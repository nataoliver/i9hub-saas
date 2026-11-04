import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_MONITOR_EVENT_LIMIT, normalizeAiMonitorEvent, summarizeAiMonitorEvents } from '../lib/ai-monitoring.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('normaliza evento sem armazenar conteúdo de mensagem ou telefone', () => {
  const event = normalizeAiMonitorEvent({
    id: 'evt1', eventKey: 'chat_abcd', at: '2026-10-27T12:00:00.000Z', status: 'processed',
    personaId: 'p1', personaName: 'Networking', personaMode: 'networking', chatType: 'private',
    chatName: 'Contato exemplo', provider: 'gemini', model: 'gemini-flash', durationMs: 1200,
    message: 'texto privado que não deve ser salvo', phone: '+5511999999999', niche: 'Fisioterapia',
  });
  assert.equal(event.status, 'processed');
  assert.equal(event.niche, 'Fisioterapia');
  assert.equal('message' in event, false);
  assert.equal('phone' in event, false);
  const redacted = normalizeAiMonitorEvent({ status: 'error', error: 'Authorization Bearer abcdefghijklmnop sk-ant-abcdefghijklmnop' });
  assert.doesNotMatch(redacted.error, /abcdefghijklmnop/);
  assert.equal(normalizeAiMonitorEvent({ status: 'processed', durationMs: null }).durationMs, null);
});

test('agrega respostas, erros, pendências e qualificação por personalidade', () => {
  const summary = summarizeAiMonitorEvents([
    { id: '1', eventKey: '1', status: 'processed', personaId: 'commercial', personaName: 'Comercial', personaMode: 'commercial', chatType: 'private', qualified: true, qualificationStatus: 'qualified', niche: 'Fisioterapia' },
    { id: '2', eventKey: '2', status: 'reply-pending', personaId: 'commercial', personaName: 'Comercial', personaMode: 'commercial', chatType: 'private', error: 'Envio não confirmado' },
    { id: '3', eventKey: '3', status: 'error', personaId: 'networking', personaName: 'Networking', personaMode: 'networking', chatType: 'group', error: 'Falha do provedor', niche: 'Educação' },
    { id: '4', eventKey: '4', status: 'group-trigger-required', personaId: 'networking', personaName: 'Networking', personaMode: 'networking', chatType: 'group' },
  ]);
  assert.deepEqual(summary.totals, { received: 4, responses: 1, analyzed: 0, observerNoChange: 0, errors: 1, pendingReplies: 1, skipped: 1, classified: 2, qualified: 1 });
  const commercial = summary.byPersona.find((row) => row.personaId === 'commercial');
  assert.equal(commercial.responses, 1);
  assert.equal(commercial.pendingReplies, 1);
  assert.equal(commercial.qualified, 1);
  assert.equal(commercial.responseRate, 50);
  assert.equal(summary.recentErrors.length, 2);
  const noAttempt = summarizeAiMonitorEvents([{ id: 'skip', status: 'group-trigger-required', personaId: 'p', personaName: 'Perfil', personaMode: 'networking' }]);
  assert.equal(noAttempt.byPersona[0].responseRate, null);
});

test('autoconhecimento não aparece como qualificação comercial e não conserva classificação sensível', () => {
  const summary = summarizeAiMonitorEvents([
    { id: '1', status: 'processed', personaId: 'reflect', personaName: 'Autoconhecimento', personaMode: 'self_knowledge', qualified: true, qualificationStatus: 'qualified', niche: 'Saúde', chatType: 'private' },
  ]);
  assert.equal(summary.totals.qualified, 0);
  assert.equal(summary.totals.classified, 0);
  assert.equal(summary.byPersona[0].qualified, 0);
  assert.equal(summary.recentEvents[0].niche, '');
  assert.equal(summary.recentEvents[0].qualificationStatus, '');
});

test('limita o histórico de eventos retidos a 500 registros', () => {
  const input = Array.from({ length: AI_MONITOR_EVENT_LIMIT + 20 }, (_, i) => ({ id: String(i), eventKey: String(i), status: 'processed', personaId: 'p', personaName: 'Perfil', personaMode: 'commercial' }));
  const summary = summarizeAiMonitorEvents(input);
  assert.equal(summary.retainedEvents, AI_MONITOR_EVENT_LIMIT);
  assert.equal(summary.recentEvents.length, 20);
});

test('o service worker registra eventos após o processamento e expõe o resumo no status', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /const AI_MONITOR_EVENTS_KEY = 'aiSupportMonitorEvents'/);
  assert.match(worker, /async function recordAiMonitorEvent\(/);
  assert.match(worker, /await recordAiMonitorEvent\(item\.payload, outcome/);
  assert.match(worker, /const monitoring = summarizeAiMonitorEvents/);
  assert.match(worker, /monitoring \}/);
  assert.match(worker, /eventKey: aiChatHash\(String\(payload\.messageId/);
});

test('a Central de Execução apresenta desempenho por personalidade, atividade e erros', () => {
  const view = read('sidepanel/components/ExecutionView.js');
  const styles = read('sidepanel/sidepanel.css');
  assert.match(view, /Desempenho por personalidade/);
  assert.match(view, /Atividade recente da IA/);
  assert.match(view, /Erros e respostas pendentes/);
  assert.match(view, /personaPerformance\(monitoring\)/);
  assert.match(view, /recentErrors/);
  assert.match(view, /byPersona/);
  assert.match(styles, /\.i9-ai-persona-grid/);
  assert.match(styles, /\.i9-ai-activity-list/);
});

test('versão 1.2.8 está sincronizada no manifesto, pacote e pontes do WhatsApp', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.equal(pkg.version, '1.0.0');
  assert.match(read('content/content.js'), /const CONTENT_VER = '0\.0\.1\.0'/);
  assert.match(read('content/injected.js'), /const EXT_VER = '0\.0\.1\.0'/);
});
