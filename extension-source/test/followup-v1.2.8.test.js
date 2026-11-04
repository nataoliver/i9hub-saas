import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOLLOWUP_STATUS, normalizeFollowupSettings, normalizeFollowupStep,
  renderFollowupTemplate, isWithinQuietHours, nextAllowedFollowupTime,
} from '../lib/followup-scheduler.js';
import { ACTION_FEATURE_MAP, ACTION_REQUIRED_FEATURES, FEATURE_CATALOG, FEATURE_CATALOG_VERSION } from '../lib/feature-catalog.js';
import { evaluateActionAuthorization } from '../lib/license-policy.js';
import { decideMessage } from '../lib/message-gate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Fase 05 ativa os três direitos de follow-up no catálogo v6', () => {
  assert.equal(FEATURE_CATALOG_VERSION, 14);
  for (const id of ['crm.followup.manage', 'crm.followup.send', 'crm.followup.automation']) {
    assert.ok(FEATURE_CATALOG.some((feature) => feature.id === id && feature.implemented === true && feature.status === 'active'), id);
  }
});

test('ações de follow-up exigem todos os entitlements e falham fechadas', () => {
  assert.equal(ACTION_FEATURE_MAP.SCHEDULE_FOLLOWUP, 'crm.followup.manage');
  assert.ok(ACTION_REQUIRED_FEATURES.SCHEDULE_FOLLOWUP.includes('crm.followup.send'));
  assert.ok(ACTION_REQUIRED_FEATURES.SCHEDULE_FOLLOWUP_SEQUENCE.includes('crm.followup.automation'));
  assert.equal(evaluateActionAuthorization({ type: 'SCHEDULE_FOLLOWUP', state: { licensed: false } }).allowed, false);
  const partial = ['crm.leads','crm.followup.manage','crm.followup.send','whatsapp.connection','compliance.consent_tracking','compliance.optout_management'];
  assert.equal(evaluateActionAuthorization({ type: 'SCHEDULE_FOLLOWUP', state: { licensed: true, payload: { ent: partial } } }).allowed, false);
  const full = [...partial,'compliance.frequency_limits'];
  assert.equal(evaluateActionAuthorization({ type: 'SCHEDULE_FOLLOWUP', state: { licensed: true, payload: { ent: full } } }).allowed, true);
});

test('modelos de mensagem substituem apenas variáveis conhecidas e limitam o conteúdo', () => {
  const result = renderFollowupTemplate('Oi {{nome}} da {{empresa}}, sobre {{servico}} em {{nicho}}. Proposta: {{proposta}}. {{vendedor}}', {
    name: 'Ana', company: 'Empresa A', category: 'Contabilidade',
    aiIntelligence: { service: 'Tráfego pago', segment: 'Contabilidade empresarial', proposal: 'Plano mensal' },
    ownerName: 'Carlos',
  });
  assert.equal(result, 'Oi Ana da Empresa A, sobre Tráfego pago em Contabilidade empresarial. Proposta: Plano mensal. Carlos');
  assert.match(renderFollowupTemplate('Olá {{campo_desconhecido}}'), /\{\{campo_desconhecido\}\}/);
});

test('prazo relativo cria timestamp futuro e preserva o modelo', () => {
  const now = Date.UTC(2026, 9, 30, 12, 0, 0);
  const step = normalizeFollowupStep({ delayMinutes: 90, messageTemplate: 'Olá {{nome}}' }, now);
  assert.equal(step.scheduledAt, now + 90 * 60_000);
  assert.equal(step.messageTemplate, 'Olá {{nome}}');
});

test('data e hora customizadas são aceitas e horários passados são recusados', () => {
  const now = Date.UTC(2026, 9, 30, 12, 0, 0);
  const custom = new Date(now + 3 * 60 * 60_000).toISOString();
  assert.equal(normalizeFollowupStep({ scheduledAt: custom, messageTemplate: 'Retorno' }, now).scheduledAt, Date.parse(custom));
  assert.throws(() => normalizeFollowupStep({ scheduledAt: new Date(now - 1000).toISOString(), messageTemplate: 'Retorno' }, now), /pelo menos 1 minuto/);
});

test('limites de segurança são normalizados e não aceitam valores fora da faixa', () => {
  assert.deepEqual(normalizeFollowupSettings({ minIntervalMinutes: -1, maxPerContactDaily: 99, maxDailyTotal: 999, quietHoursEnabled: false }), {
    minIntervalMinutes: 0, maxPerContactDaily: 10, maxDailyTotal: 200,
    quietHoursEnabled: false, quietHoursStart: '20:00', quietHoursEnd: '08:00',
  });
});

test('horário de silêncio posterga o envio até o próximo período permitido', () => {
  const settings = { quietHoursEnabled: true, quietHoursStart: '20:00', quietHoursEnd: '08:00' };
  const late = new Date(2026, 9, 30, 22, 0, 0).getTime();
  assert.equal(isWithinQuietHours(late, settings), true);
  const next = nextAllowedFollowupTime(late, settings);
  const date = new Date(next);
  assert.equal(date.getHours(), 8);
  assert.equal(date.getDate(), 31);
  const morning = new Date(2026, 9, 30, 7, 0, 0).getTime();
  assert.equal(new Date(nextAllowedFollowupTime(morning, settings)).getHours(), 8);
});

test('status de follow-up inclui bloqueios e estados de revisão', () => {
  assert.equal(FOLLOWUP_STATUS.SCHEDULED, 'scheduled');
  assert.equal(FOLLOWUP_STATUS.OVERDUE, 'overdue');
  assert.equal(FOLLOWUP_STATUS.BLOCKED_CONSENT, 'blocked_consent');
  assert.equal(FOLLOWUP_STATUS.CANCELLED, 'cancelled');
});

test('atividade de resposta só é aceita como evento passivo do WhatsApp Web', () => {
  const base = { senderId: 'extension-id', runtimeId: 'extension-id', type: 'FOLLOWUP_INBOUND_ACTIVITY' };
  assert.equal(decideMessage({ ...base, senderUrl: 'https://web.whatsapp.com/' }).action, 'acknowledge');
  assert.equal(decideMessage({ ...base, senderUrl: 'https://example.com/' }).action, 'reject');
});

test('service worker usa alarmes persistentes, consentimento, blacklist, spam, quiet hours e cancela após resposta', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /chrome\.alarms\.create\(name, \{ when:/);
  assert.match(worker, /reconcilePendingFollowups\(\)/);
  assert.match(worker, /CONSENT_STATUS_OPTED_IN/);
  assert.match(worker, /blacklistTails\(\)/);
  assert.match(worker, /normalizeType\(lead\.tipo\) === 'spam'/);
  assert.match(worker, /isWithinQuietHours\(now, settings\)/);
  assert.match(worker, /cancelOnReply/);
  assert.match(worker, /FOLLOWUP_SEND_TO_PHONE/);
});

test('resposta recebida no WhatsApp envia apenas metadados para interromper sequência', () => {
  const content = read('content/content.js');
  assert.match(content, /FOLLOWUP_INBOUND_ACTIVITY/);
  assert.match(content, /messageId: aiPayload\.messageId/);
  assert.match(content, /receivedAt: aiPayload\.receivedAt/);
  assert.doesNotMatch(content.slice(content.indexOf("sendToBackground('FOLLOWUP_INBOUND_ACTIVITY'"), content.indexOf("sendToBackground('FOLLOWUP_INBOUND_ACTIVITY'") + 450), /text:/);
});

test('ponte de envio de follow-up é restrita ao service worker e usa a ponte do WhatsApp existente', () => {
  const content = read('content/content.js');
  const injected = read('content/injected.js');
  assert.match(content, /sender\?\.url !== expectedSender/);
  assert.match(content, /FOLLOWUP_SEND_TO_PHONE/);
  assert.match(injected, /withOutgoingSendLock\(\(\) => sendViaStore\(phone, text\)\)/);
});
