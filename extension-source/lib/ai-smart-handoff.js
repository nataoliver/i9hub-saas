/**
 * i9Hub AI Supervisionada — Handoff Inteligente para Atendimento Humano
 * Detecta frustração, baixa confiança consecutiva ou solicitação explícita de humano.
 */
const STORAGE_KEY = "i9hub_ai_handoff_config";
const STATE_KEY = "i9hub_ai_handoff_state";
const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  maxConsecutiveLowConfidence: 3,
  lowConfidenceThreshold: 0.4,
  frustrationKeywords: ["raiva", "ódio", "péssimo", "horrível", "inútil", "burro", "idiota", "merda", "porra", "caralho"],
  humanRequestKeywords: ["falar com atendente", "falar com humano", "quero falar com uma pessoa", "atendimento humano", "transferir para humano", "passar para atendente"],
  cooldownMinutes: 5,
});
export async function getHandoffConfig() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const config = result[STORAGE_KEY] || {};
    return {
      enabled: config.enabled !== false,
      maxConsecutiveLowConfidence: Number(config.maxConsecutiveLowConfidence) || DEFAULT_CONFIG.maxConsecutiveLowConfidence,
      lowConfidenceThreshold: Number(config.lowConfidenceThreshold) || DEFAULT_CONFIG.lowConfidenceThreshold,
      frustrationKeywords: Array.isArray(config.frustrationKeywords) ? config.frustrationKeywords : [...DEFAULT_CONFIG.frustrationKeywords],
      humanRequestKeywords: Array.isArray(config.humanRequestKeywords) ? config.humanRequestKeywords : [...DEFAULT_CONFIG.humanRequestKeywords],
      cooldownMinutes: Number(config.cooldownMinutes) || DEFAULT_CONFIG.cooldownMinutes,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
export async function saveHandoffConfig(newConfig) {
  const current = await getHandoffConfig();
  const merged = {
    enabled: newConfig.enabled !== undefined ? Boolean(newConfig.enabled) : current.enabled,
    maxConsecutiveLowConfidence: Number(newConfig.maxConsecutiveLowConfidence) || current.maxConsecutiveLowConfidence,
    lowConfidenceThreshold: Number(newConfig.lowConfidenceThreshold) || current.lowConfidenceThreshold,
    frustrationKeywords: Array.isArray(newConfig.frustrationKeywords) ? newConfig.frustrationKeywords.map(k => String(k).trim().toLowerCase()).filter(Boolean) : current.frustrationKeywords,
    humanRequestKeywords: Array.isArray(newConfig.humanRequestKeywords) ? newConfig.humanRequestKeywords.map(k => String(k).trim().toLowerCase()).filter(Boolean) : current.humanRequestKeywords,
    cooldownMinutes: Number(newConfig.cooldownMinutes) || current.cooldownMinutes,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: merged });
  return merged;
}
function normalizeText(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
export async function evaluateHandoff({ leadId, userMessage, aiConfidence }) {
  const config = await getHandoffConfig();
  if (!config.enabled) return { shouldHandoff: false, reason: null };
  const normalizedMsg = normalizeText(userMessage);
  for (const kw of config.humanRequestKeywords) {
    if (normalizedMsg.includes(normalizeText(kw))) {
      return { shouldHandoff: true, reason: "Solicitação explícita de atendimento humano", trigger: "human_request" };
    }
  }
  for (const kw of config.frustrationKeywords) {
    if (normalizedMsg.includes(normalizeText(kw))) {
      return { shouldHandoff: true, reason: "Frustração detectada na mensagem", trigger: "frustration" };
    }
  }
  if (typeof aiConfidence === "number" && aiConfidence < config.lowConfidenceThreshold) {
    const state = await getHandoffState(leadId);
    const consecutive = (state.consecutiveLowConfidence || 0) + 1;
    await setHandoffState(leadId, { consecutiveLowConfidence: consecutive, lastCheckAt: new Date().toISOString() });
    if (consecutive >= config.maxConsecutiveLowConfidence) {
      return { shouldHandoff: true, reason: `${consecutive} respostas consecutivas com baixa confiança (< ${config.lowConfidenceThreshold})`, trigger: "low_confidence" };
    }
  } else if (typeof aiConfidence === "number") {
    await setHandoffState(leadId, { consecutiveLowConfidence: 0, lastCheckAt: new Date().toISOString() });
  }
  return { shouldHandoff: false, reason: null };
}
async function getHandoffState(leadId) {
  try {
    const result = await chrome.storage.local.get(STATE_KEY);
    const all = result[STATE_KEY] || {};
    return all[leadId] || { consecutiveLowConfidence: 0, lastCheckAt: null, handedOffAt: null };
  } catch {
    return { consecutiveLowConfidence: 0, lastCheckAt: null, handedOffAt: null };
  }
}
async function setHandoffState(leadId, partial) {
  try {
    const result = await chrome.storage.local.get(STATE_KEY);
    const all = result[STATE_KEY] || {};
    all[leadId] = { ...(all[leadId] || {}), ...partial };
    await chrome.storage.local.set({ [STATE_KEY]: all });
  } catch { /* silencioso */ }
}
export async function markHandedOff(leadId) {
  await setHandoffState(leadId, { handedOffAt: new Date().toISOString(), consecutiveLowConfidence: 0 });
  return true;
}
export async function clearHandoff(leadId) {
  await setHandoffState(leadId, { consecutiveLowConfidence: 0, handedOffAt: null, lastCheckAt: null });
  return true;
}
export async function isHandedOff(leadId) {
  const state = await getHandoffState(leadId);
  if (!state.handedOffAt) return false;
  const config = await getHandoffConfig();
  const elapsed = Date.now() - new Date(state.handedOffAt).getTime();
  if (elapsed > config.cooldownMinutes * 60 * 1000) return false;
  return true;
}
