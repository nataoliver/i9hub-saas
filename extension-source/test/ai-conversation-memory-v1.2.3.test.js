import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiConversationMemoryPrompt, mergeAiConversationMemory, mergeAiConversationMemoryMaps } from '../lib/ai-conversation-memory.js';
import { mergeAiConfig } from '../background/drive-sync.js';

const now = new Date().toISOString();

test('memória de networking conserva somente fatos profissionais e não guarda resumo pessoal, orçamento ou pedido', () => {
  const entry = mergeAiConversationMemory(null, {
    company: 'Coletivo Buriti', segment: 'Arte-educação', service: 'Oficinas culturais',
    summary: 'Relatou uma situação pessoal sensível', exactRequest: 'Quero apoio pessoal', budget: 'R$ 0',
    nicheClassification: { primaryNiche: 'Educação e cultura', path: ['Educação e cultura', 'Arte-educação'], subniches: ['Oficinas culturais'], tags: ['arte'] },
  }, 'networking', now);
  assert.equal(entry.company, 'Coletivo Buriti');
  assert.equal(entry.primaryNiche, 'Educação e cultura');
  assert.deepEqual(entry.nichePath, ['Educação e cultura', 'Arte-educação']);
  assert.equal('summary' in entry, false);
  assert.equal('exactRequest' in entry, false);
  assert.equal('budget' in entry, false);
});

test('autoconhecimento não persiste memória e não injeta memória profissional no prompt', () => {
  const entry = mergeAiConversationMemory(null, { summary: 'relato pessoal', company: 'Exemplo' }, 'self_knowledge', now);
  assert.equal(entry, null);
  assert.equal(buildAiConversationMemoryPrompt({ personaMode: 'commercial', company: 'Empresa', budget: 'R$ 1.000', updatedAt: now }, 'self_knowledge'), '');
});

test('memória comercial preserva pedido/necessidade e a instrução evita perguntas repetidas', () => {
  const entry = mergeAiConversationMemory(null, {
    company: 'Clínica Horizonte', segment: 'Fisioterapia', service: 'Fisioterapia esportiva',
    exactRequest: 'Atrair pacientes para reabilitação', need: 'Gerar novos contatos', budget: 'R$ 1.500/mês', timeframe: 'Próximo mês', nextStep: 'Agendar conversa',
    nicheClassification: { primaryNiche: 'Saúde', path: ['Saúde', 'Fisioterapia'] },
  }, 'commercial', now);
  const prompt = buildAiConversationMemoryPrompt(entry, 'commercial');
  assert.match(prompt, /Atrair pacientes para reabilitação/);
  assert.match(prompt, /R\$ 1\.500\/mês/);
  assert.match(prompt, /não repita perguntas já respondidas/);
});

test('mescla memória de dois dispositivos por hash de conversa sem descartar fatos de outro contato', () => {
  const local = { chat_a1: { personaMode: 'networking', updatedAt: now, company: 'Empresa A', primaryNiche: 'Marketing' } };
  const remote = { chat_b2: { personaMode: 'commercial', updatedAt: now, company: 'Clínica B', primaryNiche: 'Saúde', exactRequest: 'Divulgar serviços' }, '+5511999999999': { personaMode: 'commercial', updatedAt: now, company: 'Não deve entrar' } };
  const merged = mergeAiConversationMemoryMaps(local, remote);
  assert.equal(merged.chat_a1.company, 'Empresa A');
  assert.equal(merged.chat_b2.company, 'Clínica B');
  assert.equal(Object.keys(merged).length, 2);
});

test('configuração do Drive mescla memória por conversa mesmo quando os prompts locais são mais recentes', () => {
  const local = { updatedAt: '2026-10-27T15:00:00.000Z', prompt: 'Prompt local novo', conversationMemory: { chat_a1: { personaMode: 'networking', updatedAt: now, company: 'Empresa local', primaryNiche: 'Marketing' } } };
  const remote = { updatedAt: '2026-10-26T15:00:00.000Z', prompt: 'Prompt remoto antigo', conversationMemory: { chat_b2: { personaMode: 'commercial', updatedAt: now, company: 'Clínica remota', primaryNiche: 'Saúde', exactRequest: 'Divulgar serviços' } } };
  const merged = mergeAiConfig(local, remote);
  assert.equal(merged.prompt, 'Prompt local novo');
  assert.equal(merged.conversationMemory.chat_a1.company, 'Empresa local');
  assert.equal(merged.conversationMemory.chat_b2.company, 'Clínica remota');
});
