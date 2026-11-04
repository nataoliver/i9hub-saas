/**
 * Modo privacidade (blur) — lado do painel da extensão (v1.2.0-pro).
 * Compartilha o estado com o script do WhatsApp Web (content/privacy.js) pela chave "privacyMode"
 * em chrome.storage.local: ligar de um lado liga do outro, na hora.
 * Atalho: Alt+Shift+P.
 */
const KEY = "privacyMode";
const DEF = { on: false, names: true, messages: true, photos: true, panel: true, hover: true };

export const Privacy = {
  cfg: { ...DEF },
  listeners: new Set(),

  async init() {
    try { this.cfg = { ...DEF, ...((await chrome.storage.local.get(KEY))[KEY] || {}) }; } catch { /* padrão */ }
    this.apply();
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !changes[KEY]) return;
        this.cfg = { ...DEF, ...(changes[KEY].newValue || {}) };
        this.apply();
      });
    } catch { /* ignora */ }
    document.addEventListener("keydown", (e) => {
      if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === "KeyP") { e.preventDefault(); this.toggle(); }
    }, true);
  },

  apply() {
    const b = document.body;
    if (b) {
      b.classList.toggle("i9p-on", !!this.cfg.on && this.cfg.panel !== false);
      b.classList.toggle("i9p-hover", this.cfg.hover !== false);
    }
    this.listeners.forEach((cb) => { try { cb(this.cfg); } catch { /* ignora */ } });
  },

  onChange(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); },

  async set(patch) {
    this.cfg = { ...this.cfg, ...patch };
    this.apply();
    try { await chrome.storage.local.set({ [KEY]: this.cfg }); } catch { /* ignora */ }
  },

  toggle() { return this.set({ on: !this.cfg.on }); },
};
