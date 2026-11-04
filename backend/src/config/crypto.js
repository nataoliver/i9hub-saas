// backend/src/config/crypto.js
// Cofre AES-256-GCM para chaves de API dos tenants (IA, WhatsApp, etc.)
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getMasterKey() {
  const raw = process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) throw new Error('ENCRYPTION_MASTER_KEY não configurada no ambiente.');
  const buf = Buffer.from(raw, 'hex');
  if (buf.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_MASTER_KEY deve ter ${KEY_LENGTH} bytes (64 hex chars). Recebido: ${buf.length}`);
  }
  return buf;
}

/**
 * Criptografa um segredo usando AES-256-GCM.
 * Retorna string base64 no formato: iv:tag:ciphertext
 */
export function encryptSecret(plaintext) {
  if (!plaintext) return '';
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Descriptografa um segredo previamente criptografado com encryptSecret().
 * Espera string base64 no formato: iv(12):tag(16):ciphertext
 */
export function decryptSecret(encoded) {
  if (!encoded) return '';
  try {
    const key = getMasterKey();
    const buf = Buffer.from(encoded, 'base64');
    if (buf.length < IV_LENGTH + TAG_LENGTH + 1) return '';
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('[Crypto] Falha ao descriptografar:', err.message);
    return '';
  }
}