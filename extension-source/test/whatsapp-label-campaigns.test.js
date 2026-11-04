import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterLeadsMulti, hasSegmentCriteria } from '../sidepanel/utils/segments.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('uma etiqueta sozinha filtra contatos sem exigir um estágio do funil', () => {
  const leads = [
    { id: '1', phone: '5511999990001', stage: 'novo', tags: ['Clientes VIP'] },
    { id: '2', phone: '5511999990002', stage: 'qualificado', tags: ['Clientes VIP', 'Imóveis'] },
    { id: '3', phone: '5511999990003', stage: 'contatado', tags: ['Imóveis'] },
  ];
  const criteria = { stages: new Set(), tags: new Set(['Clientes VIP']), groups: new Set() };
  assert.equal(hasSegmentCriteria(criteria), true);
  assert.deepEqual(filterLeadsMulti(leads, criteria).map((lead) => lead.id), ['1', '2']);
});

test('sem estágio, etiqueta ou grupo não há seleção automática de todos os contatos', () => {
  assert.equal(hasSegmentCriteria({ stages: new Set(), tags: new Set(), groups: new Set() }), false);
  const form = read('sidepanel/components/CampaignForm.js');
  assert.match(form, /if \(!this\.hasAudienceCriteria\(\)\) return \{ contacts: \[\], dupes: 0, spamExcluded: 0, empty: true \}/);
});

test('listas de campanha são salvas localmente e reutilizam filtros de estágio, etiqueta e grupo', () => {
  const form = read('sidepanel/components/CampaignForm.js');
  assert.match(form, /i9hubCampaignListsV1/);
  assert.match(form, /async saveCurrentList\(\)/);
  assert.match(form, /applySavedList\(\)/);
  assert.match(form, /sourceFilter: this\.sourceFilter \|\| "all", stages: \[\.\.\.this\.sel\.stages\], tags: \[\.\.\.this\.sel\.tags\], waLabels: \[\.\.\.this\.sel\.waLabels\], groups: \[\.\.\.this\.sel\.groups\]/);
  assert.match(form, /id=\"campaign-list-name\"/);
  assert.match(form, /Salvar filtros/);
});

test('sincronização de etiquetas mantém etiquetas como tags e não as converte em estágios comerciais', () => {
  const worker = read('background/service-worker.js');
  const start = worker.indexOf('async WA_LABELS_SYNC(p) {');
  const end = worker.indexOf('// ---- WhatsApp: chats / grupos', start);
  assert.ok(start >= 0 && end > start);
  const sync = worker.slice(start, end);
  assert.match(sync, /tags: \[\.\.\.new Set\(names\)\]/);
  assert.match(sync, /stage: 'novo'/);
  assert.match(sync, /legacyStagesCleaned/);
  assert.doesNotMatch(sync, /stagesCreated|stageOfLabel\.get/);
});

test('botão de etiquetas chama a sincronização protegida pelo catálogo', () => {
  const crm = read('sidepanel/components/CRMView.js');
  const catalog = read('lib/feature-catalog.js');
  assert.match(crm, /id="btn-sync-labels" data-feature="whatsapp\.labels_sync"/);
  assert.match(crm, /this\.app\.api\.syncLabels\(\{ createLeads: true \}\)/);
  assert.match(catalog, /WA_LABELS_SYNC: 'whatsapp\.labels_sync'/);
});

test('manifesto e pontes do WhatsApp usam a versão comercial 1.2.8', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.match(read('content/content.js'), /const CONTENT_VER = '0\.0\.1\.0'/);
  assert.match(read('content/injected.js'), /const EXT_VER = '0\.0\.1\.0'/);
});
