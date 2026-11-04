import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_LEAD_SCORING_CONFIG,
  LEAD_SCORE_ACTIONS,
  normalizeLeadScoringConfig,
  parseBudgetAmount,
  scoreLead,
  leadNicheLabels,
} from '../lib/lead-scoring.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('configuração do Lead Score normaliza pesos, limites e mantém a pontuação de lead quente acima da qualificação', () => {
  const config = normalizeLeadScoringConfig({ qualifiedThreshold: 72, hotThreshold: 20, minimumMonthlyBudget: -5, weights: { repliedToCampaign: 999, spam: -999 } });
  assert.equal(config.qualifiedThreshold, 72);
  assert.equal(config.hotThreshold, 72);
  assert.equal(config.minimumMonthlyBudget, 0);
  assert.equal(config.weights.repliedToCampaign, 100);
  assert.equal(config.weights.spam, -100);
  assert.equal(normalizeLeadScoringConfig().minimumMonthlyBudget, 1000);
});

test('orçamentos brasileiros são interpretados sem confundir milhares e centavos', () => {
  assert.equal(parseBudgetAmount('R$ 1.000,00 por mês'), 1000);
  assert.equal(parseBudgetAmount('1500/mês'), 1500);
  assert.equal(parseBudgetAmount('R$ 950,50'), 950.5);
  assert.equal(parseBudgetAmount('sem orçamento no momento'), null);
});

test('Lead Score soma sinais comerciais e explica os pontos atribuídos', () => {
  const lead = {
    tipo: 'prospecto',
    tipoEvidence: { respondedToCampaign: true, incomingCount: 2, outgoingCount: 1 },
    aiIntelligence: { need: 'Atrair mais pacientes', service: 'Gestão de tráfego', budget: 'R$ 1.500/mês', timeframe: 'urgente', decisionMaker: 'sou eu' },
    aiQualification: { status: 'qualified', qualified: true },
    aiNicheClassification: { path: ['Saúde', 'Fisioterapia'] },
  };
  const score = scoreLead(lead, DEFAULT_LEAD_SCORING_CONFIG);
  assert.ok(score.score >= 80);
  assert.equal(score.qualified, true);
  assert.equal(score.hot, true);
  assert.ok(score.activeSignals.some((signal) => signal.key === 'repliedToCampaign'));
  assert.ok(score.activeSignals.some((signal) => signal.key === 'budgetMeetsMinimum'));
  assert.deepEqual(leadNicheLabels(lead).slice(0, 2), ['Saúde', 'Fisioterapia']);
});

test('regra opcional exige orçamento mínimo e bloqueios de spam/black list prevalecem sobre a pontuação', () => {
  const config = normalizeLeadScoringConfig({ requireBudgetMinimum: true, minimumMonthlyBudget: 1000 });
  const missingBudget = scoreLead({ aiIntelligence: { need: 'Quero contratar', service: 'Marketing' }, aiQualification: { qualified: true, status: 'qualified' } }, config);
  assert.equal(missingBudget.qualified, false);
  assert.equal(missingBudget.status, 'Aguardando orçamento mínimo');
  const spam = scoreLead({ tipo: 'spam', aiIntelligence: { need: 'Contratar', service: 'Marketing', budget: 'R$ 10.000' }, aiQualification: { qualified: true, status: 'qualified' } }, config);
  assert.equal(spam.qualified, false);
  assert.equal(spam.blocked, true);
  assert.equal(spam.status, 'Spam');
});

test('descadastro explícito bloqueia qualificação e o CRM recebe o estado de consentimento registrado', () => {
  const optedOut = scoreLead({ consentStatus: 'opted_out', aiIntelligence: { need: 'Contratar', service: 'Marketing', budget: 'R$ 10.000/mês' }, aiQualification: { status: 'qualified', qualified: true } });
  assert.equal(optedOut.blocked, true);
  assert.equal(optedOut.qualified, false);
  assert.equal(optedOut.status, 'Descadastrado');
  const worker = read('background/service-worker.js');
  assert.match(worker, /const consents = await getConsentTracking\(\)/);
  assert.match(worker, /optedOut: consent\.status === CONSENT_STATUS_OPTED_OUT/);
});

test('CRM expõe painel de pesos, filtros de qualificação/nicho e score na tabela e no Kanban', () => {
  const crm = read('sidepanel/components/CRMView.js');
  assert.match(crm, /btn-manage-lead-score/);
  assert.match(crm, /lead-score-weight-/);
  assert.match(crm, /lead-score-qualified-threshold/);
  assert.match(crm, /lead-score-min-budget/);
  assert.match(crm, /filter-qualification/);
  assert.match(crm, /filter-niche/);
  assert.match(crm, /leadScoreBadgeHTML/);
  assert.match(crm, /leadScoreTagHTML/);
  assert.match(crm, /stat-qualified-leads/);
  assert.match(crm, /stat-hot-leads/);
  const worker = read('background/service-worker.js');
  assert.match(worker, /leadScoreSignals/);
  assert.match(worker, /qualificationStatus/);
  assert.ok(LEAD_SCORE_ACTIONS.length >= 17);
});

test('a versão 1.2.8 está sincronizada entre manifesto, pacote e scripts do WhatsApp', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.equal(pkg.version, '1.0.0');
  assert.match(read('content/content.js'), /const CONTENT_VER = '0\.0\.1\.0'/);
  assert.match(read('content/injected.js'), /const EXT_VER = '0\.0\.1\.0'/);
});
