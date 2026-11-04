/**
* i9Hub Prioridade 5 — Indicadores Comparativos por Nicho
* Compara métricas locais do usuário com benchmarks padrão dos modelos de nicho.
*/
import { NICHE_MODELS } from './niche-models.js';
const STATS_KEY = 'i9hub_niche_stats';
const DEFAULT_BENCHMARKS = Object.freeze({
  contabilidade: { conversionRate: 0.12, avgResponseTimeMin: 45, objectionRate: 0.18 },
  dentistas: { conversionRate: 0.22, avgResponseTimeMin: 30, objectionRate: 0.15 },
  advogados: { conversionRate: 0.08, avgResponseTimeMin: 60, objectionRate: 0.25 },
  varejo_roupas: { conversionRate: 0.15, avgResponseTimeMin: 20, objectionRate: 0.20 },
  vendas_recorrentes: { conversionRate: 0.10, avgResponseTimeMin: 35, objectionRate: 0.22 },
  personalizado: { conversionRate: 0.10, avgResponseTimeMin: 40, objectionRate: 0.20 },
});
export async function recordNicheEvent(nicheId, eventType) {
  if (!nicheId || !eventType) return;
  try {
    const result = await chrome.storage.local.get(STATS_KEY);
    const stats = result[STATS_KEY] || {};
    if (!stats[nicheId]) stats[nicheId] = { prospects: 0, clients: 0, objections: 0, responseTimes: [] };
    const s = stats[nicheId];
    if (eventType === 'prospect') s.prospects++;
    else if (eventType === 'client') s.clients++;
    else if (eventType === 'objection') s.objections++;
    else if (typeof eventType === 'number') {
      s.responseTimes.push(eventType);
      if (s.responseTimes.length > 500) s.responseTimes = s.responseTimes.slice(-500);
    }
    await chrome.storage.local.set({ [STATS_KEY]: stats });
  } catch { /* silencioso */ }
}
export async function getNicheBenchmarks(nicheId) {
  const model = NICHE_MODELS[nicheId];
  const benchmark = DEFAULT_BENCHMARKS[nicheId] || DEFAULT_BENCHMARKS.personalizado;
  const label = model ? model.nome : (nicheId || 'Personalizado');
  return { nicheId: nicheId || 'personalizado', label, ...benchmark };
}
export async function getNichePerformance(nicheId) {
  try {
    const result = await chrome.storage.local.get(STATS_KEY);
    const stats = result[STATS_KEY] || {};
    const s = stats[nicheId || 'personalizado'] || { prospects: 0, clients: 0, objections: 0, responseTimes: [] };
    const totalLeads = s.prospects + s.clients;
    const conversionRate = totalLeads > 0 ? s.clients / totalLeads : 0;
    const objectionRate = totalLeads > 0 ? s.objections / totalLeads : 0;
    const avgResponseTimeMin = s.responseTimes.length > 0
      ? Math.round(s.responseTimes.reduce((a, b) => a + b, 0) / s.responseTimes.length)
      : null;
    return {
      nicheId: nicheId || 'personalizado',
      totalLeads,
      prospects: s.prospects,
      clients: s.clients,
      objections: s.objections,
      conversionRate: Math.round(conversionRate * 1000) / 1000,
      objectionRate: Math.round(objectionRate * 1000) / 1000,
      avgResponseTimeMin,
    };
  } catch {
    return { nicheId: nicheId || 'personalizado', totalLeads: 0, prospects: 0, clients: 0, objections: 0, conversionRate: 0, objectionRate: 0, avgResponseTimeMin: null };
  }
}
export async function getComparison(nicheId) {
  const performance = await getNichePerformance(nicheId);
  const benchmark = await getNicheBenchmarks(nicheId);
  return {
    nicheId: performance.nicheId,
    label: benchmark.label,
    metrics: {
      conversionRate: { value: performance.conversionRate, benchmark: benchmark.conversionRate, delta: performance.conversionRate - benchmark.conversionRate },
      objectionRate: { value: performance.objectionRate, benchmark: benchmark.objectionRate, delta: performance.objectionRate - benchmark.objectionRate },
      avgResponseTimeMin: { value: performance.avgResponseTimeMin, benchmark: benchmark.avgResponseTimeMin, delta: performance.avgResponseTimeMin != null && benchmark.avgResponseTimeMin != null ? performance.avgResponseTimeMin - benchmark.avgResponseTimeMin : null },
    },
    sampleSize: performance.totalLeads,
  };
}
export async function getAllNicheComparisons() {
  const results = [];
  for (const nicheId of Object.keys(NICHE_MODELS)) {
    results.push(await getComparison(nicheId));
  }
  return results;
}
