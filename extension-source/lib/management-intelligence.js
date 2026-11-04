/**
 * i9Hub — inteligência gerencial comercial.
 * A camada determinística trabalha localmente com dados agregados do CRM.
 * A IA recebe somente um resumo agregado, nunca mensagens, telefones ou nomes de leads.
 */
import { commercialStageCategory } from './commercial-performance.js';

const DAY = 86400000;
const clean = (value, max = 180) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const dateMs = (value) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
};
const numeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
const money = (value) => Math.round(numeric(value) * 100) / 100;
const monthKey = (value, now) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''))
  ? String(value)
  : `${new Date(now).getFullYear()}-${String(new Date(now).getMonth() + 1).padStart(2, '0')}`;

function stageLabel(lead, stages) {
  const id = clean(lead?.stage, 120);
  return clean(stages.find((stage) => stage.id === id)?.title || lead?.stageTitle || id || 'Sem etapa', 120);
}
function stageTimestamp(lead) {
  const history = Array.isArray(lead?.activityLog) ? lead.activityLog : [];
  const transitions = history
    .filter((event) => event && (event.type === 'lead.stage_changed' || /stage.changed/.test(String(event.type || ''))))
    .map((event) => dateMs(event.createdAt)).filter(Boolean);
  if (dateMs(lead?.stageUpdatedAt)) return { at: dateMs(lead.stageUpdatedAt), source: 'stage_updated' };
  if (transitions.length) return { at: Math.max(...transitions), source: 'stage_history' };
  if (dateMs(lead?.createdAt || lead?.extractedAt)) return { at: dateMs(lead.createdAt || lead.extractedAt), source: 'lead_created' };
  return { at: 0, source: 'unknown' };
}
function nicheOf(lead) {
  const candidates = [
    lead?.aiNicheClassification?.path,
    lead?.aiIntelligence?.nicheClassification?.path,
    lead?.aiQualification?.nicheClassification?.path,
    lead?.aiNicheClassification?.name,
    lead?.aiIntelligence?.segment,
    lead?.aiQualification?.segment,
    lead?.segment,
    lead?.niche,
    lead?.industry,
  ];
  for (const candidate of candidates) {
    const value = Array.isArray(candidate) ? candidate.map((part) => clean(part, 80)).filter(Boolean).join(' > ') : clean(candidate, 120);
    if (value) return value;
  }
  return 'Não classificado';
}
function closeTimestamp(lead) {
  if (commercialStageCategory(lead?.stage) !== 'closed_won') return 0;
  const history = Array.isArray(lead?.activityLog) ? lead.activityLog : [];
  const matches = history.filter((event) => event && (event.type === 'lead.stage_changed' || /stage.changed/.test(String(event.type || '')))
    && commercialStageCategory(event.metadata?.to) === 'closed_won').map((event) => dateMs(event.createdAt)).filter(Boolean);
  return matches.at(-1) || dateMs(lead?.stageUpdatedAt);
}

export function buildManagementIntelligence({ leads = [], managementReport = {}, stages = [], month = '', now = Date.now(), staleDays = 7 } = {}) {
  const current = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const selectedMonth = monthKey(month || managementReport?.period?.month, current);
  const [year, monthNumber] = selectedMonth.split('-').map(Number);
  const start = new Date(year, monthNumber - 1, 1).getTime();
  const end = new Date(year, monthNumber, 1).getTime();
  const period = managementReport?.period || {};
  const isFuture = period.isFuture === true || current < start;
  const isPast = period.isPast === true || current >= end;
  const elapsedPercent = Math.max(0, Math.min(100, Number(period.elapsedPercent) || 0));
  const metrics = managementReport?.metrics || {};
  const goals = Array.isArray(managementReport?.goalRows) ? managementReport.goalRows : [];
  const sellerGoals = goals.filter((goal) => goal.targetType === 'seller' && numeric(goal.revenueTarget) > 0);
  const teamGoals = goals.filter((goal) => goal.targetType === 'team' && numeric(goal.revenueTarget) > 0);
  // Evita somar metas individuais e coletivas em duplicidade no consolidado.
  const revenueGoalRows = sellerGoals.length ? sellerGoals : teamGoals;
  const revenueTarget = money(revenueGoalRows.reduce((sum, goal) => sum + numeric(goal.revenueTarget), 0));
  const actualRevenue = money(metrics.revenue);
  const elapsedFraction = elapsedPercent / 100;
  let projectedRevenue = null;
  if (isPast) projectedRevenue = actualRevenue;
  else if (!isFuture && elapsedFraction >= 0.10) projectedRevenue = money(actualRevenue / elapsedFraction);
  const goalAttainment = revenueTarget > 0 ? Math.round(actualRevenue / revenueTarget * 1000) / 10 : null;
  const projectedAttainment = revenueTarget > 0 && projectedRevenue !== null ? Math.round(projectedRevenue / revenueTarget * 1000) / 10 : null;
  const daysRemaining = isPast ? 0 : Math.max(0, Math.ceil((end - current) / DAY));

  const stageNames = Array.isArray(stages) ? stages : [];
  const staleLimit = Math.max(1, Math.min(90, Number(staleDays) || 7));
  const openLeads = (Array.isArray(leads) ? leads : []).filter((lead) => !['closed_won', 'closed_lost', 'excluded'].includes(commercialStageCategory(lead?.stage)));
  const stalledAll = openLeads.map((lead) => {
    const timestamp = stageTimestamp(lead);
    const ageDays = timestamp.at ? Math.max(0, Math.floor((current - timestamp.at) / DAY)) : null;
    return {
      id: clean(lead?.id || lead?.placeId || lead?.phone, 180),
      name: clean(lead?.name || lead?.contactName || lead?.company || lead?.title || 'Lead sem nome', 140),
      stage: stageLabel(lead, stageNames),
      stageId: clean(lead?.stage, 120),
      owner: clean(lead?.commercialOwner, 120) || 'Sem responsável',
      ageDays,
      ageSource: timestamp.source,
      dealValue: money(lead?.dealValue),
      niche: nicheOf(lead),
    };
  }).filter((row) => row.ageDays !== null && row.ageDays >= staleLimit)
    .sort((a, b) => b.ageDays - a.ageDays || b.dealValue - a.dealValue);
  const stalledCount = stalledAll.length;
  const stalledRows = stalledAll.slice(0, 30);

  const segmentMap = new Map();
  for (const lead of Array.isArray(leads) ? leads : []) {
    const category = commercialStageCategory(lead?.stage);
    if (category === 'excluded') continue;
    const niche = nicheOf(lead);
    if (!segmentMap.has(niche)) segmentMap.set(niche, { segment: niche, leads: 0, openOpportunities: 0, pipelineValue: 0, salesClosed: 0, revenue: 0 });
    const row = segmentMap.get(niche);
    row.leads++;
    if (!['closed_won', 'closed_lost'].includes(category)) {
      row.openOpportunities++;
      row.pipelineValue += numeric(lead?.dealValue);
    }
    const closedAt = closeTimestamp(lead);
    if (category === 'closed_won' && closedAt >= start && closedAt < end) {
      row.salesClosed++;
      row.revenue += numeric(lead?.saleValue);
    }
  }
  const segmentRows = [...segmentMap.values()].map((row) => ({ ...row, pipelineValue: money(row.pipelineValue), revenue: money(row.revenue) }))
    .sort((a, b) => b.revenue - a.revenue || b.pipelineValue - a.pipelineValue || b.leads - a.leads).slice(0, 12);

  const riskGoals = goals.filter((goal) => ['at_risk', 'attention', 'missed'].includes(goal.status))
    .map((goal) => ({ targetType: goal.targetType, targetName: clean(goal.targetName, 120), status: goal.status,
      attainmentPercent: goal.attainmentPercent === null ? null : Number(goal.attainmentPercent),
      actualRevenue: money(goal.actualRevenue), revenueTarget: money(goal.revenueTarget),
      actualSales: numeric(goal.actualSales), salesTarget: numeric(goal.salesTarget),
      assignedLeads: numeric(goal.assignedLeads), leadsTarget: numeric(goal.leadsTarget) }));
  const sellerRows = (Array.isArray(managementReport?.rankingRows) ? managementReport.rankingRows : []).map((row) => ({
    sellerName: clean(row.sellerName, 120), teamName: clean(row.teamName, 120),
    revenue: money(row.revenue), salesClosed: numeric(row.salesClosed),
    goalTarget: money(row.revenueTarget), goalAttainment: row.revenueAttainment === null ? null : Number(row.revenueAttainment),
    commissionPending: money(row.commissionPending),
  }));
  const teamRows = (Array.isArray(managementReport?.teamRows) ? managementReport.teamRows : []).map((row) => ({
    teamName: clean(row.teamName, 120), revenue: money(row.revenue), salesClosed: numeric(row.salesClosed),
    goalTarget: money(row.revenueTarget), goalAttainment: row.revenueAttainment === null ? null : Number(row.revenueAttainment),
  }));
  const productRows = (Array.isArray(managementReport?.productRows) ? managementReport.productRows : []).slice(0, 10).map((row) => ({
    productName: clean(row.productName, 120), salesClosed: numeric(row.salesClosed),
    revenue: money(row.revenue), commissionTotal: money(row.commissionTotal),
  }));

  const recommendations = [];
  if (riskGoals.length) recommendations.push({ priority: 'high', title: 'Plano de recuperação de metas', detail: `${riskGoals.length} meta(s) estão em atenção, risco ou encerraram abaixo do alvo. Revise a carteira, a cadência de contato e a distribuição de oportunidades.` });
  if (stalledCount) recommendations.push({ priority: 'high', title: 'Retomar oportunidades paradas', detail: `${stalledCount} oportunidade(s) abertas estão sem mudança de etapa há pelo menos ${staleLimit} dias. Priorize as de maior valor estimado e confirme se ainda estão ativas.` });
  if (numeric(metrics.salesWithoutSeller) > 0) recommendations.push({ priority: 'medium', title: 'Completar atribuição comercial', detail: `${numeric(metrics.salesWithoutSeller)} venda(s) não têm vendedor associado e podem distorcer o ranking e a análise por equipe.` });
  if (numeric(metrics.salesWithoutCommissionRule) > 0) recommendations.push({ priority: 'medium', title: 'Revisar regras de comissão', detail: `${numeric(metrics.salesWithoutCommissionRule)} venda(s) estão sem regra positiva de comissão cadastrada.` });
  if (!goals.length) recommendations.push({ priority: 'medium', title: 'Cadastrar metas mensais', detail: 'Sem metas configuradas, o sistema não consegue medir atingimento nem alertar sobre risco de desempenho.' });
  if (!stalledRows.length && !riskGoals.length && goals.length) recommendations.push({ priority: 'low', title: 'Manter rotina de acompanhamento', detail: 'Não foram encontrados alertas de metas ou oportunidades paradas segundo os critérios atuais. Continue registrando etapas e resultados para manter os indicadores confiáveis.' });

  return {
    generatedAt: new Date(current).toISOString(),
    period: { month: selectedMonth, label: `${selectedMonth.slice(5, 7)}/${selectedMonth.slice(0, 4)}`, elapsedPercent, daysRemaining, isFuture, isPast },
    forecast: {
      actualRevenue, revenueTarget, goalAttainment, projectedRevenue,
      projectedAttainment, daysRemaining,
      method: isPast ? 'resultado do mês encerrado' : projectedRevenue === null ? 'dados insuficientes para ritmo linear' : 'projeção linear pelo ritmo acumulado',
      disclaimer: 'Estimativa indicativa: extrapola o ritmo observado no mês. Não considera sazonalidade, datas de recebimento, estornos ou vendas futuras ainda não registradas.',
    },
    metrics: {
      stalledOpportunities: stalledCount,
      openOpportunities: openLeads.length,
      activeGoals: goals.length,
      goalsAtRisk: riskGoals.length,
      salesWithoutSeller: numeric(metrics.salesWithoutSeller),
      salesWithoutCommissionRule: numeric(metrics.salesWithoutCommissionRule),
    },
    riskGoals, sellerRows, teamRows, productRows, segmentRows, stalledRows, recommendations,
    dataQuality: {
      unclassifiedLeads: segmentRows.find((row) => row.segment === 'Não classificado')?.leads || 0,
      stalledWithoutStageHistory: stalledAll.filter((row) => row.ageSource === 'lead_created').length,
      staleThresholdDays: staleLimit,
    },
    aiContext: {
      period: selectedMonth,
      forecast: { actualRevenue, revenueTarget, goalAttainment, projectedRevenue, projectedAttainment, daysRemaining, method: isPast ? 'month_closed' : 'linear_run_rate' },
      metrics: { stalledOpportunities: stalledRows.length, openOpportunities: openLeads.length, activeGoals: goals.length, goalsAtRisk: riskGoals.length, salesWithoutSeller: numeric(metrics.salesWithoutSeller), salesWithoutCommissionRule: numeric(metrics.salesWithoutCommissionRule) },
      goalAlerts: riskGoals.map((goal, index) => ({ target: `${goal.targetType === 'team' ? 'Equipe' : 'Vendedor'} ${index + 1}`, status: goal.status, attainmentPercent: goal.attainmentPercent, revenueTarget: goal.revenueTarget, actualRevenue: goal.actualRevenue })),
      sellerPerformance: sellerRows.map((row, index) => ({ seller: `Vendedor ${index + 1}`, revenue: row.revenue, salesClosed: row.salesClosed, goalTarget: row.goalTarget, goalAttainment: row.goalAttainment })),
      teamPerformance: teamRows.map((row, index) => ({ team: `Equipe ${index + 1}`, revenue: row.revenue, salesClosed: row.salesClosed, goalTarget: row.goalTarget, goalAttainment: row.goalAttainment })),
      segmentPerformance: segmentRows.slice(0, 8).map((row) => ({ segment: row.segment, leads: row.leads, openOpportunities: row.openOpportunities, pipelineValue: row.pipelineValue, salesClosed: row.salesClosed, revenue: row.revenue })),
      productPerformance: productRows.slice(0, 8).map((row) => ({ product: `Item ${row.productName ? productRows.indexOf(row) + 1 : 0}`, salesClosed: row.salesClosed, revenue: row.revenue })),
    },
  };
}

export function buildManagementIntelligencePrompt(context = {}) {
  return [
    'Você é um analista comercial sênior. Analise somente os indicadores agregados fornecidos em JSON.',
    'Não invente números, metas, causas, sazonalidade ou tendências que não estejam nos dados.',
    'Não identifique pessoas. Os nomes de vendedores, equipes, clientes e produtos foram anonimizados ou omitidos.',
    'Não solicite nem revele mensagens, telefones, e-mails, nomes de leads ou dados pessoais.',
    'Entregue em português do Brasil, com estes títulos: Diagnóstico executivo; Riscos prioritários; Oportunidades; Plano de ação para os próximos 7 dias; Limitações dos dados.',
    'Diferencie fato observado de hipótese. Quando a amostra for pequena ou não houver histórico, declare a limitação.',
    'Para previsões, trate projeção linear como cenário indicativo, não como garantia.',
  ].join(' ') + '\n\nIndicadores agregados:\n' + JSON.stringify(context).slice(0, 18000);
}
