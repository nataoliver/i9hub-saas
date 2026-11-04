import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('a IA gera uma ficha comercial estruturada além da resposta de chat', () => {
  const worker = read('background/service-worker.js');
  for (const field of ['exactRequest', 'summary', 'company', 'need', 'service', 'segment', 'intent', 'budgetStatus', 'decisionMaker', 'objection', 'evidence', 'missingFields', 'nextStep']) {
    assert.ok(worker.includes(field), `campo comercial ausente: ${field}`);
  }
  assert.match(worker, /qualification\.status deve ser exatamente um destes valores/);
  assert.match(worker, /applyAiLeadQualification\(\{ \.\.\.payload, chatType, chatName, senderName \}, config, crmDecision, providerResult\)/);
  assert.match(worker, /personaMode !== 'self_knowledge'/);
  assert.match(worker, /const hasStructuredData =/);
});

test('a IA salva a inteligência em leads qualificados, em qualificação e em nutrição', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /lead\.aiIntelligence = intelligence/);
  assert.match(worker, /lead\.aiQualification =/);
  assert.match(worker, /'qualified', 'nurture', 'in_qualification', 'not_qualified'/);
  assert.match(worker, /if \(candidates\.length > 1\) return \{ applied: false, reason: 'ambiguous-lead-match' \}/);
  assert.match(worker, /targetStageValid/);
  assert.match(worker, /previouslyQualified/);
});

test('a planilha de histórico cria uma aba Leads e atualiza a linha pelo ID estável', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /const AI_LEADS_HEADERS =/);
  assert.match(worker, /title: 'Leads'/);
  assert.match(worker, /async function upsertAiLeadSheet/);
  assert.match(worker, /'Leads'!A:A/);
  assert.match(worker, /'Leads'!A\$\{rowNumber\}:AD\$\{rowNumber\}/);
  assert.match(worker, /AI_LEAD_SYNC_QUEUE_KEY/);
  assert.match(worker, /flushAiLeadIntelligenceQueue/);
  assert.match(worker, /await queueAllAiLeadsForSheetSync\(\);/);
});

test('o card do CRM mostra a Inteligência Comercial e o Kanban mostra um resumo', () => {
  const modal = read('sidepanel/components/LeadModal.js');
  const crm = read('sidepanel/components/CRMView.js');
  assert.match(modal, /Inteligência Comercial do Lead/);
  assert.match(modal, /Pedido exato/);
  assert.match(modal, /Empresa\/organização/);
  assert.match(modal, /Evidências da conversa/);
  assert.match(crm, /aiStatusBadgeHTML/);
  assert.match(crm, /aiStatusTagHTML/);
  assert.match(crm, /aiIntelligencePreviewHTML/);
  assert.match(crm, /lead\.aiIntelligence\?\.exactRequest/);
});
