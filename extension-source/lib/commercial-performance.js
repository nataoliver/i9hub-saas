/**
 * i9Hub — inteligência de performance comercial.
 * Agregação determinística sobre registros locais do CRM; sem inferir vendas ou atribuição ausentes.
 */
const DAY_MS = 24 * 60 * 60_000;
const cleanText = (value, max = 140) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const timestamp = (value) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
};
const amount = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1e12 ? Math.round(parsed * 100) / 100 : null;
};
export function commercialStageCategory(value) {
  const stage = cleanText(value, 120).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/fechad|ganh|vend|cliente|won|closed/.test(stage)) return 'closed_won';
  if (/perdid|recus|lost/.test(stage)) return 'closed_lost';
  if (/black|spam/.test(stage)) return 'excluded';
  if (/oportun|propost|negoci|qualific/.test(stage)) return 'opportunity';
  return stage ? 'open' : 'unknown';
}
function leadId(lead) {
  return cleanText(lead?.id || lead?.placeId || lead?.phone, 180);
}
function leadCreatedAt(lead) {
  return timestamp(lead?.createdAt || lead?.extractedAt || lead?.opportunityCreatedAt);
}
function stageTransitions(lead) {
  return (Array.isArray(lead?.activityLog) ? lead.activityLog : [])
    .filter((event) => event && (event.type === 'lead.stage_changed' || /stage.changed/.test(String(event.type || ''))))
    .map((event) => ({
      from: cleanText(event.metadata?.from, 120),
      to: cleanText(event.metadata?.to, 120),
      at: timestamp(event.createdAt),
    }))
    .filter((event) => event.to && event.at > 0)
    .sort((a, b) => a.at - b.at);
}
function ownerHistory(lead) {
  const source = Array.isArray(lead?.commercialOwnerHistory) ? lead.commercialOwnerHistory : [];
  const history = source.map((item) => ({
    owner: cleanText(item?.owner, 120),
    assignedAt: timestamp(item?.assignedAt),
    unassignedAt: timestamp(item?.unassignedAt) || 0,
  })).filter((item) => item.owner && item.assignedAt > 0);
  if (!history.length && cleanText(lead?.commercialOwner, 120)) {
    const assignedAt = timestamp(lead?.commercialOwnerAssignedAt);
    if (assignedAt) history.push({ owner: cleanText(lead.commercialOwner, 120), assignedAt, unassignedAt: 0 });
  }
  return history.sort((a, b) => a.assignedAt - b.assignedAt);
}
function ownerAt(lead, at) {
  const history = ownerHistory(lead);
  const match = history.filter((item) => item.assignedAt <= at && (!item.unassignedAt || item.unassignedAt >= at)).at(-1);
  return match?.owner || '';
}
function closureAt(lead, transitions) {
  if (commercialStageCategory(lead?.stage) !== 'closed_won') return 0;
  const fromHistory = transitions.filter((item) => commercialStageCategory(item.to) === 'closed_won').at(-1)?.at || 0;
  return fromHistory || timestamp(lead?.stageUpdatedAt);
}
function defaultStageProbability(stage) {
  const id = cleanText(stage?.id, 120).toLowerCase();
  const defaults = { novo: 10, contatado: 20, qualificado: 35, proposta: 60 };
  if (Object.prototype.hasOwnProperty.call(defaults, id)) return defaults[id];
  return commercialStageCategory(stage?.id) === 'opportunity' ? 40 : 15;
}
function probabilityFor(stage, config) {
  const configured = Number(config?.[stage.id]);
  const probability = Number.isFinite(configured) ? configured : defaultStageProbability(stage);
  return Math.max(0, Math.min(100, probability));
}
function inPeriod(value, start, end) {
  return value > 0 && value >= start && value <= end;
}
function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function buildCommercialPerformanceReport({
  leads = [],
  stages = [],
  rangeDays = 30,
  stageProbabilities = {},
  now = Date.now(),
} = {}) {
  const current = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const validDays = [30, 90, 365, 0].includes(Number(rangeDays)) ? Number(rangeDays) : 30;
  const start = validDays === 0 ? 0 : current - validDays * DAY_MS;
  const list = Array.isArray(leads) ? leads : [];
  const stageList = Array.isArray(stages) ? stages.filter((item) => item?.id).map((item) => ({ id: cleanText(item.id, 120), title: cleanText(item.title || item.id, 120) })) : [];
  const probabilityConfig = {};
  for (const stage of stageList) probabilityConfig[stage.id] = probabilityFor(stage, stageProbabilities);

  const prepared = list.map((lead) => {
    const id = leadId(lead);
    const transitions = stageTransitions(lead);
    const createdAt = leadCreatedAt(lead);
    const closedAt = closureAt(lead, transitions);
    const dealValue = amount(lead?.dealValue);
    const saleValue = amount(lead?.saleValue);
    const ownerTimeline = ownerHistory(lead);
    const currentOwner = ownerAt(lead, current);
    const stageEntry = transitions.filter((item) => item.to === String(lead?.stage || '')).at(-1)?.at || timestamp(lead?.stageUpdatedAt);
    return { lead, id, transitions, createdAt, closedAt, dealValue, saleValue, ownerTimeline, currentOwner, stageEntry };
  }).filter((item) => item.id);

  const createdInPeriod = prepared.filter((item) => inPeriod(item.createdAt, start, current) && commercialStageCategory(item.lead.stage) !== 'excluded');
  const cohortConverted = createdInPeriod.filter((item) => commercialStageCategory(item.lead.stage) === 'closed_won');
  const closedInPeriod = prepared.filter((item) => item.closedAt && inPeriod(item.closedAt, start, current));
  const closedWithValue = closedInPeriod.filter((item) => item.saleValue !== null && item.saleValue > 0);
  const closingDurations = closedInPeriod
    .filter((item) => item.createdAt && item.closedAt >= item.createdAt)
    .map((item) => (item.closedAt - item.createdAt) / DAY_MS);
  const activePipeline = prepared.filter((item) => !['closed_won', 'closed_lost', 'excluded'].includes(commercialStageCategory(item.lead.stage)));

  const meetings = [];
  for (const item of prepared) {
    for (const event of Array.isArray(item.lead.calendarEvents) ? item.lead.calendarEvents : []) {
      if (!event || event.status === 'cancelled' || !['completed', 'no_show'].includes(event.outcome)) continue;
      const at = timestamp(event.outcomeAt || event.end || event.start);
      if (!inPeriod(at, start, current)) continue;
      meetings.push({
        leadId: item.id,
        outcome: event.outcome,
        at,
        owner: ownerAt(item.lead, at),
      });
    }
  }
  const completedMeetings = meetings.filter((item) => item.outcome === 'completed');
  const noShowMeetings = meetings.filter((item) => item.outcome === 'no_show');
  const attendanceDenominator = completedMeetings.length + noShowMeetings.length;

  let pipelineValue = 0;
  let weightedForecast = 0;
  let opportunitiesWithoutValue = 0;
  for (const item of activePipeline) {
    const stage = stageList.find((entry) => entry.id === String(item.lead.stage || ''));
    const probability = stage ? probabilityConfig[stage.id] : 15;
    if (item.dealValue === null || item.dealValue <= 0) {
      opportunitiesWithoutValue++;
      continue;
    }
    pipelineValue += item.dealValue;
    weightedForecast += item.dealValue * probability / 100;
  }

  const sellerMap = new Map();
  const getSeller = (name) => {
    const key = name || 'Sem responsável';
    if (!sellerMap.has(key)) sellerMap.set(key, {
      seller: key, leadsAssigned: 0, cohortWon: 0, cohortConversionRate: 0,
      salesClosed: 0, recordedRevenue: 0, salesWithoutValue: 0,
      meetingsCompleted: 0, meetingsNoShow: 0, attendanceRate: null,
    });
    return sellerMap.get(key);
  };
  let unassignedCreatedLeads = 0;
  for (const item of prepared) {
    if (commercialStageCategory(item.lead.stage) === 'excluded') continue;
    const assignmentsInPeriod = [...new Set(item.ownerTimeline.filter((entry) => inPeriod(entry.assignedAt, start, current)).map((entry) => entry.owner))];
    for (const owner of assignmentsInPeriod) {
      const seller = getSeller(owner);
      seller.leadsAssigned++;
      if (commercialStageCategory(item.lead.stage) === 'closed_won') {
        const closureOwner = item.closedAt ? ownerAt(item.lead, item.closedAt) : item.currentOwner;
        if (closureOwner === owner) seller.cohortWon++;
      }
    }
  }
  for (const item of createdInPeriod) {
    if (!item.currentOwner) unassignedCreatedLeads++;
  }
  for (const item of closedInPeriod) {
    const seller = getSeller(ownerAt(item.lead, item.closedAt));
    seller.salesClosed++;
    if (item.saleValue !== null && item.saleValue > 0) seller.recordedRevenue += item.saleValue;
    else seller.salesWithoutValue++;
  }
  for (const meeting of meetings) {
    const seller = getSeller(meeting.owner);
    if (meeting.outcome === 'completed') seller.meetingsCompleted++;
    else seller.meetingsNoShow++;
  }
  const sellerRows = [...sellerMap.values()].map((seller) => ({
    ...seller,
    recordedRevenue: money(seller.recordedRevenue),
    cohortConversionRate: seller.leadsAssigned ? seller.cohortWon / seller.leadsAssigned * 100 : null,
    attendanceRate: seller.meetingsCompleted + seller.meetingsNoShow
      ? seller.meetingsCompleted / (seller.meetingsCompleted + seller.meetingsNoShow) * 100 : null,
  })).sort((a, b) => b.recordedRevenue - a.recordedRevenue || b.salesClosed - a.salesClosed || b.leadsAssigned - a.leadsAssigned || a.seller.localeCompare(b.seller, 'pt-BR'));

  const stageRows = stageList.map((stage) => {
    const currentStageLeads = prepared.filter((item) => String(item.lead.stage || '') === stage.id);
    const activeStageLeads = currentStageLeads.filter((item) => !['closed_won', 'closed_lost', 'excluded'].includes(commercialStageCategory(item.lead.stage)));
    const enteredByTransition = prepared.reduce((sum, item) => sum + item.transitions.filter((transition) => transition.to === stage.id && inPeriod(transition.at, start, current)).length, 0);
    const enteredAtLeadCreation = prepared.filter((item) => {
      const initialStage = item.transitions[0]?.from || (item.transitions.length === 0 && stage.id === stageList[0]?.id ? stage.id : '');
      return initialStage === stage.id && inPeriod(item.createdAt, start, current);
    }).length;
    const enteredInPeriod = enteredByTransition + enteredAtLeadCreation;
    const movedOutInPeriod = prepared.reduce((sum, item) => sum + item.transitions.filter((transition) => transition.from === stage.id && inPeriod(transition.at, start, current)).length, 0);
    const values = activeStageLeads.map((item) => item.dealValue).filter((value) => value !== null && value > 0);
    const stagePipelineValue = money(values.reduce((sum, value) => sum + value, 0));
    const probability = probabilityConfig[stage.id];
    const days = currentStageLeads.map((item) => item.stageEntry && item.stageEntry <= current ? (current - item.stageEntry) / DAY_MS : null).filter((value) => value !== null && value >= 0);
    return {
      id: stage.id, title: stage.title, probability,
      currentLeads: currentStageLeads.length,
      enteredInPeriod,
      movedOutInPeriod,
      pipelineValue: stagePipelineValue,
      weightedForecast: money(stagePipelineValue * probability / 100),
      averageDaysInStage: days.length ? days.reduce((sum, value) => sum + value, 0) / days.length : null,
      leadsWithStageAge: days.length,
      leadsWithoutDealValue: activeStageLeads.filter((item) => item.dealValue === null || item.dealValue <= 0).length,
    };
  });

  const salesRevenue = money(closedWithValue.reduce((sum, item) => sum + item.saleValue, 0));
  const salesWithoutValue = closedInPeriod.length - closedWithValue.length;
  const leadsWithoutOwner = prepared.filter((item) => commercialStageCategory(item.lead.stage) !== 'excluded' && !item.currentOwner).length;
  const closedWonWithoutDate = prepared.filter((item) => commercialStageCategory(item.lead.stage) === 'closed_won' && !item.closedAt).length;
  return {
    generatedAt: new Date(current).toISOString(),
    period: {
      rangeDays: validDays,
      start: start ? new Date(start).toISOString() : '',
      end: new Date(current).toISOString(),
      label: validDays === 0 ? 'Todo o histórico disponível' : `Últimos ${validDays} dias`,
    },
    metrics: {
      leadsCreated: createdInPeriod.length,
      cohortConverted: cohortConverted.length,
      cohortConversionRate: createdInPeriod.length ? cohortConverted.length / createdInPeriod.length * 100 : null,
      salesClosed: closedInPeriod.length,
      salesRevenue,
      salesWithoutValue,
      averageClosingDays: closingDurations.length ? closingDurations.reduce((sum, value) => sum + value, 0) / closingDurations.length : null,
      completedMeetings: completedMeetings.length,
      noShowMeetings: noShowMeetings.length,
      attendanceRate: attendanceDenominator ? completedMeetings.length / attendanceDenominator * 100 : null,
      meetingsWithOutcome: attendanceDenominator,
      openOpportunities: activePipeline.length,
      pipelineValue: money(pipelineValue),
      weightedForecast: money(weightedForecast),
      opportunitiesWithoutValue,
      leadsWithoutOwner,
      unassignedCreatedLeads,
      closedWonWithoutDate,
    },
    sellerRows,
    stageRows,
    stageProbabilities: probabilityConfig,
    notes: {
      revenue: 'Receita considera somente saleValue informado em leads fechados como ganho dentro do período.',
      conversion: 'Conversão é uma coorte: leads criados no período que atualmente estão em etapa de ganho.',
      attendance: 'Comparecimento considera somente reuniões com resultado Realizada ou Não compareceu. Cancelamentos e reuniões sem resultado ficam fora do denominador.',
      forecast: 'Previsão ponderada = valor estimado da oportunidade (dealValue) × probabilidade configurada para a etapa. Não é faturamento realizado nem previsão por data.',
      attribution: 'A atribuição por vendedor começa quando o responsável comercial é registrado no lead. O histórico não é retroativo.',
      closingTime: 'Tempo de fechamento é calculado somente quando existe data de entrada e evento de fechamento rastreável no histórico.',
    },
  };
}
