/**
 * Lead Score configurável do i9Hub.
 * Pontuação explicável, local e derivada dos dados já disponíveis no CRM/IA.
 */
export const LEAD_SCORE_ACTIONS = Object.freeze([
  { key: 'repliedToCampaign', label: 'Respondeu à campanha', description: 'Resposta recebida depois do último envio da campanha.', defaultWeight: 18 },
  { key: 'activeConversation', label: 'Conversa nos dois sentidos', description: 'Há mensagens recebidas e enviadas na conversa.', defaultWeight: 8 },
  { key: 'needIdentified', label: 'Necessidade identificada', description: 'A IA identificou uma necessidade ou pedido específico.', defaultWeight: 12 },
  { key: 'serviceIdentified', label: 'Serviço ou segmento identificado', description: 'Existe serviço, segmento ou nicho identificado.', defaultWeight: 6 },
  { key: 'budgetIdentified', label: 'Orçamento informado', description: 'O lead informou um orçamento utilizável.', defaultWeight: 8 },
  { key: 'budgetMeetsMinimum', label: 'Orçamento atinge o mínimo', description: 'O orçamento identificado é igual ou superior ao mínimo configurado.', defaultWeight: 18 },
  { key: 'urgent', label: 'Prazo urgente', description: 'Há indicação de contratação ou decisão em prazo curto.', defaultWeight: 8 },
  { key: 'decisionMaker', label: 'Poder de decisão identificado', description: 'Há indicação de que o contato decide ou participa da decisão.', defaultWeight: 10 },
  { key: 'aiQualified', label: 'Qualificação positiva da IA', description: 'A qualificação comercial da IA foi marcada como qualificada.', defaultWeight: 12 },
  { key: 'crmQualifiedStage', label: 'Movido para etapa Qualificado', description: 'O lead foi movido para uma etapa de qualificação no CRM.', defaultWeight: 10 },
  { key: 'proposalStage', label: 'Avançou para proposta', description: 'O lead está na etapa de proposta/orçamento.', defaultWeight: 12 },
  { key: 'closedWon', label: 'Venda fechada', description: 'O CRM indica venda ganha ou cliente convertido.', defaultWeight: 20 },
  { key: 'noResponse', label: 'Sem resposta após campanha', description: 'Foi enviado contato, mas ainda não há resposta posterior identificada.', defaultWeight: -10 },
  { key: 'budgetBelowMinimum', label: 'Orçamento abaixo do mínimo', description: 'O orçamento informado está abaixo do mínimo ou foi declarado indisponível.', defaultWeight: -20 },
  { key: 'noNeed', label: 'Sem necessidade/interesse', description: 'A qualificação indica que não há necessidade ou interesse atual.', defaultWeight: -15 },
  { key: 'spam', label: 'Identificado como spam', description: 'Reduz a pontuação e, por padrão, bloqueia a qualificação.', defaultWeight: -100 },
  { key: 'blacklisted', label: 'Na Black list', description: 'Reduz a pontuação e, por padrão, bloqueia a qualificação.', defaultWeight: -100 },
  { key: 'optedOut', label: 'Pediu descadastro', description: 'Reduz a pontuação e, por padrão, bloqueia a qualificação.', defaultWeight: -100 },
]);

const DEFAULT_WEIGHTS = Object.freeze(Object.fromEntries(LEAD_SCORE_ACTIONS.map((action) => [action.key, action.defaultWeight])));
export const DEFAULT_LEAD_SCORING_CONFIG = Object.freeze({
  enabled: true,
  qualifiedThreshold: 60,
  hotThreshold: 80,
  minimumMonthlyBudget: 1000,
  requireBudgetMinimum: false,
  requireNeed: false,
  excludeSpam: true,
  excludeBlacklisted: true,
  excludeOptOut: true,
  weights: DEFAULT_WEIGHTS,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const text = (value) => String(value ?? '').trim();
const normalized = (value) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const meaningful = (value) => {
  const v = normalized(value);
  return !!v && !/^(nao informado|desconhecido|unknown|n\/a|nenhum|ainda nao identificado|nao se aplica|-)$/.test(v);
};

export function normalizeLeadScoringConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const weightsSource = source.weights && typeof source.weights === 'object' ? source.weights : {};
  const weights = {};
  for (const action of LEAD_SCORE_ACTIONS) {
    const value = Number(weightsSource[action.key] ?? DEFAULT_WEIGHTS[action.key]);
    weights[action.key] = Number.isFinite(value) ? Math.round(clamp(value, -100, 100)) : DEFAULT_WEIGHTS[action.key];
  }
  const qualifiedThreshold = Number(source.qualifiedThreshold);
  const hotThreshold = Number(source.hotThreshold);
  const minimumMonthlyBudget = Number(source.minimumMonthlyBudget);
  const normalizedQualifiedThreshold = Number.isFinite(qualifiedThreshold) ? Math.round(clamp(qualifiedThreshold, 1, 100)) : 60;
  const normalizedHotThreshold = Number.isFinite(hotThreshold) ? Math.round(clamp(hotThreshold, 1, 100)) : 80;
  return {
    enabled: source.enabled !== false,
    qualifiedThreshold: normalizedQualifiedThreshold,
    hotThreshold: Math.max(normalizedQualifiedThreshold, normalizedHotThreshold),
    minimumMonthlyBudget: Number.isFinite(minimumMonthlyBudget) ? clamp(minimumMonthlyBudget, 0, 100000000) : 1000,
    requireBudgetMinimum: source.requireBudgetMinimum === true,
    requireNeed: source.requireNeed === true,
    excludeSpam: source.excludeSpam !== false,
    excludeBlacklisted: source.excludeBlacklisted !== false,
    excludeOptOut: source.excludeOptOut !== false,
    weights,
  };
}

/** Extrai um valor monetário de um campo que representa orçamento, sem usar texto genérico. */
export function parseBudgetAmount(value) {
  const source = text(value);
  if (!source) return null;
  const normalizedText = normalized(source);
  if (/sem verba|sem orcamento|nao tem verba|nao possui verba|indisponivel|nao informado|ainda nao definido/.test(normalizedText)) return null;
  const match = source.match(/(?:r\$\s*)?(-?\d[\d.\s]*(?:,\d{1,2})?)/i);
  if (!match) return null;
  let numeric = match[1].replace(/\s/g, '');
  if (numeric.includes(',')) numeric = numeric.replace(/\./g, '').replace(',', '.');
  else if ((numeric.match(/\./g) || []).length > 1) numeric = numeric.replace(/\./g, '');
  else if (/^\d{1,3}\.\d{3}$/.test(numeric)) numeric = numeric.replace('.', '');
  const amount = Number(numeric);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function leadNicheLabels(lead = {}) {
  const ai = lead.aiIntelligence && typeof lead.aiIntelligence === 'object' ? lead.aiIntelligence : {};
  const classification = lead.aiNicheClassification && typeof lead.aiNicheClassification === 'object' ? lead.aiNicheClassification : {};
  const qualification = lead.aiQualification && typeof lead.aiQualification === 'object' ? lead.aiQualification : {};
  const qNiche = qualification.nicheClassification && typeof qualification.nicheClassification === 'object' ? qualification.nicheClassification : {};
  const values = [
    ...(Array.isArray(classification.path) ? classification.path : []),
    ...(Array.isArray(qNiche.path) ? qNiche.path : []),
    classification.primaryNiche, qNiche.primaryNiche,
    ...(Array.isArray(classification.subniches) ? classification.subniches : []),
    ...(Array.isArray(qNiche.subniches) ? qNiche.subniches : []),
    ...(Array.isArray(lead.nichePath) ? lead.nichePath : []),
    ai.segment, qualification.segment, lead.subniche, lead.niche, lead.category,
  ];
  return [...new Set(values.map((value) => text(value)).filter(Boolean))];
}

function isOptedOut(lead) {
  const status = normalized(lead.consentStatus || lead.consentState || lead.optOutStatus || '');
  return lead.optedOut === true || lead.unsubscribe === true || lead.descadastrado === true
    || ['opt_out', 'opted_out', 'descadastrado', 'descadastro', 'unsubscribed'].includes(status);
}

export function scoreLead(lead = {}, rawConfig = DEFAULT_LEAD_SCORING_CONFIG) {
  const config = normalizeLeadScoringConfig(rawConfig);
  const evidence = lead.tipoEvidence && typeof lead.tipoEvidence === 'object' ? lead.tipoEvidence
    : lead.classifierEvidence && typeof lead.classifierEvidence === 'object' ? lead.classifierEvidence : {};
  const intel = lead.aiIntelligence && typeof lead.aiIntelligence === 'object' ? lead.aiIntelligence : {};
  const qualification = lead.aiQualification && typeof lead.aiQualification === 'object' ? lead.aiQualification : {};
  const budgetText = text(intel.budget || qualification.budget || lead.monthlyBudget || lead.budget);
  const budgetAmount = parseBudgetAmount(budgetText);
  const budgetStatus = normalized(`${intel.budgetStatus || ''} ${qualification.budgetStatus || ''} ${budgetText}`);
  const budgetBelow = (budgetAmount !== null && budgetAmount < config.minimumMonthlyBudget)
    || /sem verba|sem orcamento|abaixo do minimo|orcamento insuficiente|nao tem verba|nao possui verba/.test(budgetStatus);
  const incomingAt = Date.parse(evidence.lastIncomingAt || lead.lastIncomingAt || '');
  const campaignAt = Date.parse(lead.lastCampaignSentAt || '');
  const repliedToCampaign = evidence.respondedToCampaign === true
    || (Number.isFinite(incomingAt) && Number.isFinite(campaignAt) && incomingAt >= campaignAt);
  const activeConversation = evidence.twoWayRecent === true
    || (Number(evidence.incomingCount) > 0 && Number(evidence.outgoingCount) > 0);
  const needText = [intel.need, intel.exactRequest, qualification.need, qualification.exactRequest].find(meaningful) || '';
  const serviceText = [intel.service, qualification.service, intel.segment, qualification.segment, lead.aiNicheClassification?.primaryNiche].find(meaningful) || '';
  const needIdentified = !!needText;
  const serviceIdentified = !!serviceText || leadNicheLabels(lead).length > 0;
  const budgetIdentified = budgetAmount !== null || (meaningful(budgetText) && !/nao informado|desconhecido|ainda nao/.test(normalized(budgetText)));
  const budgetMeetsMinimum = budgetAmount !== null && budgetAmount >= config.minimumMonthlyBudget;
  const timeframe = normalized(`${intel.timeframe || ''} ${qualification.timeframe || ''} ${lead.urgencia || ''}`);
  const urgent = /urgente|imediat|hoje|amanha|esta semana|7 dias|o quanto antes|prazo curto|asap|em poucos dias/.test(timeframe);
  const decision = normalized(`${intel.decisionMaker || ''} ${qualification.decisionMaker || ''}`);
  const decisionMaker = /^(sim|yes|sou eu|eu|proprio|propria|responsavel|decisor|decido|dono|proprietario|socio|diretor|gestor)$/.test(decision)
    || /sou (o|a)? ?(responsavel|dono|proprietario)|eu decido|poder de decisao|tomador de decisao/.test(decision);
  const qStatus = normalized(qualification.status || intel.status || '');
  const aiQualified = qualification.qualified === true || qualification.isQualified === true || qStatus === 'qualified' || qStatus === 'qualificado';
  const stage = normalized(lead.stage || '');
  const crmQualifiedStage = ['qualificado', 'qualified'].includes(stage) || stage.includes('qualificado');
  const proposalStage = ['proposta', 'proposal', 'orcamento', 'orçamento'].includes(stage) || /proposta|orcamento/.test(stage);
  const closedWon = ['fechado', 'closed_won', 'ganho', 'cliente'].includes(stage) || lead.saleClosed === true || lead.tipo === 'cliente';
  const noResponse = Number.isFinite(campaignAt) && !repliedToCampaign && !(Number.isFinite(incomingAt) && incomingAt > campaignAt);
  const reason = normalized(`${qualification.reason || ''} ${intel.reason || ''} ${qualification.objection || ''} ${intel.objection || ''}`);
  const noNeed = ['not_qualified', 'nao_qualificado'].includes(qStatus)
    || /sem necessidade|nao precisa|sem interesse|nao tem interesse|nao quer contratar/.test(reason);
  const spam = normalized(lead.tipo) === 'spam';
  const blacklisted = lead.blacklisted === true || stage === 'blacklist';
  const optedOut = isOptedOut(lead);
  const signals = { repliedToCampaign, activeConversation, needIdentified, serviceIdentified, budgetIdentified, budgetMeetsMinimum, urgent, decisionMaker, aiQualified, crmQualifiedStage, proposalStage, closedWon, noResponse, budgetBelowMinimum: budgetBelow, noNeed, spam, blacklisted, optedOut };
  const activeSignals = LEAD_SCORE_ACTIONS.filter((action) => signals[action.key] === true).map((action) => ({ key: action.key, label: action.label, points: config.weights[action.key] }));
  const rawScore = activeSignals.reduce((sum, signal) => sum + signal.points, 0);
  const score = config.enabled ? Math.round(clamp(rawScore, 0, 100)) : 0;
  const blocked = (config.excludeSpam && spam) || (config.excludeBlacklisted && blacklisted) || (config.excludeOptOut && optedOut);
  const meetsBudgetRule = !config.requireBudgetMinimum || budgetMeetsMinimum;
  const meetsNeedRule = !config.requireNeed || needIdentified;
  const qualified = config.enabled && !blocked && score >= config.qualifiedThreshold && meetsBudgetRule && meetsNeedRule;
  const hot = config.enabled && !blocked && score >= config.hotThreshold && meetsBudgetRule && meetsNeedRule;
  let status = 'Baixa prioridade';
  if (blocked) status = spam ? 'Spam' : blacklisted ? 'Black list' : 'Descadastrado';
  else if (hot) status = 'Quente';
  else if (qualified) status = 'Qualificado';
  else if (score >= Math.max(30, Math.floor(config.qualifiedThreshold / 2))) status = 'Em avaliação';
  if (!meetsBudgetRule && !blocked) status = 'Aguardando orçamento mínimo';
  if (!meetsNeedRule && !blocked) status = 'Aguardando necessidade';
  return { score, status, qualified, hot, blocked, budgetAmount, budgetMeetsMinimum, signals, activeSignals, config };
}
