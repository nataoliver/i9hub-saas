/**
 * Admin Handlers - Painel Administrativo SuperAdmin
 * Gerencia tenants, planos, licenças, Asaas e métricas de IA
 */
import { encryptSecret } from '../config/crypto.js';

const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';

// ─── PLANOS ───
export async function handleAdmin(type, client, tenantId, userId, payload) {
  switch (type) {
    // Listar todos os planos
    case 'ADMIN_GET_PLANS': {
      const { rows } = await client.query(
        'SELECT * FROM plans ORDER BY sort_order ASC'
      );
      return { success: true, data: rows };
    }

    // Criar novo plano
    case 'ADMIN_CREATE_PLAN': {
      const { name, slug, description, priceMonthly, priceYearly, entitlements, limits } = payload;
      const { rows } = await client.query(
        `INSERT INTO plans (name, slug, description, price_monthly, price_yearly, entitlements, limits)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb) RETURNING *`,
        [name, slug, description || '', priceMonthly || 0, priceYearly || 0,
         JSON.stringify(entitlements || []), JSON.stringify(limits || {})]
      );
      return { success: true, data: rows[0] };
    }

    // Atualizar plano existente
    case 'ADMIN_UPDATE_PLAN': {
      const { id, name, description, priceMonthly, priceYearly, entitlements, limits, isActive, asaasPlanId } = payload;
      const { rows } = await client.query(
        `UPDATE plans SET
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           price_monthly = COALESCE($4, price_monthly),
           price_yearly = COALESCE($5, price_yearly),
           entitlements = COALESCE($6::jsonb, entitlements),
           limits = COALESCE($7::jsonb, limits),
           is_active = COALESCE($8, is_active),
           asaas_plan_id = COALESCE($9, asaas_plan_id),
           updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id, name, description, priceMonthly, priceYearly,
         entitlements ? JSON.stringify(entitlements) : null,
         limits ? JSON.stringify(limits) : null, isActive, asaasPlanId]
      );
      if (!rows.length) return { success: false, error: 'Plano não encontrado.' };
      return { success: true, data: rows[0] };
    }

    // Deletar plano
    case 'ADMIN_DELETE_PLAN': {
      const { id } = payload;
      await client.query('DELETE FROM plans WHERE id = $1', [id]);
      return { success: true };
    }

    // Listar catálogo de features disponíveis para seleção
    case 'ADMIN_GET_FEATURE_CATALOG': {
      const { FEATURE_CATALOG } = await import('../lib/feature-catalog.js');
      const catalog = FEATURE_CATALOG.filter(f => f.implemented === true).map(f => ({
        id: f.id,
        name: f.name,
        category: f.category,
        module: f.module || null,
        requires: f.requires || [],
      }));
      return { success: true, data: catalog };
    }

    // ─── TENANTS ───
    case 'ADMIN_GET_TENANTS': {
      const { rows } = await client.query(
        `SELECT t.id, t.name, t.slug, t.plan, t.status, t.active, t.max_users,
                t.entitlements, t.license_key, t.license_expires_at,
                t.asaas_customer_id, t.asaas_subscription_id, t.billing_email,
                t.created_at, t.updated_at,
                (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS user_count
         FROM tenants t ORDER BY t.created_at DESC`
      );
      return { success: true, data: rows };
    }

    // Criar tenant manualmente
    case 'ADMIN_CREATE_TENANT': {
      const { name, slug, plan, email, password, entitlements } = payload;
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.default.hash(password || 'temp123', 12);

      const tenantRes = await client.query(
        `INSERT INTO tenants (name, slug, plan, entitlements, active)
         VALUES ($1, $2, $3, $4::jsonb, true) RETURNING id`,
        [name, slug, plan || 'starter', JSON.stringify(entitlements || [])]
      );
      const newTenantId = tenantRes.rows[0].id;

      await client.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, 'owner')`,
        [newTenantId, name, email, hash]
      );

      return { success: true, data: { tenantId: newTenantId } };
    }

    // Atualizar licença/plano de um tenant
    case 'ADMIN_UPDATE_TENANT_LICENSE': {
      const { tenantId: targetTenantId, plan, entitlements, licenseExpiresAt, active } = payload;
      const { rows } = await client.query(
        `UPDATE tenants SET
           plan = COALESCE($2, plan),
           entitlements = COALESCE($3::jsonb, entitlements),
           license_expires_at = COALESCE($4::timestamptz, license_expires_at),
           active = COALESCE($5, active),
           updated_at = NOW()
         WHERE id = $1 RETURNING id, name, plan, active, entitlements`,
        [targetTenantId, plan,
         entitlements ? JSON.stringify(entitlements) : null,
         licenseExpiresAt || null, active]
      );
      if (!rows.length) return { success: false, error: 'Tenant não encontrado.' };
      return { success: true, data: rows[0] };
    }

    // ─── ASAAS INTEGRATION ───
    case 'ADMIN_GET_ASAAS_CONFIG': {
      const cfg = await getKvInternal(client, 'system', 'asaas_config', {
        apiKeyConfigured: !!ASAAS_API_KEY,
        webhookUrl: process.env.ASAAS_WEBHOOK_URL || '',
        defaultPlanSlug: 'starter',
      });
      return { success: true, data: { ...cfg, apiKey: '' } };
    }

    case 'ADMIN_SAVE_ASAAS_CONFIG': {
      const { webhookUrl, defaultPlanSlug } = payload;
      const cfg = {
        apiKeyConfigured: !!ASAAS_API_KEY,
        webhookUrl: webhookUrl || '',
        defaultPlanSlug: defaultPlanSlug || 'starter',
        updatedAt: new Date().toISOString(),
      };
      await setKvInternal(client, 'system', 'asaas_config', cfg);
      return { success: true, data: cfg };
    }

    // Gerar link de pagamento Asaas para um tenant
    case 'ADMIN_GENERATE_PAYMENT_LINK': {
      const { tenantId: targetTenantId, planSlug, billingType } = payload;
      if (!ASAAS_API_KEY) {
        return { success: false, error: 'ASAAS_API_KEY não configurada no servidor.' };
      }

      // Buscar plano
      const planRes = await client.query(
        'SELECT * FROM plans WHERE slug = $1 LIMIT 1', [planSlug]
      );
      if (!planRes.rows.length) return { success: false, error: 'Plano não encontrado.' };
      const plan = planRes.rows[0];

      // Buscar tenant
      const tenantRes = await client.query(
        'SELECT * FROM tenants WHERE id = $1 LIMIT 1', [targetTenantId]
      );
      if (!tenantRes.rows.length) return { success: false, error: 'Tenant não encontrado.' };
      const tenant = tenantRes.rows[0];

      // Criar ou buscar customer no Asaas
      let customerId = tenant.asaas_customer_id;
      if (!customerId) {
        const customerRes = await fetch(`${ASAAS_API_URL}/customers`, {
          method: 'POST',
          headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tenant.name,
            email: tenant.billing_email || `${tenant.slug}@i9ads.com.br`,
            externalReference: tenant.id,
          }),
        });
        if (!customerRes.ok) {
          const err = await customerRes.text();
          return { success: false, error: `Asaas customer error: ${err}` };
        }
        const customerData = await customerRes.json();
        customerId = customerData.id;
        await client.query(
          'UPDATE tenants SET asaas_customer_id = $1, updated_at = NOW() WHERE id = $2',
          [customerId, targetTenantId]
        );
      }

      // Gerar link de pagamento
      const amount = billingType === 'yearly' ? plan.price_yearly : plan.price_monthly;
      const linkRes = await fetch(`${ASAAS_API_URL}/paymentLinks`, {
        method: 'POST',
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `i9Hub - ${plan.name} (${billingType === 'yearly' ? 'Anual' : 'Mensal'})`,
          description: `Plano ${plan.name} - i9Hub SaaS`,
          value: Number(amount),
          billingType: 'UNDEFINED',
          chargeType: 'DETACHED',
          subscription: false,
          customer: customerId,
          externalReference: `${tenant.id}:${plan.slug}:${billingType}`,
          redirectUrl: process.env.APP_URL || 'https://app.i9ads.com.br',
        }),
      });

      if (!linkRes.ok) {
        const err = await linkRes.text();
        return { success: false, error: `Asaas payment link error: ${err}` };
      }
      const linkData = await linkRes.json();

      return {
        success: true,
        data: {
          paymentUrl: linkData.url || linkData.paymentUrl,
          linkId: linkData.id,
          amount: Number(amount),
          plan: plan.name,
          billingType,
        },
      };
    }

    // ─── MÉTRICAS E ANALYTICS ───
    case 'ADMIN_GET_DASHBOARD': {
      const tenantsCount = await client.query('SELECT COUNT(*) AS c FROM tenants');
      const activeTenants = await client.query("SELECT COUNT(*) AS c FROM tenants WHERE active = true");
      const usersCount = await client.query('SELECT COUNT(*) AS c FROM users');
      const aiUsageToday = await client.query(
        "SELECT COALESCE(SUM(cost_usd), 0) AS total_cost, COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens FROM ai_usage WHERE created_at >= CURRENT_DATE"
      );
      const aiUsageMonth = await client.query(
        "SELECT COALESCE(SUM(cost_usd), 0) AS total_cost, COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens FROM ai_usage WHERE created_at >= date_trunc('month', CURRENT_DATE)"
      );
      const recentSignups = await client.query(
        "SELECT name, slug, plan, created_at FROM tenants ORDER BY created_at DESC LIMIT 10"
      );

      return {
        success: true,
        data: {
          tenants: { total: Number(tenantsCount.rows[0].c), active: Number(activeTenants.rows[0].c) },
          users: Number(usersCount.rows[0].c),
          ai: {
            todayCost: Number(aiUsageToday.rows[0].total_cost),
            todayTokens: Number(aiUsageToday.rows[0].total_tokens),
            monthCost: Number(aiUsageMonth.rows[0].total_cost),
            monthTokens: Number(aiUsageMonth.rows[0].total_tokens),
          },
          recentSignups: recentSignups.rows,
        },
      };
    }

    case 'ADMIN_GET_AI_USAGE': {
      const { days = 30, targetTenantId } = payload || {};
      let query = `
        SELECT tenant_id, provider, model,
               SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens,
               SUM(cost_usd) AS total_cost, COUNT(*) AS requests
        FROM ai_usage
        WHERE created_at >= NOW() - INTERVAL '${Number(days)} days'
      `;
      const params = [];
      if (targetTenantId) {
        query += ' AND tenant_id = $1';
        params.push(targetTenantId);
      }
      query += ' GROUP BY tenant_id, provider, model ORDER BY total_cost DESC';
      const { rows } = await client.query(query, params);
      return { success: true, data: rows };
    }

    // ─── PROPÇÃO ATIVA / CONTATOS UNIFICADOS ───
    case 'ADMIN_GET_UNIFIED_CONTACTS': {
      const { search, limit = 50, offset = 0 } = payload || {};
      let query = 'SELECT * FROM unified_contacts';
      const params = [];
      if (search) {
        query += ' WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1';
        params.push(`%${search}%`);
      }
      query += ' ORDER BY updated_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);
      const { rows } = await client.query(query, params);
      return { success: true, data: rows };
    }

    case 'ADMIN_SYNC_CONTACTS': {
      const { contacts = [] } = payload;
      let synced = 0;
      for (const c of contacts) {
        if (!c.phone && !c.email) continue;
        await client.query(
          `INSERT INTO unified_contacts (tenant_id, name, phone, email, channels, tags, opt_in_whatsapp, opt_in_rcs, opt_in_email)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
           ON CONFLICT (tenant_id, phone) DO UPDATE SET
             name = COALESCE(EXCLUDED.name, unified_contacts.name),
             email = COALESCE(EXCLUDED.email, unified_contacts.email),
             channels = EXCLUDED.channels,
             tags = EXCLUDED.tags,
             opt_in_whatsapp = EXCLUDED.opt_in_whatsapp,
             opt_in_rcs = EXCLUDED.opt_in_rcs,
             opt_in_email = EXCLUDED.opt_in_email,
             updated_at = NOW()`,
          [
            c.tenantId || tenantId, c.name || '', c.phone || null, c.email || null,
            JSON.stringify(c.channels || {}), c.tags || [],
            c.optInWhatsapp !== false, c.optInRcs || false, c.optInEmail !== false,
          ]
        );
        synced++;
      }
      return { success: true, data: { synced } };
    }

    default:
      return null;
  }
}

// Helpers internos de KV (sem dependência do server.js)
async function getKvInternal(client, tenantId, key, fallback) {
  try {
    const { rows } = await client.query(
      'SELECT store_value FROM tenant_kv_store WHERE tenant_id = $1 AND store_key = $2',
      [tenantId, key]
    );
    return rows[0]?.store_value ?? fallback;
  } catch {
    return fallback;
  }
}

async function setKvInternal(client, tenantId, key, value) {
  await client.query(
    `INSERT INTO tenant_kv_store (tenant_id, store_key, store_value, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (tenant_id, store_key)
     DO UPDATE SET store_value = EXCLUDED.store_value, updated_at = NOW()`,
    [tenantId, key, JSON.stringify(value ?? {})]
  );
}
