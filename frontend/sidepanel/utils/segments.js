// Segmentação de leads do CRM (grupo do WhatsApp, etiqueta, estágio) para
// alimentar campanhas WhatsApp e exportações.
import { normalizeType } from "../../lib/classifier.js";
const STAGES = { novo: 'Novo', contatado: 'Contatado', qualificado: 'Qualificado', proposta: 'Proposta', fechado: 'Fechado', perdido: 'Perdido', blacklist: 'Black list' };

// Níveis do CRM (mesma ordem/cores do Kanban).
// v1.4.0: a lista é MUTÁVEL (mesma referência para todas as telas): os 6 padrão + um estágio por etiqueta
// do WhatsApp (id "wl_..."), carregados do service worker por refreshStages().
export const STAGE_LIST = [
  { id: 'novo', title: 'Novo', color: '#3b82f6' },
  { id: 'contatado', title: 'Contatado', color: '#f59e0b' },
  { id: 'qualificado', title: 'Qualificado', color: '#8b5cf6' },
  { id: 'proposta', title: 'Proposta', color: '#06b6d4' },
  { id: 'fechado', title: 'Fechado', color: '#22c55e' },
  { id: 'perdido', title: 'Perdido', color: '#ef4444' },
  { id: 'blacklist', title: 'Black list', color: '#111827' },
];
/** Estágios que podem ser público de campanha (a Black list nunca recebe mensagem). */
export const campaignStages = () => STAGE_LIST.filter((s) => s.id !== 'blacklist');
export function setStageList(list) {
  STAGE_LIST.splice(0, STAGE_LIST.length, ...list);
  for (const k of Object.keys(STAGES)) delete STAGES[k];
  for (const s of STAGE_LIST) STAGES[s.id] = s.title;
}
export async function refreshStages(api) {
  try { const r = await api.getStages(); if (r?.success && r.data?.stages?.length) setStageList(r.data.stages); } catch { /* mantém os padrão */ }
  return STAGE_LIST;
}
export const stageTitle = (id) => STAGES[id] || id || '-';
export const stageColor = (id) => (STAGE_LIST.find((s) => s.id === id) || {}).color || '#6b7280';
export const isLabelStage = (id) => /^wl_/.test(String(id || ''));
export const leadStageOf = (l) => (STAGES[l.stage] ? l.stage : 'novo');

/**
 * Filtro múltiplo: dentro de cada critério vale "qualquer um" (OU); entre critérios, "todos" (E).
 * Ex.: níveis {novo, contatado} + etiqueta {vip} = leads novos OU contatados que tenham a etiqueta vip.
 * Conjunto vazio = sem filtro naquele critério.
 */
export function filterLeadsMulti(leads, { stages = new Set(), tags = new Set(), groups = new Set() } = {}) {
  return leads.filter((l) =>
    (!stages.size || stages.has(leadStageOf(l))) &&
    (!tags.size || leadTags(l).some((t) => tags.has(t))) &&
    (!groups.size || leadGroups(l).some((g) => groups.has(g))));
}

/** Evita campanhas acidentais para todos: ao menos um critério deve ser escolhido. */
export function hasSegmentCriteria({ stages = new Set(), tags = new Set(), groups = new Set() } = {}) {
  return Boolean(stages?.size || tags?.size || groups?.size);
}

/** Lead do CRM -> contato de campanha (variáveis {{nome}}, {{empresa}}, {{estagio}}...). */
export const leadToContact = (l) => ({
  name: String(l.name || '').trim(),
  phone: normPhone(l.phone),
  email: l.email || '',
  company: l.company || (l.source === 'google_maps' ? l.name || '' : ''),
  category: l.category || '',
  stage: isLabelStage(leadStageOf(l)) ? stageTitle(leadStageOf(l)) : leadStageOf(l),
  labels: (l.waLabels || []).join(', '),
  leadId: l.id || l.placeId || '',
});

export const normPhone = (p) => String(p || '').replace(/\D/g, '');
export const leadGroups = (l) => [...new Set([...(l.groups || []), l.groupName].filter(Boolean))];
export const leadTags = (l) => [...new Set([...(Array.isArray(l?.tags) ? l.tags : []), ...(Array.isArray(l?.aiTags) ? l.aiTags : []), ...(Array.isArray(l?.aiNicheClassification?.path) ? l.aiNicheClassification.path : []), ...(Array.isArray(l?.aiNicheClassifications) ? l.aiNicheClassifications.flatMap((classification) => Array.isArray(classification?.path) ? classification.path : []) : [])].map((tag) => String(tag || '').trim()).filter(Boolean))];

/** Etiquetas nativas sincronizadas do WhatsApp Business. */
export const leadWaLabels = (l) => [...new Set((Array.isArray(l?.waLabels) ? l.waLabels : []).map((tag) => String(tag || '').trim()).filter(Boolean))];

/** Classificações internas do i9Hub/IA, separadas das etiquetas nativas do WhatsApp. */
export const leadInternalTags = (l) => {
  const waLabels = new Set(leadWaLabels(l));
  return leadTags(l).filter((tag) => !waLabels.has(tag));
};

export async function loadLeadSegments(api) {
  await refreshStages(api);
  const res = await api.getSavedLeads();
  const leads = (res.success ? res.data : []) || [];
  const usable = leads.filter((l) => normPhone(l.phone).length >= 10 && !l.blacklisted && l.stage !== 'blacklist');
  const groups = new Map(); const tags = new Map(); const i9Tags = new Map(); const waLabels = new Map(); const stages = new Map(); const sources = new Map();
  const inc = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
  for (const l of usable) {
    leadGroups(l).forEach((g) => inc(groups, g));
    leadTags(l).forEach((t) => inc(tags, t)); // mapa legado: mantém o comportamento dos outros seletores
    leadInternalTags(l).forEach((t) => inc(i9Tags, t));
    leadWaLabels(l).forEach((t) => inc(waLabels, t));
    inc(sources, String(l.source || 'manual'));
    inc(stages, l.stage || 'novo');
  }
  return { leads: usable, groups, tags, i9Tags, waLabels, stages, sources };
}

export function filterLeads(leads, { group = '', tag = '', stage = '' } = {}) {
  return leads.filter((l) => (!group || leadGroups(l).includes(group)) && (!tag || leadTags(l).includes(tag)) && (!stage || (l.stage || 'novo') === stage));
}

// Uma linha por contato: "nome,telefone" (formato aceito pelos formulários de campanha).
export const toContactLines = (leads) => leads.map((l) => `${String(l.name || '').replace(/[,\r\n]+/g, ' ').trim()},${normPhone(l.phone)}`).join('\n');

export function segmentPickerHTML() {
  return `<div class="form-group" data-segment-picker><label class="form-label">Importar do CRM (segmentar)</label>
    <div class="form-row"><select class="form-select" data-seg="group"><option value="">Todos os grupos</option></select><select class="form-select" data-seg="tag"><option value="">Todas as etiquetas</option></select><select class="form-select" data-seg="stage"><option value="">Todos os estágios</option></select></div>
    <div class="form-group" style="margin-top:10px"><label class="toggle"><input type="checkbox" data-seg="include-spam"><span class="toggle-slider"></span> Incluir contatos classificados como Spam</label><small class="text-muted">Desligado por padrão.</small></div>
    <div class="btn-group" style="margin-top:8px;align-items:center"><button type="button" class="btn btn-secondary" data-seg="apply"><i class="fas fa-file-import"></i> Preencher contatos</button><small class="text-muted" data-seg="count"></small></div></div>`;
}

export async function bindSegmentPicker(root, textarea, app) {
  const picker = root.querySelector('[data-segment-picker]'); if (!picker || !textarea) return;
  const seg = await loadLeadSegments(app.api);
  const sel = (n) => picker.querySelector(`select[data-seg="${n}"]`);
  const fill = (select, map, label = (k) => k) => [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'pt-BR')).forEach(([k, n]) => { const o = document.createElement('option'); o.value = k; o.textContent = `${label(k)} (${n})`; select.appendChild(o); });
  fill(sel('group'), seg.groups); fill(sel('tag'), seg.tags); fill(sel('stage'), seg.stages, (k) => STAGES[k] || k);
  const current = () => {
    const includeSpam = picker.querySelector('[data-seg="include-spam"]')?.checked === true;
    return filterLeads(seg.leads, { group: sel('group').value, tag: sel('tag').value, stage: sel('stage').value })
      .filter((l) => includeSpam || normalizeType(l.tipo) !== 'spam');
  };
  const count = picker.querySelector('[data-seg="count"]');
  const update = () => { count.textContent = `${current().length} contatos com telefone`; };
  ['group', 'tag', 'stage'].forEach((n) => sel(n).addEventListener('change', update));
  picker.querySelector('[data-seg="include-spam"]')?.addEventListener('change', update);
  update();
  picker.querySelector('[data-seg="apply"]').addEventListener('click', () => {
    const list = current();
    if (!list.length) { app.showToast('Nenhum contato no CRM com esse filtro. Salve participantes de grupos no CRM primeiro.', 'warning'); return; }
    textarea.value = toContactLines(list); app.showToast(`${list.length} contatos preenchidos`, 'success');
  });
}

// Contatos enviados do CRM para um formulário de campanha ("Usar em campanha").
export function takePendingContacts(app) { const c = app.pendingContacts; app.pendingContacts = null; return c && c.length ? toContactLines(c) : ''; }
