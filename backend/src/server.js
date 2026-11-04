// backend/src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, withTenantTransaction, seedInitialTenants } from './config/db.js';
import { encryptSecret, decryptSecret } from './config/crypto.js';
import { signToken, requireAuth, requireSuperAdmin } from './middlewares/auth.js';
import { handleCrm } from './handlers/crm.js';
import { handleCampaigns } from './handlers/campaigns.js';
import { handleAi } from './handlers/ai.js';
import { Queue } from 'bullmq';
import { validateLicenseKey, persistLicenseValidation, getTenantLicenseStatus } from './services/LicenseService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');
const app = express();
const DEMO_MODE = process.env.DEMO_MODE === 'true' || !process.env.DATABASE_URL;

// ─── BullMQ Queues (apenas fora do DEMO_MODE) ───
let webhookQueue = null;
if (!DEMO_MODE && process.env.REDIS_URL) {
  try {
    const redisUrl = new URL(process.env.REDIS_URL);
    const connection = {
      host: redisUrl.hostname || 'localhost',
      port: Number(redisUrl.port) || 6379,
      password: redisUrl.password || undefined,
      db: Number(redisUrl.pathname?.replace('/', '') || 0),
    };
    webhookQueue = new Queue('whatsapp-webhooks', { connection });
    console.log('[BullMQ] Webhook queue connected to Redis');
  } catch (err) {
    console.error('[BullMQ] Failed to connect webhook queue:', err.message);
  }
}

if (DEMO_MODE) {
  console.log('[i9Hub] ⚠️  MODO DEMO ATIVADO - Servidor rodando sem banco de dados.');
  console.log('[i9Hub] O login aceitará qualquer credencial. Dados não serão persistidos.');
}

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
    if (DEMO_MODE) {
      const email = String(req.body?.email || 'demo@i9hub.com');
      const mockUser = { id: 'demo-user-001', name: 'Usuário Demo', email, role: 'superadmin' };
      const mockTenant = { id: 'demo-tenant-001', name: 'Empresa Demo', slug: 'demo', plan: 'pro', entitlements: ['*'] };
      const token = signToken(mockUser, mockTenant);
      return res.json({ success: true, data: { token, user: mockUser, tenant: mockTenant } });
    }
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const { rows } = await pool.query(
      `SELECT u.*, t.name AS tenant_name, t.slug AS tenant_slug, t.plan AS tenant_plan, t.active AS tenant_active, t.entitlements AS tenant_entitlements
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
        tenant: { id: user.tenant_id, name: user.tenant_name, slug: user.tenant_slug, plan: user.tenant_plan, entitlements: user.tenant_entitlements }
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
    return res.status(400).json({ success: false, error: 'Preencha todos os campos da empresa.' });
  }
  try {
    const hash = await bcrypt.hash(managerPassword, 12);
    const result = await pool.query('BEGIN');
    const tenantRes = await pool.query(
      `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
      [companyName, slug]
    );
    const tenantId = tenantRes.rows[0].id;
    await pool.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'manager')`,
      [tenantId, managerName, managerEmail.toLowerCase(), hash]
    );
    await pool.query('COMMIT');
    return res.json({ success: true, data: { tenantId, slug } });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. RPC Router Multi-Tenant (Unificado)
app.post('/api/rpc', requireAuth, async (req, res) => {
  const { type, payload } = req.body || {};
  if (!type) return res.status(400).json({ success: false, error: 'Tipo de requisição ausente.' });

  const tenantId = req.user.tenant?.id;
  const userId = req.user.id;
  const role = req.user.role;

  if (!tenantId) return res.status(403).json({ success: false, error: 'Tenant não identificado no token.' });

  // DEMO_MODE: retornar dados mock sem acessar o banco de dados
  if (DEMO_MODE) {
    const dm = {
      GET_TENANT_INFO: { id: tenantId, name: 'Empresa Demo', slug: 'demo', plan: 'pro', entitlements: ['*'], active: true, created_at: new Date().toISOString() },
      GET_SETTINGS: {},
      SAVE_SETTINGS: payload.settings || payload,
      GET_BUSINESS_PROFILE: { name: 'Empresa Demo', phone: '+5511999999999', address: 'Sao Paulo, SP' },
      SAVE_BUSINESS_PROFILE: payload.profile || payload,
      GET_DASHBOARD_STATS: { activeCampaigns: 0, sentToday: 0, successRate: 0, leadsSaved: 0, opportunities: 0, closedCustomers: 0 },
      GET_LEADS: [],
      GET_CAMPAIGNS: [],
      GET_AI_CONFIG: { enabled: false, provider: 'deepseek', model: 'deepseek-v3.2', apiKeyConfigured: false },
      GET_AI_STATUS: { enabled: false, runtimeActive: false, whatsappConnected: true },
      GET_AI_COSTS: { tokens: 0, cost: 0, messages: 0, byModel: {} },
      AI_HEARTBEAT: { active: true, timestamp: new Date().toISOString() },
      WA_STATUS: { state: 'connected', mode: 'demo', visible: true, phone: 'Modo Demo' },
      LOG: { logged: true },
     TELEMETRY_GET_PROFILE: {},
     TELEMETRY_SAVE_PROFILE: payload || {},
    };
    if (dm[type] !== undefined) return res.json({ success: true, data: dm[type] });
    console.warn(`[RPC DEMO] Handler nao implementado: ${type}`);
    return res.json({ success: true, data: null });
  }


  try {
    const result = await withTenantTransaction(tenantId, async (client) => {
      switch (type) {
        // === KV Store genérico ===
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
          const { rows: fRows } = await client.query(`SELECT COUNT(*)::int AS pending FROM followups WHERE tenant_id = $1 AND status = 'scheduled'`, [tenantId]);
          return {
            success: true,
            data: {
              totalLeads: lRows[0]?.total || 0,
              activeCampaigns: cRows[0]?.active || 0,
              pendingFollowups: fRows[0]?.pending || 0,
              messagesSent: 0,
              successRate: 100
            }
          };
        }

        case 'GET_TENANT_INFO': {
          if (DEMO_MODE) {
            return {
              success: true,
              data: {
                id: tenantId,
                name: 'Empresa Demo',
                slug: 'demo',
                plan: 'pro',
                entitlements: ['*'],
                active: true,
                created_at: new Date().toISOString()
              }
            };
          }
          const { rows } = await client.query(
            `SELECT t.id, t.name, t.slug, t.plan, t.entitlements, t.active, t.created_at
             FROM tenants t WHERE t.id = $1`,
            [tenantId]
          );
          if (!rows[0]) return { success: false, error: 'Tenant não encontrado.' };
          return { success: true, data: rows[0] };
        }

        case 'WA_STATUS':
          return {
            success: true,
            data: { state: 'connected', mode: 'vps_gateway_24x7', visible: true, phone: 'Conectado na VPS 24/7' }
          };

        default: {
          // ─── License Validation ───
          if (type === 'GET_LICENSE_STATUS') {
            if (DEMO_MODE) return { success: true, data: { licensed: false, plan: 'demo', entitlementsConfigured: false, features: [], entitlements: [] } };
            const status = await getTenantLicenseStatus(tenantId);
            return { success: true, data: status };
          }
          if (type === 'VALIDATE_LICENSE') {
            if (DEMO_MODE) return { success: false, error: 'Validação de licença indisponível em modo demo.' };
            const licenseKey = String(payload?.licenseKey || '').trim();
            if (!licenseKey) return { success: false, error: 'Chave de licença é obrigatória.' };
            const tenantRow = await client.query('SELECT slug FROM tenants WHERE id = $1', [tenantId]);
            const tenantSlug = tenantRow.rows[0]?.slug || 'unknown';
            const result = await validateLicenseKey(licenseKey, tenantSlug);
            if (result.valid) {
              await persistLicenseValidation(tenantId, licenseKey, result);
              const updatedStatus = await getTenantLicenseStatus(tenantId);
              return { success: true, data: updatedStatus };
            }
            return { success: false, error: result.error || 'Licença inválida.' };
          }

          // Tentar handlers modulares em ordem de prioridade
          const crmResult = await handleCrm(type, client, tenantId, userId, payload);
          if (crmResult) return crmResult;

          const campResult = await handleCampaigns(type, client, tenantId, userId, payload);
          if (campResult) return campResult;

          const aiResult = await handleAi(type, client, tenantId, userId, payload, getKv, setKv);
          if (aiResult) return aiResult;

          console.warn(`[RPC] Handler não encontrado: ${type} (tenant: ${tenantId})`);
          return { success: false, error: `Handler '${type}' não implementado.` };
        }
      }
    });

    return res.json(result);
  } catch (err) {
    console.error(`[RPC Error] ${type}:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Webhook WhatsApp (Evolution API → i9Hub)
app.post('/api/webhooks/whatsapp', express.json(), async (req, res) => {
  try {
    const apiKey = req.headers['apikey'] || req.headers['x-api-key'];
    if (apiKey !== process.env.WA_GATEWAY_API_KEY) {
      return res.status(401).json({ error: 'API Key inválida' });
    }
    const event = req.body?.event;
    const instanceName = req.body?.instance;
    const data = req.body?.data;
    console.log(`[WA Webhook] ${event} from ${instanceName}`);

    // Enfileirar para processamento assíncrono pelo worker BullMQ
    if (webhookQueue) {
      await webhookQueue.add(event || 'unknown', {
        event,
        instance: instanceName,
        data,
        receivedAt: new Date().toISOString(),
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      });
    } else {
      console.warn('[WA Webhook] Queue indisponível, evento não processado:', event);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[WA Webhook Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Healthcheck endpoint (usado pelo Docker e Uptime Kuma)
app.get('/api/health', async (_req, res) => {
  try {
    if (DEMO_MODE) {
      return res.json({ status: 'ok', mode: 'demo', timestamp: new Date().toISOString(), version: '1.0.0' });
    }
    await pool.query('SELECT 1');
    return res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
  } catch (err) {
    return res.status(503).json({ status: 'error', error: err.message });
  }
});

// Servir arquivos estáticos do Frontend SaaS
app.use('/lib', express.static(path.join(FRONTEND_DIR, 'sidepanel', 'lib')));
app.use(express.static(FRONTEND_DIR));
app.get('/', (_req, res) => res.redirect('/sidepanel/sidepanel.html'));

const PORT = Number(process.env.PORT || 3000);
async function startServer() {
  if (!DEMO_MODE) {
    try {
      await seedInitialTenants();
    } catch (err) {
      console.error('[FATAL] Falha ao inicializar seeds:', err);
      process.exit(1);
    }
  }
  app.listen(PORT, () => {
    console.log(`[i9Hub SaaS] Servidor rodando na porta ${PORT}${DEMO_MODE ? ' (MODO DEMO)' : ''}`);
    console.log(`[i9Hub SaaS] Acesse: http://localhost:${PORT}`);
  });
}
startServer();
