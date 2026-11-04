/**
 * i9Hub Prioridade 5 — Integrações com CRMs Externos (Webhooks/REST)
 * Sincroniza leads classificados com RD Station, Kommo, HubSpot, ActiveCampaign e webhooks genéricos.
 * Roda em background via fetch() sempre que um lead é classificado ou muda de status.
 */

const STORAGE_KEY = 'i9hub_crm_integrations';
const LOG_KEY = 'i9hub_crm_sync_log';
const MAX_LOG_ENTRIES = 500;

/**
 * Retorna todas as integrações configuradas.
 * @returns {Promise<Array>}
 */
export async function getCrmIntegrations() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  } catch {
    return [];
  }
}

/**
 * Salva ou atualiza uma integração.
 * @param {Object} integration
 * @param {string} [integration.id]
 * @param {string} integration.name
 * @param {string} integration.type - 'rdstation'|'kommo'|'hubspot'|'activecampaign'|'webhook'
 * @param {string} integration.webhookUrl
 * @param {string} [integration.apiKey]
 * @param {boolean} [integration.enabled=true]
 * @param {Object} [integration.fieldMapping]
 * @returns {Promise<Object|null>}
 */
export async function saveCrmIntegration(integration) {
  if (!integration || !integration.name || !integration.webhookUrl) return null;
  const list = await getCrmIntegrations();
  const normalized = {
    id: integration.id || ('crm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
    name: String(integration.name).trim().slice(0, 100),
    type: String(integration.type || 'webhook').trim().toLowerCase().slice(0, 30),
    webhookUrl: String(integration.webhookUrl).trim().slice(0, 2000),
    apiKey: integration.apiKey ? String(integration.apiKey).trim().slice(0, 500) : '',
    enabled: integration.enabled !== false,
    fieldMapping: integration.fieldMapping && typeof integration.fieldMapping === 'object' ? integration.fieldMapping : {},
    updatedAt: new Date().toISOString(),
  };
  const idx = list.findIndex(i => i.id === normalized.id);
  if (idx >= 0) {
    list[idx] = normalized;
  } else {
    if (list.length >= 20) list.shift();
    list.push(normalized);
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
  return normalized;
}

/**
 * Remove uma integração por ID.
 * @param {string} integrationId
 * @returns {Promise<boolean>}
 */
export async function deleteCrmIntegration(integrationId) {
  const list = await getCrmIntegrations();
  const filtered = list.filter(i => i.id !== integrationId);
  if (filtered.length === list.length) return false;
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
  return true;
}

/**
 * Envia dados de um lead para todas as integrações ativas.
 * @param {Object} leadData - Dados do lead (tipo, score, intencao, urgencia, telefone, nome, etc.)
 * @param {string} event - 'classified'|'status_changed'|'updated'
 * @returns {Promise<{success: number, failed: number, results: Array}>}
 */
export async function syncLeadToCrms(leadData, event = 'classified') {
  const integrations = await getCrmIntegrations();
  const active = integrations.filter(i => i.enabled && i.webhookUrl);
  if (!active.length) return { success: 0, failed: 0, results: [] };

  const results = [];
  for (const integration of active) {
    const payload = buildPayload(leadData, event, integration);
    const headers = buildHeaders(integration);
    try {
      const resp = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        credentials: 'omit',
        cache: 'no-store',
      });
      const ok = resp.ok;
      results.push({ integrationId: integration.id, name: integration.name, success: ok, status: resp.status });
      await logSyncAttempt(integration.id, leadData, event, ok, resp.status);
    } catch (e) {
      results.push({ integrationId: integration.id, name: integration.name, success: false, error: e.message });
      await logSyncAttempt(integration.id, leadData, event, false, 0, e.message);
    }
  }
  const successCount = results.filter(r => r.success).length;
  return { success: successCount, failed: results.length - successCount, results };
}

function buildPayload(leadData, event, integration) {
  const base = {
    event,
    timestamp: new Date().toISOString(),
    source: 'i9hub_extension',
    lead: {
      phone: leadData.phone || leadData.contactId || '',
      name: leadData.name || '',
      type: leadData.tipo || leadData.type || '',
      score: leadData.score ?? 0,
      confidence: leadData.confianca ?? leadData.confidence ?? 0,
      intent: leadData.intencao || leadData.intent || '',
      urgency: leadData.urgencia || leadData.urgency || '',
      niche: leadData.modeloNicho || leadData.niche || '',
      stage: leadData.estagio || leadData.stage || '',
      tags: Array.isArray(leadData.tags) ? leadData.tags : [],
      customFields: leadData.customFields || {},
    },
  };
  // Aplica mapeamento de campos se configurado
  if (integration.fieldMapping && Object.keys(integration.fieldMapping).length > 0) {
    const mapped = {};
    for (const [targetField, sourceField] of Object.entries(integration.fieldMapping)) {
      mapped[targetField] = base.lead[sourceField] ?? leadData[sourceField] ?? '';
    }
    base.mappedFields = mapped;
  }
  return base;
}

function buildHeaders(integration) {
  const headers = { 'Content-Type': 'application/json' };
  if (integration.apiKey) {
    switch (integration.type) {
      case 'hubspot':
        headers['Authorization'] = `Bearer ${integration.apiKey}`;
        break;
      case 'activecampaign':
        headers['Api-Token'] = integration.apiKey;
        break;
      case 'rdstation':
        headers['Authorization'] = `Bearer ${integration.apiKey}`;
        break;
      default:
        headers['X-API-Key'] = integration.apiKey;
        break;
    }
  }
  return headers;
}

async function logSyncAttempt(integrationId, leadData, event, success, status, errorMsg) {
  try {
    const result = await chrome.storage.local.get(LOG_KEY);
    const logs = Array.isArray(result[LOG_KEY]) ? result[LOG_KEY] : [];
    logs.push({
      integrationId,
      event,
      leadPhone: String(leadData?.phone || leadData?.contactId || '').slice(0, 50),
      success,
      status,
      error: errorMsg ? String(errorMsg).slice(0, 300) : null,
      timestamp: new Date().toISOString(),
    });
    if (logs.length > MAX_LOG_ENTRIES) logs.splice(0, logs.length - MAX_LOG_ENTRIES);
    await chrome.storage.local.set({ [LOG_KEY]: logs });
  } catch { /* silencioso */ }
}

/**
 * Retorna o log de sincronizações recentes.
 * @param {number} [limit=50]
 * @returns {Promise<Array>}
 */
export async function getSyncLog(limit = 50) {
  try {
    const result = await chrome.storage.local.get(LOG_KEY);
    const logs = Array.isArray(result[LOG_KEY]) ? result[LOG_KEY] : [];
    logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return logs.slice(0, Number(limit) || 50);
  } catch {
    return [];
  }
}

/**
 * Testa uma integração enviando um payload de teste.
 * @param {string} integrationId
 * @returns {Promise<{success: boolean, status?: number, error?: string}>}
 */
export async function testCrmIntegration(integrationId) {
  const list = await getCrmIntegrations();
  const integration = list.find(i => i.id === integrationId);
  if (!integration) return { success: false, error: 'Integração não encontrada' };
  const testPayload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    source: 'i9hub_extension',
    lead: { phone: '5511999999999', name: 'Teste i9Hub', type: 'prospecto', score: 75 },
  };
  try {
    const resp = await fetch(integration.webhookUrl, {
      method: 'POST',
      headers: buildHeaders(integration),
      body: JSON.stringify(testPayload),
      credentials: 'omit',
      cache: 'no-store',
    });
    return { success: resp.ok, status: resp.status };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
