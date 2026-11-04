import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeCalendarAutomationRule, normalizeCalendarAutomationRules,
  normalizeCalendarAutomationTasks, getNewlyAddedTags, calendarAutomationMatches,
  getLeadAutomationField, resolveCalendarAutomationDate, buildCalendarAutomationRunKey,
} from '../lib/calendar-automation.js';
import { ACTION_FEATURE_MAP, ACTION_REQUIRED_FEATURES, FEATURE_CATALOG, FEATURE_CATALOG_VERSION, getFeatureAccess } from '../lib/feature-catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('Fase 07 promove o catálogo v8 e protege as ações de automação por entitlement', () => {
  assert.equal(FEATURE_CATALOG_VERSION, 14);
  assert.equal(FEATURE_CATALOG.find((item) => item.id === 'google.calendar.automation')?.implemented, true);
  for (const action of ['CALENDAR_AUTOMATION_GET_RULES','CALENDAR_AUTOMATION_SAVE_RULES','CALENDAR_AUTOMATION_GET_TASKS','CALENDAR_AUTOMATION_DISMISS_TASK']) {
    assert.equal(ACTION_FEATURE_MAP[action], 'google.calendar.automation');
    assert.ok(ACTION_REQUIRED_FEATURES[action].includes('google.calendar.automation'));
  }
  assert.equal(getFeatureAccess(['google.calendar.automation'], 'google.calendar.automation').allowed, false, 'dependências de agenda e CRM também são necessárias');
  assert.equal(getFeatureAccess(['google.calendar.connect','google.calendar.availability','google.calendar.booking','crm.kanban','google.calendar.automation'], 'google.calendar.automation').allowed, true);
});

test('normaliza regras e rejeita condições vazias e IDs duplicados', () => {
  const rules = normalizeCalendarAutomationRules([
    { id: 'r1', name: 'Retorno', trigger: { type: 'stage', value: 'proposta' }, action: { type: 'create_relative_event', offsetValue: 2, offsetUnit: 'days', preferredTime: '10:00' } },
    { id: 'r1', name: 'Duplicada', trigger: { type: 'tag', value: 'visita' }, action: { type: 'request_booking' } },
    { id: 'r2', trigger: { type: 'tag', value: '' }, action: { type: 'request_booking' } },
  ]);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].action.offsetValue, 2);
  assert.equal(rules[0].action.requireApproval, false);
  assert.equal(normalizeCalendarAutomationRule({ trigger: { type: 'tag', value: 'visita' }, action: { type: 'request_booking' } }).action.requireApproval, true);
});

test('dispara somente quando ocorre transição real de estágio ou inclusão nova de etiqueta', () => {
  const rule = normalizeCalendarAutomationRule({ id: 'r1', enabled: true, trigger: { type: 'tag', value: 'Visita' }, action: { type: 'request_booking' } });
  assert.equal(calendarAutomationMatches(rule, { type: 'tag', value: 'visita' }), true);
  assert.equal(calendarAutomationMatches(rule, { type: 'stage', value: 'visita' }), false);
  assert.deepEqual(getNewlyAddedTags(['Cliente', 'Visita'], ['Cliente', 'Visita', 'Proposta', 'proposta']), ['Proposta']);
});

test('resolve data relativa em dias e campos do card, incluindo campos personalizados', () => {
  const ruleDays = normalizeCalendarAutomationRule({ trigger: { type: 'stage', value: 'proposta' }, action: { type: 'create_relative_event', offsetValue: 2, offsetUnit: 'days', preferredTime: '10:30' } });
  const base = new Date(2026, 9, 30, 13, 0, 0, 0);
  const relative = resolveCalendarAutomationDate({ rule: ruleDays, lead: {}, triggerAt: base.getTime() });
  assert.equal(relative.getDate(), 1);
  assert.equal(relative.getHours(), 10);
  assert.equal(relative.getMinutes(), 30);

  const ruleFields = normalizeCalendarAutomationRule({ trigger: { type: 'tag', value: 'reuniao_confirmada' }, action: { type: 'create_event_from_lead', dateField: 'meetingDate', timeField: 'meetingTime' } });
  const fromLead = resolveCalendarAutomationDate({
    rule: ruleFields,
    lead: { customFields: [{ key: 'meetingDate', value: '2026-11-05' }, { key: 'meetingTime', value: '14:45' }] },
  });
  assert.equal(fromLead.getFullYear(), 2026);
  assert.equal(fromLead.getMonth(), 10);
  assert.equal(fromLead.getDate(), 5);
  assert.equal(fromLead.getHours(), 14);
  assert.equal(fromLead.getMinutes(), 45);
});

test('valida campos ausentes e normaliza tarefas de revisão', () => {
  const rule = normalizeCalendarAutomationRule({ trigger: { type: 'tag', value: 'reuniao_confirmada' }, action: { type: 'create_event_from_lead', dateField: 'meetingDate', timeField: 'meetingTime' } });
  assert.throws(() => resolveCalendarAutomationDate({ rule, lead: {} }), /não possui data preenchida/);
  const tasks = normalizeCalendarAutomationTasks([{ id: 't1', leadId: 'lead1', status: 'needs_review', title: 'Agendar', createdAt: '2026-10-30T10:00:00Z' }]);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].status, 'needs_review');
  assert.equal(normalizeCalendarAutomationTasks([{ id: 'x', leadId: 'l', status: 'unknown' }])[0].status, 'needs_review');
});

test('chave de execução identifica regra, lead e transição para impedir eventos duplicados', () => {
  const a = buildCalendarAutomationRunKey({ ruleId: 'r1', leadId: 'l1', transitionId: 't1' });
  const b = buildCalendarAutomationRunKey({ ruleId: 'r1', leadId: 'l1', transitionId: 't1' });
  const c = buildCalendarAutomationRunKey({ ruleId: 'r1', leadId: 'l1', transitionId: 't2' });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('service worker liga as transições de etapa e etiqueta ao motor de automação', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /runCalendarAutomationsForTransition\(l, \{ type: 'stage'/);
  assert.match(worker, /getNewlyAddedTags\(previousTags, nextTags\)/);
  assert.match(worker, /CALENDAR_AUTOMATION_SAVE_RULES/);
  assert.match(worker, /findGoogleCalendarEventByKey\(config\.calendarId, requestKey\)/);
  assert.match(worker, /\/freeBusy/);
  assert.match(worker, /completeCalendarAutomationTasksForLead/);
  assert.match(worker, /gate\('CALENDAR_SEND_CONFIRMATION'/);
  assert.match(worker, /processingAge < 5 \* 60_000/);
});

test('interface de configurações oferece criação, pausa, edição e revisão de automações', () => {
  const settings = read('sidepanel/components/SettingsView.js');
  const api = read('sidepanel/utils/api.js');
  assert.match(settings, /calendar-auto-trigger-type/);
  assert.match(settings, /calendar-auto-action/);
  assert.match(settings, /renderCalendarAutomationRules/);
  assert.match(settings, /data-calendar-rule-toggle/);
  assert.match(settings, /data-calendar-task-open/);
  assert.match(api, /getCalendarAutomationRules/);
  assert.match(api, /saveCalendarAutomationRules/);
});
