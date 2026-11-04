/**
 * i9Leads Flow — Backup e sincronização com o Google Drive (v7.2.0 / Fase 12)
 *
 * Sincroniza: leads, campanhas, configurações, preferências do Chat com IA e cadastros comerciais (Fase 12).
 * Chaves API da IA só entram no backup se o usuário definir uma senha; o conteúdo é criptografado com AES-GCM.
 * NÃO sincroniza: licença, chave de licença, senha de sincronização, id do dispositivo, autorizações, logs ou aparência local.
 *
 * Como funciona
 *  - Escopo OAuth: drive.file (a extensão só enxerga os arquivos que ela mesma criou).
 *  - Pasta "i9Leads Flow - Backup" no Meu Drive, com o arquivo principal i9leads-backup.json
 *    e um instantâneo por dia (últimos 7) para desfazer erros.
 *  - Sincronização automática: toda alteração local agenda um envio (~30 s depois, em lote);
 *    a cada 10 min a extensão confere se outro computador enviou algo novo e MESCLA.
 *  - Mescla (nunca sobrescreve às cegas): leads pela chave telefone (ou nome+endereço), o mais
 *    recente vence; exclusões viram "lápides" para não ressuscitar leads apagados.
 *  - Proteção: exclusão em massa (ex.: "Limpar tudo") pausa o envio automático em vez de apagar o Drive.
 *  - Nunca aplica dados remotos enquanto há campanha em andamento (evita conflito com o envio).
 */

import { getApiExtensionVersion } from '../lib/version.js';
import { mergeCrmStageConfig } from '../lib/crm-stage-config.js';
import { mergeNicheTaxonomies } from '../lib/niche-taxonomy.js';
import { mergeAiConversationMemoryMaps } from '../lib/ai-conversation-memory.js';
import { mergeCrmEmailSignatures, mergeCrmEmailTemplates, normalizeCrmEmailSignatures, normalizeCrmEmailTemplates } from '../lib/crm-communication.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_NAME = 'i9Leads Flow - Backup';
const FILE_NAME = 'i9leads-backup.json';
// Arquivo separado para manter compatibilidade: extensões v1.7.0 e anteriores
// não conhecem estes dados e, portanto, não conseguem apagá-los ao atualizar o backup principal.
const MANAGEMENT_FILE_NAME = 'i9leads-commercial-backup.json';
const MANAGEMENT_SNAP_PREFIX = 'i9leads-commercial-backup-';
// Comunicação fica em arquivo separado para que versões anteriores não apaguem modelos/assinaturas.
const COMMUNICATION_FILE_NAME = 'i9leads-communication-backup.json';
const COMMUNICATION_SNAP_PREFIX = 'i9leads-communication-backup-';
const SNAP_PREFIX = 'i9leads-backup-';
const SNAP_KEEP = 7;

const KEY_STATE = 'driveSync';
const KEY_TOMB = 'driveSyncTomb';
const AI_CONFIG_KEY = 'aiSupportConfig';
const AI_SYNC_PASSPHRASE_KEY = 'aiSupportConfigSyncPassphrase';
const AI_SYNC_ENVELOPE_KEY = 'aiSupportConfigSyncEnvelope';
const AI_SYNC_STATUS_KEY = 'aiSupportConfigSyncStatus';
const AI_SYNC_PBKDF2_ITERATIONS = 310000;
const ALARM_PUSH = 'drive-sync-push';
const ALARM_PULL = 'drive-sync-pull';
const PUSH_DELAY_MIN = 0.5;
const PULL_EVERY_MIN = 10;
const TOMB_TTL_MS = 90 * 24 * 3600 * 1000;
const MASS_DELETE_MIN = 10;      // exclusão em massa = removeu >= 10 e >= 50% de uma vez
const LOCAL_ONLY_SETTINGS = ['licenseKey', 'darkTheme', 'compactMode'];
const CRM_STAGE_CONFIG_KEY = 'crmStageConfig';
const CRM_NICHE_TAXONOMY_KEY = 'crmNicheTaxonomy';
const COMMERCIAL_MANAGEMENT_CONFIG_KEY = 'commercialManagementConfig';
const COMMERCIAL_PERFORMANCE_CONFIG_KEY = 'commercialPerformanceConfig';
const CRM_EMAIL_TEMPLATES_KEY = 'crmEmailTemplates';
const CRM_EMAIL_SIGNATURES_KEY = 'crmEmailSignatures';

let hooks = { broadcast: () => {}, log: () => {} };
let applying = false;
let chain = Promise.resolve();            // fila: uma operação por vez
const enqueue = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const normPhone = (p) => String(p || '').replace(/\D/g, '');
function leadKey(l) {
  const ph = normPhone(l?.phone);
  if (ph) return 'p:' + ph;
  return 'n:' + String(l?.name || '').trim().toLowerCase() + '|' + String(l?.address || '').trim().toLowerCase();
}
const ts = (o) => Date.parse(o?.updatedAt || o?.createdAt || o?.extractedAt || '') || 0;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const stripSettings = (s) => { const o = { ...(s || {}) }; LOCAL_ONLY_SETTINGS.forEach((k) => delete o[k]); return o; };

/** The AI preferences sync automatically, but API keys never go to Drive in plaintext. */
export function sanitizeAiConfigForDrive(config = {}) {
  const safe = { ...(config || {}) };
  delete safe.apiKey;
  delete safe.enabled;                 // Never enable unattended replies on a new computer.
  delete safe.providerVerified;         // Re-test provider permissions on each installation.
  delete safe.providerLastError;
  delete safe.providerCooldownUntil;
  delete safe.sheetsVerified;
  safe.fallbackProviders = (Array.isArray(config?.fallbackProviders) ? config.fallbackProviders : []).map((item) => {
    const { apiKey, verified, lastError, cooldownUntil, ...profile } = item || {};
    return profile;
  });
  safe.conversationMemory = mergeAiConversationMemoryMaps(config?.conversationMemory || {}, {});
  return safe;
}

function aiSecretBundle(config = {}) {
  return {
    provider: String(config.provider || ''),
    apiKey: String(config.apiKey || ''),
    fallbackProviders: (Array.isArray(config.fallbackProviders) ? config.fallbackProviders : [])
      .filter((item) => item?.apiKey)
      .map((item) => ({ id: String(item.id || ''), provider: String(item.provider || ''), apiKey: String(item.apiKey || '') })),
  };
}
function hasAiSecrets(config = {}) {
  return !!(String(config.apiKey || '').trim() || (Array.isArray(config.fallbackProviders) && config.fallbackProviders.some((item) => String(item?.apiKey || '').trim())));
}
function bytesToBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = ''; for (let i = 0; i < arr.length; i += 0x8000) binary += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  return btoa(binary);
}
function base64ToBytes(value) { return Uint8Array.from(atob(String(value || '')), (char) => char.charCodeAt(0)); }
async function deriveAiSyncKey(passphrase, salt, iterations = AI_SYNC_PBKDF2_ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(passphrase)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptAiSecrets(config, passphrase) {
  const bundle = aiSecretBundle(config);
  if (!hasAiSecrets(config)) return null;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAiSyncKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(bundle));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { version: 1, algorithm: 'AES-GCM-256', kdf: 'PBKDF2-SHA-256', iterations: AI_SYNC_PBKDF2_ITERATIONS, salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext), fingerprint: await sha256(JSON.stringify(bundle)), updatedAt: new Date().toISOString() };
}
export async function decryptAiSecrets(envelope, passphrase) {
  if (!envelope || envelope.version !== 1 || envelope.algorithm !== 'AES-GCM-256') throw new Error('Backup criptografado de chaves inválido ou incompatível.');
  const iterations = Math.min(600000, Math.max(100000, Number(envelope.iterations) || AI_SYNC_PBKDF2_ITERATIONS));
  const salt = base64ToBytes(envelope.salt); const iv = base64ToBytes(envelope.iv); const ciphertext = base64ToBytes(envelope.ciphertext);
  const key = await deriveAiSyncKey(passphrase, salt, iterations);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  const bundle = JSON.parse(new TextDecoder().decode(plaintext));
  if (!bundle || typeof bundle !== 'object' || typeof bundle.apiKey !== 'string' || !Array.isArray(bundle.fallbackProviders)) throw new Error('Conteúdo do backup de chaves inválido.');
  return bundle;
}
async function secretFingerprint(config) { return hasAiSecrets(config) ? sha256(JSON.stringify(aiSecretBundle(config))) : ''; }
function mergeAiSecretsIntoConfig(config = {}, secrets = {}) {
  const next = { ...(config || {}) };
  if (secrets.provider && secrets.provider === next.provider && secrets.apiKey) next.apiKey = secrets.apiKey;
  const saved = Array.isArray(next.fallbackProviders) ? next.fallbackProviders : [];
  const secretMap = new Map((Array.isArray(secrets.fallbackProviders) ? secrets.fallbackProviders : []).map((item) => [`${item.id}|${item.provider}`, item.apiKey]));
  next.fallbackProviders = saved.map((item) => ({ ...item, ...((secretMap.get(`${item.id}|${item.provider}`)) ? { apiKey: secretMap.get(`${item.id}|${item.provider}`) } : {}) }));
  return next;
}
async function prepareLocalAiSecrets() {
  const r = await chrome.storage.local.get([AI_CONFIG_KEY, AI_SYNC_PASSPHRASE_KEY, AI_SYNC_ENVELOPE_KEY]);
  const config = r[AI_CONFIG_KEY] || {};
  const passphrase = String(r[AI_SYNC_PASSPHRASE_KEY] || '');
  const existing = r[AI_SYNC_ENVELOPE_KEY] || null;
  if (!passphrase) return existing;
  if (!hasAiSecrets(config)) {
    if (existing) await chrome.storage.local.set({ [AI_SYNC_ENVELOPE_KEY]: null, [AI_SYNC_STATUS_KEY]: { state: 'no_keys', updatedAt: Date.now() } });
    return null;
  }
  const fingerprint = await secretFingerprint(config);
  if (existing?.fingerprint === fingerprint) return existing;
  const envelope = await encryptAiSecrets(config, passphrase);
  await chrome.storage.local.set({ [AI_SYNC_ENVELOPE_KEY]: envelope, [AI_SYNC_STATUS_KEY]: { state: 'encrypted', updatedAt: Date.now() } });
  return envelope;
}
function hasAiPreferences(config) {
  if (!config || typeof config !== 'object') return false;
  const safe = sanitizeAiConfigForDrive(config);
  delete safe.conversationMemory;
  delete safe.conversationMemoryUpdatedAt;
  return Object.keys(safe).some((key) => key !== 'fallbackProviders' || config.fallbackProviders?.length);
}
const AI_HISTORY_CONFIG_FIELDS = ['historySheetId', 'historySheetUrl', 'historyEnabled', 'historyLastSyncAt', 'historyLastError'];
function aiHistoryConfigTimestamp(config = {}) {
  const explicit = Date.parse(config.historyUpdatedAt || '') || 0;
  if (explicit) return explicit;
  const hasHistory = AI_HISTORY_CONFIG_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(config, field));
  return hasHistory ? (Date.parse(config.updatedAt || '') || 0) : 0;
}

export function mergeAiConfig(local = {}, remote = {}, forceRemote = false) {
  const localHas = hasAiPreferences(local); const remoteHas = hasAiPreferences(remote);
  const mergedMemory = mergeAiConversationMemoryMaps(local.conversationMemory || {}, remote.conversationMemory || {});
  const memoryUpdatedAt = [local.conversationMemoryUpdatedAt, remote.conversationMemoryUpdatedAt]
    .filter(Boolean).sort((a, b) => (Date.parse(a) || 0) - (Date.parse(b) || 0)).at(-1) || '';
  if (!remoteHas) return { ...local, conversationMemory: mergedMemory, conversationMemoryUpdatedAt: memoryUpdatedAt };
  const localTs = Date.parse(local.updatedAt || '') || 0; const remoteTs = Date.parse(remote.updatedAt || '') || 0;
  const remoteWins = forceRemote || !localHas || remoteTs > localTs;
  const base = { ...(remoteWins ? remote : local) };
  // Preferências e metadados do histórico têm relógios separados: conectar/sincronizar
  // uma planilha não pode tornar um prompt antigo mais recente nem sobrescrever prompts novos.
  const localHistoryTs = aiHistoryConfigTimestamp(local);
  const remoteHistoryTs = aiHistoryConfigTimestamp(remote);
  const historySource = forceRemote || remoteHistoryTs > localHistoryTs ? remote : local;
  const historyFallback = historySource === remote ? local : remote;
  for (const field of AI_HISTORY_CONFIG_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(historySource, field)) base[field] = historySource[field];
    else if (!forceRemote && Object.prototype.hasOwnProperty.call(historyFallback, field)) base[field] = historyFallback[field];
    else delete base[field];
  }
  const historyTs = forceRemote ? remoteHistoryTs : Math.max(localHistoryTs, remoteHistoryTs);
  if (historyTs) base.historyUpdatedAt = new Date(historyTs).toISOString();
  else if (forceRemote) delete base.historyUpdatedAt;
  else if (local.historyUpdatedAt || remote.historyUpdatedAt) base.historyUpdatedAt = historySource.historyUpdatedAt || historyFallback.historyUpdatedAt;
  const keySource = local.provider === base.provider ? local : {};
  if (!base.apiKey && keySource.apiKey) base.apiKey = keySource.apiKey;
  const localFallbacks = new Map((Array.isArray(local.fallbackProviders) ? local.fallbackProviders : []).map((item) => [`${item.id}|${item.provider}`, item]));
  base.fallbackProviders = (Array.isArray(base.fallbackProviders) ? base.fallbackProviders : []).map((item) => {
    const old = localFallbacks.get(`${item.id}|${item.provider}`);
    return { ...item, ...(item.apiKey ? {} : old?.apiKey ? { apiKey: old.apiKey } : {}) };
  });
  // A memória por conversa tem relógio independente dos prompts. Mescla por contato
  // mesmo quando um dispositivo tem configurações mais recentes que o outro.
  base.conversationMemory = mergedMemory;
  base.conversationMemoryUpdatedAt = memoryUpdatedAt;
  if (remoteWins) { base.enabled = false; base.providerVerified = false; base.providerLastError = ''; base.providerCooldownUntil = 0; base.sheetsVerified = false; }
  return base;
}
async function hydrateAiSecrets(config, envelope, passphrase) {
  if (!envelope) return { config, status: { state: 'not_backed_up', updatedAt: Date.now() } };
  if (!passphrase) return { config, status: { state: 'passphrase_required', updatedAt: Date.now() } };
  try {
    const secrets = await decryptAiSecrets(envelope, passphrase);
    return { config: mergeAiSecretsIntoConfig(config, secrets), status: { state: 'restored', updatedAt: Date.now() } };
  } catch {
    return { config, status: { state: 'passphrase_invalid', updatedAt: Date.now() } };
  }
}

async function getState() {
  const r = await chrome.storage.local.get(KEY_STATE);
  return { enabled: false, auto: true, ...(r[KEY_STATE] || {}) };
}
async function setState(patch) {
  const cur = await getState();
  const next = { ...cur, ...patch };
  await chrome.storage.local.set({ [KEY_STATE]: next });
  return next;
}
async function getTomb() {
  const r = await chrome.storage.local.get(KEY_TOMB);
  return { leads: {}, campaigns: {}, ...(r[KEY_TOMB] || {}) };
}
async function setTomb(t) {
  const cut = Date.now() - TOMB_TTL_MS;
  for (const grp of ['leads', 'campaigns']) for (const k of Object.keys(t[grp] || {})) if (t[grp][k] < cut) delete t[grp][k];
  await chrome.storage.local.set({ [KEY_TOMB]: t });
}
async function readLocal() {
  const r = await chrome.storage.local.get(['leads', 'campaigns', 'settings', AI_CONFIG_KEY, AI_SYNC_PASSPHRASE_KEY, AI_SYNC_ENVELOPE_KEY, CRM_STAGE_CONFIG_KEY, CRM_NICHE_TAXONOMY_KEY, COMMERCIAL_MANAGEMENT_CONFIG_KEY, COMMERCIAL_PERFORMANCE_CONFIG_KEY, CRM_EMAIL_TEMPLATES_KEY, CRM_EMAIL_SIGNATURES_KEY]);
  const aiConfig = r[AI_CONFIG_KEY] || {};
  const envelope = r[AI_SYNC_ENVELOPE_KEY] || null;
  const passphrase = String(r[AI_SYNC_PASSPHRASE_KEY] || '');
  const fingerprint = passphrase && hasAiSecrets(aiConfig) ? await secretFingerprint(aiConfig) : (envelope?.fingerprint || '');
  return {
    leads: r.leads || [], campaigns: r.campaigns || [], settings: r.settings || {}, aiConfig,
    aiSecretsEnvelope: envelope, aiSyncPassphrase: passphrase, aiSecretsFingerprint: fingerprint,
    crmStageConfig: r[CRM_STAGE_CONFIG_KEY] || null, crmNicheTaxonomy: r[CRM_NICHE_TAXONOMY_KEY] || null,
    commercialManagementConfig: normalizeCommercialManagementConfig(r[COMMERCIAL_MANAGEMENT_CONFIG_KEY] || {}),
    commercialPerformanceConfig: normalizeCommercialPerformanceConfig(r[COMMERCIAL_PERFORMANCE_CONFIG_KEY] || {}),
    crmEmailTemplates: normalizeCrmEmailTemplates(r[CRM_EMAIL_TEMPLATES_KEY] || []),
    crmEmailSignatures: normalizeCrmEmailSignatures(r[CRM_EMAIL_SIGNATURES_KEY] || {}),
  };
}
async function localHash(d) {
  return sha256(JSON.stringify({
    l: d.leads, c: d.campaigns, s: stripSettings(d.settings),
    ai: sanitizeAiConfigForDrive(d.aiConfig || {}),
    aiSecretsFingerprint: d.aiSecretsFingerprint || d.aiSecretsEnvelope?.fingerprint || '',
    crmStageConfig: d.crmStageConfig || null, crmNicheTaxonomy: d.crmNicheTaxonomy || null,
  }));
}
async function localCommercialHash(d) {
  return sha256(JSON.stringify({
    commercialManagementConfig: normalizeCommercialManagementConfig(d.commercialManagementConfig || {}),
    commercialPerformanceConfig: normalizeCommercialPerformanceConfig(d.commercialPerformanceConfig || {}),
  }));
}
async function localCommunicationHash(d) {
  return sha256(JSON.stringify({
    crmEmailTemplates: normalizeCrmEmailTemplates(d.crmEmailTemplates || []),
    crmEmailSignatures: normalizeCrmEmailSignatures(d.crmEmailSignatures || {}),
  }));
}
function normalizeCommercialManagementConfig(value = {}) {
  return {
    sellers: Array.isArray(value?.sellers) ? value.sellers.filter((item) => item && typeof item === 'object') : [],
    teams: Array.isArray(value?.teams) ? value.teams.filter((item) => item && typeof item === 'object') : [],
    products: Array.isArray(value?.products) ? value.products.filter((item) => item && typeof item === 'object') : [],
    goals: Array.isArray(value?.goals) ? value.goals.filter((item) => item && typeof item === 'object') : [],
    updatedAt: value?.updatedAt || null,
  };
}
function normalizeCommercialPerformanceConfig(value = {}) {
  const source = value?.stageProbabilities && typeof value.stageProbabilities === 'object' && !Array.isArray(value.stageProbabilities) ? value.stageProbabilities : {};
  const stageProbabilities = {};
  for (const [id, raw] of Object.entries(source)) {
    const probability = Number(raw);
    if (id && Number.isFinite(probability) && probability >= 0 && probability <= 100) stageProbabilities[id] = Math.round(probability * 10) / 10;
  }
  return { stageProbabilities, updatedAt: value?.updatedAt || null };
}

class DriveError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status; }
}

// ---------------------------------------------------------------------------
// Autenticação e chamadas à API do Drive
// ---------------------------------------------------------------------------
function configured() {
  const id = chrome.runtime.getManifest().oauth2?.client_id || '';
  return !!id && !/^SEU_|YOUR_|COLE_/i.test(id) && id.endsWith('.apps.googleusercontent.com');
}

async function getToken(interactive) {
  if (!configured()) throw new DriveError('NOT_CONFIGURED', 'O Client ID do Google ainda não foi configurado no manifest.json (veja o LEIA-ME).');
  try {
    const r = await chrome.identity.getAuthToken({ interactive, scopes: [SCOPE] });
    const token = typeof r === 'string' ? r : r?.token;
    if (!token) throw new Error('sem token');
    return token;
  } catch (e) {
    throw new DriveError('AUTH_REQUIRED', interactive ? ('Não foi possível autorizar o Google Drive: ' + (e?.message || e)) : 'É preciso reconectar ao Google Drive.');
  }
}
async function dropToken(token) { try { await chrome.identity.removeCachedAuthToken({ token }); } catch { /* ok */ } }

async function gfetch(url, opts = {}, interactive = false, retry = true) {
  const token = await getToken(interactive);
  let res;
  try {
    res = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token } });
  } catch (e) { throw new DriveError('OFFLINE', 'Sem conexão com o Google Drive.'); }
  if (res.status === 401 && retry) { await dropToken(token); return gfetch(url, opts, interactive, false); }
  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => '');
    if (/storageQuotaExceeded|quota/i.test(body)) throw new DriveError('QUOTA', 'O Google Drive está sem espaço.', res.status);
    if (/rateLimit|userRateLimit/i.test(body)) throw new DriveError('RATE', 'Limite temporário do Google Drive. Tentaremos de novo.', res.status);
    throw new DriveError('AUTH_REQUIRED', 'Permissão do Google Drive negada ou revogada. Reconecte.', res.status);
  }
  if (!res.ok) { const body = await res.text().catch(() => ''); throw new DriveError('HTTP_' + res.status, `Drive respondeu ${res.status}. ${body.slice(0, 160)}`, res.status); }
  return res;
}
const gjson = async (url, opts, interactive) => (await gfetch(url, opts, interactive)).json();

const q = (s) => encodeURIComponent(s);

async function findFolder(interactive) {
  const r = await gjson(`${API}/files?q=${q(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&orderBy=createdTime&fields=files(id)&spaces=drive`, {}, interactive);
  return r.files?.[0]?.id || null;
}
async function createFolder(interactive) {
  const r = await gjson(`${API}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }) }, interactive);
  return r.id;
}
async function findMainFile(folderId, interactive) {
  const r = await gjson(`${API}/files?q=${q(`'${folderId}' in parents and name='${FILE_NAME}' and trashed=false`)}&orderBy=createdTime&fields=files(id,version,modifiedTime)`, {}, interactive);
  return r.files?.[0] || null;
}
async function findManagementFile(folderId, interactive) {
  const r = await gjson(`${API}/files?q=${q(`'${folderId}' in parents and name='${MANAGEMENT_FILE_NAME}' and trashed=false`)}&orderBy=createdTime&fields=files(id,version,modifiedTime)`, {}, interactive);
  return r.files?.[0] || null;
}
async function findCommunicationFile(folderId, interactive) {
  const r = await gjson(`${API}/files?q=${q(`'${folderId}' in parents and name='${COMMUNICATION_FILE_NAME}' and trashed=false`)}&orderBy=createdTime&fields=files(id,version,modifiedTime)`, {}, interactive);
  return r.files?.[0] || null;
}
async function downloadManagementJson(id, interactive) {
  const res = await gfetch(`${API}/files/${id}?alt=media`, {}, interactive);
  const data = await res.json().catch(() => null);
  if (!data || data.app !== 'i9leads-flow-commercial' || data.schema !== 1) throw new DriveError('BAD_MANAGEMENT_FILE', 'O arquivo de sincronização comercial no Drive está inválido.');
  return data;
}
async function downloadCommunicationJson(id, interactive) {
  const res = await gfetch(`${API}/files/${id}?alt=media`, {}, interactive);
  const data = await res.json().catch(() => null);
  if (!data || data.app !== 'i9leads-flow-communication' || data.schema !== 1) throw new DriveError('BAD_COMMUNICATION_FILE', 'O arquivo de modelos e assinaturas no Drive está inválido.');
  return data;
}
async function buildManagementPayload(d, st) {
  return JSON.stringify({
    app: 'i9leads-flow-commercial', schema: 1,
    extVersion: getApiExtensionVersion(), savedAt: new Date().toISOString(), device: st.deviceTag || '',
    commercialManagementConfig: normalizeCommercialManagementConfig(d.commercialManagementConfig || {}),
    commercialPerformanceConfig: normalizeCommercialPerformanceConfig(d.commercialPerformanceConfig || {}),
  });
}
async function snapshotManagementIfNeeded(st, folderId, content, interactive) {
  const today = new Date().toISOString().slice(0, 10);
  if (st.lastManagementSnapshotDate === today) return st;
  try {
    await createJsonFile(folderId, `${MANAGEMENT_SNAP_PREFIX}${today}.json`, content, interactive);
    const list = await gjson(`${API}/files?q=${q(`'${folderId}' in parents and name contains '${MANAGEMENT_SNAP_PREFIX}' and trashed=false`)}&orderBy=name desc&fields=files(id,name)&pageSize=100`, {}, interactive);
    const snaps = (list.files || []).filter((f) => /^i9leads-commercial-backup-\d{4}-\d{2}-\d{2}\.json$/.test(f.name)).sort((a, b) => b.name.localeCompare(a.name));
    for (const f of snaps.slice(SNAP_KEEP)) await gfetch(`${API}/files/${f.id}`, { method: 'DELETE' }, interactive).catch(() => {});
    return await setState({ lastManagementSnapshotDate: today });
  } catch { return st; }
}
async function snapshotCommunicationIfNeeded(st, folderId, content, interactive) {
  const today = new Date().toISOString().slice(0, 10);
  if (st.lastCommunicationSnapshotDate === today) return st;
  try {
    await createJsonFile(folderId, `${COMMUNICATION_SNAP_PREFIX}${today}.json`, content, interactive);
    const list = await gjson(`${API}/files?q=${q(`'${folderId}' in parents and name contains '${COMMUNICATION_SNAP_PREFIX}' and trashed=false`)}&orderBy=name desc&fields=files(id,name)&pageSize=100`, {}, interactive);
    const snaps = (list.files || []).filter((f) => /^i9leads-communication-backup-\d{4}-\d{2}-\d{2}\.json$/.test(f.name)).sort((a, b) => b.name.localeCompare(a.name));
    for (const f of snaps.slice(SNAP_KEEP)) await gfetch(`${API}/files/${f.id}`, { method: 'DELETE' }, interactive).catch(() => {});
    return await setState({ lastCommunicationSnapshotDate: today });
  } catch { return st; }
}
async function fileMeta(id, interactive) {
  try { const m = await gjson(`${API}/files/${id}?fields=id,version,modifiedTime,trashed`, {}, interactive); return m.trashed ? null : m; }
  catch (e) { if (e.status === 404) return null; throw e; }
}
async function createJsonFile(folderId, name, content, interactive) {
  const boundary = 'i9leads' + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name, parents: [folderId], mimeType: 'application/json' });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
  return gjson(`${UPLOAD}/files?uploadType=multipart&fields=id,version,modifiedTime`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body }, interactive);
}
async function updateJsonFile(id, content, interactive) {
  return gjson(`${UPLOAD}/files/${id}?uploadType=media&fields=id,version,modifiedTime`, { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: content }, interactive);
}
async function downloadJson(id, interactive) {
  const res = await gfetch(`${API}/files/${id}?alt=media`, {}, interactive);
  const data = await res.json().catch(() => null);
  if (!data || data.app !== 'i9leads-flow') throw new DriveError('BAD_FILE', 'O arquivo de backup no Drive está inválido.');
  return data;
}
async function accountEmail(interactive) {
  try { const r = await gjson(`${API}/about?fields=user(emailAddress)`, {}, interactive); return r.user?.emailAddress || ''; } catch { return ''; }
}

// ---------------------------------------------------------------------------
// Mescla
// ---------------------------------------------------------------------------
function mergeTomb(a, b) {
  const out = { leads: { ...(a.leads || {}) }, campaigns: { ...(a.campaigns || {}) } };
  for (const grp of ['leads', 'campaigns']) for (const [k, v] of Object.entries(b?.[grp] || {})) out[grp][k] = Math.max(out[grp][k] || 0, v);
  return out;
}

export function mergeLeads(local, remote, tomb) {
  const map = new Map();
  const consider = (l, isLocal) => {
    if (!l) return;
    const k = leadKey(l);
    const t = ts(l);
    if (tomb[k] && tomb[k] >= t) return;                 // apagado depois da última edição
    const cur = map.get(k);
    if (!cur) { map.set(k, l); return; }
    const win = t > ts(cur) ? l : cur;                   // empate: fica o que já estava (local)
    const lose = win === l ? cur : l;
    const tags = [...new Set([...(win.tags || []), ...(lose.tags || [])])];
    const aiTags = [...new Set([...(win.aiTags || []), ...(lose.aiTags || [])])];
    const aiTagIds = [...new Set([...(win.aiTagIds || []), ...(lose.aiTagIds || [])])];
    const groups = [...new Set([...(win.groups || []), ...(lose.groups || [])])];
    const classificationMap = new Map();
    for (const item of [...(win.aiNicheClassifications || (win.aiNicheClassification ? [win.aiNicheClassification] : [])), ...(lose.aiNicheClassifications || (lose.aiNicheClassification ? [lose.aiNicheClassification] : []))]) {
      const key = Array.isArray(item?.nodeIds) && item.nodeIds.length ? item.nodeIds.join('>') : (item?.path || []).join('>');
      if (!key) continue;
      const current = classificationMap.get(key);
      if (!current || (Date.parse(item.updatedAt || '') || 0) > (Date.parse(current.updatedAt || '') || 0)) classificationMap.set(key, item);
    }
    const aiNicheClassifications = [...classificationMap.values()].sort((a, b) => (Date.parse(a.updatedAt || '') || 0) - (Date.parse(b.updatedAt || '') || 0)).slice(-20);
    const merged = { ...win, ...(tags.length ? { tags } : {}), ...(aiTags.length ? { aiTags } : {}), ...(aiTagIds.length ? { aiTagIds } : {}), ...(aiNicheClassifications.length ? { aiNicheClassifications, aiNicheClassification: aiNicheClassifications[aiNicheClassifications.length - 1] } : {}), ...(groups.length ? { groups } : {}) };
    map.set(k, merged);
  };
  local.forEach((l) => consider(l, true));
  remote.forEach((l) => consider(l, false));
  return [...map.values()];
}

const progress = (c) => (c.contacts || []).filter((x) => x.status).length;
export function mergeCampaigns(local, remote, tomb) {
  const map = new Map();
  for (const c of [...local, ...remote]) {
    if (!c?.id) continue;
    const created = Date.parse(c.createdAt || '') || 0;
    if (tomb[c.id] && tomb[c.id] >= created) continue;
    const cur = map.get(c.id);
    if (!cur) { map.set(c.id, c); continue; }
    const a = progress(cur), b = progress(c);
    if (b > a || (b === a && c.status === 'completed' && cur.status !== 'completed')) map.set(c.id, c);
  }
  return [...map.values()];
}

const configTimestamp = (item, fallback = 0) => Date.parse(item?.updatedAt || item?.deletedAt || item?.createdAt || '') || fallback || 0;
const stableLegacyKey = (kind, item) => {
  if (item?.id) return String(item.id);
  if (kind === 'goal') return `legacy:${item?.month || ''}|${item?.targetType || 'seller'}|${item?.targetId || ''}`;
  return `legacy:${String(item?.name || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}`;
};
function mergeCommercialEntityList(kind, local = [], remote = [], localFallback = 0, remoteFallback = 0) {
  const map = new Map();
  for (const [source, fallback, isLocal] of [[local, localFallback, true], [remote, remoteFallback, false]]) {
    for (const raw of Array.isArray(source) ? source : []) {
      if (!raw || typeof raw !== 'object') continue;
      const item = { ...raw };
      const key = stableLegacyKey(kind, item);
      if (!key || key === 'legacy:') { map.set(`${isLocal ? 'local' : 'remote'}:${map.size}`, item); continue; }
      const current = map.get(key);
      if (!current) { map.set(key, { ...item, __mergeSource: isLocal ? 'local' : 'remote' }); continue; }
      const currentIsLocal = current.__mergeSource === 'local';
      const currentTs = configTimestamp(current, currentIsLocal ? localFallback : remoteFallback);
      const nextTs = configTimestamp(item, fallback);
      const winnerRaw = nextTs > currentTs || (nextTs === currentTs && isLocal) ? item : current;
      const winner = { ...winnerRaw, __mergeSource: winnerRaw === item ? (isLocal ? 'local' : 'remote') : current.__mergeSource };
      const loser = winnerRaw === item ? current : item;
      const merged = { ...loser, ...winner };
      // Histórico de equipe é cumulativo: mudanças feitas em computadores diferentes não devem sumir.
      if (kind === 'seller') {
        const history = new Map();
        for (const entry of [...(Array.isArray(loser.teamHistory) ? loser.teamHistory : []), ...(Array.isArray(winner.teamHistory) ? winner.teamHistory : [])]) {
          if (!entry || typeof entry !== 'object') continue;
          const historyKey = `${entry.teamId || ''}|${entry.assignedAt || ''}`;
          const existing = history.get(historyKey);
          if (!existing || (Date.parse(entry.unassignedAt || '') || 0) > (Date.parse(existing.unassignedAt || '') || 0)) history.set(historyKey, entry);
        }
        merged.teamHistory = [...history.values()].sort((a, b) => (Date.parse(a.assignedAt || '') || 0) - (Date.parse(b.assignedAt || '') || 0)).slice(-100);
      }
      map.set(key, merged);
    }
  }
  return [...map.values()].map((item) => { const out = { ...item }; delete out.__mergeSource; return out; });
}
export function mergeCommercialManagementConfig(local = {}, remote = {}) {
  const a = normalizeCommercialManagementConfig(local);
  const b = normalizeCommercialManagementConfig(remote);
  const localTs = Date.parse(a.updatedAt || '') || 0;
  const remoteTs = Date.parse(b.updatedAt || '') || 0;
  return {
    sellers: mergeCommercialEntityList('seller', a.sellers, b.sellers, localTs, remoteTs),
    teams: mergeCommercialEntityList('team', a.teams, b.teams, localTs, remoteTs),
    products: mergeCommercialEntityList('product', a.products, b.products, localTs, remoteTs),
    goals: mergeCommercialEntityList('goal', a.goals, b.goals, localTs, remoteTs),
    updatedAt: Math.max(localTs, remoteTs) ? new Date(Math.max(localTs, remoteTs)).toISOString() : null,
  };
}
export function mergeCommercialPerformanceConfig(local = {}, remote = {}) {
  const a = normalizeCommercialPerformanceConfig(local);
  const b = normalizeCommercialPerformanceConfig(remote);
  const localTs = Date.parse(a.updatedAt || '') || 0;
  const remoteTs = Date.parse(b.updatedAt || '') || 0;
  const localHas = Object.keys(a.stageProbabilities).length > 0;
  const remoteHas = Object.keys(b.stageProbabilities).length > 0;
  const winner = remoteTs > localTs || (!localHas && remoteHas) ? b : a; // empate preserva o estado local
  return { stageProbabilities: { ...winner.stageProbabilities }, updatedAt: winner.updatedAt || null };
}
function hasCommercialManagementData(config = {}) {
  const value = normalizeCommercialManagementConfig(config);
  return !!(value.sellers.length || value.teams.length || value.products.length || value.goals.length);
}
function hasCommercialPerformanceData(config = {}) {
  return Object.keys(normalizeCommercialPerformanceConfig(config).stageProbabilities).length > 0;
}

function mergeAll(local, remote, localTomb, settingsTsLocal) {
  const tomb = mergeTomb(localTomb, remote.tombstones || {});
  const leads = mergeLeads(local.leads, remote.leads || [], tomb.leads);
  const campaigns = mergeCampaigns(local.campaigns, remote.campaigns || [], tomb.campaigns);
  let settings = local.settings; let settingsTs = settingsTsLocal || 0;
  const localEmpty = Object.keys(stripSettings(local.settings)).length === 0;
  const remoteHas = Object.keys(stripSettings(remote.settings)).length > 0;
  if ((remote.settingsTs || 0) > settingsTs || (localEmpty && remoteHas)) {
    settings = { ...stripSettings(remote.settings), ...Object.fromEntries(LOCAL_ONLY_SETTINGS.filter((k) => k in local.settings).map((k) => [k, local.settings[k]])) };
    settingsTs = remote.settingsTs;
  }
  const aiConfig = mergeAiConfig(local.aiConfig || {}, remote.aiConfig || {});
  const crmStageConfig = mergeCrmStageConfig(local.crmStageConfig || {}, remote.crmStageConfig || {});
  const crmNicheTaxonomy = mergeNicheTaxonomies(local.crmNicheTaxonomy || {}, remote.crmNicheTaxonomy || {});
  const commercialManagementConfig = mergeCommercialManagementConfig(local.commercialManagementConfig || {}, remote.commercialManagementConfig || {});
  const commercialPerformanceConfig = mergeCommercialPerformanceConfig(local.commercialPerformanceConfig || {}, remote.commercialPerformanceConfig || {});
  const localEnvelope = local.aiSecretsEnvelope || null; const remoteEnvelope = remote.aiSecrets || null;
  const localEnvTs = Date.parse(localEnvelope?.updatedAt || '') || 0; const remoteEnvTs = Date.parse(remoteEnvelope?.updatedAt || '') || 0;
  const aiSecretsEnvelope = remoteEnvelope && (!localEnvelope || remoteEnvTs > localEnvTs) ? remoteEnvelope : localEnvelope;
  const aiSecretsFingerprint = aiSecretsEnvelope?.fingerprint || local.aiSecretsFingerprint || remote.aiSecretsFingerprint || '';
  return { leads, campaigns, settings, settingsTs, tomb, aiConfig, aiSecretsEnvelope, aiSecretsFingerprint, crmStageConfig, crmNicheTaxonomy, commercialManagementConfig, commercialPerformanceConfig };
}

async function applyLocal(next, current) {
  const patch = {};
  if (JSON.stringify(next.leads) !== JSON.stringify(current.leads)) patch.leads = next.leads;
  if (JSON.stringify(next.campaigns) !== JSON.stringify(current.campaigns)) patch.campaigns = next.campaigns;
  if (JSON.stringify(next.settings) !== JSON.stringify(current.settings)) patch.settings = next.settings;
  if (JSON.stringify(next.aiConfig || {}) !== JSON.stringify(current.aiConfig || {})) patch[AI_CONFIG_KEY] = next.aiConfig || {};
  if (JSON.stringify(next.aiSecretsEnvelope || null) !== JSON.stringify(current.aiSecretsEnvelope || null)) patch[AI_SYNC_ENVELOPE_KEY] = next.aiSecretsEnvelope || null;
  if (JSON.stringify(next.crmStageConfig || null) !== JSON.stringify(current.crmStageConfig || null)) patch[CRM_STAGE_CONFIG_KEY] = next.crmStageConfig || null;
  if (JSON.stringify(next.crmNicheTaxonomy || null) !== JSON.stringify(current.crmNicheTaxonomy || null)) patch[CRM_NICHE_TAXONOMY_KEY] = next.crmNicheTaxonomy || null;
  if (JSON.stringify(next.commercialManagementConfig || {}) !== JSON.stringify(current.commercialManagementConfig || {})) patch[COMMERCIAL_MANAGEMENT_CONFIG_KEY] = normalizeCommercialManagementConfig(next.commercialManagementConfig || {});
  if (JSON.stringify(next.commercialPerformanceConfig || {}) !== JSON.stringify(current.commercialPerformanceConfig || {})) patch[COMMERCIAL_PERFORMANCE_CONFIG_KEY] = normalizeCommercialPerformanceConfig(next.commercialPerformanceConfig || {});
  if (!Object.keys(patch).length) return false;
  applying = true;
  try { await chrome.storage.local.set(patch); await new Promise((r) => setTimeout(r, 150)); } finally { applying = false; }
  return true;
}

async function buildPayload(d, tomb, st) {
  return JSON.stringify({
    app: 'i9leads-flow', schema: 1,
    extVersion: getApiExtensionVersion(),
    savedAt: new Date().toISOString(),
    device: st.deviceTag || '',
    counts: { leads: d.leads.length, campaigns: d.campaigns.length },
    settings: stripSettings(d.settings), settingsTs: st.settingsTs || 0,
    aiConfig: sanitizeAiConfigForDrive(d.aiConfig || {}),
    aiSecrets: d.aiSecretsEnvelope || null,
    aiSecretsFingerprint: d.aiSecretsFingerprint || d.aiSecretsEnvelope?.fingerprint || '',
    crmStageConfig: d.crmStageConfig || null,
    crmNicheTaxonomy: d.crmNicheTaxonomy || null,
    leads: d.leads, campaigns: d.campaigns,
    tombstones: tomb,
  });
}

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------
async function ensureRemote(st, interactive, create) {
  let { folderId, fileId } = st;
  if (fileId && !(await fileMeta(fileId, interactive))) fileId = null;
  if (!fileId) {
    if (!folderId) folderId = await findFolder(interactive);
    if (folderId) { const f = await findMainFile(folderId, interactive); fileId = f?.id || null; }
    if (!folderId && create) folderId = await createFolder(interactive);
  }
  return { folderId, fileId };
}

async function snapshotIfNeeded(st, folderId, content) {
  const today = new Date().toISOString().slice(0, 10);
  if (st.lastSnapshotDate === today) return st;
  try {
    await createJsonFile(folderId, `${SNAP_PREFIX}${today}.json`, content, false);
    const list = await gjson(`${API}/files?q=${q(`'${folderId}' in parents and name contains '${SNAP_PREFIX}' and trashed=false`)}&orderBy=name desc&fields=files(id,name)&pageSize=100`, {}, false);
    const snaps = (list.files || []).filter((f) => /^i9leads-backup-\d{4}-\d{2}-\d{2}\.json$/.test(f.name)).sort((a, b) => b.name.localeCompare(a.name));
    for (const f of snaps.slice(SNAP_KEEP)) await gfetch(`${API}/files/${f.id}`, { method: 'DELETE' }, false).catch(() => {});
    return await setState({ lastSnapshotDate: today });
  } catch { return st; }
}

async function syncCommercialData(folderId, state, mode, interactive) {
  const local = await readLocal();
  let file = state.managementFileId ? await fileMeta(state.managementFileId, interactive) : null;
  if (!file) file = await findManagementFile(folderId, interactive);
  let remote = null;
  const remoteChanged = !!file && String(file.version) !== String(state.lastManagementRemoteVersion || '');
  const localManagementEmpty = !hasCommercialManagementData(local.commercialManagementConfig);
  const localPerformanceEmpty = !hasCommercialPerformanceData(local.commercialPerformanceConfig);
  if (file && mode !== 'overwrite' && (mode === 'restore' || remoteChanged || !state.lastManagementRemoteVersion || localManagementEmpty || localPerformanceEmpty)) {
    remote = await downloadManagementJson(file.id, interactive);
  }

  let mergedManagement = local.commercialManagementConfig;
  let mergedPerformance = local.commercialPerformanceConfig;
  if (mode === 'restore' && remote) {
    mergedManagement = normalizeCommercialManagementConfig(remote.commercialManagementConfig || {});
    mergedPerformance = normalizeCommercialPerformanceConfig(remote.commercialPerformanceConfig || {});
  } else if (remote) {
    mergedManagement = mergeCommercialManagementConfig(local.commercialManagementConfig, remote.commercialManagementConfig || {});
    mergedPerformance = mergeCommercialPerformanceConfig(local.commercialPerformanceConfig, remote.commercialPerformanceConfig || {});
  }

  let changedLocal = false;
  if (remote && mode !== 'overwrite') {
    const fresh = await readLocal();
    const patch = {};
    if (JSON.stringify(mergedManagement) !== JSON.stringify(fresh.commercialManagementConfig)) patch[COMMERCIAL_MANAGEMENT_CONFIG_KEY] = mergedManagement;
    if (JSON.stringify(mergedPerformance) !== JSON.stringify(fresh.commercialPerformanceConfig)) patch[COMMERCIAL_PERFORMANCE_CONFIG_KEY] = mergedPerformance;
    if (Object.keys(patch).length) {
      applying = true;
      try { await chrome.storage.local.set(patch); await new Promise((resolve) => setTimeout(resolve, 100)); }
      finally { applying = false; }
      changedLocal = true;
    }
  }

  const finalLocal = await readLocal();
  const hash = await localCommercialHash(finalLocal);
  const remoteData = remote ? {
    commercialManagementConfig: normalizeCommercialManagementConfig(remote.commercialManagementConfig || {}),
    commercialPerformanceConfig: normalizeCommercialPerformanceConfig(remote.commercialPerformanceConfig || {}),
  } : null;
  const remoteHash = remoteData ? await localCommercialHash(remoteData) : '';
  const remoteAlreadyEqual = !!remote && hash === remoteHash;
  const needPush = mode === 'overwrite' || !file || (hash !== state.lastManagementPushedHash && !remoteAlreadyEqual);
  let pushed = false;
  if (needPush) {
    const content = await buildManagementPayload(finalLocal, state);
    const saved = file
      ? await updateJsonFile(file.id, content, interactive)
      : await createJsonFile(folderId, MANAGEMENT_FILE_NAME, content, interactive);
    file = saved;
    pushed = true;
    state = await snapshotManagementIfNeeded(state, folderId, content, interactive);
  }
  const nextState = await setState({
    managementFileId: file?.id || state.managementFileId || null,
    lastManagementRemoteVersion: file ? String(file.version) : state.lastManagementRemoteVersion,
    lastManagementPushedHash: needPush || remoteAlreadyEqual ? hash : state.lastManagementPushedHash,
    remoteManagementInfo: {
      sellers: finalLocal.commercialManagementConfig.sellers.length,
      teams: finalLocal.commercialManagementConfig.teams.length,
      products: finalLocal.commercialManagementConfig.products.length,
      goals: finalLocal.commercialManagementConfig.goals.length,
      stageProbabilities: Object.keys(finalLocal.commercialPerformanceConfig.stageProbabilities).length,
    },
  });
  return {
    changedLocal, pushed,
    changed: changedLocal,
    state: nextState,
    local: finalLocal,
  };
}

async function syncCommunicationData(folderId, state, mode, interactive) {
  const local = await readLocal();
  let file = state.communicationFileId ? await fileMeta(state.communicationFileId, interactive) : null;
  if (!file) file = await findCommunicationFile(folderId, interactive);
  let remote = null;
  const remoteChanged = !!file && String(file.version) !== String(state.lastCommunicationRemoteVersion || '');
  const localEmpty = !local.crmEmailTemplates.length && !Object.keys(local.crmEmailSignatures).length;
  if (file && mode !== 'overwrite' && (mode === 'restore' || remoteChanged || !state.lastCommunicationRemoteVersion || localEmpty)) {
    remote = await downloadCommunicationJson(file.id, interactive);
  }

  let templates = local.crmEmailTemplates;
  let signatures = local.crmEmailSignatures;
  if (mode === 'restore' && remote) {
    templates = normalizeCrmEmailTemplates(remote.crmEmailTemplates || []);
    signatures = normalizeCrmEmailSignatures(remote.crmEmailSignatures || {});
  } else if (remote) {
    templates = mergeCrmEmailTemplates(local.crmEmailTemplates, remote.crmEmailTemplates || []);
    signatures = mergeCrmEmailSignatures(local.crmEmailSignatures, remote.crmEmailSignatures || {});
  }

  let changedLocal = false;
  if (remote && mode !== 'overwrite') {
    const fresh = await readLocal();
    const patch = {};
    if (JSON.stringify(templates) !== JSON.stringify(fresh.crmEmailTemplates)) patch[CRM_EMAIL_TEMPLATES_KEY] = templates;
    if (JSON.stringify(signatures) !== JSON.stringify(fresh.crmEmailSignatures)) patch[CRM_EMAIL_SIGNATURES_KEY] = signatures;
    if (Object.keys(patch).length) {
      applying = true;
      try { await chrome.storage.local.set(patch); await new Promise((resolve) => setTimeout(resolve, 100)); }
      finally { applying = false; }
      changedLocal = true;
    }
  }

  const finalLocal = await readLocal();
  const hash = await localCommunicationHash(finalLocal);
  const remoteData = remote ? {
    crmEmailTemplates: normalizeCrmEmailTemplates(remote.crmEmailTemplates || []),
    crmEmailSignatures: normalizeCrmEmailSignatures(remote.crmEmailSignatures || {}),
  } : null;
  const remoteHash = remoteData ? await localCommunicationHash(remoteData) : '';
  const remoteAlreadyEqual = !!remote && hash === remoteHash;
  const needPush = mode === 'overwrite' || !file || (hash !== state.lastCommunicationPushedHash && !remoteAlreadyEqual);
  let pushed = false;
  if (needPush) {
    const content = JSON.stringify({
      app: 'i9leads-flow-communication', schema: 1,
      extVersion: getApiExtensionVersion(), savedAt: new Date().toISOString(), device: state.deviceTag || '',
      crmEmailTemplates: finalLocal.crmEmailTemplates,
      crmEmailSignatures: finalLocal.crmEmailSignatures,
    });
    const saved = file
      ? await updateJsonFile(file.id, content, interactive)
      : await createJsonFile(folderId, COMMUNICATION_FILE_NAME, content, interactive);
    file = saved;
    pushed = true;
    state = await snapshotCommunicationIfNeeded(state, folderId, content, interactive);
  }
  const nextState = await setState({
    communicationFileId: file?.id || state.communicationFileId || null,
    lastCommunicationRemoteVersion: file ? String(file.version) : state.lastCommunicationRemoteVersion,
    lastCommunicationPushedHash: needPush || remoteAlreadyEqual ? hash : state.lastCommunicationPushedHash,
    remoteCommunicationInfo: { templates: finalLocal.crmEmailTemplates.length, sellerSignatures: Object.values(finalLocal.crmEmailSignatures).filter((item) => item.text && !item.deletedAt).length },
  });
  return { changedLocal, pushed, changed: changedLocal, state: nextState, local: finalLocal };
}

/**
 * mode: 'merge' (padrão) | 'restore' (Drive substitui o local) | 'overwrite' (local substitui o Drive)
 * opts.interactive: pode abrir a tela de autorização do Google.
 */
async function runSync({ mode = 'merge', interactive = false, auto = false } = {}) {
  let st = await getState();
  if (!st.enabled) return { success: false, code: 'DISABLED', error: 'O backup no Google Drive não está conectado.' };
  if (auto && st.paused) return { success: true, skipped: 'paused' };
  const summary = { mode, pulled: 0, pushed: false };
  try {
    const remoteRef = await ensureRemote(st, interactive, true);
    let { folderId, fileId } = remoteRef;
    await prepareLocalAiSecrets();
    const local = await readLocal();
    const hasRunning = local.campaigns.some((c) => c.status === 'running');
    let localTomb = await getTomb();
    let meta = fileId ? await fileMeta(fileId, interactive) : null;
    if (!meta) fileId = null;

    let remote = null;
    const remoteChanged = !!meta && String(meta.version) !== String(st.lastRemoteVersion || '');
    // Se uma coleção local está vazia, sempre leia e mescle o backup antes de enviar para não apagar dados de outro computador.
    const localNeedsMergeProtection = local.leads.length === 0 || local.campaigns.length === 0;
    if (meta && (remoteChanged || mode !== 'merge' || !st.lastRemoteVersion || localNeedsMergeProtection)) {
      if (mode !== 'overwrite') {
        if (hasRunning && mode === 'merge') {
          return { success: true, skipped: 'campaign-running', error: auto ? undefined : 'Há uma campanha em andamento. A sincronização será feita quando ela terminar.' };
        }
        remote = await downloadJson(fileId, interactive);
      }
    }

    let result = { leads: local.leads, campaigns: local.campaigns, settings: local.settings, settingsTs: st.settingsTs || 0, tomb: localTomb, aiConfig: local.aiConfig, aiSecretsEnvelope: local.aiSecretsEnvelope, aiSecretsFingerprint: local.aiSecretsFingerprint, crmStageConfig: local.crmStageConfig, crmNicheTaxonomy: local.crmNicheTaxonomy };

    if (mode === 'restore') {
      if (!remote) return { success: false, error: 'Não há backup no Google Drive para restaurar.' };
      result = { leads: remote.leads || [], campaigns: remote.campaigns || [],
        settings: { ...stripSettings(remote.settings), ...Object.fromEntries(LOCAL_ONLY_SETTINGS.filter((k) => k in local.settings).map((k) => [k, local.settings[k]])) },
        settingsTs: remote.settingsTs || 0, tomb: remote.tombstones || { leads: {}, campaigns: {} },
        aiConfig: mergeAiConfig(local.aiConfig || {}, remote.aiConfig || {}, true),
        aiSecretsEnvelope: remote.aiSecrets || local.aiSecretsEnvelope || null,
        aiSecretsFingerprint: remote.aiSecretsFingerprint || remote.aiSecrets?.fingerprint || local.aiSecretsFingerprint || '',
        crmStageConfig: remote.crmStageConfig || local.crmStageConfig || null,
        crmNicheTaxonomy: remote.crmNicheTaxonomy || local.crmNicheTaxonomy || null };
    } else if (remote) {
      result = mergeAll(local, remote, localTomb, st.settingsTs);
    }

    // Restaura chaves somente após descriptografia local; a senha nunca sai deste computador.
    if (remote && result.aiConfig) {
      const hydrated = await hydrateAiSecrets(result.aiConfig, result.aiSecretsEnvelope, local.aiSyncPassphrase);
      result.aiConfig = hydrated.config;
      result.aiSecretsFingerprint = result.aiSecretsEnvelope?.fingerprint || result.aiSecretsFingerprint || '';
      await chrome.storage.local.set({ [AI_SYNC_STATUS_KEY]: hydrated.status });
    }
    // aplica localmente (releitura logo antes, para não pisar em algo gravado durante o download)
    const fresh = await readLocal();
    const fresh_hasRunning = fresh.campaigns.some((c) => c.status === 'running');
    if (remote && fresh_hasRunning && mode === 'merge') return { success: true, skipped: 'campaign-running' };
    const keysBefore = new Set(local.leads.map(leadKey));
    const changed = remote ? await applyLocal(result, fresh) : false;
    if (remote) summary.pulled = result.leads.filter((l) => !keysBefore.has(leadKey(l))).length;
    await setTomb(result.tomb);
    summary.changedLocal = changed;

    // decide se envia
    const finalLocal = await readLocal();
    const hash = await localHash(finalLocal);
    const remoteAlreadyEqual = remote && hash === (await localHash({ leads: remote.leads || [], campaigns: remote.campaigns || [], settings: remote.settings || {}, aiConfig: remote.aiConfig || {}, aiSecretsEnvelope: remote.aiSecrets || null, aiSecretsFingerprint: remote.aiSecretsFingerprint || remote.aiSecrets?.fingerprint || '', crmStageConfig: remote.crmStageConfig || null, crmNicheTaxonomy: remote.crmNicheTaxonomy || null }));
    const needPush = mode === 'overwrite' || !meta || (hash !== st.lastPushedHash && !remoteAlreadyEqual);

    if (needPush) {
      if (auto && finalLocal.leads.length === 0 && finalLocal.campaigns.length === 0 && meta) {
        // Preserve o backup se ele contém dados comerciais; permita backups somente de configurações.
        let remoteHasBusinessData = !!(remote && ((remote.leads || []).length || (remote.campaigns || []).length));
        if (!remote) {
          try { const probe = await downloadJson(fileId, interactive); remoteHasBusinessData = !!((probe.leads || []).length || (probe.campaigns || []).length); }
          catch { remoteHasBusinessData = true; }
        }
        if (remoteHasBusinessData) {
          st = await setState({ paused: true, lastError: { code: 'EMPTY_LOCAL', message: 'Os dados locais estão vazios. O envio automático foi pausado para não apagar o seu backup.' } });
          hooks.broadcast('DRIVE_STATUS', {});
          return { success: false, code: 'EMPTY_LOCAL', error: st.lastError.message };
        }
      }
      // Configurações existentes mas sem data de alteração (primeiro envio): marca agora.
      if (!result.settingsTs && Object.keys(stripSettings(finalLocal.settings)).length) result.settingsTs = Date.now();
      st = await setState({ settingsTs: result.settingsTs });
      const content = await buildPayload(finalLocal, result.tomb, st);
      const saved = fileId ? await updateJsonFile(fileId, content, interactive) : await createJsonFile(folderId, FILE_NAME, content, interactive);
      fileId = saved.id; meta = saved; summary.pushed = true;
      st = await snapshotIfNeeded(await getState(), folderId, content);
    }

    // Dados de gestão comercial ficam em arquivo próprio para que versões antigas da extensão
    // não apaguem esses campos ao regravar o backup principal.
    const commercialSync = await syncCommercialData(folderId, await getState(), mode, interactive);
    summary.managementChanged = commercialSync.changed;
    summary.managementPushed = commercialSync.pushed;
    summary.changedLocal = summary.changedLocal || commercialSync.changedLocal;
    const communicationSync = await syncCommunicationData(folderId, await getState(), mode, interactive);
    summary.communicationChanged = communicationSync.changed;
    summary.communicationPushed = communicationSync.pushed;
    summary.changedLocal = summary.changedLocal || communicationSync.changedLocal;
    st = await setState({
      folderId, fileId, lastRemoteVersion: meta ? String(meta.version) : st.lastRemoteVersion,
      lastPushedHash: needPush || remoteAlreadyEqual ? hash : st.lastPushedHash,
      lastSyncAt: Date.now(), lastError: null, paused: false,
      remoteInfo: remote ? { savedAt: remote.savedAt, leads: (remote.leads || []).length, campaigns: (remote.campaigns || []).length } : st.remoteInfo,
    });
    hooks.broadcast('DRIVE_STATUS', {});
    return { success: true, data: { ...summary, ...(await publicStatus()) } };
  } catch (e) {
    const code = e.code || 'ERROR';
    await setState({ lastError: { code, message: e.message || String(e), at: Date.now() } });
    hooks.log({ module: 'drive-sync', action: 'DRIVE_SYNC_ERROR', status: 'error', message: e.message, data: { code, mode } });
    hooks.broadcast('DRIVE_STATUS', {});
    return { success: false, code, error: e.message || String(e) };
  }
}
const syncQueued = (opts) => enqueue(() => runSync(opts));

// ---------------------------------------------------------------------------
// Alterações locais -> lápides, "sujo" e agendamento do envio
// ---------------------------------------------------------------------------
async function onLocalChange(changes) {
  const st = await getState();
  if (!st.enabled) return;
  const patch = {};
  const tomb = await getTomb();
  let tombChanged = false;

  if (changes.leads) {
    const oldL = changes.leads.oldValue || []; const newL = changes.leads.newValue || [];
    const present = new Set(newL.map(leadKey));
    const removed = oldL.filter((l) => !present.has(leadKey(l)));
    const mass = removed.length >= MASS_DELETE_MIN && removed.length >= oldL.length / 2;
    if (mass) {
      patch.paused = true;
      patch.lastError = { code: 'MASS_DELETE', message: `${removed.length} leads foram removidos de uma vez. O envio automático foi pausado para proteger o backup no Drive.`, at: Date.now() };
    } else if (removed.length) {
      const now = Date.now();
      removed.forEach((l) => { tomb.leads[leadKey(l)] = now; });
      tombChanged = true;
    }
  }
  if (changes.campaigns) {
    const oldC = changes.campaigns.oldValue || []; const newC = changes.campaigns.newValue || [];
    const ids = new Set(newC.map((c) => c.id));
    const removed = oldC.filter((c) => !ids.has(c.id));
    if (removed.length) { const now = Date.now(); removed.forEach((c) => { tomb.campaigns[c.id] = now; }); tombChanged = true; }
  }
  if (changes.settings) patch.settingsTs = Date.now();
  const templatesChange = changes[CRM_EMAIL_TEMPLATES_KEY];
  const signaturesChange = changes[CRM_EMAIL_SIGNATURES_KEY];
  const countCommunication = (value) => (Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : 0);
  const beforeCommunication = countCommunication(templatesChange?.oldValue) + countCommunication(signaturesChange?.oldValue);
  const afterCommunication = countCommunication(templatesChange?.newValue) + countCommunication(signaturesChange?.newValue);
  if ((templatesChange || signaturesChange) && beforeCommunication > 0 && afterCommunication === 0) {
    patch.paused = true;
    patch.lastError = { code: 'COMMUNICATION_CLEAR', message: 'Os modelos e assinaturas locais foram limpos. A sincronização automática foi pausada para proteger o backup compartilhado no Drive.', at: Date.now() };
  }
  const commercialChange = changes[COMMERCIAL_MANAGEMENT_CONFIG_KEY];
  if (commercialChange) {
    const count = (value) => ['sellers', 'teams', 'products', 'goals'].reduce((sum, key) => sum + (Array.isArray(value?.[key]) ? value[key].length : 0), 0);
    const before = count(commercialChange.oldValue || {});
    const after = count(commercialChange.newValue || {});
    // Remoções normais são desativações com histórico. Uma limpeza física total pausa o push
    // automático para impedir que um clique/bug apague o backup comercial compartilhado.
    if (before > 0 && after === 0) {
      patch.paused = true;
      patch.lastError = { code: 'MANAGEMENT_CLEAR', message: 'Os cadastros comerciais locais foram limpos. A sincronização automática foi pausada para proteger o backup compartilhado no Drive.', at: Date.now() };
    }
  }
  if (tombChanged) await setTomb(tomb);
  if (Object.keys(patch).length) await setState(patch);
  if (st.auto && !(patch.paused)) schedulePush();
  if (patch.paused) hooks.broadcast('DRIVE_STATUS', {});
}

async function schedulePush() {
  const a = await chrome.alarms.get(ALARM_PUSH);
  if (!a) await chrome.alarms.create(ALARM_PUSH, { delayInMinutes: PUSH_DELAY_MIN });
}

async function ensureAlarms() {
  const st = await getState();
  if (st.enabled && st.auto) {
    if (!(await chrome.alarms.get(ALARM_PULL))) await chrome.alarms.create(ALARM_PULL, { delayInMinutes: 1, periodInMinutes: PULL_EVERY_MIN });
  } else {
    await chrome.alarms.clear(ALARM_PULL); await chrome.alarms.clear(ALARM_PUSH);
  }
}

// ---------------------------------------------------------------------------
// Status e handlers (ligados ao service worker)
// ---------------------------------------------------------------------------
async function publicStatus() {
  const st = await getState();
  const local = await readLocal();
  const syncMeta = await chrome.storage.local.get([AI_SYNC_PASSPHRASE_KEY, AI_SYNC_ENVELOPE_KEY, AI_SYNC_STATUS_KEY]);
  return {
    configured: configured(), connected: !!st.enabled, auto: !!st.auto, email: st.email || '',
    aiConfigPresent: hasAiPreferences(local.aiConfig), aiKeyBackupAvailable: !!syncMeta[AI_SYNC_ENVELOPE_KEY], aiKeySyncPassphraseConfigured: !!syncMeta[AI_SYNC_PASSPHRASE_KEY], aiKeySyncStatus: syncMeta[AI_SYNC_STATUS_KEY] || null,
    lastSyncAt: st.lastSyncAt || null, lastError: st.lastError || null, paused: !!st.paused,
    remote: st.remoteInfo || null, remoteManagement: st.remoteManagementInfo || null, remoteCommunication: st.remoteCommunicationInfo || null,
    local: { leads: local.leads.length, campaigns: local.campaigns.length, sellers: local.commercialManagementConfig.sellers.length, teams: local.commercialManagementConfig.teams.length, products: local.commercialManagementConfig.products.length, goals: local.commercialManagementConfig.goals.length, stageProbabilities: Object.keys(local.commercialPerformanceConfig.stageProbabilities).length, emailTemplates: local.crmEmailTemplates.length, sellerSignatures: Object.values(local.crmEmailSignatures).filter((item) => item.text && !item.deletedAt).length },
    folder: FOLDER_NAME,
  };
}

export const driveHandlers = {
  async DRIVE_GET_STATUS() { return { success: true, data: await publicStatus() }; },

  async DRIVE_CONNECT() {
    if (!configured()) return { success: false, code: 'NOT_CONFIGURED', error: 'O Client ID do Google ainda não foi configurado no manifest.json (veja o LEIA-ME).' };
    try {
      await getToken(true);
      const email = await accountEmail(true);
      const prev = await getState();
      await setState({
        enabled: true, auto: true, email, paused: false, lastError: null,
        deviceTag: prev.deviceTag || ('pc-' + Math.random().toString(36).slice(2, 7)),
        settingsTs: prev.settingsTs || 0,
      });
      await ensureAlarms();
      const r = await syncQueued({ mode: 'merge', interactive: true });
      if (!r.success) { await setState({ enabled: false }); await ensureAlarms(); }
      return r;
    } catch (e) { return { success: false, code: e.code || 'ERROR', error: e.message || String(e) }; }
  },

  async DRIVE_SYNC_NOW() { await setState({ paused: false, lastError: null }); return syncQueued({ mode: 'merge', interactive: true }); },
  async DRIVE_RESTORE() { await setState({ paused: false }); return syncQueued({ mode: 'restore', interactive: true }); },
  async DRIVE_OVERWRITE() { await setState({ paused: false }); return syncQueued({ mode: 'overwrite', interactive: true }); },

  async DRIVE_SET_AUTO(p) {
    await setState({ auto: !!p?.enabled }); await ensureAlarms();
    if (p?.enabled) schedulePush();
    return { success: true, data: await publicStatus() };
  },

  async DRIVE_SET_AI_SYNC_PASSPHRASE(p) {
    const passphrase = String(p?.passphrase || '');
    if (passphrase.length < 10 || passphrase.length > 256) return { success: false, code: 'AI_SYNC_PASSWORD_LENGTH', error: 'Use uma senha de sincronização com pelo menos 10 caracteres.' };
    let current = await chrome.storage.local.get([AI_CONFIG_KEY, AI_SYNC_ENVELOPE_KEY, AI_SYNC_PASSPHRASE_KEY]);
    // Se a máquina nova ainda não puxou o backup, tenta sincronizar antes de validar a senha.
    const state = await getState();
    let preRestoreSyncResult = null;
    if (state.enabled && !current[AI_SYNC_ENVELOPE_KEY] && !hasAiSecrets(current[AI_CONFIG_KEY] || {})) {
      preRestoreSyncResult = await syncQueued({ mode: 'merge', interactive: true });
      current = await chrome.storage.local.get([AI_CONFIG_KEY, AI_SYNC_ENVELOPE_KEY, AI_SYNC_PASSPHRASE_KEY]);
    }
    const config = current[AI_CONFIG_KEY] || {};
    const envelope = current[AI_SYNC_ENVELOPE_KEY] || null;
    const hasLocalSecrets = hasAiSecrets(config);
    let restored = false;
    if (!hasLocalSecrets && envelope) {
      let secrets;
      try { secrets = await decryptAiSecrets(envelope, passphrase); }
      catch { return { success: false, code: 'AI_SYNC_PASSWORD_INVALID', error: 'A senha não corresponde ao backup criptografado. Confira a senha usada no outro computador.' }; }
      const nextConfig = mergeAiSecretsIntoConfig(config, secrets);
      await chrome.storage.local.set({ [AI_SYNC_PASSPHRASE_KEY]: passphrase, [AI_CONFIG_KEY]: nextConfig, [AI_SYNC_STATUS_KEY]: { state: 'restored', updatedAt: Date.now() } });
      restored = true;
    } else {
      await chrome.storage.local.set({ [AI_SYNC_PASSPHRASE_KEY]: passphrase });
      await prepareLocalAiSecrets();
    }
    const latestState = await getState();
    let syncResult = null;
    // Se uma sincronização anterior já trouxe as preferências e o backup de chaves foi restaurado,
    // evite um segundo merge imediato. Se não houve sync prévio (ou ele falhou/foi ignorado), tente agora.
    const preRestoreSyncCompleted = preRestoreSyncResult?.success === true && !preRestoreSyncResult?.skipped;
    if (latestState.enabled && (!restored || !preRestoreSyncCompleted)) syncResult = await syncQueued({ mode: 'merge', interactive: true });
    const effectiveSyncResult = syncResult || preRestoreSyncResult;
    return { success: true, data: { passphraseConfigured: true, restored, driveConnected: !!latestState.enabled, syncSuccess: effectiveSyncResult?.success === true && !effectiveSyncResult?.skipped, syncError: effectiveSyncResult?.success === false ? effectiveSyncResult.error : '' } };
  },

  async DRIVE_CLEAR_AI_SYNC_PASSPHRASE() {
    await chrome.storage.local.remove(AI_SYNC_PASSPHRASE_KEY);
    await chrome.storage.local.set({ [AI_SYNC_STATUS_KEY]: { state: 'passphrase_required', updatedAt: Date.now() } });
    return { success: true, data: await publicStatus() };
  },

  async DRIVE_DISCONNECT() {
    try {
      const r = await chrome.identity.getAuthToken({ interactive: false, scopes: [SCOPE] });
      const token = typeof r === 'string' ? r : r?.token;
      if (token) { await dropToken(token); fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }).toString(), credentials: 'omit', cache: 'no-store', redirect: 'error' }).catch(() => {}); }
    } catch { /* sem token ativo */ }
    await chrome.storage.local.remove([KEY_STATE, KEY_TOMB]);
    await ensureAlarms();
    hooks.broadcast('DRIVE_STATUS', {});
    return { success: true, data: await publicStatus() };
  },
};

export function initDriveSync(h = {}) {
  hooks = { ...hooks, ...h };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || applying) return;
  if (!(changes.leads || changes.campaigns || changes.settings || changes[AI_CONFIG_KEY] || changes[AI_SYNC_ENVELOPE_KEY] || changes[CRM_STAGE_CONFIG_KEY] || changes[CRM_NICHE_TAXONOMY_KEY] || changes[COMMERCIAL_MANAGEMENT_CONFIG_KEY] || changes[COMMERCIAL_PERFORMANCE_CONFIG_KEY] || changes[CRM_EMAIL_TEMPLATES_KEY] || changes[CRM_EMAIL_SIGNATURES_KEY])) return;
    enqueue(() => onLocalChange(changes)).catch(() => {});
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_PUSH || alarm.name === ALARM_PULL) {
      if (alarm.name === ALARM_PUSH) chrome.alarms.clear(ALARM_PUSH);
      syncQueued({ mode: 'merge', auto: true });
    }
  });
  chrome.runtime.onStartup.addListener(async () => { const st = await getState(); if (st.enabled && st.auto) syncQueued({ mode: 'merge', auto: true }); });
  ensureAlarms().catch(() => {});
  // Migra automaticamente a configuração de IA existente para o backup ao atualizar a extensão.
  (async () => { const st = await getState(); if (st.enabled && st.auto) { await prepareLocalAiSecrets().catch(() => {}); schedulePush().catch(() => {}); } })().catch(() => {});
}
