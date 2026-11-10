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
import { handleAdmin } from './handlers/admin.js';
import { Queue } from 'bullmq';
import { validateLicenseKey, persistLicenseValidation, getTenantLicenseStatus } from './services/LicenseService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');
const app = express();
const DEMO_MODE = process.env.DEMO_MODE === 'true' || !process.env.DATABASE_URL;

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
  console.log('[i9Hub] MODO DEMO ATIVADO - Servidor rodando sem banco de dados.');
}

app.use(cors());
app.use(express.json({ limit: '15mb' }));

async function getKv(client, tenantId, key, fallback = null) {
  const { rows } = await client.query(
    'SELECT store_value FROM tenant_kv_store WHERE tenant_id = $1 AND store_key = $2',
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

// 1. Login Multi-Tenant
app.post('/api/auth/login', async (req, res) => {
  try {
    if (DEMO_MODE) {
      const email = String(req.body?.email || 'demo@i9hub.com');
      const mockUser = { id: 'demo-user-001', name: 'Usuario Demo', email, role: 'superadmin' };
      const mockTenant = { id: 'demo-tenant-001', name: 'Empresa Demo', slug: 'demo', plan: 'pro', entitlements: ['*'] };
      const token = signToken(mockUser, mockTenant);
      return res.json({ success: true, data: { token, user: mockUser, tenant: mockTenant } });
    }
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const { rows } = await pool.query(
      `SELECT u.*, t.name AS tenant_name, t.slug AS tenant_slug, t.plan AS tenant_plan,
              t.active AS tenant_active, t.entitlements AS tenant_entitlements
       FROM users u JOIN tenants t ON t.id = u.tenant_id
       WHERE LOWER(u.email) = $1 AND u.is_active = true LIMIT 1`,
      [email]
    );
    if (!rows.length) return res.status(401).json({ success: false, error: 'Credenciais invalidas.' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, error: 'Credenciais invalidas.' });
    if (!user.tenant_active) return res.status(403).json({ success: false, error: 'Tenant suspenso ou inativo.' });
    const tenant = { id: user.tenant_id, name: user.tenant_name, slug: user.tenant_slug, plan: user.tenant_plan, entitlements: user.tenant_entitlements || [] };
    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = signToken(safeUser, tenant);
    return res.json({ success: true, data: { token, user: safeUser, tenant } });
  } catch (err) {
    console.error('[Login Error]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Validacao de Licenca
app.post('/api/license/validate', requireAuth, async (req, res) => {
  try {
    if (DEMO_MODE) return res.json({ success: true, data: { valid: true, plan: 'pro', entitlements: ['*'] } });
    const { licenseKey } = req.body || {};
    if (!licenseKey) return res.status(400).json({ success: false, error: 'Chave de licenca obrigatoria.' });
    const result = await validateLicenseKey(licenseKey, req.user.tenant?.slug);
    if (result.valid) {
      await persistLicenseValidation(req.user.tenant.id, licenseKey, result);
    }
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/license/status', requireAuth, async (req, res) => {
  try {
    if (DEMO_MODE) return res.json({ success: true, data: { licensed: true, plan: 'pro', entitlements: ['*'] } });
    const status = await getTenantLicenseStatus(req.user.tenant.id);
    return res.json({ success: true, data: status });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. RPC Unificado
app.post('/api/rpc', requireAuth, async (req, res) => {
  const { type, payload = {} } = req.body || {};
  if (!type) return res.status(400).json({ success: false, error: 'Tipo de requisicao obrigatorio.' });
  const tenantId = req.user.tenant?.id;
  const userId = req.user.id;

  try {
    if (DEMO_MODE) {
      return res.json({ success: true, data: { demo: true, type } });
    }

    const result = await withTenantTransaction(tenantId, async (client) => {
      // Handlers administrativos (apenas superadmin)
      if (String(type).startsWith('ADMIN_')) {
        if (req.user?.role !== 'superadmin') {
          return { success: false, error: 'Acesso restrito a super administradores.' };
        }
        const adminResult = await handleAdmin(type, client, tenantId, userId, payload);
        if (adminResult) return adminResult;
      }

      // Validacao de licenca via RPC
      if (type === 'LICENSE_VALIDATE') {
        const { licenseKey } = payload;
        if (!licenseKey) return { success: false, error: 'Chave de licenca obrigatoria.' };
        const result = await validateLicenseKey(licenseKey, req.user.tenant?.slug);
        if (result.valid) {
          await persistLicenseValidation(tenantId, licenseKey, result);
          const updatedStatus = await getTenantLicenseStatus(tenantId);
          return { success: true, data: updatedStatus };
        }
        return { success: false, error: result.error || 'Licenca invalida.' };
      }

      const crmResult = await handleCrm(type, client, tenantId, userId, payload);
      if (crmResult) return crmResult;

      const campResult = await handleCampaigns(type, client, tenantId, userId, payload);
      if (campResult) return campResult;

      const aiResult = await handleAi(type, client, tenantId, userId, payload, getKv, setKv);
      if (aiResult) return aiResult;

      console.warn(`[RPC] Handler nao encontrado: ${type} (tenant: ${tenantId})`);
      return { success: false, error: `Handler '${type}' nao implementado.` };
    });

    return res.json(result);
  } catch (err) {
    console.error(`[RPC Error] ${type}:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Webhook WhatsApp
app.post('/api/webhooks/whatsapp', express.json(), async (req, res) => {
  try {
    const apiKey = req.headers['apikey'] || req.headers['x-api-key'];
    if (apiKey !== process.env.WA_GATEWAY_API_KEY) {
      return res.status(401).json({ error: 'API Key invalida' });
    }
    const event = req.body?.event;
    const instanceName = req.body?.instance;
    const data = req.body?.data;
    console.log(`[WA Webhook] ${event} from ${instanceName}`);
    if (webhookQueue) {
      await webhookQueue.add(event || 'unknown', {
        event, instance: instanceName, data, receivedAt: new Date().toISOString(),
      }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 } });
    }
    return res.json({ received: true });
  } catch (err) {
    console.error('[WA Webhook Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// 5. Webhook Asaas (confirmacao de pagamento)
app.post('/api/webhooks/asaas', express.json(), async (req, res) => {
  try {
    const event = req.body?.event;
    const payment = req.body?.payment || req.body;
    const externalRef = payment?.externalReference || '';
    console.log(`[Asaas Webhook] ${event} ref=${externalRef}`);

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      const parts = String(externalRef).split(':');
      if (parts.length >= 2) {
        const [tenantId, planSlug] = parts;
        const billingType = parts[2] || 'monthly';

        // Buscar plano e seus entitlements
        const { rows: planRows } = await pool.query(
          'SELECT entitlements, limits FROM plans WHERE slug = $1 LIMIT 1', [planSlug]
        );
        if (planRows.length) {
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + (billingType === 'yearly' ? 1 : 0));
          expiresAt.setMonth(expiresAt.getMonth() + (billingType === 'yearly' ? 0 : 1));

          await pool.query(
            `UPDATE tenants SET
               plan = $1, entitlements = $2::jsonb, active = true,
               license_expires_at = $3, updated_at = NOW()
             WHERE id = $4`,
            [planSlug, JSON.stringify(planRows[0].entitlements || []), expiresAt.toISOString(), tenantId]
          );
          console.log(`[Asaas] Tenant ${tenantId} ativado plano ${planSlug} ate ${expiresAt.toISOString()}`);
        }
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[Asaas Webhook Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Healthcheck
app.get('/api/health', async (_req, res) => {
  try {
    if (DEMO_MODE) return res.json({ status: 'ok', mode: 'demo', timestamp: new Date().toISOString(), version: '1.0.0' });
    await pool.query('SELECT 1');
    return res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
  } catch (err) {
    return res.status(503).json({ status: 'error', error: err.message });
  }
});

// Frontend estatico
app.use('/lib', express.static(path.join(FRONTEND_DIR, 'sidepanel', 'lib')));
app.use(express.static(FRONTEND_DIR));
app.get('/', (_req, res) => res.redirect('/sidepanel/sidepanel.html'));
app.get('/admin', (_req, res) => res.sendFile(path.join(FRONTEND_DIR, 'admin', 'index.html')));

const PORT = Number(process.env.PORT || 3000);
async function startServer() {
  if (!DEMO_MODE) {
    try { await seedInitialTenants(); }
    catch (err) { console.error('[FATAL] Falha ao inicializar seeds:', err); process.exit(1); }
  }
  app.listen(PORT, () => {
    console.log(`[i9Hub SaaS] Servidor rodando na porta ${PORT}${DEMO_MODE ? ' (MODO DEMO)' : ''}`);
  });
}
startServer();
