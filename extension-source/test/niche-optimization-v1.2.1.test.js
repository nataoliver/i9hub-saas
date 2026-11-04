import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateNichePerformance, buildPersonaOptimizationRecommendations, buildNicheAnalyticsCsv } from '../lib/niche-optimization.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const report = (campaignId, aiPersonaId, aiPersonaName, metrics) => ({
  campaignId, campaignName: campaignId, aiPersonaId, aiPersonaName,
  metrics: { sent: 10, responseCount: 4, qualifiedCount: 2, hotCount: 1, ...metrics },
  niches: [],
});

test('Fase 4 agrupa métricas por personalidade e agrega campanhas sem perfil no perfil global', () => {
  const summary = aggregateNichePerformance([
    report('c1', 'networking', 'Networking', { sent: 20, responseCount: 12, qualifiedCount: 4, hotCount: 2 }),
    report('c2', 'networking', 'Networking', { sent: 10, responseCount: 6, qualifiedCount: 3, hotCount: 1 }),
    report('c3', '', 'Perfil global', { sent: 10, responseCount: 1, qualifiedCount: 0, hotCount: 0 }),
  ]);
  const networking = summary.personas.find((item) => item.personaId === 'networking');
  const global = summary.personas.find((item) => item.personaName === 'Perfil global');
  assert.equal(networking.campaigns, 2);
  assert.equal(networking.sent, 30);
  assert.equal(networking.responses, 18);
  assert.equal(networking.responseRate, 60);
  assert.equal(networking.qualificationRate, 23.3);
  assert.equal(global.sent, 10);
  assert.equal(summary.totals.sent, 40);
});

test('recomendações por personalidade pedem cautela com amostras pequenas e explicam os sinais', () => {
  const summary = {
    totals: { sent: 40, responseRate: 25, qualificationRate: 10 },
    personas: [
      { personaId: 'networking', personaName: 'Networking', sent: 20, responses: 10, qualified: 4, hot: 2, campaigns: 2, responseRate: 50, qualificationRate: 20, hotRate: 10 },
      { personaId: 'commercial', personaName: 'Comercial', sent: 20, responses: 2, qualified: 0, hot: 0, campaigns: 2, responseRate: 10, qualificationRate: 0, hotRate: 0 },
      { personaId: 'new', personaName: 'Novo perfil', sent: 2, responses: 2, qualified: 0, hot: 0, campaigns: 1, responseRate: 100, qualificationRate: 0, hotRate: 0 },
    ],
  };
  const recommendations = buildPersonaOptimizationRecommendations(summary, { minSample: 5 });
  assert.ok(recommendations.some((item) => item.title.includes('Continue testando Networking')));
  assert.ok(recommendations.some((item) => item.title.includes('Revise a abordagem de Comercial')));
  assert.ok(!recommendations.some((item) => item.personaId === 'new'));
  assert.ok(recommendations.every((item) => item.action && item.message));
});

test('CSV exporta métricas agregadas de nicho e personalidade sem dados pessoais', () => {
  const summary = aggregateNichePerformance([
    { ...report('campanha-1', 'networking', 'Networking', { sent: 10, responseCount: 5, qualifiedCount: 2, hotCount: 1 }), niches: [{ niche: 'Saúde', sent: 10, responses: 5, qualified: 2, hot: 1, subniches: [{ subniche: 'Fisioterapia', sent: 10, responses: 5, qualified: 2, hot: 1 }] }] },
  ]);
  const csv = buildNicheAnalyticsCsv(summary);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /Personalidade IA/);
  assert.match(csv, /Networking/);
  assert.match(csv, /Fisioterapia/);
  assert.match(csv, /Taxa de resposta/);
  assert.doesNotMatch(csv, /telefone|\+55|@/i);
});

test('interface da Fase 4 apresenta comparativo por personalidade, exportação e proteção do público', () => {
  const crm = read('sidepanel/components/CRMView.js');
  assert.match(crm, /Desempenho por personalidade da IA/);
  assert.match(crm, /i9-niche-optimization-export/);
  assert.match(crm, /buildPersonaOptimizationRecommendations/);
  assert.match(crm, /signals\.optedOut/);
  assert.match(crm, /buildNicheAnalyticsCsv/);
});
