import test from 'node:test';
import assert from 'node:assert/strict';
import { decideMessage } from '../lib/message-gate.js';
import { hasFeatureEntitlement, FEATURE_CATALOG, ACTION_FEATURE_MAP, SAFETY_ACTIONS } from '../lib/feature-catalog.js';

// ============================================================================
// Parser de palavras-chave de consentimento (lógica replicada do content.js)
// ============================================================================
const CONSENT_NEGATION = /\b(?:n[aã]o|nunca|jamais|sem)\s+(?:quero|desejo|aceito|autorizo|permito)/i;
const CONSENT_CONTEXT_FALSE_POSITIVE = /\b(?:quero|desejo)\s+(?:saber|ver|conhecer|entender|perguntar|falar|comprar|receber\s+(?:mais|informa))/i;

function detectConsentKeyword(text) {
  if (!text || typeof text !== 'string') return null;
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.length > 200) return null;
  if (CONSENT_NEGATION.test(cleaned)) return null;
  if (CONSENT_CONTEXT_FALSE_POSITIVE.test(cleaned)) return null;
  const optedOut = /^\s*(?:sair|cancelar|descadastrar|remover|parar|stop|unsubscribe)\s*$/i.test(cleaned);
  const optedIn = /^\s*(?:quero|sim|autorizo|aceito|permito|ok|confirmo)\s*$/i.test(cleaned);
  if (optedOut) return 'opted_out';
  if (optedIn) return 'opted_in';
  return null;
}

test('detecta opt-in explícito com diferentes variações', () => {
  assert.equal(detectConsentKeyword('QUERO'), 'opted_in');
  assert.equal(detectConsentKeyword('quero'), 'opted_in');
  assert.equal(detectConsentKeyword('  Quero  '), 'opted_in');
  assert.equal(detectConsentKeyword('Sim'), 'opted_in');
  assert.equal(detectConsentKeyword('AUTORIZO'), 'opted_in');
  assert.equal(detectConsentKeyword('aceito'), 'opted_in');
  assert.equal(detectConsentKeyword('OK'), 'opted_in');
  assert.equal(detectConsentKeyword('confirmo'), 'opted_in');
});

test('detecta opt-out explícito com diferentes variações', () => {
  assert.equal(detectConsentKeyword('SAIR'), 'opted_out');
  assert.equal(detectConsentKeyword('sair'), 'opted_out');
  assert.equal(detectConsentKeyword('  Sair  '), 'opted_out');
  assert.equal(detectConsentKeyword('CANCELAR'), 'opted_out');
  assert.equal(detectConsentKeyword('descadastrar'), 'opted_out');
  assert.equal(detectConsentKeyword('REMOVER'), 'opted_out');
  assert.equal(detectConsentKeyword('parar'), 'opted_out');
  assert.equal(detectConsentKeyword('STOP'), 'opted_out');
  assert.equal(detectConsentKeyword('unsubscribe'), 'opted_out');
});

test('evita falsos positivos com negação', () => {
  assert.equal(detectConsentKeyword('não quero'), null);
  assert.equal(detectConsentKeyword('NÃO QUERO'), null);
  assert.equal(detectConsentKeyword('nao quero'), null);
  assert.equal(detectConsentKeyword('nunca aceito'), null);
  assert.equal(detectConsentKeyword('jamais autorizo'), null);
  assert.equal(detectConsentKeyword('sem desejo'), null);
});

test('evita falsos positivos com contexto', () => {
  assert.equal(detectConsentKeyword('quero saber o preço'), null);
  assert.equal(detectConsentKeyword('quero ver mais detalhes'), null);
  assert.equal(detectConsentKeyword('quero conhecer a empresa'), null);
  assert.equal(detectConsentKeyword('quero entender melhor'), null);
  assert.equal(detectConsentKeyword('quero perguntar algo'), null);
  assert.equal(detectConsentKeyword('quero falar com alguém'), null);
  assert.equal(detectConsentKeyword('quero comprar agora'), null);
  assert.equal(detectConsentKeyword('quero receber mais informações'), null);
});

test('ignora mensagens vazias ou muito longas', () => {
  assert.equal(detectConsentKeyword(''), null);
  assert.equal(detectConsentKeyword(null), null);
  assert.equal(detectConsentKeyword(undefined), null);
  assert.equal(detectConsentKeyword('   '), null);
  assert.equal(detectConsentKeyword('x'.repeat(201)), null);
});

test('mensagens ambíguas não concedem autorização', () => {
  assert.equal(detectConsentKeyword('talvez'), null);
  assert.equal(detectConsentKeyword('vou pensar'), null);
  assert.equal(detectConsentKeyword('me conta mais'), null);
  assert.equal(detectConsentKeyword('interessante'), null);
});

// ============================================================================
// Message Gate - CONSENT_UPDATE
// ============================================================================
test('CONSENT_UPDATE é aceito apenas do WhatsApp Web', () => {
  const base = { senderId: 'ext-id', runtimeId: 'ext-id', type: 'CONSENT_UPDATE' };
  assert.equal(decideMessage({ ...base, senderUrl: 'https://web.whatsapp.com/' }).action, 'accept');
  assert.equal(decideMessage({ ...base, senderUrl: 'https://example.com/' }).action, 'reject');
  assert.equal(decideMessage({ ...base, senderUrl: '' }).action, 'reject');
});

test('CONSENT_UPDATE de página da extensão é aceito', () => {
  const base = { senderId: 'ext-id', runtimeId: 'ext-id', type: 'CONSENT_UPDATE', senderUrl: 'chrome-extension://ext-id/popup.html' };
  assert.equal(decideMessage(base).action, 'accept');
});

// ============================================================================
// Catálogo de features - compliance.consent_tracking
// ============================================================================
test('compliance.auto_blacklist está registrado no catálogo como implementado', () => {
  const feature = FEATURE_CATALOG.find((f) => f.id === 'compliance.auto_blacklist');
  assert.ok(feature, 'Feature compliance.auto_blacklist deve existir no catálogo');
  assert.equal(feature.implemented, true);
  assert.equal(feature.category, 'Conformidade');
});

test('CONSENT_UPDATE está mapeado para compliance.consent_tracking', () => {
  assert.equal(ACTION_FEATURE_MAP.CONSENT_UPDATE, 'compliance.consent_tracking');
});

test('CONSENT_UPDATE permanece disponível como ação de segurança para registrar opt-in/opt-out', () => {
  assert.equal(SAFETY_ACTIONS.has('CONSENT_UPDATE'), true);
  assert.equal(hasFeatureEntitlement(['compliance.consent_tracking'], 'compliance.consent_tracking'), true);
  assert.equal(hasFeatureEntitlement([], 'compliance.consent_tracking'), false);
});

test('admin.full_access e wildcard concedem consent_tracking implementado, mas full access não é inferido do wildcard', () => {
  assert.equal(hasFeatureEntitlement(['admin.full_access'], 'compliance.consent_tracking'), true);
  assert.equal(hasFeatureEntitlement(['*'], 'compliance.consent_tracking'), true);
  assert.equal(hasFeatureEntitlement(['*'], 'admin.full_access'), false);
});