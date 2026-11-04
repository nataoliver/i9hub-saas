import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('v1.1.8 registra a Central de Execução no menu e na inicialização', () => {
  const router = read('sidepanel/utils/router.js');
  const header = read('sidepanel/components/Header.js');
  const app = read('sidepanel/sidepanel.js');
  assert.match(router, /execution: \{ title: 'Central de Execução'/);
  assert.match(header, /execution: 'Execução'/);
  assert.match(app, /execution: new ExecutionView\(this\)/);
  assert.match(app, /import \{ ExecutionView \} from "\.\/components\/ExecutionView\.js"/);
});

test('a Central de Execução consulta status reais e distingue estados desconhecidos', () => {
  const view = read('sidepanel/components/ExecutionView.js');
  assert.match(view, /sendMessage\('AI_GET_STATUS'\)/);
  assert.match(view, /sendMessage\('WA_STATUS'\)/);
  assert.match(view, /getCampaigns\(\)/);
  assert.match(view, /Estado desconhecido/);
  assert.match(view, /Atualização automática a cada 5 segundos/);
  assert.match(view, /data-execution-action="pause"/);
  assert.match(view, /data-execution-action="resume"/);
  assert.match(view, /data-execution-action="stop"/);
});

test('o estado da IA inclui a contagem real da fila de mensagens de entrada', () => {
  const worker = read('background/service-worker.js');
  const view = read('sidepanel/components/ExecutionView.js');
  assert.match(worker, /pendingInboundCount: incomingQueueCount/);
  assert.match(view, /Mensagens na fila de entrada/);
  assert.match(view, /Eventos aguardando histórico/);
  assert.match(view, /Fichas aguardando sincronização/);
});

test('o Dashboard contém um resumo visual e acesso à Central de Execução', () => {
  const dashboard = read('sidepanel/components/DashboardView.js');
  const styles = read('sidepanel/sidepanel.css');
  assert.match(dashboard, /Status da operação/);
  assert.match(dashboard, /id="dashboard-execution-summary"/);
  assert.match(dashboard, /quick-open-execution/);
  assert.match(styles, /\.i9-dashboard-execution-grid/);
});

test('a versão técnica e comercial atual é 1.2.8', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.match(read('content/content.js'), /const CONTENT_VER = '0\.0\.1\.0'/);
  assert.match(read('content/injected.js'), /const EXT_VER = '0\.0\.1\.0'/);
});
