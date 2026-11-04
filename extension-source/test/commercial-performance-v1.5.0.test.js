import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCommercialPerformanceReport, commercialStageCategory } from '../lib/commercial-performance.js';
import { ACTION_FEATURE_MAP, ACTION_REQUIRED_FEATURES, FEATURE_CATALOG, FEATURE_CATALOG_VERSION, getFeatureAccess } from '../lib/feature-catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const stages = [
  { id: 'novo', title: 'Novo' },
  { id: 'contatado', title: 'Contatado' },
  { id: 'qualificado', title: 'Qualificado' },
  { id: 'proposta', title: 'Proposta' },
  { id: 'fechado', title: 'Fechado' },
  { id: 'perdido', title: 'Perdido' },
];

test('Fase 09 registra performance comercial no catálogo v10 com dependências de CRM', () => {
  assert.equal(FEATURE_CATALOG_VERSION, 14);
  assert.equal(FEATURE_CATALOG.length, 91);
  assert.equal(FEATURE_CATALOG.filter((feature) => feature.implemented === true).length, 89);
  assert.equal(FEATURE_CATALOG.find((feature) => feature.id === 'dashboard.commercial_performance')?.implemented, true);
  assert.equal(ACTION_FEATURE_MAP.DASHBOARD_GET_COMMERCIAL_PERFORMANCE, 'dashboard.commercial_performance');
  assert.equal(ACTION_FEATURE_MAP.SALES_ANALYTICS_SAVE_CONFIG, 'dashboard.commercial_performance');
  assert.equal(ACTION_FEATURE_MAP.UPDATE_LEAD_COMMERCIAL_FIELDS, 'crm.leads');
  assert.ok(ACTION_REQUIRED_FEATURES.DASHBOARD_GET_COMMERCIAL_PERFORMANCE.includes('crm.kanban'));
  assert.equal(getFeatureAccess(['dashboard.commercial_performance'], 'dashboard.commercial_performance').allowed, false);
  assert.equal(getFeatureAccess(['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'], 'dashboard.commercial_performance').allowed, true);
});

test('relatório calcula coorte de conversão, receita registrada, tempo de fechamento e comparecimento', () => {
  const now = Date.UTC(2026, 9, 30, 12, 0, 0);
  const leads = [
    {
      id: 'l1', name: 'Ana', createdAt: '2026-10-01T10:00:00.000Z', stage: 'fechado',
      stageUpdatedAt: '2026-10-20T10:00:00.000Z', dealValue: 10000, saleValue: 9000,
      commercialOwner: 'Ana', commercialOwnerHistory: [{ owner: 'Ana', assignedAt: '2026-10-02T10:00:00.000Z', unassignedAt: null }],
      activityLog: [{ id: 's1', type: 'lead.stage_changed', createdAt: '2026-10-20T10:00:00.000Z', metadata: { from: 'proposta', to: 'fechado' } }],
      calendarEvents: [{ eventId: 'm1', status: 'confirmed', outcome: 'completed', start: '2026-10-15T10:00:00Z', end: '2026-10-15T10:30:00Z', outcomeAt: '2026-10-15T10:35:00Z' }],
    },
    {
      id: 'l2', name: 'Bia 1', createdAt: '2026-10-05T10:00:00.000Z', stage: 'proposta',
      stageUpdatedAt: '2026-10-10T10:00:00.000Z', dealValue: 5000,
      commercialOwner: 'Bia', commercialOwnerHistory: [{ owner: 'Bia', assignedAt: '2026-10-06T10:00:00.000Z', unassignedAt: null }],
      activityLog: [],
    },
    {
      id: 'l3', name: 'Sem responsável', createdAt: '2026-10-07T10:00:00.000Z', stage: 'contatado',
      activityLog: [],
    },
    {
      id: 'l4', name: 'Ganho sem data', createdAt: '2026-10-01T10:00:00.000Z', stage: 'fechado',
      saleValue: null, activityLog: [],
    },
    {
      id: 'l5', name: 'Bia 2', createdAt: '2026-10-02T10:00:00.000Z', stage: 'qualificado',
      stageUpdatedAt: '2026-10-12T10:00:00.000Z', dealValue: 2000,
      commercialOwner: 'Bia', commercialOwnerHistory: [{ owner: 'Bia', assignedAt: '2026-10-03T10:00:00.000Z', unassignedAt: null }],
      calendarEvents: [
        { eventId: 'm2', status: 'confirmed', outcome: 'no_show', start: '2026-10-12T10:00:00Z', end: '2026-10-12T10:30:00Z', outcomeAt: '2026-10-12T10:35:00Z' },
        { eventId: 'm3', status: 'cancelled', outcome: 'no_show', start: '2026-10-13T10:00:00Z', end: '2026-10-13T10:30:00Z', outcomeAt: '2026-10-13T10:35:00Z' },
      ],
    },
  ];
  const report = buildCommercialPerformanceReport({ leads, stages, rangeDays: 30, now });
  assert.equal(report.metrics.leadsCreated, 5);
  assert.equal(report.metrics.cohortConverted, 2);
  assert.equal(report.metrics.cohortConversionRate, 40);
  assert.equal(report.metrics.salesClosed, 1);
  assert.equal(report.metrics.salesRevenue, 9000);
  assert.equal(report.metrics.salesWithoutValue, 0);
  assert.equal(report.metrics.averageClosingDays, 19);
  assert.equal(report.metrics.completedMeetings, 1);
  assert.equal(report.metrics.noShowMeetings, 1);
  assert.equal(report.metrics.attendanceRate, 50);
  assert.equal(report.metrics.openOpportunities, 3);
  assert.equal(report.metrics.pipelineValue, 7000);
  assert.equal(report.metrics.weightedForecast, 3700);
  assert.equal(report.metrics.opportunitiesWithoutValue, 1);
  assert.equal(report.metrics.closedWonWithoutDate, 1);
  assert.equal(report.metrics.unassignedCreatedLeads, 2);
  const ana = report.sellerRows.find((row) => row.seller === 'Ana');
  const bia = report.sellerRows.find((row) => row.seller === 'Bia');
  assert.equal(ana.leadsAssigned, 1);
  assert.equal(ana.cohortWon, 1);
  assert.equal(ana.cohortConversionRate, 100);
  assert.equal(ana.salesClosed, 1);
  assert.equal(ana.recordedRevenue, 9000);
  assert.equal(ana.attendanceRate, 100);
  assert.equal(bia.leadsAssigned, 2);
  assert.equal(bia.cohortWon, 0);
  assert.equal(bia.attendanceRate, 0);
  assert.equal(report.stageRows.find((row) => row.id === 'proposta').weightedForecast, 3000);
});

test('relatório respeita histórico de transferência de responsável e não atribui venda ao vendedor errado', () => {
  const now = Date.UTC(2026, 9, 30, 12);
  const lead = {
    id: 'handoff', createdAt: '2026-09-20T10:00:00Z', stage: 'fechado',
    stageUpdatedAt: '2026-10-20T10:00:00Z', saleValue: 2500, dealValue: 2500,
    commercialOwner: 'Bia',
    commercialOwnerHistory: [
      { owner: 'Ana', assignedAt: '2026-10-01T10:00:00Z', unassignedAt: '2026-10-10T10:00:00Z' },
      { owner: 'Bia', assignedAt: '2026-10-10T10:00:00Z', unassignedAt: null },
    ],
    activityLog: [{ id: 'won', type: 'lead.stage_changed', createdAt: '2026-10-20T10:00:00Z', metadata: { from: 'proposta', to: 'fechado' } }],
  };
  const report = buildCommercialPerformanceReport({ leads: [lead], stages, rangeDays: 30, now });
  const ana = report.sellerRows.find((row) => row.seller === 'Ana');
  const bia = report.sellerRows.find((row) => row.seller === 'Bia');
  assert.equal(ana.leadsAssigned, 1);
  assert.equal(ana.cohortWon, 0);
  assert.equal(ana.salesClosed, 0);
  assert.equal(bia.leadsAssigned, 1);
  assert.equal(bia.cohortWon, 1);
  assert.equal(bia.salesClosed, 1);
  assert.equal(bia.recordedRevenue, 2500);
});

test('probabilidades configuráveis alteram previsão sem alterar receita realizada', () => {
  const now = Date.UTC(2026, 9, 30, 12);
  const leads = [{ id: 'p1', createdAt: '2026-10-10T10:00:00Z', stage: 'proposta', dealValue: 10000 }];
  const report = buildCommercialPerformanceReport({
    leads, stages, rangeDays: 30, now, stageProbabilities: { proposta: 25 },
  });
  assert.equal(report.metrics.pipelineValue, 10000);
  assert.equal(report.metrics.weightedForecast, 2500);
  assert.equal(report.metrics.salesRevenue, 0);
  assert.equal(report.stageProbabilities.proposta, 25);
});

test('range all inclui todo o histórico e taxa de comparecimento ignora reuniões sem resultado', () => {
  const now = Date.UTC(2026, 9, 30, 12);
  const leads = [{
    id: 'old', createdAt: '2020-01-01T10:00:00Z', stage: 'novo',
    calendarEvents: [
      { eventId: 'a', status: 'confirmed', outcome: 'completed', outcomeAt: '2020-01-03T10:00:00Z' },
      { eventId: 'b', status: 'confirmed', outcome: '', end: '2020-01-04T10:00:00Z' },
    ],
  }];
  const report = buildCommercialPerformanceReport({ leads, stages, rangeDays: 0, now });
  assert.equal(report.period.rangeDays, 0);
  assert.equal(report.metrics.leadsCreated, 1);
  assert.equal(report.metrics.completedMeetings, 1);
  assert.equal(report.metrics.attendanceRate, 100);
});

test('normalização de categoria comercial reconhece ganho, perda e exclusão', () => {
  assert.equal(commercialStageCategory('Fechado'), 'closed_won');
  assert.equal(commercialStageCategory('Perdido'), 'closed_lost');
  assert.equal(commercialStageCategory('Black list'), 'excluded');
  assert.equal(commercialStageCategory('Proposta'), 'opportunity');
});

test('service worker protege consulta/configuração de performance e salva histórico de responsável', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /async DASHBOARD_GET_COMMERCIAL_PERFORMANCE/);
  assert.match(worker, /async SALES_ANALYTICS_SAVE_CONFIG/);
  assert.match(worker, /async UPDATE_LEAD_COMMERCIAL_FIELDS/);
  assert.match(worker, /commercialOwnerHistory/);
  assert.match(worker, /lead\.stageUpdatedAt = now/);
  assert.match(worker, /buildCommercialPerformanceReport/);
});

test('LeadModal oferece responsável, valor estimado e valor efetivamente vendido', () => {
  const modal = read('sidepanel/components/LeadModal.js');
  const api = read('sidepanel/utils/api.js');
  const dashboard = read('sidepanel/components/DashboardView.js');
  assert.match(modal, /Responsável comercial/);
  assert.match(modal, /Valor estimado da oportunidade/);
  assert.match(modal, /Valor efetivamente vendido/);
  assert.match(modal, /updateLeadCommercialFields/);
  assert.match(api, /getCommercialPerformance/);
  assert.match(api, /saveCommercialPerformanceConfig/);
  assert.match(dashboard, /Performance por vendedor/);
  assert.match(dashboard, /Desempenho por etapa/);
  assert.match(dashboard, /Previsão ponderada de vendas/);
  assert.match(dashboard, /Taxa de comparecimento/);
});

test('Fase 09 mantém catálogo e versão sincronizados em 1.5.0', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.equal(pkg.version, '1.0.0');
  assert.match(read('content/content.js'), /0\.0\.1\.0/);
  assert.match(read('content/injected.js'), /0\.0\.1\.0/);
});
