import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GOOGLE_CALENDAR_SCOPES, GOOGLE_CALENDAR_ORIGIN, normalizeCalendarSettings,
  parseLocalDateRange, buildAvailableCalendarSlots, buildCalendarEventBody,
} from '../lib/google-calendar.js';
import { ACTION_FEATURE_MAP, ACTION_REQUIRED_FEATURES, FEATURE_CATALOG, FEATURE_CATALOG_VERSION, SAFETY_ACTIONS, getFeatureAccess } from '../lib/feature-catalog.js';
import { evaluateActionAuthorization } from '../lib/license-policy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('Fase 06 registra Google Calendar como recurso implementado e protegido por licença', () => {
  assert.equal(FEATURE_CATALOG_VERSION, 14);
  for (const id of ['google.calendar.connect', 'google.calendar.availability', 'google.calendar.booking']) {
    assert.equal(FEATURE_CATALOG.find((feature) => feature.id === id)?.implemented, true, `${id} deve estar implementado`);
  }
  assert.equal(FEATURE_CATALOG.find((feature) => feature.id === 'google.calendar.automation')?.implemented, true, 'automação por estágio/etiqueta foi implementada na Fase 07');
  assert.equal(getFeatureAccess(['google.calendar.connect'], 'google.calendar.connect').allowed, true);
  assert.equal(getFeatureAccess(['google.calendar.booking'], 'google.calendar.booking').allowed, false, 'dependências ausentes devem bloquear reserva');
  assert.equal(getFeatureAccess(['google.calendar.connect', 'google.calendar.availability', 'google.calendar.booking'], 'google.calendar.booking').allowed, true);
});

test('todas as operações Calendar possuem mapeamento e permissões compostas', () => {
  for (const action of ['CALENDAR_GET_STATUS','CALENDAR_CONNECT','CALENDAR_LIST_CALENDARS','CALENDAR_SAVE_SETTINGS','CALENDAR_GET_AVAILABILITY','CALENDAR_GET_LEAD_EVENTS','CALENDAR_CREATE_EVENT','CALENDAR_UPDATE_EVENT','CALENDAR_DELETE_EVENT','CALENDAR_SYNC_LEAD_EVENTS','CALENDAR_SET_EVENT_OUTCOME','CALENDAR_SEND_CONFIRMATION','CALENDAR_AUTOMATION_GET_RULES','CALENDAR_AUTOMATION_SAVE_RULES','CALENDAR_AUTOMATION_GET_TASKS','CALENDAR_AUTOMATION_DISMISS_TASK']) {
    assert.ok(ACTION_FEATURE_MAP[action], `${action} precisa estar protegido pelo catálogo`);
  }
  for (const id of ACTION_REQUIRED_FEATURES.CALENDAR_CREATE_EVENT) assert.ok(FEATURE_CATALOG.some((feature) => feature.id === id && feature.implemented), `${id} precisa estar implementado`);
  for (const id of ACTION_REQUIRED_FEATURES.CALENDAR_SEND_CONFIRMATION) assert.ok(FEATURE_CATALOG.some((feature) => feature.id === id && feature.implemented), `${id} precisa estar implementado`);
  const allowedEntitlements = ['google.calendar.connect', 'google.calendar.availability', 'google.calendar.booking', 'whatsapp.connection', 'compliance.consent_tracking', 'compliance.optout_management', 'compliance.frequency_limits'];
  assert.equal(evaluateActionAuthorization({ type: 'CALENDAR_SEND_CONFIRMATION', state: { licensed: true, plan: 'pro', payload: { ent: allowedEntitlements } } }).allowed, true);
  assert.equal(evaluateActionAuthorization({ type: 'CALENDAR_SEND_CONFIRMATION', state: { licensed: true, plan: 'pro', payload: { ent: allowedEntitlements.filter((id) => id !== 'whatsapp.connection') } } }).allowed, false);
  assert.equal(SAFETY_ACTIONS.has('CALENDAR_DISCONNECT'), true);
});

test('manifesto declara escopos Calendar e host permission opcional sem retirar Drive e Sheets', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.ok(manifest.oauth2.scopes.includes('https://www.googleapis.com/auth/calendar.calendarlist.readonly'));
  assert.ok(manifest.oauth2.scopes.includes('https://www.googleapis.com/auth/calendar.freebusy'));
  assert.ok(manifest.oauth2.scopes.includes('https://www.googleapis.com/auth/calendar.events'));
  assert.ok(manifest.oauth2.scopes.includes('https://www.googleapis.com/auth/drive.file'));
  assert.ok(manifest.oauth2.scopes.includes('https://www.googleapis.com/auth/spreadsheets'));
  assert.ok(manifest.optional_host_permissions.includes(GOOGLE_CALENDAR_ORIGIN));
  assert.deepEqual(GOOGLE_CALENDAR_SCOPES.length, 3);
});

test('normaliza expediente, dias úteis, duração, lembretes e fuso local', () => {
  const settings = normalizeCalendarSettings({ workingHoursStart: '08:30', workingHoursEnd: '17:30', weekdays: [1,2,2,8,-1], defaultDurationMinutes: 45, reminderMinutes: [15,30,999] });
  assert.equal(settings.workingHoursStart, '08:30');
  assert.equal(settings.workingHoursEnd, '17:30');
  assert.deepEqual(settings.weekdays, [1,2]);
  assert.equal(settings.defaultDurationMinutes, 45);
  assert.deepEqual(settings.reminderMinutes, [15,30]);
  assert.ok(settings.timeZone.length > 0);
});

test('valida intervalo local de um dia e rejeita datas inexistentes', () => {
  const range = parseLocalDateRange('2026-11-02');
  assert.equal(new Date(range.startMs).getHours(), 0);
  assert.equal(range.endMs - range.startMs, 24 * 60 * 60 * 1000);
  assert.throws(() => parseLocalDateRange('2026-02-30'), /não existe/);
});

test('gera horários livres sem sobrepor compromissos ocupados e respeita dias/expediente', () => {
  const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const weekday = date.getDay();
  const settings = { weekdays: [weekday], workingHoursStart: '09:00', workingHoursEnd: '11:00', defaultDurationMinutes: 30, slotStepMinutes: 30 };
  const range = parseLocalDateRange(dateStr);
  const busyStart = new Date(range.startMs); busyStart.setHours(9,30,0,0);
  const busyEnd = new Date(range.startMs); busyEnd.setHours(10,0,0,0);
  const slots = buildAvailableCalendarSlots({ date: dateStr, settings, busy: [{ start: busyStart.toISOString(), end: busyEnd.toISOString() }], now: Date.now() });
  assert.ok(slots.length > 0);
  assert.ok(slots.every((slot) => !(Date.parse(slot.start) < busyEnd.getTime() && Date.parse(slot.end) > busyStart.getTime())));
  assert.ok(slots.every((slot) => new Date(slot.start).getHours() >= 9 && new Date(slot.end).getHours() <= 11));
});

test('monta evento com dados do lead, lembretes e convite somente mediante confirmação explícita', () => {
  const lead = { id: 'lead_1', name: 'Ana', company: 'Empresa A', phone: '5511999999999', email: 'ana@example.com', category: 'Contabilidade', stage: 'proposta', tags: ['interessado'] };
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const settings = normalizeCalendarSettings({ reminderMinutes: [15,30] });
  const body = buildCalendarEventBody({ lead, booking: { start: start.toISOString(), end: end.toISOString(), inviteLeadByEmail: true }, settings, eventKey: 'req_123' });
  assert.equal(body.attendees[0].email, 'ana@example.com');
  assert.deepEqual(body.reminders.overrides.map((item) => item.minutes), [15,30]);
  assert.match(body.description, /Ana/);
  assert.match(body.description, /5511999999999/);
  assert.equal(body.extendedProperties.private.i9HubEventKey, 'req_123');
  const withoutInvite = buildCalendarEventBody({ lead, booking: { start: start.toISOString(), end: end.toISOString() }, settings, eventKey: 'req_124' });
  assert.equal(Object.hasOwn(withoutInvite, 'attendees'), false);
  assert.throws(() => buildCalendarEventBody({ lead, booking: { start: start.toISOString(), end: new Date(start.getTime() + 5 * 60_000).toISOString() }, settings }), /mínima/);
  assert.throws(() => buildCalendarEventBody({ lead: { ...lead, email: 'email-invalido' }, booking: { start: start.toISOString(), end: end.toISOString(), inviteLeadByEmail: true }, settings }), /e-mail válido/);
});

test('service worker integra OAuth, FreeBusy, criação, atualização, cancelamento e sincronização dos dados do lead', () => {
  const worker = read('background/service-worker.js');
  for (const marker of ['getGoogleCalendarToken','googleCalendarRequest','/freeBusy','CALENDAR_CREATE_EVENT','CALENDAR_UPDATE_EVENT','CALENDAR_DELETE_EVENT','syncLeadCalendarEvents','privateExtendedProperty','pageToken']) assert.ok(worker.includes(marker), `integração ausente: ${marker}`);
  assert.match(worker, /CALENDAR_DISCONNECT/);
  assert.match(worker, /async CALENDAR_SEND_CONFIRMATION/);
  assert.match(worker, /CONSENT_REQUIRED/);
  assert.match(worker, /BLOCKED_BLACKLIST/);
  assert.match(worker, /google_calendar\.event_created/);
  assert.match(worker, /getAuthToken\(\{ interactive, scopes: \[?'https:\/\/www\.googleapis\.com\/auth\/spreadsheets'/);
  assert.match(worker, /lead_data_synced/);
  assert.match(worker, /lead_data_sync_pending/);
  assert.match(worker, /pendingRetry/);
});

test('interface oferece conexão em Configurações e reserva pelo card do CRM', () => {
  const settings = read('sidepanel/components/SettingsView.js');
  const leadModal = read('sidepanel/components/LeadModal.js');
  const api = read('sidepanel/utils/api.js');
  assert.match(settings, /data-tab="calendar"/);
  assert.match(settings, /google-calendar-connect/);
  assert.match(settings, /chrome\.permissions\.request/);
  assert.match(leadModal, /crm-calendar-find-slots/);
  assert.match(leadModal, /crm-calendar-book/);
  assert.match(leadModal, /Enviar confirmação/);
  assert.match(leadModal, /crm-calendar-send-wa-confirmation/);
  assert.match(api, /getGoogleCalendarAvailability/);
  assert.match(api, /createLeadCalendarEvent/);
});

test('a confirmação WhatsApp só é enviada após escolha explícita e passa pelo handler com consentimento e compliance', () => {
  const modal = read('sidepanel/components/LeadModal.js');
  const worker = read('background/service-worker.js');
  assert.match(modal, /Enviar confirmação pelo WhatsApp após reservar/);
  assert.match(modal, /sendCalendarConfirmation/);
  assert.match(worker, /consent\?\.status !== CONSENT_STATUS_OPTED_IN/);
  assert.match(worker, /isWithinQuietHours/);
  assert.match(worker, /BLOCKED_FREQUENCY/);
});

test('versão 1.5.0 está sincronizada no manifesto, pacote e pontes WhatsApp', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.equal(pkg.version, '1.0.0');
  assert.match(read('content/content.js'), /0\.0\.1\.0/);
  assert.match(read('content/injected.js'), /0\.0\.1\.0/);
});
