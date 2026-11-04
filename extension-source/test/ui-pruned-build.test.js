import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('a variante 1.1.8 remove os módulos antigos e registra o novo Chat com IA', () => {
  const router = read('sidepanel/utils/router.js');
  const app = read('sidepanel/sidepanel.js');
  const header = read('sidepanel/components/Header.js');
  assert.doesNotMatch(router, /ai-support|audiences/);
  assert.match(router, /'ai-chat': \{ title: 'Chat com IA'/);
  assert.doesNotMatch(app, /AIAssistantView|AudiencesView|ai-support|audiences/);
  assert.match(app, /AIChatView/);
  assert.doesNotMatch(header, /Atendimento IA|Públicos Status|ai-support|audiences/);
  assert.match(header, /'ai-chat': 'Chat com IA'/);
});

test('a variante 1.1.8 não renderiza nem consulta a saúde da conta no dashboard', () => {
  const dashboard = read('sidepanel/components/DashboardView.js');
  const styles = read('sidepanel/sidepanel.css');
  assert.doesNotMatch(dashboard, /Saúde da conta WhatsApp|GET_COMPLIANCE_HEALTH|health-card|health-score|health-details-btn|health-pause-campaigns/);
  assert.doesNotMatch(styles, /Health Card - Saúde da conta WhatsApp|\.health-card|\.health-score-ring/);
});

test('a variante 1.1.8 não mostra os indicadores exclusivos do Atendimento IA', () => {
  const dashboard = read('sidepanel/components/DashboardView.js');
  assert.doesNotMatch(dashboard, /stat-ai-conversations|stat-ai-messages|stat-pending-orders|Conversas IA|Mensagens IA Processadas/);
});

test('o nome comercial é 1.1.8 e a versão técnica do Chrome é numérica', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
  assert.match(manifest.version, /^\d+(?:\.\d+){0,3}$/);
});


test('a variante 1.1.8 não expõe campanha adicional no CRM, menu, ajuda ou tutorial', () => {
  const crm = read('sidepanel/components/CRMView.js');
  const router = read('sidepanel/utils/router.js');
  const app = read('sidepanel/sidepanel.js');
  const help = read('sidepanel/utils/helpData.js');
  const tour = read('sidepanel/components/Tour.js');
  const api = read('sidepanel/utils/api.js');
  const header = read('sidepanel/components/Header.js');
  const readme = read('README.md');
  assert.doesNotMatch(crm, /Campanha RCS|btn-use-rcs|campaigns-rcs|template RCS/);
  assert.doesNotMatch(router, /campaigns-rcs|Campanhas RCS/);
  assert.doesNotMatch(app, /CampaignsRCSView|campaigns-rcs/);
  assert.doesNotMatch(header, /campaigns-rcs|Campanhas RCS|RCS/);
  assert.doesNotMatch(readme, /Campanhas RCS|campanhas para .* RCS|i9RCS/);
  assert.doesNotMatch(help, /Campanhas RCS|mensagens ricas|campaigns-rcs/);
  assert.doesNotMatch(tour, /campaigns-rcs|Campanhas RCS|mensagens ricas/);
  assert.doesNotMatch(api, /GET_RCS|SEND_RCS|START_RCS|RCS/);
  assert.equal(fs.existsSync(path.join(root, 'sidepanel/components/CampaignsRCSView.js')), false);
});

test('os cartões do Kanban permitem que ações e dados quebrem linha sem ultrapassar o cartão', () => {
  const styles = read('sidepanel/sidepanel.css');
  assert.match(styles, /\.kanban-card-actions[^{}]*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(styles, /\.kanban-card-actions \.btn[^{}]*\{[^}]*min-width:\s*0/s);
  assert.match(styles, /\.kanban-card[^{}]*\{[^}]*box-sizing:\s*border-box/s);
  assert.match(styles, /@media \(max-width: 420px\)/);
});

test('menu e apresentação usam os nomes corretos e descrevem os recursos da versão 1.2.8', () => {
  const header = read('sidepanel/components/Header.js');
  const router = read('sidepanel/utils/router.js');
  const maps = read('sidepanel/components/MapsView.js');
  const chats = read('sidepanel/components/ChatsView.js');
  const tour = read('sidepanel/components/Tour.js');
  assert.match(header, /maps: 'Extração Google Maps'/);
  assert.match(header, /chats: 'Extração Grupos do WhatsApp'/);
  assert.match(router, /title: 'Extração Google Maps'/);
  assert.match(router, /title: 'Extração Grupos do WhatsApp'/);
  assert.match(maps, /Extração Google Maps/);
  assert.match(chats, /Extração Grupos do WhatsApp/);
  assert.match(tour, /Funções incluídas na versão 1\.2\.9/);
  assert.match(tour, /Extração Google Maps/);
  assert.match(tour, /Extração Grupos do WhatsApp/);
  assert.doesNotMatch(tour, /i9Flow|i9Assist/);
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.version_name, '1.0.0');
  assert.equal(manifest.version, '1.0.0.0');
});
