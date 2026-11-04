/**
 * i9Hub AI Supervisionada — Base de Conhecimento Versionada
 * Gerencia contexto da IA com versionamento automático e rollback.
 */

const STORAGE_KEY = "i9hub_ai_knowledge_base";
const MAX_VERSIONS = 50;

export async function getKnowledgeBase() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || { current: "", versions: [], updatedAt: null };
  } catch {
    return { current: "", versions: [], updatedAt: null };
  }
}

export async function updateKnowledgeBase(newContent, reason) {
  const kb = await getKnowledgeBase();
  const version = {
    id: "kb_v" + Date.now().toString(36),
    content: String(newContent || "").slice(0, 20000),
    reason: String(reason || "Atualização manual").slice(0, 500),
    createdAt: new Date().toISOString(),
  };
  // Salva versão anterior antes de atualizar
  if (kb.current) {
    kb.versions.push({
      id: "kb_v" + Date.now().toString(36) + "_prev",
      content: kb.current,
      reason: "Auto-save antes da atualização",
      createdAt: kb.updatedAt || new Date().toISOString(),
    });
  }
  // Limita histórico de versões
  if (kb.versions.length > MAX_VERSIONS) {
    kb.versions = kb.versions.slice(-MAX_VERSIONS);
  }
  kb.current = version.content;
  kb.updatedAt = version.createdAt;
  await chrome.storage.local.set({ [STORAGE_KEY]: kb });
  return { success: true, versionId: version.id, totalVersions: kb.versions.length };
}

export async function rollbackToVersion(versionId) {
  const kb = await getKnowledgeBase();
  const target = kb.versions.find(v => v.id === versionId);
  if (!target) return { success: false, error: "Versão não encontrada" };
  // Salva estado atual como nova versão antes do rollback
  if (kb.current) {
    kb.versions.push({
      id: "kb_v" + Date.now().toString(36) + "_pre_rollback",
      content: kb.current,
      reason: "Auto-save antes do rollback",
      createdAt: new Date().toISOString(),
    });
  }
  kb.current = target.content;
  kb.updatedAt = new Date().toISOString();
  if (kb.versions.length > MAX_VERSIONS) {
    kb.versions = kb.versions.slice(-MAX_VERSIONS);
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: kb });
  return { success: true, rolledBackTo: versionId, totalVersions: kb.versions.length };
}

export async function getKnowledgeVersions(limit) {
  const kb = await getKnowledgeBase();
  const versions = [...kb.versions].reverse();
  const l = Number(limit) || 20;
  return versions.slice(0, l).map(v => ({
    id: v.id,
    reason: v.reason,
    createdAt: v.createdAt,
    contentLength: (v.content || "").length,
  }));
}

export async function getKnowledgeVersionContent(versionId) {
  const kb = await getKnowledgeBase();
  const v = kb.versions.find(ver => ver.id === versionId);
  return v ? { id: v.id, content: v.content, reason: v.reason, createdAt: v.createdAt } : null;
}

export async function getCurrentKnowledge() {
  const kb = await getKnowledgeBase();
  return { content: kb.current || "", updatedAt: kb.updatedAt, hasContent: Boolean(kb.current) };
}

export async function clearKnowledgeBase() {
  await chrome.storage.local.remove(STORAGE_KEY);
  return { success: true };
}
