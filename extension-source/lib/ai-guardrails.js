/**
 * i9Hub AI Supervisionada — Guardrails (Assuntos Proibidos Configuráveis)
 * Filtra prompts e respostas da IA contra tópicos proibidos antes e depois da chamada à API.
 */

const STORAGE_KEY = "i9hub_ai_guardrails";
const DEFAULT_SAFE_RESPONSE = "Desculpe, não posso abordar este tema. Posso ajudar com outra questão?";

export async function getGuardrailsConfig() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const config = result[STORAGE_KEY] || {};
    return {
      enabled: config.enabled !== false,
      forbiddenKeywords: Array.isArray(config.forbiddenKeywords) ? config.forbiddenKeywords : [],
      forbiddenPatterns: Array.isArray(config.forbiddenPatterns) ? config.forbiddenPatterns : [],
      safeResponse: String(config.safeResponse || DEFAULT_SAFE_RESPONSE).slice(0, 500),
      blockOnInput: config.blockOnInput !== false,
      blockOnOutput: config.blockOnOutput !== false,
    };
  } catch {
    return { enabled: true, forbiddenKeywords: [], forbiddenPatterns: [], safeResponse: DEFAULT_SAFE_RESPONSE, blockOnInput: true, blockOnOutput: true };
  }
}

export async function saveGuardrailsConfig(newConfig) {
  const current = await getGuardrailsConfig();
  const merged = {
    enabled: newConfig.enabled !== undefined ? Boolean(newConfig.enabled) : current.enabled,
    forbiddenKeywords: Array.isArray(newConfig.forbiddenKeywords) ? newConfig.forbiddenKeywords.map(k => String(k).trim().toLowerCase()).filter(Boolean).slice(0, 200) : current.forbiddenKeywords,
    forbiddenPatterns: Array.isArray(newConfig.forbiddenPatterns) ? newConfig.forbiddenPatterns.map(p => String(p).trim()).filter(Boolean).slice(0, 50) : current.forbiddenPatterns,
    safeResponse: newConfig.safeResponse !== undefined ? String(newConfig.safeResponse || DEFAULT_SAFE_RESPONSE).slice(0, 500) : current.safeResponse,
    blockOnInput: newConfig.blockOnInput !== undefined ? Boolean(newConfig.blockOnInput) : current.blockOnInput,
    blockOnOutput: newConfig.blockOnOutput !== undefined ? Boolean(newConfig.blockOnOutput) : current.blockOnOutput,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: merged });
  return merged;
}

function normalizeText(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function checkAgainstGuardrails(text, config) {
  if (!config || config.enabled === false) return { blocked: false, reason: null };
  const normalized = normalizeText(text);
  for (const kw of (config.forbiddenKeywords || [])) {
    if (normalized.includes(normalizeText(kw))) {
      return { blocked: true, reason: `Palavra-chave proibida detectada: \"${kw}\"` };
    }
  }
  for (const pattern of (config.forbiddenPatterns || [])) {
    try {
      const re = new RegExp(pattern, "i");
      if (re.test(text)) {
        return { blocked: true, reason: `Padrão proibido detectado: \"${pattern}\"` };
      }
    } catch { /* padrão inválido, ignorar */ }
  }
  return { blocked: false, reason: null };
}

export async function validatePrompt(prompt) {
  const config = await getGuardrailsConfig();
  if (!config.enabled || !config.blockOnInput) return { allowed: true, safeResponse: null, reason: null };
  const result = checkAgainstGuardrails(prompt, config);
  if (result.blocked) {
    return { allowed: false, safeResponse: config.safeResponse, reason: result.reason };
  }
  return { allowed: true, safeResponse: null, reason: null };
}

export async function validateResponse(response) {
  const config = await getGuardrailsConfig();
  if (!config.enabled || !config.blockOnOutput) return { allowed: true, safeResponse: null, reason: null };
  const result = checkAgainstGuardrails(response, config);
  if (result.blocked) {
    return { allowed: false, safeResponse: config.safeResponse, reason: result.reason };
  }
  return { allowed: true, safeResponse: null, reason: null };
}

export async function addForbiddenKeyword(keyword) {
  const config = await getGuardrailsConfig();
  const kw = String(keyword || "").trim().toLowerCase();
  if (!kw || config.forbiddenKeywords.includes(kw)) return config;
  config.forbiddenKeywords.push(kw);
  if (config.forbiddenKeywords.length > 200) config.forbiddenKeywords = config.forbiddenKeywords.slice(-200);
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
  return config;
}

export async function removeForbiddenKeyword(keyword) {
  const config = await getGuardrailsConfig();
  const kw = String(keyword || "").trim().toLowerCase();
  config.forbiddenKeywords = config.forbiddenKeywords.filter(k => k !== kw);
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
  return config;
}

export async function addForbiddenPattern(pattern) {
  const config = await getGuardrailsConfig();
  const p = String(pattern || "").trim();
  if (!p || config.forbiddenPatterns.includes(p)) return config;
  try { new RegExp(p, "i"); } catch { return config; }
  config.forbiddenPatterns.push(p);
  if (config.forbiddenPatterns.length > 50) config.forbiddenPatterns = config.forbiddenPatterns.slice(-50);
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
  return config;
}

export async function removeForbiddenPattern(pattern) {
  const config = await getGuardrailsConfig();
  const p = String(pattern || "").trim();
  config.forbiddenPatterns = config.forbiddenPatterns.filter(pat => pat !== p);
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
  return config;
}
