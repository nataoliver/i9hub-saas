/**
 * i9Hub AI Supervisionada — Controle de Custos por Provedor
 * Limites de gastos/tokens com fallback automático em cascata via 9Route.
 */

const STORAGE_KEY = "i9hub_ai_cost_control";
const USAGE_KEY = "i9hub_ai_cost_usage";

const DEFAULT_PROVIDERS = Object.freeze([
  { id: "groq", name: "Groq", costPer1kInput: 0.0005, costPer1kOutput: 0.0008, priority: 1 },
  { id: "gemini", name: "Gemini", costPer1kInput: 0.0007, costPer1kOutput: 0.0021, priority: 2 },
  { id: "openai", name: "OpenAI", costPer1kInput: 0.0015, costPer1kOutput: 0.006, priority: 3 },
  { id: "anthropic", name: "Anthropic", costPer1kInput: 0.003, costPer1kOutput: 0.015, priority: 4 },
]);

export async function getCostConfig() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const config = result[STORAGE_KEY] || {};
    return {
      enabled: config.enabled !== false,
      dailyLimitUsd: Number(config.dailyLimitUsd) || 5,
      monthlyLimitUsd: Number(config.monthlyLimitUsd) || 100,
      providerLimits: config.providerLimits || {},
      providers: Array.isArray(config.providers) && config.providers.length > 0 ? config.providers : [...DEFAULT_PROVIDERS],
    };
  } catch {
    return { enabled: true, dailyLimitUsd: 5, monthlyLimitUsd: 100, providerLimits: {}, providers: [...DEFAULT_PROVIDERS] };
  }
}

export async function saveCostConfig(newConfig) {
  const current = await getCostConfig();
  const merged = {
    enabled: newConfig.enabled !== undefined ? Boolean(newConfig.enabled) : current.enabled,
    dailyLimitUsd: Number(newConfig.dailyLimitUsd) || current.dailyLimitUsd,
    monthlyLimitUsd: Number(newConfig.monthlyLimitUsd) || current.monthlyLimitUsd,
    providerLimits: newConfig.providerLimits || current.providerLimits,
    providers: Array.isArray(newConfig.providers) && newConfig.providers.length > 0 ? newConfig.providers : current.providers,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: merged });
  return merged;
}

export async function getUsageStats() {
  try {
    const result = await chrome.storage.local.get(USAGE_KEY);
    return result[USAGE_KEY] || { daily: {}, monthly: {}, byProvider: {}, lastResetDaily: null, lastResetMonthly: null };
  } catch {
    return { daily: {}, monthly: {}, byProvider: {}, lastResetDaily: null, lastResetMonthly: null };
  }
}

function todayKey() { return new Date().toISOString().slice(0, 10); }
function monthKey() { return new Date().toISOString().slice(0, 7); }

export async function recordUsage(providerId, inputTokens, outputTokens, costUsd) {
  const usage = await getUsageStats();
  const dKey = todayKey();
  const mKey = monthKey();
  if (!usage.daily[dKey]) usage.daily[dKey] = { costUsd: 0, tokens: 0 };
  if (!usage.monthly[mKey]) usage.monthly[mKey] = { costUsd: 0, tokens: 0 };
  if (!usage.byProvider[providerId]) usage.byProvider[providerId] = { costUsd: 0, tokens: 0, requests: 0 };
  usage.daily[dKey].costUsd += costUsd;
  usage.daily[dKey].tokens += inputTokens + outputTokens;
  usage.monthly[mKey].costUsd += costUsd;
  usage.monthly[mKey].tokens += inputTokens + outputTokens;
  usage.byProvider[providerId].costUsd += costUsd;
  usage.byProvider[providerId].tokens += inputTokens + outputTokens;
  usage.byProvider[providerId].requests += 1;
  usage.lastResetDaily = dKey;
  usage.lastResetMonthly = mKey;
  await chrome.storage.local.set({ [USAGE_KEY]: usage });
  return usage;
}

export async function checkBudgetAndSelectProvider(requestedProvider) {
  const config = await getCostConfig();
  if (!config.enabled) return { allowed: true, provider: requestedProvider || config.providers[0]?.id, reason: null };
  const usage = await getUsageStats();
  const dKey = todayKey();
  const mKey = monthKey();
  const dailyUsed = usage.daily[dKey]?.costUsd || 0;
  const monthlyUsed = usage.monthly[mKey]?.costUsd || 0;
  if (monthlyUsed >= config.monthlyLimitUsd) {
    return { allowed: false, provider: null, reason: "Limite mensal de custo atingido" };
  }
  if (dailyUsed >= config.dailyLimitUsd) {
    return { allowed: false, provider: null, reason: "Limite diário de custo atingido" };
  }
  // Fallback em cascata: tenta o provedor solicitado, se excedeu limite específico vai para o próximo
  const sorted = [...config.providers].sort((a, b) => (a.priority || 99) - (b.priority || 99));
  for (const prov of sorted) {
    const provLimit = config.providerLimits[prov.id];
    const provUsed = usage.byProvider[prov.id]?.costUsd || 0;
    if (provLimit && typeof provLimit.maxCostUsd === "number" && provUsed >= provLimit.maxCostUsd) continue;
    if (requestedProvider && prov.id === requestedProvider) return { allowed: true, provider: prov.id, reason: null };
    if (!requestedProvider) return { allowed: true, provider: prov.id, reason: null };
  }
  // Se o provedor solicitado está bloqueado, faz fallback
  if (requestedProvider) {
    for (const prov of sorted) {
      const provLimit = config.providerLimits[prov.id];
      const provUsed = usage.byProvider[prov.id]?.costUsd || 0;
      if (provLimit && typeof provLimit.maxCostUsd === "number" && provUsed >= provLimit.maxCostUsd) continue;
      return { allowed: true, provider: prov.id, reason: `Fallback de ${requestedProvider} para ${prov.id} (limite atingido)` };
    }
  }
  return { allowed: false, provider: null, reason: "Todos os provedores atingiram seus limites" };
}

export function estimateCost(providerId, inputTokens, outputTokens, providers) {
  const list = providers || DEFAULT_PROVIDERS;
  const prov = list.find(p => p.id === providerId);
  if (!prov) return 0;
  return ((inputTokens / 1000) * (prov.costPer1kInput || 0)) + ((outputTokens / 1000) * (prov.costPer1kOutput || 0));
}

export async function resetUsage(period) {
  const usage = await getUsageStats();
  if (period === "daily") {
    usage.daily[todayKey()] = { costUsd: 0, tokens: 0 };
  } else if (period === "monthly") {
    usage.monthly[monthKey()] = { costUsd: 0, tokens: 0 };
  } else if (period === "all") {
    usage.daily = {};
    usage.monthly = {};
    usage.byProvider = {};
  }
  await chrome.storage.local.set({ [USAGE_KEY]: usage });
  return usage;
}
