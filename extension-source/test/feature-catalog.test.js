import test from 'node:test';
import { buildWhatsAppUrl, WHATSAPP_SUPPORT_NUMBER } from '../lib/onboarding.js';
import { decideMessage } from '../lib/message-gate.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTION_FEATURE_MAP,
  ACTION_REQUIRED_FEATURES,
  CORE_ACTIONS,
  FEATURE_CATALOG,
  PUBLIC_ACTIONS,
  SAFETY_ACTIONS,
  getEntitlementIds,
  hasConfiguredEntitlements,
  hasFeatureEntitlement,
} from '../lib/feature-catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('sem entitlement explícito, a função fica bloqueada', () => {
  assert.equal(hasFeatureEntitlement(undefined, 'crm.leads'), false);
  assert.equal(hasFeatureEntitlement([], 'crm.leads'), false);
  assert.equal(hasFeatureEntitlement({ 'crm.leads': false }, 'crm.leads'), false);
});

test('entitlements assinados podem ser lista ou mapa de permissões', () => {
  assert.equal(hasFeatureEntitlement(['crm.leads', 'maps.extraction'], 'crm.leads'), true);
  assert.equal(hasFeatureEntitlement({ features: ['crm.kanban'] }, 'crm.kanban'), true);
  assert.equal(hasFeatureEntitlement({ 'whatsapp.campaigns.send': true }, 'whatsapp.campaigns.send'), true);
  assert.equal(hasFeatureEntitlement({ 'whatsapp.campaigns.send': false }, 'whatsapp.campaigns.send'), false);
  assert.equal(hasFeatureEntitlement(['settings.general'], 'settings.webhook'), true);
  assert.equal(hasFeatureEntitlement(['settings.webhook'], 'settings.appearance'), false);
  assert.deepEqual(getEntitlementIds({ 'crm.leads': true, 'crm.kanban': false }), ['crm.leads']);
});

test('direitos novos contam no catálogo somente quando a função está marcada como implementada', () => {
  assert.equal(hasConfiguredEntitlements(['crm.leads']), true);
  assert.equal(hasConfiguredEntitlements(['ads.footer']), true);
  assert.equal(hasConfiguredEntitlements(['whatsapp.ai_support']), true);
  assert.equal(hasConfiguredEntitlements(['unknown.permission']), false);
  assert.equal(hasConfiguredEntitlements(['admin.full_access']), true);
});

test('todos os handlers operacionais estão mapeados ou são exceções explícitas', () => {
  const serviceWorker = fs.readFileSync(path.join(root, 'background/service-worker.js'), 'utf8');
  const driveSync = fs.readFileSync(path.join(root, 'background/drive-sync.js'), 'utf8');
  const handlersStart = serviceWorker.indexOf('const handlers = {');
  const handlersEnd = serviceWorker.indexOf('\n};', handlersStart);
  const handlerSource = serviceWorker.slice(handlersStart, handlersEnd);
  const handlerNames = new Set([...handlerSource.matchAll(/\basync\s+([A-Z][A-Z0-9_]+)\s*\(/g)].map((match) => match[1]));
  const driveStart = driveSync.indexOf('export const driveHandlers');
  const driveNames = new Set([...driveSync.slice(driveStart).matchAll(/\basync\s+([A-Z][A-Z0-9_]+)\s*\(/g)].map((match) => match[1]));
  for (const name of driveNames) handlerNames.add(name);
  const unmapped = [...handlerNames].filter((name) => !ACTION_FEATURE_MAP[name] && !PUBLIC_ACTIONS.has(name) && !SAFETY_ACTIONS.has(name));
  assert.deepEqual(unmapped, [], `Handlers sem política de autorização: ${unmapped.join(', ')}`);
});


test('operações sensíveis podem exigir mais de um entitlement', () => {
  for (const featureId of [...ACTION_REQUIRED_FEATURES.OPEN_AWAITING_REPLY_CHAT, ...ACTION_REQUIRED_FEATURES.GET_WA_LABELS, ...ACTION_REQUIRED_FEATURES.AI_TEST_SHEETS]) {
    assert.ok(FEATURE_CATALOG.some((feature) => feature.id === featureId && feature.implemented), `${featureId} precisa estar implementado no catálogo`);
  }
});

test('o catálogo tem IDs únicos e toda ação mapeada aponta para um recurso conhecido', () => {
  const ids = FEATURE_CATALOG.map((feature) => feature.id);
  assert.equal(new Set(ids).size, ids.length, 'IDs duplicados no catálogo');
  for (const [action, featureId] of Object.entries(ACTION_FEATURE_MAP)) {
    assert.ok(ids.includes(featureId), `${action} aponta para ID inexistente: ${featureId}`);
  }
});


test('o CTA de conta gratuita abre o WhatsApp de suporte com a origem da extensão', () => {
  const url = new URL(buildWhatsAppUrl('free-account'));
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname.replace(/^\//, ''), WHATSAPP_SUPPORT_NUMBER);
  const message = url.searchParams.get('text') || '';
  assert.match(message, /i9Hub/);
  assert.match(message, /conta gratuita/i);
  assert.match(message, /Origem: Extensão i9Hub/);
});


test('novos módulos comerciais estão cadastrados e todos os handlers possuem gate de licença', () => {
  for (const id of ['whatsapp.ai_support','whatsapp.ai_support.configure','whatsapp.ai_support.order_capture','whatsapp.ai_support.google_sheets','whatsapp.status_audience','telemetry.usage','telemetry.sales_funnel','marketing.tracking','notifications.in_app','ads.footer']) assert.ok(FEATURE_CATALOG.some((f) => f.id === id && f.implemented), `recurso não cadastrado: ${id}`);
  for (const name of ['AI_SAVE_CONFIG','AI_CLEAR_KEY','AI_SET_ENABLED','AI_TEST_PROVIDER','AI_TEST_SHEETS','AI_GET_ORDERS','AI_UPDATE_ORDER_STATUS','AI_RENOTIFY_SELLER','AI_RETRY_ORDER_WRITE','AI_GET_HANDOFFS','AI_RESUME_CHAT','GET_WA_LABELS','AUDIENCE_SAVE','TELEMETRY_FLUSH_NOW','MARKETING_SAVE_CONFIG']) assert.ok(ACTION_FEATURE_MAP[name], `handler sem gate: ${name}`);
});


test('evento de entrada da IA só é aceito vindo do WhatsApp Web', () => {
  const base = { senderId: 'extension-id', runtimeId: 'extension-id', type: 'AI_INCOMING_MESSAGE' };
  assert.equal(decideMessage({ ...base, senderUrl: 'https://web.whatsapp.com/' }).action, 'acknowledge');
  assert.equal(decideMessage({ ...base, senderUrl: 'https://example.com/' }).action, 'reject');
});

test('consulta do estado do monitor de inbox da IA só é aceita vindo do WhatsApp Web', () => {
  const base = { senderId: 'extension-id', runtimeId: 'extension-id', type: 'AI_INBOX_CHECK' };
  assert.equal(decideMessage({ ...base, senderUrl: 'https://web.whatsapp.com/' }).action, 'acknowledge');
  assert.equal(decideMessage({ ...base, senderUrl: 'https://example.com/' }).action, 'reject');
});


test('preferência de telemetria pode ser salva antes da licença, mas envio continua protegido por consentimento e licença', () => {
  assert.ok(PUBLIC_ACTIONS.has('TELEMETRY_SAVE_PROFILE'));
  const worker = fs.readFileSync(path.join(root, 'background/service-worker.js'), 'utf8');
  assert.match(worker, /function defaultTelemetryProfile\(\) \{ return \{ industry: '', role: '', companySize: '', consent: false \}; \}/);
  assert.match(worker, /if \(profile\.consent === false\) return/);
  assert.match(worker, /consent: p\?\.consent === true/);
});

test('Marketing & Dados não é uma rota pública da extensão e o rodapé do anúncio tem slot persistente', () => {
  const router = fs.readFileSync(path.join(root, 'sidepanel/utils/router.js'), 'utf8');
  const header = fs.readFileSync(path.join(root, 'sidepanel/components/Header.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'sidepanel/sidepanel.html'), 'utf8');
  assert.doesNotMatch(router, /growth: \{ title: ['\"]Marketing & Dados/);
  assert.doesNotMatch(header, /Marketing & Dados/);
  assert.match(html, /id="footer-ad-slot"/);
});

test('a apresentação tem modo explicativo que não navega para controles bloqueados', () => {
  const tour = fs.readFileSync(path.join(root, 'sidepanel/components/Tour.js'), 'utf8');
  assert.match(tour, /start\(\{ allFeatures: true \}\)/);
  assert.match(tour, /if \(this\.allFeatures\) return/);
  assert.match(tour, /getAvailableSteps\(\)/);
});


test('modo demonstração permite navegar, mas nenhuma operação comercial é core sem licença', () => {
  assert.equal(CORE_ACTIONS.size, 0, 'não deve haver bypass operacional sem licença');
  for (const action of ['WA_OPEN_NEW_TAB', 'WA_STATUS', 'GET_SAVED_LEADS', 'GET_STAGES', 'SYNC_PRIVATE_OPPORTUNITIES', 'UPDATE_LEAD_STAGE', 'START_CAMPAIGN']) {
    assert.ok(!CORE_ACTIONS.has(action), `${action} deve exigir licença`);
  }
  assert.ok(PUBLIC_ACTIONS.has('GET_LICENSE_STATUS'));
  assert.ok(SAFETY_ACTIONS.has('STOP_CAMPAIGN'));
  assert.ok(SAFETY_ACTIONS.has('CONSENT_UPDATE'));
});

test('a detecção do WhatsApp inclui URLs pendentes e não depende só de um padrão de URL', () => {
  const worker = fs.readFileSync(path.join(root, 'background/service-worker.js'), 'utf8');
  assert.match(worker, /async function sortedWaTabs\(\)/);
  assert.match(worker, /chrome\.tabs\.query\(\{\}\)/);
  assert.match(worker, /tab\.url \|\| tab\.pendingUrl/);
  assert.match(worker, /u\.hostname\.toLowerCase\(\) === 'web\.whatsapp\.com'/);
});

test('a build candidata usa a identidade i9Hub e ícones existentes no manifesto', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, '1.0.0.0');
  assert.equal(manifest.action.default_title, 'i9Hub');
  for (const icon of Object.values(manifest.icons)) assert.ok(fs.existsSync(path.join(root, icon)), `ícone ausente: ${icon}`);
});


test('configurações privadas de marketing exigem licença administrativa do proprietário', () => {
  const policy = fs.readFileSync(path.join(root, 'lib/license-policy.js'), 'utf8');
  assert.match(policy, /OWNER_ONLY_ACTIONS = new Set\(\['MARKETING_GET_CONFIG', 'MARKETING_SAVE_CONFIG'\]\)/);
  assert.match(policy, /OWNER_ONLY_ACTIONS\.has\(type\) && !hasOwnerAdminAccess\(state\)/);
  assert.match(policy, /hasFeatureEntitlement\(state\?\.payload\?\.ent, 'admin\.full_access'\)/);
});


test('o nicho não é enviado ao endpoint de configuração quando a telemetria não foi consentida', () => {
  const worker = fs.readFileSync(path.join(root, 'background/service-worker.js'), 'utf8');
  assert.match(worker, /industry: profile\.consent === true \? \(profile\.industry \|\| ''\) : ''/);
  assert.match(worker, /async function fetchAdminConfig\(\) \{\s*await ensureTelemetryConsentMigration\(\);/);
});
