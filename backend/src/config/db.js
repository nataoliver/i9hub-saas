// backend/src/config/db.js
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: Number(process.env.PG_POOL_MIN || 2),
  max: Number(process.env.PG_POOL_MAX || 20),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PG] Unexpected pool error:', err.message);
});

export async function withTenantTransaction(tenantId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function seedInitialTenants() {
  const bcrypt = await import('bcryptjs');

  // Verificar se superadmin ja existe
  const { rows: existingAdmin } = await pool.query(
    "SELECT id FROM users WHERE email = 'contato@i9ads.com.br' LIMIT 1"
  );

  if (existingAdmin.length === 0) {
    console.log('[Seed] Criando tenant i9Ads e superadmin contato@i9ads.com.br...');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Tenant i9Ads (administrativo)
      const i9adsRes = await client.query(
        `INSERT INTO tenants (name, slug, plan, entitlements, active)
         VALUES ($1, $2, $3, $4::jsonb, true)
         ON CONFLICT (slug) DO UPDATE SET entitlements = EXCLUDED.entitlements
         RETURNING id`,
        ['i9Ads', 'i9ads', 'enterprise', '["*","admin.full_access"]']
      );
      const i9adsTenantId = i9adsRes.rows[0].id;

      const superHash = await bcrypt.default.hash(
        process.env.SUPERADMIN_PASSWORD || 'I9Ads@2026!Xyz', 12
      );
      await client.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, email) DO NOTHING`,
        [i9adsTenantId, 'Super Admin i9Ads', 'contato@i9ads.com.br', superHash, 'superadmin']
      );

      await client.query('COMMIT');
      console.log('[Seed] Superadmin criado: contato@i9ads.com.br');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[Seed] Erro ao criar superadmin:', err.message);
    } finally {
      client.release();
    }
  } else {
    console.log('[Seed] Superadmin contato@i9ads.com.br ja existe.');
  }

  // Seed demo tenant
  const { rows } = await pool.query("SELECT id FROM tenants WHERE slug = 'demo' LIMIT 1");
  if (rows.length > 0) {
    console.log('[Seed] Tenant demo ja existe, pulando.');
    return;
  }

  console.log('[Seed] Criando tenant demo...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tenantRes = await client.query(
      `INSERT INTO tenants (name, slug, plan, entitlements)
       VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
      ['Empresa Demo', 'demo', 'pro', '["*"]']
    );
    const tenantId = tenantRes.rows[0].id;

    const hash = await bcrypt.default.hash('admin123', 12);
    await client.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, 'Administrador', 'admin@demo.com', hash, 'owner']
    );

    await client.query('COMMIT');
    console.log('[Seed] Tenant demo criado. Login: admin@demo.com / admin123');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export { pool };
