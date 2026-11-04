import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v1.2.0 preserva o gerenciador de personalidades e três modelos iniciais', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.match(ui, /id="ai-chat-persona-select"/);
  assert.match(ui, /id="ai-chat-persona-create"/);
  assert.match(ui, /id="ai-chat-persona-duplicate"/);
  assert.match(ui, /id="ai-chat-persona-delete"/);
  assert.match(ui, /networking: \{/);
  assert.match(ui, /self_knowledge: \{/);
  assert.match(ui, /commercial: \{/);
  assert.match(ui, /O limite é de 20 perfis de IA/);
});

test('perfil legado é preservado e perfis independentes são enviados ao salvar', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  const worker = read('background/service-worker.js');
  assert.match(ui, /Configuração migrada automaticamente da versão anterior/);
  assert.match(ui, /activePersonaId: activePersona.id, aiPersonas: personas\.slice\(0, 20\)/);
  assert.match(ui, /this\.personaMigrationPending = !Array\.isArray\(c\.aiPersonas\)/);
  assert.match(worker, /const rawPersonas = Array\.isArray\(input\.aiPersonas\)/);
  assert.match(worker, /aiPersonas, activePersonaId/);
  assert.match(worker, /function applyActiveAiPersona\(config = \{\}\)/);
});

test('modo networking evita venda não solicitada e limita o CRM a dados profissionais', () => {
  const worker = read('background/service-worker.js');
  const ui = read('sidepanel/components/AIChatView.js');
  assert.match(worker, /MODO NETWORKING/);
  assert.match(worker, /Não ofereça serviços, não pergunte orçamento e não faça prospecção comercial/);
  assert.match(worker, /if \(personaMode === 'networking'\)/);
  assert.match(worker, /nicheClassification: \{ primaryNiche: niche\.primaryNiche/);
  assert.match(ui, /Networking e conexão — sem abordagem comercial/);
});

test('modo autoconhecimento não grava reflexões pessoais no card nem cria pedidos', () => {
  const worker = read('background/service-worker.js');
  const ui = read('sidepanel/components/AIChatView.js');
  assert.match(worker, /personaMode !== 'self_knowledge'/);
  assert.match(worker, /if \(personaMode === 'commercial' && !decision\.handoffToHuman && decision\.shouldCreateOrder/);
  assert.match(worker, /MODO AUTOCONHECIMENTO/);
  assert.match(ui, /Autoconhecimento — conversa reflexiva/);
  assert.match(ui, /enabled\.disabled = mode !== 'commercial'/);
});

test('perfil selecionado só é ativado no atendimento automático após salvar', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  const worker = read('background/service-worker.js');
  assert.match(ui, /será usado no atendimento depois de salvar/);
  assert.match(ui, /AI_SAVE_CONFIG/);
  assert.match(worker, /const config = applyAiPersonaForContext\(storedConfig, payload\)/);
});
