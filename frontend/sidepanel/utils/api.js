/**
 * API Client para i9Hub SaaS
 * Substitui chrome.runtime.sendMessage por fetch + JWT
 */
export class API {
  constructor() {
    this.baseUrl = '/api';
  }

  getToken() {
    return localStorage.getItem('i9hub_jwt');
  }

  async sendMessage(type, payload = {}) {
    const token = this.getToken();
    if (!token) {
      window.location.href = '/login.html';
      return { success: false, error: 'Sessão expirada. Redirecionando...' };
    }

    try {
      const res = await fetch(`${this.baseUrl}/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, payload })
      });

      if (res.status === 401) {
        localStorage.removeItem('i9hub_jwt');
        window.location.href = '/login.html';
        return { success: false, error: 'Sessão expirada.' };
      }

      const data = await res.json();
      return data;
    } catch (e) {
      return { success: false, error: e.message || 'Erro de conexão' };
    }
  }

  // Auth
  async login(email, password) {
    try {
      const res = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  logout() {
    localStorage.removeItem('i9hub_jwt');
    window.location.href = '/login.html';
  }

  // CRM
  getSavedLeads() { return this.sendMessage('GET_LEADS'); }
  saveLead(lead) { return this.sendMessage('SAVE_LEAD', lead); }
  deleteLead(id) { return this.sendMessage('DELETE_LEAD', { id }); }
  bulkDeleteLeads(ids) { return this.sendMessage('BULK_DELETE_LEADS', { ids }); }
  updateLeadStage(id, stage) { return this.sendMessage('UPDATE_LEAD_STAGE', { id, stage }); }
  blacklistAdd(entries, source) { return this.sendMessage('BLACKLIST_ADD', { entries, source }); }
  blacklistRemove(phone) { return this.sendMessage('BLACKLIST_REMOVE', { phone }); }
  getBlacklist() { return this.sendMessage('GET_BLACKLIST'); }

  // Campaigns
  getCampaigns() { return this.sendMessage('GET_CAMPAIGNS'); }
  saveCampaign(campaign) { return this.sendMessage('SAVE_CAMPAIGN', campaign); }
  startCampaign(id) { return this.sendMessage('START_CAMPAIGN', { id }); }
  pauseCampaign(id) { return this.sendMessage('PAUSE_CAMPAIGN', { id }); }
  deleteCampaign(id) { return this.sendMessage('DELETE_CAMPAIGN', { id }); }

  // Settings & Profile
  getSettings() { return this.sendMessage('GET_SETTINGS'); }
  saveSettings(settings) { return this.sendMessage('SAVE_SETTINGS', settings); }
  getBusinessProfile() { return this.sendMessage('GET_BUSINESS_PROFILE'); }
  saveBusinessProfile(profile) { return this.sendMessage('SAVE_BUSINESS_PROFILE', { profile }); }
  getDashboardStats() { return this.sendMessage('GET_DASHBOARD_STATS'); }

  // AI
  getAiConfig() { return this.sendMessage('GET_AI_CONFIG'); }
  saveAiConfig(config) { return this.sendMessage('SAVE_AI_CONFIG', config); }
  getAiStatus() { return this.sendMessage('GET_AI_STATUS'); }
  getAiCosts() { return this.sendMessage('GET_AI_COSTS'); }

  // Followups
  getFollowups() { return this.sendMessage('GET_FOLLOWUPS'); }
  saveFollowup(followup) { return this.sendMessage('SAVE_FOLLOWUP', followup); }

  // WhatsApp Instances
  getWaInstances() { return this.sendMessage('GET_WA_INSTANCES'); }
  createWaInstance(name) { return this.sendMessage('CREATE_WA_INSTANCE', { name }); }
  connectWaInstance(id) { return this.sendMessage('CONNECT_WA_INSTANCE', { id }); }
  disconnectWaInstance(id) { return this.sendMessage('DISCONNECT_WA_INSTANCE', { id }); }

  // License
  getLicenseStatus() { return this.sendMessage('GET_LICENSE_STATUS'); }
  validateLicense(licenseKey) { return this.sendMessage('VALIDATE_LICENSE', { licenseKey }); }

  // Calendar Automation
  getCalendarAutomationRules() { return this.sendMessage('CALENDAR_GET_AUTOMATION_RULES'); }
  getCalendarAutomationTasks() { return this.sendMessage('CALENDAR_GET_AUTOMATION_TASKS'); }
  saveCalendarAutomationRule(rule) { return this.sendMessage('CALENDAR_SAVE_AUTOMATION_RULE', rule); }
  deleteCalendarAutomationRule(id) { return this.sendMessage('CALENDAR_DELETE_AUTOMATION_RULE', { id }); }
  saveCalendarAutomationTask(task) { return this.sendMessage('CALENDAR_SAVE_AUTOMATION_TASK', task); }
  deleteCalendarAutomationTask(id) { return this.sendMessage('CALENDAR_DELETE_AUTOMATION_TASK', { id }); }

  // Stages / Funnel
  getStages() { return this.sendMessage('GET_STAGES'); }

  // Telemetry
  getTelemetryProfile() { return this.sendMessage('TELEMETRY_GET_PROFILE'); }
  saveTelemetryProfile(profile) { return this.sendMessage('TELEMETRY_SAVE_PROFILE', profile); }

  // Google Drive
  getDriveStatus() { return this.sendMessage('DRIVE_GET_STATUS'); }
  drivePull() { return this.sendMessage('DRIVE_PULL'); }
  driveDisconnect() { return this.sendMessage('DRIVE_DISCONNECT'); }

  // Calendar Connect
  calendarConnect() { return this.sendMessage('CALENDAR_CONNECT'); }
  calendarDisconnect() { return this.sendMessage('CALENDAR_DISCONNECT'); }
  calendarSaveSettings(settings) { return this.sendMessage('CALENDAR_SAVE_SETTINGS', settings); }
  calendarGetStatus() { return this.sendMessage('CALENDAR_GET_STATUS'); }
  calendarListCalendars() { return this.sendMessage('CALENDAR_LIST_CALENDARS'); }

  // WhatsApp Settings
  setWaAllowHidden(enabled) { return this.sendMessage('WA_SET_ALLOW_HIDDEN', { enabled }); }
}