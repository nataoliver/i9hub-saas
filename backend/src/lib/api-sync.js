/**
 * i9Hub — Sincronização de Modelos, Rate Limits e Reconciliação de Dados
 * Integra WhatsApp Web (fonte da verdade) com APIs de IA via chrome.storage.local.
 */
import { getRecentMessages } from './whatsapp-transport.js';

const MODELS_CACHE_KEY = 'i9hub_ai_models_cache';
const RATE_LIMIT_KEY = 'i9hub_ai_rate_limits';
const RECONCILIATION_KEY = 'i9hub_reconciliation_state';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

// === SINCRONIZAÇÃO DE MODELOS ===

export async function getCachedModels() {
  try {
    const result = await chrome.storage.local.get(MODELS_CACHE_KEY);
    return result[MODELS_CACHE_KEY] || { templates: [], systemPrompts: [], approvedResponses: [], lastSync: null };
  } catch {
    return { templates: [], systemPrompts: [], approvedResponses: [], lastSync: null };
  }
}

export async function updateModelsCache(models) {
  const cache = {
    templates: Array.isArray(models.templates) ? models.templates.slice(0, 100) : [],
    systemPrompts: Array.isArray(models.systemPrompts) ? models.systemPrompts.slice(0, 50) : [],
    approvedResponses: Array.isArray(models.approvedResponses) ? models.approvedResponses.slice(0, 200) : [],
    lastSync: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [MODELS_CACHE_KEY]: cache });
  return cache;
}

export async function fetchModelsFromBackend(baseUrl) {
  try {
    const resp = await fetch(`${baseUrl}/ai/models`, { credentials: 'omit', cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return await updateModelsCache(data);
  } catch (e) {
    console.warn('[api-sync] Falha ao buscar modelos:', e.message);
    return await getCachedModels();
  }
}

// === CONTROLE DE RATE LIMITS E SAÚDE DA API ===

export async function getRateLimitState(providerId) {
  try {
    const result = await chrome.storage.local.get(RATE_LIMIT_KEY);
    const all = result[RATE_LIMIT_KEY] || {};
    return all[providerId] || { remaining: null, resetAt: null, throttled: false, lastCheck: null };
  } catch {
    return { remaining: null, resetAt: null, throttled: false, lastCheck: null };
  }
}

export async function updateRateLimit(providerId, headers) {
  const state = {
    remaining: headers['x-ratelimit-remaining'] != null ? Number(headers['x-ratelimit-remaining']) : null,
    resetAt: headers['x-ratelimit-reset'] ? new Date(Number(headers['x-ratelimit-reset']) * 1000).toISOString() : null,
    throttled: false,
    lastCheck: new Date().toISOString(),
  };
  if (state.remaining !== null && state.remaining <= 5) state.throttled = true;
  try {
    const result = await chrome.storage.local.get(RATE_LIMIT_KEY);
    const all = result[RATE_LIMIT_KEY] || {};
    all[providerId] = state;
    await chrome.storage.local.set({ [RATE_LIMIT_KEY]: all });
  } catch { /* silencioso */ }
  return state;
}

export async function isProviderThrottled(providerId) {
  const state = await getRateLimitState(providerId);
  if (!state.throttled) return false;
  if (state.resetAt && new Date(state.resetAt) < new Date()) {
    await updateRateLimit(providerId, { 'x-ratelimit-remaining': '100' });
    return false;
  }
  return true;
}

export async function getApiHealthSummary() {
  try {
    const result = await chrome.storage.local.get(RATE_LIMIT_KEY);
    const all = result[RATE_LIMIT_KEY] || {};
    const summary = {};
    for (const [prov, state] of Object.entries(all)) {
      summary[prov] = {
        throttled: state.throttled,
        remaining: state.remaining,
        resetAt: state.resetAt,
        healthy: !state.throttled && (state.remaining === null || state.remaining > 10),
      };
    }
    return summary;
  } catch {
    return {};
  }
}

// === RECONCILIAÇÃO DE DADOS (WhatsApp Web ↔ IA) ===

export async function getReconciliationState(chatId) {
  try {
    const result = await chrome.storage.local.get(RECONCILIATION_KEY);
    const all = result[RECONCILIATION_KEY] || {};
    return all[chatId] || { lastProcessedMessageId: null, lastProcessedTimestamp: null, pendingCount: 0 };
  } catch {
    return { lastProcessedMessageId: null, lastProcessedTimestamp: null, pendingCount: 0 };
  }
}

export async function updateReconciliationState(chatId, messageId, timestamp) {
  try {
    const result = await chrome.storage.local.get(RECONCILIATION_KEY);
    const all = result[RECONCILIATION_KEY] || {};
    all[chatId] = {
      lastProcessedMessageId: String(messageId || '').slice(0, 100),
      lastProcessedTimestamp: timestamp || new Date().toISOString(),
      pendingCount: 0,
    };
    await chrome.storage.local.set({ [RECONCILIATION_KEY]: all });
  } catch { /* silencioso */ }
}

export async function reconcileChat(chatId, limit = 50) {
  const state = await getReconciliationState(chatId);
  const messages = await getRecentMessages(limit);
  if (!messages.length) return { gap: 0, newMessages: [], reconciled: true };
  let newMessages = messages;
  if (state.lastProcessedMessageId) {
    const idx = messages.findIndex(m => m.id === state.lastProcessedMessageId);
    if (idx >= 0) {
      newMessages = messages.slice(idx + 1);
    } else if (state.lastProcessedTimestamp) {
      const cutoff = new Date(state.lastProcessedTimestamp).getTime();
      newMessages = messages.filter(m => m.timestamp > cutoff);
    }
  }
  if (newMessages.length > 0) {
    const latest = newMessages[newMessages.length - 1];
    await updateReconciliationState(chatId, latest.id, latest.timestamp ? new Date(latest.timestamp * 1000).toISOString() : new Date().toISOString());
  }
  return { gap: newMessages.length, newMessages, reconciled: true };
}

export async function clearReconciliationState(chatId) {
  try {
    const result = await chrome.storage.local.get(RECONCILIATION_KEY);
    const all = result[RECONCILIATION_KEY] || {};
    delete all[chatId];
    await chrome.storage.local.set({ [RECONCILIATION_KEY]: all });
  } catch { /* silencioso */ }
}
