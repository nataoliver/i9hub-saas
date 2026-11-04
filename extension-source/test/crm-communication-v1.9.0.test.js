import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_CRM_EMAIL_TEMPLATES,
  GMAIL_SEND_SCOPE,
  buildGmailRawMessage,
  normalizeCrmEmailAddress,
  normalizeCrmEmailTemplates,
  renderCrmEmailTemplate,
} from '../lib/crm-communication.js';
import {
  ACTION_FEATURE_MAP,
  ACTION_REQUIRED_FEATURES,
  FEATURE_CATALOG,
  FEATURE_CATALOG_VERSION,
  getFeatureAccess,
} from '../lib/feature-catalog.js';
import { evaluateActionAuthorization } from '../lib/license-policy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

function decodeBase64Url(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  return atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
}

test('Fase 13 adiciona o envio Gmail ao catálogo v13 sem remover direitos anteriores', () => {
  assert.equal(FEATURE_CATALOG_VERSION, 14);
  assert.equal(FEATURE_CATALOG.length, 91);
  assert.equal(FEATURE_CATALOG.filter((feature) => feature.implemented === true).length, 89);
  const feature = FEATURE_CATALOG.find((item) => item.id === 'crm.communication.email');
  assert.equal(feature?.implemented, true);
  assert.equal(feature?.phase, 13);
  assert.ok(feature.requires.includes('crm.leads'));
  assert.equal(ACTION_FEATURE_MAP.OPEN_CRM_LEAD_CHAT, 'crm.leads');
  assert.equal(ACTION_FEATURE_MAP.SEND_CRM_EMAIL, 'crm.communication.email');
  assert.deepEqual(ACTION_REQUIRED_FEATURES.OPEN_CRM_LEAD_CHAT, ['crm.leads', 'whatsapp.connection']);
  assert.ok(ACTION_REQUIRED_FEATURES.SEND_CRM_EMAIL.includes('crm.leads'));
  assert.ok(ACTION_REQUIRED_FEATURES.SEND_CRM_EMAIL.includes('crm.communication.email'));
  assert.equal(getFeatureAccess(['crm.leads'], 'crm.communication.email').allowed, false);
  assert.equal(getFeatureAccess(['crm.leads', 'crm.communication.email'], 'crm.communication.email').allowed, true);
  assert.equal(evaluateActionAuthorization({ type: 'OPEN_CRM_LEAD_CHAT', state: { licensed: true, payload: { ent: ['crm.leads', 'whatsapp.connection'] } } }).allowed, true);
  assert.equal(evaluateActionAuthorization({ type: 'OPEN_CRM_LEAD_CHAT', state: { licensed: true, payload: { ent: ['crm.leads'] } } }).allowed, false);
  assert.equal(evaluateActionAuthorization({ type: 'SEND_CRM_EMAIL', state: { licensed: true, payload: { ent: ['crm.leads'] } } }).allowed, false);
  assert.equal(evaluateActionAuthorization({ type: 'SEND_CRM_EMAIL', state: { licensed: true, payload: { ent: ['crm.leads', 'crm.communication.email'] } } }).allowed, true);
});

test('validação de destinatário bloqueia cabeçalhos injetados e endereços inválidos', () => {
  assert.equal(normalizeCrmEmailAddress(' joao@empresa.com '), 'joao@empresa.com');
  assert.equal(normalizeCrmEmailAddress('nao-e-email'), '');
  assert.equal(normalizeCrmEmailAddress('joao@empresa.com\r\nBcc: atacante@exemplo.com'), '');
});

test('mensagem MIME preserva acentos, assunto e corpo em UTF-8 e não aceita header injection', () => {
  const raw = buildGmailRawMessage({
    to: 'joao@empresa.com',
    subject: 'Proposta — João e José',
    body: 'Olá, João!\nSegue a proposta com condições especiais.',
  });
  const mime = decodeBase64Url(raw);
  assert.match(mime, /To: joao@empresa\.com/);
  assert.match(mime, /Subject: =\?UTF-8\?B\?/);
  assert.match(mime, /Content-Type: text\/plain; charset=UTF-8/);
  const bodyEncoded = mime.split('\r\n\r\n').at(-1).replace(/\r\n/g, '');
  const body = new TextDecoder().decode(Uint8Array.from(atob(bodyEncoded), (char) => char.charCodeAt(0)));
  assert.equal(body, 'Olá, João!\nSegue a proposta com condições especiais.');
  const sanitized = decodeBase64Url(buildGmailRawMessage({ to: 'joao@empresa.com', subject: 'Olá\r\nBcc: x@y.com', body: 'Teste' }));
  assert.equal((sanitized.match(/Bcc:/g) || []).length, 0, 'quebra de linha não pode criar um cabeçalho Bcc');
});

test('modelos padrão são renderizados com dados do lead e modelos salvos são normalizados', () => {
  const first = DEFAULT_CRM_EMAIL_TEMPLATES[0];
  const rendered = renderCrmEmailTemplate(first.body, { name: 'João', company: 'ACME', category: 'Consultoria' }, { sellerName: 'Marina' });
  assert.match(rendered, /Olá, João!/);
  assert.match(rendered, /Consultoria/);
  assert.match(rendered, /Marina/);
  const templates = normalizeCrmEmailTemplates([
    { id: 'custom-1', name: 'Proposta', subject: 'Proposta para {{nome}}', body: 'Olá {{nome}}' },
    { id: 'custom-1', name: 'Duplicado', subject: 'X', body: 'Y' },
    { name: '', subject: 'Sem nome', body: 'Teste' },
  ]);
  assert.equal(templates.length, 1);
  assert.equal(templates[0].id, 'custom-1');
});

test('WhatsApp do card CRM e Gmail usam handlers licenciados, com registro de atividade sem salvar o corpo do e-mail', () => {
  const worker = read('background/service-worker.js');
  const crm = read('sidepanel/components/CRMView.js');
  const leadModal = read('sidepanel/components/LeadModal.js');
  const composer = read('sidepanel/components/CommunicationModal.js');
  const api = read('sidepanel/utils/api.js');
  assert.match(worker, /async OPEN_CRM_LEAD_CHAT\(p\) \{ return openWhatsAppChatForCrm/);
  assert.match(worker, /type: 'OPEN_CHAT_BY_PHONE'/);
  assert.match(worker, /await bringWaToFront\(wa\.tab\)/);
  assert.match(worker, /emailOptedOut === true/);
  assert.match(worker, /communication\.whatsapp\.opened/);
  assert.match(worker, /async SEND_CRM_EMAIL\(p\)/);
  assert.match(worker, /gmailApiRequest\('\/messages\/send'/);
  assert.match(worker, /gmailApiRequest\('\/profile/);
  assert.match(worker, /async SYNC_CRM_EMAIL_REPLIES\(p\)/);
  assert.match(worker, /communication\.email\.sent/);
  assert.match(worker, /description: `Para: \$\{to\} · Assunto: \$\{subject\}`/);
  assert.doesNotMatch(worker, /metadata: \{[^}]*body,/s);
  assert.match(crm, /kanban-act-wa/);
  assert.match(crm, /kanban-act-email/);
  assert.match(crm, /btn-open-wa/);
  assert.match(crm, /btn-send-email/);
  assert.match(leadModal, /data-action="open-whatsapp"/);
  assert.match(leadModal, /data-action="send-email"/);
  assert.match(leadModal, /crmCommunicationHistoryHTML/);
  assert.match(leadModal, /Histórico de comunicação/);
  assert.match(composer, /Conectar conta/);
  assert.match(composer, /Confirmo que este contato pode receber este e-mail/);
  assert.match(composer, /saveCrmEmailTemplates/);
  assert.match(api, /openCrmLeadChat\(lead\)/);
  assert.match(api, /sendCrmEmail\(payload\)/);
});

test('manifesto declara escopo mínimo gmail.send e permissão de host opcional', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.ok(manifest.oauth2.scopes.includes(GMAIL_SEND_SCOPE));
  assert.ok(manifest.oauth2.scopes.includes('https://www.googleapis.com/auth/gmail.readonly'), 'o escopo de leitura é usado apenas quando o usuário sincroniza respostas');
  assert.ok(manifest.optional_host_permissions.includes('https://gmail.googleapis.com/*'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.equal(JSON.parse(read('package.json')).version, '1.0.0');
  assert.match(read('content/content.js'), /0\.0\.1\.0/);
  assert.match(read('content/injected.js'), /0\.0\.1\.0/);
});
