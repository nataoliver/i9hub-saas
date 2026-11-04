/**
 * ComplianceGuard - Regras de proteção para campanhas WhatsApp (i9Hub v1.0.1)
 * 
 * Este módulo aplica verificações ANTES do envio em massa e durante a execução.
 * NUNCA promete proteção contra banimento - apenas reduz riscos através de boas práticas.
 */

import { calculateHealthScore } from './compliance-score.js';
import { isOptedOut, hasValidConsent, logComplianceEvent, filterContactsByOptOut } from './compliance-store.js';

// Finalidades que exigem consentimento explícito
const PURPOSES_REQUIRING_CONSENT = ['marketing_authorized', 'reactivation'];

// Limites padrão de pausa automática (configuráveis via painel)
const DEFAULT_PAUSE_THRESHOLDS = Object.freeze({
  maxBlockRate: 0.05,         // 5% de bloqueios -> pausa
  maxOptOutRate: 0.08,        // 8% de descadastros -> pausa
  maxRepetitionRate: 0.30,    // 30% de repetição -> pausa
  consecutiveFailures: 5,     // 5 falhas consecutivas -> pausa
  minScoreForMarketing: 40,   // Score mínimo para campanhas promocionais
});

/**
 * Valida uma campanha ANTES de iniciar.
 * Retorna { allowed: boolean, blocked: boolean, warnings: [], errors: [], filteredContacts: [] }
 */
export async function validateCampaignBeforeStart({ contacts, purpose, scoreMetrics, limitsOverride }) {
  const result = {
    allowed: true,
    blocked: false,
    warnings: [],
    errors: [],
    filteredContacts: [],
    excludedCount: 0,
  };

  // 1. Verificar finalidade obrigatória
  if (!purpose || typeof purpose !== 'string') {
    result.allowed = false;
    result.blocked = true;
    result.errors.push('Finalidade da campanha é obrigatória. Selecione uma finalidade antes de enviar.');
    await logComplianceEvent({ type: 'CAMPAIGN_BLOCKED_NO_PURPOSE', detail: 'Campanha sem finalidade' });
    return result;
  }

  // 2. Calcular score de saúde
  const health = calculateHealthScore(scoreMetrics, limitsOverride);
  
  // 3. Bloquear campanhas promocionais com score baixo
  if (PURPOSES_REQUIRING_CONSENT.includes(purpose) && health.score < DEFAULT_PAUSE_THRESHOLDS.minScoreForMarketing) {
    result.allowed = false;
    result.blocked = true;
    result.errors.push(`Score de saúde muito baixo (${health.score}/100 - ${health.levelLabel}). Campanhas promocionais requerem score mínimo de ${DEFAULT_PAUSE_THRESHOLDS.minScoreForMarketing}.`);
    await logComplianceEvent({ type: 'CAMPAIGN_BLOCKED_LOW_SCORE', detail: `Score: ${health.score}, Finalidade: ${purpose}` });
    return result;
  }

  // 4. Filtrar contatos em opt-out
  const { valid, excluded } = await filterContactsByOptOut(contacts, purpose);
  result.filteredContacts = valid;
  result.excludedCount = excluded.length;
  
  if (excluded.length > 0) {
    result.warnings.push(`${excluded.length} contato(s) removido(s) por estarem em lista de descadastro.`);
    await logComplianceEvent({ type: 'CONTACTS_EXCLUDED_OPTOUT', detail: `${excluded.length} excluídos`, campaignId: null });
  }

  // 5. Verificar consentimento para finalidades que exigem
  if (PURPOSES_REQUIRING_CONSENT.includes(purpose)) {
    let withoutConsent = 0;
    for (const contact of valid) {
      const cid = contact.phone || contact.contactId;
      const hasConsent = await hasValidConsent(cid, purpose);
      if (!hasConsent) withoutConsent++;
    }
    if (withoutConsent > 0) {
      result.warnings.push(`${withoutConsent} contato(s) sem consentimento registrado para "${purpose}". Considere obter consentimento antes de enviar.`);
      if (withoutConsent === valid.length) {
        result.allowed = false;
        result.blocked = true;
        result.errors.push('Nenhum contato possui consentimento válido para esta finalidade de marketing.');
        await logComplianceEvent({ type: 'CAMPAIGN_BLOCKED_NO_CONSENT', detail: `${withoutConsent} sem consentimento` });
        return result;
      }
    }
  }

  // 6. Alertas baseados no score
  if (health.level === 'attention') {
    result.warnings.push(`Saúde da conta em ATENÇÃO (${health.score}/100). Reduza o volume de envios.`);
  } else if (health.level === 'risk') {
    result.warnings.push(`Saúde da conta em RISCO (${health.score}/100). Evite campanhas promocionais.`);
  }

  // 7. Aviso sobre volume recomendado
  if (valid.length > health.suggestedMaxContacts && health.suggestedMaxContacts > 0) {
    result.warnings.push(`Você está enviando para ${valid.length} contatos, mas o recomendado agora é até ${health.suggestedMaxContacts}.`);
  }

  await logComplianceEvent({ 
    type: 'CAMPAIGN_VALIDATED', 
    detail: `Purpose: ${purpose}, Contacts: ${valid.length}, Excluded: ${excluded.length}, Score: ${health.score}` 
  });

  return result;
}

/**
 * Verifica se deve pausar automaticamente uma campanha em andamento.
 * Retorna { shouldPause: boolean, reason: string|null }
 */
export function checkAutoPauseConditions({ sent, failed, blocks, optOuts, repeatedMessages, currentScore, previousLevel, thresholds = null }) {
  const t = thresholds || DEFAULT_PAUSE_THRESHOLDS;
  const totalProcessed = Math.max(1, sent + failed);
  
  // Taxa de bloqueios
  if (blocks > 0 && (blocks / totalProcessed) > t.maxBlockRate) {
    return { shouldPause: true, reason: `Taxa de bloqueios (${((blocks/totalProcessed)*100).toFixed(1)}%) ultrapassou o limite seguro de ${(t.maxBlockRate*100)}%.` };
  }
  
  // Taxa de descadastros
  if (optOuts > 0 && (optOuts / totalProcessed) > t.maxOptOutRate) {
    return { shouldPause: true, reason: `Taxa de descadastros (${((optOuts/totalProcessed)*100).toFixed(1)}%) ultrapassou o limite seguro de ${(t.maxOptOutRate*100)}%.` };
  }
  
  // Repetição excessiva
  if (sent > 0 && repeatedMessages > 0 && (repeatedMessages / sent) > t.maxRepetitionRate) {
    return { shouldPause: true, reason: `Alta repetição de mensagens detectada (${((repeatedMessages/sent)*100).toFixed(1)}%). Varie o conteúdo.` };
  }
  
  // Falhas consecutivas
  if (failed >= t.consecutiveFailures) {
    return { shouldPause: true, reason: `${failed} falhas consecutivas no envio. Verifique sua conexão e o status do WhatsApp Web.` };
  }
  
  // Queda de nível de score
  if (previousLevel && currentScore) {
    const levels = ['healthy', 'attention', 'risk', 'critical', 'suspended'];
    const prevIdx = levels.indexOf(previousLevel);
    const currIdx = levels.indexOf(currentScore.level);
    if (currIdx > prevIdx && currIdx >= 2) { // Caiu para risk ou pior
      return { shouldPause: true, reason: `Saúde da conta caiu de "${previousLevel}" para "${currentScore.levelLabel}". Reavalie antes de continuar.` };
    }
  }
  
  return { shouldPause: false, reason: null };
}

/**
 * Gera o texto do modal de confirmação consciente para envio em massa.
 */
export function getMassSendConfirmationText({ contactCount, purpose, healthScore }) {
  return {
    title: '⚠️ Confirmação de Envio em Massa',
    body: [
      'O i9Hub NÃO recomenda disparos indiscriminados de mensagens.',
      '',
      'Riscos reais de envio em massa:',
      '• Bloqueio temporário ou permanente da conta',
      '• Denúncias por spam de destinatários',
      '• Descadastros e perda de reputação',
      '• Banimento do número pela Meta/WhatsApp',
      '',
      `Destinatários: ${contactCount}`,
      `Finalidade: ${purpose || 'Não especificada'}`,
      `Saúde da conta: ${healthScore?.score ?? '?'}/100 (${healthScore?.levelLabel ?? 'Desconhecido'})`,
      '',
      'Esta recomendação NÃO garante ausência de bloqueio.',
      'Confirme apenas se você obteve consentimento dos destinatários.',
    ].join('\n'),
    confirmLabel: 'Confirmo os riscos e desejo continuar',
    cancelLabel: 'Cancelar envio',
  };
}

/**
 * Verifica se uma campanha pode ser retomada após pausa automática.
 * Exige confirmação consciente do usuário.
 */
export async function canResumeAfterPause({ pauseReason, userConfirmed, currentScore }) {
  if (!userConfirmed) {
    return { allowed: false, message: 'A campanha foi pausada automaticamente. Revise o motivo e confirme conscientemente para retomar.' };
  }
  
  // Se o score caiu para crítico ou suspenso, não permite retomada mesmo com confirmação
  if (currentScore && ['critical', 'suspended'].includes(currentScore.level)) {
    return { allowed: false, message: `Score atual (${currentScore.score}/100 - ${currentScore.levelLabel}) não permite retomar campanhas. Melhore seus indicadores primeiro.` };
  }
  
  await logComplianceEvent({ type: 'CAMPAIGN_RESUMED_AFTER_PAUSE', detail: `Motivo anterior: ${pauseReason}` });
  return { allowed: true, message: null };
}

export { DEFAULT_PAUSE_THRESHOLDS };
