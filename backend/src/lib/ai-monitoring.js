/**
 * Monitoramento local do Chat com IA.
 * Armazena apenas metadados de processamento; nunca conteúdo de mensagens ou telefones.
 */
export const AI_MONITOR_EVENT_LIMIT = 500;
const VALID_PERSONA_MODES = new Set(['networking', 'self_knowledge', 'commercial']);
const VALID_QUALIFICATION_STATUSES = new Set(['qualified', 'nurture', 'in_qualification', 'not_qualified', 'profile_identified']);
const VALID_PROCESS_STATUSES = new Set([
  'processed', 'reply-pending', 'error', 'paused', 'panel-not-open', 'chat-type-disabled',
  'group-not-selected', 'group-excluded', 'group-keywords-empty', 'group-trigger-required',
  'human-handoff-active', 'rate-limited', 'configuration-incomplete', 'license-blocked',
  'duplicate', 'duplicate-content', 'duplicate-in-flight', 'ignored', 'invalid-message', 'rate-limit-storage-error',
  'observed', 'observer-no-change', 'license-blocked-observer', 'observer-persona-not-supported'
]);

function clean(value, max = 160) {
  return String(value ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, max);
}
function cleanError(value) {
  return clean(value, 220)
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/ig, 'Bearer [oculto]')
    .replace(/\bsk-(?:ant-)?[A-Za-z0-9_-]{12,}\b/ig, '[CHAVE API OCULTA]')
    .replace(/\bAIzaSy[A-Za-z0-9_-]{20,}\b/g, '[CHAVE API OCULTA]')
    .replace(/\b[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3,}\b/ig, '[CHAVE OCULTA]');
}

export function normalizeAiMonitorEvent(input = {}) {
  const status = VALID_PROCESS_STATUSES.has(String(input.status || '')) ? String(input.status) : 'ignored';
  const mode = VALID_PERSONA_MODES.has(String(input.personaMode || '')) ? String(input.personaMode) : 'commercial';
  const qualificationStatus = VALID_QUALIFICATION_STATUSES.has(String(input.qualificationStatus || ''))
    ? String(input.qualificationStatus) : '';
  const hasConfidence = input.confidence !== null && input.confidence !== undefined && input.confidence !== '';
  const confidence = hasConfidence ? Number(input.confidence) : NaN;
  const hasDuration = input.durationMs !== null && input.durationMs !== undefined && input.durationMs !== '';
  return {
    id: clean(input.id, 100),
    eventKey: clean(input.eventKey, 100),
    at: clean(input.at || new Date().toISOString(), 40),
    status,
    category: status === 'processed' ? 'response_sent'
      : status === 'reply-pending' ? 'response_pending'
        : status === 'observed' ? 'crm_observation_updated'
          : status === 'observer-no-change' ? 'crm_observation_no_change'
            : status === 'error' ? 'error' : 'skipped',
    personaId: clean(input.personaId || 'global', 100) || 'global',
    personaName: clean(input.personaName || 'Perfil global', 100) || 'Perfil global',
    personaMode: mode,
    operationMode: input.operationMode === 'observe_only' ? 'observe_only' : 'auto_reply',
    chatType: input.chatType === 'group' ? 'group' : 'private',
    chatName: clean(input.chatName || (input.chatType === 'group' ? 'Grupo' : 'Conversa privada'), 100),
    provider: clean(input.provider, 40),
    model: clean(input.model, 100),
    durationMs: hasDuration && Number.isFinite(Number(input.durationMs)) ? Math.max(0, Math.min(600000, Math.round(Number(input.durationMs)))) : null,
    qualificationStatus: mode === 'self_knowledge' ? '' : qualificationStatus,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    qualified: mode === 'commercial' && input.qualified === true,
    niche: mode === 'self_knowledge' ? '' : clean(input.niche, 100),
    error: ['error', 'reply-pending'].includes(status) ? cleanError(input.error) : '',
  };
}

export function summarizeAiMonitorEvents(input = []) {
  const events = (Array.isArray(input) ? input : [])
    .slice(0, AI_MONITOR_EVENT_LIMIT)
    .map(normalizeAiMonitorEvent);
  const byPersona = new Map();
  const totals = { received: events.length, responses: 0, analyzed: 0, observerNoChange: 0, errors: 0, pendingReplies: 0, skipped: 0, classified: 0, qualified: 0 };

  for (const event of events) {
    if (event.status === 'processed') totals.responses += 1;
    else if (event.status === 'observed') totals.analyzed += 1;
    else if (event.status === 'observer-no-change') totals.observerNoChange += 1;
    else if (event.status === 'error') totals.errors += 1;
    else if (event.status === 'reply-pending') totals.pendingReplies += 1;
    else totals.skipped += 1;
    if (event.qualificationStatus || event.niche) totals.classified += 1;
    if (event.qualified) totals.qualified += 1;

    const key = event.personaId || 'global';
    if (!byPersona.has(key)) byPersona.set(key, {
      personaId: key, personaName: event.personaName || 'Perfil global', personaMode: event.personaMode, operationMode: event.operationMode,
      messages: 0, responses: 0, analyzed: 0, observerNoChange: 0, errors: 0, pendingReplies: 0, skipped: 0,
      classified: 0, qualified: 0, attempted: 0, niches: Object.create(null), latestAt: event.at,
    });
    const row = byPersona.get(key);
    row.messages += 1;
    if (event.status === 'processed') { row.responses += 1; row.attempted += 1; }
    else if (event.status === 'observed') row.analyzed += 1;
    else if (event.status === 'observer-no-change') row.observerNoChange += 1;
    else if (event.status === 'error') { row.errors += 1; row.attempted += 1; }
    else if (event.status === 'reply-pending') { row.pendingReplies += 1; row.attempted += 1; }
    else row.skipped += 1;
    if (event.qualificationStatus || event.niche) row.classified += 1;
    if (event.qualified) row.qualified += 1;
    if (event.niche) row.niches[event.niche] = (row.niches[event.niche] || 0) + 1;
  }

  const personaRows = [...byPersona.values()].map((row) => {
    const niches = Object.entries(row.niches).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));
    const { niches: _nichesMap, ...rest } = row;
    return { ...rest, niches, responseRate: row.attempted ? Math.round((row.responses / row.attempted) * 1000) / 10 : null };
  }).sort((a, b) => b.messages - a.messages || a.personaName.localeCompare(b.personaName, 'pt-BR'));

  return {
    retainedEvents: events.length,
    retentionLimit: AI_MONITOR_EVENT_LIMIT,
    latestAt: events[0]?.at || null,
    totals,
    byPersona: personaRows,
    recentEvents: events.slice(0, 20),
    recentErrors: events.filter((event) => ['error', 'reply-pending'].includes(event.status)).slice(0, 10),
  };
}
