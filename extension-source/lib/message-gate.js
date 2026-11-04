/**
 * Autorização de mensagens `chrome.runtime.sendMessage` (v5.3.3-fix1).
 *
 * Regra central: o remetente só é tratado como CONTENT SCRIPT quando a origem
 * declarada é uma página web. Páginas da própria extensão (side panel, popup,
 * options e o painel aberto em aba com o WhatsApp embutido) enviam mensagens com
 * `sender.tab` preenchido, mas NÃO são content scripts — tratá-las como tal
 * bloqueava todos os comandos e a porta fechava sem resposta
 * ("The message port closed before a response was received.").
 *
 * Este módulo é puro (não usa APIs do Chrome) para poder ser testado no Node.
 */

/** Eventos que um content script pode enviar (aceitos e apenas registrados). */
export const CONTENT_PASSIVE_TYPES = new Set([
  'CAMPAIGN_STARTED', 'CAMPAIGN_PAUSED', 'CAMPAIGN_RESUMED', 'CAMPAIGN_STOPPED', 'CAMPAIGN_COMPLETED',
  'CONTACT_PROCESSING', 'CAMPAIGN_WAITING_VISIBLE', 'MESSAGE_SENT', 'MESSAGE_FAILED', 'MESSAGE_SKIPPED',
  'RATE_LIMIT_DETECTED', 'WHATSAPP_OFFLINE', 'CAMPAIGN_FINISHED', 'CAMPAIGN_PROGRESS',
  'PRIVATE_CHATS_DETECTED', 'PRIVATE_CHATS_SYNC_PROGRESS', 'PRIVATE_CHATS_SYNC_FAILED', 'GROUP_MEMBERS_EXTRACTED', 'CHATS_EXTRACTED', 'CURRENT_CHAT_INFO', 'AI_INCOMING_MESSAGE', 'AI_INBOX_CHECK', 'AI_STORE_STATUS',
  'READY', 'ERROR', 'TAB_VISIBLE', 'FOLLOWUP_INBOUND_ACTIVITY', 'LOG',
]);

/** Eventos passivos que só podem vir do WhatsApp Web. */
export const WA_CONTENT_TYPES = new Set([
  'CAMPAIGN_STARTED', 'CAMPAIGN_PAUSED', 'CAMPAIGN_RESUMED', 'CAMPAIGN_STOPPED', 'CAMPAIGN_COMPLETED',
  'CONTACT_PROCESSING', 'CAMPAIGN_WAITING_VISIBLE', 'MESSAGE_SENT', 'MESSAGE_FAILED', 'MESSAGE_SKIPPED',
  'RATE_LIMIT_DETECTED', 'WHATSAPP_OFFLINE', 'CAMPAIGN_FINISHED', 'CAMPAIGN_PROGRESS',
  'PRIVATE_CHATS_DETECTED', 'PRIVATE_CHATS_SYNC_PROGRESS', 'PRIVATE_CHATS_SYNC_FAILED', 'GROUP_MEMBERS_EXTRACTED', 'CHATS_EXTRACTED', 'CURRENT_CHAT_INFO', 'AI_INCOMING_MESSAGE', 'AI_INBOX_CHECK', 'AI_STORE_STATUS',
  'READY', 'ERROR', 'TAB_VISIBLE', 'FOLLOWUP_INBOUND_ACTIVITY', 'BLACKLIST_ADD', 'CONSENT_UPDATE', 'LOG',
]);

const WHATSAPP_ORIGIN = 'https://web.whatsapp.com';
const MAPS_ORIGINS = new Set(['https://www.google.com', 'https://maps.google.com']);

export function originOfUrl(url) {
  try { return new URL(String(url || '')).origin; } catch { return ''; }
}

export function isMapsOrigin(origin) { return MAPS_ORIGINS.has(origin); }
export function isWhatsAppOrigin(origin) { return origin === WHATSAPP_ORIGIN; }

/** `true` somente para páginas da própria extensão (painel, popup, options, painel em aba). */
export function isExtensionPageUrl(url, runtimeId) {
  if (!runtimeId) return false;
  return String(url || '').startsWith(`chrome-extension://${runtimeId}/`);
}

/**
 * Decide o que fazer com uma mensagem recebida.
 *
 * @returns {{action: 'accept'|'acknowledge'|'reject', reason: string}}
 *  - accept:      remetente confiável (página da extensão) -> despachar o handler
 *  - acknowledge: evento passivo de content script -> registrar e confirmar
 *  - reject:      recusar com resposta explícita (nunca fechar a porta em silêncio)
 */
export function decideMessage({ senderId, runtimeId, senderUrl, type, source } = {}) {
  if (!senderId || !runtimeId || senderId !== runtimeId) {
    return { action: 'reject', reason: 'UNTRUSTED_SENDER' };
  }

  // Página da própria extensão: confiável mesmo quando aberta em uma aba.
  if (isExtensionPageUrl(senderUrl, runtimeId)) {
    return { action: 'accept', reason: 'EXTENSION_PAGE' };
  }

  const origin = originOfUrl(senderUrl);
  const t = String(type || '');

  if (origin === '') return { action: 'reject', reason: 'UNKNOWN_SENDER_CONTEXT' };

  if (source === 'maps-extractor') {
    return isMapsOrigin(origin)
      ? { action: 'acknowledge', reason: 'MAPS_EXTRACTOR_EVENT' }
      : { action: 'reject', reason: 'WRONG_ORIGIN' };
  }

  // "Black list" pela conversa do WhatsApp é a única ação de escrita aceita de
  // content script (com limite de frequência aplicado no service worker).
  if (t === 'BLACKLIST_ADD') {
    return isWhatsAppOrigin(origin)
      ? { action: 'accept', reason: 'WA_BLACKLIST_ADD' }
      : { action: 'reject', reason: 'WRONG_ORIGIN' };
  }

  // v1.6.0 - CONSENT_UPDATE: opt-in/opt-out detectado por palavra-chave ou link
  // no WhatsApp Web. Aceito apenas da origem oficial para evitar injeção externa.
  if (t === 'CONSENT_UPDATE') {
    return isWhatsAppOrigin(origin)
      ? { action: 'accept', reason: 'WA_CONSENT_UPDATE' }
      : { action: 'reject', reason: 'WRONG_ORIGIN' };
  }

  if (t === 'LOG') {
    return isWhatsAppOrigin(origin) || isMapsOrigin(origin)
      ? { action: 'acknowledge', reason: 'CONTENT_LOG' }
      : { action: 'reject', reason: 'WRONG_ORIGIN' };
  }

  if (!CONTENT_PASSIVE_TYPES.has(t)) {
    return { action: 'reject', reason: 'NOT_ALLOWED_FROM_CONTENT' };
  }
  if (WA_CONTENT_TYPES.has(t) && !isWhatsAppOrigin(origin)) {
    return { action: 'reject', reason: 'WRONG_ORIGIN' };
  }
  if (t === 'MAPS_CELL_DONE' && !isMapsOrigin(origin)) {
    return { action: 'reject', reason: 'WRONG_ORIGIN' };
  }

  return { action: 'acknowledge', reason: 'CONTENT_EVENT' };
}

/** Mensagem de erro compreensível para a interface quando algo é recusado. */
export function rejectMessage(reason) {
  const messages = {
    UNTRUSTED_SENDER: 'A extensão recusou uma mensagem de origem desconhecida.',
    UNKNOWN_SENDER_CONTEXT: 'A extensão recusou uma mensagem sem origem identificável.',
    WRONG_ORIGIN: 'A extensão recusou uma mensagem vinda de uma página inesperada.',
    NOT_ALLOWED_FROM_CONTENT: 'Esta ação precisa ser feita pela interface da extensão.',
  };
  return messages[reason] || 'A extensão recusou a mensagem.';
}
