import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CRM_NOTE_MAX_LENGTH,
  CRM_NOTE_MAX_ITEMS,
  appendCrmActivity,
  buildCrmTimeline,
  createManualCrmNote,
  normalizeCrmNotes,
} from '../lib/crm-history.js';
import { FEATURE_CATALOG, FEATURE_CATALOG_VERSION, ACTION_FEATURE_MAP, hasFeatureEntitlement } from '../lib/feature-catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('catálogo ativa histórico CRM como entitlement próprio dependente de crm.leads', () => {
  const feature = FEATURE_CATALOG.find((item) => item.id === 'crm.notes');
  assert.equal(FEATURE_CATALOG_VERSION, 14);
  assert.equal(feature?.implemented, true);
  assert.deepEqual(feature?.requires, ['crm.leads']);
  assert.equal(hasFeatureEntitlement(['crm.notes'], 'crm.notes'), false);
  assert.equal(hasFeatureEntitlement(['crm.leads', 'crm.notes'], 'crm.notes'), true);
  for (const action of ['GET_LEAD_HISTORY', 'ADD_LEAD_NOTE', 'UPDATE_LEAD_NOTE', 'DELETE_LEAD_NOTE']) {
    assert.equal(ACTION_FEATURE_MAP[action], 'crm.notes');
  }
});

test('anotações legadas são normalizadas sem perder texto, autor ou data e recebem ID estável', () => {
  const legacy = [{ date: '2026-10-01T10:00:00.000Z', author: 'Gabriel', text: 'Retornar na sexta.' }];
  const first = normalizeCrmNotes(legacy);
  const second = normalizeCrmNotes(legacy);
  assert.equal(first.length, 1);
  assert.equal(first[0].text, 'Retornar na sexta.');
  assert.equal(first[0].author, 'Gabriel');
  assert.equal(first[0].createdAt, legacy[0].date);
  assert.equal(first[0].id, second[0].id);
  assert.equal(first[0].manual, true);
});

test('notas manuais validam texto e possuem autoria, origem e timestamps', () => {
  const note = createManualCrmNote('Cliente prefere contato à tarde.', 'Usuário', '2026-10-30T12:00:00.000Z', 'note_test');
  assert.equal(note.id, 'note_test');
  assert.equal(note.manual, true);
  assert.equal(note.source, 'manual');
  assert.equal(note.createdAt, '2026-10-30T12:00:00.000Z');
  assert.throws(() => createManualCrmNote('   '), /anotação/i);
  assert.equal(CRM_NOTE_MAX_LENGTH, 5000);
});

test('normalização não descarta anotações antigas silenciosamente', () => {
  const notes = Array.from({ length: CRM_NOTE_MAX_ITEMS }, (_, index) => ({
    id: `note_${index}`, text: `Nota ${index}`, author: 'Vendedor', source: 'manual', manual: true,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
  }));
  assert.equal(normalizeCrmNotes(notes).length, CRM_NOTE_MAX_ITEMS);
});

test('linha do tempo reúne notas e eventos em ordem cronológica decrescente', () => {
  const lead = {
    notes: [
      { id: 'n1', text: 'Primeiro contato', author: 'Vendedor', source: 'manual', manual: true, createdAt: '2026-10-01T10:00:00.000Z' },
    ],
    activityLog: [
      { id: 'a1', type: 'lead.stage_changed', title: 'Etapa alterada', description: 'Novo para Contatado', actor: 'Usuário', source: 'manual', createdAt: '2026-10-02T10:00:00.000Z' },
    ],
  };
  const timeline = buildCrmTimeline(lead);
  assert.deepEqual(timeline.map((item) => item.id), ['a1', 'n1']);
  assert.equal(timeline[1].editable, true);
});

test('eventos automáticos são limitados, deduplicados e não viram notas editáveis', () => {
  const lead = { activityLog: [] };
  const event = { id: 'evt_1', type: 'lead.identity_updated', title: 'Dados corrigidos', description: 'Nome atualizado', actor: 'Usuário', source: 'manual' };
  appendCrmActivity(lead, event, { now: '2026-10-30T12:00:00.000Z' });
  appendCrmActivity(lead, event, { now: '2026-10-30T12:00:01.000Z' });
  const timeline = buildCrmTimeline(lead);
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].kind, 'activity');
  assert.equal(timeline[0].editable, false);
});

test('service worker implementa CRUD de notas, trilha de alterações e preservação na deduplicação', () => {
  const worker = read('background/service-worker.js');
  for (const action of ['GET_LEAD_HISTORY', 'ADD_LEAD_NOTE', 'UPDATE_LEAD_NOTE', 'DELETE_LEAD_NOTE']) {
    assert.ok(worker.includes(`async ${action}(p)`), `${action} não encontrado`);
  }
  assert.match(worker, /withCrmHistoryMutation/);
  assert.match(worker, /lead\.notes = notes\.filter/);
  assert.match(worker, /appendCrmActivity\(l,/);
  assert.match(worker, /Etiquetas do WhatsApp sincronizadas/);
  assert.match(worker, /Etapa comercial alterada/);
  assert.match(worker, /Deduplicação deve consolidar histórico/);
});

test('card do CRM apresenta composição de nota, timeline e controles de edição/exclusão', () => {
  const modal = read('sidepanel/components/LeadModal.js');
  assert.match(modal, /data-feature="crm\.notes"/);
  assert.match(modal, /id="crm-note-input"/);
  assert.match(modal, /id="crm-note-add"/);
  assert.match(modal, /data-note-edit/);
  assert.match(modal, /data-note-save/);
  assert.match(modal, /data-note-delete/);
  assert.match(modal, /addCrmNote/);
  assert.match(modal, /updateCrmNote/);
  assert.match(modal, /deleteCrmNote/);
});

test('cliente API expõe as operações de histórico e o CSS é responsivo', () => {
  const api = read('sidepanel/utils/api.js');
  const css = read('sidepanel/sidepanel.css');
  assert.match(api, /getLeadHistory\(leadId/);
  assert.match(api, /addLeadNote\(leadId/);
  assert.match(api, /updateLeadNote\(leadId/);
  assert.match(api, /deleteLeadNote\(leadId/);
  assert.match(css, /\.crm-history-section/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
