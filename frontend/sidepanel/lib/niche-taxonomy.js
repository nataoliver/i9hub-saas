/** Taxonomia interna dinâmica do i9Hub: nichos hierárquicos e etiquetas livres. */
const cleanText = (value, max = 120) => String(value ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
export const normalizeTaxonomyName = (value) => cleanText(value, 120).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (value) => normalizeTaxonomyName(value).replace(/\s+/g, '_').slice(0, 50) || 'item';
const validType = (value) => value === 'tag' ? 'tag' : 'niche';
const dateValue = (value, fallback) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : fallback;

export function normalizeNicheTaxonomy(input = {}, now = new Date().toISOString()) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const rawNodes = Array.isArray(source.nodes) ? source.nodes : [];
  const nodes = [];
  const ids = new Set();
  for (const raw of rawNodes.slice(0, 50000)) {
    if (!raw || typeof raw !== 'object') continue;
    const id = cleanText(raw.id, 120);
    const name = cleanText(raw.name, 120);
    if (!id || !name || ids.has(id)) continue;
    ids.add(id);
    const type = validType(raw.type);
    const parentId = type === 'niche' && raw.parentId ? cleanText(raw.parentId, 120) : null;
    nodes.push({
      id, name, type, parentId,
      aliases: [...new Set((Array.isArray(raw.aliases) ? raw.aliases : []).map((item) => cleanText(item, 120)).filter(Boolean))].slice(0, 30),
      source: raw.source === 'manual' ? 'manual' : 'ai',
      confidence: Number.isFinite(Number(raw.confidence)) ? Math.max(0, Math.min(1, Number(raw.confidence))) : 0,
      evidence: [...new Set((Array.isArray(raw.evidence) ? raw.evidence : []).map((item) => cleanText(item, 350)).filter(Boolean))].slice(0, 8),
      createdAt: dateValue(raw.createdAt, now), updatedAt: dateValue(raw.updatedAt, now),
      deletedAt: raw.deletedAt ? dateValue(raw.deletedAt, now) : null,
    });
  }
  const activeNicheIds = new Set(nodes.filter((node) => !node.deletedAt && node.type === 'niche').map((node) => node.id));
  for (const node of nodes) {
    if (node.type === 'niche' && node.parentId && !activeNicheIds.has(node.parentId)) node.parentId = null;
    if (node.type === 'tag') node.parentId = null;
  }
  // Break malformed cycles rather than letting a corrupted backup freeze the taxonomy view.
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    const seen = new Set([node.id]); let parent = node.parentId; let depth = 0;
    while (parent && byId.has(parent) && depth++ < 100) {
      if (seen.has(parent)) { node.parentId = null; break; }
      seen.add(parent); parent = byId.get(parent)?.parentId || null;
    }
    if (depth >= 100) node.parentId = null;
  }
  return { version: 1, nodes, updatedAt: dateValue(source.updatedAt, now) };
}

export function mergeNicheTaxonomies(local = {}, remote = {}, now = new Date().toISOString()) {
  const a = normalizeNicheTaxonomy(local, now); const b = normalizeNicheTaxonomy(remote, now);
  const map = new Map();
  for (const node of [...a.nodes, ...b.nodes]) {
    const current = map.get(node.id);
    if (!current || (Date.parse(node.updatedAt) || 0) > (Date.parse(current.updatedAt) || 0)) map.set(node.id, node);
  }
  return normalizeNicheTaxonomy({ version: 1, nodes: [...map.values()], updatedAt: (Date.parse(a.updatedAt) || 0) > (Date.parse(b.updatedAt) || 0) ? a.updatedAt : b.updatedAt }, now);
}

export function createTaxonomyNode(inputState, input = {}, now = new Date().toISOString(), idFactory = null) {
  const taxonomy = normalizeNicheTaxonomy(inputState, now);
  const name = cleanText(input.name, 120); const type = validType(input.type);
  const parentId = type === 'niche' && input.parentId ? cleanText(input.parentId, 120) : null;
  if (!name || !normalizeTaxonomyName(name)) return { success: false, error: 'Informe um nome válido para a classificação.' };
  if (parentId) {
    const parent = taxonomy.nodes.find((node) => node.id === parentId && !node.deletedAt && node.type === 'niche');
    if (!parent) return { success: false, error: 'O nicho pai selecionado não existe ou está inativo.' };
  }
  const key = normalizeTaxonomyName(name);
  const duplicate = taxonomy.nodes.find((node) => !node.deletedAt && node.type === type && (type === 'tag' || node.parentId === parentId) && (normalizeTaxonomyName(node.name) === key || node.aliases.some((alias) => normalizeTaxonomyName(alias) === key)));
  if (duplicate) return { success: true, created: false, node: duplicate, taxonomy, duplicate: true };
  const generated = idFactory ? idFactory(name, type, parentId) : `${type === 'tag' ? 'tag' : 'niche'}_${slug(name)}_${Math.random().toString(36).slice(2, 7)}`;
  const id = cleanText(generated, 120);
  const node = { id, name, type, parentId, aliases: [], source: input.source === 'manual' ? 'manual' : 'ai', confidence: Number.isFinite(Number(input.confidence)) ? Math.max(0, Math.min(1, Number(input.confidence))) : 0, evidence: [...new Set((Array.isArray(input.evidence) ? input.evidence : []).map((item) => cleanText(item, 350)).filter(Boolean))].slice(0, 8), createdAt: now, updatedAt: now, deletedAt: null };
  taxonomy.nodes.push(node); taxonomy.updatedAt = now;
  return { success: true, created: true, node, taxonomy };
}

export function updateTaxonomyNode(inputState, nodeId, patch = {}, now = new Date().toISOString()) {
  const taxonomy = normalizeNicheTaxonomy(inputState, now);
  const node = taxonomy.nodes.find((item) => item.id === nodeId && !item.deletedAt);
  if (!node) return { success: false, error: 'Classificação não encontrada.' };
  if (patch.name !== undefined) {
    const name = cleanText(patch.name, 120); const key = normalizeTaxonomyName(name);
    if (!key) return { success: false, error: 'Informe um nome válido.' };
    const duplicate = taxonomy.nodes.find((item) => item.id !== nodeId && !item.deletedAt && item.type === node.type && (node.type === 'tag' || item.parentId === node.parentId) && normalizeTaxonomyName(item.name) === key);
    if (duplicate) return { success: false, error: 'Já existe uma classificação com esse nome neste nível.' };
    node.name = name;
  }
  if (patch.parentId !== undefined && node.type === 'niche') {
    const parentId = patch.parentId ? cleanText(patch.parentId, 120) : null;
    if (parentId === node.id) return { success: false, error: 'Uma classificação não pode ser filha de si mesma.' };
    if (parentId) {
      const parent = taxonomy.nodes.find((item) => item.id === parentId && !item.deletedAt && item.type === 'niche');
      if (!parent) return { success: false, error: 'Nicho pai inválido.' };
      let cursor = parent; let depth = 0;
      while (cursor && depth++ < 100) { if (cursor.id === node.id) return { success: false, error: 'Essa alteração criaria um ciclo na árvore.' }; cursor = taxonomy.nodes.find((item) => item.id === cursor.parentId && !item.deletedAt) || null; }
    }
    node.parentId = parentId;
  }
  if (Array.isArray(patch.aliases)) node.aliases = [...new Set(patch.aliases.map((item) => cleanText(item, 120)).filter(Boolean))].slice(0, 30);
  node.source = patch.source === 'ai' ? 'ai' : 'manual'; node.updatedAt = now; taxonomy.updatedAt = now;
  return { success: true, node, taxonomy };
}

export function deleteTaxonomyNode(inputState, nodeId, now = new Date().toISOString()) {
  const taxonomy = normalizeNicheTaxonomy(inputState, now);
  const node = taxonomy.nodes.find((item) => item.id === nodeId && !item.deletedAt);
  if (!node) return { success: false, error: 'Classificação não encontrada.' };
  if (taxonomy.nodes.some((item) => !item.deletedAt && item.parentId === nodeId)) return { success: false, code: 'HAS_CHILDREN', error: 'Esse nicho possui subnichos. Mova ou remova os subnichos antes de excluir o nicho principal.' };
  node.deletedAt = now; node.updatedAt = now; taxonomy.updatedAt = now;
  return { success: true, node, taxonomy };
}

export function applyAiNicheClassification(inputState, lead, rawClassification = {}, now = new Date().toISOString()) {
  const confidenceRaw = Number(rawClassification.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw > 1 ? confidenceRaw / 100 : confidenceRaw)) : 0;
  const evidence = [...new Set((Array.isArray(rawClassification.evidence) ? rawClassification.evidence : []).map((item) => cleanText(item, 350)).filter(Boolean))].slice(0, 8);
  let path = (Array.isArray(rawClassification.path) ? rawClassification.path : []).map((item) => cleanText(item, 120)).filter(Boolean).slice(0, 12);
  if (!path.length) {
    const primary = cleanText(rawClassification.primaryNiche, 120);
    const sub = (Array.isArray(rawClassification.subniches) ? rawClassification.subniches : []).map((item) => cleanText(item, 120)).filter(Boolean).slice(0, 11);
    path = [primary, ...sub].filter(Boolean);
  }
  const rawTags = (Array.isArray(rawClassification.tags) ? rawClassification.tags : []).map((item) => cleanText(item, 100)).filter(Boolean).slice(0, 30);
  if ((!path.length && (!rawTags.length || confidence < 0.7)) || confidence < 0.65 || !evidence.length) return { applied: false, reason: 'low-confidence-or-no-evidence', taxonomy: normalizeNicheTaxonomy(inputState, now), lead };
  let taxonomy = normalizeNicheTaxonomy(inputState, now); const nodeIds = []; let parentId = null;
  for (const name of path) {
    const result = createTaxonomyNode(taxonomy, { name, type: 'niche', parentId, source: 'ai', confidence, evidence }, now);
    if (!result.success) return { applied: false, reason: result.error, taxonomy };
    taxonomy = result.taxonomy; nodeIds.push(result.node.id); parentId = result.node.id;
  }
  const tagIds = new Set(Array.isArray(lead?.aiTagIds) ? lead.aiTagIds : []);
  const aiTags = new Set(Array.isArray(lead?.aiTags) ? lead.aiTags : []);
  if (confidence >= 0.7) {
    for (const name of rawTags) {
      const result = createTaxonomyNode(taxonomy, { name, type: 'tag', source: 'ai', confidence, evidence }, now);
      if (!result.success) continue;
      taxonomy = result.taxonomy; tagIds.add(result.node.id); aiTags.add(result.node.name);
    }
  }
  const previousClassifications = Array.isArray(lead?.aiNicheClassifications) ? lead.aiNicheClassifications : (lead?.aiNicheClassification?.path?.length ? [lead.aiNicheClassification] : []);
  let boundedClassifications = previousClassifications;
  let currentClassification = lead?.aiNicheClassification || {};
  if (path.length) {
    const classification = { primaryNiche: path[0], path, nodeIds, confidence, evidence, updatedAt: now, source: 'ai' };
    const pathKey = nodeIds.join('>');
    const nextClassifications = previousClassifications.filter((item) => (Array.isArray(item?.nodeIds) ? item.nodeIds.join('>') : (item?.path || []).map(normalizeTaxonomyName).join('>')) !== pathKey);
    nextClassifications.push(classification);
    nextClassifications.sort((a, b) => (Date.parse(a.updatedAt || '') || 0) - (Date.parse(b.updatedAt || '') || 0));
    boundedClassifications = nextClassifications.slice(-20);
    currentClassification = boundedClassifications[boundedClassifications.length - 1] || classification;
  }
  const updatedLead = { ...lead,
    ...(path.length ? { aiNicheClassification: currentClassification, aiNicheClassifications: boundedClassifications } : {}),
    aiTagIds: [...tagIds], aiTags: [...aiTags],
    updatedAt: now,
  };
  taxonomy.updatedAt = now;
  return { applied: true, taxonomy, lead: updatedLead, createdOrUpdatedNodes: nodeIds.length + rawTags.length };
}

export function rebuildLeadTaxonomyFields(lead, inputTaxonomy) {
  const taxonomy = normalizeNicheTaxonomy(inputTaxonomy);
  const active = new Map(taxonomy.nodes.filter((node) => !node.deletedAt).map((node) => [node.id, node]));
  const old = lead?.aiNicheClassification || {};
  const oldClassifications = Array.isArray(lead?.aiNicheClassifications) ? lead.aiNicheClassifications : (old.path?.length ? [old] : []);
  const classifications = oldClassifications.map((item) => {
    const nodeIds = (Array.isArray(item?.nodeIds) ? item.nodeIds : []).filter((id) => active.has(id) && active.get(id).type === 'niche');
    const path = nodeIds.map((id) => active.get(id).name);
    return { ...item, primaryNiche: path[0] || '', path, nodeIds, updatedAt: new Date().toISOString() };
  }).filter((item) => item.path.length);
  classifications.sort((a, b) => (Date.parse(a.updatedAt || '') || 0) - (Date.parse(b.updatedAt || '') || 0));
  const currentClassification = classifications[classifications.length - 1] || { ...old, primaryNiche: '', path: [], nodeIds: [], updatedAt: new Date().toISOString() };
  const tagIds = (Array.isArray(lead?.aiTagIds) ? lead.aiTagIds : []).filter((id) => active.has(id) && active.get(id).type === 'tag');
  const unlinkedTags = Array.isArray(lead?.aiTags) ? lead.aiTags.filter((name) => !taxonomy.nodes.some((node) => node.type === 'tag' && normalizeTaxonomyName(node.name) === normalizeTaxonomyName(name))) : [];
  const aiTags = [...new Set([...tagIds.map((id) => active.get(id).name), ...unlinkedTags])];
  return { ...lead, aiNicheClassification: currentClassification, aiNicheClassifications: classifications, aiTagIds: tagIds, aiTags };
}


/** Merges a taxonomy node into a chosen canonical sibling, preserving references in the caller. */
export function mergeTaxonomyNodes(inputState, sourceId, targetId, now = new Date().toISOString()) {
  const taxonomy = normalizeNicheTaxonomy(inputState, now);
  const source = taxonomy.nodes.find((node) => node.id === String(sourceId) && !node.deletedAt);
  const target = taxonomy.nodes.find((node) => node.id === String(targetId) && !node.deletedAt);
  if (!source || !target) return { success: false, error: 'A classificação de origem ou destino não existe mais.' };
  if (source.id === target.id) return { success: false, error: 'Escolha duas classificações diferentes.' };
  if (source.type !== target.type) return { success: false, error: 'Só é possível consolidar classificações do mesmo tipo.' };
  if (source.type === 'niche' && source.parentId !== target.parentId) return { success: false, error: 'Para preservar a hierarquia, só é possível consolidar nichos que tenham o mesmo nicho pai.' };
  const targetAliases = [...target.aliases, source.name, ...source.aliases].filter((alias) => String(alias) !== String(target.name));
  target.aliases = [...new Set(targetAliases)].slice(-30);
  target.updatedAt = now;
  let reparentedChildren = 0;
  if (source.type === 'niche') {
    for (const child of taxonomy.nodes) {
      if (!child.deletedAt && child.type === 'niche' && child.parentId === source.id) { child.parentId = target.id; child.updatedAt = now; reparentedChildren++; }
    }
  }
  source.deletedAt = now; source.updatedAt = now;
  taxonomy.updatedAt = now;
  return { success: true, source, target, taxonomy, reparentedChildren };
}
