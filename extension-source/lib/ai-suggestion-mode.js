/**
 * i9Hub AI Supervisionada — Modo Sugestão com Aprovação Humana
 * Respostas da IA são salvas como rascunho e só enviadas após aprovação explícita.
 */
import { buildAuditEntry, recordAuditEntry } from "./ai-audit-log.js";

const STORAGE_KEY = "i9hub_ai_suggestions";
const MAX_PENDING = 200;

export async function getPendingSuggestions(leadId) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    let list = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    if (leadId) list = list.filter(s => s.leadId === leadId);
    list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return list;
  } catch {
    return [];
  }
}

export async function createSuggestion({ leadId, prompt, response, provider, inputTokens, outputTokens }) {
  const suggestion = {
    id: "sug_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    leadId: String(leadId || "").slice(0, 100),
    prompt: String(prompt || "").slice(0, 4000),
    response: String(response || "").slice(0, 4000),
    provider: String(provider || "unknown").slice(0, 50),
    inputTokens: Number.isFinite(inputTokens) ? Math.max(0, Math.round(inputTokens)) : 0,
    outputTokens: Number.isFinite(outputTokens) ? Math.max(0, Math.round(outputTokens)) : 0,
    status: "pending",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const list = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    list.push(suggestion);
    if (list.length > MAX_PENDING) list.splice(0, list.length - MAX_PENDING);
    await chrome.storage.local.set({ [STORAGE_KEY]: list });
    await recordAuditEntry(buildAuditEntry({
      leadId: suggestion.leadId, prompt: suggestion.prompt, response: suggestion.response,
      provider: suggestion.provider, inputTokens: suggestion.inputTokens,
      outputTokens: suggestion.outputTokens, status: "suggestion",
    }));
    return suggestion;
  } catch {
    return null;
  }
}

export async function approveSuggestion(suggestionId) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const list = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    const idx = list.findIndex(s => s.id === suggestionId && s.status === "pending");
    if (idx === -1) return null;
    list[idx].status = "approved";
    list[idx].resolvedAt = new Date().toISOString();
    await chrome.storage.local.set({ [STORAGE_KEY]: list });
    await recordAuditEntry(buildAuditEntry({
      leadId: list[idx].leadId, prompt: list[idx].prompt, response: list[idx].response,
      provider: list[idx].provider, inputTokens: list[idx].inputTokens,
      outputTokens: list[idx].outputTokens, status: "approved",
    }));
    return list[idx];
  } catch {
    return null;
  }
}

export async function discardSuggestion(suggestionId) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const list = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    const idx = list.findIndex(s => s.id === suggestionId && s.status === "pending");
    if (idx === -1) return null;
    list[idx].status = "discarded";
    list[idx].resolvedAt = new Date().toISOString();
    await chrome.storage.local.set({ [STORAGE_KEY]: list });
    await recordAuditEntry(buildAuditEntry({
      leadId: list[idx].leadId, prompt: list[idx].prompt, response: list[idx].response,
      provider: list[idx].provider, inputTokens: list[idx].inputTokens,
      outputTokens: list[idx].outputTokens, status: "discarded",
    }));
    return list[idx];
  } catch {
    return null;
  }
}

export async function editSuggestion(suggestionId, newResponse) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const list = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    const idx = list.findIndex(s => s.id === suggestionId && s.status === "pending");
    if (idx === -1) return null;
    list[idx].response = String(newResponse || "").slice(0, 4000);
    list[idx].editedAt = new Date().toISOString();
    await chrome.storage.local.set({ [STORAGE_KEY]: list });
    return list[idx];
  } catch {
    return null;
  }
}

export async function clearResolvedSuggestions() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const list = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    const pending = list.filter(s => s.status === "pending");
    await chrome.storage.local.set({ [STORAGE_KEY]: pending });
    return list.length - pending.length;
  } catch {
    return 0;
  }
}
