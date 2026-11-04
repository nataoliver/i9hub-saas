import { buildWhatsAppUrl } from '../lib/onboarding.js';

const $ = (id) => document.getElementById(id);
const send = (type, payload = {}) => new Promise((res) => chrome.runtime.sendMessage({ type, payload }, (r) => res(r || { success: false, error: chrome.runtime.lastError?.message })));

function msg(text, cls = '') { const m = $('msg'); m.textContent = text || ''; m.className = cls; }

async function refresh() {
  const res = await send('GET_LICENSE_STATUS');
  const s = res.data;
  if (!s) { $('status-card').textContent = 'Erro ao carregar status.'; return; }
  if (s.licensed && s.entitlementsConfigured) {
    const enabled = Array.isArray(s.features) ? s.features.filter((f) => f.enabled && f.implemented).length : 0;
    $('status-card').innerHTML = `<div class="row"><span class="muted">Licença</span><span class="badge b-ok">ATIVA</span></div>
      <div class="row"><span class="muted">Plano</span><strong>${escapeHtml(String(s.plan || 'licenciado').toUpperCase())}</strong></div>
      <div class="row"><span class="muted">Funções liberadas</span><strong>${enabled}</strong></div>`;
  } else if (s.licensed) {
    $('status-card').innerHTML = `<div class="row"><span class="muted">Licença</span><span class="badge b-lim">PERMISSÕES PENDENTES</span></div>
      <p style="margin-top:8px">A licença foi validada, mas o painel ainda não enviou as permissões das funcionalidades. Fale com o suporte para corrigir a configuração.</p>`;
  } else {
    $('status-card').innerHTML = `<div class="row"><span class="muted">Estado</span><span class="badge b-free">MODO DEMONSTRAÇÃO</span></div>
      <p style="margin-top:8px">Você pode conhecer os módulos, mas precisa ativar uma licença gratuita emitida pelo painel para utilizar as funções.</p>`;
  }
  $('wa-btn').href = buildWhatsAppUrl('free-account');
  $('license-block').hidden = !!(s.licensed && s.entitlementsConfigured);
  $('licensed-block').hidden = !s.licensed;
  $('licensed-support').href = buildWhatsAppUrl('license-support');
  $('activate-form').hidden = !!s.licensed;
  $('wa-btn').textContent = s.licensed ? 'Falar com suporte sobre minha licença' : 'Quero minha conta grátis pelo WhatsApp';
  $('wa-btn').href = s.licensed ? buildWhatsAppUrl('license-support') : buildWhatsAppUrl('free-account');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('open-panel').addEventListener('click', async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel/sidepanel.html'), active: true });
  window.close();
});

$('activate-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('activate').disabled = true; msg('Validando licença emitida pelo painel...');
  const res = await send('VALIDATE_LICENSE', { key: $('key').value });
  $('activate').disabled = false;
  if (res.success) {
    msg('Licença validada. Conferindo permissões...', 'ok');
    $('key').value = '';
    await refresh();
  } else msg(res.error || 'Não foi possível ativar a licença.', 'err');
});

$('deactivate').addEventListener('click', async () => {
  if (!confirm('Desativar a licença neste dispositivo?')) return;
  await send('REMOVE_LICENSE');
  msg('Licença removida. A extensão voltou ao modo de demonstração.');
  await refresh();
});

$('ver').textContent = 'v' + (chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version);
refresh();
