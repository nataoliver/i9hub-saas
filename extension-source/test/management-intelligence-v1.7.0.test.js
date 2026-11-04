import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManagementIntelligence, buildManagementIntelligencePrompt } from '../lib/management-intelligence.js';
import { ACTION_FEATURE_MAP, ACTION_REQUIRED_FEATURES, FEATURE_CATALOG, FEATURE_CATALOG_VERSION, getFeatureAccess } from '../lib/feature-catalog.js';
import { evaluateActionAuthorization, isReadOnlyAction } from '../lib/license-policy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const now = Date.UTC(2026, 9, 30, 12);
const stages = [
  { id: 'novo', title: 'Novo' }, { id: 'qualificado', title: 'Qualificado' },
  { id: 'proposta', title: 'Proposta' }, { id: 'fechado', title: 'Fechado' },
  { id: 'perdido', title: 'Perdido' },
];
const managementReport = {
  generatedAt: '2026-10-30T12:00:00.000Z',
  period: { month: '2026-10', label: '10/2026', elapsedPercent: 95, isFuture: false, isPast: false },
  metrics: { revenue: 50000, salesClosed: 5, salesWithoutSeller: 1, salesWithoutCommissionRule: 2 },
  goalRows: [
    { targetType: 'seller', targetName: 'Vendedor Alfa', status: 'at_risk', attainmentPercent: 40, revenueTarget: 50000, actualRevenue: 20000, actualSales: 2, salesTarget: 5, assignedLeads: 6, leadsTarget: 10 },
    { targetType: 'team', targetName: 'Equipe Norte', status: 'attention', attainmentPercent: 70, revenueTarget: 100000, actualRevenue: 70000, actualSales: 7, salesTarget: 10, assignedLeads: 20, leadsTarget: 30 },
  ],
  rankingRows: [{ sellerName: 'Vendedor Alfa', teamName: 'Equipe Norte', revenue: 20000, salesClosed: 2, revenueTarget: 50000, revenueAttainment: 40, commissionPending: 1000 }],
  teamRows: [{ teamName: 'Equipe Norte', revenue: 20000, salesClosed: 2, revenueTarget: 50000, revenueAttainment: 40 }],
  productRows: [{ productName: 'Consultoria Premium', salesClosed: 2, revenue: 20000, commissionTotal: 1000 }],
};
const leads = [
  { id: 'stale-1', name: 'Lead Cliente Privado', phone: '+5511999999999', stage: 'proposta', stageUpdatedAt: '2026-10-01T12:00:00Z', createdAt: '2026-09-20T12:00:00Z', commercialOwner: 'Vendedor Alfa', dealValue: 12000, aiNicheClassification: { path: ['Serviços', 'Contabilidade'] } },
  { id: 'stale-2', name: 'Lead Cliente B', stage: 'qualificado', createdAt: '2026-10-01T12:00:00Z', dealValue: 5000, aiIntelligence: { segment: 'Advocacia' } },
  { id: 'closed-1', name: 'Cliente Fechado', stage: 'fechado', stageUpdatedAt: '2026-10-20T12:00:00Z', saleValue: 20000, createdAt: '2026-10-01T12:00:00Z', activityLog: [{ type: 'lead.stage_changed', createdAt: '2026-10-20T12:00:00Z', metadata: { from: 'proposta', to: 'fechado' } }], aiQualification: { segment: 'Contabilidade' } },
  { id: 'lost-1', name: 'Cliente Perdido', stage: 'perdido', createdAt: '2026-09-01T12:00:00Z', dealValue: 9000 },
  { id: 'excluded-1', name: 'Blacklisted', stage: 'blacklist', createdAt: '2026-09-01T12:00:00Z', dealValue: 5000 },
];

test('Fase 11 adiciona inteligência gerencial ao catálogo v12 com compatibilidade da Fase 09/10', () => {
  assert.equal(FEATURE_CATALOG_VERSION, 14);
  assert.equal(FEATURE_CATALOG.length, 91);
  assert.equal(FEATURE_CATALOG.filter((feature) => feature.implemented === true).length, 89);
  const feature = FEATURE_CATALOG.find((item) => item.id === 'dashboard.management_intelligence');
  assert.equal(feature?.implemented, true);
  assert.equal(feature?.phase, 11);
  assert.ok(feature.requires.includes('dashboard.commercial_performance'));
  assert.equal(ACTION_FEATURE_MAP.DASHBOARD_GET_MANAGEMENT_INTELLIGENCE, 'dashboard.management_intelligence');
  assert.equal(ACTION_FEATURE_MAP.DASHBOARD_GENERATE_MANAGEMENT_INSIGHTS, 'dashboard.management_intelligence');
  assert.ok(ACTION_REQUIRED_FEATURES.DASHBOARD_GET_MANAGEMENT_INTELLIGENCE.includes('crm.leads'));
  assert.equal(getFeatureAccess(['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'], 'dashboard.management_intelligence').allowed, true);
  assert.ok(ACTION_REQUIRED_FEATURES.DASHBOARD_GENERATE_MANAGEMENT_INSIGHTS.includes('crm.kanban'));
  assert.equal(getFeatureAccess(['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'], 'dashboard.commercial_performance').allowed, true);
  assert.equal(getFeatureAccess(['dashboard.management_intelligence', 'dashboard.commercial_performance', 'crm.leads', 'crm.kanban'], 'dashboard.management_intelligence').allowed, true);
  const legacyAuthorization = evaluateActionAuthorization({
    type: 'DASHBOARD_GET_MANAGEMENT_INTELLIGENCE',
    state: { licensed: true, payload: { ent: ['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'] } },
  });
  assert.equal(legacyAuthorization.allowed, true);
  assert.equal(isReadOnlyAction('DASHBOARD_GET_MANAGEMENT_INTELLIGENCE'), true);
  assert.equal(isReadOnlyAction('DASHBOARD_GENERATE_MANAGEMENT_INSIGHTS'), false);
});

test('inteligência calcula projeção linear, metas em risco e oportunidades paradas', () => {
  const report = buildManagementIntelligence({ leads, managementReport, stages, month: '2026-10', now });
  assert.equal(report.period.month, '2026-10');
  assert.equal(report.forecast.actualRevenue, 50000);
  assert.equal(report.forecast.revenueTarget, 50000); // prefere metas individuais para evitar duplicidade com a meta da equipe
  assert.equal(report.forecast.projectedRevenue, 52631.58);
  assert.equal(report.forecast.goalAttainment, 100);
  assert.equal(report.metrics.stalledOpportunities, 2);
  assert.equal(report.metrics.openOpportunities, 2);
  assert.equal(report.metrics.goalsAtRisk, 2);
  assert.equal(report.stalledRows[0].id, 'stale-1');
  assert.equal(report.stalledRows[0].ageDays, 29);
  assert.equal(report.stalledRows[1].ageSource, 'lead_created');
  assert.equal(report.segmentRows.find((row) => row.segment === 'Serviços > Contabilidade').openOpportunities, 1);
  assert.equal(report.segmentRows.find((row) => row.segment === 'Contabilidade').revenue, 20000);
  assert.equal(report.dataQuality.stalledWithoutStageHistory, 1);
  assert.ok(report.recommendations.some((item) => item.title === 'Retomar oportunidades paradas'));
  assert.ok(report.recommendations.some((item) => item.title === 'Plano de recuperação de metas'));
});

test('contagem de oportunidades paradas não é limitada pelo tamanho da tabela exibida', () => {
  const manyLeads = Array.from({ length: 35 }, (_, index) => ({
    id: `stale-${index}`, name: `Lead ${index}`, stage: 'proposta',
    stageUpdatedAt: '2026-09-01T12:00:00Z', createdAt: '2026-09-01T12:00:00Z',
  }));
  const report = buildManagementIntelligence({ leads: manyLeads, managementReport, stages, month: '2026-10', now });
  assert.equal(report.metrics.stalledOpportunities, 35);
  assert.equal(report.stalledRows.length, 30);
});

test('inteligência não inventa previsão no início do mês e identifica dados ausentes', () => {
  const earlyReport = { ...managementReport, period: { ...managementReport.period, elapsedPercent: 4 }, goalRows: [] };
  const report = buildManagementIntelligence({ leads: [], managementReport: earlyReport, stages, month: '2026-10', now: Date.UTC(2026, 9, 2) });
  assert.equal(report.forecast.projectedRevenue, null);
  assert.equal(report.forecast.method, 'dados insuficientes para ritmo linear');
  assert.ok(report.recommendations.some((item) => item.title === 'Cadastrar metas mensais'));
});

test('prompt da IA envia somente indicadores agregados e exige separar fatos de hipóteses', () => {
  const report = buildManagementIntelligence({ leads, managementReport, stages, month: '2026-10', now });
  const prompt = buildManagementIntelligencePrompt(report.aiContext);
  assert.match(prompt, /Não identifique pessoas/);
  assert.match(prompt, /Diferencie fato observado de hipótese/);
  assert.doesNotMatch(prompt, /Lead Cliente Privado/);
  assert.doesNotMatch(prompt, /\+5511999999999/);
  assert.doesNotMatch(prompt, /Vendedor Alfa/);
  assert.match(prompt, /Vendedor 1/);
});

test('service worker protege ações de inteligência e usa provedor configurado sem incluir dados pessoais', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /async DASHBOARD_GET_MANAGEMENT_INTELLIGENCE/);
  assert.match(worker, /async DASHBOARD_GENERATE_MANAGEMENT_INSIGHTS/);
  assert.match(worker, /callAiProviderWithFallback/);
  assert.match(worker, /buildManagementIntelligencePrompt\(report\.aiContext\)/);
  assert.match(worker, /managementIntelligenceLastAiRun/);
  const api = read('sidepanel/utils/api.js');
  assert.match(api, /getManagementIntelligence/);
  assert.match(api, /generateManagementInsights/);
  const dashboard = read('sidepanel/components/DashboardView.js');
  assert.match(dashboard, /Inteligência gerencial/);
  assert.match(dashboard, /Oportunidades paradas/);
  assert.match(dashboard, /Gerar análise com IA/);
  assert.match(dashboard, /textContent = response\.data\?\.text/);
});

test('Fase 11 permanece compatível na release 1.0.0 e mantém a interface responsiva', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.equal(pkg.version, '1.0.0');
  assert.match(read('content/content.js'), /0\.0\.1\.0/);
  assert.match(read('content/injected.js'), /0\.0\.1\.0/);
  assert.match(read('sidepanel/sidepanel.css'), /i9-intelligence-grid/);
  assert.match(read('sidepanel/sidepanel.css'), /@media \(max-width:560px\)/);
});
