// backend/src/server.js
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, withTenantTransaction, seedInitialTenants } from './config/db.js';
import { encryptSecret, decryptSecret } from './config/crypto.js';
import { signToken, requireAuth, requireSuperAdmin } from './middlewares/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');
const app = express();

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Auxiliares de KV Store por Tenant
async function getKv(client, tenantId, key, fallback = null) {
  const { rows } = await client.query(
    `SELECT store_value FROM tenant_kv_store WHERE tenant_id = $1 AND store_key = $2`,
    [tenantId, key]
  );
  return rows[0]?.store_value ?? fallback;
}

async function setKv(client, tenantId, key, value) {
  await client.query(
    `INSERT INTO tenant_kv_store (tenant_id, store_key, store_value, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (tenant_id, store_key)
     DO UPDATE SET store_value = EXCLUDED.store_value, updated_at = NOW()`,
    [tenantId, key, JSON.stringify(value ?? {})]
  );
}

// 1. Endpoint de Login Multi-Tenant
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const { rows } = await pool.query(
      `SELECT u.*, t.name AS tenant_name, t.slug AS tenant_slug, t.plan AS tenant_plan, t.active AS tenant_active
       FROM users u JOIN tenants t ON t.id = u.tenant_id
       WHERE LOWER(u.email) = $1 LIMIT 1`,
      [email]
    );
    const user = rows[0];
    if (!user || !user.active || !user.tenant_active) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas ou empresa inativa.' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'E-mail ou senha incorretos.' });
    }
    const token = signToken(user, { id: user.tenant_id, name: user.tenant_name, slug: user.tenant_slug, plan: user.tenant_plan });
    return res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        tenant: { id: user.tenant_id, name: user.tenant_name, slug: user.tenant_slug, plan: user.tenant_plan }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Endpoints Super Admin (Gestão de Empresas / Tenants)
app.get('/api/admin/tenants', requireAuth, requireSuperAdmin, async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT t.*,
      (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id) AS users_count,
      (SELECT COUNT(*)::int FROM leads l WHERE l.tenant_id = t.id) AS leads_count
    FROM tenants t ORDER BY t.created_at DESC
  `);
  res.json({ success: true, data: rows });
});

app.post('/api/admin/tenants', requireAuth, requireSuperAdmin, async (req, res) => {
  const { companyName, slug, managerName, managerEmail, managerPassword } = req.body || {};
  if (!companyName || !slug || !managerEmail || !managerPassword) {
    return res.status(400).json({ success: false, error: 'Preencha todos os campos da empresa e do gestor.' });
  }
  const passHash = await bcrypt.hash(String(managerPassword), 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tRes = await client.query(
      `INSERT INTO tenants (name, slug, plan, active) VALUES ($1, $2, 'pro', true) RETURNING *`,
      [companyName, String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-')]
    );
    const tenant = tRes.rows[0];
    await client.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'manager')`,
      [tenant.id, managerName || 'Gestor', String(managerEmail).toLowerCase(), passHash]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: tenant });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// 3. Roteador RPC Central (Substitui chrome.runtime.sendMessage mantendo 100% de compatibilidade com as Views)
app.post('/api/rpc', requireAuth, async (req, res) => {
  const { type, payload = {} } = req.body || {};
  const { tenantId, sub: userId, role, viewOnlyOwnLeads, tenantName, plan } = req.auth;

  try {
    const result = await withTenantTransaction(tenantId, async (client) => {
      switch (type) {
        case 'GET_LICENSE_STATUS':
          return {
            success: true,
            data: {
              licensed: true,
              plan: plan || 'pro',
              status: 'active',
              tenantName,
              entitlementsConfigured: true,
              entitlements: ['*'],
              features: [{ id: '*', enabled: true }]
            }
          };

        case 'GET_USAGE_STATUS':
          return { success: true, data: { used: 0, limit: 999999, remaining: 999999, plan: plan || 'pro' } };

        case 'GET_SAVED_LEADS': {
          const params = [tenantId];
          let sql = `SELECT data, seller_id FROM leads WHERE tenant_id = $1`;
          if (role === 'seller' && viewOnlyOwnLeads) {
            params.push(userId);
            sql += ` AND seller_id = $2`;
          }
          sql += ` ORDER BY updated_at DESC`;
          const { rows } = await client.query(sql, params);
          return { success: true, data: rows.map((r) => ({ ...r.data, commercialOwnerId: r.seller_id || r.data?.commercialOwnerId || '' })) };
        }

        case 'SAVE_LEADS': {
          const list = Array.isArray(payload.leads) ? payload.leads : [];
          for (const item of list) {
            const id = String(item.id || item.placeId || item.phone || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
            const leadObj = { ...item, id, source: item.source || payload.source || 'manual', extractedAt: item.extractedAt || new Date().toISOString() };
            await client.query(
              `INSERT INTO leads (id, tenant_id, seller_id, name, phone, email, stage, tipo, lead_score, blacklisted, data, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())
               ON CONFLICT (tenant_id, id) DO UPDATE SET
                 name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email,
                 stage = EXCLUDED.stage, tipo = EXCLUDED.tipo, blacklisted = EXCLUDED.blacklisted,
                 data = EXCLUDED.data, updated_at = NOW()`,
              [id, tenantId, userId, leadObj.name || '', leadObj.phone || '', leadObj.email || '', leadObj.stage || 'novo', leadObj.tipo || 'a_classificar', Number(leadObj.leadScore || 0), !!leadObj.blacklisted, JSON.stringify(leadObj)]
            );
          }
          return { success: true, data: { saved: list.length } };
        }

        case 'UPDATE_LEAD_STAGE': {
          const id = String(payload.leadId || '');
          const { rows } = await client.query(`SELECT data FROM leads WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
          if (!rows[0]) return { success: false, error: 'Lead não encontrado nesta empresa.' };
          const updated = { ...rows[0].data, stage: payload.stage, updatedAt: new Date().toISOString() };
          await client.query(`UPDATE leads SET stage = $1, data = $2::jsonb, updated_at = NOW() WHERE tenant_id = $3 AND id = $4`, [payload.stage, JSON.stringify(updated), tenantId, id]);
          return { success: true, data: updated };
        }

        case 'UPDATE_LEAD_TYPE':
        case 'UPDATE_LEADS_TYPE': {
          const ids = Array.isArray(payload.leadIds) ? payload.leadIds : [payload.leadId];
          for (const rawId of ids.filter(Boolean)) {
            const { rows } = await client.query(`SELECT data FROM leads WHERE tenant_id = $1 AND id = $2`, [tenantId, String(rawId)]);
            if (!rows[0]) continue;
            const updated = { ...rows[0].data, tipo: payload.tipo, tipoMotivo: payload.motivo || '', tipoManual: true };
            await client.query(`UPDATE leads SET tipo = $1, data = $2::jsonb, updated_at = NOW() WHERE tenant_id = $3 AND id = $4`, [payload.tipo, JSON.stringify(updated), tenantId, String(rawId)]);
          }
          return { success: true };
        }

        case 'DELETE_LEAD':
          await client.query(`DELETE FROM leads WHERE tenant_id = $1 AND id = $2`, [tenantId, String(payload.leadId || '')]);
          return { success: true };

        case 'CLEAR_ALL_LEADS':
          if (role === 'seller') return { success: false, error: 'Apenas gestores podem limpar a base da empresa.' };
          await client.query(`DELETE FROM leads WHERE tenant_id = $1`, [tenantId]);
          return { success: true };

        case 'GET_CAMPAIGNS': {
          const { rows } = await client.query(`SELECT data FROM campaigns WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
          return { success: true, data: rows.map((r) => r.data) };
        }

        case 'CREATE_CAMPAIGN': {
          const id = `camp_${Date.now().toString(36)}`;
          const camp = {
            id,
            name: payload.name,
            template: payload.template,
            contacts: (payload.contacts || []).map((c) => ({ ...c, status: 'pending' })),
            total: (payload.contacts || []).length,
            sent: 0, failed: 0, skipped: 0,
            status: 'draft',
            createdAt: new Date().toISOString()
          };
          await client.query(
            `INSERT INTO campaigns (id, tenant_id, created_by, name, status, data) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
            [id, tenantId, userId, camp.name, camp.status, JSON.stringify(camp)]
          );
          return { success: true, data: camp };
        }

        case 'AI_GET_CONFIG': {
          const cfg = await getKv(client, tenantId, 'ai_config', {
            enabled: false,
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            operationMode: 'observe_only',
            personaMode: 'commercial',
            chatMode: 'private_only',
            apiKeyConfigured: false,
            providerVerified: false
          });
          return { success: true, data: { ...cfg, apiKey: '' } };
        }

        case 'AI_SAVE_CONFIG': {
          const current = await getKv(client, tenantId, 'ai_config', {});
          const encryptedKey = payload.apiKey ? encryptSecret(payload.apiKey) : current.encryptedApiKey || '';
          const merged = {
            ...current,
            ...payload,
            apiKey: '',
            encryptedApiKey: encryptedKey,
            apiKeyConfigured: !!encryptedKey,
            modelConfigured: !!(payload.model || current.model),
            providerVerified: !!(encryptedKey && (payload.model || current.model)),
            updatedAt: new Date().toISOString()
          };
          await setKv(client, tenantId, 'ai_config', merged);
          return { success: true, data: { ...merged, apiKey: '' } };
        }

        case 'AI_SET_ENABLED': {
          const current = await getKv(client, tenantId, 'ai_config', {});
          current.enabled = !!payload.enabled;
          current.updatedAt = new Date().toISOString();
          await setKv(client, tenantId, 'ai_config', current);
          return { success: true, data: await buildAiStatus(client, tenantId) };
        }

        case 'AI_GET_STATUS':
          return { success: true, data: await buildAiStatus(client, tenantId) };

        case 'WA_STATUS':
          return {
            success: true,
            data: { state: 'connected', mode: 'vps_gateway_24x7', visible: true, phone: 'Conectado na VPS 24/7' }
          };

        case 'GET_SETTINGS':
          return { success: true, data: await getKv(client, tenantId, 'settings', {}) };

        case 'SAVE_SETTINGS': {
          const st = { ...(await getKv(client, tenantId, 'settings', {})), ...(payload.settings || payload) };
          await setKv(client, tenantId, 'settings', st);
          return { success: true, data: st };
        }

        case 'GET_BUSINESS_PROFILE':
          return { success: true, data: await getKv(client, tenantId, 'business_profile', null) };

        case 'SAVE_BUSINESS_PROFILE':
          await setKv(client, tenantId, 'business_profile', payload.profile || payload);
          return { success: true, data: payload.profile || payload };

        case 'GET_STAGES':
          return { success: true, data: await getKv(client, tenantId, 'crm_stages', null) };

        case 'GET_NICHE_TAXONOMY':
          return { success: true, data: await getKv(client, tenantId, 'niche_taxonomy', { nodes: [] }) };

        case 'GET_BLACKLIST':
          return { success: true, data: await getKv(client, tenantId, 'blacklist', []) };

        case 'GET_FOLLOWUPS': {
          const { rows } = await client.query(`SELECT data FROM followups WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
          return { success: true, data: rows.map((r) => r.data) };
        }

        case 'GET_DASHBOARD_STATS': {
          const { rows: lRows } = await client.query(`SELECT COUNT(*)::int AS total FROM leads WHERE tenant_id = $1`, [tenantId]);
          const { rows: cRows } = await client.query(`SELECT COUNT(*)::int AS active FROM campaigns WHERE tenant_id = $1 AND status = 'running'`, [tenantId]);
          return {
            success: true,
            data: { totalLeads: lRows[0]?.total || 0, activeCampaigns: cRows[0]?.active || 0, messagesSent: 0, successRate: 100 }
          };
        }

        default:
          return { success: true, data: {} };
      }
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

async function buildAiStatus(client, tenantId) {
  const cfg = await getKv(client, tenantId, 'ai_config', {});
  const events = await getKv(client, tenantId, 'ai_monitor_events', []);
  return {
    enabled: !!cfg.enabled,
    runtimeActive: true,
    panelActive: true,
    whatsappConnected: true,
    provider: cfg.provider || 'gemini',
    model: cfg.model || 'gemini-2.5-flash',
    operationMode: cfg.operationMode === 'observe_only' ? 'observe_only' : 'auto_reply',
    personaMode: cfg.personaMode || 'commercial',
    apiKeyConfigured: !!cfg.apiKeyConfigured,
    modelConfigured: !!cfg.modelConfigured,
    providerVerified: !!cfg.providerVerified,
    storeWatcher: { active: true, via: 'vps-webhook-24x7' },
    monitoring: {
      retainedEvents: events.length,
      retentionLimit: 500,
      totals: { received: events.length, responses: 0, analyzed: events.length, observerNoChange: 0, errors: 0, classified: events.length, qualified: 0 },
      byPersona: [],
      recentEvents: events.slice(0, 20),
      recentErrors: []
    }
  };
}

// Servir arquivos estáticos do Frontend SaaS
app.use(express.static(FRONTEND_DIR));
app.get('/', (_req, res) => res.redirect('/sidepanel/sidepanel.html'));

const PORT = Number(process.env.PORT || 3000);
seedInitialTenants().then(() => {
  app.listen(PORT, () => {
    console.log(`[i9Hub SaaS 24/7] Servidor Multi-Tenant rodando na porta ${PORT}`);
  });
});