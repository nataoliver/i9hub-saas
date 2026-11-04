/**
 * Cliente de mensagens para o service worker.
 * As respostas de autorização vêm do service worker; apenas ações iniciadas pelo usuário
 * abrem o modal de conta/licença. Consultas usadas para desenhar telas não interrompem a navegação.
 */
/**
 * Traduz o erro cru do Chrome quando o service worker some no meio da resposta.
 * Antes isso aparecia como "The message port closed before a response was received.",
 * que não diz o que fazer.
 */
import { getRequiredFeaturesForAction } from "../../lib/license-policy.js";
import { hasFeatureEntitlement } from "../../lib/feature-catalog.js";

const PORT_CLOSED_RE = /message port closed|receiving end does not exist|extension context invalidated/i;
export function friendlyError(raw) {
  if (!raw || !PORT_CLOSED_RE.test(raw)) return null;
  return "A extensão não respondeu a tempo (o serviço em segundo plano pode ter reiniciado). "
    + "Recarregue esta tela; se persistir, recarregue também a aba do WhatsApp Web.";
}

export class API {
  async sendMessage(type, payload = {}) {
    // Só abra/mostre o WhatsApp depois de confirmar que a licença possui os direitos
    // necessários. Uma tentativa bloqueada não deve provocar efeitos colaterais na interface.
    if (["START_CAMPAIGN", "RESUME_CAMPAIGN", "RETRY_FAILED_CAMPAIGN"].includes(type)) {
      const licenseResponse = await this.getLicenseStatus();
      const license = licenseResponse?.data;
      const entitlements = Array.isArray(license?.entitlements)
        ? license.entitlements
        : (license?.features || []).filter((feature) => feature?.enabled).map((feature) => feature.id);
      const required = getRequiredFeaturesForAction(type, payload, entitlements);
      const allowed = !!(license?.licensed && license?.entitlementsConfigured && required.length && required.every((id) => hasFeatureEntitlement(entitlements, id)));
      if (allowed) document.dispatchEvent(new CustomEvent("i9:wa-need"));
    }
    const response = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type, payload }, (r) => {
          if (chrome.runtime.lastError) {
            const raw = chrome.runtime.lastError.message;
            resolve({ success: false, code: "BACKGROUND_UNAVAILABLE", error: friendlyError(raw) || raw, detail: raw });
          } else resolve(r || { success: false, error: "Sem resposta da extensao" });
        });
      } catch (e) { resolve({ success: false, error: e.message }); }
    });
    if (response.usage) document.dispatchEvent(new CustomEvent("i9:usage", { detail: response.usage }));
    if (response.promptLicense && ["LICENSE_REQUIRED", "FEATURE_NOT_INCLUDED", "LICENSE_PERMISSIONS_MISSING", "FEATURE_NOT_CONFIGURED"].includes(response.code)) {
      document.dispatchEvent(new CustomEvent("i9:license-required", { detail: response }));
    }
    return response;
  }

  /**
   * v7.0.5 - Inicia/retoma/reenvia pedindo confirmação quando o WhatsApp não está visível:
   * "Trazer o WhatsApp para frente e iniciar?" -> repete com bringToFront.
   */
  async sendWithVisibility(type, payload = {}) {
    let r = await this.sendMessage(type, payload);
    if (r?.code === "WA_NOT_VISIBLE") {
      const sameWindowNote = r.windowMode ? "" : "\n\nSe o WhatsApp estiver na mesma janela desta tela, esta aba ficará em segundo plano; o envio continua e você acompanha por aqui quando voltar. Para ver as duas telas ao mesmo tempo, use \"Abrir em janela lateral\".";
      if (typeof confirm === "function" && confirm((r.error || "O WhatsApp não está visível.") + "\n\nTrazer o WhatsApp para frente e iniciar agora?" + sameWindowNote)) {
        r = await this.sendMessage(type, { ...payload, bringToFront: true });
      }
    }
    return r;
  }

  // Webhooks para dominios arbitrarios precisam de permissao opcional do navegador.
  async ensureOrigin(url) {
    try {
      const parsed = new URL(String(url || '').trim());
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
      const origin = parsed.origin + "/*";
      if (await chrome.permissions.contains({ origins: [origin] })) return true;
      return await chrome.permissions.request({ origins: [origin] });
    } catch { return false; }
  }

  // Licenca / uso
  getLicenseStatus() { return this.sendMessage("GET_LICENSE_STATUS"); }
  getUsageStatus() { return this.sendMessage("GET_USAGE_STATUS"); }
  validateLicense(key) { return this.sendMessage("VALIDATE_LICENSE", { key }); }

  // Leads / CRM
  getSavedLeads() { return this.sendMessage("GET_SAVED_LEADS"); }
  getLeads() { return this.sendMessage("GET_SAVED_LEADS"); }
  saveLeads(leads, source = "manual") { return this.sendMessage("SAVE_LEADS", { leads, source }); }
  deleteLead(leadId) { return this.sendMessage("DELETE_LEAD", { leadId }); }
  updateLeadStage(leadId, stage) { return this.sendMessage("UPDATE_LEAD_STAGE", { leadId, stage }); }
  updateLeadType(leadId, tipo, motivo) { return this.sendMessage("UPDATE_LEAD_TYPE", { leadId, tipo, motivo }); }
  updateLeadIdentity(leadId, fields) { return this.sendMessage("UPDATE_LEAD_IDENTITY", { leadId, fields }); }
  updateLeadCommercialFields(leadId, fields) { return this.sendMessage("UPDATE_LEAD_COMMERCIAL_FIELDS", { leadId, fields }); }
  updateLeadCustomFields(leadId, fields) { return this.sendMessage("UPDATE_LEAD_CUSTOM_FIELDS", { leadId, fields }); }
  getLeadHistory(leadId, limit = 100) { return this.sendMessage("GET_LEAD_HISTORY", { leadId, limit }); }
  addLeadNote(leadId, text) { return this.sendMessage("ADD_LEAD_NOTE", { leadId, text }); }
  updateLeadNote(leadId, noteId, text) { return this.sendMessage("UPDATE_LEAD_NOTE", { leadId, noteId, text }); }
  deleteLeadNote(leadId, noteId) { return this.sendMessage("DELETE_LEAD_NOTE", { leadId, noteId }); }
  getFollowups(filters = {}) { return this.sendMessage("GET_FOLLOWUPS", filters); }
  scheduleFollowup(leadId, step, options = {}) { return this.sendMessage("SCHEDULE_FOLLOWUP", { leadId, step, ...options }); }
  scheduleFollowupSequence(leadId, steps, options = {}) { return this.sendMessage("SCHEDULE_FOLLOWUP_SEQUENCE", { leadId, steps, ...options }); }
  cancelFollowup(followupId) { return this.sendMessage("CANCEL_FOLLOWUP", { followupId }); }
  cancelFollowupSequence(followupId) { return this.sendMessage("CANCEL_FOLLOWUP_SEQUENCE", { followupId }); }
  rescheduleFollowup(followupId, scheduledAt) { return this.sendMessage("RESCHEDULE_FOLLOWUP", { followupId, scheduledAt }); }
  sendFollowupNow(followupId) { return this.sendMessage("SEND_FOLLOWUP_NOW", { followupId }); }
  deleteFollowup(followupId) { return this.sendMessage("DELETE_FOLLOWUP", { followupId }); }
  getFollowupSettings() { return this.sendMessage("GET_FOLLOWUP_SETTINGS"); }
  saveFollowupSettings(settings) { return this.sendMessage("SAVE_FOLLOWUP_SETTINGS", { settings }); }
  getFollowupTemplates() { return this.sendMessage("GET_FOLLOWUP_TEMPLATES"); }
  saveFollowupTemplates(templates) { return this.sendMessage("SAVE_FOLLOWUP_TEMPLATES", { templates }); }
  getGoogleCalendarStatus() { return this.sendMessage("CALENDAR_GET_STATUS"); }
  connectGoogleCalendar() { return this.sendMessage("CALENDAR_CONNECT"); }
  disconnectGoogleCalendar() { return this.sendMessage("CALENDAR_DISCONNECT"); }
  listGoogleCalendars() { return this.sendMessage("CALENDAR_LIST_CALENDARS"); }
  saveGoogleCalendarSettings(settings) { return this.sendMessage("CALENDAR_SAVE_SETTINGS", { settings }); }
  getGoogleCalendarAvailability(date, durationMinutes) { return this.sendMessage("CALENDAR_GET_AVAILABILITY", { date, durationMinutes }); }
  getLeadCalendarEvents(leadId) { return this.sendMessage("CALENDAR_GET_LEAD_EVENTS", { leadId }); }
  createLeadCalendarEvent(leadId, booking, requestKey) { return this.sendMessage("CALENDAR_CREATE_EVENT", { leadId, booking, requestKey }); }
  updateLeadCalendarEvent(leadId, eventId, booking) { return this.sendMessage("CALENDAR_UPDATE_EVENT", { leadId, eventId, booking }); }
  deleteLeadCalendarEvent(leadId, eventId) { return this.sendMessage("CALENDAR_DELETE_EVENT", { leadId, eventId }); }
  setCalendarEventOutcome(leadId, eventId, outcome) { return this.sendMessage("CALENDAR_SET_EVENT_OUTCOME", { leadId, eventId, outcome }); }
  syncLeadCalendarEvents(leadId, changedFields = []) { return this.sendMessage("CALENDAR_SYNC_LEAD_EVENTS", { leadId, changedFields }); }
  sendCalendarConfirmation(leadId, eventId) { return this.sendMessage("CALENDAR_SEND_CONFIRMATION", { leadId, eventId }); }
  getCalendarAutomationRules() { return this.sendMessage("CALENDAR_AUTOMATION_GET_RULES"); }
  saveCalendarAutomationRules(rules) { return this.sendMessage("CALENDAR_AUTOMATION_SAVE_RULES", { rules }); }
  getCalendarAutomationTasks() { return this.sendMessage("CALENDAR_AUTOMATION_GET_TASKS"); }
  dismissCalendarAutomationTask(taskId) { return this.sendMessage("CALENDAR_AUTOMATION_DISMISS_TASK", { taskId }); }
  updateLeadsType(leadIds, tipo, motivo) { return this.sendMessage("UPDATE_LEADS_TYPE", { leadIds, tipo, motivo }); }
  resetLeadType(leadId) { return this.sendMessage("RESET_LEAD_TYPE", { leadId }); }
  resetLeadsType(leadIds) { return this.sendMessage("RESET_LEAD_TYPE", { leadIds }); }
  reclassifyLeads() { return this.sendMessage("RECLASSIFY_LEADS"); }
  deduplicateLeads() { return this.sendMessage("DEDUPLICATE_LEADS"); }
  exportCSV(leads, filename) { return this.sendMessage("EXPORT_LEADS_CSV", { leads, filename }); }
  async exportWebhook(leads) {
    try {
      const st = (await this.getSettings()).data || {};
      if (st.webhookUrl) await this.ensureOrigin(st.webhookUrl);
    } catch { /* segue sem a permissao */ }
    return this.sendMessage("EXPORT_LEADS_WEBHOOK", { leads });
  }

  // Etiquetas do WhatsApp <-> estágios do CRM (v1.4.0)
  getStages() { return this.sendMessage("GET_STAGES"); }
  saveCrmStageConfig(config) { return this.sendMessage("SAVE_CRM_STAGE_CONFIG", { config }); }
  deleteCrmStage(stageId, migrateTo = '') { return this.sendMessage("DELETE_CRM_STAGE", { stageId, migrateTo }); }
  getNicheTaxonomy() { return this.sendMessage("GET_NICHE_TAXONOMY"); }
  saveNicheNode(node) { return this.sendMessage("SAVE_NICHE_NODE", node || {}); }
  deleteNicheNode(id) { return this.sendMessage("DELETE_NICHE_NODE", { id }); }
  mergeNicheNodes(sourceId, targetId) { return this.sendMessage("MERGE_NICHE_NODES", { sourceId, targetId }); }
  labelsDiagnostic() { return this.sendMessage("WA_LABELS_DIAGNOSTIC"); }
  syncLabels(options = {}) { return this.sendMessage("WA_LABELS_SYNC", options); }

  // Black list (v1.5.0)
  getBlacklist() { return this.sendMessage("GET_BLACKLIST"); }
  blacklistAdd(items, source = "crm") { return this.sendMessage("BLACKLIST_ADD_MANY", { items, source }); }
  blacklistRemove(phone) { return this.sendMessage("BLACKLIST_REMOVE", { phone }); }

  // Maps
  startMapsExtraction(config) { return this.sendMessage("MAPS_START_EXTRACTION", config); }
  stopMapsExtraction() { return this.sendMessage("MAPS_STOP_EXTRACTION"); }

  // Chats / Grupos
  extractAllChats() { return this.sendMessage("EXTRACT_ALL_CHATS"); }
  syncPrivateOpportunities(opts = {}) { return this.sendMessage("SYNC_PRIVATE_OPPORTUNITIES", opts); }
  extractGroupMembers(groupId) { return this.sendMessage("EXTRACT_GROUP_MEMBERS", { groupId }); }
  extractChatMessages(chatId, limit = 50) { return this.sendMessage("EXTRACT_CHAT_MESSAGES", { chatId, limit }); }

  // Campanhas WhatsApp
  getCampaigns() { return this.sendMessage("GET_CAMPAIGNS"); }
  getCampaignReport(campaignId) { return this.sendMessage("GET_CAMPAIGN_REPORT", { campaignId }); }
  refreshCampaignReport(campaignId, period = 'manual') { return this.sendMessage("REFRESH_CAMPAIGN_REPORT", { campaignId, period }); }
  createCampaign(data) { return this.sendMessage("CREATE_CAMPAIGN", data); }
  updateCampaign(data) { return this.sendMessage("UPDATE_CAMPAIGN", data); }
  deleteCampaign(campaignId) { return this.sendMessage("DELETE_CAMPAIGN", { campaignId }); }
  startCampaign(campaignData) { return this.sendWithVisibility("START_CAMPAIGN", campaignData); }
  pauseCampaign(campaignId) { return this.sendMessage("PAUSE_CAMPAIGN", { campaignId }); }
  resumeCampaign(campaignId) { return this.sendWithVisibility("RESUME_CAMPAIGN", { campaignId }); }
  retryFailedCampaign(campaignId) { return this.sendWithVisibility("RETRY_FAILED_CAMPAIGN", { campaignId }); }
  stopCampaign(campaignId) { return this.sendMessage("STOP_CAMPAIGN", { campaignId }); }


  // Webhook
  getWebhookConfig() { return this.sendMessage("GET_WEBHOOK_CONFIG"); }
  saveWebhookConfig(config) { return this.sendMessage("SAVE_WEBHOOK_CONFIG", config); }
  async testWebhook(url) { await this.ensureOrigin(url); return this.sendMessage("TEST_WEBHOOK", { url }); }
  saveWebhookSettings(settings) { return this.sendMessage("SAVE_WEBHOOK_SETTINGS", settings); }

  // Configuracoes / perfil inteligente
  getSettings() { return this.sendMessage("GET_SETTINGS"); }
  saveSettings(settings) { return this.sendMessage("SAVE_SETTINGS", settings); }
  getBusinessProfile() { return this.sendMessage("GET_BUSINESS_PROFILE"); }
  saveBusinessProfile(profile) { return this.sendMessage("SAVE_BUSINESS_PROFILE", { profile }); }
  resetBusinessProfile() { return this.sendMessage("RESET_BUSINESS_PROFILE"); }
  clearAllData() { return this.sendMessage("CLEAR_ALL_DATA"); }
  getDashboardStats() { return this.sendMessage("GET_DASHBOARD_STATS"); }
  getCommercialDashboardOverview() { return this.sendMessage("DASHBOARD_GET_COMMERCIAL_OVERVIEW"); }
  getCommercialPerformance(rangeDays = 30) { return this.sendMessage("DASHBOARD_GET_COMMERCIAL_PERFORMANCE", { rangeDays }); }
  saveCommercialPerformanceConfig(stageProbabilities) { return this.sendMessage("SALES_ANALYTICS_SAVE_CONFIG", { stageProbabilities }); }
  getCommercialManagement(month) { return this.sendMessage("COMMERCIAL_MANAGEMENT_GET", { month }); }
  getManagementIntelligence(month, staleDays = 7) { return this.sendMessage("DASHBOARD_GET_MANAGEMENT_INTELLIGENCE", { month, staleDays }); }
  generateManagementInsights(month, staleDays = 7) { return this.sendMessage("DASHBOARD_GENERATE_MANAGEMENT_INSIGHTS", { month, staleDays }); }
  saveCommercialSeller(seller) { return this.sendMessage("COMMERCIAL_MANAGEMENT_SAVE_SELLER", { seller }); }
  saveCommercialTeam(team) { return this.sendMessage("COMMERCIAL_MANAGEMENT_SAVE_TEAM", { team }); }
  saveCommercialProduct(product) { return this.sendMessage("COMMERCIAL_MANAGEMENT_SAVE_PRODUCT", { product }); }
  saveCommercialGoal(goal) { return this.sendMessage("COMMERCIAL_MANAGEMENT_SAVE_GOAL", { goal }); }
  deleteCommercialEntity(entityType, id) { return this.sendMessage("COMMERCIAL_MANAGEMENT_DELETE_ENTITY", { entityType, id }); }
  updateCommercialCommissionStatus(leadId, status) { return this.sendMessage("COMMERCIAL_MANAGEMENT_UPDATE_COMMISSION_STATUS", { leadId, status }); }
  getAwaitingReplies() { return this.sendMessage("GET_AWAITING_REPLIES"); }
  openAwaitingReplyChat(contact) { return this.sendMessage("OPEN_AWAITING_REPLY_CHAT", contact || {}); }
  openCrmLeadChat(lead) { return this.sendMessage("OPEN_CRM_LEAD_CHAT", { id: lead?.id || lead?.placeId || lead?.phone || "", phone: lead?.phone || "", waChatId: lead?.waChatId || "" }); }
  async ensureGmailOrigin() { return this.ensureOrigin("https://gmail.googleapis.com"); }
  getCrmEmailStatus() { return this.sendMessage("GET_CRM_EMAIL_STATUS"); }
  connectCrmGmail(accountId) { return this.sendMessage("CONNECT_CRM_GMAIL", { accountId }); }
  selectCrmGmailAccount(accountId) { return this.sendMessage("SELECT_CRM_GMAIL_ACCOUNT", { accountId }); }
  disconnectCrmGmail(accountId) { return this.sendMessage("DISCONNECT_CRM_GMAIL", { accountId }); }
  getCrmEmailTemplates() { return this.sendMessage("GET_CRM_EMAIL_TEMPLATES"); }
  saveCrmEmailTemplates(templates) { return this.sendMessage("SAVE_CRM_EMAIL_TEMPLATES", { templates }); }
  sendCrmEmail(payload) { return this.sendMessage("SEND_CRM_EMAIL", payload || {}); }
  getCrmEmailSignature(sellerId) { return this.sendMessage("GET_CRM_EMAIL_SIGNATURE", { sellerId }); }
  saveCrmEmailSignature(sellerId, signature) { return this.sendMessage("SAVE_CRM_EMAIL_SIGNATURE", { sellerId, signature }); }
  syncCrmEmailReplies(payload = {}) { return this.sendMessage("SYNC_CRM_EMAIL_REPLIES", payload); }
  getCrmCommunicationMetrics() { return this.sendMessage("GET_CRM_COMMUNICATION_METRICS"); }
  setCrmEmailConsent(payload = {}) { return this.sendMessage("SET_CRM_EMAIL_CONSENT", payload); }
}
