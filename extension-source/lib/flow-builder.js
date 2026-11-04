/**
 * i9Hub Prioridade 5 — Construtor de Fluxos (Automação via WhatsApp Web)
 * Configura sequências de mensagens com regras lógicas locais.
 * Usa a camada de transporte abstrata (whatsapp-transport.js) para enviar mensagens.
 */
import { sendMessage } from './whatsapp-transport.js';

const STORAGE_KEY = 'i9hub_flows';
const MAX_FLOWS = 50;
const MAX_STEPS_PER_FLOW = 30;

/**
 * Retorna todos os fluxos configurados.
 * @returns {Promise<Array>}
 */
export async function getFlows() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  } catch {
    return [];
  }
}

/**
 * Cria ou atualiza um fluxo.
 * @param {Object} flow
 * @param {string} [flow.id]
 * @param {string} flow.name
 * @param {Array<{trigger: string, message: string, delayMs?: number}>} flow.steps
 * @param {boolean} [flow.enabled=true]
 * @returns {Promise<Object|null>}
 */
export async function saveFlow(flow) {
  if (!flow || !flow.name || !Array.isArray(flow.steps)) return null;
  const flows = await getFlows();
  const normalized = {
    id: flow.id || ('flow_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
    name: String(flow.name).trim().slice(0, 100),
    steps: flow.steps.slice(0, MAX_STEPS_PER_FLOW).map(s => ({
      trigger: String(s.trigger || '').trim().toLowerCase().slice(0, 200),
      message: String(s.message || '').trim().slice(0, 5000),
      delayMs: Number.isFinite(s.delayMs) ? Math.max(1000, Math.min(s.delayMs, 300000)) : 2000,
    })).filter(s => s.message),
    enabled: flow.enabled !== false,
    updatedAt: new Date().toISOString(),
  };
  const idx = flows.findIndex(f => f.id === normalized.id);
  if (idx >= 0) {
    flows[idx] = normalized;
  } else {
    if (flows.length >= MAX_FLOWS) flows.shift();
    flows.push(normalized);
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: flows });
  return normalized;
}

/**
 * Remove um fluxo por ID.
 * @param {string} flowId
 * @returns {Promise<boolean>}
 */
export async function deleteFlow(flowId) {
  const flows = await getFlows();
  const filtered = flows.filter(f => f.id !== flowId);
  if (filtered.length === flows.length) return false;
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
  return true;
}

/**
 * Avalia uma mensagem recebida contra todos os fluxos ativos.
 * Retorna a resposta correspondente ao primeiro gatilho encontrado.
 * @param {string} userMessage
 * @returns {Promise<{matched: boolean, response?: string, flowId?: string, stepIndex?: number}>}
 */
export async function evaluateFlows(userMessage) {
  const flows = await getFlows();
  const normalizedMsg = String(userMessage || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  for (const flow of flows) {
    if (!flow.enabled) continue;
    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i];
      if (!step.trigger) continue;
      const triggerNorm = step.trigger.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      if (normalizedMsg.includes(triggerNorm)) {
        return { matched: true, response: step.message, flowId: flow.id, stepIndex: i };
      }
    }
  }
  return { matched: false };
}

/**
 * Envia uma resposta de fluxo com delay humanizado.
 * @param {string} text
 * @param {number} [delayMs=2000]
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendFlowResponse(text, delayMs = 2000) {
  const safeDelay = Math.max(1000, Math.min(Number(delayMs) || 2000, 60000));
  await new Promise(r => setTimeout(r, safeDelay));
  return sendMessage(text);
}

/**
 * Exporta todos os fluxos como JSON (para backup).
 * @returns {Promise<string>}
 */
export async function exportFlows() {
  const flows = await getFlows();
  return JSON.stringify(flows, null, 2);
}

/**
 * Importa fluxos de um JSON (substitui todos os existentes).
 * @param {string} jsonStr
 * @returns {Promise<{success: boolean, count?: number, error?: string}>}
 */
export async function importFlows(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return { success: false, error: 'Formato inválido: esperado array' };
    const valid = parsed.filter(f => f && f.name && Array.isArray(f.steps)).slice(0, MAX_FLOWS);
    await chrome.storage.local.set({ [STORAGE_KEY]: valid });
    return { success: true, count: valid.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
