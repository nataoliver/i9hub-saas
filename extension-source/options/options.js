const $ = (id) => document.getElementById(id);
const send = (type, payload = {}) => new Promise((res) => chrome.runtime.sendMessage({ type, payload }, (r) => res(r || { success: false, error: chrome.runtime.lastError?.message })));

function box(text, ok = true) {
  const b = $('msg-box'); b.style.display = text ? 'block' : 'none'; b.textContent = text || '';
  b.style.background = ok ? '#e8f5e9' : '#ffebee'; b.style.color = ok ? '#2e7d32' : '#d32f2f';
}

async function refresh() {
  const { data: s } = await send('GET_LICENSE_STATUS');
  const ver = (chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version);
  $('ext-version').textContent = ver;
  $('hdr-version').textContent = 'v' + ver;
  if (!s) { $('license-info').textContent = 'Erro ao carregar.'; return; }
  $('device-id').textContent = s.deviceId;
  const waText = 'Olá! Vim pela extensão i9Leads Flow e gostaria de criar minha conta gratuita para começar a utilizar as funcionalidades. Poderiam me orientar sobre o cadastro e a ativação da minha licença gratuita? Origem: Extensão i9Leads Flow.';
  const freeUrl = 'https://wa.me/5511954721939?text=' + encodeURIComponent(waText);
  const supportUrl = 'https://wa.me/5511954721939?text=' + encodeURIComponent('Olá! Vim pela extensão i9Leads Flow. Já tenho uma licença e preciso de ajuda para conferir/liberar as funcionalidades da minha conta. Origem: Extensão i9Leads Flow.');
  if (s.licensed && s.entitlementsConfigured) {
    const count = Array.isArray(s.features) ? s.features.filter((feature) => feature.enabled && feature.implemented).length : (s.entitlements || []).length;
    $('license-info').innerHTML = `Licença <strong>ativa</strong> — plano ${String(s.plan).toUpperCase()} — ${count} função(ões) liberada(s)`;
  } else if (s.licensed) {
    $('license-info').innerHTML = `A licença foi validada, mas as permissões precisam ser configuradas no painel. <a href="${supportUrl}" target="_blank" rel="noopener noreferrer">Falar com suporte pelo WhatsApp</a>`;
  } else {
    $('license-info').innerHTML = `Modo de demonstração: você pode conhecer os módulos, mas precisa de uma licença emitida pelo painel para usar as funções. <a href="${freeUrl}" target="_blank" rel="noopener noreferrer">Quero minha conta grátis pelo WhatsApp</a>`;
  }
}

$('validate-btn').addEventListener('click', async () => {
  const { data: s } = await send('GET_LICENSE_STATUS');
  if (s?.licensed) { box('Licença válida.'); return; }
  const key = prompt('Cole a chave de licença:');
  if (!key) return;
  const r = await send('VALIDATE_LICENSE', { key });
  box(r.success ? 'Licença validada. Conferindo as permissões emitidas pelo painel...' : (r.error || 'Falha'), r.success);
  refresh();
});

$('deactivate-btn').addEventListener('click', async () => {
  if (!confirm('Desativar a licença neste dispositivo?')) return;
  await send('REMOVE_LICENSE'); box('Licença removida.'); refresh();
});

refresh();
