import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function loadIdentity() {
  const sandbox = { URL, Date, Set, Map, Object, String, Number, Math, Array, RegExp };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read('content/lead-identity.js'), sandbox, { filename: 'content/lead-identity.js' });
  return sandbox.i9LeadIdentity;
}

test('rejeita nomes genéricos, telefones e títulos de resultado sem descartar nomes comerciais curtos', () => {
  const identity = loadIdentity();
  for (const value of ['Resultados', 'Search results', 'Contato WhatsApp', 'Sem nome', '+55 11 99999-9999']) {
    assert.equal(identity.isValidName(value), false, value);
  }
  assert.equal(identity.isValidName('3M'), true);
  assert.equal(identity.isValidName('Clínica Horizonte'), true);
});

test('seleciona o contato salvo antes do nome de perfil e do título da conversa', () => {
  const identity = loadIdentity();
  const selected = identity.selectBestNameCandidate([
    { value: 'Perfil Público', source: 'whatsapp_push_name', confidence: 0.86 },
    { value: 'Clínica Horizonte', source: 'whatsapp_saved_contact', confidence: 0.99 },
    { value: '5511999999999', source: 'whatsapp_chat_title', confidence: 0.82 },
  ]);
  assert.equal(selected.value, 'Clínica Horizonte');
  assert.equal(selected.source, 'whatsapp_saved_contact');
});

test('dados de origem mais confiável corrigem dados automáticos antigos', () => {
  const identity = loadIdentity();
  const lead = {
    name: 'Perfil Público', source: 'whatsapp_private',
    identityMeta: { name: identity.makeMeta('whatsapp_push_name', 0.86) },
  };
  const result = identity.mergeLeadIdentity(lead, {
    name: 'Clínica Horizonte', source: 'google_maps',
    identityMeta: { name: identity.makeMeta('google_maps_details', 0.99) },
  });
  assert.equal(result.changed, true);
  assert.equal(lead.name, 'Clínica Horizonte');
  assert.equal(lead.identityMeta.name.source, 'google_maps_details');
  assert.equal(lead.identityMeta.name.confidence, 0.99);
});

test('correção manual fica bloqueada contra sincronizações automáticas posteriores', () => {
  const identity = loadIdentity();
  const lead = {
    name: 'Nome corrigido pelo usuário', source: 'whatsapp_private',
    identityMeta: { name: identity.makeMeta('manual', 1, { manual: true, locked: true }) },
  };
  const result = identity.mergeLeadIdentity(lead, {
    name: 'Nome antigo do WhatsApp', source: 'whatsapp_private',
    identityMeta: { name: identity.makeMeta('whatsapp_saved_contact', 0.99) },
  });
  assert.equal(result.changed, false);
  assert.equal(lead.name, 'Nome corrigido pelo usuário');
  assert.equal(lead.identityMeta.name.manual, true);
});

test('limpeza manual de campo também impede que a sincronização repovoe o valor', () => {
  const identity = loadIdentity();
  const lead = { email: 'antigo@empresa.com', source: 'google_maps' };
  identity.mergeLeadIdentity(lead, {
    email: '', source: 'manual',
    identityMeta: { email: identity.makeMeta('manual', 1, { manual: true, locked: true, cleared: true }) },
  });
  identity.mergeLeadIdentity(lead, { email: 'novo@empresa.com', source: 'google_maps' });
  assert.equal(lead.email, '');
  assert.equal(lead.identityMeta.email.cleared, true);
});

test('fonte automática menos confiável não substitui um campo melhor identificado', () => {
  const identity = loadIdentity();
  const lead = { name: 'Clínica Horizonte', source: 'google_maps', identityMeta: { name: identity.makeMeta('google_maps_details', 0.98) } };
  identity.mergeLeadIdentity(lead, { name: 'Horizonte', source: 'whatsapp_private', identityMeta: { name: identity.makeMeta('whatsapp_push_name', 0.86) } });
  assert.equal(lead.name, 'Clínica Horizonte');
});

test('normaliza telefones brasileiros e constrói chaves para deduplicação segura', () => {
  const identity = loadIdentity();
  assert.equal(identity.normalizePhone('(11) 99999-8888'), '5511999998888');
  assert.equal(identity.normalizePhone('+55 11 99999-8888'), '5511999998888');
  const index = identity.createIdentityIndex([{ id: 'wa-1', phone: '(11) 99999-8888', source: 'whatsapp_private' }]);
  const match = identity.findIdentityMatch(index, { phone: '+55 11 99999-8888', source: 'google_maps' });
  assert.equal(match.id, 'wa-1');
});

test('deduplica pelo identificador do Maps ou pelo par nome/endereço, mas não só pelo domínio', () => {
  const identity = loadIdentity();
  const byPlace = identity.createIdentityIndex([{ id: 'maps-1', placeId: 'ChIJ-123', name: 'Clínica Horizonte' }]);
  assert.equal(identity.findIdentityMatch(byPlace, { placeId: 'ChIJ-123', name: 'Horizonte' }).id, 'maps-1');
  const byAddress = identity.createIdentityIndex([{ id: 'a', name: 'Clínica Horizonte', address: 'Rua A, 10' }]);
  assert.equal(identity.findIdentityMatch(byAddress, { name: 'Clínica Horizonte', address: 'Rua A, 10' }).id, 'a');
  const byWebsite = identity.createIdentityIndex([{ id: 'b', name: 'Clínica Horizonte', website: 'https://rede.com.br' }]);
  assert.equal(identity.findIdentityMatch(byWebsite, { name: 'Clínica Sul', website: 'https://rede.com.br' }), null);
  const branches = identity.createIdentityIndex([
    { id: 'unit-a', name: 'Clínica Horizonte', website: 'https://rede.com.br', address: 'Rua A, 10' },
    { id: 'unit-b', name: 'Clínica Horizonte', website: 'https://rede.com.br', address: 'Rua B, 20' },
  ]);
  assert.equal(identity.findIdentityMatch(branches, { name: 'Clínica Horizonte', website: 'https://rede.com.br', address: 'Rua B, 20' }).id, 'unit-b');
});

test('a extensão carrega o resolvedor antes dos scripts WhatsApp e Maps', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const whatsappMain = manifest.content_scripts.find((entry) => entry.world === 'MAIN');
  const maps = manifest.content_scripts.find((entry) => entry.matches?.some((match) => match.includes('maps')));
  assert.deepEqual(whatsappMain.js, ['content/lead-identity.js', 'content/injected.js']);
  assert.deepEqual(maps.js, ['content/lead-identity.js', 'content/maps-name.js', 'content/maps-extractor.js']);
  const worker = read('background/service-worker.js');
  assert.match(worker, /import '\.\.\/content\/lead-identity\.js'/);
  assert.match(worker, /UPDATE_LEAD_IDENTITY\(p\)/);
  assert.match(worker, /LeadIdentity\.mergeLeadIdentity\(lead, identityCandidate/);
});

test('card do CRM permite corrigir identidade e mostra origem e confiabilidade por campo', () => {
  const modal = read('sidepanel/components/LeadModal.js');
  const api = read('sidepanel/utils/api.js');
  assert.match(modal, /Identidade e dados do lead/);
  assert.match(modal, /Confiabilidade:/);
  assert.match(modal, /Correção manual protegida/);
  assert.match(modal, /saveLeadIdentity\(modal, lead\)/);
  assert.match(api, /updateLeadIdentity\(leadId, fields\)/);
});

test('extração de participantes de grupos também registra a origem do nome e não promove telefone a nome', () => {
  const injected = read('content/injected.js');
  assert.match(injected, /function extractContactFromElement\(el\)/);
  assert.match(injected, /window\.i9LeadIdentity\?\.isValidName/);
  assert.match(injected, /whatsapp_group_member_dom/);
  assert.match(injected, /const identity = privateChatIdentity\(\{\}, contact\)/);
  const identity = loadIdentity();
  assert.equal(identity.SOURCE_DEFAULTS.whatsapp_group_member_dom, 0.78);
});

test('catálogo libera somente a edição de identidade da fase 02 e protege a ação por entitlement', () => {
  const catalog = read('lib/feature-catalog.js');
  assert.match(catalog, /UPDATE_LEAD_IDENTITY: 'crm\.lead\.identity_edit'/);
  assert.match(catalog, /id: 'crm\.lead\.identity_edit'.*implemented: true/);
  assert.match(catalog, /id: 'crm\.notes'.*implemented: true/);
});
