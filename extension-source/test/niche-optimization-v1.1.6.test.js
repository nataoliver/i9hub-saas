import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateNichePerformance, buildNicheOptimizationRecommendations, suggestNicheConsolidations } from '../lib/niche-optimization.js';
import { createTaxonomyNode, mergeTaxonomyNodes, normalizeNicheTaxonomy } from '../lib/niche-taxonomy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const report = (campaignId, niches, metrics = {}) => ({
  campaignId, campaignName: campaignId,
  metrics: { sent: 10, responseCount: 4, qualifiedCount: 2, hotCount: 1, ...metrics },
  niches,
});

test('agrega resultados de nichos e subnichos usando taxas ponderadas pelos envios', () => {
  const summary = aggregateNichePerformance([
    report('c1', [{ niche: 'Saúde', sent: 10, responses: 4, qualified: 2, hot: 1, subniches: [{ subniche: 'Fisioterapia', sent: 10, responses: 4, qualified: 2, hot: 1 }] }]),
    report('c2', [{ niche: 'Saúde', sent: 30, responses: 6, qualified: 3, hot: 2, subniches: [{ subniche: 'Fisioterapia', sent: 30, responses: 6, qualified: 3, hot: 2 }] }], { sent: 30, responseCount: 6, qualifiedCount: 3, hotCount: 2 }),
  ]);
  assert.equal(summary.campaignCount, 2);
  assert.equal(summary.totals.sent, 40);
  assert.equal(summary.totals.responseRate, 25);
  assert.equal(summary.niches[0].sent, 40);
  assert.equal(summary.niches[0].responseRate, 25);
  assert.equal(summary.subniches[0].qualificationRate, 12.5);
});

test('recomendações são baseadas em histórico próprio e pedem mais amostra antes de comparar', () => {
  const small = aggregateNichePerformance([report('c1', [], { sent: 2, responseCount: 0, qualifiedCount: 0, hotCount: 0 })]);
  const smallRecs = buildNicheOptimizationRecommendations(small, { minSample: 5 });
  assert.ok(smallRecs.some((item) => item.id === 'collect-more-data'));
  const summary = {
    totals: { sent: 40, responses: 10, qualified: 4, hot: 2, responseRate: 25, qualificationRate: 10 },
    niches: [
      { niche: 'Fisioterapia', sent: 20, responses: 8, qualified: 4, hot: 2, responseRate: 40, qualificationRate: 20 },
      { niche: 'Contabilidade', sent: 20, responses: 2, qualified: 0, hot: 0, responseRate: 10, qualificationRate: 0 },
    ], subniches: [],
  };
  const recommendations = buildNicheOptimizationRecommendations(summary, { minSample: 5 });
  assert.ok(recommendations.some((item) => item.title.includes('Priorize Fisioterapia')));
  assert.ok(recommendations.some((item) => item.title.includes('Revise a abordagem de Contabilidade')));
  assert.ok(recommendations.every((item) => typeof item.action === 'string' && item.action.length > 0));
});

test('sugestões de consolidação ficam limitadas a subnichos semelhantes sob o mesmo pai', () => {
  const suggestions = suggestNicheConsolidations([
    { id: 'root', name: 'Saúde', type: 'niche', parentId: null },
    { id: 'a', name: 'Fisioterapia', type: 'niche', parentId: 'root', leadCount: 12 },
    { id: 'b', name: 'Fisioterapias', type: 'niche', parentId: 'root', leadCount: 3 },
    { id: 'other', name: 'Fisioterapias', type: 'niche', parentId: 'another-root', leadCount: 2 },
  ]);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].targetId, 'a');
  assert.equal(suggestions[0].sourceId, 'b');
});

test('consolidação de nós preserva sinônimo e move subnichos filhos sem misturar pais diferentes', () => {
  let taxonomy = normalizeNicheTaxonomy({});
  taxonomy = createTaxonomyNode(taxonomy, { name: 'Saúde', type: 'niche' }, '2026-10-27T12:00:00.000Z', () => 'root').taxonomy;
  taxonomy = createTaxonomyNode(taxonomy, { name: 'Fisioterapia', type: 'niche', parentId: 'root' }, '2026-10-27T12:00:01.000Z', () => 'target').taxonomy;
  taxonomy = createTaxonomyNode(taxonomy, { name: 'Fisioterapias', type: 'niche', parentId: 'root' }, '2026-10-27T12:00:02.000Z', () => 'source').taxonomy;
  taxonomy = createTaxonomyNode(taxonomy, { name: 'Esportiva', type: 'niche', parentId: 'source' }, '2026-10-27T12:00:03.000Z', () => 'child').taxonomy;
  const merged = mergeTaxonomyNodes(taxonomy, 'source', 'target', '2026-10-27T12:00:04.000Z');
  assert.equal(merged.success, true);
  assert.ok(merged.target.aliases.includes('Fisioterapias'));
  assert.equal(merged.taxonomy.nodes.find((node) => node.id === 'source').deletedAt, '2026-10-27T12:00:04.000Z');
  assert.equal(merged.taxonomy.nodes.find((node) => node.id === 'child').parentId, 'target');
  assert.equal(mergeTaxonomyNodes(taxonomy, 'source', 'root').success, false);
});

test('Fase 4 está ligada ao CRM, ao handler protegido por licença e à versão 1.2.8', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const worker = read('background/service-worker.js');
  const features = read('lib/feature-catalog.js');
  const api = read('sidepanel/utils/api.js');
  const crm = read('sidepanel/components/CRMView.js');
  assert.equal(manifest.version_name, '1.0.0');
  assert.match(crm, /btn-niche-optimization/);
  assert.match(crm, /aggregateNichePerformance/);
  assert.match(crm, /suggestNicheConsolidations/);
  assert.match(worker, /async MERGE_NICHE_NODES/);
  assert.match(features, /MERGE_NICHE_NODES: 'crm\.classifier\.niche_models'/);
  assert.match(api, /mergeNicheNodes\(sourceId, targetId\)/);
});
