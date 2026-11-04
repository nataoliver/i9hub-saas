import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCrmStageConfig, buildCrmStageList, makeStageId, mergeCrmStageConfig } from '../lib/crm-stage-config.js';
import { applyAiNicheClassification, createTaxonomyNode, deleteTaxonomyNode, mergeNicheTaxonomies, normalizeNicheTaxonomy, updateTaxonomyNode } from '../lib/niche-taxonomy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('o funil aceita etapas personalizadas, renomeia etapas padrão e preserva IDs do sistema', () => {
  const config = normalizeCrmStageConfig({ overrides: { qualificado: { title: 'Lead qualificado', color: '#123456' } }, custom: [{ id: 'crm_reuniao_123', title: 'Reunião marcada', color: '#abcdef', order: 0 }] }, '2026-10-27T12:00:00.000Z');
  const stages = buildCrmStageList(undefined, [], config);
  assert.equal(stages.find((stage) => stage.id === 'qualificado').title, 'Lead qualificado');
  assert.equal(stages.find((stage) => stage.id === 'qualificado').isSystem, true);
  assert.equal(stages.find((stage) => stage.id === 'crm_reuniao_123').isCustom, true);
  assert.equal(stages.find((stage) => stage.id === 'crm_reuniao_123').title, 'Reunião marcada');
  assert.match(makeStageId('Aguardando documentos', 'abc12'), /^crm_aguardando_documentos_abc12$/);
});

test('configuração do funil mescla etapas criadas em dispositivos diferentes e respeita exclusões', () => {
  const local = { updatedAt: '2026-10-27T10:00:00.000Z', custom: [{ id: 'crm_local_1', title: 'Retorno', order: 0 }] };
  const remote = { updatedAt: '2026-10-27T11:00:00.000Z', custom: [{ id: 'crm_remote_2', title: 'Diagnóstico', order: 0 }] };
  const merged = mergeCrmStageConfig(local, remote);
  assert.deepEqual(merged.custom.map((stage) => stage.id).sort(), ['crm_local_1', 'crm_remote_2']);
  const restored = mergeCrmStageConfig({}, { updatedAt: '2026-10-27T09:00:00.000Z', custom: [{ id: 'crm_drive_3', title: 'Aguardando retorno', order: 0 }] });
  assert.equal(restored.custom.some((stage) => stage.id === 'crm_drive_3'), true);
  const deleted = mergeCrmStageConfig({ ...merged, updatedAt: '2026-10-27T12:00:00.000Z', custom: [{ id: 'crm_remote_2', title: 'Diagnóstico', order: 0 }], deletedCustomIds: ['crm_local_1'] }, local);
  assert.equal(deleted.custom.some((stage) => stage.id === 'crm_local_1'), false);
});

test('estágios legados permanecem disponíveis para não quebrar leads existentes', () => {
  const stages = buildCrmStageList(undefined, [{ id: 'wl_abc', title: 'Etiqueta antiga', source: 'whatsapp_label' }, { id: 'bp_pipeline', title: 'Etapa do perfil' }], {});
  assert.equal(stages.some((stage) => stage.id === 'wl_abc'), true);
  assert.equal(stages.some((stage) => stage.id === 'bp_pipeline'), true);
});

test('a taxonomia cria nichos hierárquicos e etiquetas livres sem duplicar irmãos equivalentes', () => {
  let taxonomy = normalizeNicheTaxonomy({});
  let result = createTaxonomyNode(taxonomy, { name: 'Saúde', type: 'niche', source: 'ai' }, '2026-10-27T12:00:00.000Z', () => 'niche_saude');
  taxonomy = result.taxonomy;
  result = createTaxonomyNode(taxonomy, { name: 'Fisioterapia', type: 'niche', parentId: 'niche_saude', source: 'ai' }, '2026-10-27T12:00:01.000Z', () => 'niche_fisio');
  taxonomy = result.taxonomy;
  const duplicate = createTaxonomyNode(taxonomy, { name: ' FISIOTERAPIA ', type: 'niche', parentId: 'niche_saude', source: 'ai' }, '2026-10-27T12:00:02.000Z', () => 'should_not_be_used');
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.node.id, 'niche_fisio');
  const tag = createTaxonomyNode(taxonomy, { name: 'Captação de pacientes', type: 'tag', source: 'ai' }, '2026-10-27T12:00:03.000Z', () => 'tag_captacao');
  assert.equal(tag.node.type, 'tag');
  assert.equal(tag.node.parentId, null);
});

test('a IA só classifica com evidência e confiança mínima; uma conversa pode acumular mais de um nicho', () => {
  const lead = { id: 'lead_1', tags: [] };
  const rejected = applyAiNicheClassification({}, lead, { path: ['Saúde', 'Fisioterapia'], tags: ['Clínica'], confidence: 0.4, evidence: ['Sou fisioterapeuta'] }, '2026-10-27T12:00:00.000Z');
  assert.equal(rejected.applied, false);
  const first = applyAiNicheClassification({}, lead, { path: ['Saúde', 'Fisioterapia'], tags: ['Clínica própria'], confidence: 0.91, evidence: ['Tenho uma clínica de fisioterapia'] }, '2026-10-27T12:00:01.000Z');
  assert.equal(first.applied, true);
  assert.deepEqual(first.lead.aiNicheClassification.path, ['Saúde', 'Fisioterapia']);
  assert.deepEqual(first.lead.aiTags, ['Clínica própria']);
  const second = applyAiNicheClassification(first.taxonomy, first.lead, { path: ['Marketing', 'Gestão de tráfego'], tags: ['Captação de clientes'], confidence: 0.86, evidence: ['Também gerencio anúncios para clientes'] }, '2026-10-27T12:00:02.000Z');
  assert.equal(second.lead.aiNicheClassifications.length, 2);
  assert.deepEqual(second.lead.aiNicheClassification.path, ['Marketing', 'Gestão de tráfego']);
  assert.deepEqual(second.lead.aiTags.sort(), ['Captação de clientes', 'Clínica própria'].sort());
});

test('a IA também pode adicionar etiquetas livres quando ainda não identificou um nicho', () => {
  const result = applyAiNicheClassification({}, { id: 'lead_tag_only' }, { tags: ['Interesse em anúncios', 'Empresa local'], confidence: 0.88, evidence: ['Quero atrair clientes para minha empresa local'] }, '2026-10-27T12:00:00.000Z');
  assert.equal(result.applied, true);
  assert.equal(result.lead.aiNicheClassification, undefined);
  assert.deepEqual(result.lead.aiTags.sort(), ['Empresa local', 'Interesse em anúncios'].sort());
  assert.equal(result.taxonomy.nodes.filter((node) => node.type === 'tag').length, 2);
});

test('renomear e remover um nó preserva a integridade e impede excluir nichos com filhos', () => {
  let taxonomy = {};
  taxonomy = createTaxonomyNode(taxonomy, { name: 'Saúde', type: 'niche' }, '2026-10-27T12:00:00.000Z', () => 'niche_saude').taxonomy;
  taxonomy = createTaxonomyNode(taxonomy, { name: 'Fisioterapia', type: 'niche', parentId: 'niche_saude' }, '2026-10-27T12:00:01.000Z', () => 'niche_fisio').taxonomy;
  const blocked = deleteTaxonomyNode(taxonomy, 'niche_saude', '2026-10-27T12:00:02.000Z');
  assert.equal(blocked.success, false);
  assert.equal(blocked.code, 'HAS_CHILDREN');
  const renamed = updateTaxonomyNode(taxonomy, 'niche_fisio', { name: 'Fisioterapia esportiva', parentId: 'niche_saude' }, '2026-10-27T12:00:03.000Z');
  assert.equal(renamed.node.name, 'Fisioterapia esportiva');
  const deleted = deleteTaxonomyNode(renamed.taxonomy, 'niche_fisio', '2026-10-27T12:00:04.000Z');
  assert.equal(deleted.success, true);
  assert.ok(deleted.node.deletedAt);
});

test('a taxonomia mescla nós entre dispositivos sem ressuscitar uma versão mais antiga', () => {
  const local = { nodes: [{ id: 'tag_1', name: 'Clínica', type: 'tag', updatedAt: '2026-10-27T10:00:00.000Z', createdAt: '2026-10-27T09:00:00.000Z' }] };
  const remote = { nodes: [{ id: 'tag_1', name: 'Clínica própria', type: 'tag', updatedAt: '2026-10-27T11:00:00.000Z', createdAt: '2026-10-27T09:00:00.000Z' }, { id: 'niche_1', name: 'Saúde', type: 'niche', updatedAt: '2026-10-27T11:00:00.000Z' }] };
  const merged = mergeNicheTaxonomies(local, remote, '2026-10-27T12:00:00.000Z');
  assert.equal(merged.nodes.find((node) => node.id === 'tag_1').name, 'Clínica própria');
  assert.equal(merged.nodes.some((node) => node.id === 'niche_1'), true);
});

test('a próxima versão integra taxonomia, etapas configuráveis e backup do Drive', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const worker = read('background/service-worker.js');
  const drive = read('background/drive-sync.js');
  const crm = read('sidepanel/components/CRMView.js');
  assert.equal(manifest.version_name, '1.0.0');
  assert.match(worker, /SAVE_CRM_STAGE_CONFIG/);
  assert.match(worker, /DELETE_CRM_STAGE/);
  assert.match(worker, /GET_NICHE_TAXONOMY/);
  assert.match(worker, /applyAiNicheClassification/);
  assert.match(worker, /qualification\.nicheClassification/);
  assert.match(drive, /CRM_STAGE_CONFIG_KEY/);
  assert.match(drive, /CRM_NICHE_TAXONOMY_KEY/);
  assert.match(crm, /Gerenciar etapas do CRM/);
  assert.match(crm, /Inteligência de nichos e etiquetas/);
});
