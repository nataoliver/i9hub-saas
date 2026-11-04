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

/**
 * Executa uma transação com SET LOCAL app.current_tenant para RLS
 */
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

/**
 * Seed inicial: cria tenant demo e usuário admin se não existirem
 */
export async function seedInitialTenants() {
  const bcrypt = await import('bcryptjs');
  const { rows } = await pool.query(`SELECT id FROM tenants WHERE slug = 'demo' LIMIT 1`);
  if (rows.length > 0) {
    console.log('[Seed] Tenant demo já existe, pulando seed.');
    return;
  }

  console.log('[Seed] Criando tenant demo e usuário admin...');
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
      [tenantId, 'Administrador', 'admin@demo.com', hash, 'superadmin']
    );

    // Seed de segundo tenant para testes multi-tenant
    const tenant2Res = await client.query(
      `INSERT INTO tenants (name, slug, plan, entitlements)
       VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
      ['Lety Plus', 'lety-plus', 'starter', '["crm.leads","crm.kanban","dashboard.analytics"]']
    );
    const tenant2Id = tenant2Res.rows[0].id;

    const hash2 = await bcrypt.default.hash('vendedor123', 12);
    await client.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenant2Id, 'Vendedor Lety', 'vendedor@letyplus.com', hash2, 'seller']
    );

    await client.query('COMMIT');
    console.log('[Seed] Tenants e usuários criados com sucesso.');
    console.log('[Seed] Login demo: admin@demo.com / admin123');
    console.log('[Seed] Login lety: vendedor@letyplus.com / vendedor123');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export { pool };