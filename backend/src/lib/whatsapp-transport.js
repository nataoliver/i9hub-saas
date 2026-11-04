/**
 * i9Hub — Camada de Transporte Abstrata para WhatsApp Web
 * Isola toda interação com o DOM do WhatsApp Web atrás de uma API assíncrona.
 * O restante da extensão (classificador, CRM, IA) NÃO deve acessar o DOM diretamente.
 *
 * Arquitetura:
 *   lib/whatsapp-transport.js (este módulo, roda no content script ou sidepanel)
 *     ↕ chrome.runtime.sendMessage / postMessage
 *   content/content.js (bridge)
 *     ↕ window.postMessage
 *   content/injected.js (acesso real ao DOM do WhatsApp Web)
 */

const BRIDGE_SOURCE = 'i9rcs7-content';
const INJECTED_SOURCE = 'i9rcs7-injected';
const DEFAULT_TIMEOUT_MS = 30000;

// Tipos de mensagem suportados pela camada de transporte
export const TRANSPORT_ACTIONS = Object.freeze({
  GET_CURRENT_CHAT_INFO: 'GET_CURRENT_CHAT_INFO',
  EXTRACT_CHAT_MESSAGES: 'EXTRACT_CHAT_MESSAGES',
  SEND_MESSAGE: 'SEND_MESSAGE_TO_CHAT',
  CHECK_READY: 'CHECK_READY',
  GET_ALL_CHATS: 'EXTRACT_ALL_CHATS',
});

let __pendingRequests = new Map();
let __requestCounter = 0;
let __listenerAttached = false;

function generateTransportId() {
  return ++__requestCounter;
}

/**
 * Garante que o listener de respostas do injected.js está ativo.
 * Deve ser chamado uma vez na inicialização do content script ou sidepanel.
 */
export function initTransportListener() {
  if (__listenerAttached) return;
  __listenerAttached = true;

  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== INJECTED_SOURCE) return;
    const { type, payload, requestId } = event.data;
    if (!requestId || !__pendingRequests.has(requestId)) return;

    const pending = __pendingRequests.get(requestId);
    __pendingRequests.delete(requestId);
    clearTimeout(pending.timer);

    if (type === 'ERROR') {
      pending.reject(new Error(payload?.message || 'Erro desconhecido no transporte'));
    } else {
      pending.resolve(payload);
    }
  });
}

/**
 * Envia um comando abstrato ao WhatsApp Web e aguarda resposta.
 * @param {string} action - Uma das chaves de TRANSPORT_ACTIONS
 * @param {Object} [payload={}]
 * @param {number} [timeoutMs=DEFAULT_TIMEOUT_MS]
 * @returns {Promise<any>}
 */
export async function sendToWhatsApp(action, payload = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!TRANSPORT_ACTIONS[action] && !Object.values(TRANSPORT_ACTIONS).includes(action)) {
    throw new Error(`Ação de transporte desconhecida: ${action}`);
  }

  return new Promise((resolve, reject) => {
    const id = generateTransportId();
    const timer = setTimeout(() => {
      __pendingRequests.delete(id);
      reject(new Error(`Timeout (${timeoutMs}ms): ${action}`));
    }, timeoutMs);

    __pendingRequests.set(id, { resolve, reject, timer });

    window.postMessage(
      { source: BRIDGE_SOURCE, type: action, payload, requestId: id },
      '*'
    );
  });
}

/**
 * Verifica se o WhatsApp Web está pronto e conectado.
 * @returns {Promise<boolean>}
 */
export async function isWhatsAppReady() {
  try {
    const result = await sendToWhatsApp(TRANSPORT_ACTIONS.CHECK_READY, {}, 5000);
    return Boolean(result?.ready);
  } catch {
    return false;
  }
}

/**
 * Obtém informações do chat atualmente aberto.
 * @returns {Promise<{id: string, name: string, phone: string, isGroup: boolean}|null>}
 */
export async function getCurrentChatInfo() {
  try {
    return await sendToWhatsApp(TRANSPORT_ACTIONS.GET_CURRENT_CHAT_INFO);
  } catch {
    return null;
  }
}

/**
 * Extrai as últimas N mensagens do chat atual.
 * @param {number} [limit=20]
 * @returns {Promise<Array<{id: string, from: string, body: string, timestamp: number, isFromMe: boolean}>>}
 */
export async function getRecentMessages(limit = 20) {
  try {
    const result = await sendToWhatsApp(
      TRANSPORT_ACTIONS.EXTRACT_CHAT_MESSAGES,
      { limit: Math.max(1, Math.min(limit, 100)) },
      15000
    );
    return Array.isArray(result?.messages) ? result.messages : [];
  } catch {
    return [];
  }
}

/**
 * Envia uma mensagem para o chat atualmente aberto.
 * @param {string} text
 * @returns {Promise<{success: boolean, messageId?: string}>}
 */
export async function sendMessage(text) {
  const sanitized = String(text || '').trim();
  if (!sanitized) return { success: false, error: 'Texto vazio' };

  try {
    const result = await sendToWhatsApp(
      TRANSPORT_ACTIONS.SEND_MESSAGE,
      { text: sanitized.slice(0, 65000) },
      30000
    );
    return { success: Boolean(result?.success), messageId: result?.messageId || null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Lista todos os chats visíveis na barra lateral.
 * @param {number} [limit=50]
 * @returns {Promise<Array<{id: string, name: string, phone: string, unreadCount: number, lastMessageTime: number}>>}
 */
export async function getAllChats(limit = 50) {
  try {
    const result = await sendToWhatsApp(
      TRANSPORT_ACTIONS.GET_ALL_CHATS,
      { limit: Math.max(1, Math.min(limit, 200)) },
      30000
    );
    return Array.isArray(result?.chats) ? result.chats : [];
  } catch {
    return [];
  }
}

/**
 * Retorna estatísticas de uso do transporte (para diagnóstico).
 * @returns {{pending: number, totalSent: number}}
 */
export function getTransportStats() {
  return {
    pending: __pendingRequests.size,
    totalSent: __requestCounter,
  };
}
