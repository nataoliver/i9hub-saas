import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v1.0.9 registra o Chat com IA no menu e no roteador', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.match(read('sidepanel/utils/router.js'), /'ai-chat': \{ title: 'Chat com IA'/);
  assert.match(read('sidepanel/sidepanel.js'), /"ai-chat": new AIChatView\(this\)/);
  assert.match(read('sidepanel/components/Header.js'), /'ai-chat': 'Chat com IA'/);
});

test('a configuração de IA inclui modo privado/grupo, gatilhos e qualificação do CRM', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  const worker = read('background/service-worker.js');
  assert.match(ui, /value="private_only"/);
  assert.match(ui, /value="groups_only"/);
  assert.match(ui, /value="both"/);
  assert.match(ui, /value="reply_or_mention"/);
  assert.match(ui, /value="all_messages"/);
  assert.match(ui, /ai-chat-qualified-stage/);
  assert.match(ui, /ai-chat-confidence/);
  assert.match(worker, /chatMode === 'private_only' && chatType === 'group'/);
  assert.match(worker, /repliedToAssistant/);
  assert.match(worker, /group-trigger-required/);
  assert.match(worker, /applyAiLeadQualification/);
  assert.match(worker, /lead\.aiQualification/);
});

test('o rodízio tenta provedores reserva e aplica cooldown após limites de uso', () => {
  const worker = read('background/service-worker.js');
  const ui = read('sidepanel/components/AIChatView.js');
  assert.match(worker, /callAiProviderWithFallback/);
  assert.match(worker, /resource[_ ]exhausted|daily.{0,20}limit|insufficient_quota/i);
  assert.match(worker, /providerCooldownUntil/);
  assert.match(worker, /fallbackProviders/);
  assert.match(ui, /Adicionar provedor reserva/);
  assert.match(ui, /rodízio tentará outra chave/i);
});

test('mensagens enviadas à IA incluem contexto de resposta citada e histórico da conversa', () => {
  const content = read('content/content.js');
  const worker = read('background/service-worker.js');
  const crm = read('sidepanel/components/CRMView.js');
  assert.match(crm, /aiStatusBadgeHTML/);
  assert.match(crm, /lead\.aiIntelligence\?\.summary/);
  assert.match(content, /replyContext/);
  assert.match(content, /isMention/);
  assert.match(content, /senderName/);
  assert.match(worker, /Mensagem citada\/respondida/);
  assert.match(worker, /conversations\[conversationKey\].*slice\(-8\)/s);
});

test('chaves de IA não são expostas na configuração pública e Gemini não recebe a chave na URL', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /const \{ apiKey, fallbackProviders, \.\.\.safe \} = c/);
  assert.match(worker, /'x-goog-api-key': config\.apiKey/);
  assert.doesNotMatch(worker, /generateContent\?key=\$\{encodeURIComponent\(config\.apiKey\)\}/);
});

test('configuração guiada abre a página oficial da chave e preenche modelo e endpoint', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  assert.match(ui, /https:\/\/platform\.openai\.com\/api-keys/);
  assert.match(ui, /https:\/\/console\.anthropic\.com\/settings\/keys/);
  assert.match(ui, /https:\/\/aistudio\.google\.com\/app\/apikey/);
  assert.match(ui, /https:\/\/openrouter\.ai\/keys/);
  assert.match(ui, /chrome\.tabs\.create\(\{ url: meta\.keyUrl, active: true \}\)/);
  assert.match(ui, /getConfiguredEndpoint\(provider, model\?\.value \|\| ''\)/);
  assert.match(ui, /Salvar, autorizar e testar/);
});

test('configuração inicial não obriga preencher empresa, instruções ou catálogo antes de colar a chave', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  assert.match(ui, /const DEFAULT_BUSINESS_NAME = 'Minha empresa'/);
  assert.match(ui, /const DEFAULT_PROMPT =/);
  assert.match(ui, /const DEFAULT_KNOWLEDGE =/);
  assert.match(ui, /businessName: activePersona.businessName/);
  assert.doesNotMatch(ui, /if \(!c\.businessName \|\| !c\.prompt \|\| !c\.knowledge\)/);
  assert.doesNotMatch(ui, /id="ai-chat-save"/);
});


test('a IA observa a lista de conversas e processa mensagens privadas e de grupos em ordem', () => {
  const content = read('content/content.js');
  const worker = read('background/service-worker.js');
  const gate = read('lib/message-gate.js');
  assert.match(content, /#pane-side/);
  assert.match(content, /AI_INBOX_CHECK/);
  assert.match(content, /inbox-list-watcher/);
  assert.match(content, /waitForIncomingMessages/);
  assert.match(content, /targetPreview = ''/);
  assert.match(content, /await waitForIncomingMessages\(candidate\.newMessageCount \|\| 1, 5000, candidate\.preview/);
  assert.match(content, /await emit\(messageEl, \{ force: true/);
  assert.match(content, /waitForProcessing: true/);
  assert.match(content, /current\.isGroup \? \[\'groups_only\', \'both\'\]\.includes\(mode\)/);
  assert.match(content, /receivedAt: parseMessageTimestamp/);
  assert.match(worker, /aiIncomingProcessingChain/);
  assert.match(worker, /type === 'AI_INBOX_CHECK'/);
  assert.match(worker, /config\.enabled === true && heartbeat > 0/);
  assert.match(gate, /'AI_INBOX_CHECK'/);
});

test('status da IA é visível e o painel usa um único controle de ativar/pausar', () => {
  const css = read('sidepanel/sidepanel.css');
  const ui = read('sidepanel/components/AIChatView.js');
  assert.match(ui, /id=\"ai-chat-status-banner\"/);
  assert.match(ui, /id=\"ai-chat-toggle\"/);
  assert.match(ui, /IA ATIVA · pronta para atender/);
  assert.match(ui, /Atendimento pausado/);
  assert.match(css, /\.ai-status-banner \{ position: sticky/);
  assert.doesNotMatch(ui, /id=\"ai-chat-enable\"/);
  assert.doesNotMatch(ui, /id=\"ai-chat-disable\"/);
});

test('histórico da IA pode criar planilha no Google Sheets e guardar contexto entre computadores', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  const worker = read('background/service-worker.js');
  const features = read('lib/feature-catalog.js');
  assert.match(ui, /Criar \/ conectar histórico/);
  assert.match(ui, /AI_CONNECT_HISTORY/);
  assert.match(worker, /connectAiConversationHistory/);
  assert.match(worker, /AI_HISTORY_HEADERS/);
  assert.match(worker, /queueAiHistoryEvent/);
  assert.match(worker, /loadAiConversationHistory/);
  assert.match(worker, /AI_HISTORY_QUEUE_KEY/);
  assert.match(features, /AI_CONNECT_HISTORY: \'whatsapp.ai_support.google_sheets\'/);
});
