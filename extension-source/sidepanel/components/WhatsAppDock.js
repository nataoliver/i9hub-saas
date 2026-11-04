/**
 * WhatsAppDock — painel de ESTADO e AÇÕES do WhatsApp Web (v7.0.5).
 *
 * v7.0.5 — decisão de produto (baseada nos logs da v7.0.4):
 *   • O iframe do WhatsApp foi DESCARTADO como padrão: o servidor respondeu HTTP 400 em todas as
 *     cargas. O modo padrão agora é o WhatsApp Web numa ABA ou JANELA comum, VISÍVEL.
 *   • Este painel não cria mais nenhum <iframe> por conta própria. Ele mostra o estado
 *     (conectado / QR code / não aberto / erro, visível ou oculto) e oferece as ações:
 *     Abrir WhatsApp · Usar esta aba · Mostrar WhatsApp · Abrir em janela lateral · Diagnóstico.
 *   • O iframe continua disponível como opção EXPERIMENTAL (Configurações › Aparência › WhatsApp
 *     embutido), desligada por padrão. Ligada, valem as regras das v7.0.2/7.0.3 (tentativas,
 *     nível de compatibilidade, página de erro).
 *   • "Conectado" nunca é mostrado sobre uma página de erro: se o painel embutido estiver com erro,
 *     isso aparece de forma explícita, mesmo que a conexão venha de uma aba comum.
 */

const WA_URL = "https://web.whatsapp.com/";
const POLL_MS = 2500;          // frequência da verificação de conexão
const LOAD_TIMEOUT_MS = 30000; // (embutido) depois disso, mostramos ajuda de diagnóstico
const KEY_COLLAPSED = "waDockCollapsed";
const KEY_WINDOW_MODE = "waWindowMode";        // (embutido) true = WhatsApp em janela lateral, sem iframe
const KEY_EMBED = "waEmbedExperimental";       // true = usa o WhatsApp embutido (iframe), experimental
const MAX_AUTO = 2;                            // (embutido) tentativas automáticas na página de erro

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
    this.embed = false;          // WhatsApp embutido (iframe) ligado? Padrão: NÃO
    this.campaignRunning = false;
    this.lastStatus = { state: "checking" };
    this.mountedAt = 0;
    this.tabId = null;           // aba que hospeda este painel (só importa no modo embutido)
    this.timer = null;
    this.noticeTimer = null;
    this.windowMode = false;     // (embutido) WhatsApp em janela lateral?
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

  // --------------------------------------------------------------------------
  // Inicialização
  // --------------------------------------------------------------------------
  async init() {
    try {
      const tab = await chrome.tabs.getCurrent();
      this.tabId = tab?.id ?? null;
    } catch { this.tabId = null; }

    const saved = await chrome.storage.local.get([KEY_COLLAPSED, KEY_WINDOW_MODE, KEY_EMBED]).catch(() => ({}));
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
      else if (act === "fulltab") chrome.tabs.create({ url: chrome.runtime.getURL("sidepanel/sidepanel.html#campaigns-wa") });
      else if (act === "closeoverlay") { this.hideOverlay(); if (this.embed && this.windowMode) this.showWindowMode(); }
    });
    this.handle?.addEventListener("click", () => {
      if (!this.app.hasFeature?.("whatsapp.connection")) { this.app.showAccessPrompt?.("whatsapp.connection"); return; }
      this.open();
    });

    // Qualquer ação que precise do WhatsApp (iniciar/retomar campanha) abre o painel.
    document.addEventListener("i9:wa-need", () => { this.open(); if (this.embed) setTimeout(() => this.focusFrame(), 250); });

    // (embutido) aviso de aba da extensão oculta/visível.
    document.addEventListener("visibilitychange", () => {
      if (!this.embed || !this.campaignRunning) return;
      if (document.visibilityState === "visible") {
        this.showNotice("Você voltou. O envio fica em espera enquanto esta aba está oculta e continua sozinho agora.", "info", 6000);
      }
    });

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

  // --------------------------------------------------------------------------
  // Estrutura visual
  // --------------------------------------------------------------------------
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

  /** Painel de estado (padrão) ou iframe (experimental). */
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

  // --------------------------------------------------------------------------
  // Abrir / recolher / recarregar
  // --------------------------------------------------------------------------
  async open() {
    if (this.ready) await this.ready;
    if (this.collapsed) {
      this.collapsed = false;
      chrome.storage.local.set({ [KEY_COLLAPSED]: false }).catch(() => {});
    }
    if (!this.mounted) await this.mount();
    this.refreshChrome();
  }

  collapse() {
    if (this.campaignRunning) return;
    this.collapsed = true;
    chrome.storage.local.set({ [KEY_COLLAPSED]: true }).catch(() => {});
    this.refreshChrome();
  }

  async mount() {
    if (this.mounted) return;
    this.mounted = true;
    this.mountedAt = Date.now();
    this.applyModeClasses();
    this.refreshChrome();

    // Modo padrão (v7.0.5): nenhum iframe. Só acompanha o estado da aba/janela do WhatsApp.
    if (!this.embed) { this.startPolling(); return; }

    // ---- Embutido (experimental) ----
    if (this.tabId == null) {
      await this.init();
      if (this.tabId == null) { this.showNeedFullTab(); return; }
    }
    if (this.windowMode) { this.showWindowMode(); this.startPolling(); return; }
    await this.createFrame();
  }

  /** Chamado pelas Configurações ao ligar/desligar o WhatsApp embutido (experimental). */
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
    await this.app.api.sendMessage("WA_CONNECT");   // aplica a regra que libera o iframe ANTES do pedido
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
      const r = await this.app.api.sendMessage("WA_RELOAD");
      this.app.showToast(r?.success ? "Recarregando a aba do WhatsApp Web…" : "Não há aba do WhatsApp Web para recarregar.", r?.success ? "success" : "error");
      return;
    }
    if (this.windowMode) return this.leaveWindowMode();
    if (!this.frame) return this.open();
    this.hideOverlay();
    this.setStatus({ state: "opening" });
    this.mountedAt = Date.now();
    this.errStreak = 0;
    this.frame.src = "about:blank";
    await new Promise((r) => setTimeout(r, 200));
    this.frame.src = opts.bust ? `${WA_URL}?i9=${Date.now()}` : WA_URL;
  }

  async retry() {
    this.autoTry = 0; this.errStreak = 0;
    await this.app.api.sendMessage("WA_SET_LEVEL", { level: 0 });
    await this.reload();
  }

  focusFrame() { try { this.frame?.focus(); } catch { /* sem foco: ok */ } }

  // --------------------------------------------------------------------------
  // Ações do modo aba/janela (padrão)
  // --------------------------------------------------------------------------
  /** "Abrir WhatsApp": aba comum ativa (reaproveita a que já existir). */
  async openTab() {
    const r = await this.app.api.sendMessage("WA_OPEN_NEW_TAB");
    if (!r?.success) { this.app.showToast(r?.error || "Não foi possível abrir o WhatsApp Web", "error"); return; }
    this.app.showToast(r.data?.reused ? "WhatsApp Web já estava aberto: trazido para frente." : "WhatsApp Web aberto numa nova aba. Escaneie o QR code se for a primeira vez.", "success");
    this._panelKey = null; this.poll();
  }

  /** "Usar esta aba": fixa a aba detectada como a do envio e a traz para frente. */
  async useTab() {
    const r = await this.app.api.sendMessage("WA_USE_TAB", { tabId: this.lastStatus?.tabId });
    if (!r?.success) { this.app.showToast(r?.error || "Não foi possível usar a aba do WhatsApp", "error"); return; }
    this.app.showToast("Usando a aba do WhatsApp Web para as campanhas.", "success");
    this._panelKey = null; this.poll();
  }

  /** "Mostrar WhatsApp": traz a aba/janela para frente. */
  async showTab() {
    await this.app.api.sendMessage("WA_OPEN_TAB");
    setTimeout(() => this.poll(), 600);
  }

  // --------------------------------------------------------------------------
  // Estado da conexão
  // --------------------------------------------------------------------------
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

      // ---- Embutido (experimental) ----
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
    // "Conectado" nunca sobre uma página de erro: o erro do painel embutido tem prioridade visual.
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

  /** Painel de estado e ações (modo aba/janela). */
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

    this.panel.innerHTML = `
      <div class="wa-help">
        <h3>${e(title)}</h3>
        <p>${body}</p>
        <div class="wa-help-actions">${actions}</div>
        <hr class="wa-help-sep">
        <p class="wa-help-small">Duas formas de deixar o WhatsApp visível: <b>janela ao lado</b> (as duas telas aparecem juntas) ou <b>mesma janela</b> (deixe a aba do WhatsApp ativa durante o envio).</p>
        <p class="wa-help-small">O WhatsApp embutido (iframe) é experimental e está desligado. ${settingsLink}</p>
      </div>`;
  }

  // --------------------------------------------------------------------------
  // Campanha em andamento
  // --------------------------------------------------------------------------
  onCampaignProgress(p) {
    if (!p) return;
    if (p.status === "running" && !this.campaignRunning) { this.campaignRunning = true; this.open(); }
    else if (p.status !== "running" && this.campaignRunning) { this.campaignRunning = false; }
    if (p.event === "CAMPAIGN_WAITING_VISIBLE") {
      this.showNotice("O WhatsApp ficou fora de vista: o envio está em espera e continua sozinho quando ele voltar a ficar visível.", "warn", 9000);
      return;
    }
    this.refreshChrome();
  }

  // --------------------------------------------------------------------------
  // Avisos e telas de ajuda
  // --------------------------------------------------------------------------
  showNotice(text, tone = "info", ms = 0) {
    this.noticeKind = ms ? "temp" : "running";
    this.notice.textContent = text;
    this.notice.dataset.tone = tone;
    this.notice.hidden = false;
    clearTimeout(this.noticeTimer);
    if (ms) this.noticeTimer = setTimeout(() => { this.hideNotice(); this.refreshChrome(); }, ms);
  }
  hideNotice() { this.notice.hidden = true; this.noticeKind = null; }

  hideOverlay() { this.overlay.hidden = true; this.overlayKind = null; this.overlay.innerHTML = ""; }
  setOverlay(kind, html) { this.overlayKind = kind; this.overlay.innerHTML = html; this.overlay.hidden = false; }

  // ---- Embutido (experimental): telas de ajuda -------------------------------------------------
  showNeedFullTab() {
    this.setOverlay("fulltab", `
      <div class="wa-help">
        <h3>Abra em tela cheia</h3>
        <p>O WhatsApp embutido (experimental) funciona na versão em <b>aba</b> do i9Hub. Este modo (popup ou painel estreito) não consegue hospedá-lo.</p>
        <div class="wa-help-actions"><button class="btn btn-primary btn-sm" data-act="fulltab">Abrir em tela cheia</button></div>
      </div>`);
  }

  showSlow() {
    this.setOverlay("slow", `
      <div class="wa-help">
        <h3>O WhatsApp está demorando para carregar</h3>
        <p>O painel embutido é experimental. Tente nesta ordem:</p>
        <ol><li>Recarregar o painel.</li><li>Ativar o <b>modo compatível</b>.</li><li>Usar o WhatsApp numa aba ou janela lateral (recomendado).</li></ol>
        <div class="wa-help-actions">
          <button class="btn btn-primary btn-sm" data-act="reload">Recarregar</button>
          <button class="btn btn-secondary btn-sm" data-act="relax">Modo compatível</button>
          <button class="btn btn-secondary btn-sm" data-act="openwin">Abrir em janela lateral</button>
          <button class="btn btn-secondary btn-sm" data-act="diag">Diagnóstico</button>
        </div>
      </div>`);
  }

  showBlocked(error) {
    this.setOverlay("blocked", `
      <div class="wa-help">
        <h3>O Chrome bloqueou o WhatsApp no painel</h3>
        <p>O WhatsApp Web envia cabeçalhos de segurança que proíbem ser exibido dentro de outra página. A extensão normalmente os remove sozinha; aqui isso não aconteceu.</p>
        <p class="wa-help-code">${this.escape(error || "erro desconhecido")}</p>
        <div class="wa-help-actions">
          <button class="btn btn-primary btn-sm" data-act="relax">Ativar modo compatível</button>
          <button class="btn btn-secondary btn-sm" data-act="openwin">Abrir em janela lateral</button>
          <button class="btn btn-secondary btn-sm" data-act="diag">Diagnóstico</button>
        </div>
      </div>`);
  }

  showWaError(c) {
    const i = c?.pageInfo || {};
    const detail = [i.httpStatus ? `HTTP ${i.httpStatus}` : null, i.title || null].filter(Boolean).join(" · ");
    this.setOverlay("waerror", `
      <div class="wa-help">
        <h3>O WhatsApp mostrou uma página de erro</h3>
        <p>O painel embutido carregou, mas o próprio WhatsApp respondeu com a tela de erro dele. A extensão já tentou de novo ${MAX_AUTO}× e não resolveu. (Nos testes da v7.0.4 isso acontecia sempre: por isso o embutido é só experimental.)</p>
        ${detail ? `<p class="wa-help-code">${this.escape(detail)}</p>` : ""}
        <p><b>Caminho recomendado:</b> abrir o WhatsApp numa <b>janela lateral</b> ou aba comum.</p>
        <div class="wa-help-actions">
          <button class="btn btn-primary btn-sm" data-act="openwin">Abrir em janela lateral</button>
          <button class="btn btn-secondary btn-sm" data-act="retry">Tentar de novo</button>
          <button class="btn btn-secondary btn-sm" data-act="diag">Diagnóstico</button>
        </div>
      </div>`);
  }

  // ---- Janela lateral -------------------------------------------------------------------------
  async openWindow() {
    const scr = { left: window.screen.availLeft ?? 0, top: window.screen.availTop ?? 0, width: window.screen.availWidth, height: window.screen.availHeight };
    const res = await this.app.api.sendMessage("WA_OPEN_WINDOW", { screen: scr });
    if (!res?.success) { this.app.showToast(res?.error || "Não foi possível abrir a janela do WhatsApp", "error"); return; }
    this._panelKey = null;
    if (this.embed) await this.enterWindowMode();
    else {
      // A extensão foi redimensionada para dividir a tela com o WhatsApp: recolhe o painel para sobrar espaço.
      this.collapsed = true;
      chrome.storage.local.set({ [KEY_COLLAPSED]: true }).catch(() => {});
      this.refreshChrome();
      this.poll();
    }
    this.app.showToast("WhatsApp aberto na janela lateral, ao lado desta. Se for a primeira vez, escaneie o QR code nela.", "success");
  }

  async enterWindowMode() {
    this.windowMode = true;
    chrome.storage.local.set({ [KEY_WINDOW_MODE]: true }).catch(() => {});
    if (this.frame) { this.frame.src = "about:blank"; this.frame.remove(); this.frame = null; }
    this.slot.innerHTML = "";
    this.mounted = true;
    this.errStreak = 0; this.autoTry = 0;
    this.showWindowMode();
    this.startPolling();
    this.collapsed = true;
    chrome.storage.local.set({ [KEY_COLLAPSED]: true }).catch(() => {});
    this.refreshChrome();
  }

  async leaveWindowMode() {
    this.windowMode = false;
    chrome.storage.local.set({ [KEY_WINDOW_MODE]: false }).catch(() => {});
    this.hideOverlay();
    this.autoTry = 0; this.errStreak = 0; this.mountedAt = Date.now();
    this.stopPolling();
    await this.app.api.sendMessage("WA_SET_LEVEL", { level: 0 });
    if (!this.frame) await this.createFrame();
    this.collapsed = false;
    this.refreshChrome();
  }

  showWindowMode() {
    this.setOverlay("window", `
      <div class="wa-help">
        <h3>WhatsApp na janela lateral</h3>
        <p>O WhatsApp Web está numa janela ao lado desta. Deixe <b>as duas janelas visíveis, lado a lado</b>, durante o envio.</p>
        <p class="wa-help-code" id="wa-window-status">Verificando…</p>
        <div class="wa-help-actions">
          <button class="btn btn-primary btn-sm" data-act="focuswin">Mostrar janela do WhatsApp</button>
          <button class="btn btn-secondary btn-sm" data-act="openwin">Reabrir janela</button>
          <button class="btn btn-secondary btn-sm" data-act="leavewin">Voltar ao painel embutido</button>
          <button class="btn btn-secondary btn-sm" data-act="diag">Diagnóstico</button>
        </div>
      </div>`);
  }

  updateWindowStatus(c) {
    const el = this.root.querySelector("#wa-window-status");
    if (!el) return;
    el.textContent = {
      connected: "Conectado" + (c.phone ? " · +" + c.phone : "") + (c.windowMode ? " · janela lateral" : "") + (c.visible === false ? " · OCULTA" : " · visível"),
      qr: "Aguardando o QR code: escaneie na janela do WhatsApp.",
      opening: "Carregando o WhatsApp Web…",
      none: "Janela do WhatsApp não encontrada. Use “Reabrir janela”.",
      error: c.error || "Erro ao verificar o WhatsApp Web",
    }[c.state] || "Verificando…";
  }

  async relax() {
    await this.app.api.sendMessage("WA_RULES_RELAX");
    this.app.showToast("Modo compatível ativado. Recarregando o WhatsApp…", "success");
    await this.reload();
  }

  // ---- Diagnóstico -----------------------------------------------------------------------------
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
        L.push(`Resposta da página: HTTP ${fp.nav?.httpStatus ?? "n/d"} · título “${fp.title || "-"}”`);
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
