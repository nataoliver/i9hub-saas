CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(140) NOT NULL,
  slug VARCHAR(80) UNIQUE NOT NULL,
  plan VARCHAR(40) DEFAULT 'pro',
  active BOOLEAN DEFAULT true,
  entitlements JSONB DEFAULT '["*"]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(140) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) DEFAULT 'seller', -- 'superadmin', 'manager', 'seller'
  view_only_own_leads BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_name VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(40) DEFAULT '',
  state VARCHAR(30) DEFAULT 'connected',
  qr_code TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id VARCHAR(120) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(200) DEFAULT '',
  phone VARCHAR(40) DEFAULT '',
  email VARCHAR(180) DEFAULT '',
  stage VARCHAR(60) DEFAULT 'novo',
  tipo VARCHAR(40) DEFAULT 'a_classificar',
  lead_score INTEGER DEFAULT 0,
  blacklisted BOOLEAN DEFAULT false,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(120) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  status VARCHAR(40) DEFAULT 'draft',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS followups (
  id VARCHAR(120) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id VARCHAR(120) NOT NULL,
  status VARCHAR(40) DEFAULT 'scheduled',
  scheduled_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS tenant_kv_store (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  store_key VARCHAR(120) NOT NULL,
  store_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, store_key)
);

-- Ativa Row-Level Security (RLS) em todas as tabelas operacionais
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_kv_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_leads ON leads
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
CREATE POLICY tenant_isolation_campaigns ON campaigns
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
CREATE POLICY tenant_isolation_followups ON followups
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
CREATE POLICY tenant_isolation_kv ON tenant_kv_store
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
CREATE POLICY tenant_isolation_wa ON wa_instances
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);