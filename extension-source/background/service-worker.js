/**
 * i9Hub - Service Worker (Manifest V3)
 *
 * - Dados locais (leads, campanhas, configurações) em chrome.storage.local
 * - Licença: ativação no servidor + token Ed25519 verificado localmente
 * - Sem licença: modo de demonstração; nenhum handler operacional é liberado.
 * - Com licença: cada handler exige o entitlement assinado correspondente.
 * - Handler sem mapeamento é negado por padrão (fail closed).
 */

import { TRUSTED_PUBLIC_KEYS } from '../lib/public-keys.js';
import { verifyExtensionToken } from '../lib/verify-token.js';
import { ACTION_FEATURE_MAP, ACTION_REQUIRED_FEATURES, CORE_ACTIONS, FEATURE_CATALOG, FEATURE_CATALOG_VERSION, PUBLIC_ACTIONS, SAFETY_ACTIONS, featureName, getEntitlementIds, getFeatureCatalogForToken, hasConfiguredEntitlements, hasFeatureEntitlement } from '../lib/feature-catalog.js';
import { LICENSE_CONTRACT_VERSION, evaluateActionAuthorization, filterSettingsByEntitlements, isReadOnlyAction, normalizeLicenseLimits } from '../lib/license-policy.js';
import { getModuleRegistryForEntitlements } from '../lib/module-registry.js';
import { buildWhatsAppUrl } from '../lib/onboarding.js';
import { decideMessage, rejectMessage, originOfUrl } from '../lib/message-gate.js';
import { initDriveSync, driveHandlers } from './drive-sync.js';
import { TYPE_VALUES, DEFAULT_CLASSIFIER_SETTINGS, normalizeClassifierSettings, normalizeType, classifyLead } from '../lib/classifier.js';
import { BUSINESS_PROFILE_VERSION, BUSINESS_PROFILES, buildBusinessProfile, profileSummary } from '../lib/profile-engine.js';
import { getApiExtensionVersion } from '../lib/version.js';
import { normalizeAiModelList } from '../lib/ai-model-catalog.js';
import { DEFAULT_CRM_STAGES, normalizeCrmStageConfig, buildCrmStageList } from '../lib/crm-stage-config.js';
import { normalizeNicheTaxonomy, createTaxonomyNode, updateTaxonomyNode, deleteTaxonomyNode, mergeTaxonomyNodes, applyAiNicheClassification, rebuildLeadTaxonomyFields } from '../lib/niche-taxonomy.js';
import { buildCampaignReport, summarizeCampaignReport } from '../lib/campaign-reporting.js';
import { AI_MONITOR_EVENT_LIMIT, normalizeAiMonitorEvent, summarizeAiMonitorEvents } from '../lib/ai-monitoring.js';
import { buildAiConversationMemoryPrompt, mergeAiConversationMemory, mergeAiConversationMemoryMaps } from '../lib/ai-conversation-memory.js';
import { AI_OPERATION_MODES, buildAiObserverSystemPrompt, getAiObserverChangedFields, normalizeAiOperationMode } from '../lib/ai-observer.js';
import { appendCrmActivity, buildCrmTimeline, createManualCrmNote, normalizeCrmNotes, CRM_NOTE_MAX_ITEMS } from '../lib/crm-history.js';
import { FOLLOWUP_STATUS, FOLLOWUP_MAX_STEPS, FOLLOWUP_MAX_MESSAGE_LENGTH, normalizeFollowupSettings, normalizeFollowupStep, renderFollowupTemplate, followupAlarmName, isWithinQuietHours, nextAllowedFollowupTime } from '../lib/followup-scheduler.js';
import { GOOGLE_CALENDAR_SCOPES, GOOGLE_CALENDAR_API, GOOGLE_CALENDAR_ORIGIN, CALENDAR_MAX_EVENTS_PER_LEAD, normalizeCalendarSettings, parseLocalDateRange, buildAvailableCalendarSlots, buildCalendarEventBody, normalizeCalendarEventRecord, buildCalendarEventDescription } from '../lib/google-calendar.js';
import { normalizeCalendarAutomationRule, normalizeCalendarAutomationRules, normalizeCalendarAutomationTasks, calendarAutomationMatches, getNewlyAddedTags, resolveCalendarAutomationDate, buildCalendarAutomationRunKey } from '../lib/calendar-automation.js';
import { GMAIL_SEND_SCOPE, GMAIL_READ_SCOPE, GMAIL_API, GMAIL_ORIGIN, CRM_EMAIL_MAX_BODY, CRM_EMAIL_MAX_SUBJECT, CRM_EMAIL_MAX_ATTACHMENTS, DEFAULT_CRM_EMAIL_TEMPLATES, normalizeCrmEmailAddress, normalizeCrmEmailTemplates, normalizeCrmEmailSignatures, buildGmailRawMessage } from '../lib/crm-communication.js';
import { buildCommercialDashboardSnapshot } from '../lib/commercial-dashboard.js';
import { buildCommercialPerformanceReport } from '../lib/commercial-performance.js';
import { buildCommercialManagementReport, validateCommercialMonth } from '../lib/commercial-management.js';
import { buildManagementIntelligence, buildManagementIntelligencePrompt } from '../lib/management-intelligence.js';
import '../content/lead-identity.js';

export const EXT_VERSION = getApiExtensionVersion();
const LeadIdentity = globalThis.i9LeadIdentity;
const BASE_URL = 'https://rcs.i9ads.com.br/api/v1';

// ---------------------------------------------------------------------------
// Configuração do licenciamento
// ---------------------------------------------------------------------------

const K = {
  DEVICE_ID: 'deviceId',
  LICENSE_KEY: 'licenseKey',
  TOKEN: 'licenseToken',
  LICENSE_DATA: 'licenseData',
  LAST_VALIDATION: 'lastValidation',
  USAGE_TOTAL: 'actionsUsedTotal', // legado: mantido para compatibilidade, não concede acesso
  SETTINGS: 'settings',
  LEADS: 'leads',
  CAMPAIGNS: 'campaigns',
  STAGES: 'customStages',      // Estágios legados e estágios derivados do perfil comercial
  CRM_STAGE_CONFIG: 'crmStageConfig',
  NICHE_TAXONOMY: 'crmNicheTaxonomy',
  LABEL_SYNC: 'labelSync',
  BLACKLIST: 'blacklist',      // v1.5.0: banco de black list (separado do CRM)
  CONSENT: 'consentTracking',  // v1.6.0: registro de opt-in/opt-out por telefone (compliance.consent_tracking)
  FOLLOWUPS: 'crmFollowups',
  FOLLOWUP_SETTINGS: 'crmFollowupSettings',
  FOLLOWUP_TEMPLATES: 'crmFollowupTemplates',
  FOLLOWUP_CONSENT: 'crmFollowupConsent',
  GOOGLE_CALENDAR: 'googleCalendarConfig',
  CALENDAR_AUTOMATIONS: 'googleCalendarAutomationRules',
  CALENDAR_AUTOMATION_RUNS: 'googleCalendarAutomationRuns',
  CALENDAR_AUTOMATION_TASKS: 'googleCalendarAutomationTasks',
  GMAIL_STATUS: 'crmGmailIntegrationStatus',
  GMAIL_ACCOUNTS: 'crmGmailAccounts',
  CRM_EMAIL_TEMPLATES: 'crmEmailTemplates',
  CRM_EMAIL_SIGNATURES: 'crmEmailSignatures',
  CRM_EMAIL_SENDS: 'crmEmailSendRequests',
};

const ALARM_NAME = 'license-validation';
const MENU_ID = 'i9rcs-open-fullscreen';
const OFFLINE_GRACE_MS = 7 * 24 * 3600 * 1000; // Política de disponibilidade; validar com o backend antes de alterar

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
async function getStore(keys) { return chrome.storage.local.get(keys); }
async function getOne(key, fallback = null) { const r = await chrome.storage.local.get(key); return r[key] ?? fallback; }
async function setStore(obj) { return chrome.storage.local.set(obj); }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// O servidor exige deviceId em formato UUID puro (sem prefixo). Versões <= 1.6.0
// gravavam "ext_<uuid>", o que gerava "deviceId deve ser um UUID válido".
async function getDeviceId() {
  let id = await getOne(K.DEVICE_ID);
  if (typeof id === 'string' && !UUID_RE.test(id)) {
    const stripped = id.replace(/^ext_/i, '');
    id = UUID_RE.test(stripped) ? stripped : null;
    if (id) await setStore({ [K.DEVICE_ID]: id });
  }
  if (!id) { id = crypto.randomUUID(); await setStore({ [K.DEVICE_ID]: id }); }
  return id;
}

function uid(prefix = 'id') { return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// ---------------------------------------------------------------------------
// Licença
// ---------------------------------------------------------------------------
async function getLicenseState() {
  const { [K.TOKEN]: token, [K.LICENSE_DATA]: data, [K.LAST_VALIDATION]: last } =
    await getStore([K.TOKEN, K.LICENSE_DATA, K.LAST_VALIDATION]);
  if (!token) return { licensed: false, plan: 'free' };

  const deviceId = await getDeviceId();
  const res = verifyExtensionToken(token, { expectedDeviceId: deviceId, publicKeysMap: TRUSTED_PUBLIC_KEYS });
  if (res.valid) {
    return { licensed: true, plan: res.payload.plan || data?.plan || 'unknown', payload: res.payload, data, lastValidation: last };
  }
  // Token expirado mas validado com o servidor recentemente: tolerância offline.
  if (res.error === 'TOKEN_EXPIRED' && last && Date.now() - last < OFFLINE_GRACE_MS) {
    return { licensed: true, plan: res.payload?.plan || data?.plan || 'unknown', payload: res.payload, data, lastValidation: last, grace: true };
  }
  return { licensed: false, plan: 'free', reason: res.error };
}

function sanitizeLicenseMetadata(source, tokenPayload = {}) {
  const input = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const tokenPlan = typeof tokenPayload?.plan === 'string' ? tokenPayload.plan.trim().slice(0, 40) : '';
  const sourcePlan = typeof input.plan === 'string' ? input.plan.trim().slice(0, 40) : '';
  const result = { plan: tokenPlan || sourcePlan || 'unknown' };
  const fields = {
    licenseId: ['licenseId', 'license_id', 'id'],
    status: ['status'],
    expiresAt: ['expiresAt', 'expires_at', 'expiryDate', 'expiry_date'],
    maxDevices: ['maxDevices', 'max_devices', 'deviceLimit', 'device_limit'],
    devicesUsed: ['devicesUsed', 'devices_used', 'deviceCount', 'device_count'],
  };
  for (const [outKey, candidates] of Object.entries(fields)) {
    const key = candidates.find((candidate) => Object.prototype.hasOwnProperty.call(input, candidate));
    if (!key) continue;
    const value = input[key];
    if (typeof value === 'string' && value.length <= 120) result[outKey] = value;
    else if (typeof value === 'number' && Number.isFinite(value) && value >= 0) result[outKey] = value;
  }
  return result;
}

async function activateLicense(licenseKey) {
  const key = String(licenseKey || '').trim();
  if (!key) return { success: false, error: 'Informe a chave de licença.' };
  const deviceId = await getDeviceId();
  let resp, data = {}, raw = '';
  try {
    resp = await fetch(`${BASE_URL}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: key, deviceId, deviceName: 'Chrome Extension', extVersion: EXT_VERSION }),
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
    });
    raw = await resp.text().catch(() => '');
    try { const parsed = raw ? JSON.parse(raw) : {}; data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { data = {}; }
  } catch {
    return { success: false, transient: true, error: 'Sem conexão com o servidor de licenças. Verifique sua internet.' };
  }

  // Tolera variações no formato da resposta do servidor (token na raiz ou dentro de data/license).
  const inner = (data && typeof data.data === 'object' && data.data) || {};
  const token = data.token || data.licenseToken || data.accessToken || inner.token || inner.licenseToken || inner.accessToken;
  const licenseDataRaw = data.licenseData || data.license || inner.licenseData || inner.license || data;
  const okFlag = data.success !== false && data.ok !== false && resp.ok;
  const errText = (typeof data.message === 'string' && data.message)
    || (typeof data.error === 'string' && data.error)
    || (typeof data.error?.message === 'string' && data.error.message)
    || '';
  if (!okFlag || !token) {
    const serverCode = String(data.code || data.error?.code || '').toUpperCase();
    const permanentCodes = new Set(['LICENSE_INVALID', 'LICENSE_REVOKED', 'DEVICE_LIMIT_REACHED', 'DEVICE_NOT_AUTHORIZED', 'LICENSE_EXPIRED']);
    const permanentStatus = [401, 403, 404, 410, 422].includes(resp.status);
    const transient = resp.status === 408 || resp.status === 429 || resp.status >= 500;
    const safeMessage = errText.replace(/(?:bearer\s+)[A-Za-z0-9._~-]+/ig, 'Bearer [oculto]')
      .replace(/(token|licenseKey|accessToken|apiKey)\s*[:=]\s*[^\s,;]+/ig, '$1=[oculto]').slice(0, 240);
    return {
      success: false,
      error: safeMessage || `Ativação recusada pelo servidor (HTTP ${resp.status}).`,
      status: resp.status,
      transient,
      permanent: permanentStatus || permanentCodes.has(serverCode),
    };
  }
  const check = verifyExtensionToken(token, { expectedDeviceId: deviceId, publicKeysMap: TRUSTED_PUBLIC_KEYS });
  if (!check.valid) return { success: false, permanent: true, error: 'Token de licença inválido: ' + check.message };
  const licenseData = sanitizeLicenseMetadata(licenseDataRaw, check.payload);

  await setStore({
    [K.LICENSE_KEY]: key,
    [K.TOKEN]: token,
    [K.LICENSE_DATA]: licenseData,
    [K.LAST_VALIDATION]: Date.now(),
  });
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 6 * 60 });
  return { success: true, data: await buildLicenseStatus() };
}

async function revalidateLicense() {
  const key = await getOne(K.LICENSE_KEY);
  if (!key) return;
  const r = await activateLicense(key);
  // Falhas transitórias (rede, rate limit ou servidor indisponível) não derrubam a licença.
  // Revogação/invalidade explícita remove o token local para que o Premium falhe fechado.
  if (!r.success && r.permanent === true) {
    await stopActiveOperationsForLicenseRevocation();
    await chrome.storage.local.remove([K.TOKEN, K.LICENSE_DATA, K.LAST_VALIDATION]);
  }
}

async function stopActiveOperationsForLicenseRevocation() {
  try {
    const campaigns = await getCampaigns();
    for (const campaign of campaigns.filter((item) => item?.status === 'running' && item?.id)) {
      try { await handlers.STOP_CAMPAIGN({ campaignId: campaign.id }); } catch { /* melhor esforço: revogação nunca deve travar */ }
    }
    if (typeof mapsJob !== 'undefined' && mapsJob.running) {
      try { await handlers.MAPS_STOP_EXTRACTION({}); } catch { /* melhor esforço */ }
    }
  } catch { /* não impede a remoção da licença */ }
}

async function deactivateLicense() {
  await stopActiveOperationsForLicenseRevocation();
  await chrome.storage.local.remove([K.LICENSE_KEY, K.TOKEN, K.LICENSE_DATA, K.LAST_VALIDATION]);
  await chrome.alarms.clear(ALARM_NAME);
}

function whatsappLink(kind = 'free-account', featureId = '') {
  return buildWhatsAppUrl(kind, featureId ? featureName(featureId) : '');
}

function usageForLicense(licensed) {
  // Não há mais cota local de ações. A licença emitida pelo painel determina acesso.
  return { used: 0, limit: null, remaining: null, required: !licensed, mode: licensed ? 'licensed' : 'license-required' };
}

async function buildLicenseStatus() {
  const [state, deviceId] = await Promise.all([getLicenseState(), getDeviceId()]);
  const entitlements = getEntitlementIds(state.payload?.ent);
  const entitlementsConfigured = state.licensed && hasConfiguredEntitlements(state.payload?.ent);
  const features = getFeatureCatalogForToken(state.licensed ? state.payload?.ent : null);
  return {
    valid: state.licensed,
    licensed: state.licensed,
    plan: state.plan,
    license: { plan: state.plan, valid: state.licensed, ...(state.data || {}) },
    usage: usageForLicense(state.licensed),
    deviceId,
    whatsappUrl: whatsappLink(),
    entitlements,
    entitlementsConfigured,
    featureCatalogVersion: FEATURE_CATALOG_VERSION,
    licenseContractVersion: LICENSE_CONTRACT_VERSION,
    limits: normalizeLicenseLimits(state.payload?.limits),
    modules: getModuleRegistryForEntitlements(state.payload?.ent),
    features,
  };
}

async function gate(type, payload = {}) {
  const state = await getLicenseState();
  return evaluateActionAuthorization({ type, payload, state });
}

function permissionDenied(type, result) {
  const code = result?.code || 'LICENSE_REQUIRED';
  const promptLicense = !isReadOnlyAction(type);
  const whatsappKind = code === 'FEATURE_NOT_INCLUDED' ? 'feature-access' : code === 'LICENSE_PERMISSIONS_MISSING' ? 'license-support' : 'free-account';
  return {
    success: false,
    code,
    error: result?.error || 'Esta funcionalidade não está liberada.',
    featureId: result?.featureId,
    featureName: result?.featureName,
    promptLicense,
    whatsappUrl: whatsappLink(whatsappKind, result?.featureId || ''),
  };
}

// ---------------------------------------------------------------------------
// Leads / Campanhas / Configurações (locais)
// ---------------------------------------------------------------------------
const leadId = (l) => l.id || l.placeId || l.phone;

function normPhone(p) { return String(p || '').replace(/\D/g, ''); }

/** Telefone pronto para o WhatsApp: só dígitos, com DDI. 10/11 dígitos = Brasil (+55). */
function normWaPhone(p) {
  let d = normPhone(p).replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d;
}

export const STAGE_IDS = DEFAULT_CRM_STAGES.map((stage) => stage.id);
const DEFAULT_STAGES = DEFAULT_CRM_STAGES;
const LABEL_STAGE_PALETTE = ['#25d366', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#e11d48'];
const labelStageId = (labelId) => 'wl_' + String(labelId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
const phoneTail = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 8 ? d.slice(-10) : ''; };
async function getCustomStages() { const v = await getOne(K.STAGES, []); return Array.isArray(v) ? v : []; }
async function getCrmStageConfig() { return normalizeCrmStageConfig(await getOne(K.CRM_STAGE_CONFIG, {})); }
async function getStageList() { return buildCrmStageList(DEFAULT_STAGES, await getCustomStages(), await getCrmStageConfig()); }
async function getStageIds() { return (await getStageList()).map((s) => s.id); }
async function getNicheTaxonomy() { return normalizeNicheTaxonomy(await getOne(K.NICHE_TAXONOMY, {})); }

// ---------------------------------------------------------------------------
// v1.5.0 - BLACK LIST: banco próprio (por telefone) + estágio "Black list" + exclusão das campanhas.
// A etiqueta "Black list" no WhatsApp Business é aplicada pela página (injected.js) quando possível.
// ---------------------------------------------------------------------------
const normLabelName = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const isBlacklistLabelName = (n) => normLabelName(n) === 'blacklist';
async function getBlacklist() { const v = await getOne(K.BLACKLIST, []); return Array.isArray(v) ? v : []; }
async function blacklistTails() { return new Set((await getBlacklist()).map((e) => phoneTail(e.phone)).filter(Boolean)); }

// ---------------------------------------------------------------------------
// v1.6.0 - CONSENT TRACKING: registro de opt-in/opt-out por telefone.
// Schema: { phone, status: 'opted_in'|'opted_out', source: 'keyword'|'link'|'manual',
//           updatedAt, campaignId?, message? }
// Usado como pré-condição pelo message-gate antes de liberar mensagens de campanha.
// ---------------------------------------------------------------------------
const CONSENT_STATUS_OPTED_IN = 'opted_in';
const CONSENT_STATUS_OPTED_OUT = 'opted_out';

async function getConsentTracking() { const v = await getOne(K.CONSENT, {}); return (v && typeof v === 'object') ? v : {}; }
async function getConsentForPhone(phone) {
  const tail = phoneTail(phone);
  if (!tail) return null;
  const all = await getConsentTracking();
  return all[tail] || null;
}
async function setConsentForPhone(phone, status, source, extra = {}) {
  const tail = phoneTail(phone);
  if (!tail || ![CONSENT_STATUS_OPTED_IN, CONSENT_STATUS_OPTED_OUT].includes(status)) return false;
  const all = await getConsentTracking();
  all[tail] = {
    phone: normWaPhone(phone),
    status,
    source: source || 'manual',
    updatedAt: new Date().toISOString(),
    campaignId: extra.campaignId || '',
    message: String(extra.message || '').slice(0, 200),
  };
  await setStore({ [K.CONSENT]: all });
  // Opt-out automático adiciona à blacklist quando a feature está habilitada.
  if (status === CONSENT_STATUS_OPTED_OUT) {
    try { await addBlacklistEntry({ phone: normWaPhone(phone), reason: 'consent_optout', source: source || 'auto' }); } catch { /* ignora */ }
  }
  return true;
}

/** Avisa o WhatsApp Web aberto (se houver) para parar de enviar a estes números na campanha em andamento. */
async function notifyBlacklistToWa() {
  try {
    const wa = await requireWhatsApp();
    await sendToTab(wa.tab.id, { type: 'BLACKLIST_SYNC', payload: { tails: [...(await blacklistTails())] } }, wa.frameId);
  } catch { /* WhatsApp fechado: a lista vai junto na próxima campanha */ }
}

async function blacklistAdd({ phone, name = '', source = 'manual', labelApplied = false, labelNote = '', reason = '' } = {}) {
  const ph = normWaPhone(phone);
  if (ph.length < 10 || ph.length > 15) return { success: false, error: 'Telefone inválido para a black list.' };
  const tail = phoneTail(ph); const now = new Date().toISOString();
  const bank = await getBlacklist();
  let entry = bank.find((e) => phoneTail(e.phone) === tail);
  const isNew = !entry;
  if (!entry) { entry = { id: uid('bl'), phone: ph, name: String(name || '').trim(), addedAt: now, source }; bank.push(entry); }
  else if (!entry.name && name) entry.name = String(name).trim();
  if (labelApplied) entry.labelApplied = true;
  if (labelNote) entry.labelNote = String(labelNote).slice(0, 120);
  if (reason) entry.reason = String(reason).slice(0, 200);
  await setStore({ [K.BLACKLIST]: bank });

  // CRM: estágio "Black list" + tag (cria o lead se ainda não existir)
  const leads = await getLeads();
  let lead = leads.find((l) => phoneTail(l.phone) === tail);
  if (!lead) { lead = { id: uid('lead'), name: entry.name, phone: ph, source: 'whatsapp', stage: 'blacklist', tags: [], groups: [], createdAt: now, extractedAt: now }; leads.push(lead); }
  if (lead.stage !== 'blacklist') lead.prevStage = lead.stage;
  Object.assign(lead, { stage: 'blacklist', blacklisted: true, tags: [...new Set([...(lead.tags || []), 'Black list'])], updatedAt: now });
  await putLeads(leads);

  // Campanhas: contatos ainda pendentes deste número viram "ignorado" (serializado com os eventos de envio)
  campaignEventQueue = campaignEventQueue.then(async () => {
    const campaigns = await getCampaigns(); let any = false;
    for (const c of campaigns) {
      let touched = false;
      for (const x of c.contacts || []) if (!x.status && phoneTail(x.phone) === tail) { x.status = 'skipped'; x.error = ''; x.skipReason = 'blacklist'; touched = true; }
      if (touched) { campaignCounts(c); any = true; }
    }
    if (any) await putCampaigns(campaigns);
  }).catch(() => {});
  await campaignEventQueue;
  notifyBlacklistToWa();
  return { success: true, data: { entry, isNew, total: bank.length } };
}

async function blacklistRemove({ phone, id } = {}) {
  const bank = await getBlacklist();
  const tail = phoneTail(phone);
  const hit = bank.find((e) => (id && e.id === id) || (tail && phoneTail(e.phone) === tail));
  if (!hit) return { success: false, error: 'Número não está na black list.' };
  await setStore({ [K.BLACKLIST]: bank.filter((e) => e !== hit) });
  const leads = await getLeads(); const t = phoneTail(hit.phone); const now = new Date().toISOString();
  for (const l of leads) {
    if (phoneTail(l.phone) !== t || !l.blacklisted) continue;
    l.blacklisted = false; l.tags = (l.tags || []).filter((x) => !isBlacklistLabelName(x));
    if (l.stage === 'blacklist') l.stage = l.prevStage && l.prevStage !== 'blacklist' ? l.prevStage : 'novo';
    delete l.prevStage; l.updatedAt = now;
  }
  await putLeads(leads);
  notifyBlacklistToWa();
  return { success: true, data: { total: bank.length - 1 } };
}

/** Contatos de uma campanha: normaliza, descarta inválidos e remove duplicados. */
function buildContacts(list = []) {
  const seen = new Set(); const out = [];
  for (const c of list) {
    const phone = normWaPhone(c?.phone);
    if (phone.length < 10 || phone.length > 15 || seen.has(phone)) continue;
    seen.add(phone);
    out.push({
      name: String(c.name || '').trim(), phone,
      email: c.email || '', company: c.company || '', category: c.category || '',
      stage: c.stage || '', labels: String(c.labels || ''), leadId: c.leadId || '',
    });
  }
  return out;
}

const campaignCounts = (c) => {
  const list = c.contacts || [];
  c.sent = list.filter((x) => x.status === 'sent').length;
  c.failed = list.filter((x) => x.status === 'failed').length;
  c.skipped = list.filter((x) => x.status === 'skipped').length;
  c.total = list.length;
};

function leadKey(l) {
  return LeadIdentity?.identityKeys?.(l)?.[0] || ('legacy:' + String(l?.id || l?.phone || l?.name || '').trim().toLowerCase());
}

async function getLeads() { return getOne(K.LEADS, []); }
async function putLeads(leads) { await setStore({ [K.LEADS]: leads }); }

// Serializa operações de histórico para evitar perda de anotações em gravações concorrentes.
let crmHistoryMutationQueue = Promise.resolve();
function withCrmHistoryMutation(task) {
  const next = crmHistoryMutationQueue.then(task, task);
  crmHistoryMutationQueue = next.catch(() => {});
  return next;
}
async function getCampaigns() { return getOne(K.CAMPAIGNS, []); }
async function putCampaigns(c) { await setStore({ [K.CAMPAIGNS]: c }); }

const CAMPAIGN_REPORT_DELAYS = Object.freeze({ '24h': 24 * 60 * 60 * 1000, '48h': 48 * 60 * 60 * 1000 });
const campaignReportAlarmName = (campaignId, cycle, period) => `i9-campaign-report:${String(campaignId)}:${Math.max(1, Number(cycle) || 1)}:${period}`;
async function clearCampaignReportAlarms(campaignId) {
  try {
    for (const period of Object.keys(CAMPAIGN_REPORT_DELAYS)) {
      const alarms = await chrome.alarms.getAll();
      for (const alarm of alarms) {
        if (alarm.name.startsWith(`i9-campaign-report:${String(campaignId)}:`) && alarm.name.endsWith(`:${period}`)) {
          await chrome.alarms.clear(alarm.name);
        }
      }
    }
  } catch { /* alarm cleanup is best effort */ }
}
async function scheduleCampaignReportAlarms(campaign) {
  if (!campaign?.id || campaign.status !== 'completed' || !campaign.finishedAt) return;
  const finishedAt = Date.parse(campaign.finishedAt);
  if (!Number.isFinite(finishedAt)) return;
  const cycle = Math.max(1, Number(campaign.reportCycle) || 1);
  const snapshots = Array.isArray(campaign.reportSnapshots) ? campaign.reportSnapshots : [];
  for (const period of Object.keys(CAMPAIGN_REPORT_DELAYS)) {
    if (snapshots.some((item) => item?.period === period && Number(item?.cycle || item?.reportCycle || 1) === cycle)) continue;
    const when = Math.max(Date.now() + 30_000, finishedAt + CAMPAIGN_REPORT_DELAYS[period]);
    try { await chrome.alarms.create(campaignReportAlarmName(campaign.id, cycle, period), { when }); } catch { /* next startup retries scheduling */ }
  }
}
async function schedulePendingCampaignReportAlarms() {
  const campaigns = await getCampaigns();
  for (const campaign of campaigns) await scheduleCampaignReportAlarms(campaign);
}
async function makeCampaignReport(campaignId) {
  const [campaigns, leads, settings] = await Promise.all([getCampaigns(), getLeads(), getSettings()]);
  const campaign = campaigns.find((item) => String(item?.id) === String(campaignId));
  if (!campaign) return { success: false, error: 'Campanha não encontrada.' };
  const report = buildCampaignReport(campaign, leads, settings?.leadScoring, { campaigns });
  return { success: true, data: { report, snapshots: Array.isArray(campaign.reportSnapshots) ? campaign.reportSnapshots : [] } };
}
async function captureCampaignReport(campaignId, period = 'manual', source = 'manual') {
  const normalizedPeriod = ['manual', '24h', '48h'].includes(period) ? period : 'manual';
  const campaigns = await getCampaigns();
  const campaign = campaigns.find((item) => String(item?.id) === String(campaignId));
  if (!campaign) return { success: false, error: 'Campanha não encontrada.' };
  if (normalizedPeriod !== 'manual') {
    const finishedAt = Date.parse(campaign.finishedAt || '');
    const waitMs = CAMPAIGN_REPORT_DELAYS[normalizedPeriod];
    if (!Number.isFinite(finishedAt)) return { success: false, error: 'O marco de acompanhamento só fica disponível depois de finalizar a campanha.' };
    if (Date.now() < finishedAt + waitMs) return { success: false, code: 'REPORT_NOT_DUE', nextAt: new Date(finishedAt + waitMs).toISOString(), error: `A atualização de ${normalizedPeriod} estará disponível em ${new Date(finishedAt + waitMs).toLocaleString('pt-BR')}.` };
  }
  const [leads, settings] = await Promise.all([getLeads(), getSettings()]);
  const report = buildCampaignReport(campaign, leads, settings?.leadScoring, { campaigns });
  const capturedAt = new Date().toISOString();
  const snapshot = {
    id: uid('report'), period: normalizedPeriod, cycle: Math.max(1, Number(campaign.reportCycle) || 1),
    source: source === 'scheduled' ? 'scheduled' : 'manual', capturedAt,
    ...summarizeCampaignReport({ ...report, generatedAt: capturedAt }),
  };
  const prior = Array.isArray(campaign.reportSnapshots) ? campaign.reportSnapshots : [];
  const retained = normalizedPeriod === 'manual'
    ? prior
    : prior.filter((item) => !(item?.period === normalizedPeriod && Number(item?.cycle || item?.reportCycle || 1) === snapshot.cycle));
  campaign.reportSnapshots = [...retained, snapshot].slice(-20);
  campaign.reportLastUpdatedAt = capturedAt;
  await putCampaigns(campaigns);
  return { success: true, data: { report, snapshots: campaign.reportSnapshots, snapshot } };
}


/**
 * Converte automaticamente conversas privadas do WhatsApp em oportunidades do CRM.
 * Idempotente: usa telefone e, como fallback, waChatId para nunca duplicar o contato.
 * Na primeira conversão de um contato em oportunidade de PV, usa o estágio Novo;
 * nas sincronizações seguintes preserva o avanço comercial manual e a origem original.
 */
let privateOpportunityQueue = Promise.resolve();
const privateOpportunityRuns = new Map();
const privateOpportunityRunErrors = new Map();

function queuePrivateOpportunityBatch(payload = {}) {
  privateOpportunityQueue = privateOpportunityQueue
    .then(() => applyPrivateOpportunityBatch(payload))
    .catch((error) => {
      const message = error?.message || String(error);
      saveSystemLog({ module: 'crm', action: 'PRIVATE_OPPORTUNITY_SYNC_ERROR', status: 'error', message });
      const runId = String(payload?.scanId || '');
      if (runId) privateOpportunityRunErrors.set(runId, message);
      if (payload?.syncRunId && payload?.finalBatch) {
        if (runId) privateOpportunityRunErrors.delete(runId);
        broadcast('PRIVATE_OPPORTUNITIES_SYNC_FAILED', { syncRunId: payload.syncRunId, scanId: runId, error: message, message: 'Falha ao gravar um lote de conversas no CRM.' });
      }
    });
  return privateOpportunityQueue;
}

function enrichClassificationEvidence(lead, evidence = {}, settings = {}) {
  const e = { ...(evidence || {}) };
  const now = Date.now();
  const recentMs = (Number(settings.recentDays) || DEFAULT_CLASSIFIER_SETTINGS.recentDays) * 86400000;
  const incoming = Date.parse(e.lastIncomingAt || '');
  const outgoing = Date.parse(e.lastOutgoingAt || '');
  const campaignSent = Date.parse(lead.lastCampaignSentAt || '');
  e.userReplied = e.userReplied === true || e.outgoingCount > 0;
  e.twoWayRecent = Number.isFinite(incoming) && Number.isFinite(outgoing)
    && now - incoming <= recentMs && now - outgoing <= recentMs;
  e.respondedToCampaign = Number.isFinite(incoming) && Number.isFinite(campaignSent)
    && incoming >= campaignSent && now - incoming <= recentMs;
  return e;
}

function compactClassificationEvidence(evidence = {}) {
  return {
    userReplied: evidence.userReplied === true,
    incomingCount: Number(evidence.incomingCount) || 0,
    outgoingCount: Number(evidence.outgoingCount) || 0,
    lastIncomingAt: evidence.lastIncomingAt || null,
    lastOutgoingAt: evidence.lastOutgoingAt || null,
    incomingTimestamps: Array.isArray(evidence.incomingTimestamps) ? evidence.incomingTimestamps.slice(-40) : [],
    firstIncomingAt: evidence.firstIncomingAt || null,
    firstIncomingFingerprint: evidence.firstIncomingFingerprint || '',
    firstMessageHasShortenedLink: evidence.firstMessageHasShortenedLink === true,
    firstMessagePromotional: evidence.firstMessagePromotional === true,
    firstMessagePromotionalLink: evidence.firstMessagePromotionalLink === true,
    spamKeywordMatch: evidence.spamKeywordMatch || '',
    isSavedContact: evidence.isSavedContact == null ? null : evidence.isSavedContact === true,
    respondedToCampaign: evidence.respondedToCampaign === true,
    twoWayRecent: evidence.twoWayRecent === true,
  };
}

async function applyClassification(lead, evidence = {}, settings = {}, fingerprintCount = 0, profile = null) {
  const e = enrichClassificationEvidence(lead, evidence, settings);
  if (fingerprintCount > 0) e.sameMessageCount = fingerprintCount;
  const result = classifyLead(lead, e, { settings, profile });
  const next = normalizeType(result.tipo);
  const changed =
    lead.tipo !== next ||
    lead.tipoMotivo !== result.motivo ||
    lead.tipoOrigem !== result.origem ||
    JSON.stringify(lead.tipoSinais || []) !== JSON.stringify(result.sinais || []);
  lead.tipo = next;
  lead.tipoMotivo = result.motivo;
  lead.tipoOrigem = result.origem;
  lead.tipoClassificadoEm = new Date().toISOString();
  lead.tipoSinais = Array.isArray(result.sinais) ? result.sinais.slice(0, 8) : [];
  if (e.firstIncomingFingerprint) lead.tipoMensagemFingerprint = e.firstIncomingFingerprint;
  lead.tipoEvidence = compactClassificationEvidence(e);
  return { changed, evidence: e };
}

/**
 * Converte conversas privadas em oportunidades e classifica cada contato.
 * A evidência de mensagens é usada apenas durante a classificação; o CRM guarda
 * somente sinais resumidos, fingerprint técnico e o motivo, nunca o texto bruto.
 */
async function applyPrivateOpportunityBatch(payload = {}) {
  const chats = Array.isArray(payload.chats) ? payload.chats : [];
  if (!chats.length) {
    if (payload.finalBatch) {
      const total = (await getLeads()).length;
      broadcast('PRIVATE_OPPORTUNITIES_UPDATED', {
        added: 0, updated: 0, classified: 0, total,
        scanned: Number(payload.totalChats) || 0,
        automatic: payload.automatic !== false,
        syncRunId: payload.syncRunId || '', scanId: payload.scanId || '',
        historyLoaded: Number(payload.historyLoaded) || 0,
        historyComplete: Number(payload.historyComplete) || 0,
      });
    }
    return { added: 0, updated: 0, classified: 0 };
  }

  const leads = await getLeads();
  const blocked = await blacklistTails();
  const settings = await getClassifierSettings();
  const profile = await getStoredBusinessProfile();
  let added = 0;
  let updated = 0;
  let classified = 0;
  const now = new Date().toISOString();
  const runId = String(payload.scanId || '');
  const run = runId
    ? (privateOpportunityRuns.get(runId) || { added: 0, updated: 0, classified: 0 })
    : { added: 0, updated: 0, classified: 0 };

  // Conta mensagens iguais por contato/chat. Usa apenas fingerprint, nunca o texto.
  const fingerprintOwners = new Map();
  const addFingerprint = (owner, fp) => {
    if (!fp) return;
    const key = String(owner || '');
    if (!key) return;
    if (!fingerprintOwners.has(key)) fingerprintOwners.set(key, fp);
  };
  for (const l of leads) {
    addFingerprint(phoneTail(l.phone) || l.waChatId || l.id, l.tipoMensagemFingerprint);
  }
  for (const chat of chats) addFingerprint(phoneTail(chat.phone) || chat.waChatId, chat.classifierEvidence?.firstIncomingFingerprint);
  const fpCounts = new Map();
  for (const fp of fingerprintOwners.values()) fpCounts.set(fp, (fpCounts.get(fp) || 0) + 1);

  const samePhone = (a, b) => {
    const ta = phoneTail(a);
    const tb = phoneTail(b);
    return !!ta && !!tb && ta === tb;
  };

  for (const chat of chats) {
    const waChatId = String(chat?.waChatId || '').trim();
    const phone = normWaPhone(chat?.phone || '');
    const validPhone = phone.length >= 10 && phone.length <= 15 ? phone : '';
    if (!waChatId && !validPhone) continue;

    let lead = null;
    if (waChatId) lead = leads.find((l) => String(l?.waChatId || '') === waChatId) || null;
    if (!lead && validPhone) lead = leads.find((l) => samePhone(l?.phone, validPhone)) || null;

    const isBlocked = validPhone && blocked.has(phoneTail(validPhone));
    if (!lead && isBlocked) continue;

    if (!lead) {
      const chatName = LeadIdentity.isValidName(chat?.name) ? String(chat.name).trim() : '';
      const identityMeta = { ...(chat?.identityMeta || {}) };
      if (validPhone && !identityMeta.phone) identityMeta.phone = LeadIdentity.makeMeta('whatsapp_store_phone', 0.98);
      lead = {
        id: uid('lead'),
        name: chatName,
        nameSource: chat?.nameSource || identityMeta.name?.source || '',
        identityMeta,
        phone: validPhone,
        source: 'whatsapp_private',
        stage: 'novo',
        tags: [],
        groups: [],
        opportunity: true,
        opportunitySource: 'whatsapp_private',
        opportunityCreatedAt: now,
        whatsappPrivate: true,
        waChatId,
        lastWhatsAppAt: chat?.lastMessageAt || null,
        whatsappUnreadCount: Number(chat?.unreadCount) || 0,
        whatsappMessageCount: Number(chat?.messageCount) || 0,
        whatsappArchived: !!chat?.archived,
        whatsappPinned: !!chat?.pinned,
        whatsappMuted: !!chat?.muted,
        createdAt: now,
        extractedAt: now,
        updatedAt: now,
      };
      LeadIdentity.initializeIdentityMeta(lead, 'whatsapp_private');
      leads.push(lead);
      added++;
    } else {
      let changed = false;
      const wasPrivateOpportunity = lead.opportunity === true && lead.opportunitySource === 'whatsapp_private';
      const setIfChanged = (key, value) => {
        if (value === undefined) return;
        if (lead[key] !== value) { lead[key] = value; changed = true; }
      };

      const identityCandidate = {
        source: 'whatsapp_private',
        name: LeadIdentity.isValidName(chat?.name) ? String(chat.name).trim() : '',
        phone: validPhone,
        identityMeta: { ...(chat?.identityMeta || {}) },
      };
      if (validPhone && !identityCandidate.identityMeta.phone) identityCandidate.identityMeta.phone = LeadIdentity.makeMeta('whatsapp_store_phone', 0.98);
      const identityMerge = LeadIdentity.mergeLeadIdentity(lead, identityCandidate, { source: 'whatsapp_private' });
      if (identityMerge.changed) changed = true;
      if (chat?.nameSource && !lead.nameSource && LeadIdentity.isValidName(chat.name)) setIfChanged('nameSource', chat.nameSource);
      setIfChanged('whatsappPrivate', true);
      if (waChatId) setIfChanged('waChatId', waChatId);
      if (chat?.lastMessageAt) setIfChanged('lastWhatsAppAt', chat.lastMessageAt);
      setIfChanged('whatsappUnreadCount', Number(chat?.unreadCount) || 0);
      setIfChanged('whatsappMessageCount', Number(chat?.messageCount) || 0);
      setIfChanged('whatsappArchived', !!chat?.archived);
      setIfChanged('whatsappPinned', !!chat?.pinned);
      setIfChanged('whatsappMuted', !!chat?.muted);

      if (!isBlocked && !lead.blacklisted) {
        if (lead.opportunity !== true) {
          setIfChanged('opportunity', true);
          if (!lead.opportunityCreatedAt) setIfChanged('opportunityCreatedAt', now);
        }
        setIfChanged('opportunitySource', 'whatsapp_private');
        // Quando um contato já existente entra no fluxo de PV pela primeira vez,
        // posiciona a nova oportunidade em Novo. O estágio é preservado nas
        // sincronizações seguintes para não desfazer o progresso comercial manual.
        if (!wasPrivateOpportunity) setIfChanged('stage', 'novo');
      } else if (lead.opportunity === true) {
        setIfChanged('opportunity', false);
      }

      if (changed) { lead.updatedAt = now; updated++; }
    }

    if (!lead.blacklisted && !isBlocked) {
      const rawEvidence = chat.classifierEvidence || {};
      const fp = rawEvidence.firstIncomingFingerprint || lead.tipoMensagemFingerprint || '';
      const count = fp ? (fpCounts.get(fp) || 1) : 0;
      const r = await applyClassification(lead, rawEvidence, settings, count, profile);
      if (r.changed) { lead.updatedAt = now; classified++; }
    }
  }

  if (added || updated || classified) await putLeads(leads);
  console.log('[i9Hub Sync] ' + JSON.stringify({ event: 'BATCH_PERSISTED', syncRunId: payload.scanId || null, batchIndex: payload.batchIndex, added, updated, classified, totalLeads: leads.length, finalBatch: !!payload.finalBatch, timestamp: new Date().toISOString(), context: 'service_worker' }));
  run.added += added;
  run.updated += updated;
  run.classified += classified;
  if (runId) privateOpportunityRuns.set(runId, run);
  if (payload.syncRunId && !payload.finalBatch && payload.phase === 'import') {
    broadcast('PRIVATE_OPPORTUNITIES_PROGRESS', {
      syncRunId: payload.syncRunId, scanId: payload.scanId || '',
      phase: payload.phase || 'import',
      processedSoFar: Number(payload.processedSoFar) || 0,
      totalChats: Number(payload.totalChats) || 0,
      added: Number(run.added) || 0, updated: Number(run.updated) || 0,
      classified: Number(run.classified) || 0, persisted: true,
    });
  }

  if (payload.finalBatch) {
    const priorRunError = runId ? privateOpportunityRunErrors.get(runId) : '';
    if (priorRunError) {
      privateOpportunityRunErrors.delete(runId);
      privateOpportunityRuns.delete(runId);
      if (payload.syncRunId) broadcast('PRIVATE_OPPORTUNITIES_SYNC_FAILED', {
        syncRunId: payload.syncRunId, scanId: payload.scanId || '',
        error: priorRunError, message: 'Um lote de conversas não foi salvo corretamente no CRM.',
      });
      return { added: Number(run.added) || 0, updated: Number(run.updated) || 0, classified: Number(run.classified) || 0 };
    }
    const totals = runId ? (privateOpportunityRuns.get(runId) || run) : run;
    if (runId) privateOpportunityRuns.delete(runId);
    const total = (await getLeads()).length;
    if (Number(totals.added) > 0) recordTelemetry('crm.opportunity.opened', 'telemetry.sales_funnel', { count: Number(totals.added), success: true }).catch(() => {});
    // v1.0.3-fix: grava snapshot de respostas pendentes para que o dashboard
    // possa distinguir "sem pendências" de "não sincronizado". O contador é
    // calculado com a mesma regra do GET_AWAITING_REPLIES logo após persistir.
    try {
      const leadsAfter = await getLeads();
      let pendingCount = 0;
      for (const lead of leadsAfter) {
        const ev = lead?.tipoEvidence || lead?.classifierEvidence || {};
        const inAt = Date.parse(ev.lastIncomingAt || '');
        const outAt = Date.parse(ev.lastOutgoingAt || '');
        if (!Number.isFinite(inAt)) continue;
        if (Number.isFinite(outAt) && outAt >= inAt) continue;
        const isPrivate = lead?.whatsappPrivate === true || lead?.source === 'whatsapp_private' || !!lead?.waChatId;
        if (!isPrivate || lead?.blacklisted || lead?.stage === 'blacklist' || normalizeType(lead?.tipo) === 'spam') continue;
        pendingCount++;
      }
      console.log('[i9Hub Sync] ' + JSON.stringify({ event: 'SNAPSHOT_READ', syncRunId: payload.scanId || null, pendingCount, totalPrivateLeads: leadsAfter.filter(l => l?.whatsappPrivate === true || l?.source === 'whatsapp_private' || !!l?.waChatId).length, timestamp: new Date().toISOString(), context: 'service_worker' }));
      recordTelemetry('whatsapp.awaiting_reply.snapshot', 'dashboard.awaiting_reply', { count: pendingCount }).catch(() => {});
    } catch { /* snapshot best-effort */ }
    broadcast('PRIVATE_OPPORTUNITIES_UPDATED', {
      added: totals.added,
      updated: totals.updated,
      classified: totals.classified,
      total,
      scanned: Number(payload.totalChats) || 0,
      automatic: payload.automatic !== false,
      scanId: payload.scanId || '',
      syncRunId: payload.syncRunId || '',
      historyLoaded: Number(payload.historyLoaded) || 0,
      historyComplete: Number(payload.historyComplete) || 0,
      errorsCount: Number(payload.errorsCount) || 0,
    });
    saveSystemLog({
      module: 'crm',
      action: 'PRIVATE_OPPORTUNITIES_SYNCED',
      status: 'success',
      message: 'Conversas privadas sincronizadas e classificadas',
      data: { added: totals.added, updated: totals.updated, classified: totals.classified, total, scanned: Number(payload.totalChats) || 0, automatic: payload.automatic !== false },
    });
  }

  return { added, updated, classified };
}

async function saveLeads({ leads = [], source = 'manual' }) {
  const current = await getLeads();
  const identityIndex = LeadIdentity.createIdentityIndex(current);
  const settings = await getClassifierSettings();
  const profile = await getStoredBusinessProfile();
  let added = 0; let updated = 0; let classified = 0;
  const automationTagTransitions = [];

  for (const raw of leads) {
    if (!raw || typeof raw !== 'object') continue;
    const lead = { ...raw, source: raw.source || source, stage: raw.stage || 'novo' };
    LeadIdentity.initializeIdentityMeta(lead, lead.source);
    const existing = LeadIdentity.findIdentityMatch(identityIndex, lead);

    if (existing) {
      const identityMerge = LeadIdentity.mergeLeadIdentity(existing, lead, { source: lead.source });
      const groups = [...new Set([...(existing.groups || []), existing.groupName, raw.groupName, ...(raw.groups || [])].filter(Boolean))];
      const previousTags = Array.isArray(existing.tags) ? [...existing.tags] : [];
      const tags = [...new Set([...previousTags, ...(raw.tags || [])])];
      for (const tag of getNewlyAddedTags(previousTags, tags)) automationTagTransitions.push({ leadId: String(leadId(existing)), tag, at: new Date().toISOString(), id: uid('tag_transition') });
      // Identity fields are merged by source/confidence. Never overwrite a manual correction.
      if (raw.placeId && !existing.placeId) existing.placeId = raw.placeId;
      if (raw.url && !existing.url) existing.url = raw.url;
      if (raw.waChatId && !existing.waChatId) existing.waChatId = raw.waChatId;
      if (raw.stage && !existing.stage) existing.stage = raw.stage;
      if (tags.length) existing.tags = tags;
      if (groups.length) existing.groups = groups;
      if (raw.crmLabel) existing.crmLabel = raw.crmLabel;
      if (raw.tipoManual === true) {
        existing.tipoManual = true;
        existing.tipo = normalizeType(raw.tipo);
        existing.tipoMotivo = raw.tipoMotivo || 'Classificação manual pelo usuário';
        existing.tipoOrigem = 'manual';
      }
      if (identityMerge.changed || raw.rating != null || raw.reviewsCount != null || raw.value != null) existing.updatedAt = new Date().toISOString();

      if (raw.classifierEvidence || raw.tipoEvidence) {
        const r = await applyClassification(existing, raw.classifierEvidence || raw.tipoEvidence || {}, settings, Number(raw.sameMessageCount) || 0, profile);
        if (r.changed) classified++;
      } else if (existing.tipoManual !== true) {
        const r = classifyLead(existing, existing.tipoEvidence || {}, { settings, profile });
        if (existing.tipo !== normalizeType(r.tipo) || existing.tipoMotivo !== r.motivo) {
          existing.tipo = normalizeType(r.tipo);
          existing.tipoMotivo = r.motivo;
          existing.tipoOrigem = r.origem;
          existing.tipoClassificadoEm = new Date().toISOString();
          existing.tipoSinais = r.sinais || [];
          classified++;
        }
      }
      updated++;
      LeadIdentity.indexIdentityLead(identityIndex, existing);
      continue;
    }

    lead.groups = [...new Set([...(lead.groups || []), lead.groupName].filter(Boolean))];
    lead.id = lead.id || uid('lead');
    lead.createdAt = lead.createdAt || new Date().toISOString();
    if (lead.tipoManual === true) {
      lead.tipo = normalizeType(lead.tipo);
      lead.tipoMotivo = lead.tipoMotivo || 'Classificação manual pelo usuário';
      lead.tipoOrigem = 'manual';
      lead.tipoClassificadoEm = lead.tipoClassificadoEm || new Date().toISOString();
    } else {
      const r = classifyLead(lead, lead.classifierEvidence || lead.tipoEvidence || {}, { settings, profile });
      lead.tipo = normalizeType(r.tipo);
      lead.tipoMotivo = r.motivo;
      lead.tipoOrigem = r.origem;
      lead.tipoClassificadoEm = new Date().toISOString();
      lead.tipoSinais = r.sinais || [];
      if (lead.classifierEvidence?.firstIncomingFingerprint) lead.tipoMensagemFingerprint = lead.classifierEvidence.firstIncomingFingerprint;
      lead.tipoEvidence = compactClassificationEvidence(lead.classifierEvidence || {});
      classified++;
    }
    current.push(lead);
    LeadIdentity.indexIdentityLead(identityIndex, lead);
    added++;
  }
  await putLeads(current);
  for (const transition of automationTagTransitions) {
    try { await runCalendarAutomationsForTransition({ id: transition.leadId }, { type: 'tag', value: transition.tag, at: transition.at, id: transition.id }); }
    catch { /* uma automação não pode invalidar a importação/salvamento do lead */ }
  }
  return { success: true, data: { added, updated, classified, total: current.length, automationTriggers: automationTagTransitions.length } };
}

async function deduplicateLeads() {
  const current = await getLeads();
  const out = [];
  const identityIndex = new Map();
  for (const lead of current) {
    if (!lead || typeof lead !== 'object') continue;
    LeadIdentity.initializeIdentityMeta(lead, lead.source || 'unknown');
    const existing = LeadIdentity.findIdentityMatch(identityIndex, lead);
    if (!existing) {
      out.push(lead);
      LeadIdentity.indexIdentityLead(identityIndex, lead);
      continue;
    }
    LeadIdentity.mergeLeadIdentity(existing, lead, { source: lead.source });
    for (const key of ['placeId', 'url', 'waChatId', 'source']) if (!existing[key] && lead[key]) existing[key] = lead[key];
    // Deduplicação deve consolidar histórico sem descartar anotações de nenhum registro.
    const noteMap = new Map();
    for (const note of [...normalizeCrmNotes(existing.notes), ...normalizeCrmNotes(lead.notes)]) {
      const key = String(note.id || `${note.createdAt}|${note.author}|${note.text}`);
      if (!noteMap.has(key)) noteMap.set(key, note);
    }
    existing.notes = [...noteMap.values()];
    const activityMap = new Map();
    for (const event of [...(Array.isArray(existing.activityLog) ? existing.activityLog : []), ...(Array.isArray(lead.activityLog) ? lead.activityLog : [])]) {
      if (!event || typeof event !== 'object') continue;
      const key = String(event.id || `${event.createdAt}|${event.type}|${event.title}`);
      if (!activityMap.has(key)) activityMap.set(key, event);
    }
    existing.activityLog = [...activityMap.values()].slice(-500);
    existing.tags = [...new Set([...(existing.tags || []), ...(lead.tags || [])])];
    existing.groups = [...new Set([...(existing.groups || []), ...(lead.groups || []), lead.groupName].filter(Boolean))];
    existing.updatedAt = new Date().toISOString();
    LeadIdentity.indexIdentityLead(identityIndex, existing);
  }
  await putLeads(out);
  return { success: true, data: { removed: current.length - out.length, total: out.length } };
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function exportCSV({ leads = [], filename }) {
  const cols = ['name', 'phone', 'email', 'company', 'address', 'category', 'rating', 'reviewsCount', 'website', 'url', 'source', 'groupName', 'perfil', 'situacao', 'tags', 'aiTags', 'nichePath', 'exactRequest', 'aiSummary', 'stage', 'tipo', 'tipoMotivo', 'leadScore', 'qualificationStatus', 'leadQualified', 'leadHot', 'leadScoreSignals', 'createdAt'];
  const lines = [cols.join(',')].concat(leads.map((l) => cols.map((c) => {
    const value = c === 'nichePath' ? (l.aiNicheClassification?.path || []).join(' > ') : c === 'exactRequest' ? l.aiIntelligence?.exactRequest || '' : c === 'aiSummary' ? l.aiIntelligence?.summary || '' : c === 'leadScore' ? (l._i9Score?.score ?? l.leadScore ?? '') : c === 'qualificationStatus' ? (l._i9Score?.status ?? l.qualificationStatus ?? '') : c === 'leadQualified' ? (l._i9Score ? (l._i9Score.qualified ? 'Sim' : 'Não') : (l.leadQualified ?? '')) : c === 'leadHot' ? (l._i9Score ? (l._i9Score.hot ? 'Sim' : 'Não') : (l.leadHot ?? '')) : c === 'leadScoreSignals' ? (l._i9Score?.activeSignals || []).map((signal) => `${signal.label} (${signal.points > 0 ? '+' : ''}${signal.points})`).join('; ') : l[c];
    return csvEscape(Array.isArray(value) ? value.join(', ') : value);
  }).join(',')));
  const csv = '﻿' + lines.join('\r\n');
  const url = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  await chrome.downloads.download({ url, filename: filename || `leads_${Date.now()}.csv`, saveAs: true });
  return { success: true, data: { count: leads.length } };
}

async function getSettings() { return getOne(K.SETTINGS, {}); }
async function getStoredBusinessProfile() {
  const s = await getSettings();
  return s?.businessProfile || null;
}
async function getClassifierSettings() {
  const s = await getSettings();
  return normalizeClassifierSettings(s?.classifier || {});
}

/**
 * Aplica o classificador a um lead sem nunca sobrescrever uma decisão manual.
 * A evidência de WhatsApp é transitória: somente tipo/motivo/sinais resumidos são persistidos.
 */
async function classifyLeadRecord(lead, evidence = {}) {
  if (!lead || lead.tipoManual === true) {
    if (lead && !TYPE_VALUES.includes(normalizeType(lead.tipo))) lead.tipo = 'a_classificar';
    return lead;
  }
  const settings = await getClassifierSettings();
  const profile = await getStoredBusinessProfile();
  const result = classifyLead(lead, evidence, { settings, profile });
  const next = normalizeType(result.tipo);
  const changed =
    lead.tipo !== next ||
    lead.tipoMotivo !== result.motivo ||
    lead.tipoOrigem !== result.origem ||
    JSON.stringify(lead.tipoSinais || []) !== JSON.stringify(result.sinais || []);
  lead.tipo = next;
  lead.tipoMotivo = result.motivo;
  lead.tipoOrigem = result.origem;
  lead.tipoClassificadoEm = new Date().toISOString();
  lead.tipoSinais = Array.isArray(result.sinais) ? result.sinais.slice(0, 8) : [];
  return { lead, changed };
}

/** Migra leads antigos para o novo campo `tipo` e recalcula apenas os automáticos. */
async function classifyAllLeads({ force = false } = {}) {
  const leads = await getLeads();
  const settings = await getClassifierSettings();
  const profile = await getStoredBusinessProfile();
  const fpCounts = new Map();
  for (const l of leads) {
    const fp = String(l?.tipoMensagemFingerprint || '');
    if (fp) fpCounts.set(fp, (fpCounts.get(fp) || 0) + 1);
  }
  let changed = false;
  for (const lead of leads) {
    if (!lead) continue;
    const normalized = normalizeType(lead.tipo);
    if (lead.tipo !== normalized) { lead.tipo = normalized; changed = true; }
    if (lead.tipoManual === true) {
      if (!lead.tipoMotivo) { lead.tipoMotivo = 'Classificação manual pelo usuário'; lead.tipoOrigem = 'manual'; changed = true; }
      continue;
    }
    if (force || !lead.tipoClassificadoEm || lead.tipo === 'a_classificar') {
      const r = await applyClassification(
        lead,
        lead.tipoEvidence || {},
        settings,
        lead.tipoMensagemFingerprint ? (fpCounts.get(lead.tipoMensagemFingerprint) || 1) : 0,
        profile
      );
      if (r.changed) changed = true;
    }
  }
  if (changed) await putLeads(leads);
  return { leads, changed };
}

function validateWebhookUrl(value) {
  let u;
  try { u = new URL(String(value || '').trim()); } catch { throw new Error('URL do webhook inválida.'); }
  if (u.protocol !== 'https:') throw new Error('Por segurança, o webhook precisa usar HTTPS.');
  if (u.username || u.password) throw new Error('A URL do webhook não pode conter usuário ou senha.');
  if (u.hash) u.hash = '';
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test') || !host.includes('.')) {
    throw new Error('O webhook precisa usar um domínio HTTPS público válido.');
  }
  const octets = host.split('.').map((v) => /^\d+$/.test(v) ? Number(v) : NaN);
  if (octets.length === 4 && octets.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) {
    const [a,b,c] = octets;
    const privateIPv4 = a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0))
      || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || b === 51))
      || (a === 192 && b === 88 && c === 99) || (a === 203 && b === 0 && c === 113) || (a >= 224);
    if (privateIPv4) throw new Error('O webhook não pode apontar para um IP local, privado ou reservado.');
  }
  if (host.includes(':')) {
    const ipv6 = host.toLowerCase();
    if (ipv6 === '::' || ipv6 === '::1' || ipv6.startsWith('fc') || ipv6.startsWith('fd') || ipv6.startsWith('fe80') || ipv6.startsWith('::ffff:')) {
      throw new Error('O webhook não pode apontar para um endereço IPv6 local ou reservado.');
    }
  }
  return u.href;
}

function normalizeWebhookHeaders(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = Object.create(null);
  const blocked = /^(host|content-length|cookie|set-cookie|origin|referer|connection|transfer-encoding|upgrade|proxy-.*)$/i;
  for (const [rawName, rawValue] of Object.entries(input).slice(0, 25)) {
    const name = String(rawName || '').trim();
    const value = String(rawValue ?? '');
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,64}$/.test(name) || blocked.test(name)) continue;
    if (value.length > 2000 || /[\r\n]/.test(value)) continue;
    out[name] = value;
  }
  return out;
}

async function webhookRequest(url, leads, settings, test = false) {
  const safeUrl = validateWebhookUrl(url);
  const target = new URL(safeUrl);
  const method = String(settings.webhookMethod || 'POST').toUpperCase();
  if (!['POST', 'PUT'].includes(method)) throw new Error('Método de webhook inválido. Use POST ou PUT.');
  const contentType = ['application/json', 'application/x-www-form-urlencoded'].includes(settings.webhookContentType)
    ? settings.webhookContentType : 'application/json';
  const headers = { 'Content-Type': contentType, ...normalizeWebhookHeaders(settings.webhookHeaders) };
  if (settings.webhookApiKey) headers['X-API-Key'] = String(settings.webhookApiKey).slice(0, 1000);
  if (chrome.permissions?.contains) {
    const granted = await chrome.permissions.contains({ origins: [`${target.origin}/*`] });
    if (!granted) throw new Error('Autorize o acesso ao domínio do webhook antes de enviar.');
  }
  const body = JSON.stringify(test ? { test: true, timestamp: new Date().toISOString() } : { source: 'i9leads-flow', count: Array.isArray(leads) ? leads.length : 0, leads: Array.isArray(leads) ? leads : [] });
  return fetch(safeUrl, { method, headers, body, credentials: 'omit', cache: 'no-store', redirect: 'error' });
}

// ---------------------------------------------------------------------------
// Abas (WhatsApp Web / Google Maps)
// ---------------------------------------------------------------------------
async function findTab(urlPattern) {
  const tabs = await chrome.tabs.query({ url: urlPattern });
  if (!tabs.length) return null;
  return tabs.find((t) => t.active && t.currentWindow) || tabs.find((t) => t.active) || tabs[0];
}

function sendToTab(tabId, message, frameId) {
  return new Promise((resolve) => {
    const cb = (resp) => {
      if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message, noReceiver: true });
      else resolve(resp || { success: false, error: 'Sem resposta da página' });
    };
    if (frameId != null) chrome.tabs.sendMessage(tabId, message, { frameId }, cb);
    else chrome.tabs.sendMessage(tabId, message, cb);
  });
}

async function injectScripts(tabId, kind, frameId) {
  try {
    const target = frameId != null ? { tabId, frameIds: [frameId] } : { tabId };
    if (kind === 'whatsapp') {
      await chrome.scripting.executeScript({ target, files: ['content/content.js'] });
      await chrome.scripting.executeScript({ target, files: ['content/lead-identity.js'], world: 'MAIN' });
      await chrome.scripting.executeScript({ target, files: ['content/injected.js'], world: 'MAIN' });
    } else {
      await chrome.scripting.executeScript({ target, files: ['content/lead-identity.js'] });
      await chrome.scripting.executeScript({ target, files: ['content/maps-name.js'] });
      await chrome.scripting.executeScript({ target, files: ['content/maps-extractor.js'] });
    }
    return true;
  } catch { return false; }
}

/** Envia mensagem à aba/frame; se o content script não estiver presente, injeta e tenta de novo. */
async function sendToTabEnsured(tab, kind, message, frameId) {
  let r = await sendToTab(tab.id, message, frameId);
  if (r.noReceiver && (await injectScripts(tab.id, kind, frameId))) {
    await new Promise((res) => setTimeout(res, 800));
    r = await sendToTab(tab.id, message, frameId);
  }
  if (r.noReceiver) r = { success: false, error: 'Não foi possível comunicar com a página. Recarregue a aba/painel do WhatsApp e tente novamente.' };
  return r;
}

// ---------------------------------------------------------------------------
// Conexão com o WhatsApp Web  (v7.0.2: WhatsApp EMBUTIDO na extensão)
//
//  Como funciona, em 3 passos:
//   1) A tela da extensão (aba cheia) carrega o WhatsApp Web num <iframe>
//      — painel "WhatsApp" à direita (sidepanel/components/WhatsAppDock.js).
//   2) Aqui no service worker achamos esse iframe (aba da extensão + frameId) e
//      falamos diretamente com ele (chrome.tabs.sendMessage com { frameId }).
//   3) Como a aba da extensão fica em primeiro plano, o Chrome não "congela" o
//      WhatsApp — a causa das falhas "em segundo plano" da v7.0.1.
//
//  Ordem de busca:  (1) iframe embutido  ->  (2) aba comum do WhatsApp já aberta.
//  Nenhuma aba é mais criada em segundo plano.
// ---------------------------------------------------------------------------
const WA_ORIGIN_RE = /^https:\/\/web\.whatsapp\.com\//;
const WA_RULE_ID = 7001;

/**
 * Libera o <iframe>. O WhatsApp Web responde com X-Frame-Options / CSP "frame-ancestors" que
 * impedem de embuti-lo. Esta regra remove esses cabeçalhos SOMENTE nas respostas de
 * sub-frames de web.whatsapp.com pedidos por esta extensão (initiatorDomains).
 *
 * v7.0.3 - "nível de compatibilidade" (waLevel), subido automaticamente pelo painel quando o
 * WhatsApp devolve a página de erro dentro do iframe:
 *   0 = padrão (só cabeçalhos de resposta, restrito à extensão)
 *   1 = compatível: remove a restrição de origem do pedido E o cabeçalho Referer enviado ao
 *       WhatsApp (o Referer de uma extensão é "chrome-extension://…", que o servidor pode recusar)
 */
async function getWaLevel() {
  const st = await chrome.storage.local.get(['waLevel', 'waRulesRelaxed']);
  if (Number.isInteger(st.waLevel)) return st.waLevel;
  return st.waRulesRelaxed ? 1 : 0;
}

/** v7.0.5 - O WhatsApp embutido (iframe) é experimental e fica DESLIGADO por padrão. */
async function getEmbedEnabled() {
  const st = await chrome.storage.local.get('waEmbedExperimental');
  return st.waEmbedExperimental === true;
}

async function ensureEmbedRules() {
  // Sem iframe, não há por que mexer nos cabeçalhos do WhatsApp: a regra é removida.
  if (!(await getEmbedEnabled())) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [WA_RULE_ID] }).catch(() => {});
    return;
  }
  const level = await getWaLevel();
  const condition = { requestDomains: ['web.whatsapp.com'], resourceTypes: ['sub_frame'] };
  if (level < 1) condition.initiatorDomains = [chrome.runtime.id];
  const action = {
    type: 'modifyHeaders',
    responseHeaders: [
      { header: 'x-frame-options', operation: 'remove' },
      { header: 'content-security-policy', operation: 'remove' },
      { header: 'content-security-policy-report-only', operation: 'remove' },
    ],
  };
  if (level >= 1) action.requestHeaders = [{ header: 'referer', operation: 'remove' }];
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [WA_RULE_ID],
    addRules: [{ id: WA_RULE_ID, priority: 1, action, condition }],
  });
}

/** Procura, nas abas da extensão, um iframe do WhatsApp Web já carregado. */
async function findEmbeddedWhatsApp() {
  if (!(await getEmbedEnabled())) return null;
  const hostTabs = await chrome.tabs.query({ url: chrome.runtime.getURL('sidepanel/*') });
  for (const tab of hostTabs) {
    let frames = [];
    try { frames = (await chrome.webNavigation.getAllFrames({ tabId: tab.id })) || []; } catch { /* aba sem frames */ }
    const f = frames.find((fr) => fr.frameId !== 0 && WA_ORIGIN_RE.test(fr.url || '') && !fr.errorOccurred);
    if (f) return { tab, frameId: f.frameId };
  }
  return null;
}

/** A aba da extensão está realmente visível? (ativa e janela não minimizada) */
async function hostVisible(tab) {
  try {
    const t = await chrome.tabs.get(tab.id);
    if (!t.active) return false;
    const w = await chrome.windows.get(t.windowId);
    return w.state !== 'minimized';
  } catch { return false; }
}

async function probeTab(tab, frameId) {
  const r = await sendToTabEnsured(tab, 'whatsapp', { type: 'CHECK_READY' }, frameId);
  return r.success && r.ready
    ? { ready: true, loggedIn: !!r.loggedIn, page: r.page || (r.loggedIn ? 'chat' : 'loading'), pageInfo: r.pageInfo || null, me: r.me || '', store: r.store || null, storeInternals: r.storeInternals || null, injectedVersion: r.injectedVersion || '', hidden: !!r.hidden }
    : { ready: false, loggedIn: false, page: 'none', pageInfo: null, me: '', store: null, storeInternals: null, injectedVersion: '', hidden: false };
}

function keepTabAlive(tabId) {
  // Evita que o Chrome (Memory Saver) descarte a aba durante uma campanha.
  chrome.tabs.update(tabId, { autoDiscardable: false }).catch(() => {});
}

/**
 * v7.0.5 - A aba/janela do WhatsApp está realmente visível?
 * (aba ativa na sua janela, janela não minimizada E a própria página diz que não está oculta —
 *  o Chrome marca a página como oculta também quando outra janela a cobre.)
 */
async function waTabVisible(tab, pageHidden) {
  try {
    const t = await chrome.tabs.get(tab.id);
    if (!t.active) return false;
    const w = await chrome.windows.get(t.windowId);
    if (w.state === 'minimized') return false;
    return !pageHidden;
  } catch { return false; }
}

/** Ordena as abas do WhatsApp: a escolhida pelo usuário, a janela lateral, as ativas. */
async function sortedWaTabs() {
  // Query/filter by parsed URL so trailing paths, pending navigation and URL-pattern quirks do not hide an open WhatsApp tab.
  const allTabs = await chrome.tabs.query({});
  const tabs = allTabs.filter((tab) => {
    try { const u = new URL(tab.url || tab.pendingUrl || ''); return u.protocol === 'https:' && u.hostname.toLowerCase() === 'web.whatsapp.com'; }
    catch { return false; }
  });
  const { waWindowId, waTabId } = await chrome.storage.local.get(['waWindowId', 'waTabId']);
  tabs.sort((x, y) =>
    (Number(y.id === waTabId) - Number(x.id === waTabId)) ||
    (Number(y.windowId === waWindowId) - Number(x.windowId === waWindowId)) ||
    (Number(y.active) - Number(x.active)));
  return { tabs, waWindowId, waTabId };
}

/**
 * Procura uma aba/janela comum do WhatsApp Web (inclui a "janela lateral" aberta pela extensão).
 * v7.0.5: devolve também aba com QR code / carregando / erro (antes virava "não aberto") e a visibilidade.
 */
async function pickTabConnection() {
  const { tabs, waWindowId, waTabId } = await sortedWaTabs();
  let fallback = null;
  for (const tab of tabs) {
    const p = await probeTab(tab);
    const base = { mode: 'tab', tabId: tab.id, windowId: tab.windowId, windowMode: tab.windowId === waWindowId, chosen: tab.id === waTabId, tabsFound: tabs.length };
    if (p.loggedIn) {
      keepTabAlive(tab.id);
      const visible = await waTabVisible(tab, p.hidden);
      return { ...base, state: 'connected', phone: p.me, store: p.store, storeInternals: p.storeInternals, visible, hidden: p.hidden, tabActive: !!tab.active };
    }
    if (!fallback) {
      if (!p.ready) fallback = { ...base, state: 'opening' };
      else if (p.page === 'error') fallback = { ...base, state: 'error', errorKind: 'wa-error-page', error: 'O WhatsApp mostrou uma página de erro nesta aba. Recarregue a aba do WhatsApp Web.', pageInfo: p.pageInfo };
      else if (p.page === 'qr') fallback = { ...base, state: 'qr' };
      else fallback = { ...base, state: 'opening' };
    }
  }
  return fallback;
}

/**
 * Estado: none | opening | qr | error | connected  (+ mode: 'tab' | 'embedded').
 * v7.0.5: o padrão é a aba/janela comum. O iframe só é consultado se o modo experimental estiver ligado.
 * Nunca devolvemos "connected" escondendo uma página de erro: se o iframe estiver com erro e a conexão
 * vier de uma aba, o resultado leva `embedError`, e o painel mostra isso explicitamente.
 */
async function waConnection() {
  const embedOn = await getEmbedEnabled();
  const emb = embedOn ? await findEmbeddedWhatsApp() : null;
  let embState = null;
  if (emb) {
    keepTabAlive(emb.tab.id);
    const base = { mode: 'embedded', tabId: emb.tab.id, frameId: emb.frameId };
    const p = await probeTab(emb.tab, emb.frameId);
    if (!p.ready) embState = { ...base, state: 'opening' };
    else if (p.loggedIn) return { ...base, state: 'connected', phone: p.me, store: p.store, storeInternals: p.storeInternals, visible: !p.hidden, hidden: p.hidden };
    else if (p.page === 'error') embState = { ...base, state: 'error', errorKind: 'wa-error-page', error: 'O WhatsApp devolveu uma página de erro dentro do painel', pageInfo: p.pageInfo };
    else if (p.page === 'qr') embState = { ...base, state: 'qr' };
    else embState = { ...base, state: 'opening' };
  }
  const t = await pickTabConnection();
  if (t && t.state === 'connected' && (!embState || embState.state === 'error' || t.windowMode)) {
    return embState && embState.state === 'error' ? { ...t, embedError: embState.error } : t;
  }
  if (embState) return embState;
  if (t) return t;
  return { state: 'none', embedEnabled: embedOn };
}

/** WhatsApp conectado (iframe ou aba), onde campanhas e extrações rodam. */
async function requireWhatsApp() {
  const c = await waConnection();
  if (c.state === 'connected') return { tab: await chrome.tabs.get(c.tabId), frameId: c.frameId, conn: c };
  throw new Error({
    none: 'O WhatsApp Web não está aberto. Use "Abrir WhatsApp" no painel de Campanhas WhatsApp e escaneie o QR code, se pedir.',
    opening: 'O WhatsApp Web ainda está carregando. Aguarde alguns segundos e tente novamente.',
    qr: 'O WhatsApp Web não está conectado. Escaneie o QR code na aba/janela do WhatsApp.',
    error: 'O WhatsApp mostrou uma página de erro. Recarregue a aba do WhatsApp Web (F5) e tente novamente.',
  }[c.state] || 'WhatsApp Web indisponível.');
}

async function requireWhatsAppTab() { return (await requireWhatsApp()).tab; }

async function waitTabComplete(tabId, timeout = 30000) {
  try {
    const current = await chrome.tabs.get(tabId);
    if (current?.status === 'complete') return;
  } catch { return; }
  return new Promise((resolve) => {
    const t = setTimeout(done, timeout);
    function listener(id, info) { if (id === tabId && info.status === 'complete') done(); }
    function done() { clearTimeout(t); chrome.tabs.onUpdated.removeListener(listener); resolve(); }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/** Traz a aba/janela do WhatsApp para frente (e restaura se estiver minimizada). */
async function bringWaToFront(tab) {
  try {
    await chrome.tabs.update(tab.id, { active: true });
    const w = await chrome.windows.get(tab.windowId);
    await chrome.windows.update(tab.windowId, { focused: true, ...(w.state === 'minimized' ? { state: 'normal' } : {}) });
  } catch { /* melhor esforço */ }
}

// ---------------------------------------------------------------------------
// v5.4.0 — telemetria pseudonimizada, experiência administrativa e atendimento IA local
// ---------------------------------------------------------------------------
const AI_CONFIG_KEY = 'aiSupportConfig';
const AI_ORDERS_KEY = 'aiSupportOrders';
const AI_CONVERSATIONS_KEY = 'aiSupportConversations';
const AI_PROCESSED_KEY = 'aiProcessedMessageIds';
const AI_MONITOR_EVENTS_KEY = 'aiSupportMonitorEvents';
const AI_INCOMING_QUEUE_KEY = 'aiSupportIncomingQueue';
const AI_INCOMING_QUEUE_LIMIT = 100;
const AI_INCOMING_QUEUE_TTL_MS = 24 * 60 * 60 * 1000;
const AI_INCOMING_REVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const AI_HANDOFFS_KEY = 'aiHumanHandoffs';
const AI_RATE_LIMIT_KEY = 'aiSupportRateLimitState';
const AI_HEARTBEAT_KEY = 'aiSupportHeartbeatAt';
// v1.0.9: o Chrome reduz os timers de abas em segundo plano para ~1/min; 45 s derrubava o painel por engano.
const AI_HEARTBEAT_TTL_MS = 120000;
const AI_HISTORY_QUEUE_KEY = 'aiSupportConversationHistoryQueue';
const AI_HISTORY_DEDUPE_KEY = 'aiSupportConversationHistoryDedupe';
const AI_LEAD_SYNC_QUEUE_KEY = 'aiSupportLeadIntelligenceSyncQueue';
const AI_LEAD_SHEET_READY_KEY = 'aiSupportLeadSheetReadyId';
let aiIncomingProcessingChain = Promise.resolve();
let aiIncomingQueueMutationChain = Promise.resolve();
let aiQueueRecovered = false;
let aiPendingInboundCount = 0;
let aiProcessingStateSeq = 0;
let aiHistoryWriteChain = Promise.resolve();
let aiHistoryFlushPromise = null;
let aiHistoryFlushRequested = false;
let aiLeadSheetWriteChain = Promise.resolve();
let aiLeadSyncFlushPromise = null;
const TELEMETRY_QUEUE_KEY = 'telemetryEventQueue';
const TELEMETRY_COUNTERS_KEY = 'telemetryCounters';
const TELEMETRY_PROFILE_KEY = 'telemetryProfile';
const TELEMETRY_CONSENT_MIGRATION_KEY = 'telemetryConsentOptInMigrationV1';
const AUDIENCES_KEY = 'whatsappStatusAudiences';
const MARKETING_CONFIG_KEY = 'marketingTrackingConfig';
const COMMERCIAL_PERFORMANCE_CONFIG_KEY = 'commercialPerformanceConfig';
const COMMERCIAL_MANAGEMENT_CONFIG_KEY = 'commercialManagementConfig';
const ADMIN_CONFIG_KEY = 'adminExtensionExperienceConfig';

async function getCommercialManagementConfig() {
  const stored = await getOne(COMMERCIAL_MANAGEMENT_CONFIG_KEY, {});
  return {
    sellers: Array.isArray(stored?.sellers) ? stored.sellers.filter((item) => item && typeof item === 'object') : [],
    teams: Array.isArray(stored?.teams) ? stored.teams.filter((item) => item && typeof item === 'object') : [],
    products: Array.isArray(stored?.products) ? stored.products.filter((item) => item && typeof item === 'object') : [],
    goals: Array.isArray(stored?.goals) ? stored.goals.filter((item) => item && typeof item === 'object') : [],
    updatedAt: stored?.updatedAt || null,
  };
}

function normalizeCommercialName(value, max = 160) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

function findCommercialSeller(config, id, name, activeOnly = false) {
  const byId = id ? config.sellers.find((item) => String(item.id) === String(id)) : null;
  if (byId && (!activeOnly || byId.active !== false)) return byId;
  const normalized = normalizeCommercialName(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  return normalized ? config.sellers.find((item) => (!activeOnly || item.active !== false) && normalizeCommercialName(item.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR') === normalized) || null : null;
}

function findCommercialProduct(config, id, name, activeOnly = false) {
  const byId = id ? config.products.find((item) => String(item.id) === String(id)) : null;
  if (byId && (!activeOnly || byId.active !== false)) return byId;
  const normalized = normalizeCommercialName(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  return normalized ? config.products.find((item) => (!activeOnly || item.active !== false) && normalizeCommercialName(item.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR') === normalized) || null : null;
}

function snapshotLeadCommission(lead, config, at = new Date().toISOString(), force = false) {
  const existingRate = Number(lead?.commissionRateAtSale);
  const hasExistingRate = lead?.commissionRateAtSale !== null && lead?.commissionRateAtSale !== undefined && lead?.commissionRateAtSale !== '' && Number.isFinite(existingRate) && existingRate >= 0 && existingRate <= 100;
  const saleValueNow = Number(lead?.saleValue);
  if (!force && hasExistingRate && Number.isFinite(saleValueNow) && saleValueNow > 0) {
    lead.commissionAmountAtSale = Math.round((saleValueNow * existingRate / 100) * 100) / 100;
    lead.commissionSnapshotAt = lead.commissionSnapshotAt || at;
    if (!lead.commissionStatus) lead.commissionStatus = 'pending';
    return true;
  }
  const seller = findCommercialSeller(config, lead?.commercialOwnerId, lead?.commercialOwner, !lead?.commercialOwnerId);
  const productName = normalizeCommercialName(lead?.commercialProductName || lead?.commercialProduct, 160);
  const product = findCommercialProduct(config, lead?.commercialProductId, productName, !lead?.commercialProductId);
  const saleValue = Number(lead?.saleValue);
  if (!seller || (productName && !product) || !Number.isFinite(saleValue) || saleValue <= 0) return false;
  const rawRate = product ? product.commissionRate : seller.defaultCommissionRate;
  const rate = Number(rawRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return false;
  lead.commercialOwnerId = seller.id;
  lead.commercialProductId = product?.id || null;
  lead.commercialProductName = product?.name || normalizeCommercialName(lead?.commercialProductName || lead?.commercialProduct, 160);
  lead.commissionRateAtSale = Math.round(rate * 10) / 10;
  lead.commissionAmountAtSale = Math.round((saleValue * rate / 100) * 100) / 100;
  lead.commissionProductIdAtSale = product?.id || null;
  lead.commissionProductNameAtSale = product?.name || '';
  lead.commercialTeamIdAtSale = seller.teamId || '';
  lead.commissionSnapshotAt = at;
  if (!lead.commissionStatus) lead.commissionStatus = 'pending';
  return true;
}

const aiInFlight = new Set();
const aiRecentContent = new Map(); // v1.0.9: evita resposta dupla se a mesma mensagem chegar por dois caminhos de leitura

async function publishAiProcessingState(tab) {
  if (!tab?.id) return;
  const payload = { pending: Math.max(0, aiPendingInboundCount), sequence: ++aiProcessingStateSeq, at: Date.now() };
  try { await sendToTabEnsured(tab, 'whatsapp', { type: 'AI_PROCESSING_STATE', payload }); }
  catch { /* a fila de campanha também tem timeout de segurança para uma ponte indisponível */ }
}

function safeHttpsUrl(value) {
  try { const u = new URL(String(value || '').trim()); return u.protocol === 'https:' && !u.username && !u.password ? u.toString() : ''; }
  catch { return ''; }
}
function isLocalAiHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}
function safeAiEndpointUrl(value) {
  try {
    const u = new URL(String(value || '').trim());
    if (u.username || u.password) return '';
    if (u.protocol === 'https:') return u.toString();
    if (u.protocol === 'http:' && isLocalAiHost(u.hostname)) return u.toString();
    return '';
  } catch { return ''; }
}
function buildAiPermissionOrigin(urlStr) {
  try {
    const u = new URL(urlStr);
    return `${u.protocol}//${u.hostname}/*`;
  } catch { return ''; }
}
function resolveOpenAIChatCompletionsUrl(rawEndpoint) {
  const clean = safeAiEndpointUrl(rawEndpoint).replace(/\/+$/, '');
  if (!clean) return '';
  if (/\/chat\/completions$/i.test(clean)) return clean;
  if (/\/v1$/i.test(clean)) return `${clean}/chat/completions`;
  return `${clean}/v1/chat/completions`;
}
function resolveOpenAIModelsUrl(rawEndpoint) {
  const clean = safeAiEndpointUrl(rawEndpoint).replace(/\/+$/, '');
  if (!clean) return '';
  if (/\/models$/i.test(clean)) return clean;
  if (/\/chat\/completions$/i.test(clean)) return clean.replace(/\/chat\/completions$/i, '/models');
  if (/\/v1$/i.test(clean)) return `${clean}/models`;
  return `${clean}/v1/models`;
}

function normalizePhoneSafe(value) { return String(value || '').replace(/\D/g, '').slice(0, 15); }
function defaultTelemetryProfile() { return { industry: '', role: '', companySize: '', consent: false }; }
async function ensureTelemetryConsentMigration() {
  if (await getOne(TELEMETRY_CONSENT_MIGRATION_KEY, false)) return;
  const existing = await getOne(TELEMETRY_PROFILE_KEY, null);
  if (existing && existing.consent !== false) {
    existing.consent = false;
    existing.consentResetAt = new Date().toISOString();
    await setStore({ [TELEMETRY_PROFILE_KEY]: existing, [TELEMETRY_QUEUE_KEY]: [] });
  }
  await setStore({ [TELEMETRY_CONSENT_MIGRATION_KEY]: true });
}

function safeTelemetryMetadata(input = {}) {
  const allowed = ['count','added','updated','total','success','code','stageCategory','provider','durationMs','status','sent','failed','orders','opportunities','sales','source','value'];
  const out = {};
  for (const key of allowed) {
    if (!(key in (input || {}))) continue;
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = Math.max(0, Math.min(100000000, key === 'value' ? Math.round(value * 100) / 100 : Math.round(value)));
    else if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'string') out[key] = value.slice(0, 80).replace(/[\r\n\t]/g, ' ');
  }
  return out;
}
function stageCategory(value) {
  const s = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/fechad|ganh|vend|cliente|won|closed/.test(s)) return 'closed_won';
  if (/perdid|recus|lost/.test(s)) return 'closed_lost';
  if (/oportun|propost|negoci|qualific/.test(s)) return 'opportunity';
  if (/black|spam/.test(s)) return 'excluded';
  return s ? 'open' : 'unknown';
}
async function recordTelemetry(eventName, featureId = '', metadata = {}) {
  try {
    await ensureTelemetryConsentMigration();
    const profile = { ...defaultTelemetryProfile(), ...(await getOne(TELEMETRY_PROFILE_KEY, {})) };
    const counters = await getOne(TELEMETRY_COUNTERS_KEY, { total: 0, events: {}, lastActivityAt: null, lastSentAt: null, endpointAvailable: null });
    counters.total = (Number(counters.total) || 0) + 1;
    counters.events = counters.events || {};
    const eventMetadata = safeTelemetryMetadata(metadata);
    const weightedEvents = new Set(['whatsapp.conversations.scanned','crm.opportunity.opened']);
    const increment = weightedEvents.has(eventName) ? Math.max(1, Number(eventMetadata.count) || 1) : 1;
    counters.events[eventName] = (Number(counters.events[eventName]) || 0) + increment;
    counters.snapshots = counters.snapshots || {};
    if (eventName === 'whatsapp.awaiting_reply.snapshot') counters.snapshots.awaitingReplies = Math.max(0, Number(eventMetadata.count) || 0);
    counters.lastActivityAt = new Date().toISOString();
    await setStore({ [TELEMETRY_COUNTERS_KEY]: counters });
    if (profile.consent === false) return;
    const state = await getLicenseState();
    if (!state.licensed || !hasFeatureEntitlement(state.payload?.ent, 'telemetry.usage')) return;
    const queue = await getOne(TELEMETRY_QUEUE_KEY, []);
    queue.push({
      id: uid('evt'), event: String(eventName || 'extension.event').slice(0, 80),
      featureId: String(featureId || '').slice(0, 100), timestamp: new Date().toISOString(),
      extVersion: EXT_VERSION, plan: String(state.plan || 'unknown').slice(0, 40),
      profile: { industry: String(profile.industry || '').slice(0, 40), role: String(profile.role || '').slice(0, 40), companySize: String(profile.companySize || '').slice(0, 20) },
      metadata: eventMetadata,
    });
    const capped = queue.slice(-1500);
    await setStore({ [TELEMETRY_QUEUE_KEY]: capped });
    if (capped.length >= 25) flushTelemetry().catch(() => {});
  } catch { /* telemetria nunca pode bloquear o produto */ }
}
async function flushTelemetry() {
  await ensureTelemetryConsentMigration();
  const state = await getLicenseState();
  if (!state.licensed || !hasFeatureEntitlement(state.payload?.ent, 'telemetry.usage')) {
    return { success: false, code: 'TELEMETRY_NOT_LICENSED', error: 'A licença precisa incluir telemetria. Nenhum evento foi enviado.' };
  }
  const profile = { ...defaultTelemetryProfile(), ...(await getOne(TELEMETRY_PROFILE_KEY, {})) };
  if (profile.consent === false) return { success: false, code: 'TELEMETRY_DISABLED', error: 'O envio de telemetria está desativado nas preferências.' };
  const queue = await getOne(TELEMETRY_QUEUE_KEY, []);
  if (!queue.length) return { success: true, data: { sent: 0, remaining: 0 } };
  const batch = queue.slice(0, 100);
  const token = await getOne(K.TOKEN, '');
  const deviceId = await getDeviceId();
  let response;
  try {
    response = await fetch(`${BASE_URL}/telemetry/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Device-Id': deviceId },
      body: JSON.stringify({ schemaVersion: 1, extVersion: EXT_VERSION, deviceId, events: batch }), credentials: 'omit', cache: 'no-store', redirect: 'error',
    });
  } catch {
    const counters = await getOne(TELEMETRY_COUNTERS_KEY, {}); counters.endpointAvailable = false; await setStore({ [TELEMETRY_COUNTERS_KEY]: counters });
    return { success: false, code: 'TELEMETRY_NETWORK_ERROR', error: 'Sem conexão com o endpoint de telemetria. Os eventos continuam na fila local.' };
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const counters = await getOne(TELEMETRY_COUNTERS_KEY, {}); counters.endpointAvailable = response.status !== 404; await setStore({ [TELEMETRY_COUNTERS_KEY]: counters });
    return { success: false, code: response.status === 404 ? 'TELEMETRY_ENDPOINT_NOT_CONFIGURED' : 'TELEMETRY_REJECTED', error: response.status === 404 ? 'O backend ainda precisa implementar POST /api/v1/telemetry/events.' : `O endpoint de telemetria respondeu HTTP ${response.status}.` };
  }
  const sentIds = new Set(batch.map((event) => event.id));
  const current = await getOne(TELEMETRY_QUEUE_KEY, []);
  const remaining = current.filter((event) => !sentIds.has(event.id));
  const counters = await getOne(TELEMETRY_COUNTERS_KEY, {}); counters.endpointAvailable = true; counters.lastSentAt = new Date().toISOString();
  await setStore({ [TELEMETRY_QUEUE_KEY]: remaining, [TELEMETRY_COUNTERS_KEY]: counters });
  return { success: true, data: { sent: batch.length, remaining: remaining.length, server: data?.success !== false } };
}
function sanitizeAdminNotification(n) {
  if (!n || typeof n !== 'object') return null;
  const url = safeHttpsUrl(n.url || n.buttonUrl);
  return { id: String(n.id || '').slice(0, 100), title: String(n.title || 'Aviso do i9Leads Flow').slice(0, 140), text: String(n.text || n.message || '').slice(0, 700), buttonLabel: String(n.buttonLabel || '').slice(0, 60), url, startsAt: n.startsAt || n.startAt || '', endsAt: n.endsAt || n.endAt || '', targetIndustries: Array.isArray(n.targetIndustries) ? n.targetIndustries.slice(0, 30).map(String) : [], targetRoles: Array.isArray(n.targetRoles) ? n.targetRoles.slice(0, 20).map(String) : [], targetPlans: Array.isArray(n.targetPlans) ? n.targetPlans.slice(0, 20).map(String) : [], targetFeatures: Array.isArray(n.targetFeatures) ? n.targetFeatures.slice(0, 40).map(String) : [], excludeIndustries: Array.isArray(n.excludeIndustries) ? n.excludeIndustries.slice(0, 30).map(String) : [] };
}
function sanitizeFooterAd(ad) {
  if (!ad || typeof ad !== 'object' || ad.active === false) return null;
  return { id: String(ad.id || '').slice(0, 100), active: true, title: String(ad.title || 'Conheça mais recursos').slice(0, 140), text: String(ad.text || '').slice(0, 260), imageUrl: safeHttpsUrl(ad.imageUrl || ad.image), buttonLabel: String(ad.buttonLabel || 'Saiba mais').slice(0, 50), url: safeHttpsUrl(ad.url || ad.link), startsAt: ad.startsAt || '', endsAt: ad.endsAt || '', targetIndustries: Array.isArray(ad.targetIndustries) ? ad.targetIndustries.slice(0, 30).map(String) : [], targetRoles: Array.isArray(ad.targetRoles) ? ad.targetRoles.slice(0, 20).map(String) : [], targetPlans: Array.isArray(ad.targetPlans) ? ad.targetPlans.slice(0, 20).map(String) : [], targetFeatures: Array.isArray(ad.targetFeatures) ? ad.targetFeatures.slice(0, 40).map(String) : [] };
}
async function fetchAdminConfig() {
  await ensureTelemetryConsentMigration();
  const state = await getLicenseState();
  if (!state.licensed) return { success: false, code: 'LICENSE_REQUIRED', error: 'Ative uma licença para receber campanhas administrativas.' };
  const ent = state.payload?.ent;
  const canNotify = hasFeatureEntitlement(ent, 'notifications.in_app');
  const canAds = hasFeatureEntitlement(ent, 'ads.footer');
  if (!canNotify && !canAds) return { success: false, code: 'FEATURE_NOT_INCLUDED', error: 'Esta licença não inclui notificações administrativas nem anúncios de rodapé.' };
  const token = await getOne(K.TOKEN, '');
  const deviceId = await getDeviceId();
  const profile = { ...defaultTelemetryProfile(), ...(await getOne(TELEMETRY_PROFILE_KEY, {})) };
  const configQuery = new URLSearchParams({ extVersion: EXT_VERSION, industry: profile.consent === true ? (profile.industry || '') : '', plan: state.plan || '' });
  let response;
  try { response = await fetch(`${BASE_URL}/extension/config?${configQuery.toString()}`, { headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': deviceId }, credentials: 'omit', cache: 'no-store', redirect: 'error' }); }
  catch { return { success: false, code: 'ADMIN_CONFIG_NETWORK_ERROR', error: 'Não foi possível conectar ao painel para sincronizar notificações e anúncios.' }; }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return { success: false, code: response.status === 404 ? 'ADMIN_CONFIG_ENDPOINT_NOT_CONFIGURED' : 'ADMIN_CONFIG_ERROR', error: response.status === 404 ? 'O backend ainda precisa implementar GET /api/v1/extension/config.' : `O painel respondeu HTTP ${response.status}.` };
  const data = body?.data || body || {};
  const config = { syncedAt: new Date().toISOString(), notifications: canNotify ? (Array.isArray(data.notifications) ? data.notifications.map(sanitizeAdminNotification).filter(Boolean).slice(0, 20) : []) : [], footerAd: canAds ? sanitizeFooterAd(data.footerAd || data.footer_ad) : null };
  await setStore({ [ADMIN_CONFIG_KEY]: config });
  return { success: true, data: config };
}
function getAiConfigInternal() { return getOne(AI_CONFIG_KEY, {}); }
function publicAiConfig(c = {}) {
  const { apiKey, fallbackProviders, ...safe } = c;
  delete safe.conversationMemory;
  delete safe.conversationMemoryUpdatedAt;
  const safeFallbacks = (Array.isArray(fallbackProviders) ? fallbackProviders : []).map((item) => {
    const { apiKey: fallbackKey, ...profile } = item || {};
    return { ...profile, apiKeyConfigured: !!(fallbackKey && String(fallbackKey).trim()) };
  });
  return { ...safe, fallbackProviders: safeFallbacks, apiKeyConfigured: !!(apiKey && String(apiKey).trim()), sheetsVerified: c.sheetsVerified === true };
}
function sanitizeAiConfig(input = {}, existing = {}) {
  const ALLOWED_AI_PROVIDERS = ['openai','anthropic','gemini','openrouter','8token','9router','custom'];
  const provider = ALLOWED_AI_PROVIDERS.includes(input.provider) ? input.provider : (existing.provider || 'openai');
  const defaultCustomEndpoint = provider === '8token' ? 'https://8token.tech/v1' : (provider === '9router' ? 'http://localhost:20128/v1' : '');
  const endpoint = ['custom','8token','9router'].includes(provider) ? safeAiEndpointUrl(input.endpoint || existing.endpoint || defaultCustomEndpoint) : '';
  const modelDefaults = { openai: '', anthropic: '', gemini: '', openrouter: '' };
  const model = String(input.model || (provider === existing.provider ? existing.model : '') || modelDefaults[provider] || '').trim().replace(/^models\//, '').slice(0, 240);
  const apiKey = String(input.apiKey || (provider === existing.provider ? existing.apiKey : '') || '').trim().slice(0, 500);
  const providerChanged = provider !== existing.provider || model !== existing.model || endpoint !== (existing.endpoint || '') || apiKey !== (existing.apiKey || '');
  const incomingFallbacks = Array.isArray(input.fallbackProviders) ? input.fallbackProviders : (Array.isArray(existing.fallbackProviders) ? existing.fallbackProviders : []);
  const oldFallbacks = Array.isArray(existing.fallbackProviders) ? existing.fallbackProviders : [];
  const fallbackProviders = incomingFallbacks.slice(0, 4).map((item, index) => {
    const id = String(item?.id || `fallback_${index + 1}`).slice(0, 100);
    const old = oldFallbacks.find((x) => x?.id === id) || oldFallbacks[index] || {};
    const fallbackProvider = ALLOWED_AI_PROVIDERS.includes(item?.provider) ? item.provider : (old.provider || 'gemini');
    const defaultFbEndpoint = fallbackProvider === '8token' ? 'https://8token.tech/v1' : (fallbackProvider === '9router' ? 'http://localhost:20128/v1' : '');
    const fallbackEndpoint = ['custom','8token','9router'].includes(fallbackProvider) ? safeAiEndpointUrl(item?.endpoint || old.endpoint || defaultFbEndpoint) : '';
    const fallbackModel = String(item?.model || (fallbackProvider === old.provider ? old.model : '') || '').trim().replace(/^models\//, '').slice(0, 240);
    const fallbackKey = String(item?.apiKey || (fallbackProvider === old.provider ? old.apiKey : '') || '').trim().slice(0, 500);
    const changed = fallbackProvider !== old.provider || fallbackModel !== old.model || fallbackEndpoint !== (old.endpoint || '') || fallbackKey !== (old.apiKey || '');
    return { id, provider: fallbackProvider, model: fallbackModel, endpoint: fallbackEndpoint, apiKey: fallbackKey, verified: changed ? false : old.verified === true, lastError: changed ? '' : String(old.lastError || '').slice(0, 180), cooldownUntil: changed ? 0 : Math.max(0, Number(old.cooldownUntil) || 0) };
  }).filter((item) => item.model && item.apiKey);
  const sheetId = String(input.sheetId ?? existing.sheetId ?? '').trim().slice(0, 220);
  const sheetChanged = sheetId !== (existing.sheetId || '');
  const sheetTab = String(input.sheetTab ?? existing.sheetTab ?? 'Pedidos').trim().slice(0, 100) || 'Pedidos';
  const sheetTabChanged = sheetTab !== (existing.sheetTab || 'Pedidos');
  const chatMode = ['private_only','groups_only','both'].includes(input.chatMode) ? input.chatMode : (existing.chatMode || 'private_only');
  const groupReplyMode = ['all_messages','reply_or_mention','mention_only','reply_only','keywords'].includes(input.groupReplyMode) ? input.groupReplyMode : (existing.groupReplyMode || 'reply_or_mention');
  const groupScope = ['all','selected','except_selected'].includes(input.groupScope) ? input.groupScope : (existing.groupScope || 'selected');
  const selectedGroupIds = [...new Set((Array.isArray(input.selectedGroupIds) ? input.selectedGroupIds : (Array.isArray(existing.selectedGroupIds) ? existing.selectedGroupIds : [])).map((id) => String(id || '').trim()).filter((id) => /@g\.us$/i.test(id)).slice(0, 500))];
  const groupReplyKeywords = String(input.groupReplyKeywords ?? existing.groupReplyKeywords ?? '').split(/[\n,;]+/).map((word) => word.trim().slice(0, 100)).filter(Boolean).slice(0, 100).join('\n').slice(0, 4000);
  const qualificationThresholdRaw = Number(input.qualificationThreshold ?? existing.qualificationThreshold ?? 0.8);
  const replyDelayRaw = Number(input.replyDelaySeconds ?? existing.replyDelaySeconds ?? 1.5);
  const rawPersonas = Array.isArray(input.aiPersonas) ? input.aiPersonas : (Array.isArray(existing.aiPersonas) ? existing.aiPersonas : []);
  const personaIds = new Set();
  const aiPersonas = rawPersonas.slice(0, 20).map((item, index) => {
    const rawId = String(item?.id || `persona_${index + 1}`).trim().slice(0, 100);
    const id = /^[A-Za-z0-9_-]+$/.test(rawId) ? rawId : `persona_${index + 1}`;
    if (personaIds.has(id)) return null;
    personaIds.add(id);
    const threshold = Number(item?.qualificationThreshold ?? 0.8);
    const mode = ['networking', 'self_knowledge', 'commercial'].includes(item?.mode) ? item.mode : 'commercial';
    const oldPersona = (Array.isArray(existing.aiPersonas) ? existing.aiPersonas : []).find((persona) => persona?.id === id) || {};
    const operationMode = mode === 'self_knowledge' ? AI_OPERATION_MODES.AUTO_REPLY : normalizeAiOperationMode(item?.operationMode ?? oldPersona.operationMode ?? existing.operationMode);
    return {
      id, mode, operationMode,
      name: String(item?.name || `Perfil ${index + 1}`).trim().slice(0, 80) || `Perfil ${index + 1}`,
      description: String(item?.description || '').trim().slice(0, 220),
      businessName: String(item?.businessName ?? existing.businessName ?? input.businessName ?? 'Minha empresa').trim().slice(0, 180),
      prompt: String(item?.prompt ?? existing.prompt ?? input.prompt ?? '').trim().slice(0, 10000),
      knowledge: String(item?.knowledge ?? existing.knowledge ?? input.knowledge ?? '').trim().slice(0, 20000),
      welcomeMessage: String(item?.welcomeMessage ?? existing.welcomeMessage ?? input.welcomeMessage ?? '').trim().slice(0, 500),
      qualificationEnabled: item?.qualificationEnabled === undefined ? true : item.qualificationEnabled === true,
      qualifiedStage: String(item?.qualifiedStage || 'qualificado').trim().slice(0, 100) || 'qualificado',
      qualificationThreshold: Number.isFinite(threshold) ? Math.max(0.5, Math.min(0.99, threshold)) : 0.8,
      qualificationCriteria: String(item?.qualificationCriteria || '').trim().slice(0, 4000),
      updatedAt: String(item?.updatedAt || new Date().toISOString()).slice(0, 40),
    };
  }).filter(Boolean);
  const requestedPersonaId = String(input.activePersonaId ?? existing.activePersonaId ?? '').trim();
  const activePersonaId = aiPersonas.some((persona) => persona.id === requestedPersonaId) ? requestedPersonaId : (aiPersonas[0]?.id || '');
  const validPersonaIds = new Set(aiPersonas.map((persona) => persona.id));
  const rawGroupAssignments = input.groupPersonaAssignments && typeof input.groupPersonaAssignments === 'object' && !Array.isArray(input.groupPersonaAssignments)
    ? input.groupPersonaAssignments : (existing.groupPersonaAssignments && typeof existing.groupPersonaAssignments === 'object' ? existing.groupPersonaAssignments : {});
  const groupPersonaAssignments = {};
  for (const [rawGroupId, rawPersonaId] of Object.entries(rawGroupAssignments).slice(0, 500)) {
    const groupId = String(rawGroupId || '').trim().slice(0, 120);
    const personaId = String(rawPersonaId || '').trim();
    if (/@g\.us$/i.test(groupId) && validPersonaIds.has(personaId)) groupPersonaAssignments[groupId] = personaId;
  }
  const rawConversationAssignments = input.conversationPersonaAssignments && typeof input.conversationPersonaAssignments === 'object' && !Array.isArray(input.conversationPersonaAssignments)
    ? input.conversationPersonaAssignments : (existing.conversationPersonaAssignments && typeof existing.conversationPersonaAssignments === 'object' ? existing.conversationPersonaAssignments : {});
  const conversationPersonaAssignments = {};
  const nowMs = Date.now();
  for (const [rawKey, rawAssignment] of Object.entries(rawConversationAssignments).slice(-5000)) {
    const keyText = String(rawKey || '').trim();
    const normalizedPhone = normWaPhone(keyText);
    // Novos registros usam hash do telefone para não replicar números em texto aberto no backup do Drive.
    const assignmentKey = /^chat_[0-9a-f]{1,16}$/i.test(keyText) ? keyText : (normalizedPhone.length >= 8 ? aiChatHash(normalizedPhone) : '');
    const assignment = rawAssignment && typeof rawAssignment === 'object' ? rawAssignment : { personaId: rawAssignment };
    const personaId = String(assignment.personaId || '').trim();
    const assignedAt = Number(assignment.assignedAt) || nowMs;
    const expiresAt = Number(assignment.expiresAt) || (assignedAt + 30 * 24 * 60 * 60 * 1000);
    if (assignmentKey && validPersonaIds.has(personaId) && expiresAt > nowMs) {
      conversationPersonaAssignments[assignmentKey] = {
        personaId,
        campaignId: String(assignment.campaignId || '').slice(0, 100),
        assignedAt,
        expiresAt,
      };
    }
  }
  return {
    provider, model, endpoint, apiKey, fallbackProviders,
    providerVerified: providerChanged ? false : existing.providerVerified === true,
    providerLastError: providerChanged ? '' : String(existing.providerLastError || '').slice(0, 180),
    providerCooldownUntil: providerChanged ? 0 : Math.max(0, Number(existing.providerCooldownUntil) || 0),
    chatMode, groupReplyMode, groupScope, selectedGroupIds, groupReplyKeywords,
    replyDelaySeconds: Number.isFinite(replyDelayRaw) ? Math.max(0, Math.min(10, replyDelayRaw)) : 1.5,
    qualificationEnabled: input.qualificationEnabled === undefined ? existing.qualificationEnabled !== false : input.qualificationEnabled === true,
    qualifiedStage: String(input.qualifiedStage ?? existing.qualifiedStage ?? 'qualificado').trim().slice(0, 100) || 'qualificado',
    qualificationThreshold: Number.isFinite(qualificationThresholdRaw) ? Math.max(0.5, Math.min(0.99, qualificationThresholdRaw)) : 0.8,
    qualificationCriteria: String(input.qualificationCriteria ?? existing.qualificationCriteria ?? 'Necessidade clara, interesse real, orçamento, prazo e intenção de avançar.').trim().slice(0, 4000),
    aiPersonas, activePersonaId, groupPersonaAssignments, conversationPersonaAssignments,
    personaMode: ['networking', 'self_knowledge', 'commercial'].includes(input.personaMode) ? input.personaMode : (['networking', 'self_knowledge', 'commercial'].includes(existing.personaMode) ? existing.personaMode : 'commercial'),
    operationMode: normalizeAiOperationMode(input.operationMode ?? existing.operationMode),
    businessName: String(input.businessName ?? existing.businessName ?? '').trim().slice(0, 180),
    prompt: String(input.prompt ?? existing.prompt ?? '').trim().slice(0, 10000),
    knowledge: String(input.knowledge ?? existing.knowledge ?? '').trim().slice(0, 20000),
    welcomeMessage: String(input.welcomeMessage ?? existing.welcomeMessage ?? '').trim().slice(0, 500),
    sheetId, sheetTab,
    historySheetId: String(input.historySheetId ?? existing.historySheetId ?? '').trim().slice(0, 220),
    historySheetUrl: String(input.historySheetUrl ?? existing.historySheetUrl ?? '').trim().slice(0, 500),
    historyEnabled: input.historyEnabled === undefined ? existing.historyEnabled === true : input.historyEnabled === true,
    historyLastSyncAt: input.historyLastSyncAt ?? existing.historyLastSyncAt ?? null,
    historyLastError: String(input.historyLastError ?? existing.historyLastError ?? '').slice(0, 240),
    historyUpdatedAt: String(input.historyUpdatedAt ?? existing.historyUpdatedAt ?? '').slice(0, 40),
    sellerPhone: normalizePhoneSafe(input.sellerPhone ?? existing.sellerPhone),
    orderInstructions: String(input.orderInstructions ?? existing.orderInstructions ?? '').trim().slice(0, 4000),
    sheetsVerified: (sheetChanged || sheetTabChanged) ? false : existing.sheetsVerified === true,
    conversationMemory: mergeAiConversationMemoryMaps(
      existing.conversationMemory || {},
      input.conversationMemory && typeof input.conversationMemory === 'object' ? input.conversationMemory : {},
    ),
    conversationMemoryUpdatedAt: [existing.conversationMemoryUpdatedAt, input.conversationMemoryUpdatedAt]
      .filter(Boolean).sort((a, b) => (Date.parse(a) || 0) - (Date.parse(b) || 0)).at(-1) || '',
    updatedAt: new Date().toISOString(),
  };
}
function applyActiveAiPersona(config = {}) {
  const personas = Array.isArray(config.aiPersonas) ? config.aiPersonas : [];
  const active = personas.find((persona) => persona?.id === config.activePersonaId);
  if (!active) return config;
  return {
    ...config,
    activePersonaName: String(active.name || ''),
    personaMode: ['networking', 'self_knowledge', 'commercial'].includes(active.mode) ? active.mode : 'commercial',
    operationMode: normalizeAiOperationMode(active.operationMode ?? config.operationMode),
    businessName: String(active.businessName || config.businessName || ''),
    prompt: String(active.prompt || config.prompt || ''),
    knowledge: String(active.knowledge || config.knowledge || ''),
    welcomeMessage: String(active.welcomeMessage ?? config.welcomeMessage ?? ''),
    qualificationEnabled: active.qualificationEnabled === undefined ? config.qualificationEnabled !== false : active.qualificationEnabled === true,
    qualifiedStage: String(active.qualifiedStage || config.qualifiedStage || 'qualificado'),
    qualificationThreshold: Number.isFinite(Number(active.qualificationThreshold)) ? Math.max(0.5, Math.min(0.99, Number(active.qualificationThreshold))) : Number(config.qualificationThreshold ?? 0.8),
    qualificationCriteria: String(active.qualificationCriteria || config.qualificationCriteria || ''),
  };
}

function aiConfigHasObserver(config = {}) {
  return normalizeAiOperationMode(config.operationMode) === AI_OPERATION_MODES.OBSERVE_ONLY
    || (Array.isArray(config.aiPersonas) ? config.aiPersonas : []).some((persona) => normalizeAiOperationMode(persona?.operationMode) === AI_OPERATION_MODES.OBSERVE_ONLY);
}

// v1.2.0 — resolve a personalidade pelo contexto antes de processar a mensagem.
// Precedência: grupo configurado > campanha que alcançou o contato > perfil global.
function applyAiPersonaForContext(config = {}, payload = {}) {
  const personas = Array.isArray(config.aiPersonas) ? config.aiPersonas : [];
  const validIds = new Set(personas.map((persona) => persona?.id).filter(Boolean));
  const isGroup = payload.chatType === 'group' || payload.isGroup === true;
  let requestedPersonaId = '';
  if (isGroup) {
    const groupId = String(payload.chatId || payload.chatRef || '').trim();
    requestedPersonaId = String(config.groupPersonaAssignments?.[groupId] || '').trim();
  } else {
    const phone = normWaPhone(payload.phone || payload.senderPhone || '');
    const assignment = phone ? config.conversationPersonaAssignments?.[aiChatHash(phone)] : null;
    const expiresAt = Number(assignment?.expiresAt) || 0;
    if (assignment && expiresAt > Date.now()) requestedPersonaId = String(assignment.personaId || '').trim();
  }
  const personaId = validIds.has(requestedPersonaId) ? requestedPersonaId : String(config.activePersonaId || '');
  return applyActiveAiPersona(personaId && personaId !== config.activePersonaId ? { ...config, activePersonaId: personaId } : config);
}

/** Registra somente metadados locais do processamento, sem conteúdo da mensagem nem telefone. */
async function recordAiMonitorEvent(payload = {}, outcome = {}, durationMs = null) {
  try {
    const storedConfig = await getAiConfigInternal();
    const config = applyAiPersonaForContext(storedConfig, payload);
    const personaId = String(outcome.personaId || config.activePersonaId || 'global');
    const persona = (Array.isArray(config.aiPersonas) ? config.aiPersonas : []).find((item) => item?.id === personaId);
    const personaName = String(outcome.personaName || (personaId === config.activePersonaId ? config.activePersonaName : '') || persona?.name || 'Perfil global').slice(0, 100);
    const requestedMode = outcome.personaMode || config.personaMode;
    const mode = ['networking', 'self_knowledge', 'commercial'].includes(requestedMode) ? requestedMode : 'commercial';
    const status = String(outcome.status || 'ignored');
    const qualificationStatus = mode === 'commercial'
      ? String(outcome.qualificationStatus || '')
      : mode === 'networking' && outcome.niche ? 'profile_identified' : '';
    const event = normalizeAiMonitorEvent({
      id: uid('ai-event'), eventKey: aiChatHash(String(payload.messageId || `${payload.chatName || ''}|${payload.receivedAt || ''}`)),
      at: new Date().toISOString(), status, personaId, personaName, personaMode: mode, operationMode: outcome.operationMode || config.operationMode || 'auto_reply',
      chatType: payload.chatType === 'group' || payload.isGroup === true ? 'group' : 'private',
      chatName: String(payload.chatName || (payload.chatType === 'group' ? 'Grupo' : 'Conversa privada')).slice(0, 100),
      provider: outcome.provider || config.provider, model: outcome.model || config.model, durationMs,
      qualificationStatus, confidence: outcome.confidence,
      qualified: mode === 'commercial' && outcome.qualified === true,
      niche: mode === 'self_knowledge' ? '' : String(outcome.niche || '').slice(0, 100),
      error: outcome.error || '',
    });
    const existing = await getOne(AI_MONITOR_EVENTS_KEY, []);
    const events = Array.isArray(existing) ? existing : [];
    if (event.eventKey && events.some((item) => item?.eventKey === event.eventKey)) return { success: true, duplicate: true };
    await setStore({ [AI_MONITOR_EVENTS_KEY]: [event, ...events].slice(0, AI_MONITOR_EVENT_LIMIT) });
    return { success: true };
  } catch (error) {
    // Falha de monitoramento nunca pode impedir uma resposta da IA.
    try { saveSystemLog({ module: 'ai-monitor', action: 'AI_MONITOR_EVENT_WRITE_FAILED', status: 'warning', message: safeLogText(error?.message || String(error), 180) }); } catch { /* sem efeito colateral */ }
    return { success: false };
  }
}

function aiEndpoint(config) {
  if (config.provider === 'openai') return { url: 'https://api.openai.com/v1/chat/completions', origin: 'https://api.openai.com', permissionOrigin: 'https://api.openai.com/*', kind: 'openai' };
  if (config.provider === 'anthropic') return { url: 'https://api.anthropic.com/v1/messages', origin: 'https://api.anthropic.com', permissionOrigin: 'https://api.anthropic.com/*', kind: 'anthropic' };
  if (config.provider === 'gemini') {
    if (!config.model) throw new Error('Carregue os modelos disponíveis e selecione um modelo do Google Gemini.');
    return { url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model.replace(/^models\//, ''))}:generateContent`, origin: 'https://generativelanguage.googleapis.com', permissionOrigin: 'https://generativelanguage.googleapis.com/*', kind: 'gemini' };
  }
  if (config.provider === 'openrouter') return { url: 'https://openrouter.ai/api/v1/chat/completions', origin: 'https://openrouter.ai', permissionOrigin: 'https://openrouter.ai/*', kind: 'openai' };
  if (['custom', '8token', '9router'].includes(config.provider)) {
    const rawEndpoint = config.endpoint || (config.provider === '8token' ? 'https://8token.tech/v1' : config.provider === '9router' ? 'http://localhost:20128/v1' : '');
    const url = resolveOpenAIChatCompletionsUrl(rawEndpoint);
    if (!url) throw new Error('O endpoint personalizado precisa ser HTTPS (ou HTTP em localhost/rede local) e não pode conter credenciais na URL.');
    const parsed = new URL(url);
    return { url, origin: parsed.origin, permissionOrigin: buildAiPermissionOrigin(url), kind: 'openai' };
  }
  throw new Error('Provedor de IA não reconhecido.');
}

/** Consulta o catálogo real do provedor sem persistir nem registrar a chave recebida. */
async function listAiProviderModels(input = {}) {
  const provider = ['openai', 'anthropic', 'gemini', 'openrouter', '8token', '9router', 'custom'].includes(input.provider) ? input.provider : '';
  if (!provider) throw new Error('Provedor de IA não reconhecido para listagem de modelos.');
  const existing = await getAiConfigInternal();
  const fallbackId = String(input.fallbackId || '');
  const savedFallback = fallbackId && Array.isArray(existing.fallbackProviders) ? existing.fallbackProviders.find((item) => item?.id === fallbackId && item.provider === provider) : null;
  const apiKey = String(input.apiKey || (fallbackId ? savedFallback?.apiKey : provider === existing.provider ? existing.apiKey : '') || '').trim().slice(0, 500);
  if (!apiKey) throw new Error('Cole a chave API do provedor antes de carregar os modelos.');

  const origins = {
    openai: 'https://api.openai.com',
    anthropic: 'https://api.anthropic.com',
    gemini: 'https://generativelanguage.googleapis.com',
    openrouter: 'https://openrouter.ai',
  };

  let origin = origins[provider] || '';
  let permissionOrigin = origin ? `${origin}/*` : '';
  let customModelsUrl = '';

  if (['custom', '8token', '9router'].includes(provider)) {
    const rawEndpoint = input.endpoint || (fallbackId ? savedFallback?.endpoint : existing.endpoint) || (provider === '8token' ? 'https://8token.tech/v1' : provider === '9router' ? 'http://localhost:20128/v1' : '');
    customModelsUrl = resolveOpenAIModelsUrl(rawEndpoint);
    if (!customModelsUrl) throw new Error('Informe um endpoint válido (ex.: https://8token.tech/v1 ou http://localhost:20128/v1) antes de carregar os modelos.');
    origin = new URL(customModelsUrl).origin;
    permissionOrigin = buildAiPermissionOrigin(customModelsUrl);
  }

  if (!await chrome.permissions.contains({ origins: [permissionOrigin] })) {
    throw new Error('O acesso ao provedor ainda não foi autorizado. Clique novamente em “Carregar modelos disponíveis” e aceite a permissão do Chrome.');
  }

  const headers = { Accept: 'application/json' };
  let url = '';
  if (provider === 'gemini') {
    url = `${origin}/v1beta/models?pageSize=1000`;
    headers['x-goog-api-key'] = apiKey;
  } else if (provider === 'openai') {
    url = `${origin}/v1/models`;
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (provider === 'anthropic') {
    url = `${origin}/v1/models?limit=100`;
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (['custom', '8token', '9router'].includes(provider)) {
    url = customModelsUrl;
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    url = `${origin}/api/v1/models/user`;
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    let response = await fetch(url, { method: 'GET', headers, signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error' });
    if (provider === 'openrouter' && [404, 405].includes(response.status)) {
      response = await fetch(`${origin}/api/v1/models`, { method: 'GET', headers, signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error' });
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const raw = payload?.error?.message || payload?.error?.message?.detail || payload?.message || (typeof payload?.error === 'string' ? payload.error : '') || `HTTP ${response.status}`;
      const safe = String(raw).split(apiKey).join('[chave ocultada]').replace(/(?:Bearer\s+)[A-Za-z0-9._~-]+/ig, 'Bearer [oculto]').slice(0, 240);
      throw new Error(`Não foi possível carregar os modelos (${response.status}): ${safe}`);
    }
    const models = normalizeAiModelList(provider, payload);
    if (!models.length) throw new Error('O provedor não retornou modelos compatíveis com geração de respostas para esta chave. Verifique o acesso à API ou informe o nome do modelo manualmente.');
    return { provider, models, count: models.length, truncated: models.length >= 400, sourceNote: provider === 'openrouter' ? 'O catálogo do OpenRouter pode incluir modelos cuja disponibilidade também depende de créditos, roteamento e permissões da conta.' : '' };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('O provedor demorou demais para responder. Tente carregar os modelos novamente.');
    const safeMessage = String(error?.message || error).split(apiKey).join('[chave ocultada]');
    throw new Error(safeMessage.slice(0, 300));
  } finally {
    clearTimeout(timeout);
  }
}
async function callAiProvider(config, messages, systemPrompt = '') {
  if (!config?.apiKey) throw new Error('Cadastre sua chave de API antes de testar o atendimento.');
  if (!config?.model) throw new Error('Informe o modelo de IA.');
  const ep = aiEndpoint(config);
  const permOrigin = ep.permissionOrigin || `${ep.origin}/*`;
  if (!await chrome.permissions.contains({ origins: [permOrigin] })) throw new Error('O acesso ao domínio do provedor ainda não foi autorizado. Abra Atendimento com IA e clique em Testar conexão.');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 35000);
  try {
    let headers = { 'Content-Type': 'application/json' }; let body;
    if (ep.kind === 'anthropic') {
      headers = { ...headers, 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' };
      body = { model: config.model, max_tokens: 800, system: systemPrompt, messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 6000) })) };
    } else if (ep.kind === 'gemini') {
      headers = { ...headers, 'x-goog-api-key': config.apiKey };
      body = { systemInstruction: { parts: [{ text: systemPrompt.slice(0, 20000) }] }, contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '').slice(0, 6000) }] })), generationConfig: { temperature: 0.3, maxOutputTokens: 1000, responseMimeType: 'application/json' } };
    } else {
      headers.Authorization = `Bearer ${config.apiKey}`;
      body = { model: config.model, messages: [{ role: 'system', content: systemPrompt }, ...messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 6000) }))], temperature: 0.3, max_tokens: 1000 };
    }
    const response = await fetch(ep.url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const raw = data?.error?.message || data?.message || data?.error || `HTTP ${response.status}`;
      throw new Error(`O provedor de IA recusou a solicitação (${response.status}): ${String(raw).slice(0, 220)}`);
    }
    let text = '';
    if (ep.kind === 'anthropic') text = (data.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('\n');
    else if (ep.kind === 'gemini') text = (data.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('\n');
    else text = data.choices?.[0]?.message?.content || '';
    if (!text.trim()) throw new Error('O provedor respondeu sem conteúdo. Confira o modelo e os limites da sua conta.');
    return text.trim().slice(0, 6000);
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A API de IA demorou mais de 35 segundos para responder.');
    throw error;
  } finally { clearTimeout(timeout); }
}
function getAiProviderProfiles(config = {}) {
  const primary = { id: 'primary', provider: config.provider, model: config.model, endpoint: config.endpoint, apiKey: config.apiKey, verified: config.providerVerified === true, cooldownUntil: Number(config.providerCooldownUntil) || 0 };
  return [primary, ...(Array.isArray(config.fallbackProviders) ? config.fallbackProviders : [])]
    .filter((p) => p && p.provider && p.model && p.apiKey)
    .slice(0, 5);
}
function aiProviderCooldownMs(errorText) {
  const text = String(errorText || '').toLowerCase();
  if (/per minute|requests per minute|tokens? per minute|\brpm\b|\btpm\b|rate.?limit|too many requests/i.test(text)) return 15 * 60 * 1000;
  if (/daily|per day|quota|resource[_ ]exhausted|insufficient_quota|billing|credits? exhausted|tokens?.{0,20}(exhaust|limit|exceed)/i.test(text)) return 24 * 60 * 60 * 1000;
  if (/\b429\b/i.test(text)) return 15 * 60 * 1000;
  if (/\b(502|503|504)\b|temporarily unavailable|timed? out|network error/i.test(text)) return 5 * 60 * 1000;
  if (/\b(401|403)\b|invalid api key|unauthorized|authentication/i.test(text)) return 60 * 60 * 1000;
  return 2 * 60 * 1000;
}
async function updateAiProviderHealth(config, profile, errorText = '') {
  const now = Date.now();
  if (profile.id === 'primary') {
    config.providerLastError = String(errorText || '').slice(0, 180);
    config.providerCooldownUntil = errorText ? now + aiProviderCooldownMs(errorText) : 0;
  } else {
    const item = (Array.isArray(config.fallbackProviders) ? config.fallbackProviders : []).find((x) => x.id === profile.id);
    if (item) {
      item.lastError = String(errorText || '').slice(0, 180);
      item.cooldownUntil = errorText ? now + aiProviderCooldownMs(errorText) : 0;
      item.verified = !errorText;
    }
  }
  await setStore({ [AI_CONFIG_KEY]: config });
}
async function callAiProviderWithFallback(config, messages, systemPrompt = '') {
  const allProfiles = getAiProviderProfiles(config);
  if (!allProfiles.length) throw new Error('Cadastre ao menos uma chave e um modelo de IA.');
  const now = Date.now();
  const profiles = allProfiles.filter((profile) => Number(profile.cooldownUntil || 0) <= now);
  if (!profiles.length) {
    const nextAt = Math.min(...allProfiles.map((profile) => Number(profile.cooldownUntil) || now));
    throw new Error(`Todos os provedores estão em espera temporária por limite de uso. Tente novamente após ${new Date(nextAt).toLocaleString('pt-BR')}.`);
  }
  const errors = [];
  for (let index = 0; index < profiles.length; index++) {
    const profile = profiles[index];
    try {
      const answer = await callAiProvider({ ...config, ...profile }, messages, systemPrompt);
      await updateAiProviderHealth(config, profile, '');
      return { text: answer, provider: profile.provider, model: profile.model, fallbackUsed: profile.id !== 'primary', providerIndex: index };
    } catch (error) {
      const rawError = String(error?.message || error);
      const safeError = profile.apiKey ? rawError.split(profile.apiKey).join('[chave ocultada]') : rawError;
      errors.push(`${profile.provider}/${profile.model}: ${safeError.slice(0, 150)}`);
      await updateAiProviderHealth(config, profile, safeError);
    }
  }
  throw new Error(`Nenhum provedor de IA conseguiu responder. ${errors.join(' | ').slice(0, 600)}`);
}

async function getGoogleToken(interactive = false) {
  if (!chrome.identity?.getAuthToken) throw new Error('A API de identidade do Chrome não está disponível.');
  try { const result = await chrome.identity.getAuthToken({ interactive, scopes: ['https://www.googleapis.com/auth/spreadsheets'] }); const token = typeof result === 'string' ? result : result?.token; if (!token) throw new Error('O Google não forneceu um token de acesso.'); return token; }
  catch (error) { throw new Error(`Não foi possível autorizar o Google Sheets: ${String(error?.message || error).slice(0, 180)}`); }
}
async function googleSheetsFetch(url, options = {}, interactive = false) {
  if (!await chrome.permissions.contains({ origins: ['https://sheets.googleapis.com/*'] })) throw new Error('A permissão de acesso ao Google Sheets não está disponível nesta instalação. Clique em “Criar / conectar histórico” e autorize o acesso.');
  const token = await getGoogleToken(interactive);
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }, credentials: 'omit', cache: 'no-store', redirect: 'error' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Google Sheets respondeu HTTP ${response.status}: ${String(data?.error?.message || data?.error || 'verifique a conta Google e as permissões').slice(0, 180)}`);
  return data;
}
async function sheetsFetch(config, path, options = {}, interactive = false) {
  if (!config.sheetId) throw new Error('Informe o ID da planilha Google Sheets.');
  return googleSheetsFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.sheetId)}${path}`, options, interactive);
}
async function historySheetsFetch(sheetId, path, options = {}, interactive = false) {
  if (!sheetId) throw new Error('A planilha de histórico ainda não foi conectada.');
  return googleSheetsFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}${path}`, options, interactive);
}
const AI_HISTORY_HEADERS = ['ID do evento','Data e hora','ID da conversa','Conversa','Tipo','Remetente','Direção','Mensagem','Status','Provedor','Modelo','Detalhes'];
const AI_LEADS_HEADERS = [
  'ID do lead','ID da conversa','Última atualização','Nome','Telefone','Empresa','Pedido exato','Resumo comercial',
  'Necessidade','Serviço de interesse','Segmento','Intenção de contratação','Orçamento de mídia','Situação do orçamento',
  'Prazo','Poder de decisão','Objeção','Status da qualificação','Confiança','Motivo da classificação','Evidências',
  'Informações pendentes','Próxima ação','Estágio CRM','Tipo de conversa','Provedor IA','Modelo IA','Nicho principal','Caminho de nicho','Etiquetas IA'
];
function historyEventRow(event) {
  return [event.eventId || '', event.at || new Date().toISOString(), event.conversationKey || '', event.chatName || '', event.chatType || '', event.senderName || '', event.direction || '', event.message || '', event.status || '', event.provider || '', event.model || '', event.details || ''].map((value) => String(value ?? '').slice(0, 6000));
}
function aiLeadSheetRow(lead) {
  const intel = lead?.aiIntelligence && typeof lead.aiIntelligence === 'object' ? lead.aiIntelligence : {};
  const qualification = lead?.aiQualification && typeof lead.aiQualification === 'object' ? lead.aiQualification : {};
  const join = (value, max = 3000) => (Array.isArray(value) ? value.join(' | ') : String(value || '')).slice(0, max);
  return [
    leadId(lead), intel.conversationKey || '', intel.updatedAt || intel.evaluatedAt || qualification.evaluatedAt || new Date().toISOString(),
    lead.name || '', lead.phone || '', intel.company || lead.company || '', intel.exactRequest || '', intel.summary || qualification.summary || '',
    intel.need || qualification.need || '', intel.service || '', intel.segment || '', intel.intent || '', intel.budget || qualification.budget || '',
    intel.budgetStatus || '', intel.timeframe || qualification.timeframe || '', intel.decisionMaker || '', intel.objection || '',
    intel.status || qualification.status || (qualification.qualified ? 'qualified' : 'in_qualification'),
    Number.isFinite(Number(intel.confidence ?? qualification.confidence)) ? Number(intel.confidence ?? qualification.confidence) : 0,
    intel.reason || qualification.reason || '', join(intel.evidence, 2500), join(intel.missingFields, 1200),
    intel.nextStep || qualification.nextStep || '', lead.stage || 'novo', intel.chatType || '', intel.provider || '', intel.model || '',
    lead.aiNicheClassification?.primaryNiche || lead.aiNicheClassification?.path?.[0] || '',
    Array.isArray(lead.aiNicheClassifications) && lead.aiNicheClassifications.length ? lead.aiNicheClassifications.map((item) => (item.path || []).join(' > ')).filter(Boolean).join(' | ') : (Array.isArray(lead.aiNicheClassification?.path) ? lead.aiNicheClassification.path.join(' > ') : ''),
    Array.isArray(lead.aiTags) ? lead.aiTags.join(' | ') : ''
  ].map((value) => String(value ?? '').slice(0, 6000));
}
async function ensureAiLeadSheet(sheetId, interactive = false) {
  if (!sheetId) throw new Error('A planilha de histórico ainda não foi conectada.');
  const headerVersion = `${sheetId}:v1.1.0`;
  if (await getOne(AI_LEAD_SHEET_READY_KEY, '') === headerVersion) return;
  const meta = await historySheetsFetch(sheetId, '?fields=spreadsheetId,sheets.properties.title', { method: 'GET' }, interactive);
  const tabs = (meta?.sheets || []).map((item) => item.properties?.title).filter(Boolean);
  if (!tabs.includes('Leads')) {
    await googleSheetsFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}:batchUpdate`, {
      method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Leads', gridProperties: { frozenRowCount: 1 } } } }] })
    }, interactive);
  }
  const headerRange = encodeURIComponent("'Leads'!A1:AD1");
  await historySheetsFetch(sheetId, `/values/${headerRange}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [AI_LEADS_HEADERS] }) }, false);
  await setStore({ [AI_LEAD_SHEET_READY_KEY]: headerVersion });
  // Migração do cabeçalho: re-enfileira fichas existentes para preencher as novas colunas de nicho.
  await queueAllAiLeadsForSheetSync().catch(() => 0);
}
async function upsertAiLeadSheet(lead, config) {
  if (!config?.historySheetId) throw new Error('Conecte a planilha do Google Sheets para sincronizar a inteligência comercial.');
  if (!await chrome.permissions.contains({ origins: ['https://sheets.googleapis.com/*'] })) throw new Error('Autorize o acesso ao Google Sheets para sincronizar os dados comerciais.');
  await ensureAiLeadSheet(config.historySheetId, false);
  const id = String(leadId(lead) || '').trim();
  if (!id || (!lead?.aiIntelligence && !lead?.aiQualification)) return { skipped: true };
  const idRange = encodeURIComponent("'Leads'!A:A");
  const data = await historySheetsFetch(config.historySheetId, `/values/${idRange}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`, { method: 'GET' }, false);
  const rows = Array.isArray(data.values) ? data.values : [];
  const index = rows.findIndex((row, i) => i > 0 && String(row?.[0] || '') === id);
  const values = [aiLeadSheetRow(lead)];
  if (index >= 0) {
    const rowNumber = index + 1;
    const range = encodeURIComponent(`'Leads'!A${rowNumber}:AD${rowNumber}`);
    await historySheetsFetch(config.historySheetId, `/values/${range}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values }) }, false);
    return { updated: true, row: rowNumber };
  }
  const appendRange = encodeURIComponent("'Leads'!A:AD");
  const result = await historySheetsFetch(config.historySheetId, `/values/${appendRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values }) }, false);
  return { added: true, range: result?.updates?.updatedRange || '' };
}
function serializeAiLeadSheetWrite(fn) {
  const task = aiLeadSheetWriteChain.then(fn, fn);
  aiLeadSheetWriteChain = task.catch(() => {});
  return task;
}
async function queueAiLeadSync(leadKey) {
  const id = String(leadKey || '').trim();
  if (!id) return;
  const queue = await getOne(AI_LEAD_SYNC_QUEUE_KEY, []);
  const current = Array.isArray(queue) ? queue : [];
  if (!current.includes(id)) current.push(id);
  await setStore({ [AI_LEAD_SYNC_QUEUE_KEY]: current.slice(-3000) });
}
async function queueAllAiLeadsForSheetSync() {
  const leads = await getLeads();
  const ids = leads.filter((lead) => lead?.aiIntelligence || lead?.aiQualification).map((lead) => String(leadId(lead) || '')).filter(Boolean);
  if (!ids.length) return 0;
  const queue = await getOne(AI_LEAD_SYNC_QUEUE_KEY, []);
  await setStore({ [AI_LEAD_SYNC_QUEUE_KEY]: [...new Set([...(Array.isArray(queue) ? queue : []), ...ids])].slice(-3000) });
  return ids.length;
}
async function flushAiLeadIntelligenceQueue() {
  if (aiLeadSyncFlushPromise) return aiLeadSyncFlushPromise;
  aiLeadSyncFlushPromise = (async () => {
    const config = await getAiConfigInternal();
    const queue = await getOne(AI_LEAD_SYNC_QUEUE_KEY, []);
    const pending = Array.isArray(queue) ? queue : [];
    if (!config.historySheetId || !pending.length) return { sent: 0, pending: pending.length };
    let sent = 0;
    const keep = [];
    for (const id of pending.slice(0, 40)) {
      const leads = await getLeads();
      const lead = leads.find((item) => String(leadId(item) || '') === String(id));
      if (!lead?.aiIntelligence && !lead?.aiQualification) { continue; }
      try {
        await serializeAiLeadSheetWrite(() => upsertAiLeadSheet(lead, config));
        const latest = await getLeads();
        const latestLead = latest.find((item) => String(leadId(item) || '') === String(id));
        if (latestLead?.aiIntelligence) {
          latestLead.aiIntelligence.syncStatus = 'synced';
          latestLead.aiIntelligence.syncError = '';
          latestLead.aiIntelligence.sheetSyncedAt = new Date().toISOString();
          await putLeads(latest);
        }
        sent++;
      } catch (error) {
        keep.push(id);
        const latest = await getLeads();
        const latestLead = latest.find((item) => String(leadId(item) || '') === String(id));
        if (latestLead?.aiIntelligence) {
          latestLead.aiIntelligence.syncStatus = 'pending';
          latestLead.aiIntelligence.syncError = String(error?.message || error).slice(0, 220);
          await putLeads(latest);
        }
      }
    }
    const processedBatch = new Set(pending.slice(0, 40));
    const remainingAfterBatch = pending.slice(40);
    const concurrentQueue = await getOne(AI_LEAD_SYNC_QUEUE_KEY, []);
    const concurrentlyAdded = (Array.isArray(concurrentQueue) ? concurrentQueue : []).filter((id) => !processedBatch.has(id));
    const finalQueue = [...new Set([...keep, ...remainingAfterBatch, ...concurrentlyAdded])].slice(-3000);
    await setStore({ [AI_LEAD_SYNC_QUEUE_KEY]: finalQueue });
    return { sent, pending: finalQueue.length };
  })().finally(() => { aiLeadSyncFlushPromise = null; });
  return aiLeadSyncFlushPromise;
}
async function connectAiConversationHistory() {
  const config = await getAiConfigInternal();
  if (!await chrome.permissions.contains({ origins: ['https://sheets.googleapis.com/*'] })) throw new Error('Autorize o acesso ao Google Sheets na janela do Chrome e tente novamente.');
  let sheetId = String(config.historySheetId || '').trim();
  let sheetTitle = 'i9Hub — Histórico de conversas IA';
  if (sheetId) {
    const existing = await historySheetsFetch(sheetId, '?fields=spreadsheetId,properties.title,sheets.properties.title', { method: 'GET' }, true);
    sheetTitle = existing?.properties?.title || sheetTitle;
    const tabs = (existing?.sheets || []).map((item) => item.properties?.title).filter(Boolean);
    if (!tabs.includes('Mensagens')) {
      await googleSheetsFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Mensagens', gridProperties: { frozenRowCount: 1 } } } }] }) }, false);
    }
  } else {
    const created = await googleSheetsFetch('https://sheets.googleapis.com/v4/spreadsheets', { method: 'POST', body: JSON.stringify({ properties: { title: sheetTitle }, sheets: [{ properties: { title: 'Mensagens', gridProperties: { frozenRowCount: 1 } } }] }) }, true);
    sheetId = String(created?.spreadsheetId || '');
    if (!sheetId) throw new Error('O Google não retornou o ID da nova planilha.');
    sheetTitle = created?.properties?.title || sheetTitle;
  }
  const headerRange = encodeURIComponent("'Mensagens'!A1:L1");
  await historySheetsFetch(sheetId, `/values/${headerRange}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [AI_HISTORY_HEADERS] }) }, false);
  await ensureAiLeadSheet(sheetId, false);
  // Atualize somente os campos do histórico a partir da configuração mais recente.
  // O objeto lido antes das chamadas de rede pode estar desatualizado e apagar prompts editados.
  const latestConfig = await getAiConfigInternal();
  latestConfig.historySheetId = sheetId;
  latestConfig.historySheetUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/edit`;
  latestConfig.historyEnabled = true;
  latestConfig.historyLastError = '';
  latestConfig.historyLastSyncAt = latestConfig.historyLastSyncAt || null;
  latestConfig.historyUpdatedAt = new Date().toISOString();
  await setStore({ [AI_CONFIG_KEY]: latestConfig });
  await chrome.alarms.create('i9-ai-history-flush', { periodInMinutes: 5 });
  await queueAllAiLeadsForSheetSync().catch(() => 0);
  flushAiHistoryQueue().catch(() => {});
  flushAiLeadIntelligenceQueue().catch(() => {});
  return { success: true, data: { sheetId, sheetTitle, sheetUrl: latestConfig.historySheetUrl, historyEnabled: true, leadSheet: 'Leads' } };
}
function queueAiHistoryEvent(event = {}) {
  const task = aiHistoryWriteChain.then(async () => {
    const config = await getAiConfigInternal();
    if (config.historyEnabled !== true || !config.historySheetId) return false;
    const direction = String(event.direction || 'Sistema').slice(0, 40);
    const rawId = String(event.eventId || uid('history')).slice(0, 220);
    const dedupeId = `${rawId}|${direction}`;
    const seen = await getOne(AI_HISTORY_DEDUPE_KEY, []);
    if (Array.isArray(seen) && seen.includes(dedupeId)) return false;
    const queue = await getOne(AI_HISTORY_QUEUE_KEY, []);
    queue.push({ ...event, eventId: rawId, direction, queuedAt: Date.now() });
    const nextSeen = [...(Array.isArray(seen) ? seen : []), dedupeId].slice(-10000);
    await setStore({ [AI_HISTORY_QUEUE_KEY]: queue.slice(-5000), [AI_HISTORY_DEDUPE_KEY]: nextSeen });
    return true;
  });
  aiHistoryWriteChain = task.catch(() => false);
  task.then((added) => { if (added) flushAiHistoryQueue().catch(() => {}); }).catch(() => {});
  return task;
}
async function flushAiHistoryQueue() {
  if (aiHistoryFlushPromise) { aiHistoryFlushRequested = true; return aiHistoryFlushPromise; }
  aiHistoryFlushPromise = (async () => {
    let sent = 0;
    try {
      do {
        aiHistoryFlushRequested = false;
        await aiHistoryWriteChain.catch(() => false);
        const config = await getAiConfigInternal();
        if (!config.historySheetId) return { sent, pending: (await getOne(AI_HISTORY_QUEUE_KEY, [])).length, skipped: true };
        const queue = await getOne(AI_HISTORY_QUEUE_KEY, []);
        if (!Array.isArray(queue) || !queue.length) break;
        const batch = queue.slice(0, 50);
        const range = encodeURIComponent("'Mensagens'!A:L");
        await historySheetsFetch(config.historySheetId, `/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: batch.map(historyEventRow) }) }, false);
        const batchIds = new Set(batch.map((item) => item.eventId));
        const currentQueue = await getOne(AI_HISTORY_QUEUE_KEY, []);
        await setStore({ [AI_HISTORY_QUEUE_KEY]: (Array.isArray(currentQueue) ? currentQueue : []).filter((item) => !batchIds.has(item.eventId)) });
        sent += batch.length;
      } while (aiHistoryFlushRequested || (await getOne(AI_HISTORY_QUEUE_KEY, [])).length > 0);
      const config = await getAiConfigInternal();
      config.historyLastSyncAt = new Date().toISOString(); config.historyLastError = ''; config.historyUpdatedAt = config.historyLastSyncAt;
      await setStore({ [AI_CONFIG_KEY]: config, aiSupportHistoryLastSyncAt: config.historyLastSyncAt });
      const leadSync = await flushAiLeadIntelligenceQueue().catch((error) => ({ sent: 0, pending: 0, error: String(error?.message || error).slice(0, 180) }));
      return { sent, pending: (await getOne(AI_HISTORY_QUEUE_KEY, [])).length, leadSync };
    } catch (error) {
      const config = await getAiConfigInternal();
      config.historyLastError = String(error?.message || error).replace(/(?:Bearer\s+)[A-Za-z0-9._~-]+/ig, 'Bearer [oculto]').slice(0, 240); config.historyUpdatedAt = new Date().toISOString();
      await setStore({ [AI_CONFIG_KEY]: config, aiSupportHistoryLastError: config.historyLastError });
      return { sent, pending: (await getOne(AI_HISTORY_QUEUE_KEY, [])).length, error: config.historyLastError };
    }
  })().finally(() => {
    aiHistoryFlushPromise = null;
    if (aiHistoryFlushRequested) { aiHistoryFlushRequested = false; flushAiHistoryQueue().catch(() => {}); }
  });
  return aiHistoryFlushPromise;
}
async function loadAiConversationHistory(conversationKey, config, localConversations = {}) {
  const local = Array.isArray(localConversations[conversationKey]) ? localConversations[conversationKey].slice(-12) : [];
  if (local.length || config.historyEnabled !== true || !config.historySheetId || !await chrome.permissions.contains({ origins: ['https://sheets.googleapis.com/*'] })) return local;
  try {
    const range = encodeURIComponent("'Mensagens'!A:L");
    const data = await historySheetsFetch(config.historySheetId, `/values/${range}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`, { method: 'GET' }, false);
    const rows = Array.isArray(data.values) ? data.values.slice(1) : [];
    const matching = rows.filter((row) => String(row?.[2] || '') === String(conversationKey) && ['Recebida','Resposta IA'].includes(String(row?.[6] || ''))).slice(-12);
    const history = matching.map((row) => ({ role: String(row?.[6] || '') === 'Resposta IA' ? 'assistant' : 'user', content: String(row?.[7] || '').slice(0, 4000), at: String(row?.[1] || new Date().toISOString()), senderName: String(row?.[5] || '').slice(0, 120), messageId: String(row?.[0] || '') })).filter((item) => item.content);
    if (history.length) {
      const all = { ...localConversations, [conversationKey]: history.slice(-12) };
      await setStore({ [AI_CONVERSATIONS_KEY]: all });
    }
    return history;
  } catch (error) {
    const latest = await getAiConfigInternal(); latest.historyLastError = `Não foi possível recuperar o contexto da planilha: ${String(error?.message || error).slice(0, 180)}`; latest.historyUpdatedAt = new Date().toISOString();
    await setStore({ [AI_CONFIG_KEY]: latest });
    return local;
  }
}
async function rememberAiUserMessage(conversationKey, messageId, content, at, senderName = '') {
  if (!conversationKey || !messageId || !content) return;
  const conversations = await getOne(AI_CONVERSATIONS_KEY, {});
  const history = Array.isArray(conversations[conversationKey]) ? conversations[conversationKey] : [];
  if (history.some((item) => item?.messageId === messageId)) return;
  conversations[conversationKey] = [...history, { role: 'user', content: String(content).slice(0, 4000), at: at || new Date().toISOString(), senderName: String(senderName || '').slice(0, 120), messageId }].slice(-12);
  await setStore({ [AI_CONVERSATIONS_KEY]: conversations });
}
function sheetTabA1(tab) { return `'${String(tab || 'Pedidos').replace(/'/g, "''")}'`; }
async function findAiOrderRange(config, orderId) {
  const range = encodeURIComponent(`${sheetTabA1(config.sheetTab)}!A:A`);
  const data = await sheetsFetch(config, `/values/${range}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`, { method: 'GET' }, false);
  const rows = Array.isArray(data.values) ? data.values : [];
  const index = rows.findIndex((row) => String(row?.[0] || '').trim() === String(orderId));
  return index >= 0 ? `${sheetTabA1(config.sheetTab)}!A${index + 1}:K${index + 1}` : '';
}
async function appendAiOrder(config, order) {
  // Antes de inserir, procure o ID para que uma resposta de rede perdida não duplique a linha.
  const existingRange = await findAiOrderRange(config, order.id);
  if (existingRange) return { updatedRange: existingRange, updatedRows: 0, alreadyPresent: true };
  const range = encodeURIComponent(`${sheetTabA1(config.sheetTab)}!A:K`);
  const values = [[order.id, order.createdAt, order.customerName || '', order.customerPhone || '', order.company || '', order.service || '', order.details || '', config.sellerPhone || '', order.status || 'awaiting_approval', 'i9Leads Flow — Atendimento IA', order.saleValue ?? '']];
  const data = await sheetsFetch(config, `/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values }) }, false);
  return { updatedRange: data?.updates?.updatedRange || '', updatedRows: data?.updates?.updatedRows || 0, alreadyPresent: false };
}
async function updateAiOrderSheet(config, order, status) {
  const match = String(order.sheetRange || '').match(/![A-Z]+(\d+)/i);
  if (!match) return false;
  const range = encodeURIComponent(`${sheetTabA1(config.sheetTab)}!I${match[1]}`);
  await sheetsFetch(config, `/values/${range}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: [[status]] }) }, false);
  if (status === 'closed_won' && Number.isFinite(Number(order.saleValue)) && Number(order.saleValue) >= 0) {
    const valueRange = encodeURIComponent(`${sheetTabA1(config.sheetTab)}!K${match[1]}`);
    await sheetsFetch(config, `/values/${valueRange}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: [[Number(order.saleValue)]] }) }, false);
  }
  return true;
}
function parseAiDecision(text) {
  const clean = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const allowedStatuses = new Set(['qualified', 'nurture', 'in_qualification', 'not_qualified']);
  const textField = (value, max = 700) => String(value ?? '').trim().slice(0, max);
  const stringList = (value, maxItems = 8, maxLen = 350) => Array.isArray(value) ? [...new Set(value.map((item) => textField(item, maxLen)).filter(Boolean))].slice(0, maxItems) : [];
  const normalize = (obj) => {
    const rawQualification = obj?.qualification && typeof obj.qualification === 'object' ? obj.qualification : {};
    const rawStatus = String(rawQualification.status || '').trim().toLowerCase();
    return {
      reply: textField(obj?.reply || obj?.message || '', 2500),
      shouldCreateOrder: obj?.shouldCreateOrder === true,
      handoffToHuman: obj?.handoffToHuman === true,
      handoffReason: textField(obj?.handoffReason, 180),
      order: obj?.order && typeof obj.order === 'object' ? obj.order : {},
      missingFields: stringList(obj?.missingFields, 10, 160),
      qualification: {
        isQualified: rawQualification.isQualified === true,
        confidence: Math.max(0, Math.min(1, Number(rawQualification.confidence) > 1 ? Number(rawQualification.confidence) / 100 : Number(rawQualification.confidence) || 0)),
        confidenceProvided: rawQualification.confidence !== undefined && rawQualification.confidence !== null && rawQualification.confidence !== '',
        qualificationProvided: !!(obj?.qualification && typeof obj.qualification === 'object'),
        missingFieldsProvided: Array.isArray(obj?.missingFields) || Array.isArray(rawQualification.missingFields),
        status: allowedStatuses.has(rawStatus) ? rawStatus : '',
        reason: textField(rawQualification.reason, 500),
        summary: textField(rawQualification.summary, 1200),
        exactRequest: textField(rawQualification.exactRequest || rawQualification.request, 1200),
        company: textField(rawQualification.company, 350),
        need: textField(rawQualification.need, 700),
        service: textField(rawQualification.service, 350),
        segment: textField(rawQualification.segment, 350),
        intent: textField(rawQualification.intent, 350),
        budget: textField(rawQualification.budget, 250),
        budgetStatus: textField(rawQualification.budgetStatus, 250),
        timeframe: textField(rawQualification.timeframe, 250),
        decisionMaker: textField(rawQualification.decisionMaker, 250),
        objection: textField(rawQualification.objection, 500),
        evidence: stringList(rawQualification.evidence, 8, 350),
        missingFields: stringList(rawQualification.missingFields, 10, 160),
        nextStep: textField(rawQualification.nextStep, 500),
        nicheClassification: (() => {
          const raw = rawQualification.nicheClassification && typeof rawQualification.nicheClassification === 'object' ? rawQualification.nicheClassification : (obj?.nicheClassification && typeof obj.nicheClassification === 'object' ? obj.nicheClassification : {});
          const confidence = raw.confidence ?? rawQualification.confidence;
          return {
            primaryNiche: textField(raw.primaryNiche || raw.primary || '', 120),
            path: stringList(raw.path, 12, 120),
            subniches: stringList(raw.subniches || raw.subNiches, 11, 120),
            tags: stringList(raw.tags, 30, 100),
            confidence: Math.max(0, Math.min(1, Number(confidence) > 1 ? Number(confidence) / 100 : Number(confidence) || 0)),
            evidence: stringList(raw.evidence || rawQualification.evidence, 8, 350),
          };
        })(),
      },
    };
  };
  try { const obj = JSON.parse(clean); if (obj && typeof obj === 'object') return normalize(obj); } catch { /* tenta extrair objeto */ }
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) try { const obj = JSON.parse(match[0]); if (obj && typeof obj === 'object') return normalize(obj); } catch { /* resposta em texto livre */ }
  return normalize({ reply: clean.slice(0, 1800) });
}


/** Atualiza uma memória estruturada por conversa sem armazenar transcrição ou telefone. */
async function updateAiConversationMemory(conversationKey, qualification = {}, personaMode = 'commercial') {
  if (!conversationKey || !/^chat_[a-f0-9]{1,16}$/i.test(String(conversationKey)) || personaMode === 'self_knowledge') return false;
  const current = await getAiConfigInternal();
  const map = mergeAiConversationMemoryMaps(current.conversationMemory || {}, {});
  const previous = map[conversationKey] || null;
  const next = mergeAiConversationMemory(previous, qualification, personaMode, new Date().toISOString());
  if (!next) return false;
  if (previous && JSON.stringify(previous) === JSON.stringify(next)) return false;
  map[conversationKey] = next;
  current.conversationMemory = mergeAiConversationMemoryMaps(map, {});
  current.conversationMemoryUpdatedAt = new Date().toISOString();
  // Deliberadamente não altera updatedAt: memória e prompts têm relógios de conflito independentes.
  await setStore({ [AI_CONFIG_KEY]: current });
  return true;
}

async function rememberAiProcessedMessage(messageId) {
  const id = String(messageId || '').slice(0, 280);
  if (!id) return;
  const current = await getOne(AI_PROCESSED_KEY, []);
  const list = Array.isArray(current) ? current : [];
  if (list.includes(id)) return;
  await setStore({ [AI_PROCESSED_KEY]: [...list, id].slice(-1000) });
}

function withAiIncomingQueueLock(fn) {
  const task = aiIncomingQueueMutationChain.then(fn, fn);
  aiIncomingQueueMutationChain = task.catch(() => {});
  return task;
}
function activeAiQueueCount(queue = []) {
  return queue.filter((item) => ['queued', 'processing'].includes(item?.status)).length;
}
function reviewAiQueueCount(queue = []) {
  return queue.filter((item) => item?.status === 'needs_attention').length;
}
function sanitizeAiIncomingPayload(input = {}) {
  const str = (value, max) => String(value ?? '').slice(0, max);
  return {
    messageId: str(input.messageId, 280), chatId: str(input.chatId, 120), chatRef: str(input.chatRef, 60),
    chatName: str(input.chatName, 180), chatType: input.chatType === 'group' || input.isGroup === true ? 'group' : 'private',
    isGroup: input.chatType === 'group' || input.isGroup === true,
    phone: normalizePhoneSafe(input.phone || ''), senderName: str(input.senderName, 120), senderPhone: normalizePhoneSafe(input.senderPhone || ''),
    isReply: input.isReply === true, isMention: input.isMention === true, replyContext: str(input.replyContext, 700),
    text: str(input.text, 4000).trim(), receivedAt: str(input.receivedAt, 40), source: str(input.source, 50),
  };
}
async function enqueueAiIncomingMessage(input = {}, sender = {}) {
  const payload = sanitizeAiIncomingPayload(input);
  if (!payload.messageId || !payload.chatName || !payload.text || !Number.isInteger(sender?.tab?.id)) {
    return { success: false, code: 'INVALID_MESSAGE', error: 'Mensagem sem identificador, conversa, texto ou aba de origem válidos.' };
  }
  let expired = [];
  const result = await withAiIncomingQueueLock(async () => {
    const now = Date.now();
    let queue = await getOne(AI_INCOMING_QUEUE_KEY, []);
    queue = Array.isArray(queue) ? queue : [];
    expired = queue.filter((item) => (item?.status === 'queued' && now - Number(item.queuedAt || 0) > AI_INCOMING_QUEUE_TTL_MS)
      || (item?.status === 'needs_attention' && now - Number(item.queuedAt || 0) > AI_INCOMING_REVIEW_TTL_MS));
    queue = queue.filter((item) => !expired.includes(item));
    const processed = await getOne(AI_PROCESSED_KEY, []);
    const duplicate = (Array.isArray(processed) && processed.includes(payload.messageId)) || queue.some((item) => item?.messageId === payload.messageId && ['queued', 'processing', 'needs_attention'].includes(item.status));
    if (duplicate) {
      await setStore({ [AI_INCOMING_QUEUE_KEY]: queue });
      return { success: true, duplicate: true, queue };
    }
    if (activeAiQueueCount(queue) >= AI_INCOMING_QUEUE_LIMIT) {
      await setStore({ [AI_INCOMING_QUEUE_KEY]: queue });
      return { success: false, code: 'AI_INCOMING_QUEUE_FULL', error: `A fila de entrada atingiu o limite de ${AI_INCOMING_QUEUE_LIMIT} mensagens. Pause o atendimento e revise a Central de Execução.`, queue };
    }
    queue.push({ id: payload.messageId, messageId: payload.messageId, payload, tabId: sender.tab.id, chatName: payload.chatName,
      chatType: payload.chatType, queuedAt: now, status: 'queued', attempts: 0 });
    await setStore({ [AI_INCOMING_QUEUE_KEY]: queue });
    return { success: true, queued: true, queue };
  });
  for (const item of expired) {
    await recordAiMonitorEvent(item.payload || { messageId: item.messageId, chatName: item.chatName, chatType: item.chatType, receivedAt: new Date(Number(item.queuedAt) || Date.now()).toISOString() },
      { status: 'error', error: item.status === 'queued' ? 'Mensagem expirou na fila após 24 horas e não foi enviada.' : 'Registro de revisão expirou após 7 dias.' }, null);
  }
  const queue = result.queue || await getOne(AI_INCOMING_QUEUE_KEY, []);
  aiPendingInboundCount = activeAiQueueCount(Array.isArray(queue) ? queue : []);
  return result;
}

/** Após reinício do service worker, não repete uma mensagem cujo envio possa ter sido confirmado. */
async function recoverAiIncomingQueueOnce() {
  if (aiQueueRecovered) return;
  let interrupted = [];
  await withAiIncomingQueueLock(async () => {
    const queue = await getOne(AI_INCOMING_QUEUE_KEY, []);
    const safeQueue = Array.isArray(queue) ? queue : [];
    interrupted = safeQueue.filter((item) => item?.status === 'processing');
    const recovered = safeQueue.map((item) => item?.status === 'processing' ? {
      id: item.id, messageId: item.messageId, chatName: item.chatName || item.payload?.chatName || 'Conversa não identificada',
      chatType: item.chatType || item.payload?.chatType || 'private', queuedAt: Number(item.queuedAt) || Date.now(),
      status: 'needs_attention', attempts: Number(item.attempts) || 1,
      error: 'A extensão reiniciou durante o processamento. O envio é incerto; a mensagem não foi repetida automaticamente para evitar duplicação.',
    } : item);
    await setStore({ [AI_INCOMING_QUEUE_KEY]: recovered });
    aiPendingInboundCount = activeAiQueueCount(recovered);
  });
  aiQueueRecovered = true;
  for (const item of interrupted) {
    await recordAiMonitorEvent(item.payload || { messageId: item.messageId, chatName: item.chatName, chatType: item.chatType, receivedAt: new Date(Number(item.queuedAt) || Date.now()).toISOString() },
      { status: 'error', error: 'A extensão reiniciou durante o processamento. O envio é incerto; a mensagem não foi repetida automaticamente para evitar duplicação.' }, null);
  }
}

async function drainAiIncomingQueue() {
  const task = aiIncomingProcessingChain.then(async () => {
    await recoverAiIncomingQueueOnce();
    while (true) {
      let expiredItem = null;
      const item = await withAiIncomingQueueLock(async () => {
        let queue = await getOne(AI_INCOMING_QUEUE_KEY, []);
        queue = Array.isArray(queue) ? queue : [];
        const now = Date.now();
        const expiredIndex = queue.findIndex((entry) => entry?.status === 'queued' && now - Number(entry.queuedAt || 0) > AI_INCOMING_QUEUE_TTL_MS);
        if (expiredIndex >= 0) {
          expiredItem = queue[expiredIndex]; queue.splice(expiredIndex, 1); await setStore({ [AI_INCOMING_QUEUE_KEY]: queue });
          aiPendingInboundCount = activeAiQueueCount(queue); return null;
        }
        const index = queue.findIndex((entry) => entry?.status === 'queued');
        if (index < 0) { aiPendingInboundCount = activeAiQueueCount(queue); return null; }
        queue[index] = { ...queue[index], status: 'processing', startedAt: now, attempts: (Number(queue[index].attempts) || 0) + 1 };
        await setStore({ [AI_INCOMING_QUEUE_KEY]: queue });
        aiPendingInboundCount = activeAiQueueCount(queue);
        return { ...queue[index] };
      });
      if (expiredItem) {
        await recordAiMonitorEvent(expiredItem.payload || { messageId: expiredItem.messageId, chatName: expiredItem.chatName, chatType: expiredItem.chatType }, { status: 'error', error: 'Mensagem expirou na fila após 24 horas e não foi enviada.' }, null);
        continue;
      }
      if (!item) break;
      let tab = null;
      try { tab = await chrome.tabs.get(item.tabId); } catch { /* aba fechada */ }
      if (!tab?.id) {
        await withAiIncomingQueueLock(async () => {
          const queue = await getOne(AI_INCOMING_QUEUE_KEY, []);
          await setStore({ [AI_INCOMING_QUEUE_KEY]: (Array.isArray(queue) ? queue : []).filter((entry) => entry.messageId !== item.messageId) });
          aiPendingInboundCount = activeAiQueueCount(await getOne(AI_INCOMING_QUEUE_KEY, []));
        });
        await recordAiMonitorEvent(item.payload, { status: 'error', error: 'A aba do WhatsApp Web foi fechada antes do processamento; confira a conversa manualmente.' }, null);
        continue;
      }
      await publishAiProcessingState(tab);
      const started = Date.now();
      let outcome;
      try { outcome = await processAiIncomingMessage(item.payload, { tab }); }
      catch (error) { outcome = { status: 'error', error: String(error?.message || error).slice(0, 220) }; }
      if (outcome?.status === 'panel-not-open') {
        await withAiIncomingQueueLock(async () => {
          const queue = await getOne(AI_INCOMING_QUEUE_KEY, []);
          const next = (Array.isArray(queue) ? queue : []).map((entry) => entry.messageId === item.messageId ? { ...entry, status: 'queued', startedAt: null, attempts: Math.max(0, (Number(entry.attempts) || 1) - 1) } : entry);
          await setStore({ [AI_INCOMING_QUEUE_KEY]: next }); aiPendingInboundCount = activeAiQueueCount(next);
        });
        await publishAiProcessingState(tab);
        break;
      }
      await recordAiMonitorEvent(item.payload, outcome || { status: 'ignored' }, Date.now() - started);
      await rememberAiProcessedMessage(item.messageId).catch(() => {});
      await setStore({ aiSupportLastProcessingStatus: { status: outcome?.status || 'ignored', at: new Date().toISOString(), chatName: String(item.payload.chatName || '').slice(0, 180), chatType: item.payload.chatType || 'private', error: String(outcome?.error || ''), personaName: String(outcome?.personaName || '').slice(0, 100) } });
      // Não repetir automaticamente erro ou envio não confirmado: o WhatsApp pode ter recebido a resposta.
      await withAiIncomingQueueLock(async () => {
        const queue = await getOne(AI_INCOMING_QUEUE_KEY, []);
        const next = (Array.isArray(queue) ? queue : []).filter((entry) => entry.messageId !== item.messageId);
        await setStore({ [AI_INCOMING_QUEUE_KEY]: next }); aiPendingInboundCount = activeAiQueueCount(next);
      });
      await publishAiProcessingState(tab);
    }
  });
  aiIncomingProcessingChain = task.catch(() => {});
  return task;
}

function aiChatHash(value) { let h = 2166136261; for (const c of String(value || '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return `chat_${(h >>> 0).toString(16)}`; }
function normalizeOrderText(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 1800); }
function aiQualificationStatus(q = {}, qualifiedNow = false) {
  if (qualifiedNow) return 'qualified';
  const allowed = new Set(['qualified', 'nurture', 'in_qualification', 'not_qualified']);
  const status = String(q.status || '').trim().toLowerCase();
  if (allowed.has(status) && status !== 'qualified') return status;
  const budgetText = normalizeOrderText(`${q.budgetStatus || ''} ${q.budget || ''} ${q.reason || ''}`);
  if (/sem verba|sem orcamento|nao tem verba|nao possui verba|orcamento indisponivel|sem disponibilidade financeira|sem investimento no momento/.test(budgetText)) return 'nurture';
  if (q.isQualified === true) return 'in_qualification';
  if (q.need || q.exactRequest || q.summary) return 'in_qualification';
  return 'in_qualification';
}
function meaningfulAiValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  return !/^(nao informado|não informado|desconhecido|unknown|n\/a|nenhum|ainda nao identificado|ainda não identificado)$/i.test(text);
}
function mergeAiIntelligence(previous = {}, next = {}) {
  const out = { ...previous };
  const scalarFields = ['exactRequest','summary','need','service','segment','intent','budget','budgetStatus','timeframe','decisionMaker','objection','reason','nextStep','status','conversationKey','chatType','chatName','provider','model','company'];
  for (const field of scalarFields) if (meaningfulAiValue(next[field])) out[field] = String(next[field]).trim().slice(0, field === 'summary' || field === 'exactRequest' ? 1200 : 700);
  if (next.confidenceProvided === true && Number.isFinite(Number(next.confidence))) out.confidence = Math.max(0, Math.min(1, Number(next.confidence)));
  if (Array.isArray(next.evidence) && next.evidence.length) out.evidence = [...new Set([...(Array.isArray(previous.evidence) ? previous.evidence : []), ...next.evidence].map((item) => String(item || '').trim()).filter(Boolean))].slice(-8);
  if (next.missingFieldsProvided === true && Array.isArray(next.missingFields)) out.missingFields = [...new Set(next.missingFields.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 10);
  out.evaluatedAt = next.evaluatedAt || previous.evaluatedAt || new Date().toISOString();
  out.updatedAt = new Date().toISOString();
  return out;
}
async function applyAiLeadQualification(payload = {}, config = {}, decision = {}, providerResult = {}, options = {}) {
  const observerOnly = options.mode === AI_OPERATION_MODES.OBSERVE_ONLY;
  const q = decision?.qualification || {};
  const threshold = Number.isFinite(Number(config.qualificationThreshold)) ? Number(config.qualificationThreshold) : 0.8;
  const qualifiesNow = config.qualificationEnabled !== false && decision.handoffToHuman !== true && q.isQualified === true && !['nurture','not_qualified'].includes(String(q.status || '')) && Number(q.confidence) >= threshold;
  const nicheData = q.nicheClassification && typeof q.nicheClassification === 'object' ? q.nicheClassification : {};
  const hasStructuredData = [q.exactRequest, q.summary, q.company, q.need, q.service, q.segment, q.intent, q.budget, q.budgetStatus, q.timeframe, q.decisionMaker, q.objection, q.reason, q.nextStep, nicheData.primaryNiche].some(meaningfulAiValue) || (Array.isArray(nicheData.path) && nicheData.path.length > 0) || (Array.isArray(nicheData.tags) && nicheData.tags.length > 0) || (meaningfulAiValue(q.status) && q.status !== 'in_qualification') || (Array.isArray(q.evidence) && q.evidence.length > 0) || (Array.isArray(q.missingFields) && q.missingFields.length > 0);
  if (!hasStructuredData) return { applied: false, reason: 'no-structured-intelligence' };
  const targetStage = String(config.qualifiedStage || 'qualificado');
  const validStages = qualifiesNow && !observerOnly ? await getStageList() : [];
  const targetStageValid = !qualifiesNow || (!!targetStage && targetStage !== 'blacklist' && validStages.some((stage) => String(stage.id) === targetStage));
  const licenseState = await getLicenseState();
  const crmFeature = observerOnly ? 'crm.leads' : 'crm.kanban';
  if (!licenseState.licensed || !hasFeatureEntitlement(licenseState.payload?.ent, crmFeature)) return { applied: false, reason: observerOnly ? 'crm-leads-permission-required' : 'crm-stage-permission-required' };
  if (observerOnly && !hasFeatureEntitlement(licenseState.payload?.ent, 'ai.mode.observe_only')) return { applied: false, reason: 'observer-feature-permission-required' };

  const leads = await getLeads();
  const chatType = payload.chatType === 'group' || payload.isGroup === true ? 'group' : 'private';
  const rawPhone = chatType === 'group' ? (payload.senderPhone || '') : (payload.phone || payload.senderPhone || '');
  const phone = normalizePhoneSafe(rawPhone);
  const displayName = String(chatType === 'group' ? (payload.senderName || '') : (payload.chatName || payload.senderName || '')).trim();
  let candidates = [];
  if (phone.length >= 8) {
    candidates = leads.filter((lead) => normalizePhoneSafe(lead.phone) === phone);
    if (!candidates.length) {
      const tail = phone.slice(-10);
      if (tail.length >= 8) candidates = leads.filter((lead) => normalizePhoneSafe(lead.phone).slice(-10) === tail);
    }
  }
  if (candidates.length !== 1 && !candidates.length && displayName) {
    const nameKey = normalizeOrderText(displayName);
    if (nameKey) candidates = leads.filter((lead) => normalizeOrderText(lead.name) === nameKey);
  }
  if (candidates.length > 1) return { applied: false, reason: 'ambiguous-lead-match' };
  let lead = candidates[0] || null;
  const now = new Date().toISOString();
  if (!lead && phone.length >= 10 && phone.length <= 15) {
    const blocked = await blacklistTails().catch(() => new Set());
    if (blocked.has(phone.slice(-10))) return { applied: false, reason: 'lead-blacklisted' };
    lead = {
      id: uid('lead'), name: displayName || phone, phone,
      source: chatType === 'group' ? 'whatsapp_group' : 'whatsapp_private', stage: 'novo', tags: [], groups: [],
      opportunity: true, opportunitySource: chatType === 'group' ? 'whatsapp_group' : 'whatsapp_private',
      opportunityCreatedAt: now, whatsappPrivate: chatType === 'private',
      ...(chatType === 'private' && payload.chatId ? { waChatId: String(payload.chatId).slice(0, 180) } : {}),
      ...(chatType === 'group' && payload.chatName ? { groupName: String(payload.chatName).slice(0, 180), groups: [String(payload.chatName).slice(0, 180)] } : {}),
      createdAt: now, extractedAt: now, updatedAt: now,
    };
    leads.push(lead);
  }
  if (!lead) return { applied: false, reason: 'lead-not-found' };
  if (lead.blacklisted || lead.stage === 'blacklist') return { applied: false, reason: 'lead-protected-stage' };

  const previousStage = String(lead.stage || 'novo');
  const previousIntel = lead.aiIntelligence && typeof lead.aiIntelligence === 'object' ? lead.aiIntelligence : {};
  const previousNicheClassification = lead.aiNicheClassification && typeof lead.aiNicheClassification === 'object' ? lead.aiNicheClassification : {};
  const previouslyQualified = lead.aiQualification?.qualified === true;
  const status = previouslyQualified ? 'qualified' : aiQualificationStatus(q, qualifiesNow);
  const intelligence = mergeAiIntelligence(previousIntel, {
    exactRequest: q.exactRequest, summary: q.summary, company: q.company, need: q.need, service: q.service, segment: q.segment,
    intent: q.intent, budget: q.budget, budgetStatus: q.budgetStatus, timeframe: q.timeframe,
    decisionMaker: q.decisionMaker, objection: q.objection, reason: q.reason, nextStep: q.nextStep,
    status, confidence: q.confidence, confidenceProvided: q.confidenceProvided, evidence: q.evidence,
    missingFieldsProvided: q.missingFieldsProvided,
    missingFields: [...(Array.isArray(decision.missingFields) ? decision.missingFields : []), ...(Array.isArray(q.missingFields) ? q.missingFields : [])],
    conversationKey: aiChatHash(payload.chatRef || payload.phone || payload.chatName || displayName), chatType,
    chatName: chatType === 'group' ? displayName : String(payload.chatName || displayName),
    provider: providerResult.provider || config.provider || '', model: providerResult.model || config.model || '',
    evaluatedAt: now,
  });
  intelligence.source = observerOnly ? 'i9Hub-ai-observer' : 'i9Hub-ai-chat';
  intelligence.analysisMode = observerOnly ? AI_OPERATION_MODES.OBSERVE_ONLY : AI_OPERATION_MODES.AUTO_REPLY;
  lead.aiIntelligence = intelligence;
  lead.aiQualification = {
    ...(lead.aiQualification && typeof lead.aiQualification === 'object' ? lead.aiQualification : {}),
    qualified: previouslyQualified || qualifiesNow,
    confidence: previouslyQualified ? Math.max(Math.max(0, Math.min(1, Number(lead.aiQualification?.confidence) || 0)), q.confidenceProvided === true ? Math.max(0, Math.min(1, Number(q.confidence) || 0)) : 0) : (q.confidenceProvided === true ? Math.max(0, Math.min(1, Number(q.confidence) || 0)) : Math.max(0, Math.min(1, Number(lead.aiQualification?.confidence) || 0))),
    status: previouslyQualified ? 'qualified' : status,
    reason: String(q.reason || intelligence.reason || '').slice(0, 500),
    summary: String(q.summary || intelligence.summary || '').slice(0, 1200),
    exactRequest: String(q.exactRequest || intelligence.exactRequest || '').slice(0, 1200),
    need: String(q.need || intelligence.need || '').slice(0, 700),
    service: String(q.service || intelligence.service || '').slice(0, 350),
    segment: String(q.segment || intelligence.segment || '').slice(0, 350),
    intent: String(q.intent || intelligence.intent || '').slice(0, 350),
    budget: String(q.budget || intelligence.budget || '').slice(0, 250),
    budgetStatus: String(q.budgetStatus || intelligence.budgetStatus || '').slice(0, 250),
    timeframe: String(q.timeframe || intelligence.timeframe || '').slice(0, 250),
    decisionMaker: String(q.decisionMaker || intelligence.decisionMaker || '').slice(0, 250),
    objection: String(q.objection || intelligence.objection || '').slice(0, 500),
    evidence: Array.isArray(intelligence.evidence) ? intelligence.evidence.slice(-8) : [],
    missingFields: Array.isArray(intelligence.missingFields) ? intelligence.missingFields.slice(0, 10) : [],
    nextStep: String(q.nextStep || intelligence.nextStep || '').slice(0, 500),
    evaluatedAt: now, source: observerOnly ? 'i9Hub-ai-observer' : 'i9Hub-ai-chat',
  };
  let nicheClassificationApplied = false;
  try {
    if (hasFeatureEntitlement(licenseState.payload?.ent, 'crm.classifier.niche_models')) {
      const rawNiche = q.nicheClassification && typeof q.nicheClassification === 'object' ? q.nicheClassification : {};
      const taxonomy = await getNicheTaxonomy();
      const nicheResult = applyAiNicheClassification(taxonomy, lead, { ...rawNiche, evidence: rawNiche.evidence?.length ? rawNiche.evidence : q.evidence }, now);
      if (nicheResult.applied) {
        Object.assign(lead, nicheResult.lead);
        await setStore({ [K.NICHE_TAXONOMY]: nicheResult.taxonomy });
        nicheClassificationApplied = true;
      }
    }
  } catch (nicheError) {
    saveSystemLog({ module: 'crm-taxonomy', action: 'AI_NICHE_CLASSIFICATION_FAILED', status: 'error', message: safeLogText(nicheError?.message || String(nicheError), 180) });
  }
  const updatedFields = observerOnly ? getAiObserverChangedFields(
    { ...previousIntel, nicheClassification: previousNicheClassification },
    { ...intelligence, nicheClassification: lead.aiNicheClassification || {} },
  ) : [];
  if (observerOnly && updatedFields.length) {
    const eventKey = aiChatHash(String(payload.messageId || `${payload.chatRef || payload.phone || payload.chatName || displayName}|${now}`));
    appendCrmActivity(lead, {
      id: `ai_observer_${eventKey}`, type: 'ai.observation.updated',
      title: 'IA observadora atualizou informações do lead',
      description: `Campos atualizados: ${updatedFields.join(', ')}.`,
      actor: 'IA observadora', source: 'ai',
      metadata: { mode: AI_OPERATION_MODES.OBSERVE_ONLY, fields: updatedFields, confidence: Number(q.confidence) || 0 },
    });
  }
  let stageUpdated = false;
  const aiPreviousStageCategory = stageCategory(lead.stage);
  const aiTargetStageCategory = stageCategory(targetStage);
  const blocksPaidCommissionMove = lead.commissionStatus === 'paid' && aiPreviousStageCategory === 'closed_won' && aiTargetStageCategory !== 'closed_won';
  if (!observerOnly && qualifiesNow && targetStageValid && !blocksPaidCommissionMove && !['fechado','perdido','blacklist'].includes(String(lead.stage || '').toLowerCase())) {
    const stages = await getStageList();
    const currentIndex = stages.findIndex((stage) => String(stage.id) === previousStage);
    const targetIndex = stages.findIndex((stage) => String(stage.id) === targetStage);
    // Não volta um lead de Proposta/Fechado para trás se já avançou no funil.
    if (previousStage === targetStage || currentIndex < 0 || targetIndex < 0 || currentIndex <= targetIndex) {
      if (previousStage !== targetStage) {
        lead.stage = targetStage;
        lead.stageUpdatedAt = now;
        appendCrmActivity(lead, {
          type: 'lead.stage_changed',
          title: 'Etapa comercial atualizada pela IA',
          description: `Etapa alterada de "${String(previousStage || 'novo').slice(0, 80)}" para "${String(targetStage).slice(0, 80)}" após qualificação.`,
          actor: 'i9Hub IA',
          source: 'ai',
          createdAt: now,
          metadata: { from: String(previousStage || ''), to: String(targetStage), trigger: 'ai_qualification' },
        });
        if (aiPreviousStageCategory !== 'closed_won' && aiTargetStageCategory === 'closed_won') {
          const managementConfig = await getCommercialManagementConfig();
          snapshotLeadCommission(lead, managementConfig, now);
        }
        stageUpdated = true;
      }
    }
  }
  lead.updatedAt = now;
  await putLeads(leads);
  broadcast('CLASSIFICATION_UPDATED', { leadIds: [String(leadId(lead))], source: 'ai-commercial-intelligence', previousStage, stage: lead.stage, status, summary: intelligence.summary });
  await queueAiLeadSync(leadId(lead));
  const syncConfig = await getAiConfigInternal();
  if (syncConfig.historySheetId) await flushAiLeadIntelligenceQueue().catch(() => {});
  if (qualifiesNow && !observerOnly) await recordTelemetry('ai.lead.qualified', 'whatsapp.ai_support', { success: true, stageCategory: stageCategory(targetStage), provider: providerResult.provider || 'ai-chat' });
  return { applied: true, leadId: String(leadId(lead)), previousStage, stage: lead.stage, stageUpdated, nicheClassificationApplied, qualified: lead.aiQualification.qualified, status, confidence: Number(q.confidence) || 0, updatedFields, observerOnly };
}

async function consumeAiRateLimit(chatKey) {
  const now = Date.now();
  let state = await getOne(AI_RATE_LIMIT_KEY, { windowStart: now, globalCount: 0, chats: {} });
  if (!state.windowStart || now - state.windowStart >= 60000) state = { windowStart: now, globalCount: 0, chats: {} };
  state.chats = state.chats || {};
  const chat = state.chats[chatKey] || { count: 0, lastNoticeAt: 0 };
  if (Number(state.globalCount) >= 60 || Number(chat.count) >= 20) {
    const notify = now - Number(chat.lastNoticeAt || 0) > 60000;
    if (notify) chat.lastNoticeAt = now;
    state.chats[chatKey] = chat;
    const keys = Object.keys(state.chats); if (keys.length > 200) for (const key of keys.slice(0, keys.length - 200)) delete state.chats[key];
    await setStore({ [AI_RATE_LIMIT_KEY]: state });
    return { allowed: false, notify };
  }
  state.globalCount = (Number(state.globalCount) || 0) + 1; chat.count = (Number(chat.count) || 0) + 1; state.chats[chatKey] = chat;
  await setStore({ [AI_RATE_LIMIT_KEY]: state });
  return { allowed: true, notify: false };
}
async function processAiIncomingMessage(payload = {}, sender = {}) {
  const state = await getLicenseState();
  if (!state.licensed || !hasFeatureEntitlement(state.payload?.ent, 'whatsapp.ai_support')) return { status: 'license-blocked' };
  const storedConfig = await getAiConfigInternal();
  const config = applyAiPersonaForContext(storedConfig, payload);
  const operationMode = normalizeAiOperationMode(config.operationMode);
  const personaMode = ['networking', 'self_knowledge', 'commercial'].includes(config.personaMode) ? config.personaMode : 'commercial';
  if (operationMode === AI_OPERATION_MODES.OBSERVE_ONLY) {
    if (!hasFeatureEntitlement(state.payload?.ent, 'ai.mode.observe_only')) return { status: 'license-blocked-observer', operationMode };
    if (personaMode === 'self_knowledge') return { status: 'observer-persona-not-supported', operationMode, personaMode };
  }
  if (!config.enabled) return { status: 'paused', operationMode };
  const heartbeat = Number(await getOne(AI_HEARTBEAT_KEY, 0));
  if (!heartbeat || Date.now() - heartbeat > AI_HEARTBEAT_TTL_MS) return { status: 'panel-not-open' };
  const text = String(payload.text || '').trim().slice(0, 4000);
  const chatName = String(payload.chatName || '').trim().slice(0, 180);
  const messageId = String(payload.messageId || '').slice(0, 280);
  const chatType = payload.chatType === 'group' || payload.isGroup === true ? 'group' : 'private';
  const chatMode = ['private_only','groups_only','both'].includes(config.chatMode) ? config.chatMode : 'private_only';
  if (!text || !chatName || !messageId || !sender?.tab?.id) return { status: 'invalid-message' };
  if ((chatMode === 'private_only' && chatType === 'group') || (chatMode === 'groups_only' && chatType !== 'group')) return { status: 'chat-type-disabled' };
  if (chatType === 'group') {
    const scope = ['all','selected','except_selected'].includes(config.groupScope) ? config.groupScope : 'selected';
    const selectedIds = Array.isArray(config.selectedGroupIds) ? config.selectedGroupIds.map(String) : [];
    const selected = selectedIds.includes(String(payload.chatId || ''));
    if (scope === 'selected' && (!selectedIds.length || !selected)) return { status: 'group-not-selected' };
    if (scope === 'except_selected' && selected) return { status: 'group-excluded' };
  }
  const conversationKey = aiChatHash(payload.chatRef || payload.phone || chatName);
  const initialConversations = await getOne(AI_CONVERSATIONS_KEY, {});
  const loadedConversationHistory = await loadAiConversationHistory(conversationKey, config, initialConversations);
  const senderName = String(payload.senderName || '').trim().slice(0, 120);
  const messageContext = `${chatType === 'group' && senderName ? `${senderName}: ` : ''}${payload.replyContext ? `[Mensagem citada/respondida: ${String(payload.replyContext).slice(0, 700)}]\n` : ''}${text}`;
  await queueAiHistoryEvent({ eventId: messageId, at: payload.receivedAt || new Date().toISOString(), conversationKey, chatName, chatType, senderName, direction: 'Recebida', message: messageContext, status: 'Recebida', provider: config.provider, model: config.model, details: payload.source || '' });
  await rememberAiUserMessage(conversationKey, messageId, messageContext, payload.receivedAt || new Date().toISOString(), senderName);
  if (chatType === 'group' && operationMode !== AI_OPERATION_MODES.OBSERVE_ONLY) {
    const mode = ['all_messages','reply_or_mention','mention_only','reply_only','keywords'].includes(config.groupReplyMode) ? config.groupReplyMode : 'reply_or_mention';
    let repliedToAssistant = false;
    if (payload.isReply === true && payload.replyContext) {
      // Só uma resposta à mensagem da própria IA aciona os modos de resposta; uma citação entre participantes não deve ativá-la.
      const groupHistory = loadedConversationHistory.slice(-12);
      const lastAssistant = [...groupHistory].reverse().find((item) => item?.role === 'assistant' && String(item.content || '').trim());
      const quoted = normalizeOrderText(payload.replyContext);
      const previousReply = normalizeOrderText(lastAssistant?.content || '');
      const signature = previousReply.slice(0, Math.min(24, previousReply.length));
      repliedToAssistant = signature.length >= 12 && quoted.includes(signature);
    }
    let triggerAllowed = false;
    if (mode === 'all_messages') triggerAllowed = true;
    else if (mode === 'mention_only') triggerAllowed = payload.isMention === true;
    else if (mode === 'reply_only') triggerAllowed = repliedToAssistant;
    else if (mode === 'reply_or_mention') triggerAllowed = payload.isMention === true || repliedToAssistant;
    else if (mode === 'keywords') {
      const keywords = String(config.groupReplyKeywords || '').split(/[\n,;]+/).map((word) => normalizeOrderText(word)).filter(Boolean);
      const normalizedText = normalizeOrderText(text);
      triggerAllowed = keywords.length > 0 && keywords.some((keyword) => normalizedText.includes(keyword));
      if (!keywords.length) return { status: 'group-keywords-empty' };
    }
    if (!triggerAllowed) return { status: 'group-trigger-required' };
  }
  const alreadyHandedOff = (await getOne(AI_HANDOFFS_KEY, [])).some((h) => h.chatKey === conversationKey && h.active === true);
  if (alreadyHandedOff && operationMode !== AI_OPERATION_MODES.OBSERVE_ONLY) return { status: 'human-handoff-active' };
  if (aiInFlight.has(messageId)) return { status: 'duplicate-in-flight' };
  const processed = await getOne(AI_PROCESSED_KEY, []);
  if (processed.includes(messageId)) return { status: 'duplicate' };
  { const nowMs = Date.now(); for (const [k, at] of aiRecentContent) if (nowMs - at > 20000) aiRecentContent.delete(k);
    const contentKey = `${conversationKey}|${senderName}|${normalizeOrderText(text).slice(0, 200)}`;
    if (aiRecentContent.has(contentKey)) return { status: 'duplicate-content' };
    aiRecentContent.set(contentKey, nowMs); }
  aiInFlight.add(messageId);
  await setStore({ [AI_PROCESSED_KEY]: [...processed, messageId].slice(-1000) });
  let rate; try { rate = await consumeAiRateLimit(conversationKey); } catch { aiInFlight.delete(messageId); return { status: 'rate-limit-storage-error' }; }
  if (!rate.allowed) {
    await recordTelemetry('ai.rate_limited', 'whatsapp.ai_support', { success: false, count: 1 });
    if (rate.notify && operationMode !== AI_OPERATION_MODES.OBSERVE_ONLY) { try { await sendToTabEnsured(sender.tab, 'whatsapp', { type: 'AI_SEND_REPLY', payload: { expectedChatName: chatName, chatId: String(payload.chatId || ''), text: 'Recebi várias mensagens em sequência e preciso de um instante para organizar o atendimento. Se precisar de uma pessoa, escreva “atendimento humano”.' } }); } catch { /* falha de envio não altera o limite */ } }
    aiInFlight.delete(messageId); return { status: 'rate-limited' };
  }
  let processingStage = 'validation';
  try {
    if (!config.apiKey || !config.model || !config.providerVerified || !config.businessName || !config.prompt || !config.knowledge) {
      await recordTelemetry('ai.message.skipped_configuration', 'whatsapp.ai_support', { success: false });
      return { status: 'configuration-incomplete' };
    }
    const conversations = await getOne(AI_CONVERSATIONS_KEY, {});
    let history = (loadedConversationHistory.length ? loadedConversationHistory : (Array.isArray(conversations[conversationKey]) ? conversations[conversationKey] : [])).slice(-8);
    const lastHistoryAt = Date.parse(history[history.length - 1]?.at || '');
    if (!Number.isFinite(lastHistoryAt) || Date.now() - lastHistoryAt > 24 * 60 * 60 * 1000) history = [];
    const handoffs = await getOne(AI_HANDOFFS_KEY, []);
    const activeHandoff = handoffs.find((h) => h.chatKey === conversationKey && h.active === true);
    if (activeHandoff && operationMode !== AI_OPERATION_MODES.OBSERVE_ONLY) return { status: 'human-handoff-active' };
    const personaInstructions = personaMode === 'networking' ? [
      'MODO NETWORKING: seu objetivo é criar uma conversa genuína e respeitosa, conhecer a atuação profissional, os projetos e os interesses da pessoa. Não transforme relatos pessoais em oportunidade comercial.',
      'Não ofereça serviços, não pergunte orçamento e não faça prospecção comercial, a menos que a pessoa pergunte diretamente sobre serviços ou demonstre interesse explícito. Faça perguntas de forma leve, uma por vez, e também responda ao conteúdo que a pessoa compartilhou.',
      'Para a análise de CRM, nunca marque qualification.isQualified=true. Registre apenas dados profissionais úteis (nicho, subnicho, atividade, empresa e interesses profissionais) quando houver evidência clara. Não registre como resumo comercial relatos íntimos, saúde, finanças pessoais, conflitos ou vulnerabilidades.',
      'Não crie pedidos neste modo. Preserve transparência: não invente experiências pessoais nem finja ser humano. Se perguntarem, diga que é um assistente virtual.',
    ] : personaMode === 'self_knowledge' ? [
      'MODO AUTOCONHECIMENTO: priorize escuta, acolhimento e reflexão, sem diagnosticar, prescrever tratamentos ou se apresentar como profissional de saúde. Reconheça o que a pessoa disse sem presumir emoções e faça uma pergunta gentil por vez.',
      'Não venda, não faça prospecção, não pergunte orçamento e não use vulnerabilidades como oportunidade comercial. Não invente vivências pessoais nem finja ser humano. Respeite limites e não pressione a pessoa a continuar.',
      'Neste modo, qualification.isQualified deve ser false e shouldCreateOrder deve ser false. Não inclua relatos pessoais, emoções, saúde, dependência, finanças pessoais ou conflitos no resumo de CRM; a extensão não deve gravar reflexões pessoais no card do CRM.',
      'Se houver risco imediato de autoagressão, violência ou perigo, responda com cuidado e incentive a pessoa a buscar imediatamente alguém de confiança e serviços de emergência locais. Não trate uma partilha emocional comum como pedido de atendimento comercial.',
    ] : [
      'MODO COMERCIAL CONSULTIVO: construa confiança e entenda a necessidade antes de falar sobre oferta. Avalie necessidade, interesse, orçamento quando apropriado, prazo e próximo passo sem pressionar.',
      'Considere qualificado apenas quando houver sinais concretos de necessidade e intenção comercial; não marque como qualificado por uma saudação, curiosidade genérica ou resposta ambígua.',
      `Critérios de qualificação definidos pela empresa:\n${config.qualificationCriteria || 'Necessidade clara, interesse real, orçamento, prazo e intenção de avançar.'}`,
      config.sheetId && config.sheetsVerified && config.sellerPhone ? 'Se houver intenção explícita de compra/contratação e os dados necessários, você pode marcar shouldCreateOrder=true.' : 'Não tente registrar pedidos nem afirme que algo foi registrado; concentre-se no atendimento e na qualificação.',
    ];
    const memoryContext = buildAiConversationMemoryPrompt(config.conversationMemory?.[conversationKey], personaMode);
    const system = operationMode === AI_OPERATION_MODES.OBSERVE_ONLY
      ? buildAiObserverSystemPrompt({ personaMode, businessName: config.businessName, prompt: config.prompt, knowledge: config.knowledge, qualificationCriteria: config.qualificationCriteria, memoryContext })
      : [
      `Você é o assistente do perfil “${config.activePersonaName || 'Atendimento'}”, vinculado a ${config.businessName || 'Minha empresa'}.`,
      memoryContext,
      'Responda em português brasileiro, com clareza, naturalidade, educação e mensagens concisas. Evite soar robótico ou bajulador.',
      'Leia o histórico recente antes de responder. Considere o que já foi perguntado, respondido, esclarecido ou prometido; não repita perguntas já respondidas e não trate a mensagem atual como se fosse isolada.',
      chatType === 'group' ? 'Você está em um grupo. Responda apenas à interação que acionou você, sem divulgar dados privados, sem assumir que fala por todos e sem monopolizar a conversa.' : 'Você está em uma conversa privada.',
      'Use somente informações fornecidas e aprovadas. Nunca invente preço, disponibilidade, prazo, desconto, estoque, aprovação, experiência pessoal ou promessa de resultado.',
      ...personaInstructions,
      'Retorne SOMENTE um objeto JSON válido com as chaves: reply (string), shouldCreateOrder (boolean), handoffToHuman (boolean), handoffReason (string), order (objeto com customerName, customerPhone, company, service, details), missingFields (array de strings), qualification (objeto com isQualified boolean, confidence número de 0 a 1, status, reason, summary, exactRequest, company, need, service, segment, intent, budget, budgetStatus, timeframe, decisionMaker, objection, evidence (array), missingFields (array) e nextStep).',
      'O campo qualification.status deve ser exatamente um destes valores: qualified, nurture, in_qualification ou not_qualified. Em networking e autoconhecimento, use isQualified=false e status in_qualification; nunca trate conversa amigável ou partilha pessoal como qualificação comercial. No modo comercial, use qualified somente quando os critérios comerciais estiverem comprovados.',
      'Registre exactRequest como síntese fiel do pedido explícito, sem inventar intenções. Registre evidence com fatos curtos. Preserve dados já fornecidos no histórico. Nunca invente orçamento, prazo ou autoridade de decisão.',
      'Inclua qualification.nicheClassification com primaryNiche, path, subniches, tags, confidence (0 a 1) e evidence. Use profissões, segmento, especialidade e público atendido sustentados pela conversa; não confunda profissão com assunto mencionado. Se não houver evidência, deixe path e tags vazios e use confidence abaixo de 0.65.',
      'Defina handoffToHuman=true quando a pessoa pedir atendimento humano ou houver uma situação que exija intervenção humana segura. Não diga que alguém foi avisado antes da confirmação do envio. Em networking ou autoconhecimento, não encaminhe automaticamente uma partilha pessoal comum como lead comercial.',
      personaMode !== 'commercial' ? 'shouldCreateOrder deve ser false neste perfil.' : '',
      config.welcomeMessage ? `Mensagem inicial preferida: ${config.welcomeMessage}. Use-a naturalmente no início quando fizer sentido; não a repita em toda mensagem.` : '',
      `Instruções deste perfil:\n${config.prompt || ''}`,
      `Base de conhecimento aprovada para este perfil:\n${config.knowledge || ''}`,
      senderName ? `Pessoa que enviou a mensagem no grupo: ${senderName}` : '',
    ].join('\n\n');
    const messages = [...history, { role: 'user', content: messageContext }];
    if (!history.length) await recordTelemetry('ai.conversation.started', 'whatsapp.ai_support', { success: true, count: 1 });
    processingStage = 'provider';
    const explicitHumanRequest = /\b(falar com (uma )?(pessoa|humano|atendente)|quero falar com|atendimento humano|atendente real|falar com alguém|falar com alguem)\b/i.test(text);
    const providerResult = operationMode !== AI_OPERATION_MODES.OBSERVE_ONLY && explicitHumanRequest
      ? { text: JSON.stringify({ reply: 'Vou encaminhar você para uma pessoa da nossa equipe.', shouldCreateOrder: false, handoffToHuman: true, handoffReason: 'Cliente solicitou atendimento humano', order: {}, missingFields: [], qualification: { isQualified: false, confidence: 0 } }), provider: config.provider, model: config.model, fallbackUsed: false }
      : await callAiProviderWithFallback(config, messages, system);
    await setStore({ aiSupportLastProvider: { provider: providerResult.provider, model: providerResult.model, fallbackUsed: providerResult.fallbackUsed === true, at: new Date().toISOString() } });
    if (providerResult.fallbackUsed) await recordTelemetry('ai.provider.fallback_used', 'whatsapp.ai_support', { success: true, provider: providerResult.provider, model: providerResult.model });
    const decision = parseAiDecision(providerResult.text);
    processingStage = 'model_done';
    await updateAiConversationMemory(conversationKey, decision.qualification || {}, personaMode).catch(() => false);
    if (operationMode === AI_OPERATION_MODES.OBSERVE_ONLY) {
      let observerDecision = decision;
      if (personaMode === 'networking') {
        const source = decision.qualification || {};
        const niche = source.nicheClassification && typeof source.nicheClassification === 'object' ? source.nicheClassification : {};
        observerDecision = { ...decision, shouldCreateOrder: false, handoffToHuman: false, qualification: {
          ...source, isQualified: false, confidence: Math.min(0.5, Number(source.confidence) || 0), status: 'in_qualification',
          nicheClassification: { primaryNiche: niche.primaryNiche || '', path: Array.isArray(niche.path) ? niche.path : [], subniches: Array.isArray(niche.subniches) ? niche.subniches : [], tags: Array.isArray(niche.tags) ? niche.tags : [], confidence: Number(niche.confidence) || 0, evidence: Array.isArray(niche.evidence) ? niche.evidence : [] },
        } };
      }
      const intelligenceResult = await applyAiLeadQualification(
        { ...payload, chatType, chatName, senderName }, config, observerDecision, providerResult,
        { mode: AI_OPERATION_MODES.OBSERVE_ONLY },
      );
      const updatedFields = Array.isArray(intelligenceResult.updatedFields) ? intelligenceResult.updatedFields : [];
      const observedStatus = intelligenceResult.applied && updatedFields.length ? 'observed' : 'observer-no-change';
      await recordTelemetry('ai.observer.analysis_completed', 'ai.mode.observe_only', { success: intelligenceResult.applied === true, count: 1, updatedFields: updatedFields.length });
      if (intelligenceResult.applied && updatedFields.length) {
        await recordTelemetry('ai.observer.crm_updated', 'ai.mode.observe_only', { success: true, count: 1, updatedFields: updatedFields.length });
      }
      await setStore({ aiSupportLastActivityAt: new Date().toISOString() });
      return {
        status: observedStatus, observerOnly: true, operationMode, updatedFields,
        qualificationStatus: intelligenceResult.status || '', confidence: Number(decision.qualification?.confidence) || 0,
        qualified: intelligenceResult.qualified === true, niche: String(decision.qualification?.nicheClassification?.primaryNiche || decision.qualification?.segment || '').slice(0, 100),
        personaId: config.activePersonaId || 'global', personaName: config.activePersonaName || 'Perfil global', personaMode,
        provider: providerResult.provider || config.provider, model: providerResult.model || config.model,
        reason: intelligenceResult.reason || '',
      };
    }
    let reply = decision.reply || 'Obrigado pela mensagem. Vou encaminhar sua dúvida para o responsável comercial.';
    let orderRecord = null;
    try {
      if (personaMode !== 'self_knowledge' && config.recordLeadIntelligence !== false) {
        let crmDecision = decision;
        if (personaMode === 'networking') {
          const source = decision.qualification || {};
          const niche = source.nicheClassification && typeof source.nicheClassification === 'object' ? source.nicheClassification : {};
          crmDecision = { ...decision, shouldCreateOrder: false, qualification: {
            isQualified: false, confidence: Math.min(0.5, Number(source.confidence) || 0), status: 'in_qualification',
            company: source.company || '', service: source.service || '', segment: source.segment || '',
            nicheClassification: { primaryNiche: niche.primaryNiche || '', path: Array.isArray(niche.path) ? niche.path : [], subniches: Array.isArray(niche.subniches) ? niche.subniches : [], tags: Array.isArray(niche.tags) ? niche.tags : [], confidence: Number(niche.confidence) || 0, evidence: Array.isArray(niche.evidence) ? niche.evidence : [] },
          } };
        }
        const intelligenceResult = await applyAiLeadQualification({ ...payload, chatType, chatName, senderName }, config, crmDecision, providerResult);
        if (intelligenceResult.applied && intelligenceResult.stageUpdated) {
          await recordTelemetry('ai.lead.stage_updated', 'whatsapp.ai_support', { success: true, stageCategory: stageCategory(intelligenceResult.stage), provider: providerResult.provider });
        }
      }
    } catch (qualificationError) {
      saveSystemLog({ module: 'ai-chat', action: 'LEAD_INTELLIGENCE_FAILED', status: 'error', message: 'A resposta da IA foi gerada, mas a atualização da inteligência comercial no CRM falhou.', data: { error: safeLogText(qualificationError?.message || String(qualificationError), 180) } });
      await recordTelemetry('ai.lead.intelligence_failed', 'whatsapp.ai_support', { success: false, provider: providerResult.provider });
    }
    if (decision.handoffToHuman) {
      const handoff = { id: uid('handoff'), chatKey: conversationKey, chatName, phoneTail: normalizePhoneSafe(payload.senderPhone || payload.phone).slice(-4), reason: decision.handoffReason || 'Solicitação encaminhada para atendimento humano', active: true, createdAt: new Date().toISOString() };
      const notice = `ATENDIMENTO HUMANO SOLICITADO\nContato: ${chatName}\nTelefone final: ${handoff.phoneTail || 'não detectado'}\nMotivo: ${handoff.reason}\nAcesse o WhatsApp Web para dar continuidade.`;
      try {
        if (!config.sellerPhone || config.sellerPhone.length < 10) throw new Error('Nenhum número de responsável foi configurado.');
        const notified = await sendToTabEnsured(sender.tab, 'whatsapp', { type: 'AI_SEND_TO_PHONE', payload: { phone: config.sellerPhone, text: notice } });
        if (!notified?.success) throw new Error('Notificação ao responsável não confirmada.');
        handoff.notifiedAt = new Date().toISOString(); handoff.notificationStatus = 'sent';
        reply = 'Vou encaminhar você para uma pessoa da nossa equipe, que dará continuidade ao atendimento assim que possível.';
        await recordTelemetry('ai.handoff.created', 'whatsapp.ai_support.human_handoff', { success: true, count: 1 });
      } catch {
        handoff.notificationStatus = 'pending';
        reply = 'Vou encaminhar seu atendimento para uma pessoa da equipe. No momento, o aviso interno não pôde ser confirmado; a equipe precisa verificar esta conversa.';
        await recordTelemetry('ai.handoff.notification_failed', 'whatsapp.ai_support.human_handoff', { success: false });
      }
      handoffs.unshift(handoff); await setStore({ [AI_HANDOFFS_KEY]: handoffs.slice(0, 200) });
    }
    if (personaMode === 'commercial' && !decision.handoffToHuman && decision.shouldCreateOrder && config.sheetId && config.sheetsVerified && config.sellerPhone) {
      const order = decision.order || {};
      const service = String(order.service || '').trim().slice(0, 180);
      const details = String(order.details || '').trim().slice(0, 1800);
      if (!service || !details) {
        reply = 'Para registrar corretamente seu pedido, me informe qual serviço você deseja e os principais detalhes da solicitação.';
      } else {
        const existingOrders = await getOne(AI_ORDERS_KEY, []);
        const serviceKey = normalizeOrderText(service);
        const detailsKey = normalizeOrderText(details);
        const duplicate = existingOrders.find((o) => o.chatKey === conversationKey && ['awaiting_approval','approved','in_progress','error'].includes(o.status) && (Date.now() - Date.parse(o.createdAt || '') < 15 * 60 * 1000) && normalizeOrderText(o.service) === serviceKey && normalizeOrderText(o.details) === detailsKey);
        if (duplicate) {
          if (duplicate.status === 'error' || duplicate.sheetRecorded === false) reply = `Já recebi essa solicitação sob o identificador ${duplicate.id}, mas a sincronização com a planilha continua pendente. Não criei outro pedido; a equipe precisa concluir a tentativa de registro.`;
          else { const duplicateStatus = duplicate.status === 'approved' ? 'aprovado' : duplicate.status === 'in_progress' ? 'em atendimento' : duplicate.status === 'closed_won' ? 'venda fechada' : 'aguardando análise'; reply = `Já registrei essa solicitação como ${duplicate.id}. O status atual é “${duplicateStatus}”, então não criei outro pedido para evitar duplicidade.`; }
          await recordTelemetry('ai.order.duplicate_prevented', 'whatsapp.ai_support.order_capture', { success: true, count: 1 });
        } else {
          const orderId = `PED-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
          orderRecord = { id: orderId, createdAt: new Date().toISOString(), customerName: String(order.customerName || chatName).slice(0, 180), customerPhone: normalizePhoneSafe(order.customerPhone || payload.phone), company: String(order.company || '').slice(0, 180), service, details, status: 'awaiting_approval', chatKey: conversationKey, sellerNotificationStatus: 'pending' };
          let appended;
          processingStage = 'order_sheet';
          try { appended = await appendAiOrder(config, orderRecord); orderRecord.sheetRange = appended.updatedRange; orderRecord.sheetRecorded = true; }
          catch (error) {
            orderRecord.status = 'error'; orderRecord.sheetRecorded = false; orderRecord.sheetError = String(error?.message || error).slice(0, 200);
            const pendingOrders = await getOne(AI_ORDERS_KEY, []); pendingOrders.unshift(orderRecord); await setStore({ [AI_ORDERS_KEY]: pendingOrders.slice(0, 300) });
            await recordTelemetry('ai.order.sheet_write_failed', 'whatsapp.ai_support.google_sheets', { success: false });
            try {
              const notice = `PEDIDO PENDENTE DE SINCRONIZAÇÃO\nPedido: ${orderRecord.id}\nCliente: ${orderRecord.customerName}\nServiço: ${orderRecord.service}\nDetalhes: ${orderRecord.details.slice(0, 500)}\nA gravação no Google Sheets falhou. O pedido está salvo localmente para nova tentativa; confira o painel da extensão.`;
              const sellerResult = await sendToTabEnsured(sender.tab, 'whatsapp', { type: 'AI_SEND_TO_PHONE', payload: { phone: config.sellerPhone, text: notice } });
              if (sellerResult?.success) { orderRecord.sellerNotificationStatus = 'sent_pending_sheet'; orderRecord.sellerNotifiedAt = new Date().toISOString(); }
            } catch { orderRecord.sellerNotificationStatus = 'pending'; }
            const pendingLatest = await getOne(AI_ORDERS_KEY, []); const pendingIndex = pendingLatest.findIndex((x) => x.id === orderRecord.id); if (pendingIndex >= 0) pendingLatest[pendingIndex] = orderRecord; await setStore({ [AI_ORDERS_KEY]: pendingLatest });
            reply = orderRecord.sellerNotificationStatus === 'sent_pending_sheet' ? `Não consegui confirmar a gravação do pedido ${orderRecord.id} na planilha. Avisei o responsável que a sincronização está pendente; o pedido ficou salvo localmente para nova tentativa. Não precisa enviar novamente.` : `Não consegui confirmar a gravação do pedido ${orderRecord.id} na planilha. A solicitação ficou salva localmente para nova tentativa, mas o aviso ao responsável também está pendente. Não precisa enviar novamente.`;
          }
          if (orderRecord?.sheetRecorded) {
            const orders = await getOne(AI_ORDERS_KEY, []); orders.unshift(orderRecord); await setStore({ [AI_ORDERS_KEY]: orders.slice(0, 300) });
            await recordTelemetry('ai.order.recorded', 'whatsapp.ai_support.order_capture', { success: true, count: 1 });
            const sellerText = `NOVO PEDIDO — AGUARDANDO ANÁLISE\nPedido: ${orderRecord.id}\nCliente: ${orderRecord.customerName}\nServiço: ${orderRecord.service}\nDetalhes: ${orderRecord.details.slice(0, 600)}\nStatus: Aguardando análise humana.\nO pedido foi registrado na planilha Google Sheets.`;
            try {
              const sellerResult = await sendToTabEnsured(sender.tab, 'whatsapp', { type: 'AI_SEND_TO_PHONE', payload: { phone: config.sellerPhone, text: sellerText } });
              if (!sellerResult?.success) throw new Error(sellerResult?.error || 'O WhatsApp não confirmou a notificação.');
              orderRecord.sellerNotificationStatus = 'sent'; orderRecord.sellerNotifiedAt = new Date().toISOString();
              await recordTelemetry('ai.seller_notification.sent', 'whatsapp.ai_support', { success: true });
              reply = `Obrigado! Seu pedido ${orderRecord.id} foi registrado e encaminhado ao responsável comercial. Ele está aguardando análise humana, e a equipe dará continuidade ao atendimento.`;
            } catch {
              orderRecord.sellerNotificationStatus = 'pending';
              reply = `Seu pedido ${orderRecord.id} foi registrado na planilha, mas o aviso ao responsável está pendente por uma instabilidade do WhatsApp Web. Não precisa enviar novamente; a equipe precisará conferir o encaminhamento.`;
              await recordTelemetry('ai.seller_notification.failed', 'whatsapp.ai_support', { success: false });
            }
            const latest = await getOne(AI_ORDERS_KEY, []); const index = latest.findIndex((x) => x.id === orderRecord.id); if (index >= 0) latest[index] = orderRecord; await setStore({ [AI_ORDERS_KEY]: latest });
          }
        }
      }
    }
    // Pausa configurável para que a resposta não seja enviada instantaneamente; não falsifica um indicador humano de digitação.
    const replyDelayMs = Math.round(Math.max(0, Math.min(10, Number(config.replyDelaySeconds ?? 1.5))) * 1000);
    if (replyDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, replyDelayMs));
    const sendResult = await sendToTabEnsured(sender.tab, 'whatsapp', { type: 'AI_SEND_REPLY', payload: { expectedChatName: chatName, chatId: String(payload.chatId || ''), text: String(reply).slice(0, 2500) } });
    if (!sendResult?.success) await recordTelemetry('ai.reply.send_failed', 'whatsapp.ai_support', { success: false });
    else await recordTelemetry('ai.reply.sent', 'whatsapp.ai_support', { success: true });
    processingStage = 'customer_reply';
    conversations[conversationKey] = [...history, { role: 'user', content: messageContext, at: payload.receivedAt || new Date().toISOString(), senderName: senderName || '', messageId }, { role: 'assistant', content: String(reply).slice(0, 1500), at: new Date().toISOString(), messageId: `${messageId}:assistant` }].slice(-12);
    await setStore({ [AI_CONVERSATIONS_KEY]: conversations, aiSupportLastActivityAt: new Date().toISOString() });
    await queueAiHistoryEvent({ eventId: `${messageId}:assistant`, at: new Date().toISOString(), conversationKey, chatName, chatType, senderName: 'i9Hub IA', direction: 'Resposta IA', message: String(reply).slice(0, 2500), status: sendResult?.success ? 'Enviada' : 'Falha no envio', provider: providerResult.provider, model: providerResult.model, details: sendResult?.success ? '' : String(sendResult?.error || 'O WhatsApp não confirmou o envio').slice(0, 180) });
    await recordTelemetry('ai.conversation.message_processed', 'whatsapp.ai_support', { success: !!sendResult?.success, count: 1 });
    const monitorQualification = decision.qualification && typeof decision.qualification === 'object' ? decision.qualification : {};
    const monitorConfidence = Number(monitorQualification.confidence);
    const rawMonitorStatus = ['qualified', 'nurture', 'in_qualification', 'not_qualified'].includes(String(monitorQualification.status || '')) ? String(monitorQualification.status) : '';
    const monitorThreshold = Number.isFinite(Number(config.qualificationThreshold)) ? Number(config.qualificationThreshold) : 0.8;
    const monitorQualified = personaMode === 'commercial' && config.qualificationEnabled !== false
      && monitorQualification.isQualified === true && !['nurture', 'not_qualified'].includes(rawMonitorStatus)
      && Number.isFinite(monitorConfidence) && monitorConfidence >= monitorThreshold;
    const monitorNicheData = monitorQualification.nicheClassification && typeof monitorQualification.nicheClassification === 'object' ? monitorQualification.nicheClassification : {};
    const monitorNiche = Array.isArray(monitorNicheData.path) && monitorNicheData.path.length
      ? monitorNicheData.path.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 4).join(' > ')
      : String(monitorNicheData.primaryNiche || monitorQualification.segment || '').slice(0, 100);
    const hasClassificationEvidence = !!(monitorNiche || monitorQualification.summary || monitorQualification.exactRequest || monitorQualification.need || monitorQualification.service || monitorQualification.intent || monitorQualification.budget || monitorQualification.reason || (Array.isArray(monitorQualification.evidence) && monitorQualification.evidence.length));
    const monitorStatus = !hasClassificationEvidence ? '' : monitorQualified ? 'qualified' : rawMonitorStatus === 'qualified' ? 'in_qualification' : rawMonitorStatus;
    return { status: sendResult?.success ? 'processed' : 'reply-pending', orderId: orderRecord?.id || '', qualificationStatus: monitorStatus, confidence: Number.isFinite(monitorConfidence) ? monitorConfidence : null, qualified: monitorQualified, niche: monitorNiche, personaId: config.activePersonaId || 'global', personaName: config.activePersonaName || 'Perfil global', personaMode, provider: providerResult.provider || config.provider, model: providerResult.model || config.model, error: sendResult?.success ? '' : String(sendResult?.error || 'O WhatsApp não confirmou o envio da resposta.').slice(0, 220) };
  } catch (error) {
    saveSystemLog({ module: 'ai-support', action: 'AI_MESSAGE_PROCESSING_FAILED', status: 'error', message: safeLogText(error?.message || String(error), 240), data: { provider: config.provider, extVersion: EXT_VERSION, stage: processingStage } });
    await setStore({ aiSupportLastProcessingStatus: { status: 'error', at: new Date().toISOString(), chatName, chatType, error: String(error?.message || error).slice(0, 180) } });
    await queueAiHistoryEvent({ eventId: `${messageId}:error`, at: new Date().toISOString(), conversationKey: aiChatHash(payload.chatRef || payload.phone || chatName), chatName, chatType, senderName: String(payload.senderName || ''), direction: 'Sistema', message: '', status: 'Erro', provider: config.provider, model: config.model, details: String(error?.message || error).slice(0, 240) });
    await recordTelemetry('ai.message.processing_failed', 'whatsapp.ai_support', { success: false, provider: config.provider });
    // Se o provedor falhar, tenta encaminhar a conversa para uma pessoa e nunca afirma que um pedido foi registrado.
    if (operationMode !== AI_OPERATION_MODES.OBSERVE_ONLY && processingStage === 'provider' && sender?.tab?.id && chatName) {
      const conversationKey = aiChatHash(payload.chatRef || payload.phone || chatName);
      const handoffs = await getOne(AI_HANDOFFS_KEY, []);
      const existingHandoff = handoffs.find((h) => h.chatKey === conversationKey && h.active);
      let humanNotificationSent = existingHandoff?.notificationStatus === 'sent';
      if (!existingHandoff) {
        const handoff = { id: uid('handoff'), chatKey: conversationKey, chatName, phoneTail: normalizePhoneSafe(payload.senderPhone || payload.phone).slice(-4), reason: 'Atendimento automático indisponível; precisa de revisão humana', active: true, createdAt: new Date().toISOString(), notificationStatus: 'pending' };
        try {
          const notice = `ATENDIMENTO IA INDISPONÍVEL\nContato: ${chatName}\nTelefone final: ${handoff.phoneTail || 'não detectado'}\nMotivo: o provedor de IA falhou. Confira a conversa no WhatsApp Web.`;
          const notified = config.sellerPhone ? await sendToTabEnsured(sender.tab, 'whatsapp', { type: 'AI_SEND_TO_PHONE', payload: { phone: config.sellerPhone, text: notice } }) : { success: false };
          if (notified?.success) { handoff.notificationStatus = 'sent'; handoff.notifiedAt = new Date().toISOString(); humanNotificationSent = true; }
        } catch { /* registro local permanece pendente */ }
        handoffs.unshift(handoff); await setStore({ [AI_HANDOFFS_KEY]: handoffs.slice(0, 200) });
      }
      try { const fallbackText = 'No momento não consegui concluir a resposta automática. ' + (humanNotificationSent ? 'Avisei o responsável para verificar a conversa.' : 'O aviso interno também está pendente, então a equipe precisa conferir a conversa no painel.') + ' Não envie os dados novamente enquanto o atendimento é conferido.'; await sendToTabEnsured(sender.tab, 'whatsapp', { type: 'AI_SEND_REPLY', payload: { expectedChatName: chatName, text: fallbackText } }); } catch { /* não há como garantir envio se o chat mudou */ }
    }
    return { status: 'error', error: String(error?.message || error).slice(0, 220), personaId: config.activePersonaId || 'global', personaName: config.activePersonaName || 'Perfil global', personaMode: config.personaMode || 'commercial', provider: config.provider, model: config.model };
  } finally { aiInFlight.delete(messageId); }
}
async function safeRecordActionTelemetry(type, payload, result) {
  if (/^(GET_LICENSE_STATUS|GET_USAGE_STATUS|GET_FEATURE_CATALOG|GET_LICENSE_LINK|TELEMETRY_|ADMIN_GET_CONFIG|ADMIN_REFRESH_CONFIG|AI_HEARTBEAT|TRACK_TELEMETRY_EVENT|LOG)/.test(type)) return;
  const featureId = ACTION_REQUIRED_FEATURES[type]?.[0] || ACTION_FEATURE_MAP[type] || '';
  const metadata = { success: result?.success === true, code: String(result?.code || '').slice(0, 60) };
  if (Array.isArray(payload?.leads)) metadata.count = payload.leads.length;
  if (Array.isArray(payload?.leadIds)) metadata.count = payload.leadIds.length;
  if (Array.isArray(payload?.contacts)) metadata.count = payload.contacts.length;
  if (Array.isArray(result?.data)) metadata.count = result.data.length;
  if (result?.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
    for (const key of ['added','updated','total','sent','failed','count']) if (Number.isFinite(Number(result.data[key]))) metadata[key] = Number(result.data[key]);
  }
  if (type === 'UPDATE_LEAD_STAGE') metadata.stageCategory = stageCategory(payload?.stage);
  const name = type === 'SAVE_LEADS' ? 'crm.leads.saved' : type === 'UPDATE_LEAD_STAGE' ? 'crm.stage.changed' : type === 'GET_AWAITING_REPLIES' ? 'whatsapp.awaiting_reply.snapshot' : `extension.action.${String(type).toLowerCase()}`;
  await recordTelemetry(name, featureId, metadata);
}



// ---------------------------------------------------------------------------
// v1.2.8 — Follow-up programado e relacionamento automático (local-first)
// ---------------------------------------------------------------------------
const FOLLOWUP_MAX_RECORDS = 2000;
const FOLLOWUP_MAX_ALARM_LAG_MS = 15 * 60 * 1000;
const FOLLOWUP_DEFAULT_TEMPLATES = Object.freeze([
  { id: 'followup_proposal', name: 'Retomar proposta', message: 'Olá, {{nome}}! Conseguiu avaliar a proposta que conversamos? Se tiver alguma dúvida, fico à disposição para ajudar.' },
  { id: 'followup_interest', name: 'Retomar interesse', message: 'Olá, {{nome}}! Passando para saber se ainda faz sentido conversarmos sobre {{servico}}. Posso ajudar com alguma informação?' },
  { id: 'followup_schedule', name: 'Confirmar disponibilidade', message: 'Olá, {{nome}}! Gostaria de combinar o melhor momento para darmos continuidade à nossa conversa. Qual horário fica melhor para você?' },
]);
const followupInFlight = new Set();
let followupMutationQueue = Promise.resolve();

function withFollowupMutation(task) {
  const next = followupMutationQueue.then(task, task);
  followupMutationQueue = next.catch(() => {});
  return next;
}
async function getFollowupsInternal() {
  const value = await getOne(K.FOLLOWUPS, []);
  return Array.isArray(value) ? value : [];
}
async function putFollowupsInternal(items) {
  await setStore({ [K.FOLLOWUPS]: (Array.isArray(items) ? items : []).slice(-FOLLOWUP_MAX_RECORDS) });
}
async function getFollowupSettingsInternal() {
  return normalizeFollowupSettings(await getOne(K.FOLLOWUP_SETTINGS, {}));
}
async function getFollowupTemplatesInternal() {
  const saved = await getOne(K.FOLLOWUP_TEMPLATES, null);
  const list = Array.isArray(saved) ? saved : [...FOLLOWUP_DEFAULT_TEMPLATES];
  return list.slice(0, 30).map((item) => ({
    id: String(item?.id || uid('template')).slice(0, 100),
    name: String(item?.name || '').trim().slice(0, 80),
    message: String(item?.message || '').trim().slice(0, FOLLOWUP_MAX_MESSAGE_LENGTH),
  })).filter((item) => item.name && item.message);
}
async function appendFollowupActivity(leadIdValue, followup, type, title, description) {
  const leads = await getLeads();
  const lead = leads.find((item) => String(leadId(item)) === String(leadIdValue));
  if (!lead) return;
  appendCrmActivity(lead, {
    id: `followup_activity_${followup.id}_${type}`,
    type: `followup.${type}`,
    title,
    description,
    actor: 'i9Hub',
    source: 'automation',
    createdAt: new Date().toISOString(),
    metadata: { followupId: followup.id, sequenceId: followup.sequenceId || '', status: followup.status },
  });
  await putLeads(leads);
}
async function clearFollowupAlarm(id) {
  const name = followupAlarmName(id);
  if (name) await chrome.alarms.clear(name).catch(() => {});
}
async function scheduleFollowupAlarm(item) {
  const when = Date.parse(item?.scheduledAt || '');
  const name = followupAlarmName(item?.id);
  if (!name || !Number.isFinite(when)) throw new Error('Agendamento inválido.');
  await chrome.alarms.create(name, { when: Math.max(Date.now() + 30_000, when) });
}
async function reconcilePendingFollowups() {
  return withFollowupMutation(async () => {
    const items = await getFollowupsInternal();
    const now = Date.now();
    let changed = false;
    for (const item of items) {
      if (item?.status !== FOLLOWUP_STATUS.SCHEDULED) continue;
      const at = Date.parse(item.scheduledAt || '');
      if (!Number.isFinite(at) || at <= now) {
        item.status = FOLLOWUP_STATUS.OVERDUE;
        item.overdueAt = new Date(now).toISOString();
        item.lastError = 'O horário programado passou enquanto a extensão estava indisponível. O envio automático não foi realizado; revise e envie ou reagende manualmente.';
        await clearFollowupAlarm(item.id);
        changed = true;
      } else {
        await scheduleFollowupAlarm(item).catch(() => {});
      }
    }
    if (changed) await putFollowupsInternal(items);
    return { reconciled: changed };
  });
}
function normalizeFollowupPhone(value) {
  let digits = String(value || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : '';
}
async function getFollowupConsentForPhone(phone) {
  const tail = phoneTail(phone);
  if (!tail) return null;
  const all = await getOne(K.FOLLOWUP_CONSENT, {});
  return all && typeof all === 'object' ? (all[tail] || null) : null;
}
async function setFollowupConsentForPhone(phone) {
  const tail = phoneTail(phone);
  if (!tail) return false;
  const all = await getOne(K.FOLLOWUP_CONSENT, {});
  const next = all && typeof all === 'object' ? all : {};
  next[tail] = {
    phone: normWaPhone(phone),
    status: CONSENT_STATUS_OPTED_IN,
    scope: 'followup_only',
    source: 'manual',
    updatedAt: new Date().toISOString(),
    note: 'Operador confirmou possuir autorização específica para este follow-up.',
  };
  await setStore({ [K.FOLLOWUP_CONSENT]: next });
  return true;
}
async function ensureFollowupConsent(phone, confirmed) {
  const globalConsent = await getConsentForPhone(phone);
  if (globalConsent?.status === CONSENT_STATUS_OPTED_OUT) {
    return { allowed: false, code: 'CONSENT_REVOKED', error: 'Este contato solicitou o descadastro. Não é possível agendar follow-ups para ele.' };
  }
  if (globalConsent?.status === CONSENT_STATUS_OPTED_IN) return { allowed: true, consent: globalConsent };
  const scopedConsent = await getFollowupConsentForPhone(phone);
  if (scopedConsent?.status === CONSENT_STATUS_OPTED_IN && scopedConsent.scope === 'followup_only') return { allowed: true, consent: scopedConsent };
  if (confirmed !== true) {
    return { allowed: false, code: 'CONSENT_REQUIRED', error: 'Confirme que possui autorização específica para este follow-up. A confirmação ficará limitada ao módulo de follow-up e não liberará campanhas.' };
  }
  await setFollowupConsentForPhone(phone);
  return { allowed: true, consent: await getFollowupConsentForPhone(phone), newlyRecorded: true };
}
async function createFollowupSequence(payload = {}, isSequence = false) {
  return withFollowupMutation(async () => {
    const id = String(payload.leadId || '');
    const leads = await getLeads();
    const lead = leads.find((item) => String(leadId(item)) === id);
    if (!lead) return { success: false, error: 'Lead não encontrado.' };
    const phone = normalizeFollowupPhone(payload.phone || lead.phone);
    if (!phone) return { success: false, error: 'Este lead não possui um telefone válido para WhatsApp.' };
    if (normalizeType(lead.tipo) === 'spam' || lead.blacklisted) return { success: false, code: 'CONTACT_BLOCKED', error: 'Este contato está classificado como spam ou bloqueado.' };
    const blacklisted = await blacklistTails();
    if (blacklisted.has(phoneTail(phone))) return { success: false, code: 'CONTACT_BLOCKED', error: 'Este contato está na Black list.' };
    const stepsInput = Array.isArray(payload.steps) ? payload.steps : [];
    if (!stepsInput.length || stepsInput.length > FOLLOWUP_MAX_STEPS) return { success: false, error: `Informe de 1 a ${FOLLOWUP_MAX_STEPS} etapas.` };
    if (isSequence && stepsInput.length < 2) return { success: false, error: 'Uma sequência precisa ter pelo menos duas etapas.' };
    const now = Date.now();
    let normalizedSteps;
    try {
      normalizedSteps = stepsInput.map((step) => {
        const normalized = normalizeFollowupStep(step, now);
        const message = renderFollowupTemplate(normalized.messageTemplate, lead);
        if (!message) throw new Error('A mensagem ficou vazia após substituir os dados do lead.');
        return { ...normalized, message };
      });
    } catch (error) {
      return { success: false, error: String(error?.message || error).slice(0, 240) };
    }
    const consent = await ensureFollowupConsent(phone, payload.consentConfirmed === true);
    if (!consent.allowed) return { success: false, code: consent.code, error: consent.error };

    const existing = await getFollowupsInternal();
    if (existing.filter((item) => item.status === FOLLOWUP_STATUS.SCHEDULED && String(item.leadId) === id).length + normalizedSteps.length > 20) {
      return { success: false, code: 'FOLLOWUP_LIMIT', error: 'Este lead já possui muitos follow-ups pendentes. Revise os agendamentos antes de adicionar outros.' };
    }
    if (existing.length + normalizedSteps.length > FOLLOWUP_MAX_RECORDS) {
      return { success: false, code: 'FOLLOWUP_STORAGE_LIMIT', error: 'O histórico local de follow-ups atingiu o limite. Exclua registros concluídos antes de continuar.' };
    }

    const sequenceId = uid('followup_seq');
    const createdAt = new Date(now).toISOString();
    const cancelOnReply = payload.cancelOnReply !== false;
    const records = normalizedSteps.map((step, index) => ({
      id: uid('followup'),
      sequenceId,
      stepIndex: index + 1,
      stepCount: normalizedSteps.length,
      leadId: id,
      leadName: String(lead.name || 'Lead').slice(0, 160),
      phone,
      messageTemplate: step.messageTemplate,
      message: step.message,
      scheduledAt: new Date(step.scheduledAt).toISOString(),
      createdAt,
      status: FOLLOWUP_STATUS.SCHEDULED,
      cancelOnReply,
      purpose: 'response',
      attempts: 0,
      lastInboundAtAtCreation: String(lead.lastInboundAt || ''),
      lastError: '',
    }));
    const next = [...existing, ...records];
    await putFollowupsInternal(next);
    const alarmErrors = [];
    for (const record of records) {
      try { await scheduleFollowupAlarm(record); }
      catch (error) {
        record.status = FOLLOWUP_STATUS.FAILED;
        record.lastError = `Não foi possível registrar o alarme: ${String(error?.message || error).slice(0, 160)}`;
        alarmErrors.push(record.id);
      }
    }
    if (alarmErrors.length) await putFollowupsInternal(next);
    appendCrmActivity(lead, {
      id: `followup_scheduled_${sequenceId}`,
      type: 'followup.sequence_scheduled',
      title: records.length > 1 ? 'Sequência de follow-ups programada' : 'Follow-up programado',
      description: `${records.length} mensagem(ns) programada(s). ${cancelOnReply ? 'A sequência será interrompida se o cliente responder.' : 'A sequência continuará mesmo se o cliente responder.'}`,
      actor: 'Usuário',
      source: 'manual',
      createdAt,
      metadata: { sequenceId, followupIds: records.map((item) => item.id), count: records.length },
    });
    await putLeads(leads);
    if (consent.newlyRecorded) {
      appendCrmActivity(lead, {
        id: `followup_consent_${sequenceId}`,
        type: 'consent.manual_confirmed',
        title: 'Autorização para contato confirmada',
        description: 'O usuário confirmou possuir autorização específica para follow-up. O registro é restrito a este módulo e não libera campanhas de marketing.',
        actor: 'Usuário',
        source: 'manual',
        createdAt,
        metadata: { source: 'followup_schedule' },
      });
      await putLeads(leads);
    }
    await recordTelemetry('crm.followup.scheduled', 'crm.followup.manage', { success: true, count: records.length });
    broadcast('FOLLOWUPS_UPDATED', { leadId: id, sequenceId, count: records.length });
    return { success: true, data: { sequenceId, followups: records, alarmFailures: alarmErrors.length } };
  });
}
async function updateFollowup(id, patch) {
  return withFollowupMutation(async () => {
    const items = await getFollowupsInternal();
    const item = items.find((entry) => String(entry.id) === String(id));
    if (!item) return { success: false, error: 'Follow-up não encontrado.' };
    Object.assign(item, patch);
    await putFollowupsInternal(items);
    broadcast('FOLLOWUPS_UPDATED', { leadId: item.leadId, followupId: item.id, status: item.status });
    return { success: true, data: { followup: item } };
  });
}
async function cancelFollowup(id, reason = 'cancelled_by_user') {
  const items = await getFollowupsInternal();
  const item = items.find((entry) => String(entry.id) === String(id));
  if (!item) return { success: false, error: 'Follow-up não encontrado.' };
  if ([FOLLOWUP_STATUS.SENT, FOLLOWUP_STATUS.CANCELLED].includes(item.status)) return { success: false, error: 'Este follow-up já foi concluído ou cancelado.' };
  if (item.status === FOLLOWUP_STATUS.PROCESSING) {
    const pending = await updateFollowup(id, { cancelRequested: true, cancelReason: reason });
    return pending.success ? { success: true, data: { followup: pending.data.followup, cancellationPending: true } } : pending;
  }
  await clearFollowupAlarm(item.id);
  const result = await updateFollowup(id, { status: FOLLOWUP_STATUS.CANCELLED, cancelledAt: new Date().toISOString(), cancelReason: reason, lastError: '' });
  if (result.success) await appendFollowupActivity(item.leadId, item, 'cancelled', 'Follow-up cancelado', reason === 'client_replied' ? 'O contato respondeu no WhatsApp; o follow-up pendente foi interrompido.' : 'O usuário cancelou o envio programado.');
  await recordTelemetry('crm.followup.cancelled', 'crm.followup.manage', { success: result.success, count: 1 });
  return result;
}
async function handleFollowupInboundActivity(payload = {}) {
  const phone = normalizeFollowupPhone(payload.phone);
  const messageId = String(payload.messageId || '').slice(0, 160);
  if (!phone || !messageId) return { success: false, ignored: true };
  const receivedAt = Number.isFinite(Date.parse(payload.receivedAt || '')) ? new Date(payload.receivedAt).toISOString() : new Date().toISOString();
  const tail = phoneTail(phone);
  const leads = await getLeads();
  const lead = leads.find((item) => phoneTail(item.phone) === tail);
  if (lead) {
    if (String(lead.lastInboundMessageId || '') === messageId) return { success: true, duplicate: true };
    lead.lastInboundAt = receivedAt;
    lead.lastInboundMessageId = messageId;
    await putLeads(leads);
  }
  const items = await getFollowupsInternal();
  const cancelled = [];
  let changed = false;
  for (const item of items) {
    if (phoneTail(item.phone) !== tail || item.cancelOnReply === false) continue;
    if ([FOLLOWUP_STATUS.SCHEDULED, FOLLOWUP_STATUS.OVERDUE, FOLLOWUP_STATUS.FAILED, FOLLOWUP_STATUS.BLOCKED_FREQUENCY, FOLLOWUP_STATUS.BLOCKED_LICENSE].includes(item.status)) {
      item.status = FOLLOWUP_STATUS.CANCELLED;
      item.cancelledAt = new Date().toISOString();
      item.cancelReason = 'client_replied';
      item.lastInboundAt = receivedAt;
      item.lastError = '';
      cancelled.push(item);
      changed = true;
      await clearFollowupAlarm(item.id);
    } else if (item.status === FOLLOWUP_STATUS.PROCESSING) {
      item.cancelRequested = true;
      item.lastInboundAt = receivedAt;
      changed = true;
    }
  }
  if (changed) await putFollowupsInternal(items);
  for (const item of cancelled) {
    await appendFollowupActivity(item.leadId, item, 'cancelled', 'Follow-up interrompido', 'O cliente respondeu no WhatsApp; as próximas mensagens desta sequência foram canceladas.');
  }
  if (cancelled.length) {
    await recordTelemetry('crm.followup.cancelled_on_reply', 'crm.followup.automation', { success: true, count: cancelled.length });
    broadcast('FOLLOWUPS_UPDATED', { phoneTail: tail, cancelled: cancelled.length, reason: 'client_replied' });
  }
  return { success: true, cancelled: cancelled.length };
}
async function reconcileFollowupBeforeSend(item) {
  const state = await getLicenseState();
  const required = ['crm.followup.manage', 'crm.followup.send', 'whatsapp.connection', 'compliance.consent_tracking', 'compliance.optout_management', 'compliance.frequency_limits'];
  if (!state.licensed || !required.every((feature) => hasFeatureEntitlement(state.payload?.ent, feature))) {
    return { allowed: false, status: FOLLOWUP_STATUS.BLOCKED_LICENSE, error: 'A licença não libera o envio de follow-ups.' };
  }
  const phone = normalizeFollowupPhone(item.phone);
  if (!phone) return { allowed: false, status: FOLLOWUP_STATUS.FAILED, error: 'Telefone inválido.' };
  const consent = await getConsentForPhone(phone);
  const scopedConsent = await getFollowupConsentForPhone(phone);
  if (consent?.status === CONSENT_STATUS_OPTED_OUT) {
    return { allowed: false, status: FOLLOWUP_STATUS.BLOCKED_CONSENT, error: 'O contato solicitou descadastro.' };
  }
  const hasFollowupConsent = consent?.status === CONSENT_STATUS_OPTED_IN
    || (scopedConsent?.status === CONSENT_STATUS_OPTED_IN && scopedConsent.scope === 'followup_only');
  if (!hasFollowupConsent) {
    return { allowed: false, status: FOLLOWUP_STATUS.BLOCKED_CONSENT, error: 'Não existe autorização válida para follow-up registrada para este contato.' };
  }
  if ((await blacklistTails()).has(phoneTail(phone))) return { allowed: false, status: FOLLOWUP_STATUS.BLOCKED_BLACKLIST, error: 'O contato está na Black list.' };
  const leads = await getLeads();
  const lead = leads.find((entry) => String(leadId(entry)) === String(item.leadId));
  if (!lead) return { allowed: false, status: FOLLOWUP_STATUS.FAILED, error: 'Lead não encontrado. Nenhuma mensagem foi enviada.' };
  if (lead.blacklisted || normalizeType(lead.tipo) === 'spam') return { allowed: false, status: FOLLOWUP_STATUS.BLOCKED_SPAM, error: 'O lead está bloqueado ou classificado como spam.' };
  if (item.cancelOnReply !== false) {
    const inboundAt = Math.max(Date.parse(item.lastInboundAt || '') || 0, Date.parse(lead.lastInboundAt || '') || 0);
    const createdAt = Date.parse(item.createdAt || '') || 0;
    if (inboundAt > createdAt || item.cancelRequested === true) return { allowed: false, status: FOLLOWUP_STATUS.CANCELLED, error: 'O cliente respondeu depois do agendamento.' };
  }
  const settings = await getFollowupSettingsInternal();
  const now = Date.now();
  if (isWithinQuietHours(now, settings)) {
    const nextAt = nextAllowedFollowupTime(now, settings);
    return { allowed: false, rescheduleAt: nextAt, error: 'Horário de silêncio configurado. O envio foi reagendado para o próximo horário permitido.' };
  }
  const sentToday = (await getFollowupsInternal()).filter((entry) => entry.status === FOLLOWUP_STATUS.SENT
    && phoneTail(entry.phone) === phoneTail(phone)
    && Date.now() - (Date.parse(entry.sentAt || '') || 0) < 24 * 60 * 60 * 1000);
  if (sentToday.length >= settings.maxPerContactDaily) return { allowed: false, status: FOLLOWUP_STATUS.BLOCKED_FREQUENCY, error: 'Limite diário de follow-ups para este contato atingido.' };
  const lastSentAt = Math.max(0, ...sentToday.map((entry) => Date.parse(entry.sentAt || '') || 0));
  if (settings.minIntervalMinutes > 0 && lastSentAt && now - lastSentAt < settings.minIntervalMinutes * 60_000) {
    return { allowed: false, status: FOLLOWUP_STATUS.BLOCKED_FREQUENCY, error: `Aguarde pelo menos ${settings.minIntervalMinutes} minuto(s) entre mensagens para este contato.` };
  }
  const sentGlobalToday = (await getFollowupsInternal()).filter((entry) => entry.status === FOLLOWUP_STATUS.SENT
    && Date.now() - (Date.parse(entry.sentAt || '') || 0) < 24 * 60 * 60 * 1000).length;
  if (sentGlobalToday >= settings.maxDailyTotal) return { allowed: false, status: FOLLOWUP_STATUS.BLOCKED_FREQUENCY, error: 'Limite diário total de follow-ups atingido.' };
  return { allowed: true, lead };
}
async function processFollowup(id, manual = false) {
  if (followupInFlight.has(id)) return { success: false, code: 'FOLLOWUP_PROCESSING', error: 'Este follow-up já está sendo processado.' };
  followupInFlight.add(id);
  try {
    let items = await getFollowupsInternal();
    let item = items.find((entry) => String(entry.id) === String(id));
    if (!item) return { success: false, error: 'Follow-up não encontrado.' };
    const allowedStatuses = manual
      ? [FOLLOWUP_STATUS.SCHEDULED, FOLLOWUP_STATUS.OVERDUE, FOLLOWUP_STATUS.FAILED, FOLLOWUP_STATUS.BLOCKED_LICENSE, FOLLOWUP_STATUS.BLOCKED_BLACKLIST, FOLLOWUP_STATUS.BLOCKED_SPAM, FOLLOWUP_STATUS.BLOCKED_FREQUENCY]
      : [FOLLOWUP_STATUS.SCHEDULED];
    if (!allowedStatuses.includes(item.status)) return { success: false, error: `Este follow-up não pode ser enviado no estado "${item.status}".` };
    if (!manual) {
      const dueAt = Date.parse(item.scheduledAt || '');
      if (!Number.isFinite(dueAt) || dueAt > Date.now()) { await scheduleFollowupAlarm(item); return { success: true, rescheduled: true }; }
      if (Date.now() - dueAt > FOLLOWUP_MAX_ALARM_LAG_MS) {
        await updateFollowup(id, { status: FOLLOWUP_STATUS.OVERDUE, overdueAt: new Date().toISOString(), lastError: 'O horário passou há mais de 15 minutos. Revise antes de enviar.' });
        return { success: false, code: 'FOLLOWUP_OVERDUE', error: 'O horário passou. Revise e envie manualmente se ainda fizer sentido.' };
      }
    }
    await updateFollowup(id, { status: FOLLOWUP_STATUS.PROCESSING, attempts: (Number(item.attempts) || 0) + 1, processingAt: new Date().toISOString(), lastError: '', cancelRequested: false });
    const check = await reconcileFollowupBeforeSend(item);
    if (!check.allowed) {
      if (check.rescheduleAt) {
        const updated = await updateFollowup(id, { status: FOLLOWUP_STATUS.SCHEDULED, scheduledAt: new Date(check.rescheduleAt).toISOString(), lastError: check.error, quietHoursAdjusted: true });
        if (updated.success) await scheduleFollowupAlarm(updated.data.followup);
        return { success: false, code: 'QUIET_HOURS', error: check.error, rescheduled: true };
      }
      await updateFollowup(id, { status: check.status, lastError: check.error, blockedAt: new Date().toISOString() });
      await appendFollowupActivity(item.leadId, { ...item, status: check.status }, check.status, 'Follow-up não enviado', check.error);
      return { success: false, code: check.status.toUpperCase(), error: check.error };
    }
    // Releitura imediatamente antes do envio: uma resposta recebida durante a validação cancela o disparo.
    items = await getFollowupsInternal();
    item = items.find((entry) => String(entry.id) === String(id));
    if (!item || item.cancelRequested || item.status !== FOLLOWUP_STATUS.PROCESSING) {
      if (item?.cancelRequested) await updateFollowup(id, { status: FOLLOWUP_STATUS.CANCELLED, cancelledAt: new Date().toISOString(), cancelReason: 'client_replied', lastError: '' });
      return { success: false, code: 'FOLLOWUP_CANCELLED', error: 'O cliente respondeu antes do envio. Follow-up cancelado.' };
    }
    let wa;
    try { wa = await requireWhatsApp(); }
    catch (error) {
      await updateFollowup(id, { status: FOLLOWUP_STATUS.OVERDUE, lastError: String(error?.message || error).slice(0, 240), overdueAt: new Date().toISOString() });
      return { success: false, code: 'WHATSAPP_UNAVAILABLE', error: 'WhatsApp Web indisponível. O follow-up ficou pendente; conecte o WhatsApp e use Enviar agora ou Reagendar.' };
    }
    const beforeSend = (await getFollowupsInternal()).find((entry) => String(entry.id) === String(id));
    if (!beforeSend || beforeSend.cancelRequested || beforeSend.status !== FOLLOWUP_STATUS.PROCESSING) {
      if (beforeSend?.cancelRequested) await updateFollowup(id, { status: FOLLOWUP_STATUS.CANCELLED, cancelledAt: new Date().toISOString(), cancelReason: beforeSend.cancelReason || 'client_replied', lastError: '' });
      return { success: false, code: 'FOLLOWUP_CANCELLED', error: 'O follow-up foi cancelado antes do envio.' };
    }
    const sendResult = await sendToTabEnsured(wa.tab, 'whatsapp', {
      type: 'FOLLOWUP_SEND_TO_PHONE',
      payload: { phone: item.phone, text: item.message, followupId: item.id },
    }, wa.frameId);
    const success = sendResult?.success === true;
    const finalStatus = success ? FOLLOWUP_STATUS.SENT : FOLLOWUP_STATUS.FAILED;
    await updateFollowup(id, {
      status: finalStatus,
      sentAt: success ? new Date().toISOString() : '',
      lastError: success ? '' : String(sendResult?.error || 'O WhatsApp Web não confirmou o envio.').slice(0, 240),
      result: success ? 'confirmed_by_whatsapp_bridge' : 'send_failed',
    });
    const latest = await getFollowupsInternal();
    const finalItem = latest.find((entry) => String(entry.id) === String(id)) || item;
    await appendFollowupActivity(item.leadId, finalItem,
      success ? 'sent' : 'failed',
      success ? 'Follow-up enviado' : 'Falha no follow-up',
      success ? `Mensagem enviada pelo WhatsApp Web para ${item.leadName || 'o contato'}.` : finalItem.lastError);
    await recordTelemetry(success ? 'crm.followup.sent' : 'crm.followup.failed', 'crm.followup.send', { success, count: 1 });
    return success ? { success: true, data: { followup: finalItem } } : { success: false, code: 'FOLLOWUP_SEND_FAILED', error: finalItem.lastError };
  } catch (error) {
    await updateFollowup(id, { status: FOLLOWUP_STATUS.FAILED, lastError: String(error?.message || error).slice(0, 240) }).catch(() => {});
    return { success: false, error: String(error?.message || error).slice(0, 240) };
  } finally {
    followupInFlight.delete(id);
  }
}
async function processFollowupAlarm(id) {
  const items = await getFollowupsInternal();
  const item = items.find((entry) => String(entry.id) === String(id));
  if (!item || item.status !== FOLLOWUP_STATUS.SCHEDULED) { await clearFollowupAlarm(id); return; }
  await processFollowup(id, false);
}
async function cancelFollowupSequence(id, reason = 'cancelled_by_user') {
  const items = await getFollowupsInternal();
  const selected = items.find((entry) => String(entry.id) === String(id));
  if (!selected) return { success: false, error: 'Follow-up não encontrado.' };
  const targets = items.filter((entry) => entry.sequenceId === selected.sequenceId
    && [FOLLOWUP_STATUS.SCHEDULED, FOLLOWUP_STATUS.OVERDUE, FOLLOWUP_STATUS.FAILED, FOLLOWUP_STATUS.PROCESSING].includes(entry.status));
  for (const target of targets) await cancelFollowup(target.id, reason);
  return { success: true, data: { cancelled: targets.length, sequenceId: selected.sequenceId } };
}

// ---------------------------------------------------------------------------
// v1.0.0 — Integração Google Calendar (OAuth do usuário, sem backend intermediário)
// ---------------------------------------------------------------------------
async function getCalendarConfigInternal() {
  return normalizeCalendarSettings(await getOne(K.GOOGLE_CALENDAR, {}));
}
async function putCalendarConfigInternal(config) {
  const clean = normalizeCalendarSettings({ ...config, updatedAt: new Date().toISOString() });
  await setStore({ [K.GOOGLE_CALENDAR]: clean });
  return clean;
}
function calendarConfigured() {
  const id = chrome.runtime.getManifest().oauth2?.client_id || '';
  return !!id && id.endsWith('.apps.googleusercontent.com') && !/^SEU_|YOUR_|COLE_/i.test(id);
}
async function getGoogleCalendarToken(interactive = false) {
  if (!calendarConfigured()) throw new Error('O Client ID OAuth do Google não está configurado no manifest.json.');
  if (!chrome.identity?.getAuthToken) throw new Error('A API de identidade do Chrome não está disponível.');
  try {
    const result = await chrome.identity.getAuthToken({ interactive, scopes: GOOGLE_CALENDAR_SCOPES });
    const token = typeof result === 'string' ? result : result?.token;
    if (!token) throw new Error('O Google não forneceu um token de acesso.');
    return token;
  } catch (error) {
    const raw = String(error?.message || error);
    if (/user.?cancel|cancelled|canceled/i.test(raw)) throw new Error('A autorização do Google Agenda foi cancelada.');
    throw new Error(`Não foi possível autorizar o Google Agenda: ${raw.slice(0, 180)}`);
  }
}
async function dropGoogleCalendarToken(token) {
  if (!token) return;
  try { await chrome.identity.removeCachedAuthToken({ token }); } catch { /* token já removido */ }
}
async function googleCalendarRequest(path, options = {}, interactive = false, retry = true) {
  if (!await chrome.permissions.contains({ origins: [GOOGLE_CALENDAR_ORIGIN] })) {
    throw new Error('Permita o acesso ao Google Agenda no botão Conectar antes de continuar.');
  }
  const token = await getGoogleCalendarToken(interactive);
  let response;
  try {
    response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
      credentials: 'omit', cache: 'no-store', redirect: 'error',
    });
  } catch {
    throw new Error('Não foi possível conectar ao Google Agenda. Verifique sua internet.');
  }
  if (response.status === 401 && retry) {
    await dropGoogleCalendarToken(token);
    return googleCalendarRequest(path, options, interactive, false);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = String(body?.error?.message || body?.error || '').slice(0, 220);
    if (response.status === 403) throw new Error(`Acesso negado pelo Google Agenda. Confira se a API Calendar está habilitada e se os escopos foram autorizados.${detail ? ` Detalhe: ${detail}` : ''}`);
    if (response.status === 404) throw new Error('Agenda ou compromisso não encontrado. Atualize a lista de calendários.');
    if (response.status === 409) throw new Error('O horário acabou de ser ocupado. Consulte a disponibilidade novamente.');
    if (response.status === 429) throw new Error('O Google Agenda aplicou um limite temporário. Aguarde e tente novamente.');
    throw new Error(`Google Agenda respondeu HTTP ${response.status}.${detail ? ` ${detail}` : ''}`);
  }
  return body;
}
async function listGoogleCalendars(interactive = false) {
  const items = []; let pageToken = ''; let page = 0;
  do {
    const query = new URLSearchParams({ maxResults: '250', showDeleted: 'false', fields: 'items(id,summary,primary,accessRole,timeZone),nextPageToken' });
    if (pageToken) query.set('pageToken', pageToken);
    const data = await googleCalendarRequest(`/users/me/calendarList?${query.toString()}`, {}, interactive);
    if (Array.isArray(data.items)) items.push(...data.items);
    pageToken = String(data.nextPageToken || ''); page++;
  } while (pageToken && page < 5);
  return items.filter((item) => item?.id && ['owner', 'writer', 'reader', 'freeBusyReader'].includes(item.accessRole)).map((item) => ({
    id: String(item.id).slice(0, 500), summary: String(item.summary || item.id).slice(0, 160),
    primary: item.primary === true, accessRole: String(item.accessRole || ''), timeZone: String(item.timeZone || '').slice(0, 80),
  }));
}
async function findGoogleCalendarEventByKey(calendarId, requestKey) {
  const query = new URLSearchParams({
    privateExtendedProperty: `i9HubEventKey=${requestKey}`,
    showDeleted: 'false', maxResults: '5',
    fields: 'items(id,summary,description,start,end,htmlLink,status,attendees,extendedProperties)',
  });
  const data = await googleCalendarRequest(`/calendars/${encodeURIComponent(calendarId)}/events?${query.toString()}`);
  return Array.isArray(data.items) ? data.items.find((item) => item.status !== 'cancelled') || null : null;
}
async function appendCalendarActivity(lead, type, title, description, metadata = {}) {
  appendCrmActivity(lead, { type: `calendar.${type}`, title, description, actor: 'Google Agenda', source: 'automation', metadata });
}
async function syncLeadCalendarEvents(lead, changedFields = []) {
  const events = Array.isArray(lead?.calendarEvents) ? lead.calendarEvents : [];
  const active = events.filter((event) => event?.eventId && event.status !== 'cancelled');
  if (!active.length) return { synced: 0, pending: 0 };
  const config = await getCalendarConfigInternal();
  const license = await getLicenseState();
  if (!license.licensed || !hasFeatureEntitlement(license.payload?.ent, 'google.calendar.booking')) {
    for (const event of active) { event.syncStatus = 'pending'; event.lastSyncError = 'A licença atual não libera a sincronização de compromissos.'; }
    const localLeads = await getLeads();
    const localIndex = localLeads.findIndex((item) => String(leadId(item)) === String(leadId(lead)));
    if (localIndex >= 0) { localLeads[localIndex] = lead; await putLeads(localLeads); }
    return { synced: 0, pending: active.length };
  }
  if (!config.connected) {
    for (const event of active) { event.syncStatus = 'pending'; event.lastSyncError = 'Conecte o Google Agenda para atualizar os dados deste compromisso.'; }
    const localLeads = await getLeads();
    const localIndex = localLeads.findIndex((item) => String(leadId(item)) === String(leadId(lead)));
    if (localIndex >= 0) { localLeads[localIndex] = lead; await putLeads(localLeads); }
    return { synced: 0, pending: active.length };
  }
  let synced = 0; let pending = 0;
  for (const event of active) {
    try {
      const body = {
        summary: /^Atendimento\s*[—-]/i.test(String(event.summary || '')) ? `Atendimento — ${String(lead.name || 'Lead').slice(0, 140)}` : event.summary,
        description: buildCalendarEventDescription(lead, event.note || ''),
      };
      await googleCalendarRequest(`/calendars/${encodeURIComponent(event.calendarId || config.calendarId)}/events/${encodeURIComponent(event.eventId)}`, { method: 'PATCH', body: JSON.stringify(body) });
      event.syncStatus = 'synced'; event.lastSyncedAt = new Date().toISOString(); event.lastSyncError = '';
      synced++;
    } catch (error) {
      event.syncStatus = 'pending'; event.lastSyncError = String(error?.message || error).slice(0, 220); pending++;
    }
  }
  lead.calendarEvents = events.slice(-CALENDAR_MAX_EVENTS_PER_LEAD);
  lead.updatedAt = new Date().toISOString();
  if (synced) await appendCalendarActivity(lead, 'lead_data_synced', 'Dados do lead atualizados na agenda', `Os dados do lead foram sincronizados em ${synced} compromisso(s).`, { fields: changedFields, synced });
  if (pending) await appendCalendarActivity(lead, 'lead_data_sync_pending', 'Atualização da agenda pendente', `${pending} compromisso(s) precisam de nova tentativa de sincronização.`, { fields: changedFields, pending });
  const leads = await getLeads();
  const index = leads.findIndex((item) => String(leadId(item)) === String(leadId(lead)));
  if (index >= 0) { leads[index] = lead; await putLeads(leads); }
  return { synced, pending };
}

// ---------------------------------------------------------------------------
// v1.3.0 — Automações Google Agenda por transição de estágio/etiqueta.
// Execução local no service worker; não depende do painel nem de backend próprio.
// ---------------------------------------------------------------------------
async function getCalendarAutomationRulesInternal() {
  return normalizeCalendarAutomationRules(await getOne(K.CALENDAR_AUTOMATIONS, []));
}
async function getCalendarAutomationRunsInternal() {
  const value = await getOne(K.CALENDAR_AUTOMATION_RUNS, []);
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object').slice(-2000) : [];
}
async function getCalendarAutomationTasksInternal() {
  return normalizeCalendarAutomationTasks(await getOne(K.CALENDAR_AUTOMATION_TASKS, []));
}
async function saveCalendarAutomationRun(run) {
  const runs = await getCalendarAutomationRunsInternal();
  const index = runs.findIndex((item) => item.runKey === run.runKey);
  if (index >= 0) runs[index] = { ...runs[index], ...run, updatedAt: new Date().toISOString() };
  else runs.push({ ...run, createdAt: run.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
  await setStore({ [K.CALENDAR_AUTOMATION_RUNS]: runs.slice(-2000) });
}
function renderAutomationTemplate(template, lead) {
  const values = {
    nome: lead?.name || 'cliente',
    empresa: lead?.company || 'sua empresa',
    telefone: lead?.phone || '',
    email: lead?.email || '',
    servico: lead?.aiIntelligence?.service || lead?.service || 'atendimento',
    nicho: lead?.aiIntelligence?.segment || lead?.category || '',
    etapa: lead?.stage || '',
  };
  return String(template || '').replace(/\{\{\s*(nome|empresa|telefone|email|servico|nicho|etapa)\s*\}\}/gi, (_match, key) => String(values[String(key).toLowerCase()] || '').slice(0, 180)).slice(0, 1200);
}
async function createCalendarAutomationTask({ rule, lead, transition, reason, proposedStart = '', proposedEnd = '', type = 'booking_request' }) {
  const tasks = await getCalendarAutomationTasksInternal();
  const id = uid('cal_task');
  const task = {
    id, ruleId: rule.id, leadId: String(leadId(lead)), leadName: String(lead.name || 'Lead').slice(0, 160),
    type, title: rule.name || 'Ação comercial aguardando revisão',
    reason: String(reason || 'É necessária uma revisão do vendedor.').slice(0, 500),
    status: 'needs_review', createdAt: new Date().toISOString(),
    trigger: { type: transition.type, value: transition.value },
    proposedStart, proposedEnd,
    metadata: { actionType: rule.action.type },
  };
  tasks.push(task);
  await setStore({ [K.CALENDAR_AUTOMATION_TASKS]: tasks.slice(-500) });
  const leads = await getLeads();
  const current = leads.find((item) => String(leadId(item)) === String(leadId(lead)));
  if (current) {
    appendCrmActivity(current, {
      type: 'calendar.automation_review_required',
      title: 'Automação de agenda aguardando revisão',
      description: `${rule.name}: ${task.reason}`,
      actor: 'i9Hub',
      source: 'automation',
      metadata: { taskId: id, ruleId: rule.id, trigger: task.trigger },
    });
    current.updatedAt = new Date().toISOString();
    const index = leads.findIndex((item) => String(leadId(item)) === String(leadId(current)));
    if (index >= 0) leads[index] = current;
    await putLeads(leads);
  }
  broadcast('CALENDAR_AUTOMATION_TASKS_UPDATED', { taskId: id, leadId: task.leadId });
  return task;
}
function isCalendarAutomationTimeAllowed(date, config, durationMinutes = 30) {
  const start = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(start.getTime())) return false;
  if (!config.weekdays.includes(start.getDay())) return false;
  const minutes = start.getHours() * 60 + start.getMinutes();
  const [startHour, startMinute] = config.workingHoursStart.split(':').map(Number);
  const [endHour, endMinute] = config.workingHoursEnd.split(':').map(Number);
  const begin = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const eventEnd = minutes + Math.max(15, Number(durationMinutes) || 30);
  return minutes >= begin && minutes < end && eventEnd <= end;
}
async function createCalendarEventFromAutomation({ rule, lead, transition, runKey }) {
  const config = await getCalendarConfigInternal();
  if (!config.connected) throw new Error('Google Agenda não está conectado neste navegador.');
  const start = resolveCalendarAutomationDate({ rule, lead, triggerAt: transition.at || Date.now() });
  const duration = Number(rule.action.durationMinutes) || config.defaultDurationMinutes;
  const end = new Date(start.getTime() + duration * 60_000);
  if (start.getTime() < Date.now() + 60_000) throw new Error('A data calculada não é futura. Revise o intervalo ou os campos de data/hora do lead.');
  if (!isCalendarAutomationTimeAllowed(start, config, duration)) throw new Error('O horário calculado está fora dos dias ou do expediente configurado no Google Agenda.');
  const requestKey = `auto_${runKey}`.replace(/[^a-zA-Z0-9_|-]/g, '').slice(0, 180);
  const events = Array.isArray(lead.calendarEvents) ? lead.calendarEvents : [];
  const localExisting = events.find((item) => item.requestKey === requestKey && item.eventId && item.status !== 'cancelled');
  if (localExisting) return localExisting;
  const booking = {
    start: start.toISOString(), end: end.toISOString(),
    summary: renderAutomationTemplate(rule.action.summaryTemplate, lead),
    note: renderAutomationTemplate(rule.action.noteTemplate, lead),
    inviteLeadByEmail: false,
  };
  const body = buildCalendarEventBody({ lead, booking, settings: config, eventKey: requestKey });
  const busyResponse = await googleCalendarRequest('/freeBusy', {
    method: 'POST',
    body: JSON.stringify({ timeMin: body.start.dateTime, timeMax: body.end.dateTime, timeZone: config.timeZone, items: [{ id: config.calendarId }] }),
  });
  const busy = busyResponse?.calendars?.[config.calendarId]?.busy || [];
  if (busy.some((item) => Date.parse(body.start.dateTime) < Date.parse(item.end) && Date.parse(body.end.dateTime) > Date.parse(item.start))) {
    const error = new Error('O horário calculado já está ocupado na agenda. Escolha outro horário no card do lead.');
    error.code = 'CALENDAR_SLOT_TAKEN';
    error.proposedStart = body.start.dateTime;
    error.proposedEnd = body.end.dateTime;
    throw error;
  }
  let remoteEvent = await findGoogleCalendarEventByKey(config.calendarId, requestKey).catch(() => null);
  if (!remoteEvent) {
    const pending = {
      requestKey, calendarId: config.calendarId, summary: body.summary,
      start: body.start.dateTime, end: body.end.dateTime, status: 'pending',
      syncStatus: 'pending', automationRuleId: rule.id, createdAt: new Date().toISOString(), note: booking.note,
    };
    lead.calendarEvents = [...events, pending].slice(-CALENDAR_MAX_EVENTS_PER_LEAD);
    const leadsBefore = await getLeads();
    const leadIndex = leadsBefore.findIndex((item) => String(leadId(item)) === String(leadId(lead)));
    if (leadIndex >= 0) { leadsBefore[leadIndex] = lead; await putLeads(leadsBefore); }
    remoteEvent = await googleCalendarRequest(`/calendars/${encodeURIComponent(config.calendarId)}/events?sendUpdates=none`, { method: 'POST', body: JSON.stringify(body) });
  }
  const record = {
    ...normalizeCalendarEventRecord(remoteEvent, config.calendarId),
    requestKey, note: booking.note, automationRuleId: rule.id,
    automated: true, attendeeInvited: false,
  };
  const latestLeads = await getLeads();
  const latestLead = latestLeads.find((item) => String(leadId(item)) === String(leadId(lead))) || lead;
  const latestEvents = Array.isArray(latestLead.calendarEvents) ? latestLead.calendarEvents : [];
  latestLead.calendarEvents = [...latestEvents.filter((item) => item.requestKey !== requestKey && item.eventId !== record.eventId), record].slice(-CALENDAR_MAX_EVENTS_PER_LEAD);
  appendCalendarActivity(latestLead, 'automation_event_created', 'Compromisso criado por automação', `${record.summary} · ${new Date(record.start).toLocaleString('pt-BR')}.`, { eventId: record.eventId, ruleId: rule.id });
  latestLead.updatedAt = new Date().toISOString();
  const latestIndex = latestLeads.findIndex((item) => String(leadId(item)) === String(leadId(latestLead)));
  if (latestIndex >= 0) latestLeads[latestIndex] = latestLead;
  await putLeads(latestLeads);
  await recordTelemetry('google_calendar.automation_event_created', 'google.calendar.automation', { success: true, count: 1 });
  broadcast('CALENDAR_EVENTS_UPDATED', { leadId: String(leadId(latestLead)), eventId: record.eventId, automated: true });
  return record;
}
async function runCalendarAutomationsForTransition(leadRef, transition) {
  const state = await getLicenseState();
  const ent = state.payload?.ent;
  if (!state.licensed || !hasFeatureEntitlement(ent, 'google.calendar.automation')
      || !hasFeatureEntitlement(ent, 'google.calendar.booking')
      || !hasFeatureEntitlement(ent, 'google.calendar.connect')) {
    return { matched: 0, executed: 0, blocked: 'license' };
  }
  const rules = await getCalendarAutomationRulesInternal();
  const matching = rules.filter((rule) => calendarAutomationMatches(rule, transition));
  if (!matching.length) return { matched: 0, executed: 0 };
  let leads = await getLeads();
  let lead = leads.find((item) => String(leadId(item)) === String(leadId(leadRef)));
  if (!lead) return { matched: matching.length, executed: 0, error: 'lead_not_found' };
  let executed = 0;
  for (const rule of matching) {
    // Releia o lead antes de cada regra: outra regra pode ter acabado de gravar um evento
    // ou uma atividade e não podemos sobrescrever esse estado com uma referência antiga.
    leads = await getLeads();
    lead = leads.find((item) => String(leadId(item)) === String(leadId(leadRef)));
    if (!lead) continue;
    const transitionId = String(transition.id || `${transition.type}_${transition.value}_${transition.at || Date.now()}`).slice(0, 100);
    const runKey = buildCalendarAutomationRunKey({ ruleId: rule.id, leadId: leadId(lead), transitionId });
    const runs = await getCalendarAutomationRunsInternal();
    const prior = runs.find((item) => item.runKey === runKey);
    const processingAge = prior?.status === 'processing' ? Date.now() - (Date.parse(prior.updatedAt || prior.createdAt || '') || 0) : Infinity;
    if (prior && ['created', 'needs_review', 'completed'].includes(prior.status)) continue;
    if (prior?.status === 'processing' && processingAge < 5 * 60_000) continue;
    const run = { runKey, ruleId: rule.id, leadId: String(leadId(lead)), transition: { type: transition.type, value: transition.value }, status: 'processing' };
    await saveCalendarAutomationRun(run);
    try {
      if (rule.action.type === 'request_booking' || rule.action.requireApproval === true) {
        let proposedStart = ''; let proposedEnd = '';
        if (rule.action.type !== 'request_booking') {
          try {
            const suggested = resolveCalendarAutomationDate({ rule, lead, triggerAt: transition.at || Date.now() });
            proposedStart = suggested.toISOString();
            proposedEnd = new Date(suggested.getTime() + (Number(rule.action.durationMinutes) || 30) * 60_000).toISOString();
          } catch { /* tarefa permanece válida mesmo sem data sugerida */ }
        }
        const task = await createCalendarAutomationTask({
          rule, lead, transition, proposedStart, proposedEnd,
          reason: rule.action.type === 'request_booking'
            ? 'A regra solicita que o vendedor escolha e confirme um horário no card do CRM.'
            : 'A regra exige aprovação humana antes de criar o compromisso.',
          type: 'booking_request',
        });
        await saveCalendarAutomationRun({ ...run, status: 'needs_review', taskId: task.id });
        executed++;
        continue;
      }
      const config = await getCalendarConfigInternal();
      if (!config.connected) {
        await createCalendarAutomationTask({ rule, lead, transition, reason: 'Conecte o Google Agenda para executar esta automação.', type: 'calendar_connection_required' });
        await saveCalendarAutomationRun({ ...run, status: 'needs_review' });
        executed++;
        continue;
      }
      let record;
      try {
        record = await createCalendarEventFromAutomation({ rule, lead, transition, runKey });
      } catch (error) {
        const task = await createCalendarAutomationTask({
          rule, lead, transition,
          reason: String(error?.message || error).slice(0, 500),
          proposedStart: error?.proposedStart || '', proposedEnd: error?.proposedEnd || '',
          type: error?.code === 'CALENDAR_SLOT_TAKEN' ? 'slot_conflict' : 'automation_error',
        });
        await saveCalendarAutomationRun({ ...run, status: 'needs_review', taskId: task.id, lastError: String(error?.message || error).slice(0, 240) });
        executed++;
        continue;
      }
      await saveCalendarAutomationRun({ ...run, status: 'created', eventId: record.eventId, createdEventAt: new Date().toISOString() });
      if (rule.action.sendWhatsAppConfirmation && record.eventId) {
        try {
          const confirmationAuthorization = await gate('CALENDAR_SEND_CONFIRMATION', {});
          if (confirmationAuthorization.allowed) {
            await handlers.CALENDAR_SEND_CONFIRMATION({ leadId: String(leadId(lead)), eventId: record.eventId });
          } else {
            const latest = await getLeads();
            const currentLead = latest.find((item) => String(leadId(item)) === String(leadId(lead)));
            if (currentLead) {
              await appendCalendarActivity(currentLead, 'automation_confirmation_not_authorized', 'Confirmação automática não autorizada', 'O compromisso foi criado, mas a licença não libera o envio de confirmação pelo WhatsApp.', { eventId: record.eventId });
              await putLeads(latest);
            }
          }
        } catch { /* evento permanece válido; confirmação poderá ser enviada manualmente */ }
      }
      executed++;
    } catch (error) {
      await saveCalendarAutomationRun({ ...run, status: 'failed', lastError: String(error?.message || error).slice(0, 240) });
    }
  }
  return { matched: matching.length, executed };
}
async function completeCalendarAutomationTasksForLead(leadIdValue) {
  const tasks = await getCalendarAutomationTasksInternal();
  let changed = false;
  for (const task of tasks) {
    if (task.leadId === String(leadIdValue) && task.status === 'needs_review' && ['booking_request', 'slot_conflict', 'calendar_connection_required'].includes(task.type)) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.reason = 'Compromisso criado ou atualizado manualmente no Google Agenda.';
      changed = true;
    }
  }
  if (changed) { await setStore({ [K.CALENDAR_AUTOMATION_TASKS]: tasks }); broadcast('CALENDAR_AUTOMATION_TASKS_UPDATED', { leadId: String(leadIdValue), completed: true }); }
  return changed;
}

// ---------------------------------------------------------------------------
// Handlers por tipo de mensagem
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fase 13 — Comunicação do CRM (WhatsApp Web + Gmail API), ampliada na Fase 14
// ---------------------------------------------------------------------------
const crmEmailSendInFlight = new Set();
function gmailOAuthConfigured() {
  const id = chrome.runtime.getManifest().oauth2?.client_id || '';
  return !!id && id.endsWith('.apps.googleusercontent.com') && !/^SEU_|YOUR_|COLE_/i.test(id);
}
async function getGmailToken(interactive = false, scopes = [GMAIL_SEND_SCOPE], accountId = '') {
  if (!gmailOAuthConfigured()) throw new Error('O Client ID OAuth do Google não está configurado no manifest.json.');
  if (!chrome.identity?.getAuthToken) throw new Error('A API de identidade do Chrome não está disponível.');
  const details = { interactive, scopes: [...new Set(scopes)] };
  if (accountId && accountId !== 'default') details.account = { id: String(accountId).slice(0, 200) };
  try {
    const result = await chrome.identity.getAuthToken(details);
    const token = typeof result === 'string' ? result : result?.token;
    if (!token) throw new Error('O Google não forneceu um token de acesso.');
    return token;
  } catch (error) {
    const raw = String(error?.message || error);
    if (/user.?cancel|cancelled|canceled/i.test(raw)) throw new Error('A autorização do Gmail foi cancelada.');
    throw new Error(`Não foi possível autorizar o Gmail: ${raw.slice(0, 180)}`);
  }
}
async function dropGmailToken(token) {
  if (!token) return;
  try { await chrome.identity.removeCachedAuthToken({ token }); } catch { /* token já removido */ }
}
async function gmailApiRequest(path, options = {}, interactive = false, retry = true, scopes = [GMAIL_SEND_SCOPE], accountId = '') {
  if (!await chrome.permissions.contains({ origins: [GMAIL_ORIGIN] })) {
    throw new Error('Autorize o acesso ao Gmail pelo botão “Conectar Gmail” antes de continuar.');
  }
  const token = await getGmailToken(interactive, scopes, accountId);
  let response;
  try {
    response = await fetch(`${GMAIL_API}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
      credentials: 'omit', cache: 'no-store', redirect: 'error',
    });
  } catch {
    const error = new Error('Não foi possível confirmar a resposta do Gmail. Verifique a pasta Enviados antes de tentar novamente.');
    error.code = 'GMAIL_NETWORK_UNCERTAIN';
    throw error;
  }
  if (response.status === 401 && retry) {
    await dropGmailToken(token);
    return gmailApiRequest(path, options, interactive, false, scopes, accountId);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = String(data?.error?.message || data?.error || '').slice(0, 220);
    const error = new Error(response.status === 403
      ? `O Google recusou a operação. Confira a autorização e as permissões da conta.${detail ? ` ${detail}` : ''}`
      : response.status === 429
        ? 'O Gmail aplicou um limite temporário. Aguarde e tente novamente.'
        : `Gmail respondeu HTTP ${response.status}.${detail ? ` ${detail}` : ''}`);
    error.code = response.status >= 500 ? 'GMAIL_NETWORK_UNCERTAIN' : `GMAIL_HTTP_${response.status}`;
    throw error;
  }
  return data;
}
async function listChromeIdentityAccounts() {
  const getter = chrome.identity?.getAccounts;
  if (typeof getter !== 'function') return [];
  return new Promise((resolve) => {
    let settled = false;
    const done = (accounts) => {
      if (settled) return;
      settled = true;
      resolve(Array.isArray(accounts) ? accounts.filter((item) => item?.id).map((item) => ({ id: String(item.id).slice(0, 200) })) : []);
    };
    try {
      const maybe = getter.call(chrome.identity, done);
      if (maybe && typeof maybe.then === 'function') maybe.then(done).catch(() => done([]));
    } catch { done([]); }
  });
}
async function getCrmEmailStatus() {
  const status = await getOne(K.GMAIL_STATUS, {});
  const stored = await getOne(K.GMAIL_ACCOUNTS, []);
  const savedAccounts = Array.isArray(stored) ? stored : [];
  const identityAccounts = await listChromeIdentityAccounts();
  const byId = new Map();
  for (const account of [...savedAccounts, ...identityAccounts]) {
    const id = String(account?.id || account?.accountId || 'default').slice(0, 200);
    const old = byId.get(id) || {};
    byId.set(id, { ...old, ...account, id, label: String(account?.label || old.label || (id === 'default' ? 'Conta Google padrão' : `Conta Google ${byId.size + 1}`)).slice(0, 100) });
  }
  if (status?.connected && !byId.has(String(status.accountId || 'default'))) {
    const id = String(status.accountId || 'default');
    byId.set(id, { id, label: status.label || 'Conta Google conectada', connected: true, email: status.email || '' });
  }
  const accounts = [...byId.values()].map((item) => ({
    id: item.id,
    label: item.label,
    email: String(item.email || '').slice(0, 254),
    connected: item.connected === true || (status?.connected === true && String(status.accountId || 'default') === item.id),
  }));
  const selectedAccountId = String(status?.accountId || (accounts.find((item) => item.connected)?.id ?? 'default')).slice(0, 200);
  const selected = accounts.find((item) => item.id === selectedAccountId);
  return {
    connected: status?.connected === true,
    email: String(status?.email || selected?.email || '').slice(0, 254),
    connectedAt: String(status?.connectedAt || ''),
    accountId: selectedAccountId,
    accounts,
    configured: gmailOAuthConfigured(),
    permissionGranted: await chrome.permissions.contains({ origins: [GMAIL_ORIGIN] }),
  };
}
async function saveCrmEmailSendRecord(record) {
  const current = await getOne(K.CRM_EMAIL_SENDS, []);
  const items = Array.isArray(current) ? current : [];
  await setStore({ [K.CRM_EMAIL_SENDS]: [record, ...items.filter((item) => item.requestId !== record.requestId)].slice(0, 200) });
}
async function recordCrmCommunicationActivity(id, event) {
  if (!id) return null;
  return withCrmHistoryMutation(async () => {
    const leads = await getLeads();
    const lead = leads.find((item) => String(leadId(item)) === String(id));
    if (!lead) return null;
    appendCrmActivity(lead, {
      type: event.type,
      title: event.title,
      description: event.description || '',
      actor: event.actor || 'Usuário',
      source: 'communication',
      metadata: event.metadata || {},
    });
    lead.updatedAt = new Date().toISOString();
    await putLeads(leads);
    return lead;
  });
}
function safeEmailHeader(message, name) {
  const headers = Array.isArray(message?.payload?.headers) ? message.payload.headers : [];
  const found = headers.find((header) => String(header?.name || '').toLowerCase() === String(name || '').toLowerCase());
  return String(found?.value || '').replace(/[\r\n\0]/g, ' ').trim().slice(0, 254);
}
function extractEmailAddress(value) {
  const text = String(value || '').slice(0, 254);
  const angle = text.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/);
  const direct = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return String(angle?.[1] || direct?.[0] || '').toLowerCase();
}
async function getCrmEmailSignature(sellerId) {
  const signatures = normalizeCrmEmailSignatures(await getOne(K.CRM_EMAIL_SIGNATURES, {}));
  const id = String(sellerId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100) || 'default';
  const own = signatures[id];
  if (own) return own.deletedAt ? '' : (own.text || '');
  const fallback = signatures.default;
  return fallback?.deletedAt ? '' : (fallback?.text || '');
}
async function syncCrmEmailReplies(payload = {}) {
  const status = await getCrmEmailStatus();
  if (!status.connected) return { success: false, code: 'GMAIL_NOT_CONNECTED', error: 'Conecte uma conta Gmail antes de sincronizar respostas.' };
  const accountId = String(payload.accountId || status.accountId || 'default').slice(0, 200);
  const leadFilter = String(payload.leadId || '');
  const storedRecords = await getOne(K.CRM_EMAIL_SENDS, []);
  const recordsByRequest = new Map((Array.isArray(storedRecords) ? storedRecords : []).map((item) => [String(item.requestId || ''), item]).filter(([id]) => !!id));
  // O activityLog dos leads é sincronizado pelo backup principal. Ele permite que outro
  // computador recupere threadId/messageId mesmo sem o registro local de envio original.
  const leadsForReplies = await getLeads();
  for (const lead of leadsForReplies) {
    for (const event of (Array.isArray(lead.activityLog) ? lead.activityLog : [])) {
      if (event?.type !== 'communication.email.sent' || !event?.metadata?.threadId || !event?.metadata?.requestId) continue;
      const requestId = String(event.metadata.requestId);
      if (recordsByRequest.has(requestId)) continue;
      recordsByRequest.set(requestId, {
        requestId, leadId: String(leadId(lead)), status: 'sent',
        to: String(event.metadata.to || ''), subject: String(event.metadata.subject || ''),
        accountId: String(event.metadata.accountId || ''), sellerId: String(event.metadata.sellerId || lead.commercialOwnerId || ''),
        messageId: String(event.metadata.messageId || ''), threadId: String(event.metadata.threadId || ''),
        sentAt: String(event.createdAt || ''), replyMessageIds: [],
      });
    }
  }
  const records = [...recordsByRequest.values()];
  const eligible = records.filter((item) =>
    item?.status === 'sent' && item.threadId && (!leadFilter || String(item.leadId) === leadFilter)
    && (!item.accountId || String(item.accountId) === accountId)
  );
  const firstByThread = new Map();
  for (const item of eligible) {
    const previous = firstByThread.get(String(item.threadId));
    if (!previous || (Date.parse(item.sentAt || '') || 0) < (Date.parse(previous.sentAt || '') || 0)) firstByThread.set(String(item.threadId), item);
  }
  const candidates = [...firstByThread.values()].slice(0, 100);
  if (!candidates.length) return { success: true, data: { checked: 0, replies: 0, message: 'Não há envios recentes com identificador de conversa para verificar.' } };

  let profile = null;
  try {
    profile = await gmailApiRequest('/profile', {}, true, true, [GMAIL_SEND_SCOPE, GMAIL_READ_SCOPE], accountId);
  } catch (error) {
    const message = String(error?.message || '');
    return { success: false, code: error?.code || 'GMAIL_READ_AUTH_REQUIRED', error: message || 'Autorize a leitura de respostas do Gmail para continuar.' };
  }
  const ownEmail = String(profile?.emailAddress || status.email || '').toLowerCase();
  if (profile?.emailAddress) {
    const currentStatus = await getOne(K.GMAIL_STATUS, {});
    if (String(currentStatus?.accountId || 'default') === accountId) await setStore({ [K.GMAIL_STATUS]: { ...currentStatus, email: String(profile.emailAddress).slice(0, 254) } });
    const storedAccounts = await getOne(K.GMAIL_ACCOUNTS, []);
    if (Array.isArray(storedAccounts)) await setStore({ [K.GMAIL_ACCOUNTS]: storedAccounts.map((item) => String(item.id) === accountId ? { ...item, email: String(profile.emailAddress).slice(0, 254) } : item) });
  }
  let replies = 0;
  let checked = 0;
  const changedRecords = new Map();
  for (const record of candidates) {
    checked++;
    try {
      const thread = await gmailApiRequest(`/threads/${encodeURIComponent(record.threadId)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`, {}, false, true, [GMAIL_SEND_SCOPE, GMAIL_READ_SCOPE], accountId);
      const messages = Array.isArray(thread?.messages) ? thread.messages : [];
      const leadForThread = leadsForReplies.find((item) => String(leadId(item)) === String(record.leadId));
      const historyReplyIds = (Array.isArray(leadForThread?.activityLog) ? leadForThread.activityLog : [])
        .filter((event) => event?.type === 'communication.email.reply_received' && String(event?.metadata?.threadId || '') === String(record.threadId))
        .map((event) => String(event?.metadata?.messageId || '')).filter(Boolean);
      const seen = new Set([...(Array.isArray(record.replyMessageIds) ? record.replyMessageIds : []), ...historyReplyIds]);
      const sentAt = Date.parse(record.sentAt || '') || 0;
      for (const message of messages) {
        const messageId = String(message?.id || '');
        if (!messageId || messageId === record.messageId || seen.has(messageId)) continue;
        const messageAt = Number(message.internalDate) || Date.parse(safeEmailHeader(message, 'Date')) || 0;
        if (messageAt && sentAt && messageAt <= sentAt) continue;
        const from = safeEmailHeader(message, 'From');
        const fromEmail = extractEmailAddress(from);
        if (!fromEmail || (ownEmail && fromEmail === ownEmail)) continue;
        const subject = safeEmailHeader(message, 'Subject') || record.subject || '';
        const snippet = String(message.snippet || '').replace(/[\r\n\0]/g, ' ').trim().slice(0, 500);
        const receivedAt = messageAt ? new Date(messageAt).toISOString() : new Date().toISOString();
        const leadIdValue = String(record.leadId || '');
        const lead = leadForThread;
        const sellerId = String(record.sellerId || lead?.commercialOwnerId || '');
        const updatedLead = await recordCrmCommunicationActivity(leadIdValue, {
          id: `gmail_reply_${messageId}`,
          type: 'communication.email.reply_received', title: 'Resposta recebida por e-mail',
          description: `De: ${from} · Assunto: ${subject}${snippet ? ` · Trecho: ${snippet}` : ''}`.slice(0, 500),
          actor: 'Gmail', metadata: { channel: 'email', provider: 'gmail', from: fromEmail, subject, messageId, threadId: record.threadId, receivedAt, sellerId, snippet },
        });
        seen.add(messageId);
        replies++;
        record.replyCount = Number(record.replyCount || 0) + 1;
        record.lastReplyAt = receivedAt;
        record.replyMessageIds = [...seen].slice(-50);
        record.replyHistoryRecorded = !!updatedLead;
      }
      changedRecords.set(record.requestId, record);
    } catch (error) {
      record.replySyncError = String(error?.code || 'GMAIL_REPLY_SYNC_FAILED').slice(0, 80);
      changedRecords.set(record.requestId, record);
    }
  }
  if (changedRecords.size) {
    const latest = await getOne(K.CRM_EMAIL_SENDS, []);
    const byId = new Map(changedRecords);
    const mergedMap = new Map((Array.isArray(latest) ? latest : []).map((item) => [String(item.requestId || ''), item]).filter(([id]) => !!id));
    for (const [id, item] of byId) mergedMap.set(String(id), item);
    const merged = [...mergedMap.values()].sort((a, b) => (Date.parse(b.sentAt || b.startedAt || '') || 0) - (Date.parse(a.sentAt || a.startedAt || '') || 0));
    await setStore({ [K.CRM_EMAIL_SENDS]: merged.slice(0, 200) });
  }
  return { success: true, data: { checked, replies, accountEmail: String(profile?.emailAddress || '').slice(0, 254) } };
}

async function buildCrmCommunicationMetrics() {
  const leads = await getLeads();
  const sends = await getOne(K.CRM_EMAIL_SENDS, []);
  const commercialConfig = await getOne('commercialManagementConfig', {});
  const sellerNames = new Map((Array.isArray(commercialConfig?.sellers) ? commercialConfig.sellers : []).map((seller) => [String(seller.id), String(seller.name || '')]));
  const totals = { whatsappOpened: 0, emailSent: 0, emailReplies: 0, emailFailed: 0, emailUncertain: 0, emailOptOuts: 0 };
  const bySeller = new Map();
  const recordedEmailRequests = new Set();
  const sellerBucket = (id, name) => {
    const key = String(id || 'unassigned');
    if (!bySeller.has(key)) bySeller.set(key, { sellerId: key, sellerName: String(name || (key === 'unassigned' ? 'Sem vendedor' : key)).slice(0, 100), whatsappOpened: 0, emailSent: 0, emailReplies: 0, emailFailed: 0 });
    return bySeller.get(key);
  };
  for (const lead of leads) {
    const sellerId = String(lead.commercialOwnerId || 'unassigned');
    const sellerName = String(sellerNames.get(sellerId) || lead.commercialOwnerName || lead.ownerName || '');
    const bucket = sellerBucket(sellerId, sellerName);
    if (lead.emailOptedOut === true || lead.emailConsentStatus === 'opted_out') totals.emailOptOuts++;
    for (const event of (Array.isArray(lead.activityLog) ? lead.activityLog : [])) {
      const type = String(event?.type || '');
      const eventSellerId = String(event?.metadata?.sellerId || sellerId);
      const eventBucket = sellerBucket(eventSellerId, sellerName);
      if (type === 'communication.whatsapp.opened') { totals.whatsappOpened++; eventBucket.whatsappOpened++; }
      if (type === 'communication.email.sent') {
        totals.emailSent++; eventBucket.emailSent++;
        if (event?.metadata?.requestId) recordedEmailRequests.add(String(event.metadata.requestId));
      }
      if (type === 'communication.email.reply_received') { totals.emailReplies++; eventBucket.emailReplies++; }
      if (type === 'communication.email.failed') {
        const uncertain = event?.metadata?.status === 'uncertain';
        if (uncertain) totals.emailUncertain++; else { totals.emailFailed++; eventBucket.emailFailed++; }
        if (event?.metadata?.requestId) recordedEmailRequests.add(String(event.metadata.requestId));
      }
    }
  }
  for (const record of Array.isArray(sends) ? sends : []) {
    const sellerId = String(record.sellerId || 'unassigned');
    const sellerName = String(sellerNames.get(sellerId) || '');
    const bucket = sellerBucket(sellerId, sellerName);
    if (!recordedEmailRequests.has(String(record.requestId || ''))) {
      if (record.status === 'sent') { totals.emailSent++; bucket.emailSent++; }
      if (record.status === 'failed') { totals.emailFailed++; bucket.emailFailed++; }
      if (record.status === 'uncertain') totals.emailUncertain++;
    }
  }
  const sellerRows = [...bySeller.values()].filter((item) => item.whatsappOpened || item.emailSent || item.emailReplies || item.emailFailed);
  return { ...totals, bySeller: sellerRows.sort((a, b) => b.emailSent + b.whatsappOpened - (a.emailSent + a.whatsappOpened)), generatedAt: new Date().toISOString() };
}
async function openWhatsAppChatForCrm(payload = {}, { requireLead = false } = {}) {
  const id = String(payload?.id || payload?.leadId || '');
  const leads = await getLeads();
  const lead = id ? leads.find((item) => String(leadId(item)) === id) : null;
  if (requireLead && id && !lead) return { success: false, code: 'LEAD_NOT_FOUND', error: 'Lead não encontrado. Atualize o CRM e tente novamente.' };
  const phone = normWaPhone(lead?.phone || payload?.phone || '');
  if (phone.length < 10 || phone.length > 15) {
    return { success: false, code: 'CONTACT_PHONE_MISSING', error: 'Este lead não possui um telefone válido para abrir a conversa. Atualize o cadastro antes de continuar.' };
  }
  let wa;
  try {
    wa = await requireWhatsApp();
  } catch {
    const opened = await handlers.WA_OPEN_NEW_TAB();
    if (!opened?.success || !opened.data?.tabId) return { success: false, error: opened?.error || 'Não foi possível abrir o WhatsApp Web.' };
    if (!opened.data.reused) await waitTabComplete(opened.data.tabId, 20000);
    for (let attempt = 0; attempt < 30; attempt++) {
      const connection = await waConnection();
      if (connection.state === 'connected') {
        wa = { tab: await chrome.tabs.get(connection.tabId), frameId: connection.frameId, conn: connection };
        break;
      }
      if (connection.state === 'qr') {
        return { success: false, code: 'WHATSAPP_NEEDS_LOGIN', error: 'O WhatsApp Web foi aberto, mas precisa ser conectado. Escaneie o QR code e clique em “Chamar no WhatsApp” novamente.' };
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!wa) return { success: false, code: 'WHATSAPP_NOT_READY', error: 'O WhatsApp Web ainda não ficou pronto. Aguarde a conexão e tente novamente.' };
  }

  const waChatId = String(lead?.waChatId || payload?.waChatId || '').slice(0, 180);
  
  // Foca a janela do Chrome que contém a aba do WhatsApp
  await chrome.windows.update(wa.tab.windowId, { focused: true });
  
  // Direciona a aba aberta do WhatsApp diretamente para a API Send do Web e a coloca em primeiro plano
  await chrome.tabs.update(wa.tab.id, { 
      url: `https://web.whatsapp.com/send/?phone=${phone}&text=`, 
      active: true 
  });
  
  const result = { success: true };

  if (!result?.success) return result || { success: false, error: 'Não foi possível abrir a conversa.' };
  const updatedLead = id && lead ? await recordCrmCommunicationActivity(id, {
    type: 'communication.whatsapp.opened', title: 'Conversa aberta no WhatsApp',
    description: `Conversa de ${String(lead?.name || phone).slice(0, 120)} aberta pelo CRM. Nenhuma mensagem foi enviada automaticamente.`,
          metadata: { channel: 'whatsapp', phone, waChatId, opened: true, sellerId: String(lead?.commercialOwnerId || '') },
  }) : null;
  return { success: true, data: { phone, waChatId, header: result.data?.header || '', lead: updatedLead || undefined } };
}

const handlers = {
  // ---- Licença / uso
  async VALIDATE_LICENSE(p) { return activateLicense(p?.key ?? p?.licenseKey); },
  async ACTIVATE_LICENSE(p) { return activateLicense(p?.key ?? p?.licenseKey); },
  async REMOVE_LICENSE() { await deactivateLicense(); return { success: true, data: await buildLicenseStatus() }; },
  async GET_LICENSE_STATUS() { return { success: true, data: await buildLicenseStatus() }; },
  async GET_USAGE_STATUS() { const state = await getLicenseState(); return { success: true, data: usageForLicense(state.licensed) }; },
  async GET_LICENSE_LINK() { return { success: true, data: { whatsappUrl: whatsappLink(), number: '+55 11 95472-1939' } }; },
  async GET_FEATURE_CATALOG() { return { success: true, data: FEATURE_CATALOG.map((feature) => ({ ...feature })) }; },
  async ADMIN_GET_CONFIG() { return fetchAdminConfig(); },
  async ADMIN_REFRESH_CONFIG() { return fetchAdminConfig(); },

  // ---- Atendimento com IA (preferências sincronizadas; chaves BYOK só saem criptografadas com senha do usuário)
  async AI_GET_CONFIG() {
    const config = await getAiConfigInternal();
    const syncMeta = await getStore(['driveSync', 'aiSupportConfigSyncPassphrase', 'aiSupportConfigSyncEnvelope', 'aiSupportConfigSyncStatus']);
    return { success: true, data: { ...publicAiConfig(config), sync: {
      driveConnected: syncMeta.driveSync?.enabled === true,
      passphraseConfigured: !!syncMeta.aiSupportConfigSyncPassphrase,
      secretBackupAvailable: !!syncMeta.aiSupportConfigSyncEnvelope,
      hasLocalKeys: !!(config.apiKey || (Array.isArray(config.fallbackProviders) && config.fallbackProviders.some((item) => item?.apiKey))),
      status: syncMeta.aiSupportConfigSyncStatus || null,
    } } };
  },
  async AI_LIST_MODELS(p) { return { success: true, data: await listAiProviderModels(p || {}) }; },
  async AI_SAVE_CONFIG(p) {
    const current = await getAiConfigInternal();
    const config = sanitizeAiConfig(p || {}, current);
    if (p?.apiKey) config.apiKey = String(p.apiKey).trim().slice(0, 500);
    const licenseState = await getLicenseState();
    const observerConfigured = aiConfigHasObserver(config);
    if (observerConfigured && (!licenseState.licensed || !hasFeatureEntitlement(licenseState.payload?.ent, 'ai.mode.observe_only'))) {
      return { success: false, code: 'FEATURE_NOT_INCLUDED', featureId: 'ai.mode.observe_only', error: 'A licença atual não libera a IA observadora. Solicite a inclusão da funcionalidade no painel administrativo.' };
    }
    if ((config.personaMode === 'self_knowledge' && normalizeAiOperationMode(config.operationMode) === AI_OPERATION_MODES.OBSERVE_ONLY) || (Array.isArray(config.aiPersonas) ? config.aiPersonas : []).some((persona) => persona?.mode === 'self_knowledge' && normalizeAiOperationMode(persona?.operationMode) === AI_OPERATION_MODES.OBSERVE_ONLY)) {
      return { success: false, code: 'AI_OBSERVER_PERSONA_NOT_ALLOWED', error: 'O modo observador não pode ser usado em perfis de autoconhecimento. Escolha Networking ou Comercial.' };
    }
    config.enabled = current.enabled === true && config.providerVerified === true;
    await setStore({ [AI_CONFIG_KEY]: config });
    await recordTelemetry('ai.configuration.saved', 'whatsapp.ai_support.configure', { provider: config.provider, success: true });
    return { success: true, data: publicAiConfig(config) };
  },
  async AI_CLEAR_KEY() {
    const config = await getAiConfigInternal(); config.apiKey = ''; config.providerVerified = false; config.enabled = false;
    config.fallbackProviders = (Array.isArray(config.fallbackProviders) ? config.fallbackProviders : []).map((item) => ({ ...item, apiKey: '', verified: false, lastError: '' }));
    config.updatedAt = new Date().toISOString(); await setStore({ [AI_CONFIG_KEY]: config, [AI_HEARTBEAT_KEY]: 0 });
    await recordTelemetry('ai.api_key.cleared', 'whatsapp.ai_support.configure', { success: true }); return { success: true, data: publicAiConfig(config) };
  },
  async AI_TEST_PROVIDER() {
    const config = await getAiConfigInternal();
    const prompt = 'Você está testando uma conexão. Responda somente OK.';
    const messages = [{ role: 'user', content: 'Responda somente com a palavra OK.' }];
    const answer = await callAiProvider(config, messages, prompt);
    config.providerVerified = true; config.providerLastError = ''; config.providerCooldownUntil = 0;
    const fallbacks = Array.isArray(config.fallbackProviders) ? config.fallbackProviders : [];
    let fallbackTested = 0;
    for (const profile of fallbacks) {
      if (!profile?.apiKey || !profile?.model) continue;
      try {
        await callAiProvider({ ...config, ...profile }, messages, prompt);
        profile.verified = true; profile.lastError = ''; profile.cooldownUntil = 0; fallbackTested++;
      } catch (error) {
        profile.verified = false;
        profile.lastError = String(error?.message || error).replace(/(?:Bearer\s+)[A-Za-z0-9._~-]+/ig, 'Bearer [oculto]').replace(profile.apiKey || '\u0000', '[chave ocultada]').slice(0, 180);
        profile.cooldownUntil = Date.now() + aiProviderCooldownMs(profile.lastError);
      }
    }
    await setStore({ [AI_CONFIG_KEY]: config });
    await recordTelemetry('ai.provider.tested', 'whatsapp.ai_support.configure', { provider: config.provider, success: true });
    return { success: true, data: { provider: config.provider, model: config.model, response: answer.slice(0, 80), fallbackTested, fallbackTotal: fallbacks.filter((x) => x?.apiKey && x?.model).length, fallbackResults: fallbacks.map((x) => ({ id: x.id, provider: x.provider, model: x.model, verified: x.verified === true, error: x.lastError || '' })) } };
  },
  async AI_TEST_SHEETS() {
    const config = await getAiConfigInternal();
    const data = await sheetsFetch(config, '?fields=spreadsheetId,properties.title,sheets.properties.title', { method: 'GET' }, true);
    const tabNames = (data?.sheets || []).map((x) => x.properties?.title).filter(Boolean);
    if (!tabNames.includes(config.sheetTab)) throw new Error(`A aba \"${config.sheetTab}\" não existe na planilha. Crie a aba ou corrija o nome antes de ativar.`);
    config.sheetsVerified = true; await setStore({ [AI_CONFIG_KEY]: config });
    await recordTelemetry('ai.sheets.tested', 'whatsapp.ai_support.google_sheets', { success: true });
    return { success: true, data: { title: data?.properties?.title || '', tabs: tabNames, spreadsheetId: config.sheetId } };
  },
  async AI_CONNECT_HISTORY() { return await connectAiConversationHistory(); },
  async AI_SET_HISTORY_ENABLED(p) {
    const enabled = p?.enabled === true;
    if (enabled && !await chrome.permissions.contains({ origins: ['https://sheets.googleapis.com/*'] })) return { success: false, error: 'Autorize o acesso ao Google Sheets e tente novamente.' };
    const config = await getAiConfigInternal();
    if (enabled && !config.historySheetId) return { success: false, error: 'Crie ou conecte a planilha de histórico antes de ativar o registro.' };
    config.historyEnabled = enabled; config.historyLastError = ''; config.historyUpdatedAt = new Date().toISOString();
    await setStore({ [AI_CONFIG_KEY]: config });
    if (enabled) { await chrome.alarms.create('i9-ai-history-flush', { periodInMinutes: 5 }); flushAiHistoryQueue().catch(() => {}); }
    return { success: true, data: { historyEnabled: enabled, historySheetId: config.historySheetId, historySheetUrl: config.historySheetUrl } };
  },
  async AI_HISTORY_SYNC_NOW() {
    const config = await getAiConfigInternal();
    if (!config.historySheetId) return { success: false, error: 'Crie ou conecte uma planilha de histórico primeiro.' };
    await queueAllAiLeadsForSheetSync();
    const result = await flushAiHistoryQueue();
    if (result?.error) return { success: false, error: result.error, data: result };
    return { success: true, data: result };
  },
  async AI_SET_ENABLED(p) {
    const config = applyActiveAiPersona(await getAiConfigInternal());
    const enabled = p?.enabled === true;
    if (enabled) {
      const licenseState = await getLicenseState();
      const observerConfigured = aiConfigHasObserver(config);
      if (observerConfigured && !hasFeatureEntitlement(licenseState.payload?.ent, 'ai.mode.observe_only')) return { success: false, code: 'FEATURE_NOT_INCLUDED', featureId: 'ai.mode.observe_only', error: 'A licença atual não libera a IA observadora.' };
      const missing = [];
      if (!config.apiKey) missing.push('chave de API do provedor principal');
      if (!config.model) missing.push('modelo de IA');
      if (!config.providerVerified) missing.push('teste bem-sucedido do provedor principal');
      if (!config.businessName) missing.push('nome da empresa');
      if (!config.prompt || !config.knowledge) missing.push('instruções e base de conhecimento');
      try { const endpoint = aiEndpoint(config); if (!await chrome.permissions.contains({ origins: [`${endpoint.origin}/*`] })) missing.push('permissão de acesso ao provedor principal (clique em Autorizar e testar)'); } catch { missing.push('endpoint válido do provedor principal'); }
      for (const profile of (Array.isArray(config.fallbackProviders) ? config.fallbackProviders : [])) {
        if (!profile?.apiKey || !profile?.model) continue;
        try { const endpoint = aiEndpoint({ ...config, ...profile }); if (!await chrome.permissions.contains({ origins: [`${endpoint.origin}/*`] })) missing.push(`permissão para o provedor reserva ${profile.provider} (clique em Autorizar e testar)`); }
        catch { missing.push(`endpoint válido para o provedor reserva ${profile.provider}`); }
      }
      const waState = await waConnection().catch(() => ({ state: 'none' }));
      if (waState.state !== 'connected') missing.push('WhatsApp Web conectado');
      if (missing.length) return { success: false, code: 'AI_SETUP_INCOMPLETE', error: `Antes de ativar, configure: ${missing.join(', ')}.` };
    }
    config.enabled = enabled; config.updatedAt = new Date().toISOString();
    await setStore({ [AI_CONFIG_KEY]: config, [AI_HEARTBEAT_KEY]: enabled ? Date.now() : 0 });
    await recordTelemetry(enabled ? 'ai.attendance.enabled' : 'ai.attendance.paused', 'whatsapp.ai_support', { success: true });
    return { success: true, data: { enabled, runtimeActive: enabled && Date.now() - Number(await getOne(AI_HEARTBEAT_KEY, 0)) < AI_HEARTBEAT_TTL_MS } };
  },
  async AI_HEARTBEAT(p) {
    const heartbeatAt = p?.active === false ? 0 : Date.now();
    await setStore({ [AI_HEARTBEAT_KEY]: heartbeatAt });
    if (p?.active !== false) drainAiIncomingQueue().catch(() => {});
    return { success: true, data: { heartbeatAt } };
  },
  async AI_GET_STATUS() {
    await recoverAiIncomingQueueOnce().catch(() => {});
    const config = applyActiveAiPersona(await getAiConfigInternal()); const heartbeat = Number(await getOne(AI_HEARTBEAT_KEY, 0));
    const orders = await getOne(AI_ORDERS_KEY, []); const handoffs = await getOne(AI_HANDOFFS_KEY, []); const wa = await waConnection().catch(() => ({ state: 'none' }));
    const licenseState = await getLicenseState();
    const operationMode = normalizeAiOperationMode(config.operationMode);
    const observerEntitled = !aiConfigHasObserver(config) || hasFeatureEntitlement(licenseState.payload?.ent, 'ai.mode.observe_only');
    const panelActive = heartbeat > 0 && Date.now() - heartbeat < AI_HEARTBEAT_TTL_MS;
    const queue = await getOne(AI_HISTORY_QUEUE_KEY, []);
    const leadSyncQueue = await getOne(AI_LEAD_SYNC_QUEUE_KEY, []);
    const lastProcessingStatus = await getOne('aiSupportLastProcessingStatus', null);
    const storeWatcherRaw = await getOne('aiSupportStoreWatcher', null);
    const setupMissing = []; if (!config.businessName) setupMissing.push('nome da empresa'); if (!config.prompt) setupMissing.push('instruções'); if (!config.knowledge) setupMissing.push('base de conhecimento'); if (!observerEntitled) setupMissing.push('licença com IA observadora');
    const historyPermissionGranted = await chrome.permissions.contains({ origins: ['https://sheets.googleapis.com/*'] }).catch(() => false);
    const monitorEvents = await getOne(AI_MONITOR_EVENTS_KEY, []);
    const monitoring = summarizeAiMonitorEvents(Array.isArray(monitorEvents) ? monitorEvents : []);
    const incomingQueue = await getOne(AI_INCOMING_QUEUE_KEY, []);
    const incomingQueueRows = Array.isArray(incomingQueue) ? incomingQueue : [];
    const incomingQueueCount = activeAiQueueCount(incomingQueueRows);
    const incomingQueueNeedsAttentionCount = reviewAiQueueCount(incomingQueueRows);
    const conversationMemoryCount = Object.keys(config.conversationMemory && typeof config.conversationMemory === 'object' ? config.conversationMemory : {}).length;
    aiPendingInboundCount = incomingQueueCount;
    return { success: true, data: { enabled: config.enabled === true, operationMode, personaMode: config.personaMode || 'commercial', observerEntitled, whatsappConnected: wa.state === 'connected', panelActive, runtimeActive: config.enabled === true && observerEntitled && panelActive && wa.state === 'connected', provider: config.provider || '', model: config.model || '', apiKeyConfigured: !!String(config.apiKey || '').trim(), modelConfigured: !!String(config.model || '').trim(), providerVerified: config.providerVerified === true, providerLastError: String(config.providerLastError || ''), heartbeatAt: heartbeat || null, lastActivity: await getOne('aiSupportLastActivityAt', null), lastProvider: await getOne('aiSupportLastProvider', null), lastProcessingStatus, storeWatcher: storeWatcherRaw ? { ok: storeWatcherRaw.ok === true, via: storeWatcherRaw.via || '', chats: storeWatcherRaw.chats || 0, reason: storeWatcherRaw.reason || '', at: storeWatcherRaw.at || 0, active: storeWatcherRaw.ok === true && Date.now() - Number(storeWatcherRaw.at || 0) < 45000 } : null, setupMissing, historyEnabled: config.historyEnabled === true, historySheetId: config.historySheetId || '', historySheetUrl: config.historySheetUrl || '', historyPermissionGranted, historyLastSyncAt: config.historyLastSyncAt || null, historyLastError: config.historyLastError || '', historyQueueCount: Array.isArray(queue) ? queue.length : 0, leadSyncQueueCount: Array.isArray(leadSyncQueue) ? leadSyncQueue.length : 0, pendingInboundCount: incomingQueueCount, incomingQueueCount, incomingQueueNeedsAttentionCount, conversationMemoryCount, ordersTotal: orders.length, pendingOrders: orders.filter((x) => ['awaiting_approval','error'].includes(x.status)).length, pendingHandoffs: handoffs.filter((h) => h.active).length, monitoring } };
  },
  async AI_GET_ORDERS() { return { success: true, data: (await getOne(AI_ORDERS_KEY, [])).slice(0, 100) }; },
  async AI_GET_HANDOFFS() { return { success: true, data: (await getOne(AI_HANDOFFS_KEY, [])).filter((h) => h.active).slice(0, 100) }; },
  async AI_RENOTIFY_SELLER(p) {
    const orders = await getOne(AI_ORDERS_KEY, []); const order = orders.find((x) => x.id === p?.orderId);
    if (!order) return { success: false, error: 'Pedido não encontrado.' };
    const config = await getAiConfigInternal(); if (!config.sellerPhone) return { success: false, error: 'Configure o número separado do vendedor.' };
    const wa = await requireWhatsApp();
    const sheetState = order.sheetRecorded ? 'Planilha registrada' : 'Planilha pendente de registro — conferir no computador do atendimento';
    const notice = `AVISO DE PEDIDO — ${order.id}\nCliente: ${order.customerName || 'Cliente'}\nServiço: ${order.service || 'Solicitação'}\nDetalhes: ${String(order.details || '').slice(0, 600)}\nStatus: ${order.status === 'closed_won' ? 'Venda fechada' : order.status === 'approved' ? 'Aprovado' : order.status === 'error' ? 'Erro de registro' : 'Aguardando análise'}\n${sheetState}\nAviso enviado pelo i9Leads Flow.`;
    const sent = await sendToTabEnsured(wa.tab, 'whatsapp', { type: 'AI_SEND_TO_PHONE', payload: { phone: config.sellerPhone, text: notice } }, wa.frameId);
    if (!sent?.success) return { success: false, error: sent?.error || 'O WhatsApp não confirmou o aviso.' };
    order.sellerNotificationStatus = order.sheetRecorded ? 'sent' : 'sent_pending_sheet'; order.sellerNotifiedAt = new Date().toISOString(); await setStore({ [AI_ORDERS_KEY]: orders });
    await recordTelemetry('ai.seller_notification.resent', 'whatsapp.ai_support.order_capture', { success: true, count: 1 });
    return { success: true, data: { order } };
  },
  async AI_RETRY_ORDER_WRITE(p) {
    const orders = await getOne(AI_ORDERS_KEY, []); const order = orders.find((x) => x.id === p?.orderId);
    if (!order) return { success: false, error: 'Pedido não encontrado.' };
    if (order.sheetRecorded) return { success: true, data: { order, alreadyRecorded: true } };
    try {
      const config = await getAiConfigInternal(); const result = await appendAiOrder(config, order);
      order.sheetRange = result.updatedRange; order.sheetRecorded = true; order.sheetError = ''; if (order.status === 'error') order.status = 'awaiting_approval'; order.updatedAt = new Date().toISOString();
      if (order.sellerNotificationStatus === 'sent_pending_sheet') order.sellerNotificationStatus = 'pending';
      await setStore({ [AI_ORDERS_KEY]: orders }); await recordTelemetry('ai.order.sheet_retry_succeeded', 'whatsapp.ai_support.google_sheets', { success: true, count: 1 });
      return { success: true, data: { order, alreadyRecorded: !!result.alreadyPresent } };
    } catch (error) {
      order.sheetError = String(error?.message || error).slice(0, 200); order.updatedAt = new Date().toISOString(); await setStore({ [AI_ORDERS_KEY]: orders });
      await recordTelemetry('ai.order.sheet_retry_failed', 'whatsapp.ai_support.google_sheets', { success: false });
      return { success: false, error: `A planilha ainda não recebeu o pedido. O pedido continua salvo localmente para nova tentativa. ${order.sheetError}` };
    }
  },
  async AI_RESUME_CHAT(p) { const handoffs = await getOne(AI_HANDOFFS_KEY, []); const h = handoffs.find((x) => x.id === p?.handoffId && x.active); if (!h) return { success: false, error: 'Transferência humana não encontrada ou já encerrada.' }; h.active = false; h.resumedAt = new Date().toISOString(); h.resumedBy = 'user'; await setStore({ [AI_HANDOFFS_KEY]: handoffs }); await recordTelemetry('ai.handoff.resumed', 'whatsapp.ai_support.human_handoff', { success: true, count: 1 }); return { success: true }; },
  async AI_UPDATE_ORDER_STATUS(p) {
    const allowed = new Set(['awaiting_approval','approved','rejected','in_progress','closed_won']);
    const status = String(p?.status || ''); if (!allowed.has(status)) return { success: false, error: 'Status do pedido inválido.' };
    const orders = await getOne(AI_ORDERS_KEY, []); const order = orders.find((x) => x.id === p?.orderId);
    if (!order) return { success: false, error: 'Pedido não encontrado.' };
    const wasClosed = order.status === 'closed_won';
    if (status === 'closed_won' && p?.saleValue !== undefined && p?.saleValue !== null && p?.saleValue !== '') {
      const value = Number(p.saleValue); if (!Number.isFinite(value) || value < 0 || value > 1e12) return { success: false, error: 'Valor de venda inválido.' };
      order.saleValue = Math.round(value * 100) / 100;
    }
    order.status = status; order.updatedAt = new Date().toISOString();
    let sheetUpdated = false;
    try { const config = await getAiConfigInternal(); sheetUpdated = await updateAiOrderSheet(config, order, status); } catch { /* mantém status local e informa */ }
    await setStore({ [AI_ORDERS_KEY]: orders });
    if (status === 'closed_won' && !wasClosed) await recordTelemetry('crm.sale.closed', 'telemetry.sales_funnel', { success: true, count: 1, ...(Number.isFinite(Number(order.saleValue)) ? { value: Number(order.saleValue) } : {}) });
    else if (status === 'approved') await recordTelemetry('ai.order.approved', 'whatsapp.ai_support.order_capture', { success: true, count: 1 });
    return { success: true, data: { order, sheetUpdated } };
  },

  // ---- Públicos de Status por etiquetas (dados locais; não publica Status automaticamente)
  async GET_WA_LABELS() {
    const wa = await requireWhatsApp();
    const r = await sendToTabEnsured(wa.tab, 'whatsapp', { type: 'LABELS_LIST', payload: {} }, wa.frameId);
    if (!r?.success) return r;
    const raw = r.data || {};
    return { success: true, data: { labels: Array.isArray(raw.labels) ? raw.labels.filter((l) => l && !l.deleted).map((l) => ({ id: String(l.id), name: String(l.name || '').slice(0, 100), color: String(l.color || '') })) : [], contacts: Array.isArray(raw.contacts) ? raw.contacts.map((c) => ({ name: String(c.name || '').slice(0, 160), phone: normalizePhoneSafe(c.phone), labelIds: Array.isArray(c.labelIds) ? c.labelIds.map(String) : [] })).filter((c) => c.labelIds.length) : [] } };
  },
  async AUDIENCE_GET() { return { success: true, data: { audiences: await getOne(AUDIENCES_KEY, []) } }; },
  async AUDIENCE_SAVE(p) {
    const a = p?.audience || {}; const name = String(a.name || '').trim().slice(0, 100); const labelIds = [...new Set((Array.isArray(a.labelIds) ? a.labelIds : []).map(String).filter((x) => x.length < 160))];
    if (!name || !labelIds.length) return { success: false, error: 'Informe o nome e selecione pelo menos uma etiqueta.' };
    const list = await getOne(AUDIENCES_KEY, []); const entry = { id: String(a.id || uid('aud')).slice(0, 100), name, labelIds, mode: a.mode === 'all' ? 'all' : 'any', createdAt: a.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), estimatedCount: Math.max(0, Number(a.estimatedCount) || 0) };
    entry.excludedKeys = [...new Set((Array.isArray(a.excludedKeys) ? a.excludedKeys : []).map(String).filter((x) => /^c_[a-f0-9]{1,16}$/i.test(x)))].slice(0, 1000);
    const index = list.findIndex((x) => x.id === entry.id); if (index >= 0) list[index] = entry; else list.unshift(entry);
    await setStore({ [AUDIENCES_KEY]: list.slice(0, 100) }); await recordTelemetry('whatsapp.status_audience.saved', 'whatsapp.status_audience', { success: true, count: entry.estimatedCount });
    return { success: true, data: entry };
  },
  async AUDIENCE_DELETE(p) { const list = await getOne(AUDIENCES_KEY, []); const next = list.filter((x) => x.id !== p?.id); await setStore({ [AUDIENCES_KEY]: next }); return { success: true, data: { removed: list.length - next.length } }; },
  async AUDIENCE_EXPORT(p) {
    const csv = String(p?.csv || ''); if (!csv || csv.length > 5_000_000) return { success: false, error: 'CSV vazio ou maior que o limite de exportação.' };
    const filename = String(p?.filename || 'publico-status.csv').replace(/[^\w.-]/g, '_').slice(0, 120);
    try { const downloadId = await chrome.downloads.download({ url: `data:text/csv;charset=utf-8,${encodeURIComponent('\ufeff' + csv)}`, filename, saveAs: true }); return { success: true, data: { downloadId } }; }
    catch { return { success: false, error: 'O Chrome não conseguiu iniciar o download do CSV.' }; }
  },

  // ---- Telemetria de uso e resultados comerciais
  async TELEMETRY_GET_PROFILE() { await ensureTelemetryConsentMigration(); return { success: true, data: { ...defaultTelemetryProfile(), ...(await getOne(TELEMETRY_PROFILE_KEY, {})) } }; },
  async TELEMETRY_SAVE_PROFILE(p) {
    await ensureTelemetryConsentMigration();
    const validIndustries = new Set(['','accounting','law','real_estate','marketing','sales','retail','services','health','education','other']);
    const validRoles = new Set(['','owner','manager','salesperson','operator','marketing','other']);
    const validSizes = new Set(['','solo','2-5','6-20','21+']);
    const profile = { industry: validIndustries.has(p?.industry) ? p.industry : '', role: validRoles.has(p?.role) ? p.role : '', companySize: validSizes.has(p?.companySize) ? p.companySize : '', consent: p?.consent === true, updatedAt: new Date().toISOString() };
    await setStore({ [TELEMETRY_PROFILE_KEY]: profile });
    if (!profile.consent) await setStore({ [TELEMETRY_QUEUE_KEY]: [] });
    return { success: true, data: profile };
  },
  async TELEMETRY_GET_STATUS() {
    const queue = await getOne(TELEMETRY_QUEUE_KEY, []); const counters = await getOne(TELEMETRY_COUNTERS_KEY, {}); const profile = { ...defaultTelemetryProfile(), ...(await getOne(TELEMETRY_PROFILE_KEY, {})) };
    return { success: true, data: { queueCount: queue.length, totalRecorded: Number(counters.total) || 0, lastActivityAt: counters.lastActivityAt || null, lastSentAt: counters.lastSentAt || null, endpointAvailable: counters.endpointAvailable, consent: profile.consent, events: counters.events || {}, snapshots: counters.snapshots || {} } };
  },
  async TELEMETRY_FLUSH_NOW() { return flushTelemetry(); },
  async TRACK_TELEMETRY_EVENT(p) { const name = String(p?.name || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80); if (!name) return { success: false, error: 'Evento inválido.' }; await recordTelemetry(name, String(p?.featureId || ''), p?.metadata || {}); return { success: true }; },

  // ---- Integrações de marketing (IDs públicos; segredos de conversão devem ficar no backend)
  async MARKETING_GET_CONFIG() { return { success: true, data: await getOne(MARKETING_CONFIG_KEY, {}) }; },
  async MARKETING_SAVE_CONFIG(p) {
    const config = { gtmId: String(p?.gtmId || '').trim().slice(0, 40), ga4Id: String(p?.ga4Id || '').trim().slice(0, 40), googleAdsId: String(p?.googleAdsId || '').trim().slice(0, 40), metaPixelId: String(p?.metaPixelId || '').trim().slice(0, 80), otherPixels: String(p?.otherPixels || '').slice(0, 1500), updatedAt: new Date().toISOString() };
    await setStore({ [MARKETING_CONFIG_KEY]: config });
    let synced = false; let syncMessage = 'Salvo localmente. O backend precisa implementar POST /api/v1/extension/marketing-config para sincronizar.';
    try {
      const state = await getLicenseState(); const token = await getOne(K.TOKEN, ''); const deviceId = await getDeviceId();
      const response = await fetch(`${BASE_URL}/extension/marketing-config`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Device-Id': deviceId }, body: JSON.stringify({ schemaVersion: 1, extVersion: EXT_VERSION, config }), credentials: 'omit', cache: 'no-store', redirect: 'error' });
      synced = response.ok; syncMessage = synced ? 'IDs salvos e sincronizados com o painel.' : `Salvo localmente; sincronização ainda não disponível (HTTP ${response.status}).`;
    } catch { /* configurações locais permanecem */ }
    await recordTelemetry('marketing.config.saved', 'marketing.tracking', { success: true });
    return { success: true, data: { config, synced, message: syncMessage } };
  },

  // ---- Settings
  async GET_SETTINGS() { const [settings, state] = await Promise.all([getSettings(), getLicenseState()]); return { success: true, data: filterSettingsByEntitlements(settings, state.payload?.ent) }; },
  async SAVE_SETTINGS(p) { await setStore({ [K.SETTINGS]: { ...(await getSettings()), ...(p || {}) } }); return { success: true }; },
  async SAVE_WEBHOOK_SETTINGS(p) { await setStore({ [K.SETTINGS]: { ...(await getSettings()), ...(p || {}) } }); return { success: true }; },

  // ---- Smart Business Profile (Tarefa 4)
  async GET_BUSINESS_PROFILE() {
    const profile = await getStoredBusinessProfile();
    return { success: true, data: { profile, configured: profile?.configured === true, summary: profileSummary(profile), version: BUSINESS_PROFILE_VERSION } };
  },
  async GET_BUSINESS_PROFILE_CATALOG() {
    return {
      success: true,
      data: {
        version: BUSINESS_PROFILE_VERSION,
        profiles: Object.values(BUSINESS_PROFILES).map((p) => ({
          id: p.id, name: p.name, icon: p.icon, description: p.description,
          modules: p.modules, fields: p.fields, pipeline: p.pipeline, terminology: p.terminology
        }))
      }
    };
  },
  async SAVE_BUSINESS_PROFILE(p) {
    const profile = p?.profile;
    if (!profile || typeof profile !== 'object') return { success: false, error: 'Perfil inválido.' };
    const safe = {
      ...profile,
      version: BUSINESS_PROFILE_VERSION,
      configured: true,
      name: String(profile.name || 'Meu negócio').slice(0, 100),
      description: String(profile.description || '').slice(0, 1000),
      modules: Array.isArray(profile.modules) ? [...new Set(profile.modules.map(String))] : [],
      fields: Array.isArray(profile.fields) ? profile.fields.slice(0, 100) : [],
      pipeline: Array.isArray(profile.pipeline) ? profile.pipeline.slice(0, 100) : [],
      updatedAt: new Date().toISOString(),
    };
    const settings = await getSettings();
    await setStore({ [K.SETTINGS]: { ...settings, businessProfile: safe } });

    // Estágios gerados pelo perfil são substituíveis sem apagar estágios de etiquetas do WhatsApp.
    const currentStages = await getCustomStages();
    const nonProfileStages = currentStages.filter((s) => !String(s?.id || '').startsWith('bp_'));
    const standardIds = new Set(DEFAULT_STAGES.map((s) => s.id));
    const profileStages = safe.pipeline
      .filter((s) => s && String(s.id || '').startsWith('bp_') && !standardIds.has(String(s.id)))
      .map((s) => ({ id: String(s.id), title: String(s.title || s.id).slice(0, 80), color: String(s.color || '#6366f1') }));
    await setStore({ [K.STAGES]: [...nonProfileStages, ...profileStages] });

    const classification = await classifyAllLeads({ force: true });
    broadcast('BUSINESS_PROFILE_UPDATED', { profile: safe, classificationChanged: classification.changed });
    return { success: true, data: { profile: safe, summary: profileSummary(safe), classificationChanged: classification.changed } };
  },
  async RESET_BUSINESS_PROFILE() {
    const settings = await getSettings();
    const next = { ...settings };
    delete next.businessProfile;
    await setStore({ [K.SETTINGS]: next });
    const currentStages = await getCustomStages();
    await setStore({ [K.STAGES]: currentStages.filter((s) => !String(s?.id || '').startsWith('bp_')) });
    const classification = await classifyAllLeads({ force: true });
    broadcast('BUSINESS_PROFILE_UPDATED', { profile: null, classificationChanged: classification.changed });
    return { success: true, data: { profile: null } };
  },

  async GET_WEBHOOK_CONFIG() {
    const s = await getSettings();
    return { success: true, data: { url: s.webhookUrl || '', method: s.webhookMethod || 'POST', headers: s.webhookHeaders || {}, apiKey: s.webhookApiKey || '' } };
  },
  async SAVE_WEBHOOK_CONFIG(p) {
    const s = await getSettings();
    await setStore({ [K.SETTINGS]: { ...s, webhookUrl: p?.url ?? s.webhookUrl, webhookMethod: p?.method ?? s.webhookMethod, webhookHeaders: p?.headers ?? s.webhookHeaders, webhookApiKey: p?.apiKey ?? s.webhookApiKey } });
    return { success: true };
  },
  async TEST_WEBHOOK(p) {
    try {
      const settings = await getSettings();
      const targetUrl = validateWebhookUrl(p?.url || settings.webhookUrl);
      let configuredUrl = '';
      try { configuredUrl = settings.webhookUrl ? validateWebhookUrl(settings.webhookUrl) : ''; } catch { configuredUrl = ''; }
      // Credenciais salvas só podem ser usadas no endereço exato que o usuário salvou.
      const sameConfiguredTarget = !!configuredUrl && targetUrl === configuredUrl;
      const testSettings = sameConfiguredTarget ? settings : {
        webhookMethod: 'POST', webhookContentType: 'application/json', webhookHeaders: {}, webhookApiKey: ''
      };
      const resp = await webhookRequest(targetUrl, [], testSettings, true);
      return { success: resp.ok, data: { status: resp.status }, error: resp.ok ? undefined : `HTTP ${resp.status}` };
    } catch (e) { return { success: false, error: String(e?.message || 'Falha no teste do webhook').slice(0, 240) }; }
  },
  async CLEAR_ALL_DATA() {
    // Mantém licença e identificador do dispositivo; a autorização não depende de contadores locais.
    await chrome.storage.local.remove([K.SETTINGS, K.LEADS, K.CAMPAIGNS]);
    return { success: true };
  },

  // ---- Leads / CRM
  async GET_SAVED_LEADS() {
    const r = await classifyAllLeads();
    const consents = await getConsentTracking();
    const data = r.leads.map((lead) => {
      const tail = phoneTail(lead.phone);
      const consent = tail ? consents[tail] : null;
      return consent ? { ...lead, consentStatus: consent.status, optedOut: consent.status === CONSENT_STATUS_OPTED_OUT } : lead;
    });
    return { success: true, data };
  },
  async SAVE_LEADS(p) { return saveLeads(p || {}); },
  async GET_LEAD_HISTORY(p) {
    const id = String(p?.leadId ?? '');
    const lead = (await getLeads()).find((item) => String(leadId(item)) === id);
    if (!lead) return { success: false, error: 'Lead não encontrado.' };
    const requestedLimit = Number(p?.limit) || 100;
    const limit = Math.max(1, Math.min(250, requestedLimit));
    return {
      success: true,
      data: {
        leadId: id,
        notes: normalizeCrmNotes(lead.notes),
        timeline: buildCrmTimeline(lead, { limit }),
      },
    };
  },
  async GET_CRM_EMAIL_STATUS() { return { success: true, data: await getCrmEmailStatus() }; },
  async SELECT_CRM_GMAIL_ACCOUNT(p) {
    const accountId = String(p?.accountId || 'default').slice(0, 200);
    const accounts = await getOne(K.GMAIL_ACCOUNTS, []);
    const list = Array.isArray(accounts) ? accounts : [];
    const found = list.find((item) => String(item.id) === accountId);
    const current = await getOne(K.GMAIL_STATUS, {});
    if (!found?.connected && String(current?.accountId || 'default') !== accountId) {
      await setStore({ [K.GMAIL_STATUS]: { connected: false, accountId, email: '', provider: 'gmail' } });
    } else if (found?.connected) {
      await setStore({ [K.GMAIL_STATUS]: { ...found, connected: true, accountId, provider: 'gmail' } });
    }
    return { success: true, data: await getCrmEmailStatus() };
  },
  async CONNECT_CRM_GMAIL(p) {
    if (!await chrome.permissions.contains({ origins: [GMAIL_ORIGIN] })) return { success: false, code: 'GMAIL_PERMISSION_REQUIRED', error: 'Autorize o acesso ao Gmail no aviso do Chrome e tente novamente.' };
    const accountId = String(p?.accountId || 'default').slice(0, 200);
    await getGmailToken(true, [GMAIL_SEND_SCOPE], accountId);
    // Mantém o escopo mínimo gmail.send: não consulta caixa de entrada nem perfil do Gmail.
    const identityAccounts = await listChromeIdentityAccounts();
    const label = accountId === 'default' ? 'Conta Google padrão' : `Conta Google ${Math.max(1, identityAccounts.findIndex((item) => item.id === accountId) + 1)}`;
    const saved = await getOne(K.GMAIL_ACCOUNTS, []);
    const accountList = Array.isArray(saved) ? saved.filter((item) => String(item.id) !== accountId) : [];
    const status = { id: accountId, accountId, label, connected: true, email: '', connectedAt: new Date().toISOString(), provider: 'gmail' };
    accountList.push(status);
    await setStore({ [K.GMAIL_ACCOUNTS]: accountList.slice(-10) });
    await setStore({ [K.GMAIL_STATUS]: status });
    await recordTelemetry('crm.email.connected', 'crm.communication.email', { success: true });
    return { success: true, data: await getCrmEmailStatus() };
  },
  async DISCONNECT_CRM_GMAIL(p) {
    const current = await getOne(K.GMAIL_STATUS, {});
    const accountId = String(p?.accountId || current?.accountId || 'default').slice(0, 200);
    for (const scopes of [[GMAIL_SEND_SCOPE], [GMAIL_SEND_SCOPE, GMAIL_READ_SCOPE]]) {
      try { const token = await getGmailToken(false, scopes, accountId); await dropGmailToken(token); } catch { /* desconexão local continua possível */ }
    }
    const saved = await getOne(K.GMAIL_ACCOUNTS, []);
    const accountList = (Array.isArray(saved) ? saved : []).map((item) => String(item.id) === accountId ? { ...item, connected: false, disconnectedAt: new Date().toISOString() } : item);
    await setStore({ [K.GMAIL_ACCOUNTS]: accountList, [K.GMAIL_STATUS]: { connected: false, accountId, email: '', disconnectedAt: new Date().toISOString(), provider: 'gmail' } });
    await recordTelemetry('crm.email.disconnected', 'crm.communication.email', { success: true });
    return { success: true, data: await getCrmEmailStatus() };
  },
  async GET_CRM_EMAIL_TEMPLATES() {
    const saved = normalizeCrmEmailTemplates(await getOne(K.CRM_EMAIL_TEMPLATES, []));
    const builtInIds = new Set(DEFAULT_CRM_EMAIL_TEMPLATES.map((item) => item.id));
    return { success: true, data: [...DEFAULT_CRM_EMAIL_TEMPLATES, ...saved.filter((item) => !builtInIds.has(item.id))] };
  },
  async SAVE_CRM_EMAIL_TEMPLATES(p) {
    const templates = normalizeCrmEmailTemplates(p?.templates || []);
    const builtInIds = new Set(DEFAULT_CRM_EMAIL_TEMPLATES.map((item) => item.id));
    const custom = templates.filter((item) => !builtInIds.has(item.id)).slice(0, 27).map((item) => ({ ...item, updatedAt: new Date().toISOString() }));
    await setStore({ [K.CRM_EMAIL_TEMPLATES]: custom });
    return { success: true, data: [...DEFAULT_CRM_EMAIL_TEMPLATES, ...custom] };
  },
  async GET_CRM_EMAIL_SIGNATURE(p) {
    const sellerId = String(p?.sellerId || 'default').slice(0, 100);
    return { success: true, data: { sellerId, signature: await getCrmEmailSignature(sellerId) } };
  },
  async SAVE_CRM_EMAIL_SIGNATURE(p) {
    const sellerId = String(p?.sellerId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100) || 'default';
    const text = String(p?.signature || '').replace(/\0/g, '').trim().slice(0, 2000);
    const signatures = normalizeCrmEmailSignatures(await getOne(K.CRM_EMAIL_SIGNATURES, {}));
    const now = new Date().toISOString();
    if (text) signatures[sellerId] = { text, updatedAt: now };
    else signatures[sellerId] = { text: '', updatedAt: now, deletedAt: now };
    await setStore({ [K.CRM_EMAIL_SIGNATURES]: signatures });
    return { success: true, data: { sellerId, signature: text } };
  },
  async SYNC_CRM_EMAIL_REPLIES(p) {
    const result = await syncCrmEmailReplies(p || {});
    if (!result?.success || !p?.leadId) return result;
    const lead = (await getLeads()).find((item) => String(leadId(item)) === String(p.leadId));
    return { ...result, data: { ...(result.data || {}), lead } };
  },
  async GET_CRM_COMMUNICATION_METRICS() { return { success: true, data: await buildCrmCommunicationMetrics() }; },
  async SET_CRM_EMAIL_CONSENT(p) {
    const id = String(p?.leadId || '');
    const status = String(p?.status || '');
    if (!id || !['opted_in', 'opted_out'].includes(status)) return { success: false, code: 'EMAIL_CONSENT_INVALID', error: 'Informe o lead e um status de autorização válido.' };
    if (status === 'opted_in' && (p?.confirmed !== true || String(p?.evidence || '').trim().length < 8)) return { success: false, code: 'EMAIL_CONSENT_EVIDENCE_REQUIRED', error: 'Para reativar, confirme que existe autorização e registre a evidência ou origem.' };
    const leads = await getLeads();
    const lead = leads.find((item) => String(leadId(item)) === id);
    if (!lead) return { success: false, code: 'LEAD_NOT_FOUND', error: 'Lead não encontrado.' };
    const now = new Date().toISOString();
    lead.emailOptedOut = status === 'opted_out';
    lead.emailConsentStatus = status;
    lead.emailConsentUpdatedAt = now;
    lead.emailConsentSource = String(p?.source || 'manual').slice(0, 80);
    lead.emailConsentEvidence = String(p?.evidence || (status === 'opted_out' ? 'Descadastro registrado manualmente no CRM.' : '')).slice(0, 500);
    lead.updatedAt = now;
    appendCrmActivity(lead, {
      type: status === 'opted_out' ? 'communication.email.opted_out' : 'communication.email.opted_in',
      title: status === 'opted_out' ? 'Descadastro de e-mail registrado' : 'Autorização de e-mail reativada',
      description: lead.emailConsentEvidence,
      actor: 'Usuário', source: 'communication', metadata: { channel: 'email', status, source: lead.emailConsentSource, updatedAt: now },
    });
    await putLeads(leads);
    return { success: true, data: { lead } };
  },
  async SEND_CRM_EMAIL(p) {
    const leadIdValue = String(p?.leadId || '');
    const requestId = String(p?.requestId || uid('crm_email')).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
    const to = normalizeCrmEmailAddress(p?.to);
    const subject = String(p?.subject || '').replace(/[\r\n\0]/g, ' ').trim().slice(0, CRM_EMAIL_MAX_SUBJECT);
    const body = String(p?.body || '').replace(/\0/g, '').trim().slice(0, CRM_EMAIL_MAX_BODY);
    const accountId = String(p?.accountId || 'default').slice(0, 200);
    const attachments = Array.isArray(p?.attachments) ? p.attachments : [];
    if (!leadIdValue) return { success: false, error: 'Lead não identificado para registrar o envio.' };
    if (!requestId) return { success: false, error: 'Identificador de envio inválido. Feche e abra o editor novamente.' };
    if (!to) return { success: false, error: 'Informe um endereço de e-mail válido.' };
    if (!subject) return { success: false, error: 'Informe o assunto do e-mail.' };
    if (!body) return { success: false, error: 'Escreva a mensagem antes de enviar.' };
    if (p?.authorized !== true) return { success: false, code: 'EMAIL_AUTHORIZATION_REQUIRED', error: 'Confirme que este contato pode receber o e-mail antes de enviar.' };
    const leadsBefore = await getLeads();
    const leadBefore = leadsBefore.find((item) => String(leadId(item)) === leadIdValue);
    if (!leadBefore) return { success: false, code: 'LEAD_NOT_FOUND', error: 'Lead não encontrado. Atualize o CRM e tente novamente.' };
    if (leadBefore.emailOptedOut === true || leadBefore.emailConsentStatus === 'opted_out') {
      return { success: false, code: 'EMAIL_OPTED_OUT', error: 'Este lead solicitou descadastro de e-mail. O i9Hub bloqueou o envio.' };
    }
    const sendRecords = await getOne(K.CRM_EMAIL_SENDS, []);
    const previous = (Array.isArray(sendRecords) ? sendRecords : []).find((item) => item.requestId === requestId);
    if (previous?.status === 'sent') return { success: true, duplicate: true, data: previous };
    if (previous?.status === 'processing' || previous?.status === 'uncertain') {
      return { success: false, code: 'EMAIL_SEND_UNCERTAIN', error: 'Já existe uma tentativa com este identificador. Confira a pasta Enviados do Gmail antes de iniciar outro envio.' };
    }
    if (crmEmailSendInFlight.has(requestId)) return { success: false, code: 'EMAIL_SEND_IN_PROGRESS', error: 'Este e-mail já está sendo processado.' };
    const status = await getCrmEmailStatus();
    const selectedStatus = await getOne(K.GMAIL_STATUS, {});
    if (!status.connected || String(selectedStatus?.accountId || 'default') !== accountId) return { success: false, code: 'GMAIL_NOT_CONNECTED', error: 'Selecione e conecte a conta Gmail que deseja utilizar.' };
    if (!status.permissionGranted) return { success: false, code: 'GMAIL_PERMISSION_REQUIRED', error: 'A permissão do Gmail foi removida. Clique em Conectar Gmail novamente.' };
    let raw;
    try { raw = buildGmailRawMessage({ to, subject, body, attachments }); }
    catch (error) { return { success: false, error: String(error?.message || 'E-mail inválido') }; }
    crmEmailSendInFlight.add(requestId);
    const startedAt = new Date().toISOString();
    try {
      try {
        await saveCrmEmailSendRecord({ requestId, leadId: leadIdValue, to, subject, accountId, sellerId: String(leadBefore.commercialOwnerId || ''), attachmentNames: attachments.slice(0, CRM_EMAIL_MAX_ATTACHMENTS).map((item) => String(item?.name || '').slice(0, 180)), status: 'processing', startedAt });
      } catch {
        return { success: false, code: 'EMAIL_LOCAL_STORAGE_FAILED', error: 'Não foi possível registrar a tentativa com segurança. Nenhum e-mail foi enviado.' };
      }
      let sent;
      try {
        sent = await gmailApiRequest('/messages/send', { method: 'POST', body: JSON.stringify({ raw }) }, false, true, [GMAIL_SEND_SCOPE], accountId);
      } catch (error) {
        const uncertain = error?.code === 'GMAIL_NETWORK_UNCERTAIN';
        const failedAt = new Date().toISOString();
        try {
          await saveCrmEmailSendRecord({ requestId, leadId: leadIdValue, to, subject, accountId, sellerId: String(leadBefore.commercialOwnerId || ''), status: uncertain ? 'uncertain' : 'failed', startedAt, failedAt, errorCode: String(error?.code || 'GMAIL_SEND_FAILED').slice(0, 80) });
        } catch { /* a falha de auditoria não deve ocultar a falha original */ }
        try {
          await recordCrmCommunicationActivity(leadIdValue, {
            type: 'communication.email.failed', title: uncertain ? 'Envio de e-mail sem confirmação' : 'Falha no envio de e-mail',
            description: `Para: ${to} · Assunto: ${subject} · ${String(error?.message || 'Falha no Gmail').slice(0, 180)}`,
            actor: 'Gmail', metadata: { channel: 'email', provider: 'gmail', to, subject, status: uncertain ? 'uncertain' : 'failed', requestId, sellerId: String(leadBefore.commercialOwnerId || ''), operatorAuthorizationConfirmed: true, errorCode: String(error?.code || 'GMAIL_SEND_FAILED').slice(0, 80) },
          });
        } catch { /* mantém o retorno da falha do provedor */ }
        try { await recordTelemetry('crm.email.send_failed', 'crm.communication.email', { success: false, count: 1 }); } catch { /* telemetry best effort */ }
        return { success: false, code: error?.code || 'GMAIL_SEND_FAILED', error: String(error?.message || 'Não foi possível enviar o e-mail.').slice(0, 300) };
      }
      // A resposta positiva do Gmail confirma o envio. Falhas posteriores no histórico
      // não podem ser apresentadas como falha de envio, evitando que o usuário duplique a mensagem.
      const sentAt = new Date().toISOString();
      let updatedLead = null;
      let warning = '';
      try {
        updatedLead = await recordCrmCommunicationActivity(leadIdValue, {
          type: 'communication.email.sent', title: 'E-mail enviado',
          description: `Para: ${to} · Assunto: ${subject}`,
          actor: 'Gmail', metadata: { channel: 'email', provider: 'gmail', to, subject, accountId, messageId: String(sent?.id || '').slice(0, 180), threadId: String(sent?.threadId || '').slice(0, 180), status: 'sent', requestId, sellerId: String(leadBefore.commercialOwnerId || ''), attachmentNames: attachments.slice(0, CRM_EMAIL_MAX_ATTACHMENTS).map((item) => String(item?.name || '').slice(0, 180)), operatorAuthorizationConfirmed: true },
        });
        if (!updatedLead) warning = 'O e-mail foi enviado, mas o lead não foi localizado para atualizar o histórico.';
      } catch { warning = 'O e-mail foi enviado, mas não foi possível atualizar o histórico do lead.'; }
      const record = { requestId, leadId: leadIdValue, to, subject, accountId, sellerId: String(leadBefore.commercialOwnerId || ''), attachmentNames: attachments.slice(0, CRM_EMAIL_MAX_ATTACHMENTS).map((item) => String(item?.name || '').slice(0, 180)), operatorAuthorizationConfirmed: true, status: 'sent', messageId: String(sent?.id || '').slice(0, 180), threadId: String(sent?.threadId || '').slice(0, 180), sentAt, historyRecorded: !!updatedLead };
      try { await saveCrmEmailSendRecord(record); } catch { warning = warning || 'O e-mail foi enviado, mas o registro local de confirmação não pôde ser atualizado.'; }
      try { await recordTelemetry('crm.email.sent', 'crm.communication.email', { success: true, count: 1 }); } catch { /* telemetry best effort */ }
      return { success: true, data: { ...record, lead: updatedLead || undefined, warning } };
    } finally { crmEmailSendInFlight.delete(requestId); }
  },
  async GET_FOLLOWUPS(p) {
    const leadFilter = p?.leadId ? String(p.leadId) : '';
    const statusFilter = p?.status ? String(p.status) : '';
    const limit = Math.max(1, Math.min(1000, Number(p?.limit) || 500));
    const items = (await getFollowupsInternal())
      .filter((item) => (!leadFilter || String(item.leadId) === leadFilter) && (!statusFilter || item.status === statusFilter))
      .sort((a, b) => (Date.parse(b.scheduledAt || '') || 0) - (Date.parse(a.scheduledAt || '') || 0))
      .slice(0, limit);
    const counts = Object.fromEntries(Object.values(FOLLOWUP_STATUS).map((status) => [status, 0]));
    for (const item of await getFollowupsInternal()) if (Object.prototype.hasOwnProperty.call(counts, item.status)) counts[item.status]++;
    return { success: true, data: { items, counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) } };
  },
  async GET_FOLLOWUP_SETTINGS() { return { success: true, data: await getFollowupSettingsInternal() }; },
  async SAVE_FOLLOWUP_SETTINGS(p) {
    const settings = normalizeFollowupSettings(p?.settings || p || {});
    await setStore({ [K.FOLLOWUP_SETTINGS]: settings });
    return { success: true, data: settings };
  },
  async GET_FOLLOWUP_TEMPLATES() { return { success: true, data: await getFollowupTemplatesInternal() }; },
  async SAVE_FOLLOWUP_TEMPLATES(p) {
    const templates = Array.isArray(p?.templates) ? p.templates.slice(0, 30) : [];
    const clean = [];
    for (const item of templates) {
      const name = String(item?.name || '').trim().slice(0, 80);
      const message = String(item?.message || '').replace(/\u0000/g, '').trim().slice(0, FOLLOWUP_MAX_MESSAGE_LENGTH);
      if (!name || !message) continue;
      clean.push({ id: String(item?.id || uid('template')).slice(0, 100), name, message });
    }
    await setStore({ [K.FOLLOWUP_TEMPLATES]: clean });
    return { success: true, data: clean };
  },
  async SCHEDULE_FOLLOWUP(p) {
    const step = p?.step && typeof p.step === 'object' ? p.step : p || {};
    return createFollowupSequence({ ...p, steps: [step] }, false);
  },
  async SCHEDULE_FOLLOWUP_SEQUENCE(p) { return createFollowupSequence(p || {}, true); },
  async CANCEL_FOLLOWUP(p) { return cancelFollowup(p?.followupId || p?.id, 'cancelled_by_user'); },
  async CANCEL_FOLLOWUP_SEQUENCE(p) { return cancelFollowupSequence(p?.followupId || p?.id, 'cancelled_by_user'); },
  async RESCHEDULE_FOLLOWUP(p) {
    const id = String(p?.followupId || p?.id || '');
    const when = Date.parse(p?.scheduledAt || '');
    if (!id || !Number.isFinite(when) || when < Date.now() + 60_000 || when > Date.now() + 365 * 24 * 60 * 60_000) {
      return { success: false, error: 'Informe uma nova data futura, entre 1 minuto e 365 dias.' };
    }
    const items = await getFollowupsInternal();
    const item = items.find((entry) => String(entry.id) === id);
    if (!item) return { success: false, error: 'Follow-up não encontrado.' };
    if (![FOLLOWUP_STATUS.SCHEDULED, FOLLOWUP_STATUS.OVERDUE, FOLLOWUP_STATUS.FAILED, FOLLOWUP_STATUS.BLOCKED_FREQUENCY, FOLLOWUP_STATUS.BLOCKED_LICENSE, FOLLOWUP_STATUS.BLOCKED_BLACKLIST, FOLLOWUP_STATUS.BLOCKED_SPAM].includes(item.status)) {
      return { success: false, error: 'Este follow-up não pode ser reagendado no estado atual.' };
    }
    await clearFollowupAlarm(id);
    const result = await updateFollowup(id, { status: FOLLOWUP_STATUS.SCHEDULED, scheduledAt: new Date(when).toISOString(), lastError: '', overdueAt: '', blockedAt: '', cancelRequested: false, rescheduledAt: new Date().toISOString() });
    if (result.success) {
      await scheduleFollowupAlarm(result.data.followup);
      await appendFollowupActivity(item.leadId, result.data.followup, 'rescheduled', 'Follow-up reagendado', `Novo horário: ${new Date(when).toLocaleString('pt-BR')}.`);
    }
    return result;
  },
  async SEND_FOLLOWUP_NOW(p) { return processFollowup(String(p?.followupId || p?.id || ''), true); },
  async CALENDAR_AUTOMATION_GET_RULES() {
    return { success: true, data: await getCalendarAutomationRulesInternal() };
  },
  async CALENDAR_AUTOMATION_SAVE_RULES(p) {
    const input = Array.isArray(p?.rules) ? p.rules : [];
    if (input.length > 50) return { success: false, error: 'Você pode cadastrar até 50 regras de automação.' };
    for (const raw of input) {
      if (!['stage', 'tag'].includes(raw?.trigger?.type)) return { success: false, error: 'Cada regra precisa disparar por etapa ou etiqueta.' };
      if (!['request_booking', 'create_relative_event', 'create_event_from_lead'].includes(raw?.action?.type)) return { success: false, error: 'A regra contém uma ação não reconhecida.' };
    }
    const rules = normalizeCalendarAutomationRules(input);
    if (rules.length !== input.length) return { success: false, error: 'Revise as regras: cada uma precisa ter identificador e condição de disparo válidos.' };
    const stages = await getStageList();
    for (const rule of rules) {
      if (rule.trigger.type === 'stage') {
        const stage = stages.find((item) => String(item.id) === rule.trigger.value || String(item.title).toLocaleLowerCase('pt-BR') === rule.trigger.value.toLocaleLowerCase('pt-BR'));
        if (!stage) return { success: false, error: `A etapa "${rule.trigger.value}" não existe mais no CRM. Atualize a regra.` };
        rule.trigger.value = String(stage.id);
      }
      if (rule.action.type === 'create_event_from_lead' && (!rule.action.dateField || !rule.action.timeField)) {
        return { success: false, error: 'Informe os campos de data e horário do card para criar eventos a partir dos dados do lead.' };
      }
    }
    await setStore({ [K.CALENDAR_AUTOMATIONS]: rules });
    await recordTelemetry('google_calendar.automation_rules_saved', 'google.calendar.automation', { success: true, count: rules.length });
    return { success: true, data: rules };
  },
  async CALENDAR_AUTOMATION_GET_TASKS() {
    const tasks = await getCalendarAutomationTasksInternal();
    return { success: true, data: tasks.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)) };
  },
  async CALENDAR_AUTOMATION_DISMISS_TASK(p) {
    const id = String(p?.taskId || p?.id || '');
    if (!id) return { success: false, error: 'Identificador da pendência inválido.' };
    const tasks = await getCalendarAutomationTasksInternal();
    const task = tasks.find((item) => item.id === id);
    if (!task) return { success: false, error: 'Pendência não encontrada.' };
    if (task.status !== 'needs_review') return { success: false, error: 'Esta pendência já foi concluída ou dispensada.' };
    task.status = 'dismissed';
    task.dismissedAt = new Date().toISOString();
    await setStore({ [K.CALENDAR_AUTOMATION_TASKS]: tasks });
    broadcast('CALENDAR_AUTOMATION_TASKS_UPDATED', { taskId: id, dismissed: true });
    return { success: true, data: task };
  },
  async CALENDAR_GET_STATUS() {
    const config = await getCalendarConfigInternal();
    return { success: true, data: { ...config, configured: calendarConfigured(), permissionGranted: await chrome.permissions.contains({ origins: [GOOGLE_CALENDAR_ORIGIN] }) } };
  },
  async CALENDAR_CONNECT() {
    await getGoogleCalendarToken(true);
    const calendars = await listGoogleCalendars(false);
    const writable = calendars.filter((item) => ['owner', 'writer'].includes(item.accessRole));
    if (!writable.length) return { success: false, error: 'A conta Google não possui uma agenda com permissão de edição.' };
    const previous = await getCalendarConfigInternal();
    const selected = writable.find((item) => item.id === previous.calendarId) || writable.find((item) => item.primary) || writable[0];
    const config = await putCalendarConfigInternal({ ...previous, connected: true, calendarId: selected.id, calendarSummary: selected.summary, timeZone: previous.timeZone, lastConnectedAt: new Date().toISOString(), lastError: '' });
    await recordTelemetry('google_calendar.connected', 'google.calendar.connect', { success: true });
    return { success: true, data: { config, calendars } };
  },
  async CALENDAR_DISCONNECT() {
    try { const token = await getGoogleCalendarToken(false); await dropGoogleCalendarToken(token); } catch { /* desconexão local continua possível */ }
    const current = await getCalendarConfigInternal();
    const config = await putCalendarConfigInternal({ ...current, connected: false, lastError: '' });
    await recordTelemetry('google_calendar.disconnected', 'google.calendar.connect', { success: true });
    return { success: true, data: config };
  },
  async CALENDAR_LIST_CALENDARS() { return { success: true, data: await listGoogleCalendars(false) }; },
  async CALENDAR_SAVE_SETTINGS(p) {
    const current = await getCalendarConfigInternal();
    if (!current.connected) return { success: false, error: 'Conecte o Google Agenda antes de salvar as preferências.' };
    const input = p?.settings && typeof p.settings === 'object' ? p.settings : p || {};
    if (Array.isArray(input.weekdays) && input.weekdays.length === 0) return { success: false, error: 'Selecione pelo menos um dia de atendimento.' };
    const next = normalizeCalendarSettings({ ...current, ...input, connected: true });
    if (next.workingHoursEnd <= next.workingHoursStart) return { success: false, error: 'O fim do expediente precisa ser posterior ao início.' };
    const calendars = await listGoogleCalendars(false);
    const selected = calendars.find((item) => item.id === next.calendarId);
    if (!selected) return { success: false, error: 'A agenda selecionada não está disponível nesta conta.' };
    if (!['owner', 'writer'].includes(selected.accessRole)) return { success: false, error: 'Esta agenda permite apenas leitura. Escolha uma agenda com permissão de edição.' };
    next.calendarSummary = selected.summary;
    return { success: true, data: await putCalendarConfigInternal(next) };
  },
  async CALENDAR_GET_AVAILABILITY(p) {
    const config = await getCalendarConfigInternal();
    if (!config.connected) return { success: false, error: 'Conecte o Google Agenda nas Configurações.' };
    const range = parseLocalDateRange(p?.date);
    const response = await googleCalendarRequest('/freeBusy', { method: 'POST', body: JSON.stringify({ timeMin: range.timeMin, timeMax: range.timeMax, timeZone: config.timeZone, items: [{ id: config.calendarId }] }) });
    const calendar = response?.calendars?.[config.calendarId];
    if (!calendar) return { success: false, error: 'O Google não retornou a disponibilidade da agenda selecionada.' };
    if (Array.isArray(calendar.errors) && calendar.errors.length) return { success: false, error: 'Não foi possível consultar esta agenda. Confira suas permissões no Google.' };
    const requestedDuration = Number(p?.durationMinutes) || config.defaultDurationMinutes;
    const duration = Math.max(15, Math.min(240, Math.floor(requestedDuration)));
    const slots = buildAvailableCalendarSlots({ date: p.date, busy: calendar.busy || [], settings: { ...config, defaultDurationMinutes: duration }, now: Date.now() });
    await recordTelemetry('google_calendar.availability_checked', 'google.calendar.availability', { success: true, count: slots.length });
    return { success: true, data: { date: p.date, timeZone: config.timeZone, durationMinutes: duration, slots, busyCount: Array.isArray(calendar.busy) ? calendar.busy.length : 0 } };
  },
  async CALENDAR_GET_LEAD_EVENTS(p) {
    const id = String(p?.leadId || '');
    const lead = (await getLeads()).find((item) => String(leadId(item)) === id);
    if (!lead) return { success: false, error: 'Lead não encontrado.' };
    const events = (Array.isArray(lead.calendarEvents) ? lead.calendarEvents : []).slice().sort((a, b) => (Date.parse(a.start || '') || 0) - (Date.parse(b.start || '') || 0));
    return { success: true, data: events };
  },
  async CALENDAR_CREATE_EVENT(p) {
    const id = String(p?.leadId || '');
    const leads = await getLeads();
    const lead = leads.find((item) => String(leadId(item)) === id);
    if (!lead) return { success: false, error: 'Lead não encontrado.' };
    const config = await getCalendarConfigInternal();
    if (!config.connected) return { success: false, error: 'Conecte o Google Agenda nas Configurações.' };
    const calendars = await listGoogleCalendars(false);
    const calendar = calendars.find((item) => item.id === config.calendarId);
    if (!calendar || !['owner', 'writer'].includes(calendar.accessRole)) return { success: false, error: 'A agenda selecionada não permite criar compromissos.' };
    const booking = p?.booking && typeof p.booking === 'object' ? p.booking : {};
    const events = Array.isArray(lead.calendarEvents) ? lead.calendarEvents : [];
    let requestKey = String(p?.requestKey || uid('calendar')).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
    // Se uma tentativa anterior foi interrompida após persistir o estado pendente,
    // reutilize sua chave quando o usuário repetir a mesma reserva em outro modal.
    const pendingRetry = events.find((item) => item.status === 'pending' && item.calendarId === config.calendarId
      && item.start === booking.start && item.end === booking.end);
    if (pendingRetry?.requestKey) requestKey = pendingRetry.requestKey;
    const localExisting = events.find((item) => item.requestKey === requestKey && item.eventId && item.status !== 'cancelled');
    if (localExisting) return { success: true, data: localExisting, reused: true };
    const eventBody = buildCalendarEventBody({ lead, booking, settings: config, eventKey: requestKey });
    const startMs = Date.parse(eventBody.start.dateTime); const endMs = Date.parse(eventBody.end.dateTime);
    if (startMs < Date.now() + 60_000) return { success: false, error: 'Escolha um horário futuro, com pelo menos um minuto de antecedência.' };
    let remoteEvent = await findGoogleCalendarEventByKey(config.calendarId, requestKey).catch(() => null);
    if (!remoteEvent) {
      const busyResponse = await googleCalendarRequest('/freeBusy', { method: 'POST', body: JSON.stringify({ timeMin: eventBody.start.dateTime, timeMax: eventBody.end.dateTime, timeZone: config.timeZone, items: [{ id: config.calendarId }] }) });
      const busy = busyResponse?.calendars?.[config.calendarId]?.busy || [];
      if (busy.some((item) => startMs < Date.parse(item.end) && endMs > Date.parse(item.start))) return { success: false, code: 'CALENDAR_SLOT_TAKEN', error: 'Este horário acabou de ficar ocupado. Consulte novamente os horários livres.' };
      const pending = { requestKey, calendarId: config.calendarId, summary: eventBody.summary, start: eventBody.start.dateTime, end: eventBody.end.dateTime, status: 'pending', syncStatus: 'pending', createdAt: new Date().toISOString(), note: String(booking.note || '').slice(0, 1200) };
      lead.calendarEvents = [...events, pending].slice(-CALENDAR_MAX_EVENTS_PER_LEAD);
      await putLeads(leads);
      remoteEvent = await googleCalendarRequest(`/calendars/${encodeURIComponent(config.calendarId)}/events?sendUpdates=${eventBody.attendees?.length ? 'all' : 'none'}`, { method: 'POST', body: JSON.stringify(eventBody) });
    }
    const record = { ...normalizeCalendarEventRecord(remoteEvent, config.calendarId), requestKey, note: String(booking.note || '').slice(0, 1200), attendeeInvited: Array.isArray(eventBody.attendees) && eventBody.attendees.length > 0 };
    const updatedEvents = (Array.isArray(lead.calendarEvents) ? lead.calendarEvents : []).filter((item) => item.requestKey !== requestKey && item.eventId !== record.eventId);
    lead.calendarEvents = [...updatedEvents, record].slice(-CALENDAR_MAX_EVENTS_PER_LEAD);
    lead.updatedAt = new Date().toISOString();
    await appendCalendarActivity(lead, 'event_created', 'Compromisso reservado no Google Agenda', `${record.summary} · ${new Date(record.start).toLocaleString('pt-BR')}.`, { eventId: record.eventId, calendarId: record.calendarId });
    const index = leads.findIndex((item) => String(leadId(item)) === id); if (index >= 0) leads[index] = lead;
    await putLeads(leads);
    await completeCalendarAutomationTasksForLead(id);
    await recordTelemetry('google_calendar.event_created', 'google.calendar.booking', { success: true, count: 1 });
    broadcast('CALENDAR_EVENTS_UPDATED', { leadId: id, eventId: record.eventId });
    return { success: true, data: record };
  },
  async CALENDAR_UPDATE_EVENT(p) {
    const id = String(p?.leadId || ''); const eventId = String(p?.eventId || '');
    const leads = await getLeads(); const lead = leads.find((item) => String(leadId(item)) === id);
    if (!lead) return { success: false, error: 'Lead não encontrado.' };
    const record = (Array.isArray(lead.calendarEvents) ? lead.calendarEvents : []).find((item) => item.eventId === eventId && item.status !== 'cancelled');
    if (!record) return { success: false, error: 'Compromisso não encontrado neste lead.' };
    const config = await getCalendarConfigInternal();
    if (!config.connected) return { success: false, error: 'Conecte o Google Agenda para atualizar o compromisso.' };
    const booking = p?.booking && typeof p.booking === 'object' ? p.booking : {};
    const start = booking.start || record.start; const end = booking.end || record.end;
    const body = buildCalendarEventBody({ lead, booking: { ...booking, start, end, summary: booking.summary || record.summary, note: booking.note ?? record.note }, settings: config, eventKey: record.requestKey || eventId });
    if (Date.parse(start) < Date.now() + 60_000 && (start !== record.start || end !== record.end)) return { success: false, error: 'O novo horário precisa estar no futuro.' };
    if (start !== record.start || end !== record.end) {
      const response = await googleCalendarRequest('/freeBusy', { method: 'POST', body: JSON.stringify({ timeMin: start, timeMax: end, timeZone: config.timeZone, items: [{ id: record.calendarId || config.calendarId }] }) });
      const busy = response?.calendars?.[record.calendarId || config.calendarId]?.busy || [];
      const oldStart = Date.parse(record.start); const oldEnd = Date.parse(record.end);
      if (busy.some((item) => !(Date.parse(item.start) === oldStart && Date.parse(item.end) === oldEnd) && Date.parse(start) < Date.parse(item.end) && Date.parse(end) > Date.parse(item.start))) return { success: false, code: 'CALENDAR_SLOT_TAKEN', error: 'O novo horário não está mais disponível.' };
    }
    const remote = await googleCalendarRequest(`/calendars/${encodeURIComponent(record.calendarId || config.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=${record.attendeeInvited ? 'all' : 'none'}`, { method: 'PATCH', body: JSON.stringify(body) });
    const originalCreatedAt = record.createdAt;
    Object.assign(record, normalizeCalendarEventRecord(remote, record.calendarId || config.calendarId), { requestKey: record.requestKey, createdAt: originalCreatedAt, note: String(booking.note ?? record.note ?? '').slice(0, 1200), attendeeInvited: record.attendeeInvited === true });
    await appendCalendarActivity(lead, 'event_updated', 'Compromisso atualizado', `${record.summary} · ${new Date(record.start).toLocaleString('pt-BR')}.`, { eventId });
    const index = leads.findIndex((item) => String(leadId(item)) === id); if (index >= 0) leads[index] = lead;
    await putLeads(leads); broadcast('CALENDAR_EVENTS_UPDATED', { leadId: id, eventId });
    return { success: true, data: record };
  },
  async CALENDAR_DELETE_EVENT(p) {
    const id = String(p?.leadId || ''); const eventId = String(p?.eventId || '');
    const leads = await getLeads(); const lead = leads.find((item) => String(leadId(item)) === id);
    if (!lead) return { success: false, error: 'Lead não encontrado.' };
    const record = (Array.isArray(lead.calendarEvents) ? lead.calendarEvents : []).find((item) => item.eventId === eventId && item.status !== 'cancelled');
    if (!record) return { success: false, error: 'Compromisso não encontrado neste lead.' };
    const config = await getCalendarConfigInternal();
    await googleCalendarRequest(`/calendars/${encodeURIComponent(record.calendarId || config.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=${record.attendeeInvited ? 'all' : 'none'}`, { method: 'DELETE' });
    record.status = 'cancelled'; record.cancelledAt = new Date().toISOString(); record.syncStatus = 'synced';
    await appendCalendarActivity(lead, 'event_cancelled', 'Compromisso cancelado', `${record.summary || 'Compromisso'} foi cancelado no Google Agenda.`, { eventId });
    const index = leads.findIndex((item) => String(leadId(item)) === id); if (index >= 0) leads[index] = lead;
    await putLeads(leads); broadcast('CALENDAR_EVENTS_UPDATED', { leadId: id, eventId, cancelled: true });
    return { success: true, data: record };
  },
  async CALENDAR_SET_EVENT_OUTCOME(p) {
    const id = String(p?.leadId || '');
    const eventId = String(p?.eventId || '');
    const outcome = String(p?.outcome || '');
    if (!id || !eventId || !['completed', 'no_show'].includes(outcome)) {
      return { success: false, error: 'Informe lead, compromisso e resultado válido.' };
    }
    const leads = await getLeads();
    const lead = leads.find((item) => String(leadId(item)) === id);
    if (!lead) return { success: false, error: 'Lead não encontrado.' };
    const event = (Array.isArray(lead.calendarEvents) ? lead.calendarEvents : []).find((item) => item.eventId === eventId && item.status !== 'cancelled');
    if (!event) return { success: false, error: 'Compromisso ativo não encontrado neste lead.' };
    const endAt = Date.parse(event.end || event.start || '');
    if (!Number.isFinite(endAt) || endAt > Date.now()) {
      return { success: false, error: 'O resultado só pode ser registrado depois do horário final do compromisso.' };
    }
    const previousOutcome = event.outcome || '';
    event.outcome = outcome;
    event.outcomeAt = new Date().toISOString();
    event.outcomeUpdatedAt = event.outcomeAt;
    appendCalendarActivity(
      lead,
      outcome === 'completed' ? 'meeting_completed' : 'meeting_no_show',
      outcome === 'completed' ? 'Reunião realizada' : 'Lead não compareceu',
      `${event.summary || 'Compromisso'} · ${outcome === 'completed' ? 'Presença registrada pelo vendedor.' : 'Ausência registrada pelo vendedor.'}`,
      { eventId, outcome, previousOutcome },
    );
    lead.updatedAt = new Date().toISOString();
    const index = leads.findIndex((item) => String(leadId(item)) === id);
    if (index >= 0) leads[index] = lead;
    await putLeads(leads);
    broadcast('CALENDAR_EVENTS_UPDATED', { leadId: id, eventId, outcome });
    return { success: true, data: event };
  },
  async CALENDAR_SYNC_LEAD_EVENTS(p) {
    const id = String(p?.leadId || '');
    const leads = await getLeads(); const lead = leads.find((item) => String(leadId(item)) === id);
    if (!lead) return { success: false, error: 'Lead não encontrado.' };
    const result = await syncLeadCalendarEvents(lead, Array.isArray(p?.changedFields) ? p.changedFields.slice(0, 20) : []);
    return { success: true, data: result };
  },
  async CALENDAR_SEND_CONFIRMATION(p) {
    const id = String(p?.leadId || ''); const eventId = String(p?.eventId || '');
    const leads = await getLeads(); const lead = leads.find((item) => String(leadId(item)) === id);
    if (!lead) return { success: false, error: 'Lead não encontrado.' };
    const event = (Array.isArray(lead.calendarEvents) ? lead.calendarEvents : []).find((item) => item.eventId === eventId && item.status !== 'cancelled');
    if (!event) return { success: false, error: 'Compromisso não encontrado neste lead.' };
    if (event.confirmationStatus === 'sent') return { success: true, alreadySent: true, data: event };
    if (event.confirmationStatus === 'sending') return { success: false, code: 'CALENDAR_CONFIRMATION_IN_PROGRESS', error: 'A confirmação já está sendo enviada. Aguarde o resultado.' };
    const phone = normWaPhone(lead.phone);
    if (!phone || phone.length < 10 || phone.length > 15) return { success: false, error: 'O lead não possui telefone válido para WhatsApp.' };
    const consent = await getConsentForPhone(phone);
    if (consent?.status !== CONSENT_STATUS_OPTED_IN) return { success: false, code: 'CONSENT_REQUIRED', error: 'A confirmação não foi enviada: registre primeiro o consentimento do contato para receber mensagens.' };
    if ((await blacklistTails()).has(phoneTail(phone))) return { success: false, code: 'BLOCKED_BLACKLIST', error: 'A confirmação não foi enviada: o contato está na Black list.' };
    if (lead.blacklisted || lead.stage === 'blacklist' || normalizeType(lead.tipo) === 'spam') return { success: false, code: 'BLOCKED_CONTACT', error: 'A confirmação não foi enviada: este lead está bloqueado ou classificado como spam.' };
    const settings = await getFollowupSettingsInternal();
    if (isWithinQuietHours(Date.now(), settings)) return { success: false, code: 'QUIET_HOURS', error: 'A confirmação não foi enviada porque está dentro do horário de silêncio configurado.' };
    const since = Date.now() - 24 * 60 * 60_000;
    const allFollowups = await getFollowupsInternal();
    const recentFollowups = allFollowups.filter((item) => item.status === FOLLOWUP_STATUS.SENT && (Date.parse(item.sentAt || '') || 0) >= since);
    const recentCalendar = [];
    for (const item of leads) for (const calendarEvent of (Array.isArray(item.calendarEvents) ? item.calendarEvents : [])) {
      if (calendarEvent.confirmationStatus === 'sent' && (Date.parse(calendarEvent.confirmationSentAt || '') || 0) >= since) recentCalendar.push({ phone: item.phone, sentAt: calendarEvent.confirmationSentAt });
    }
    const contactTail = phoneTail(phone);
    const contactSent = [...recentFollowups.filter((item) => phoneTail(item.phone) === contactTail), ...recentCalendar.filter((item) => phoneTail(item.phone) === contactTail)];
    const globalCount = recentFollowups.length + recentCalendar.length;
    if (contactSent.length >= settings.maxPerContactDaily) return { success: false, code: 'BLOCKED_FREQUENCY', error: 'Limite diário de mensagens para este contato atingido.' };
    if (globalCount >= settings.maxDailyTotal) return { success: false, code: 'BLOCKED_FREQUENCY', error: 'Limite diário total de mensagens atingido.' };
    const lastContactSent = Math.max(0, ...contactSent.map((item) => Date.parse(item.sentAt || '') || 0));
    if (settings.minIntervalMinutes > 0 && lastContactSent && Date.now() - lastContactSent < settings.minIntervalMinutes * 60_000) return { success: false, code: 'BLOCKED_FREQUENCY', error: `Aguarde pelo menos ${settings.minIntervalMinutes} minuto(s) antes de enviar outra mensagem para este contato.` };
    let wa;
    try { wa = await requireWhatsApp(); }
    catch (error) { return { success: false, code: 'WHATSAPP_UNAVAILABLE', error: String(error?.message || error) }; }
    event.confirmationStatus = 'sending'; event.confirmationRequestedAt = new Date().toISOString();
    const index = leads.findIndex((item) => String(leadId(item)) === id); if (index >= 0) leads[index] = lead;
    await putLeads(leads);
    const date = new Date(event.start);
    const text = `Olá, ${String(lead.name || 'tudo bem').slice(0, 100)}! Seu horário foi reservado para ${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Se precisar alterar, é só nos avisar.`;
    let sendResult;
    try {
      sendResult = await sendToTabEnsured(wa.tab, 'whatsapp', { type: 'FOLLOWUP_SEND_TO_PHONE', payload: { phone, text, followupId: `calendar_${eventId}` } }, wa.frameId);
    } catch (error) { sendResult = { success: false, error: String(error?.message || error) }; }
    event.confirmationStatus = sendResult?.success === true ? 'sent' : 'failed';
    event.confirmationSentAt = sendResult?.success === true ? new Date().toISOString() : '';
    event.confirmationError = sendResult?.success === true ? '' : String(sendResult?.error || 'O WhatsApp Web não confirmou o envio.').slice(0, 220);
    await appendCalendarActivity(lead, sendResult?.success === true ? 'confirmation_sent' : 'confirmation_failed', sendResult?.success === true ? 'Confirmação enviada pelo WhatsApp' : 'Falha na confirmação pelo WhatsApp', sendResult?.success === true ? `A confirmação do compromisso ${event.summary || ''} foi enviada.` : `A confirmação não foi enviada: ${event.confirmationError}`, { eventId });
    const finalIndex = leads.findIndex((item) => String(leadId(item)) === id); if (finalIndex >= 0) leads[finalIndex] = lead;
    await putLeads(leads);
    await recordTelemetry(sendResult?.success === true ? 'google_calendar.confirmation_sent' : 'google_calendar.confirmation_failed', 'google.calendar.booking', { success: sendResult?.success === true });
    broadcast('CALENDAR_EVENTS_UPDATED', { leadId: id, eventId, confirmationStatus: event.confirmationStatus });
    return sendResult?.success === true ? { success: true, data: event } : { success: false, code: 'CALENDAR_CONFIRMATION_FAILED', error: event.confirmationError, data: event };
  },
  async DELETE_FOLLOWUP(p) {
    const id = String(p?.followupId || p?.id || '');
    const items = await getFollowupsInternal();
    const item = items.find((entry) => String(entry.id) === id);
    if (!item) return { success: false, error: 'Follow-up não encontrado.' };
    if ([FOLLOWUP_STATUS.SCHEDULED, FOLLOWUP_STATUS.PROCESSING, FOLLOWUP_STATUS.OVERDUE].includes(item.status)) {
      return { success: false, error: 'Cancele ou conclua o follow-up antes de excluí-lo.' };
    }
    await clearFollowupAlarm(id);
    await putFollowupsInternal(items.filter((entry) => String(entry.id) !== id));
    broadcast('FOLLOWUPS_UPDATED', { leadId: item.leadId, followupId: id, deleted: true });
    return { success: true };
  },
  async ADD_LEAD_NOTE(p) {
    return withCrmHistoryMutation(async () => {
      const id = String(p?.leadId ?? '');
      const text = String(p?.text ?? '').replace(/\u0000/g, '').trim();
      if (!text) return { success: false, error: 'Escreva uma anotação antes de salvar.' };
      if (text.length > 5000) return { success: false, error: 'A anotação deve ter no máximo 5.000 caracteres.' };
      const leads = await getLeads();
      const lead = leads.find((item) => String(leadId(item)) === id);
      if (!lead) return { success: false, error: 'Lead não encontrado.' };
      const currentNotes = normalizeCrmNotes(lead.notes);
      if (currentNotes.length >= CRM_NOTE_MAX_ITEMS) return { success: false, error: `Este lead atingiu o limite de ${CRM_NOTE_MAX_ITEMS} anotações. Exporte ou revise o histórico antes de adicionar outra.` };
      const note = createManualCrmNote(text, 'Usuário');
      lead.notes = [...currentNotes, note];
      lead.updatedAt = new Date().toISOString();
      await putLeads(leads);
      broadcast('LEAD_HISTORY_UPDATED', { leadId: id, action: 'note_added' });
      return { success: true, data: { lead, note, timeline: buildCrmTimeline(lead) } };
    });
  },
  async UPDATE_LEAD_NOTE(p) {
    return withCrmHistoryMutation(async () => {
      const id = String(p?.leadId ?? '');
      const noteId = String(p?.noteId ?? '');
      const text = String(p?.text ?? '').replace(/\u0000/g, '').trim();
      if (!noteId) return { success: false, error: 'Identificador da anotação inválido.' };
      if (!text) return { success: false, error: 'A anotação não pode ficar vazia.' };
      if (text.length > 5000) return { success: false, error: 'A anotação deve ter no máximo 5.000 caracteres.' };
      const leads = await getLeads();
      const lead = leads.find((item) => String(leadId(item)) === id);
      if (!lead) return { success: false, error: 'Lead não encontrado.' };
      const notes = normalizeCrmNotes(lead.notes);
      const note = notes.find((item) => String(item.id) === noteId);
      if (!note) return { success: false, error: 'Anotação não encontrada.' };
      if (note.manual !== true) return { success: false, error: 'Esta anotação é automática e não pode ser editada.' };
      if (note.text === text) return { success: true, data: { lead, note, timeline: buildCrmTimeline(lead) }, unchanged: true };
      note.text = text;
      note.updatedAt = new Date().toISOString();
      note.edited = true;
      lead.notes = notes;
      appendCrmActivity(lead, {
        type: 'note.updated',
        title: 'Anotação editada',
        description: 'Uma anotação manual foi atualizada.',
        actor: 'Usuário',
        source: 'manual',
        metadata: { noteId },
      });
      lead.updatedAt = new Date().toISOString();
      await putLeads(leads);
      broadcast('LEAD_HISTORY_UPDATED', { leadId: id, action: 'note_updated' });
      return { success: true, data: { lead, note, timeline: buildCrmTimeline(lead) } };
    });
  },
  async DELETE_LEAD_NOTE(p) {
    return withCrmHistoryMutation(async () => {
      const id = String(p?.leadId ?? '');
      const noteId = String(p?.noteId ?? '');
      if (!noteId) return { success: false, error: 'Identificador da anotação inválido.' };
      const leads = await getLeads();
      const lead = leads.find((item) => String(leadId(item)) === id);
      if (!lead) return { success: false, error: 'Lead não encontrado.' };
      const notes = normalizeCrmNotes(lead.notes);
      const note = notes.find((item) => String(item.id) === noteId);
      if (!note) return { success: false, error: 'Anotação não encontrada.' };
      if (note.manual !== true) return { success: false, error: 'Esta anotação automática não pode ser excluída por aqui.' };
      lead.notes = notes.filter((item) => String(item.id) !== noteId);
      appendCrmActivity(lead, {
        type: 'note.deleted',
        title: 'Anotação excluída',
        description: 'Uma anotação manual foi removida do histórico.',
        actor: 'Usuário',
        source: 'manual',
        metadata: { noteId },
      });
      lead.updatedAt = new Date().toISOString();
      await putLeads(leads);
      broadcast('LEAD_HISTORY_UPDATED', { leadId: id, action: 'note_deleted' });
      return { success: true, data: { lead, timeline: buildCrmTimeline(lead) } };
    });
  },
  async DELETE_LEAD(p) {
    const id = p?.leadId ?? p?.id;
    const leads = (await getLeads()).filter((l) => leadId(l) !== id);
    await putLeads(leads);
    return { success: true };
  },
  async CLEAR_ALL_LEADS() { await putLeads([]); return { success: true }; },

  /** Força uma varredura das conversas privadas do WhatsApp para teste/reconciliação. */
  async SYNC_PRIVATE_OPPORTUNITIES(payload = {}) {
    const syncRunId = payload?.syncRunId || null;
    console.log('[i9Hub Sync] ' + JSON.stringify({ event: 'WORKER_SYNC_REQUEST_RECEIVED', syncRunId, timestamp: new Date().toISOString(), context: 'service_worker' }));
    const wa = await requireWhatsApp();
    // Atualização da extensão pode deixar o MAIN-world antigo vivo no WhatsApp.
    // Reinjeta a versão atual antes do comando; os bridges são versionados e
    // a versão antiga passa a ignorar mensagens.
    await injectScripts(wa.tab.id, 'whatsapp', wa.frameId);
    console.log('[i9Hub Sync] ' + JSON.stringify({ event: 'WHATSAPP_TAB_SELECTED', syncRunId, tabId: wa.tab.id, frameId: wa.frameId, timestamp: new Date().toISOString(), context: 'service_worker' }));
    return sendToTabEnsured(wa.tab, 'whatsapp', { type: 'SYNC_PRIVATE_OPPORTUNITIES', payload: { syncRunId } }, wa.frameId);
  },

  async UPDATE_LEAD_STAGE(p) {
    const leads = await getLeads();
    const l = leads.find((x) => leadId(x) === p?.leadId);
    if (!l) return { success: false, error: 'Lead não encontrado' };
    // Movimentação de estágios é recurso exclusivo de contas licenciadas.
    const state = await getLicenseState();
    if (!state.licensed) {
      return { success: false, code: 'LICENSE_REQUIRED', error: 'Movimentação entre estágios está disponível apenas na versão licenciada. Ative sua conta para utilizar.', promptLicense: true, whatsappUrl: whatsappLink('feature-access', 'crm.stage_move') };
    }
    const previousStage = l.stage;
    const previousStageCategory = stageCategory(l.stage);
    if (p.stage === 'blacklist' && !l.blacklisted) return blacklistAdd({ phone: l.phone, name: l.name, source: 'crm' });
    if (l.blacklisted && p.stage !== 'blacklist') return { success: false, error: 'Este contato está na Black list. Remova-o da Black list (botão Black list no CRM) para mudar o estágio.' };
    if (l.commissionStatus === 'paid' && previousStageCategory === 'closed_won' && stageCategory(p.stage) !== 'closed_won') {
      return { success: false, error: 'Esta venda já possui comissão marcada como paga. Reabra a comissão antes de alterar a etapa da venda.' };
    }
    const stageChangedAt = new Date().toISOString();
    l.stage = p.stage; l.updatedAt = stageChangedAt;
    if (previousStage !== p.stage) l.stageUpdatedAt = stageChangedAt;
    if (previousStage !== p.stage) appendCrmActivity(l, {
      type: 'lead.stage_changed',
      title: 'Etapa comercial alterada',
      description: `Etapa alterada de "${String(previousStage || 'novo').slice(0, 80)}" para "${String(p.stage || '').slice(0, 80)}".`,
      actor: 'Usuário',
      source: 'manual',
      metadata: { from: String(previousStage || ''), to: String(p.stage || '') },
    });
    if (previousStageCategory !== 'closed_won' && stageCategory(l.stage) === 'closed_won') {
      const managementConfig = await getCommercialManagementConfig();
      snapshotLeadCommission(l, managementConfig, stageChangedAt);
    }
    if (l.tipoManual !== true) {
      const settings = await getClassifierSettings();
      const profile = await getStoredBusinessProfile();
      const r = await applyClassification(l, l.tipoEvidence || {}, settings, 0, profile);
      if (r.changed) l.updatedAt = new Date().toISOString();
    }
    await putLeads(leads);
    let automation = { matched: 0, executed: 0 };
    if (previousStage !== p.stage) {
      try { automation = await runCalendarAutomationsForTransition(l, { type: 'stage', value: String(p.stage), from: String(previousStage || ''), at: new Date().toISOString(), id: uid('stage_transition') }); }
      catch (error) { automation = { matched: 0, executed: 0, error: String(error?.message || error).slice(0, 160) }; }
    }
    if (stageCategory(l.stage) === 'closed_won' && previousStageCategory !== 'closed_won') await recordTelemetry('crm.sale.closed', 'telemetry.sales_funnel', { success: true, count: 1 });
    else if (stageCategory(l.stage) === 'opportunity' && previousStageCategory !== 'opportunity') await recordTelemetry('crm.opportunity.opened', 'telemetry.sales_funnel', { success: true, count: 1 });
    broadcast('CLASSIFICATION_UPDATED', { leadIds: [leadId(l)] });
    return { success: true, data: { automation } };
  },
  async UPDATE_LEAD_TYPE(p) {
    const leads = await getLeads();
    const l = leads.find((x) => leadId(x) === p?.leadId);
    const tipo = normalizeType(p?.tipo);
    if (!l) return { success: false, error: 'Lead não encontrado' };
    if (!TYPE_VALUES.includes(tipo)) return { success: false, error: 'Tipo inválido.' };
    const previousType = l.tipo;
    l.tipo = tipo;
    l.tipoManual = true;
    l.tipoOrigem = 'manual';
    l.tipoMotivo = String(p?.motivo || 'Classificação manual pelo usuário').slice(0, 200);
    l.tipoSinais = [];
    l.tipoClassificadoEm = new Date().toISOString();
    l.updatedAt = new Date().toISOString();
    if (previousType !== tipo) appendCrmActivity(l, {
      type: 'lead.classification_changed',
      title: 'Classificação alterada',
      description: `Classificação alterada para "${tipo}".`,
      actor: 'Usuário',
      source: 'manual',
      metadata: { from: String(previousType || ''), to: tipo },
    });
    await putLeads(leads);
    broadcast('CLASSIFICATION_UPDATED', { leadIds: [leadId(l)], manual: true });
    return { success: true, data: l };
  },
  async UPDATE_LEAD_IDENTITY(p) {
    const leads = await getLeads();
    const id = p?.leadId;
    const lead = leads.find((item) => String(leadId(item)) === String(id));
    if (!lead) return { success: false, error: 'Lead não encontrado.' };
    const input = p?.fields && typeof p.fields === 'object' && !Array.isArray(p.fields) ? p.fields : {};
    const allowed = ['name', 'phone', 'email', 'company', 'category', 'address', 'website'];
    const fields = {};
    const identityMeta = {};
    for (const field of allowed) {
      if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
      const value = String(input[field] ?? '').trim().slice(0, field === 'address' ? 500 : field === 'website' ? 2000 : field === 'email' ? 254 : 180);
      if (field === 'name' && value && !LeadIdentity.isValidName(value)) return { success: false, error: 'Informe um nome válido. Nomes genéricos ou números não são aceitos.' };
      if (field === 'phone' && value && !LeadIdentity.normalizePhone(value)) return { success: false, error: 'Telefone inválido. Informe entre 8 e 15 dígitos.' };
      if (field === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return { success: false, error: 'E-mail inválido.' };
      if (field === 'website' && value && !LeadIdentity.normalizeWebsite(value)) return { success: false, error: 'Site inválido. Informe um endereço HTTP ou HTTPS válido.' };
      fields[field] = value;
      identityMeta[field] = LeadIdentity.makeMeta('manual', 1, { manual: true, locked: true, cleared: !value });
    }
    if (!Object.keys(fields).length) return { success: false, error: 'Nenhum campo foi alterado.' };
    LeadIdentity.mergeLeadIdentity(lead, { ...fields, identityMeta, source: 'manual' }, { source: 'manual' });
    lead.identityEditedAt = new Date().toISOString();
    lead.updatedAt = lead.identityEditedAt;
    const fieldLabels = { name: 'nome', phone: 'telefone', email: 'e-mail', company: 'empresa', category: 'categoria', address: 'endereço', website: 'site' };
    appendCrmActivity(lead, {
      type: 'lead.identity_updated',
      title: 'Dados do lead corrigidos',
      description: `Campos atualizados: ${Object.keys(fields).map((field) => fieldLabels[field] || field).join(', ')}.`,
      actor: 'Usuário',
      source: 'manual',
      metadata: { fields: Object.keys(fields) },
    });
    await putLeads(leads);
    let calendarSync = { synced: 0, pending: 0 };
    if (Array.isArray(lead.calendarEvents) && lead.calendarEvents.some((event) => event?.status !== 'cancelled')) {
      try { calendarSync = await syncLeadCalendarEvents(lead, Object.keys(fields)); }
      catch { calendarSync = { synced: 0, pending: lead.calendarEvents.length }; }
    }
    broadcast('LEAD_IDENTITY_UPDATED', { leadId: String(leadId(lead)), fields: Object.keys(fields), calendarSync });
    return { success: true, data: { lead, fields: Object.keys(fields), calendarSync } };
  },
  async UPDATE_LEAD_CUSTOM_FIELDS(p) {
    const leads = await getLeads();
    const id = p?.leadId;
    const lead = leads.find((x) => leadId(x) === id);
    if (!lead) return { success: false, error: 'Lead não encontrado.' };
    const profile = await getStoredBusinessProfile();
    const allowed = new Set((profile?.fields || []).map((f) => String(f?.key || '')).filter(Boolean));
    const input = (p?.fields && typeof p.fields === 'object') ? p.fields : {};
    const previous = { ...(lead.customFields || {}) };
    const next = { ...previous };
    for (const [key, value] of Object.entries(input)) {
      if (allowed.size && !allowed.has(key)) continue;
      next[String(key).slice(0, 80)] = String(value ?? '').slice(0, 2000);
    }
    lead.customFields = next;
    lead.updatedAt = new Date().toISOString();
    const changedKeys = Object.keys(input).filter((key) => Object.prototype.hasOwnProperty.call(next, key) && String(previous[key] ?? '') !== String(next[key] ?? ''));
    if (changedKeys.length) appendCrmActivity(lead, {
      type: 'lead.custom_fields_updated',
      title: 'Campos personalizados atualizados',
      description: `${changedKeys.length} campo(s) personalizado(s) atualizado(s).`,
      actor: 'Usuário',
      source: 'manual',
      metadata: { fields: changedKeys.map((key) => String(key).slice(0, 80)) },
    });
    await putLeads(leads);
    broadcast('LEAD_CUSTOM_FIELDS_UPDATED', { leadId: id });
    return { success: true, data: { customFields: next } };
  },

  async UPDATE_LEAD_COMMERCIAL_FIELDS(p) {
    const leads = await getLeads();
    const id = String(p?.leadId || '');
    const lead = leads.find((item) => String(leadId(item)) === id);
    if (!lead) return { success: false, error: 'Lead não encontrado.' };
    const input = p?.fields && typeof p.fields === 'object' && !Array.isArray(p.fields) ? p.fields : {};
    const config = await getCommercialManagementConfig();
    const fields = {};
    if (Object.prototype.hasOwnProperty.call(input, 'commercialOwner')) {
      fields.commercialOwner = normalizeCommercialName(input.commercialOwner, 120);
      const seller = findCommercialSeller(config, '', fields.commercialOwner, true);
      fields.commercialOwnerId = seller?.id || null;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'commercialProductName')) {
      fields.commercialProductName = normalizeCommercialName(input.commercialProductName, 160);
      const product = findCommercialProduct(config, '', fields.commercialProductName, true);
      fields.commercialProductId = product?.id || null;
      if (product) fields.commercialProductName = product.name;
    }
    for (const key of ['dealValue', 'saleValue']) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
      const raw = input[key];
      if (raw === '' || raw === null || raw === undefined) { fields[key] = null; continue; }
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 1e12) return { success: false, error: `Informe um valor válido para ${key === 'dealValue' ? 'a oportunidade' : 'a venda'}.` };
      fields[key] = Math.round(value * 100) / 100;
    }
    const changed = Object.keys(fields).filter((key) => {
      if (key === 'commercialOwner' || key === 'commercialProductName') return String(lead[key] || '') !== fields[key];
      if (key === 'commercialOwnerId' || key === 'commercialProductId') return String(lead[key] || '') !== String(fields[key] || '');
      const before = lead[key] === null || lead[key] === undefined || lead[key] === '' ? null : Number(lead[key]);
      return before !== fields[key];
    });
    const needsCommissionSnapshot = stageCategory(lead.stage) === 'closed_won'
      && Number(lead.saleValue) > 0
      && (lead.commissionRateAtSale === null || lead.commissionRateAtSale === undefined || lead.commissionRateAtSale === '')
      && lead.commissionStatus !== 'paid';
    if (!changed.length && !needsCommissionSnapshot) return { success: false, error: 'Nenhuma alteração nos dados comerciais.' };
    if (lead.commissionStatus === 'paid' && changed.some((key) => ['commercialOwner', 'commercialOwnerId', 'commercialProductName', 'commercialProductId', 'saleValue'].includes(key))) {
      return { success: false, error: 'Esta venda já possui comissão paga. Reabra a comissão antes de alterar vendedor, produto ou valor vendido.' };
    }
    const now = new Date().toISOString();
    const ownerChanged = changed.some((key) => ['commercialOwner', 'commercialOwnerId'].includes(key));
    if (ownerChanged) {
      const history = Array.isArray(lead.commercialOwnerHistory) ? lead.commercialOwnerHistory.filter((item) => item && typeof item === 'object') : [];
      const previousOwner = String(lead.commercialOwner || '').trim();
      const previousOwnerId = String(lead.commercialOwnerId || '');
      if (previousOwner || previousOwnerId) {
        const activeIndex = [...history].map((item, index) => ({ item, index }))
          .filter(({ item }) => (previousOwnerId ? String(item.ownerId || '') === previousOwnerId : String(item.owner || '').trim() === previousOwner) && !item.unassignedAt)
          .at(-1)?.index;
        if (activeIndex !== undefined) history[activeIndex] = { ...history[activeIndex], unassignedAt: now };
      }
      const seller = findCommercialSeller(config, fields.commercialOwnerId, fields.commercialOwner, true);
      lead.commercialOwner = fields.commercialOwner ?? String(lead.commercialOwner || '');
      lead.commercialOwnerId = seller?.id || null;
      lead.commercialOwnerAssignedAt = lead.commercialOwner ? now : null;
      if (lead.commercialOwner) history.push({ owner: lead.commercialOwner, ownerId: seller?.id || null, teamId: seller?.teamId || '', assignedAt: now, unassignedAt: null });
      lead.commercialOwnerHistory = history.slice(-100);
    }
    for (const key of ['dealValue', 'saleValue', 'commercialProductName', 'commercialProductId']) {
      if (changed.includes(key)) lead[key] = fields[key];
    }
    if (changed.includes('commercialProductName') || changed.includes('commercialProductId')) {
      const product = findCommercialProduct(config, lead.commercialProductId, lead.commercialProductName, true);
      lead.commercialProductId = product?.id || null;
      lead.commercialProductName = product?.name || lead.commercialProductName || '';
    }
    if (stageCategory(lead.stage) === 'closed_won' && Number(lead.saleValue) > 0 && lead.commissionStatus !== 'paid'
      && (ownerChanged || changed.some((key) => ['saleValue', 'commercialProductName', 'commercialProductId'].includes(key)) || needsCommissionSnapshot)) {
      const snapshotted = snapshotLeadCommission(lead, config, now, true);
      if (!snapshotted) {
        lead.commissionRateAtSale = null;
        lead.commissionAmountAtSale = null;
        lead.commissionProductIdAtSale = null;
        lead.commissionProductNameAtSale = '';
        lead.commercialTeamIdAtSale = '';
        lead.commissionSnapshotAt = null;
      }
    } else if (lead.commissionStatus !== 'paid' && (ownerChanged || changed.some((key) => ['saleValue', 'commercialProductName', 'commercialProductId'].includes(key)))) {
      lead.commissionRateAtSale = null;
      lead.commissionAmountAtSale = null;
      lead.commissionProductIdAtSale = null;
      lead.commissionProductNameAtSale = '';
      lead.commercialTeamIdAtSale = '';
      lead.commissionSnapshotAt = null;
    }
    lead.commercialDataUpdatedAt = now;
    lead.updatedAt = now;
    const labels = {
      commercialOwner: 'responsável comercial', commercialOwnerId: 'vínculo do vendedor cadastrado',
      commercialProductName: 'produto/serviço', commercialProductId: 'vínculo do produto/serviço',
      dealValue: 'valor estimado da oportunidade', saleValue: 'valor efetivamente vendido',
    };
    if (changed.length) appendCrmActivity(lead, {
      type: 'lead.commercial_data_updated',
      title: 'Dados comerciais atualizados',
      description: `Campos atualizados: ${changed.map((key) => labels[key]).join(', ')}.`,
      actor: 'Usuário', source: 'manual', createdAt: now, metadata: { fields: changed },
    });
    const index = leads.findIndex((item) => String(leadId(item)) === id);
    if (index >= 0) leads[index] = lead;
    await putLeads(leads);
    broadcast('COMMERCIAL_PERFORMANCE_UPDATED', { leadId: id, fields: changed });
    broadcast('COMMERCIAL_MANAGEMENT_UPDATED', { leadId: id, fields: changed });
    return { success: true, data: { lead, fields: changed, commissionSnapshotted: !!lead.commissionSnapshotAt } };
  },
  async UPDATE_LEADS_TYPE(p) {
    const leads = await getLeads();
    const ids = new Set((p?.leadIds || []).map(String));
    const tipo = normalizeType(p?.tipo);
    if (!ids.size) return { success: false, error: 'Nenhum lead selecionado.' };
    if (!TYPE_VALUES.includes(tipo)) return { success: false, error: 'Tipo inválido.' };
    const now = new Date().toISOString();
    let changed = 0;
    for (const l of leads) {
      if (!ids.has(String(leadId(l)))) continue;
      const previousType = l.tipo;
      l.tipo = tipo; l.tipoManual = true; l.tipoOrigem = 'manual';
      l.tipoMotivo = String(p?.motivo || 'Classificação manual pelo usuário').slice(0, 200);
      l.tipoSinais = []; l.tipoClassificadoEm = now; l.updatedAt = now; changed++;
      if (previousType !== tipo) appendCrmActivity(l, {
        type: 'lead.classification_changed',
        title: 'Classificação alterada em lote',
        description: `Classificação alterada para "${tipo}" por ação em lote.`,
        actor: 'Usuário',
        source: 'manual',
        metadata: { from: String(previousType || ''), to: tipo, bulk: true },
      });
    }
    await putLeads(leads);
    broadcast('CLASSIFICATION_UPDATED', { leadIds: [...ids], manual: true });
    return { success: true, data: { changed } };
  },
  async RESET_LEAD_TYPE(p) {
    const leads = await getLeads();
    const ids = new Set((p?.leadIds || [p?.leadId]).filter(Boolean).map(String));
    if (!ids.size) return { success: false, error: 'Nenhum lead selecionado.' };
    const settings = await getClassifierSettings();
    const profile = await getStoredBusinessProfile();
    const now = new Date().toISOString();
    let changed = 0;
    for (const l of leads) {
      if (!ids.has(String(leadId(l)))) continue;
      const previousType = l.tipo;
      l.tipoManual = false;
      const r = await applyClassification(l, l.tipoEvidence || {}, settings, l.tipoMensagemFingerprint ? 1 : 0, profile);
      l.updatedAt = now; changed++;
      if (previousType !== l.tipo) appendCrmActivity(l, {
        type: 'lead.classification_reset',
        title: 'Classificação automática restaurada',
        description: `Classificação recalculada pelo i9Hub: "${String(l.tipo || 'não classificado')}".`,
        actor: 'Sistema',
        source: 'system',
        metadata: { from: String(previousType || ''), to: String(l.tipo || '') },
      });
    }
    await putLeads(leads);
    broadcast('CLASSIFICATION_UPDATED', { leadIds: [...ids], manual: false });
    return { success: true, data: { changed } };
  },
  async RECLASSIFY_LEADS() {
    const r = await classifyAllLeads({ force: true });
    broadcast('CLASSIFICATION_UPDATED', { changed: r.changed });
    return { success: true, data: { changed: r.changed, total: r.leads.length } };
  },
  async DEDUPLICATE_LEADS() { return deduplicateLeads(); },
  async EXPORT_LEADS_CSV(p) { return exportCSV(p || {}); },
  async EXPORT_LEADS_WEBHOOK(p) {
    const s = await getSettings();
    if (!s.webhookUrl) return { success: false, error: 'Configure a URL do webhook em Configurações.' };
    try {
      const resp = await webhookRequest(s.webhookUrl, p?.leads || [], s);
      if (!resp.ok) return { success: false, error: `Webhook respondeu HTTP ${resp.status}` };
      return { success: true, data: { count: (p?.leads || []).length } };
    } catch (e) { return { success: false, error: 'Falha ao chamar o webhook: ' + e.message }; }
  },

  // ---- Dashboard
  async DASHBOARD_GET_COMMERCIAL_OVERVIEW() {
    const [leads, followups, calendarConfig, licenseState] = await Promise.all([
      getLeads(),
      getFollowupsInternal(),
      getCalendarConfigInternal(),
      getLicenseState(),
    ]);
    const automationEnabled = hasFeatureEntitlement(licenseState.payload?.ent, 'google.calendar.automation');
    const tasks = automationEnabled ? await getCalendarAutomationTasksInternal() : [];
    const recentActivities = [];
    const activityCutoff = Date.now() - 7 * 24 * 60 * 60_000;
    let activityCountLast7Days = 0;
    for (const lead of leads) {
      const id = String(leadId(lead) || '');
      if (!id) continue;
      for (const item of buildCrmTimeline(lead, { limit: 500 })) {
        const createdAt = Date.parse(item.createdAt || '');
        if (Number.isFinite(createdAt) && createdAt >= activityCutoff) activityCountLast7Days++;
        if (recentActivities.length >= 2000) continue;
        recentActivities.push({
          id: item.id,
          leadId: id,
          leadName: lead.name || lead.company || 'Lead',
          title: item.title || 'Atividade comercial',
          description: item.description || item.text || '',
          actor: item.actor || 'Sistema',
          source: item.source || 'system',
          createdAt: item.createdAt,
          kind: item.kind || 'activity',
        });
      }
    }
    const calendarPermissionGranted = await chrome.permissions.contains({ origins: [GOOGLE_CALENDAR_ORIGIN] });
    const snapshot = buildCommercialDashboardSnapshot({
      leads,
      followups,
      automationTasks: tasks,
      recentActivities,
      activityCountLast7Days,
      now: Date.now(),
    });
    return {
      success: true,
      data: {
        ...snapshot,
        automationEnabled,
        calendar: {
          connected: calendarConfig.connected === true && calendarPermissionGranted,
          permissionGranted: calendarPermissionGranted,
          calendarSummary: calendarConfig.calendarSummary,
          timeZone: calendarConfig.timeZone,
          lastConnectedAt: calendarConfig.lastConnectedAt,
        },
      },
    };
  },
  async DASHBOARD_GET_COMMERCIAL_PERFORMANCE(p = {}) {
    const [leads, stages, config] = await Promise.all([
      getLeads(),
      getStageList(),
      getOne(COMMERCIAL_PERFORMANCE_CONFIG_KEY, {}),
    ]);
    const report = buildCommercialPerformanceReport({
      leads,
      stages,
      rangeDays: p?.rangeDays === 0 || p?.rangeDays === '0' ? 0 : (Number(p?.rangeDays) || 30),
      stageProbabilities: config?.stageProbabilities || {},
      now: Date.now(),
    });
    return { success: true, data: report };
  },
  async SALES_ANALYTICS_SAVE_CONFIG(p = {}) {
    const stages = await getStageList();
    const existing = await getOne(COMMERCIAL_PERFORMANCE_CONFIG_KEY, {});
    const input = p?.stageProbabilities && typeof p.stageProbabilities === 'object' && !Array.isArray(p.stageProbabilities)
      ? p.stageProbabilities : {};
    const previousProbabilities = existing?.stageProbabilities && typeof existing.stageProbabilities === 'object' && !Array.isArray(existing.stageProbabilities) ? existing.stageProbabilities : {};
    const stageProbabilities = { ...previousProbabilities };
    for (const stage of stages) {
      if (!Object.prototype.hasOwnProperty.call(input, stage.id)) continue;
      const probability = Number(input[stage.id]);
      if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
        return { success: false, error: `A probabilidade da etapa "${stage.title}" deve ficar entre 0% e 100%.` };
      }
      stageProbabilities[stage.id] = Math.round(probability * 10) / 10;
    }
    const config = { stageProbabilities, updatedAt: new Date().toISOString() };
    await setStore({ [COMMERCIAL_PERFORMANCE_CONFIG_KEY]: config });
    broadcast('COMMERCIAL_PERFORMANCE_UPDATED', { configUpdated: true });
    return { success: true, data: config };
  },
  async COMMERCIAL_MANAGEMENT_GET(p = {}) {
    const [leads, config] = await Promise.all([getLeads(), getCommercialManagementConfig()]);
    const month = validateCommercialMonth(p?.month) ? String(p.month) : '';
    return { success: true, data: { config, report: buildCommercialManagementReport({ leads, config, month, now: Date.now() }) } };
  },
  async DASHBOARD_GET_MANAGEMENT_INTELLIGENCE(p = {}) {
    const [leads, config, stages] = await Promise.all([getLeads(), getCommercialManagementConfig(), getStageList()]);
    const month = validateCommercialMonth(p?.month) ? String(p.month) : '';
    const managementReport = buildCommercialManagementReport({ leads, config, month, now: Date.now() });
    const report = buildManagementIntelligence({ leads, managementReport, stages, month, now: Date.now(), staleDays: p?.staleDays || 7 });
    return { success: true, data: report };
  },
  async DASHBOARD_GENERATE_MANAGEMENT_INSIGHTS(p = {}) {
    const [leads, managementConfig, stages, aiConfig] = await Promise.all([
      getLeads(), getCommercialManagementConfig(), getStageList(), getAiConfigInternal(),
    ]);
    const month = validateCommercialMonth(p?.month) ? String(p.month) : '';
    const now = Date.now();
    const managementReport = buildCommercialManagementReport({ leads, config: managementConfig, month, now });
    const report = buildManagementIntelligence({ leads, managementReport, stages, month, now, staleDays: p?.staleDays || 7 });
    const hasProvider = !!(aiConfig?.apiKey && aiConfig?.model) || (Array.isArray(aiConfig?.fallbackProviders) && aiConfig.fallbackProviders.some((item) => item?.apiKey && item?.model));
    if (!hasProvider) return { success: false, code: 'AI_PROVIDER_NOT_CONFIGURED', error: 'Configure e teste uma chave de IA em Configurações → Atendimento IA antes de gerar a análise gerencial.' };
    const previousRun = Number(await getOne('managementIntelligenceLastAiRun', 0)) || 0;
    if (now - previousRun < 60000) return { success: false, code: 'AI_COOLDOWN', error: 'Aguarde 1 minuto antes de solicitar outra análise com IA.' };
    await setStore({ managementIntelligenceLastAiRun: now });
    try {
      const outcome = await callAiProviderWithFallback(
        aiConfig,
        [{ role: 'user', content: buildManagementIntelligencePrompt(report.aiContext) }],
        'Analista de inteligência comercial. Responda em português do Brasil, com recomendações práticas, concisas e fundamentadas exclusivamente nos indicadores agregados fornecidos.',
      );
      const text = String(outcome?.text || '').trim().slice(0, 12000);
      if (!text) return { success: false, error: 'O provedor de IA retornou uma resposta vazia.' };
      return { success: true, data: { text, provider: outcome.provider, model: outcome.model, generatedAt: new Date().toISOString(), period: report.period, privacy: 'Somente indicadores agregados foram enviados ao provedor. Nomes, telefones e conteúdo de conversas dos leads não foram incluídos.' } };
    } catch (error) {
      return { success: false, error: String(error?.message || error).slice(0, 500) };
    }
  },
  async COMMERCIAL_MANAGEMENT_SAVE_TEAM(p = {}) {
    const input = p?.team && typeof p.team === 'object' ? p.team : {};
    const name = normalizeCommercialName(input.name, 120);
    if (!name) return { success: false, error: 'Informe o nome da equipe.' };
    const config = await getCommercialManagementConfig();
    const id = String(input.id || '');
    const duplicate = config.teams.find((item) => item.id !== id && normalizeCommercialName(item.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
    if (duplicate) return { success: false, error: 'Já existe uma equipe com esse nome.' };
    const now = new Date().toISOString();
    const existing = config.teams.find((item) => item.id === id);
    const team = { ...(existing || {}), id: existing?.id || uid('team'), name, active: true, createdAt: existing?.createdAt || now, updatedAt: now };
    if (existing) config.teams = config.teams.map((item) => item.id === id ? team : item);
    else config.teams.push(team);
    config.updatedAt = now;
    await setStore({ [COMMERCIAL_MANAGEMENT_CONFIG_KEY]: config });
    broadcast('COMMERCIAL_MANAGEMENT_UPDATED', { entity: 'team', id: team.id });
    return { success: true, data: { team, config } };
  },
  async COMMERCIAL_MANAGEMENT_SAVE_SELLER(p = {}) {
    const input = p?.seller && typeof p.seller === 'object' ? p.seller : {};
    const name = normalizeCommercialName(input.name, 120);
    if (!name) return { success: false, error: 'Informe o nome do vendedor.' };
    const rate = input.defaultCommissionRate === '' || input.defaultCommissionRate === null || input.defaultCommissionRate === undefined ? 0 : Number(input.defaultCommissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return { success: false, error: 'A comissão padrão deve ficar entre 0% e 100%.' };
    const config = await getCommercialManagementConfig();
    const id = String(input.id || '');
    const existing = config.sellers.find((item) => item.id === id);
    const duplicate = config.sellers.find((item) => item.id !== id && normalizeCommercialName(item.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
    if (duplicate) return { success: false, error: 'Já existe um vendedor cadastrado com esse nome.' };
    const teamId = String(input.teamId || '');
    if (teamId && !config.teams.some((item) => item.id === teamId && item.active !== false)) return { success: false, error: 'Selecione uma equipe ativa ou deixe o campo sem equipe.' };
    const now = new Date().toISOString();
    const seller = { ...(existing || {}), id: existing?.id || uid('seller'), name, teamId: teamId || '', defaultCommissionRate: Math.round(rate * 10) / 10, active: true, createdAt: existing?.createdAt || now, updatedAt: now };
    const history = Array.isArray(existing?.teamHistory) ? existing.teamHistory.filter((item) => item && typeof item === 'object') : [];
    if (!existing && teamId) history.push({ teamId, assignedAt: now, unassignedAt: null });
    if (existing && String(existing.teamId || '') !== teamId) {
      if (existing.teamId && !history.some((item) => !item.unassignedAt && String(item.teamId || '') === String(existing.teamId))) {
        history.push({ teamId: existing.teamId, assignedAt: existing.createdAt || existing.updatedAt || now, unassignedAt: null });
      }
      const activeIndex = [...history].map((item, index) => ({ item, index })).filter(({ item }) => !item.unassignedAt && String(item.teamId || '') === String(existing.teamId || '')).at(-1)?.index;
      if (activeIndex !== undefined) history[activeIndex] = { ...history[activeIndex], unassignedAt: now };
      if (teamId) history.push({ teamId, assignedAt: now, unassignedAt: null });
    }
    seller.teamHistory = history.slice(-100);
    if (existing) config.sellers = config.sellers.map((item) => item.id === id ? seller : item);
    else config.sellers.push(seller);
    config.updatedAt = now;
    await setStore({ [COMMERCIAL_MANAGEMENT_CONFIG_KEY]: config });
    if (existing && existing.name !== name) {
      const leads = await getLeads();
      const oldNameKey = normalizeCommercialName(existing.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
      let changed = false;
      for (const lead of leads) {
        const currentNameKey = normalizeCommercialName(lead.commercialOwner).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
        const currentMatches = String(lead.commercialOwnerId || '') === seller.id || (!!oldNameKey && currentNameKey === oldNameKey);
        let leadChanged = false;
        if (currentMatches) {
          lead.commercialOwner = name;
          lead.commercialOwnerId = seller.id;
          leadChanged = true;
        }
        if (Array.isArray(lead.commercialOwnerHistory)) {
          for (const entry of lead.commercialOwnerHistory) {
            const historyNameKey = normalizeCommercialName(entry?.owner).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
            if (String(entry?.ownerId || '') !== seller.id && (!oldNameKey || historyNameKey !== oldNameKey)) continue;
            entry.owner = name;
            entry.ownerId = seller.id;
            if (!entry.teamId) {
              const at = Date.parse(entry.assignedAt || '') || 0;
              const teamMatch = (seller.teamHistory || []).filter((item) => (Date.parse(item.assignedAt || '') || 0) <= at && (!(Date.parse(item.unassignedAt || '') || 0) || (Date.parse(item.unassignedAt || '') || 0) >= at)).at(-1);
              entry.teamId = teamMatch?.teamId || seller.teamId || '';
            }
            leadChanged = true;
          }
        }
        if (leadChanged) { lead.updatedAt = now; changed = true; }
      }
      if (changed) await putLeads(leads);
    }
    broadcast('COMMERCIAL_MANAGEMENT_UPDATED', { entity: 'seller', id: seller.id });
    return { success: true, data: { seller, config } };
  },
  async COMMERCIAL_MANAGEMENT_SAVE_PRODUCT(p = {}) {
    const input = p?.product && typeof p.product === 'object' ? p.product : {};
    const name = normalizeCommercialName(input.name, 160);
    if (!name) return { success: false, error: 'Informe o nome do produto ou serviço.' };
    const rate = input.commissionRate === '' || input.commissionRate === null || input.commissionRate === undefined ? 0 : Number(input.commissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return { success: false, error: 'A comissão do produto/serviço deve ficar entre 0% e 100%.' };
    const config = await getCommercialManagementConfig();
    const id = String(input.id || '');
    const duplicate = config.products.find((item) => item.id !== id && normalizeCommercialName(item.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
    if (duplicate) return { success: false, error: 'Já existe um produto/serviço com esse nome.' };
    const now = new Date().toISOString();
    const existing = config.products.find((item) => item.id === id);
    const product = { ...(existing || {}), id: existing?.id || uid('product'), name, kind: input.kind === 'service' ? 'service' : 'product', commissionRate: Math.round(rate * 10) / 10, active: true, createdAt: existing?.createdAt || now, updatedAt: now };
    if (existing) config.products = config.products.map((item) => item.id === id ? product : item);
    else config.products.push(product);
    config.updatedAt = now;
    await setStore({ [COMMERCIAL_MANAGEMENT_CONFIG_KEY]: config });
    broadcast('COMMERCIAL_MANAGEMENT_UPDATED', { entity: 'product', id: product.id });
    return { success: true, data: { product, config } };
  },
  async COMMERCIAL_MANAGEMENT_SAVE_GOAL(p = {}) {
    const input = p?.goal && typeof p.goal === 'object' ? p.goal : {};
    const month = String(input.month || '');
    if (!validateCommercialMonth(month)) return { success: false, error: 'Selecione um mês válido para a meta.' };
    const targetType = input.targetType === 'team' ? 'team' : 'seller';
    const targetId = String(input.targetId || '');
    const config = await getCommercialManagementConfig();
    const targetExists = targetType === 'team'
      ? config.teams.some((item) => item.id === targetId && item.active !== false)
      : config.sellers.some((item) => item.id === targetId && item.active !== false);
    if (!targetExists) return { success: false, error: 'Selecione um vendedor ou equipe ativa para a meta.' };
    const parseTarget = (value, label) => {
      if (value === '' || value === null || value === undefined) return 0;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1e12) throw new Error(`A meta de ${label} deve ser um número entre 0 e 1.000.000.000.000.`);
      return parsed;
    };
    let revenueTarget, salesTarget, leadsTarget;
    try {
      revenueTarget = Math.round(parseTarget(input.revenueTarget, 'receita') * 100) / 100;
      salesTarget = Math.round(parseTarget(input.salesTarget, 'vendas'));
      leadsTarget = Math.round(parseTarget(input.leadsTarget, 'leads'));
    } catch (error) { return { success: false, error: error.message }; }
    if (!(revenueTarget > 0 || salesTarget > 0 || leadsTarget > 0)) return { success: false, error: 'Informe pelo menos uma meta: receita, vendas ou leads.' };
    const id = String(input.id || '');
    const existing = config.goals.find((item) => item.id === id || (item.month === month && item.targetType === targetType && item.targetId === targetId));
    const now = new Date().toISOString();
    const goal = { ...(existing || {}), id: existing?.id || uid('goal'), month, targetType, targetId, revenueTarget, salesTarget, leadsTarget, active: true, createdAt: existing?.createdAt || now, updatedAt: now };
    delete goal.deletedAt;
    if (existing) config.goals = config.goals.map((item) => item.id === existing.id ? goal : item);
    else config.goals.push(goal);
    config.updatedAt = now;
    await setStore({ [COMMERCIAL_MANAGEMENT_CONFIG_KEY]: config });
    broadcast('COMMERCIAL_MANAGEMENT_UPDATED', { entity: 'goal', id: goal.id });
    return { success: true, data: { goal, config } };
  },
  async COMMERCIAL_MANAGEMENT_DELETE_ENTITY(p = {}) {
    const type = String(p?.entityType || '');
    const id = String(p?.id || '');
    if (!id || !['seller', 'team', 'product', 'goal'].includes(type)) return { success: false, error: 'Registro inválido.' };
    const config = await getCommercialManagementConfig();
    const key = `${type}s`;
    const index = config[key].findIndex((item) => item.id === id);
    if (index < 0) return { success: false, error: 'Registro não encontrado.' };
    const now = new Date().toISOString();
    if (type === 'team') {
      const assigned = config.sellers.some((seller) => seller.active !== false && seller.teamId === id);
      if (assigned) return { success: false, error: 'Transfira os vendedores desta equipe antes de desativá-la.' };
      config.teams[index] = { ...config.teams[index], active: false, updatedAt: now };
    } else if (type === 'seller') {
      config.sellers[index] = { ...config.sellers[index], active: false, updatedAt: now };
    } else if (type === 'product') {
      config.products[index] = { ...config.products[index], active: false, updatedAt: now };
    } else config.goals[index] = { ...config.goals[index], active: false, deletedAt: now, updatedAt: now };
    config.updatedAt = now;
    await setStore({ [COMMERCIAL_MANAGEMENT_CONFIG_KEY]: config });
    broadcast('COMMERCIAL_MANAGEMENT_UPDATED', { entity: type, id, deleted: true });
    return { success: true, data: { config } };
  },
  async COMMERCIAL_MANAGEMENT_UPDATE_COMMISSION_STATUS(p = {}) {
    const id = String(p?.leadId || '');
    if (!['paid', 'pending'].includes(String(p?.status || ''))) return { success: false, error: 'Status de comissão inválido.' };
    const status = String(p.status);
    const leads = await getLeads();
    const lead = leads.find((item) => String(leadId(item)) === id);
    if (!lead) return { success: false, error: 'Venda não encontrada.' };
    if (stageCategory(lead.stage) !== 'closed_won' || !(Number(lead.saleValue) > 0)) return { success: false, error: 'A comissão só pode ser atualizada para vendas ganhas com valor efetivamente vendido.' };
    const config = await getCommercialManagementConfig();
    if (status === 'paid') snapshotLeadCommission(lead, config, new Date().toISOString());
    if (!(Number(lead.commissionRateAtSale) > 0) || !(Number(lead.commissionAmountAtSale) > 0)) return { success: false, error: 'Não há comissão calculável. Cadastre o vendedor e informe um percentual de comissão para o vendedor ou produto/serviço.' };
    const now = new Date().toISOString();
    lead.commissionStatus = status;
    lead.commissionPaidAt = status === 'paid' ? now : null;
    lead.commissionStatusUpdatedAt = now;
    lead.updatedAt = now;
    appendCrmActivity(lead, {
      type: 'lead.commission_status_changed',
      title: status === 'paid' ? 'Comissão marcada como paga' : 'Comissão reaberta como pendente',
      description: `Comissão de ${Number(lead.commissionAmountAtSale).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ${status === 'paid' ? 'marcada como paga' : 'retornada para pendente'}.`,
      actor: 'Usuário', source: 'manual', createdAt: now, metadata: { status, amount: lead.commissionAmountAtSale, rate: lead.commissionRateAtSale },
    });
    await putLeads(leads);
    broadcast('COMMERCIAL_MANAGEMENT_UPDATED', { leadId: id, commissionStatus: status });
    broadcast('COMMERCIAL_PERFORMANCE_UPDATED', { leadId: id, commissionStatus: status });
    return { success: true, data: { lead } };
  },
  async GET_DASHBOARD_STATS() {
    const [campaigns, leads] = await Promise.all([getCampaigns(), getLeads()]);
    const today = new Date().toISOString().slice(0, 10);
    const sentToday = campaigns.reduce((n, c) => n + (c.lastSentDate === today ? (c.sentToday || 0) : 0), 0);
    const sent = campaigns.reduce((n, c) => n + (c.sent || 0), 0);
    const failed = campaigns.reduce((n, c) => n + (c.failed || 0), 0);
    const orders = await getOne(AI_ORDERS_KEY, []);
    const opportunities = leads.filter((lead) => ['opportunity','closed_won'].includes(stageCategory(lead.stage)) && !lead.blacklisted).length;
    const closedCustomers = leads.filter((lead) => stageCategory(lead.stage) === 'closed_won' || lead.saleClosed === true).length;
    const telemetry = await getOne(TELEMETRY_COUNTERS_KEY, { events: {} });
    const licenseState = await getLicenseState(); const ent = licenseState.payload?.ent;
    const canViewSalesFunnel = hasFeatureEntitlement(ent, 'telemetry.sales_funnel');
    const canViewTelemetry = hasFeatureEntitlement(ent, 'telemetry.usage');
    const canViewAwaitingReplies = hasFeatureEntitlement(ent, 'dashboard.awaiting_reply');
    const canViewAi = hasFeatureEntitlement(ent, 'whatsapp.ai_support');
    const canViewOrders = hasFeatureEntitlement(ent, 'whatsapp.ai_support.order_capture');
    return {
      success: true,
      data: {
        activeCampaigns: campaigns.filter((c) => c.status === 'running').length,
        sentToday,
        successRate: sent + failed ? Math.round((sent / (sent + failed)) * 100) : 0,
        leadsSaved: leads.length,
        conversationsDetected: canViewTelemetry ? (Number(telemetry.events?.['whatsapp.conversations.scanned']) || 0) : null,
        awaitingReplies: canViewAwaitingReplies ? (Number(telemetry.snapshots?.awaitingReplies) || 0) : null,
        opportunitiesOpened: opportunities,
        opportunitiesCreatedTotal: canViewSalesFunnel ? (Number(telemetry.events?.['crm.opportunity.opened']) || 0) : null,
        closedCustomers,
        aiConversations: canViewAi ? (Number(telemetry.events?.['ai.conversation.started']) || 0) : null,
        aiMessagesProcessed: canViewAi ? (Number(telemetry.events?.['ai.conversation.message_processed']) || 0) : null,
        pendingOrders: canViewOrders ? orders.filter((o) => ['awaiting_approval','error'].includes(o.status)).length : null,
        salesClosed: canViewSalesFunnel ? (Number(telemetry.events?.['crm.sale.closed']) || 0) : null,
        salesRevenue: canViewSalesFunnel ? orders.filter((o) => o.status === 'closed_won').reduce((sum, o) => sum + (Number.isFinite(Number(o.saleValue)) ? Number(o.saleValue) : 0), 0) : null,
        recentCampaigns: campaigns.slice(-5).reverse(),
      },
    };
  },
  async GET_AWAITING_REPLIES() {
    const leads = await getLeads();
    // v1.0.3-fix: distingue "sem pendências reais" de "histórico não sincronizado".
    // Se nenhum lead privado tiver evidência de mensagem recebida, o dashboard deve
    // indicar sincronização pendente em vez de "Tudo em dia!".
    let hasPrivateWithEvidence = false;
    const pending = leads.map((lead) => {
      const evidence = lead?.tipoEvidence || lead?.classifierEvidence || {};
      const incomingAt = evidence.lastIncomingAt || lead?.lastIncomingAt || null;
      const outgoingAt = evidence.lastOutgoingAt || lead?.lastOutgoingAt || null;
      const incomingMs = Date.parse(incomingAt || '');
      const outgoingMs = Date.parse(outgoingAt || '');
      const isPrivateWhatsAppLead = lead?.whatsappPrivate === true || lead?.source === 'whatsapp_private' || !!lead?.waChatId;
      if (!isPrivateWhatsAppLead || lead?.blacklisted || lead?.stage === 'blacklist' || normalizeType(lead?.tipo) === 'spam') return null;
      if (Number.isFinite(incomingMs)) hasPrivateWithEvidence = true;
      if (!Number.isFinite(incomingMs) || (Number.isFinite(outgoingMs) && outgoingMs >= incomingMs)) return null;
      return {
        id: String(leadId(lead) || ''),
        waChatId: String(lead?.waChatId || ''),
        name: String(lead?.name || 'Contato WhatsApp').slice(0, 160),
        phone: String(lead?.phone || ''),
        lastIncomingAt: incomingAt,
        lastOutgoingAt: outgoingAt,
        unreadCount: Number(lead?.whatsappUnreadCount) || 0,
        stage: String(lead?.stage || 'novo'),
      };
    }).filter(Boolean).sort((a, b) => Date.parse(a.lastIncomingAt) - Date.parse(b.lastIncomingAt));
    return {
      success: true,
      data: pending.slice(0, 100),
      meta: {
        totalPrivateLeads: leads.filter((l) => l?.whatsappPrivate === true || l?.source === 'whatsapp_private' || !!l?.waChatId).length,
        hasSyncedHistory: hasPrivateWithEvidence,
      },
    };
  },
  async OPEN_AWAITING_REPLY_CHAT(p) { return openWhatsAppChatForCrm(p || {}); },
  async OPEN_CRM_LEAD_CHAT(p) { return openWhatsAppChatForCrm(p || {}, { requireLead: true }); },
  // ---- Campanhas WhatsApp (locais, execução no WhatsApp Web)
  async GET_CAMPAIGNS() { return { success: true, data: await getCampaigns() }; },
  async GET_CAMPAIGN_REPORT(p) { return makeCampaignReport(p?.campaignId); },
  async REFRESH_CAMPAIGN_REPORT(p) { return captureCampaignReport(p?.campaignId, p?.period || 'manual', 'manual'); },
  async CREATE_CAMPAIGN(p) {
    if (!String(p?.name || '').trim() || !String(p?.template || '').trim()) return { success: false, error: 'Informe o nome e a mensagem da campanha.' };
    const blTails = await blacklistTails();
    const built = buildContacts(p.contacts || []);
    const leadsForTypes = await getLeads();
    const includeSpam = p?.includeSpam === true;
    const spamPhones = new Set(leadsForTypes.filter((l) => normalizeType(l.tipo) === 'spam').map((l) => phoneTail(l.phone)).filter(Boolean));
    const withoutSpam = includeSpam ? built : built.filter((x) => !spamPhones.has(phoneTail(x.phone)));
    const excludedSpam = built.length - withoutSpam.length;
    const contacts = withoutSpam.filter((x) => !blTails.has(phoneTail(x.phone)));
    const excludedBlacklist = withoutSpam.length - contacts.length;
    if (!contacts.length && excludedBlacklist) return { success: false, error: `Todos os ${excludedBlacklist} contatos estão na Black list.` };
    if (!contacts.length && excludedSpam) return { success: false, error: `Todos os ${excludedSpam} contatos estão classificados como Spam. Ative "Incluir Spam" para enviar.` };
    if (!contacts.length) return { success: false, error: 'Nenhum contato com telefone válido. Escolha ao menos um nível do CRM ou cole uma lista.' };
    const campaigns = await getCampaigns();
    const aiConfigForCampaign = await getAiConfigInternal();
    const requestedCampaignPersona = String(p.aiPersonaId || '').trim();
    const validCampaignPersona = (Array.isArray(aiConfigForCampaign.aiPersonas) ? aiConfigForCampaign.aiPersonas : []).some((persona) => persona.id === requestedCampaignPersona);
    const campaignPersonaId = validCampaignPersona ? requestedCampaignPersona : '';
    const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
    const delayMin = Math.max(1000, num(p.delayMin, 8000));
    const c = {
      id: uid('camp'), name: String(p.name).trim(), template: p.template, source: p.source || 'manual', contacts,
      audience: p.audience || null,
      aiPersonaId: campaignPersonaId,
      delayMin, delayMax: Math.max(delayMin, num(p.delayMax, 20000)),
      batchSize: Math.max(0, Math.min(1000, Math.floor(num(p.batchSize, 0)))), batchPauseMs: Math.max(0, Math.min(604800000, num(p.batchPauseMs, 0))),
      sendLimit: Math.max(0, Math.min(10000, Math.floor(num(p.sendLimit, 0)))),
      scheduleStart: p.scheduleStart, scheduleEnd: p.scheduleEnd, scheduleEnabled: !!p.scheduleEnabled,
      moveToStage: (await getStageIds()).includes(p.moveToStage) ? p.moveToStage : '',
      skipOwn: p.skipOwn !== false,
      excludedBlacklist, excludedSpam, includeSpam,
      status: 'draft', total: contacts.length, sent: 0, failed: 0, log: [], editVersion: 1, editHistory: [], reportCycle: 1, reportSnapshots: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    campaigns.push(c);
    await putCampaigns(campaigns);
    return { success: true, data: c };
  },
  async UPDATE_CAMPAIGN(p) {
    const campaigns = await getCampaigns();
    const c = campaigns.find((x) => x.id === p?.campaignId);
    if (!c) return { success: false, error: 'Campanha não encontrada' };
    if (c.status === 'running' || c.pauseRequestedAt) return { success: false, code: 'CAMPAIGN_MUST_BE_PAUSED', error: 'Pause a campanha e aguarde a confirmação antes de editar.' };
    const pending = (c.contacts || []).some((x) => !x.status);
    if (!['draft', 'paused', 'limit_reached', 'completed'].includes(c.status)) return { success: false, error: 'O estado atual da campanha não permite edição.' };
    if (c.status === 'completed' && !pending) return { success: false, error: 'Esta campanha já terminou e não possui contatos pendentes para aplicar alterações.' };

    const supplied = (key) => Object.prototype.hasOwnProperty.call(p || {}, key);
    const next = {};
    const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
    const time = (v, fallback) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : fallback;
    if (supplied('name')) {
      const value = String(p.name || '').trim().slice(0, 120);
      if (!value) return { success: false, error: 'O nome da campanha não pode ficar vazio.' };
      next.name = value;
    }
    if (supplied('template')) {
      const value = String(p.template || '').trim().slice(0, 5000);
      if (!value) return { success: false, error: 'A mensagem da campanha não pode ficar vazia.' };
      next.template = value;
    }
    if (supplied('delayMin')) next.delayMin = Math.max(1000, Math.min(3600000, num(p.delayMin, c.delayMin || 8000)));
    if (supplied('delayMax')) next.delayMax = Math.max(1000, Math.min(3600000, num(p.delayMax, c.delayMax || 20000)));
    if (next.delayMin === undefined && next.delayMax !== undefined) next.delayMin = Math.max(1000, Math.min(Number(c.delayMin) || 8000, next.delayMax));
    if (next.delayMax === undefined && next.delayMin !== undefined) next.delayMax = Math.max(next.delayMin, Math.min(3600000, Number(c.delayMax) || next.delayMin));
    if (next.delayMin !== undefined && next.delayMax !== undefined && next.delayMax < next.delayMin) next.delayMax = next.delayMin;
    if (supplied('batchSize')) next.batchSize = Math.max(0, Math.min(1000, Math.floor(num(p.batchSize, c.batchSize || 0))));
    if (supplied('batchPauseMs')) next.batchPauseMs = Math.max(0, Math.min(604800000, num(p.batchPauseMs, c.batchPauseMs || 0)));
    if (supplied('sendLimit')) next.sendLimit = Math.max(0, Math.min(10000, Math.floor(num(p.sendLimit, c.sendLimit || 0))));
    if (supplied('scheduleEnabled')) next.scheduleEnabled = p.scheduleEnabled === true;
    if (supplied('scheduleStart')) next.scheduleStart = time(p.scheduleStart, c.scheduleStart || '09:00');
    if (supplied('scheduleEnd')) next.scheduleEnd = time(p.scheduleEnd, c.scheduleEnd || '18:00');
    if (supplied('moveToStage')) next.moveToStage = String(p.moveToStage || '').trim() && (await getStageIds()).includes(String(p.moveToStage)) ? String(p.moveToStage) : '';
    if (supplied('aiPersonaId')) {
      const aiConfig = await getAiConfigInternal();
      const requested = String(p.aiPersonaId || '').trim();
      next.aiPersonaId = requested && (Array.isArray(aiConfig.aiPersonas) ? aiConfig.aiPersonas : []).some((persona) => persona.id === requested) ? requested : '';
    }
    if (supplied('skipOwn')) next.skipOwn = p.skipOwn !== false;

    const changed = {};
    const labels = { name: 'nome', template: 'mensagem', delayMin: 'intervalo mínimo', delayMax: 'intervalo máximo', batchSize: 'tamanho do lote', batchPauseMs: 'pausa entre lotes', sendLimit: 'limite de envios', scheduleEnabled: 'agendamento', scheduleStart: 'início do horário', scheduleEnd: 'fim do horário', moveToStage: 'estágio após envio', aiPersonaId: 'personalidade da IA', skipOwn: 'proteção do próprio número' };
    for (const [key, value] of Object.entries(next)) {
      if (JSON.stringify(c[key] ?? null) === JSON.stringify(value ?? null)) continue;
      changed[key] = key === 'template'
        ? { changed: true, previousLength: String(c[key] || '').length, newLength: String(value || '').length }
        : { from: c[key] ?? null, to: value };
    }
    if (!Object.keys(changed).length) return { success: true, data: c, unchanged: true };
    Object.assign(c, next);
    const at = new Date().toISOString();
    c.updatedAt = at;
    c.editVersion = Math.max(1, Math.floor(Number(c.editVersion) || 1)) + 1;
    c.editHistory = [...(Array.isArray(c.editHistory) ? c.editHistory : []), { at, version: c.editVersion, fields: changed }].slice(-50);
    const changedNames = Object.keys(changed).map((key) => labels[key] || key);
    c.log = [...(Array.isArray(c.log) ? c.log : []), { timestamp: at, contact: 'Sistema', success: true, note: `Configuração editada (v${c.editVersion}): ${changedNames.join(', ')}. Alterações aplicam-se somente aos contatos pendentes.` }].slice(-300);
    if (c.status === 'limit_reached' && (Number(c.sendLimit) === 0 || Number(c.sendLimit) > Number(c.sent || 0) + Number(c.failed || 0))) {
      c.status = 'paused';
      delete c.limitReachedAt;
    }
    await putCampaigns(campaigns);
    broadcast('CAMPAIGN_PROGRESS', { campaignId: c.id, status: c.status, sent: c.sent || 0, failed: c.failed || 0, total: c.total || (c.contacts || []).length, nextBatchAt: c.nextBatchAt || null, batchPauseMs: c.batchPauseMs || 0, event: 'CAMPAIGN_EDITED' });
    return { success: true, data: c, changedFields: changedNames };
  },
  async DELETE_CAMPAIGN(p) {
    await putCampaigns((await getCampaigns()).filter((c) => c.id !== (p?.campaignId ?? p?.id)));
    return { success: true };
  },
  async START_CAMPAIGN(p) {
    const campaigns = await getCampaigns();
    const c = campaigns.find((x) => x.id === p?.campaignId);
    if (!c) return { success: false, error: 'Campanha não encontrada' };
    if (c.status === 'running') return { success: false, code: 'CAMPAIGN_ALREADY_RUNNING', error: 'Esta campanha já está em execução.' };
    // Campanhas criadas antes da v7 só tinham contadores: converte para status por contato.
    if ((c.contacts || []).length && !c.contacts.some((x) => x.status) && (c.sent || c.failed)) {
      c.contacts.forEach((x, i) => { if (i < c.sent) x.status = 'sent'; else if (i < c.sent + c.failed) x.status = 'failed'; });
    }
    // v1.5.0: quem entrou na black list depois de a campanha ser criada também é ignorado.
    const blTails = await blacklistTails();
    const spamTails = new Set((await getLeads()).filter((l) => normalizeType(l.tipo) === 'spam').map((l) => phoneTail(l.phone)).filter(Boolean));
    for (const x of c.contacts || []) {
      if (x.status) continue;
      if (blTails.has(phoneTail(x.phone))) { x.status = 'skipped'; x.error = ''; x.skipReason = 'blacklist'; continue; }
      if (c.includeSpam !== true && spamTails.has(phoneTail(x.phone))) { x.status = 'skipped'; x.error = ''; x.skipReason = 'spam'; }
    }
    campaignCounts(c);
    const pendingAll = (c.contacts || []).filter((x) => !x.status);
    if (!pendingAll.length) { await putCampaigns(campaigns); return { success: false, error: 'Não há contatos pendentes nesta campanha (os da Black list são ignorados).' }; }
    const sendLimit = Math.max(0, Math.min(10000, Math.floor(Number(c.sendLimit) || 0)));
    const attemptsUsed = Math.max(0, Number(c.sent) || 0) + Math.max(0, Number(c.failed) || 0);
    const remainingLimit = sendLimit > 0 ? Math.max(0, sendLimit - attemptsUsed) : pendingAll.length;
    if (remainingLimit <= 0) {
      c.status = 'limit_reached'; c.limitReachedAt = new Date().toISOString();
      c.log = [...(c.log || []), { timestamp: c.limitReachedAt, contact: 'Sistema', success: true, note: `Limite de ${sendLimit} tentativas atingido. Aumente o limite ou defina 0 para continuar com todos os contatos pendentes.` }].slice(-300);
      await putCampaigns(campaigns);
      broadcast('CAMPAIGN_PROGRESS', { campaignId: c.id, status: c.status, sent: c.sent, failed: c.failed, total: c.total, event: 'CAMPAIGN_LIMIT_REACHED' });
      return { success: false, code: 'CAMPAIGN_LIMIT_REACHED', error: `O limite de ${sendLimit} tentativas já foi atingido. Edite a campanha para aumentar o limite ou use 0 para todos os contatos.` };
    }
    const pending = pendingAll.slice(0, remainingLimit);
    const wa = await requireWhatsApp();
    // v7.0.5 - O WhatsApp precisa estar VISÍVEL (aba ativa ou janela ao lado), em qualquer modo.
    // Exceção de DIAGNÓSTICO (desligada por padrão): "enviar mesmo oculto" serve para provar se a visibilidade é necessária (H-C).
    const allowHidden = (await getOne('waAllowHidden', true)) !== false; // v1.0.0-pro: segundo plano ligado por padrão
    if (allowHidden && !wa.conn?.visible) saveSystemLog({ module: 'whatsapp-web', action: 'HIDDEN_SEND_ALLOWED', status: 'warn', message: 'Modo segundo plano: iniciando com o WhatsApp oculto', data: { tabId: wa.tab.id, tabActive: !!wa.conn?.tabActive, pageHidden: !!wa.conn?.hidden, windowMode: !!wa.conn?.windowMode } });
    if (wa.frameId != null) {
      // Modo embutido (experimental): vale a aba da extensão.
      if (!(await hostVisible(wa.tab))) {
        return { success: false, code: 'WA_NOT_VISIBLE', error: 'Mantenha a aba do i9Leads Flow em primeiro plano (visível) e tente novamente.' };
      }
    } else if (!wa.conn?.visible && !allowHidden) {
      if (!p?.bringToFront) {
        saveSystemLog({ module: 'whatsapp-web', action: 'START_BLOCKED_NOT_VISIBLE', status: 'warn', message: 'WhatsApp fora de vista', data: { tabId: wa.tab.id, tabActive: !!wa.conn?.tabActive, pageHidden: !!wa.conn?.hidden, windowMode: !!wa.conn?.windowMode } });
        return {
          success: false, code: 'WA_NOT_VISIBLE',
          error: wa.conn?.windowMode
            ? 'A janela do WhatsApp está coberta ou minimizada. Deixe-a visível ao lado desta janela para enviar.'
            : 'A aba do WhatsApp Web está em segundo plano. Deixe-a ativa (visível) durante o envio ou use a janela lateral.',
          windowMode: !!wa.conn?.windowMode,
        };
      }
      await bringWaToFront(wa.tab);
      await new Promise((res) => setTimeout(res, 700));
      saveSystemLog({ module: 'whatsapp-web', action: 'WA_BROUGHT_TO_FRONT', status: 'info', message: 'WhatsApp trazido para frente antes de iniciar', data: { tabId: wa.tab.id } });
    }
    const settings = await getSettings();
    const delayMin = Number(c.delayMin || settings.delayContactMin || 8000);
    const prevStatus = c.status;
    const prevFinishedAt = c.finishedAt || null;
    const prevReportCycle = Math.max(1, Number(c.reportCycle) || 1);
    if (c.finishedAt) {
      await clearCampaignReportAlarms(c.id);
      c.reportCycle = Math.max(1, Number(c.reportCycle) || 1) + 1;
    }
    // Marca como "em andamento" ANTES de enviar: os eventos do WhatsApp podem chegar imediatamente.
    c.status = 'running'; c.startedAt = c.startedAt || new Date().toISOString(); delete c.finishedAt;
    await putCampaigns(campaigns);
    const r = await sendToTabEnsured(wa.tab, 'whatsapp', {
      type: 'START_CAMPAIGN',
      payload: {
        id: c.id, template: c.template,
        contacts: pending.map(({ name, phone, email, company, category, stage, labels }) => ({ name, phone, email, company, category, stage, labels })),
        blacklist: [...blTails],
        skipOwn: c.skipOwn !== false,
        delayRange: { min: delayMin, max: Math.max(delayMin, Number(c.delayMax || settings.delayContactMax || 20000)) },
        batch: c.batchSize > 0 && c.batchPauseMs > 0 ? { size: c.batchSize, pauseMs: c.batchPauseMs } : null,
        schedule: c.scheduleEnabled && c.scheduleStart && c.scheduleEnd ? { start: c.scheduleStart, end: c.scheduleEnd } : null,
        allowHidden,
      },
    }, wa.frameId);
    if (!r.success) {
      const again = await getCampaigns(); const cc = again.find((x) => x.id === c.id);
      if (cc) { cc.status = prevStatus; cc.reportCycle = prevReportCycle; if (prevFinishedAt) cc.finishedAt = prevFinishedAt; else delete cc.finishedAt; await putCampaigns(again); if (prevFinishedAt) await scheduleCampaignReportAlarms(cc); }
      return r;
    }
    return { success: true, data: c };
  },
  /** Reenvia apenas os contatos que falharam (ex.: após corrigir a conexão). */
  async RETRY_FAILED_CAMPAIGN(p) {
    const campaigns = await getCampaigns();
    const c = campaigns.find((x) => x.id === p?.campaignId);
    if (!c) return { success: false, error: 'Campanha não encontrada' };
    const failed = (c.contacts || []).filter((x) => x.status === 'failed');
    if (!failed.length) return { success: false, error: 'Nenhum contato com falha para reenviar.' };
    failed.forEach((x) => { delete x.status; delete x.error; });
    campaignCounts(c);
    await putCampaigns(campaigns);
    return handlers.START_CAMPAIGN({ campaignId: c.id, bringToFront: !!p?.bringToFront });
  },
  async PAUSE_CAMPAIGN(p) {
    const campaignId = p?.campaignId ?? p?.id;
    let campaigns = await getCampaigns();
    let c = campaigns.find((x) => x.id === campaignId);
    if (!c) return { success: false, error: 'Campanha não encontrada.' };
    if (c.status !== 'running') return { success: c.status === 'paused' || c.status === 'limit_reached' || c.status === 'completed', data: c };
    c.pauseRequestedAt = new Date().toISOString();
    await putCampaigns(campaigns);
    try {
      const wa = await requireWhatsApp();
      const result = await sendToTab(wa.tab.id, { type: 'PAUSE_CAMPAIGN', payload: { campaignId: c.id } }, wa.frameId);
      if (result?.success === false) throw new Error(result.error || 'O WhatsApp não confirmou o pedido de pausa.');
    } catch (error) {
      campaigns = await getCampaigns(); c = campaigns.find((x) => x.id === campaignId);
      if (c) { delete c.pauseRequestedAt; await putCampaigns(campaigns); }
      return { success: false, code: 'PAUSE_REQUEST_FAILED', error: `Não foi possível solicitar a pausa segura: ${error?.message || 'WhatsApp indisponível'}` };
    }
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      campaigns = await getCampaigns(); c = campaigns.find((x) => x.id === campaignId);
      if (c && !c.pauseRequestedAt && ['paused', 'completed', 'limit_reached'].includes(c.status)) return { success: true, data: c };
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    campaigns = await getCampaigns(); c = campaigns.find((x) => x.id === campaignId);
    if (c && c.status === 'running') { delete c.pauseRequestedAt; await putCampaigns(campaigns); }
    return { success: false, code: 'PAUSE_NOT_CONFIRMED', error: 'A pausa ainda não foi confirmada pelo WhatsApp. Nenhuma edição foi aplicada; verifique a conexão e tente novamente.' };
  },
  async RESUME_CAMPAIGN(p) {
    // Reinicia do ponto em que parou (contatos restantes).
    return handlers.START_CAMPAIGN({ campaignId: p?.campaignId, bringToFront: !!p?.bringToFront });
  },
  async STOP_CAMPAIGN(p) { return campaignControl('STOP_CAMPAIGN', p, 'completed'); },

  // ---- Conexão do WhatsApp Web (menu WhatsApp)
  // ---- Conexão do WhatsApp Web (painel embutido)
  async WA_CONNECT() { await ensureEmbedRules(); return { success: true, data: await waConnection() }; },
  /** v7.0.5 - Liga/desliga o WhatsApp embutido (experimental). Desligado = nenhuma requisição de iframe. */
  async WA_SET_EMBED(p) {
    const enabled = p?.enabled === true;
    await chrome.storage.local.set({ waEmbedExperimental: enabled });
    await ensureEmbedRules();
    saveSystemLog({ module: 'whatsapp-web', action: 'WA_EMBED_SETTING', status: 'info', message: 'WhatsApp embutido (experimental): ' + (enabled ? 'ligado' : 'desligado'), data: { enabled } });
    return { success: true, data: { enabled } };
  },
  /** Chave de DIAGNÓSTICO: permite enviar com o WhatsApp oculto (para o teste T2/T4 da hipótese H-C). */
  async WA_SET_ALLOW_HIDDEN(p) {
    const enabled = p?.enabled === true;
    await chrome.storage.local.set({ waAllowHidden: enabled });
    saveSystemLog({ module: 'whatsapp-web', action: 'WA_ALLOW_HIDDEN_SETTING', status: 'info', message: 'Enviar mesmo com o WhatsApp oculto (teste): ' + (enabled ? 'ligado' : 'desligado'), data: { enabled } });
    return { success: true, data: { enabled } };
  },
  async WA_GET_EMBED() { return { success: true, data: { enabled: await getEmbedEnabled() } }; },
  /** "Usar esta aba": fixa a aba do WhatsApp escolhida e a traz para frente. */
  async WA_USE_TAB(p) {
    const { tabs } = await sortedWaTabs();
    const tab = tabs.find((t) => t.id === p?.tabId) || tabs[0];
    if (!tab) return { success: false, error: 'Nenhuma aba do WhatsApp Web encontrada. Use "Abrir WhatsApp".' };
    await chrome.storage.local.set({ waTabId: tab.id });
    keepTabAlive(tab.id);
    await bringWaToFront(tab);
    saveSystemLog({ module: 'whatsapp-web', action: 'WA_TAB_CHOSEN', status: 'info', message: 'Aba do WhatsApp escolhida', data: { tabId: tab.id, windowId: tab.windowId } });
    return { success: true, data: { tabId: tab.id } };
  },
  /** Abre o WhatsApp Web numa aba comum (ativa), ou reaproveita a que já existe. */
  async WA_OPEN_NEW_TAB() {
    const { tabs } = await sortedWaTabs();
    if (tabs[0]) { await bringWaToFront(tabs[0]); await chrome.storage.local.set({ waTabId: tabs[0].id }); return { success: true, data: { tabId: tabs[0].id, reused: true } }; }
    const tab = await chrome.tabs.create({ url: 'https://web.whatsapp.com/', active: true });
    await chrome.storage.local.set({ waTabId: tab.id });
    saveSystemLog({ module: 'whatsapp-web', action: 'WA_TAB_OPENED', status: 'info', message: 'WhatsApp Web aberto em aba comum', data: { tabId: tab.id } });
    return { success: true, data: { tabId: tab.id, reused: false } };
  },
  async WA_STATUS() { return { success: true, data: await waConnection() }; },
  /** Define o nível de compatibilidade das regras do iframe (0 = padrão, 1 = compatível) e as reaplica. */
  async WA_SET_LEVEL(p) {
    const level = Math.max(0, Math.min(1, Number(p?.level) || 0));
    await chrome.storage.local.set({ waLevel: level, waRulesRelaxed: level >= 1 });
    await ensureEmbedRules();
    saveSystemLog({ module: 'whatsapp-web', action: 'WA_LEVEL', status: 'info', message: 'Nível de compatibilidade: ' + level, data: { level } });
    return { success: true, data: { level } };
  },
  /** Compatibilidade com a v7.0.2: "modo compatível" = nível 1. */
  async WA_RULES_RELAX() { return handlers.WA_SET_LEVEL({ level: 1 }); },
  /**
   * Alternativa ao iframe: WhatsApp Web numa JANELA lateral (aba de verdade, visível, sem iframe).
   * Reaproveita a aba comum do WhatsApp já aberta (evita "aberto em outra janela") e posiciona
   * a janela ao lado da extensão, sem sobreposição, para o Chrome não tratá-la como oculta.
   */
  async WA_OPEN_WINDOW(p, sender) {
    // v1.0.3-fix2: layout 90/10 real — WhatsApp ocupa ~10% da tela, i9Hub ~90%.
    // A largura mínima de 380px evita que o WhatsApp fique inutilizável em telas pequenas.
    const waRatio = 0.10;
    const minWaWidth = 380;
    const area = p?.screen && p.screen.width > 900 && p.screen.height > 500 ? p.screen : null;
    const width = area ? Math.max(minWaWidth, Math.round(area.width * waRatio)) : 460;
    const opts = { type: 'popup', focused: true, width };
    if (area) {
      opts.left = Math.round(area.left + area.width - width);
      opts.top = Math.round(area.top);
      opts.height = Math.round(area.height);
      if (sender?.tab?.windowId != null) {
        await chrome.windows.update(sender.tab.windowId, {
          state: 'normal', left: Math.round(area.left), top: Math.round(area.top),
          width: Math.round(area.width - width), height: Math.round(area.height),
        }).catch(() => {});
      }
    }
    const { waWindowId } = await chrome.storage.local.get('waWindowId');
    if (waWindowId != null) {
      const w = await chrome.windows.get(waWindowId, { populate: true }).catch(() => null);
      if (w) { await chrome.windows.update(w.id, { focused: true }).catch(() => {}); return { success: true, data: { windowId: w.id, reused: true } }; }
    }
    const { tabs } = await sortedWaTabs();
    const win = tabs.length
      ? await chrome.windows.create({ tabId: tabs[0].id, ...opts })
      : await chrome.windows.create({ url: 'https://web.whatsapp.com/', ...opts });
    await chrome.storage.local.set({ waWindowId: win.id });
    saveSystemLog({ module: 'whatsapp-web', action: 'WA_WINDOW_OPENED', status: 'info', message: 'WhatsApp aberto em janela lateral', data: { windowId: win.id, movedTab: tabs.length > 0, arranged: !!area } });
    return { success: true, data: { windowId: win.id, movedTab: tabs.length > 0 } };
  },
  /** Relatório para suporte: regras, frames, estado da conexão e sondagem DENTRO do iframe. */
  async WA_DIAGNOSE() {
    const out = { version: EXT_VERSION, time: new Date().toISOString(), chrome: (navigator.userAgent.match(/Chrome\/[\d.]+/) || [''])[0] };
    try { out.rules = await chrome.declarativeNetRequest.getDynamicRules(); } catch (e) { out.rulesError = e.message; }
    out.level = await getWaLevel();
    const emb = await findEmbeddedWhatsApp().catch(() => null);
    out.embeddedFrame = emb ? { tabId: emb.tab.id, frameId: emb.frameId, tabActive: emb.tab.active } : null;
    if (emb) {
      try {
        const frames = (await chrome.webNavigation.getAllFrames({ tabId: emb.tab.id })) || [];
        out.frames = frames.map((f) => ({ frameId: f.frameId, parent: f.parentFrameId, url: (f.url || '').slice(0, 120), error: !!f.errorOccurred }));
      } catch (e) { out.framesError = e.message; }
      try {
        const [r] = await chrome.scripting.executeScript({ target: { tabId: emb.tab.id, frameIds: [emb.frameId] }, func: waFrameProbe });
        out.frameProbe = r?.result || null;
      } catch (e) { out.frameProbeError = e.message; }
    }
    const { waWindowId, waTabId } = await chrome.storage.local.get(['waWindowId', 'waTabId']);
    out.sideWindow = waWindowId ?? null;
    out.chosenTab = waTabId ?? null;
    out.embedExperimental = await getEmbedEnabled();
    try { out.connection = await waConnection(); } catch (e) { out.connectionError = e.message; }
    // v7.0.5: estado do acesso interno (envio rápido) e da visibilidade, para saber se o envio por busca é evitável.
    out.storeInternals = out.connection?.storeInternals || null;
    out.visibility = out.connection ? { visible: out.connection.visible ?? null, pageHidden: out.connection.hidden ?? null, tabActive: out.connection.tabActive ?? null, windowMode: !!out.connection.windowMode } : null;
    return { success: true, data: out };
  },
  /** Só para o modo "aba comum" (o painel embutido recarrega a si mesmo). */
  async WA_RELOAD() {
    const { tabs } = await sortedWaTabs(); // v7.0.5: recarrega a aba escolhida/conectada, não "a primeira"
    if (!tabs[0]) return { success: false, error: 'Nenhuma aba do WhatsApp Web encontrada.' };
    await chrome.tabs.reload(tabs[0].id);
    return { success: true };
  },
  async WA_OPEN_TAB() {
    const { waWindowId } = await chrome.storage.local.get('waWindowId');
    const { tabs: sortedTabs } = await sortedWaTabs();
    const tabs = sortedTabs.sort((x, y) => Number(y.windowId === waWindowId) - Number(x.windowId === waWindowId));
    if (tabs[0]) { await bringWaToFront(tabs[0]); return { success: true }; }
    return handlers.WA_OPEN_NEW_TAB();
  },

  // ---- v1.5.0: Black list
  async GET_BLACKLIST() { return { success: true, data: await getBlacklist() }; },
  async BLACKLIST_ADD(p, sender) {
    const phone = String(p?.phone || '').replace(/\D/g, '').slice(0, 15);
    if (phone.length < 7 || phone.length > 15) return { success: false, error: 'Telefone inválido para a black list.' };
    return blacklistAdd({ phone, name: String(p?.name || '').slice(0, 120), source: sender?.tab ? 'whatsapp' : String(p?.source || 'manual').slice(0, 40), reason: String(p?.reason || '').slice(0, 200) });
  },
  async BLACKLIST_REMOVE(p) { return blacklistRemove(p || {}); },

  // ---- v1.6.0: Consent tracking (opt-in/opt-out por palavra-chave ou link)
  async CONSENT_UPDATE(p, sender) {
    const phone = String(p?.phone || '').replace(/\D/g, '').slice(0, 15);
    if (phone.length < 7 || phone.length > 15) return { success: false, error: 'Telefone inválido para atualização de consentimento.' };
    const status = p?.status;
    if (status !== 'opted_in' && status !== 'opted_out') return { success: false, error: 'Status de consentimento inválido.' };
    const source = String(p?.source || 'keyword').slice(0, 40);
    const ok = await setConsentForPhone(phone, status, source, { campaignId: p?.campaignId, message: p?.message });
    if (!ok) return { success: false, error: 'Falha ao persistir consentimento.' };
    saveSystemLog({ level: 'info', module: 'compliance', action: 'CONSENT_UPDATED', status: 'success', message: `${status} via ${source}`, data: { phoneTail: phone.slice(-8), source } });
    return { success: true, data: { phone, status, source } };
  },
  /** Do CRM: vários contatos de uma vez; tenta também aplicar a etiqueta no WhatsApp (se conectado). */
  async BLACKLIST_ADD_MANY(p) {
    const items = (p?.items || []).filter((x) => x && x.phone);
    if (!items.length) return { success: false, error: 'Nenhum contato com telefone.' };
    let labelRes = null;
    try {
      const wa = await requireWhatsApp();
      const r = await sendToTabEnsured(wa.tab, 'whatsapp', { type: 'BLACKLIST_APPLY_LABELS', payload: { phones: items.map((x) => normWaPhone(x.phone)) } }, wa.frameId);
      if (r.success) labelRes = r.data;
    } catch { /* sem WhatsApp conectado */ }
    let added = 0; let already = 0; let invalid = 0;
    for (const it of items) {
      const r = await blacklistAdd({ phone: it.phone, name: it.name, source: p?.source || 'crm', labelApplied: !!labelRes?.applied });
      if (!r.success) invalid++; else if (r.data.isNew) added++; else already++;
    }
    return { success: true, data: { added, already, invalid, total: (await getBlacklist()).length, label: labelRes } };
  },

  // ---- Gestão nativa do funil comercial (sem dependência das etiquetas do WhatsApp)
  async GET_STAGES() {
    return { success: true, data: { stages: await getStageList(), config: await getCrmStageConfig(), lastSync: await getOne(K.LABEL_SYNC, null) } };
  },
  async SAVE_CRM_STAGE_CONFIG(p = {}) {
    const current = await getCrmStageConfig();
    const incoming = p?.config && typeof p.config === 'object' ? p.config : {};
    const next = normalizeCrmStageConfig({ ...current, ...incoming, updatedAt: new Date().toISOString() });
    const currentIds = new Set(current.custom.map((stage) => stage.id));
    const nextIds = new Set(next.custom.map((stage) => stage.id));
    const removed = [...currentIds].filter((id) => !nextIds.has(id));
    if (removed.length) return { success: false, code: 'STAGE_DELETE_USE_ACTION', error: 'Para remover uma etapa, use a ação de exclusão com transferência dos leads. Assim o CRM não perde oportunidades.' };
    const built = buildCrmStageList(DEFAULT_STAGES, await getCustomStages(), next);
    const nameKeys = new Set();
    for (const stage of built) {
      const key = String(stage.title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (key && nameKeys.has(key)) return { success: false, code: 'DUPLICATE_STAGE_NAME', error: `Já existe uma etapa chamada "${stage.title}". Use nomes diferentes para evitar confusão no funil.` };
      if (key) nameKeys.add(key);
    }
    await setStore({ [K.CRM_STAGE_CONFIG]: next });
    broadcast('CRM_STAGES_UPDATED', { updatedAt: next.updatedAt });
    return { success: true, data: { config: next, stages: await getStageList() } };
  },
  async DELETE_CRM_STAGE(p = {}) {
    const stageId = String(p.stageId || '');
    const current = await getCrmStageConfig();
    const stage = current.custom.find((item) => item.id === stageId);
    if (!stage) return { success: false, error: 'Somente etapas personalizadas do CRM podem ser removidas. As etapas essenciais do sistema podem ser renomeadas, mas não excluídas.' };
    const leads = await getLeads();
    const assigned = leads.filter((lead) => String(lead.stage || 'novo') === stageId);
    const validStages = (await getStageList()).filter((item) => item.id !== stageId);
    let migrateTo = String(p.migrateTo || '');
    if (assigned.length && !migrateTo) return { success: false, code: 'STAGE_MIGRATION_REQUIRED', count: assigned.length, options: validStages.map(({ id, title }) => ({ id, title })), error: `Existem ${assigned.length} lead(s) nesta etapa. Escolha uma etapa de destino antes de removê-la.` };
    if (assigned.length && !validStages.some((item) => item.id === migrateTo)) return { success: false, error: 'Selecione uma etapa de destino válida.' };
    const now = new Date().toISOString();
    if (assigned.length) for (const lead of assigned) { lead.stage = migrateTo; lead.stageUpdatedAt = now; lead.updatedAt = now; }
    const next = normalizeCrmStageConfig({ ...current, custom: current.custom.filter((item) => item.id !== stageId), deletedCustomIds: [...(current.deletedCustomIds || []), stageId], updatedAt: now });
    const aiConfig = await getAiConfigInternal();
    const aiConfigChanged = aiConfig.qualifiedStage === stageId;
    if (aiConfigChanged) { aiConfig.qualifiedStage = migrateTo || (validStages.some((item) => item.id === 'qualificado') ? 'qualificado' : 'novo'); aiConfig.updatedAt = now; }
    const patch = { [K.CRM_STAGE_CONFIG]: next };
    if (assigned.length) patch[K.LEADS] = leads;
    if (aiConfigChanged) patch[AI_CONFIG_KEY] = aiConfig;
    await setStore(patch);
    broadcast('CRM_STAGES_UPDATED', { deletedStage: stageId, migrated: assigned.length, migrateTo });
    return { success: true, data: { removed: stageId, migrated: assigned.length, migrateTo, stages: await getStageList() } };
  },
  // ---- Taxonomia interna dinâmica de nichos, subnichos e etiquetas livres
  async GET_NICHE_TAXONOMY() {
    const taxonomy = await getNicheTaxonomy();
    const leads = await getLeads();
    const counts = {};
    for (const lead of leads) {
      for (const id of new Set([...(lead.aiNicheClassification?.nodeIds || []), ...((lead.aiNicheClassifications || []).flatMap((item) => item.nodeIds || []))])) counts[id] = (counts[id] || 0) + 1;
      for (const id of lead.aiTagIds || []) counts[id] = (counts[id] || 0) + 1;
    }
    return { success: true, data: { ...taxonomy, nodes: taxonomy.nodes.filter((node) => !node.deletedAt).map((node) => ({ ...node, leadCount: counts[node.id] || 0 })) } };
  },
  async SAVE_NICHE_NODE(p = {}) {
    const now = new Date().toISOString();
    let taxonomy = await getNicheTaxonomy();
    const result = p.id
      ? updateTaxonomyNode(taxonomy, String(p.id), { name: p.name, parentId: p.parentId, aliases: p.aliases, source: 'manual' }, now)
      : createTaxonomyNode(taxonomy, { name: p.name, parentId: p.parentId || null, type: p.type === 'tag' ? 'tag' : 'niche', source: 'manual' }, now, (name, type) => uid(type === 'tag' ? 'tag' : 'niche'));
    if (!result.success) return result;
    taxonomy = normalizeNicheTaxonomy({ ...result.taxonomy, updatedAt: now });
    const leads = await getLeads();
    if (p.id) {
      for (let i = 0; i < leads.length; i++) leads[i] = rebuildLeadTaxonomyFields(leads[i], taxonomy);
      await putLeads(leads);
    }
    await setStore({ [K.NICHE_TAXONOMY]: taxonomy });
    broadcast('CRM_NICHE_TAXONOMY_UPDATED', { nodeId: result.node.id, action: p.id ? 'renamed' : (result.created ? 'created' : 'existing') });
    return { success: true, data: { node: result.node, taxonomy, created: result.created !== false, duplicate: result.duplicate === true } };
  },
  async DELETE_NICHE_NODE(p = {}) {
    const now = new Date().toISOString();
    const result = deleteTaxonomyNode(await getNicheTaxonomy(), String(p.id || ''), now);
    if (!result.success) return result;
    const leads = await getLeads();
    for (let i = 0; i < leads.length; i++) leads[i] = rebuildLeadTaxonomyFields(leads[i], result.taxonomy);
    await putLeads(leads);
    await setStore({ [K.NICHE_TAXONOMY]: result.taxonomy });
    broadcast('CRM_NICHE_TAXONOMY_UPDATED', { nodeId: p.id, action: 'deleted' });
    return { success: true, data: { nodeId: p.id, taxonomy: result.taxonomy } };
  },
  async MERGE_NICHE_NODES(p = {}) {
    const now = new Date().toISOString();
    const sourceId = String(p.sourceId || '');
    const targetId = String(p.targetId || '');
    const result = mergeTaxonomyNodes(await getNicheTaxonomy(), sourceId, targetId, now);
    if (!result.success) return result;
    const leads = await getLeads();
    let updatedLeads = 0;
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i] || {};
      const hasSourceReference = (lead.aiNicheClassification?.nodeIds || []).some((id) => String(id) === sourceId)
        || (lead.aiNicheClassifications || []).some((item) => (item?.nodeIds || []).some((id) => String(id) === sourceId))
        || (lead.aiTagIds || []).some((id) => String(id) === sourceId);
      if (!hasSourceReference) continue;
      const replaceIds = (values) => [...new Set((Array.isArray(values) ? values : []).map((id) => String(id) === sourceId ? targetId : id))];
      const current = lead.aiNicheClassification && typeof lead.aiNicheClassification === 'object'
        ? { ...lead.aiNicheClassification, nodeIds: replaceIds(lead.aiNicheClassification.nodeIds) } : lead.aiNicheClassification;
      const rawClassifications = Array.isArray(lead.aiNicheClassifications) ? [...lead.aiNicheClassifications] : [];
      if (current?.nodeIds?.length && !rawClassifications.some((item) => replaceIds(item?.nodeIds).join('>') === current.nodeIds.join('>'))) rawClassifications.push(current);
      const classifications = rawClassifications.map((item) => ({ ...item, nodeIds: replaceIds(item?.nodeIds) }));
      const next = {
        ...lead,
        ...(current ? { aiNicheClassification: current } : {}),
        ...(rawClassifications.length ? { aiNicheClassifications: classifications } : {}),
        aiTagIds: replaceIds(lead.aiTagIds),
        updatedAt: now,
      };
      leads[i] = rebuildLeadTaxonomyFields(next, result.taxonomy);
      updatedLeads++;
    }
    await putLeads(leads);
    await setStore({ [K.NICHE_TAXONOMY]: result.taxonomy });
    broadcast('CRM_NICHE_TAXONOMY_UPDATED', { nodeId: targetId, sourceId, action: 'merged', updatedLeads });
    return { success: true, data: { sourceId, targetId, updatedLeads, reparentedChildren: result.reparentedChildren, taxonomy: result.taxonomy } };
  },
  async WA_LABELS_DIAGNOSTIC() {
    const wa = await requireWhatsApp();
    const r = await sendToTabEnsured(wa.tab, 'whatsapp', { type: 'LABELS_DIAGNOSTIC', payload: {} }, wa.frameId);
    if (!r.success) return r;
    return { success: true, data: r.data };
  },
  async WA_LABELS_SYNC(p) {
    const wa = await requireWhatsApp();
    const r = await sendToTabEnsured(wa.tab, 'whatsapp', { type: 'LABELS_LIST', payload: {} }, wa.frameId);
    if (!r?.success) {
      if (/NO_LABEL_COLLECTION/.test(r?.error || '')) return { success: false, code: 'NO_LABELS', error: 'Não encontrei etiquetas disponíveis. Elas normalmente exigem uma conta WhatsApp Business. Rode o Diagnóstico de etiquetas para verificar o que o WhatsApp Web expõe.' };
      return r || { success: false, error: 'O WhatsApp não respondeu à leitura das etiquetas.' };
    }
    const d = r.data || {};
    const allLabels = (Array.isArray(d.labels) ? d.labels : []).filter((l) => l && String(l.id ?? '') && String(l.name || '').trim() && !l.deleted);
    if (!allLabels.length) return { success: false, code: 'NO_LABELS', error: 'A leitura foi concluída, mas nenhuma etiqueta ativa foi encontrada neste WhatsApp Business.' };

    // A etiqueta especial de bloqueio nunca é um público comercial de campanha.
    const blLabelIds = new Set(allLabels.filter((l) => isBlacklistLabelName(l.name)).map((l) => String(l.id)));
    const labels = allLabels.filter((l) => !blLabelIds.has(String(l.id)));
    const blacklistBefore = new Set((await getBlacklist()).map((entry) => phoneTail(entry.phone)).filter(Boolean));
    let blacklistImported = 0;
    for (const c of (Array.isArray(d.contacts) ? d.contacts : [])) {
      if (!(Array.isArray(c.labelIds) ? c.labelIds : []).some((id) => blLabelIds.has(String(id)))) continue;
      const phone = normWaPhone(c.phone); const tail = phoneTail(phone);
      const existed = tail && blacklistBefore.has(tail);
      const rr = await blacklistAdd({ phone, name: c.name, source: 'etiqueta', labelApplied: true });
      if (rr.success && tail) { if (!existed) blacklistImported++; blacklistBefore.add(tail); }
    }
    if (!labels.length) {
      const summary = { at: new Date().toISOString(), labels: 0, labelsAvailable: allLabels.length, labeledContacts: 0, blacklistImported, leadsCreated: 0, leadsUpdated: 0, labelsRemoved: 0, legacyStagesCleaned: 0, noPhone: Number(d.stats?.noPhone) || 0, groupsSkipped: Number(d.stats?.groupsSkipped) || 0, labeledChats: Number(d.stats?.labeledChats) || 0, perLabel: [] };
      await setStore({ [K.LABEL_SYNC]: summary });
      return { success: true, data: { ...summary, stages: await getStageList() } };
    }

    const leads = await getLeads();
    const idx = new Map();
    for (const lead of leads) { const key = phoneTail(lead.phone); if (key && !idx.has(key)) idx.set(key, lead); }
    const now = new Date().toISOString();
    let leadsCreated = 0; let leadsUpdated = 0; let labelsRemoved = 0; let legacyStagesCleaned = 0;
    const automationTagTransitions = [];
    const labelById = new Map(labels.map((label) => [String(label.id), String(label.name).trim()]));
    const perLabel = new Map(labels.map((label) => [String(label.id), new Set()]));
    const labeledTails = new Set();

    // Migração segura: estágios sintéticos de etiquetas de versões antigas deixam de ser estágios comerciais.
    const customStages = await getCustomStages();
    const legacyLabelStageIds = new Set(customStages.filter((stage) => stage?.source === 'whatsapp_label' || /^wl_/.test(String(stage?.id || ''))).map((stage) => String(stage.id)));
    const retainedStages = customStages.filter((stage) => !legacyLabelStageIds.has(String(stage?.id || '')));
    if (retainedStages.length !== customStages.length) await setStore({ [K.STAGES]: retainedStages });
    for (const lead of leads) {
      if (legacyLabelStageIds.has(String(lead.stage || ''))) { lead.stage = 'novo'; lead.updatedAt = now; legacyStagesCleaned++; }
    }

    // Deduplica por telefone e mescla etiquetas de múltiplas conversas do mesmo contato.
    const uniqueContacts = new Map();
    for (const c of (Array.isArray(d.contacts) ? d.contacts : [])) {
      const phone = normWaPhone(c.phone); const tail = phoneTail(phone);
      if (phone.length < 10 || phone.length > 15 || !tail) continue;
      const rawIds = Array.isArray(c.labelIds) ? c.labelIds : [];
      const ids = [...new Set(rawIds.map(String).filter((id) => labelById.has(id)))];
      if (!ids.length || rawIds.some((id) => blLabelIds.has(String(id)))) continue;
      const existing = uniqueContacts.get(phone);
      if (existing) { existing.labelIds = [...new Set([...existing.labelIds, ...ids])]; if (!existing.name && c.name) existing.name = c.name; }
      else uniqueContacts.set(phone, { phone, name: String(c.name || '').trim(), labelIds: ids });
    }

    // Etiquetas viram tags reutilizáveis para filtros/listas; não movem o estágio comercial.
    for (const c of uniqueContacts.values()) {
      const tail = phoneTail(c.phone); const ids = c.labelIds; const names = ids.map((id) => labelById.get(id)).filter(Boolean);
      if (!names.length) continue;
      ids.forEach((id) => perLabel.get(id)?.add(tail));
      labeledTails.add(tail);
      let lead = idx.get(tail);
      if (lead?.blacklisted) continue;
      if (lead) {
        const previousWaLabels = Array.isArray(lead.waLabels) ? lead.waLabels : [];
        const previousTags = Array.isArray(lead.tags) ? [...lead.tags] : [];
        const tags = new Set(previousTags.filter((tag) => !previousWaLabels.includes(tag)));
        names.forEach((name) => tags.add(name));
        const nextTags = [...tags];
        for (const tag of getNewlyAddedTags(previousTags, nextTags)) automationTagTransitions.push({ leadId: String(leadId(lead)), tag, at: now, id: uid('tag_transition') });
        const changed = JSON.stringify(previousWaLabels) !== JSON.stringify(names) || JSON.stringify(lead.tags || []) !== JSON.stringify(nextTags);
        lead.tags = nextTags; lead.waLabels = names;
        if (changed) {
          lead.updatedAt = now; leadsUpdated++;
          appendCrmActivity(lead, {
            type: 'lead.labels_synced',
            title: 'Etiquetas do WhatsApp sincronizadas',
            description: names.length ? `Etiquetas atuais: ${names.join(', ')}.` : 'As etiquetas sincronizadas foram atualizadas.',
            actor: 'WhatsApp Business',
            source: 'integration',
            createdAt: now,
            metadata: { labels: names },
          });
        }
      } else if (p?.createLeads !== false) {
        lead = { id: uid('lead'), name: c.name || '', phone: c.phone, source: 'whatsapp', stage: 'novo', tags: [...new Set(names)], waLabels: names, groups: [], createdAt: now, extractedAt: now };
        leads.push(lead); idx.set(tail, lead); leadsCreated++;
      }
    }

    // Se a etiqueta foi removida no WhatsApp, remove apenas as tags sincronizadas; mantém o estágio comercial.
    const unlabeled = new Set((Array.isArray(d.unlabeledPhones) ? d.unlabeledPhones : []).map(phoneTail).filter(Boolean));
    for (const lead of leads) {
      const previousWaLabels = Array.isArray(lead.waLabels) ? lead.waLabels : [];
      if (!previousWaLabels.length) continue;
      const tail = phoneTail(lead.phone);
      if (!tail || labeledTails.has(tail) || !unlabeled.has(tail)) continue;
      lead.tags = (Array.isArray(lead.tags) ? lead.tags : []).filter((tag) => !previousWaLabels.includes(tag));
      lead.waLabels = []; lead.updatedAt = now; labelsRemoved++;
      appendCrmActivity(lead, {
        type: 'lead.labels_removed',
        title: 'Etiquetas removidas do WhatsApp',
        description: `Etiquetas removidas: ${previousWaLabels.join(', ')}.`,
        actor: 'WhatsApp Business',
        source: 'integration',
        createdAt: now,
        metadata: { labels: previousWaLabels },
      });
    }

    await putLeads(leads);
    await classifyAllLeads();
    for (const transition of automationTagTransitions) {
      try { await runCalendarAutomationsForTransition({ id: transition.leadId }, { type: 'tag', value: transition.tag, at: transition.at, id: transition.id }); }
      catch { /* falhas de automação não impedem a sincronização das etiquetas */ }
    }
    const summary = {
      at: now, labels: labels.length, labelsAvailable: allLabels.length,
      labeledContacts: uniqueContacts.size, blacklistImported, leadsCreated, leadsUpdated, labelsRemoved, legacyStagesCleaned,
      noPhone: Number(d.stats?.noPhone) || 0, groupsSkipped: Number(d.stats?.groupsSkipped) || 0,
      labeledChats: Number(d.stats?.labeledChats) || 0,
      perLabel: labels.map((label) => ({ id: String(label.id), name: String(label.name), color: String(label.color || ''), contacts: perLabel.get(String(label.id))?.size || 0 })),
    };
    await setStore({ [K.LABEL_SYNC]: summary });
    return { success: true, data: { ...summary, stages: await getStageList() } };
  },

  // ---- WhatsApp: chats / grupos
  async EXTRACT_ALL_CHATS() {
    const wa = await requireWhatsApp();
    const r = await sendToTabEnsured(wa.tab, 'whatsapp', { type: 'EXTRACT_ALL_CHATS', payload: {} }, wa.frameId);
    if (!r.success) return r;
    return { success: true, data: r.data?.chats || [] };
  },
  async EXTRACT_GROUP_MEMBERS(p) {
    const wa = await requireWhatsApp();
    const r = await sendToTabEnsured(wa.tab, 'whatsapp', { type: 'EXTRACT_GROUP_MEMBERS', payload: p || {} }, wa.frameId);
    if (!r.success) return r;
    const members = r.data?.members || [];
    // Resultado vazio não é tratado como operação concluída.
    if (!members.length) return { success: false, error: 'Nenhum participante foi extraído. Recarregue o WhatsApp Web no painel da direita e tente novamente.' };
    return { success: true, data: members };
  },
  async EXTRACT_CHAT_MESSAGES(p) {
    const wa = await requireWhatsApp();
    const r = await sendToTabEnsured(wa.tab, 'whatsapp', { type: 'EXTRACT_CHAT_MESSAGES', payload: p || {} }, wa.frameId);
    if (!r.success) return r;
    return { success: true, data: r.data?.messages || [] };
  },

  // ---- Google Maps
  async MAPS_START_EXTRACTION(config) {
    if (mapsJob.running) return { success: false, error: 'Já existe uma extração em andamento.' };
    if (!config?.query) return { success: false, error: 'Informe o que buscar.' };
    let tab = await findTab(MAPS_URLS);
    if (!tab) tab = await chrome.tabs.create({ url: 'https://www.google.com/maps?hl=pt-BR', active: true });
    Object.assign(mapsJob, { running: true, stop: false, stopAt: 0, tabId: tab.id, lastActivity: Date.now(), cellDone: null });
    // A extração pode levar vários minutos: roda em segundo plano e avisa o painel por eventos.
    runMapsJob(config, tab).catch((e) => { emitMaps('MAPS_EXTRACTION_ERROR', { error: e?.message || String(e) }); mapsJob.running = false; });
    return { success: true };
  },
  async MAPS_STOP_EXTRACTION() {
    mapsJob.stop = true; mapsJob.stopAt = Date.now();
    const tab = mapsJob.tabId != null ? { id: mapsJob.tabId } : await findTab(MAPS_URLS);
    if (tab) await sendToTab(tab.id, { type: 'MAPS_STOP_EXTRACTION' });
    return { success: true };
  },

  // ---- Backup / sincronização com o Google Drive (v7.2.0) — ver background/drive-sync.js
  ...driveHandlers,

};

async function campaignControl(type, p, newStatus) {
  const campaigns = await getCampaigns();
  const c = campaigns.find((x) => x.id === (p?.campaignId ?? p?.id));
  try {
    const wa = await requireWhatsApp();
    await sendToTab(wa.tab.id, { type, payload: { campaignId: c?.id } }, wa.frameId);
  } catch { /* WhatsApp indisponível: só atualiza o status local */ }
  if (c) {
    c.status = newStatus;
    if (newStatus === 'completed') c.finishedAt = new Date().toISOString();
    await putCampaigns(campaigns);
    if (newStatus === 'completed') await scheduleCampaignReportAlarms(c);
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Eventos vindos dos content scripts (sem resposta)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Google Maps (v1.3.0): quantidade livre de leads, histórico anti-repetição e busca por áreas
// ---------------------------------------------------------------------------
// O Google Maps costuma parar em ~120 resultados por busca. Para chegar à quantidade pedida, a extensão faz a busca
// por texto (primeira área) e, se faltar, repete a mesma busca em uma grade de áreas ao redor do centro, dentro do
// raio informado. Leads repetidos (ID do lugar, telefone ou site) não contam no limite.
const MAPS_URLS = ['https://www.google.com/maps/*', 'https://maps.google.com/*'];
const MAPS_HISTORY_KEY = 'mapsHistory';
const MAPS_MAX_LEADS = 5000;
const MAPS_GRID_STEP_KM = 2.2;   // distância entre áreas vizinhas (zoom 15 cobre ~3-4 km)
const MAPS_GRID_ZOOM = 15;
const MAPS_MAX_CELLS = 200;
const MAPS_EMPTY_STREAK_STOP = 12; // áreas seguidas sem nenhum lead novo => região esgotada
const mapsJob = { running: false, stop: false, stopAt: 0, tabId: null, lastActivity: 0, cellDone: null };

const mapsSleep = (ms) => new Promise((r) => setTimeout(r, ms));
function emitMaps(type, payload = {}) {
  try { chrome.runtime.sendMessage({ type, payload, source: 'maps-extractor', timestamp: Date.now() }).catch(() => {}); } catch { /* painel fechado */ }
}

// Chaves de deduplicação: mantidas iguais às de content/maps-extractor.js
const MAPS_SITE_IGNORE = ['facebook.com', 'instagram.com', 'wa.me', 'whatsapp.com', 'linktr.ee', 'google.com', 'goo.gl',
  'youtube.com', 'tiktok.com', 'twitter.com', 'x.com', 'linkedin.com', 'bit.ly', 'ifood.com.br'];
function mapsIdOf(url) {
  const m = String(url || '').match(/!1s([^!?&#/]+)/) || String(url || '').match(/[?&]ftid=([^&#]+)/);
  if (!m) return '';
  try { return decodeURIComponent(m[1]).toLowerCase(); } catch { return m[1].toLowerCase(); }
}
function mapsPhoneKey(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  return d.length >= 8 ? d : '';
}
function mapsSiteKey(u) {
  if (!u) return '';
  try {
    const x = new URL(/^https?:\/\//i.test(u) ? u : 'http://' + u);
    const h = x.hostname.toLowerCase().replace(/^www\./, '');
    if (!h || MAPS_SITE_IGNORE.some((d) => h === d || h.endsWith('.' + d))) return '';
    const path = x.pathname.replace(/\/+$/, '');
    return h + (path && path !== '/' ? path : '');
  } catch { return ''; }
}

/** Primeira vez: leads do Maps que já estão no CRM entram no histórico, para não voltarem (nem se forem apagados do CRM). */
async function seedMapsHistoryFromCRM() {
  const r = await getStore(['mapsHistorySeeded', MAPS_HISTORY_KEY, K.LEADS]);
  if (r.mapsHistorySeeded) return;
  const h = r[MAPS_HISTORY_KEY] || {};
  const ids = new Set(h.ids || []); const phones = new Set(h.phones || []); const sites = new Set(h.sites || []);
  let n = h.n || 0;
  for (const l of (r[K.LEADS] || [])) {
    if (!l || !(l.source === 'google_maps' || String(l.url || '').includes('/maps/'))) continue;
    const id = mapsIdOf(l.url || l.placeId); const ph = mapsPhoneKey(l.phone); const st = mapsSiteKey(l.website);
    if (id) ids.add(id); if (ph) phones.add(ph); if (st) sites.add(st);
    if (id || ph || st) n++;
  }
  await setStore({ [MAPS_HISTORY_KEY]: { ids: [...ids], phones: [...phones], sites: [...sites], n, updatedAt: Date.now() }, mapsHistorySeeded: true });
}

/** Áreas ao redor do centro, da mais próxima para a mais distante, dentro do raio. */
function mapsGrid(center, radiusKm) {
  const kmLat = 110.574; const kmLng = 111.32 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180));
  const maxRing = Math.ceil(radiusKm / MAPS_GRID_STEP_KM);
  const cells = [];
  for (let dx = -maxRing; dx <= maxRing; dx++) {
    for (let dy = -maxRing; dy <= maxRing; dy++) {
      const dist = Math.hypot(dx, dy) * MAPS_GRID_STEP_KM;
      if (dist > radiusKm + MAPS_GRID_STEP_KM * 0.5) continue;
      cells.push({ lat: center.lat + (dy * MAPS_GRID_STEP_KM) / kmLat, lng: center.lng + (dx * MAPS_GRID_STEP_KM) / kmLng, dist });
    }
  }
  cells.sort((a, b) => a.dist - b.dist);
  return cells.slice(0, MAPS_MAX_CELLS);
}

function mapsOnEvent(message) {
  mapsJob.lastActivity = Date.now();
  if (message.type === 'MAPS_CELL_DONE' && mapsJob.running) mapsJob.cellDone = message.payload || {};
}

async function mapsWaitCell() {
  for (;;) {
    if (mapsJob.cellDone) return mapsJob.cellDone;
    if (mapsJob.stop && Date.now() - mapsJob.stopAt > 12000) return { results: [], skipped: 0, error: '', stopped: true };
    if (Date.now() - mapsJob.lastActivity > 120000) return { results: [], skipped: 0, error: 'A página do Maps parou de responder.', timedOut: true };
    await mapsSleep(1000);
  }
}

async function mapsRunCell(tab, url, payload) {
  mapsJob.cellDone = null;
  mapsJob.lastActivity = Date.now();
  await chrome.tabs.update(tab.id, { url, active: true });
  await waitTabComplete(tab.id);
  await mapsSleep(3000);
  if (mapsJob.stop) return { results: [], skipped: 0, error: '', stopped: true };
  const r = await sendToTabEnsured(tab, 'maps', { type: 'MAPS_START_EXTRACTION', payload });
  if (!r.success) return { results: [], skipped: 0, error: r.error || 'Não foi possível iniciar a leitura da página.' };
  return mapsWaitCell();
}

async function runMapsJob(config, tab) {
  const total = Math.min(MAPS_MAX_LEADS, Math.max(1, parseInt(config.maxResults, 10) || 20));
  const radiusKm = Math.min(100, Math.max(1, Number(config.radius) || 5));
  const useHistory = config.skipKnown !== false;
  const all = [];
  const runKeys = { ids: [], phones: [], sites: [] };
  let skipped = 0; let reason = 'target'; let cellsDone = 0;
  const keepAlive = setInterval(() => { try { chrome.runtime.getPlatformInfo(() => {}); } catch { /* ignora */ } }, 20000);

  const addRun = (places) => {
    for (const p of places) {
      all.push(p);
      const id = mapsIdOf(p.url || p.placeId); const ph = mapsPhoneKey(p.phone); const st = mapsSiteKey(p.website);
      if (id) runKeys.ids.push(id); if (ph) runKeys.phones.push(ph); if (st) runKeys.sites.push(st);
    }
  };
  const cellPayload = (extra) => ({
    query: config.query, extractDetails: config.extractDetails, useHistory, runKeys,
    total, offset: all.length, remaining: total - all.length, skippedBase: skipped, ...extra,
  });

  try {
    await seedMapsHistoryFromCRM().catch(() => {});
    emitMaps('MAPS_EXTRACTION_STARTED', { total, query: config.query });

    // Área 1: busca por texto ("dentista São Paulo, SP"), como sempre foi.
    const q = [config.query, config.location].filter(Boolean).join(' ');
    const firstUrl = 'https://www.google.com/maps/search/' + encodeURIComponent(q) + '?hl=pt-BR';
    let c = await mapsRunCell(tab, firstUrl, cellPayload({ feedTimeout: 15000 }));
    cellsDone++;
    if (c.error && !c.results.length) { emitMaps('MAPS_EXTRACTION_ERROR', { error: c.error }); return; }
    addRun(c.results); skipped += c.skipped || 0;
    let center = c.viewport;
    let stopped = !!c.stopped || mapsJob.stop;

    // Faltam leads? Repete a busca em áreas vizinhas, dentro do raio.
    if (!stopped && all.length < total) {
      if (!center) {
        reason = 'nocenter';
      } else {
        const cells = mapsGrid(center, radiusKm);
        let emptyStreak = 0; let i = 0;
        reason = 'radius';
        for (const cell of cells) {
          i++;
          if (mapsJob.stop) { stopped = true; break; }
          if (all.length >= total) { reason = 'target'; break; }
          if (emptyStreak >= MAPS_EMPTY_STREAK_STOP) { reason = 'exhausted'; break; }
          emitMaps('MAPS_EXTRACTION_PROGRESS', { current: all.length, total, skipped, message: `Buscando em outra área (${i}/${cells.length})...` });
          const url = 'https://www.google.com/maps/search/' + encodeURIComponent(config.query) +
            `/@${cell.lat.toFixed(6)},${cell.lng.toFixed(6)},${MAPS_GRID_ZOOM}z?hl=pt-BR`;
          c = await mapsRunCell(tab, url, cellPayload({ feedTimeout: 9000 }));
          cellsDone++;
          if (c.timedOut) { reason = 'error'; break; }
          const before = all.length;
          addRun(c.results); skipped += c.skipped || 0;
          emptyStreak = all.length > before ? 0 : emptyStreak + 1; // áreas sem lista de resultados também contam aqui
          if (c.stopped || mapsJob.stop) { stopped = true; break; }
        }
        if (!stopped && all.length >= total) reason = 'target';
      }
    } else if (all.length >= total) { reason = 'target'; }
    if (stopped) reason = 'stopped';

    emitMaps('MAPS_EXTRACTION_COMPLETED', { total: all.length, requested: total, results: all, skipped, reason, cells: cellsDone });
  } catch (e) {
    emitMaps('MAPS_EXTRACTION_ERROR', { error: e?.message || String(e) });
  } finally {
    clearInterval(keepAlive);
    mapsJob.running = false; mapsJob.stop = false; mapsJob.cellDone = null;
  }
}

function broadcast(type, payload) {
  chrome.runtime.sendMessage({ type, payload }).catch(() => {});
}

let campaignEventQueue = Promise.resolve();
function updateCampaignFromEvent(type, payload) {
  // Serializa: eventos chegam em rajada e o read-modify-write concorrente perdia contagens.
  campaignEventQueue = campaignEventQueue.then(() => applyCampaignEvent(type, payload)).catch(() => {});
  return campaignEventQueue;
}

async function moveLeadAfterSend(phone, stage) {
  if (!stage || !(await getStageIds()).includes(stage)) return;
  const leads = await getLeads();
  let changed = false;
  for (const l of leads) {
    if (normWaPhone(l.phone) === phone && l.stage !== stage && !l.blacklisted) {
      const previousStage = l.stage;
      const previousStageCategory = stageCategory(previousStage);
      const nextStageCategory = stageCategory(stage);
      if (l.commissionStatus === 'paid' && previousStageCategory === 'closed_won' && nextStageCategory !== 'closed_won') continue;
      const stageChangedAt = new Date().toISOString();
      l.stage = stage; l.stageUpdatedAt = stageChangedAt; l.updatedAt = stageChangedAt;
      appendCrmActivity(l, {
        type: 'lead.stage_changed',
        title: 'Etapa atualizada automaticamente',
        description: `Etapa alterada de "${String(previousStage || 'novo').slice(0, 80)}" para "${String(stage).slice(0, 80)}" após ação de campanha.`,
        actor: 'i9Hub',
        source: 'automation',
        metadata: { from: String(previousStage || ''), to: String(stage), trigger: 'campaign' },
      });
      if (previousStageCategory !== 'closed_won' && nextStageCategory === 'closed_won') {
        const managementConfig = await getCommercialManagementConfig();
        snapshotLeadCommission(l, managementConfig, stageChangedAt);
      }
      changed = true;
    }
  }
  if (changed) await putLeads(leads);
}

async function bindCampaignPersonaToContact(campaign, rawPhone) {
  const personaId = String(campaign?.aiPersonaId || '').trim();
  const phone = normWaPhone(rawPhone);
  if (!personaId || phone.length < 8) return false;
  const config = await getAiConfigInternal();
  if (!(Array.isArray(config.aiPersonas) ? config.aiPersonas : []).some((persona) => persona.id === personaId)) return false;
  const assignments = config.conversationPersonaAssignments && typeof config.conversationPersonaAssignments === 'object' ? { ...config.conversationPersonaAssignments } : {};
  const now = Date.now();
  assignments[aiChatHash(phone)] = { personaId, campaignId: String(campaign.id || '').slice(0, 100), assignedAt: now, expiresAt: now + 30 * 24 * 60 * 60 * 1000 };
  const entries = Object.entries(assignments).sort((a, b) => Number(a[1]?.assignedAt || 0) - Number(b[1]?.assignedAt || 0));
  while (entries.length > 5000) { const [oldestKey] = entries.shift(); delete assignments[oldestKey]; }
  config.conversationPersonaAssignments = assignments;
  config.updatedAt = new Date().toISOString();
  await setStore({ [AI_CONFIG_KEY]: config });
  return true;
}

async function applyCampaignEvent(type, payload) {
  const campaigns = await getCampaigns();
  const c = campaigns.find((x) => x.id === payload?.campaignId);
  if (!c) return;
  const today = new Date().toISOString().slice(0, 10);
  const pushLog = (entry) => { c.log = [...(c.log || []), { timestamp: new Date().toISOString(), ...entry }].slice(-300); };
  const phone = normWaPhone(payload?.contact?.phone);
  const target = phone ? (c.contacts || []).find((x) => x.phone === phone) : null;
  const who = payload?.contact?.name || payload?.contact?.phone || '';
  if (type === 'MESSAGE_SENT') {
    if (target) { target.status = 'sent'; target.sentAt = new Date().toISOString(); if (payload?.via) target.via = payload.via; if (payload?.storeReason) target.storeReason = String(payload.storeReason).slice(0, 200); else delete target.storeReason; }
    c.sentToday = c.lastSentDate === today ? (c.sentToday || 0) + 1 : 1;
    c.lastSentDate = today;
    pushLog({ contact: who, phone, success: true, ...(payload?.via ? { via: payload.via } : {}), ...(payload?.storeReason ? { storeReason: String(payload.storeReason).slice(0, 200) } : {}) });
    // Guarda apenas a data do último disparo; isso permite reconhecer respostas a campanha
    // sem armazenar o conteúdo da mensagem enviada.
    if (phone) {
      const leads = await getLeads();
      let leadChanged = false;
      const sentAt = new Date().toISOString();
      for (const l of leads) {
        if (normWaPhone(l.phone) !== phone) continue;
        if (l.lastCampaignSentAt !== sentAt) { l.lastCampaignSentAt = sentAt; l.updatedAt = sentAt; leadChanged = true; }
      }
      if (leadChanged) await putLeads(leads);
    }
    await moveLeadAfterSend(phone, c.moveToStage);
    if (c.aiPersonaId && phone) {
      try { await bindCampaignPersonaToContact(c, phone); }
      catch (error) { saveSystemLog({ module: 'ai-chat', action: 'CAMPAIGN_PERSONA_BIND_FAILED', status: 'warning', message: 'A mensagem foi enviada, mas a personalidade da campanha não pôde ser vinculada ao contato.', data: { campaignId: c.id, error: safeLogText(error?.message || String(error), 160) } }); }
    }
  } else if (type === 'MESSAGE_SKIPPED') {
    const bl = payload?.reason === 'blacklist';
    if (target) { target.status = 'skipped'; target.error = ''; if (bl) target.skipReason = 'blacklist'; }
    pushLog({ contact: who, phone, success: true, skipped: true, note: bl ? 'Black list: ignorado (não conta como falha)' : 'Número da própria conta: ignorado (não conta como falha)' });
  } else if (type === 'MESSAGE_FAILED') {
    if (target) { target.status = 'failed'; target.error = payload?.error || ''; }
    c.lastError = payload?.error || c.lastError;
    pushLog({ contact: who, phone, success: false, error: payload?.error || 'Falha desconhecida' });
  } else if (type === 'CAMPAIGN_BATCH_PAUSE_STARTED') {
    c.nextBatchAt = String(payload?.resumeAt || '');
    c.batchPauseStartedAt = new Date().toISOString();
    pushLog({ contact: 'Sistema', success: true, note: `Lote concluído. Próximo lote previsto para ${c.nextBatchAt ? new Date(c.nextBatchAt).toLocaleString('pt-BR') : 'mais tarde'}. O Chat com IA permanece ativo durante a pausa.` });
  } else if (type === 'CAMPAIGN_BATCH_PAUSE_ENDED') {
    delete c.nextBatchAt; delete c.batchPauseStartedAt;
    pushLog({ contact: 'Sistema', success: true, note: 'Pausa entre lotes concluída; retomando o envio.' });
  } else if (type === 'CAMPAIGN_COMPLETED') {
    const pendingLeft = (c.contacts || []).some((x) => !x.status);
    const sendLimit = Math.max(0, Math.floor(Number(c.sendLimit) || 0));
    const attempted = (c.contacts || []).filter((x) => x.status === 'sent' || x.status === 'failed').length;
    if (pendingLeft && sendLimit > 0 && attempted >= sendLimit) {
      c.status = 'limit_reached'; c.limitReachedAt = new Date().toISOString();
      pushLog({ contact: 'Sistema', success: true, note: `Limite de ${sendLimit} tentativas atingido. ${Math.max(0, (c.contacts || []).filter((x) => !x.status).length)} contato(s) continuam pendentes; edite o limite para continuar.` });
    } else c.status = 'completed';
    c.finishedAt = new Date().toISOString(); delete c.pauseRequestedAt; delete c.nextBatchAt; delete c.batchPauseStartedAt;
  } else if (type === 'CAMPAIGN_PAUSED') {
    c.status = 'paused'; delete c.pauseRequestedAt;
    delete c.nextBatchAt; delete c.batchPauseStartedAt;
    if (payload?.reason) pushLog({ contact: 'Sistema', success: false, error: payload.reason });
  } else if (type === 'CAMPAIGN_STOPPED') {
    c.status = 'completed'; c.finishedAt = new Date().toISOString(); delete c.pauseRequestedAt; delete c.nextBatchAt; delete c.batchPauseStartedAt;
  } else if (type === 'RATE_LIMIT_DETECTED') {
    c.status = 'paused'; delete c.nextBatchAt; delete c.batchPauseStartedAt;
  }
  campaignCounts(c);
  await putCampaigns(campaigns);
  if (c.status === 'completed' && c.finishedAt) await scheduleCampaignReportAlarms(c);
  broadcast('CAMPAIGN_PROGRESS', { campaignId: c.id, status: c.status, sent: c.sent, failed: c.failed, total: c.total, nextBatchAt: c.nextBatchAt || null, batchPauseMs: c.batchPauseMs || 0, aiActiveDuringPause: ['CAMPAIGN_BATCH_PAUSE_STARTED', 'CAMPAIGN_BATCH_PAUSE_ENDED'].includes(type), event: type });
}

const CAMPAIGN_EVENTS = new Set(['CAMPAIGN_WAITING_VISIBLE', 'CAMPAIGN_BATCH_PAUSE_STARTED', 'CAMPAIGN_BATCH_PAUSE_ENDED', 'MESSAGE_SENT', 'MESSAGE_FAILED', 'MESSAGE_SKIPPED', 'CAMPAIGN_COMPLETED', 'CAMPAIGN_PAUSED', 'CAMPAIGN_STOPPED', 'RATE_LIMIT_DETECTED']);

// ---------------------------------------------------------------------------
// Listeners
// ---------------------------------------------------------------------------

// v7.0.5 - Fila serializada: os logs chegam em rajada e o ciclo ler-tudo/gravar-tudo concorrente
// sobrescrevia registros. Agora cada gravação espera a anterior e as pendentes saem em lote.
const LOG_MAX = 1500;
let logPending = [];
let logFlushing = null;
const logRate = new Map();
let logsMigration = Promise.resolve();
// A autorização de mensagens vive em lib/message-gate.js (pura e testável no Node).
function originOfSender(sender) {
  return originOfUrl(sender?.url || sender?.tab?.url || '');
}
function allowLogRate(sender) {
  const key = sender?.tab ? `tab:${sender.tab.id}:${originOfSender(sender)}` : 'extension';
  const now = Date.now();
  const entry = logRate.get(key) || { start: now, count: 0 };
  if (now - entry.start >= 60000) { entry.start = now; entry.count = 0; }
  entry.count++;
  logRate.set(key, entry);
  if (logRate.size > 100) for (const [k, v] of logRate) if (now - v.start > 120000) logRate.delete(k);
  return entry.count <= (sender?.tab ? 120 : 300);
}
function safeLogValue(value, key = '', depth = 0) {
  if (/(token|secret|password|authorization|api.?key|license.?key|credential|cookie|private.?key|refresh.?token|access.?token)/i.test(key)) return '[REDACTED]';
  if (depth > 4) return '[TRUNCATED]';
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    return value.replace(/Bearer\s+[A-Za-z0-9._~-]+/ig, 'Bearer [REDACTED]')
      .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\b/g, '[TOKEN REDACTED]')
      .replace(/\b[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3,}\b/ig, '[LICENSE KEY REDACTED]')
      .replace(/(token|licenseKey|accessToken|apiKey)\s*[:=]\s*[^\s,;]+/ig, '$1=[REDACTED]').slice(0, 1200);
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => safeLogValue(v, key, depth + 1));
  if (typeof value === 'object') {
    const out = Object.create(null);
    for (const [k, v] of Object.entries(value).slice(0, 50)) out[String(k).slice(0, 80)] = safeLogValue(v, String(k), depth + 1);
    return out;
  }
  return String(value).slice(0, 300);
}
function safeLogText(value, max = 240) {
  return String(value ?? '').replace(/Bearer\s+[A-Za-z0-9._~-]+/ig, 'Bearer [REDACTED]')
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\b/g, '[TOKEN REDACTED]')
    .replace(/\b[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3,}\b/ig, '[LICENSE KEY REDACTED]').slice(0, max);
}
function saveSystemLog(payload = {}) {
  const data = safeLogValue(payload?.data && typeof payload.data === 'object' ? payload.data : {});
  const item = {
    id: uid('log'),
    timestamp: new Date().toISOString(),
    module: safeLogText(payload?.module || 'runtime', 60),
    action: safeLogText(payload?.action || payload?.message || 'EVENT', 80),
    status: safeLogText(payload?.status || payload?.level || 'info', 20),
    message: safeLogText(payload?.message || '', 500),
    data: { ...(data && typeof data === 'object' && !Array.isArray(data) ? data : { value: data }), EXT_VERSION }
  };
  logPending.push(item);
  if (logPending.length > LOG_MAX) logPending = logPending.slice(-LOG_MAX);
  return flushSystemLogs();
}
async function sanitizeStoredSystemLogs() {
  try {
    const { systemLogs = [] } = await chrome.storage.local.get('systemLogs');
    if (!Array.isArray(systemLogs)) { await chrome.storage.local.set({ systemLogs: [] }); return; }
    const sanitized = systemLogs.slice(-LOG_MAX).map((entry) => ({
      id: safeLogText(entry?.id || '', 80),
      timestamp: safeLogText(entry?.timestamp || '', 40),
      module: safeLogText(entry?.module || 'runtime', 60),
      action: safeLogText(entry?.action || 'EVENT', 80),
      status: safeLogText(entry?.status || 'info', 20),
      message: safeLogText(entry?.message || '', 500),
      data: safeLogValue(entry?.data && typeof entry.data === 'object' ? entry.data : {})
    }));
    if (JSON.stringify(sanitized) !== JSON.stringify(systemLogs)) await chrome.storage.local.set({ systemLogs: sanitized });
  } catch { /* logs nunca devem impedir a inicialização */ }
}

function flushSystemLogs() {
  if (logFlushing) return logFlushing;
  logFlushing = (async () => {
    try {
      await logsMigration;
      while (logPending.length) {
        const batch = logPending; logPending = [];
        try {
          const { systemLogs = [] } = await chrome.storage.local.get('systemLogs');
          const previous = Array.isArray(systemLogs) ? systemLogs : [];
          await chrome.storage.local.set({ systemLogs: [...previous, ...batch].slice(-LOG_MAX) });
        } catch {
          logPending = batch.concat(logPending).slice(-LOG_MAX);
          break;
        }
      }
    } finally { logFlushing = null; }
  })();
  return logFlushing;
}

logsMigration = sanitizeStoredSystemLogs().catch(() => {});
initDriveSync({ broadcast, log: saveSystemLog });

/**
 * Prazo máximo para um handler responder antes de avisarmos a interface.
 * Fica acima do maior timeout interno (180s, etiquetas em lote) para nunca cortar
 * uma operação legítima; é só uma rede de segurança contra travamento.
 */
const HANDLER_TIMEOUT_MS = 240000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type;
  const decision = decideMessage({
    senderId: sender?.id,
    runtimeId: chrome.runtime.id,
    senderUrl: sender?.url || sender?.tab?.url || '',
    type,
    source: message?.source,
  });

  // Recusa sempre com resposta explícita: fechar a porta em silêncio produzia
  // "The message port closed before a response was received." na interface.
  if (decision.action === 'reject') {
    if (decision.reason !== 'UNTRUSTED_SENDER') {
      saveSystemLog({
        level: 'warn', module: 'background', action: 'MESSAGE_REJECTED', status: 'warning',
        message: `${type || 'sem tipo'}: ${decision.reason}`, data: { origin: originOfSender(sender) },
      });
    }
    sendResponse({ success: false, code: 'MESSAGE_REJECTED', reason: decision.reason, error: rejectMessage(decision.reason) });
    return true;
  }

  // Eventos passivos de content script: registra e confirma o recebimento.
  if (decision.action === 'acknowledge') {
    if (type === 'PRIVATE_CHATS_SYNC_PROGRESS') {
      broadcast('PRIVATE_OPPORTUNITIES_PROGRESS', message.payload || {});
      sendResponse({ success: true, accepted: true });
      return true;
    }
    if (type === 'PRIVATE_CHATS_SYNC_FAILED') {
      const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
      broadcast('PRIVATE_OPPORTUNITIES_SYNC_FAILED', payload);
      saveSystemLog({ module: 'crm', action: 'PRIVATE_OPPORTUNITY_SYNC_ERROR', status: 'error', message: payload.error || payload.message || 'Sincronização interrompida' });
      sendResponse({ success: true, accepted: true });
      return true;
    }

    if (type === 'FOLLOWUP_INBOUND_ACTIVITY') {
      (async () => {
        try {
          const result = await handleFollowupInboundActivity(message.payload || {});
          sendResponse({ success: true, accepted: true, data: result });
        } catch (error) {
          sendResponse({ success: false, accepted: false, error: safeLogText(error?.message || String(error), 180) });
        }
      })();
      return true;
    }

    if (type === 'AI_STORE_STATUS') {
      (async () => {
        try {
          const p = message.payload && typeof message.payload === 'object' ? message.payload : {};
          await setStore({ aiSupportStoreWatcher: { ok: p.ok === true, via: String(p.via || '').slice(0, 40), chats: Number(p.chats) || 0, reason: String(p.reason || '').slice(0, 80), at: Date.now() } });
          sendResponse({ success: true });
        } catch { sendResponse({ success: false }); }
      })();
      return true;
    }
    if (type === 'AI_INBOX_CHECK') {
      (async () => {
        try {
          const storedConfig = await getAiConfigInternal();
          const config = applyActiveAiPersona(storedConfig);
          const heartbeat = Number(await getOne(AI_HEARTBEAT_KEY, 0));
          const licenseState = await getLicenseState();
          const entitled = licenseState.licensed && hasFeatureEntitlement(licenseState.payload?.ent, 'whatsapp.ai_support');
          const operationMode = normalizeAiOperationMode(config.operationMode);
          const observerEntitled = !aiConfigHasObserver(config) || hasFeatureEntitlement(licenseState.payload?.ent, 'ai.mode.observe_only');
          const active = entitled && observerEntitled && config.enabled === true && heartbeat > 0 && Date.now() - heartbeat < AI_HEARTBEAT_TTL_MS;
          sendResponse({ success: true, active, operationMode, chatMode: ['private_only', 'groups_only', 'both'].includes(config.chatMode) ? config.chatMode : 'private_only', groupReplyMode: config.groupReplyMode || 'reply_or_mention', groupScope: config.groupScope || 'selected', selectedGroupIds: Array.isArray(config.selectedGroupIds) ? config.selectedGroupIds : [] });
        } catch { sendResponse({ success: false, active: false, chatMode: 'private_only' }); }
      })();
      return true;
    }
    if (type === 'AI_INCOMING_MESSAGE') {
      (async () => {
        const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
        const licenseState = await getLicenseState();
        const authorization = evaluateActionAuthorization({ type: 'AI_INCOMING_MESSAGE', payload, state: licenseState });
        if (!authorization.allowed) {
          sendResponse({ success: false, accepted: false, ...permissionDenied('AI_INCOMING_MESSAGE', authorization) });
          return;
        }
        const contextConfig = applyAiPersonaForContext(await getAiConfigInternal(), payload);
        if (normalizeAiOperationMode(contextConfig.operationMode) === AI_OPERATION_MODES.OBSERVE_ONLY && !hasFeatureEntitlement(licenseState.payload?.ent, 'ai.mode.observe_only')) {
          sendResponse({ success: false, accepted: false, code: 'FEATURE_NOT_INCLUDED', featureId: 'ai.mode.observe_only', error: 'A licença atual não libera a IA observadora.' });
          return;
        }
        const result = await enqueueAiIncomingMessage(payload, sender);
        if (!result.success) {
          await recordAiMonitorEvent(payload, { status: 'error', error: result.error || 'Não foi possível adicionar a mensagem à fila.' }, null);
          await setStore({ aiSupportLastProcessingStatus: { status: 'error', at: new Date().toISOString(), chatName: String(payload.chatName || '').slice(0, 180), chatType: payload.chatType || 'private', error: String(result.error || 'Fila indisponível').slice(0, 180) } });
          sendResponse({ success: false, accepted: false, code: result.code || 'AI_QUEUE_ERROR', error: result.error || 'Não foi possível enfileirar a mensagem.' });
          return;
        }
        sendResponse({ success: true, accepted: true, queued: !result.duplicate, duplicate: result.duplicate === true, aiStatus: result.duplicate ? 'duplicate' : 'queued' });
        if (!result.duplicate) drainAiIncomingQueue().catch((error) => {
          saveSystemLog({ module: 'ai-support', action: 'AI_INCOMING_QUEUE_DRAIN_FAILED', status: 'error', message: safeLogText(error?.message || String(error), 180) });
        });
      })().catch((error) => {
        try { sendResponse({ success: false, accepted: false, code: 'AI_QUEUE_ERROR', error: safeLogText(error?.message || String(error), 180) }); } catch { /* porta já fechada */ }
      });
      return true;
    }
    // PLG: a sincronização de conversas privadas é um "aha moment" do modo demo.
    // Contas não licenciadas podem receber e salvar oportunidades; o paywall
    // atua nas ações avançadas (exportação, campanhas, blacklist), não na ingestão.
    if (type === 'PRIVATE_CHATS_DETECTED') {
      (async () => {
        try {
          const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
          const authorization = await gate('SYNC_PRIVATE_OPPORTUNITIES', payload);
          if (!authorization.allowed) {
            sendResponse({ success: false, accepted: false, ...permissionDenied('SYNC_PRIVATE_OPPORTUNITIES', authorization) });
            return;
          }
          const scanCount = ['chats','conversations','contacts','items'].reduce((n, key) => n || (Array.isArray(payload[key]) ? payload[key].length : 0), 0) || Number(payload.count || payload.total || payload.conversationsCount || 0) || 1;
          recordTelemetry('whatsapp.conversations.scanned', 'whatsapp.private_opportunities', { count: scanCount || 1, success: true }).catch(() => {});
          console.log('[i9Hub Sync] ' + JSON.stringify({ event: payload.finalBatch ? 'FINAL_BATCH_RECEIVED' : 'BATCH_RECEIVED', syncRunId: payload.scanId || null, batchIndex: payload.batchIndex, chatCount: Array.isArray(payload.chats) ? payload.chats.length : 0, processedSoFar: payload.processedSoFar, totalChats: payload.totalChats, timestamp: new Date().toISOString(), context: 'service_worker' }));
          queuePrivateOpportunityBatch(payload);
          sendResponse({ success: true, accepted: true });
        } catch (error) {
          sendResponse({ success: false, error: safeLogText(error?.message || String(error), 240) });
        }
      })();
      return true;
    }
    try {
      if (type === 'LOG') {
        if (allowLogRate(sender)) saveSystemLog(message.payload || {});
      } else if (message?.source === 'maps-extractor') {
        mapsOnEvent(message);
      } else if (CAMPAIGN_EVENTS.has(type)) {
        // Eventos de progresso podem ser registrados para refletir/encerrar operações
        // que já estavam em andamento, inclusive durante uma revogação.
        updateCampaignFromEvent(type, message.payload);
      }
    } catch (error) {
      sendResponse({ success: false, error: safeLogText(error?.message || String(error), 240) });
      return true;
    }
    sendResponse({ success: true, accepted: true });
    return true;
  }

  // Páginas da própria extensão (painel, popup, options, painel aberto em aba).
  if (type === 'LOG') {
    if (allowLogRate(sender)) saveSystemLog(message.payload || {});
    sendResponse({ success: true, accepted: true });
    return true;
  }

  // "Black list" vinda da conversa do WhatsApp: mantém o limite de frequência.
  if (type === 'BLACKLIST_ADD' && sender?.tab && !allowLogRate(sender)) {
    sendResponse({ success: false, code: 'RATE_LIMITED', error: 'Muitas solicitações seguidas. Aguarde um instante e tente novamente.' });
    return true;
  }

  const handler = handlers[type];
  if (!handler) {
    sendResponse({ success: false, code: 'UNKNOWN_MESSAGE', error: `Tipo de mensagem não reconhecido: ${type || 'sem tipo'}` });
    return true;
  }

  const execute = async () => {
    let answered = false;
    let timer = null;
    const done = (payload) => {
      if (answered) return;
      answered = true;
      if (timer) clearTimeout(timer);
      try { sendResponse(payload); } catch { /* porta já fechada */ }
    };
    // Rede de segurança: nunca deixa a interface esperando sem resposta.
    timer = setTimeout(() => done({ success: false, code: 'TIMEOUT', error: 'A extensão demorou demais para responder. Tente novamente.' }), HANDLER_TIMEOUT_MS);
    try {
      if (!PUBLIC_ACTIONS.has(type) && !SAFETY_ACTIONS.has(type) && !CORE_ACTIONS.has(type)) {
        const g = await gate(type, message.payload || {});
        if (!g.allowed) { safeRecordActionTelemetry(type, message.payload || {}, { success: false, code: g.code }).catch(() => {}); done(permissionDenied(type, g)); return; }
      }
      const result = await handler(message.payload || {}, sender);
      safeRecordActionTelemetry(type, message.payload || {}, result).catch(() => {});
      done(result);
    } catch (error) {
      done({ success: false, error: safeLogText(error?.message || String(error), 240) });
    }
  };
  execute();
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  await getDeviceId();
  ensureEmbedRules().catch(() => {});
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({ id: MENU_ID, title: 'Abrir i9Leads Flow em tela cheia', contexts: ['action'] });
  } catch (e) { /* ignore */ }
  if (chrome.sidePanel?.setPanelBehavior) chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  await chrome.alarms.create('i9-telemetry-flush', { periodInMinutes: 15 });
  await chrome.alarms.create('i9-admin-config-sync', { periodInMinutes: 15 });
  await chrome.alarms.create('i9-ai-history-flush', { periodInMinutes: 5 });
  schedulePendingCampaignReportAlarms().catch(() => {});
  reconcilePendingFollowups().catch(() => {});
  if (await getOne(K.LICENSE_KEY)) { await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 6 * 60 }); revalidateLicense(); }
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create('i9-telemetry-flush', { periodInMinutes: 15 });
  await chrome.alarms.create('i9-admin-config-sync', { periodInMinutes: 15 });
  await chrome.alarms.create('i9-ai-history-flush', { periodInMinutes: 5 });
  schedulePendingCampaignReportAlarms().catch(() => {});
  reconcilePendingFollowups().catch(() => {});
  if (await getOne(K.LICENSE_KEY)) revalidateLicense();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) revalidateLicense();
  if (alarm.name === 'i9-telemetry-flush') flushTelemetry().catch(() => {});
  if (alarm.name === 'i9-admin-config-sync') fetchAdminConfig().catch(() => {});
  if (alarm.name === 'i9-ai-history-flush') flushAiHistoryQueue().catch(() => {});
  if (String(alarm.name || '').startsWith('i9-followup:')) {
    const id = String(alarm.name).slice('i9-followup:'.length);
    processFollowupAlarm(id).catch((error) => saveSystemLog({ module: 'crm-followup', action: 'FOLLOWUP_ALARM_FAILED', status: 'error', message: safeLogText(error?.message || String(error), 180) }));
  }
  const reportMatch = /^i9-campaign-report:([^:]+):(\d+):(24h|48h)$/.exec(String(alarm.name || ''));
  if (reportMatch) {
    const [, campaignId, cycleRaw, period] = reportMatch;
    const cycle = Number(cycleRaw);
    (async () => {
      const campaigns = await getCampaigns();
      const campaign = campaigns.find((item) => String(item?.id) === campaignId && Math.max(1, Number(item?.reportCycle) || 1) === cycle);
      if (!campaign || campaign.status !== 'completed') { await chrome.alarms.clear(alarm.name); return; }
      const existing = (campaign.reportSnapshots || []).some((item) => item?.period === period && Number(item?.cycle || item?.reportCycle || 1) === cycle);
      if (existing) { await chrome.alarms.clear(alarm.name); return; }
      const captured = await captureCampaignReport(campaignId, period, 'scheduled');
      if (!captured.success && captured.code === 'REPORT_NOT_DUE' && captured.nextAt) {
        const nextAt = Date.parse(captured.nextAt);
        await chrome.alarms.create(alarm.name, { when: Math.max(Date.now() + 30_000, Number.isFinite(nextAt) ? nextAt : Date.now() + 60_000) });
      } else {
        await chrome.alarms.clear(alarm.name);
      }
    })().catch(() => {});
  }
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_ID) chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel/sidepanel.html') });
});

// ---------------------------------------------------------------------------
// v7.0.2/7.0.3 - Painel embutido do WhatsApp
// ---------------------------------------------------------------------------
// As regras são persistentes, mas reaplicá-las a cada partida do service worker é barato e
// garante que existam mesmo após atualização/reinstalação da extensão.
ensureEmbedRules().catch((e) => console.warn('[i9Leads] regras do iframe:', e?.message || e));


/** v7.0.3 - Executada DENTRO do iframe do WhatsApp (chrome.scripting.executeScript). Sem dados de conversas. */
async function waFrameProbe() {
  const o = { url: location.href, title: document.title, referrer: document.referrer, lang: navigator.language, cookieEnabled: navigator.cookieEnabled };
  try { o.ancestors = Array.from(location.ancestorOrigins || []); } catch (e) { /* ignora */ }
  try { const n = performance.getEntriesByType('navigation')[0]; if (n) o.nav = { httpStatus: n.responseStatus ?? null, type: n.type, protocol: n.nextHopProtocol, redirects: n.redirectCount }; } catch (e) { /* ignora */ }
  try { o.text = ((document.body && document.body.innerText) || '').trim().slice(0, 240); } catch (e) { /* ignora */ }
  try { localStorage.setItem('__i9p', '1'); localStorage.removeItem('__i9p'); o.localStorage = 'ok'; } catch (e) { o.localStorage = 'ERRO ' + e.name; }
  try { o.storageAccess = document.hasStorageAccess ? await document.hasStorageAccess() : 'n/d'; } catch (e) { o.storageAccess = 'ERRO ' + e.name; }
  try { o.serviceWorker = 'serviceWorker' in navigator; o.secureContext = window.isSecureContext; } catch (e) { /* ignora */ }
  o.indexedDB = await new Promise((res) => {
    try {
      const r = indexedDB.open('__i9probe');
      r.onsuccess = () => { r.result.close(); indexedDB.deleteDatabase('__i9probe'); res('ok'); };
      r.onerror = () => res('ERRO ' + (r.error && r.error.name));
      setTimeout(() => res('timeout'), 3000);
    } catch (e) { res('ERRO ' + e.name); }
  });
  return o;
}

// A janela lateral foi fechada: esquece o id (a conexão volta a procurar o painel/abas).
chrome.windows.onRemoved.addListener(async (id) => {
  const { waWindowId } = await chrome.storage.local.get('waWindowId');
  if (waWindowId === id) await chrome.storage.local.remove('waWindowId');
});

// Se o Chrome bloquear o iframe (cabeçalhos de segurança), avisa o painel para mostrar a solução.
chrome.webNavigation.onErrorOccurred.addListener((d) => {
  if (d.frameId === 0 || !WA_ORIGIN_RE.test(d.url || '')) return;
  saveSystemLog({ module: 'whatsapp-web', action: 'WA_FRAME_ERROR', status: 'error', message: d.error, data: { tabId: d.tabId, frameId: d.frameId, error: d.error } });
  broadcast('WA_FRAME_ERROR', { tabId: d.tabId, error: d.error });
}, { url: [{ hostEquals: 'web.whatsapp.com' }] });
