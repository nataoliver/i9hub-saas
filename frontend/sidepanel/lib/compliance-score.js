/**
 * Módulo de Saúde e Conformidade do WhatsApp (i9Hub v1.0.1)
 * 
 * IMPORTANTE: Este score é uma estimativa interna do i9Hub para auxiliar na
 * comunicação consciente. Ele NÃO representa o score oficial do WhatsApp/Meta.
 * O WhatsApp pode aplicar critérios próprios de qualidade, limites ou bloqueio
 * independentemente desta pontuação.
 * 
 * O módulo é determinístico, testável e não depende do DOM do WhatsApp Web.
 */

const WEIGHTS = Object.freeze({
  consentRate: 0.25,
  positiveResponseRate: 0.20,
  blockReportRate: 0.20,
  optOutRate: 0.15,
  repetitionRate: 0.10,
  volumeVelocity: 0.10,
});

const DEFAULT_LIMITS = Object.freeze({
  healthy:   { min: 80, max: 100, suggestedMaxContacts: 50, label: 'Saudável' },
  attention: { min: 60, max: 79,  suggestedMaxContacts: 20, label: 'Atenção' },
  risk:      { min: 40, max: 59,  suggestedMaxContacts: 0,  label: 'Risco' },
  critical:  { min: 20, max: 39,  suggestedMaxContacts: 0,  label: 'Crítico' },
  suspended: { min: 0,  max: 19,  suggestedMaxContacts: 0,  label: 'Suspenso' },
});

const LEVEL_COLORS = Object.freeze({
  healthy:   '#10b981',
  attention: '#f59e0b',
  risk:      '#f97316',
  critical:  '#ef4444',
  suspended: '#991b1b',
});

export function calculateHealthScore(metrics, limitsOverride = null) {
  const limits = limitsOverride || DEFAULT_LIMITS;
  
  if (!metrics || typeof metrics !== 'object') {
    return buildUnknownResult('Dados insuficientes para calcular o score.');
  }
  
  const totalContacts = Math.max(0, Number(metrics.totalContacts) || 0);
  const consentedContacts = Math.max(0, Number(metrics.consentedContacts) || 0);
  const positiveResponses = Math.max(0, Number(metrics.positiveResponses) || 0);
  const totalResponses = Math.max(0, Number(metrics.totalResponses) || 0);
  const blocksAndReports = Math.max(0, Number(metrics.blocksAndReports) || 0);
  const optOuts = Math.max(0, Number(metrics.optOuts) || 0);
  const repeatedMessages = Math.max(0, Number(metrics.repeatedMessages) || 0);
  const totalSentRecent = Math.max(0, Number(metrics.totalSentRecent) || 0);
  const maxRecommendedDaily = Math.max(1, Number(metrics.maxRecommendedDaily) || 50);
  
  if (totalContacts < 5) {
    return buildUnknownResult('Base de contatos insuficiente (< 5). Interaja organicamente antes de iniciar campanhas.');
  }
  
  const consentRate = totalContacts > 0 ? Math.min(1, consentedContacts / totalContacts) : 0;
  const positiveResponseRate = totalResponses > 0 ? Math.min(1, positiveResponses / totalResponses) : 0;
  const blockReportImpact = totalContacts > 0 ? Math.max(0, 1 - (blocksAndReports / Math.max(totalContacts, 1))) : 0;
  const optOutImpact = totalContacts > 0 ? Math.max(0, 1 - (optOuts / Math.max(totalContacts, 1))) : 0;
  const repetitionImpact = totalSentRecent > 0 ? Math.max(0, 1 - (repeatedMessages / Math.max(totalSentRecent, 1))) : 0;
  const volumeImpact = Math.max(0, 1 - (totalSentRecent / maxRecommendedDaily));
  
  const rawScore = (
    (consentRate * WEIGHTS.consentRate) +
    (positiveResponseRate * WEIGHTS.positiveResponseRate) +
    (blockReportImpact * WEIGHTS.blockReportRate) +
    (optOutImpact * WEIGHTS.optOutRate) +
    (repetitionImpact * WEIGHTS.repetitionRate) +
    (volumeImpact * WEIGHTS.volumeVelocity)
  ) * 100;
  
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));
  
  let level = 'suspended';
  if (score >= limits.healthy.min) level = 'healthy';
  else if (score >= limits.attention.min) level = 'attention';
  else if (score >= limits.risk.min) level = 'risk';
  else if (score >= limits.critical.min) level = 'critical';
  
  const levelConfig = limits[level] || limits.suspended;
  const color = LEVEL_COLORS[level] || LEVEL_COLORS.suspended;
  
  const factors = [];
  if (consentRate < 0.5) factors.push({ id: 'low_consent', severity: consentRate < 0.2 ? 'high' : 'medium', message: `Apenas ${Math.round(consentRate * 100)}% dos contatos têm consentimento registrado.` });
  if (positiveResponseRate < 0.3 && totalResponses > 0) factors.push({ id: 'low_engagement', severity: 'medium', message: `Taxa de resposta positiva baixa (${Math.round(positiveResponseRate * 100)}%).` });
  if (blocksAndReports > 0) factors.push({ id: 'blocks_reports', severity: blocksAndReports > 3 ? 'high' : 'medium', message: `${blocksAndReports} bloqueio(s)/denúncia(s) recente(s).` });
  if (optOuts > 0) factors.push({ id: 'optouts', severity: optOuts > 5 ? 'high' : 'medium', message: `${optOuts} descadastro(s) recente(s).` });
  if (repetitionImpact < 0.7) factors.push({ id: 'repetition', severity: 'medium', message: 'Alta repetição de mensagens detectada.' });
  if (volumeImpact < 0.5) factors.push({ id: 'high_volume', severity: 'high', message: `Volume recente (${totalSentRecent}) próximo ou acima do recomendado (${maxRecommendedDaily}).` });
  
  const suggestedMaxContacts = levelConfig.suggestedMaxContacts || 0;
  let recommendation = '';
  if (level === 'healthy') recommendation = `Envios sugeridos agora: até ${suggestedMaxContacts} contatos engajados.`;
  else if (level === 'attention') recommendation = `Envios sugeridos agora: até ${suggestedMaxContacts} contatos engajados. Reduza o ritmo.`;
  else if (level === 'risk') recommendation = 'Não inicie novas campanhas promocionais. Foque em atendimento orgânico.';
  else if (level === 'critical') recommendation = 'Campanhas promocionais bloqueadas. Revise sua estratégia de comunicação.';
  else recommendation = 'Conta em estado suspenso. Aguarde e revise todas as práticas de envio.';
  
  return {
    success: true,
    score,
    level,
    levelLabel: levelConfig.label,
    color,
    factors,
    suggestedMaxContacts,
    recommendation,
    disclaimer: 'Este indicador é uma estimativa interna do i9Hub. O WhatsApp pode aplicar critérios próprios de qualidade, limites ou bloqueio.',
    weights: WEIGHTS,
    rawMetrics: {
      consentRate: Math.round(consentRate * 100),
      positiveResponseRate: Math.round(positiveResponseRate * 100),
      blockReportImpact: Math.round(blockReportImpact * 100),
      optOutImpact: Math.round(optOutImpact * 100),
      repetitionImpact: Math.round(repetitionImpact * 100),
      volumeImpact: Math.round(volumeImpact * 100),
    },
  };
}

function buildUnknownResult(reason) {
  return {
    success: true,
    score: 0,
    level: 'unknown',
    levelLabel: 'Desconhecido',
    color: '#64748b',
    factors: [{ id: 'insufficient_data', severity: 'info', message: reason }],
    suggestedMaxContacts: 0,
    recommendation: 'Interaja organicamente com seus contatos antes de iniciar campanhas.',
    disclaimer: 'Este indicador é uma estimativa interna do i9Hub. O WhatsApp pode aplicar critérios próprios de qualidade, limites ou bloqueio.',
    weights: WEIGHTS,
    rawMetrics: null,
  };
}

export function getDefaultLimits() { return DEFAULT_LIMITS; }
export function getLevelColors() { return LEVEL_COLORS; }
