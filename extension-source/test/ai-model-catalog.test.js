import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAiModelList, preferredAiModel } from '../lib/ai-model-catalog.js';

test('Gemini lista somente modelos com generateContent e remove o prefixo models/', () => {
  const models = normalizeAiModelList('gemini', { models: [
    { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
    { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/gemini-2.0-pro', supportedGenerationMethods: ['generateContent'] },
  ] });
  assert.deepEqual(models.map((item) => item.id).sort(), ['gemini-2.0-pro', 'gemini-2.5-flash']);
  assert.equal(models.find((item) => item.id === 'gemini-2.5-flash').label, 'Gemini 2.5 Flash — gemini-2.5-flash');
});

test('OpenAI não apresenta modelos de embedding, áudio ou imagem como modelos de chat', () => {
  const models = normalizeAiModelList('openai', { data: [
    { id: 'gpt-4o-mini', owned_by: 'openai' },
    { id: 'gpt-4.1-mini', owned_by: 'openai' },
    { id: 'text-embedding-3-small' },
    { id: 'whisper-1' },
  ] });
  assert.deepEqual(models.map((item) => item.id).sort(), ['gpt-4.1-mini', 'gpt-4o-mini']);
});

test('Anthropic e OpenRouter são normalizados em opções com id e rótulo', () => {
  const anthropic = normalizeAiModelList('anthropic', { data: [{ id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4' }] });
  assert.equal(anthropic[0].id, 'claude-sonnet-4-20250514');
  assert.match(anthropic[0].label, /Claude Sonnet 4/);
  const openrouter = normalizeAiModelList('openrouter', { data: [
    { id: 'vendor/model-text', name: 'Model Text', architecture: { modality: 'text->text' }, context_length: 32000, pricing: { prompt: '0', completion: '0' } },
    { id: 'vendor/model-image-only', name: 'Image Only', architecture: { modality: 'image->image' } },
  ] });
  assert.equal(openrouter.length, 1);
  assert.equal(openrouter[0].id, 'vendor/model-text');
  assert.match(openrouter[0].description, /preço zero/i);
});

test('o seletor prefere o modelo atual se ele estiver disponível e senão recomenda o primeiro da lista', () => {
  const models = [{ id: 'gemini-2.5-flash', label: 'Flash' }, { id: 'gemini-2.5-pro', label: 'Pro' }];
  assert.equal(preferredAiModel(models, 'gemini-2.5-pro'), 'gemini-2.5-pro');
  assert.equal(preferredAiModel(models, 'modelo-retirado'), 'gemini-2.5-flash');
});

test('v1.0.9 consulta modelos por chave e apresenta um seletor em vez de exigir o nome digitado', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const ui = read('sidepanel/components/AIChatView.js');
  const worker = read('background/service-worker.js');
  const features = read('lib/feature-catalog.js');
  assert.match(ui, /<select class="form-select" id="ai-chat-model">/);
  assert.match(ui, /id="ai-chat-load-models"/);
  assert.match(ui, /sendMessage\('AI_LIST_MODELS'/);
  assert.match(worker, /async AI_LIST_MODELS\(p\)/);
  assert.match(worker, /v1beta\/models\?pageSize=1000/);
  assert.match(worker, /\/v1\/models/);
  assert.match(worker, /normalizeAiModelList\(provider, payload\)/);
  assert.match(features, /AI_LIST_MODELS: 'whatsapp\.ai_support\.configure'/);
  assert.doesNotMatch(ui, /gemini-3\.1-flash/);
  assert.doesNotMatch(ui, /gemini-2\.0-flash/);
});
