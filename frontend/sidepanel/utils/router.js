export class Router {
  constructor(app) {
    this.app = app;
    this.routes = {
      dashboard: { title: 'Dashboard', icon: 'fa-house' },
      'campaigns-wa': { title: 'Campanhas WhatsApp', icon: 'fa-message' },
      execution: { title: 'Central de Execução', icon: 'fa-gauge-high' },
      crm: { title: 'CRM Leads', icon: 'fa-database' },
      followups: { title: 'Follow-ups', icon: 'fa-clock' },
      maps: { title: 'Extração Google Maps', icon: 'fa-map-marker-alt' },
      chats: { title: 'Extração Grupos do WhatsApp', icon: 'fa-users' },
      'ai-chat': { title: 'IA - Atendimento', icon: 'fa-robot' },
      'ai-costs': { title: 'Custos e Tokens', icon: 'fa-coins' },
      'ai-observer': { title: 'IA - Observador', icon: 'fa-eye' },
      settings: { title: 'Configurações', icon: 'fa-gear' },
      'business-profile': { title: 'Meu negócio', icon: 'fa-sliders' },
      logs: { title: 'Logs do Sistema', icon: 'fa-bug', hidden: true },
    };
    this.currentRoute = null;
  }

  init() {
    window.addEventListener('hashchange', () => this.handleHashChange());
    this.handleHashChange();
  }

  handleHashChange() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    if (this.routes[hash]) this.navigate(hash);
    else this.navigate('dashboard');
  }

  navigate(route) {
    if (this.currentRoute === route) return;
    const previousRoute = this.currentRoute;
    if (previousRoute && this.app.views?.[previousRoute]?.onLeave) this.app.views[previousRoute].onLeave();
    this.currentRoute = route;
    window.location.hash = route;
    this.app.header.updateActiveRoute(route);
    this.renderView(route);
  }

  async renderView(route) {
    const mainContent = document.getElementById('main-content');
    const viewContainer = document.getElementById('view-content') || mainContent;
    const footerSlot = document.getElementById('footer-ad-slot') || mainContent;
    if (!mainContent || !viewContainer) return;
    if ((route === 'campaigns-wa' || route === 'chats') && this.app.hasFeature?.('whatsapp.connection')) this.app.waDock?.open();

    if (route === 'followups' && !this.app.hasFeature?.('crm.followup.manage')) {
      viewContainer.innerHTML = `<div class="empty-state"><div class="icon"><i class="fas fa-lock"></i></div><h3>Follow-ups</h3><p>O gerenciamento de follow-ups depende de uma licença que inclua este módulo.</p><button class="btn btn-secondary" data-feature="crm.followup.manage">Conhecer funcionalidade</button></div>`;
      viewContainer.querySelector('[data-feature]')?.addEventListener('click', () => this.app.showAccessPrompt?.('crm.followup.manage'));
      this.app.applyLicenseAccessMode?.(viewContainer);
      this.app.renderAdminFooterAd?.(footerSlot);
      return;
    }
    // Logs são lidos localmente; proteja a rota e mantenha o espaço publicitário separado do conteúdo.
    if (route === 'logs' && !this.app.hasFeature?.('system.logs')) {
      viewContainer.innerHTML = `<div class="empty-state"><div class="icon"><i class="fas fa-lock"></i></div><h3>Logs do sistema</h3><p>O acesso aos logs depende de uma licença que inclua essa funcionalidade.</p><button class="btn btn-secondary" data-feature="system.logs">Solicitar liberação</button></div>`;
      this.app.applyLicenseAccessMode?.(viewContainer);
      this.app.renderAdminFooterAd?.(footerSlot);
      return;
    }
    const view = this.app.views[route];
    if (!view) {
      viewContainer.innerHTML = `<div class="empty-state"><div class="icon"><i class="fas fa-exclamation-triangle"></i></div><h3>View não encontrada</h3><p>Rota: ${String(route)}</p></div>`;
      this.app.applyLicenseAccessMode?.(viewContainer);
      this.app.renderAdminFooterAd?.(footerSlot);
      return;
    }
    viewContainer.innerHTML = '';
    await view.render(viewContainer);
    this.app.applyLicenseAccessMode?.(viewContainer);
    this.app.renderAdminFooterAd?.(footerSlot);
  }
}
