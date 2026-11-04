/**
 * Normaliza os catálogos de modelos dos provedores de IA para a interface do i9Hub.
 * Não contém chaves nem faz chamadas de rede; pode ser testado isoladamente.
 */
const MAX_MODELS = 400;

function asText(value, max = 180) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function modelRecord(id, label, description = '') {
  const cleanId = asText(id, 240).replace(/^models\//, '');
  if (!cleanId) return null;
  const cleanLabel = asText(label, 240);
  const cleanDescription = asText(description, 300);
  return {
    id: cleanId,
    label: cleanLabel && cleanLabel !== cleanId ? `${cleanLabel} — ${cleanId}` : cleanId,
    description: cleanDescription,
  };
}

function isLikelyOpenAIChatModel(id) {
  const value = String(id || '').toLowerCase();
  if (!value) return false;
  if (/(embedding|whisper|tts|dall-e|moderation|transcri|translat|realtime|audio|image|search|computer-use|deep-research)/i.test(value)) return false;
  return /^(gpt-|chatgpt-|o[134](?:-|$)|ft:gpt-|codex-mini|computer-use-)/i.test(value);
}

function sortModels(models) {
  const unique = new Map();
  for (const model of models) if (model?.id && !unique.has(model.id)) unique.set(model.id, model);
  return [...unique.values()].sort((a, b) => {
    const rank = (model) => {
      const id = model.id.toLowerCase();
      if (/(flash|mini|haiku)/.test(id)) return 0;
      if (/(sonnet|gpt-4o|gpt-4\.1)/.test(id)) return 1;
      if (/(pro|opus)/.test(id)) return 2;
      return 3;
    };
    return rank(a) - rank(b) || a.id.localeCompare(b.id);
  }).slice(0, MAX_MODELS);
}

export function normalizeAiModelList(provider, payload) {
  const data = Array.isArray(payload?.data)
    ? payload.data
    : (Array.isArray(payload?.models) && provider !== 'gemini' ? payload.models : (Array.isArray(payload) ? payload : []));
  const geminiModels = Array.isArray(payload?.models) ? payload.models : [];
  let models = [];

  if (provider === 'gemini') {
    models = geminiModels
      .filter((item) => Array.isArray(item?.supportedGenerationMethods) && item.supportedGenerationMethods.includes('generateContent'))
      .map((item) => modelRecord(item.name, item.displayName, item.description));
  } else if (provider === 'openai') {
    models = data
      .filter((item) => isLikelyOpenAIChatModel(item?.id))
      .map((item) => modelRecord(item.id, item.id, item.owned_by ? `Disponível para a conta; proprietário: ${item.owned_by}` : ''));
  } else if (provider === 'anthropic') {
    models = data.map((item) => modelRecord(item.id, item.display_name || item.displayName || item.id, item.description));
  } else if (provider === 'openrouter') {
    models = data
      .filter((item) => {
        const modality = String(item?.architecture?.modality || '').toLowerCase();
        return !modality || modality.includes('text');
      })
      .map((item) => {
        const pricing = item?.pricing;
        const free = pricing && Number(pricing.prompt) === 0 && Number(pricing.completion) === 0;
        const context = Number(item?.context_length) > 0 ? `Contexto: ${Number(item.context_length).toLocaleString('pt-BR')} tokens` : '';
        const pricingLabel = free ? 'Catálogo indica preço zero' : '';
        return modelRecord(item.id, item.name || item.id, [context, pricingLabel].filter(Boolean).join(' · '));
      });
  } else if (['custom', '8token', '9router'].includes(provider)) {
    models = data
      .map((item) => {
        if (typeof item === 'string') return modelRecord(item, item);
        const id = item?.id || item?.name || item?.model;
        const label = item?.display_name || item?.displayName || item?.name || id;
        const desc = item?.owned_by ? `Roteador / Provedor: ${item.owned_by}` : (item?.description || '');
        return modelRecord(id, label, desc);
      });
  }

  return sortModels(models.filter(Boolean));
}

export function preferredAiModel(models, currentModel = '') {
  if (!Array.isArray(models) || !models.length) return '';
  const current = String(currentModel || '').replace(/^models\//, '');
  if (current && models.some((item) => item.id === current)) return current;
  return models.find((item) => /(flash|mini|haiku)/i.test(item.id))?.id || models[0].id;
}
