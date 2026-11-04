/**
 * i9Hub CRM — histórico e anotações locais.
 * Mantém notas editáveis separadas de eventos automáticos de auditoria.
 */
export const CRM_HISTORY_VERSION = 1;
export const CRM_NOTE_MAX_LENGTH = 5000;
export const CRM_NOTE_MAX_ITEMS = 500;
export const CRM_ACTIVITY_MAX_ITEMS = 500;

const SYSTEM_ACTOR_RE = /^(ia|sistema|system|bot|assistente)(\b|$)/i;

function asText(value, max = 500) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function stableLegacyId(note, index) {
  const raw = `${index}|${note?.date || note?.createdAt || ''}|${note?.author || ''}|${note?.text || ''}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `legacy_${(hash >>> 0).toString(36)}`;
}

export function createCrmRecordId(prefix = 'crm') {
  let token = '';
  try { token = globalThis.crypto?.randomUUID?.() || ''; } catch { /* fallback abaixo */ }
  if (!token) token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  return `${asText(prefix, 20) || 'crm'}_${token}`;
}

export function normalizeCrmNote(note, index = 0) {
  if (!note || typeof note !== 'object' || Array.isArray(note)) return null;
  const text = asText(note.text, CRM_NOTE_MAX_LENGTH);
  if (!text) return null;
  const author = asText(note.author || note.createdBy || 'Usuário', 100);
  const createdAt = asText(note.createdAt || note.date || note.timestamp, 50) || new Date(0).toISOString();
  const source = asText(note.source || (SYSTEM_ACTOR_RE.test(author) ? 'system' : 'legacy'), 40);
  const manual = note.manual === true || source === 'manual' || (source === 'legacy' && !SYSTEM_ACTOR_RE.test(author));
  return {
    ...note,
    id: asText(note.id || note.noteId, 120) || stableLegacyId(note, index),
    text,
    author,
    date: createdAt,
    createdAt,
    updatedAt: asText(note.updatedAt, 50) || createdAt,
    source,
    manual,
    kind: 'note',
  };
}

export function normalizeCrmNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes
    .map((note, index) => normalizeCrmNote(note, index))
    .filter(Boolean);
}

export function createManualCrmNote(text, author = 'Usuário', now = new Date().toISOString(), id = createCrmRecordId('note')) {
  const cleanText = asText(text, CRM_NOTE_MAX_LENGTH);
  if (!cleanText) throw new Error('Escreva uma anotação antes de salvar.');
  return {
    id: asText(id, 120) || createCrmRecordId('note'),
    text: cleanText,
    author: asText(author || 'Usuário', 100),
    source: 'manual',
    manual: true,
    kind: 'note',
    date: now,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeCrmActivityEvent(event, index = 0) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const title = asText(event.title || event.label || event.type, 160);
  if (!title) return null;
  const createdAt = asText(event.createdAt || event.date || event.timestamp, 50) || new Date(0).toISOString();
  return {
    id: asText(event.id, 120) || `activity_${index}_${createdAt}`,
    type: asText(event.type || 'activity', 80),
    title,
    description: asText(event.description || event.summary, 500),
    actor: asText(event.actor || 'Sistema', 100),
    source: asText(event.source || 'system', 40),
    createdAt,
    metadata: event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
      ? event.metadata : {},
  };
}

export function appendCrmActivity(lead, event, options = {}) {
  if (!lead || typeof lead !== 'object') return null;
  const now = options.now || new Date().toISOString();
  const normalized = normalizeCrmActivityEvent({
    id: event?.id || createCrmRecordId('activity'),
    type: event?.type || 'activity',
    title: event?.title || event?.type || 'Atividade',
    description: event?.description || '',
    actor: event?.actor || 'Sistema',
    source: event?.source || 'system',
    createdAt: event?.createdAt || now,
    metadata: event?.metadata || {},
  });
  if (!normalized) return null;
  const current = Array.isArray(lead.activityLog) ? lead.activityLog : [];
  if (current.some((item) => String(item?.id || '') === normalized.id)) return normalized;
  lead.activityLog = [...current.map((item, index) => normalizeCrmActivityEvent(item, index)).filter(Boolean), normalized]
    .slice(-CRM_ACTIVITY_MAX_ITEMS);
  return normalized;
}

export function buildCrmTimeline(lead, options = {}) {
  const limit = Math.max(1, Math.min(500, Number(options.limit) || 100));
  const notes = normalizeCrmNotes(lead?.notes).map((note) => ({
    id: note.id,
    kind: 'note',
    type: 'note.created',
    title: 'Anotação',
    description: note.text,
    text: note.text,
    actor: note.author,
    source: note.source,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    editable: note.manual === true,
  }));
  const activities = (Array.isArray(lead?.activityLog) ? lead.activityLog : [])
    .map((event, index) => normalizeCrmActivityEvent(event, index))
    .filter(Boolean)
    .map((event) => ({ ...event, kind: 'activity', editable: false }));
  return [...notes, ...activities]
    .sort((a, b) => {
      const delta = Date.parse(b.createdAt) - Date.parse(a.createdAt);
      return Number.isFinite(delta) && delta !== 0 ? delta : String(b.id).localeCompare(String(a.id));
    })
    .slice(0, limit);
}
