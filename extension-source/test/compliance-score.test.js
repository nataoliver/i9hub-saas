import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHealthScore, getDefaultLimits, getLevelColors } from '../lib/compliance-score.js';

// ============================================================================
// Score sem dados / insuficiente
// ============================================================================
test('score sem métricas retorna nível desconhecido', () => {
  const result = calculateHealthScore(null);
  assert.equal(result.success, true);
  assert.equal(result.level, 'unknown');
  assert.equal(result.score, 0);
  assert.ok(result.factors.some(f => f.id === 'insufficient_data'));
});

test('score com objeto vazio retorna nível desconhecido', () => {
  const result = calculateHealthScore({});
  assert.equal(result.level, 'unknown');
});

test('score com menos de 5 contatos retorna desconhecido', () => {
  const result = calculateHealthScore({ totalContacts: 3, consentedContacts: 3 });
  assert.equal(result.level, 'unknown');
  assert.ok(result.factors.some(f => f.id === 'insufficient_data'));
});

// ============================================================================
// Score saudável (consentimento alto, sem bloqueios)
// ============================================================================
test('score saudável com consentimento alto e sem bloqueios', () => {
  const result = calculateHealthScore({
    totalContacts: 100,
    consentedContacts: 90,
    positiveResponses: 60,
    totalResponses: 80,
    blocksAndReports: 0,
    optOuts: 0,
    repeatedMessages: 2,
    totalSentRecent: 20,
    maxRecommendedDaily: 50,
  });
  assert.equal(result.success, true);
  assert.ok(result.score >= 80, `Expected >= 80, got ${result.score}`);
  assert.equal(result.level, 'healthy');
  assert.equal(result.levelLabel, 'Saudável');
  assert.equal(result.color, '#10b981');
  assert.ok(result.suggestedMaxContacts > 0);
  assert.ok(result.disclaimer.includes('estimativa interna'));
});

// ============================================================================
// Aumento de bloqueios reduz score
// ============================================================================
test('aumento de bloqueios reduz score significativamente', () => {
  const base = {
    totalContacts: 100, consentedContacts: 80,
    positiveResponses: 50, totalResponses: 70,
    blocksAndReports: 0, optOuts: 0,
    repeatedMessages: 0, totalSentRecent: 20, maxRecommendedDaily: 50,
  };
  const healthy = calculateHealthScore(base);
  const withBlocks = calculateHealthScore({ ...base, blocksAndReports: 15 });
  assert.ok(withBlocks.score < healthy.score, `Score com bloqueios (${withBlocks.score}) deveria ser menor que sem (${healthy.score})`);
  assert.ok(withBlocks.factors.some(f => f.id === 'blocks_reports'));
});

// ============================================================================
// Aumento de descadastros reduz score
// ============================================================================
test('aumento de descadastros reduz score', () => {
  const base = {
    totalContacts: 100, consentedContacts: 80,
    positiveResponses: 50, totalResponses: 70,
    blocksAndReports: 0, optOuts: 0,
    repeatedMessages: 0, totalSentRecent: 20, maxRecommendedDaily: 50,
  };
  const normal = calculateHealthScore(base);
  const withOptOuts = calculateHealthScore({ ...base, optOuts: 20 });
  assert.ok(withOptOuts.score < normal.score);
  assert.ok(withOptOuts.factors.some(f => f.id === 'optouts'));
});

// ============================================================================
// Repetição excessiva reduz score
// ============================================================================
test('repetição excessiva de mensagens reduz score', () => {
  const result = calculateHealthScore({
    totalContacts: 50, consentedContacts: 40,
    positiveResponses: 20, totalResponses: 30,
    blocksAndReports: 0, optOuts: 0,
    repeatedMessages: 35, totalSentRecent: 40, maxRecommendedDaily: 50,
  });
  assert.ok(result.factors.some(f => f.id === 'repetition'));
});

// ============================================================================
// Volume alto reduz score
// ============================================================================
test('volume acima do recomendado reduz score', () => {
  const result = calculateHealthScore({
    totalContacts: 50, consentedContacts: 40,
    positiveResponses: 20, totalResponses: 30,
    blocksAndReports: 0, optOuts: 0,
    repeatedMessages: 0, totalSentRecent: 60, maxRecommendedDaily: 50,
  });
  assert.ok(result.factors.some(f => f.id === 'high_volume'));
});

// ============================================================================
// Estados corretos por faixa
// ============================================================================
test('estados cobrem todas as faixas de score', () => {
  const limits = getDefaultLimits();
  assert.equal(limits.healthy.min, 80);
  assert.equal(limits.attention.min, 60);
  assert.equal(limits.risk.min, 40);
  assert.equal(limits.critical.min, 20);
  assert.equal(limits.suspended.min, 0);
});

test('cores por nível estão definidas', () => {
  const colors = getLevelColors();
  assert.ok(colors.healthy);
  assert.ok(colors.attention);
  assert.ok(colors.risk);
  assert.ok(colors.critical);
  assert.ok(colors.suspended);
});

// ============================================================================
// Score crítico e suspenso
// ============================================================================
test('score crítico com muitos bloqueios e descadastros', () => {
  const result = calculateHealthScore({
    totalContacts: 100, consentedContacts: 5,
    positiveResponses: 2, totalResponses: 50,
    blocksAndReports: 30, optOuts: 25,
    repeatedMessages: 40, totalSentRecent: 80, maxRecommendedDaily: 50,
  });
  assert.ok(result.score < 40, `Expected < 40, got ${result.score}`);
  assert.ok(['critical', 'suspended'].includes(result.level));
  assert.equal(result.suggestedMaxContacts, 0);
});

// ============================================================================
// Determinismo
// ============================================================================
test('score é determinístico (mesmas entradas = mesmo resultado)', () => {
  const metrics = {
    totalContacts: 80, consentedContacts: 60,
    positiveResponses: 30, totalResponses: 50,
    blocksAndReports: 3, optOuts: 5,
    repeatedMessages: 8, totalSentRecent: 25, maxRecommendedDaily: 50,
  };
  const r1 = calculateHealthScore(metrics);
  const r2 = calculateHealthScore(metrics);
  assert.equal(r1.score, r2.score);
  assert.equal(r1.level, r2.level);
  assert.deepEqual(r1.factors.map(f => f.id), r2.factors.map(f => f.id));
});

// ============================================================================
// Disclaimer sempre presente
// ============================================================================
test('disclaimer menciona que é estimativa interna', () => {
  const result = calculateHealthScore({
    totalContacts: 100, consentedContacts: 90,
    positiveResponses: 60, totalResponses: 80,
    blocksAndReports: 0, optOuts: 0,
    repeatedMessages: 0, totalSentRecent: 10, maxRecommendedDaily: 50,
  });
  assert.ok(result.disclaimer.includes('estimativa interna do i9Hub'));
  assert.ok(!result.disclaimer.toLowerCase().includes('oficial'));
});

// ============================================================================
// Pesos expostos para transparência
// ============================================================================
test('pesos são expostos no resultado para transparência', () => {
  const result = calculateHealthScore({
    totalContacts: 50, consentedContacts: 40,
    positiveResponses: 20, totalResponses: 30,
    blocksAndReports: 0, optOuts: 0,
    repeatedMessages: 0, totalSentRecent: 10, maxRecommendedDaily: 50,
  });
  assert.ok(result.weights);
  assert.equal(result.weights.consentRate, 0.25);
  assert.equal(result.weights.positiveResponseRate, 0.20);
  assert.equal(result.weights.blockReportRate, 0.20);
  assert.equal(result.weights.optOutRate, 0.15);
  assert.equal(result.weights.repetitionRate, 0.10);
  assert.equal(result.weights.volumeVelocity, 0.10);
});
