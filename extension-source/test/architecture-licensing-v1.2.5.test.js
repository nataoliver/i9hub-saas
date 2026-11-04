import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTION_FEATURE_MAP, ACTION_REQUIRED_FEATURES, CORE_ACTIONS, FEATURE_CATALOG,
  FEATURE_CATALOG_VERSION, PUBLIC_ACTIONS, SAFETY_ACTIONS, getFeatureAccess,
  getFeatureCatalogForToken, hasConfiguredEntitlements, hasFeatureEntitlement,
} from '../lib/feature-catalog.js';
import { evaluateActionAuthorization, filterSettingsByEntitlements, getLicenseLimit, getRequiredFeaturesForAction } from '../lib/license-policy.js';
import { MODULE_REGISTRY, getFeatureModuleId, getModuleRegistryForEntitlements } from '../lib/module-registry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const licensedState = (ent) => ({ licensed: true, plan: 'pro', payload: { ent } });

test('catálogo v10 mantém 86 IDs e ativa a Central Comercial da Fase 08', () => {
  assert.equal(FEATURE_CATALOG_VERSION, 14);
  assert.equal(FEATURE_CATALOG.length, 91);
  assert.equal(FEATURE_CATALOG.filter((feature) => feature.implemented === true).length, 89);
  const planned = FEATURE_CATALOG.filter((feature) => feature.status === 'planned');
  assert.equal(planned.length, 1);
  assert.equal(FEATURE_CATALOG.find((feature) => feature.id === 'google.calendar.automation')?.implemented, true);
  assert.equal(FEATURE_CATALOG.find((feature) => feature.id === 'dashboard.commercial_agenda')?.implemented, true);
});

test('IDs desconhecidos, recursos não implementados e privilégios implícitos são negados', () => {
  assert.equal(hasFeatureEntitlement(['unknown.permission'], 'unknown.permission'), false);
  assert.equal(hasFeatureEntitlement(['rcs.campaigns'], 'rcs.campaigns'), false);
  assert.equal(hasFeatureEntitlement(['*'], 'admin.full_access'), false);
  assert.equal(hasFeatureEntitlement(['all'], 'admin.full_access'), false);
  assert.equal(hasFeatureEntitlement(['admin.full_access'], 'crm.leads'), true);
  assert.equal(hasConfiguredEntitlements(['unknown.permission']), false);
  assert.equal(hasConfiguredEntitlements(['admin.full_access']), true);
});

test('dependências são avaliadas no mesmo ponto de verdade para UI e service worker', () => {
  assert.equal(hasFeatureEntitlement(['whatsapp.ai_support.configure'], 'whatsapp.ai_support.configure'), false);
  assert.equal(getFeatureAccess(['crm.leads', 'whatsapp.ai_support.configure'], 'whatsapp.ai_support.configure').reason, 'DEPENDENCY_MISSING');
  assert.equal(hasFeatureEntitlement(['whatsapp.ai_support', 'whatsapp.ai_support.configure'], 'whatsapp.ai_support.configure'), true);
  assert.equal(hasFeatureEntitlement(['whatsapp.labels_sync', 'whatsapp.connection', 'whatsapp.status_audience'], 'whatsapp.status_audience'), true);
  assert.equal(hasFeatureEntitlement(['telemetry.sales_funnel'], 'telemetry.sales_funnel'), false);
  assert.equal(hasFeatureEntitlement(['telemetry.usage', 'telemetry.sales_funnel'], 'telemetry.sales_funnel'), true);
});

test('catálogo retornado à interface libera automação de agenda para licença administrativa com dependências', () => {
  const catalog = getFeatureCatalogForToken(['admin.full_access']);
  const automation = catalog.find((feature) => feature.id === 'google.calendar.automation');
  const current = catalog.find((feature) => feature.id === 'crm.leads');
  assert.equal(automation.enabled, true);
  assert.equal(current.enabled, true);
});

test('nenhuma ação operacional é liberada sem licença; somente metadados e segurança são exceções', () => {
  assert.equal(CORE_ACTIONS.size, 0);
  for (const action of ['WA_OPEN_NEW_TAB', 'GET_SAVED_LEADS', 'GET_STAGES', 'SYNC_PRIVATE_OPPORTUNITIES', 'UPDATE_LEAD_STAGE', 'START_CAMPAIGN']) {
    assert.equal(evaluateActionAuthorization({ type: action, state: { licensed: false } }).allowed, false, `${action} não pode ser usado sem licença`);
  }
  assert.equal(evaluateActionAuthorization({ type: 'GET_LICENSE_STATUS', state: { licensed: false } }).allowed, true);
  assert.equal(evaluateActionAuthorization({ type: 'STOP_CAMPAIGN', state: { licensed: false } }).allowed, true);
  assert.equal(evaluateActionAuthorization({ type: 'CONSENT_UPDATE', state: { licensed: false } }).allowed, true);
});

test('edição da identidade do lead exige o novo entitlement e mantém dependência de CRM', () => {
  assert.equal(ACTION_FEATURE_MAP.UPDATE_LEAD_IDENTITY, 'crm.lead.identity_edit');
  assert.equal(evaluateActionAuthorization({ type: 'UPDATE_LEAD_IDENTITY', state: { licensed: false } }).allowed, false);
  assert.equal(evaluateActionAuthorization({ type: 'UPDATE_LEAD_IDENTITY', state: licensedState(['crm.leads']) }).code, 'FEATURE_NOT_INCLUDED');
  assert.equal(evaluateActionAuthorization({ type: 'UPDATE_LEAD_IDENTITY', state: licensedState(['crm.leads', 'crm.lead.identity_edit']) }).allowed, true);
});

test('ações operacionais exigem entitlement explícito e handler sem mapeamento falha fechado', () => {
  assert.equal(evaluateActionAuthorization({ type: 'GET_SAVED_LEADS', state: licensedState([]) }).code, 'LICENSE_PERMISSIONS_MISSING');
  assert.equal(evaluateActionAuthorization({ type: 'GET_SAVED_LEADS', state: licensedState(['crm.leads']) }).allowed, true);
  assert.equal(evaluateActionAuthorization({ type: 'SOME_NEW_HANDLER', state: licensedState(['crm.leads']) }).code, 'FEATURE_NOT_CONFIGURED');
});

test('ações compostas de campanha exigem envio e conexão do WhatsApp', () => {
  assert.deepEqual(getRequiredFeaturesForAction('START_CAMPAIGN', {}, ['whatsapp.campaigns.send']), ['whatsapp.campaigns.send', 'whatsapp.connection']);
  assert.equal(evaluateActionAuthorization({ type: 'START_CAMPAIGN', state: licensedState(['whatsapp.campaigns.send']) }).allowed, false);
  assert.equal(evaluateActionAuthorization({ type: 'START_CAMPAIGN', state: licensedState(['whatsapp.campaigns.send', 'whatsapp.connection']) }).allowed, true);
});

test('ações exclusivas do proprietário não são concedidas por wildcard comercial', () => {
  assert.equal(evaluateActionAuthorization({ type: 'MARKETING_SAVE_CONFIG', state: licensedState(['*']) }).code, 'OWNER_ONLY');
  assert.equal(evaluateActionAuthorization({ type: 'MARKETING_SAVE_CONFIG', state: licensedState(['admin.full_access']) }).allowed, true);
});

test('configurações são filtradas pelo mesmo catálogo de permissões', () => {
  const settings = { darkTheme: true, webhookUrl: 'https://example.test', delayMsgMin: 2, licenseKey: 'never-expose' };
  assert.deepEqual(filterSettingsByEntitlements(settings, ['settings.appearance']), { darkTheme: true });
  assert.deepEqual(filterSettingsByEntitlements(settings, ['settings.general']), { darkTheme: true, webhookUrl: 'https://example.test', delayMsgMin: 2 });
});

test('registro modular cobre todas as funcionalidades e calcula disponibilidade por licença', () => {
  const registeredIds = new Set(MODULE_REGISTRY.flatMap((module) => module.featureIds));
  for (const feature of FEATURE_CATALOG) assert.ok(registeredIds.has(feature.id), `feature sem módulo: ${feature.id}`);
  for (const feature of FEATURE_CATALOG) assert.ok(getFeatureModuleId(feature), `módulo não resolvido: ${feature.id}`);
  const modules = getModuleRegistryForEntitlements(['crm.leads']);
  const crm = modules.find((module) => module.id === 'crm');
  assert.ok(crm);
  assert.ok(crm.enabledFeatureIds.includes('crm.leads'));
  assert.equal(crm.plannedCount, 1);
});

test('limites da licença aceitam somente valores escalares não negativos', () => {
  assert.equal(getLicenseLimit({ 'campaigns.monthly': 100, 'devices.max': 2, unsafe: -1, nested: { x: 1 } }, 'campaigns.monthly'), 100);
  assert.equal(getLicenseLimit({ 'campaigns.monthly': 100 }, 'missing', 0), 0);
});

test('todos os IDs mapeados e dependências existem no catálogo; dependências não formam ciclos', () => {
  const ids = new Set(FEATURE_CATALOG.map((feature) => feature.id));
  const byId = new Map(FEATURE_CATALOG.map((feature) => [feature.id, feature]));
  for (const [action, featureId] of Object.entries(ACTION_FEATURE_MAP)) assert.ok(ids.has(featureId), `${action}: ${featureId}`);
  for (const [action, required] of Object.entries(ACTION_REQUIRED_FEATURES)) for (const featureId of required) assert.ok(ids.has(featureId), `${action}: ${featureId}`);
  for (const feature of FEATURE_CATALOG) for (const dependency of feature.requires || []) assert.ok(ids.has(dependency), `${feature.id} depende de ID inexistente ${dependency}`);
  const visiting = new Set(); const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) throw new Error(`ciclo de dependência detectado em ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.requires || []) visit(dependency);
    visiting.delete(id); visited.add(id);
  };
  for (const id of ids) visit(id);
});

test('service worker protege a ingestão passiva de oportunidades e da fila de IA', () => {
  const worker = fs.readFileSync(path.join(root, 'background/service-worker.js'), 'utf8');
  assert.match(worker, /const authorization = await gate\('SYNC_PRIVATE_OPPORTUNITIES', payload\)/);
  assert.match(worker, /evaluateActionAuthorization\(\{ type: 'AI_INCOMING_MESSAGE', payload, state: licenseState \}\)/);
  assert.match(worker, /evaluateActionAuthorization\(\{ type, payload, state \}\)/);
});

test('catálogo e contrato são aditivos e mantêm formato de token Ed25519 existente', () => {
  const verifier = fs.readFileSync(path.join(root, 'lib/verify-token.js'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'background/service-worker.js'), 'utf8');
  assert.match(verifier, /ed25519\.verify/);
  assert.match(verifier, /payload\.exp/);
  assert.match(verifier, /payload\.did/);
  assert.match(worker, /verifyExtensionToken\(token, \{ expectedDeviceId: deviceId, publicKeysMap: TRUSTED_PUBLIC_KEYS \}\)/);
  assert.match(worker, /featureCatalogVersion: FEATURE_CATALOG_VERSION/);
  assert.match(worker, /licenseContractVersion: LICENSE_CONTRACT_VERSION/);
  assert.match(worker, /modules: getModuleRegistryForEntitlements/);
  assert.match(worker, /limits: normalizeLicenseLimits/);
});
