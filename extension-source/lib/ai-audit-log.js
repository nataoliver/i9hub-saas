/**
 * i9Hub AI Supervisionada — Auditoria Local de Mensagens
 * Registra todas as interações da IA com retenção configurável e limpeza automática.
 * Armazenamento: chrome.storage.local (compatível com Manifest V3 service worker).
 */

const STORAGE_KEY = "i9hub_ai_audit_log";
const CONFIG_KEY = "i9hub_ai_audit_config";
const DEFAULT_RETENTION_DAYS = 30;
const MAX_LOG_ENTRIES = 5000;

export async function getAuditConfig() {
  try {
    const result = await chrome.storage.local.get(CONFIG_KEY);
    const config = result[CONFIG_KEY] || {};
    return {
      retentionDays: Number(config.retentionDays) || DEFAULT_RETENTION_DAYS,
      enabled: config.enabled !== false,
    };
  } catch {
    return { retentionDays: DEFAULT_RETENTION_DAYS, enabled: true };
  }
}

export async function saveAuditConfig(newConfig) {
  const current = await getAuditConfig();
  const merged = {
    retentionDays: Number(newConfig.retentionDays) || current.retentionDays,
    enabled: newConfig.enabled !== undefined ? Boolean(newConfig.enabled) : current.enabled,
  };
  await chrome.storage.local.set({ [CONFIG_KEY]: merged });
  return merged;
}

export function buildAuditEntry({ leadId, prompt, response, provider, inputTokens, outputTokens, status, blockReason }) {
  return {
    id: "audit_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    leadId: String(leadId || "").slice(0, 100),
    prompt: String(prompt || "").slice(0, 4000),
    response: String(response || "").slice(0, 4000),
    provider: String(provider || "unknown").slice(0, 50),
    inputTokens: Number.isFinite(inputTokens) ? Math.max(0, Math.round(inputTokens)) : 0,
    outputTokens: Number.isFinite(outputTokens) ? Math.max(0, Math.round(outputTokens)) : 0,
    status: String(status || "suggestion").slice(0, 30),
    blockReason: blockReason ? String(blockReason).slice(0, 500) : null,
    timestamp: new Date().toISOString(),
  };
}

export async function recordAuditEntry(entry) {
  const config = await getAuditConfig();
  if (!config.enabled) return false;
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const logs = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    logs.push(entry);
    if (logs.length > MAX_LOG_ENTRIES) {
      logs.splice(0, logs.length - MAX_LOG_ENTRIES);
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: logs });
    return true;
  } catch {
    return false;
  }
}

export async function getAuditLogs(filters = {}) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    let logs = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    if (filters.leadId) logs = logs.filter(l => l.leadId === filters.leadId);
    if (filters.provider) logs = logs.filter(l => l.provider === filters.provider);
    if (filters.status) logs = logs.filter(l => l.status === filters.status);
    logs.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    const limit = Number(filters.limit) || 100;
    return logs.slice(0, limit);
  } catch {
    return [];
  }
}

export async function purgeOldAuditLogs() {
  const config = await getAuditConfig();
  const cutoff = new Date(Date.now() - config.retentionDays * 24 * 3600 * 1000).toISOString();
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const logs = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    const before = logs.length;
    const filtered = logs.filter(l => l.timestamp >= cutoff);
    const removed = before - filtered.length;
    if (removed > 0) {
      await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
    }
    return removed;
  } catch {
    return 0;
  }
}

export async function getAuditStats() {
  const logs = await getAuditLogs({ limit: MAX_LOG_ENTRIES });
  const stats = { total: logs.length, byProvider: {}, byStatus: {}, totalInputTokens: 0, totalOutputTokens: 0 };
  for (const l of logs) {
    stats.byProvider[l.provider] = (stats.byProvider[l.provider] || 0) + 1;
    stats.byStatus[l.status] = (stats.byStatus[l.status] || 0) + 1;
    stats.totalInputTokens += l.inputTokens || 0;
    stats.totalOutputTokens += l.outputTokens || 0;
  }
  return stats;
}

export async function clearAuditLogs() {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
