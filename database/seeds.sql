-- i9Hub SaaS - Seeds iniciais para desenvolvimento e teste
-- Este arquivo é executado automaticamente pelo Docker na primeira inicialização
-- Para produção, use o seed programático no db.js ou crie tenants via API admin

-- Estágios padrão de CRM para tenant demo
INSERT INTO tenant_kv_store (tenant_id, store_key, store_value, updated_at)
SELECT t.id, 'crm_stages', '[
  {"id": "novo", "label": "Novo Lead", "color": "#6366f1", "order": 1},
  {"id": "contatado", "label": "Contatado", "color": "#8b5cf6", "order": 2},
  {"id": "qualificado", "label": "Qualificado", "color": "#ec4899", "order": 3},
  {"id": "proposta", "label": "Proposta Enviada", "color": "#f59e0b", "order": 4},
  {"id": "negociacao", "label": "Em Negociação", "color": "#f97316", "order": 5},
  {"id": "fechado_ganho", "label": "Fechado ✓", "color": "#10b981", "order": 6},
  {"id": "fechado_perdido", "label": "Perdido ✗", "color": "#ef4444", "order": 7},
  {"id": "blacklist", "label": "Black List", "color": "#1e293b", "order": 99}
]'::jsonb, NOW()
FROM tenants t WHERE t.slug = 'demo'
ON CONFLICT (tenant_id, store_key) DO NOTHING;

-- Configurações padrão para tenant demo
INSERT INTO tenant_kv_store (tenant_id, store_key, store_value, updated_at)
SELECT t.id, 'settings', '{
  "pauseOnBlur": false,
  "notificationsEnabled": true,
  "debugMode": false,
  "leadScoring": {
    "enabled": true,
    "weights": {"phone": 20, "email": 15, "company": 10, "stage": 25, "tipo": 15, "recency": 15}
  },
  "delays": {"min": 30, "max": 90},
  "spintax": false,
  "classifier": {"autoClassify": true, "confidenceThreshold": 0.7}
}'::jsonb, NOW()
FROM tenants t WHERE t.slug = 'demo'
ON CONFLICT (tenant_id, store_key) DO NOTHING;

-- Perfil comercial padrão para tenant demo
INSERT INTO tenant_kv_store (tenant_id, store_key, store_value, updated_at)
SELECT t.id, 'business_profile', '{
  "industry": "saas",
  "name": "i9Hub Demo",
  "terminology": {
    "contactSingular": "Lead",
    "contactPlural": "Leads",
    "opportunitySingular": "Oportunidade",
    "opportunityPlural": "Oportunidades"
  },
  "timezone": "America/Sao_Paulo",
  "currency": "BRL"
}'::jsonb, NOW()
FROM tenants t WHERE t.slug = 'demo'
ON CONFLICT (tenant_id, store_key) DO NOTHING;

-- Leads de exemplo para tenant demo
INSERT INTO leads (id, tenant_id, name, phone, email, stage, tipo, lead_score, data)
SELECT
  'demo_lead_001', t.id, 'Maria Silva', '11999998888', 'maria@exemplo.com', 'novo', 'a_classificar', 35,
  '{"source": "maps", "city": "São Paulo", "extractedAt": "2026-11-01T10:00:00Z"}'::jsonb
FROM tenants t WHERE t.slug = 'demo'
ON CONFLICT (tenant_id, id) DO NOTHING;

INSERT INTO leads (id, tenant_id, name, phone, email, stage, tipo, lead_score, data)
SELECT
  'demo_lead_002', t.id, 'João Santos', '11988887777', 'joao@empresa.com', 'contatado', 'quente', 65,
  '{"source": "whatsapp", "lastContact": "2026-11-02T14:30:00Z"}'::jsonb
FROM tenants t WHERE t.slug = 'demo'
ON CONFLICT (tenant_id, id) DO NOTHING;

INSERT INTO leads (id, tenant_id, name, phone, email, stage, tipo, lead_score, data)
SELECT
  'demo_lead_003', t.id, 'Ana Oliveira', '21977776666', 'ana@startup.io', 'qualificado', 'quente', 82,
  '{"source": "manual", "budget": "R$ 5.000-10.000", "decisionMaker": true}'::jsonb
FROM tenants t WHERE t.slug = 'demo'
ON CONFLICT (tenant_id, id) DO NOTHING;