import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v1.2.0 permite atribuir uma personalidade por grupo do WhatsApp', () => {
  const ui = read('sidepanel/components/AIChatView.js');
  const worker = read('background/service-worker.js');
  const content = read('content/content.js');
  assert.match(ui, /data-ai-group-persona/);
  assert.match(ui, /groupPersonaAssignments/);
  assert.match(ui, /Personalidade/);
  assert.match(worker, /groupPersonaAssignments/);
  assert.match(worker, /config\.groupPersonaAssignments\?\.\[groupId\]/);
  assert.match(content, /messageId, chatId: jid, chatRef/);
});

test('v1.2.0 vincula o perfil escolhido à campanha e aos contatos alcançados', () => {
  const form = read('sidepanel/components/CampaignForm.js');
  const campaigns = read('sidepanel/components/CampaignsWAView.js');
  const worker = read('background/service-worker.js');
  assert.match(form, /id="campaign-ai-persona"/);
  assert.match(form, /aiPersonaId: this\.\$\("#campaign-ai-persona"\)/);
  assert.match(campaigns, /id="edit-ai-persona"/);
  assert.match(campaigns, /aiPersonaId: modal\.querySelector\("#edit-ai-persona"\)/);
  assert.match(worker, /async function bindCampaignPersonaToContact/);
  assert.match(worker, /if \(c\.aiPersonaId && phone\)/);
  assert.match(worker, /expiresAt: now \+ 30 \* 24 \* 60 \* 60 \* 1000/);
});

test('v1.2.0 prioriza perfil do grupo ou campanha e usa o perfil global como fallback', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /function applyAiPersonaForContext\(config = \{\}, payload = \{\}\)/);
  assert.match(worker, /Precedência: grupo configurado > campanha que alcançou o contato > perfil global/);
  assert.match(worker, /config\.conversationPersonaAssignments\?\.\[aiChatHash\(phone\)\]/);
  assert.match(worker, /applyActiveAiPersona\(personaId && personaId !== config\.activePersonaId/);
});

test('atribuições privadas usam hash de telefone e expiram após 30 dias', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /assignments\[aiChatHash\(phone\)\]/);
  assert.match(worker, /const assignmentKey = \/\^chat_\[0-9a-f\]\{1,16\}\$\/i\.test\(keyText\)/);
  assert.match(worker, /expiresAt > Date\.now\(\)/);
});
