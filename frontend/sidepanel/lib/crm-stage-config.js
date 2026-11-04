/** Configuração do funil comercial do CRM. Estágios padrão mantêm IDs estáveis para não quebrar automações. */
export const DEFAULT_CRM_STAGES = [
  { id: 'novo', title: 'Novo', color: '#3b82f6' },
  { id: 'contatado', title: 'Contatado', color: '#f59e0b' },
  { id: 'qualificado', title: 'Qualificado', color: '#8b5cf6' },
  { id: 'proposta', title: 'Proposta', color: '#06b6d4' },
  { id: 'fechado', title: 'Fechado', color: '#22c55e' },
  { id: 'perdido', title: 'Perdido', color: '#ef4444' },
  { id: 'blacklist', title: 'Black list', color: '#111827' },
];

const DEFAULT_IDS = new Set(DEFAULT_CRM_STAGES.map((stage) => stage.id));
const safeText = (value, max = 80) => String(value ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
const safeColor = (value, fallback = '#6366f1') => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback;
const normalized = (value) => safeText(value, 120).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const dateValueForStage = (value, fallback) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : fallback;

export function normalizeCrmStageConfig(input = {}, now = new Date().toISOString()) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const overrides = {};
  const rawOverrides = source.overrides && typeof source.overrides === 'object' && !Array.isArray(source.overrides) ? source.overrides : {};
  for (const [id, raw] of Object.entries(rawOverrides)) {
    if (!DEFAULT_IDS.has(id) || !raw || typeof raw !== 'object') continue;
    const title = safeText(raw.title, 80);
    if (!title) continue;
    const base = DEFAULT_CRM_STAGES.find((stage) => stage.id === id);
    overrides[id] = { title, color: safeColor(raw.color, base?.color || '#6366f1') };
  }
  const deletedCustomIds = [...new Set((Array.isArray(source.deletedCustomIds) ? source.deletedCustomIds : []).map((id) => safeText(id, 100)).filter((id) => id.startsWith('crm_')))];
  const deletedSet = new Set(deletedCustomIds);
  const custom = [];
  const seenIds = new Set();
  const seenNames = new Set(DEFAULT_CRM_STAGES.map((stage) => normalized(overrides[stage.id]?.title || stage.title)));
  const rawCustom = Array.isArray(source.custom) ? source.custom : [];
  for (const raw of rawCustom.slice(0, 2000)) {
    if (!raw || typeof raw !== 'object') continue;
    const id = safeText(raw.id, 100);
    const title = safeText(raw.title, 80);
    const key = normalized(title);
    if (!id.startsWith('crm_') || deletedSet.has(id) || !title || seenIds.has(id) || !key || seenNames.has(key)) continue;
    seenIds.add(id); seenNames.add(key);
    custom.push({ id, title, color: safeColor(raw.color), order: Number.isFinite(Number(raw.order)) ? Math.max(0, Math.min(10000, Number(raw.order))) : custom.length, source: 'crm_custom', isCustom: true, updatedAt: dateValueForStage(source.updatedAt, now) });
  }
  custom.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'pt-BR'));
  return { version: 1, overrides, custom, deletedCustomIds, updatedAt: safeText(source.updatedAt, 40) || now };
}

export function buildCrmStageList(defaultStages = DEFAULT_CRM_STAGES, legacyStages = [], rawConfig = {}) {
  const config = normalizeCrmStageConfig(rawConfig);
  const defaults = defaultStages.map((stage) => ({
    ...stage,
    ...(config.overrides[stage.id] || {}),
    isSystem: true,
    isCustom: false,
    canDelete: false,
    source: 'system',
  }));
  const legacy = (Array.isArray(legacyStages) ? legacyStages : [])
    .filter((stage) => stage && stage.id)
    .filter((stage) => !DEFAULT_IDS.has(String(stage.id)))
    .map((stage) => ({ ...stage, title: safeText(stage.title || stage.id, 80), color: safeColor(stage.color), isSystem: true, isCustom: false, canDelete: false, source: stage.source || (String(stage.id).startsWith('bp_') ? 'business_profile' : 'legacy') }));
  const ids = new Set(defaults.map((stage) => stage.id));
  const extra = legacy.filter((stage) => !ids.has(stage.id) && (ids.add(stage.id), true));
  const custom = config.custom.filter((stage) => !ids.has(stage.id) && (ids.add(stage.id), true));
  return [...defaults, ...extra, ...custom];
}

export function mergeCrmStageConfig(local = {}, remote = {}) {
  const localTs = Date.parse(local?.updatedAt || '') || 0;
  const remoteTs = Date.parse(remote?.updatedAt || '') || 0;
  const stableFallback = '1970-01-01T00:00:00.000Z';
  const a = normalizeCrmStageConfig(local, stableFallback); const b = normalizeCrmStageConfig(remote, stableFallback);
  const preferred = remoteTs > localTs ? b : a;
  const deletedCustomIds = [...new Set([...(a.deletedCustomIds || []), ...(b.deletedCustomIds || [])])];
  const deleted = new Set(deletedCustomIds);
  const customMap = new Map();
  for (const stage of [...a.custom, ...b.custom]) {
    if (deleted.has(stage.id)) continue;
    const current = customMap.get(stage.id);
    if (!current || (Date.parse(stage.updatedAt || '') || 0) > (Date.parse(current.updatedAt || '') || 0)) customMap.set(stage.id, stage);
  }
  const custom = [...customMap.values()].sort((x, y) => x.order - y.order || x.title.localeCompare(y.title, 'pt-BR')).map((stage, index) => ({ ...stage, order: index }));
  const updatedAt = remoteTs > localTs ? b.updatedAt : a.updatedAt;
  return normalizeCrmStageConfig({ ...preferred, custom, deletedCustomIds, updatedAt });
}

export function makeStageId(title, suffix = Math.random().toString(36).slice(2, 7)) {
  const slug = normalized(title).replace(/\s+/g, '_').slice(0, 36) || 'etapa';
  return `crm_${slug}_${String(suffix).replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'novo'}`;
}
