import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCommercialManagementReport, validateCommercialMonth } from '../lib/commercial-management.js';
import { ACTION_FEATURE_MAP, ACTION_REQUIRED_FEATURES, FEATURE_CATALOG, FEATURE_CATALOG_VERSION, getFeatureAccess } from '../lib/feature-catalog.js';
import { isReadOnlyAction } from '../lib/license-policy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const now = Date.UTC(2026, 9, 30, 12, 0, 0);
const teams = [
  { id: 'team-norte', name: 'Equipe Norte', active: true },
  { id: 'team-sul', name: 'Equipe Sul', active: true },
];
const sellers = [
  {
    id: 'seller-ana', name: 'Ana', teamId: 'team-sul', active: true, defaultCommissionRate: 5,
    teamHistory: [
      { teamId: 'team-norte', assignedAt: '2026-01-01T00:00:00Z', unassignedAt: '2026-10-15T00:00:00Z' },
      { teamId: 'team-sul', assignedAt: '2026-10-15T00:00:00Z', unassignedAt: null },
    ],
  },
  { id: 'seller-bruno', name: 'Bruno', teamId: 'team-norte', active: true, defaultCommissionRate: 4, teamHistory: [{ teamId: 'team-norte', assignedAt: '2026-01-01T00:00:00Z', unassignedAt: null }] },
];
const products = [
  { id: 'product-consultoria', name: 'Consultoria', kind: 'service', commissionRate: 12, active: true },
  { id: 'product-kit', name: 'Kit', kind: 'product', commissionRate: 6, active: true },
];

function sale({ id, name, sellerId, sellerName, teamId, date, value, productId = '', productName = '', rate, amount, status = 'pending' }) {
  return {
    id, name, stage: 'fechado', stageUpdatedAt: `${date}T10:00:00.000Z`, createdAt: '2026-10-01T09:00:00.000Z', saleValue: value,
    commercialOwner: sellerName, commercialOwnerId: sellerId,
    commercialOwnerHistory: [{ owner: sellerName, ownerId: sellerId, teamId, assignedAt: '2026-10-01T08:00:00.000Z', unassignedAt: null }],
    commercialProductId: productId || null, commercialProductName: productName,
    commissionRateAtSale: rate, commissionAmountAtSale: amount, commissionStatus: status,
    commissionPaidAt: status === 'paid' ? `${date}T11:00:00.000Z` : null,
    activityLog: [{ id: `stage-${id}`, type: 'lead.stage_changed', createdAt: `${date}T10:00:00.000Z`, metadata: { from: 'proposta', to: 'fechado' } }],
  };
}

const config = {
  sellers, teams, products,
  goals: [
    { id: 'goal-ana', month: '2026-10', targetType: 'seller', targetId: 'seller-ana', revenueTarget: 4000, salesTarget: 3, leadsTarget: 10, active: true },
    { id: 'goal-sul', month: '2026-10', targetType: 'team', targetId: 'team-sul', revenueTarget: 1000, salesTarget: 1, leadsTarget: 0, active: true },
  ],
};

test('Fase 10 adiciona gestão comercial ao catálogo v11 e mantém ações sob entitlement da Fase 09', () => {
  assert.equal(FEATURE_CATALOG_VERSION, 14);
  assert.equal(FEATURE_CATALOG.length, 91);
  assert.equal(FEATURE_CATALOG.filter((feature) => feature.implemented === true).length, 89);
  const feature = FEATURE_CATALOG.find((item) => item.id === 'dashboard.commercial_management');
  assert.equal(feature?.implemented, true);
  assert.equal(feature?.phase, 10);
  assert.ok(feature.requires.includes('dashboard.commercial_performance'));
  for (const action of [
    'COMMERCIAL_MANAGEMENT_GET', 'COMMERCIAL_MANAGEMENT_SAVE_SELLER', 'COMMERCIAL_MANAGEMENT_SAVE_TEAM',
    'COMMERCIAL_MANAGEMENT_SAVE_PRODUCT', 'COMMERCIAL_MANAGEMENT_SAVE_GOAL',
    'COMMERCIAL_MANAGEMENT_DELETE_ENTITY', 'COMMERCIAL_MANAGEMENT_UPDATE_COMMISSION_STATUS',
  ]) {
    assert.equal(ACTION_FEATURE_MAP[action], 'dashboard.commercial_performance');
    assert.ok(ACTION_REQUIRED_FEATURES[action].includes('crm.leads'));
    assert.ok(ACTION_REQUIRED_FEATURES[action].includes('crm.kanban'));
  }
  assert.equal(getFeatureAccess(['dashboard.commercial_performance', 'crm.leads', 'crm.kanban'], 'dashboard.commercial_performance').allowed, true);
  assert.equal(getFeatureAccess(['dashboard.commercial_management', 'crm.leads', 'crm.kanban'], 'dashboard.commercial_management').allowed, false);
  assert.equal(isReadOnlyAction('COMMERCIAL_MANAGEMENT_GET'), true);
  assert.equal(isReadOnlyAction('COMMERCIAL_MANAGEMENT_SAVE_GOAL'), false);
});

test('relatório calcula ranking, comissões por produto e vendedor, metas individuais e de equipe', () => {
  const leads = [
    sale({ id: 'lead-ana', name: 'Venda Ana', sellerId: 'seller-ana', sellerName: 'Ana', teamId: 'team-norte', date: '2026-10-20', value: 1000, productId: 'product-consultoria', productName: 'Consultoria', rate: 8, amount: 80 }),
    sale({ id: 'lead-bruno', name: 'Venda Bruno', sellerId: 'seller-bruno', sellerName: 'Bruno', teamId: 'team-norte', date: '2026-10-21', value: 2000, productId: '', productName: '', rate: 4, amount: 80, status: 'paid' }),
  ];
  const report = buildCommercialManagementReport({ leads, config, month: '2026-10', now });
  assert.equal(report.period.month, '2026-10');
  assert.equal(report.metrics.revenue, 3000);
  assert.equal(report.metrics.salesClosed, 2);
  assert.equal(report.metrics.commissionTotal, 160);
  assert.equal(report.metrics.commissionPending, 80);
  assert.equal(report.metrics.commissionPaid, 80);
  assert.equal(report.metrics.goalsAtRisk, 1);
  assert.equal(report.commissionRows.length, 2);
  assert.equal(report.commissionRows.find((row) => row.leadId === 'lead-ana').commissionRate, 8);
  assert.equal(report.commissionRows.find((row) => row.leadId === 'lead-bruno').status, 'paid');
  assert.equal(report.rankingRows[0].sellerId, 'seller-bruno');
  assert.equal(report.rankingRows[0].revenue, 2000);
  assert.equal(report.rankingRows[1].revenue, 1000);
  assert.equal(report.goalRows.find((row) => row.id === 'goal-ana').status, 'at_risk');
  assert.equal(report.goalRows.find((row) => row.id === 'goal-ana').attainmentPercent, 10);
  assert.equal(report.goalRows.find((row) => row.id === 'goal-ana').metricProgress.length, 3);
  assert.equal(report.goalRows.find((row) => row.id === 'goal-sul').status, 'achieved');
  assert.equal(report.teamRows.find((row) => row.teamId === 'team-sul').revenue, 1000);
  assert.equal(report.teamRows.find((row) => row.teamId === 'team-norte').revenue, 2000);
  assert.equal(report.productRows.find((row) => row.productName === 'Consultoria').commissionTotal, 80);
});

test('mudança de equipe preserva a equipe vigente na data da venda', () => {
  const lead = sale({ id: 'team-transfer', name: 'Venda após transferência', sellerId: 'seller-ana', sellerName: 'Ana', teamId: 'team-norte', date: '2026-10-20', value: 500, productId: '', productName: '', rate: 5, amount: 25 });
  const report = buildCommercialManagementReport({ leads: [lead], config, month: '2026-10', now });
  assert.equal(report.teamRows.find((row) => row.teamId === 'team-sul').revenue, 500);
  assert.equal(report.teamRows.find((row) => row.teamId === 'team-norte').revenue, 0);
});

test('compatibilidade com leads antigos resolve vendedor pelo nome e sinaliza comissão sem snapshot', () => {
  const lead = {
    id: 'legacy', name: 'Venda antiga', stage: 'fechado', stageUpdatedAt: '2026-10-10T10:00:00Z',
    saleValue: 500, commercialOwner: 'Bruno', commercialOwnerHistory: [{ owner: 'Bruno', assignedAt: '2026-10-01T08:00:00Z', unassignedAt: null }],
    activityLog: [{ type: 'lead.stage_changed', createdAt: '2026-10-10T10:00:00Z', metadata: { from: 'proposta', to: 'fechado' } }],
  };
  const report = buildCommercialManagementReport({ leads: [lead], config, month: '2026-10', now });
  assert.equal(report.commissionRows.length, 1);
  assert.equal(report.commissionRows[0].sellerId, 'seller-bruno');
  assert.equal(report.commissionRows[0].commissionRate, 4);
  assert.equal(report.commissionRows[0].commissionAmount, 20);
  assert.equal(report.commissionRows[0].snapshotMissing, true);
});

test('vendas perdidas, sem data ou fora do mês não entram em receita nem comissão', () => {
  const leads = [
    { id: 'lost', stage: 'perdido', saleValue: 5000, commercialOwner: 'Ana' },
    { id: 'no-date', stage: 'fechado', saleValue: 1000, commercialOwner: 'Ana' },
    sale({ id: 'previous-month', name: 'Anterior', sellerId: 'seller-ana', sellerName: 'Ana', teamId: 'team-sul', date: '2026-09-30', value: 700, rate: 5, amount: 35 }),
  ];
  const report = buildCommercialManagementReport({ leads, config, month: '2026-10', now });
  assert.equal(report.metrics.revenue, 0);
  assert.equal(report.metrics.salesClosed, 0);
  assert.equal(report.commissionRows.length, 0);
});

test('venda após encerramento da atribuição fica sem vendedor e não gera comissão para ex-responsável', () => {
  const lead = {
    id: 'unassigned-at-close', name: 'Venda sem responsável', stage: 'fechado', stageUpdatedAt: '2026-10-20T10:00:00Z',
    saleValue: 900, commercialOwner: '', commercialOwnerHistory: [{ owner: 'Ana', ownerId: 'seller-ana', teamId: 'team-norte', assignedAt: '2026-10-01T08:00:00Z', unassignedAt: '2026-10-10T08:00:00Z' }],
    activityLog: [{ type: 'lead.stage_changed', createdAt: '2026-10-20T10:00:00Z', metadata: { from: 'proposta', to: 'fechado' } }],
  };
  const report = buildCommercialManagementReport({ leads: [lead], config, month: '2026-10', now });
  assert.equal(report.metrics.revenue, 900);
  assert.equal(report.metrics.salesWithoutSeller, 1);
  assert.equal(report.commissionRows.length, 0);
});

test('metas futuras e meses encerrados recebem estados próprios', () => {
  const future = buildCommercialManagementReport({ leads: [], config: { ...config, goals: [{ id: 'future', month: '2026-12', targetType: 'seller', targetId: 'seller-ana', revenueTarget: 1000 }] }, month: '2026-12', now });
  assert.equal(future.goalRows[0].status, 'scheduled');
  const past = buildCommercialManagementReport({ leads: [], config: { ...config, goals: [{ id: 'past', month: '2026-09', targetType: 'seller', targetId: 'seller-ana', revenueTarget: 1000 }] }, month: '2026-09', now });
  assert.equal(past.goalRows[0].status, 'missed');
});

test('validador aceita somente mês no formato AAAA-MM', () => {
  assert.equal(validateCommercialMonth('2026-10'), true);
  assert.equal(validateCommercialMonth('2026-13'), false);
  assert.equal(validateCommercialMonth('10/2026'), false);
});

test('service worker protege cadastros, metas e status de comissão; lead grava snapshots', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /async COMMERCIAL_MANAGEMENT_GET/);
  assert.match(worker, /async COMMERCIAL_MANAGEMENT_SAVE_SELLER/);
  assert.match(worker, /async COMMERCIAL_MANAGEMENT_SAVE_TEAM/);
  assert.match(worker, /async COMMERCIAL_MANAGEMENT_SAVE_PRODUCT/);
  assert.match(worker, /async COMMERCIAL_MANAGEMENT_SAVE_GOAL/);
  assert.match(worker, /async COMMERCIAL_MANAGEMENT_DELETE_ENTITY/);
  assert.match(worker, /async COMMERCIAL_MANAGEMENT_UPDATE_COMMISSION_STATUS/);
  assert.match(worker, /snapshotLeadCommission\(l, managementConfig, stageChangedAt\)/);
  assert.match(worker, /blocksPaidCommissionMove/);
  assert.match(worker, /snapshotLeadCommission\(lead, managementConfig, now\)/);
  assert.match(worker, /snapshotLeadCommission\(l, managementConfig, stageChangedAt\)/);
  assert.match(worker, /commissionRateAtSale/);
  assert.match(worker, /commissionProductNameAtSale/);
  assert.match(worker, /commercialOwnerHistory/);
  assert.match(worker, /commissionStatus === 'paid'/);
});

test('Dashboard e LeadModal oferecem gestão, metas, comissões e vínculo de catálogo', () => {
  const dashboard = read('sidepanel/components/DashboardView.js');
  const modal = read('sidepanel/components/LeadModal.js');
  const api = read('sidepanel/utils/api.js');
  assert.match(dashboard, /Gestão de metas, equipes e comissões/);
  assert.match(dashboard, /Ranking de vendedores/);
  assert.match(dashboard, /Alertas de metas/);
  assert.match(dashboard, /Comissões das vendas/);
  assert.match(dashboard, /Exportar CSV/);
  assert.match(dashboard, /csvCell/);
  assert.match(dashboard, /saveCommercialGoal/);
  assert.match(dashboard, /updateCommercialCommissionStatus/);
  assert.match(modal, /lead-commercial-product/);
  assert.match(modal, /loadCommercialOptions/);
  assert.match(modal, /commercialProductName/);
  assert.match(api, /getCommercialManagement/);
  assert.match(api, /saveCommercialSeller/);
  assert.match(api, /saveCommercialTeam/);
  assert.match(api, /saveCommercialProduct/);
  assert.match(api, /saveCommercialGoal/);
});

test('Fase 10 atualiza a extensão para 1.6.0', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.equal(pkg.version, '1.0.0');
  assert.match(read('content/content.js'), /0\.0\.1\.0/);
  assert.match(read('content/injected.js'), /0\.0\.1\.0/);
});
