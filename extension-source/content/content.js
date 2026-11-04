(function () {
// v7.0.2/7.0.3 - Onde este script pode rodar (v7.0.5: o padrão é a aba/janela comum; o iframe é opcional):
//  (a) aba comum do WhatsApp Web ............................ window === window.parent
//  (b) WhatsApp Web EMBUTIDO (iframe) na página da extensão ... o pai é de outra origem
//  Subframes internos do próprio WhatsApp (pai de mesma origem) são ignorados, para
//  que apenas UM script responda às mensagens da extensão.
let __sameOriginParent = false;
try { __sameOriginParent = window !== window.parent && window.parent.location.origin === location.origin; }
catch (e) { /* pai de outra origem: estamos embutidos na página da extensão */ }
if (__sameOriginParent) return;
const EMBEDDED = window !== window.parent;
const CONTENT_VER = '1.0.0.0';

// Bridge versioning: if an older content-script context is still alive after an
// extension update, it yields to the newest bridge instead of returning stale errors.
if (window.__i9rcsContentV7Version === CONTENT_VER) return;
window.__i9rcsContentV7 = true;
window.__i9rcsContentV7Version = CONTENT_VER;

// v1.0.9 - Chat com IA: mensagens recebidas chegam pelo Store interno (injected.js).
// Enquanto o monitor do Store estiver ativo (sinal a cada 5 s), a leitura por DOM fica
// desligada para a mesma mensagem não ser respondida duas vezes.
let aiStoreBeatAt = 0;
let aiStoreChain = Promise.resolve();
let aiStoreLastReport = { ok: null, at: 0 };
let aiBridgeStatusCache = null;
let aiBridgeStatusAt = 0;
const aiStoreHealthy = () => Date.now() - aiStoreBeatAt < 15000;

/**
 * i9Hub - Content Script (Bridge)
 * Ponte: Service Worker <-> Injected Script
 */

const MSG = {
  START_CAMPAIGN: 'START_CAMPAIGN',
  PAUSE_CAMPAIGN: 'PAUSE_CAMPAIGN',
  RESUME_CAMPAIGN: 'RESUME_CAMPAIGN',
  STOP_CAMPAIGN: 'STOP_CAMPAIGN',
  EXTRACT_GROUP_MEMBERS: 'EXTRACT_GROUP_MEMBERS',
  EXTRACT_ALL_CHATS: 'EXTRACT_ALL_CHATS',
  SYNC_PRIVATE_OPPORTUNITIES: 'SYNC_PRIVATE_OPPORTUNITIES',
  EXTRACT_CHAT_MESSAGES: 'EXTRACT_CHAT_MESSAGES',
  GET_CURRENT_CHAT_INFO: 'GET_CURRENT_CHAT_INFO',
  GET_QR: 'GET_QR',
  LABELS_DIAGNOSTIC: 'LABELS_DIAGNOSTIC',
  LABELS_LIST: 'LABELS_LIST',
  BLACKLIST_ADD_REQUEST: 'BLACKLIST_ADD_REQUEST',
  CONSENT_UPDATE: 'CONSENT_UPDATE',
  CHECK_READY: 'CHECK_READY',
  CAMPAIGN_STARTED: 'CAMPAIGN_STARTED',
  CAMPAIGN_PAUSED: 'CAMPAIGN_PAUSED',
  CAMPAIGN_RESUMED: 'CAMPAIGN_RESUMED',
  CAMPAIGN_STOPPED: 'CAMPAIGN_STOPPED',
  CAMPAIGN_COMPLETED: 'CAMPAIGN_COMPLETED',
  CAMPAIGN_RESULT: 'CAMPAIGN_RESULT',
  CONTACT_PROCESSING: 'CONTACT_PROCESSING',
  CAMPAIGN_WAITING_VISIBLE: 'CAMPAIGN_WAITING_VISIBLE',
  CAMPAIGN_BATCH_PAUSE_STARTED: 'CAMPAIGN_BATCH_PAUSE_STARTED',
  CAMPAIGN_BATCH_PAUSE_ENDED: 'CAMPAIGN_BATCH_PAUSE_ENDED',
  MESSAGE_SENT: 'MESSAGE_SENT',
  MESSAGE_FAILED: 'MESSAGE_FAILED',
  MESSAGE_SKIPPED: 'MESSAGE_SKIPPED',
  RATE_LIMIT_DETECTED: 'RATE_LIMIT_DETECTED',
  WHATSAPP_OFFLINE: 'WHATSAPP_OFFLINE',
  GROUP_MEMBERS_EXTRACTED: 'GROUP_MEMBERS_EXTRACTED',
  CHATS_EXTRACTED: 'CHATS_EXTRACTED',
  CURRENT_CHAT_INFO: 'CURRENT_CHAT_INFO',
  READY: 'READY',
  PONG: 'PONG',
  ERROR: 'ERROR',
  LOG: 'LOG',
};

let injectedReady = false;
let pendingRequests = new Map();
let requestId = 0;

window.addEventListener("error", e => logToBackground("error", "window.onerror", {module:"content", action:"WINDOW_ERROR", data:{error:e.message,file:e.filename,line:e.lineno}}));
window.addEventListener("unhandledrejection", e => logToBackground("error", "promise rejection", {module:"content", action:"PROMISE_REJECTION", data:{error:String(e.reason)}}));


function sendToBackground(type, payload = {}) {
  try {
    if (!chrome.runtime || !chrome.runtime.id) {
      console.warn('[i9Hub] Extension context invalidated');
      return;
    }
    chrome.runtime.sendMessage({ type, payload, timestamp: Date.now() }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[i9Hub] background indisponível', chrome.runtime.lastError.message);
      }
    });
  } catch (e) {
    console.warn('[i9Hub] sendToBackground falhou', e.message);
  }
}
function logToBackground(level, message, data = {}) {
  sendToBackground(MSG.LOG, { level, message, data });
}
function generateRequestId() { return ++requestId; }
function sendToInjected(type, payload = {}) {
  window.postMessage({ source: 'i9rcs7-content', type, payload }, '*');
}

function sendToInjectedWithResponse(type, payload = {}, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const id = generateRequestId();
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Timeout: ${type} nao respondeu a tempo`));
    }, timeoutMs);
    pendingRequests.set(id, { resolve, reject, timeout });
    window.postMessage({ source: 'i9rcs7-content', type, payload: { ...payload, requestId: id } }, '*');
  });
}

window.addEventListener('message', (event) => {
  if (window.__i9rcsContentV7Version !== CONTENT_VER) return;
  if (event.source !== window) return;
  if (event.data?.source !== 'i9rcs7-injected') return;
  const { type, payload } = event.data;
  if (type === 'KEEPALIVE_PING') {
    chrome.runtime.sendMessage({ type: "WA_PING_RECEIVED" }).catch(() => {});
    return;
  }
  if (payload?.requestId && pendingRequests.has(payload.requestId)) {
    const { resolve, reject, timeout } = pendingRequests.get(payload.requestId);
    clearTimeout(timeout);
    pendingRequests.delete(payload.requestId);
    if (type === 'ERROR') reject(new Error(payload.error));
    else resolve(payload);
    return;
  }
  handleInjectedEvent(type, payload);
});

function handleInjectedEvent(type, payload) {
  switch (type) {
    case MSG.READY:
      injectedReady = true;
      logToBackground('info', 'Injected script pronto', { version: payload.version });
      sendToBackground(MSG.READY, { ready: true, version: payload.version });
      break;
    case MSG.CAMPAIGN_STARTED:
    case MSG.CAMPAIGN_PAUSED:
    case MSG.CAMPAIGN_RESUMED:
    case MSG.CAMPAIGN_STOPPED:
    case MSG.CAMPAIGN_COMPLETED:
    case MSG.CONTACT_PROCESSING:
    case MSG.CAMPAIGN_WAITING_VISIBLE:
    case MSG.CAMPAIGN_BATCH_PAUSE_STARTED:
    case MSG.CAMPAIGN_BATCH_PAUSE_ENDED:
    case MSG.MESSAGE_SENT:
    case MSG.MESSAGE_FAILED:
    case MSG.MESSAGE_SKIPPED:
    case MSG.RATE_LIMIT_DETECTED:
    case MSG.WHATSAPP_OFFLINE:
      sendToBackground(type, payload);
      break;
    case MSG.CAMPAIGN_RESULT:
      sendToBackground('CAMPAIGN_FINISHED', payload);
      break;
    case MSG.BLACKLIST_ADD_REQUEST: {
      // Botão "Black list" da conversa -> service worker -> resposta de volta para a página (aviso na tela).
      const rid = payload?.requestId;
      try {
        chrome.runtime.sendMessage({ type: 'BLACKLIST_ADD', payload }, (resp) => {
          const r = chrome.runtime.lastError ? { success: false, error: chrome.runtime.lastError.message } : (resp || { success: false, error: 'Sem resposta da extensão' });
          sendToInjected('BLACKLIST_RESULT', { ...r, requestId: rid });
        });
      } catch (e) { sendToInjected('BLACKLIST_RESULT', { success: false, error: e.message, requestId: rid }); }
      break;
    }
    case MSG.GROUP_MEMBERS_EXTRACTED:
      sendToBackground('GROUP_MEMBERS_EXTRACTED', payload);
      break;
    case 'PRIVATE_CHATS_DETECTED':
      console.log('[i9Hub Sync] ' + JSON.stringify({ event: 'BRIDGE_BATCH_FORWARD', syncRunId: payload?.scanId || null, batchIndex: payload?.batchIndex, chatCount: Array.isArray(payload?.chats) ? payload.chats.length : 0, finalBatch: !!payload?.finalBatch, timestamp: new Date().toISOString(), context: 'content_script' }));
      sendToBackground('PRIVATE_CHATS_DETECTED', payload);
      break;
    case 'PRIVATE_CHATS_SYNC_PROGRESS':
      sendToBackground('PRIVATE_CHATS_SYNC_PROGRESS', payload);
      break;
    case 'PRIVATE_CHATS_SYNC_FAILED':
      sendToBackground('PRIVATE_CHATS_SYNC_FAILED', payload);
      break;
    case 'AI_STORE_STATUS': {
      const ok = payload?.ok === true;
      aiStoreBeatAt = ok ? Date.now() : 0;
      if (aiStoreLastReport.ok !== ok || Date.now() - aiStoreLastReport.at > 15000) {
        aiStoreLastReport = { ok, at: Date.now() };
        sendToBackground('AI_STORE_STATUS', { ok, via: String(payload?.via || '').slice(0, 40), chats: Number(payload?.chats) || 0, reason: String(payload?.reason || '').slice(0, 80) });
      }
      break;
    }
    case 'AI_STORE_MESSAGE':
      aiStoreChain = aiStoreChain.then(() => forwardStoreAiMessage(payload)).catch(() => {});
      break;
    case MSG.CHATS_EXTRACTED:
      sendToBackground('CHATS_EXTRACTED', payload);
      break;
    case MSG.CURRENT_CHAT_INFO:
      sendToBackground('CURRENT_CHAT_INFO', payload);
      break;
    case MSG.LOG:
      sendToBackground('LOG', payload);
      break;
    case MSG.PONG:
      break;
    case MSG.ERROR:
      logToBackground('error', `Erro no injected: ${payload.error}`, { type: payload.type });
      sendToBackground('ERROR', payload);
      break;
    default:
      logToBackground('debug', `Evento nao tratado: ${type}`, payload);
  }
}

function aiBridgeStatus() {
  if (Date.now() - aiBridgeStatusAt < 4000) return Promise.resolve(aiBridgeStatusCache);
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'AI_INBOX_CHECK' }, (response) => {
        aiBridgeStatusCache = chrome.runtime.lastError || !response?.success ? null : response;
        aiBridgeStatusAt = Date.now();
        resolve(aiBridgeStatusCache);
      });
    } catch { aiBridgeStatusCache = null; aiBridgeStatusAt = Date.now(); resolve(null); }
  });
}

function aiTrackConsentFromStore(phone, text) {
  // Mesma regra do observador por DOM (QUERO/SAIR), agora também para mensagens vindas do Store.
  const digits = String(phone || '').replace(/\D/g, '').slice(0, 15);
  const clean = String(text || '').trim().replace(/\s+/g, ' ');
  if (digits.length < 7 || !clean || clean.length > 200) return;
  if (/\b(?:n[aã]o|nunca|jamais|sem)\s+(?:quero|desejo|aceito|autorizo|permito)/i.test(clean)) return;
  if (/\b(?:quero|desejo)\s+(?:saber|ver|conhecer|entender|perguntar|falar|comprar|receber\s+(?:mais|informa))/i.test(clean)) return;
  const optedOut = /^\s*(?:sair|cancelar|descadastrar|remover|parar|stop|unsubscribe)\s*$/i.test(clean);
  const optedIn = /^\s*(?:quero|sim|autorizo|aceito|permito|ok|confirmo)\s*$/i.test(clean);
  if (optedOut || optedIn) sendToBackground('CONSENT_UPDATE', { phone: digits, status: optedOut ? 'opted_out' : 'opted_in', source: 'keyword', message: clean.slice(0, 200) });
}

async function forwardStoreAiMessage(raw) {
  if (!raw || typeof raw !== 'object') return;
  // Só campos conhecidos e com tipo/tamanho validados seguem para o service worker.
  const str = (v, n) => String(v == null ? '' : v).slice(0, n);
  const payload = {
    messageId: str(raw.messageId, 280), chatId: str(raw.chatId, 120), chatRef: str(raw.chatRef, 60), chatName: str(raw.chatName, 180),
    chatType: raw.chatType === 'group' ? 'group' : 'private', isGroup: raw.chatType === 'group',
    phone: str(raw.phone, 15).replace(/\D/g, ''), senderName: str(raw.senderName, 120), senderPhone: str(raw.senderPhone, 15).replace(/\D/g, ''),
    isReply: raw.isReply === true, isMention: raw.isMention === true, replyContext: str(raw.replyContext, 700),
    text: str(raw.text, 4000).trim(), receivedAt: str(raw.receivedAt, 40), source: 'store-' + str(raw.source, 20).replace(/^store-/, ''),
  };
  if (!payload.messageId.startsWith('store_') || !payload.chatId || !payload.chatName || !payload.text) return;
  if (!payload.isGroup) aiTrackConsentFromStore(payload.phone, payload.text);
  const status = await aiBridgeStatus();
  if (!status?.active) return;
  const mode = status.chatMode || 'private_only';
  const allowed = payload.isGroup ? ['groups_only', 'both'].includes(mode) : ['private_only', 'both'].includes(mode);
  if (!allowed) return;
  await new Promise((resolve) => {
    try { chrome.runtime.sendMessage({ type: 'AI_INCOMING_MESSAGE', payload, timestamp: Date.now() }, () => { void chrome.runtime.lastError; resolve(); }); }
    catch { resolve(); }
  });
}

async function handleStartCampaign(payload) {
  if (!injectedReady) {
    try { await sendToInjectedWithResponse('PING', {}); }
    catch { return { success: false, error: 'Injected script nao pronto. Recarregue o WhatsApp Web.' }; }
  }
  try { sendToInjected(MSG.START_CAMPAIGN, payload); return { success: true }; }
  catch (error) { return { success: false, error: error.message }; }
}
async function handlePauseCampaign(payload) { sendToInjected(MSG.PAUSE_CAMPAIGN, payload); return { success: true }; }
async function handleResumeCampaign(payload) { sendToInjected(MSG.RESUME_CAMPAIGN, payload); return { success: true }; }
async function handleStopCampaign(payload) { sendToInjected(MSG.STOP_CAMPAIGN, payload); return { success: true }; }
async function handleExtractGroupMembers(payload) {
  try { const r = await sendToInjectedWithResponse(MSG.EXTRACT_GROUP_MEMBERS, payload); return { success: true, data: r }; }
  catch (error) { return { success: false, error: error.message }; }
}
async function handleExtractAllChats(payload) {
  try { const r = await sendToInjectedWithResponse(MSG.EXTRACT_ALL_CHATS, payload); return { success: true, data: r }; }
  catch (error) { return { success: false, error: error.message }; }
}
async function handleOpenChatByPhone(payload) {
  try {
    const result = await sendToInjectedWithResponse('OPEN_CHAT_BY_PHONE', payload || {}, 30000);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message || 'Não foi possível abrir a conversa.' };
  }
}
async function handleExtractChatMessages(payload) {
  try { const r = await sendToInjectedWithResponse(MSG.EXTRACT_CHAT_MESSAGES, payload); return { success: true, data: r }; }
  catch (error) { return { success: false, error: error.message }; }
}
async function handleSyncPrivateOpportunities(payload) {
  try {
    const r = await sendToInjectedWithResponse(MSG.SYNC_PRIVATE_OPPORTUNITIES, payload, 30000);
    if (r?.sync?.success === false) {
      const code = String(r.sync.error || 'SYNC_FAILED');
      const error = code === 'STORE_NOT_READY'
        ? 'O WhatsApp ainda está carregando as conversas. Aguarde alguns segundos e tente novamente.'
        : 'A sincronização das conversas privadas não pôde ser iniciada.';
      return { success: false, code, error, data: r };
    }
    return { success: true, data: r };
  } catch (error) { return { success: false, error: error.message }; }
}
async function handleGetCurrentChatInfo(payload) {
  try { const r = await sendToInjectedWithResponse(MSG.GET_CURRENT_CHAT_INFO, payload); return { success: true, data: r }; }
  catch (error) { return { success: false, error: error.message }; }
}
async function handleLabelsDiagnostic() {
  try { const r = await sendToInjectedWithResponse(MSG.LABELS_DIAGNOSTIC, {}, 45000); return { success: true, data: r.report }; }
  catch (error) { return { success: false, error: error.message }; }
}
async function handleLabelsList() {
  try { const r = await sendToInjectedWithResponse(MSG.LABELS_LIST, {}, 120000); return { success: true, data: r }; }
  catch (error) { return { success: false, error: error.message }; }
}
async function handleBlacklistSync(payload) {
  try { await sendToInjectedWithResponse('BLACKLIST_SYNC', payload || {}, 5000); return { success: true }; }
  catch (error) { return { success: false, error: error.message }; }
}
async function handleBlacklistApplyLabels(payload) {
  try { const r = await sendToInjectedWithResponse('BLACKLIST_APPLY_LABELS', payload || {}, 180000); return { success: true, data: r }; }
  catch (error) { return { success: false, error: error.message }; }
}
async function handleGetQr() {
  try { const r = await sendToInjectedWithResponse('GET_QR', {}, 3000); return { success: true, qr: r.qr || null }; }
  catch (error) { return { success: false, error: error.message }; }
}
async function handleCheckReady() {
  try { const r = await sendToInjectedWithResponse('PING', {}, 3000); return { success: true, ready: true, loggedIn: !!r?.loggedIn, page: r?.page || (r?.loggedIn ? 'chat' : 'loading'), pageInfo: r?.pageInfo || null, me: r?.me || '', store: r?.store || null, storeInternals: r?.storeInternals || null, injectedVersion: r?.injectedVersion || '', hidden: !!r?.hidden, embedded: EMBEDDED }; }
  catch { return { success: true, ready: false, injectedVersion: '' }; }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (window.__i9rcsContentV7Version !== CONTENT_VER) return false;
  const { type, payload } = message;
  (async () => {
    let response = { success: false, error: 'Tipo nao reconhecido' };
    try {
      switch (type) {
        case MSG.START_CAMPAIGN: response = await handleStartCampaign(payload); break;
        case MSG.PAUSE_CAMPAIGN: response = await handlePauseCampaign(payload); break;
        case MSG.RESUME_CAMPAIGN: response = await handleResumeCampaign(payload); break;
        case MSG.STOP_CAMPAIGN: response = await handleStopCampaign(payload); break;
        case MSG.EXTRACT_GROUP_MEMBERS: response = await handleExtractGroupMembers(payload); break;
        case MSG.EXTRACT_ALL_CHATS: response = await handleExtractAllChats(payload); break;
        case 'OPEN_CHAT_BY_PHONE': response = await handleOpenChatByPhone(payload); break;
        case MSG.EXTRACT_CHAT_MESSAGES: response = await handleExtractChatMessages(payload); break;
        case MSG.SYNC_PRIVATE_OPPORTUNITIES: response = await handleSyncPrivateOpportunities(payload); break;
        case MSG.GET_CURRENT_CHAT_INFO: response = await handleGetCurrentChatInfo(payload); break;
        case 'AI_SEND_REPLY':
        case 'AI_SEND_TO_PHONE': {
          const expectedSender = chrome.runtime.getURL('background/service-worker.js');
          if (sender?.url !== expectedSender) throw new Error('Comando interno de IA recusado: origem não autorizada.');
          response = type === 'AI_SEND_REPLY'
            ? await sendToInjectedWithResponse('AI_SEND_REPLY', payload, 20000).then((r) => ({ success: true, data: r }))
            : await sendToInjectedWithResponse('AI_SEND_TO_PHONE', payload, 30000).then((r) => ({ success: true, data: r }));
          break;
        }
        case 'FOLLOWUP_SEND_TO_PHONE': {
          const expectedSender = chrome.runtime.getURL('background/service-worker.js');
          if (sender?.url !== expectedSender) throw new Error('Comando interno de follow-up recusado: origem não autorizada.');
          response = await sendToInjectedWithResponse('FOLLOWUP_SEND_TO_PHONE', payload, 30000).then((r) => ({ success: true, data: r }));
          break;
        }
        case 'AI_PROCESSING_STATE': {
          const expectedSender = chrome.runtime.getURL('background/service-worker.js');
          if (sender?.url !== expectedSender) throw new Error('Estado interno da IA recusado: origem não autorizada.');
          response = await sendToInjectedWithResponse('AI_PROCESSING_STATE', payload, 5000).then((r) => ({ success: true, data: r }));
          break;
        }
        case MSG.CHECK_READY: response = await handleCheckReady(); break;
        case MSG.GET_QR: response = await handleGetQr(); break;
        case MSG.LABELS_DIAGNOSTIC: response = await handleLabelsDiagnostic(); break;
        case MSG.LABELS_LIST: response = await handleLabelsList(); break;
        case 'BLACKLIST_SYNC': response = await handleBlacklistSync(payload); break;
        case 'BLACKLIST_APPLY_LABELS': response = await handleBlacklistApplyLabels(payload); break;
        default: response = { success: false, error: `Tipo desconhecido: ${type}` };
      }
    } catch (error) { response = { success: false, error: error.message }; }
    sendResponse(response);
  })();
  return true;
});

// Observador isolado para IA. Ele envia eventos diretamente ao service worker, sem depender
// da ponte window.postMessage do mundo MAIN, que uma página poderia tentar forjar.
function startAiIncomingObserver() {
  if (!checkWhatsAppLoaded() || window.__i9AiObserverStarted) return;
  window.__i9AiObserverStarted = true;
  const seen = new Set();
  let activeChat = '';
  const chatLabel = () => {
    const el = document.querySelector('[data-testid="conversation-header-name"], #main header [data-testid="conversation-info-header-chat-title"], #main header span[title], #main header [dir="auto"]');
    return String(el?.getAttribute('title') || el?.textContent || '').trim().slice(0, 180);
  };
  const identity = (el, text) => {
    const raw = String(el?.getAttribute('data-id') || el?.getAttribute('data-pre-plain-text') || '') + '|' + String(text || '').slice(0, 120);
    let hash = 2166136261; for (let i = 0; i < raw.length; i++) { hash ^= raw.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return 'msg_' + (hash >>> 0).toString(16);
  };
  const parseMessageTimestamp = (prePlain) => {
    const match = String(prePlain || '').match(/\[(\d{1,2}):(\d{2}),\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\]/);
    if (!match) return new Date().toISOString();
    const [, hh, mm, dd, mo, yyyy] = match;
    const date = new Date(Number(yyyy), Number(mo) - 1, Number(dd), Number(hh), Number(mm), 0, 0);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  };
  const prime = () => {
    activeChat = chatLabel();
    for (const el of document.querySelectorAll('#main .message-in')) {
      const text = String(el.querySelector('.selectable-text, .copyable-text')?.textContent || '').trim();
      if (text) seen.add(identity(el, text));
    }
    while (seen.size > 500) seen.delete(seen.values().next().value);
  };
  const emit = (el, options = {}) => {
    if (!el?.matches?.('.message-in')) return false;
    const text = String(options.textOverride || el.querySelector('.selectable-text, .copyable-text')?.textContent || '').trim();
    if (!text || text.length > 6000) return false;
    const messageId = identity(el, text); if (seen.has(messageId) && options.force !== true) return false;
    seen.add(messageId); while (seen.size > 500) seen.delete(seen.values().next().value);
    const name = chatLabel(); if (!name) return;
    const header = document.querySelector('#main header');
    const rawDataId = String(el?.getAttribute('data-id') || '');
    const jids = [...rawDataId.matchAll(/([0-9A-Za-z.+-]+@(?:c\.us|s\.whatsapp\.net|g\.us))/gi)].map((m) => m[1]);
    const groupJid = jids.find((value) => /@g\.us$/i.test(value)) || '';
    const privateJid = jids.find((value) => /@(?:c\.us|s\.whatsapp\.net)$/i.test(value)) || '';
    const isGroup = !!groupJid || /participantes|participante|membros/i.test(String(header?.textContent || ''));
    const jid = groupJid || privateJid || '';
    const chatRef = identity({ getAttribute: () => jid || name }, 'chat-ref');
    const prePlain = String(el.getAttribute('data-pre-plain-text') || el.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || '');
    const senderMatch = prePlain.match(/\]\s*([^:]{1,120}):\s*$/);
    const senderName = String(senderMatch?.[1] || el.querySelector('[data-testid*="author"], [data-testid*="sender"], .copyable-text[aria-label]')?.getAttribute('aria-label') || '').trim().slice(0, 120);
    const senderJid = isGroup ? privateJid : '';
    const headerPhone = name.match(/\+?\d[\d\s().-]{8,}\d/);
    const privatePhone = !isGroup && privateJid ? privateJid.split('@')[0].replace(/\D/g, '').slice(0, 15) : '';
    const senderPhone = senderJid ? senderJid.split('@')[0].replace(/\D/g, '').slice(0, 15) : '';
    const quoteEl = el.querySelector('[data-testid*="quoted"], [data-testid*="reply"], .quoted-message, .quoted-message-container, .quoted-mention, [aria-label*="mensagem citada" i], [aria-label*="quoted message" i]');
    const isReply = !!quoteEl;
    const replyContext = String(quoteEl?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 700);
    const isMention = !!el.querySelector('[data-mention-jid], [data-testid*="mention"], [aria-label*="mencion" i], span[title^="@"]') || /@[^\s@]{2,}/.test(text);
    const aiPayload = {
      messageId, chatId: jid, chatRef, chatName: name, chatType: isGroup ? 'group' : 'private', isGroup,
      phone: !isGroup && headerPhone ? headerPhone[0].replace(/\D/g, '').slice(0, 15) : privatePhone,
      senderName, senderPhone, isReply, isMention, replyContext,
      text: text.slice(0, 4000), receivedAt: parseMessageTimestamp(prePlain), source: options.source || 'isolated-dom-observer'
    };
    // Follow-up: somente metadados de atividade são enviados ao service worker.
    // O texto da conversa não é copiado para o histórico de follow-ups.
    if (!isGroup && aiPayload.phone && aiPayload.phone.replace(/\D/g, '').length >= 10) {
      sendToBackground('FOLLOWUP_INBOUND_ACTIVITY', {
        phone: aiPayload.phone,
        chatId: String(aiPayload.chatId || '').slice(0, 120),
        messageId: aiPayload.messageId,
        receivedAt: aiPayload.receivedAt,
      });
    }
    let aiProcessingPromise = null;
    if (aiStoreHealthy()) {
      aiProcessingPromise = Promise.resolve({ success: true, aiStatus: 'handled-by-store' });
    } else if (options.waitForProcessing === true) {
      aiProcessingPromise = new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({ type: 'AI_INCOMING_MESSAGE', payload: aiPayload, timestamp: Date.now() }, (response) => {
            const error = chrome.runtime.lastError;
            resolve(error ? { success: false, error: error.message } : (response || { success: false, error: 'Sem confirmação do processamento da IA.' }));
          });
        } catch (error) { resolve({ success: false, error: error?.message || String(error) }); }
      });
    } else sendToBackground('AI_INCOMING_MESSAGE', aiPayload);
    // v1.6.0 - Consent tracking: detecta palavras-chave QUERO/SAIR em mensagens recebidas
    // e envia CONSENT_UPDATE ao service worker para persistência. Evita processar mensagens
    // do próprio usuário (message-out) e duplicatas (mesmo messageId).
    const consentPhoneSource = !isGroup ? (headerPhone || (privatePhone ? [privatePhone] : [])) : [];
    const phoneClean = consentPhoneSource.length ? String(consentPhoneSource[0]).replace(/\D/g, '').slice(0, 15) : '';
    if (phoneClean && phoneClean.length >= 7) {
      const cleanedText = text.trim().replace(/\s+/g, ' ');
      if (cleanedText && cleanedText.length <= 200) {
        const negation = /\b(?:n[aã]o|nunca|jamais|sem)\s+(?:quero|desejo|aceito|autorizo|permito)/i;
        const falsePositive = /\b(?:quero|desejo)\s+(?:saber|ver|conhecer|entender|perguntar|falar|comprar|receber\s+(?:mais|informa))/i;
        if (!negation.test(cleanedText) && !falsePositive.test(cleanedText)) {
          const optedOut = /^\s*(?:sair|cancelar|descadastrar|remover|parar|stop|unsubscribe)\s*$/i.test(cleanedText);
          const optedIn = /^\s*(?:quero|sim|autorizo|aceito|permito|ok|confirmo)\s*$/i.test(cleanedText);
          if (optedOut || optedIn) {
            sendToBackground('CONSENT_UPDATE', { phone: phoneClean, status: optedOut ? 'opted_out' : 'opted_in', source: 'keyword', message: cleanedText.slice(0, 200) });
          }
        }
      }
    }
    return options.waitForProcessing === true ? aiProcessingPromise : true;
  };
  prime();
  const root = document.body || document.documentElement;
  const observer = new MutationObserver((mutations) => {
    const label = chatLabel();
    if (label && label !== activeChat) { prime(); return; }
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') { const bubble = mutation.target?.parentElement?.closest?.('.message-in'); if (bubble) emit(bubble); continue; }
      for (const node of mutation.addedNodes || []) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches?.('.message-in')) emit(node);
        for (const child of node.querySelectorAll?.('.message-in') || []) emit(child);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });

  // Observador da lista de conversas. O observador acima só vê bolhas dentro de
  // #main; quando o usuário está na lista, mensagens recebidas em outros chats
  // atualizam a prévia e o contador de não lidas em #pane-side. Detectamos apenas
  // mudanças posteriores ao baseline, consultamos o estado da IA e abrimos o chat
  // privado ou grupo elegível para extrair mensagens novas em ordem antes de responder.
  const inboxSnapshots = new Map();
  const inboxQueue = [];
  const inboxQueuedKeys = new Set();
  let inboxBaselineReady = false;
  let inboxScanTimer = 0;
  let inboxScanRunning = false;
  let inboxScanAgain = false;
  let inboxQueueRunning = false;
  let inboxStatusCache = null;
  let inboxStatusCacheAt = 0;

  const normalizeInboxText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const parseInboxTime = (value) => {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return 0;
    const now = new Date(); const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(match[1]), Number(match[2]), 0, 0);
    if (date.getTime() > now.getTime() + 2 * 60 * 60 * 1000) date.setDate(date.getDate() - 1);
    return date.getTime();
  };
  const isTimeOrStatusLine = (line) => /^(?:\d{1,2}:\d{2}|hoje|ontem|today|yesterday|online|digitando(?:\.\.\.)?|typing(?:\.\.\.)?|agora|now)$/i.test(String(line || '').trim());
  const isUnreadLine = (line) => /(?:mensagens?\s+nao\s+lidas?|mensagens?\s+nao\s+vista|unread\s+messages?)/i.test(String(line || ''));
  const isOutgoingPreview = (preview) => /^(?:voce|you)\b/i.test(normalizeInboxText(preview));

  function getInboxRows() {
    const pane = document.querySelector('#pane-side');
    if (!pane) return [];
    let rows = Array.from(pane.querySelectorAll('[data-testid="cell-frame-container"]'));
    if (!rows.length) rows = Array.from(pane.querySelectorAll('[role="listitem"]'));
    return rows.filter((row) => row?.isConnected && row.getClientRects?.().length && !row.parentElement?.closest?.('[data-testid="cell-frame-container"]'));
  }

  function parseInboxRow(row) {
    const nameEl = row.querySelector('[data-testid="cell-frame-title"], span[title], [title]');
    const name = String(nameEl?.getAttribute('title') || nameEl?.textContent || row.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    if (!name) return null;
    const lines = String(row.innerText || row.textContent || '').split(/\n|\r/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const normalizedName = normalizeInboxText(name);
    const unreadMetadata = Array.from(row.querySelectorAll('[aria-label], [title], [data-testid]')).filter((el) => {
      const meta = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('data-testid') || ''}`;
      return /unread|nao lida|não lida|nao vista|não vista/i.test(meta);
    });
    let unreadCount = 0;
    for (const el of unreadMetadata) {
      const meta = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.textContent || ''}`;
      const match = meta.match(/(\d{1,4}\+?)/);
      unreadCount = Math.max(unreadCount, match ? (match[1].includes('+') ? 999 : Number(match[1])) : 1);
    }
    if (!unreadCount) {
      const countLine = lines.slice(-3).find((line) => /^\d{1,3}\+?$/.test(line));
      if (countLine) unreadCount = countLine.includes('+') ? 999 : Number(countLine);
    }
    const previewLines = lines.filter((line) => {
      const norm = normalizeInboxText(line);
      return norm && norm !== normalizedName && !isTimeOrStatusLine(line) && !isUnreadLine(line) && !/^\d{1,3}\+?$/.test(line) && !/^\d{1,2}:\d{2}\s/.test(line);
    });
    const preview = String(previewLines[previewLines.length - 1] || '').slice(0, 500);
    const timeLine = lines.find((line) => /^\d{1,2}:\d{2}$/.test(line)) || '';
    const groupSignal = row.querySelector('[data-testid*="group" i], [data-icon*="group" i], [aria-label*="grupo" i], [aria-label*="group" i], [data-testid="default-group"], [data-icon="default-group"]');
    const groupWords = /\b(?:grupo|group|participantes|participants|membros|members)\b/i.test(String(row.getAttribute('aria-label') || '') + ' ' + lines.join(' '));
    const isGroup = !!groupSignal || groupWords || /:/.test(preview) && /\b(?:grupo|group)\b/i.test(String(row.innerText || ''));
    const key = String(row.getAttribute('data-id') || name.toLocaleLowerCase()).slice(0, 240);
    return { row, key, name, preview, unreadCount, isGroup, receivedAt: parseInboxTime(timeLine), outgoing: isOutgoingPreview(preview) };
  }

  function hasOpenInboxConversation() {
    const header = chatLabel();
    const composer = Array.from(document.querySelectorAll('#main footer [contenteditable="true"], #main footer [role="textbox"]'))
      .find((el) => el.getClientRects?.().length);
    return !!(header && composer);
  }

  function inboxStatus() {
    if (Date.now() - inboxStatusCacheAt < 4000) return Promise.resolve(inboxStatusCache);
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'AI_INBOX_CHECK' }, (response) => {
          const err = chrome.runtime.lastError;
          inboxStatusCache = err || !response?.success ? null : response;
          inboxStatusCacheAt = Date.now();
          resolve(inboxStatusCache);
        });
      } catch {
        inboxStatusCache = null;
        inboxStatusCacheAt = Date.now();
        resolve(null);
      }
    });
  }

  function clickInboxRow(row) {
    const rect = row.getBoundingClientRect();
    const options = { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    row.dispatchEvent(new MouseEvent('mousedown', options));
    row.dispatchEvent(new MouseEvent('mouseup', options));
    row.dispatchEvent(new MouseEvent('click', options));
  }

  function findInboxRow(candidate) {
    const rows = getInboxRows().map(parseInboxRow).filter(Boolean);
    return rows.find((item) => item.key === candidate.key)?.row
      || rows.find((item) => normalizeInboxText(item.name) === normalizeInboxText(candidate.name))?.row
      || null;
  }

  async function waitForInboxChat(name, timeoutMs = 9000) {
    const target = normalizeInboxText(name);
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const current = normalizeInboxText(chatLabel());
      if (hasOpenInboxConversation() && current && (current === target || (target.length >= 5 && current.startsWith(target)))) return true;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  }

  function queueInboxCandidate(candidate) {
    if (inboxQueuedKeys.has(candidate.key)) {
      const existing = inboxQueue.find((item) => item.key === candidate.key);
      if (existing) {
        existing.newMessageCount = Math.min(20, Math.max(1, Number(existing.newMessageCount) || 1) + Math.max(1, Number(candidate.newMessageCount) || 1));
        existing.preview = candidate.preview || existing.preview;
        existing.unreadCount = candidate.unreadCount;
        existing.detectedAt = Math.max(Number(existing.detectedAt) || 0, Number(candidate.detectedAt) || Date.now());
        existing.receivedAt = Math.min(Number(existing.receivedAt) || Infinity, Number(candidate.receivedAt) || Infinity);
        if (!Number.isFinite(existing.receivedAt)) existing.receivedAt = 0;
      }
      return;
    }
    inboxQueue.push({ ...candidate });
    inboxQueuedKeys.add(candidate.key);
    while (inboxQueue.length > 40) {
      const dropped = inboxQueue.shift();
      if (dropped) inboxQueuedKeys.delete(dropped.key);
    }
    processInboxQueue().catch(() => {});
  }

  function getComposerDraft() {
    const composer = Array.from(document.querySelectorAll('#main footer [contenteditable="true"], #main footer [role="textbox"]')).find((el) => el.getClientRects?.().length);
    return String(composer?.innerText || composer?.textContent || '').trim();
  }

  async function waitForIncomingMessages(count = 1, timeoutMs = 5000, targetPreview = '', isGroup = false) {
    const started = Date.now();
    const wanted = Math.max(1, Math.min(20, Number(count) || 1));
    const target = normalizeInboxText(isGroup ? String(targetPreview || '').replace(/^[^:]{1,100}:\s*/, '') : String(targetPreview || ''));
    while (Date.now() - started < timeoutMs) {
      const incoming = Array.from(document.querySelectorAll('#main .message-in')).filter((el) => String(el.querySelector('.selectable-text, .copyable-text')?.textContent || '').trim());
      if (incoming.length) {
        let targetIndex = -1;
        if (target.length >= 4) {
          for (let i = incoming.length - 1; i >= 0; i--) {
            const body = normalizeInboxText(incoming[i].querySelector('.selectable-text, .copyable-text')?.textContent || '');
            if (body && (body.includes(target) || target.includes(body) || (isGroup && body.split(' ').some((word) => word.length > 3 && target.includes(word))))) { targetIndex = i; break; }
          }
        }
        if (targetIndex >= 0) return incoming.slice(Math.max(0, targetIndex - wanted + 1), targetIndex + 1);
        if (target.length < 4) return incoming.slice(-wanted);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return [];
  }

  async function processInboxQueue() {
    if (inboxQueueRunning) return;
    inboxQueueRunning = true;
    const originalChatName = hasOpenInboxConversation() ? chatLabel() : '';
    try {
      while (inboxQueue.length) {
        inboxQueue.sort((a, b) => { const atA = Number(a.receivedAt) || 0; const atB = Number(b.receivedAt) || 0; if (atA && atB && atA !== atB) return atA - atB; return (Number(b.detectedAt) || 0) - (Number(a.detectedAt) || 0); });
        const candidate = inboxQueue[0];
        const activeName = hasOpenInboxConversation() ? chatLabel() : '';
        if (activeName && normalizeInboxText(activeName) !== normalizeInboxText(candidate.name) && getComposerDraft()) {
          console.info('[i9Hub AI] Há um rascunho no chat atual; a fila aguardará para não interromper a digitação.');
          break;
        }
        inboxQueue.shift(); inboxQueuedKeys.delete(candidate.key);
        if (normalizeInboxText(activeName) !== normalizeInboxText(candidate.name)) {
          const row = findInboxRow(candidate);
          if (!row) continue;
          clickInboxRow(row);
          const opened = await waitForInboxChat(candidate.name);
          if (!opened) {
            console.warn('[i9Hub AI] Não foi possível abrir a conversa detectada na lista.');
            continue;
          }
        }
        const messages = await waitForIncomingMessages(candidate.newMessageCount || 1, 5000, candidate.preview, candidate.isGroup === true);
        if (messages.length) {
          const latest = messages[messages.length - 1];
          const latestText = normalizeInboxText(latest.querySelector('.selectable-text, .copyable-text')?.textContent || '');
          const preview = normalizeInboxText(candidate.isGroup ? String(candidate.preview || '').replace(/^[^:]{1,100}:\s*/, '') : String(candidate.preview || ''));
          const previewMatches = !preview || preview.length < 4 || !latestText || preview.includes(latestText) || latestText.includes(preview) || (candidate.isGroup && latestText.split(' ').some((word) => preview.includes(word)));
          if (previewMatches) {
            for (const messageEl of messages) {
              const result = await emit(messageEl, { force: true, source: 'inbox-list-watcher', waitForProcessing: true });
              if (result?.success === false) console.warn('[i9Hub AI] O processamento desta mensagem não foi confirmado:', result.error || result.aiStatus || 'erro');
            }
            console.info(`[i9Hub AI] ${messages.length} mensagem(ns) nova(s) de ${candidate.isGroup ? 'grupo' : 'conversa privada'} encaminhada(s) para processamento em ordem.`);
          } else {
            console.warn('[i9Hub AI] A prévia da lista não corresponde às mensagens carregadas; envio automático cancelado por segurança.');
          }
        } else {
          console.warn('[i9Hub AI] A conversa foi aberta, mas não foi possível ler mensagens de texto recebidas.');
        }
      }
    } finally {
      // Se o observador abriu chats para processar mensagens, retorna ao chat que o usuário
      // estava usando, desde que não haja rascunho no compositor.
      if (originalChatName && !getComposerDraft() && normalizeInboxText(chatLabel()) !== normalizeInboxText(originalChatName)) {
        const row = findInboxRow({ name: originalChatName, key: originalChatName.toLocaleLowerCase() });
        if (row) { clickInboxRow(row); await waitForInboxChat(originalChatName, 5000); }
      }
      inboxQueueRunning = false;
    }
  }

  async function scanInboxRows() {
    if (inboxScanRunning) { inboxScanAgain = true; return; }
    inboxScanRunning = true;
    try {
      do {
        inboxScanAgain = false;
        const rows = getInboxRows();
        if (!rows.length) continue;
        for (const row of rows) {
          const current = parseInboxRow(row);
          if (!current) continue;
          const previous = inboxSnapshots.get(current.key);
          inboxSnapshots.set(current.key, { preview: current.preview, unreadCount: current.unreadCount, isGroup: current.isGroup });
          if (!inboxBaselineReady || !previous) continue;
          if (aiStoreHealthy()) continue; // v1.0.9: o monitor do Store já cobre esta conversa
          if (current.outgoing || !current.preview) continue;
          const previewChanged = current.preview !== previous.preview;
          const unreadIncreased = current.unreadCount > previous.unreadCount;
          if (!previewChanged && !unreadIncreased) continue;
          const status = await inboxStatus();
          if (!status?.active) continue;
          const mode = status.chatMode || 'private_only';
          const allowedType = current.isGroup ? ['groups_only', 'both'].includes(mode) : ['private_only', 'both'].includes(mode);
          if (!allowedType) continue;
          const unreadDelta = unreadIncreased ? current.unreadCount - previous.unreadCount : 1;
          queueInboxCandidate({ ...current, newMessageCount: Math.max(1, Math.min(20, unreadDelta)), detectedAt: Date.now() });
        }
        inboxBaselineReady = true;
        await processInboxQueue();
      } while (inboxScanAgain);
    } finally {
      inboxScanRunning = false;
    }
  }

  // O body é observado porque o painel lateral da lista pode existir antes de
  // #main ou ser recriado pelo WhatsApp durante a navegação.
  const inboxObserver = new MutationObserver(() => {
    if (inboxScanTimer) clearTimeout(inboxScanTimer);
    inboxScanTimer = setTimeout(() => { scanInboxRows().catch(() => {}); }, 350);
  });
  if (document.body) inboxObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  scanInboxRows().catch(() => {});
}

function checkWhatsAppLoaded() { return document.URL.startsWith('https://web.whatsapp.com/'); }

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && checkWhatsAppLoaded()) {
    sendToBackground('TAB_VISIBLE', { url: window.location.href });
  }
});

if (checkWhatsAppLoaded()) {
  startAiIncomingObserver();
  logToBackground('info', 'Content script carregado no WhatsApp Web', { mode: EMBEDDED ? 'embutido' : 'aba' });
  setTimeout(() => { if (!injectedReady) sendToInjected('PING', {}); }, 1000);
} else {
  logToBackground('warn', 'Content script carregado em pagina nao-WhatsApp');
}

console.log('[i9Hub] Content script (bridge) inicializado');
})();
