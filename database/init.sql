-- i9Hub SaaS - Schema Inicial Multi-Tenant
-- Executado automaticamente na primeira criação do container PostgreSQL

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Planos Customizáveis
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    price_monthly NUMERIC(10,2) DEFAULT 0,
    price_yearly NUMERIC(10,2) DEFAULT 0,
    asaas_plan_id VARCHAR(255),
    entitlements JSONB DEFAULT '[]'::jsonb,
    limits JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plans (name, slug, description, price_monthly, price_yearly, entitlements, limits, sort_order) VALUES
('Starter', 'starter', 'Para pequenos negocios', 97.00, 970.00,
 '["crm.leads","crm.kanban","dashboard.analytics","compliance.consent_tracking"]'::jsonb,
 '{"max_users": 2, "ai_messages_day": 50, "wa_instances": 1}'::jsonb, 1),
('Pro', 'pro', 'Para equipes comerciais', 197.00, 1970.00,
 '["*"]'::jsonb,
 '{"max_users": 10, "ai_messages_day": 500, "wa_instances": 3, "rcs_enabled": true}'::jsonb, 2),
('Enterprise', 'enterprise', 'Alta escala', 497.00, 4970.00,
 '["*","admin.full_access"]'::jsonb,
 '{"max_users": -1, "ai_messages_day": -1, "wa_instances": -1, "rcs_enabled": true, "priority_support": true}'::jsonb, 3)
ON CONFLICT (slug) DO NOTHING;

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    plan VARCHAR(50) DEFAULT 'starter',
    status VARCHAR(20) DEFAULT 'active',
    active BOOLEAN DEFAULT true,
    max_users INTEGER DEFAULT 5,
    entitlements JSONB DEFAULT '[]'::jsonb,
    license_key VARCHAR(255),
    license_expires_at TIMESTAMPTZ,
    asaas_customer_id VARCHAR(255),
    asaas_subscription_id VARCHAR(255),
    billing_email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_asaas ON tenants(asaas_customer_id);

-- License Audit
CREATE TABLE IF NOT EXISTS license_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    license_key VARCHAR(255),
    valid BOOLEAN NOT NULL,
    plan VARCHAR(50),
    response JSONB,
    validated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Usage
CREATE TABLE IF NOT EXISTS ai_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd NUMERIC(10,6) DEFAULT 0,
    purpose VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant_date ON ai_usage(tenant_id, created_at);

-- Unified Contacts (WhatsApp/RCS/Email)
CREATE TABLE IF NOT EXISTS unified_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    channels JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}',
    last_contact_at TIMESTAMPTZ,
    opt_in_whatsapp BOOLEAN DEFAULT false,
    opt_in_rcs BOOLEAN DEFAULT false,
    opt_in_email BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, phone)
);

-- KV Store
CREATE TABLE IF NOT EXISTS tenant_kv_store (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_key VARCHAR(255) NOT NULL,
    store_value JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, store_key)
);

-- Leads
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    stage VARCHAR(50) DEFAULT 'novo',
    tipo VARCHAR(50) DEFAULT 'a_classificar',
    lead_score INTEGER DEFAULT 0,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, id)
);
