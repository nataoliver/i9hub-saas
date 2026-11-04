import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_ACTIONS, ACTION_FEATURE_MAP } from '../lib/feature-catalog.js';
import { decideMessage } from '../lib/message-gate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Sincronizar PV usa o identificador canônico do catálogo', () => {
  const crm = read('sidepanel/components/CRMView.js');
  const catalog = read('lib/feature-catalog.js');
  const sidepanel = read('sidepanel/sidepanel.js');
  assert.match(crm, /id="btn-sync-private" data-feature="whatsapp\.private_opportunities"/);
  assert.doesNotMatch(crm, /id="btn-sync-private" data-feature="crm\.sync_private"/);
  assert.match(crm, /const syncRunId = `crm_pv_/);
  assert.match(crm, /syncPrivateOpportunities\(\{ syncRunId \}\)/);
  assert.match(catalog, /SYNC_PRIVATE_OPPORTUNITIES:\s*'whatsapp\.private_opportunities'/);
  assert.match(sidepanel, /hasFeatureEntitlement/);
  assert.match(sidepanel, /if \(!license\?\.licensed\) return false/);
  assert.equal(ACTION_FEATURE_MAP.SYNC_PRIVATE_OPPORTUNITIES, 'whatsapp.private_opportunities');
  assert.ok(!CORE_ACTIONS.has('SYNC_PRIVATE_OPPORTUNITIES'));
  const worker = read('background/service-worker.js');
  assert.match(worker, /gate\('SYNC_PRIVATE_OPPORTUNITIES', payload\)/);
});

test('syncRunId e scanId estão definidos antes dos primeiros logs da varredura', () => {
  const injected = read('content/injected.js');
  const start = injected.indexOf('async function syncPrivateChatsToCrm(');
  const end = injected.indexOf('function startPrivateOpportunityMonitor()', start);
  assert.ok(start >= 0 && end > start, 'função de sincronização deve existir');
  const fn = injected.slice(start, end);
  const scanIdDeclaration = fn.indexOf('const scanId =');
  const firstScanIdUse = fn.indexOf("event: 'CHAT_DISCOVERY_RESULT'");
  const firstSyncRunIdUse = fn.indexOf("event: 'CHAT_DISCOVERY_RESULT'");
  assert.ok(scanIdDeclaration >= 0 && scanIdDeclaration < firstScanIdUse, 'scanId deve ser inicializado antes do primeiro uso');
  assert.match(fn.slice(0, fn.indexOf('privateScanInFlight =')), /syncRunId\s*=\s*null/);
  assert.ok(firstSyncRunIdUse >= 0, 'log inicial de descoberta deve existir');
});

test('sincronização manual encaminha o ID da execução e não descarta clique durante varredura ativa', () => {
  const injected = read('content/injected.js');
  assert.match(injected, /syncPrivateChatsToCrm\(\{\s*force:\s*true,\s*syncRunId:\s*payload\?\.syncRunId\s*\|\|\s*null\s*\}\)/);
  assert.match(injected, /if \(force\) \{[\s\S]*?return privateScanInFlight\.then\(\(\) => syncPrivateChatsToCrm\(\{ force, syncRunId \}\)\)/);
});


test('falha de prontidão do WhatsApp é devolvida como erro ao botão', () => {
  const content = read('content/content.js');
  assert.match(content, /if \(r\?\.sync\?\.success === false\)/);
  assert.match(content, /return \{ success: false, code, error, data: r \}/);
  assert.match(content, /O WhatsApp ainda está carregando as conversas/);
});


test('Sincronização importa os contatos em lotes antes de carregar o histórico antigo', () => {
  const injected = read('content/injected.js');
  const fnStart = injected.indexOf('async function syncPrivateChatsToCrm(');
  const fnEnd = injected.indexOf('function startPrivateOpportunityMonitor()', fnStart);
  const fn = injected.slice(fnStart, fnEnd);
  const importPhase = fn.indexOf("phase: 'import'");
  const historyLoad = fn.indexOf('loadPrivateChatHistory(st, rawChat');
  assert.ok(importPhase >= 0, 'deve existir fase de importação imediata');
  assert.ok(historyLoad > importPhase, 'o histórico não pode bloquear a importação inicial');
  assert.match(fn, /scanId, syncRunId, batchIndex/);
  assert.match(fn, /PRIVATE_CHATS_SYNC_PROGRESS/);
});

test('progresso e conclusão da sincronização são correlacionados à execução manual', () => {
  const injected = read('content/injected.js');
  const worker = read('background/service-worker.js');
  const crm = read('sidepanel/components/CRMView.js');
  assert.match(injected, /PRIVATE_CHATS_SYNC_PROGRESS/);
  assert.match(worker, /syncRunId: payload\.syncRunId \|\| ''/);
  assert.match(worker, /broadcast\('PRIVATE_OPPORTUNITIES_PROGRESS'/);
  assert.match(crm, /payload\.syncRunId !== syncRunId/);
  assert.match(crm, /PRIVATE_OPPORTUNITIES_UPDATED/);
  assert.match(crm, /Sincronização concluída:/);
});

test('scripts WhatsApp têm versão interna nova para evitar reutilização de scripts antigos', () => {
  assert.match(read('content/content.js'), /const CONTENT_VER = '0\.0\.1\.0'/);
  assert.match(read('content/injected.js'), /const EXT_VER = '0\.0\.1\.0'/);
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
});


test('lotes iniciais persistidos atualizam o CRM antes da conclusão do histórico', () => {
  const worker = read('background/service-worker.js');
  const sidepanel = read('sidepanel/sidepanel.js');
  assert.match(worker, /classified: Number\(run\.classified\) \|\| 0, persisted: true/);
  assert.match(sidepanel, /d\.persisted && d\.phase === "import"/);
  assert.match(sidepanel, /this\.views\.crm\?\.loadLeads\?\.\(\)/);
});


test('eventos de progresso da sincronização só são aceitos do WhatsApp Web', () => {
  const base = { senderId: 'ext-id', runtimeId: 'ext-id', senderUrl: 'https://web.whatsapp.com/' };
  assert.equal(decideMessage({ ...base, type: 'PRIVATE_CHATS_SYNC_PROGRESS' }).action, 'acknowledge');
  assert.equal(decideMessage({ ...base, type: 'PRIVATE_CHATS_SYNC_FAILED' }).action, 'acknowledge');
  assert.equal(decideMessage({ ...base, senderUrl: 'https://example.com/', type: 'PRIVATE_CHATS_SYNC_PROGRESS' }).action, 'reject');
});

test('contatos que entram pela primeira vez como oportunidade de PV vão para Novo sem resetar PVs existentes', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /const wasPrivateOpportunity = lead\.opportunity === true && lead\.opportunitySource === 'whatsapp_private'/);
  assert.match(worker, /if \(!wasPrivateOpportunity\) setIfChanged\('stage', 'novo'\)/);
  assert.match(worker, /stage: 'novo'/);
});


test('clique manual durante varredura ativa informa que a execução foi enfileirada', () => {
  const injected = read('content/injected.js');
  const crm = read('sidepanel/components/CRMView.js');
  assert.match(injected, /phase: 'queued'/);
  assert.match(crm, /payload\.phase === "queued"/);
  assert.match(injected, /privateScanInFlight\.then\(\(\) => syncPrivateChatsToCrm\(\{ force, syncRunId \}\)\)/);
});
