/**
 * i9Leads Flow 1.2.0-pro — Modo privacidade (blur) no WhatsApp Web
 *
 * Liga/desliga um CSS que desfoca nomes, prévias, mensagens e fotos, para gravar a tela,
 * fazer apresentações ou trabalhar em lugar público sem expor conversas.
 *
 * - Estado em chrome.storage.local, chave "privacyMode" (compartilhada com o painel da extensão):
 *     { on, names, messages, photos, panel, hover }
 * - Atalho: Alt+Shift+P (funciona no WhatsApp Web e no painel da extensão).
 * - Botão flutuante discreto no canto inferior direito do WhatsApp Web.
 * - Só mexe na aparência (CSS). Não lê nem altera mensagens, nem interfere no envio das campanhas.
 *
 * Os seletores do WhatsApp Web mudam de vez em quando; se algum trecho deixar de ficar desfocado
 * depois de uma atualização do WhatsApp, basta ajustar as listas SEL_* abaixo.
 */
(function () {
  if (window.__i9Privacy) return;
  window.__i9Privacy = true;

  const KEY = 'privacyMode';
  const DEF = { on: false, names: true, messages: true, photos: true, panel: true, hover: true };
  const STYLE_ID = 'i9-privacy-style';
  const BTN_ID = 'i9-privacy-btn';

  // --- Seletores (ajustar aqui se o WhatsApp mudar o HTML) ---------------------------------------
  const SEL_NAMES = [
    '#pane-side span[dir="auto"]',
    '#pane-side span[dir="ltr"]',
    '#pane-side span[title]',
    '#pane-side [data-testid="cell-frame-title"]',
    '#main header span[dir="auto"]',
    '#main header span[title]',
    '[data-testid="conversation-info-header"]',
    '[data-testid="drawer-right"] span[dir]',
  ];
  const SEL_MESSAGES = [
    '#main [data-id]',
    '#main .copyable-text',
    '#main span.selectable-text',
    '#main [data-pre-plain-text]',
  ];
  const SEL_PHOTOS = [
    '#pane-side img:not([data-plain-text])',
    '#side header img',
    '#main header img',
    '#main img[src^="blob:"]',
    '#main video',
    '[data-testid="drawer-right"] img:not([data-plain-text])',
  ];

  const group = (cls, list) => list.map((s) => `html.i9p-on.${cls} ${s}`).join(',\n');
  const reveal = (cls, list) => list.map((s) => `html.i9p-on.i9p-hover.${cls} ${s}:hover`).join(',\n');
  const BLUR = 'filter: blur(7px) !important; transition: filter .15s ease; user-select: none !important;';

  const CSS = `
${group('i9p-names', SEL_NAMES)} { ${BLUR} }
${group('i9p-messages', SEL_MESSAGES)} { ${BLUR} }
${group('i9p-photos', SEL_PHOTOS)} { ${BLUR} }
${reveal('i9p-names', SEL_NAMES)},
${reveal('i9p-messages', SEL_MESSAGES)},
${reveal('i9p-photos', SEL_PHOTOS)} { filter: none !important; user-select: auto !important; }
/* Passar o mouse sobre uma conversa da lista revela nome, prévia e foto dela */
html.i9p-on.i9p-hover.i9p-names #pane-side [role="listitem"]:hover span,
html.i9p-on.i9p-hover.i9p-photos #pane-side [role="listitem"]:hover img { filter: none !important; user-select: auto !important; }
#${BTN_ID} { position: fixed; right: 14px; bottom: 14px; z-index: 2147483000; width: 34px; height: 34px; border-radius: 50%;
  border: 1px solid rgba(128,128,128,.45); background: rgba(32,44,51,.88); color: #e9edef; font-size: 16px; line-height: 1;
  cursor: pointer; opacity: .5; transition: opacity .15s, transform .15s; display: flex; align-items: center; justify-content: center; padding: 0; }
#${BTN_ID}:hover { opacity: 1; transform: scale(1.08); }
#${BTN_ID}.on { opacity: 1; background: #25d366; color: #0b141a; border-color: #25d366; }
@media print { #${BTN_ID} { display: none !important; } }
`;

  let cfg = { ...DEF };

  function hasStorage() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local); }
    catch { return false; }
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  // O botão aparece só no quadro principal (ou no WhatsApp embutido na extensão), nunca em subquadros internos.
  function isMainFrame() {
    try { return window === window.top || window.parent.location.origin !== location.origin; }
    catch { return true; /* pai de outra origem: estamos embutidos */ }
  }

  function ensureButton() {
    if (!document.body || document.getElementById(BTN_ID) || !isMainFrame()) return;
    const b = document.createElement('button');
    b.id = BTN_ID;
    b.type = 'button';
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggle(); });
    document.body.appendChild(b);
  }

  function apply() {
    ensureStyle();
    ensureButton();
    const root = document.documentElement;
    root.classList.toggle('i9p-on', !!cfg.on);
    root.classList.toggle('i9p-names', cfg.names !== false);
    root.classList.toggle('i9p-messages', cfg.messages !== false);
    root.classList.toggle('i9p-photos', cfg.photos !== false);
    root.classList.toggle('i9p-hover', cfg.hover !== false);
    const b = document.getElementById(BTN_ID);
    if (b) {
      b.classList.toggle('on', !!cfg.on);
      b.textContent = cfg.on ? '🙈' : '👁️';
      b.title = (cfg.on ? 'Modo privacidade LIGADO' : 'Modo privacidade desligado') + ' — clique ou Alt+Shift+P (i9Leads Flow)';
      b.setAttribute('aria-pressed', cfg.on ? 'true' : 'false');
    }
  }

  async function load() {
    if (!hasStorage()) return;
    try {
      const r = await chrome.storage.local.get(KEY);
      cfg = { ...DEF, ...(r[KEY] || {}) };
    } catch { /* mantém o padrão */ }
    apply();
  }

  async function toggle() {
    if (!hasStorage()) return;
    try {
      const r = await chrome.storage.local.get(KEY);
      const cur = { ...DEF, ...(r[KEY] || {}) };
      await chrome.storage.local.set({ [KEY]: { ...cur, on: !cur.on } });
    } catch { /* extensão recarregada: ignora */ }
  }

  if (hasStorage()) {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes[KEY]) return;
        cfg = { ...DEF, ...(changes[KEY].newValue || {}) };
        apply();
      });
    } catch { /* ignora */ }
  }

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyP') {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    }
  }, true);

  load();
  // O botão precisa do <body>; se ainda não existir, tenta de novo quando o documento terminar de carregar.
  if (!document.body) document.addEventListener('DOMContentLoaded', apply, { once: true });
})();
