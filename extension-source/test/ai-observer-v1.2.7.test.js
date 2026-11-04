import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AI_OPERATION_MODES,
  buildAiObserverSystemPrompt,
  getAiObserverChangedFields,
  normalizeAiOperationMode,
} from '../lib/ai-observer.js';
import { FEATURE_CATALOG, FEATURE_CATALOG_VERSION, getFeatureAccess, hasFeatureEntitlement } from '../lib/feature-catalog.js';
import { normalizeAiMonitorEvent, summarizeAiMonitorEvents } from '../lib/ai-monitoring.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('modo de operação normaliza valores legados para atendimento automático', () => {
  assert.equal(normalizeAiOperationMode('observe_only'), AI_OPERATION_MODES.OBSERVE_ONLY);
  assert.equal(normalizeAiOperationMode('auto_reply'), AI_OPERATION_MODES.AUTO_REPLY);
  assert.equal(normalizeAiOperationMode('qualquer-outro-valor'), AI_OPERATION_MODES.AUTO_REPLY);
  assert.equal(normalizeAiOperationMode(undefined, 'observe_only'), AI_OPERATION_MODES.OBSERVE_ONLY);
});

test('prompt observador proíbe respostas, ações externas e registro de atributos pessoais sensíveis', () => {
  const prompt = buildAiObserverSystemPrompt({ personaMode: 'commercial', businessName: 'Empresa Exemplo', qualificationCriteria: 'Orçamento de mídia a partir de R$ 1.000.' });
  assert.match(prompt, /MODO SOMENTE OBSERVAÇÃO/);
  assert.match(prompt, /não envie mensagem/i);
  assert.match(prompt, /Nunca inclua chaves reply/);
  assert.match(prompt, /dados financeiros pessoais/);
  assert.match(prompt, /Empresa Exemplo/);
  assert.match(prompt, /Orçamento de mídia a partir de R\$ 1\.000/);
});

test('prompt de networking não transforma conexão em qualificação comercial', () => {
  const prompt = buildAiObserverSystemPrompt({ personaMode: 'networking' });
  assert.match(prompt, /PERFIL NETWORKING/);
  assert.match(prompt, /mantenha isQualified=false/);
});

test('detector de mudanças ignora timestamps e classificações de nicho vazias', () => {
  const previous = { summary: 'Empresa busca anúncios', nicheClassification: { updatedAt: '2026-10-01T10:00:00Z' } };
  const same = { summary: 'Empresa busca anúncios', nicheClassification: { updatedAt: '2026-10-02T10:00:00Z' } };
  assert.deepEqual(getAiObserverChangedFields(previous, same), []);
  const next = { summary: 'Empresa busca anúncios', need: 'Gerar leads', nicheClassification: { primaryNiche: 'Contabilidade', path: ['Serviços', 'Contabilidade'], updatedAt: '2026-10-02T10:00:00Z' } };
  assert.deepEqual(getAiObserverChangedFields(previous, next), ['necessidade', 'classificação de nicho']);
});

test('catálogo v5 libera IA observadora somente com IA e CRM básico', () => {
  assert.equal(FEATURE_CATALOG_VERSION, 14);
  const feature = FEATURE_CATALOG.find((item) => item.id === 'ai.mode.observe_only');
  assert.equal(feature?.implemented, true);
  assert.deepEqual(feature?.requires, ['whatsapp.ai_support', 'crm.leads']);
  assert.equal(getFeatureAccess(['ai.mode.observe_only'], 'ai.mode.observe_only').allowed, false);
  assert.equal(hasFeatureEntitlement(['whatsapp.ai_support', 'crm.leads', 'ai.mode.observe_only'], 'ai.mode.observe_only'), true);
});

test('service worker valida entitlement e separa observação do caminho de resposta', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /normalizeAiOperationMode\(config\.operationMode\)/);
  assert.match(worker, /hasFeatureEntitlement\(state\.payload\?\.ent, 'ai\.mode\.observe_only'\)/);
  assert.match(worker, /buildAiObserverSystemPrompt/);
  assert.match(worker, /if \(operationMode === AI_OPERATION_MODES\.OBSERVE_ONLY\)/);
  assert.match(worker, /if \(chatType === 'group' && operationMode !== AI_OPERATION_MODES\.OBSERVE_ONLY\)/);
  assert.match(worker, /if \(activeHandoff && operationMode !== AI_OPERATION_MODES\.OBSERVE_ONLY\)/);
  assert.match(worker, /\{ mode: AI_OPERATION_MODES\.OBSERVE_ONLY \}/);
  assert.match(worker, /operationMode !== AI_OPERATION_MODES\.OBSERVE_ONLY && processingStage === 'provider'/);
  const processBody = worker.slice(worker.indexOf('async function processAiIncomingMessage'), worker.indexOf('async function safeRecordActionTelemetry'));
  const observerBranch = processBody.slice(processBody.indexOf('if (operationMode === AI_OPERATION_MODES.OBSERVE_ONLY) {', processBody.indexOf('const decision = parseAiDecision')), processBody.indexOf('let reply = decision.reply'));
  assert.doesNotMatch(observerBranch, /AI_SEND_REPLY|AI_SEND_TO_PHONE|sendToTabEnsured|createAiOrder|notifySeller/);
  assert.match(worker, /if \(!observerOnly && qualifiesNow/);
  assert.match(worker, /ai\.observation\.updated/);
  assert.match(worker, /observerConfigured.*ai\.mode\.observe_only/s);
});

test('UI permite configurar modo observador por personalidade e explica que não envia mensagens', () => {
  const view = read('sidepanel/components/AIChatView.js');
  assert.match(view, /id="ai-chat-operation-mode"/);
  assert.match(view, /value="observe_only"/);
  assert.match(view, /Somente observação/);
  assert.match(view, /nenhuma mensagem será enviada/i);
  assert.match(view, /operationMode: activePersona\.operationMode/);
  assert.match(view, /IA OBSERVADORA · analisando conversas/);
});

test('card do CRM identifica informações atualizadas pela IA observadora', () => {
  const modal = read('sidepanel/components/LeadModal.js');
  assert.match(modal, /i9Hub-ai-observer/);
  assert.match(modal, /IA observadora · nenhuma mensagem foi enviada ao contato/);
});

test('monitoramento separa análises CRM de respostas enviadas', () => {
  const observed = normalizeAiMonitorEvent({ status: 'observed', operationMode: 'observe_only', personaMode: 'commercial', personaId: 'p1' });
  assert.equal(observed.category, 'crm_observation_updated');
  assert.equal(observed.operationMode, 'observe_only');
  const summary = summarizeAiMonitorEvents([
    { id: 'a', status: 'observed', operationMode: 'observe_only', personaId: 'p1', personaMode: 'commercial', qualificationStatus: 'in_qualification' },
    { id: 'b', status: 'observer-no-change', operationMode: 'observe_only', personaId: 'p1', personaMode: 'commercial' },
    { id: 'c', status: 'processed', operationMode: 'auto_reply', personaId: 'p2', personaMode: 'commercial' },
  ]);
  assert.equal(summary.totals.analyzed, 1);
  assert.equal(summary.totals.observerNoChange, 1);
  assert.equal(summary.totals.responses, 1);
  assert.equal(summary.byPersona.find((row) => row.personaId === 'p1').responseRate, null);
});

test('versão 1.2.8 está sincronizada no manifesto, pacote e pontes WhatsApp', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.equal(pkg.version, '1.0.0');
  assert.match(read('content/content.js'), /const CONTENT_VER = '0\.0\.1\.0'/);
  assert.match(read('content/injected.js'), /const EXT_VER = '0\.0\.1\.0'/);
});
