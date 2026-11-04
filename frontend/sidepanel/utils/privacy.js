/**
 * Modo privacidade (blur) — compatível com SaaS web e extensão Chrome.
 * No SaaS, usa localStorage como fallback quando chrome.storage não existe.
 * Atalho: Alt+Shift+P.
 */
const KEY = "privacyMode";
const DEF = { on: false, names: true, messages: true, photos: true, panel: true, hover: true };
const isExtension = typeof chrome !== "undefined" && !!chrome.storage?.local;

async function storageGet(key) {
  if (isExtension) {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  }
  try { return JSON.parse(localStorage.getItem(`i9hub_${key}`)); } catch { return null; }
}

async function storageSet(key, value) {
  if (isExtension) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  try { localStorage.setItem(`i9hub_${key}`, JSON.stringify(value)); } catch { /* ignora */ }
}

export const Privacy = {
  cfg: { ...DEF },
  listeners: new Set(),

  async init() {
    try {
      const stored = await storageGet(KEY);
      this.cfg = { ...DEF, ...(stored || {}) };
    } catch { /* padrão */ }
    this.apply();
    if (isExtension) {
      try {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area !== "local" || !changes[KEY]) return;
          this.cfg = { ...DEF, ...(changes[KEY].newValue || {}) };
          this.apply();
        });
      } catch { /* ignora */ }
    }
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
    try { await storageSet(KEY, this.cfg); } catch { /* ignora */ }
  },

  toggle() { return this.set({ on: !this.cfg.on }); },
};
