import { DEFAULT_LEAD_SCORING_CONFIG, normalizeLeadScoringConfig, scoreLead, leadNicheLabels } from './lead-scoring.js';

const digits = (value) => String(value ?? '').replace(/\D/g, '');
const text = (value) => String(value ?? '').trim();
const safeDate = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 0 ? value : null;
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : null;
};
const pct = (numerator, denominator) => denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;

function phoneKey(value) {
  const d = digits(value);
  return d.length >= 10 ? d : '';
}
function phoneTail(value) {
  const d = phoneKey(value);
  return d ? d.slice(-10) : '';
}
function buildLeadIndexes(leads = []) {
  const exact = new Map();
  const tails = new Map();
  for (const lead of Array.isArray(leads) ? leads : []) {
    const key = phoneKey(lead?.phone);
    if (!key) continue;
    if (!exact.has(key)) exact.set(key, lead);
    const tail = phoneTail(key);
    if (tail) {
      if (!tails.has(tail)) tails.set(tail, lead);
      else if (tails.get(tail) !== lead) tails.set(tail, null);
    }
  }
  return { exact, tails };
}
function findLead(contact, indexes) {
  const key = phoneKey(contact?.phone);
  if (!key) return null;
  return indexes.exact.get(key) || indexes.tails.get(phoneTail(key)) || null;
}
function contactSendAt(campaign, contact, lead = null) {
  const explicit = safeDate(contact?.sentAt);
  if (explicit !== null) return explicit;
  const targetPhone = phoneKey(contact?.phone);
  const logs = Array.isArray(campaign?.log) ? campaign.log : [];
  const sentLog = logs
    .filter((entry) => entry?.success === true && entry?.skipped !== true && phoneKey(entry?.phone) === targetPhone && safeDate(entry?.timestamp) !== null)
    .sort((a, b) => safeDate(a.timestamp) - safeDate(b.timestamp))[0];
  if (sentLog) return safeDate(sentLog.timestamp);
  // Compatibilidade com campanhas antigas cujos logs por contato já foram truncados.
  const legacySentAt = safeDate(lead?.lastCampaignSentAt);
  const campaignStart = safeDate(campaign?.createdAt);
  const campaignEnd = safeDate(campaign?.finishedAt) ?? Date.now();
  if (legacySentAt !== null && (campaignStart === null || legacySentAt >= campaignStart) && legacySentAt <= campaignEnd) return legacySentAt;
  return null;
}
function leadInboundTimes(lead) {
  const evidence = lead?.tipoEvidence || lead?.classifierEvidence || {};
  const times = (Array.isArray(evidence.incomingTimestamps) ? evidence.incomingTimestamps : [])
    .map((value) => safeDate(value)).filter((value) => value !== null);
  const last = safeDate(evidence.lastIncomingAt || lead?.lastIncomingAt);
  if (last !== null) times.push(last);
  return [...new Set(times)].sort((a, b) => a - b);
}
function leadNiche(lead) {
  const classification = lead?.aiNicheClassification && typeof lead.aiNicheClassification === 'object' ? lead.aiNicheClassification : {};
  const qualification = lead?.aiQualification && typeof lead.aiQualification === 'object' ? lead.aiQualification : {};
  const nested = qualification.nicheClassification && typeof qualification.nicheClassification === 'object' ? qualification.nicheClassification : {};
  const path = Array.isArray(classification.path) && classification.path.length ? classification.path
    : Array.isArray(nested.path) && nested.path.length ? nested.path
      : Array.isArray(lead?.nichePath) ? lead.nichePath : [];
  const primary = text(classification.primaryNiche || nested.primaryNiche || path[0] || lead?.niche || lead?.category) || 'Não identificado';
  const sub = text(classification.subniche || nested.subniche || (Array.isArray(classification.subniches) ? classification.subniches[0] : '') || (Array.isArray(nested.subniches) ? nested.subniches[0] : '') || path[1] || lead?.subniche) || 'Não identificado';
  const labels = leadNicheLabels(lead);
  return { primary, sub, path: labels.length ? labels : [primary, ...(sub !== 'Não identificado' ? [sub] : [])] };
}
function compactLead(contact, lead, score, response, tracking) {
  const niche = lead ? leadNiche(lead) : { primary: 'Não identificado', sub: 'Não identificado', path: [] };
  return {
    id: String(lead?.id || lead?.placeId || contact?.leadId || contact?.phone || ''),
    name: text(contact?.name || lead?.name || lead?.company) || 'Sem nome',
    phone: text(contact?.phone || lead?.phone),
    stage: text(lead?.stage) || 'Não identificado',
    score: lead ? score.score : null,
    scoreStatus: lead ? score.status : 'Sem dados no CRM',
    qualified: lead ? score.qualified === true : false,
    hot: lead ? score.hot === true : false,
    niche: niche.primary,
    subniche: niche.sub,
    nichePath: niche.path,
    responded: response,
    trackingStatus: tracking,
  };
}

/** Builds a privacy-conscious campaign report from campaign events and current CRM evidence. */
export function buildCampaignReport(campaign = {}, leads = [], rawScoringConfig = DEFAULT_LEAD_SCORING_CONFIG, options = {}) {
  const scoringConfig = normalizeLeadScoringConfig(rawScoringConfig);
  const indexes = buildLeadIndexes(leads);
  const contacts = Array.isArray(campaign.contacts) ? campaign.contacts : [];
  const otherCampaigns = Array.isArray(options.campaigns) ? options.campaigns : [campaign];
  const sendTimesByPhone = new Map();
  for (const other of otherCampaigns) {
    for (const contact of Array.isArray(other?.contacts) ? other.contacts : []) {
      if (contact?.status !== 'sent') continue;
      const phone = phoneKey(contact.phone);
      const at = contactSendAt(other, contact, findLead(contact, indexes));
      if (!phone || at === null) continue;
      const list = sendTimesByPhone.get(phone) || [];
      list.push({ at, campaignId: String(other.id || '') });
      sendTimesByPhone.set(phone, list);
    }
  }
  for (const list of sendTimesByPhone.values()) list.sort((a, b) => a.at - b.at);

  const sentContacts = [];
  const failedContacts = [];
  const skippedContacts = [];
  const pendingContacts = [];
  const respondedContacts = [];
  const notRespondedContacts = [];
  const untrackedContacts = [];
  const qualifiedContacts = [];
  const hotContacts = [];
  const nicheMap = new Map();

  for (const contact of contacts) {
    const status = String(contact?.status || '');
    const lead = findLead(contact, indexes);
    const scoring = lead ? scoreLead(lead, scoringConfig) : { score: 0, status: 'Sem dados no CRM', qualified: false, hot: false, activeSignals: [] };
    const sendAt = status === 'sent' ? contactSendAt(campaign, contact, lead) : null;
    const incomingTimes = lead ? leadInboundTimes(lead) : [];
    let responded = false;
    if (lead && status === 'sent') {
      if (sendAt !== null) {
        const nextSend = (sendTimesByPhone.get(phoneKey(contact.phone)) || [])
          .find((entry) => entry.at > sendAt && entry.campaignId !== String(campaign.id || ''));
        responded = incomingTimes.some((at) => at >= sendAt && (!nextSend || at < nextSend.at));
      } else {
        const evidence = lead.tipoEvidence || lead.classifierEvidence || {};
        responded = evidence.respondedToCampaign === true;
      }
    }
    const tracking = !lead ? 'Não sincronizado com o CRM' : sendAt === null ? 'Envio sem data individual' : responded ? 'Resposta identificada' : 'Sem resposta registrada';
    const item = compactLead(contact, lead, scoring, responded, tracking);
    item.sentAt = sendAt === null ? null : new Date(sendAt).toISOString();
    item.lastIncomingAt = incomingTimes.length ? new Date(incomingTimes[incomingTimes.length - 1]).toISOString() : null;
    item.scoreSignals = Array.isArray(scoring.activeSignals) ? scoring.activeSignals.map((signal) => ({ label: signal.label, points: signal.points })) : [];

    if (status === 'sent') {
      sentContacts.push(item);
      if (responded) respondedContacts.push(item);
      else notRespondedContacts.push(item);
      if (!lead || sendAt === null) untrackedContacts.push(item);
      if (lead && scoring.qualified) qualifiedContacts.push(item);
      if (lead && scoring.hot) hotContacts.push(item);
      const niche = item.niche || 'Não identificado';
      const group = nicheMap.get(niche) || { niche, sent: 0, responses: 0, qualified: 0, hot: 0, subniches: new Map() };
      group.sent++;
      if (responded) group.responses++;
      if (lead && scoring.qualified) group.qualified++;
      if (lead && scoring.hot) group.hot++;
      const sub = item.subniche || 'Não identificado';
      const subGroup = group.subniches.get(sub) || { subniche: sub, sent: 0, responses: 0, qualified: 0, hot: 0 };
      subGroup.sent++;
      if (responded) subGroup.responses++;
      if (lead && scoring.qualified) subGroup.qualified++;
      if (lead && scoring.hot) subGroup.hot++;
      group.subniches.set(sub, subGroup);
      nicheMap.set(niche, group);
    } else if (status === 'failed') failedContacts.push(item);
    else if (status === 'skipped') skippedContacts.push(item);
    else pendingContacts.push(item);
  }

  const total = contacts.length;
  const sent = sentContacts.length;
  const failed = failedContacts.length;
  const skipped = skippedContacts.length;
  const pending = pendingContacts.length;
  const attempted = sent + failed;
  const responded = respondedContacts.length;
  const trackedSent = Math.max(0, sent - untrackedContacts.length);
  const qualified = qualifiedContacts.length;
  const hot = hotContacts.length;
  const niches = [...nicheMap.values()].map((group) => ({
    niche: group.niche, sent: group.sent, responses: group.responses,
    responseRate: pct(group.responses, group.sent), qualified: group.qualified, hot: group.hot,
    subniches: [...group.subniches.values()].sort((a, b) => b.sent - a.sent).map((sub) => ({ ...sub, responseRate: pct(sub.responses, sub.sent) })),
  })).sort((a, b) => b.sent - a.sent || b.responses - a.responses);
  const metrics = {
    total, sent, failed, skipped, pending, attempted,
    sendSuccessRate: pct(sent, attempted),
    responseCount: responded,
    responseRate: pct(responded, sent),
    qualifiedCount: qualified,
    qualifiedRate: pct(qualified, sent),
    qualifiedResponders: respondedContacts.filter((item) => item.qualified).length,
    qualifiedResponderRate: pct(respondedContacts.filter((item) => item.qualified).length, responded),
    hotCount: hot,
    noResponseCount: notRespondedContacts.length,
    trackedSent,
    untrackedCount: untrackedContacts.length,
    dataCoverageRate: pct(trackedSent, sent),
  };
  return {
    campaignId: String(campaign.id || ''),
    campaignName: text(campaign.name) || 'Campanha sem nome',
    status: String(campaign.status || 'draft'),
    reportCycle: Math.max(1, Number(campaign.reportCycle) || 1),
    createdAt: campaign.createdAt || null,
    startedAt: campaign.startedAt || null,
    finishedAt: campaign.finishedAt || null,
    generatedAt: new Date(options.now ?? Date.now()).toISOString(),
    audience: campaign.audience || null,
    metrics,
    niches,
    respondedContacts,
    qualifiedContacts,
    hotContacts,
    notRespondedContacts,
    untrackedContacts,
    failedContacts,
    skippedContacts,
    pendingContacts,
    notes: [
      'A taxa de resposta usa as mensagens enviadas como denominador.',
      'A identificação de respostas depende das evidências de conversa sincronizadas no CRM/WhatsApp.',
      'Contatos sem registro sincronizado ou sem data individual de envio são sinalizados para evitar conclusões indevidas.',
      'A qualificação usa os critérios e pesos atuais do Lead Score; ela pode mudar quando novas informações são registradas.',
    ],
  };
}

export function summarizeCampaignReport(report = {}) {
  const metrics = report.metrics || {};
  return {
    campaignId: String(report.campaignId || ''),
    campaignName: String(report.campaignName || ''),
    reportCycle: Math.max(1, Number(report.reportCycle) || 1),
    generatedAt: report.generatedAt || new Date().toISOString(),
    metrics: {
      total: Number(metrics.total) || 0,
      sent: Number(metrics.sent) || 0,
      failed: Number(metrics.failed) || 0,
      skipped: Number(metrics.skipped) || 0,
      pending: Number(metrics.pending) || 0,
      sendSuccessRate: Number(metrics.sendSuccessRate) || 0,
      responseCount: Number(metrics.responseCount) || 0,
      responseRate: Number(metrics.responseRate) || 0,
      qualifiedCount: Number(metrics.qualifiedCount) || 0,
      qualifiedRate: Number(metrics.qualifiedRate) || 0,
      qualifiedResponders: Number(metrics.qualifiedResponders) || 0,
      qualifiedResponderRate: Number(metrics.qualifiedResponderRate) || 0,
      hotCount: Number(metrics.hotCount) || 0,
      noResponseCount: Number(metrics.noResponseCount) || 0,
      untrackedCount: Number(metrics.untrackedCount) || 0,
      dataCoverageRate: Number(metrics.dataCoverageRate) || 0,
    },
    niches: (Array.isArray(report.niches) ? report.niches : []).slice(0, 30).map((item) => ({
      niche: String(item.niche || 'Não identificado'), sent: Number(item.sent) || 0,
      responses: Number(item.responses) || 0, responseRate: Number(item.responseRate) || 0,
      qualified: Number(item.qualified) || 0, hot: Number(item.hot) || 0,
      subniches: (Array.isArray(item.subniches) ? item.subniches : []).slice(0, 20).map((sub) => ({
        subniche: String(sub.subniche || 'Não identificado'), sent: Number(sub.sent) || 0,
        responses: Number(sub.responses) || 0, responseRate: Number(sub.responseRate) || 0,
        qualified: Number(sub.qualified) || 0, hot: Number(sub.hot) || 0,
      })),
    })),
  };
}
