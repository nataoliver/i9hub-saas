export const FEATURE_CATALOG_VERSION = 14;

/**
 * Catálogo canônico de funcionalidades da extensão.
 * Os direitos vêm do token assinado pelo backend do painel administrativo.
 * Ausência de um direito explícito significa NEGADO (fail closed).
 */
export const FEATURE_CATALOG = Object.freeze([
  { id: 'dashboard.analytics', name: 'Dashboard comercial', category: 'Dashboard', implemented: true },
  { id: 'dashboard.awaiting_reply', name: 'Conversas aguardando resposta', category: 'Dashboard', implemented: true },
  { id: 'dashboard.account_health', name: 'Saúde da conta WhatsApp', category: 'Dashboard', implemented: true },
  { id: 'dashboard.commercial_agenda', name: 'Central de agenda e atividades comerciais', category: 'Dashboard', module: 'dashboard', implemented: true, status: 'active', phase: 8, requires: ['google.calendar.connect', 'google.calendar.booking', 'crm.followup.manage', 'crm.kanban'] },
  { id: 'dashboard.commercial_performance', name: 'Relatórios e inteligência de performance comercial', category: 'Dashboard', module: 'dashboard', implemented: true, status: 'active', phase: 9, requires: ['crm.leads', 'crm.kanban'] },
  { id: 'dashboard.commercial_management', name: 'Gestão de vendedores, equipes, metas e comissões', category: 'Dashboard', module: 'dashboard', implemented: true, status: 'active', phase: 10, requires: ['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'] },
  { id: 'dashboard.management_intelligence', name: 'Inteligência gerencial e recomendações com IA', category: 'Dashboard', module: 'dashboard', implemented: true, status: 'active', phase: 11, requires: ['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'] },
  // === CONFORMIDADE E PROTEÇÃO DA CONTA (Diretrizes Meta) ===
  { id: 'compliance.consent_tracking', name: 'Registro de opt-in e consentimento', category: 'Conformidade', implemented: true },
  { id: 'compliance.optout_management', name: 'Descadastro global e por finalidade', category: 'Conformidade', implemented: true },
  { id: 'compliance.message_purpose', name: 'Classificação de mensagem por finalidade', category: 'Conformidade', implemented: true },
  { id: 'compliance.policy_alerts', name: 'Alertas de violação de política', category: 'Conformidade', implemented: true },
  { id: 'compliance.campaign_auto_pause', name: 'Pausa automática por sinais de risco', category: 'Conformidade', implemented: true },
  { id: 'compliance.frequency_limits', name: 'Limites de frequência por conversa', category: 'Conformidade', implemented: true },
  { id: 'compliance.auto_blacklist', name: 'Blacklist automática por palavra-chave ou link', category: 'Conformidade', implemented: true },
  { id: 'crm.leads', name: 'Gestão de leads', category: 'CRM', implemented: true },
  { id: 'crm.communication.email', name: 'Envio de e-mails pelo CRM via Gmail', category: 'CRM', module: 'crm', implemented: true, status: 'active', phase: 13, requires: ['crm.leads'] },
  { id: 'crm.communication.email.read', name: 'Sincronização de respostas de e-mail', category: 'CRM', module: 'crm', implemented: true, status: 'active', phase: 14, requires: ['crm.leads', 'crm.communication.email'] },
  { id: 'crm.communication.outlook', name: 'Integração de e-mail Microsoft 365 / Outlook', category: 'CRM', module: 'crm', implemented: false, status: 'planned', phase: 14, requires: ['crm.leads'] },
  { id: 'crm.kanban', name: 'Funil e etapas comerciais', category: 'CRM', implemented: true },
  { id: 'crm.custom_fields', name: 'Campos personalizados', category: 'CRM', implemented: true },
  { id: 'crm.classification.manual', name: 'Classificação manual', category: 'CRM', implemented: true },
  { id: 'crm.classification.auto', name: 'Classificação automática', category: 'CRM', implemented: true },
  // === CLASSIFICADOR DE LEADS 2.0 (Diretrizes Meta) ===
  { id: 'crm.scoring_explainable', name: 'Pontuação explicável com evidências', category: 'CRM', implemented: true },
  { id: 'crm.classifier.niche_models', name: 'Taxonomia dinâmica de nichos, subnichos e etiquetas internas', category: 'CRM', implemented: true },
  { id: 'crm.intent_detection', name: 'Detecção de intenção e urgência', category: 'CRM', implemented: true },
  { id: 'crm.classifier.feedback_loop', name: 'Aprendizado com correções do usuário', category: 'CRM', implemented: true },
  { id: 'crm.spam_confidence_levels', name: 'Separação spam confirmado vs. suspeito', category: 'CRM', implemented: true },
  { id: 'crm.deduplication', name: 'Remoção de duplicidades', category: 'CRM', implemented: true },
  { id: 'crm.export.csv', name: 'Exportação CSV', category: 'CRM', implemented: true },
  { id: 'crm.export.webhook', name: 'Exportação por webhook', category: 'CRM', implemented: true },
  { id: 'crm.blacklist', name: 'Lista de bloqueio', category: 'CRM', implemented: true },
  { id: 'whatsapp.chat_list', name: 'Lista de conversas', category: 'WhatsApp', implemented: true },
  { id: 'whatsapp.group_members', name: 'Extração de participantes', category: 'WhatsApp', implemented: true },
  { id: 'whatsapp.chat_messages', name: 'Extração de mensagens', category: 'WhatsApp', implemented: true },
  { id: 'whatsapp.private_opportunities', name: 'Oportunidades de conversas privadas', category: 'WhatsApp', implemented: true },
  { id: 'whatsapp.labels_sync', name: 'Sincronização de etiquetas', category: 'WhatsApp', implemented: true },
  { id: 'whatsapp.campaigns.manage', name: 'Gestão de campanhas WhatsApp', category: 'WhatsApp', implemented: true },
  { id: 'whatsapp.campaigns.send', name: 'Execução de campanhas WhatsApp', category: 'WhatsApp', implemented: true },
  { id: 'whatsapp.connection', name: 'Conexão e diagnóstico do WhatsApp', category: 'WhatsApp', implemented: true },
  { id: 'whatsapp.background_mode', name: 'Operação em segundo plano', category: 'WhatsApp', implemented: true },
  { id: 'maps.extraction', name: 'Extração do Google Maps', category: 'Prospecção', implemented: true },
  { id: 'rcs.campaigns', name: 'Canal de mensagens reservado', category: 'Sistema', implemented: false },
  { id: 'business.profile', name: 'Perfil comercial', category: 'Configurações', implemented: true },
  { id: 'settings.general', name: 'Configurações gerais', category: 'Configurações', implemented: true },
  { id: 'settings.webhook', name: 'Integrações e webhooks', category: 'Integrações', implemented: true },
  { id: 'settings.spintax', name: 'Presets Spintax', category: 'Configurações', implemented: true },
  { id: 'settings.delays', name: 'Intervalos de envio', category: 'Configurações', implemented: true },
  { id: 'settings.classifier', name: 'Regras do classificador', category: 'Configurações', implemented: true },
  { id: 'settings.privacy', name: 'Preferências de privacidade', category: 'Configurações', implemented: true },
  { id: 'settings.appearance', name: 'Aparência', category: 'Configurações', implemented: true },
  { id: 'data.management', name: 'Gerenciamento de dados', category: 'Dados', implemented: true },
  { id: 'data.backup.manual', name: 'Backup manual', category: 'Dados', implemented: true },
  { id: 'drive.sync', name: 'Google Drive e sincronização', category: 'Integrações', implemented: true },
  { id: 'system.logs', name: 'Logs e diagnósticos', category: 'Sistema', implemented: true },
  { id: 'help.tour', name: 'Tutorial e ajuda', category: 'Ajuda', implemented: true },
  { id: 'whatsapp.ai_support', name: 'Chat com IA e qualificação de leads', category: 'Automação', implemented: true },
  { id: 'whatsapp.ai_support.configure', name: 'Configuração do Chat com IA', category: 'Automação', module: 'ai', implemented: true, requires: ['whatsapp.ai_support'] },
  { id: 'whatsapp.ai_support.order_capture', name: 'Captura e acompanhamento de pedidos', category: 'Automação', module: 'ai', implemented: true, requires: ['whatsapp.ai_support'] },
  { id: 'whatsapp.ai_support.google_sheets', name: 'Registro de pedidos no Google Sheets', category: 'Integrações', module: 'ai', implemented: true, requires: ['whatsapp.ai_support', 'whatsapp.ai_support.configure'] },
  { id: 'whatsapp.ai_support.human_handoff', name: 'Transferência para atendimento humano', category: 'Automação', module: 'ai', implemented: true, requires: ['whatsapp.ai_support'] },
  // === IA SUPERVISIONADA E SEGURA (Diretrizes Meta) ===
  { id: 'ai.mode.suggestion', name: 'Modo sugestão (draft antes de enviar)', category: 'IA', implemented: true },
  { id: 'ai.knowledge_base', name: 'Base de conhecimento versionada', category: 'IA', implemented: true },
  { id: 'ai.forbidden_topics', name: 'Assuntos proibidos configuráveis', category: 'IA', implemented: true },
  { id: 'ai.audit_log', name: 'Auditoria local de mensagens geradas', category: 'IA', implemented: true },
  { id: 'ai.cost_control', name: 'Controle de custo por provedor IA', category: 'IA', implemented: true },
  { id: 'ai.smart_handoff', name: 'Handoff inteligente por frustração/complexidade', category: 'IA', implemented: true },
  { id: 'whatsapp.status_audience', name: 'Públicos de Status por etiquetas', category: 'WhatsApp', module: 'whatsapp', implemented: true, requires: ['whatsapp.labels_sync', 'whatsapp.connection'] },
  { id: 'telemetry.usage', name: 'Telemetria de utilização', category: 'Administração', implemented: true },
  { id: 'telemetry.sales_funnel', name: 'Telemetria do funil comercial', category: 'Administração', module: 'admin', implemented: true, requires: ['telemetry.usage'] },
  { id: 'marketing.tracking', name: 'Integrações de marketing e pixels', category: 'Marketing', implemented: true },
  { id: 'notifications.in_app', name: 'Notificações administrativas', category: 'Comunicação', implemented: true },
  { id: 'ads.footer', name: 'Anúncios no rodapé', category: 'Marketing', implemented: true },
  // === ARQUITETURA HÍBRIDA WEB/API (Diretrizes Meta) ===
  { id: 'transport.adapter', name: 'Camada abstrata de transporte Web/API', category: 'Arquitetura', implemented: true },
  { id: 'api.templates_sync', name: 'Importação de templates aprovados', category: 'Arquitetura', implemented: true },
  { id: 'api.quality_sync', name: 'Sync de qualidade e limites da WABA', category: 'Arquitetura', implemented: true },
  { id: 'api.reconciliation', name: 'Reconciliação de mensagens Web ↔ API', category: 'Arquitetura', implemented: true },
  // === NOVAS OPORTUNIDADES COMERCIAIS (Diretrizes Meta) ===
  { id: 'whatsapp.flows_builder', name: 'WhatsApp Flows para coleta estruturada', category: 'Oportunidades', implemented: true },
  { id: 'whatsapp.status_segments', name: 'Segmentação de Status com consentimento', category: 'Oportunidades', implemented: true },
  { id: 'campaigns.reengagement', name: 'Campanhas de reengajamento com controle', category: 'Oportunidades', implemented: true },
  { id: 'analytics.niche_benchmarks', name: 'Métricas de qualidade por nicho', category: 'Oportunidades', implemented: true },
  { id: 'integrations.crm_sync', name: 'Integração nativa com CRMs externos', category: 'Oportunidades', implemented: true },
  // === ROADMAP v1.3.0 — IDs reservados; permanecem indisponíveis até implementação e testes ===
  { id: 'ai.mode.observe_only', name: 'IA observadora — somente análise e registro no CRM', category: 'IA', module: 'ai', implemented: true, status: 'active', phase: 4, requires: ['whatsapp.ai_support', 'crm.leads'] },
  { id: 'crm.notes', name: 'Histórico e anotações manuais do lead', category: 'CRM', module: 'crm', implemented: true, status: 'active', phase: 3, requires: ['crm.leads'] },
  { id: 'crm.lead.identity_edit', name: 'Edição e correção dos dados de identidade do lead', category: 'CRM', module: 'crm', implemented: true, status: 'active', requires: ['crm.leads'] },
  { id: 'crm.followup.manage', name: 'Gerenciamento de follow-ups', category: 'CRM', module: 'crm', implemented: true, status: 'active', phase: 5, requires: ['crm.leads'] },
  { id: 'crm.followup.send', name: 'Envio programado de mensagens de follow-up', category: 'CRM', module: 'crm', implemented: true, status: 'active', phase: 5, requires: ['crm.followup.manage', 'whatsapp.connection', 'compliance.consent_tracking', 'compliance.optout_management', 'compliance.frequency_limits'] },
  { id: 'crm.followup.automation', name: 'Sequências e interrupção automática de follow-up', category: 'CRM', module: 'crm', implemented: true, status: 'active', phase: 5, requires: ['crm.followup.manage', 'crm.followup.send', 'crm.kanban'] },
  { id: 'google.calendar.connect', name: 'Conexão com Google Agenda', category: 'Agenda', module: 'calendar', implemented: true, status: 'active', phase: 6 },
  { id: 'google.calendar.availability', name: 'Consulta de disponibilidade no Google Agenda', category: 'Agenda', module: 'calendar', implemented: true, status: 'active', phase: 6, requires: ['google.calendar.connect'] },
  { id: 'google.calendar.booking', name: 'Reserva e gerenciamento de compromissos', category: 'Agenda', module: 'calendar', implemented: true, status: 'active', phase: 6, requires: ['google.calendar.connect', 'google.calendar.availability'] },
  { id: 'google.calendar.automation', name: 'Automações de agenda por estágio e etiqueta', category: 'Agenda', module: 'calendar', implemented: true, status: 'active', phase: 7, requires: ['google.calendar.booking', 'google.calendar.connect', 'crm.kanban'] },
]);

/** Ações que só consultam estado de licença ou metadados públicos da extensão. */
export const PUBLIC_ACTIONS = new Set([
  'VALIDATE_LICENSE', 'ACTIVATE_LICENSE', 'REMOVE_LICENSE', 'GET_LICENSE_STATUS',
  'GET_USAGE_STATUS', 'GET_LICENSE_LINK', 'GET_FEATURE_CATALOG', 'GET_BUSINESS_PROFILE_CATALOG',
  'ADMIN_GET_CONFIG', 'TELEMETRY_GET_PROFILE', 'TELEMETRY_SAVE_PROFILE',
]);

/** Ações de segurança/encerramento permitidas para não prender uma operação já iniciada. */
export const SAFETY_ACTIONS = new Set([
  'PAUSE_CAMPAIGN', 'STOP_CAMPAIGN', 'MAPS_STOP_EXTRACTION', 'DRIVE_DISCONNECT', 'CALENDAR_DISCONNECT', 'CONSENT_UPDATE',
]);

/**
 * Não há ações operacionais core liberadas sem licença.
 * O modo de demonstração permite navegar e conhecer a interface, mas qualquer
 * leitura/escrita operacional exige uma licença válida emitida pelo painel.
 * Ações públicas de ativação/metadados e ações de segurança permanecem em listas próprias.
 */
export const CORE_ACTIONS = new Set();

/**
 * Cada handler operacional precisa estar associado a uma permissão do catálogo.
 * Handler novo sem mapeamento é negado por padrão no service worker.
 */
export const ACTION_FEATURE_MAP = Object.freeze({
  GET_SETTINGS: 'settings.general', SAVE_SETTINGS: 'settings.general',
  SAVE_WEBHOOK_SETTINGS: 'settings.webhook',
  GET_BUSINESS_PROFILE: 'business.profile', SAVE_BUSINESS_PROFILE: 'business.profile', RESET_BUSINESS_PROFILE: 'business.profile',
  GET_WEBHOOK_CONFIG: 'settings.webhook', SAVE_WEBHOOK_CONFIG: 'settings.webhook', TEST_WEBHOOK: 'settings.webhook',
  CLEAR_ALL_DATA: 'data.management',
  GET_SAVED_LEADS: 'crm.leads', SAVE_LEADS: 'crm.leads', DELETE_LEAD: 'crm.leads', CLEAR_ALL_LEADS: 'crm.leads', OPEN_CRM_LEAD_CHAT: 'crm.leads',
  GET_CRM_EMAIL_STATUS: 'crm.communication.email', CONNECT_CRM_GMAIL: 'crm.communication.email', SELECT_CRM_GMAIL_ACCOUNT: 'crm.communication.email', DISCONNECT_CRM_GMAIL: 'crm.communication.email', GET_CRM_EMAIL_TEMPLATES: 'crm.communication.email', SAVE_CRM_EMAIL_TEMPLATES: 'crm.communication.email', SEND_CRM_EMAIL: 'crm.communication.email', GET_CRM_EMAIL_SIGNATURE: 'crm.communication.email', SAVE_CRM_EMAIL_SIGNATURE: 'crm.communication.email', GET_CRM_COMMUNICATION_METRICS: 'crm.communication.email', SYNC_CRM_EMAIL_REPLIES: 'crm.communication.email.read', SET_CRM_EMAIL_CONSENT: 'compliance.optout_management',
  SYNC_PRIVATE_OPPORTUNITIES: 'whatsapp.private_opportunities',
  UPDATE_LEAD_STAGE: 'crm.kanban', UPDATE_LEAD_TYPE: 'crm.classification.manual',
  UPDATE_LEAD_IDENTITY: 'crm.lead.identity_edit', UPDATE_LEAD_COMMERCIAL_FIELDS: 'crm.leads',
  UPDATE_LEAD_CUSTOM_FIELDS: 'crm.custom_fields', GET_LEAD_HISTORY: 'crm.notes', ADD_LEAD_NOTE: 'crm.notes', UPDATE_LEAD_NOTE: 'crm.notes', DELETE_LEAD_NOTE: 'crm.notes', UPDATE_LEADS_TYPE: 'crm.classification.manual',
  RESET_LEAD_TYPE: 'crm.classification.manual', RECLASSIFY_LEADS: 'crm.classification.auto',
  DEDUPLICATE_LEADS: 'crm.deduplication', EXPORT_LEADS_CSV: 'crm.export.csv', EXPORT_LEADS_WEBHOOK: 'crm.export.webhook',
  GET_DASHBOARD_STATS: 'dashboard.analytics', DASHBOARD_GET_COMMERCIAL_OVERVIEW: 'dashboard.commercial_agenda', DASHBOARD_GET_COMMERCIAL_PERFORMANCE: 'dashboard.commercial_performance', SALES_ANALYTICS_SAVE_CONFIG: 'dashboard.commercial_performance', COMMERCIAL_MANAGEMENT_GET: 'dashboard.commercial_performance', COMMERCIAL_MANAGEMENT_SAVE_SELLER: 'dashboard.commercial_performance', COMMERCIAL_MANAGEMENT_SAVE_TEAM: 'dashboard.commercial_performance', COMMERCIAL_MANAGEMENT_SAVE_PRODUCT: 'dashboard.commercial_performance', COMMERCIAL_MANAGEMENT_SAVE_GOAL: 'dashboard.commercial_performance', COMMERCIAL_MANAGEMENT_DELETE_ENTITY: 'dashboard.commercial_performance', COMMERCIAL_MANAGEMENT_UPDATE_COMMISSION_STATUS: 'dashboard.commercial_performance', DASHBOARD_GET_MANAGEMENT_INTELLIGENCE: 'dashboard.management_intelligence', DASHBOARD_GENERATE_MANAGEMENT_INSIGHTS: 'dashboard.management_intelligence', GET_AWAITING_REPLIES: 'dashboard.awaiting_reply', OPEN_AWAITING_REPLY_CHAT: 'dashboard.awaiting_reply',
  GET_CAMPAIGNS: 'whatsapp.campaigns.manage', GET_CAMPAIGN_REPORT: 'whatsapp.campaigns.manage', REFRESH_CAMPAIGN_REPORT: 'whatsapp.campaigns.manage', CREATE_CAMPAIGN: 'whatsapp.campaigns.manage',
  UPDATE_CAMPAIGN: 'whatsapp.campaigns.manage', DELETE_CAMPAIGN: 'whatsapp.campaigns.manage',
  START_CAMPAIGN: 'whatsapp.campaigns.send', RESUME_CAMPAIGN: 'whatsapp.campaigns.send', RETRY_FAILED_CAMPAIGN: 'whatsapp.campaigns.send',
  WA_CONNECT: 'whatsapp.connection', WA_SET_EMBED: 'whatsapp.connection', WA_GET_EMBED: 'whatsapp.connection',
  WA_USE_TAB: 'whatsapp.connection', WA_OPEN_NEW_TAB: 'whatsapp.connection', WA_STATUS: 'whatsapp.connection',
  WA_SET_LEVEL: 'whatsapp.connection', WA_RULES_RELAX: 'whatsapp.connection', WA_OPEN_WINDOW: 'whatsapp.connection',
  WA_DIAGNOSE: 'whatsapp.connection', WA_RELOAD: 'whatsapp.connection', WA_OPEN_TAB: 'whatsapp.connection',
  WA_SET_ALLOW_HIDDEN: 'whatsapp.background_mode',
  GET_BLACKLIST: 'crm.blacklist', BLACKLIST_ADD: 'crm.blacklist', BLACKLIST_REMOVE: 'crm.blacklist', BLACKLIST_ADD_MANY: 'crm.blacklist',
  CONSENT_UPDATE: 'compliance.consent_tracking',
  GET_STAGES: 'crm.kanban', SAVE_CRM_STAGE_CONFIG: 'crm.kanban', DELETE_CRM_STAGE: 'crm.kanban',
  GET_NICHE_TAXONOMY: 'crm.classifier.niche_models', SAVE_NICHE_NODE: 'crm.classifier.niche_models', DELETE_NICHE_NODE: 'crm.classifier.niche_models', MERGE_NICHE_NODES: 'crm.classifier.niche_models',
  WA_LABELS_DIAGNOSTIC: 'whatsapp.labels_sync', WA_LABELS_SYNC: 'whatsapp.labels_sync',
  EXTRACT_ALL_CHATS: 'whatsapp.chat_list', EXTRACT_GROUP_MEMBERS: 'whatsapp.group_members', EXTRACT_CHAT_MESSAGES: 'whatsapp.chat_messages',
  MAPS_START_EXTRACTION: 'maps.extraction',
  DRIVE_GET_STATUS: 'drive.sync', DRIVE_CONNECT: 'drive.sync', DRIVE_SYNC_NOW: 'drive.sync',
  DRIVE_RESTORE: 'drive.sync', DRIVE_OVERWRITE: 'drive.sync', DRIVE_SET_AUTO: 'drive.sync',
  DRIVE_SET_AI_SYNC_PASSPHRASE: 'drive.sync', DRIVE_CLEAR_AI_SYNC_PASSPHRASE: 'drive.sync',
  AI_INCOMING_MESSAGE: 'whatsapp.ai_support',
  AI_GET_CONFIG: 'whatsapp.ai_support.configure', AI_SAVE_CONFIG: 'whatsapp.ai_support.configure', AI_CLEAR_KEY: 'whatsapp.ai_support.configure', AI_TEST_PROVIDER: 'whatsapp.ai_support.configure', AI_LIST_MODELS: 'whatsapp.ai_support.configure',
  AI_SET_ENABLED: 'whatsapp.ai_support', AI_GET_STATUS: 'whatsapp.ai_support', AI_HEARTBEAT: 'whatsapp.ai_support',
  AI_GET_HANDOFFS: 'whatsapp.ai_support.human_handoff', AI_RESUME_CHAT: 'whatsapp.ai_support.human_handoff',
  AI_TEST_SHEETS: 'whatsapp.ai_support.google_sheets', AI_CONNECT_HISTORY: 'whatsapp.ai_support.google_sheets', AI_SET_HISTORY_ENABLED: 'whatsapp.ai_support.google_sheets', AI_HISTORY_SYNC_NOW: 'whatsapp.ai_support.google_sheets', AI_GET_ORDERS: 'whatsapp.ai_support.order_capture', AI_UPDATE_ORDER_STATUS: 'whatsapp.ai_support.order_capture', AI_RENOTIFY_SELLER: 'whatsapp.ai_support.order_capture', AI_RETRY_ORDER_WRITE: 'whatsapp.ai_support.order_capture',
  GET_WA_LABELS: 'whatsapp.status_audience', AUDIENCE_GET: 'whatsapp.status_audience', AUDIENCE_SAVE: 'whatsapp.status_audience', AUDIENCE_DELETE: 'whatsapp.status_audience', AUDIENCE_EXPORT: 'whatsapp.status_audience',
  TELEMETRY_GET_STATUS: 'telemetry.usage', TELEMETRY_GET_PROFILE: 'telemetry.usage', TELEMETRY_SAVE_PROFILE: 'telemetry.usage', TELEMETRY_FLUSH_NOW: 'telemetry.usage', TRACK_TELEMETRY_EVENT: 'telemetry.usage',
  MARKETING_GET_CONFIG: 'marketing.tracking', MARKETING_SAVE_CONFIG: 'marketing.tracking', ADMIN_REFRESH_CONFIG: 'notifications.in_app',
  GET_FOLLOWUPS: 'crm.followup.manage', GET_FOLLOWUP_SETTINGS: 'crm.followup.manage', GET_FOLLOWUP_TEMPLATES: 'crm.followup.manage',
  SCHEDULE_FOLLOWUP: 'crm.followup.manage', SCHEDULE_FOLLOWUP_SEQUENCE: 'crm.followup.manage',
  CANCEL_FOLLOWUP: 'crm.followup.manage', CANCEL_FOLLOWUP_SEQUENCE: 'crm.followup.manage', RESCHEDULE_FOLLOWUP: 'crm.followup.manage', DELETE_FOLLOWUP: 'crm.followup.manage',
  SAVE_FOLLOWUP_SETTINGS: 'crm.followup.manage', SAVE_FOLLOWUP_TEMPLATES: 'crm.followup.manage',
  SEND_FOLLOWUP_NOW: 'crm.followup.send',
  CALENDAR_GET_STATUS: 'google.calendar.connect', CALENDAR_CONNECT: 'google.calendar.connect',
  CALENDAR_LIST_CALENDARS: 'google.calendar.connect', CALENDAR_SAVE_SETTINGS: 'google.calendar.connect',
  CALENDAR_GET_AVAILABILITY: 'google.calendar.availability', CALENDAR_GET_LEAD_EVENTS: 'google.calendar.booking',
  CALENDAR_CREATE_EVENT: 'google.calendar.booking', CALENDAR_UPDATE_EVENT: 'google.calendar.booking',
  CALENDAR_DELETE_EVENT: 'google.calendar.booking', CALENDAR_SYNC_LEAD_EVENTS: 'google.calendar.booking', CALENDAR_SET_EVENT_OUTCOME: 'google.calendar.booking',
  CALENDAR_SEND_CONFIRMATION: 'google.calendar.booking',
  CALENDAR_AUTOMATION_GET_RULES: 'google.calendar.automation',
  CALENDAR_AUTOMATION_SAVE_RULES: 'google.calendar.automation',
  CALENDAR_AUTOMATION_GET_TASKS: 'google.calendar.automation',
  CALENDAR_AUTOMATION_DISMISS_TASK: 'google.calendar.automation',
});

/** Algumas operações precisam de mais de um direito para serem úteis com segurança. */
export const ACTION_REQUIRED_FEATURES = Object.freeze({
  START_CAMPAIGN: ['whatsapp.campaigns.send', 'whatsapp.connection'],
  RESUME_CAMPAIGN: ['whatsapp.campaigns.send', 'whatsapp.connection'],
  RETRY_FAILED_CAMPAIGN: ['whatsapp.campaigns.send', 'whatsapp.connection'],
  OPEN_AWAITING_REPLY_CHAT: ['dashboard.awaiting_reply', 'whatsapp.connection'],
  OPEN_CRM_LEAD_CHAT: ['crm.leads', 'whatsapp.connection'],
  GET_CRM_EMAIL_STATUS: ['crm.leads', 'crm.communication.email'],
  CONNECT_CRM_GMAIL: ['crm.leads', 'crm.communication.email'],
  SELECT_CRM_GMAIL_ACCOUNT: ['crm.leads', 'crm.communication.email'],
  DISCONNECT_CRM_GMAIL: ['crm.leads', 'crm.communication.email'],
  GET_CRM_EMAIL_TEMPLATES: ['crm.leads', 'crm.communication.email'],
  SAVE_CRM_EMAIL_TEMPLATES: ['crm.leads', 'crm.communication.email'],
  SEND_CRM_EMAIL: ['crm.leads', 'crm.communication.email'],
  GET_CRM_EMAIL_SIGNATURE: ['crm.leads', 'crm.communication.email'],
  SAVE_CRM_EMAIL_SIGNATURE: ['crm.leads', 'crm.communication.email'],
  GET_CRM_COMMUNICATION_METRICS: ['crm.leads', 'crm.communication.email'],
  SYNC_CRM_EMAIL_REPLIES: ['crm.leads', 'crm.communication.email', 'crm.communication.email.read'],
  SET_CRM_EMAIL_CONSENT: ['crm.leads', 'compliance.optout_management'],
  DASHBOARD_GET_COMMERCIAL_OVERVIEW: ['dashboard.commercial_agenda', 'google.calendar.connect', 'google.calendar.booking', 'crm.followup.manage', 'crm.kanban'],
  DASHBOARD_GET_COMMERCIAL_PERFORMANCE: ['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'],
  SALES_ANALYTICS_SAVE_CONFIG: ['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'],
  COMMERCIAL_MANAGEMENT_GET: ['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'],
  COMMERCIAL_MANAGEMENT_SAVE_SELLER: ['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'],
  COMMERCIAL_MANAGEMENT_SAVE_TEAM: ['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'],
  COMMERCIAL_MANAGEMENT_SAVE_PRODUCT: ['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'],
  COMMERCIAL_MANAGEMENT_SAVE_GOAL: ['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'],
  COMMERCIAL_MANAGEMENT_DELETE_ENTITY: ['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'],
  COMMERCIAL_MANAGEMENT_UPDATE_COMMISSION_STATUS: ['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'],
  DASHBOARD_GET_MANAGEMENT_INTELLIGENCE: ['dashboard.management_intelligence', 'crm.leads', 'crm.kanban'],
  DASHBOARD_GENERATE_MANAGEMENT_INSIGHTS: ['dashboard.management_intelligence', 'crm.leads', 'crm.kanban'],
  UPDATE_LEAD_COMMERCIAL_FIELDS: ['crm.leads'],
  GET_WA_LABELS: ['whatsapp.status_audience', 'whatsapp.labels_sync', 'whatsapp.connection'],
  AI_GET_CONFIG: ['whatsapp.ai_support', 'whatsapp.ai_support.configure'],
  AI_SAVE_CONFIG: ['whatsapp.ai_support', 'whatsapp.ai_support.configure'],
  AI_CLEAR_KEY: ['whatsapp.ai_support', 'whatsapp.ai_support.configure'],
  AI_TEST_PROVIDER: ['whatsapp.ai_support', 'whatsapp.ai_support.configure'],
  AI_LIST_MODELS: ['whatsapp.ai_support', 'whatsapp.ai_support.configure'],
  AI_TEST_SHEETS: ['whatsapp.ai_support', 'whatsapp.ai_support.configure', 'whatsapp.ai_support.google_sheets'],
  AI_CONNECT_HISTORY: ['whatsapp.ai_support', 'whatsapp.ai_support.google_sheets'],
  AI_SET_HISTORY_ENABLED: ['whatsapp.ai_support', 'whatsapp.ai_support.google_sheets'],
  AI_HISTORY_SYNC_NOW: ['whatsapp.ai_support', 'whatsapp.ai_support.google_sheets'],
  AI_GET_ORDERS: ['whatsapp.ai_support', 'whatsapp.ai_support.order_capture'],
  AI_UPDATE_ORDER_STATUS: ['whatsapp.ai_support', 'whatsapp.ai_support.order_capture'],
  AI_RENOTIFY_SELLER: ['whatsapp.ai_support', 'whatsapp.ai_support.order_capture'],
  AI_RETRY_ORDER_WRITE: ['whatsapp.ai_support', 'whatsapp.ai_support.order_capture'],
  AI_GET_HANDOFFS: ['whatsapp.ai_support', 'whatsapp.ai_support.human_handoff'],
  AI_RESUME_CHAT: ['whatsapp.ai_support', 'whatsapp.ai_support.human_handoff'],
  TELEMETRY_GET_STATUS: ['telemetry.usage'],
  TELEMETRY_SAVE_PROFILE: ['telemetry.usage'], TELEMETRY_FLUSH_NOW: ['telemetry.usage'], TRACK_TELEMETRY_EVENT: ['telemetry.usage'],
  MARKETING_GET_CONFIG: ['marketing.tracking'], MARKETING_SAVE_CONFIG: ['marketing.tracking'],
  SCHEDULE_FOLLOWUP: ['crm.followup.manage', 'crm.followup.send', 'whatsapp.connection', 'compliance.consent_tracking', 'compliance.optout_management', 'compliance.frequency_limits'],
  SCHEDULE_FOLLOWUP_SEQUENCE: ['crm.followup.manage', 'crm.followup.send', 'crm.followup.automation', 'whatsapp.connection', 'compliance.consent_tracking', 'compliance.optout_management', 'compliance.frequency_limits'],
  SEND_FOLLOWUP_NOW: ['crm.followup.manage', 'crm.followup.send', 'whatsapp.connection', 'compliance.consent_tracking', 'compliance.optout_management', 'compliance.frequency_limits'],
  CALENDAR_SAVE_SETTINGS: ['google.calendar.connect', 'google.calendar.booking'],
  CALENDAR_GET_AVAILABILITY: ['google.calendar.connect', 'google.calendar.availability'],
  CALENDAR_CREATE_EVENT: ['google.calendar.connect', 'google.calendar.availability', 'google.calendar.booking'],
  CALENDAR_UPDATE_EVENT: ['google.calendar.connect', 'google.calendar.booking'],
  CALENDAR_DELETE_EVENT: ['google.calendar.connect', 'google.calendar.booking'],
  CALENDAR_SET_EVENT_OUTCOME: ['google.calendar.connect', 'google.calendar.booking'],
  CALENDAR_GET_LEAD_EVENTS: ['google.calendar.connect', 'google.calendar.booking'],
  CALENDAR_SYNC_LEAD_EVENTS: ['google.calendar.connect', 'google.calendar.booking'],
  CALENDAR_SEND_CONFIRMATION: ['google.calendar.connect', 'google.calendar.booking', 'whatsapp.connection', 'compliance.consent_tracking', 'compliance.optout_management', 'compliance.frequency_limits'],
  CALENDAR_AUTOMATION_GET_RULES: ['google.calendar.automation', 'google.calendar.booking', 'google.calendar.connect'],
  CALENDAR_AUTOMATION_SAVE_RULES: ['google.calendar.automation', 'google.calendar.booking', 'google.calendar.connect'],
  CALENDAR_AUTOMATION_GET_TASKS: ['google.calendar.automation', 'google.calendar.booking', 'google.calendar.connect'],
  CALENDAR_AUTOMATION_DISMISS_TASK: ['google.calendar.automation', 'google.calendar.booking', 'google.calendar.connect'],
});

function flattenEntitlements(ent) {
  if (Array.isArray(ent)) return ent.filter((v) => typeof v === 'string').map((v) => v.trim()).filter(Boolean);
  if (typeof ent === 'string') return ent.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);
  if (!ent || typeof ent !== 'object' || Array.isArray(ent)) return [];
  const nested = ent.features ?? ent.permissions ?? ent.entitlements;
  if (Array.isArray(nested)) return nested.filter((v) => typeof v === 'string').map((v) => v.trim()).filter(Boolean);
  if (nested && typeof nested === 'object') return flattenEntitlements(nested);
  const result = [];
  for (const [key, value] of Object.entries(ent)) {
    if (['features', 'permissions', 'entitlements'].includes(key)) continue;
    if (value === true || value === 1 || value === 'true' || value === 'enabled' || (value && typeof value === 'object' && value.enabled === true)) result.push(key);
  }
  return result;
}

const FEATURE_BY_ID = new Map(FEATURE_CATALOG.map((feature) => [feature.id, feature]));
const ALL_ACCESS_MARKERS = new Set(['*', 'all']);

export function getEntitlementIds(ent) {
  return [...new Set(flattenEntitlements(ent))];
}

function hasDirectEntitlement(ids, featureId) {
  if (ids.includes('admin.full_access') || ids.some((id) => ALL_ACCESS_MARKERS.has(id))) return true;
  if (ids.includes(featureId)) return true;
  // Backward compatibility: licenses already issued with commercial performance also unlock the management intelligence add-on.
  if (featureId === 'dashboard.management_intelligence' && ids.includes('dashboard.commercial_performance')) return true;
  // settings.general is a scoped umbrella only for implemented settings.* features.
  return String(featureId || '').startsWith('settings.') && ids.includes('settings.general');
}

function resolveFeatureAccess(ids, featureId, visiting = new Set()) {
  const id = String(featureId || '').trim();
  if (!id) return { allowed: false, reason: 'INVALID_FEATURE', missingFeatures: [] };
  // Full access is a privileged entitlement, never implied by '*' or 'all'.
  if (id === 'admin.full_access') {
    const allowed = ids.includes('admin.full_access');
    return { allowed, reason: allowed ? 'GRANTED' : 'OWNER_PRIVILEGE_REQUIRED', missingFeatures: allowed ? [] : [id] };
  }
  const feature = FEATURE_BY_ID.get(id);
  if (!feature) return { allowed: false, reason: 'UNKNOWN_FEATURE', missingFeatures: [id] };
  if (feature.implemented !== true) return { allowed: false, reason: 'NOT_IMPLEMENTED', missingFeatures: [id] };
  if (visiting.has(id)) return { allowed: false, reason: 'DEPENDENCY_CYCLE', missingFeatures: [id] };
  if (!hasDirectEntitlement(ids, id)) return { allowed: false, reason: 'ENTITLEMENT_MISSING', missingFeatures: [id] };

  visiting.add(id);
  const missing = [];
  for (const dependency of Array.isArray(feature.requires) ? feature.requires : []) {
    const result = resolveFeatureAccess(ids, dependency, visiting);
    if (!result.allowed) missing.push(...(result.missingFeatures?.length ? result.missingFeatures : [dependency]));
  }
  visiting.delete(id);
  const uniqueMissing = [...new Set(missing)];
  return uniqueMissing.length
    ? { allowed: false, reason: 'DEPENDENCY_MISSING', missingFeatures: uniqueMissing }
    : { allowed: true, reason: 'GRANTED', missingFeatures: [] };
}

/** Avalia uma permissão sem confiar em IDs desconhecidos ou recursos ainda planejados. */
export function getFeatureAccess(ent, featureId) {
  return resolveFeatureAccess(getEntitlementIds(ent), featureId);
}

export function hasConfiguredEntitlements(ent) {
  const ids = getEntitlementIds(ent);
  if (ids.includes('admin.full_access')) return true;
  return FEATURE_CATALOG.some((feature) => feature.implemented === true && resolveFeatureAccess(ids, feature.id).allowed);
}

export function hasFeatureEntitlement(ent, featureId) {
  return getFeatureAccess(ent, featureId).allowed;
}

export function featureName(featureId) {
  return FEATURE_BY_ID.get(featureId)?.name || featureId || 'esta funcionalidade';
}

export function getFeatureCatalogForToken(ent) {
  return FEATURE_CATALOG.map((feature) => {
    const access = getFeatureAccess(ent, feature.id);
    return {
      ...feature,
      requires: Array.isArray(feature.requires) ? [...feature.requires] : [],
      enabled: access.allowed,
      accessReason: access.reason,
      missingFeatures: access.missingFeatures,
    };
  });
}
