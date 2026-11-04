/**
 * i9Hub Classifier 2.0 — Feedback e Aprendizado Progressivo Local
 * Registra correções do usuário e ajusta pesos locais após threshold mínimo.
 */
const STORAGE_KEY = "i9hub_classifier_feedback_v2";
const MIN_CORRECTIONS_TO_ADJUST = 3;
const CLASSIFIER_VERSION = "classifier-2.0";
export function buildFeedbackEntry({ leadId, previousDecision, newDecision, previousIntent, newIntent, previousUrgency, newUrgency, reason, user, nicheModel }) {
  return {
    leadId: String(leadId || ""),
    previousDecision: previousDecision || null,
    newDecision: newDecision || null,
    previousIntent: previousIntent || null,
    newIntent: newIntent || null,
    previousUrgency: previousUrgency || null,
    newUrgency: newUrgency || null,
    reason: String(reason || "").slice(0, 500),
    date: new Date().toISOString(),
    user: String(user || "default"),
    classifierVersion: CLASSIFIER_VERSION,
    nicheModel: nicheModel || "personalizado",
  };
}
function storageKeyFor(user, niche) {
  return `${STORAGE_KEY}:${String(user||"default")}:${String(niche||"personalizado")}`;
}
export async function recordFeedback(entry, storageApi) {
  if (!storageApi || typeof storageApi.get !== "function") return false;
  const key = storageKeyFor(entry.user, entry.nicheModel);
  try {
    const result = await storageApi.get(key);
    const list = Array.isArray(result?.[key]) ? result[key] : [];
    list.push(entry);
    // Mantém apenas últimas 500 entradas por chave para evitar crescimento infinito
    if (list.length > 500) list.splice(0, list.length - 500);
    await storageApi.set({ [key]: list });
    return true;
  } catch { return false; }
}
export async function getFeedbackHistory(user, niche, storageApi) {
  if (!storageApi || typeof storageApi.get !== "function") return [];
  const key = storageKeyFor(user, niche);
  try {
    const result = await storageApi.get(key);
    return Array.isArray(result?.[key]) ? result[key] : [];
  } catch { return []; }
}
export async function resetFeedback(user, niche, storageApi) {
  if (!storageApi || typeof storageApi.remove !== "function") return false;
  const key = storageKeyFor(user, niche);
  try { await storageApi.remove(key); return true; } catch { return false; }
}
/**
 * Verifica se há aprendizado local suficiente para ajustar uma regra.
 * Retorna ajustes sugeridos baseados em correções repetidas.
 */
export function computeLocalAdjustments(history) {
  if (!Array.isArray(history) || history.length < MIN_CORRECTIONS_TO_ADJUST) return { hasAdjustment: false, adjustments: [] };
  const correctionCounts = {};
  for (const entry of history) {
    if (!entry.previousDecision || !entry.newDecision) continue;
    const key = `${entry.previousDecision}->${entry.newDecision}`;
    correctionCounts[key] = (correctionCounts[key] || 0) + 1;
  }
  const adjustments = [];
  for (const [key, count] of Object.entries(correctionCounts)) {
    if (count >= MIN_CORRECTIONS_TO_ADJUST) {
      const [from, to] = key.split("->");
      adjustments.push({ from, to, count, applied: true });
    }
  }
  return { hasAdjustment: adjustments.length > 0, adjustments };
}
export function wasAdjustedByFeedback(result, history) {
  if (!result || !Array.isArray(history)) return false;
  const adj = computeLocalAdjustments(history);
  if (!adj.hasAdjustment) return false;
  return adj.adjustments.some(a => a.from === result.tipo && a.count >= MIN_CORRECTIONS_TO_ADJUST);
}