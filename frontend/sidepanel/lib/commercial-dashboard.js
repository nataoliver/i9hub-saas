/**
 * i9Hub — agregação local para a Central de Agenda e Atividades Comerciais.
 * Não acessa Chrome APIs nem faz chamadas de rede; recebe registros já carregados do CRM.
 */
const dateMs = (value) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
};
const leadKey = (lead) => String(lead?.id || lead?.placeId || lead?.phone || '');
const clean = (value, max = 240) => String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);

function isOpenCommercialLead(lead) {
  if (!lead || lead.blacklisted === true) return false;
  const stage = clean(lead.stage, 100).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/fechad|ganh|vend|cliente|won|closed|perdid|recus|lost|black|spam/.test(stage)) return false;
  return true;
}

export function buildCommercialDashboardSnapshot({
  leads = [],
  followups = [],
  automationTasks = [],
  now = Date.now(),
  recentActivities = [],
  activityCountLast7Days = null,
} = {}) {
  const timestamp = Number(now);
  const current = Number.isFinite(timestamp) ? timestamp : Date.now();
  const todayStart = new Date(current);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const weekEnd = current + 7 * 24 * 60 * 60_000;
  const weekStart = current - 7 * 24 * 60 * 60_000;
  const leadById = new Map((Array.isArray(leads) ? leads : []).map((lead) => [leadKey(lead), lead]).filter(([id]) => id));

  const eventMap = new Map();
  for (const lead of Array.isArray(leads) ? leads : []) {
    const id = leadKey(lead);
    for (const raw of Array.isArray(lead.calendarEvents) ? lead.calendarEvents : []) {
      if (!raw || typeof raw !== 'object') continue;
      const eventId = clean(raw.eventId, 300);
      const requestKey = clean(raw.requestKey, 180);
      const uniqueKey = eventId ? `${clean(raw.calendarId, 500)}|${eventId}` : (raw.status === 'pending' && requestKey ? `${id}|pending|${requestKey}` : '');
      if (!uniqueKey || eventMap.has(uniqueKey)) continue;
      const startMs = dateMs(raw.start);
      const endMs = dateMs(raw.end);
      eventMap.set(uniqueKey, {
        eventId,
        calendarId: clean(raw.calendarId, 500),
        requestKey,
        leadId: id,
        leadName: clean(lead.name || lead.company || 'Lead', 160),
        leadPhone: clean(lead.phone, 40),
        leadStage: clean(lead.stage, 100),
        summary: clean(raw.summary || 'Atendimento comercial', 200),
        start: clean(raw.start, 60),
        end: clean(raw.end, 60),
        startMs,
        endMs,
        status: ['confirmed', 'tentative', 'cancelled', 'pending'].includes(raw.status) ? raw.status : 'confirmed',
        outcome: ['completed', 'no_show'].includes(raw.outcome) ? raw.outcome : '',
        outcomeAt: clean(raw.outcomeAt, 50),
        syncStatus: clean(raw.syncStatus, 30),
        htmlLink: /^https:\/\/(?:calendar\.google\.com|www\.google\.com\/calendar)\//.test(String(raw.htmlLink || '')) ? String(raw.htmlLink).slice(0, 2000) : '',
        confirmationStatus: clean(raw.confirmationStatus, 30),
      });
    }
  }
  const events = [...eventMap.values()].sort((a, b) => a.startMs - b.startMs);
  const activeEvents = events.filter((event) => event.status !== 'cancelled');
  const todayEvents = activeEvents.filter((event) => event.startMs >= todayStart.getTime() && event.startMs < tomorrowStart.getTime());
  const upcomingEvents = activeEvents.filter((event) => event.startMs >= current && event.startMs <= weekEnd);
  const completedEvents = events.filter((event) => event.outcome === 'completed');
  const noShowEvents = events.filter((event) => event.outcome === 'no_show');
  const cancelledEvents = events.filter((event) => event.status === 'cancelled');

  const normalizedFollowups = (Array.isArray(followups) ? followups : []).map((item) => {
    const lead = leadById.get(String(item?.leadId || ''));
    return {
      id: clean(item?.id, 120),
      leadId: clean(item?.leadId, 180),
      leadName: clean(item?.leadName || lead?.name || lead?.company || 'Lead', 160),
      phone: clean(item?.phone || lead?.phone, 40),
      message: clean(item?.message, 500),
      status: clean(item?.status, 40) || 'unknown',
      scheduledAt: clean(item?.scheduledAt, 50),
      scheduledMs: dateMs(item?.scheduledAt),
      sentAt: clean(item?.sentAt, 50),
      updatedAt: clean(item?.updatedAt, 50),
      lastError: clean(item?.lastError, 300),
    };
  });
  const overdueFollowups = normalizedFollowups
    .filter((item) => item.status === 'overdue' || (item.status === 'scheduled' && item.scheduledMs > 0 && item.scheduledMs < current))
    .sort((a, b) => a.scheduledMs - b.scheduledMs);
  const upcomingFollowups = normalizedFollowups
    .filter((item) => item.status === 'scheduled' && item.scheduledMs >= current && item.scheduledMs <= weekEnd)
    .sort((a, b) => a.scheduledMs - b.scheduledMs);

  const openLeads = (Array.isArray(leads) ? leads : []).filter(isOpenCommercialLead);
  const leadsWithoutNextAction = openLeads.filter((lead) => {
    const id = leadKey(lead);
    const hasEvent = activeEvents.some((event) => event.leadId === id && event.startMs >= current);
    const hasFollowup = upcomingFollowups.some((item) => item.leadId === id);
    return !hasEvent && !hasFollowup;
  }).map((lead) => ({
    leadId: leadKey(lead),
    leadName: clean(lead.name || lead.company || 'Lead sem nome', 160),
    phone: clean(lead.phone, 40),
    stage: clean(lead.stage, 100),
    updatedAt: clean(lead.updatedAt || lead.extractedAt, 50),
    updatedMs: dateMs(lead.updatedAt || lead.extractedAt),
  })).sort((a, b) => a.updatedMs - b.updatedMs);

  const activities = (Array.isArray(recentActivities) ? recentActivities : [])
    .filter((item) => item && dateMs(item.createdAt) > 0)
    .map((item) => ({
      id: clean(item.id, 140),
      leadId: clean(item.leadId, 180),
      leadName: clean(item.leadName || 'Lead', 160),
      title: clean(item.title || 'Atividade comercial', 160),
      description: clean(item.description, 300),
      actor: clean(item.actor || 'Sistema', 100),
      source: clean(item.source || 'system', 40),
      createdAt: clean(item.createdAt, 50),
      createdMs: dateMs(item.createdAt),
      kind: clean(item.kind || 'activity', 20),
    }))
    .sort((a, b) => b.createdMs - a.createdMs);

  const pendingTasks = (Array.isArray(automationTasks) ? automationTasks : [])
    .filter((task) => task?.status === 'needs_review')
    .map((task) => ({
      id: clean(task.id, 120),
      leadId: clean(task.leadId, 180),
      leadName: clean(task.leadName || leadById.get(String(task.leadId))?.name || 'Lead', 160),
      title: clean(task.title || 'Ação aguardando revisão', 180),
      reason: clean(task.reason, 500),
      createdAt: clean(task.createdAt, 50),
      proposedStart: clean(task.proposedStart, 60),
      type: clean(task.type, 60),
    }))
    .sort((a, b) => dateMs(b.createdAt) - dateMs(a.createdAt));

  const sentFollowupsLast7Days = normalizedFollowups.filter((item) => {
    if (item.status !== 'sent') return false;
    const sentAt = dateMs(item.sentAt || item.updatedAt || item.scheduledAt);
    return sentAt >= weekStart && sentAt <= current;
  });
  const completedLast7Days = completedEvents.filter((event) => {
    const outcomeAt = dateMs(event.outcomeAt) || event.endMs;
    return outcomeAt >= weekStart && outcomeAt <= current;
  });
  const noShowLast7Days = noShowEvents.filter((event) => {
    const outcomeAt = dateMs(event.outcomeAt) || event.endMs;
    return outcomeAt >= weekStart && outcomeAt <= current;
  });
  const activitiesLast7Days = activities.filter((item) => item.createdMs >= weekStart && item.createdMs <= current);

  return {
    generatedAt: new Date(current).toISOString(),
    metrics: {
      todayMeetings: todayEvents.length,
      upcomingMeetings: upcomingEvents.length,
      confirmedMeetings: activeEvents.filter((event) => event.status === 'confirmed' && !event.outcome).length,
      completedMeetings: completedEvents.length,
      cancelledMeetings: cancelledEvents.length,
      noShowMeetings: noShowEvents.length,
      overdueFollowups: overdueFollowups.length,
      upcomingFollowups: upcomingFollowups.length,
      activeLeads: openLeads.length,
      leadsWithoutNextAction: leadsWithoutNextAction.length,
      pendingAutomationTasks: pendingTasks.length,
      activitiesLast7Days: activityCountLast7Days !== null && activityCountLast7Days !== undefined && Number.isFinite(Number(activityCountLast7Days)) ? Math.max(0, Math.floor(Number(activityCountLast7Days))) : activitiesLast7Days.length,
      followupsSentLast7Days: sentFollowupsLast7Days.length,
      meetingsCompletedLast7Days: completedLast7Days.length,
      noShowLast7Days: noShowLast7Days.length,
    },
    todayEvents: todayEvents.slice(0, 20),
    upcomingEvents: upcomingEvents.slice(0, 30),
    overdueFollowups: overdueFollowups.slice(0, 20),
    upcomingFollowups: upcomingFollowups.slice(0, 20),
    leadsWithoutNextAction: leadsWithoutNextAction.slice(0, 30),
    pendingAutomationTasks: pendingTasks.slice(0, 30),
    recentActivities: activities.slice(0, 40),
  };
}
