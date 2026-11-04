import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CRM_EMAIL_MAX_ATTACHMENT_BYTES,
  CRM_EMAIL_MAX_ATTACHMENTS,
  GMAIL_READ_SCOPE,
  buildGmailRawMessage,
  mergeCrmEmailSignatures,
  mergeCrmEmailTemplates,
  normalizeCrmEmailSignatures,
} from '../lib/crm-communication.js';
import { ACTION_FEATURE_MAP, ACTION_REQUIRED_FEATURES, FEATURE_CATALOG, FEATURE_CATALOG_VERSION } from '../lib/feature-catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const decodeBase64Url = (value) => {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  return atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
};

const tinyPdf = btoa('%PDF-1.4\nphase14\n');

test('Fase 14 amplia o catálogo para v14 e libera somente leitura Gmail como direito adicional', () => {
  assert.equal(FEATURE_CATALOG_VERSION, 14);
  assert.equal(FEATURE_CATALOG.length, 91);
  assert.equal(FEATURE_CATALOG.filter((item) => item.implemented === true).length, 89);
  assert.equal(FEATURE_CATALOG.find((item) => item.id === 'crm.communication.email.read')?.implemented, true);
  assert.deepEqual(FEATURE_CATALOG.find((item) => item.id === 'crm.communication.email.read')?.requires, ['crm.leads', 'crm.communication.email']);
  assert.equal(FEATURE_CATALOG.find((item) => item.id === 'crm.communication.outlook')?.implemented, false);
  assert.equal(ACTION_FEATURE_MAP.SYNC_CRM_EMAIL_REPLIES, 'crm.communication.email.read');
  assert.ok(ACTION_REQUIRED_FEATURES.SYNC_CRM_EMAIL_REPLIES.includes('crm.communication.email'));
  assert.equal(GMAIL_READ_SCOPE, 'https://www.googleapis.com/auth/gmail.readonly');
});

test('anexos MIME suportam arquivos permitidos e recusam executáveis, injeção e excesso de tamanho', () => {
  const raw = buildGmailRawMessage({
    to: 'cliente@empresa.com', subject: 'Proposta', body: 'Segue arquivo.',
    attachments: [{ name: 'proposta.pdf', mimeType: 'application/pdf', data: tinyPdf }],
  });
  const mime = decodeBase64Url(raw);
  assert.match(mime, /multipart\/mixed/);
  assert.match(mime, /filename="proposta\.pdf"/);
  assert.match(mime, /Content-Type: application\/pdf/);
  assert.throws(() => buildGmailRawMessage({ to: 'a@b.com', subject: 'x', body: 'y', attachments: [{ name: 'payload.exe', mimeType: 'application/octet-stream', data: tinyPdf }] }), /não permitido/i);
  assert.throws(() => buildGmailRawMessage({ to: 'a@b.com', subject: 'x', body: 'y', attachments: Array.from({ length: CRM_EMAIL_MAX_ATTACHMENTS + 1 }, (_, i) => ({ name: `f${i}.pdf`, mimeType: 'application/pdf', data: tinyPdf })) }), /no máximo/i);
  const oversized = btoa('x'.repeat(CRM_EMAIL_MAX_ATTACHMENT_BYTES + 1));
  assert.throws(() => buildGmailRawMessage({ to: 'a@b.com', subject: 'x', body: 'y', attachments: [{ name: 'big.txt', mimeType: 'text/plain', data: oversized }] }), /10 MB/i);
});

test('modelos e assinaturas mesclam por ID e updatedAt sem perder dados de outro dispositivo', () => {
  const templates = mergeCrmEmailTemplates(
    [{ id: 't1', name: 'Modelo local', subject: 'Local', body: 'Texto local', updatedAt: '2026-10-01T10:00:00.000Z' }],
    [
      { id: 't1', name: 'Modelo remoto', subject: 'Remoto', body: 'Texto remoto', updatedAt: '2026-10-02T10:00:00.000Z' },
      { id: 't2', name: 'Outro', subject: 'Outro', body: 'Outro texto', updatedAt: '2026-10-01T11:00:00.000Z' },
    ],
  );
  assert.equal(templates.length, 2);
  assert.equal(templates.find((item) => item.id === 't1').subject, 'Remoto');
  const signatures = mergeCrmEmailSignatures(
    { seller_a: { text: 'Assinatura antiga', updatedAt: '2026-10-01T10:00:00.000Z' } },
    { seller_a: { text: 'Assinatura nova', updatedAt: '2026-10-02T10:00:00.000Z' }, seller_b: { text: 'Outra assinatura' }, seller_c: { text: '', deletedAt: '2026-10-03T10:00:00.000Z' } },
  );
  assert.equal(signatures.seller_a.text, 'Assinatura nova');
  assert.equal(signatures.seller_b.text, 'Outra assinatura');
  assert.equal(signatures.seller_c.deletedAt, '2026-10-03T10:00:00.000Z');
  assert.deepEqual(normalizeCrmEmailSignatures({ bad: null }), {});
});

test('handlers, interface e Drive cobrem múltiplas contas, respostas, assinatura, consentimento e indicadores', () => {
  const worker = read('background/service-worker.js');
  const composer = read('sidepanel/components/CommunicationModal.js');
  const leadModal = read('sidepanel/components/LeadModal.js');
  const crm = read('sidepanel/components/CRMView.js');
  const drive = read('background/drive-sync.js');
  const api = read('sidepanel/utils/api.js');
  const settings = read('sidepanel/components/SettingsView.js');
  for (const action of ['SELECT_CRM_GMAIL_ACCOUNT', 'SYNC_CRM_EMAIL_REPLIES', 'GET_CRM_EMAIL_SIGNATURE', 'SAVE_CRM_EMAIL_SIGNATURE', 'GET_CRM_COMMUNICATION_METRICS', 'SET_CRM_EMAIL_CONSENT']) {
    assert.match(worker, new RegExp(`async ${action}\\(`), `${action} deve ter handler`);
  }
  assert.match(worker, /identity\?\.getAccounts/);
  assert.match(worker, /GMAIL_READ_SCOPE/);
  assert.match(worker, /threadId/);
  assert.match(worker, /replyMessageIds/);
  assert.match(worker, /const leadsForReplies = await getLeads\(\)/);
  assert.match(worker, /event\?\.metadata\?\.threadId/);
  assert.match(worker, /firstByThread/);
  assert.match(worker, /emailOptedOut === true/);
  assert.match(worker, /EMAIL_CONSENT_EVIDENCE_REQUIRED/);
  assert.match(composer, /crm-email-attachments/);
  assert.match(composer, /crm-email-signature/);
  assert.match(composer, /Sincronizar respostas/);
  assert.match(composer, /Atualizar contas/);
  assert.match(composer, /Microsoft 365/);
  assert.match(leadModal, /crm-email-consent-optout/);
  assert.match(leadModal, /crm-email-consent-optin/);
  assert.match(crm, /Indicadores de comunicação/);
  assert.match(crm, /Desempenho por vendedor/);
  assert.match(drive, /i9leads-communication-backup\.json/);
  assert.match(drive, /crmEmailSignatures/);
  assert.match(drive, /crmEmailTemplates/);
  assert.match(settings, /remoteCommunication/);
  assert.match(settings, /emailTemplates/);
  assert.match(api, /syncCrmEmailReplies/);
  assert.match(api, /getCrmCommunicationMetrics/);
});

test('reset comercial para 1.0.0 fica consistente entre manifesto, pacote e pontes WhatsApp', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(manifest.version, '1.0.0.0');
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(pkg.version, '1.0.0');
  assert.match(read('content/content.js'), /const CONTENT_VER = '0\.0\.1\.0'/);
  assert.match(read('content/injected.js'), /const EXT_VER = '0\.0\.1\.0'/);
});
