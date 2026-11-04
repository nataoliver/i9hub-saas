
/**
 * i9Hub Extension - Sidepanel Main Entry
 * CRM, WhatsApp, Maps & Settings
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
import { LicenseModal } from "./components/LicenseModal.js";
import { LogsView } from "./components/LogsView.js";
import { AIChatView } from "./components/AIChatView.js";
import { WhatsAppDock } from "./components/WhatsAppDock.js";
import { AICostsView } from "./components/AICostsView.js";
import { Tour } from "./components/Tour.js";
import { Help } from "./components/Help.js";
import { logger } from "./utils/logger.js";
import { Privacy } from "./utils/privacy.js";
import { buildWhatsAppUrl } from "../lib/onboarding.js";
import { hasFeatureEntitlement } from "../lib/feature-catalog.js";

// ============================================================================
// MAIN APP INITIALIZATION
// ============================================================================

class App {
  constructor() {
    this.state = new State();
    this.api = new API();
    this.toast = new Toast();
    this.router = new Router(this);
    this.components = {};
    this.shownAdminNotifications = new Set();
    this.seenFooterAdIds = new Set();
    
    this.init();
  }

  async init() {
    console.log("[i9Hub] Initializing Sidepanel v" + (chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version) + "");
    logger({module:"system", action:"SIDE_PANEL_INIT", status:"success", message:"Sidepanel iniciado"});
    
    // Modo privacidade (blur): carregado antes do menu, que mostra o botão
    await Privacy.init();

    // Initialize UI components
    this.header = new Header(this);
    this.header.render();
    
    // WhatsApp Web embutido (v7.0.2): criado antes das telas, que dependem dele.
    this.waDock = new WhatsAppDock(this);

    // Initialize view components
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
    
    // Initialize modals
    this.leadModal = new LeadModal(this);
    this.communicationModal = new CommunicationModal(this);
    this.campaignForm = new CampaignForm(this);
    this.webhookModal = new WebhookConfigModal(this);
    this.licenseModal = new LicenseModal(this);
    this.setupLicensePreviewGuard();
    document.addEventListener("i9:usage", () => this.refreshLicense());
    
    // Load initial data (including the business profile) before the first route render.
    await this.loadInitialData();

    // Setup router
    this.router.init();
    this.startRuntimeHeartbeat();
    await this.loadAdminExperience();
    this.adminConfigTimer = setInterval(() => this.loadAdminExperience(), 15 * 60 * 1000);
    window.addEventListener("pagehide", () => { if (this.hasFeature("whatsapp.ai_support")) this.api.sendMessage("AI_HEARTBEAT", { active: false }); });
    
    // Listen for background messages
    this.setupMessageListeners();

    // Tutorial e Ajuda lateral com pesquisa (v1.6.0; ver components/Help.js)
    this.help = new Help(this);
    this.help.init();

    // Apresentação guiada (abre sozinha só na primeira vez; ver components/Tour.js)
    this.tour = new Tour(this);
    this.tour.init();
    
    console.log("[i9Hub] Sidepanel fully initialized");
  }

  startRuntimeHeartbeat() {
    const beat = () => { if (this.hasFeature("whatsapp.ai_support")) this.api.sendMessage("AI_HEARTBEAT", { active: true }).catch?.(() => {}); };
    beat();
    this.aiHeartbeatTimer = setInterval(beat, 10000);
    document.addEventListener("visibilitychange", beat);
  }

  async loadAdminExperience() {
    if (!this.canUseFeatures()) return;
    { const profileResult = await this.api.sendMessage('TELEMETRY_GET_PROFILE'); if (profileResult?.success) this.telemetryProfile = profileResult.data || {}; }
    const r = await this.api.sendMessage("ADMIN_GET_CONFIG");
    if (!r?.success) return;
    this.adminConfig = r.data || {};
    this.showAdminNotifications(this.adminConfig.notifications || []);
    if (this.router?.currentRoute) this.renderAdminFooterAd(document.getElementById("footer-ad-slot"));
  }

  async showAdminNotifications(notifications = []) {
    if (!this.hasFeature("notifications.in_app") || !Array.isArray(notifications) || !notifications.length) return;
    const profileRes = await this.api.sendMessage("TELEMETRY_GET_PROFILE");
    const profile = profileRes?.data || {};
    this.telemetryProfile = profile;
    const license = this.state.get("license") || {};
    const now = Date.now();
    const valid = notifications.filter((n) => {
      if (!n?.id || (n.startsAt && Date.parse(n.startsAt) > now) || (n.endsAt && Date.parse(n.endsAt) < now)) return false;
      if (n.targetIndustries?.length && !n.targetIndustries.includes(profile.industry || "")) return false;
      if (n.targetRoles?.length && !n.targetRoles.includes(profile.role || "")) return false;
      if (n.targetFeatures?.length && !n.targetFeatures.every(id => this.hasFeature(id))) return false;
      if (n.excludeIndustries?.includes(profile.industry || "")) return false;
      if (n.targetPlans?.length && !n.targetPlans.map(x => String(x).toLowerCase()).includes(String(license.plan || "").toLowerCase())) return false;
      return true;
    });
    const stored = await chrome.storage.local.get("i9DismissedAdminNotifications");
    const dismissed = new Set(stored.i9DismissedAdminNotifications || []);
    const notification = valid.find((n) => !dismissed.has(n.id) && !this.shownAdminNotifications.has(n.id));
    if (!notification) return;
    const layer = document.getElementById("admin-notification-layer");
    if (!layer) return;
    layer.replaceChildren();
    const card = document.createElement("section"); card.className = "i9-admin-notification"; card.setAttribute("role", "status");
    const top = document.createElement("div"); top.className = "i9-admin-notification-top";
    const mark = document.createElement("span"); mark.className = "i9-admin-notification-mark"; mark.textContent = "i9";
    const label = document.createElement("span"); label.textContent = "Aviso do i9Hub";
    const close = document.createElement("button"); close.type = "button"; close.className = "i9-admin-notification-close"; close.textContent = "×"; close.setAttribute("aria-label", "Dispensar aviso");
    close.addEventListener("click", async () => { dismissed.add(notification.id); await chrome.storage.local.set({ i9DismissedAdminNotifications: [...dismissed].slice(-300) }); card.remove(); this.api.sendMessage("TRACK_TELEMETRY_EVENT", { name: "notification.dismissed", featureId: "notifications.in_app", metadata: { count: 1 } }); });
    top.append(mark, label, close);
    const title = document.createElement("strong"); title.className = "i9-admin-notification-title"; title.textContent = notification.title || "Aviso";
    const body = document.createElement("p"); body.className = "i9-admin-notification-body"; body.textContent = notification.text || "";
    card.append(top, title, body);
    if (notification.buttonLabel && notification.url) { const action = document.createElement("button"); action.className = "btn btn-primary btn-sm"; action.textContent = notification.buttonLabel; action.addEventListener("click", async () => { chrome.tabs.create({ url: notification.url }); dismissed.add(notification.id); await chrome.storage.local.set({ i9DismissedAdminNotifications: [...dismissed].slice(-300) }); card.remove(); this.api.sendMessage("TRACK_TELEMETRY_EVENT", { name: "notification.clicked", featureId: "notifications.in_app", metadata: { count: 1 } }); }); card.append(action); }
    layer.append(card);
    this.shownAdminNotifications.add(notification.id);
    this.api.sendMessage("TRACK_TELEMETRY_EVENT", { name: "notification.displayed", featureId: "notifications.in_app", metadata: { count: 1 } });
  }

  renderAdminFooterAd(container) {
    if (!container) return;
    container.replaceChildren();
    const ad = this.adminConfig?.footerAd;
    const profile = this.state.get("license") || {};
    const industry = this.telemetryProfile?.industry || "";
    const now = Date.now();
    if (!ad?.active) { container.hidden = true; return; }
    if ((ad.startsAt && Date.parse(ad.startsAt) > now) || (ad.endsAt && Date.parse(ad.endsAt) < now)) { container.hidden = true; return; }
    if (ad.targetPlans?.length && !ad.targetPlans.map(x=>String(x).toLowerCase()).includes(String(profile.plan||"").toLowerCase())) { container.hidden = true; return; }
    if (ad.targetIndustries?.length && (!industry || !ad.targetIndustries.includes(industry))) { container.hidden = true; return; }
    if (ad.targetRoles?.length && (!this.telemetryProfile?.role || !ad.targetRoles.includes(this.telemetryProfile.role))) { container.hidden = true; return; }
    if (ad.targetFeatures?.length && !ad.targetFeatures.every(id => this.hasFeature(id))) { container.hidden = true; return; }
    const safeHttps = (value) => { try { const u = new URL(String(value || "")); return u.protocol === "https:" && !u.username && !u.password ? u.href : ""; } catch { return ""; } };
    const imageUrl = safeHttps(ad.imageUrl);
    const destination = safeHttps(ad.url);
    const box = document.createElement("aside"); box.className = "i9-footer-ad"; box.setAttribute("aria-label", "Anúncio ou aviso promocional");
    if (imageUrl) { const img = document.createElement("img"); img.src = imageUrl; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; box.append(img); }
    const copy = document.createElement("div"); copy.className = "i9-footer-ad-copy";
    const title = document.createElement("strong"); title.textContent = ad.title || "Conheça mais recursos";
    const text = document.createElement("span"); text.textContent = ad.text || ""; copy.append(title, text); box.append(copy);
    if (destination) { const link = document.createElement("a"); link.href = destination; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = ad.buttonLabel || "Saiba mais"; link.className = "btn btn-primary btn-sm"; link.addEventListener("click", () => this.api.sendMessage("TRACK_TELEMETRY_EVENT", { name: "footer_ad.clicked", featureId: "ads.footer", metadata: { count: 1 } })); box.append(link); }
    container.append(box); container.hidden = false;
    const adKey = String(ad.id || ad.title || 'footer-ad');
    if (!this.seenFooterAdIds.has(adKey)) { this.seenFooterAdIds.add(adKey); this.api.sendMessage("TRACK_TELEMETRY_EVENT", { name: "footer_ad.impression", featureId: "ads.footer", metadata: { count: 1 } }); }
  }

  async refreshLicense() {
    const previous = this.licenseAccessFingerprint();
    const [licenseRes, usageRes] = await Promise.all([this.api.getLicenseStatus(), this.api.getUsageStatus()]);
    if (licenseRes?.success) {
      this.state.setLicense(licenseRes.data);
      this.state.setUsage(usageRes?.data || licenseRes.data.usage);
      this.header.updateLicense(licenseRes.data, usageRes?.data || licenseRes.data.usage);
      const current = this.licenseAccessFingerprint();
      if (previous !== current && this.router?.currentRoute && this.views?.[this.router.currentRoute]) {
        await this.router.renderView(this.router.currentRoute);
      }
    }
    return licenseRes;
  }

  licenseAccessFingerprint() {
    const license = this.state.get("license");
    const enabled = (license?.features || []).filter((feature) => feature.enabled && feature.implemented).map((feature) => feature.id).sort();
    return JSON.stringify({ licensed: !!license?.licensed, entitlementsConfigured: !!license?.entitlementsConfigured, plan: license?.plan || "", enabled });
  }

  canUseFeatures() {
    const license = this.state.get("license");
    return !!(license?.licensed && license?.entitlementsConfigured);
  }

  /** O modo demonstração permite explorar a interface, mas não executar módulos sem licença. */
  hasFeature(featureId) {
    const license = this.state.get("license");
    if (!license?.licensed) return false;
    const entitlements = Array.isArray(license.entitlements)
      ? license.entitlements
      : (license.features || []).filter((item) => item?.enabled).map((item) => item.id);
    return hasFeatureEntitlement(entitlements, featureId);
  }

  showAccessPrompt(featureId = "") {
    const license = this.state.get("license");
    if (!license?.licensed) {
      this.showUpgradeModal();
      return;
    }
    if (!license.entitlementsConfigured) {
      this.licenseModal?.show({ code: "LICENSE_PERMISSIONS_MISSING", whatsappUrl: buildWhatsAppUrl("license-support") });
      return;
    }
    const feature = license.features?.find?.((item) => item.id === featureId);
    this.licenseModal?.show({
      code: "FEATURE_NOT_INCLUDED",
      featureId,
      featureName: feature?.name || featureId,
      whatsappUrl: buildWhatsAppUrl("feature-access", feature?.name || featureId),
    });
  }

  requestWhatsApp(kind = "free-account", featureName = "") {
    try {
      chrome.tabs.create({ url: buildWhatsAppUrl(kind, featureName), active: true });
    } catch (error) {
      console.error("[i9Hub] Não foi possível abrir o WhatsApp:", error);
      this.showToast("Não foi possível abrir o WhatsApp. Tente novamente.", "error");
    }
  }

  applyLicenseAccessMode(container) {
    if (!container) return;
    container.classList.toggle("license-preview-mode", !this.canUseFeatures());
    container.querySelector(".license-preview-banner")?.remove();
    container.querySelectorAll('.feature-lock-overlay').forEach((node) => node.remove());
    container.querySelectorAll('.feature-locked-preview').forEach((node) => node.classList.remove('feature-locked-preview'));

    if (!this.canUseFeatures()) {
      const license = this.state.get("license");
      const needsSupport = !!license?.licensed;
      const banner = document.createElement("section");
      banner.className = "license-preview-banner";
      banner.setAttribute("role", "status");
      const title = document.createElement("strong");
      title.textContent = needsSupport ? "Permissões da licença pendentes" : "Modo de demonstração — conheça os módulos";
      const description = document.createElement("p");
      description.textContent = needsSupport
        ? "A licença foi reconhecida, mas não trouxe permissões de funcionalidades. Fale com o suporte para corrigir a configuração no painel."
        : "Você pode navegar e conhecer a extensão. Para usar as funções, solicite uma conta gratuita e ative a licença emitida pelo painel administrativo.";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-primary license-preview-allow";
      button.textContent = needsSupport ? "Falar com suporte" : "Quero minha conta grátis";
      button.addEventListener("click", () => this.requestWhatsApp(needsSupport ? "license-support" : "free-account"));
      banner.append(title, description, button);
      container.prepend(banner);
      return;
    }

    // Em licença válida, recursos fora do plano ficam visíveis, porém cobertos por um bloqueio
    // explícito. Isso preserva a descoberta do produto sem expor métricas nem permitir operação.
    for (const el of container.querySelectorAll('[data-feature]')) {
      const featureId = el.dataset.feature;
      const parentFeature = el.parentElement?.closest?.('[data-feature]');
      if (parentFeature && !this.hasFeature(parentFeature.dataset.feature)) continue;
      if (this.hasFeature(featureId)) continue;
      if (!['DIV','ARTICLE','SECTION','ASIDE'].includes(el.tagName)) continue;
      if (el.querySelector(':scope > .feature-lock-overlay')) continue;
      el.classList.add('feature-locked-preview');
      const overlay = document.createElement('button');
      overlay.type = 'button'; overlay.className = 'feature-lock-overlay'; overlay.dataset.feature = featureId;
      overlay.innerHTML = '<span class="feature-lock-icon"><i class="fas fa-lock"></i></span><strong>Recurso não incluído no plano</strong><small>Clique para ver as opções de acesso</small>';
      el.append(overlay);
    }
  }

  setupLicensePreviewGuard() {
    // A interface pode ser explorada sem licença, mas qualquer operação de dados ou módulo
    // deve permanecer bloqueada; o service worker é a autoridade final de autorização.
    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.("button, a, input, select, textarea, label[data-feature], label:has(input[data-feature]), [role=button], [data-action]");
      if (!target || target.closest("#licensing-modal")) return;
      const inMainContent = !!target.closest("#main-content");
      const inFeatureModal = !!target.closest(".modal-overlay");
      if (!inMainContent && !inFeatureModal) return;
      if (target.closest(".license-preview-banner")) return;
      if (target.matches(".modal-close, [data-dismiss], [data-action=close]") || /close|cancel|fechar|cancelar/i.test(target.id || "")) return;
      if (target.matches(".tab-btn, [data-tab]") || (target.closest(".settings-tabs") && target.matches("button"))) return;
      if (target.closest("#tab-license")) return;
      if (target.closest("[data-view-only]")) return;

      const license = this.state.get("license");
      const featureId = target.dataset?.feature || target.closest("[data-feature]")?.dataset?.feature || target.querySelector?.("[data-feature]")?.dataset?.feature;
      if (license?.licensed && license.entitlementsConfigured && featureId && !this.hasFeature(featureId)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.showAccessPrompt(featureId);
        return;
      }
      if (!this.canUseFeatures()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.showAccessPrompt(featureId);
      }
    }, true);

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!target?.closest?.("#main-content") || target.closest("#tab-license") || target.closest("[data-view-only]")) return;
      const license = this.state.get("license");
      const featureId = target.dataset?.feature || target.closest("[data-feature]")?.dataset?.feature || target.querySelector?.("[data-feature]")?.dataset?.feature;
      if (license?.licensed && license.entitlementsConfigured && featureId && !this.hasFeature(featureId)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.showAccessPrompt(featureId);
        return;
      }
      if (!this.canUseFeatures()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.showAccessPrompt(featureId);
      }
    }, true);

    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!form || form.closest("#licensing-modal")) return;
      const inMainContent = !!form.closest("#main-content");
      const inFeatureModal = !!form.closest(".modal-overlay");
      if (!inMainContent && !inFeatureModal) return;
      if (form.closest("#tab-license") || form.closest("[data-view-only]")) return;
      if (this.canUseFeatures()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.showAccessPrompt();
    }, true);
  }

  async loadInitialData() {
    try {
      await this.refreshLicense();
      const profileRes = await this.api.getBusinessProfile();
      this.businessProfile = profileRes?.success ? (profileRes.data?.profile || null) : null;
    } catch (error) {
      console.error("[i9Hub] Init error:", error);
    }
    this.router.navigate("dashboard");
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.source === "maps-extractor") {
        this.handleMapsEvent(message);
      } else if (message.type === "CAMPAIGN_PROGRESS") {
        this.waDock?.onCampaignProgress(message.payload);
        this.views["campaigns-wa"]?.updateCampaignProgress?.(message.payload);
        if (this.router.currentRoute === "dashboard") { this.views.dashboard?.loadStats?.(); this.views.dashboard?.loadExecutionSummary?.(); }
      } else if (message.type === "PRIVATE_OPPORTUNITIES_PROGRESS") {
        const d = message.payload || {};
        if (this.router.currentRoute === "crm") {
          this.views.crm?.updatePrivateSyncProgress?.(d);
          // Atualiza o Kanban assim que cada lote inicial foi efetivamente salvo;
          // não espera o carregamento do histórico terminar para mostrar os contatos.
          if (d.persisted && d.phase === "import") this.views.crm?.loadLeads?.();
        }
      } else if (message.type === "PRIVATE_OPPORTUNITIES_UPDATED") {
        const d = message.payload || {};
        if (this.router.currentRoute === "crm") {
          this.views.crm?.loadLeads?.();
        }
        if (this.router.currentRoute === "dashboard") {
          this.views.dashboard?.loadStats?.();
        }
        if (Number(d.added) > 0 && d.automatic !== false) {
          this.showToast(`${d.added} nova(s) oportunidade(s) criada(s) a partir das conversas privadas do WhatsApp.`, "success", 6000);
        }
        if (Number(d.classified) > 0 && this.router.currentRoute === "crm") {
          this.views.crm?.updateStats?.();
        }
      } else if (message.type === "CLASSIFICATION_UPDATED") {
        if (this.router.currentRoute === "crm") this.views.crm?.loadLeads?.();
        if (this.router.currentRoute === "dashboard") { this.views.dashboard?.loadStats?.(); this.views.dashboard?.loadExecutionSummary?.(); }
      } else if (message.type === "BUSINESS_PROFILE_UPDATED") {
        this.businessProfile = message.payload?.profile || null;
        this.views["business-profile"]?.refresh?.();
        if (this.router.currentRoute === "crm") this.views.crm?.loadLeads?.();
      }
      return false; // nunca responde: quem responde e o service worker
    });
  }

  handleMapsEvent(message) {
    const mapsView = this.views.maps;
    if (!mapsView) return;
    
    switch (message.type) {
      case "MAPS_EXTRACTION_STARTED":
        mapsView.onExtractionStarted(message.payload);
        break;
      case "MAPS_EXTRACTION_PROGRESS":
        mapsView.onExtractionProgress(message.payload);
        break;
      case "MAPS_EXTRACTION_COMPLETED":
        mapsView.onExtractionCompleted(message.payload);
        break;
      case "MAPS_EXTRACTION_ERROR":
        mapsView.onExtractionError(message.payload);
        break;
    }
  }

  // Global helpers
  showUpgradeModal() { this.licenseModal.show({ usage: this.state.get("usage") }); }
  showToast(message, type, duration) { this.toast.show(message, type, duration); }
  getState() { return this.state; }
  getAPI() { return this.api; }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new App());
} else {
  new App();
}

export { App };
