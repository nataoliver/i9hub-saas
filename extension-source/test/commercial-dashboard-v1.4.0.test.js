import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCommercialDashboardSnapshot } from '../lib/commercial-dashboard.js';
import { ACTION_FEATURE_MAP, ACTION_REQUIRED_FEATURES, FEATURE_CATALOG, FEATURE_CATALOG_VERSION, getFeatureAccess } from '../lib/feature-catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('Fase 08 registra a Central Comercial no catálogo v9 e protege o endpoint por dependências', () => {
  assert.equal(FEATURE_CATALOG_VERSION, 14);
  assert.equal(FEATURE_CATALOG.length, 91);
  assert.equal(FEATURE_CATALOG.filter((feature) => feature.implemented === true).length, 89);
  assert.equal(FEATURE_CATALOG.find((feature) => feature.id === 'dashboard.commercial_agenda')?.implemented, true);
  assert.equal(ACTION_FEATURE_MAP.DASHBOARD_GET_COMMERCIAL_OVERVIEW, 'dashboard.commercial_agenda');
  assert.ok(ACTION_REQUIRED_FEATURES.DASHBOARD_GET_COMMERCIAL_OVERVIEW.includes('google.calendar.booking'));
  assert.equal(getFeatureAccess(['dashboard.commercial_agenda'], 'dashboard.commercial_agenda').allowed, false);
  assert.equal(getFeatureAccess([
    'dashboard.commercial_agenda', 'google.calendar.connect', 'google.calendar.availability',
    'google.calendar.booking', 'crm.leads', 'crm.followup.manage', 'crm.kanban',
  ], 'dashboard.commercial_agenda').allowed, true);
});

test('snapshot agrega agenda, reuniões realizadas/canceladas, follow-ups e produtividade', () => {
  const now = Date.UTC(2026, 9, 30, 14, 0, 0);
  const leads = [
    {
      id: 'lead_today', name: 'Ana', stage: 'Proposta',
      calendarEvents: [
        { eventId: 'evt_today', calendarId: 'primary', summary: 'Reunião de proposta', start: '2026-10-30T15:00:00.000Z', end: '2026-10-30T15:30:00.000Z', status: 'confirmed' },
        { eventId: 'evt_done', calendarId: 'primary', summary: 'Diagnóstico', start: '2026-10-28T10:00:00.000Z', end: '2026-10-28T10:30:00.000Z', status: 'confirmed', outcome: 'completed', outcomeAt: '2026-10-28T10:35:00.000Z' },
        { eventId: 'evt_cancel', calendarId: 'primary', summary: 'Reunião cancelada', start: '2026-10-27T10:00:00.000Z', end: '2026-10-27T10:30:00.000Z', status: 'cancelled' },
      ],
    },
    { id: 'lead_no_action', name: 'Bruno', stage: 'Novo', updatedAt: '2026-10-20T12:00:00.000Z', calendarEvents: [] },
    { id: 'lead_closed', name: 'Carla', stage: 'Fechado ganho', calendarEvents: [] },
    { id: 'lead_blacklist', name: 'Spam', stage: 'Novo', blacklisted: true, calendarEvents: [] },
  ];
  const followups = [
    { id: 'f_overdue', leadId: 'lead_no_action', leadName: 'Bruno', status: 'scheduled', scheduledAt: '2026-10-29T10:00:00.000Z' },
    { id: 'f_upcoming', leadId: 'lead_today', leadName: 'Ana', status: 'scheduled', scheduledAt: '2026-11-02T10:00:00.000Z' },
    { id: 'f_sent', leadId: 'lead_today', status: 'sent', sentAt: '2026-10-29T12:00:00.000Z' },
  ];
  const snapshot = buildCommercialDashboardSnapshot({
    leads,
    followups,
    automationTasks: [{ id: 'task1', leadId: 'lead_no_action', leadName: 'Bruno', status: 'needs_review', createdAt: '2026-10-30T12:00:00Z' }],
    recentActivities: [{ id: 'a1', leadId: 'lead_today', leadName: 'Ana', title: 'Mudou para Proposta', createdAt: '2026-10-30T11:00:00Z' }],
    now,
  });
  assert.equal(snapshot.metrics.todayMeetings, 1);
  assert.equal(snapshot.metrics.upcomingMeetings, 1);
  assert.equal(snapshot.metrics.completedMeetings, 1);
  assert.equal(snapshot.metrics.cancelledMeetings, 1);
  assert.equal(snapshot.metrics.overdueFollowups, 1);
  assert.equal(snapshot.metrics.upcomingFollowups, 1);
  assert.equal(snapshot.metrics.leadsWithoutNextAction, 1);
  assert.equal(snapshot.metrics.pendingAutomationTasks, 1);
  assert.equal(snapshot.metrics.followupsSentLast7Days, 1);
  assert.equal(snapshot.metrics.meetingsCompletedLast7Days, 1);
  assert.equal(snapshot.recentActivities[0].title, 'Mudou para Proposta');
  assert.equal(snapshot.todayEvents[0].leadName, 'Ana');
});

test('snapshot não duplica eventos, não conta cancelados como próximos e respeita ações futuras', () => {
  const now = Date.UTC(2026, 9, 30, 12, 0, 0);
  const leads = [
    { id: 'l1', name: 'A', stage: 'Negociação', calendarEvents: [
      { eventId: 'same', calendarId: 'primary', start: '2026-10-31T10:00:00Z', end: '2026-10-31T10:30:00Z', status: 'confirmed' },
      { eventId: 'same', calendarId: 'primary', start: '2026-10-31T10:00:00Z', end: '2026-10-31T10:30:00Z', status: 'confirmed' },
      { eventId: 'cancelled', calendarId: 'primary', start: '2026-10-31T11:00:00Z', end: '2026-10-31T11:30:00Z', status: 'cancelled' },
    ] },
    { id: 'l2', name: 'B', stage: 'Novo', calendarEvents: [] },
  ];
  const snapshot = buildCommercialDashboardSnapshot({ leads, followups: [], now });
  assert.equal(snapshot.metrics.upcomingMeetings, 1);
  assert.equal(snapshot.upcomingEvents.length, 1);
  assert.equal(snapshot.metrics.leadsWithoutNextAction, 1);
  assert.equal(snapshot.leadsWithoutNextAction[0].leadId, 'l2');
});

test('service worker expõe visão comercial local e valida resultado de reunião após o fim do evento', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /async DASHBOARD_GET_COMMERCIAL_OVERVIEW/);
  assert.match(worker, /buildCommercialDashboardSnapshot/);
  assert.match(worker, /async CALENDAR_SET_EVENT_OUTCOME/);
  assert.match(worker, /O resultado só pode ser registrado depois do horário final/);
  assert.match(worker, /meeting_completed/);
  assert.match(worker, /CALENDAR_SET_EVENT_OUTCOME/);
});

test('dashboard oferece indicadores, agenda, follow-ups, leads sem ação, pendências e atividades recentes', () => {
  const dashboard = read('sidepanel/components/DashboardView.js');
  const api = read('sidepanel/utils/api.js');
  const css = read('sidepanel/sidepanel.css');
  assert.match(dashboard, /Agenda e atividades comerciais/);
  assert.match(dashboard, /commercial-today-events/);
  assert.match(dashboard, /commercial-overdue-followups/);
  assert.match(dashboard, /commercial-leads-no-action/);
  assert.match(dashboard, /commercial-automation-tasks/);
  assert.match(dashboard, /commercial-recent-activities/);
  assert.match(dashboard, /setCalendarEventOutcome/);
  assert.match(api, /getCommercialDashboardOverview/);
  assert.match(api, /setCalendarEventOutcome/);
  assert.match(css, /i9-commercial-overview/);
});

test('card do lead também permite registrar reunião realizada ou ausência depois do horário final', () => {
  const modal = read('sidepanel/components/LeadModal.js');
  assert.match(modal, /data-calendar-outcome="completed"/);
  assert.match(modal, /data-calendar-outcome="no_show"/);
  assert.match(modal, /setCalendarEventOutcome/);
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
