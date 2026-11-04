/**
 * i9Hub — gestão local de equipes, metas e comissões.
 * Calcula resultados apenas com vendas fechadas e valores registrados no CRM.
 */
import { commercialStageCategory } from './commercial-performance.js';

const clean = (value, max = 160) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const stamp = (value) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const amount = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1e12 ? money(parsed) : null;
};
const normalizeName = (value) => clean(value, 160).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

function monthWindow(value, now) {
  const fallback = new Date(now);
  const candidate = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || '')) ? String(value) : `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}`;
  const [year, month] = candidate.split('-').map(Number);
  const start = new Date(year, month - 1, 1).getTime();
  const end = new Date(year, month, 1).getTime();
  const days = new Date(year, month, 0).getDate();
  const elapsed = now < start ? 0 : now >= end ? 100 : (now - start) / (end - start) * 100;
  return { key: candidate, start, end, days, elapsedPercent: Math.max(0, Math.min(100, elapsed)), isFuture: now < start, isPast: now >= end };
}

function transitionsFor(lead) {
  return (Array.isArray(lead?.activityLog) ? lead.activityLog : [])
    .filter((event) => event && (event.type === 'lead.stage_changed' || /stage.changed/.test(String(event.type || ''))))
    .map((event) => ({
      from: clean(event.metadata?.from, 120),
      to: clean(event.metadata?.to, 120),
      at: stamp(event.createdAt),
    }))
    .filter((event) => event.to && event.at > 0)
    .sort((a, b) => a.at - b.at);
}

function closedAt(lead) {
  if (commercialStageCategory(lead?.stage) !== 'closed_won') return 0;
  const transitions = transitionsFor(lead);
  return transitions.filter((event) => commercialStageCategory(event.to) === 'closed_won').at(-1)?.at || stamp(lead?.stageUpdatedAt);
}

function findSellerByName(sellers, name) {
  const key = normalizeName(name);
  return key ? sellers.find((seller) => normalizeName(seller.name) === key) || null : null;
}

function ownerAssignments(lead, sellers) {
  const history = Array.isArray(lead?.commercialOwnerHistory) ? lead.commercialOwnerHistory : [];
  const normalized = history.map((entry) => {
    const seller = (entry?.ownerId && sellers.find((item) => item.id === entry.ownerId)) || findSellerByName(sellers, entry?.owner);
    return {
      owner: clean(entry?.owner || seller?.name, 120),
      ownerId: seller?.id || clean(entry?.ownerId, 120),
      teamId: clean(entry?.teamId || '', 120) || seller?.teamAt?.(stamp(entry?.assignedAt)) || seller?.teamId || '',
      assignedAt: stamp(entry?.assignedAt),
      unassignedAt: stamp(entry?.unassignedAt) || 0,
    };
  }).filter((entry) => entry.owner && entry.assignedAt > 0).sort((a, b) => a.assignedAt - b.assignedAt);
  if (normalized.length) return normalized;
  const currentName = clean(lead?.commercialOwner, 120);
  const seller = (lead?.commercialOwnerId && sellers.find((item) => item.id === lead.commercialOwnerId)) || findSellerByName(sellers, currentName);
  if (!currentName && !seller) return [];
  const assignedAt = stamp(lead?.commercialOwnerAssignedAt || lead?.createdAt || lead?.extractedAt);
  return [{ owner: currentName || seller?.name || '', ownerId: seller?.id || '', teamId: clean(lead?.commercialTeamIdAtSale || seller?.teamId, 120), assignedAt, unassignedAt: 0 }];
}

function teamAt(seller, at, assignment) {
  const history = Array.isArray(seller?.teamHistory) ? seller.teamHistory : [];
  const match = history.filter((entry) => stamp(entry?.assignedAt) <= at && (!stamp(entry?.unassignedAt) || stamp(entry?.unassignedAt) >= at)).at(-1);
  return clean(match?.teamId || assignment?.teamId || seller?.teamId, 120);
}

function ownerAt(assignments, at) {
  return assignments.filter((entry) => entry.assignedAt <= at && (!entry.unassignedAt || entry.unassignedAt >= at)).at(-1) || null;
}

function progress(actual, target) {
  return target > 0 ? Math.max(0, actual / target * 100) : null;
}

function goalStatus(attainment, elapsed, isFuture, isPast) {
  if (isFuture) return 'scheduled';
  if (attainment !== null && attainment >= 100) return 'achieved';
  if (isPast) return 'missed';
  if (elapsed < 15) return 'on_track';
  const pace = elapsed > 0 ? (attainment || 0) / elapsed : 0;
  if (pace < 0.5) return 'at_risk';
  if (pace < 0.8) return 'attention';
  return 'on_track';
}

export function buildCommercialManagementReport({ leads = [], config = {}, month = '', now = Date.now() } = {}) {
  const current = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const window = monthWindow(month, current);
  const sellers = (Array.isArray(config?.sellers) ? config.sellers : []).filter((item) => item && item.id).map((item) => ({
    ...item,
    id: clean(item.id, 120),
    name: clean(item.name, 120),
    teamId: clean(item.teamId, 120),
    active: item.active !== false,
    defaultCommissionRate: Math.max(0, Math.min(100, Number(item.defaultCommissionRate) || 0)),
  }));
  for (const seller of sellers) {
    seller.teamAt = (at) => {
      const history = Array.isArray(seller.teamHistory) ? seller.teamHistory : [];
      const match = history.filter((entry) => stamp(entry?.assignedAt) <= at && (!stamp(entry?.unassignedAt) || stamp(entry?.unassignedAt) >= at)).at(-1);
      return clean(match?.teamId || seller.teamId, 120);
    };
  }
  const teams = (Array.isArray(config?.teams) ? config.teams : []).filter((item) => item && item.id).map((item) => ({ ...item, id: clean(item.id, 120), name: clean(item.name, 120), active: item.active !== false }));
  const products = (Array.isArray(config?.products) ? config.products : []).filter((item) => item && item.id).map((item) => ({
    ...item, id: clean(item.id, 120), name: clean(item.name, 160), kind: item.kind === 'service' ? 'service' : 'product',
    commissionRate: Math.max(0, Math.min(100, Number(item.commissionRate) || 0)), active: item.active !== false,
  }));
  const leadRows = (Array.isArray(leads) ? leads : []).map((lead) => {
    const at = closedAt(lead);
    const assignments = ownerAssignments(lead, sellers);
    const assignment = at ? ownerAt(assignments, at) : null;
    const seller = assignment?.ownerId ? sellers.find((item) => item.id === assignment.ownerId) : findSellerByName(sellers, assignment?.owner || lead?.commercialOwner);
    const productIdForSale = lead?.commissionProductIdAtSale || lead?.commercialProductId;
    const product = products.find((item) => item.id === productIdForSale) || products.find((item) => normalizeName(item.name) === normalizeName(lead?.commissionProductNameAtSale || lead?.commercialProductName || lead?.commercialProduct)) || null;
    const saleValue = amount(lead?.saleValue);
    const rawRate = lead?.commissionRateAtSale;
    const hasSnapshot = rawRate !== null && rawRate !== undefined && rawRate !== '' && Number.isFinite(Number(rawRate)) && Number(rawRate) >= 0 && Number(rawRate) <= 100;
    const displayedProductName = clean(lead?.commissionProductNameAtSale || product?.name || lead?.commercialProductName || lead?.commercialProduct, 160);
    const hasUnmatchedProductName = !!clean(lead?.commercialProductName || lead?.commercialProduct, 160) && !product;
    const rate = hasSnapshot ? Number(rawRate) : product ? product.commissionRate : hasUnmatchedProductName ? 0 : (seller?.defaultCommissionRate || 0);
    const commissionAmount = amount(lead?.commissionAmountAtSale) ?? (saleValue !== null ? money(saleValue * rate / 100) : 0);
    const assignedTeamId = clean(lead?.commercialTeamIdAtSale, 120) || teamAt(seller, at, assignment);
    const team = teams.find((item) => item.id === assignedTeamId) || null;
    return {
      lead, closedAt: at, assignments, assignment, seller, sellerId: seller?.id || '', sellerName: seller?.name || assignment?.owner || clean(lead?.commercialOwner, 120) || 'Sem responsável',
      teamId: assignedTeamId, teamName: team?.name || 'Sem equipe', product, productName: displayedProductName || 'Sem produto/serviço',
      saleValue, commissionRate: rate, commissionAmount, commissionStatus: lead?.commissionStatus === 'paid' ? 'paid' : 'pending',
      commissionSnapshotMissing: !hasSnapshot,
    };
  });

  const monthlySales = leadRows.filter((row) => row.closedAt >= window.start && row.closedAt < window.end && row.saleValue !== null && row.saleValue > 0);
  const commissionRows = monthlySales.filter((row) => row.sellerId && row.commissionRate > 0).map((row) => ({
    leadId: clean(row.lead.id || row.lead.placeId || row.lead.phone, 180),
    leadName: clean(row.lead.name || 'Lead sem nome', 140),
    sellerId: row.sellerId, sellerName: row.sellerName, teamName: row.teamName,
    productName: row.productName, saleValue: row.saleValue, commissionRate: row.commissionRate,
    commissionAmount: row.commissionAmount, status: row.commissionStatus,
    paidAt: clean(row.lead.commissionPaidAt || '', 40), snapshotMissing: row.commissionSnapshotMissing,
  })).sort((a, b) => b.commissionAmount - a.commissionAmount || a.sellerName.localeCompare(b.sellerName, 'pt-BR'));

  const sellerMap = new Map(sellers.filter((seller) => seller.active).map((seller) => [seller.id, {
    sellerId: seller.id, sellerName: seller.name, teamId: seller.teamId,
    teamName: teams.find((team) => team.id === seller.teamId)?.name || 'Sem equipe',
    salesClosed: 0, revenue: 0, commissionTotal: 0, commissionPending: 0, commissionPaid: 0,
    revenueTarget: 0, revenueAttainment: null, rank: 0,
  }]));
  const teamMap = new Map(teams.filter((team) => team.active).map((team) => [team.id, {
    teamId: team.id, teamName: team.name, sellers: sellers.filter((seller) => seller.active && seller.teamId === team.id).length,
    salesClosed: 0, revenue: 0, commissionTotal: 0, commissionPending: 0, commissionPaid: 0, revenueTarget: 0, revenueAttainment: null,
  }]));

  for (const row of monthlySales) {
    if (!row.sellerId) continue;
    if (!sellerMap.has(row.sellerId)) sellerMap.set(row.sellerId, { sellerId: row.sellerId, sellerName: row.sellerName, teamId: row.teamId, teamName: row.teamName, salesClosed: 0, revenue: 0, commissionTotal: 0, commissionPending: 0, commissionPaid: 0, revenueTarget: 0, revenueAttainment: null, rank: 0 });
    const seller = sellerMap.get(row.sellerId);
    seller.salesClosed++;
    seller.revenue += row.saleValue;
    seller.commissionTotal += row.commissionAmount;
    if (row.commissionStatus === 'paid') seller.commissionPaid += row.commissionAmount;
    else seller.commissionPending += row.commissionAmount;
    if (row.teamId) {
      if (!teamMap.has(row.teamId)) teamMap.set(row.teamId, { teamId: row.teamId, teamName: row.teamName, sellers: 0, salesClosed: 0, revenue: 0, commissionTotal: 0, commissionPending: 0, commissionPaid: 0, revenueTarget: 0, revenueAttainment: null });
      const team = teamMap.get(row.teamId);
      team.salesClosed++;
      team.revenue += row.saleValue;
      team.commissionTotal += row.commissionAmount;
      if (row.commissionStatus === 'paid') team.commissionPaid += row.commissionAmount;
      else team.commissionPending += row.commissionAmount;
    }
  }

  const goals = (Array.isArray(config?.goals) ? config.goals : []).filter((goal) => goal && goal.month === window.key && goal.active !== false);
  const monthlyAssignedLeads = [];
  for (const lead of Array.isArray(leads) ? leads : []) {
    const assignments = ownerAssignments(lead, sellers);
    for (const assignment of assignments) {
      if (assignment.assignedAt < window.start || assignment.assignedAt >= window.end) continue;
      const seller = sellers.find((item) => item.id === assignment.ownerId) || null;
      monthlyAssignedLeads.push({ lead, sellerId: seller?.id || assignment.ownerId, teamId: teamAt(seller, assignment.assignedAt, assignment) });
    }
  }
  const goalRows = goals.map((goal) => {
    const targetType = goal.targetType === 'team' ? 'team' : 'seller';
    const targetId = clean(goal.targetId, 120);
    const sales = monthlySales.filter((row) => targetType === 'team' ? row.teamId === targetId : row.sellerId === targetId);
    const assignedLeads = new Set(monthlyAssignedLeads.filter((row) => targetType === 'team' ? row.teamId === targetId : row.sellerId === targetId).map((row) => clean(row.lead.id || row.lead.placeId || row.lead.phone, 180))).size;
    const actualRevenue = money(sales.reduce((sum, row) => sum + row.saleValue, 0));
    const actualSales = sales.length;
    const revenueTarget = amount(goal.revenueTarget) || 0;
    const salesTarget = Math.max(0, Number(goal.salesTarget) || 0);
    const leadsTarget = Math.max(0, Number(goal.leadsTarget) || 0);
    const metricValues = [
      { id: 'revenue', target: revenueTarget, actual: actualRevenue },
      { id: 'sales', target: salesTarget, actual: actualSales },
      { id: 'leads', target: leadsTarget, actual: assignedLeads },
    ].filter((item) => item.target > 0).map((item) => ({ ...item, attainmentPercent: progress(item.actual, item.target) }));
    const metric = metricValues[0]?.id || 'leads';
    const primary = metricValues[0] || { target: 0, actual: 0, attainmentPercent: null };
    const attainment = metricValues.length ? Math.min(...metricValues.map((item) => item.attainmentPercent ?? 0)) : null;
    const status = goalStatus(attainment, window.elapsedPercent, window.isFuture, window.isPast);
    const targetName = targetType === 'team' ? teams.find((item) => item.id === targetId)?.name : sellers.find((item) => item.id === targetId)?.name;
    return {
      id: clean(goal.id, 120), targetType, targetId, targetName: targetName || 'Cadastro inativo/não encontrado',
      revenueTarget, salesTarget, leadsTarget, actualRevenue, actualSales, assignedLeads,
      primaryMetric: metric, primaryTarget: primary.target, primaryActual: primary.actual,
      metricProgress: metricValues, attainmentPercent: attainment,
      elapsedPercent: window.elapsedPercent, status,
    };
  });

  for (const goal of goalRows.filter((item) => item.targetType === 'seller')) {
    const seller = sellerMap.get(goal.targetId);
    if (seller && goal.revenueTarget > 0) { seller.revenueTarget += goal.revenueTarget; seller.revenueAttainment = progress(seller.revenue, seller.revenueTarget); }
  }
  for (const goal of goalRows.filter((item) => item.targetType === 'team')) {
    const team = teamMap.get(goal.targetId);
    if (team && goal.revenueTarget > 0) { team.revenueTarget += goal.revenueTarget; team.revenueAttainment = progress(team.revenue, team.revenueTarget); }
  }

  const rankingRows = [...sellerMap.values()].map((row) => ({ ...row,
    revenue: money(row.revenue), commissionTotal: money(row.commissionTotal), commissionPending: money(row.commissionPending), commissionPaid: money(row.commissionPaid),
  })).sort((a, b) => b.revenue - a.revenue || b.salesClosed - a.salesClosed || a.sellerName.localeCompare(b.sellerName, 'pt-BR'));
  rankingRows.forEach((row, index) => { row.rank = index + 1; });
  const teamRows = [...teamMap.values()].map((row) => ({ ...row,
    revenue: money(row.revenue), commissionTotal: money(row.commissionTotal), commissionPending: money(row.commissionPending), commissionPaid: money(row.commissionPaid),
  })).sort((a, b) => b.revenue - a.revenue || a.teamName.localeCompare(b.teamName, 'pt-BR'));

  const productMap = new Map();
  for (const row of monthlySales) {
    const key = row.product?.id || `name:${normalizeName(row.productName)}`;
    if (!productMap.has(key)) productMap.set(key, { productName: row.productName, salesClosed: 0, revenue: 0, commissionTotal: 0, commissionPending: 0, commissionPaid: 0 });
    const product = productMap.get(key);
    product.salesClosed++;
    product.revenue += row.saleValue;
    product.commissionTotal += row.commissionAmount;
    if (row.commissionStatus === 'paid') product.commissionPaid += row.commissionAmount;
    else product.commissionPending += row.commissionAmount;
  }
  const productRows = [...productMap.values()].map((row) => ({ ...row, revenue: money(row.revenue), commissionTotal: money(row.commissionTotal), commissionPending: money(row.commissionPending), commissionPaid: money(row.commissionPaid) })).sort((a, b) => b.revenue - a.revenue);

  const commissionTotal = money(commissionRows.reduce((sum, row) => sum + row.commissionAmount, 0));
  const commissionPaid = money(commissionRows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.commissionAmount, 0));
  const commissionPending = money(commissionTotal - commissionPaid);
  const revenue = money(monthlySales.reduce((sum, row) => sum + row.saleValue, 0));
  const salesWithoutSeller = monthlySales.filter((row) => !row.sellerId).length;
  const salesWithoutCommissionRule = monthlySales.filter((row) => row.sellerId && row.commissionRate <= 0).length;
  const goalsAtRisk = goalRows.filter((row) => ['at_risk', 'attention', 'missed'].includes(row.status)).length;

  return {
    generatedAt: new Date(current).toISOString(),
    period: { month: window.key, label: `${window.key.slice(5, 7)}/${window.key.slice(0, 4)}`, days: window.days, elapsedPercent: window.elapsedPercent, isFuture: window.isFuture, isPast: window.isPast },
    metrics: { revenue, salesClosed: monthlySales.length, commissionTotal, commissionPending, commissionPaid, activeSellers: sellers.filter((item) => item.active).length, activeTeams: teams.filter((item) => item.active).length, goalsCount: goalRows.length, goalsAtRisk, salesWithoutSeller, salesWithoutCommissionRule },
    rankingRows, teamRows, goalRows, commissionRows, productRows,
    notes: {
      revenue: 'Receita considera somente leads em etapa de ganho, com data de fechamento rastreável e valor efetivamente vendido informado.',
      commission: 'Comissão = valor efetivamente vendido × percentual vigente no snapshot da venda. Regras antigas sem snapshot usam a regra atual e são sinalizadas para revisão.',
      goalRisk: 'Risco é um alerta de ritmo linear: compara o percentual da meta atingido com o percentual do mês transcorrido. Não é previsão estatística.',
      attribution: 'A atribuição por vendedor/equipe usa o histórico disponível no momento do fechamento; registros antigos sem histórico não são atribuídos artificialmente.',
    },
  };
}

export function validateCommercialMonth(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''));
}
