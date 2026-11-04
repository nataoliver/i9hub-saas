/**
 * i9Hub Classifier 2.0 — Classificador Explicavel de Leads
 */
import { getNicheModel } from "./niche-models.js";
import { detectIntent, INTENT_VALUES } from "./intent-detector.js";
import { detectUrgency, URGENCY_LEVELS } from "./urgency-detector.js";
import { computeLocalAdjustments } from "./classifier-feedback.js";

export const TYPE_VALUES = Object.freeze(["spam","prospecto","cliente","a_classificar"]);
export const CLASSIFIER_VERSION = "classifier-2.0";
export { INTENT_VALUES, URGENCY_LEVELS };

export const TYPE_META = Object.freeze({
  spam: { label: "Spam", badge: "type-spam", icon: "fa-ban", description: "Sinalizado como spam" },
  prospecto: { label: "Prospecto", badge: "type-prospecto", icon: "fa-user-plus", description: "Sinais de interesse comercial" },
  cliente: { label: "Cliente", badge: "type-cliente", icon: "fa-user-check", description: "Cliente ativo ou convertido" },
  a_classificar: { label: "A classificar", badge: "type-a-classificar", icon: "fa-question", description: "Sem sinal suficiente" },
});

const SPAM_KEYWORDS = Object.freeze([
  "aposta","apostas","bet","bets","cassino","casino","roleta",
  "criptomoeda","cripto","bitcoin","ethereum","airdrop","forex",
  "ganhe dinheiro","ganhar dinheiro","renda extra","dinheiro facil",
  "investimento garantido","lucro garantido","multiplique seu dinheiro"
]);
const SHORTENER_RE = /(?:^|[^\w])(?:bit\.ly|tinyurl\.com|t\.co|is\.gd|ow\.ly|cutt\.ly|rebrand\.ly|shorturl\.at|buff\.ly|lnkd\.in|tiny\.cc|rb\.gy|s\.id)(?:[/?#\s]|$)/i;
const URL_RE = /\bhttps?:\/\/[^\s<>"']+|\b(?:www\.)?[a-z0-9-]+\.(?:com|com\.br|net|org|io|co|me|app|site|online)(?:\/[^\s<>"']*)?/i;

function normalizeText(v) {
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}
export function normalizeType(value) {
  const v = String(value||"").trim().toLowerCase();
  return TYPE_VALUES.includes(v) ? v : "a_classificar";
}
// Configurações padrão do classificador (usadas por SettingsView e service-worker).
// Adicionado para corrigir erro de linkagem ES module que deixava o sidepanel em branco.
export const DEFAULT_CLASSIFIER_SETTINGS = Object.freeze({
  spamKeywords: [...SPAM_KEYWORDS],
  floodMessageCount: 5,
  floodWindowSeconds: 60,
  sameMessageNumbers: 3,
  recentDays: 7,
  shortenedLinkFirstMessage: true,
  promotionalFirstMessage: true,
  outsideContactsNeverReplied: false,
});

// Normaliza configurações do classificador, preenchendo valores padrão quando ausentes.
export function normalizeClassifierSettings(settings = {}) {
  const s = settings && typeof settings === 'object' ? settings : {};
  return {
    spamKeywords: Array.isArray(s.spamKeywords) ? s.spamKeywords.map(k => String(k).trim()).filter(Boolean) : [...DEFAULT_CLASSIFIER_SETTINGS.spamKeywords],
    floodMessageCount: Math.max(1, Math.min(100, Number(s.floodMessageCount) || DEFAULT_CLASSIFIER_SETTINGS.floodMessageCount)),
    floodWindowSeconds: Math.max(10, Math.min(3600, Number(s.floodWindowSeconds) || DEFAULT_CLASSIFIER_SETTINGS.floodWindowSeconds)),
    sameMessageNumbers: Math.max(1, Math.min(50, Number(s.sameMessageNumbers) || DEFAULT_CLASSIFIER_SETTINGS.sameMessageNumbers)),
    recentDays: Math.max(1, Math.min(365, Number(s.recentDays) || DEFAULT_CLASSIFIER_SETTINGS.recentDays)),
    shortenedLinkFirstMessage: s.shortenedLinkFirstMessage !== false,
    promotionalFirstMessage: s.promotionalFirstMessage !== false,
    outsideContactsNeverReplied: s.outsideContactsNeverReplied === true,
  };
}
function isClientLabel(lead) {
  const labels = Array.isArray(lead?.labels) ? lead.labels : [];
  return labels.some(l => String(l).toLowerCase() === "cliente");
}
function getConfidenceLevel(c) {
  if (c >= 0.85) return "alta";
  if (c >= 0.65) return "media";
  if (c >= 0.40) return "baixa";
  return "muito_baixa";
}
function getSpamLevel(s) {
  if (s >= 85) return "confirmado";
  if (s >= 65) return "provavel";
  if (s >= 40) return "suspeito";
  return "nao_identificado";
}
function getTextsFromEvidence(evidence) {
  if (Array.isArray(evidence?.incomingTexts) && evidence.incomingTexts.length > 0) {
    return evidence.incomingTexts.filter(Boolean);
  }
  return [evidence?.firstIncomingText].filter(Boolean);
}
function detectSpamScore(evidence, nicheModel) {
  let score = 0;
  const motivos = [];
  const textos = getTextsFromEvidence(evidence);
  const joined = textos.join("\n");
  const normalized = normalizeText(joined);
  // Cada keyword encontrada soma pontos; múltiplas keywords acumulam
  for (const kw of SPAM_KEYWORDS) {
    if (normalized.includes(normalizeText(kw))) {
      score += 45;
      motivos.push({tipo:"negativo",texto:`palavra-chave spam: "${kw}"`,pontos:-45});
    }
  }
  // Cap em 100 após keywords para evitar overflow
  score = Math.min(100, score);
  if (nicheModel && Array.isArray(nicheModel.spamSignals)) {
    for (const sig of nicheModel.spamSignals) {
      if (normalized.includes(normalizeText(sig))) { score += 35; motivos.push({tipo:"negativo",texto:`spam nicho: "${sig}"`,pontos:-35}); break; }
    }
  }
  if (evidence?.isFirstMessage && SHORTENER_RE.test(joined)) { score += 40; motivos.push({tipo:"negativo",texto:"link encurtado na primeira mensagem",pontos:-40}); }
  const urls = joined.match(URL_RE);
  if (urls && urls.length >= 2 && !evidence?.userReplied) { score += 30; motivos.push({tipo:"negativo",texto:`${urls.length} links sem conversa previa`,pontos:-30}); }
  if (evidence?.recentMessageCount >= 8) { score += 55; motivos.push({tipo:"negativo",texto:`${evidence.recentMessageCount} mensagens em janela curta`,pontos:-55}); }
  if (evidence?.sameMessageToMultipleNumbers >= 3) { score += 45; motivos.push({tipo:"negativo",texto:`mesma mensagem para ${evidence.sameMessageToMultipleNumbers} numeros`,pontos:-45}); }
  return { score: Math.min(100, score), motivos };
}
function detectProspectMotivos(evidence, nicheModel) {
  const motivos = [];
  const textos = getTextsFromEvidence(evidence);
  const joined = textos.join("\n");
  const normalized = normalizeText(joined);
  const hasQuestion = /[?]/.test(joined) || /\b(?:como|qual|quais|onde|quando|por que|porque)\b/.test(normalized);
  const hasPrice = /\b(?:pre[cç]o|valor|or[cç]amento|quanto custa|tabela|investimento)\b/.test(normalized);
  const hasDeadline = /\b(?:prazo|entrega|disponibilidade|agenda|agendar|hor[aá]rio)\b/.test(normalized);
  const hasProduct = /\b(?:produto|servi[cç]o|modelo|tamanho|cor|cat[aá]logo|comprar|contratar)\b/.test(normalized);
  if (hasQuestion && (hasPrice||hasDeadline||hasProduct)) motivos.push({tipo:"positivo",texto:"pergunta sobre preco, prazo ou produto",pontos:15});
  else if (hasPrice) motivos.push({tipo:"positivo",texto:"interesse em preco/orcamento",pontos:12});
  else if (hasDeadline) motivos.push({tipo:"positivo",texto:"interesse em prazo/disponibilidade",pontos:10});
  else if (hasProduct) motivos.push({tipo:"positivo",texto:"interesse em produto/servico",pontos:8});
  if (evidence?.respondedToCampaign) motivos.push({tipo:"positivo",texto:"respondeu a campanha",pontos:18});
  if (evidence?.twoWayRecent) motivos.push({tipo:"positivo",texto:"conversa bidirecional recente",pontos:20});
  if (nicheModel && Array.isArray(nicheModel.keywords)) {
    const hits = nicheModel.keywords.filter(kw => normalized.includes(normalizeText(kw))).slice(0,3);
    for (const h of hits) motivos.push({tipo:"positivo",texto:`sinal nicho: "${h}"`,pontos:8});
  }
  return motivos;
}
export function classifyLead(lead={}, evidence={}, context={}) {
  const nicheId = context.nicheId || lead.nicheId || "personalizado";
  const nicheModel = getNicheModel(nicheId);
  const feedbackHistory = Array.isArray(context.feedbackHistory) ? context.feedbackHistory : [];
  const current = normalizeType(lead.tipo);
  if (lead.tipoManual === true && TYPE_VALUES.includes(current)) {
    return {
      tipo: current, score: 100, confianca: 1.0, nivelConfianca: "alta",
      intencao: { nome: lead.intencao || "sem_intencao_identificada", confianca: 1.0 },
      urgencia: { nivel: lead.urgencia || "normal", confianca: 1.0 },
      modeloNicho: nicheModel.id, motivos: [{tipo:"info",texto:lead.tipoMotivo||"Classificacao manual",pontos:0}],
      sinaisAtencao: [], versaoModelo: CLASSIFIER_VERSION, origem: "manual", ajustadoPorFeedback: false,
    };
  }
  const motivos = [];
  const sinaisAtencao = [];
  const intencaoResult = detectIntent(evidence, nicheModel);
  const urgenciaResult = detectUrgency(evidence, nicheModel);
  const spamResult = detectSpamScore(evidence, nicheModel);
  const spamLevel = getSpamLevel(spamResult.score);
  motivos.push(...spamResult.motivos);
  const prospectMotivos = detectProspectMotivos(evidence, nicheModel);
  motivos.push(...prospectMotivos);
  // Score final: base 50 + pontos positivos + pontos negativos
  let score = 50;
  for (const m of motivos) score += (m.pontos || 0);
  score = Math.max(0, Math.min(100, score));
  // Determinar tipo: spam usa spamResult.score direto
  let tipo = "a_classificar";
  let confianca = 0.5;
  if (String(lead.stage||"").toLowerCase() === "fechado") {
    tipo = "cliente"; confianca = 0.95;
    motivos.push({tipo:"positivo",texto:'estagio CRM = "Fechado"',pontos:0});
  } else if (isClientLabel(lead)) {
    tipo = "cliente"; confianca = 0.92;
    motivos.push({tipo:"positivo",texto:'etiqueta "Cliente" do WhatsApp',pontos:0});
  } else if (evidence?.twoWayRecent === true && evidence?.userReplied === true) {
    tipo = "cliente"; confianca = 0.85;
    motivos.push({tipo:"positivo",texto:"interacao mutua recente",pontos:0});
  } else if (spamLevel === "confirmado" && evidence?.userReplied !== true) {
    tipo = "spam"; confianca = spamResult.score / 100;
    sinaisAtencao.push("spam confirmado: sugerir arquivamento e bloquear campanhas");
  } else if (spamLevel === "provavel" && evidence?.userReplied !== true) {
    tipo = "spam"; confianca = spamResult.score / 100;
    sinaisAtencao.push("spam provavel: revisao recomendada");
  } else if (spamLevel === "suspeito") {
    tipo = "a_classificar"; confianca = 0.4 + (spamResult.score / 200);
    sinaisAtencao.push("suspeito de spam: mantido para revisao");
  } else if (prospectMotivos.length > 0 && score >= 55) {
    tipo = "prospecto"; confianca = Math.min(0.95, 0.5 + (prospectMotivos.length * 0.08));
  } else {
    tipo = "a_classificar"; confianca = Math.max(0.2, score / 100);
  }
  // Feedback local
  const adjustments = computeLocalAdjustments(feedbackHistory);
  let ajustadoPorFeedback = false;
  if (adjustments.hasAdjustment) {
    for (const adj of adjustments.adjustments) {
      if (adj.from === tipo) {
        confianca = Math.max(0.3, confianca - 0.15);
        sinaisAtencao.push(`classificacao ajustada por ${adj.count} correcoes locais (${adj.from}->${adj.to})`);
        ajustadoPorFeedback = true;
      }
    }
  }
  const nivelConfianca = getConfidenceLevel(confianca);
  // Motivos: incluir negativos se tipo é spam OU se há suspeita de spam
  const showNegativeMotivos = tipo === "spam" || spamLevel === "suspeito" || spamLevel === "provavel";
  return {
    tipo, score: Math.round(score), confianca: Number(confianca.toFixed(2)), nivelConfianca,
    intencao: { nome: intencaoResult.nome, confianca: intencaoResult.confianca },
    urgencia: { nivel: urgenciaResult.nivel, confianca: urgenciaResult.confianca },
    modeloNicho: nicheModel.id,
    motivos: motivos.filter(m => m.tipo !== "negativo" || showNegativeMotivos),
    sinaisAtencao, versaoModelo: CLASSIFIER_VERSION, origem: "automatico",
    ajustadoPorFeedback, spamLevel: (tipo === "spam" || spamLevel === "suspeito") ? spamLevel : null,
  };
}
