// backend/src/services/LicenseService.js
// Serviço de validação de licença contra Painel de Licenças externo
import { pool } from '../config/db.js';

const LICENSE_API_URL = process.env.LICENSE_API_URL || '';
const LICENSE_API_KEY = process.env.LICENSE_API_KEY || '';

/**
 * Valida uma chave de licença junto ao painel emissor externo.
 * Retorna objeto com status, plano, expiração e entitlements.
 */
export async function validateLicenseKey(licenseKey, tenantSlug) {
  if (!LICENSE_API_URL) {
    console.warn('[License] LICENSE_API_URL não configurada, pulando validação externa.');
    return { valid: false, error: 'Serviço de licenciamento não configurado.' };
  }

  try {
    const res = await fetch(LICENSE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LICENSE_API_KEY}`,
      },
      body: JSON.stringify({
        license_key: licenseKey,
        tenant_slug: tenantSlug,
        product: 'i9hub-saas',
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[License] API retornou ${res.status}: ${errBody}`);
      return { valid: false, error: `Painel de licenças retornou erro ${res.status}.` };
    }

    const data = await res.json();
    return {
      valid: data.valid === true,
      plan: data.plan || 'basic',
      expiresAt: data.expires_at || null,
      entitlements: Array.isArray(data.entitlements) ? data.entitlements : [],
      maxUsers: data.max_users || 1,
      raw: data,
    };
  } catch (err) {
    console.error('[License] Erro na requisição ao painel:', err.message);
    return { valid: false, error: `Falha de comunicação com o painel de licenças: ${err.message}` };
  }
}

/**
 * Persiste o resultado da validação de licença no tenant.
 */
export async function persistLicenseValidation(tenantId, licenseKey, validationResult) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (validationResult.valid) {
      // Atualizar tenant com dados da licença válida
      await client.query(
        `UPDATE tenants SET
           plan = $1,
           active = true,
           entitlements = $2::jsonb,
           license_key = $3,
           license_expires_at = $4,
           updated_at = NOW()
         WHERE id = $5`,
        [
          validationResult.plan,
          JSON.stringify(validationResult.entitlements),
          licenseKey,
          validationResult.expiresAt || null,
          tenantId,
        ]
      );
    } else {
      // Registrar tentativa inválida sem alterar plano atual
      await client.query(
        `UPDATE tenants SET updated_at = NOW() WHERE id = $1`,
        [tenantId]
      );
    }

    // Log de auditoria
    await client.query(
      `INSERT INTO license_audit_log (tenant_id, license_key, valid, plan, response, validated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
      [
        tenantId,
        licenseKey,
        validationResult.valid,
        validationResult.plan || null,
        JSON.stringify(validationResult.raw || { error: validationResult.error }),
      ]
    ).catch((err) => {
      // Tabela de auditoria pode não existir ainda; log apenas
      console.warn('[License] Audit log insert failed (table may not exist):', err.message);
    });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Obtém o status atual da licença do tenant.
 */
export async function getTenantLicenseStatus(tenantId) {
  const { rows } = await pool.query(
    `SELECT plan, active, entitlements, license_key, license_expires_at
     FROM tenants WHERE id = $1 LIMIT 1`,
    [tenantId]
  );

  if (rows.length === 0) {
    return { licensed: false, error: 'Tenant não encontrado.' };
  }

  const t = rows[0];
  const now = new Date();
  const expired = t.license_expires_at && new Date(t.license_expires_at) < now;
  const hasKey = !!t.license_key;
  const isActive = t.active === true && !expired;
  const entitlements = Array.isArray(t.entitlements) ? t.entitlements : [];
  const allFeatures = entitlements.includes('*');

  return {
    licensed: hasKey && isActive,
    plan: t.plan || 'free',
    expiresAt: t.license_expires_at || null,
    expired: expired || false,
    entitlements,
    entitlementsConfigured: allFeatures || entitlements.length > 0,
    features: allFeatures
      ? [{ name: 'all', enabled: true, implemented: true }]
      : entitlements.map((e) => ({ name: e, enabled: true, implemented: true })),
  };
}