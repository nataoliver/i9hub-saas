import { normalizeTaxonomyName } from './niche-taxonomy.js';

const count = (value) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
const rate = (numerator, denominator) => denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
const label = (value) => String(value ?? '').trim() || 'Não identificado';

/** Combines only the user's own campaign reports; no external/industry benchmark is invented. */
export function aggregateNichePerformance(reports = []) {
  const nicheMap = new Map();
  const campaignIds = new Set();
  const personaMap = new Map();
  const totals = { sent: 0, responses: 0, qualified: 0, hot: 0 };
  for (const report of Array.isArray(reports) ? reports : []) {
    const campaignId = String(report?.campaignId || report?.campaignName || '');
    if (campaignId) campaignIds.add(campaignId);
    const metrics = report?.metrics || {};
    totals.sent += count(metrics.sent);
    totals.responses += count(metrics.responseCount);
    totals.qualified += count(metrics.qualifiedCount);
    totals.hot += count(metrics.hotCount);

    // Fase 4: compara os perfis associados às campanhas. Campanhas antigas ou sem perfil
    // explícito são agrupadas em Perfil global para não desaparecerem da análise.
    const personaId = String(report?.aiPersonaId || '').trim();
    const personaKey = personaId ? `persona:${personaId}` : 'global';
    const personaName = label(report?.aiPersonaName || (personaId ? `Perfil ${personaId}` : 'Perfil global'));
    const persona = personaMap.get(personaKey) || { personaId, personaName, sent: 0, responses: 0, qualified: 0, hot: 0, campaigns: new Set() };
    persona.sent += count(metrics.sent);
    persona.responses += count(metrics.responseCount);
    persona.qualified += count(metrics.qualifiedCount);
    persona.hot += count(metrics.hotCount);
    if (campaignId) persona.campaigns.add(campaignId);
    // Se o nome do perfil foi atualizado, mostramos o nome atual sem criar uma linha duplicada.
    if (report?.aiPersonaName) persona.personaName = label(report.aiPersonaName);
    personaMap.set(personaKey, persona);

    for (const niche of Array.isArray(report?.niches) ? report.niches : []) {
      const nicheName = label(niche?.niche);
      const group = nicheMap.get(nicheName) || { niche: nicheName, sent: 0, responses: 0, qualified: 0, hot: 0, campaigns: new Set(), subMap: new Map() };
      group.sent += count(niche.sent);
      group.responses += count(niche.responses);
      group.qualified += count(niche.qualified);
      group.hot += count(niche.hot);
      if (campaignId) group.campaigns.add(campaignId);
      for (const sub of Array.isArray(niche?.subniches) ? niche.subniches : []) {
        const subName = label(sub?.subniche);
        const subGroup = group.subMap.get(subName) || { subniche: subName, sent: 0, responses: 0, qualified: 0, hot: 0, campaigns: new Set() };
        subGroup.sent += count(sub.sent);
        subGroup.responses += count(sub.responses);
        subGroup.qualified += count(sub.qualified);
        subGroup.hot += count(sub.hot);
        if (campaignId) subGroup.campaigns.add(campaignId);
        group.subMap.set(subName, subGroup);
      }
      nicheMap.set(nicheName, group);
    }
  }
  const finalize = (item) => ({
    ...item,
    campaigns: item.campaigns.size,
    responseRate: rate(item.responses, item.sent),
    qualificationRate: rate(item.qualified, item.sent),
    hotRate: rate(item.hot, item.sent),
  });
  const niches = [...nicheMap.values()].map((item) => ({
    ...finalize({ niche: item.niche, sent: item.sent, responses: item.responses, qualified: item.qualified, hot: item.hot, campaigns: item.campaigns }),
    subniches: [...item.subMap.values()].map(finalize).sort((a, b) => b.qualified - a.qualified || b.responseRate - a.responseRate || b.sent - a.sent),
  })).sort((a, b) => b.qualified - a.qualified || b.responseRate - a.responseRate || b.sent - a.sent);
  const subniches = niches.flatMap((item) => item.subniches.map((sub) => ({ ...sub, niche: item.niche })));
  const personas = [...personaMap.values()].map((item) => finalize({
    personaId: item.personaId, personaName: item.personaName, sent: item.sent,
    responses: item.responses, qualified: item.qualified, hot: item.hot, campaigns: item.campaigns,
  })).sort((a, b) => b.qualified - a.qualified || b.responseRate - a.responseRate || b.sent - a.sent);
  return {
    campaignCount: campaignIds.size,
    totals: { ...totals, responseRate: rate(totals.responses, totals.sent), qualificationRate: rate(totals.qualified, totals.sent), hotRate: rate(totals.hot, totals.sent) },
    niches,
    subniches,
    personas,
    generatedAt: new Date().toISOString(),
  };
}

/** Produces cautious, explainable suggestions using the user's own historical results. */
export function buildNicheOptimizationRecommendations(summary = {}, options = {}) {
  const minSample = Math.max(3, Math.min(100, Math.round(count(options.minSample) || 5)));
  const totals = summary.totals || {};
  const baselineResponse = count(totals.responseRate);
  const baselineQualification = count(totals.qualificationRate);
  const segments = [...(Array.isArray(summary.niches) ? summary.niches : []), ...(Array.isArray(summary.subniches) ? summary.subniches : [])]
    .filter((item) => item && label(item.niche || item.subniche) !== 'Não identificado');
  const recommendations = [];
  if (count(totals.sent) < minSample) {
    recommendations.push({
      id: 'collect-more-data', severity: 'info', title: 'Amostra ainda pequena',
      message: `Há ${count(totals.sent)} envio(s) registrado(s). Reúna pelo menos ${minSample} envios com dados sincronizados antes de comparar nichos.`,
      action: 'Colete mais dados e sincronize as conversas antes de decidir quais segmentos priorizar.',
      sample: count(totals.sent),
    });
  }
  const eligible = segments.filter((item) => count(item.sent) >= minSample);
  if (!eligible.length && count(totals.sent) >= minSample) {
    recommendations.push({ id: 'identify-niches', severity: 'info', title: 'Classifique melhor os segmentos', message: 'Ainda não há nichos/subnichos com amostra suficiente para uma comparação responsável.', action: 'Revise a classificação dos leads no CRM e atualize os relatórios após sincronizar as conversas.', sample: 0 });
  }
  for (const item of eligible) {
    const segmentName = item.subniche && item.subniche !== 'Não identificado' ? `${item.niche} › ${item.subniche}` : item.niche;
    if (item.responseRate >= baselineResponse + 5 && item.qualificationRate >= baselineQualification) {
      recommendations.push({ id: `prioritize-${normalizeTaxonomyName(segmentName)}`, severity: 'success', title: `Priorize ${segmentName}`, message: `Este segmento está acima da média histórica da sua conta em respostas (${item.responseRate}% vs. ${baselineResponse}%) e não fica abaixo da taxa geral de qualificação (${item.qualificationRate}% vs. ${baselineQualification}%).`, action: 'Teste um novo lote pequeno para esse segmento, mantendo a mensagem atual como referência e comparando os resultados.', segment: segmentName, niche: item.niche, subniche: item.subniche || '', sample: item.sent });
    } else if (item.responseRate <= Math.max(0, baselineResponse - 5)) {
      recommendations.push({ id: `review-${normalizeTaxonomyName(segmentName)}`, severity: 'warning', title: `Revise a abordagem de ${segmentName}`, message: `A taxa de resposta é ${item.responseRate}%, abaixo da taxa geral da conta (${baselineResponse}%). Isso é um sinal para investigar, não prova de que o nicho seja ruim.`, action: 'Teste uma abertura mais contextual, revise a origem e a adequação dos contatos e compare com outro lote semelhante antes de escalar.', segment: segmentName, niche: item.niche, subniche: item.subniche || '', sample: item.sent });
    }
    if (item.responseRate >= baselineResponse + 5 && item.qualificationRate < baselineQualification - 5) {
      recommendations.push({ id: `qualify-${normalizeTaxonomyName(segmentName)}`, severity: 'info', title: `Melhore a qualificação em ${segmentName}`, message: 'O segmento responde relativamente bem, mas gera menos leads qualificados do que a média da conta.', action: 'Ajuste os critérios de qualificação e as perguntas de descoberta; não aumente o volume apenas pela taxa de resposta.', segment: segmentName, niche: item.niche, subniche: item.subniche || '', sample: item.sent });
    }
  }
  if (count(summary.totals?.sent) >= minSample && count(totals.responses) === 0) {
    recommendations.push({ id: 'sync-inbound', severity: 'warning', title: 'Confira a sincronização das respostas', message: 'Nenhuma resposta foi identificada nos relatórios carregados.', action: 'Sincronize as conversas do WhatsApp antes de interpretar isso como ausência real de respostas.' });
  }
  return recommendations.slice(0, 30);
}


/** Compara perfis de IA usando somente relatórios de campanha da própria conta. */
export function buildPersonaOptimizationRecommendations(summary = {}, options = {}) {
  const minSample = Math.max(3, Math.min(100, Math.round(count(options.minSample) || 5)));
  const totals = summary.totals || {};
  const baselineResponse = count(totals.responseRate);
  const baselineQualification = count(totals.qualificationRate);
  const personas = Array.isArray(summary.personas) ? summary.personas : [];
  const recommendations = [];
  if (personas.length > 1 && count(totals.sent) < minSample) {
    recommendations.push({
      id: 'persona-more-data', severity: 'info', title: 'Compare as personalidades com mais dados',
      message: `A análise reúne ${count(totals.sent)} envio(s). Para comparar perfis com mais segurança, procure ter pelo menos ${minSample} envios registrados.`,
      action: 'Mantenha os testes pequenos e sincronize as respostas antes de decidir qual perfil funciona melhor.', sample: count(totals.sent),
    });
  }
  for (const persona of personas) {
    if (count(persona.sent) < minSample) continue;
    const name = label(persona.personaName);
    if (persona.responseRate >= baselineResponse + 5 && persona.qualificationRate >= baselineQualification) {
      recommendations.push({
        id: `persona-prioritize-${normalizeTaxonomyName(persona.personaId || name)}`, severity: 'success',
        title: `Continue testando ${name}`,
        message: `O perfil apresenta ${persona.responseRate}% de respostas e ${persona.qualificationRate}% de qualificação, comparado às médias da conta de ${baselineResponse}% e ${baselineQualification}%.`,
        action: 'Repita um lote pequeno com público semelhante e compare a qualidade das conversas, não apenas o volume de respostas.',
        personaId: persona.personaId || '', personaName: name, sample: persona.sent,
      });
    } else if (persona.responseRate >= baselineResponse + 5 && persona.qualificationRate < baselineQualification - 5) {
      recommendations.push({
        id: `persona-refine-${normalizeTaxonomyName(persona.personaId || name)}`, severity: 'info',
        title: `Revise o objetivo de ${name}`,
        message: 'O perfil gera respostas acima da média, mas a proporção de leads qualificados fica abaixo da média da conta.',
        action: 'Revise a instrução e a pergunta seguinte para melhorar a identificação de necessidades, sem transformar a conversa em um questionário.',
        personaId: persona.personaId || '', personaName: name, sample: persona.sent,
      });
    } else if (persona.responseRate <= Math.max(0, baselineResponse - 5)) {
      recommendations.push({
        id: `persona-review-${normalizeTaxonomyName(persona.personaId || name)}`, severity: 'warning',
        title: `Revise a abordagem de ${name}`,
        message: `A taxa de resposta do perfil é ${persona.responseRate}%, abaixo da média da conta (${baselineResponse}%). Isso não prova que o perfil seja ruim: o público e a mensagem também influenciam.`,
        action: 'Revise a adequação do público, a abertura e o horário. Altere uma variável por vez para conseguir interpretar o próximo teste.',
        personaId: persona.personaId || '', personaName: name, sample: persona.sent,
      });
    }
  }
  return recommendations.slice(0, 20);
}

/** CSV agregado para Excel/Sheets. Não exporta nomes, telefones nem conteúdo de conversas. */
export function buildNicheAnalyticsCsv(summary = {}) {
  const headers = ['Tipo', 'Nicho', 'Subnicho', 'Personalidade IA', 'Campanhas', 'Envios', 'Respostas', 'Taxa de resposta (%)', 'Qualificados', 'Taxa de qualificação (%)', 'Leads quentes', 'Taxa de leads quentes (%)'];
  const rows = [headers];
  const add = (type, item = {}) => rows.push([
    type, item.niche || '', item.subniche || '', item.personaName || '',
    count(item.campaigns), count(item.sent), count(item.responses), Number(item.responseRate) || 0,
    count(item.qualified), Number(item.qualificationRate) || 0, count(item.hot), Number(item.hotRate) || 0,
  ]);
  add('Geral', { ...(summary.totals || {}), campaigns: summary.campaignCount });
  for (const item of Array.isArray(summary.niches) ? summary.niches : []) add('Nicho', item);
  for (const item of Array.isArray(summary.subniches) ? summary.subniches : []) add('Subnicho', item);
  for (const item of Array.isArray(summary.personas) ? summary.personas : []) add('Personalidade IA', item);
  const cell = (value) => `"${String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  return '\uFEFF' + rows.map((row) => row.map(cell).join(';')).join('\r\n');
}

function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0]; prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  return prev[b.length];
}

/** Suggests only sibling subniches with near-identical labels; never merges without user approval. */
export function suggestNicheConsolidations(nodes = []) {
  const active = (Array.isArray(nodes) ? nodes : []).filter((node) => !node?.deletedAt && node?.type === 'niche' && node?.parentId);
  const suggestions = [];
  const seen = new Set();
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      if (a.parentId !== b.parentId) continue;
      const na = normalizeTaxonomyName(a.name), nb = normalizeTaxonomyName(b.name);
      if (na.length < 5 || nb.length < 5) continue;
      const distance = editDistance(na, nb);
      const maxLength = Math.max(na.length, nb.length);
      const exact = na === nb;
      if (!exact && (distance > Math.max(1, Math.floor(maxLength * 0.12)) || Math.min(na.length, nb.length) / maxLength < 0.82)) continue;
      const pairKey = [a.id, b.id].sort().join('|');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      const countA = count(a.leadCount), countB = count(b.leadCount);
      const target = countB > countA ? b : countA > countB ? a : (String(a.name).length <= String(b.name).length ? a : b);
      const source = target.id === a.id ? b : a;
      suggestions.push({
        id: pairKey, sourceId: source.id, sourceName: source.name, sourceLeadCount: count(source.leadCount),
        targetId: target.id, targetName: target.name, targetLeadCount: count(target.leadCount), parentId: a.parentId,
        reason: exact ? 'Nomes equivalentes após normalização (acentos/maiúsculas/espaços).' : 'Nomes muito semelhantes; confirme se representam o mesmo subnicho.',
        confidence: exact ? 'alta' : 'revisar',
      });
    }
  }
  return suggestions.sort((a, b) => (a.confidence === 'alta' ? -1 : 1) - (b.confidence === 'alta' ? -1 : 1) || (b.sourceLeadCount + b.targetLeadCount) - (a.sourceLeadCount + a.targetLeadCount)).slice(0, 100);
}
