import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('nova campanha permite definir limite total de envios e 0 significa todos', () => {
  const form = read('sidepanel/components/CampaignForm.js');
  const worker = read('background/service-worker.js');
  assert.match(form, /id="campaign-send-limit"/);
  assert.match(form, /0 = todos os contatos selecionados/);
  assert.match(form, /sendLimit:/);
  assert.match(worker, /sendLimit: Math\.max\(0, Math\.min\(10000/);
});

test('edição de campanha usa lista de campos permitidos e bloqueia alterações enquanto está rodando', () => {
  const worker = read('background/service-worker.js');
  assert.match(worker, /async UPDATE_CAMPAIGN\(p\)/);
  assert.match(worker, /CAMPAIGN_MUST_BE_PAUSED/);
  assert.match(worker, /if \(c\.status === 'running' \|\| c\.pauseRequestedAt\)/);
  assert.match(worker, /const supplied = \(key\) => Object\.prototype\.hasOwnProperty\.call/);
  assert.match(worker, /editHistory = \[\.\.\.\(Array\.isArray\(c\.editHistory\)/);
  assert.match(worker, /Alterações aplicam-se somente aos contatos pendentes/);
});

test('pausa da campanha espera confirmação antes de permitir edição', () => {
  const worker = read('background/service-worker.js');
  const view = read('sidepanel/components/CampaignsWAView.js');
  assert.match(worker, /async PAUSE_CAMPAIGN\(p\)/);
  assert.match(worker, /PAUSE_NOT_CONFIRMED/);
  assert.match(worker, /c\.pauseRequestedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(view, /await this\.app\.api\.pauseCampaign\(id\)/);
  assert.match(view, /As mensagens já enviadas não serão alteradas/);
});

test('limite de envios restringe cada execução e mostra estado de limite atingido com contatos pendentes', () => {
  const worker = read('background/service-worker.js');
  const view = read('sidepanel/components/CampaignsWAView.js');
  const execution = read('sidepanel/components/ExecutionView.js');
  assert.match(worker, /const remainingLimit = sendLimit > 0 \? Math\.max\(0, sendLimit - attemptsUsed\) : pendingAll\.length/);
  assert.match(worker, /pendingAll\.slice\(0, remainingLimit\)/);
  assert.match(worker, /c\.status = 'limit_reached'/);
  assert.match(view, /Limite atingido/);
  assert.match(view, /Limite total de envios \(0 = todos os contatos\)/);
  assert.match(execution, /Limite atingido · aguardando ajuste/);
});

test('editor oferece intervalo, lote, pausa, limite, horário, estágio e salvar/retomar', () => {
  const view = read('sidepanel/components/CampaignsWAView.js');
  for (const text of [
    'edit-delay-min', 'edit-delay-max', 'edit-batch-size', 'edit-batch-pause',
    'edit-send-limit', 'edit-schedule-enabled', 'edit-move-stage', 'data-edit-save-resume',
    'Histórico de alterações', 'Salvar alterações'
  ]) assert.ok(view.includes(text), `campo/ação ausente: ${text}`);
});

test('a versão 1.2.8 está sincronizada no manifesto e nas pontes do WhatsApp', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.equal(pkg.version, '1.0.0');
  assert.match(read('content/content.js'), /const CONTENT_VER = '0\.0\.1\.0'/);
  assert.match(read('content/injected.js'), /const EXT_VER = '0\.0\.1\.0'/);
  assert.match(read('sidepanel/sidepanel.html'), /v1\.2\.9/);
});
