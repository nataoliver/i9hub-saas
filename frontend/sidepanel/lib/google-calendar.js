/**
 * Regras puras da integração Google Calendar.
 * Os horários exibidos são interpretados no fuso local do navegador, que é
 * persistido na configuração e enviado explicitamente à API do Google.
 */
export const GOOGLE_CALENDAR_SCOPES = Object.freeze([
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.events',
]);
export const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
export const GOOGLE_CALENDAR_ORIGIN = 'https://www.googleapis.com/*';
export const CALENDAR_MAX_RANGE_DAYS = 31;
export const CALENDAR_MAX_EVENTS_PER_LEAD = 100;

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
};
const validTime = (value, fallback) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? String(value) : fallback;

export function getBrowserTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'; }
  catch { return 'America/Sao_Paulo'; }
}

export function normalizeCalendarSettings(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const weekdays = Array.isArray(source.weekdays)
    ? [...new Set(source.weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort()
    : [1, 2, 3, 4, 5];
  const reminders = Array.isArray(source.reminderMinutes)
    ? [...new Set(source.reminderMinutes.map(Number).filter((n) => Number.isInteger(n) && [5, 10, 15, 30, 60, 120, 1440].includes(n)))].slice(0, 5)
    : [30];
  const timeZone = typeof source.timeZone === 'string' && source.timeZone.length <= 80 ? source.timeZone : getBrowserTimeZone();
  return {
    connected: source.connected === true,
    calendarId: String(source.calendarId || 'primary').slice(0, 500),
    calendarSummary: String(source.calendarSummary || 'Agenda principal').slice(0, 160),
    timeZone,
    workingHoursStart: validTime(source.workingHoursStart, '09:00'),
    workingHoursEnd: validTime(source.workingHoursEnd, '18:00'),
    weekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5],
    defaultDurationMinutes: clamp(source.defaultDurationMinutes, 15, 240, 30),
    slotStepMinutes: clamp(source.slotStepMinutes, 5, 120, 15),
    bufferMinutes: clamp(source.bufferMinutes, 0, 120, 0),
    reminderMinutes: reminders.length ? reminders : [30],
    inviteLeadByEmail: source.inviteLeadByEmail === true,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt.slice(0, 40) : '',
    lastConnectedAt: typeof source.lastConnectedAt === 'string' ? source.lastConnectedAt.slice(0, 40) : '',
    lastError: typeof source.lastError === 'string' ? source.lastError.slice(0, 240) : '',
  };
}

export function parseLocalDateRange(dateValue) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ''));
  if (!match) throw new Error('Informe uma data válida.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) throw new Error('A data informada não existe.');
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { timeMin: start.toISOString(), timeMax: end.toISOString(), startMs: start.getTime(), endMs: end.getTime() };
}

export function buildAvailableCalendarSlots({ date, busy = [], settings = {}, now = Date.now() } = {}) {
  const config = normalizeCalendarSettings(settings);
  const range = parseLocalDateRange(date);
  const day = new Date(range.startMs).getDay();
  if (!config.weekdays.includes(day)) return [];
  const [startHour, startMinute] = config.workingHoursStart.split(':').map(Number);
  const [endHour, endMinute] = config.workingHoursEnd.split(':').map(Number);
  const startOfWork = startHour * 60 + startMinute;
  const endOfWork = endHour * 60 + endMinute;
  const duration = config.defaultDurationMinutes;
  const step = config.slotStepMinutes;
  if (endOfWork <= startOfWork || endOfWork - startOfWork < duration) return [];
  const occupied = (Array.isArray(busy) ? busy : []).map((item) => ({
    start: Date.parse(item?.start || ''), end: Date.parse(item?.end || ''),
  })).filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start);
  const slots = [];
  const localDay = new Date(range.startMs);
  for (let minute = startOfWork; minute + duration <= endOfWork; minute += step) {
    const start = new Date(localDay);
    start.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    const end = new Date(start.getTime() + duration * 60_000);
    if (start.getTime() < now + 60_000) continue;
    if (occupied.some((item) => start.getTime() < item.end && end.getTime() > item.start)) continue;
    slots.push({ start: start.toISOString(), end: end.toISOString(), label: start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
  }
  return slots;
}

function clean(value, max = 500) { return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max); }

export function buildCalendarEventDescription(lead = {}, extraNote = '') {
  const intel = lead.aiIntelligence && typeof lead.aiIntelligence === 'object' ? lead.aiIntelligence : {};
  const fields = [
    ['Lead', lead.name], ['Empresa', lead.company], ['Telefone', lead.phone], ['E-mail', lead.email],
    ['Serviço de interesse', intel.service || intel.exactRequest || lead.service],
    ['Nicho', intel.segment || lead.category], ['Estágio CRM', lead.stage],
    ['Etiquetas', Array.isArray(lead.tags) ? lead.tags.join(', ') : lead.tags],
    ['Observação', extraNote],
  ].filter(([, value]) => clean(value, 1200));
  return fields.map(([label, value]) => `${label}: ${clean(value, 1200)}`).join('\n').slice(0, 8000);
}

export function buildCalendarEventBody({ lead = {}, booking = {}, settings = {}, eventKey = '' } = {}) {
  const config = normalizeCalendarSettings(settings);
  const start = Date.parse(booking.start || '');
  const end = Date.parse(booking.end || '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Selecione um horário válido para o compromisso.');
  if (end - start < 15 * 60_000) throw new Error('A duração mínima de um compromisso é de 15 minutos.');
  if (end - start > 4 * 60 * 60_000) throw new Error('A duração máxima de um compromisso é de 4 horas.');
  const summary = clean(booking.summary || `Atendimento — ${lead.name || 'Novo lead'}`, 200) || 'Atendimento comercial';
  const body = {
    summary,
    description: buildCalendarEventDescription(lead, booking.note),
    start: { dateTime: new Date(start).toISOString(), timeZone: config.timeZone },
    end: { dateTime: new Date(end).toISOString(), timeZone: config.timeZone },
    reminders: { useDefault: false, overrides: config.reminderMinutes.map((minutes) => ({ method: 'popup', minutes })) },
    extendedProperties: { private: { i9Hub: 'true', i9HubLeadId: clean(lead.id || lead.placeId || lead.phone, 180), i9HubEventKey: clean(eventKey, 180) } },
  };
  const inviteEmail = booking.inviteLeadByEmail === true ? clean(lead.email, 254) : '';
  if (booking.inviteLeadByEmail === true && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) throw new Error('O convite foi selecionado, mas o lead não possui um e-mail válido.');
  if (inviteEmail) body.attendees = [{ email: inviteEmail }];
  return body;
}

export function normalizeCalendarEventRecord(event = {}, calendarId = 'primary') {
  return {
    eventId: clean(event.id, 300),
    calendarId: clean(calendarId, 500) || 'primary',
    summary: clean(event.summary, 200),
    start: clean(event.start?.dateTime || event.start?.date, 60),
    end: clean(event.end?.dateTime || event.end?.date, 60),
    htmlLink: /^https:\/\/(?:calendar\.google\.com|www\.google\.com\/calendar)\//.test(String(event.htmlLink || '')) ? String(event.htmlLink).slice(0, 2000) : '',
    status: ['confirmed', 'tentative', 'cancelled'].includes(event.status) ? event.status : 'confirmed',
    createdAt: new Date().toISOString(),
    syncStatus: 'synced',
  };
}
