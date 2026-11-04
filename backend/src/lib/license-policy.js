/**
 * Política central de autorização do i9Hub.
 * Este módulo é puro: não acessa APIs do Chrome e pode ser testado no Node.
 */
import {
  ACTION_FEATURE_MAP, ACTION_REQUIRED_FEATURES, CORE_ACTIONS, FEATURE_CATALOG,
  PUBLIC_ACTIONS, SAFETY_ACTIONS, featureName, getEntitlementIds,
  hasConfiguredEntitlements, hasFeatureEntitlement,
} from './feature-catalog.js';

export const LICENSE_CONTRACT_VERSION = 1;
export const OWNER_ONLY_ACTIONS = new Set(['MARKETING_GET_CONFIG', 'MARKETING_SAVE_CONFIG']);

export const SETTINGS_FEATURE_IDS = Object.freeze([
  'settings.general', 'settings.webhook', 'settings.spintax', 'settings.delays',
  'settings.classifier', 'settings.privacy', 'settings.appearance',
]);

const SETTINGS_KEY_FEATURE = Object.freeze({
  webhookUrl: 'settings.webhook', webhookMethod: 'settings.webhook', webhookContentType: 'settings.webhook', webhookHeaders: 'settings.webhook', webhookApiKey: 'settings.webhook',
  spintaxPresets: 'settings.spintax',
  delayMsgMin: 'settings.delays', delayMsgMax: 'settings.delays', delayContactMin: 'settings.delays', delayContactMax: 'settings.delays', delayErrorMin: 'settings.delays', delayErrorMax: 'settings.delays',
  classifier: 'settings.classifier',
  darkTheme: 'settings.appearance', compactMode: 'settings.appearance',
  businessProfile: 'business.profile',
});

export function settingsFeatureForKey(key) {
  return SETTINGS_KEY_FEATURE[key] || 'settings.general';
}

export function filterSettingsByEntitlements(settings, entitlements) {
  const filtered = {};
  for (const [key, value] of Object.entries(settings || {})) {
    if (key === 'licenseKey') continue;
    if (hasFeatureEntitlement(entitlements, settingsFeatureForKey(key))) filtered[key] = value;
  }
  return filtered;
}

export function getRequiredFeaturesForAction(type, payload = {}, entitlements = []) {
  if (type === 'GET_SETTINGS') {
    const allowedSettings = SETTINGS_FEATURE_IDS.filter((featureId) => hasFeatureEntitlement(entitlements, featureId));
    return allowedSettings.length ? allowedSettings : ['settings.general'];
  }
  if (type === 'SAVE_SETTINGS') {
    const keys = Object.keys(payload && typeof payload === 'object' ? payload : {});
    return [...new Set((keys.length ? keys : ['']).map(settingsFeatureForKey))];
  }
  const required = ACTION_REQUIRED_FEATURES[type] || (ACTION_FEATURE_MAP[type] ? [ACTION_FEATURE_MAP[type]] : []);
  return [...new Set(required)];
}

export function hasOwnerAdminAccess(state) {
  const role = String(state?.payload?.role || state?.payload?.accountRole || state?.payload?.licenseRole || '').trim().toLowerCase();
  return ['owner', 'admin', 'administrator', 'proprietario', 'proprietário'].includes(role)
    || hasFeatureEntitlement(state?.payload?.ent, 'admin.full_access');
}

export function evaluateActionAuthorization({ type, payload = {}, state = {} } = {}) {
  if (PUBLIC_ACTIONS.has(type)) return { allowed: true, bypass: 'public', reason: 'PUBLIC_ACTION' };
  if (SAFETY_ACTIONS.has(type)) return { allowed: true, bypass: 'safety', reason: 'SAFETY_ACTION' };
  if (CORE_ACTIONS.has(type)) return { allowed: true, bypass: 'core', reason: 'CORE_ACTION' };

  if (!state.licensed) {
    return { allowed: false, code: 'LICENSE_REQUIRED', error: 'Para utilizar as funcionalidades, solicite sua conta gratuita e ative a licença emitida pelo painel administrativo.' };
  }
  if (!hasConfiguredEntitlements(state.payload?.ent)) {
    return { allowed: false, code: 'LICENSE_PERMISSIONS_MISSING', error: 'A licença foi validada, mas não contém permissões de funcionalidades. O painel administrativo precisa emitir os direitos deste plano.' };
  }
  if (OWNER_ONLY_ACTIONS.has(type) && !hasOwnerAdminAccess(state)) {
    return { allowed: false, code: 'OWNER_ONLY', error: 'Esta operação é exclusiva da licença administrativa do proprietário do i9Hub.' };
  }

  const requiredFeatures = getRequiredFeaturesForAction(type, payload, state.payload?.ent);
  if (!requiredFeatures.length) {
    return { allowed: false, code: 'FEATURE_NOT_CONFIGURED', error: 'Esta operação ainda não está vinculada a uma permissão do catálogo. Por segurança, ela foi bloqueada.' };
  }
  const missingFeature = requiredFeatures.find((featureId) => !hasFeatureEntitlement(state.payload?.ent, featureId));
  if (missingFeature) {
    return {
      allowed: false,
      code: 'FEATURE_NOT_INCLUDED',
      featureId: missingFeature,
      featureName: featureName(missingFeature),
      error: `A funcionalidade "${featureName(missingFeature)}" não está liberada para esta licença.`,
    };
  }
  return { allowed: true, licensed: true, featureId: requiredFeatures[0], requiredFeatures, state };
}

export function isReadOnlyAction(type) {
  return String(type || '').startsWith('GET_') || [
    'WA_STATUS', 'WA_GET_EMBED', 'DRIVE_GET_STATUS', 'AUDIENCE_GET', 'MARKETING_GET_CONFIG',
    'TELEMETRY_GET_PROFILE', 'TELEMETRY_GET_STATUS', 'AI_GET_CONFIG', 'AI_GET_STATUS', 'AI_GET_ORDERS', 'AI_GET_HANDOFFS', 'TRACK_TELEMETRY_EVENT',
    'DASHBOARD_GET_COMMERCIAL_PERFORMANCE', 'DASHBOARD_GET_MANAGEMENT_INTELLIGENCE', 'COMMERCIAL_MANAGEMENT_GET', 'GET_CRM_EMAIL_STATUS',
  ].includes(type);
}

/** Aceita somente limites escalares, finitos e não negativos assinados pelo painel. */
export function normalizeLicenseLimits(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const limits = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(key)) continue;
    if (typeof value === 'boolean') limits[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value) && value >= 0) limits[key] = value;
  }
  return limits;
}

export function getLicenseLimit(limits, key, fallback = null) {
  const normalized = normalizeLicenseLimits(limits);
  return Object.prototype.hasOwnProperty.call(normalized, key) ? normalized[key] : fallback;
}

export function getLicenseEntitlementSummary(entitlements) {
  const ids = getEntitlementIds(entitlements);
  return { ids, configured: hasConfiguredEntitlements(ids), ownerFullAccess: ids.includes('admin.full_access') };
}
