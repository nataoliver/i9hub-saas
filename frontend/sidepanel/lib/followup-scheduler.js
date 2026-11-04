/**
 * i9Hub — regras puras para agendamento de follow-ups.
 * Não acessa Chrome APIs: pode ser validado em testes unitários.
 */
export const FOLLOWUP_MAX_STEPS = 10;
export const FOLLOWUP_MAX_MESSAGE_LENGTH = 2500;
export const FOLLOWUP_MAX_FUTURE_DAYS = 365;
export const FOLLOWUP_MIN_LEAD_TIME_MS = 60_000;

export const FOLLOWUP_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  PROCESSING: 'processing',
  SENT: 'sent',
  FAILED: 'failed',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  BLOCKED_CONSENT: 'blocked_consent',
  BLOCKED_BLACKLIST: 'blocked_blacklist',
  BLOCKED_SPAM: 'blocked_spam',
  BLOCKED_LICENSE: 'blocked_license',
  BLOCKED_FREQUENCY: 'blocked_frequency',
});

export const FOLLOWUP_STATUS_LABELS = Object.freeze({
  scheduled: 'Agendado',
  processing: 'Enviando',
  sent: 'Enviado',
  failed: 'Falha no envio',
  overdue: 'Aguardando ação',
  cancelled: 'Cancelado',
  blocked_consent: 'Sem consentimento',
  blocked_blacklist: 'Black list',
  blocked_spam: 'Contato classificado como spam',
  blocked_license: 'Licença sem permissão',
  blocked_frequency: 'Limite de frequência',
});

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
};

export function normalizeFollowupSettings(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const time = (value, fallback) => /^\d{2}:\d{2}$/.test(String(value || '')) ? String(value) : fallback;
  return {
    minIntervalMinutes: clamp(source.minIntervalMinutes, 0, 1440, 240),
    maxPerContactDaily: clamp(source.maxPerContactDaily, 1, 10, 3),
    maxDailyTotal: clamp(source.maxDailyTotal, 1, 200, 30),
    quietHoursEnabled: source.quietHoursEnabled !== false,
    quietHoursStart: time(source.quietHoursStart, '20:00'),
    quietHoursEnd: time(source.quietHoursEnd, '08:00'),
  };
}

export function renderFollowupTemplate(template, lead = {}) {
  const intelligence = lead.aiIntelligence && typeof lead.aiIntelligence === 'object' ? lead.aiIntelligence : {};
  const values = {
    nome: lead.name || 'tudo bem',
    empresa: lead.company || lead.name || '',
    servico: intelligence.service || intelligence.exactRequest || lead.service || '',
    nicho: intelligence.segment || lead.category || '',
    proposta: lead.proposal || intelligence.proposal || '',
    vendedor: lead.ownerName || lead.assignedTo || 'nossa equipe',
  };
  return String(template || '').slice(0, FOLLOWUP_MAX_MESSAGE_LENGTH)
    .replace(/\{\{\s*(nome|empresa|servico|nicho|proposta|vendedor)\s*\}\}/gi, (_, key) => String(values[key.toLowerCase()] ?? '').slice(0, 180))
    .replace(/[ \t]+\n/g, '\n')
    .trim()
    .slice(0, FOLLOWUP_MAX_MESSAGE_LENGTH);
}

export function normalizeFollowupStep(step = {}, now = Date.now()) {
  const template = String(step.messageTemplate ?? step.message ?? '').replace(/\u0000/g, '').trim();
  if (!template) throw new Error('Cada etapa precisa ter uma mensagem.');
  if (template.length > FOLLOWUP_MAX_MESSAGE_LENGTH) throw new Error(`A mensagem deve ter no máximo ${FOLLOWUP_MAX_MESSAGE_LENGTH} caracteres.`);
  let scheduledAt = Number.isFinite(Date.parse(step.scheduledAt || '')) ? Date.parse(step.scheduledAt) : 0;
  if (!scheduledAt) {
    const delayMinutes = Number(step.delayMinutes);
    if (!Number.isFinite(delayMinutes) || delayMinutes < 1 || delayMinutes > FOLLOWUP_MAX_FUTURE_DAYS * 24 * 60) {
      throw new Error('Informe um prazo válido entre 1 minuto e 365 dias.');
    }
    scheduledAt = now + Math.floor(delayMinutes) * 60_000;
  }
  if (scheduledAt < now + FOLLOWUP_MIN_LEAD_TIME_MS) throw new Error('Agende pelo menos 1 minuto à frente.');
  if (scheduledAt > now + FOLLOWUP_MAX_FUTURE_DAYS * 24 * 60 * 60_000) throw new Error('O agendamento não pode ultrapassar 365 dias.');
  return { messageTemplate: template, scheduledAt, delayMinutes: Math.max(1, Math.round((scheduledAt - now) / 60_000)) };
}

export function followupAlarmName(id) {
  const safe = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  return safe ? `i9-followup:${safe}` : '';
}

export function isFollowupTerminal(status) {
  return [FOLLOWUP_STATUS.SENT, FOLLOWUP_STATUS.CANCELLED, FOLLOWUP_STATUS.BLOCKED_CONSENT,
    FOLLOWUP_STATUS.BLOCKED_BLACKLIST, FOLLOWUP_STATUS.BLOCKED_SPAM, FOLLOWUP_STATUS.BLOCKED_LICENSE].includes(status);
}

export function minutesFromLocalTime(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function isWithinQuietHours(timestamp, settingsInput = {}) {
  const settings = normalizeFollowupSettings(settingsInput);
  if (!settings.quietHoursEnabled) return false;
  const start = minutesFromLocalTime(settings.quietHoursStart);
  const end = minutesFromLocalTime(settings.quietHoursEnd);
  const date = new Date(timestamp);
  const current = date.getHours() * 60 + date.getMinutes();
  if (start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export function nextAllowedFollowupTime(timestamp, settingsInput = {}) {
  const settings = normalizeFollowupSettings(settingsInput);
  if (!isWithinQuietHours(timestamp, settings)) return timestamp;
  const end = minutesFromLocalTime(settings.quietHoursEnd);
  const date = new Date(timestamp);
  date.setSeconds(0, 0);
  if (end == null) return timestamp;
  date.setHours(Math.floor(end / 60), end % 60, 0, 0);
  if (date.getTime() <= timestamp) date.setDate(date.getDate() + 1);
  return date.getTime();
}
