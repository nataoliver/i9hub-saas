/**
 * WhatsAppDock — painel de ESTADO e AÇÕES do WhatsApp Web (v7.0.5).
 * Adaptado para SaaS web: todas as APIs Chrome têm fallback seguro.
 */

const WA_URL = "https://web.whatsapp.com/";
const POLL_MS = 2500;
const LOAD_TIMEOUT_MS = 30000;
const KEY_COLLAPSED = "waDockCollapsed";
const KEY_WINDOW_MODE = "waWindowMode";
const KEY_EMBED = "waEmbedExperimental";
const MAX_AUTO = 2;

// Compatibilidade SaaS: wrappers para APIs Chrome com fallback seguro
const _isExt = typeof chrome !== "undefined" && !!chrome.storage?.local;
async function _storageGet(keys) {
  if (_isExt) return chrome.storage.local.get(keys);
  const r = {}; const ks = Array.isArray(keys) ? keys : [keys];
  for (const k of ks) { try { const v = localStorage.getItem("i9hub_" + k); if (v !== null) r[k] = JSON.parse(v); } catch {} }
  return r;
}
async function _storageSet(obj) {
  if (_isExt) return chrome.storage.local.set(obj);
  for (const [k, v] of Object.entries(obj)) { try { localStorage.setItem("i9hub_" + k, JSON.stringify(v)); } catch {} }
}

const ICONS = {
  reload: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
  diag: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 8-6-16-3 8H2"/></svg>',
  collapse: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
};

export class WhatsAppDock {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById("wa-dock");
    this.handle = document.getElementById("wa-handle");
    this.mounted = false;
    this.collapsed = true;
    this.embed = false;
    this.campaignRunning = false;
    this.lastStatus = { state: "checking" };
    this.mountedAt = 0;
    this.tabId = null;
    this.timer = null;
    this.noticeTimer = null;
    this.windowMode = false;
    this.autoTry = 0;
    this.errStreak = 0;
    this.polling = false;
    this._panelKey = null;
    this.ready = null;

    if (!this.root) return;
    this.renderShell();
    this.bind();
    this.ready = this.init();
  }

  async init() {
    try {
      const tab = _isExt ? await chrome.tabs.getCurrent() : { id: null };
      this.tabId = tab?.id ?? null;
    } catch { this.tabId = null; }

    const saved = await _storageGet([KEY_COLLAPSED, KEY_WINDOW_MODE, KEY_EMBED]).catch(() => ({}));
    this.collapsed = saved[KEY_COLLAPSED] !== false;
    this.windowMode = !!saved[KEY_WINDOW_MODE];
    this.embed = saved[KEY_EMBED] === true;
    this.applyModeClasses();

    try {
      const res = await this.app.api.getCampaigns();
      this.campaignRunning = !!(res?.success && (res.data || []).some((c) => c.status === "running"));
    } catch { /* ignora */ }
    this.refreshChrome();
  }

  bind() {
    this.root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      const requiresConnection = new Set(["reload", "diag", "relax", "retry", "openwin", "opentab", "usetab", "showtab", "focuswin", "leavewin"]);
      if (requiresConnection.has(act) && !this.app.hasFeature?.("whatsapp.connection")) {
        e.preventDefault();
        this.app.showAccessPrompt?.("whatsapp.connection");
        return;
      }
      if (act === "copy" && !this.app.hasFeature?.("system.logs")) {
        e.preventDefault();
        this.app.showAccessPrompt?.("system.logs");
        return;
      }
      if (act === "reload") this.reload();
      else if (act === "diag") this.diagnose();
      else if (act === "collapse") this.collapse();
      else if (act === "relax") this.relax();
      else if (act === "retry") this.retry();
      else if (act === "openwin") this.openWindow();
      else if (act === "opentab") this.openTab();
      else if (act === "usetab") this.useTab();
      else if (act === "showtab" || act === "focuswin") this.showTab();
      else if (act === "leavewin") this.leaveWindowMode();
      else if (act === "copy") this.copyDiag();
      else if (act === "settings") this.app.router.navigate("settings");
      else if (act === "fulltab") {
        if (_isExt) chrome.tabs.create({ url: chrome.runtime.getURL("sidepanel/sidepanel.html#campaigns-wa") });
        else window.location.hash = "campaigns-wa";
      }
      else if (act === "closeoverlay") { this.hideOverlay(); if (this.embed && this.windowMode) this.showWindowMode(); }
    });
    this.handle?.addEventListener("click", () => {
      if (!this.app.hasFeature?.("whatsapp.connection")) { this.app.showAccessPrompt?.("whatsapp.connection"); return; }
      this.open();
    });

    document.addEventListener("i9:wa-need", () => { this.open(); if (this.embed) setTimeout(() => this.focusFrame(), 250); });

    document.addEventListener("visibilitychange", () => {
      if (!this.embed || !this.campaignRunning) return;
      if (document.visibilityState === "visible") {
        this.showNotice("Você voltou. O envio fica em espera enquanto esta aba está oculta e continua sozinho agora.", "info", 6000);
      }
    });

    if (_isExt) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (this.embed && msg?.type === "WA_FRAME_ERROR" && (this.tabId == null || msg.payload?.tabId === this.tabId)) {
          this.showBlocked(msg.payload?.error);
        }
        if (msg?.type === "WA_PING_RECEIVED") {
          const dot = this.root.querySelector("#wa-dock-dot");
          if (dot) {
            dot.style.boxShadow = "0 0 8px 3px var(--wa-green)";
            setTimeout(() => { dot.style.boxShadow = ""; }, 500);
          }
        }
        return false;
      });
    }
  }

  renderShell() {
    this.root.innerHTML = `
      <header class="wa-dock-head">
        <div class="wa-dock-title">
          <span class="wa-dot wa-dot-wait" id="wa-dock-dot"></span>
          <div class="wa-dock-titletext">
            <strong>WhatsApp Web</strong>
            <small id="wa-dock-sub">Preparando…</small>
          </div>
        </div>
        <div class="wa-dock-actions">
          <button type="button" class="wa-ico-btn" data-act="reload" title="Recarregar o WhatsApp Web" aria-label="Recarregar o WhatsApp Web">${ICONS.reload}</button>
          <button type="button" class="wa-ico-btn" data-act="diag" title="Diagnóstico de conexão" aria-label="Diagnóstico de conexão">${ICONS.diag}</button>
          <button type="button" class="wa-ico-btn" data-act="collapse" id="wa-dock-collapse" title="Recolher painel" aria-label="Recolher painel">${ICONS.collapse}</button>
        </div>
      </header>
      <div class="wa-dock-notice" id="wa-dock-notice" role="status" hidden></div>
      <div class="wa-dock-body">
        <div class="wa-dock-panel" id="wa-dock-panel"></div>
        <div class="wa-dock-frame-slot" id="wa-dock-slot" hidden></div>
        <div class="wa-dock-overlay" id="wa-dock-overlay" hidden></div>
      </div>
      <footer class="wa-dock-foot" id="wa-dock-foot"></footer>`;
    this.dot = this.root.querySelector("#wa-dock-dot");
    this.sub = this.root.querySelector("#wa-dock-sub");
    this.notice = this.root.querySelector("#wa-dock-notice");
    this.overlay = this.root.querySelector("#wa-dock-overlay");
    this.slot = this.root.querySelector("#wa-dock-slot");
    this.panel = this.root.querySelector("#wa-dock-panel");
    this.foot = this.root.querySelector("#wa-dock-foot");
    this.collapseBtn = this.root.querySelector("#wa-dock-collapse");
    this.applyModeClasses();
  }

  applyModeClasses() {
    if (!this.root) return;
    this.root.classList.toggle("wa-dock-slim", !this.embed);
    if (this.panel) this.panel.hidden = this.embed;
    if (this.slot) this.slot.hidden = !this.embed;
    if (this.foot) {
      this.foot.textContent = this.embed
        ? "WhatsApp embutido (experimental). Sessão própria da extensão: se for a primeira vez, escaneie o QR code uma única vez."
        : "O WhatsApp Web roda numa aba ou janela comum do Chrome. Deixe-o visível durante o envio.";
    }
  }

  refreshChrome() {
    const visible = this.mounted && !this.collapsed;
    this.root.hidden = !visible;
    if (this.handle) this.handle.hidden = !(this.mounted && this.collapsed);
    document.body.classList.toggle("wa-dock-open", visible);
    if (this.collapseBtn) {
      this.collapseBtn.disabled = this.campaignRunning;
      this.collapseBtn.title = this.campaignRunning ? "Não é possível recolher durante uma campanha" : "Recolher painel";
    }
    if (this.campaignRunning) {
      const hiddenWa = !this.embed && this.lastStatus?.state === "connected" && this.lastStatus.visible === false;
      this.showNotice(hiddenWa
        ? "WhatsApp fora de vista: a campanha continua em segundo plano (pode ficar mais lenta). Se algum contato exigir a tela, ela espera o WhatsApp voltar a aparecer."
        : (this.embed
          ? "Campanha em andamento — mantenha esta aba aberta e visível até terminar."
          : "Campanha em andamento — pode usar o computador: o envio continua em segundo plano (mais lento se a janela estiver oculta)."), "info");
    } else if (this.notice && this.noticeKind === "running") {
      this.hideNotice();
    }
  }

  async open() {
    if (this.ready) await this.ready;
    if (this.collapsed) {
      this.collapsed = false;
      _storageSet({ [KEY_COLLAPSED]: false }).catch(() => {});
    }
    if (!this.mounted) await this.mount();
    this.refreshChrome();
  }

  collapse() {
    if (this.campaignRunning) return;
    this.collapsed = true;
    _storageSet({ [KEY_COLLAPSED]: true }).catch(() => {});
    this.refreshChrome();
  }

  async mount() {
    if (this.mounted) return;
    this.mounted = true;
    this.mountedAt = Date.now();
    this.applyModeClasses();
    this.refreshChrome();
    if (!this.embed) { this.startPolling(); return; }
    if (this.tabId == null) {
      await this.init();
      if (this.tabId == null) { this.showNeedFullTab(); return; }
    }
    if (this.windowMode) { this.showWindowMode(); this.startPolling(); return; }
    await this.createFrame();
  }

  async applyEmbedSetting(enabled) {
    if (this.ready) await this.ready;
    await this.app.api.sendMessage("WA_SET_EMBED", { enabled: !!enabled });
    this.embed = !!enabled;
    this.stopPolling();
    this.hideOverlay();
    if (this.frame) { this.frame.src = "about:blank"; this.frame.remove(); this.frame = null; }
    if (this.slot) this.slot.innerHTML = "";
    this.mounted = false; this.autoTry = 0; this.errStreak = 0; this._panelKey = null;
    this.lastStatus = { state: "checking" };
    this.applyModeClasses();
    const r = this.app.router.currentRoute;
    if (r === "campaigns-wa" || r === "chats") await this.open(); else this.refreshChrome();
  }

  async createFrame(url = WA_URL) {
    await this.app.api.sendMessage("WA_CONNECT");
    const frame = document.createElement("iframe");
    frame.id = "wa-frame";
    frame.className = "wa-frame";
    frame.title = "WhatsApp Web";
    frame.allow = "clipboard-read; clipboard-write; microphone; camera; autoplay; fullscreen";
    frame.referrerPolicy = "no-referrer";
    frame.src = url;
    this.slot.appendChild(frame);
    this.frame = frame;
    this.startPolling();
  }

  async reload(opts = {}) {
    if (!this.embed) {
      const r = await this.app.api.sendMessage("WA_RELOAD_TAB");
      if (r?.success) this.app.showToast("Aba do WhatsApp recarregada.", "success");
      else this.app.showToast(r?.error || "Não foi possível recarregar a aba do WhatsApp.", "error");
      setTimeout(() => this.poll(), 1200);
      return;
    }
    if (!this.frame) return;
    this.sub.textContent = "Recarregando o WhatsApp Web…";
    this.dot.className = "wa-dot wa-dot-wait";
    if (opts.bust) this.frame.src = WA_URL + "?bust=" + Date.now();
    else this.frame.contentWindow?.location.reload();
    this.mountedAt = Date.now();
    this.autoTry = 0;
    this.errStreak = 0;
  }

  retry() {
    this.autoTry = 0;
    this.errStreak = 0;
    this.hideOverlay();
    this.reload({ bust: true });
  }

  showSlow() {
    this.setOverlay("slow", `
      <div class="wa-help">
        <h3>O WhatsApp está demorando</h3>
        <p>Verifique sua conexão ou tente recarregar.</p>
        <div class="wa-help-actions">
          <button class="btn btn-primary btn-sm" data-act="reload">Recarregar</button>
          <button class="btn btn-secondary btn-sm" data-act="diag">Diagnóstico</button>
          <button class="btn btn-secondary btn-sm" data-act="closeoverlay">Fechar</button>
        </div>
      </div>`);
  }

  showWaError(c) {
    this.setOverlay("waerror", `
      <div class="wa-help">
        <h3>O WhatsApp mostrou um erro</h3>
        <p>${this.escape(c?.error || "Erro desconhecido.")}</p>
        <div class="wa-help-actions">
          <button class="btn btn-primary btn-sm" data-act="retry">Tentar de novo</button>
          <button class="btn btn-secondary btn-sm" data-act="relax">Modo compatível</button>
          <button class="btn btn-secondary btn-sm" data-act="diag">Diagnóstico</button>
          <button class="btn btn-secondary btn-sm" data-act="closeoverlay">Ignorar</button>
        </div>
      </div>`);
  }

  showBlocked(error) {
    this.setOverlay("blocked", `
      <div class="wa-help">
        <h3>O WhatsApp bloqueou o painel embutido</h3>
        <p>${this.escape(error || "O WhatsApp não permite ser carregado dentro de outro site.")}</p>
        <p>Use o modo padrão (aba/janela comum) nas Configurações.</p>
        <div class="wa-help-actions">
          <button class="btn btn-primary btn-sm" data-act="settings">Abrir Configurações</button>
          <button class="btn btn-secondary btn-sm" data-act="closeoverlay">Fechar</button>
        </div>
      </div>`);
  }

  showNeedFullTab() {
    this.setOverlay("needfull", `
      <div class="wa-help">
        <h3>WhatsApp embutido indisponível</h3>
        <p>Este recurso experimental precisa que o painel rode numa aba própria da extensão.</p>
        <div class="wa-help-actions">
          <button class="btn btn-primary btn-sm" data-act="fulltab">Abrir numa aba própria</button>
          <button class="btn btn-secondary btn-sm" data-act="settings">Usar modo padrão</button>
          <button class="btn btn-secondary btn-sm" data-act="closeoverlay">Fechar</button>
        </div>
      </div>`);
  }

  setOverlay(kind, html) {
    this.overlayKind = kind;
    if (this.overlay) { this.overlay.innerHTML = html; this.overlay.hidden = false; }
  }

  hideOverlay() {
    this.overlayKind = null;
    if (this.overlay) { this.overlay.hidden = true; this.overlay.innerHTML = ""; }
  }

  showNotice(text, kind = "info", autoHideMs = 0) {
    if (!this.notice) return;
    this.noticeKind = kind;
    this.notice.textContent = text;
    this.notice.className = "wa-dock-notice wa-notice-" + kind;
    this.notice.hidden = false;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    if (autoHideMs > 0) this.noticeTimer = setTimeout(() => this.hideNotice(), autoHideMs);
  }

  hideNotice() {
    this.noticeKind = null;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = null;
    if (this.notice) { this.notice.hidden = true; this.notice.textContent = ""; }
  }

  focusFrame() {
    try { this.frame?.contentWindow?.focus(); } catch { /* cross-origin */ }
  }

  // ---- Modo janela lateral / aba ---------------------------------------------------------------
  async openWindow() {
    await this.app.api.sendMessage("WA_OPEN_WINDOW");
    this.app.showToast("Janela lateral do WhatsApp solicitada.", "success");
    setTimeout(() => this.poll(), 800);
  }

  async openTab() {
    await this.app.api.sendMessage("WA_OPEN_TAB");
    this.app.showToast("Aba do WhatsApp Web solicitada.", "success");
    setTimeout(() => this.poll(), 800);
  }

  async useTab() {
    const r = await this.app.api.sendMessage("WA_USE_CURRENT_TAB");
    if (!r?.success) { this.app.showToast(r?.error || "Não foi possível usar a aba do WhatsApp", "error"); return; }
    this.app.showToast("Usando a aba do WhatsApp Web para as campanhas.", "success");
    this._panelKey = null; this.poll();
  }

  async showTab() {
    await this.app.api.sendMessage("WA_OPEN_TAB");
    setTimeout(() => this.poll(), 600);
  }

  startPolling() {
    this.stopPolling();
    this.poll();
    this.timer = setInterval(() => this.poll(), POLL_MS);
  }
  stopPolling() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const res = await this.app.api.sendMessage("WA_STATUS");
      const c = res?.success ? res.data : { state: "error", error: res?.error || "Falha ao verificar o WhatsApp Web" };
      this.setStatus(c);
      if (!this.embed) { this.renderPanel(c); this.refreshChrome(); return; }
      if (this.windowMode) { this.updateWindowStatus(c); return; }
      if (c.state === "error" && c.errorKind === "wa-error-page") {
        this.errStreak++;
        if (this.errStreak >= 2) await this.onWaErrorPage(c);
        return;
      }
      this.errStreak = 0;
      if (c.state === "connected" || c.state === "qr") {
        this.autoTry = 0;
        if (!c.embedError && ["slow", "blocked", "waerror"].includes(this.overlayKind)) this.hideOverlay();
        return;
      }
      const waiting = c.state === "none" || c.state === "opening" || c.state === "error";
      if (waiting && Date.now() - this.mountedAt > LOAD_TIMEOUT_MS && this.overlay.hidden) this.showSlow();
    } finally { this.polling = false; }
  }

  async onWaErrorPage(c) {
    if (this.autoTry < MAX_AUTO) {
      this.autoTry++;
      this.sub.textContent = `O WhatsApp mostrou um erro — tentando de novo (${this.autoTry}/${MAX_AUTO})…`;
      await this.app.api.sendMessage("WA_SET_LEVEL", { level: 1 });
      await this.reload({ bust: this.autoTry >= 2 });
      return;
    }
    if (this.overlayKind !== "waerror") this.showWaError(c);
  }

  setStatus(c) {
    this.lastStatus = c;
    const embErr = !!c.embedError;
    const kind = embErr ? "err" : ({ connected: c.visible === false ? "wait" : "ok", qr: "wait", opening: "wait", checking: "wait", none: "wait", error: "err" }[c.state] || "wait");
    this.dot.className = "wa-dot wa-dot-" + kind;
    let text;
    if (c.state === "connected") {
      const phone = c.phone ? ` · +${c.phone}` : "";
      const method = c.store?.ok ? "envio rápido" : "envio compatível";
      let where = "";
      if (c.mode === "tab") where = (c.windowMode ? " · janela lateral" : " · aba comum") + (c.visible === false ? " · OCULTA" : " · visível");
      text = embErr ? `Painel embutido com erro · usando ${c.windowMode ? "a janela lateral" : "a aba comum"}${phone}` : `Conectado${phone}${where} · ${method}`;
    } else if (c.state === "qr") text = "Escaneie o QR code com o celular";
    else if (c.state === "error") text = c.error || "Erro ao verificar";
    else if (c.state === "none") text = "WhatsApp Web não está aberto";
    else text = "Carregando o WhatsApp Web…";
    this.sub.textContent = text;
    document.dispatchEvent(new CustomEvent("i9:wa-status", { detail: c }));
  }

  renderPanel(c) {
    if (!this.panel) return;
    const key = [c.state, c.mode || "", c.windowMode ? 1 : 0, c.visible === false ? 0 : 1, c.phone || "", c.error || "", c.tabId || "", c.chosen ? 1 : 0, c.tabsFound || 0, c.embedError ? 1 : 0].join("|");
    if (this._panelKey === key) return;
    this._panelKey = key;
    const e = (t) => this.escape(t);
    const settingsLink = `<button type="button" class="btn btn-sm btn-secondary" data-act="settings">Configurações</button>`;
    let title, body, actions = "";
    if (c.state === "connected") {
      const where = c.windowMode ? "janela lateral" : "aba comum";
      const vis = c.visible !== false;
      title = vis ? `Conectado · ${where} · visível` : `Conectado · ${where} · OCULTA`;
      body = vis
        ? (c.windowMode
          ? "Pronto para enviar. A campanha segue em segundo plano; só não feche a janela do WhatsApp."
          : "Pronto para enviar. A campanha segue em segundo plano; só não feche a aba do WhatsApp.")
        : "O WhatsApp está fora de vista (aba em segundo plano, janela coberta ou minimizada). O Chrome reduz o ritmo de páginas ocultas: o envio fica em espera até ele aparecer. Ao iniciar, a extensão oferece trazê-lo para frente.";
      if (c.embedError) body += " (O painel embutido experimental mostrou erro; as campanhas usam esta aba.)";
      actions = `<button type="button" class="btn btn-sm ${vis ? "btn-secondary" : "btn-primary"}" data-act="showtab">Mostrar WhatsApp</button>`
        + (c.windowMode ? "" : `<button type="button" class="btn btn-sm btn-secondary" data-act="openwin">Mover para janela lateral</button>`)
        + (c.chosen ? "" : `<button type="button" class="btn btn-sm btn-secondary" data-act="usetab">Usar esta aba</button>`);
    } else if (c.state === "qr") {
      title = "Escaneie o QR code";
      body = "Abra o WhatsApp no celular › Aparelhos conectados › Conectar um aparelho e escaneie o QR code na aba/janela do WhatsApp Web. A conexão é detectada sozinha.";
      actions = `<button type="button" class="btn btn-sm btn-primary" data-act="usetab">Usar esta aba</button>`
        + `<button type="button" class="btn btn-sm btn-secondary" data-act="openwin">Abrir em janela lateral</button>`;
    } else if (c.state === "opening") {
      title = "Carregando o WhatsApp Web…";
      body = "Aguarde alguns segundos. Se demorar, recarregue a aba do WhatsApp.";
      actions = `<button type="button" class="btn btn-sm btn-secondary" data-act="showtab">Mostrar WhatsApp</button><button type="button" class="btn btn-sm btn-secondary" data-act="reload">Recarregar</button>`;
    } else if (c.state === "error") {
      title = "O WhatsApp mostrou um erro";
      body = e(c.error || "Não foi possível verificar o WhatsApp Web.") + " Recarregue a aba do WhatsApp Web (F5).";
      actions = `<button type="button" class="btn btn-sm btn-primary" data-act="reload">Recarregar a aba</button><button type="button" class="btn btn-sm btn-secondary" data-act="showtab">Mostrar WhatsApp</button>`;
    } else if (c.state === "checking") {
      title = "Verificando…";
      body = "Procurando o WhatsApp Web nas suas abas.";
    } else {
      title = "WhatsApp Web não está aberto";
      body = "Abra o WhatsApp Web numa aba comum (ou em janela lateral, para ver as duas telas ao mesmo tempo). Se for a primeira vez, escaneie o QR code.";
      actions = `<button type="button" class="btn btn-sm btn-primary" data-act="opentab">Abrir WhatsApp</button><button type="button" class="btn btn-sm btn-secondary" data-act="openwin">Abrir em janela lateral</button>`;
    }
    this.panel.innerHTML = `<div class="wa-panel-card"><div class="wa-panel-head"><strong>${title}</strong></div><p class="wa-panel-body">${body}</p><div class="wa-panel-actions">${actions}${settingsLink}</div></div>`;
  }

  showWindowMode() {
    if (!this.panel) return;
    this.panel.innerHTML = `<div class="wa-panel-card"><div class="wa-panel-head"><strong>Janela lateral do WhatsApp</strong></div><p class="wa-panel-body">O WhatsApp Web está numa janela separada ao lado desta. As campanhas usam essa janela para enviar.</p><div class="wa-panel-actions"><button type="button" class="btn btn-sm btn-primary" data-act="focuswin">Trazer para frente</button><button type="button" class="btn btn-sm btn-secondary" data-act="leavewin">Voltar para aba comum</button><button type="button" class="btn btn-sm btn-secondary" data-act="settings">Configurações</button></div></div>`;
  }

  updateWindowStatus(c) {
    if (!this.panel) return;
    const sub = {
      connected: "Conectado" + (c.phone ? " · +" + c.phone : "") + (c.windowMode ? " · janela lateral" : "") + (c.visible === false ? " · OCULTA" : " · visível"),
      qr: "Aguardando o QR code: escaneie na janela do WhatsApp.",
      opening: "Carregando o WhatsApp Web…",
      none: 'Janela do WhatsApp não encontrada. Use "Reabrir janela".',
      error: c.error || "Erro ao verificar o WhatsApp Web",
    }[c.state] || "Verificando…";
    this.sub.textContent = sub;
  }

  async leaveWindowMode() {
    await this.app.api.sendMessage("WA_LEAVE_WINDOW_MODE");
    this.windowMode = false;
    _storageSet({ [KEY_WINDOW_MODE]: false }).catch(() => {});
    this.app.showToast("Modo janela lateral desativado.", "success");
    this._panelKey = null;
    this.poll();
  }

  async relax() {
    await this.app.api.sendMessage("WA_RULES_RELAX");
    this.app.showToast("Modo compatível ativado. Recarregando o WhatsApp…", "success");
    await this.reload();
  }

  summarize(d) {
    const L = [];
    const fp = d?.frameProbe;
    L.push(`Versão: ${d?.version || "?"} · Modo: ${d?.embedExperimental ? "embutido (experimental)" : "aba/janela comum (padrão)"}`);
    const cn = d?.connection;
    L.push(`Estado: ${cn?.state || d?.connectionError || "?"}${cn?.mode ? " (" + cn.mode + ")" : ""}${cn?.windowMode ? " · janela lateral" : ""}`);
    if (d?.visibility) L.push(`Visibilidade: ${d.visibility.visible === true ? "visível" : d.visibility.visible === false ? "OCULTA" : "n/d"} · aba ativa: ${d.visibility.tabActive ?? "n/d"} · página oculta: ${d.visibility.pageHidden ?? "n/d"}`);
    const si = d?.storeInternals;
    if (si) {
      const mods = Object.entries(si.modules || {}).map(([k, v]) => `${k}=${v ? "sim" : "NÃO"}`).join(", ");
      L.push(`Acesso interno (envio rápido): require=${si.hasRequire} · webpack=${si.hasWebpack} · via=${si.via || "nenhum"} · chats=${si.chats ?? "?"}`);
      L.push(`Módulos: ${mods}${si.disabledAfterFailure ? " · envio rápido desativado após falha" : ""}`);
    } else L.push("Acesso interno (envio rápido): sem dados (WhatsApp não conectado?)");
    if (d?.embedExperimental) {
      L.push(`Nível de compatibilidade: ${d?.level ?? "?"} (0 = padrão, 1 = sem Referer/origem livre)`);
      L.push(d?.embeddedFrame ? "Iframe do WhatsApp: carregado" : "Iframe do WhatsApp: não encontrado");
      if (fp) {
        L.push(`Resposta da página: HTTP ${fp.nav?.httpStatus ?? "n/d"} · título "${fp.title || "-"}"`);
        L.push(`Armazenamento no iframe: localStorage ${fp.localStorage} · IndexedDB ${fp.indexedDB} · acesso ${fp.storageAccess}`);
        L.push(`Referer enviado: ${fp.referrer ? fp.referrer : "(nenhum)"}`);
      }
      if (d?.frameProbeError) L.push("Sondagem do iframe falhou: " + d.frameProbeError);
    }
    return L.join("\n");
  }

  async diagnose() {
    const res = await this.app.api.sendMessage("WA_DIAGNOSE");
    const data = res?.data || res;
    this.diagText = this.summarize(data) + "\n\n" + JSON.stringify(data, null, 2);
    this.setOverlay("diag", `
      <div class="wa-help">
        <h3>Diagnóstico</h3>
        <p>Copie e envie ao suporte se o problema continuar.</p>
        <pre class="wa-help-pre">${this.escape(this.diagText)}</pre>
        <div class="wa-help-actions">
          <button class="btn btn-primary btn-sm" data-act="copy">Copiar</button>
          <button class="btn btn-secondary btn-sm" data-act="closeoverlay">Fechar</button>
        </div>
      </div>`);
  }

  async copyDiag() {
    try { await navigator.clipboard.writeText(this.diagText || ""); this.app.showToast("Diagnóstico copiado", "success"); }
    catch { this.app.showToast("Não foi possível copiar", "error"); }
  }

  escape(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : String(t);
    return d.innerHTML;
  }
}