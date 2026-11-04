/**
 * Memória contextual minimizada por conversa para o Chat com IA.
 * Guarda apenas fatos profissionais/operacionais estruturados; nunca guarda telefone
 * ou transcrição bruta. O modo Autoconhecimento não persiste fatos da conversa.
 */
export const AI_CONVERSATION_MEMORY_LIMIT = 500;
export const AI_CONVERSATION_MEMORY_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const KEY_RE = /^chat_[a-f0-9]{1,16}$/i;
const COMMON_FIELDS = ['company', 'profession', 'primaryNiche', 'nichePath', 'subniches', 'services'];
const COMMERCIAL_FIELDS = ['exactRequest', 'need', 'budget', 'timeframe', 'nextStep', 'summary'];

function text(value, max = 240) {
  const out = String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
  if (!out || /^(não informado|nao informado|desconhecido|unknown|n\/a|nenhum|ainda não identificado|ainda nao identificado)$/i.test(out)) return '';
  return out;
}
function list(value, maxItems = 8, maxLen = 100) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item, maxLen)).filter(Boolean))].slice(0, maxItems);
}
function modeOf(value) { return ['networking', 'self_knowledge', 'commercial'].includes(value) ? value : 'commercial'; }

export function normalizeAiConversationMemoryEntry(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const mode = modeOf(input.personaMode);
  if (mode === 'self_knowledge') return null;
  const out = {
    personaMode: mode,
    updatedAt: text(input.updatedAt, 40) || new Date(0).toISOString(),
    company: text(input.company, 180),
    profession: text(input.profession, 180),
    primaryNiche: text(input.primaryNiche, 120),
    nichePath: list(input.nichePath, 6, 100),
    subniches: list(input.subniches, 8, 100),
    services: text(input.services, 220),
  };
  if (mode === 'commercial') {
    for (const key of COMMERCIAL_FIELDS) out[key] = text(input[key], key === 'summary' || key === 'exactRequest' ? 500 : 240);
  }
  const hasFacts = [...COMMON_FIELDS, ...(mode === 'commercial' ? COMMERCIAL_FIELDS : [])].some((key) => Array.isArray(out[key]) ? out[key].length : !!out[key]);
  return hasFacts ? out : null;
}

/** Mergeia fatos novos confirmados. Valores vazios nunca apagam fatos anteriores. */
export function mergeAiConversationMemory(previous = {}, qualification = {}, personaMode = 'commercial', at = new Date().toISOString()) {
  const mode = modeOf(personaMode);
  if (mode === 'self_knowledge') return null;
  const q = qualification && typeof qualification === 'object' ? qualification : {};
  const niche = q.nicheClassification && typeof q.nicheClassification === 'object' ? q.nicheClassification : {};
  const next = {
    personaMode: mode,
    updatedAt: text(at, 40) || new Date().toISOString(),
    company: text(q.company, 180),
    profession: text(q.segment, 180),
    primaryNiche: text(niche.primaryNiche || q.segment, 120),
    nichePath: list(niche.path, 6, 100),
    subniches: list(niche.subniches || niche.subNiches, 8, 100),
    services: text(q.service, 220),
  };
  if (mode === 'commercial') {
    next.exactRequest = text(q.exactRequest, 500);
    next.need = text(q.need, 240);
    next.budget = text(q.budget, 240);
    next.timeframe = text(q.timeframe, 240);
    next.nextStep = text(q.nextStep, 240);
    next.summary = text(q.summary, 500);
  }
  const old = normalizeAiConversationMemoryEntry(previous) || {};
  const hasNewFacts = [...COMMON_FIELDS, ...(mode === 'commercial' ? COMMERCIAL_FIELDS : [])]
    .some((key) => Array.isArray(next[key]) ? next[key].length > 0 : !!next[key]);
  if (!hasNewFacts && old.personaMode === mode) return Object.keys(old).length ? old : null;
  const merged = { ...old, personaMode: mode, updatedAt: next.updatedAt };
  for (const key of [...COMMON_FIELDS, ...(mode === 'commercial' ? COMMERCIAL_FIELDS : [])]) {
    const value = next[key];
    if (Array.isArray(value) ? value.length : !!value) merged[key] = value;
  }
  // Networking guarda somente fatos profissionais, nunca resumo/pedido/orçamento.
  if (mode !== 'commercial') for (const key of COMMERCIAL_FIELDS) delete merged[key];
  return normalizeAiConversationMemoryEntry(merged);
}

/** Mescla mapas de dois dispositivos por conversa, preservando campos não vazios e fatos mais recentes. */
export function mergeAiConversationMemoryMaps(local = {}, remote = {}, options = {}) {
  const now = Number(options.now) || Date.now();
  const maxAge = Number(options.maxAgeMs) || AI_CONVERSATION_MEMORY_MAX_AGE_MS;
  const byKey = new Map();
  const add = (source, sourceName) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return;
    for (const [key, raw] of Object.entries(source)) {
      if (!KEY_RE.test(key)) continue;
      const entry = normalizeAiConversationMemoryEntry(raw);
      if (!entry) continue;
      const updated = Date.parse(entry.updatedAt) || 0;
      if (updated && now - updated > maxAge) continue;
      const current = byKey.get(key);
      if (!current) { byKey.set(key, { entry, sourceName }); continue; }
      const currentTs = Date.parse(current.entry.updatedAt) || 0;
      const incomingWins = updated > currentTs || (updated === currentTs && sourceName === 'local');
      const newer = incomingWins ? entry : current.entry;
      const older = incomingWins ? current.entry : entry;
      const merged = { ...older, ...newer };
      for (const field of [...COMMON_FIELDS, ...COMMERCIAL_FIELDS]) {
        const newValue = newer[field]; const oldValue = older[field];
        if (Array.isArray(newValue) ? !newValue.length : !newValue) {
          if (Array.isArray(oldValue) ? oldValue.length : !!oldValue) merged[field] = oldValue;
        }
      }
      if (merged.personaMode !== 'commercial') for (const field of COMMERCIAL_FIELDS) delete merged[field];
      const normalized = normalizeAiConversationMemoryEntry(merged);
      if (normalized) byKey.set(key, { entry: normalized, sourceName: incomingWins ? sourceName : current.sourceName });
    }
  };
  add(remote, 'remote');
  add(local, 'local');
  const entries = [...byKey.entries()].sort((a, b) => (Date.parse(b[1].entry.updatedAt) || 0) - (Date.parse(a[1].entry.updatedAt) || 0)).slice(0, AI_CONVERSATION_MEMORY_LIMIT);
  return Object.fromEntries(entries.map(([key, value]) => [key, value.entry]));
}

export function buildAiConversationMemoryPrompt(entry, personaMode = 'commercial') {
  const mode = modeOf(personaMode);
  if (mode === 'self_knowledge') return '';
  const normalized = normalizeAiConversationMemoryEntry(entry);
  if (!normalized) return '';
  const fields = mode === 'commercial'
    ? [['Empresa', normalized.company], ['Atuação / nicho', normalized.primaryNiche || normalized.profession], ['Especialidades', normalized.nichePath.join(' > ') || normalized.subniches.join(', ')], ['Serviços', normalized.services], ['Pedido já identificado', normalized.exactRequest], ['Necessidade', normalized.need], ['Orçamento informado', normalized.budget], ['Prazo', normalized.timeframe], ['Próximo passo', normalized.nextStep], ['Resumo comercial', normalized.summary]]
    : [['Empresa/projeto', normalized.company], ['Profissão/atuação', normalized.profession], ['Nicho', normalized.primaryNiche], ['Especialidades', normalized.nichePath.join(' > ') || normalized.subniches.join(', ')], ['Serviços profissionais', normalized.services]];
  const lines = fields.filter(([, value]) => value && (Array.isArray(value) ? value.length : true)).map(([label, value]) => `${label}: ${Array.isArray(value) ? value.join(', ') : value}`);
  if (!lines.length) return '';
  return `FATOS ANTERIORMENTE IDENTIFICADOS (memória estruturada, não é transcrição):\n${lines.join('\n')}\nUse somente se ainda forem pertinentes, não repita perguntas já respondidas e priorize correções mais recentes feitas pela própria pessoa.`;
}
