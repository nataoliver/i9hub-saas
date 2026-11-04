/**
* i9Hub Prioridade 5 — Motor de Reengajamento com Compliance
* Disparos em massa cadenciados com delay aleatório e bloqueio automático de opt-out/spam.
*/
import { sendMessage } from './whatsapp-transport.js';
import { isOptedOut } from './compliance-store.js';
const QUEUE_KEY = 'i9hub_reengagement_queue';
const HISTORY_KEY = 'i9hub_reengagement_history';
const MAX_QUEUE = 500;
const MIN_DELAY_MS = 45000;
const MAX_DELAY_MS = 180000;
export async function getReengagementQueue() {
try {
const result = await chrome.storage.local.get(QUEUE_KEY);
return Array.isArray(result[QUEUE_KEY]) ? result[QUEUE_KEY] : [];
} catch { return []; }
}
export async function addToQueue(entries) {
if (!Array.isArray(entries) || !entries.length) return { added: 0, blocked: 0 };
const queue = await getReengagementQueue();
let added = 0, blocked = 0;
for (const entry of entries) {
const phone = String(entry.phone || '').trim();
if (!phone || !entry.message) { blocked++; continue; }
const optedOut = await isOptedOut(phone);
if (optedOut) { blocked++; continue; }
if (queue.some(q => q.phone === phone && q.status === 'pending')) { blocked++; continue; }
queue.push({
id: 'reeng_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
phone,
message: String(entry.message).slice(0, 5000),
status: 'pending',
scheduledAt: new Date().toISOString(),
sentAt: null,
result: null,
});
added++;
}
if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
await chrome.storage.local.set({ [QUEUE_KEY]: queue });
return { added, blocked };
}
export async function processNextInQueue() {
const queue = await getReengagementQueue();
const pending = queue.filter(q => q.status === 'pending');
if (!pending.length) return { processed: 0 };
const next = pending[0];
const delay = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
await new Promise(r => setTimeout(r, delay));
const result = await sendMessage(next.message);
const idx = queue.findIndex(q => q.id === next.id);
if (idx >= 0) {
queue[idx].status = result.success ? 'sent' : 'failed';
queue[idx].sentAt = new Date().toISOString();
queue[idx].result = result.success ? 'ok' : (result.error || 'unknown');
}
await chrome.storage.local.set({ [QUEUE_KEY]: queue });
await logHistory(next);
return { processed: 1, success: result.success, delayMs: delay };
}
async function logHistory(entry) {
try {
const result = await chrome.storage.local.get(HISTORY_KEY);
const history = Array.isArray(result[HISTORY_KEY]) ? result[HISTORY_KEY] : [];
history.push({ phone: entry.phone, status: entry.status, sentAt: entry.sentAt, result: entry.result });
if (history.length > 1000) history.splice(0, history.length - 1000);
await chrome.storage.local.set({ [HISTORY_KEY]: history });
} catch { /* silencioso */ }
}
export async function clearCompletedFromQueue() {
const queue = await getReengagementQueue();
const pending = queue.filter(q => q.status === 'pending');
await chrome.storage.local.set({ [QUEUE_KEY]: pending });
return queue.length - pending.length;
}
export async function getReengagementStats() {
const queue = await getReengagementQueue();
const stats = { total: queue.length, pending: 0, sent: 0, failed: 0 };
for (const q of queue) {
if (q.status === 'pending') stats.pending++;
else if (q.status === 'sent') stats.sent++;
else if (q.status === 'failed') stats.failed++;
}
return stats;
}
