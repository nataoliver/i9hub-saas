import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CampaignForm } from '../sidepanel/components/CampaignForm.js';
import { leadInternalTags, leadWaLabels } from '../sidepanel/utils/segments.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const lead = (overrides = {}) => ({
  id: 'lead_1', name: 'Clínica Exemplo', phone: '5511999990000', source: 'google_maps',
  stage: 'novo', tags: ['Fisioterapia', 'Interessado em anúncios'], waLabels: ['Cliente VIP'], groups: [],
  ...overrides,
});

test('separa etiquetas nativas do WhatsApp das etiquetas internas do i9Hub/IA', () => {
  const item = lead({ tags: ['Cliente VIP', 'Fisioterapia'], waLabels: ['Cliente VIP'], aiTags: ['Interesse em mídia paga'] });
  assert.deepEqual(leadWaLabels(item), ['Cliente VIP']);
  assert.deepEqual(leadInternalTags(item).sort(), ['Fisioterapia', 'Interesse em mídia paga'].sort());
});

test('a campanha pode selecionar Google Maps como fonte sem exigir outro filtro', () => {
  const form = new CampaignForm({});
  form.mode = 'crm'; form.sourceFilter = 'google_maps';
  form.sel = { stages: new Set(), tags: new Set(), waLabels: new Set(), groups: new Set() };
  form.seg = { leads: [lead(), lead({ id: 'lead_2', phone: '5511888880000', source: 'whatsapp_group' })] };
  form.includeSpam = false;
  const result = form.resolveContacts();
  assert.equal(result.empty, false);
  assert.equal(result.contacts.length, 1);
  assert.equal(result.contacts[0].phone, '5511999990000');
});

test('as etiquetas WhatsApp e i9Hub filtram separadamente os destinatários', () => {
  const form = new CampaignForm({});
  form.mode = 'crm'; form.sourceFilter = 'all';
  form.sel = { stages: new Set(), tags: new Set(['Fisioterapia']), waLabels: new Set(['Cliente VIP']), groups: new Set() };
  form.seg = { leads: [lead(), lead({ id: 'lead_2', phone: '5511888880000', tags: ['Contabilidade'], waLabels: ['Cliente VIP'] })] };
  form.includeSpam = false;
  assert.equal(form.resolveContacts().contacts.length, 1);
  form.sel.tags.clear(); form.sel.waLabels = new Set(['Cliente VIP']);
  assert.equal(form.resolveContacts().contacts.length, 2);
});

test('o formulário descreve ciclos de lote e deixa explícito que a IA atende durante a pausa', () => {
  const html = read('sidepanel/components/CampaignForm.js');
  assert.match(html, /Fonte dos leads/);
  assert.match(html, /Google Maps/);
  assert.match(html, /Participantes de grupos do WhatsApp/);
  assert.match(html, /Etiquetas do WhatsApp Business/);
  assert.match(html, /Etiquetas inteligentes do i9Hub\/IA/);
  assert.match(html, /120 minutos \(2 horas\)/);
  assert.match(html, /Chat com IA continua atendendo/);
});

test('campanha e IA compartilham fila de saída e a campanha aguarda o processamento da IA', () => {
  const injected = read('content/injected.js');
  const worker = read('background/service-worker.js');
  const content = read('content/content.js');
  assert.match(injected, /withOutgoingSendLock/);
  assert.match(injected, /waitForAiIdle/);
  assert.match(injected, /AI_PROCESSING_STATE/);
  assert.match(worker, /aiPendingInboundCount/);
  assert.match(worker, /publishAiProcessingState/);
  assert.match(content, /CAMPAIGN_BATCH_PAUSE_STARTED/);
  assert.match(content, /AI_PROCESSING_STATE/);
});

test('a pausa entre lotes tem início/fim registrados e aparece no painel', () => {
  const injected = read('content/injected.js');
  const worker = read('background/service-worker.js');
  const view = read('sidepanel/components/CampaignsWAView.js');
  assert.match(injected, /CAMPAIGN_BATCH_PAUSE_STARTED/);
  assert.match(injected, /CAMPAIGN_BATCH_PAUSE_ENDED/);
  assert.match(worker, /nextBatchAt/);
  assert.match(view, /Pausa entre lotes · IA ativa/);
  assert.match(view, /Próximo lote/);
});

test('o tempo de resposta é configurável e limitado a uma pausa curta', () => {
  const view = read('sidepanel/components/AIChatView.js');
  const worker = read('background/service-worker.js');
  assert.match(view, /id="ai-chat-reply-delay" type="number" min="0" max="10"/);
  assert.match(view, /replyDelaySeconds:/);
  assert.match(worker, /replyDelaySeconds: Number\.isFinite\(replyDelayRaw\) \? Math\.max\(0, Math\.min\(10, replyDelayRaw\)\) : 1\.5/);
  assert.match(worker, /const replyDelayMs = Math\.round/);
  assert.match(view, /não simula uma pessoa digitando/);
});

test('a versão técnica e comercial da extensão é 1.2.8', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.match(read('content/content.js'), /const CONTENT_VER = '0\.0\.1\.0'/);
  assert.match(read('content/injected.js'), /const EXT_VER = '0\.0\.1\.0'/);
});
