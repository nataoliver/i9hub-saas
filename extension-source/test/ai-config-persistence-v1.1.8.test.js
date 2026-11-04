import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Chat com IA oferece um botão geral de salvar e mostra o estado das alterações', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  assert.match(ui, /id="ai-chat-save-config"/);
  assert.match(ui, /id="ai-chat-config-save-status"/);
  assert.match(ui, /\$\('ai-chat-save-config'\).*saveAllConfig/);
  assert.match(ui, /async saveAllConfig\(/);
  assert.match(ui, /DRIVE_SYNC_NOW/);
  assert.match(ui, /Há alterações não salvas/);
});

test('operações de histórico preservam o formulário e salvam rascunhos antes de continuar', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  for (const methodName of ['connectHistory', 'toggleHistory', 'syncHistoryNow']) {
    const start = ui.indexOf(`  async ${methodName}() {`);
    const next = ui.indexOf('\n  async ', start + 5);
    const method = ui.slice(start, next === -1 ? ui.length : next);
    assert.match(method, /ensureDraftSavedBeforeAuxAction/);
    assert.match(method, /refreshSyncStatusPreservingForm/);
    assert.doesNotMatch(method, /await this\.load\(\)/);
  }
});

test('conectar e sincronizar histórico atualiza apenas metadados do histórico, não a data dos prompts', () => {
  const worker = read('background/service-worker.js');
  const connectStart = worker.indexOf('async function connectAiConversationHistory()');
  const connectEnd = worker.indexOf('function queueAiHistoryEvent', connectStart);
  const connect = worker.slice(connectStart, connectEnd);
  assert.match(connect, /const latestConfig = await getAiConfigInternal\(\)/);
  assert.match(connect, /latestConfig\.historyUpdatedAt = new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(connect, /latestConfig\.updatedAt =/);
  const enabledStart = worker.indexOf('async AI_SET_HISTORY_ENABLED(p)');
  const enabledEnd = worker.indexOf('async AI_HISTORY_SYNC_NOW()', enabledStart);
  const enabled = worker.slice(enabledStart, enabledEnd);
  assert.match(enabled, /config\.historyUpdatedAt = new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(enabled, /config\.updatedAt =/);
});

test('a mesclagem do Google Drive mantém timestamps separados para preferências e histórico', () => {
  const drive = read('background/drive-sync.js');
  assert.match(drive, /function aiHistoryConfigTimestamp/);
  assert.match(drive, /export function mergeAiConfig/);
  assert.match(drive, /AI_HISTORY_CONFIG_FIELDS/);
  const worker = read('background/service-worker.js');
  assert.match(worker, /historyUpdatedAt: String\(input\.historyUpdatedAt \?\? existing\.historyUpdatedAt/);
});
