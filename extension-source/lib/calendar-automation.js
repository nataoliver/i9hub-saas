/**
 * i9Hub v1.3.0 — regras puras para automações do Google Agenda.
 * Não executa rede, storage ou ações; valida e normaliza a configuração.
 */
export const CALENDAR_AUTOMATION_MAX_RULES = 50;
export const CALENDAR_AUTOMATION_MAX_TASKS = 500;
export const CALENDAR_AUTOMATION_ACTIONS = Object.freeze([
  'request_booking',
  'create_relative_event',
  'create_event_from_lead',
]);

const clean = (value, max = 160) => String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
const validTime = (value, fallback = '10:00') => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? String(value) : fallback;
const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
};

export function normalizeCalendarAutomationRule(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const triggerSource = source.trigger && typeof source.trigger === 'object' ? source.trigger : {};
  const actionSource = source.action && typeof source.action === 'object' ? source.action : {};
  const triggerType = ['stage', 'tag'].includes(triggerSource.type) ? triggerSource.type : 'stage';
  const actionType = CALENDAR_AUTOMATION_ACTIONS.includes(actionSource.type) ? actionSource.type : 'request_booking';
  const triggerValue = clean(triggerSource.value, 120);
  const id = clean(source.id, 100) || `calrule_${Date.now().toString(36)}`;
  const offsetUnit = actionSource.offsetUnit === 'hours' ? 'hours' : 'days';
  return {
    id,
    name: clean(source.name, 100) || 'Automação sem nome',
    enabled: source.enabled !== false,
    trigger: { type: triggerType, value: triggerValue },
    action: {
      type: actionType,
      offsetValue: clamp(actionSource.offsetValue, 1, offsetUnit === 'hours' ? 720 : 365, 2),
      offsetUnit,
      preferredTime: validTime(actionSource.preferredTime),
      durationMinutes: clamp(actionSource.durationMinutes, 15, 240, 30),
      summaryTemplate: clean(actionSource.summaryTemplate, 200) || 'Retorno comercial — {{nome}}',
      noteTemplate: clean(actionSource.noteTemplate, 1200),
      requireApproval: actionType === 'request_booking' || actionSource.requireApproval === true,
      sendWhatsAppConfirmation: actionSource.sendWhatsAppConfirmation === true,
      dateField: clean(actionSource.dateField, 100) || 'appointmentDate',
      timeField: clean(actionSource.timeField, 100) || 'appointmentTime',
    },
    createdAt: clean(source.createdAt, 40) || new Date().toISOString(),
    updatedAt: clean(source.updatedAt, 40) || new Date().toISOString(),
  };
}

export function normalizeCalendarAutomationRules(input = []) {
  const seen = new Set();
  const result = [];
  for (const raw of (Array.isArray(input) ? input : []).slice(0, CALENDAR_AUTOMATION_MAX_RULES)) {
    const rule = normalizeCalendarAutomationRule(raw);
    if (!rule.trigger.value || seen.has(rule.id)) continue;
    seen.add(rule.id);
    result.push(rule);
  }
  return result;
}

export function normalizeCalendarAutomationTasks(input = []) {
  const allowed = new Set(['needs_review', 'completed', 'dismissed', 'failed']);
  return (Array.isArray(input) ? input : []).slice(-CALENDAR_AUTOMATION_MAX_TASKS).filter((item) => item && typeof item === 'object').map((item) => ({
    id: clean(item.id, 120),
    ruleId: clean(item.ruleId, 100),
    leadId: clean(item.leadId, 180),
    leadName: clean(item.leadName, 160) || 'Lead',
    type: clean(item.type, 60) || 'booking_request',
    title: clean(item.title, 180) || 'Ação comercial aguardando revisão',
    reason: clean(item.reason, 500),
    status: allowed.has(item.status) ? item.status : 'needs_review',
    createdAt: clean(item.createdAt, 40) || new Date().toISOString(),
    trigger: item.trigger && typeof item.trigger === 'object' ? {
      type: clean(item.trigger.type, 20),
      value: clean(item.trigger.value, 120),
    } : {},
    proposedStart: clean(item.proposedStart, 60),
    proposedEnd: clean(item.proposedEnd, 60),
    metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {},
  })).filter((item) => item.id && item.leadId);
}

export function getNewlyAddedTags(previous = [], next = []) {
  const before = new Set((Array.isArray(previous) ? previous : []).map((tag) => clean(tag, 120).toLocaleLowerCase('pt-BR')).filter(Boolean));
  const seen = new Set();
  return (Array.isArray(next) ? next : []).map((tag) => clean(tag, 120)).filter((tag) => {
    const key = tag.toLocaleLowerCase('pt-BR');
    if (!key || before.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function calendarAutomationMatches(rule, transition = {}) {
  if (!rule || rule.enabled !== true || !transition || !transition.type) return false;
  if (rule.trigger?.type !== transition.type) return false;
  const expected = clean(rule.trigger?.value, 120).toLocaleLowerCase('pt-BR');
  const actual = clean(transition.value, 120).toLocaleLowerCase('pt-BR');
  return !!expected && expected === actual;
}

export function getLeadAutomationField(lead = {}, fieldKey = '') {
  const key = clean(fieldKey, 100);
  if (!key) return '';
  if (lead[key] !== undefined && lead[key] !== null && lead[key] !== '') return lead[key];
  const custom = lead.customFields;
  if (Array.isArray(custom)) {
    const found = custom.find((item) => String(item?.key || item?.id || item?.name || '').toLocaleLowerCase('pt-BR') === key.toLocaleLowerCase('pt-BR'));
    if (found) return found.value ?? found.text ?? '';
  } else if (custom && typeof custom === 'object') {
    if (custom[key] !== undefined) return custom[key];
  }
  return '';
}

export function resolveCalendarAutomationDate({ rule, lead = {}, triggerAt = Date.now() } = {}) {
  const action = rule?.action || {};
  if (action.type === 'create_event_from_lead') {
    const rawDate = getLeadAutomationField(lead, action.dateField);
    const rawTime = getLeadAutomationField(lead, action.timeField);
    if (!rawDate) throw new Error(`O campo "${action.dateField}" não possui data preenchida no card.`);
    const dateText = String(rawDate).trim();
    let start;
    if (/^\d{4}-\d{2}-\d{2}T/.test(dateText) || /^\d{4}-\d{2}-\d{2}Z/.test(dateText)) {
      start = new Date(dateText);
    } else {
      const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
      const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(rawTime || ''));
      if (!dateMatch || !timeMatch) throw new Error(`Preencha "${action.dateField}" (AAAA-MM-DD) e "${action.timeField}" (HH:mm) no card do lead.`);
      start = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
      if (start.getFullYear() !== Number(dateMatch[1]) || start.getMonth() !== Number(dateMatch[2]) - 1 || start.getDate() !== Number(dateMatch[3])) {
        throw new Error('A data informada no card não é válida.');
      }
    }
    if (!Number.isFinite(start.getTime())) throw new Error('A data/hora preenchida no card não é válida.');
    return start;
  }

  const base = new Date(triggerAt);
  if (!Number.isFinite(base.getTime())) throw new Error('Data de disparo inválida.');
  const amount = clamp(action.offsetValue, 1, action.offsetUnit === 'hours' ? 720 : 365, 2);
  if (action.offsetUnit === 'hours') {
    base.setTime(base.getTime() + amount * 60 * 60_000);
    base.setSeconds(0, 0);
    return base;
  }
  base.setDate(base.getDate() + amount);
  const [hour, minute] = validTime(action.preferredTime).split(':').map(Number);
  base.setHours(hour, minute, 0, 0);
  return base;
}

export function buildCalendarAutomationRunKey({ ruleId, leadId, transitionId } = {}) {
  return [clean(ruleId, 100), clean(leadId, 180), clean(transitionId, 100)].join('|').slice(0, 380);
}
