import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('fila de entrada é persistente, limitada, serial e deduplica mensagens por ID', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /const AI_INCOMING_QUEUE_KEY = 'aiSupportIncomingQueue'/);
  assert.match(worker, /const AI_INCOMING_QUEUE_LIMIT = 100/);
  assert.match(worker, /async function enqueueAiIncomingMessage/);
  assert.match(worker, /async function drainAiIncomingQueue/);
  assert.match(worker, /queue\.some\(\(item\) => item\?\.messageId === payload\.messageId/);
  assert.match(worker, /aiIncomingProcessingChain\.then\(async \(\) =>/);
  assert.match(worker, /status: 'processing'/);
});

test('a fila recupera mensagens incertas sem repetir envio e conserva mensagens sem painel aberto', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /async function recoverAiIncomingQueueOnce/);
  assert.match(worker, /status: 'needs_attention'/);
  assert.match(worker, /O envio é incerto; a mensagem não foi repetida automaticamente/);
  assert.match(worker, /outcome\?\.status === 'panel-not-open'/);
  assert.match(worker, /status: 'queued', startedAt: null/);
  assert.match(worker, /Não repetir automaticamente erro ou envio não confirmado/);
});

test('estado operacional expõe fila pendente, mensagens para revisão e quantidade de memórias', () => {
  const worker = read('background/service-worker.js');
  const execution = read('sidepanel/components/ExecutionView.js');
  const aiChat = read('sidepanel/components/AIChatView.js');
  assert.match(worker, /incomingQueueCount, incomingQueueNeedsAttentionCount, conversationMemoryCount/);
  assert.match(execution, /Mensagens para revisão/);
  assert.match(execution, /Contatos com memória profissional/);
  assert.match(aiChat, /incomingQueueNeedsAttentionCount/);
});

test('memória é estruturada, usa hash da conversa e não expõe o mapa na configuração pública', () => {
  const worker = read('background/service-worker.js');
  const drive = read('background/drive-sync.js');
  assert.match(worker, /updateAiConversationMemory\(conversationKey, decision\.qualification/);
  assert.match(worker, /buildAiConversationMemoryPrompt\(config\.conversationMemory\?\.\[conversationKey\]/);
  assert.match(worker, /delete safe\.conversationMemory/);
  assert.match(drive, /mergeAiConversationMemoryMaps\(local\.conversationMemory/);
  assert.match(drive, /safe\.conversationMemory = mergeAiConversationMemoryMaps/);
});
