import { campaignStages, refreshStages } from "../utils/segments.js";

export class CampaignsWAView {
  constructor(app) {
    this.app = app;
    this.campaigns = [];
    this.aiPersonas = [];
    this._connKey = null;
    this._onWa = null;
  }

  async render(container) {
    container.innerHTML = this.getHTML();
    await this.loadCampaigns();
    this.bindEvents();
    this.startConnection();
  }

  getHTML() {
    return `<div class="campaigns-wa-view">
      <header class="view-header">
        <h2><i class="fas fa-message"></i> Campanhas WhatsApp</h2>
        <button class="btn btn-primary" id="new-campaign-btn"><i class="fas fa-plus"></i> Nova Campanha</button>
      </header>
      <div id="wa-conn" class="wa-conn"></div>
      <div id="campaigns-list" class="campaign-list"></div>
    </div>`;
  }

  async loadCampaigns() {
    try {
      const [res, aiConfig] = await Promise.all([
        this.app.api.getCampaigns(),
        this.app.api.sendMessage('AI_GET_CONFIG').catch(() => null),
      ]);
      if (aiConfig?.success && Array.isArray(aiConfig.data?.aiPersonas)) this.aiPersonas = aiConfig.data.aiPersonas.filter((persona) => persona?.id && persona?.name).slice(0, 20);
      if (res.success) {
        this.campaigns = res.data || [];
        this.renderCampaigns();
      }
    } catch (error) {
      this.app.showToast("Erro ao carregar campanhas: " + error.message, "error");
    }
  }

  renderCampaigns() {
    const container = document.getElementById("campaigns-list");
    if (!container) return;
    if (!this.campaigns.length) {
      container.innerHTML = `<div class="empty-state"><div class="icon"><i class="fas fa-rocket"></i></div><h3>Nenhuma campanha</h3><p>Crie sua primeira campanha WhatsApp</p></div>`;
      return;
    }
    container.innerHTML = this.campaigns.map((campaign) => this.getCampaignCardHTML(campaign)).join("");
  }

  getCampaignCardHTML(c) {
    const validStatuses = ["running", "paused", "completed", "draft", "limit_reached"];
    const status = validStatuses.includes(c?.status) ? c.status : "draft";
    const statusClass = status === "running" ? "status-running" : ["paused", "limit_reached"].includes(status) ? "status-paused" : status === "completed" ? "status-completed" : "status-draft";
    const count = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
    const sent = count(c?.sent), failed = count(c?.failed), skipped = count(c?.skipped), total = count(c?.total);
    const pending = Array.isArray(c?.contacts) ? c.contacts.filter((contact) => !contact?.status).length : Math.max(0, total - sent - failed - skipped);
    const progress = total > 0 ? Math.min(100, Math.max(0, Math.round(((sent + failed + skipped) / total) * 100))) : 0;
    const inBatchPause = status === "running" && c?.nextBatchAt && Date.parse(c.nextBatchAt) > Date.now();
    const statusLabels = { running: "Em andamento", paused: "Pausada", completed: "Concluída", draft: "Rascunho", limit_reached: "Limite atingido" };
    const statusLabel = inBatchPause ? "Pausa entre lotes · IA ativa" : statusLabels[status];
    const reportSnapshots = Array.isArray(c?.reportSnapshots) ? c.reportSnapshots : [];
    const reportMarks = ['24h', '48h'].filter((period) => reportSnapshots.some((item) => item?.period === period && Number(item?.cycle || item?.reportCycle || 1) === Math.max(1, Number(c?.reportCycle) || 1)));
    const reportLabel = reportMarks.length ? `Relatório: ${reportMarks.join(' · ')}` : 'Relatório disponível';
    const id = this.escapeHtml(String(c?.id ?? ""));
    const audience = this.audienceLabel(c);
    const selectedPersona = this.aiPersonas.find((persona) => persona.id === c?.aiPersonaId);
    const sendLimit = count(c?.sendLimit);
    const canEdit = ["draft", "paused", "limit_reached"].includes(status) || (status === "completed" && pending > 0) || status === "running";
    const canResume = status === "paused" || status === "limit_reached" || (status === "completed" && pending > 0);

    return `<div class="campaign-item">
      <div class="campaign-header"><span class="campaign-name"><i class="fas fa-paper-plane"></i> ${this.escapeHtml(c?.name || "")}</span><span class="campaign-status ${statusClass}">${this.escapeHtml(statusLabel)}</span></div>
      <div class="campaign-meta">
        <span><i class="fas fa-check-circle"></i> ${sent}/${total} enviadas</span>
        <span><i class="fas fa-hourglass-half"></i> ${pending} pendentes</span>
        <span><i class="fas fa-times-circle"></i> ${failed} falharam</span>
        ${skipped ? `<span title="Contatos ignorados"><i class="fas fa-forward"></i> ${skipped} ignorado(s)</span>` : ""}
        ${count(c?.excludedSpam) ? `<span title="Spam excluído por padrão"><i class="fas fa-ban"></i> ${count(c.excludedSpam)} Spam excluído(s)</span>` : ""}
        ${audience ? `<span><i class="fas fa-filter"></i> ${this.escapeHtml(audience)}</span>` : ""}
        ${selectedPersona ? `<span title="Personalidade usada nas respostas desta campanha"><i class="fas fa-masks-theater"></i> IA: ${this.escapeHtml(selectedPersona.name)}</span>` : ""}
        ${sendLimit ? `<span title="Limite de tentativas da campanha"><i class="fas fa-gauge-high"></i> Limite: ${sendLimit}</span>` : `<span><i class="fas fa-infinity"></i> Sem limite adicional</span>`}
        ${inBatchPause ? `<span title="A IA continua atendendo durante a pausa"><i class="fas fa-robot"></i> Próximo lote: ${this.escapeHtml(this.formatDate(c.nextBatchAt))}</span>` : ""}
        <span><i class="fas fa-clock"></i> ${this.escapeHtml(this.formatDate(c?.createdAt))}</span>
        ${reportSnapshots.length ? `<span title="Marcos de acompanhamento salvos"><i class="fas fa-chart-line"></i> ${this.escapeHtml(reportLabel)}</span>` : ""}
      </div>
      <div class="campaign-progress"><div class="campaign-progress-bar" style="width: ${progress}%"></div></div>
      <div class="campaign-actions">
        ${status === "running" ? `<button class="btn btn-sm btn-secondary" data-action="pause" data-id="${id}"><i class="fas fa-pause"></i> Pausar</button><button class="btn btn-sm btn-secondary" data-action="stop" data-id="${id}"><i class="fas fa-stop"></i> Parar</button>` : ""}
        ${status !== "running" && failed > 0 ? `<button class="btn btn-sm btn-primary" data-action="retry" data-id="${id}"><i class="fas fa-redo"></i> Reenviar falhas (${failed})</button>` : ""}
        ${status === "draft" ? `<button class="btn btn-sm btn-primary" data-action="start" data-id="${id}"><i class="fas fa-rocket"></i> Iniciar</button>` : ""}
        ${canResume ? `<button class="btn btn-sm btn-primary" data-action="resume" data-id="${id}"><i class="fas fa-play"></i> Retomar</button>` : ""}
        ${canEdit ? `<button class="btn btn-sm btn-secondary" data-action="edit" data-id="${id}"><i class="fas fa-sliders"></i> Editar</button>` : ""}
        <button class="btn btn-sm btn-primary" data-action="report" data-id="${id}"><i class="fas fa-chart-column"></i> Relatório</button>
        <button class="btn btn-sm btn-secondary" data-action="view" data-id="${id}"><i class="fas fa-eye"></i> Ver</button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${id}"><i class="fas fa-trash"></i> Excluir</button>
      </div>
    </div>`;
  }

  audienceLabel(c) {
    const audience = c?.audience || {};
    const stages = audience.stages || [];
    const stageNames = { novo: "Novo", contatado: "Contatado", qualificado: "Qualificado", proposta: "Proposta", fechado: "Fechado", perdido: "Perdido" };
    const sources = { all: "CRM", google_maps: "Google Maps", whatsapp_group: "Grupos WhatsApp", whatsapp_private: "Conversas privadas", whatsapp: "WhatsApp Business", wa_labels: "Etiquetas WhatsApp Business", i9_tags: "Etiquetas i9Hub/IA", manual: "Cadastro manual", import: "Importação" };
    const parts = [];
    if (audience.sourceFilter && audience.sourceFilter !== "all") parts.push(sources[audience.sourceFilter] || audience.sourceFilter);
    if (stages.length) parts.push("Níveis: " + stages.map((stage) => stageNames[stage] || stage).join(", "));
    if ((audience.tags || []).length) parts.push("i9Hub: " + audience.tags.join(", "));
    if ((audience.waLabels || []).length) parts.push("WhatsApp: " + audience.waLabels.join(", "));
    if ((audience.groups || []).length) parts.push("Grupos: " + audience.groups.join(", "));
    return parts.join(" · ") || (c?.source === "crm" ? "Seleção do CRM" : "");
  }

  formatDate(iso) {
    if (!iso) return "-";
    try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; }
  }

  escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  startConnection() {
    this.stopConnection();
    this._connKey = null;
    this._onWa = (event) => {
      if (!document.getElementById("wa-conn")) return this.stopConnection();
      this.renderConn(event.detail || { state: "checking" });
    };
    document.addEventListener("i9:wa-status", this._onWa);
    if (this.app.hasFeature?.("whatsapp.connection")) this.app.waDock?.open();
    this.renderConn(this.app.waDock?.lastStatus || { state: "checking" });
  }

  stopConnection() {
    if (this._onWa) document.removeEventListener("i9:wa-status", this._onWa);
    this._onWa = null;
  }

  renderConn(c) {
    const el = document.getElementById("wa-conn");
    if (!el) return;
    const dockOpen = !(this.app.waDock?.collapsed);
    const key = [c.state, c.mode || "", c.windowMode ? 1 : 0, c.visible === false ? 0 : 1, c.phone || "", c.error || "", c.embedError ? 1 : 0, dockOpen ? 1 : 0].join("|");
    if (this._connKey === key) return;
    this._connKey = key;
    const phone = c.phone ? " &middot; +" + this.escapeHtml(String(c.phone)) : "";
    const openButton = dockOpen ? "" : `<button class="btn btn-sm btn-secondary" data-wa="open-dock">Mostrar painel do WhatsApp</button>`;
    let html;
    if (c.state === "connected" && c.mode === "tab") {
      const visible = c.visible !== false;
      const where = c.windowMode ? "janela lateral" : "aba comum";
      const heading = `WhatsApp em ${where} (${visible ? "visível" : "oculta"})`;
      const hint = visible
        ? (c.windowMode ? "Pronto para enviar. A campanha segue em segundo plano; só não feche a janela do WhatsApp." : "Pronto para enviar. A campanha segue em segundo plano; só não feche a aba do WhatsApp.")
        : "O WhatsApp está fora de vista: a campanha continua em segundo plano (pode ficar mais lenta).";
      html = `<div class="wa-conn-row ${visible ? "wa-ok" : ""}"><span class="wa-dot ${visible ? "wa-dot-ok" : "wa-dot-wait"}"></span><strong>${heading}${phone}</strong><span class="wa-conn-sub">${hint}</span>${c.embedError ? `<span class="wa-conn-note">O painel embutido (experimental) está com erro; as campanhas usam esta ${where}.</span>` : ""}${openButton}</div>`;
    } else if (c.state === "connected") {
      html = `<div class="wa-conn-row wa-ok"><span class="wa-dot wa-dot-ok"></span><strong>WhatsApp embutido (experimental) conectado${phone}</strong><span class="wa-conn-sub">Mantenha esta aba do i9Hub aberta e visível durante a campanha.</span>${openButton}</div>`;
    } else if (c.state === "qr") {
      html = `<div class="wa-conn-row"><span class="wa-dot wa-dot-wait"></span><strong>Escaneie o QR code no WhatsApp Web</strong><span class="wa-conn-sub">No celular: WhatsApp &rsaquo; Aparelhos conectados &rsaquo; Conectar um aparelho. A conexão é detectada sozinha.</span>${openButton}</div>`;
    } else if (c.state === "error") {
      html = `<div class="wa-conn-row wa-err"><span class="wa-dot wa-dot-err"></span><strong>${this.escapeHtml(c.error || "Não foi possível verificar o WhatsApp Web")}</strong>${openButton}</div>`;
    } else if (c.state === "none") {
      html = `<div class="wa-conn-row"><span class="wa-dot wa-dot-wait"></span><strong>WhatsApp Web não está aberto</strong><span class="wa-conn-sub">Use <b>Abrir WhatsApp</b> no painel da direita (aba comum) ou <b>Abrir em janela lateral</b>.</span><button class="btn btn-sm btn-primary" data-wa="open-tab">Abrir WhatsApp</button><button class="btn btn-sm btn-secondary" data-wa="open-window">Janela lateral</button></div>`;
    } else {
      html = `<div class="wa-conn-row"><span class="wa-dot wa-dot-wait"></span><strong>Verificando o WhatsApp Web…</strong><span class="wa-conn-sub">Procurando nas suas abas.</span>${openButton}</div>`;
    }
    el.innerHTML = html;
    el.onclick = (event) => {
      if (event.target.closest("[data-wa='open-window']")) { this.app.waDock?.openWindow(); return; }
      if (event.target.closest("[data-wa='open-tab']")) { this.app.waDock?.openTab(); return; }
      if (event.target.closest("[data-wa='open-dock']")) { this._connKey = null; this.app.waDock?.open(); }
    };
  }

  bindEvents() {
    document.getElementById("new-campaign-btn")?.addEventListener("click", () => this.app.campaignForm.show());
    document.getElementById("campaigns-list")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      this.handleAction(button.dataset.action, button.dataset.id);
    });
  }

  async handleAction(action, id) {
    try {
      let result;
      switch (action) {
        case "start":
          result = await this.app.api.startCampaign({ campaignId: id });
          if (result.success) this.app.showToast("Campanha iniciada!", "success");
          else if (!this.isLicenseError(result)) this.app.showToast(result.error || "Não foi possível iniciar a campanha", "error");
          break;
        case "pause":
          this.app.showToast("Solicitando pausa segura; o envio atual pode terminar antes da confirmação…", "info", 6000);
          result = await this.app.api.pauseCampaign(id);
          if (result.success) this.app.showToast("Campanha pausada com segurança.", "success");
          else this.app.showToast(result.error || "Não foi possível confirmar a pausa", "error", 8000);
          break;
        case "resume":
          result = await this.app.api.resumeCampaign(id);
          if (result.success) this.app.showToast("Campanha retomada!", "success");
          else if (!this.isLicenseError(result)) this.app.showToast(result.error || "Não foi possível retomar a campanha", "error");
          break;
        case "stop":
          if (!confirm("Parar esta campanha? Os contatos pendentes não serão enviados até você retomá-la.")) return;
          result = await this.app.api.stopCampaign(id);
          if (result.success) this.app.showToast("Campanha parada.", "success");
          break;
        case "retry":
          result = await this.app.api.retryFailedCampaign(id);
          if (result.success) this.app.showToast("Reenviando os contatos que falharam…", "success");
          else if (!this.isLicenseError(result)) this.app.showToast(result.error || "Não foi possível reenviar", "error");
          break;
        case "edit":
          await this.editCampaign(id);
          return;
        case "view":
          this.showCampaignDetail(id);
          return;
        case "report":
          await this.showCampaignReport(id);
          return;
        case "delete":
          if (!confirm("Excluir esta campanha? Esta ação não pode ser desfeita.")) return;
          result = await this.app.api.deleteCampaign(id);
          if (result.success) this.app.showToast("Campanha excluída.", "success");
          break;
      }
      await this.loadCampaigns();
    } catch (error) {
      this.app.showToast("Erro: " + error.message, "error");
    }
  }

  isLicenseError(result) {
    return ["LICENSE_REQUIRED", "FEATURE_NOT_INCLUDED", "LICENSE_PERMISSIONS_MISSING", "FEATURE_NOT_CONFIGURED"].includes(result?.code);
  }

  async editCampaign(id) {
    let campaign = this.campaigns.find((item) => item.id === id);
    if (!campaign) return;
    if (campaign.status === "running") {
      if (!confirm("Para editar com segurança, o i9Hub vai pausar a campanha e aguardar a confirmação do WhatsApp. As mensagens já enviadas não serão alteradas. Continuar?")) return;
      this.app.showToast("Aguardando a pausa segura da campanha…", "info", 7000);
      const pause = await this.app.api.pauseCampaign(id);
      if (!pause.success) {
        await this.loadCampaigns();
        this.app.showToast(pause.error || "A pausa não foi confirmada. Nenhuma alteração foi aplicada.", "error", 8000);
        return;
      }
      await this.loadCampaigns();
      campaign = this.campaigns.find((item) => item.id === id) || pause.data;
    }
    if (campaign.status === "completed" && !(campaign.contacts || []).some((contact) => !contact.status)) {
      this.app.showToast("Esta campanha já terminou e não possui contatos pendentes para editar.", "warning", 6000);
      return;
    }
    await refreshStages(this.app.api);
    try {
      const aiConfig = await this.app.api.sendMessage('AI_GET_CONFIG');
      if (aiConfig?.success && Array.isArray(aiConfig.data?.aiPersonas)) this.aiPersonas = aiConfig.data.aiPersonas.filter((persona) => persona?.id && persona?.name).slice(0, 20);
    } catch { /* a campanha pode ser editada sem perfis carregados */ }
    this.showEditCampaignModal(campaign);
  }

  showEditCampaignModal(campaign) {
    const modal = document.createElement("div");
    modal.className = "modal-overlay open";
    const stageOptions = campaignStages().map((stage) => `<option value="${this.escapeHtml(stage.id)}" ${stage.id === campaign.moveToStage ? "selected" : ""}>${this.escapeHtml(stage.title)}</option>`).join("");
    const personaOptions = `<option value="" ${!campaign.aiPersonaId ? "selected" : ""}>Usar perfil global do Chat com IA</option>${this.aiPersonas.map((persona) => `<option value="${this.escapeHtml(persona.id)}" ${persona.id === campaign.aiPersonaId ? "selected" : ""}>${this.escapeHtml(persona.name)}</option>`).join("")}`;
    const pending = (campaign.contacts || []).filter((contact) => !contact.status).length;
    const minSeconds = Math.max(1, Math.round((Number(campaign.delayMin) || 8000) / 1000));
    const maxSeconds = Math.max(minSeconds, Math.round((Number(campaign.delayMax) || 20000) / 1000));
    const pauseMinutes = Math.round((Number(campaign.batchPauseMs) || 0) / 60000);
    const canResume = campaign.status === "paused" || campaign.status === "limit_reached" || (campaign.status === "completed" && pending > 0);
    modal.innerHTML = `<div class="modal modal-lg">
      <div class="modal-header"><h3 class="modal-title"><i class="fas fa-sliders"></i> Editar campanha</h3><button class="modal-close" type="button">&times;</button></div>
      <div class="modal-body">
        <div class="info-box"><strong>Alterações seguras</strong><br>As mudanças serão aplicadas somente aos ${pending} contatos pendentes. O histórico dos envios anteriores será preservado. Versão atual da configuração: ${Math.max(1, Number(campaign.editVersion) || 1)}.</div>
        <form id="campaign-edit-form">
          <div class="form-group"><label class="form-label" for="edit-campaign-name">Nome da campanha</label><input class="form-input" id="edit-campaign-name" maxlength="120" required value="${this.escapeHtml(campaign.name || "")}"></div>
          <div class="form-group"><label class="form-label" for="edit-campaign-template">Mensagem para os próximos envios</label><textarea class="form-textarea" id="edit-campaign-template" rows="5" maxlength="5000" required>${this.escapeHtml(campaign.template || "")}</textarea><small class="text-muted">Mensagens que já foram enviadas não podem ser alteradas.</small></div>
          <div class="form-group"><label class="form-label" for="edit-ai-persona">Personalidade da IA para as respostas</label><select class="form-select" id="edit-ai-persona">${personaOptions}</select><small class="text-muted">A escolha vale para contatos que receberem mensagens daqui para frente. Respostas usam o perfil escolhido por até 30 dias após cada envio.</small></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="edit-delay-min">Intervalo mínimo (segundos)</label><input class="form-input" id="edit-delay-min" type="number" min="1" max="3600" required value="${minSeconds}"></div>
            <div class="form-group"><label class="form-label" for="edit-delay-max">Intervalo máximo (segundos)</label><input class="form-input" id="edit-delay-max" type="number" min="1" max="3600" required value="${maxSeconds}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="edit-batch-size">Enviar por lote (mensagens)</label><input class="form-input" id="edit-batch-size" type="number" min="0" max="1000" required value="${Math.max(0, Number(campaign.batchSize) || 0)}"></div>
            <div class="form-group"><label class="form-label" for="edit-batch-pause">Pausa entre lotes (minutos)</label><input class="form-input" id="edit-batch-pause" type="number" min="0" max="10080" required value="${pauseMinutes}"></div>
          </div>
          <div class="form-group"><label class="form-label" for="edit-send-limit">Limite total de envios (0 = todos os contatos)</label><input class="form-input" id="edit-send-limit" type="number" min="0" max="10000" required value="${Math.max(0, Number(campaign.sendLimit) || 0)}"><small class="text-muted">O limite considera tentativas concluídas (enviadas + falhas). Se já foi atingido, aumente o valor ou informe 0 para continuar sem limite adicional.</small></div>
          <div class="form-group"><label class="form-label" for="edit-move-stage">Depois de enviar, mover o lead para</label><select class="form-select" id="edit-move-stage"><option value="">Não alterar o estágio</option>${stageOptions}</select></div>
          <div class="form-group"><label class="toggle"><input type="checkbox" id="edit-skip-own" ${campaign.skipOwn !== false ? "checked" : ""}><span class="toggle-slider"></span> Não enviar para o próprio número</label></div>
          <div class="form-group"><label class="toggle"><input type="checkbox" id="edit-schedule-enabled" ${campaign.scheduleEnabled ? "checked" : ""}><span class="toggle-slider"></span> Enviar apenas dentro de um horário</label></div>
          <div class="form-row" id="edit-schedule-row" style="display:${campaign.scheduleEnabled ? "" : "none"}">
            <div class="form-group"><label class="form-label" for="edit-schedule-start">Das</label><input class="form-input" id="edit-schedule-start" type="time" value="${this.escapeHtml(campaign.scheduleStart || "09:00")}"></div>
            <div class="form-group"><label class="form-label" for="edit-schedule-end">Até</label><input class="form-input" id="edit-schedule-end" type="time" value="${this.escapeHtml(campaign.scheduleEnd || "18:00")}"></div>
          </div>
        </form>
        <div class="form-section"><div class="form-section-title">Histórico de alterações</div>${this.renderEditHistory(campaign)}</div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary modal-close" type="button">Cancelar</button><button class="btn btn-secondary" type="button" data-edit-save>Salvar alterações</button>${canResume ? `<button class="btn btn-primary" type="button" data-edit-save-resume><i class="fas fa-play"></i> Salvar e retomar</button>` : ""}</div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelectorAll(".modal-close").forEach((button) => button.addEventListener("click", close));
    modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
    modal.querySelector("#edit-schedule-enabled")?.addEventListener("change", (event) => {
      modal.querySelector("#edit-schedule-row").style.display = event.target.checked ? "" : "none";
    });
    modal.querySelector("[data-edit-save]")?.addEventListener("click", () => this.saveCampaignEdit(modal, campaign, false));
    modal.querySelector("[data-edit-save-resume]")?.addEventListener("click", () => this.saveCampaignEdit(modal, campaign, true));
    modal.querySelector("#campaign-edit-form")?.addEventListener("submit", (event) => { event.preventDefault(); this.saveCampaignEdit(modal, campaign, false); });
  }

  renderEditHistory(campaign) {
    const history = Array.isArray(campaign.editHistory) ? campaign.editHistory.slice(-8).reverse() : [];
    if (!history.length) return `<p class="text-muted">Nenhuma alteração anterior registrada.</p>`;
    return `<div style="max-height:150px;overflow:auto">${history.map((entry) => {
      const fields = Object.keys(entry.fields || {}).join(", ") || "configuração";
      return `<div style="padding:7px 0;border-bottom:1px solid var(--border)"><strong>Versão ${Number(entry.version) || "—"}</strong> · ${this.escapeHtml(this.formatDate(entry.at))}<br><small>${this.escapeHtml(fields)}</small></div>`;
    }).join("")}</div>`;
  }

  async saveCampaignEdit(modal, campaign, resumeAfterSave) {
    const form = modal.querySelector("#campaign-edit-form");
    if (!form.reportValidity()) return;
    const minSeconds = Number(modal.querySelector("#edit-delay-min").value);
    const maxSeconds = Number(modal.querySelector("#edit-delay-max").value);
    const batchSize = Number(modal.querySelector("#edit-batch-size").value);
    const batchPauseMinutes = Number(modal.querySelector("#edit-batch-pause").value);
    const sendLimit = Number(modal.querySelector("#edit-send-limit").value);
    if (maxSeconds < minSeconds) {
      this.app.showToast("O intervalo máximo precisa ser igual ou maior que o mínimo.", "warning");
      return;
    }
    if (minSeconds > 3600 || maxSeconds > 3600 || batchSize > 1000 || batchPauseMinutes > 10080 || sendLimit > 10000) {
      this.app.showToast("Um dos valores ultrapassa o limite permitido.", "warning");
      return;
    }
    const data = {
      campaignId: campaign.id,
      name: modal.querySelector("#edit-campaign-name").value.trim(),
      template: modal.querySelector("#edit-campaign-template").value.trim(),
      delayMin: minSeconds * 1000,
      delayMax: maxSeconds * 1000,
      batchSize: Math.floor(batchSize),
      batchPauseMs: Math.floor(batchPauseMinutes * 60000),
      sendLimit: Math.floor(sendLimit),
      moveToStage: modal.querySelector("#edit-move-stage").value,
      aiPersonaId: modal.querySelector("#edit-ai-persona")?.value || "",
      skipOwn: modal.querySelector("#edit-skip-own").checked,
      scheduleEnabled: modal.querySelector("#edit-schedule-enabled").checked,
      scheduleStart: modal.querySelector("#edit-schedule-start").value || "09:00",
      scheduleEnd: modal.querySelector("#edit-schedule-end").value || "18:00",
    };
    const buttons = modal.querySelectorAll("button[data-edit-save], button[data-edit-save-resume]");
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const result = await this.app.api.updateCampaign(data);
      if (!result.success) {
        this.app.showToast(result.error || "Não foi possível salvar as alterações.", "error", 7000);
        return;
      }
      modal.remove();
      await this.loadCampaigns();
      const fields = result.changedFields?.length ? result.changedFields.join(", ") : "nenhuma mudança necessária";
      this.app.showToast(`Configuração salva (${fields}).`, "success", 6000);
      if (resumeAfterSave) {
        const resumed = await this.app.api.resumeCampaign(campaign.id);
        if (resumed.success) this.app.showToast("Campanha retomada com as novas configurações.", "success");
        else if (!this.isLicenseError(resumed)) this.app.showToast((resumed.error || "Não foi possível retomar") + " As alterações foram salvas e a campanha continua pausada.", "error", 8000);
        await this.loadCampaigns();
      }
    } catch (error) {
      this.app.showToast("Erro ao salvar a campanha: " + error.message, "error", 7000);
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  async showCampaignReport(id) {
    const response = await this.app.api.getCampaignReport(id);
    if (!response?.success || !response?.data?.report) {
      this.app.showToast(response?.error || "Não foi possível montar o relatório da campanha.", "error", 7000);
      return;
    }
    this.renderCampaignReportModal(response.data);
  }

  formatPercent(value) {
    const number = Number(value);
    return `${Number.isFinite(number) ? number.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0"}%`;
  }

  renderReportLeadList(items, emptyText, limit = 20) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return `<p class="text-muted">${this.escapeHtml(emptyText)}</p>`;
    const shown = list.slice(0, limit);
    return `<div class="i9-report-lead-list">${shown.map((lead) => `<div class="i9-report-lead"><div><strong>${this.escapeHtml(lead.name || "Sem nome")}</strong><small>${this.escapeHtml(lead.phone || "Sem telefone")} · ${this.escapeHtml(lead.niche || "Nicho não identificado")}${lead.subniche && lead.subniche !== "Não identificado" ? ` / ${this.escapeHtml(lead.subniche)}` : ""}</small></div><div class="i9-report-lead-score">${lead.score == null ? "Sem score" : `${Number(lead.score) || 0}/100`}<small>${this.escapeHtml(lead.scoreStatus || lead.trackingStatus || "")}</small></div></div>`).join("")}</div>${list.length > limit ? `<small class="text-muted">Exibindo ${limit} de ${list.length}. O PDF inclui até 1.000 contatos por lista.</small>` : ""}`;
  }

  renderCampaignReportModal(payload) {
    const report = payload.report;
    const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots.slice().sort((a, b) => Date.parse(b.capturedAt || b.generatedAt || 0) - Date.parse(a.capturedAt || a.generatedAt || 0)) : [];
    const m = report.metrics || {};
    const finishedAt = Date.parse(report.finishedAt || "");
    const elapsed = Number.isFinite(finishedAt) ? Date.now() - finishedAt : -1;
    const can24 = elapsed >= 24 * 60 * 60 * 1000;
    const can48 = elapsed >= 48 * 60 * 60 * 1000;
    const currentCycle = Math.max(1, Number(report.reportCycle) || 1);
    const snapshotRows = snapshots.length ? snapshots.map((snapshot) => {
      const sm = snapshot.metrics || {};
      return `<tr><td>${this.escapeHtml(snapshot.period === "24h" ? "24 horas" : snapshot.period === "48h" ? "48 horas" : "Atualização manual")}</td><td>${this.escapeHtml(String(snapshot.cycle || snapshot.reportCycle || 1))}</td><td>${this.escapeHtml(this.formatDate(snapshot.capturedAt || snapshot.generatedAt))}</td><td>${Number(sm.sent) || 0}</td><td>${Number(sm.responseCount) || 0} (${this.formatPercent(sm.responseRate)})</td><td>${Number(sm.qualifiedCount) || 0}</td></tr>`;
    }).join("") : `<tr><td colspan="6" class="text-muted">Nenhum marco salvo ainda. Os marcos de 24h e 48h são programados automaticamente após a conclusão.</td></tr>`;
    const modal = document.createElement("div");
    modal.className = "modal-overlay open";
    modal.innerHTML = `<div class="modal modal-lg i9-campaign-report-modal">
      <div class="modal-header"><h3 class="modal-title"><i class="fas fa-chart-column"></i> Relatório · ${this.escapeHtml(report.campaignName)}</h3><button type="button" class="modal-close">&times;</button></div>
      <div class="modal-body">
        <div class="i9-report-topline"><span class="campaign-status ${report.status === "completed" ? "status-completed" : report.status === "running" ? "status-running" : "status-paused"}">${this.escapeHtml(this.formatStatus(report.status))}</span><span class="text-muted">Ciclo ${currentCycle} · Atualizado ${this.escapeHtml(this.formatDate(report.generatedAt))}</span></div>
        <div class="i9-report-metrics">
          <div class="i9-report-metric"><small>Contatos selecionados</small><strong>${Number(m.total) || 0}</strong></div>
          <div class="i9-report-metric"><small>Mensagens enviadas</small><strong>${Number(m.sent) || 0}</strong><em>${this.formatPercent(m.sendSuccessRate)} de sucesso nas tentativas</em></div>
          <div class="i9-report-metric"><small>Respostas identificadas</small><strong>${Number(m.responseCount) || 0}</strong><em>${this.formatPercent(m.responseRate)} dos envios</em></div>
          <div class="i9-report-metric"><small>Leads qualificados</small><strong>${Number(m.qualifiedCount) || 0}</strong><em>${this.formatPercent(m.qualifiedRate)} dos envios</em></div>
          <div class="i9-report-metric"><small>Qualificados que responderam</small><strong>${Number(m.qualifiedResponders) || 0}</strong><em>${this.formatPercent(m.qualifiedResponderRate)} das respostas</em></div>
          <div class="i9-report-metric"><small>Leads quentes</small><strong>${Number(m.hotCount) || 0}</strong><em>conforme o Lead Score atual</em></div>
          <div class="i9-report-metric"><small>Falhas / ignorados</small><strong>${Number(m.failed) || 0} / ${Number(m.skipped) || 0}</strong><em>${Number(m.pending) || 0} pendentes</em></div>
          <div class="i9-report-metric"><small>Dados acompanhados</small><strong>${this.formatPercent(m.dataCoverageRate)}</strong><em>${Number(m.untrackedCount) || 0} sem evidência completa</em></div>
        </div>
        <div class="i9-report-notice"><strong>Importante sobre a precisão</strong><p>As respostas são identificadas pelas evidências sincronizadas no CRM. Antes de concluir que alguém não respondeu, sincronize as conversas do WhatsApp. Contatos sem registro no CRM ou sem data individual de envio são sinalizados separadamente.</p></div>
        <div class="form-section"><div class="form-section-title">Desempenho por nicho e subnicho</div>${report.niches?.length ? `<div class="table-responsive"><table class="table i9-report-table"><thead><tr><th>Nicho</th><th>Subnichos</th><th>Enviados</th><th>Respostas</th><th>Taxa</th><th>Qualificados</th><th>Quentes</th></tr></thead><tbody>${report.niches.map((niche) => `<tr><td><strong>${this.escapeHtml(niche.niche)}</strong></td><td>${(niche.subniches || []).map((sub) => `${this.escapeHtml(sub.subniche)} (${Number(sub.sent) || 0})`).join("<br>") || "—"}</td><td>${Number(niche.sent) || 0}</td><td>${Number(niche.responses) || 0}</td><td>${this.formatPercent(niche.responseRate)}</td><td>${Number(niche.qualified) || 0}</td><td>${Number(niche.hot) || 0}</td></tr>`).join("")}</tbody></table></div>` : `<p class="text-muted">Ainda não há nichos identificados nos contatos enviados.</p>`}</div>
        <div class="form-section"><div class="form-section-title">Quem respondeu (${report.respondedContacts?.length || 0})</div>${this.renderReportLeadList(report.respondedContacts, "Nenhuma resposta identificada com os dados sincronizados.")}</div>
        <div class="form-section"><div class="form-section-title">Leads qualificados (${report.qualifiedContacts?.length || 0})</div>${this.renderReportLeadList(report.qualifiedContacts, "Nenhum lead atende aos critérios atuais do Lead Score.")}</div>
        <div class="form-section"><div class="form-section-title">Sem resposta registrada (${report.notRespondedContacts?.length || 0})</div>${this.renderReportLeadList(report.notRespondedContacts, "Todos os envios têm uma resposta identificada.")}</div>
        <div class="form-section"><div class="form-section-title">Contatos sem dados suficientes para atribuição (${report.untrackedContacts?.length || 0})</div>${this.renderReportLeadList(report.untrackedContacts, "Todos os contatos enviados têm dados suficientes para análise.")}</div>
        <div class="form-section"><div class="form-section-title">Marcos e histórico de relatórios</div><div class="table-responsive"><table class="table i9-report-table"><thead><tr><th>Marco</th><th>Ciclo</th><th>Capturado em</th><th>Enviados</th><th>Respostas</th><th>Qualificados</th></tr></thead><tbody>${snapshotRows}</tbody></table></div><small class="text-muted">O i9Hub programa snapshots automáticos após 24h e 48h da conclusão. Eles são agregados históricos; o relatório atual reflete os dados mais recentes.</small></div>
      </div>
      <div class="modal-footer i9-report-footer"><button type="button" class="btn btn-secondary modal-close">Fechar</button><button type="button" class="btn btn-secondary" data-report-refresh><i class="fas fa-rotate"></i> Atualizar agora</button><button type="button" class="btn btn-secondary" data-report-snapshot="24h" ${can24 ? "" : "disabled"}><i class="fas fa-clock"></i> Registrar marco 24h</button><button type="button" class="btn btn-secondary" data-report-snapshot="48h" ${can48 ? "" : "disabled"}><i class="fas fa-clock"></i> Registrar marco 48h</button><button type="button" class="btn btn-primary" data-report-pdf><i class="fas fa-file-pdf"></i> Exportar PDF</button></div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelectorAll(".modal-close").forEach((button) => button.addEventListener("click", close));
    modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
    modal.querySelector("[data-report-refresh]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget; button.disabled = true;
      try {
        const refreshed = await this.app.api.refreshCampaignReport(report.campaignId, "manual");
        if (!refreshed.success) { this.app.showToast(refreshed.error || "Não foi possível atualizar o relatório.", "error", 7000); return; }
        modal.remove(); this.renderCampaignReportModal(refreshed.data); await this.loadCampaigns();
        this.app.showToast("Relatório atualizado com os dados mais recentes do CRM.", "success");
      } finally { button.disabled = false; }
    });
    modal.querySelectorAll("[data-report-snapshot]").forEach((button) => button.addEventListener("click", async () => {
      const period = button.dataset.reportSnapshot; button.disabled = true;
      try {
        const refreshed = await this.app.api.refreshCampaignReport(report.campaignId, period);
        if (!refreshed.success) { this.app.showToast(refreshed.error || "Não foi possível registrar este marco.", "warning", 7000); return; }
        modal.remove(); this.renderCampaignReportModal(refreshed.data); await this.loadCampaigns();
        this.app.showToast(`Marco de ${period} salvo.`, "success");
      } finally { button.disabled = false; }
    }));
    modal.querySelector("[data-report-pdf]")?.addEventListener("click", () => this.printCampaignReport(report));
  }

  printCampaignReport(report) {
    const win = window.open("", "_blank");
    if (!win) { this.app.showToast("O navegador bloqueou a janela do relatório. Permita pop-ups para a extensão e tente novamente.", "warning", 7000); return; }
    const esc = (value) => this.escapeHtml(value);
    const m = report.metrics || {};
    const listTable = (title, items) => {
      const list = (Array.isArray(items) ? items : []).slice(0, 1000);
      return `<h2>${esc(title)} (${(items || []).length})</h2>${list.length ? `<table><thead><tr><th>Nome</th><th>Telefone</th><th>Nicho / subnicho</th><th>Score</th><th>Situação</th></tr></thead><tbody>${list.map((lead) => `<tr><td>${esc(lead.name)}</td><td>${esc(lead.phone)}</td><td>${esc(lead.niche)}${lead.subniche && lead.subniche !== "Não identificado" ? ` / ${esc(lead.subniche)}` : ""}</td><td>${lead.score == null ? "—" : `${Number(lead.score) || 0}/100`}</td><td>${esc(lead.scoreStatus || lead.trackingStatus || "")}</td></tr>`).join("")}</tbody></table>${(items || []).length > list.length ? `<p>Listagem limitada aos primeiros ${list.length} contatos para manter o PDF leve.</p>` : ""}` : "<p>Nenhum contato nesta categoria.</p>"}`;
    };
    const nicheRows = (report.niches || []).map((niche) => `<tr><td>${esc(niche.niche)}</td><td>${(niche.subniches || []).map((sub) => `${esc(sub.subniche)} (${Number(sub.sent) || 0})`).join(", ")}</td><td>${Number(niche.sent) || 0}</td><td>${Number(niche.responses) || 0}</td><td>${this.formatPercent(niche.responseRate)}</td><td>${Number(niche.qualified) || 0}</td><td>${Number(niche.hot) || 0}</td></tr>`).join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório - ${esc(report.campaignName)}</title><style>@page{size:A4;margin:14mm}body{font:12px Arial,sans-serif;color:#172033;margin:0}h1{font-size:22px;margin:0 0 6px}h2{font-size:15px;margin:22px 0 8px;border-bottom:1px solid #d8dee9;padding-bottom:5px}.muted{color:#586579}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0}.metric{border:1px solid #d8dee9;border-radius:8px;padding:9px}.metric small{display:block;color:#586579}.metric strong{display:block;font-size:20px;margin-top:5px}.metric em{font-style:normal;font-size:10px;color:#586579}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #d8dee9;padding:5px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#f2f5fa}p{line-height:1.45}.note{background:#fff7e8;border:1px solid #f1d59b;padding:9px;border-radius:6px;margin:12px 0}.break{page-break-before:always}@media print{button{display:none}}</style></head><body><h1>Relatório de campanha · ${esc(report.campaignName)}</h1><div class="muted">Gerado em ${esc(this.formatDate(report.generatedAt))} · Ciclo ${Math.max(1, Number(report.reportCycle) || 1)} · Status: ${esc(this.formatStatus(report.status))}</div><p>Criação: ${esc(this.formatDate(report.createdAt))} · Início: ${esc(this.formatDate(report.startedAt))} · Conclusão: ${esc(this.formatDate(report.finishedAt))}</p><div class="metrics"><div class="metric"><small>Selecionados</small><strong>${Number(m.total) || 0}</strong></div><div class="metric"><small>Enviados</small><strong>${Number(m.sent) || 0}</strong><em>${this.formatPercent(m.sendSuccessRate)} de sucesso</em></div><div class="metric"><small>Respostas</small><strong>${Number(m.responseCount) || 0}</strong><em>${this.formatPercent(m.responseRate)} dos envios</em></div><div class="metric"><small>Qualificados</small><strong>${Number(m.qualifiedCount) || 0}</strong><em>${this.formatPercent(m.qualifiedRate)} dos envios</em></div><div class="metric"><small>Qualificados que responderam</small><strong>${Number(m.qualifiedResponders) || 0}</strong></div><div class="metric"><small>Leads quentes</small><strong>${Number(m.hotCount) || 0}</strong></div><div class="metric"><small>Falhas / ignorados</small><strong>${Number(m.failed) || 0} / ${Number(m.skipped) || 0}</strong></div><div class="metric"><small>Dados acompanhados</small><strong>${this.formatPercent(m.dataCoverageRate)}</strong><em>${Number(m.untrackedCount) || 0} sem evidência completa</em></div></div><div class="note"><strong>Limite de interpretação:</strong> a taxa de resposta depende das evidências sincronizadas no CRM/WhatsApp. Contatos sem registro ou sem data individual de envio são sinalizados; sincronize as conversas antes de concluir que não responderam. A qualificação usa o Lead Score atual e pode mudar com novas informações.</div><h2>Desempenho por nicho e subnicho</h2><table><thead><tr><th>Nicho</th><th>Subnichos</th><th>Enviados</th><th>Respostas</th><th>Taxa</th><th>Qualificados</th><th>Quentes</th></tr></thead><tbody>${nicheRows || '<tr><td colspan="7">Nenhum nicho identificado.</td></tr>'}</tbody></table>${listTable('Quem respondeu', report.respondedContacts)}${listTable('Leads qualificados', report.qualifiedContacts)}${listTable('Sem resposta registrada', report.notRespondedContacts)}${listTable('Contatos sem dados suficientes para atribuição', report.untrackedContacts)}${listTable('Falhas de envio', report.failedContacts)}${listTable('Pendentes', report.pendingContacts)}<p class="muted">Relatório gerado localmente pelo i9Hub. Não contém o conteúdo das mensagens, apenas métricas e dados de contato/classificação existentes no CRM.</p></body></html>`;
    win.document.open(); win.document.write(html); win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch { /* janela fechada pelo usuário */ } }, 350);
  }

  showCampaignDetail(id) {
    const campaign = this.campaigns.find((item) => item.id === id);
    if (!campaign) return;
    const count = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
    const sent = count(campaign.sent), failed = count(campaign.failed), total = count(campaign.total);
    const attempted = sent + failed;
    const rate = attempted > 0 ? Math.min(100, Math.max(0, Math.round((sent / attempted) * 100))) : 0;
    const status = campaign.status || "draft";
    const pending = (campaign.contacts || []).filter((contact) => !contact.status).length;
    const history = Array.isArray(campaign.editHistory) ? campaign.editHistory : [];
    const modal = document.createElement("div");
    modal.className = "modal-overlay open";
    modal.innerHTML = `<div class="modal modal-lg">
      <div class="modal-header"><h3 class="modal-title"><i class="fas fa-paper-plane"></i> ${this.escapeHtml(campaign.name || "Campanha")}</h3><button type="button" class="modal-close">&times;</button></div>
      <div class="modal-body">
        <div class="detail-grid">
          <div class="detail-item"><label>Status</label><span>${this.escapeHtml(this.formatStatus(status))}</span></div>
          <div class="detail-item"><label>Enviadas</label><span>${sent}/${total}</span></div>
          <div class="detail-item"><label>Pendentes</label><span>${pending}</span></div>
          <div class="detail-item"><label>Falharam</label><span>${failed}</span></div>
          <div class="detail-item"><label>Taxa de sucesso</label><span>${rate}%</span></div>
          <div class="detail-item"><label>Limite de envios</label><span>${count(campaign.sendLimit) || "Todos os contatos"}</span></div>
          <div class="detail-item"><label>Público</label><span>${this.escapeHtml(this.audienceLabel(campaign) || "Lista manual")}</span></div>
          <div class="detail-item"><label>Criada em</label><span>${this.escapeHtml(this.formatDate(campaign.createdAt))}</span></div>
          <div class="detail-item"><label>Configuração</label><span>Versão ${Math.max(1, Number(campaign.editVersion) || 1)} · ${history.length} alteração(ões)</span></div>
          <div class="detail-item full-width"><label>Template atual para contatos pendentes</label><pre style="white-space:pre-wrap;font-size:12px;background:var(--border);padding:10px;border-radius:8px;max-height:150px;overflow:auto">${this.escapeHtml(campaign.template || "")}</pre></div>
        </div>
        <div class="form-section"><div class="form-section-title">Log (últimos 20 — mostra o motivo de cada falha e alterações)</div><div style="max-height:220px;overflow:auto;font-size:12px;font-family:monospace;background:var(--bg-input);padding:10px;border-radius:8px">${this.renderLog(campaign.log)}</div></div>
        <div class="form-section"><div class="form-section-title">Histórico de configuração</div>${this.renderEditHistory(campaign)}</div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-secondary modal-close">Fechar</button></div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll(".modal-close").forEach((button) => button.addEventListener("click", () => modal.remove()));
    modal.addEventListener("click", (event) => { if (event.target === modal) modal.remove(); });
  }

  formatStatus(status) {
    return ({ running: "Em andamento", paused: "Pausada", completed: "Concluída", draft: "Rascunho", limit_reached: "Limite atingido" })[status] || "Desconhecido";
  }

  renderLog(log) {
    if (!log || !log.length) return '<span style="color: var(--text-muted)">Nenhum log ainda</span>';
    return log.slice(-20).reverse().map((entry) => {
      const border = entry.success ? "var(--success)" : "var(--error)";
      const message = entry.note ? this.escapeHtml(entry.note) : entry.success ? "Enviado" + (entry.via ? ` <span style="color:var(--text-muted)">(${entry.via === "store" ? "envio rápido" : "por busca" + (entry.storeReason ? " — " + this.escapeHtml(entry.storeReason) : "")})</span>` : "") : "Falhou: " + this.escapeHtml(entry.error || "");
      return `<div style="margin-bottom:4px;padding:4px;border-left:3px solid ${border}"><span style="color:var(--text-muted)">${this.escapeHtml(new Date(entry.timestamp).toLocaleString("pt-BR"))}</span> <strong>${this.escapeHtml(entry.contact || entry.phone || "")}</strong> - ${message}</div>`;
    }).join("");
  }

  updateCampaignProgress(payload) {
    const campaign = this.campaigns.find((item) => item.id === payload.campaignId);
    if (!campaign) { this.loadCampaigns(); return; }
    campaign.sent = payload.sent;
    campaign.failed = payload.failed;
    campaign.total = payload.total ?? campaign.total;
    campaign.status = payload.status;
    campaign.nextBatchAt = payload.nextBatchAt || null;
    campaign.batchPauseMs = payload.batchPauseMs ?? campaign.batchPauseMs;
    this.renderCampaigns();
    if (["CAMPAIGN_PAUSED", "CAMPAIGN_COMPLETED", "CAMPAIGN_LIMIT_REACHED", "CAMPAIGN_EDITED", "CAMPAIGN_BATCH_PAUSE_STARTED", "CAMPAIGN_BATCH_PAUSE_ENDED", "MESSAGE_FAILED"].includes(payload.event)) this.loadCampaigns();
  }
}
