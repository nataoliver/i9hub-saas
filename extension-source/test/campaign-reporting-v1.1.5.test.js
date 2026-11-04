import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCampaignReport, summarizeCampaignReport } from '../lib/campaign-reporting.js';
import { DEFAULT_LEAD_SCORING_CONFIG } from '../lib/lead-scoring.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const sentAt = '2026-10-27T12:00:00.000Z';
const leadQualified = {
  id: 'lead-1', name: 'Clínica Horizonte', phone: '5511999990001', stage: 'qualificado',
  aiIntelligence: { need: 'atrair pacientes', service: 'fisioterapia', segment: 'Fisioterapia', budget: 'R$ 1.500 por mês', timeframe: 'esta semana', decisionMaker: 'sou eu' },
  aiQualification: { qualified: true, status: 'qualified' },
  aiNicheClassification: { primaryNiche: 'Saúde', path: ['Saúde', 'Fisioterapia'] },
  tipoEvidence: { incomingTimestamps: ['2026-10-27T13:00:00.000Z'], lastIncomingAt: '2026-10-27T13:00:00.000Z', incomingCount: 1, outgoingCount: 2 },
};
const leadNoReply = {
  id: 'lead-2', name: 'Contábil Alfa', phone: '5511999990002', stage: 'novo', category: 'Contabilidade',
  aiIntelligence: { segment: 'Contabilidade', budget: 'R$ 300 por mês' },
  aiNicheClassification: { primaryNiche: 'Serviços profissionais', path: ['Serviços profissionais', 'Contabilidade'] },
  tipoEvidence: { incomingTimestamps: ['2026-10-27T11:00:00.000Z'], lastIncomingAt: '2026-10-27T11:00:00.000Z', incomingCount: 1, outgoingCount: 1 },
};
const campaign = {
  id: 'camp_test', name: 'Teste outubro', status: 'completed', reportCycle: 1,
  createdAt: '2026-10-27T11:50:00.000Z', startedAt: '2026-10-27T11:55:00.000Z', finishedAt: '2026-10-27T14:00:00.000Z',
  contacts: [
    { name: 'Clínica Horizonte', phone: leadQualified.phone, status: 'sent', sentAt },
    { name: 'Contábil Alfa', phone: leadNoReply.phone, status: 'sent', sentAt },
    { name: 'Sem cadastro', phone: '5511999990003', status: 'sent', sentAt },
    { name: 'Falha', phone: '5511999990004', status: 'failed' },
    { name: 'Ignorado', phone: '5511999990005', status: 'skipped' },
    { name: 'Pendente', phone: '5511999990006' },
  ],
  log: [],
};

test('relatório calcula envios, respostas, qualificação e cobertura do CRM', () => {
  const report = buildCampaignReport(campaign, [leadQualified, leadNoReply], DEFAULT_LEAD_SCORING_CONFIG, { now: Date.parse('2026-10-27T15:00:00Z'), campaigns: [campaign] });
  assert.equal(report.metrics.total, 6);
  assert.equal(report.metrics.sent, 3);
  assert.equal(report.metrics.failed, 1);
  assert.equal(report.metrics.skipped, 1);
  assert.equal(report.metrics.pending, 1);
  assert.equal(report.metrics.responseCount, 1);
  assert.equal(report.metrics.responseRate, 33.3);
  assert.equal(report.metrics.qualifiedCount, 1);
  assert.equal(report.metrics.qualifiedResponders, 1);
  assert.equal(report.metrics.untrackedCount, 1);
  assert.equal(report.metrics.dataCoverageRate, 66.7);
  assert.equal(report.respondedContacts[0].name, 'Clínica Horizonte');
  assert.equal(report.qualifiedContacts[0].niche, 'Saúde');
  assert.equal(report.niches.find((n) => n.niche === 'Saúde').subniches[0].subniche, 'Fisioterapia');
});

test('resposta anterior ao envio não é atribuída à campanha', () => {
  const report = buildCampaignReport(campaign, [leadNoReply], DEFAULT_LEAD_SCORING_CONFIG, { campaigns: [campaign] });
  assert.equal(report.metrics.responseCount, 0);
  assert.equal(report.notRespondedContacts.length, 3);
});

test('snapshots armazenam métricas agregadas sem conteúdo de conversa', () => {
  const report = buildCampaignReport(campaign, [leadQualified, leadNoReply], DEFAULT_LEAD_SCORING_CONFIG, { campaigns: [campaign] });
  const snapshot = summarizeCampaignReport(report);
  assert.equal(snapshot.metrics.sent, 3);
  assert.equal(snapshot.metrics.responseCount, 1);
  assert.equal(snapshot.niches[0].niche, 'Saúde');
  assert.equal(JSON.stringify(snapshot).includes('incomingTimestamps'), false);
});

test('interface oferece relatório, atualização, marcos 24/48h e exportação para PDF', () => {
  const view = read('sidepanel/components/CampaignsWAView.js');
  assert.match(view, /data-action="report"/);
  assert.match(view, /Atualizar agora/);
  assert.match(view, /Registrar marco 24h/);
  assert.match(view, /Registrar marco 48h/);
  assert.match(view, /Exportar PDF/);
  assert.match(view, /win\.print\(\)/);
});

test('service worker agenda snapshots 24h/48h e reavalia em campanhas concluídas', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /scheduleCampaignReportAlarms/);
  assert.match(worker, /CAMPAIGN_REPORT_DELAYS/);
  assert.match(worker, /REFRESH_CAMPAIGN_REPORT/);
  assert.match(worker, /i9-campaign-report:/);
  assert.match(worker, /schedulePendingCampaignReportAlarms/);
});

test('relatório de campanha tem permissões de gerenciamento e a versão é 1.2.8', () => {
  const features = read('lib/feature-catalog.js');
  assert.match(features, /GET_CAMPAIGN_REPORT: 'whatsapp\.campaigns\.manage'/);
  assert.match(features, /REFRESH_CAMPAIGN_REPORT: 'whatsapp\.campaigns\.manage'/);
  const manifest = JSON.parse(read('manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.equal(pkg.version, '1.0.0');
});
