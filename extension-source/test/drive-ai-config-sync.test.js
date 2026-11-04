import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeAiConfigForDrive, encryptAiSecrets, decryptAiSecrets, mergeAiConfig } from '../background/drive-sync.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('preferências da IA sincronizam, mas chaves e estado de ativação ficam fora do JSON aberto', () => {
  const safe = sanitizeAiConfigForDrive({ provider: 'gemini', model: 'gemini-flash', apiKey: 'SECRET-KEY', enabled: true, providerVerified: true, prompt: 'Qualifique leads', fallbackProviders: [{ id: 'f1', provider: 'openai', model: 'gpt-mini', apiKey: 'FALLBACK-SECRET', verified: true }] });
  assert.equal(safe.provider, 'gemini');
  assert.equal(safe.prompt, 'Qualifique leads');
  assert.equal('apiKey' in safe, false);
  assert.equal('enabled' in safe, false);
  assert.equal('providerVerified' in safe, false);
  assert.equal('apiKey' in safe.fallbackProviders[0], false);
  const drive = read('background/drive-sync.js');
  assert.match(drive, /aiConfig: sanitizeAiConfigForDrive/);
  assert.match(drive, /changes\[AI_CONFIG_KEY\]/);
  assert.match(drive, /DRIVE_SET_AI_SYNC_PASSPHRASE/);
});

test('chaves API são criptografadas com AES-GCM e recuperadas somente com a senha correta', async () => {
  const config = { provider: 'gemini', apiKey: 'AIza-TEST-SECRET', fallbackProviders: [{ id: 'f1', provider: 'openai', apiKey: 'sk-test-secret' }] };
  const envelope = await encryptAiSecrets(config, 'senha-forte-de-teste');
  const json = JSON.stringify(envelope);
  assert.equal(json.includes('AIza-TEST-SECRET'), false);
  assert.equal(json.includes('sk-test-secret'), false);
  const restored = await decryptAiSecrets(envelope, 'senha-forte-de-teste');
  assert.equal(restored.apiKey, config.apiKey);
  assert.equal(restored.fallbackProviders[0].apiKey, config.fallbackProviders[0].apiKey);
  await assert.rejects(() => decryptAiSecrets(envelope, 'senha-errada-123'), /decrypt|operation|data/i);
});

test('a interface explica sincronização de IA e oferece configurar/esquecer senha de sincronização', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  assert.match(ui, /Sincronização da IA entre computadores/);
  assert.match(ui, /ai-chat-sync-passphrase-save/);
  assert.match(ui, /DRIVE_SET_AI_SYNC_PASSPHRASE/);
  assert.match(ui, /DRIVE_CLEAR_AI_SYNC_PASSPHRASE/);
  const map = read('lib/feature-catalog.js');
  assert.match(map, /DRIVE_SET_AI_SYNC_PASSPHRASE: 'drive.sync'/);
});

test('sincronizar senha preserva rascunhos e reaplica somente os campos alterados após restaurar o Drive', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  const start = ui.indexOf('  async saveSyncPassphrase() {');
  const end = ui.indexOf('  async clearSyncPassphrase() {', start);
  const method = ui.slice(start, end);
  assert.match(method, /const draft = this\.collectConfig\(\)/);
  assert.match(method, /const changedFields = this\.getDraftChangedFields\(draft\)/);
  assert.match(method, /if \(hadLocalConfig && preserveDraft\)/);
  assert.match(method, /await this\.load\(\);[\s\S]*if \(preserveDraft\)[\s\S]*this\.applyDraftChanges\(draft, changedFields\)/);
  assert.match(method, /this\.mergeDraftIntoConfig\(draft, changedFields\)/);
  assert.match(method, /this\.refreshSyncStatusPreservingForm\(\)/);
  assert.match(ui, /getDraftChangedFields\(draft\)/);
});

test('restaurar chaves não executa um segundo merge imediato sobre as preferências recém-restauradas', () => {
  const drive = read('background/drive-sync.js');
  assert.match(drive, /if \(latestState\.enabled && \(!restored \|\| !preRestoreSyncCompleted\)\) syncResult = await syncQueued/);
});

test('mesclagem do Drive mantém prompts mais recentes mesmo quando o histórico foi atualizado em outro computador', () => {
  const local = {
    provider: 'gemini', model: 'gemini-flash', prompt: 'Prompt local mais recente', knowledge: 'Base local',
    updatedAt: '2026-10-27T14:00:00.000Z', historySheetId: 'sheet-local', historySheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-local/edit',
    historyEnabled: true, historyLastSyncAt: '2026-10-27T14:20:00.000Z', historyLastError: '', historyUpdatedAt: '2026-10-27T14:20:00.000Z',
  };
  const remote = {
    provider: 'gemini', model: 'gemini-flash', prompt: 'Prompt remoto antigo', knowledge: 'Base remota antiga',
    updatedAt: '2026-10-27T13:50:00.000Z', historySheetId: '', historySheetUrl: '', historyEnabled: false,
    historyLastSyncAt: null, historyLastError: '', historyUpdatedAt: '2026-10-27T13:55:00.000Z',
  };
  const merged = mergeAiConfig(local, remote);
  assert.equal(merged.prompt, 'Prompt local mais recente');
  assert.equal(merged.knowledge, 'Base local');
  assert.equal(merged.historySheetId, 'sheet-local');
  assert.equal(merged.historyEnabled, true);
});

test('mesclagem do Drive aceita prompt mais recente do outro computador sem perder a conexão local do histórico', () => {
  const local = {
    provider: 'gemini', model: 'gemini-flash', prompt: 'Prompt antigo local', updatedAt: '2026-10-27T14:00:00.000Z',
    historySheetId: 'sheet-local', historySheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-local/edit', historyEnabled: true,
    historyLastSyncAt: '2026-10-27T14:20:00.000Z', historyLastError: '', historyUpdatedAt: '2026-10-27T14:20:00.000Z',
  };
  const remote = {
    provider: 'gemini', model: 'gemini-flash', prompt: 'Prompt novo remoto', updatedAt: '2026-10-27T14:10:00.000Z',
    historySheetId: '', historySheetUrl: '', historyEnabled: false, historyLastSyncAt: null, historyLastError: '', historyUpdatedAt: '2026-10-27T13:55:00.000Z',
  };
  const merged = mergeAiConfig(local, remote);
  assert.equal(merged.prompt, 'Prompt novo remoto');
  assert.equal(merged.historySheetId, 'sheet-local');
  assert.equal(merged.historyEnabled, true);
});
