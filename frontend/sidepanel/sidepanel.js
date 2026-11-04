/**
 * i9Hub SaaS - Sidepanel Main Entry
 * Adaptado da extensão Chrome para SPA web multi-tenant
 */
import { State } from "./utils/state.js";
import { API } from "./utils/api.js";
import { Toast } from "./utils/toast.js";
import { Spintax } from "./utils/spintax.js";
import { Router } from "./utils/router.js";
import { Header } from "./components/Header.js";
import { DashboardView } from "./components/DashboardView.js";
import { CampaignsWAView } from "./components/CampaignsWAView.js";
import { ExecutionView } from "./components/ExecutionView.js";
import { CRMView } from "./components/CRMView.js";
import { FollowupsView } from "./components/FollowupsView.js";
import { MapsView } from "./components/MapsView.js";
import { ChatsView } from "./components/ChatsView.js";
import { SettingsView } from "./components/SettingsView.js";
import { BusinessProfileView } from "./components/BusinessProfileView.js";
import { LeadModal } from "./components/LeadModal.js";
import { CommunicationModal } from "./components/CommunicationModal.js";
import { CampaignForm } from "./components/CampaignForm.js";
import { WebhookConfigModal } from "./components/WebhookConfigModal.js";
import { LogsView } from "./components/LogsView.js";
import { AIChatView } from "./components/AIChatView.js";
import { WhatsAppDock } from "./components/WhatsAppDock.js";
import { AICostsView } from "./components/AICostsView.js";
import { Tour } from "./components/Tour.js";
import { Help } from "./components/Help.js";
import { logger } from "./utils/logger.js";
import { Privacy } from "./utils/privacy.js";

class App {
  constructor() {
    console.log('[App] Constructor started');
    this.state = new State();
    this.api = new API();
    this.toast = new Toast();
    this.router = new Router(this);
    this.components = {};
    this.businessProfile = null;
    this.tenantInfo = null;
    console.log('[App] Basic objects created, calling init()');
    this.init();
  }

  async init() {
    console.log('[App] init() started');
    console.log("[i9Hub SaaS] Initializing v1.0.0");
    logger({ module: "system", action: "SAAS_INIT", status: "success", message: "SaaS Sidepanel iniciado" });

    // Verificar autenticação
    console.log('[App] Checking token');
    const token = this.api.getToken();
    if (!token) {
      console.log('[App] No token, redirecting to login');
      window.location.href = '/login.html';
      return;
    }

    // Carregar dados do tenant
    console.log('[App] Token found, loading tenant data');
    await this.loadTenantData();
    console.log('[App] Tenant data loaded:', this.tenantInfo);

    // Modo privacidade
    console.log('[App] Initializing privacy');
    await Privacy.init();
    console.log('[App] Privacy initialized');

    // Inicializar UI
    console.log('[App] Creating Header');
    this.header = new Header(this);
    this.header.render();
    console.log('[App] Header rendered');

    // WhatsApp Dock (embed via Evolution API iframe ou link direto)
    console.log('[App] Creating WhatsAppDock');
    this.waDock = new WhatsAppDock(this);
    console.log('[App] WhatsAppDock created');

    // Views
    console.log('[App] Creating views');
    this.views = {
      dashboard: new DashboardView(this),
      "campaigns-wa": new CampaignsWAView(this),
      execution: new ExecutionView(this),
      crm: new CRMView(this),
      followups: new FollowupsView(this),
      maps: new MapsView(this),
      chats: new ChatsView(this),
      "ai-chat": new AIChatView(this, { mode: "auto_reply" }),
      "ai-observer": new AIChatView(this, { mode: "observe_only" }),
      "ai-costs": new AICostsView(this),
      settings: new SettingsView(this),
      "business-profile": new BusinessProfileView(this),
      logs: new LogsView(this),
    };

    // Modals
    console.log('[App] Views created, creating modals');
    this.leadModal = new LeadModal(this);
    this.communicationModal = new CommunicationModal(this);
    this.campaignForm = new CampaignForm(this);
    this.webhookModal = new WebhookConfigModal(this);

    // Carregar dados iniciais
    console.log('[App] Modals created, loading initial data');
    await this.loadInitialData();
    console.log('[App] Initial data loaded');

    // Router
    console.log('[App] Initializing router');
    this.router.init();
    console.log('[App] Router initialized');

    // Heartbeat IA
    this.startRuntimeHeartbeat();

    // Tutorial e Ajuda
    console.log('[App] Creating help and tour');
    this.help = new Help(this);
    this.help.init();
    this.tour = new Tour(this);
    this.tour.init();

    console.log('[App] Help and tour created');
    console.log('[i9Hub SaaS] Fully initialized');
  }

  async loadTenantData() {
    console.log('[App] loadTenantData() started');
    try {
      console.log('[App] Sending GET_TENANT_INFO');
      const res = await this.api.sendMessage('GET_TENANT_INFO');
      console.log('[App] GET_TENANT_INFO response:', res);
      if (res?.success) {
        this.tenantInfo = res.data;
        this.state.set('tenant', res.data);
      }
    } catch (e) {
      console.error("Erro ao carregar tenant:", e);
    }
  }

  async loadInitialData() {
    try {
      const [profileRes, settingsRes] = await Promise.all([
        this.api.getBusinessProfile(),
        this.api.getSettings()
      ]);
      if (profileRes?.success) this.businessProfile = profileRes.data;
      if (settingsRes?.success) this.state.set('settings', settingsRes.data);
    } catch (e) {
      console.error("Erro ao carregar dados iniciais:", e);
    }
  }

  startRuntimeHeartbeat() {
    const beat = () => {
      this.api.sendMessage("AI_HEARTBEAT", { active: true }).catch(() => {});
    };
    beat();
    this.aiHeartbeatTimer = setInterval(beat, 30000);
    document.addEventListener("visibilitychange", beat);
  }

  // Compatibilidade com extensão: hasFeature sempre retorna true no SaaS
  // (controle real está no RLS do Postgres e entitlements do tenant)
  hasFeature(featureId) {
    if (!this.tenantInfo?.entitlements) return true;
    const ents = this.tenantInfo.entitlements;
    if (ents.includes('*')) return true;
    return ents.includes(featureId);
  }

  canUseFeatures() {
    return !!this.api.getToken();
  }

  showToast(message, type = 'info', duration = 4000) {
    this.toast.show(message, type, duration);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new App());
} else {
  new App();
}