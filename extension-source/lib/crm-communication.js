/**
 * Helpers puros da Central de Comunicação do CRM.
 * O token OAuth nunca é persistido por este módulo; a autenticação fica no Chrome Identity.
 */
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
export const GMAIL_ORIGIN = 'https://gmail.googleapis.com/*';
export const CRM_EMAIL_MAX_SUBJECT = 200;
export const CRM_EMAIL_MAX_BODY = 20000;
export const CRM_EMAIL_MAX_TEMPLATES = 30;
export const CRM_EMAIL_MAX_ATTACHMENTS = 5;
export const CRM_EMAIL_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const CRM_EMAIL_MAX_SIGNATURE = 2000;

export const DEFAULT_CRM_EMAIL_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'first_contact', name: 'Primeiro contato',
    subject: 'Vamos conversar sobre {{produto}}',
    body: 'Olá, {{nome}}!\n\nTudo bem? Estou entrando em contato para dar continuidade ao nosso atendimento e entender melhor como podemos ajudar com {{produto}}.\n\nFico à disposição para conversarmos.\n\nAtenciosamente,\n{{vendedor}}',
  }),
  Object.freeze({
    id: 'proposal', name: 'Envio de proposta',
    subject: 'Proposta comercial — {{empresa}}',
    body: 'Olá, {{nome}}!\n\nConforme conversamos, estou encaminhando as informações da proposta para sua avaliação.\n\nSe tiver alguma dúvida ou desejar ajustar algum ponto, fico à disposição.\n\nAguardo seu retorno.\n\nAtenciosamente,\n{{vendedor}}',
  }),
  Object.freeze({
    id: 'follow_up', name: 'Acompanhamento',
    subject: 'Podemos dar continuidade à nossa conversa?',
    body: 'Olá, {{nome}}!\n\nPassando para saber se conseguiu avaliar as informações que encaminhei.\n\nSe precisar de algum esclarecimento ou quiser avançar, estou à disposição.\n\nAtenciosamente,\n{{vendedor}}',
  }),
]);

export function normalizeCrmEmailAddress(value) {
  const email = String(value || '').trim().slice(0, 254);
  if (!email || /[\r\n\0]/.test(email) || !/^[^\s@<>(),;:\\"\[\]]+@[^\s@<>(),;:\\"\[\]]+\.[^\s@<>(),;:\\"\[\]]{2,}$/.test(email)) return '';
  return email;
}

export function normalizeCrmEmailTemplate(input, index = 0) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const name = String(input.name || '').replace(/[\r\n\0]/g, ' ').trim().slice(0, 80);
  const subject = String(input.subject || '').replace(/[\r\n\0]/g, ' ').trim().slice(0, CRM_EMAIL_MAX_SUBJECT);
  const body = String(input.body || '').replace(/\0/g, '').trim().slice(0, CRM_EMAIL_MAX_BODY);
  if (!name || !subject || !body) return null;
  return {
    id: String(input.id || `email_template_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100),
    name, subject, body,
    updatedAt: String(input.updatedAt || new Date(0).toISOString()).slice(0, 40),
  };
}

export function normalizeCrmEmailTemplates(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input.slice(0, CRM_EMAIL_MAX_TEMPLATES).map(normalizeCrmEmailTemplate).filter((item) => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function normalizeCrmEmailSignatures(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const output = {};
  for (const [rawId, rawValue] of Object.entries(input).slice(0, 200)) {
    const id = String(rawId || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
    if (!id || !rawValue || typeof rawValue !== 'object') continue;
    const text = String(rawValue.text || '').replace(/\0/g, '').trim().slice(0, CRM_EMAIL_MAX_SIGNATURE);
    const deletedAt = String(rawValue.deletedAt || '').slice(0, 40);
    if (!text && !deletedAt) continue;
    output[id] = {
      text,
      updatedAt: String(rawValue.updatedAt || deletedAt || new Date(0).toISOString()).slice(0, 40),
      ...(deletedAt ? { deletedAt } : {}),
    };
  }
  return output;
}

export function mergeCrmEmailTemplates(local = [], remote = []) {
  const map = new Map();
  for (const item of [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])]) {
    const normalized = normalizeCrmEmailTemplates([item])[0];
    if (!normalized) continue;
    const previous = map.get(normalized.id);
    const nextTs = Date.parse(item.updatedAt || '') || 0;
    const previousTs = Date.parse(previous?.updatedAt || '') || 0;
    if (!previous || nextTs > previousTs) map.set(normalized.id, { ...normalized, updatedAt: item.updatedAt || null });
  }
  return [...map.values()].slice(0, CRM_EMAIL_MAX_TEMPLATES);
}

export function mergeCrmEmailSignatures(local = {}, remote = {}) {
  const a = normalizeCrmEmailSignatures(local);
  const b = normalizeCrmEmailSignatures(remote);
  const merged = { ...a };
  for (const [sellerId, signature] of Object.entries(b)) {
    const localTs = Date.parse(a[sellerId]?.updatedAt || '') || 0;
    const remoteTs = Date.parse(signature.updatedAt || '') || 0;
    if (!merged[sellerId] || remoteTs > localTs) merged[sellerId] = signature;
  }
  return merged;
}

export function renderCrmEmailTemplate(value, lead = {}, context = {}) {
  const replacements = {
    nome: String(lead.name || 'Olá').trim(),
    empresa: String(lead.company || lead.name || '').trim(),
    produto: String(lead.commercialProductName || lead.product || lead.service || lead.category || 'nossa solução').trim(),
    vendedor: String(context.sellerName || lead.commercialOwnerName || lead.ownerName || 'Equipe comercial').trim(),
  };
  return String(value || '').replace(/\{\{\s*(nome|empresa|produto|vendedor)\s*\}\}/gi, (_match, key) => replacements[String(key).toLowerCase()] || '');
}

function base64Utf8(value) {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

function wrapBase64(value, width = 76) {
  return String(value).match(new RegExp(`.{1,${width}}`, 'g'))?.join('\r\n') || '';
}

/** Monta MIME texto simples compatível com Gmail API e codifica em base64url. */
function sanitizeAttachmentName(value) {
  const name = String(value || 'arquivo').replace(/[\\/\x00-\x1f\x7f";]/g, '_').trim().slice(0, 180);
  return name || 'arquivo';
}

function normalizeAttachment(input) {
  if (!input || typeof input !== 'object') throw new Error('Anexo inválido.');
  const name = sanitizeAttachmentName(input.name);
  const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  const extensionMime = {
    pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    rtf: 'application/rtf', odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet',
    csv: 'text/csv', txt: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  };
  if (!Object.prototype.hasOwnProperty.call(extensionMime, extension)) throw new Error(`Tipo de arquivo não permitido: ${name}.`);
  const requestedMime = String(input.mimeType || '').toLowerCase().slice(0, 120);
  const mimeType = requestedMime && requestedMime !== 'application/octet-stream' ? requestedMime : extensionMime[extension];
  const data = String(input.data || '').replace(/\s/g, '');
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mimeType) || mimeType !== extensionMime[extension]) throw new Error(`Tipo de arquivo inválido: ${name}.`);
  if (!data || !/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length % 4 !== 0) throw new Error(`O conteúdo do anexo ${name} está inválido.`);
  const bytes = Math.floor(data.length * 3 / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
  if (!bytes) throw new Error(`O anexo ${name} está vazio.`);
  return { name, mimeType, data, size: bytes };
}

export function normalizeCrmEmailAttachments(input) {
  if (!Array.isArray(input)) return [];
  if (input.length > CRM_EMAIL_MAX_ATTACHMENTS) throw new Error(`Anexe no máximo ${CRM_EMAIL_MAX_ATTACHMENTS} arquivos por e-mail.`);
  const attachments = input.map(normalizeAttachment);
  const total = attachments.reduce((sum, item) => sum + item.size, 0);
  if (total > CRM_EMAIL_MAX_ATTACHMENT_BYTES) throw new Error('O tamanho total dos anexos ultrapassa 10 MB.');
  return attachments;
}

/** Monta MIME texto simples ou multipart/mixed com anexos, em base64url. */
export function buildGmailRawMessage({ to, subject, body, attachments = [] }) {
  const recipient = normalizeCrmEmailAddress(to);
  const cleanSubject = String(subject || '').replace(/[\r\n\0]/g, ' ').trim().slice(0, CRM_EMAIL_MAX_SUBJECT);
  const cleanBody = String(body || '').replace(/\0/g, '').trim().slice(0, CRM_EMAIL_MAX_BODY);
  if (!recipient) throw new Error('Informe um endereço de e-mail válido.');
  if (!cleanSubject) throw new Error('Informe o assunto do e-mail.');
  if (!cleanBody) throw new Error('Escreva a mensagem antes de enviar.');
  const encodedSubject = `=?UTF-8?B?${base64Utf8(cleanSubject)}?=`;
  const encodedBody = wrapBase64(base64Utf8(cleanBody));
  const safeAttachments = normalizeCrmEmailAttachments(attachments);
  let mime;
  if (!safeAttachments.length) {
    mime = [
      `To: ${recipient}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      encodedBody,
    ].join('\r\n');
  } else {
    const boundary = `i9hub_${globalThis.crypto?.randomUUID?.().replace(/-/g, '') || Date.now().toString(36)}`;
    const parts = [
      `To: ${recipient}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      encodedBody,
    ];
    for (const attachment of safeAttachments) {
      const asciiName = attachment.name.replace(/[^\x20-\x7e]/g, '_');
      const encodedName = encodeURIComponent(attachment.name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
      parts.push(
        `--${boundary}`,
        `Content-Type: ${attachment.mimeType}; name="${asciiName}"`,
        `Content-Disposition: attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        'Content-Transfer-Encoding: base64',
        '',
        wrapBase64(attachment.data),
      );
    }
    parts.push(`--${boundary}--`, '');
    mime = parts.join('\r\n');
  }
  return base64Utf8(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
