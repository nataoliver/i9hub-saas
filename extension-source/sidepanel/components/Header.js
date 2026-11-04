import { Privacy } from '../utils/privacy.js';
import { creditHTML } from '../utils/brand.js';

export class Header {
  constructor(app) { this.app = app; this.sidebar = null; this.nav = null; }

  render() {
    this.sidebar = document.querySelector('.sidebar');
    if (!this.sidebar) return;
    this.sidebar.innerHTML = this.getSidebarHTML();
    this.nav = this.sidebar.querySelector('#sidebar-nav');
    this.renderNav();
    this.bindEvents();
    this.updateLicense(this.app.state.get('license'), this.app.state.get('usage'));
  }

  renderNav() {
    const icons = { dashboard: '🏠', 'campaigns-wa': '💬', execution: '📊', crm: '🗂️', followups: '⏰', maps: '📍', chats: '👥', 'ai-chat': '🤖', 'ai-observer': '👁️', 'ai-costs': '🪙', settings: '⚙️', 'business-profile': '🧩' };
    const labels = { dashboard: 'Dashboard', 'campaigns-wa': 'WhatsApp', execution: 'Execução', crm: 'CRM', followups: 'Follow-ups', maps: 'Extração Google Maps', chats: 'Extração Grupos do WhatsApp', 'ai-chat': 'IA - Atendimento', 'ai-observer': 'IA - Observador', 'ai-costs': 'Custos e Tokens', settings: 'Configurações', 'business-profile': 'Meu negócio' };
    this.nav.innerHTML = Object.keys(this.app.router.routes).filter((r) => !this.app.router.routes[r].hidden).map((r) =>
      `<a class="nav-item" role="button" tabindex="0" data-route="${r}" title="${this.app.router.routes[r].title}"><span class="nav-icon">${icons[r] || '•'}</span><span class="nav-label">${labels[r] || r}</span></a>`
    ).join('');
  }

  getSidebarHTML() {
    const version = chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version;
    return `<div class="sidebar-header"><img src="../icons/icon-32.png" alt="i9Hub v${version}" class="logo-icon"><h1 class="logo-text">i9Hub</h1><span class="version-badge" id="version-badge">v${version}</span></div>
      <nav class="sidebar-nav" id="sidebar-nav"></nav>
      <div class="sidebar-tools"><button type="button" class="btn btn-sm btn-primary whatsapp-quick-open" id="open-whatsapp-btn" title="Abrir ou reutilizar o WhatsApp Web ao lado da extensão"><span aria-hidden="true">💬</span> Abrir WhatsApp</button><button type="button" class="btn btn-sm btn-secondary privacy-toggle-btn" id="privacy-btn" title="Desfoca nomes, telefones e conversas (Alt+Shift+P)">👁️ Privacidade</button></div>
      <div class="sidebar-suggestions"><button type="button" class="btn btn-sm btn-outline suggestions-btn" id="suggestions-btn" title="Sugerir funcionalidades ou melhorias">💡 Sugestões</button></div>
      <div class="sidebar-footer"><div class="license-status" id="license-status"><span class="status-indicator" id="status-indicator"></span><div class="license-info"><span class="license-plan" id="license-plan">DEMONSTRAÇÃO</span><span class="license-usage" id="license-usage">Conta não ativada</span></div></div><button class="btn btn-sm btn-secondary upgrade-btn" id="upgrade-btn" title="Solicitar conta gratuita">Quero conta grátis</button>${creditHTML('rodape_menu')}</div>`;
  }

  bindEvents() {
    this.nav.addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (item?.dataset.route) this.app.router.navigate(item.dataset.route);
    });
    this.nav.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const item = e.target.closest('.nav-item');
      if (item?.dataset.route) { e.preventDefault(); this.app.router.navigate(item.dataset.route); }
    });
    this.sidebar.querySelector('#upgrade-btn')?.addEventListener('click', () => {
      const license = this.app.state.get('license');
      this.app.requestWhatsApp(license?.licensed ? 'license-support' : 'free-account');
    });
    const openWhatsAppButton = this.sidebar.querySelector('#open-whatsapp-btn');
    openWhatsAppButton?.addEventListener('click', async () => {
      // A conexão com WhatsApp é um recurso operacional liberado pela licença.
      if (this.app.hasFeature && !this.app.hasFeature('whatsapp.connection')) {
        this.app.showAccessPrompt?.('whatsapp.connection');
        return;
      }
      const original = openWhatsAppButton.innerHTML;
      openWhatsAppButton.disabled = true;
      openWhatsAppButton.innerHTML = '<span aria-hidden="true">⏳</span> Abrindo…';
      try {
        await this.app.waDock?.open();
        if (this.app.waDock) await this.app.waDock.openWindow();
        else this.app.showToast('O módulo de conexão do WhatsApp ainda não foi inicializado.', 'error');
      } catch (error) {
        this.app.showToast(error?.message || 'Não foi possível abrir o WhatsApp Web.', 'error');
      } finally {
        openWhatsAppButton.disabled = false;
        openWhatsAppButton.innerHTML = original;
      }
    });
    const privacyButton = this.sidebar.querySelector('#privacy-btn');
    const suggestionsButton = this.sidebar.querySelector('#suggestions-btn');
    if (suggestionsButton) {
      suggestionsButton.addEventListener('click', () => {
        const url = 'https://forms.gle/8o1Xz2FTbLdWcCoo9';
        chrome.tabs.create({ url });
      });
    }
    if (privacyButton) {
      privacyButton.addEventListener('click', () => Privacy.toggle());
      const sync = (config) => {
        privacyButton.classList.toggle('on', !!config.on);
        privacyButton.textContent = config.on ? '🙈 Privacidade: ligada' : '👁️ Privacidade';
        privacyButton.setAttribute('aria-pressed', config.on ? 'true' : 'false');
      };
      Privacy.onChange(sync);
      sync(Privacy.cfg);
    }
  }

  updateActiveRoute(route) {
    this.nav?.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.route === route));
  }

  updateLicense(license, usage) {
    const planEl = this.sidebar?.querySelector('#license-plan');
    const usageEl = this.sidebar?.querySelector('#license-usage');
    const indicator = this.sidebar?.querySelector('#status-indicator');
    const upgradeButton = this.sidebar?.querySelector('#upgrade-btn');
    if (!planEl || !usageEl || !indicator || !upgradeButton) return;

    const licensed = !!(license && (license.licensed || license.valid));
    if (licensed && license.entitlementsConfigured) {
      const enabledCount = Array.isArray(license.features) ? license.features.filter((feature) => feature.enabled && feature.implemented).length : (license.entitlements || []).length;
      planEl.textContent = String(license.plan || 'LICENCIADO').toUpperCase();
      usageEl.textContent = `${enabledCount} função(ões) liberada(s)`;
      indicator.className = 'status-indicator valid';
      upgradeButton.style.display = 'none';
      return;
    }

    if (licensed) {
      planEl.textContent = 'LICENÇA ATIVA';
      usageEl.textContent = 'Permissões pendentes no painel';
      indicator.className = 'status-indicator warning';
      upgradeButton.style.display = '';
      upgradeButton.textContent = 'Falar com suporte';
      upgradeButton.title = 'Solicitar conferência das permissões da licença';
      return;
    }

    planEl.textContent = 'DEMONSTRAÇÃO';
    usageEl.textContent = 'Conta não ativada';
    indicator.className = 'status-indicator warning';
    upgradeButton.style.display = '';
    upgradeButton.textContent = 'Quero conta grátis';
    upgradeButton.title = 'Solicitar uma conta gratuita pelo WhatsApp';
  }
}
