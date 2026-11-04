import { ed25519 } from './noble-ed25519.js';

function b64ToBytes(b64url) {
  const value = String(b64url || '');
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) throw new Error('Base64/base64url inválido');
  let b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const invalid = (error, message, payload) => ({ valid: false, error, message, ...(payload === undefined ? {} : { payload }) });

/**
 * Verifica token "base64url(payload).base64url(assinatura)" assinado com Ed25519.
 * A distribuição comercial usa somente chaves de produção e nunca faz fallback
 * para outra chave quando o token declara um kid conhecido/desconhecido.
 */
export function verifyExtensionToken(token, { now, expectedDeviceId, publicKeysMap } = {}) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return invalid('MALFORMED_TOKEN', 'Token deve ter 2 partes');
  const [payloadB64, sigB64] = parts;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64ToBytes(payloadB64)));
  } catch {
    return invalid('MALFORMED_TOKEN', 'Payload JSON inválido');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return invalid('MALFORMED_TOKEN', 'Payload deve ser um objeto JSON');
  }

  const keys = publicKeysMap && typeof publicKeysMap === 'object' ? publicKeysMap : {};
  let keysToTry;
  if (Object.prototype.hasOwnProperty.call(payload, 'kid')) {
    if (typeof payload.kid !== 'string' || !payload.kid.trim() || !Object.prototype.hasOwnProperty.call(keys, payload.kid)) {
      return invalid('UNKNOWN_KEY_ID', 'A chave de assinatura do token não é confiável', payload);
    }
    keysToTry = [[payload.kid, keys[payload.kid]]];
  } else {
    // Compatibilidade com tokens legados sem kid; somente chaves explicitamente confiáveis.
    keysToTry = Object.entries(keys);
  }
  if (!keysToTry.length) return invalid('NO_TRUSTED_KEYS', 'Nenhuma chave pública confiável está configurada', payload);

  let signatureValid = false;
  let lastError = null;
  for (const [kid, keyB64] of keysToTry) {
    try {
      const pub = b64ToBytes(keyB64);
      const sig = b64ToBytes(sigB64);
      if (pub.length !== 32 || sig.length !== 64) {
        lastError = invalid('INVALID_SIGNATURE', `Tamanho inválido da chave/assinatura (${kid})`, payload);
        continue;
      }
      const ok = ed25519.verify(sig, new TextEncoder().encode(payloadB64), pub);
      if (ok) { signatureValid = true; break; }
      lastError = invalid('INVALID_SIGNATURE', `Assinatura inválida (${kid})`, payload);
    } catch {
      lastError = invalid('INVALID_SIGNATURE', 'Não foi possível verificar a assinatura', payload);
    }
  }
  if (!signatureValid) return lastError || invalid('INVALID_SIGNATURE', 'Assinatura inválida', payload);

  const t = Number.isSafeInteger(now) ? now : Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(payload.exp) || payload.exp <= 0) {
    return invalid('INVALID_EXPIRY', 'Token sem expiração válida', payload);
  }
  if (typeof payload.did !== 'string' || !payload.did.trim()) {
    return invalid('INVALID_DEVICE_CLAIM', 'Token sem identificador de dispositivo válido', payload);
  }
  if (expectedDeviceId && payload.did !== expectedDeviceId) {
    return invalid('DEVICE_MISMATCH', 'Dispositivo divergente do autorizado no token', payload);
  }
  if (payload.nbf !== undefined) {
    if (!Number.isSafeInteger(payload.nbf) || payload.nbf <= 0) return invalid('INVALID_NOT_BEFORE', 'Campo nbf inválido', payload);
    if (t < payload.nbf) return invalid('TOKEN_NOT_YET_VALID', 'Token ainda não está válido', payload);
  }
  if (payload.iat !== undefined) {
    if (!Number.isSafeInteger(payload.iat) || payload.iat <= 0) return invalid('INVALID_ISSUED_AT', 'Campo iat inválido', payload);
    if (payload.iat > t + 300) return invalid('TOKEN_ISSUED_IN_FUTURE', 'Token emitido em horário futuro', payload);
  }
  if (t >= payload.exp) return invalid('TOKEN_EXPIRED', 'Token expirado', payload);
  return { valid: true, payload };
}
