/**
 * Registro modular do i9Hub.
 * Os módulos são agrupamentos de apresentação e arquitetura; as permissões
 * efetivas continuam sendo avaliadas por feature ID no catálogo canônico.
 */
import { FEATURE_CATALOG, FEATURE_CATALOG_VERSION, hasFeatureEntitlement } from './feature-catalog.js';

export const MODULE_REGISTRY_VERSION = 1;

const MODULE_DEFINITIONS = Object.freeze([
  { id: 'dashboard', name: 'Dashboard', description: 'Indicadores e acompanhamento comercial.' },
  { id: 'crm', name: 'CRM', description: 'Leads, oportunidades, funil e relacionamento.' },
  { id: 'whatsapp', name: 'WhatsApp', description: 'Conexão, conversas, etiquetas e campanhas.' },
  { id: 'prospecting', name: 'Prospecção', description: 'Pesquisa e extração de negócios.' },
  { id: 'ai', name: 'Inteligência artificial', description: 'Atendimento, análise e automações inteligentes.' },
  { id: 'compliance', name: 'Conformidade', description: 'Consentimento, descadastro e proteção.' },
  { id: 'calendar', name: 'Agenda', description: 'Integração e compromissos comerciais.' },
  { id: 'integrations', name: 'Integrações', description: 'Serviços externos e sincronização.' },
  { id: 'marketing', name: 'Marketing', description: 'Medição, anúncios e configurações de marketing.' },
  { id: 'admin', name: 'Administração', description: 'Telemetria e recursos exclusivos do proprietário.' },
  { id: 'settings', name: 'Configurações', description: 'Preferências e configurações do produto.' },
  { id: 'data', name: 'Dados', description: 'Backup, exportação e gerenciamento de dados.' },
  { id: 'system', name: 'Sistema', description: 'Diagnóstico e recursos internos da plataforma.' },
  { id: 'help', name: 'Ajuda', description: 'Tutoriais e documentação.' },
  { id: 'communications', name: 'Comunicação', description: 'Notificações administrativas.' },
  { id: 'platform', name: 'Arquitetura', description: 'Capacidades e contratos de plataforma.' },
  { id: 'opportunities', name: 'Oportunidades', description: 'Recursos comerciais complementares.' },
]);

const CATEGORY_MODULE = Object.freeze({
  Dashboard: 'dashboard', CRM: 'crm', WhatsApp: 'whatsapp', Prospecção: 'prospecting',
  IA: 'ai', Automação: 'ai', Conformidade: 'compliance', Agenda: 'calendar',
  Integrações: 'integrations', Marketing: 'marketing', Administração: 'admin',
  Configurações: 'settings', Dados: 'data', Sistema: 'system', Ajuda: 'help',
  Comunicação: 'communications', Arquitetura: 'platform', Oportunidades: 'opportunities',
});

export function getFeatureModuleId(featureOrId) {
  const feature = typeof featureOrId === 'string'
    ? FEATURE_CATALOG.find((item) => item.id === featureOrId)
    : featureOrId;
  if (!feature) return null;
  return feature.module || CATEGORY_MODULE[feature.category] || null;
}

export const MODULE_REGISTRY = Object.freeze(MODULE_DEFINITIONS.map((module) => {
  const featureIds = FEATURE_CATALOG
    .filter((feature) => getFeatureModuleId(feature) === module.id)
    .map((feature) => feature.id);
  return Object.freeze({ ...module, featureIds: Object.freeze(featureIds) });
}));

export function getModuleRegistryForEntitlements(entitlements) {
  return MODULE_REGISTRY.map((module) => {
    const features = module.featureIds.map((id) => FEATURE_CATALOG.find((feature) => feature.id === id)).filter(Boolean);
    const implemented = features.filter((feature) => feature.implemented === true);
    const enabledFeatureIds = implemented.filter((feature) => hasFeatureEntitlement(entitlements, feature.id)).map((feature) => feature.id);
    return {
      ...module,
      featureIds: [...module.featureIds],
      implementedCount: implemented.length,
      plannedCount: features.length - implemented.length,
      enabledCount: enabledFeatureIds.length,
      enabledFeatureIds,
      enabled: enabledFeatureIds.length > 0,
      catalogVersion: FEATURE_CATALOG_VERSION,
    };
  });
}

export function getModuleDefinition(moduleId) {
  return MODULE_REGISTRY.find((module) => module.id === moduleId) || null;
}
