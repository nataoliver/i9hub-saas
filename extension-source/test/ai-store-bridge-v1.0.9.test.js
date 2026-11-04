import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

// Carrega o content.js real com uma API chrome simulada e um service worker falso.
function bootContent({ active = true, chatMode = 'private_only' } = {}) {
  const sent = []; const listeners = {}; const noop = () => {};
  const stubEl = () => new Proxy(function () {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stubEl()), apply: () => stubEl() });
  const document = {
    URL: 'https://web.whatsapp.com/', readyState: 'complete', hidden: false, visibilityState: 'visible',
    addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    createElement: () => stubEl(), body: stubEl(), head: stubEl(), documentElement: stubEl(),
  };
  const state = { active, chatMode };
  const chrome = {
    runtime: {
      id: 'ext-id', lastError: undefined, getURL: (p) => `chrome-extension://ext-id/${p}`,
      onMessage: { addListener: noop },
      sendMessage: (msg, cb) => {
        sent.push(msg);
        if (msg.type === 'AI_INBOX_CHECK') cb?.({ success: true, active: state.active, chatMode: state.chatMode });
        else cb?.({ success: true, accepted: true });
      },
    },
  };
  const window = {
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); }, postMessage: noop, location: { href: 'https://web.whatsapp.com/', origin: 'https://web.whatsapp.com' },
  };
  window.window = window; window.parent = window; window.document = document;
  const sandbox = {
    window, document, chrome, location: window.location, console: { log: noop, info: noop, warn: noop, error: noop, debug: noop },
    setInterval: noop, clearInterval: noop, setTimeout: (fn, ms) => setTimeout(fn, Math.min(Number(ms) || 0, 5)), clearTimeout: (t) => clearTimeout(t),
    MutationObserver: class { observe() {} disconnect() {} }, Node: { ELEMENT_NODE: 1 }, MouseEvent: class {}, Event: class {},
    requestAnimationFrame: noop, URL, performance: { now: () => Date.now() },
  };
  vm.createContext(sandbox);
  vm.runInContext(read('content/content.js'), sandbox, { filename: 'content.js' });
  const fromInjected = async (type, payload) => { for (const fn of listeners.message || []) await fn({ source: window, data: { source: 'i9rcs7-injected', type, payload } }); await new Promise((r) => setTimeout(r, 30)); };
  return { sent, state, fromInjected, window, listeners };
}

const goodPayload = (extra = {}) => ({
  messageId: 'store_false_5511999990000@c.us_A1', chatId: '5511999990000@c.us', chatRef: 'msg_abc', chatName: 'Cliente', chatType: 'private', isGroup: false,
  phone: '5511999990000', senderName: '', senderPhone: '', isReply: false, isMention: false, replyContext: '', text: 'Quero um orçamento', receivedAt: new Date().toISOString(), source: 'store-event', ...extra,
});
const aiSent = (env) => env.sent.filter((m) => m.type === 'AI_INCOMING_MESSAGE');

test('mensagem do Store chega ao service worker como AI_INCOMING_MESSAGE com chatId para a resposta', async () => {
  const env = bootContent();
  await env.fromInjected('AI_STORE_MESSAGE', goodPayload());
  const [m] = aiSent(env);
  assert.ok(m);
  assert.equal(m.payload.chatId, '5511999990000@c.us');
  assert.equal(m.payload.text, 'Quero um orçamento');
  assert.equal(m.payload.chatType, 'private');
  assert.equal(m.payload.source, 'store-event');
});

test('com a IA pausada ou painel fechado a mensagem não é encaminhada', async () => {
  const env = bootContent({ active: false });
  await env.fromInjected('AI_STORE_MESSAGE', goodPayload());
  assert.equal(aiSent(env).length, 0);
});

test('o modo "somente privadas" bloqueia grupos e o modo "somente grupos" bloqueia privadas', async () => {
  const priv = bootContent({ chatMode: 'private_only' });
  await priv.fromInjected('AI_STORE_MESSAGE', goodPayload({ chatType: 'group', isGroup: true, chatId: '1203@g.us' }));
  assert.equal(aiSent(priv).length, 0);
  const grp = bootContent({ chatMode: 'groups_only' });
  await grp.fromInjected('AI_STORE_MESSAGE', goodPayload());
  assert.equal(aiSent(grp).length, 0);
  const both = bootContent({ chatMode: 'both' });
  await both.fromInjected('AI_STORE_MESSAGE', goodPayload({ messageId: 'store_g1', chatType: 'group', isGroup: true, chatId: '1203@g.us' }));
  await both.fromInjected('AI_STORE_MESSAGE', goodPayload({ messageId: 'store_p1' }));
  assert.equal(aiSent(both).length, 2);
});

test('payload malformado ou com ID que não veio do Store é descartado e campos extras são removidos', async () => {
  const env = bootContent();
  await env.fromInjected('AI_STORE_MESSAGE', goodPayload({ messageId: 'dom_forjado' }));
  await env.fromInjected('AI_STORE_MESSAGE', goodPayload({ text: '   ' }));
  await env.fromInjected('AI_STORE_MESSAGE', null);
  assert.equal(aiSent(env).length, 0);
  await env.fromInjected('AI_STORE_MESSAGE', goodPayload({ messageId: 'store_ok', evil: '<script>', text: 'x'.repeat(9000) }));
  const [m] = aiSent(env);
  assert.equal(m.payload.evil, undefined);
  assert.equal(m.payload.text.length, 4000);
});

test('mensagens chegam ao service worker na mesma ordem em que o Store as entregou', async () => {
  const env = bootContent();
  for (const n of [1, 2, 3, 4]) await env.fromInjected('AI_STORE_MESSAGE', goodPayload({ messageId: `store_${n}`, text: `msg ${n}` }));
  assert.deepEqual(aiSent(env).map((m) => m.payload.text), ['msg 1', 'msg 2', 'msg 3', 'msg 4']);
});

test('palavras de consentimento (SAIR/QUERO) continuam sendo registradas na leitura pelo Store', async () => {
  const env = bootContent({ active: false }); // consentimento independe de a IA estar ativa
  await env.fromInjected('AI_STORE_MESSAGE', goodPayload({ messageId: 'store_s1', text: 'SAIR' }));
  const c = env.sent.find((m) => m.type === 'CONSENT_UPDATE');
  assert.ok(c);
  assert.equal(c.payload.status, 'opted_out');
  assert.equal(c.payload.phone, '5511999990000');
});

test('o status do monitor é repassado ao service worker (sem repetir a cada sinal de vida)', async () => {
  const env = bootContent();
  await env.fromInjected('AI_STORE_STATUS', { ok: true, via: 'event+poll', chats: 120 });
  await env.fromInjected('AI_STORE_STATUS', { ok: true, via: 'event+poll', chats: 120 });
  const st = env.sent.filter((m) => m.type === 'AI_STORE_STATUS');
  assert.equal(st.length, 1);
  assert.deepEqual({ ok: st[0].payload.ok, via: st[0].payload.via, chats: st[0].payload.chats }, { ok: true, via: 'event+poll', chats: 120 });
  await env.fromInjected('AI_STORE_STATUS', { ok: false, reason: 'store-unavailable' });
  assert.equal(env.sent.filter((m) => m.type === 'AI_STORE_STATUS').length, 2);
});

test('arquivos de contrato: tipo liberado no message-gate, chatId na resposta e painel mostra o motivo real', () => {
  assert.match(read('lib/message-gate.js'), /'AI_STORE_STATUS'/);
  const worker = read('background/service-worker.js');
  assert.match(worker, /chatId: String\(payload\.chatId \|\| ''\), text: String\(reply\)/);
  assert.match(worker, /duplicate-content/);
  assert.match(worker, /AI_HEARTBEAT_TTL_MS = 120000/);
  assert.match(worker, /setupMissing/);
  const ui = read('sidepanel/components/AIChatView.js');
  assert.match(ui, /AI_PROCESSING_LABELS/);
  assert.match(ui, /configuration-incomplete/);
  assert.match(ui, /ai-chat-reader-status/);
  const content = read('content/content.js');
  assert.match(content, /aiStoreHealthy\(\)/);
  assert.match(content, /handled-by-store/);
});
