import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const wid = (user, server = 'c.us') => ({ user, server, _serialized: `${user}@${server}` });
const fnv = (raw) => { let h = 2166136261; for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); } return 'msg_' + (h >>> 0).toString(16); };

// Carrega o injected.js real num ambiente simulado, com um Store falso do WhatsApp.
async function bootInjected() {
  const posted = []; const sent = []; const intervals = []; const listeners = {}; const msgHandlers = [];
  const chats = [makeChat(wid('5511999990000'))]; // o monitor só inicia quando o Store já tem conversas
  const chatCollection = {
    getModelsArray: () => chats,
    get: (id) => { const key = typeof id === 'string' ? id : id?._serialized; return chats.find((c) => c.id._serialized === key) || null; },
  };
  const mods = {
    WAWebCollections: { Chat: chatCollection, GroupMetadata: { getModelsArray: () => [] }, Contact: { get: () => null, getModelsArray: () => [] }, Msg: { on: (ev, fn) => { if (ev === 'add') msgHandlers.push(fn); } } },
    WAWebSendTextMsgChatAction: { sendTextMsgToChat: async (chat, text) => { sent.push({ chatId: chat.id._serialized, text }); return { messageSendResult: 'OK' }; } },
  };
  const noop = () => {};
  const stubEl = () => new Proxy(function () {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stubEl()), apply: () => stubEl() });
  const document = {
    readyState: 'complete', hidden: false, URL: 'https://web.whatsapp.com/', title: '', addEventListener: noop, removeEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => stubEl(),
    body: stubEl(), head: stubEl(), documentElement: stubEl(),
  };
  const window = {
    require: (name) => mods[name] || null,
    postMessage: (data) => { posted.push(data); },
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    removeEventListener: noop, location: { href: 'https://web.whatsapp.com/', origin: 'https://web.whatsapp.com' },
    localStorage: { getItem: (k) => (k === 'last-wid-md' ? JSON.stringify('5511900000000:1@c.us') : null), setItem: noop },
    getComputedStyle: () => ({}), innerWidth: 1000, innerHeight: 800,
  };
  window.window = window; window.parent = window; window.self = window; window.top = window; window.document = document;
  const sandbox = {
    window, document, console: { log: noop, info: noop, warn: noop, error: noop, debug: noop },
    navigator: { locks: { request: () => new Promise(() => {}) }, userAgent: 'test', language: 'pt-BR' },
    localStorage: window.localStorage, location: window.location,
    setInterval: (fn) => { intervals.push(fn); return intervals.length; }, clearInterval: noop,
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(Number(ms) || 0, 5)), clearTimeout: (t) => clearTimeout(t),
    MutationObserver: class { observe() {} disconnect() {} }, Node: { ELEMENT_NODE: 1 }, Event: class {}, MouseEvent: class {}, KeyboardEvent: class {},
    requestAnimationFrame: (fn) => queueMicrotask(fn), performance: { now: () => Date.now() }, CSS: { escape: (x) => x },
    URL, TextEncoder, TextDecoder, crypto: globalThis.crypto, structuredClone,
  };
  vm.createContext(sandbox);
  vm.runInContext(read('content/injected.js'), sandbox, { filename: 'injected.js' });
  await new Promise((r) => setTimeout(r, 20)); // deixa o monitor assíncrono inicializar
  return { posted, sent, intervals, listeners, msgHandlers, chats, window };
}

const aiMessages = (env) => env.posted.filter((p) => p.source === 'i9rcs7-injected' && p.type === 'AI_STORE_MESSAGE').map((p) => p.payload);
const nowSec = () => Math.floor(Date.now() / 1000);
const makeChat = (id, extra = {}) => ({ id, msgs: { models: [] }, t: nowSec(), formattedTitle: 'Cliente Teste', ...extra });
const privMsg = (suffix, body, extra = {}) => ({ id: { _serialized: `false_5511999990000@c.us_${suffix}`, remote: wid('5511999990000'), fromMe: false }, type: 'chat', body, t: nowSec(), fromMe: false, from: wid('5511999990000'), ...extra });

test('o monitor do Store avisa que está ativo e entrega mensagem privada recebida', async () => {
  const env = await bootInjected();
  const chat = env.chats[0];
  const status = env.posted.find((p) => p.type === 'AI_STORE_STATUS');
  assert.ok(status, 'deve emitir AI_STORE_STATUS');
  assert.equal(status.payload.ok, true);
  assert.equal(env.msgHandlers.length, 1, 'deve assinar o evento Msg add');

  env.msgHandlers[0](privMsg('A1', 'Olá, quero um orçamento'));
  const [m] = aiMessages(env);
  assert.ok(m, 'mensagem deve ser emitida');
  assert.equal(m.chatType, 'private');
  assert.equal(m.isGroup, false);
  assert.equal(m.text, 'Olá, quero um orçamento');
  assert.equal(m.phone, '5511999990000');
  assert.equal(m.chatName, 'Cliente Teste');
  assert.equal(m.chatId, '5511999990000@c.us');
  assert.equal(m.chatRef, fnv('5511999990000@c.us|chat-ref'), 'chatRef deve coincidir com o cálculo do leitor por DOM (mantém o histórico)');
  assert.match(m.messageId, /^store_false_5511999990000@c\.us_A1$/);
});

test('mensagens próprias, mídia sem legenda, notificações e antigas são ignoradas', async () => {
  const env = await bootInjected();
  const h = env.msgHandlers[0];
  h(privMsg('B1', 'enviada por mim', { fromMe: true, id: { _serialized: 'true_x_B1', remote: wid('5511999990000'), fromMe: true } }));
  h(privMsg('B2', '/9j/4AAQSkZJRgABAQ...base64...', { type: 'image' }));
  h(privMsg('B3', 'entrou no grupo', { isNotification: true }));
  h(privMsg('B4', 'mensagem velha', { t: nowSec() - 3600 }));
  h(privMsg('B5', 'status', { id: { _serialized: 'false_status@broadcast_B5', remote: wid('status', 'broadcast'), fromMe: false } }));
  assert.equal(aiMessages(env).length, 0);
  h(privMsg('B6', '/9j/base64', { type: 'image', caption: 'foto do produto que quero' }));
  assert.equal(aiMessages(env).length, 1);
  assert.equal(aiMessages(env)[0].text, 'foto do produto que quero');
});

test('a mesma mensagem por evento e pela varredura é entregue uma única vez', async () => {
  const env = await bootInjected();
  const chat = env.chats[0];
  const msg = privMsg('C1', 'oi');
  env.msgHandlers[0](msg);
  chat.msgs.models.push(msg);
  env.intervals.forEach((fn) => fn()); // varredura + sinal de vida
  assert.equal(aiMessages(env).length, 1);
});

test('a varredura de reserva captura mensagens mesmo se o evento Msg add não disparar', async () => {
  const env = await bootInjected();
  const chat = env.chats[0];
  chat.msgs.models.push(privMsg('D1', 'mensagem sem evento'));
  env.intervals.forEach((fn) => fn());
  const msgs = aiMessages(env);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].source, 'store-poll');
});

test('grupo: identifica remetente, menção à conta conectada e resposta citada', async () => {
  const env = await bootInjected();
  const gid = wid('120363000000000000', 'g.us');
  env.chats.push(makeChat(gid, { formattedTitle: 'Grupo Vendas' }));
  const base = (suffix, extra) => ({ id: { _serialized: `false_${gid._serialized}_${suffix}_5511977770000@c.us`, remote: gid, fromMe: false }, type: 'chat', t: nowSec(), fromMe: false, author: wid('5511977770000'), notifyName: 'Maria', ...extra });
  env.msgHandlers[0](base('E1', { body: 'bom dia pessoal' }));
  env.msgHandlers[0](base('E2', { body: '@IA qual o preço?', mentionedJidList: [wid('5511900000000')] }));
  env.msgHandlers[0](base('E3', { body: 'sim, pode ser', quotedStanzaID: 'ABC', quotedMsg: { type: 'chat', body: 'Posso ajudar com algo mais?' } }));
  const [a, b, c] = aiMessages(env);
  assert.equal(a.chatType, 'group'); assert.equal(a.chatName, 'Grupo Vendas'); assert.equal(a.senderName, 'Maria'); assert.equal(a.senderPhone, '5511977770000');
  assert.equal(a.isMention, false);
  assert.equal(b.isMention, true);
  assert.equal(c.isReply, true); assert.equal(c.replyContext, 'Posso ajudar com algo mais?');
});

test('a resposta da IA é enviada pelo Store usando o ID da conversa, sem depender do chat aberto', async () => {
  const env = await bootInjected();
  const dispatch = async (payload) => {
    for (const fn of env.listeners.message) await fn({ source: env.window, data: { source: 'i9rcs7-content', type: 'AI_SEND_REPLY', payload } });
  };
  await dispatch({ chatId: '5511999990000@c.us', expectedChatName: 'Outro chat aberto', text: 'Olá! Como posso ajudar?', requestId: 'r1' });
  assert.deepEqual(env.sent, [{ chatId: '5511999990000@c.us', text: 'Olá! Como posso ajudar?' }]);
  const ok = env.posted.find((p) => p.type === 'AI_REPLY_SENT');
  assert.ok(ok && ok.payload.success === true && ok.payload.via === 'store' && ok.payload.requestId === 'r1');
});

test('se o Store não achar a conversa, a resposta cai no método por tela e não envia nada pelo Store', async () => {
  const env = await bootInjected();
  for (const fn of env.listeners.message) await fn({ source: env.window, data: { source: 'i9rcs7-content', type: 'AI_SEND_REPLY', payload: { chatId: '5500000000000@c.us', expectedChatName: 'Cliente Teste', text: 'oi', requestId: 'r2' } } });
  assert.equal(env.sent.length, 0);
  assert.ok(!env.posted.some((p) => p.type === 'AI_REPLY_SENT' && p.payload?.via === 'store'));
});
