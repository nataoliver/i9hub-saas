/**
 * ComplianceStore - Gestão local de consentimentos e descadastros (i9Hub v1.0.1)
 * 
 * Armazena dados localmente no chrome.storage.local.
 * NÃO envia conteúdo de mensagens ou chaves de API ao painel.
 * Métricas são agregadas e pseudonimizadas quando sincronizadas.
 */

const STORAGE_KEY_CONSENTS = 'compliance_consents';
const STORAGE_KEY_OPTOUTS = 'compliance_optouts';
const STORAGE_KEY_EVENTS = 'compliance_events';

// Finalidades obrigatórias para campanhas
export const MESSAGE_PURPOSES = Object.freeze([
  { id: 'support', label: 'Atendimento' },
  { id: 'response', label: 'Resposta a solicitação' },
  { id: 'utility', label: 'Utilidade/Transacional' },
  { id: 'order_confirmation', label: 'Confirmação de pedido' },
  { id: 'post_sale', label: 'Pós-venda' },
  { id: 'marketing_authorized', label: 'Marketing autorizado' },
  { id: 'reactivation', label: 'Reativação' },
  { id: 'other', label: 'Outro' },
]);

// Status de consentimento
export const CONSENT_STATUS = Object.freeze({
  GRANTED: 'granted',
  DENIED: 'denied',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
});

/**
 * Cria um registro de consentimento válido.
 */
export function createConsentRecord({ contactId, origin, purpose, method, note = '', policyVersion = '1.0' }) {
  if (!contactId || !origin || !purpose || !method) {
    throw new Error('Campos obrigatórios: contactId, origin, purpose, method');
  }
  return {
    contactId: String(contactId).trim(),
    origin: String(origin).trim(),
    purpose: String(purpose).trim(),
    grantedAt: new Date().toISOString(),
    method: String(method).trim(),
    status: CONSENT_STATUS.GRANTED,
    revokedAt: null,
    note: String(note || '').trim(),
    policyVersion: String(policyVersion || '1.0').trim(),
  };
}

/**
 * Cria um registro de opt-out (descadastro).
 */
export function createOptOutRecord({ contactId, purpose = 'global', origin = 'user_request', note = '' }) {
  if (!contactId) throw new Error('contactId é obrigatório');
  return {
    contactId: String(contactId).trim(),
    purpose: purpose === 'global' ? 'global' : String(purpose).trim(),
    optedOutAt: new Date().toISOString(),
    origin: String(origin).trim(),
    note: String(note || '').trim(),
  };
}

/**
 * Salva um consentimento no storage local.
 */
export async function saveConsent(record) {
  const consents = await getConsents();
  // Substitui registros anteriores do mesmo contato+finalidade
  const filtered = consents.filter(c => !(c.contactId === record.contactId && c.purpose === record.purpose));
  filtered.push(record);
  await chrome.storage.local.set({ [STORAGE_KEY_CONSENTS]: filtered });
  return record;
}

/**
 * Registra um opt-out global ou por finalidade.
 */
export async function registerOptOut(contactId, purpose = 'global', origin = 'user_request', note = '') {
  const record = createOptOutRecord({ contactId, purpose, origin, note });
  const optOuts = await getOptOuts();
  // Remove opt-out anterior da mesma finalidade para evitar duplicidade
  const filtered = optOuts.filter(o => !(o.contactId === contactId && o.purpose === purpose));
  filtered.push(record);
  await chrome.storage.local.set({ [STORAGE_KEY_OPTOUTS]: filtered });
  
  // Atualiza status do consentimento correspondente para REVOKED
  const consents = await getConsents();
  const updatedConsents = consents.map(c => {
    if (c.contactId === contactId && (purpose === 'global' || c.purpose === purpose)) {
      return { ...c, status: CONSENT_STATUS.REVOKED, revokedAt: record.optedOutAt };
    }
    return c;
  });
  await chrome.storage.local.set({ [STORAGE_KEY_CONSENTS]: updatedConsents });
  
  return record;
}

/**
 * Verifica se um contato está em opt-out (global ou para uma finalidade específica).
 */
export async function isOptedOut(contactId, purpose = null) {
  const optOuts = await getOptOuts();
  const cid = String(contactId).trim();
  return optOuts.some(o => 
    o.contactId === cid && 
    (o.purpose === 'global' || (purpose && o.purpose === purpose))
  );
}

/**
 * Verifica se um contato tem consentimento válido para uma finalidade.
 */
export async function hasValidConsent(contactId, purpose) {
  const consents = await getConsents();
  const cid = String(contactId).trim();
  const consent = consents.find(c => 
    c.contactId === cid && 
    c.purpose === purpose && 
    c.status === CONSENT_STATUS.GRANTED
  );
  if (!consent) return false;
  // Verifica se não há opt-out posterior
  const optedOut = await isOptedOut(contactId, purpose);
  return !optedOut;
}

/**
 * Retorna todos os consentimentos armazenados.
 */
export async function getConsents() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_CONSENTS);
    return Array.isArray(result[STORAGE_KEY_CONSENTS]) ? result[STORAGE_KEY_CONSENTS] : [];
  } catch { return []; }
}

/**
 * Retorna todos os opt-outs armazenados.
 */
export async function getOptOuts() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_OPTOUTS);
    return Array.isArray(result[STORAGE_KEY_OPTOUTS]) ? result[STORAGE_KEY_OPTOUTS] : [];
  } catch { return []; }
}

/**
 * Registra um evento de conformidade (para auditoria local).
 */
export async function logComplianceEvent(event) {
  try {
    const events = await getComplianceEvents();
    events.push({
      timestamp: new Date().toISOString(),
      type: event.type || 'unknown',
      contactId: event.contactId || null,
      campaignId: event.campaignId || null,
      purpose: event.purpose || null,
      detail: event.detail || null,
    });
    // Mantém apenas os últimos 500 eventos para não inflar o storage
    const trimmed = events.slice(-500);
    await chrome.storage.local.set({ [STORAGE_KEY_EVENTS]: trimmed });
  } catch { /* silencioso - eventos são auxiliares */ }
}

/**
 * Retorna eventos de conformidade.
 */
export async function getComplianceEvents(limit = 100) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_EVENTS);
    const events = Array.isArray(result[STORAGE_KEY_EVENTS]) ? result[STORAGE_KEY_EVENTS] : [];
    return events.slice(-limit);
  } catch { return []; }
}

/**
 * Limpa todos os dados locais de conformidade (privacidade).
 */
export async function clearComplianceData() {
  await chrome.storage.local.remove([STORAGE_KEY_CONSENTS, STORAGE_KEY_OPTOUTS, STORAGE_KEY_EVENTS]);
}

/**
 * Filtra contatos removendo os que estão em opt-out.
 * Retorna { valid: [], excluded: [] }
 */
export async function filterContactsByOptOut(contacts, purpose = null) {
  const optOuts = await getOptOuts();
  const optOutMap = new Map();
  optOuts.forEach(o => {
    if (!optOutMap.has(o.contactId)) optOutMap.set(o.contactId, new Set());
    optOutMap.get(o.contactId).add(o.purpose);
  });
  
  const valid = [];
  const excluded = [];
  
  for (const contact of contacts) {
    const cid = String(contact.phone || contact.contactId || '').trim();
    const purposes = optOutMap.get(cid);
    if (purposes && (purposes.has('global') || (purpose && purposes.has(purpose)))) {
      excluded.push(contact);
    } else {
      valid.push(contact);
    }
  }
  
  return { valid, excluded };
}
