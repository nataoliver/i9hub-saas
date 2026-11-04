export class WebhookConfigModal {
  constructor(app) {
    this.app = app;
  }
  show() {
    const modal = document.createElement("div");
    modal.className = "modal-overlay open";
    modal.innerHTML = this.getHTML();
    document.body.appendChild(modal);
    this.bindEvents(modal);
  }
  getHTML() {
    const settings = this.app.settingsView?.settings || {};
    const headersJson = JSON.stringify(settings.webhookHeaders || {}, null, 2);
    return `<div class="modal modal-lg">
 <div class="modal-header"><h3 class="modal-title"><i class="fas fa-plug"></i> Configurar Webhook</h3><button class="modal-close">&times;</button></div>
 <div class="modal-body">
 <form id="webhook-form">
 <div class="form-group"><label class="form-label">URL do Webhook</label><input type="url" class="form-input" id="wh-url" value="${this.escapeHtml(settings.webhookUrl || "")}" placeholder="https://seu-crm.com/webhook" required></div>
 <div class="form-row"><div class="form-group"><label class="form-label">Metodo</label><select class="form-select" id="wh-method"><option value="POST" ${settings.webhookMethod === "POST" ? "selected" : ""}>POST</option><option value="PUT" ${settings.webhookMethod === "PUT" ? "selected" : ""}>PUT</option></select></div><div class="form-group"><label class="form-label">Content-Type</label><select class="form-select" id="wh-content-type"><option value="application/json" ${settings.webhookContentType === "application/json" ? "selected" : ""}>application/json</option><option value="application/x-www-form-urlencoded" ${settings.webhookContentType === "application/x-www-form-urlencoded" ? "selected" : ""}>form-urlencoded</option></select></div></div>
 <div class="form-group"><label class="form-label">Headers (JSON)</label><textarea class="form-textarea" id="wh-headers" rows="4" placeholder='{"Authorization": "Bearer token", "X-API-Key": "key"}'>${this.escapeHtml(headersJson)}</textarea></div>
 <div class="form-group"><label class="form-label">API Key (opcional)</label><input type="text" class="form-input" id="wh-api-key" value="${this.escapeHtml(settings.webhookApiKey || "")}" placeholder="Chave da API"></div>
 <div class="btn-group"><button type="button" class="btn btn-secondary" id="test-wh"><i class="fas fa-flask"></i> Testar</button><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Salvar</button></div>
 </form>
 <div id="wh-test-result" style="margin-top: 16px;"></div>
 </div>
 </div>`;
  }
  bindEvents(modal) {
    modal.querySelector(".modal-close")?.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector("#test-wh")?.addEventListener("click", async () => await this.testWebhook());
    modal.querySelector("#webhook-form")?.addEventListener("submit", async (e) => { e.preventDefault(); await this.saveWebhook(modal); });
  }
  async testWebhook() {
    const url = document.getElementById("wh-url").value.trim();
    if (!url) { this.app.showToast("Digite a URL", "warning"); return; }
    try {
      this.app.showToast("Testando...", "info");
      const res = await this.app.api.testWebhook(url);
      const container = document.getElementById("wh-test-result");
      if (res.success) {
        container.innerHTML = `<div class="status-badge success"><i class="fas fa-check-circle"></i> OK - Status: ${res.data?.status}</div>`;
        this.app.showToast("Webhook funcionando!", "success");
      } else {
        container.innerHTML = `<div class="status-badge error"><i class="fas fa-times-circle"></i> Erro: ${this.escapeHtml(res.error || "Falha no teste")}</div>`;
        this.app.showToast("Falha no teste", "error");
      }
    } catch (error) {
      document.getElementById("wh-test-result").innerHTML = `<div class="status-badge error"><i class="fas fa-times-circle"></i> Erro: ${this.escapeHtml(error.message || "Erro inesperado")}</div>`;
      this.app.showToast("Erro: " + error.message, "error");
    }
  }
  async saveWebhook(modal) {
    const headersText = document.getElementById("wh-headers").value.trim();
    let headers = {};
    try { headers = headersText ? JSON.parse(headersText) : {}; } catch { this.app.showToast("Headers JSON invalido", "error"); return; }
    const settings = { webhookUrl: document.getElementById("wh-url").value.trim(), webhookMethod: document.getElementById("wh-method").value, webhookContentType: document.getElementById("wh-content-type").value, webhookHeaders: headers, webhookApiKey: document.getElementById("wh-api-key").value.trim() };
    try {
      await this.app.api.saveWebhookSettings(settings);
      if (this.app.settingsView) this.app.settingsView.settings = { ...this.app.settingsView.settings, ...settings };
      this.app.showToast("Webhook salvo!", "success");
      modal.remove();
    } catch (error) { this.app.showToast("Erro: " + error.message, "error"); }
  }
  escapeHtml(text) { const div = document.createElement("div"); div.textContent = text; return div.innerHTML.replace(/"/g, "&quot;").replace(/\'/g, "&#39;"); }
}