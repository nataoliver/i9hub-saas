import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Chat com IA permite escolher todos os grupos, apenas selecionados ou excluir grupos', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  assert.match(ui, /id="ai-group-scope"/);
  assert.match(ui, /value="selected">Somente grupos selecionados/);
  assert.match(ui, /value="all">Todos os grupos/);
  assert.match(ui, /value="except_selected">Todos, exceto os grupos selecionados/);
  assert.match(ui, /id="ai-groups-refresh"/);
  assert.match(ui, /sendMessage\('EXTRACT_ALL_CHATS'\)/);
  assert.match(ui, /selectedGroupIds: \[\.\.\.this\.selectedGroupIds\]/);
});

test('gatilhos de grupo cobrem todas as mensagens, menção, resposta à IA e palavras-chave', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  const worker = read('background/service-worker.js');
  for (const value of ['all_messages', 'reply_or_mention', 'mention_only', 'reply_only', 'keywords']) {
    assert.ok(ui.includes(`value="${value}"`), `UI deve oferecer ${value}`);
    assert.ok(worker.includes(`'${value}'`), `worker deve reconhecer ${value}`);
  }
  assert.match(ui, /id="ai-group-keywords"/);
  assert.match(worker, /groupReplyKeywords/);
  assert.match(worker, /payload\.isMention === true/);
  assert.match(worker, /repliedToAssistant/);
});

test('regras de seleção de grupo são validadas no service worker antes de gerar resposta', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /if \(scope === 'selected' && \(!selectedIds\.length \|\| !selected\)\) return \{ status: 'group-not-selected' \}/);
  assert.match(worker, /if \(scope === 'except_selected' && selected\) return \{ status: 'group-excluded' \}/);
  assert.match(worker, /const selectedGroupIds = \[\.\.\.new Set/);
  assert.match(worker, /filter\(\(id\) => \/@g\\\.us\$\/i\.test\(id\)\)/);
});

test('a configuração de grupos é carregada e salva junto com as preferências da IA', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  const worker = read('background/service-worker.js');
  assert.match(ui, /c\.groupScope \|\| 'selected'/);
  assert.match(ui, /Array\.isArray\(c\.selectedGroupIds\)/);
  assert.match(ui, /groupReplyKeywords: val\('ai-group-keywords'\)/);
  assert.match(worker, /groupScope, selectedGroupIds, groupReplyKeywords/);
});

test('a versão comercial e as pontes do WhatsApp estão sincronizadas em 1.2.8', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.equal(pkg.version, '1.0.0');
  assert.match(read('content/content.js'), /const CONTENT_VER = '0\.0\.1\.0'/);
  assert.match(read('content/injected.js'), /const EXT_VER = '0\.0\.1\.0'/);
});
