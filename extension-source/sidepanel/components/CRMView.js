import { leadGroups, leadTags as getLeadTags, STAGE_LIST, refreshStages, stageTitle } from "../utils/segments.js";
import { TYPE_VALUES, TYPE_META, normalizeType } from "../../lib/classifier.js";
import { DEFAULT_LEAD_SCORING_CONFIG, LEAD_SCORE_ACTIONS, normalizeLeadScoringConfig, scoreLead, leadNicheLabels } from "../../lib/lead-scoring.js";
import { aggregateNichePerformance, buildNicheOptimizationRecommendations, buildPersonaOptimizationRecommendations, buildNicheAnalyticsCsv, suggestNicheConsolidations } from "../../lib/niche-optimization.js";
export class CRMView { constructor(app) { this.app = app; this.state = { leads: [], filteredLeads: [], currentPage: 1, pageSize: 20, selectedIds: new Set(), viewMode: "kanban", privateSyncRunId: null, leadScoring: DEFAULT_LEAD_SCORING_CONFIG, communicationMetrics: null }; } async render(container) { await refreshStages(this.app.api); container.innerHTML = this.getHTML(); this.bindEvents(); this.markActiveView(); await this.loadLeads(); } getHTML() { const t = this.app.businessProfile?.terminology || {}; const contactPlural = t.contactPlural || "Leads"; const opportunityPlural = t.opportunityPlural || "Oportunidades"; return `<div class="crm-view"> <div class="crm-header"> <h2><i class="fas fa-database"></i> CRM - ${this.escapeHtml(contactPlural)} &amp; ${this.escapeHtml(opportunityPlural)}</h2> <div class="crm-actions"> <div class="btn-group" style="margin-bottom: 8px;"> <button class="btn btn-secondary btn-sm" id="view-table"><i class="fas fa-table"></i> Tabela</button> <button class="btn btn-secondary btn-sm" id="view-kanban"><i class="fas fa-columns"></i> Kanban</button> </div> <div class="btn-group"> <button class="btn btn-secondary" id="btn-followups" data-feature="crm.followup.manage"><i class="fas fa-clock"></i> Follow-ups</button> <button class="btn btn-primary" id="btn-export-csv" disabled><i class="fas fa-download"></i> Exportar CSV</button> <button class="btn btn-primary" id="btn-use-wa"><i class="fas fa-message"></i> Campanha WhatsApp</button> <style>.btn-sync-pv .icon-hover-only{opacity:0;transition:opacity .2s ease;margin-right:0;width:0;overflow:hidden}.btn-sync-pv:hover .icon-hover-only{opacity:1;margin-right:6px;width:auto}</style><button class="btn btn-secondary btn-sync-pv" id="btn-sync-private" data-feature="whatsapp.private_opportunities" title="Sincroniza todas as conversas privadas do WhatsApp como oportunidades"><i class="fab fa-whatsapp icon-hover-only"></i> Sincronizar PV</button> <button class="btn btn-secondary" id="btn-bulk-type" disabled title="Classificar os contatos selecionados"><i class="fas fa-tags"></i> Marcar como...</button> <button class="btn btn-secondary" id="btn-blacklist" title="Contatos que nunca recebem campanha"><i class="fas fa-ban"></i> Black list</button> <button class="btn btn-secondary" id="btn-sync-labels" data-feature="whatsapp.labels_sync" title="Importa etiquetas do WhatsApp Business como filtros de listas para campanhas"><i class="fab fa-whatsapp"></i> Sincronizar etiquetas</button> <button class="btn btn-secondary" id="btn-labels-diag" title="Mostra o que o seu WhatsApp expõe sobre etiquetas"><i class="fas fa-stethoscope"></i> Diagnóstico de etiquetas</button> <button class="btn btn-secondary" id="btn-export-webhook" disabled><i class="fas fa-plug"></i> Enviar Webhook</button> <button class="btn btn-danger" id="btn-clear-leads"><i class="fas fa-trash"></i> Limpar Tudo</button> </div> </div> <div class="crm-intelligence-toolbar"><button class="btn btn-secondary" id="btn-manage-stages"><i class="fas fa-stream"></i> Gerenciar etapas</button><button class="btn btn-secondary" id="btn-manage-niches"><i class="fas fa-sitemap"></i> Nichos e etiquetas inteligentes</button><button class="btn btn-primary" id="btn-manage-lead-score"><i class="fas fa-chart-line"></i> Lead Score e qualificação</button><button class="btn btn-secondary" id="btn-niche-optimization"><i class="fas fa-lightbulb"></i> Inteligência comercial</button><span class="text-muted">Pontuação explicável, desempenho por nicho e recomendações.</span></div> <div class="crm-filters"> <input type="text" id="filter-search" placeholder="Buscar por nome, telefone, categoria..." class="form-input"> <select id="filter-sort" class="form-select"><option value="newest">Mais recentes primeiro</option><option value="oldest">Mais antigos primeiro</option><option value="updated">Última atualização</option></select> <select id="filter-source" class="form-select"><option value="">Todas as origens</option><option value="google_maps">Google Maps</option><option value="whatsapp">WhatsApp</option><option value="manual">Manual</option><option value="import">Importacao CSV</option><option value="whatsapp_group">Grupos do WhatsApp</option><option value="whatsapp_private">Oportunidades WhatsApp</option></select> <select id="filter-group" class="form-select"><option value="">Todos os grupos</option></select> <select id="filter-tag" class="form-select"><option value="">Todas as etiquetas</option></select> <select id="filter-category" class="form-select"><option value="">Todas as categorias</option></select> <select id="filter-stage" class="form-select"><option value="">Todos os estagios</option>${STAGE_LIST.map(st => `<option value="${this.escapeHtml(st.id)}">${this.escapeHtml(st.title)}</option>`).join("")}</select> <select id="filter-type" class="form-select"><option value="">Todos os tipos</option>${TYPE_VALUES.map(t => `<option value="${t}">${this.escapeHtml(TYPE_META[t].label)}</option>`).join("")}</select> <select id="filter-qualification" class="form-select"><option value="">Todas as qualificações</option><option value="qualified">Qualificados (Score/IA)</option><option value="hot">Leads quentes</option><option value="ai_all">Processados pela IA (Ambas)</option><option value="ai_qualified">Qualificados pela IA</option><option value="ai_auto">Atendidos por IA - Atendimento</option><option value="ai_observer">Anotados por IA - Observador</option><option value="unqualified">Não qualificados</option><option value="blocked">Bloqueados</option></select> <select id="filter-niche" class="form-select"><option value="">Todos os nichos/subnichos</option></select> </div> <div class="crm-stats"> <div class="stat-card"><span class="stat-number" id="stat-total">0</span><span class="stat-label">Total</span></div> <div class="stat-card"><span class="stat-number" id="stat-opportunities">0</span><span class="stat-label">Oportunidades</span></div> <div class="stat-card"><span class="stat-number" id="stat-today">0</span><span class="stat-label">Hoje</span></div> <div class="stat-card"><span class="stat-number" id="stat-whatsapp">0</span><span class="stat-label">Com WhatsApp</span></div> <div class="stat-card"><span class="stat-number" id="stat-email">0</span><span class="stat-label">Com Email</span></div> <div class="stat-card"><span class="stat-number" id="stat-value">R$ 0</span><span class="stat-label">Valor Total</span></div> <div class="stat-card type-stat-spam"><span class="stat-number" id="stat-type-spam">0</span><span class="stat-label">Spam</span></div> <div class="stat-card type-stat-prospecto"><span class="stat-number" id="stat-type-prospecto">0</span><span class="stat-label">Prospectos</span></div> <div class="stat-card type-stat-cliente"><span class="stat-number" id="stat-type-cliente">0</span><span class="stat-label">Clientes</span></div> <div class="stat-card type-stat-a-classificar"><span class="stat-number" id="stat-type-a-classificar">0</span><span class="stat-label">A classificar</span></div> <div class="stat-card"><span class="stat-number" id="stat-qualified-leads">0</span><span class="stat-label">Qualificados</span></div> <div class="stat-card"><span class="stat-number" id="stat-hot-leads">0</span><span class="stat-label">Leads quentes</span></div> </div> <section class="crm-communication-panel" data-feature="crm.communication.email"><div class="crm-communication-panel-head"><div><strong><i class="fas fa-comments"></i> Comunicação comercial</strong><small>Atividade registrada pelo CRM</small></div><button class="btn btn-sm btn-secondary" id="btn-communication-metrics"><i class="fas fa-chart-column"></i> Ver por vendedor</button></div><div class="crm-communication-stats"><div class="stat-card"><span class="stat-number" id="comm-stat-whatsapp">0</span><span class="stat-label">Conversas abertas</span></div><div class="stat-card"><span class="stat-number" id="comm-stat-sent">0</span><span class="stat-label">E-mails enviados</span></div><div class="stat-card"><span class="stat-number" id="comm-stat-replies">0</span><span class="stat-label">Respostas recebidas</span></div><div class="stat-card"><span class="stat-number" id="comm-stat-failed">0</span><span class="stat-label">Falhas de envio</span></div><div class="stat-card"><span class="stat-number" id="comm-stat-uncertain">0</span><span class="stat-label">Envios incertos</span></div><div class="stat-card"><span class="stat-number" id="comm-stat-optouts">0</span><span class="stat-label">Descadastros</span></div></div></section> <div id="table-container" class="crm-table-container"> <table class="table" id="leads-table"> <thead> <tr> <th><input type="checkbox" id="select-all"></th> <th>Nome</th> <th>Telefone</th> <th>Email</th> <th>Categoria</th> <th>Origem</th> <th>Estagio</th> <th>Tipo</th> <th>Lead Score</th> <th>Avaliacao</th> <th>Valor</th> <th>Data</th> <th>Acoes</th> </tr> </thead> <tbody id="leads-tbody"></tbody> </table> <div id="empty-state" class="empty-state" style="display:none;"><div class="icon"><i class="fas fa-inbox"></i></div><h3>Nenhum lead ou oportunidade salvo</h3><p>Extraia leads, importe um CSV ou conecte o WhatsApp para criar oportunidades automaticamente.</p></div> </div> <div id="kanban-container" class="kanban-board" style="display:none;"></div> <div class="crm-pagination" id="crm-pagination"> <button id="prev-page" class="btn btn-sm" disabled><i class="fas fa-chevron-left"></i></button> <span id="page-info">Pagina 1 de 1</span> <button id="next-page" class="btn btn-sm" disabled><i class="fas fa-chevron-right"></i></button> </div> </div>`; } async loadLeads() {
    try {
      const title = document.querySelector(".crm-header h2");
      const t = this.app.businessProfile?.terminology || {};
      if (title) title.innerHTML = `<i class="fas fa-database"></i> CRM - ${this.escapeHtml(t.contactPlural || "Leads")} &amp; ${this.escapeHtml(t.opportunityPlural || "Oportunidades")}`;
      const [res, settingsRes] = await Promise.all([this.app.api.getSavedLeads(), this.app.api.getSettings()]);
      if (!res?.success) { this.app.showToast("Erro ao carregar leads: " + (res?.error || "resposta inválida"), "error"); return; }
      this.state.leadScoring = normalizeLeadScoringConfig(settingsRes?.data?.leadScoring || this.state.leadScoring || DEFAULT_LEAD_SCORING_CONFIG);
      this.state.leads = (Array.isArray(res.data) ? res.data : []).map((lead) => ({ ...lead, _i9Score: scoreLead(lead, this.state.leadScoring) }));
      this.populateCategoryFilter();
      this.populateSegmentFilters();
      this.populateNicheFilter();
      this.populateStageFilter();
      this.applyFilters();
      if (this.app.hasFeature?.('crm.communication.email')) this.loadCommunicationMetrics();
    } catch (error) { this.app.showToast("Erro: " + error.message, "error"); }
  }
 applyFilters() {
    const search = document.getElementById("filter-search")?.value.toLowerCase() || "";
    const source = document.getElementById("filter-source")?.value || "";
    const category = document.getElementById("filter-category")?.value || "";
    const stage = document.getElementById("filter-stage")?.value || "";
    const group = document.getElementById("filter-group")?.value || "";
    const tag = document.getElementById("filter-tag")?.value || "";
    const type = document.getElementById("filter-type")?.value || "";
    const qualification = document.getElementById("filter-qualification")?.value || "";
    const niche = document.getElementById("filter-niche")?.value || "";
    this.state.filteredLeads = this.state.leads.filter((lead) => {
      const matchesSearch = !search || String(lead.name || "").toLowerCase().includes(search) || String(lead.phone || "").includes(search)
        || String(lead.category || "").toLowerCase().includes(search) || String(lead.address || "").toLowerCase().includes(search)
        || leadGroups(lead).some((g) => g.toLowerCase().includes(search)) || getLeadTags(lead).some((tagValue) => String(tagValue).toLowerCase().includes(search))
        || [lead.aiIntelligence?.exactRequest, lead.aiIntelligence?.summary, lead.aiIntelligence?.need, lead.aiIntelligence?.service, lead.aiIntelligence?.segment]
          .some((value) => String(value || "").toLowerCase().includes(search));
      const matchesGroup = !group || leadGroups(lead).includes(group);
      const matchesTag = !tag || getLeadTags(lead).includes(tag);
      const matchesSource = !source || (source === "whatsapp_private" ? lead.opportunitySource === "whatsapp_private" && lead.opportunity === true : lead.source === source);
      const matchesCategory = !category || lead.category === category;
      const matchesStage = !stage || this.leadStage(lead) === stage;
      const matchesType = !type || normalizeType(lead.tipo) === type;
      const score = lead._i9Score || scoreLead(lead, this.state.leadScoring);
      const hasAiData = !!(lead.aiIntelligence?.evaluatedAt || lead.aiIntelligence?.updatedAt || lead.aiIntelligence?.summary || lead.aiIntelligence?.exactRequest || lead.aiQualification?.evaluatedAt || lead.aiQualification?.status);
      const aiMode = lead.aiIntelligence?.analysisMode || (lead.aiIntelligence?.source === "i9Hub-ai-observer" ? "observe_only" : (hasAiData ? "auto_reply" : ""));
      const isAiQualified = lead.aiQualification?.qualified === true || lead.aiIntelligence?.status === "qualified" || lead.aiQualification?.status === "qualified";
      const matchesQualification = !qualification || (
        qualification === "qualified" ? (score.qualified || isAiQualified) :
        qualification === "hot" ? score.hot :
        qualification === "ai_all" ? hasAiData :
        qualification === "ai_qualified" ? isAiQualified :
        qualification === "ai_auto" ? (hasAiData && aiMode === "auto_reply") :
        qualification === "ai_observer" ? (hasAiData && aiMode === "observe_only") :
        qualification === "blocked" ? score.blocked :
        !score.qualified && !score.blocked
      );
      const matchesNiche = !niche || leadNicheLabels(lead).includes(niche);
      return matchesSearch && matchesSource && matchesCategory && matchesStage && matchesGroup && matchesTag && matchesType && matchesQualification && matchesNiche;
    });
    const sortVal = document.getElementById("filter-sort")?.value || "newest";
    this.state.filteredLeads.sort((a, b) => {
      if (sortVal === "oldest") return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortVal === "updated") return (b.updatedAt || 0) - (a.updatedAt || 0);
      return (b.createdAt || 0) - (a.createdAt || 0); // newest default
    });

    this.state.currentPage = 1;
    this.state.selectedIds.clear();
    this.renderCurrentView(); this.updatePagination(); this.updateStats(); this.updateExportButtons();
  }
 populateSegmentFilters() { const fill = (id, label, values) => { const select = document.getElementById(id); if (!select) return; const cur = select.value; select.innerHTML = `<option value="">${label}</option>` + values.map(v => `<option value="${this.escapeHtml(v)}">${this.escapeHtml(v)}</option>`).join(""); select.value = values.includes(cur) ? cur : ""; }; fill("filter-group", "Todos os grupos", [...new Set(this.state.leads.flatMap(l => leadGroups(l)))].sort((a, b) => a.localeCompare(b, "pt-BR"))); fill("filter-tag", "Todas as etiquetas", [...new Set(this.state.leads.flatMap(l => getLeadTags(l)))].sort((a, b) => String(a).localeCompare(String(b), "pt-BR"))); } populateNicheFilter() { const select = document.getElementById("filter-niche"); if (!select) return; const current = select.value; const values = [...new Set(this.state.leads.flatMap((lead) => leadNicheLabels(lead)))].sort((a, b) => a.localeCompare(b, "pt-BR")); select.innerHTML = `<option value="">Todos os nichos/subnichos</option>` + values.map((value) => `<option value="${this.escapeHtml(value)}">${this.escapeHtml(value)}</option>`).join(""); select.value = values.includes(current) ? current : ""; } currentSelection() { return this.state.selectedIds.size > 0 ? this.state.filteredLeads.filter(l => this.state.selectedIds.has(l.id || l.placeId || l.phone)) : this.state.filteredLeads; } useInCampaign(kind) { const sel = this.currentSelection(); const blocked = sel.filter(l => l.blacklisted).length; const leads = sel.filter(l => String(l.phone || "").replace(/\D/g, "").length >= 10 && !l.blacklisted); if (blocked) this.app.showToast(`${blocked} contato(s) na Black list ficaram de fora da campanha.`, "info", 5000); if (!leads.length) { this.app.showToast("Nenhum contato com telefone neste filtro/seleção.", "warning"); return; } this.app.pendingContacts = leads; if (kind === "wa") { this.app.campaignForm.show(); } } populateCategoryFilter() { const select = document.getElementById("filter-category"); if (!select) return; const categories = [...new Set(this.state.leads.map(l => l.category).filter(Boolean))].sort(); select.innerHTML = "<option value=\"\">Todas as categorias</option>" + categories.map(c => `<option value=\"${this.escapeHtml(c)}\">${this.escapeHtml(c)}</option>`).join(""); } renderCurrentView() { if (this.state.viewMode === "kanban") { this.renderKanban(); } else { this.renderTable(); } } renderTable() { const tbody = document.getElementById("leads-tbody"); const emptyState = document.getElementById("empty-state"); const start = (this.state.currentPage - 1) * this.state.pageSize; const end = start + this.state.pageSize; const pageLeads = this.state.filteredLeads.slice(start, end); if (pageLeads.length === 0) { tbody.innerHTML = ""; emptyState.style.display = "flex"; document.getElementById("leads-table").style.display = "none"; return; } emptyState.style.display = "none"; document.getElementById("leads-table").style.display = "table"; tbody.innerHTML = pageLeads.map(lead => { const isSelected = this.state.selectedIds.has(lead.id || lead.placeId || lead.phone); return `<tr data-id=\"${this.escapeHtml(lead.id || lead.placeId || lead.phone)}\" ${isSelected ? "class=\"selected\"" : ""}> <td><input type=\"checkbox\" class=\"lead-checkbox\" value=\"${this.escapeHtml(lead.id || lead.placeId || lead.phone)}\" ${isSelected ? "checked" : ""}></td> <td><strong>${this.escapeHtml(lead.name || "Sem nome")}</strong>${lead.opportunity ? ` <span class="badge" title="Oportunidade criada a partir de conversa privada">WhatsApp</span>` : ""}${this.aiStatusBadgeHTML(lead)}${this.leadTagsHTML(lead, 4)}</td> <td>${this.escapeHtml(lead.phone || "-")}</td> <td>${this.escapeHtml(lead.email || "-")}</td> <td><span class=\"badge\">${this.escapeHtml(lead.category || leadGroups(lead).join(", ") || "-")}</span></td> <td><span class=\"badge\">${this.escapeHtml(this.formatSource(lead.source))}</span></td> <td><span class=\"badge\">${this.escapeHtml(this.formatStage(this.leadStage(lead)))}</span></td> <td>${this.typeBadgeHTML(lead)}</td> <td>${this.leadScoreBadgeHTML(lead)}</td> <td>${Number.isFinite(Number(lead.rating)) && Number(lead.rating) > 0 && Number(lead.rating) <= 5 ? "<i class=\"fas fa-star text-warning\"></i> " + Number(lead.rating).toFixed(1) : "-"}</td> <td>${lead.value ? "R$ " + Number(lead.value).toLocaleString("pt-BR", {minimumFractionDigits: 2}) : "-"}</td> <td>${lead.extractedAt ? this.formatDate(lead.extractedAt) : "-"}</td> <td> <div class="action-buttons"> <button class="btn-icon btn-view" title="Ver detalhes" data-id=\"${this.escapeHtml(lead.id || lead.placeId || lead.phone)}\"><i class="fas fa-eye"></i></button> ${this.communicationActionsHTML(lead, this.idOf(lead))} <button class="btn-icon btn-copy-phone" title="Copiar telefone" data-phone=\"${this.escapeHtml(lead.phone)}\"><i class="fas fa-phone"></i></button> <button class="btn-icon btn-edit-stage" title="Mover estagio" data-id=\"${this.escapeHtml(lead.id || lead.placeId || lead.phone)}\"><i class="fas fa-arrow-right"></i></button> <button class="btn-icon btn-blacklist" title="${lead.blacklisted ? 'Tirar da Black list' : 'Colocar na Black list'}" data-id="${this.escapeHtml(this.idOf(lead))}"><i class="fas fa-ban"></i></button> <button class="btn-icon btn-type" title="Marcar como..." data-id="${this.escapeHtml(this.idOf(lead))}"><i class="fas fa-tags"></i></button> <button class="btn-icon btn-delete" title="Excluir" data-id=\"${this.escapeHtml(lead.id || lead.placeId || lead.phone)}\"><i class="fas fa-trash"></i></button> </div> </td> </tr>`; }).join(""); this.attachRowEventListeners(); }
  bindBlacklistButtons() {
    document.querySelectorAll(".btn-blacklist, .kanban-act-bl").forEach(btn => {
      if (btn.dataset.blBound) return; btn.dataset.blBound = "1";
      btn.addEventListener("click", (e) => { e.stopPropagation(); const lead = this.findLead(btn.dataset.id); if (lead) this.toggleBlacklist(lead); });
    });
  }
  async toggleBlacklist(lead) {
    const label = lead.name || lead.phone || "este contato";
    if (!String(lead.phone || "").replace(/\D/g, "")) { this.app.showToast("Este lead não tem telefone.", "warning"); return; }
    if (lead.blacklisted) {
      if (!confirm(`Tirar ${label} da Black list? Ele volta a poder receber campanhas. A etiqueta no WhatsApp não é removida.`)) return;
      const r = await this.app.api.blacklistRemove(lead.phone);
      this.app.showToast(r.success ? "Removido da Black list." : (r.error || "Erro ao remover"), r.success ? "success" : "error");
    } else {
      if (!confirm(`Colocar ${label} na Black list?\n\n• sai de todas as campanhas\n• vai para o estágio "Black list"\n• recebe a etiqueta no WhatsApp Business (se o WhatsApp estiver conectado)`)) return;
      const r = await this.app.api.blacklistAdd([{ phone: lead.phone, name: lead.name }], "crm");
      if (r.success) { const l = r.data?.label; this.app.showToast("Na Black list." + (l ? (l.applied ? " Etiqueta aplicada." : ` Etiqueta não aplicada (${l.note || "indisponível"}).`) : " Etiqueta não aplicada (WhatsApp não conectado)."), "success", 7000); }
      else this.app.showToast(r.error || "Erro ao colocar na Black list", "error");
    }
    await this.loadLeads(); this.renderCurrentView();
  }
  async showBlacklistManager() {
    const modal = document.createElement("div"); modal.className = "modal-overlay open";
    modal.innerHTML = `<div class="modal modal-lg"><div class="modal-header"><h3 class="modal-title"><i class="fas fa-ban"></i> Black list</h3><button class="modal-close">&times;</button></div><div class="modal-body"><p class="text-muted" style="margin-bottom:10px">Quem está aqui nunca recebe campanha WhatsApp, fica no estágio "Black list" do CRM e (conta Business) tem a etiqueta "Black list". Para adicionar pelo WhatsApp, passe o mouse numa mensagem recebida e clique em "Black list".</p><div id="bl-list"><p><i class="fas fa-spinner fa-spin"></i> Carregando...</p></div><label class="form-label" style="margin-top:14px">Adicionar números (um por linha: telefone ou nome,telefone)</label><textarea class="form-textarea" id="bl-add" rows="3" placeholder="5511999999999&#10;Maria,11988887777"></textarea><div class="btn-group" style="margin-top:10px;justify-content:flex-end"><button class="btn btn-primary" id="bl-add-btn"><i class="fas fa-plus"></i> Adicionar</button></div></div></div>`;
    document.body.appendChild(modal);
    const close = () => { modal.remove(); this.loadLeads(); };
    modal.querySelector(".modal-close")?.addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    const srcName = { whatsapp_msg: "Mensagem do WhatsApp", crm: "CRM", etiqueta: "Etiqueta do WhatsApp", manual: "Manual" };
    const load = async () => {
      const r = await this.app.api.getBlacklist(); const list = (r.data || []).slice().reverse(); const box = modal.querySelector("#bl-list");
      if (!r.success) { box.innerHTML = `<p>${this.escapeHtml(r.error || "Erro")}</p>`; return; }
      box.innerHTML = list.length ? `<div style="max-height:300px;overflow:auto"><table class="table"><thead><tr><th>Contato</th><th>Telefone</th><th>Origem</th><th>Etiqueta</th><th></th></tr></thead><tbody>${list.map(e => `<tr><td>${this.escapeHtml(e.name || "-")}</td><td>${this.escapeHtml(e.phone)}</td><td>${this.escapeHtml(srcName[e.source] || e.source || "-")}</td><td>${e.labelApplied ? "Aplicada" : `<span title="${this.escapeHtml(e.labelNote || "")}">Não</span>`}</td><td><button class="btn btn-sm btn-secondary bl-remove" data-phone="${this.escapeHtml(e.phone)}">Remover</button></td></tr>`).join("")}</tbody></table></div><small class="text-muted">${list.length} na Black list</small>` : `<div class="empty-state"><p>Black list vazia.</p></div>`;
      box.querySelectorAll(".bl-remove").forEach(b => b.addEventListener("click", async () => { if (!confirm("Tirar este número da Black list?")) return; const rr = await this.app.api.blacklistRemove(b.dataset.phone); this.app.showToast(rr.success ? "Removido." : (rr.error || "Erro"), rr.success ? "success" : "error"); load(); }));
    };
    await load();
    modal.querySelector("#bl-add-btn")?.addEventListener("click", async () => {
      const items = modal.querySelector("#bl-add").value.split(/\r?\n/).map(l => l.split(/[;,\t]/).map(x => x.trim()).filter(Boolean)).filter(p => p.length).map(p => { const i = p.findIndex(x => x.replace(/\D/g, "").length >= 8); return i < 0 ? null : { phone: p[i], name: p.find((_, k) => k !== i) || "" }; }).filter(Boolean);
      if (!items.length) { this.app.showToast("Nenhum telefone válido.", "warning"); return; }
      const r = await this.app.api.blacklistAdd(items, "manual");
      if (r.success) { modal.querySelector("#bl-add").value = ""; this.app.showToast(`${r.data.added} adicionados` + (r.data.already ? `, ${r.data.already} já estavam` : "") + (r.data.invalid ? `, ${r.data.invalid} inválidos` : "") + ".", "success"); load(); }
      else this.app.showToast(r.error || "Erro", "error");
    });
  }
  populateStageFilter() {
    const select = document.getElementById("filter-stage"); if (!select) return;
    const cur = select.value;
    select.innerHTML = `<option value="">Todos os estagios</option>` + STAGE_LIST.map(st => `<option value="${this.escapeHtml(st.id)}">${this.escapeHtml(st.title)}</option>`).join("");
    select.value = STAGE_LIST.some(st => st.id === cur) ? cur : "";
  }
  updatePrivateSyncProgress(payload = {}) {
    if (!payload.syncRunId || payload.syncRunId !== this.state.privateSyncRunId) return;
    const btn = document.getElementById("btn-sync-private");
    if (!btn || !btn.disabled) return;
    const processed = Math.max(0, Number(payload.processedSoFar) || 0);
    const total = Math.max(0, Number(payload.totalChats) || 0);
    if (payload.phase === "queued") {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aguardando...';
    } else if (payload.phase === "history") {
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Histórico ${processed}/${total}`;
    } else if (payload.phase === "import") {
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Importando ${processed}/${total}`;
    } else {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Localizando PV...';
    }
  }
  handlePrivateSyncFailure(payload = {}) {
    if (!payload.syncRunId || payload.syncRunId !== this.state.privateSyncRunId) return;
    this.app.showToast(payload.message || payload.error || "A sincronização das conversas privadas foi interrompida.", "error", 9000);
  }
  async syncPrivateOpportunities() {
    const btn = document.getElementById("btn-sync-private");
    const original = btn ? btn.innerHTML : "";
    const syncRunId = `crm_pv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    this.state.privateSyncRunId = syncRunId;
    let listener = null;
    let timeoutId = null;
    let settled = false;
    let resolveCompletion;
    const cleanup = () => {
      if (listener) chrome.runtime.onMessage.removeListener(listener);
      if (timeoutId) clearTimeout(timeoutId);
      listener = null;
      timeoutId = null;
    };
    const completion = new Promise((resolve) => {
      resolveCompletion = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };
      listener = (message) => {
        const payload = message?.payload || {};
        if (payload.syncRunId !== syncRunId) return;
        if (message.type === "PRIVATE_OPPORTUNITIES_UPDATED") resolveCompletion({ type: "completed", payload });
        if (message.type === "PRIVATE_OPPORTUNITIES_SYNC_FAILED") resolveCompletion({ type: "failed", payload });
      };
      chrome.runtime.onMessage.addListener(listener);
      timeoutId = setTimeout(() => resolveCompletion({ type: "timeout" }), 8 * 60 * 1000);
    });

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparando...'; }
    try {
      const r = await this.app.api.syncPrivateOpportunities({ syncRunId });
      if (!r.success) {
        resolveCompletion({ type: "request-error", payload: { error: r.error || "Não foi possível iniciar a sincronização." } });
      } else if (r.data?.sync?.started === true) {
        this.app.showToast("Sincronização iniciada. As conversas privadas serão incluídas no estágio Novo; o histórico será processado em seguida.", "info", 7000);
      } else {
        resolveCompletion({ type: "completed", payload: r.data || {} });
      }
      const outcome = await completion;
      if (outcome.type === "failed" || outcome.type === "request-error") {
        this.app.showToast(outcome.payload?.message || outcome.payload?.error || "A sincronização falhou.", "error", 9000);
        return;
      }
      if (outcome.type === "timeout") {
        await this.loadLeads();
        this.app.showToast("A sincronização ainda não confirmou a conclusão após 8 minutos. Os contatos já importados foram atualizados; verifique o diagnóstico do WhatsApp antes de tentar novamente.", "warning", 12000);
        return;
      }
      await this.loadLeads();
      const d = outcome.payload || {};
      const historyErrors = Number(d.errorsCount) || 0;
      const summary = `Sincronização concluída: ${Number(d.scanned) || 0} conversas privadas analisadas, ${Number(d.added) || 0} oportunidades novas, ${Number(d.updated) || 0} atualizadas e ${Number(d.historyLoaded) || 0} históricos ampliados.`;
      this.app.showToast(
        summary + (historyErrors ? ` Atenção: ${historyErrors} conversa(s) tiveram falha ao carregar o histórico.` : ""),
        historyErrors ? "warning" : "success", 11000
      );
    } catch (e) {
      resolveCompletion({ type: "request-error", payload: { error: e.message } });
      this.app.showToast("Erro: " + e.message, "error", 8000);
    } finally {
      cleanup();
      if (this.state.privateSyncRunId === syncRunId) this.state.privateSyncRunId = null;
      if (btn) { btn.disabled = false; btn.innerHTML = original; }
    }
  }

  async syncLabels() {
    const btn = document.getElementById("btn-sync-labels");
    const original = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...'; }
    try {
      const r = await this.app.api.syncLabels({ createLeads: true });
      if (!r.success) {
        this.app.showToast(r.error || "Não foi possível sincronizar as etiquetas.", "error", 9000);
        if (r.code === "NO_LABELS") this.showLabelDiagnostic();
        return;
      }
      const d = r.data || {};
      await refreshStages(this.app.api);
      await this.loadLeads();
      this.populateStageFilter();
      this.renderCurrentView();
      const hasNoMatches = Number(d.labeledContacts || 0) === 0;
      this.app.showToast(`${d.labels} etiquetas sincronizadas. ${d.labeledContacts || 0} contatos com etiqueta; ${d.leadsCreated || 0} novos e ${d.leadsUpdated || 0} atualizados` + (d.labelsRemoved ? `; ${d.labelsRemoved} perderam etiquetas` : "") + (d.blacklistImported ? `; ${d.blacklistImported} adicionados à Black List` : "") + (d.noPhone ? `. ${d.noPhone} conversas ficaram de fora porque o WhatsApp não mostrou o telefone.` : ".") + (hasNoMatches ? " Confira o Diagnóstico de etiquetas se esperava encontrar contatos." : " Agora filtre por etiqueta no CRM ou salve uma lista no formulário de campanha."), d.noPhone || hasNoMatches ? "warning" : "success", 11000);
    } catch (e) {
      this.app.showToast("Erro ao sincronizar etiquetas: " + e.message, "error", 8000);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = original; }
    }
  }
  async showLabelDiagnostic() {
    const modal = document.createElement("div"); modal.className = "modal-overlay open";
    modal.innerHTML = `<div class="modal modal-lg"><div class="modal-header"><h3 class="modal-title"><i class="fas fa-stethoscope"></i> Diagnóstico de etiquetas</h3><button class="modal-close">&times;</button></div><div class="modal-body"><div id="label-diag-body"><p><i class="fas fa-spinner fa-spin"></i> Lendo o seu WhatsApp...</p></div></div></div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector(".modal-close")?.addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    const body = modal.querySelector("#label-diag-body");
    const r = await this.app.api.labelsDiagnostic();
    if (!r.success) { body.innerHTML = `<p>${this.escapeHtml(r.error || "Não foi possível rodar o diagnóstico.")}</p>`; return; }
    const rep = r.data || {};
    const text = JSON.stringify(rep, null, 2);
    const msgs = {
      ok: ["success", "Tudo certo: o seu WhatsApp expõe as etiquetas e as conversas ligadas a elas. Pode usar \"Sincronizar etiquetas\"."],
      sem_etiquetas: ["warning", "O WhatsApp expõe a área de etiquetas, mas não há nenhuma etiqueta criada. Crie etiquetas no WhatsApp Business e rode de novo."],
      etiquetas_sem_conversas: ["warning", "As etiquetas foram lidas, mas nenhuma conversa aparece ligada a elas. Se você já etiquetou conversas, copie o relatório abaixo e envie para ajuste."],
      nao_encontrado: ["danger", "Não localizei as etiquetas neste WhatsApp. Em conta WhatsApp normal isso é esperado (etiquetas só existem no Business). Se a sua conta é Business, copie o relatório abaixo e envie para ajuste."],
      store_indisponivel: ["danger", "O WhatsApp Web ainda não carregou as conversas. Espere a lista aparecer, recarregue o painel do WhatsApp e rode de novo."],
    };
    const [kind, msg] = msgs[rep.verdict] || ["warning", "Resultado inesperado. Copie o relatório abaixo."];
    const labels = (rep.labels || []).map(l => `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${this.escapeHtml(l.color || "#6b7280")};margin-right:6px"></span>${this.escapeHtml(l.name)}${l.deleted ? " (apagada)" : ""}</td><td>${l.chats}</td></tr>`).join("");
    const s = rep.sync || {};
    body.innerHTML = `<p><span class="badge badge-${kind}">${rep.verdict === "ok" ? "OK" : "Atenção"}</span> ${this.escapeHtml(msg)}</p>
      ${labels ? `<table class="table" style="margin:12px 0"><thead><tr><th>Etiqueta (vira estágio)</th><th>Conversas</th></tr></thead><tbody>${labels}</tbody></table>` : ""}
      ${rep.sync ? `<p class="text-muted">Conversas etiquetadas: ${s.labeledChats} · com telefone: ${s.withPhone} · sem telefone visível: ${s.noPhone} · grupos ignorados: ${s.groupsSkipped}</p>` : ""}
      ${(rep.notes || []).map(n => `<p class="text-muted">${this.escapeHtml(n)}</p>`).join("")}
      <label class="form-label" style="margin-top:12px">Relatório técnico (sem telefones nem nomes de contatos)</label>
      <textarea class="form-textarea" id="label-diag-json" rows="10" readonly style="font-family:monospace;font-size:11px">${this.escapeHtml(text)}</textarea>
      <div class="btn-group" style="margin-top:12px;justify-content:flex-end"><button class="btn btn-secondary" id="label-diag-copy"><i class="fas fa-copy"></i> Copiar relatório</button><button class="btn btn-primary" id="label-diag-close">Fechar</button></div>`;
    body.querySelector("#label-diag-copy")?.addEventListener("click", () => { navigator.clipboard.writeText(text); this.app.showToast("Relatório copiado.", "success"); });
    body.querySelector("#label-diag-close")?.addEventListener("click", close);
  }
  communicationActionsHTML(lead, id, kanban = false) {
    const phone = String(lead?.phone || '').replace(/\D/g, '');
    const email = String(lead?.email || '').trim();
    const classes = kanban ? 'btn btn-sm btn-secondary' : 'btn-icon';
    const whatsapp = phone.length >= 10 && phone.length <= 15
      ? `<button type="button" class="${classes} ${kanban ? 'kanban-act-wa' : 'btn-open-wa'}" data-id="${this.escapeHtml(id)}" data-feature="whatsapp.connection" title="Abrir conversa no WhatsApp">${kanban ? '<i class="fab fa-whatsapp"></i> WhatsApp' : '<i class="fab fa-whatsapp text-success"></i>'}</button>` : '';
    const emailButton = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
      ? `<button type="button" class="${classes} ${kanban ? 'kanban-act-email' : 'btn-send-email'}" data-id="${this.escapeHtml(id)}" data-feature="crm.communication.email" title="Enviar e-mail">${kanban ? '<i class="fas fa-envelope"></i> E-mail' : '<i class="fas fa-envelope"></i>'}</button>` : '';
    return `${whatsapp}${emailButton}`;
  }
  async openLeadWhatsApp(lead) {
    if (!lead) return;
    const phone = String(lead.phone || '').replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 15) { this.app.showToast('Este lead não possui um telefone válido.', 'warning'); return; }
    const result = await this.app.api.openCrmLeadChat(lead);
    if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível abrir a conversa.', 'error', 7000); return; }
    this.app.showToast(`Conversa de ${lead.name || phone} aberta no WhatsApp Web. Nenhuma mensagem foi enviada.`, 'success', 5000);
    try { await this.loadLeads(); } catch { /* a conversa já foi aberta */ }
  }
  openLeadEmail(lead) {
    if (!lead) return;
    this.app.communicationModal?.show(lead);
  }
  idOf(lead) { return String(lead.id || lead.placeId || lead.phone || ""); }
  leadStage(lead) { return STAGE_LIST.some(st => st.id === lead.stage) ? lead.stage : "novo"; }
  markActiveView() { document.getElementById("view-table")?.classList.toggle("active", this.state.viewMode === "table"); document.getElementById("view-kanban")?.classList.toggle("active", this.state.viewMode === "kanban"); }
  renderKanban() {
    const container = document.getElementById("kanban-container");
    if (!container) return;
    container.style.display = "flex";
    document.getElementById("table-container")?.style.setProperty("display", "none");
    document.getElementById("crm-pagination")?.style.setProperty("display", "none");
    container.innerHTML = STAGE_LIST.map(stage => {
      const stageLeads = this.state.filteredLeads.filter(l => this.leadStage(l) === stage.id);
      const total = stageLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
      return `<div class="kanban-column" data-stage="${stage.id}">
        <div class="kanban-header" style="border-left: 4px solid ${stage.color}">
          <span class="kanban-title">${this.escapeHtml(stage.title)}</span>
          <span class="kanban-count">${stageLeads.length}</span>
        </div>
        ${total > 0 ? `<div class="kanban-total">R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>` : ""}
        <div class="kanban-list" data-stage="${stage.id}">
          ${stageLeads.length ? stageLeads.map(lead => this.getKanbanCardHTML(lead)).join("") : `<div class="kanban-empty">Arraste leads para cá</div>`}
        </div>
      </div>`;
    }).join("");
    this.attachKanbanEvents(container);
  }
  getKanbanCardHTML(lead) {
    const rawId = this.idOf(lead);
    const id = this.escapeHtml(rawId);
    const isSelected = this.state.selectedIds.has(rawId);
    const tags = this.allLeadTags(lead).slice(0, 3).map(t => `<span class="tag tag-muted">${this.escapeHtml(t)}</span>`).join("");
    return `<div class="kanban-card ${isSelected ? "selected" : ""}" data-id="${id}" draggable="true">
      <div class="kanban-card-top">
        <input type="checkbox" class="kanban-select" value="${id}" title="Selecionar" ${isSelected ? "checked" : ""}>
        <div class="kanban-card-name">${this.escapeHtml(lead.name || "Sem nome")}</div>
      </div>
      <div class="kanban-card-meta">
        <span>${this.escapeHtml(lead.phone || "-")}</span>
        <span>${this.escapeHtml(lead.category || leadGroups(lead).join(", ") || "-")}</span>
      </div>
      <div class="kanban-card-tags">
        ${this.aiStatusTagHTML(lead)}
        <span class="tag" style="background: ${this.getSourceColor(lead.source)}">${this.escapeHtml(this.formatSource(lead.source))}</span>
        ${lead.value ? `<span class="tag" style="background: #22c55e">R$ ${Number(lead.value).toLocaleString("pt-BR")}</span>` : ""}
        ${tags}
        ${this.typeBadgeHTML(lead)}
        ${this.leadScoreTagHTML(lead)}
      </div>
      ${this.aiIntelligencePreviewHTML(lead)}
      <div class="kanban-card-actions">
        <button type="button" class="btn btn-sm btn-secondary kanban-act-view" data-id="${id}">Ver</button>
        ${this.communicationActionsHTML(lead, rawId, true)}
        <button type="button" class="btn btn-sm btn-secondary kanban-act-bl" data-id="${id}">${lead.blacklisted ? "Tirar da Black list" : "Black list"}</button>
        <button type="button" class="btn btn-sm btn-secondary kanban-act-move" data-id="${id}">Mover</button> <button type="button" class="btn btn-sm btn-secondary kanban-act-type" data-id="${id}">Marcar como...</button>
      </div>
    </div>`;
  }
  aiStatusText(lead) {
    const intel = lead?.aiIntelligence || lead?.aiQualification || {};
    const status = String(intel.status || (intel.qualified ? "qualified" : ""));
    const labels = { qualified: "Qualificado", nurture: "Nutrição · sem orçamento", in_qualification: "Em qualificação", not_qualified: "Não qualificado" };
    return labels[status] || "";
  }
  aiModeLabel(lead) {
    const mode = lead?.aiIntelligence?.analysisMode || (lead?.aiIntelligence?.source === "i9Hub-ai-observer" ? "observe_only" : "");
    return mode === "observe_only" ? "👁️ IA Observador" : "🤖 IA Atendimento";
  }
  aiStatusBadgeHTML(lead) {
    const intel = lead?.aiIntelligence || lead?.aiQualification || {};
    const label = this.aiStatusText(lead);
    if (!label) return "";
    const confidence = Number(intel.confidence);
    const confidenceText = Number.isFinite(confidence) && confidence > 0 ? ` · ${Math.round(confidence * 100)}%` : "";
    const modeText = this.aiModeLabel(lead);
    return ` <span class="badge" title="${this.escapeHtml(intel.summary || intel.reason || "Inteligência Comercial da IA")}">${modeText} · ${this.escapeHtml(label + confidenceText)}</span>`;
  }
  aiStatusTagHTML(lead) {
    const intel = lead?.aiIntelligence || lead?.aiQualification || {};
    const label = this.aiStatusText(lead);
    if (!label) return "";
    const confidence = Number(intel.confidence);
    const confidenceText = Number.isFinite(confidence) && confidence > 0 ? ` · ${Math.round(confidence * 100)}%` : "";
    const modeText = this.aiModeLabel(lead);
    return `<span class="tag tag-ai" title="${this.escapeHtml(intel.summary || intel.reason || "Inteligência Comercial da IA")}">${modeText} · ${this.escapeHtml(label + confidenceText)}</span>`;
  }
  aiIntelligencePreviewHTML(lead) {
    const intel = lead?.aiIntelligence || {};
    const summary = String(intel.exactRequest || intel.summary || intel.need || "").trim();
    const budget = String(intel.budget || "").trim();
    if (!summary && !budget) return "";
    return `<div style="font-size:11px;line-height:1.4;color:var(--text-muted);margin:6px 0;white-space:normal;overflow-wrap:anywhere">${summary ? `<div><strong>IA:</strong> ${this.escapeHtml(summary.slice(0, 180))}${summary.length > 180 ? "…" : ""}</div>` : ""}${budget ? `<div><strong>Orçamento:</strong> ${this.escapeHtml(budget.slice(0, 100))}</div>` : ""}</div>`;
  }
  leadScoreBadgeHTML(lead) {
    const score = lead?._i9Score || scoreLead(lead, this.state.leadScoring);
    const title = `${score.status}. ${score.activeSignals.map((signal) => `${signal.label}: ${signal.points > 0 ? "+" : ""}${signal.points}`).join("; ") || "Ainda sem sinais de pontuação."}`;
    const palette = score.blocked ? ["#fee2e2", "#991b1b"] : score.hot ? ["#dcfce7", "#166534"] : score.qualified ? ["#ede9fe", "#5b21b6"] : score.score >= 30 ? ["#fef3c7", "#92400e"] : ["#f3f4f6", "#374151"];
    return `<span class="badge" title="${this.escapeHtml(title)}" style="display:inline-flex;align-items:center;gap:4px;background:${palette[0]};color:${palette[1]};white-space:normal">${score.score}/100 · ${this.escapeHtml(score.status)}</span>`;
  }
  leadScoreTagHTML(lead) {
    const score = lead?._i9Score || scoreLead(lead, this.state.leadScoring);
    const palette = score.blocked ? ["#fee2e2", "#991b1b"] : score.hot ? ["#dcfce7", "#166534"] : score.qualified ? ["#ede9fe", "#5b21b6"] : ["#f3f4f6", "#374151"];
    return `<span class="tag" title="Pontuação comercial explicável" style="background:${palette[0]};color:${palette[1]}">Score ${score.score}/100</span>`;
  }
  typeBadgeHTML(lead) {
    const type = normalizeType(lead?.tipo);
    const meta = TYPE_META[type] || TYPE_META.a_classificar;
    const reason = lead?.tipoMotivo || meta.description;
    const manual = lead?.tipoManual === true ? " · Manual" : "";
    return `<span class="badge type-badge ${meta.badge}" title="${this.escapeHtml(reason + manual)}"><i class="fas ${meta.icon}"></i> ${this.escapeHtml(meta.label)}${manual}</span>`;
  }

  showTypeModal(target = null, selectedIds = null) {
    const ids = selectedIds ? [...selectedIds].map(String) : [this.idOf(target)];
    const leads = ids.map((id) => this.findLead(id)).filter(Boolean);
    if (!leads.length) { this.app.showToast("Nenhum lead selecionado.", "warning"); return; }
    const bulk = leads.length > 1;
    const modal = document.createElement("div");
    modal.className = "modal-overlay open";
    modal.innerHTML = `<div class="modal">
      <div class="modal-header"><h3 class="modal-title"><i class="fas fa-tags"></i> Marcar como...</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <p>${bulk ? `<strong>${leads.length}</strong> contatos selecionados.` : `Contato: <strong>${this.escapeHtml(leads[0].name || leads[0].phone || "Sem nome")}</strong>`}</p>
        <p class="text-muted" style="margin:8px 0 14px">A marcação é manual e terá prioridade sobre a classificação automática.</p>
        <div class="type-choice-grid">
          ${TYPE_VALUES.map((type) => {
            const meta = TYPE_META[type];
            return `<button type="button" class="btn btn-secondary type-choice ${meta.badge}" data-type="${type}"><i class="fas ${meta.icon}"></i> ${this.escapeHtml(meta.label)}</button>`;
          }).join("")}
        </div>
        <div style="margin-top:12px;text-align:right"><button type="button" class="btn btn-ghost" id="type-auto"><i class="fas fa-magic"></i> Voltar para classificação automática</button></div>
      </div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector(".modal-close")?.addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    modal.querySelector("#type-auto")?.addEventListener("click", async () => {
      close();
      const r = bulk ? await this.app.api.resetLeadsType(leads.map((l) => this.idOf(l))) : await this.app.api.resetLeadType(this.idOf(leads[0]));
      if (!r.success) { this.app.showToast(r.error || "Não foi possível voltar ao automático.", "error"); return; }
      await this.loadLeads(); this.renderCurrentView();
      this.app.showToast(`${bulk ? leads.length + " contatos" : "Contato"} voltou a ser classificado automaticamente.`, "success");
    });
    modal.querySelectorAll(".type-choice").forEach((btn) => btn.addEventListener("click", async () => {
      const tipo = normalizeType(btn.dataset.type);
      close();
      const idsToUpdate = leads.map((l) => this.idOf(l));
      const r = bulk
        ? await this.app.api.updateLeadsType(idsToUpdate, tipo)
        : await this.app.api.updateLeadType(idsToUpdate[0], tipo);
      if (!r.success) { this.app.showToast(r.error || "Não foi possível atualizar o tipo.", "error"); return; }

      if (tipo === "spam") {
        const items = leads
          .map((l) => ({ phone: l.phone, name: l.name }))
          .filter((x) => String(x.phone || "").replace(/\D/g, "").length >= 10);
        if (items.length) {
          const label = bulk ? `${items.length} contatos` : (leads[0].name || leads[0].phone || "este contato");
          if (confirm(`"${label}" foi marcado como Spam.\n\nDeseja também enviar ${bulk ? "esses contatos" : "este número"} para a Black List?\n\nIsso impede o recebimento de campanhas. A Black List só será alterada porque você confirmou agora.`)) {
            const br = await this.app.api.blacklistAdd(items, "crm");
            if (!br.success) this.app.showToast(br.error || "O tipo foi salvo, mas a Black List não foi atualizada.", "warning", 7000);
          }
        }
      }
      await this.loadLeads();
      this.renderCurrentView();
      this.app.showToast(`${bulk ? leads.length + " contatos" : "Contato"} marcado${bulk ? "s" : ""} como ${TYPE_META[tipo].label}.`, "success");
    }));
  }

  findLead(id) { return this.state.leads.find(l => this.idOf(l) === String(id)); }
  attachKanbanEvents(container) {
    this.bindBlacklistButtons();
    const canMoveStages = !!(this.app.state?.get?.("license")?.licensed && this.app.state?.get?.("license")?.entitlementsConfigured);
    container.querySelectorAll(".kanban-card").forEach(card => {
      if (canMoveStages) {
        card.draggable = true;
        card.addEventListener("dragstart", (e) => { card.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", card.dataset.id); });
        card.addEventListener("dragend", () => { card.classList.remove("dragging"); container.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over")); });
      } else {
        card.draggable = false;
        card.title = "Movimentação entre estágios disponível na versão licenciada";
      }
      card.addEventListener("click", (e) => { if (e.target.closest("button, input")) return; const lead = this.findLead(card.dataset.id); if (lead) this.app.leadModal.show(lead); });
    });
    container.querySelectorAll(".kanban-select").forEach(cb => cb.addEventListener("change", (e) => {
      const id = e.target.value;
      if (e.target.checked) this.state.selectedIds.add(id); else this.state.selectedIds.delete(id);
      e.target.closest(".kanban-card")?.classList.toggle("selected", e.target.checked);
      this.updateExportButtons();
    }));
    container.querySelectorAll(".kanban-act-view").forEach(btn => btn.addEventListener("click", () => { const lead = this.findLead(btn.dataset.id); if (lead) this.app.leadModal.show(lead); }));
    container.querySelectorAll(".kanban-act-wa").forEach(btn => btn.addEventListener("click", (event) => { event.stopPropagation(); const lead = this.findLead(btn.dataset.id); if (lead) this.openLeadWhatsApp(lead); }));
    container.querySelectorAll(".kanban-act-email").forEach(btn => btn.addEventListener("click", (event) => { event.stopPropagation(); const lead = this.findLead(btn.dataset.id); if (lead) this.openLeadEmail(lead); }));
    container.querySelectorAll(".kanban-act-move").forEach(btn => btn.addEventListener("click", () => {
      if (!canMoveStages) { this.app.showToast("Movimentação entre estágios disponível na versão licenciada.", "warning"); return; }
      const lead = this.findLead(btn.dataset.id); if (lead) this.showStageModal(lead);
    }));
    container.querySelectorAll(".kanban-act-type").forEach(btn => btn.addEventListener("click", () => { const lead = this.findLead(btn.dataset.id); if (lead) this.showTypeModal(lead); }));
    if (canMoveStages) {
      container.querySelectorAll(".kanban-list").forEach(list => {
        list.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; list.classList.add("drag-over"); });
        list.addEventListener("dragleave", (e) => { if (!list.contains(e.relatedTarget)) list.classList.remove("drag-over"); });
        list.addEventListener("drop", async (e) => {
          e.preventDefault(); list.classList.remove("drag-over");
          const leadId = e.dataTransfer.getData("text/plain");
          if (leadId) await this.moveLeadStage(leadId, list.dataset.stage);
        });
      });
    }
  }
  async moveLeadStage(leadId, newStage) {
    const lead = this.findLead(leadId);
    if (!lead) { this.app.showToast("Lead não encontrado", "error"); return; }
    const oldStage = this.leadStage(lead);
    if (oldStage === newStage) return;
    const keep = new Set(this.state.selectedIds);
    lead.stage = newStage; lead.updatedAt = new Date().toISOString();
    try {
      const res = await this.app.api.updateLeadStage(this.idOf(lead), newStage);
      if (res.success) {
        this.app.showToast(`Lead movido para ${this.formatStage(newStage)}`, "success");
      } else {
        lead.stage = oldStage; this.app.showToast(res.error || "Erro ao mover lead", "error");
      }
    } catch (error) { lead.stage = oldStage; this.app.showToast("Erro: " + error.message, "error"); }
    this.applyFilters();
    this.state.selectedIds = new Set([...keep].filter(id => this.state.filteredLeads.some(l => this.idOf(l) === id)));
    this.renderCurrentView(); this.updateExportButtons();
  }
 updateStats() { const total = this.state.leads.length; const qualifiedLeads = this.state.leads.filter(l => l._i9Score?.qualified).length; const hotLeads = this.state.leads.filter(l => l._i9Score?.hot).length; const opportunityCount = this.state.leads.filter(l => l.opportunity === true).length; const today = new Date().toISOString().split("T")[0]; const todayCount = this.state.leads.filter(l => l.extractedAt?.startsWith(today)).length; const whatsappCount = this.state.leads.filter(l => l.phone && l.phone.length >= 10).length; const emailCount = this.state.leads.filter(l => l.email && l.email.includes("@")).length; const totalValue = this.state.leads.reduce((sum, l) => sum + (Number(l.value) || 0), 0); const counts = Object.fromEntries(TYPE_VALUES.map(t => [t, this.state.leads.filter(l => normalizeType(l.tipo) === t).length])); document.getElementById("stat-total").textContent = total; document.getElementById("stat-opportunities").textContent = opportunityCount; document.getElementById("stat-today").textContent = todayCount; document.getElementById("stat-whatsapp").textContent = whatsappCount; document.getElementById("stat-email").textContent = emailCount; document.getElementById("stat-value").textContent = "R$ " + totalValue.toLocaleString("pt-BR", {minimumFractionDigits: 2}); TYPE_VALUES.forEach(t => { const el = document.getElementById("stat-type-" + t); if (el) el.textContent = counts[t] || 0; }); const qualifiedEl = document.getElementById("stat-qualified-leads"); if (qualifiedEl) qualifiedEl.textContent = qualifiedLeads; const hotEl = document.getElementById("stat-hot-leads"); if (hotEl) hotEl.textContent = hotLeads; }
 async loadCommunicationMetrics() {
   const result = await this.app.api.getCrmCommunicationMetrics();
   if (!result?.success) return;
   const metrics = result.data || {};
   this.state.communicationMetrics = metrics;
   const values = { 'comm-stat-whatsapp': metrics.whatsappOpened, 'comm-stat-sent': metrics.emailSent, 'comm-stat-replies': metrics.emailReplies, 'comm-stat-failed': metrics.emailFailed, 'comm-stat-uncertain': metrics.emailUncertain, 'comm-stat-optouts': metrics.emailOptOuts };
   for (const [id, value] of Object.entries(values)) { const element = document.getElementById(id); if (element) element.textContent = Number(value) || 0; }
 }
 showCommunicationMetrics() {
   const metrics = this.state.communicationMetrics || {};
   const rows = (Array.isArray(metrics.bySeller) ? metrics.bySeller : []).map((item) => `<tr><td>${this.escapeHtml(item.sellerName || 'Sem vendedor')}</td><td>${Number(item.whatsappOpened) || 0}</td><td>${Number(item.emailSent) || 0}</td><td>${Number(item.emailReplies) || 0}</td><td>${Number(item.emailFailed) || 0}</td></tr>`).join('');
   const modal = document.createElement('div'); modal.className = 'modal-overlay open';
   modal.innerHTML = `<div class="modal modal-lg"><div class="modal-header"><h3 class="modal-title"><i class="fas fa-chart-column"></i> Indicadores de comunicação</h3><button class="modal-close">&times;</button></div><div class="modal-body"><p class="text-muted">Contagens de ações registradas no histórico local do CRM. Abrir WhatsApp não significa que uma mensagem foi enviada; resposta de e-mail só aparece após sincronização manual.</p><div class="crm-communication-summary"><div><strong>${Number(metrics.whatsappOpened) || 0}</strong><span>Conversas abertas</span></div><div><strong>${Number(metrics.emailSent) || 0}</strong><span>E-mails enviados</span></div><div><strong>${Number(metrics.emailReplies) || 0}</strong><span>Respostas recebidas</span></div><div><strong>${Number(metrics.emailFailed) || 0}</strong><span>Falhas</span></div><div><strong>${Number(metrics.emailUncertain) || 0}</strong><span>Envios incertos</span></div><div><strong>${Number(metrics.emailOptOuts) || 0}</strong><span>Descadastros</span></div></div><h4>Desempenho por vendedor</h4><div class="table-responsive"><table class="table"><thead><tr><th>Vendedor</th><th>WhatsApp</th><th>E-mails</th><th>Respostas</th><th>Falhas</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Ainda não há atividade registrada.</td></tr>'}</tbody></table></div><small class="text-muted">Atualizado em ${this.escapeHtml(metrics.generatedAt ? new Date(metrics.generatedAt).toLocaleString('pt-BR') : '—')}.</small></div></div>`;
   document.body.appendChild(modal);
   modal.querySelector('.modal-close')?.addEventListener('click', () => modal.remove());
   modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });
 }
 updatePagination() { const totalPages = Math.ceil(this.state.filteredLeads.length / this.state.pageSize); document.getElementById("page-info").textContent = `Pagina ${this.state.currentPage} de ${totalPages || 1}`; document.getElementById("prev-page").disabled = this.state.currentPage <= 1; document.getElementById("next-page").disabled = this.state.currentPage >= totalPages; } bindEvents() { document.getElementById("btn-manage-stages")?.addEventListener("click", () => this.showStageManager()); document.getElementById("btn-manage-niches")?.addEventListener("click", () => this.showNicheManager()); document.getElementById("btn-manage-lead-score")?.addEventListener("click", () => this.showLeadScoringManager()); document.getElementById("btn-niche-optimization")?.addEventListener("click", () => this.showNicheOptimization()); document.getElementById("btn-followups")?.addEventListener("click", () => this.app.router.navigate("followups")); document.getElementById("btn-communication-metrics")?.addEventListener("click", () => this.showCommunicationMetrics()); document.getElementById("btn-sync-private")?.addEventListener("click", () => this.syncPrivateOpportunities()); document.getElementById("btn-bulk-type")?.addEventListener("click", () => this.showTypeModal(null, this.state.selectedIds)); document.getElementById("btn-blacklist")?.addEventListener("click", () => this.showBlacklistManager()); document.getElementById("btn-sync-labels")?.addEventListener("click", () => this.syncLabels()); document.getElementById("btn-labels-diag")?.addEventListener("click", () => this.showLabelDiagnostic()); document.getElementById("filter-search")?.addEventListener("input", this.debounce(() => this.applyFilters(), 300)); document.getElementById("filter-source")?.addEventListener("change", () => this.applyFilters()); document.getElementById("filter-category")?.addEventListener("change", () => this.applyFilters()); document.getElementById("filter-stage")?.addEventListener("change", () => this.applyFilters()); document.getElementById("filter-type")?.addEventListener("change", () => this.applyFilters()); document.getElementById("filter-qualification")?.addEventListener("change", () => this.applyFilters()); document.getElementById("filter-niche")?.addEventListener("change", () => this.applyFilters()); document.getElementById("filter-group")?.addEventListener("change", () => this.applyFilters()); document.getElementById("filter-tag")?.addEventListener("change", () => this.applyFilters()); document.getElementById("btn-use-wa")?.addEventListener("click", () => this.useInCampaign("wa")); document.getElementById("view-table")?.addEventListener("click", () => this.switchView("table")); document.getElementById("view-kanban")?.addEventListener("click", () => this.switchView("kanban")); document.getElementById("select-all")?.addEventListener("change", (e) => { const checkboxes = document.querySelectorAll(".lead-checkbox"); checkboxes.forEach(cb => { cb.checked = e.target.checked; const id = cb.value; if (e.target.checked) this.state.selectedIds.add(id); else this.state.selectedIds.delete(id); cb.closest("tr")?.classList.toggle("selected", e.target.checked); }); this.updateExportButtons(); }); document.getElementById("prev-page")?.addEventListener("click", () => { if (this.state.currentPage > 1) { this.state.currentPage--; this.renderCurrentView(); this.updatePagination(); } }); document.getElementById("next-page")?.addEventListener("click", () => { const totalPages = Math.ceil(this.state.filteredLeads.length / this.state.pageSize); if (this.state.currentPage < totalPages) { this.state.currentPage++; this.renderCurrentView(); this.updatePagination(); } }); document.getElementById("btn-export-csv")?.addEventListener("click", async () => { const leadsToExport = this.state.selectedIds.size > 0 ? this.state.filteredLeads.filter(l => this.state.selectedIds.has(l.id || l.placeId || l.phone)) : this.state.filteredLeads; if (leadsToExport.length === 0) { this.app.showToast("Nenhum lead para exportar", "warning"); return; } const res = await this.app.api.exportCSV(leadsToExport, `leads_${new Date().toISOString().split("T")[0]}.csv`); if (res.success) { this.app.showToast(`${leadsToExport.length} leads exportados!`, "success"); } else { this.app.showToast(res.error || "Erro ao exportar", "error"); if (res.error?.includes("Pro")) this.app.showUpgradeModal(); } }); document.getElementById("btn-export-webhook")?.addEventListener("click", async () => { const leadsToExport = this.state.selectedIds.size > 0 ? this.state.filteredLeads.filter(l => this.state.selectedIds.has(l.id || l.placeId || l.phone)) : this.state.filteredLeads; if (leadsToExport.length === 0) { this.app.showToast("Nenhum lead para exportar", "warning"); return; } const res = await this.app.api.exportWebhook(leadsToExport); if (res.success) { this.app.showToast(`${leadsToExport.length} leads enviados via Webhook!`, "success"); } else { this.app.showToast(res.error || "Erro no webhook", "error"); if (res.error?.includes("Pro")) this.app.showUpgradeModal(); } }); document.getElementById("btn-clear-leads")?.addEventListener("click", async () => { if (!confirm("Tem certeza que deseja remover TODOS os leads salvos?")) return; await this.app.api.sendMessage("CLEAR_ALL_LEADS"); this.state.leads = []; this.applyFilters(); this.app.showToast("Todos os leads foram removidos", "success"); }); this.updateExportButtons(); } switchView(mode) { this.state.viewMode = mode; this.markActiveView(); const tbl = document.getElementById("table-container"); const kan = document.getElementById("kanban-container"); const pag = document.getElementById("crm-pagination"); if (tbl) tbl.style.display = mode === "table" ? "block" : "none"; if (kan) kan.style.display = mode === "kanban" ? "flex" : "none"; if (pag) pag.style.display = mode === "table" ? "flex" : "none"; if (mode === "kanban") this.renderKanban(); else this.renderTable(); } attachRowEventListeners() { this.bindBlacklistButtons(); document.querySelectorAll(".lead-checkbox").forEach(cb => { cb.addEventListener("change", (e) => { const id = e.target.value; const row = e.target.closest("tr"); if (e.target.checked) { this.state.selectedIds.add(id); row?.classList.add("selected"); } else { this.state.selectedIds.delete(id); row?.classList.remove("selected"); } this.updateExportButtons(); this.updateSelectAllCheckbox(); }); }); document.querySelectorAll(".btn-open-wa").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); const lead = this.findLead(e.currentTarget.dataset.id); if (lead) this.openLeadWhatsApp(lead); })); document.querySelectorAll(".btn-send-email").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); const lead = this.findLead(e.currentTarget.dataset.id); if (lead) this.openLeadEmail(lead); })); document.querySelectorAll(".btn-view").forEach(btn => { btn.addEventListener("click", (e) => { const id = e.currentTarget.dataset.id; const lead = this.state.leads.find(l => (l.id || l.placeId || l.phone) === id); if (lead) this.app.leadModal.show(lead); }); }); document.querySelectorAll(".btn-copy-phone").forEach(btn => { btn.addEventListener("click", (e) => { const phone = e.currentTarget.dataset.phone; if (phone && phone !== "-") { navigator.clipboard.writeText(phone); this.app.showToast("Telefone copiado!", "success"); } }); }); document.querySelectorAll(".btn-edit-stage").forEach(btn => { btn.addEventListener("click", (e) => { const id = e.currentTarget.dataset.id; const lead = this.state.leads.find(l => (l.id || l.placeId || l.phone) === id); if (lead) this.showStageModal(lead); }); });
    document.querySelectorAll(".btn-type").forEach(btn => { btn.addEventListener("click", (e) => { const id = e.currentTarget.dataset.id; const lead = this.findLead(id); if (lead) this.showTypeModal(lead); }); }); document.querySelectorAll(".btn-delete").forEach(btn => { btn.addEventListener("click", async (e) => { const id = e.currentTarget.dataset.id; if (!confirm("Excluir este lead?")) return; this.state.leads = this.state.leads.filter(l => (l.id || l.placeId || l.phone) !== id); await this.app.api.deleteLead(id); this.applyFilters(); this.app.showToast("Lead removido", "success"); }); }); } updateExportButtons() { const hasSelection = this.state.selectedIds.size > 0 || this.state.filteredLeads.length > 0; document.getElementById("btn-export-csv").disabled = !hasSelection; document.getElementById("btn-export-webhook").disabled = !hasSelection; const bulk = document.getElementById("btn-bulk-type"); if (bulk) bulk.disabled = this.state.selectedIds.size === 0; } updateSelectAllCheckbox() { const checkboxes = document.querySelectorAll(".lead-checkbox"); const allChecked = checkboxes.length > 0 && [...checkboxes].every(cb => cb.checked); const selectAll = document.getElementById("select-all"); if (selectAll) selectAll.checked = allChecked; } showStageModal(lead) {
    const canMoveStages = !!(this.app.state?.get?.("license")?.licensed && this.app.state?.get?.("license")?.entitlementsConfigured);
    if (!canMoveStages) { this.app.showToast("Movimentação entre estágios disponível na versão licenciada.", "warning"); return; }
    const stages = STAGE_LIST.map(st => st.id); const modal = document.createElement("div"); modal.className = "modal-overlay open"; modal.innerHTML = `<div class="modal"> <div class="modal-header"><h3 class="modal-title">Mover Estagio</h3><button class="modal-close">&times;</button></div> <div class="modal-body"> <p>Mover <strong>${this.escapeHtml(lead.name)}</strong> para:</p> <div class="btn-group" style="flex-direction: column; gap: 8px; max-height: 60vh; overflow: auto;"> ${stages.map(s => `<button class="btn btn-${s === lead.stage ? 'primary' : 'secondary'} stage-btn" data-stage="${this.escapeHtml(s)}\">${this.escapeHtml(this.formatStage(s))}</button>`).join("")} </div> </div> </div>`; document.body.appendChild(modal); modal.querySelectorAll(".stage-btn").forEach(btn => { btn.addEventListener("click", async () => { const newStage = btn.dataset.stage; modal.remove(); await this.moveLeadStage(lead.id || lead.placeId || lead.phone, newStage); }); }); modal.querySelector(".modal-close")?.addEventListener("click", () => modal.remove()); modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); }); }
  async showStageManager() {
    const response = await this.app.api.getStages();
    if (!response?.success) { this.app.showToast(response?.error || 'Não foi possível carregar as etapas.', 'error'); return; }
    const data = response.data || {};
    const config = data.config || { overrides: {}, custom: [] };
    const systemIds = new Set(['novo', 'contatado', 'qualificado', 'proposta', 'fechado', 'perdido', 'blacklist']);
    const systemStages = (data.stages || STAGE_LIST).filter((stage) => systemIds.has(stage.id));
    const profileStages = (data.stages || STAGE_LIST).filter((stage) => !systemIds.has(stage.id) && !stage.isCustom && stage.source !== 'whatsapp_label' && !String(stage.id).startsWith('wl_'));
    const modal = document.createElement('div'); modal.className = 'modal-overlay open';
    modal.innerHTML = `<div class="modal modal-lg"><div class="modal-header"><h3 class="modal-title"><i class="fas fa-stream"></i> Gerenciar etapas do CRM</h3><button class="modal-close" aria-label="Fechar">&times;</button></div><div class="modal-body">
      <p class="text-muted">Personalize os nomes das etapas principais e crie etapas próprias. Os IDs internos são preservados para proteger o histórico e as automações.</p>
      <h4>Etapas principais</h4><div class="crm-stage-system-list">${systemStages.map((stage) => `<div class="crm-stage-row" data-stage-kind="system" data-stage-id="${this.escapeHtml(stage.id)}"><label>Nome<input class="form-input" data-stage-title value="${this.escapeHtml(stage.title)}" maxlength="80"></label><label>Cor<input type="color" data-stage-color value="${this.escapeHtml(stage.color || '#6366f1')}"></label><span class="badge">Sistema</span></div>`).join('')}</div>
      ${profileStages.length ? `<h4>Etapas vinculadas a outras configurações</h4><p class="text-muted">Estas etapas são gerenciadas por configurações existentes e permanecem protegidas nesta tela.</p><div class="crm-stage-locked-list">${profileStages.map((stage) => `<span class="badge">${this.escapeHtml(stage.title)}</span>`).join(' ')}</div>` : ''}
      <h4 style="margin-top:18px">Etapas personalizadas</h4><p class="text-muted">Você pode criar várias etapas e reordená-las. Para excluir uma etapa que contém leads, o i9Hub pedirá um destino para transferi-los.</p>
      <div id="crm-custom-stage-list">${(config.custom || []).map((stage) => `<div class="crm-stage-row crm-stage-custom-row" data-stage-kind="custom" data-stage-id="${this.escapeHtml(stage.id)}"><label>Nome<input class="form-input" data-stage-title value="${this.escapeHtml(stage.title)}" maxlength="80"></label><label>Cor<input type="color" data-stage-color value="${this.escapeHtml(stage.color || '#6366f1')}"></label><div class="crm-stage-row-actions"><button type="button" class="btn btn-sm btn-secondary" data-action="stage-up" title="Mover para cima"><i class="fas fa-arrow-up"></i></button><button type="button" class="btn btn-sm btn-secondary" data-action="stage-down" title="Mover para baixo"><i class="fas fa-arrow-down"></i></button><button type="button" class="btn btn-sm btn-danger" data-action="stage-delete" data-stage-id="${this.escapeHtml(stage.id)}">Excluir</button></div></div>`).join('')}</div>
      <div class="crm-stage-add"><h4>Adicionar etapa</h4><div class="form-row"><label>Nome<input class="form-input" id="crm-new-stage-title" maxlength="80" placeholder="Ex.: Aguardando documentos"></label><label>Cor<input class="form-input" id="crm-new-stage-color" type="color" value="#6366f1"></label><button type="button" class="btn btn-secondary" id="crm-add-stage"><i class="fas fa-plus"></i> Adicionar</button></div></div>
      </div><div class="modal-footer"><button type="button" class="btn btn-secondary modal-close">Cancelar</button><button type="button" class="btn btn-primary" id="crm-save-stages"><i class="fas fa-save"></i> Salvar alterações</button></div></div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelectorAll('.modal-close').forEach((button) => button.addEventListener('click', close));
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.querySelector('#crm-add-stage')?.addEventListener('click', () => {
      const titleInput = modal.querySelector('#crm-new-stage-title'); const colorInput = modal.querySelector('#crm-new-stage-color');
      const title = String(titleInput?.value || '').trim();
      if (!title) { this.app.showToast('Informe o nome da nova etapa.', 'warning'); titleInput?.focus(); return; }
      const list = modal.querySelector('#crm-custom-stage-list');
      const duplicate = [...modal.querySelectorAll('[data-stage-title]')].some((input) => input.value.trim().toLocaleLowerCase('pt-BR') === title.toLocaleLowerCase('pt-BR'));
      if (duplicate) { this.app.showToast('Já existe uma etapa com esse nome.', 'warning'); return; }
      const id = `crm_${title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32) || 'etapa'}_${Math.random().toString(36).slice(2, 7)}`;
      list.insertAdjacentHTML('beforeend', `<div class="crm-stage-row crm-stage-custom-row" data-stage-kind="custom" data-stage-id="${this.escapeHtml(id)}"><label>Nome<input class="form-input" data-stage-title value="${this.escapeHtml(title)}" maxlength="80"></label><label>Cor<input type="color" data-stage-color value="${this.escapeHtml(colorInput?.value || '#6366f1')}"></label><div class="crm-stage-row-actions"><button type="button" class="btn btn-sm btn-secondary" data-action="stage-up" title="Mover para cima"><i class="fas fa-arrow-up"></i></button><button type="button" class="btn btn-sm btn-secondary" data-action="stage-down" title="Mover para baixo"><i class="fas fa-arrow-down"></i></button><button type="button" class="btn btn-sm btn-danger" data-action="stage-delete" data-stage-id="${this.escapeHtml(id)}">Excluir</button></div></div>`);
      titleInput.value = '';
    });
    modal.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action="stage-up"], [data-action="stage-down"], [data-action="stage-delete"]'); if (!button) return;
      const row = button.closest('.crm-stage-custom-row'); if (!row) return;
      if (button.dataset.action === 'stage-up') { const prev = row.previousElementSibling; if (prev) row.parentElement.insertBefore(row, prev); return; }
      if (button.dataset.action === 'stage-down') { const next = row.nextElementSibling; if (next) row.parentElement.insertBefore(next, row); return; }
      if (!(config.custom || []).some((stage) => stage.id === row.dataset.stageId)) { row.remove(); return; }
      await this.confirmDeleteCrmStage(row.dataset.stageId, modal);
    });
    modal.querySelector('#crm-save-stages')?.addEventListener('click', async () => {
      const overrides = { ...(config.overrides || {}) };
      for (const row of modal.querySelectorAll('[data-stage-kind="system"]')) {
        const id = row.dataset.stageId; const title = row.querySelector('[data-stage-title]')?.value.trim(); const color = row.querySelector('[data-stage-color]')?.value;
        if (!title) { this.app.showToast('O nome de uma etapa principal não pode ficar vazio.', 'warning'); return; }
        overrides[id] = { title, color };
      }
      const custom = [...modal.querySelectorAll('.crm-stage-custom-row')].map((row, order) => ({ id: row.dataset.stageId, title: row.querySelector('[data-stage-title]')?.value.trim(), color: row.querySelector('[data-stage-color]')?.value, order }));
      if (custom.some((stage) => !stage.title)) { this.app.showToast('Todas as etapas personalizadas precisam de um nome.', 'warning'); return; }
      const result = await this.app.api.saveCrmStageConfig({ ...config, overrides, custom, updatedAt: new Date().toISOString() });
      if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível salvar as etapas.', 'error', 6000); return; }
      await refreshStages(this.app.api); close(); await this.loadLeads(); this.app.showToast('Funil comercial atualizado.', 'success');
    });
  }
  async confirmDeleteCrmStage(stageId, managerModal) {
    const leadCount = this.state.leads.filter((lead) => lead.stage === stageId).length;
    const choices = STAGE_LIST.filter((stage) => stage.id !== stageId);
    const modal = document.createElement('div'); modal.className = 'modal-overlay open';
    modal.innerHTML = `<div class="modal"><div class="modal-header"><h3 class="modal-title">Remover etapa</h3><button class="modal-close">&times;</button></div><div class="modal-body"><p>Deseja remover esta etapa? ${leadCount ? `<strong>${leadCount} lead(s)</strong> estão nela e precisam ser transferidos.` : 'Nenhum lead está nesta etapa.'}</p>${leadCount ? `<label>Transferir leads para<select class="form-select" id="crm-stage-migrate-to">${choices.map((stage) => `<option value="${this.escapeHtml(stage.id)}">${this.escapeHtml(stage.title)}</option>`).join('')}</select></label>` : ''}</div><div class="modal-footer"><button class="btn btn-secondary modal-close">Cancelar</button><button class="btn btn-danger" id="crm-confirm-delete-stage">Remover etapa</button></div></div>`;
    document.body.appendChild(modal); const close = () => modal.remove(); modal.querySelectorAll('.modal-close').forEach((button) => button.addEventListener('click', close)); modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.querySelector('#crm-confirm-delete-stage')?.addEventListener('click', async () => {
      const migrateTo = modal.querySelector('#crm-stage-migrate-to')?.value || '';
      const result = await this.app.api.deleteCrmStage(stageId, migrateTo);
      if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível remover a etapa.', 'error', 6000); return; }
      close(); managerModal.remove(); await refreshStages(this.app.api); await this.loadLeads(); this.app.showToast(`Etapa removida. ${result.data?.migrated || 0} lead(s) transferidos.`, 'success'); this.showStageManager();
    });
  }
  async showLeadScoringManager() {
    const settingsResponse = await this.app.api.getSettings();
    if (settingsResponse && settingsResponse.success === false) {
      this.app.showToast(settingsResponse.error || "Não foi possível carregar a configuração do Lead Score.", "error");
      return;
    }
    const config = normalizeLeadScoringConfig(settingsResponse?.data?.leadScoring || this.state.leadScoring || DEFAULT_LEAD_SCORING_CONFIG);
    const modal = document.createElement("div"); modal.className = "modal-overlay open";
    modal.innerHTML = `<div class="modal modal-lg"><div class="modal-header"><h3 class="modal-title"><i class="fas fa-chart-line"></i> Lead Score e critérios de qualificação</h3><button class="modal-close" aria-label="Fechar">&times;</button></div><div class="modal-body" id="lead-score-manager-body"></div><div class="modal-footer"><button type="button" class="btn btn-secondary modal-close">Cancelar</button><button type="button" class="btn btn-primary" id="lead-score-save"><i class="fas fa-save"></i> Salvar critérios</button></div></div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelectorAll(".modal-close").forEach((button) => button.addEventListener("click", close));
    modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
    const summary = () => ({ total: this.state.leads.length, qualified: this.state.leads.filter((lead) => lead._i9Score?.qualified).length, hot: this.state.leads.filter((lead) => lead._i9Score?.hot).length, blocked: this.state.leads.filter((lead) => lead._i9Score?.blocked).length });
    const s = summary();
    const weightRows = LEAD_SCORE_ACTIONS.map((action) => `<label class="form-label" style="display:grid;grid-template-columns:minmax(0,1fr) 90px;gap:8px;align-items:center;padding:9px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;margin:0"><span><strong>${this.escapeHtml(action.label)}</strong><small style="display:block;color:var(--text-muted);font-weight:400;line-height:1.35;margin-top:3px">${this.escapeHtml(action.description)}</small></span><input class="form-input" type="number" min="-100" max="100" step="1" id="lead-score-weight-${action.key}" value="${config.weights[action.key]}" aria-label="Peso: ${this.escapeHtml(action.label)}"></label>`).join("");
    modal.querySelector("#lead-score-manager-body").innerHTML = `<p class="text-muted">O Lead Score é calculado a partir de sinais disponíveis no CRM e na Inteligência Comercial da IA. Cada peso pode ser ajustado de -100 a +100 pontos. Dados que não foram identificados não são presumidos.</p>
      <div class="crm-taxonomy-summary"><div class="stat-card"><span class="stat-number">${s.total}</span><span class="stat-label">Leads analisados</span></div><div class="stat-card"><span class="stat-number">${s.qualified}</span><span class="stat-label">Qualificados</span></div><div class="stat-card"><span class="stat-number">${s.hot}</span><span class="stat-label">Quentes</span></div><div class="stat-card"><span class="stat-number">${s.blocked}</span><span class="stat-label">Bloqueados</span></div></div>
      <div class="form-row" style="margin-top:16px"><label class="form-label">Ativar Lead Score<select class="form-select" id="lead-score-enabled"><option value="true" ${config.enabled ? "selected" : ""}>Ativado</option><option value="false" ${!config.enabled ? "selected" : ""}>Desativado</option></select></label><label class="form-label">Pontuação mínima para qualificar<input class="form-input" type="number" id="lead-score-qualified-threshold" min="1" max="100" value="${config.qualifiedThreshold}"></label><label class="form-label">Pontuação para lead quente<input class="form-input" type="number" id="lead-score-hot-threshold" min="1" max="100" value="${config.hotThreshold}"></label><label class="form-label">Orçamento mínimo mensal (R$)<input class="form-input" type="number" id="lead-score-min-budget" min="0" max="100000000" step="100" value="${config.minimumMonthlyBudget}"></label></div>
      <h4 style="margin:18px 0 8px">Regras de qualificação</h4><div style="display:grid;gap:8px"><label><input type="checkbox" id="lead-score-require-budget" ${config.requireBudgetMinimum ? "checked" : ""}> Exigir orçamento identificado igual ou superior ao mínimo para qualificar</label><label><input type="checkbox" id="lead-score-require-need" ${config.requireNeed ? "checked" : ""}> Exigir necessidade/pedido identificado</label><label><input type="checkbox" id="lead-score-exclude-spam" ${config.excludeSpam ? "checked" : ""}> Bloquear qualificação de leads identificados como spam</label><label><input type="checkbox" id="lead-score-exclude-blacklist" ${config.excludeBlacklisted ? "checked" : ""}> Bloquear qualificação de contatos na Black list</label><label><input type="checkbox" id="lead-score-exclude-optout" ${config.excludeOptOut ? "checked" : ""}> Bloquear qualificação de contatos que pediram descadastro</label></div>
      <h4 style="margin:20px 0 8px">Pesos por ação</h4><p class="text-muted">Use pontos positivos para sinais de intenção e pontos negativos para sinais de risco. Spam, Black list e descadastro começam com -100 e também podem bloquear a qualificação.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px">${weightRows}</div>
      <div class="btn-group" style="margin-top:18px;justify-content:flex-start;flex-wrap:wrap"><button type="button" class="btn btn-secondary" id="lead-score-view-qualified"><i class="fas fa-filter"></i> Ver leads qualificados</button><button type="button" class="btn btn-secondary" id="lead-score-view-niches"><i class="fas fa-sitemap"></i> Ver nichos e subnichos</button></div>`;
    modal.querySelector("#lead-score-view-qualified")?.addEventListener("click", () => { close(); const filter = document.getElementById("filter-qualification"); if (filter) filter.value = "qualified"; this.applyFilters(); });
    modal.querySelector("#lead-score-view-niches")?.addEventListener("click", () => { close(); this.showNicheManager(); });
    modal.querySelector("#lead-score-save")?.addEventListener("click", async () => {
      const readNumber = (id, fallback) => { const value = Number(modal.querySelector(`#${id}`)?.value); return Number.isFinite(value) ? value : fallback; };
      const weights = Object.fromEntries(LEAD_SCORE_ACTIONS.map((action) => [action.key, readNumber(`lead-score-weight-${action.key}`, config.weights[action.key])]));
      const next = normalizeLeadScoringConfig({
        enabled: modal.querySelector("#lead-score-enabled")?.value !== "false",
        qualifiedThreshold: readNumber("lead-score-qualified-threshold", config.qualifiedThreshold),
        hotThreshold: readNumber("lead-score-hot-threshold", config.hotThreshold),
        minimumMonthlyBudget: readNumber("lead-score-min-budget", config.minimumMonthlyBudget),
        requireBudgetMinimum: modal.querySelector("#lead-score-require-budget")?.checked === true,
        requireNeed: modal.querySelector("#lead-score-require-need")?.checked === true,
        excludeSpam: modal.querySelector("#lead-score-exclude-spam")?.checked === true,
        excludeBlacklisted: modal.querySelector("#lead-score-exclude-blacklist")?.checked === true,
        excludeOptOut: modal.querySelector("#lead-score-exclude-optout")?.checked === true,
        weights,
      });
      if (next.hotThreshold < next.qualifiedThreshold) { this.app.showToast("A pontuação de lead quente precisa ser igual ou maior que a pontuação mínima de qualificação.", "warning"); return; }
      const saved = await this.app.api.saveSettings({ leadScoring: next });
      if (!saved?.success) { this.app.showToast(saved?.error || "Não foi possível salvar o Lead Score.", "error", 7000); return; }
      this.state.leadScoring = next; close(); await this.loadLeads();
      this.app.showToast("Pesos e critérios do Lead Score salvos. A lista foi recalculada.", "success", 6000);
    });
  }

  async showNicheOptimization() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `<div class="modal modal-lg i9-niche-optimization-modal"><div class="modal-header"><h3 class="modal-title"><i class="fas fa-lightbulb"></i> Inteligência de nichos e otimização</h3><button type="button" class="modal-close" aria-label="Fechar">&times;</button></div><div class="modal-body" id="i9-niche-optimization-body"><div class="i9-optimization-loading"><i class="fas fa-spinner fa-spin"></i> Analisando campanhas, nichos e subnichos…</div></div><div class="modal-footer"><button type="button" class="btn btn-secondary modal-close">Fechar</button><button type="button" class="btn btn-secondary" id="i9-niche-optimization-export" disabled><i class="fas fa-file-csv"></i> Exportar análise CSV</button><button type="button" class="btn btn-primary" id="i9-niche-optimization-refresh"><i class="fas fa-rotate"></i> Atualizar análise</button></div></div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelectorAll('.modal-close').forEach((button) => button.addEventListener('click', close));
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    const body = modal.querySelector('#i9-niche-optimization-body');
    let lastAnalysisSummary = null;
    const fmtPct = (value) => `${(Number(value) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
    const fmtNum = (value) => (Number(value) || 0).toLocaleString('pt-BR');
    const refresh = async () => {
      if (!modal.isConnected) return;
      body.innerHTML = `<div class="i9-optimization-loading"><i class="fas fa-spinner fa-spin"></i> Atualizando resultados…</div>`;
      lastAnalysisSummary = null;
      const exportControl = modal.querySelector('#i9-niche-optimization-export');
      if (exportControl) exportControl.disabled = true;
      try {
        const [campaignResponse, taxonomyResponse, aiConfigResponse] = await Promise.all([
          this.app.api.getCampaigns(), this.app.api.getNicheTaxonomy(),
          this.app.api.sendMessage('AI_GET_CONFIG').catch(() => null),
        ]);
        if (!campaignResponse?.success) throw new Error(campaignResponse?.error || 'Não foi possível carregar as campanhas.');
        const campaigns = Array.isArray(campaignResponse.data) ? campaignResponse.data : [];
        const personaById = new Map((Array.isArray(aiConfigResponse?.data?.aiPersonas) ? aiConfigResponse.data.aiPersonas : []).map((persona) => [String(persona.id), persona]));
        const eligibleCampaigns = campaigns.filter((campaign) => Array.isArray(campaign.contacts) && campaign.contacts.some((contact) => contact?.status === 'sent'));
        const settled = await Promise.allSettled(eligibleCampaigns.map((campaign) => this.app.api.getCampaignReport(campaign.id)));
        const reports = settled.flatMap((item, index) => {
          if (item.status !== 'fulfilled' || !item.value?.success || !item.value?.data?.report) return [];
          const campaign = eligibleCampaigns[index] || {};
          const report = item.value.data.report;
          const personaId = String(campaign.aiPersonaId || report.aiPersonaId || '').trim();
          const persona = personaId ? personaById.get(personaId) : null;
          return [{ ...report, aiPersonaId: personaId, aiPersonaName: persona?.name || (personaId ? `Perfil ${personaId}` : 'Perfil global') }];
        });
        const summary = aggregateNichePerformance(reports);
        lastAnalysisSummary = summary;
        const exportButton = modal.querySelector('#i9-niche-optimization-export');
        if (exportButton) exportButton.disabled = reports.length === 0;
        const recommendations = buildNicheOptimizationRecommendations(summary, { minSample: 5 });
        const personaRecommendations = buildPersonaOptimizationRecommendations(summary, { minSample: 5 });
        const taxonomy = taxonomyResponse?.success ? taxonomyResponse.data : { nodes: [] };
        const consolidationSuggestions = suggestNicheConsolidations(taxonomy.nodes || []);
        const best = summary.niches.find((item) => item.niche !== 'Não identificado' && item.sent >= 5);
        const missedReports = Math.max(0, eligibleCampaigns.length - reports.length);
        const metric = (title, value, hint) => `<div class="i9-optimization-metric"><small>${this.escapeHtml(title)}</small><strong>${this.escapeHtml(value)}</strong><em>${this.escapeHtml(hint)}</em></div>`;
        const recommendationHtml = recommendations.length ? recommendations.map((item) => `<article class="i9-optimization-recommendation is-${this.escapeHtml(item.severity)}"><div class="i9-optimization-rec-heading"><strong>${this.escapeHtml(item.title)}</strong><span class="badge">${item.sample != null ? `${fmtNum(item.sample)} envios` : item.severity === 'success' ? 'Sinal positivo' : item.severity === 'warning' ? 'Revisar' : 'Informação'}</span></div><p>${this.escapeHtml(item.message)}</p><small>${this.escapeHtml(item.action)}</small>${item.niche ? `<div class="i9-optimization-rec-actions"><button type="button" class="btn btn-sm btn-secondary" data-prepare-niche="${this.escapeHtml(item.niche)}" data-subniche="${this.escapeHtml(item.subniche || '')}"><i class="fas fa-message"></i> Preparar público</button></div>` : ''}</article>`).join('') : `<p class="text-muted">Ainda não há dados suficientes para gerar recomendações. Execute campanhas, sincronize as conversas e atualize os relatórios.</p>`;
        const nicheRows = summary.niches.map((item) => `<tr><td><strong>${this.escapeHtml(item.niche)}</strong></td><td>${fmtNum(item.sent)}</td><td>${fmtNum(item.responses)} <small>(${fmtPct(item.responseRate)})</small></td><td>${fmtNum(item.qualified)} <small>(${fmtPct(item.qualificationRate)})</small></td><td>${fmtNum(item.hot)}</td><td>${fmtNum(item.campaigns)}</td><td><button type="button" class="btn btn-sm btn-secondary" data-prepare-niche="${this.escapeHtml(item.niche)}"><i class="fas fa-users"></i> Público</button></td></tr>`).join('');
        const subRows = summary.subniches.map((item) => `<tr><td>${this.escapeHtml(item.niche)}</td><td><strong>${this.escapeHtml(item.subniche)}</strong></td><td>${fmtNum(item.sent)}</td><td>${fmtNum(item.responses)} <small>(${fmtPct(item.responseRate)})</small></td><td>${fmtNum(item.qualified)} <small>(${fmtPct(item.qualificationRate)})</small></td><td>${fmtNum(item.hot)}</td><td><button type="button" class="btn btn-sm btn-secondary" data-prepare-niche="${this.escapeHtml(item.niche)}" data-subniche="${this.escapeHtml(item.subniche)}"><i class="fas fa-users"></i> Público</button></td></tr>`).join('');
        const consolidationHtml = consolidationSuggestions.length ? consolidationSuggestions.map((item) => `<article class="i9-optimization-consolidation"><div><strong>${this.escapeHtml(item.sourceName)}</strong><span class="i9-optimization-arrow">→</span><strong>${this.escapeHtml(item.targetName)}</strong><div class="text-muted">${this.escapeHtml(item.reason)} ${fmtNum(item.sourceLeadCount + item.targetLeadCount)} lead(s) nas duas classificações.</div></div><button type="button" class="btn btn-sm btn-secondary" data-merge-source="${this.escapeHtml(item.sourceId)}" data-merge-target="${this.escapeHtml(item.targetId)}" data-merge-source-name="${this.escapeHtml(item.sourceName)}" data-merge-target-name="${this.escapeHtml(item.targetName)}">Consolidar</button></article>`).join('') : `<p class="text-muted">Nenhuma duplicidade provável entre subnichos irmãos foi encontrada. As sugestões nunca são aplicadas automaticamente.</p>`;
        const personaRows = (summary.personas || []).map((item) => `<tr><td><strong>${this.escapeHtml(item.personaName)}</strong></td><td>${fmtNum(item.campaigns)}</td><td>${fmtNum(item.sent)}</td><td>${fmtNum(item.responses)} <small>(${fmtPct(item.responseRate)})</small></td><td>${fmtNum(item.qualified)} <small>(${fmtPct(item.qualificationRate)})</small></td><td>${fmtNum(item.hot)}</td></tr>`).join('');
        const personaRecommendationHtml = personaRecommendations.length ? personaRecommendations.map((item) => `<article class="i9-optimization-recommendation is-${this.escapeHtml(item.severity)}"><div class="i9-optimization-rec-heading"><strong>${this.escapeHtml(item.title)}</strong><span class="badge">${fmtNum(item.sample || 0)} envios</span></div><p>${this.escapeHtml(item.message)}</p><small>${this.escapeHtml(item.action)}</small></article>`).join('') : `<p class="text-muted">Ainda não há diferenças consistentes entre personalidades com amostra suficiente. Compare públicos semelhantes e altere uma variável por vez.</p>`;
        body.innerHTML = `
          <p class="text-muted">A análise usa os relatórios e dados do seu próprio CRM. Não compara sua operação com números externos nem presume que um segmento seja melhor sem amostra suficiente.</p>
          <div class="i9-optimization-metrics">
            ${metric('Campanhas analisadas', fmtNum(reports.length), `${fmtNum(eligibleCampaigns.length)} com envios${missedReports ? ` · ${missedReports} sem relatório acessível` : ''}`)}
            ${metric('Envios registrados', fmtNum(summary.totals.sent), 'Somados entre os relatórios carregados')}
            ${metric('Taxa de resposta', fmtPct(summary.totals.responseRate), `${fmtNum(summary.totals.responses)} resposta(s) identificada(s)`)}
            ${metric('Taxa de qualificação', fmtPct(summary.totals.qualificationRate), `${fmtNum(summary.totals.qualified)} lead(s) qualificado(s)`)}
          </div>
          ${best ? `<div class="i9-optimization-best"><i class="fas fa-chart-line"></i><div><strong>Segmento em destaque: ${this.escapeHtml(best.niche)}</strong><span>${fmtPct(best.responseRate)} de resposta · ${fmtPct(best.qualificationRate)} de qualificação em ${fmtNum(best.sent)} envio(s). Use como hipótese para um novo teste, não como garantia de resultado.</span></div><button type="button" class="btn btn-sm btn-primary" data-prepare-niche="${this.escapeHtml(best.niche)}">Preparar público</button></div>` : ''}
          <div class="form-section"><div class="form-section-title">Recomendações para próximas campanhas</div><div class="i9-optimization-recommendations">${recommendationHtml}</div></div>
          <div class="form-section"><div class="form-section-title">Desempenho por personalidade da IA</div><p class="text-muted">As campanhas são agrupadas pelo perfil salvo na campanha. Campanhas antigas ou sem perfil específico entram em Perfil global. A comparação é observacional: público, mensagem e horário também influenciam o resultado.</p>${personaRows ? `<div class="table-responsive"><table class="table i9-optimization-table"><thead><tr><th>Personalidade</th><th>Campanhas</th><th>Envios</th><th>Respostas</th><th>Qualificados</th><th>Quentes</th></tr></thead><tbody>${personaRows}</tbody></table></div>` : `<p class="text-muted">Ainda não há dados por personalidade.</p>`}<div class="i9-optimization-recommendations">${personaRecommendationHtml}</div></div>
          <div class="form-section"><div class="form-section-title">Comparativo por nicho</div>${nicheRows ? `<div class="table-responsive"><table class="table i9-optimization-table"><thead><tr><th>Nicho</th><th>Envios</th><th>Respostas</th><th>Qualificados</th><th>Quentes</th><th>Campanhas</th><th>Ação</th></tr></thead><tbody>${nicheRows}</tbody></table></div>` : `<p class="text-muted">Ainda não há campanhas com envios e nichos identificados para comparar.</p>`}</div>
          <div class="form-section"><div class="form-section-title">Comparativo por subnicho</div>${subRows ? `<div class="table-responsive"><table class="table i9-optimization-table"><thead><tr><th>Nicho pai</th><th>Subnicho</th><th>Envios</th><th>Respostas</th><th>Qualificados</th><th>Quentes</th><th>Ação</th></tr></thead><tbody>${subRows}</tbody></table></div>` : `<p class="text-muted">Nenhum subnicho apareceu nos relatórios carregados.</p>`}</div>
          <div class="form-section"><div class="form-section-title">Consolidação assistida de subnichos (${consolidationSuggestions.length})</div><p class="text-muted">O i9Hub identifica nomes muito parecidos dentro do mesmo nicho pai. Revise cada sugestão: a consolidação remapeia os leads para o nome escolhido e preserva o nome anterior como sinônimo.</p><div class="i9-optimization-consolidations">${consolidationHtml}</div></div>
          <div class="i9-optimization-footnote">A qualidade desta análise depende da sincronização das conversas, da classificação dos leads e da data individual dos envios. Resultados históricos orientam testes; não garantem resultados futuros.</div>`;
      } catch (error) {
        body.innerHTML = `<div class="alert alert-danger"><strong>Não foi possível montar a análise.</strong><p>${this.escapeHtml(error?.message || 'Erro inesperado.')}</p><p>Confira a licença, atualize o CRM e tente novamente.</p></div>`;
      }
    };
    modal.querySelector('#i9-niche-optimization-refresh')?.addEventListener('click', refresh);
    modal.querySelector('#i9-niche-optimization-export')?.addEventListener('click', () => {
      if (!lastAnalysisSummary) { this.app.showToast('Atualize a análise antes de exportar.', 'warning'); return; }
      try {
        const csv = buildNicheAnalyticsCsv(lastAnalysisSummary);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `i9hub-inteligencia-comercial-${new Date().toISOString().slice(0, 10)}.csv`;
        link.style.display = 'none';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        this.app.showToast('Análise agregada exportada em CSV. O arquivo não contém telefones nem conteúdo de conversas.', 'success', 6000);
      } catch (error) { this.app.showToast(error?.message || 'Não foi possível exportar a análise.', 'error', 6000); }
    });
    body.addEventListener('click', async (event) => {
      const mergeButton = event.target.closest('[data-merge-source]');
      if (mergeButton) {
        const sourceId = mergeButton.dataset.mergeSource, targetId = mergeButton.dataset.mergeTarget;
        const sourceName = mergeButton.dataset.mergeSourceName, targetName = mergeButton.dataset.mergeTargetName;
        if (!confirm(`Consolidar “${sourceName}” em “${targetName}”? Os leads serão remapeados, subnichos filhos serão preservados e a ação não poderá ser desfeita automaticamente.`)) return;
        mergeButton.disabled = true;
        const result = await this.app.api.mergeNicheNodes(sourceId, targetId);
        if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível consolidar os subnichos.', 'error', 8000); mergeButton.disabled = false; return; }
        await this.loadLeads();
        this.app.showToast(`Classificação consolidada. ${fmtNum(result.data?.updatedLeads)} lead(s) atualizado(s).`, 'success', 7000);
        await refresh();
        return;
      }
      const prepareButton = event.target.closest('[data-prepare-niche]');
      if (prepareButton) {
        const nicheName = prepareButton.dataset.prepareNiche || '';
        const subName = prepareButton.dataset.subniche || '';
        const norm = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const matching = this.state.leads.filter((lead) => {
          const labels = leadNicheLabels(lead).map(norm);
          return subName ? labels.includes(norm(nicheName)) && labels.includes(norm(subName)) : labels.includes(norm(nicheName));
        });
        const excluded = { phone: 0, blacklist: 0, spam: 0, optout: 0 };
        const contacts = matching.filter((lead) => {
          if (String(lead.phone || '').replace(/\D/g, '').length < 10) { excluded.phone++; return false; }
          const signals = scoreLead(lead, this.state.leadScoring || DEFAULT_LEAD_SCORING_CONFIG).signals || {};
          if (lead.blacklisted || this.leadStage(lead) === 'blacklist' || signals.blacklisted) { excluded.blacklist++; return false; }
          if (normalizeType(lead.tipo) === 'spam' || signals.spam) { excluded.spam++; return false; }
          if (signals.optedOut || lead.optedOut === true || lead.unsubscribe === true || lead.descadastrado === true) { excluded.optout++; return false; }
          return true;
        });
        if (!contacts.length) { this.app.showToast(`Nenhum contato elegível neste segmento. Correspondentes: ${matching.length}; sem telefone: ${excluded.phone}; Black list: ${excluded.blacklist}; spam: ${excluded.spam}; descadastro: ${excluded.optout}.`, 'warning', 8000); return; }
        this.app.pendingContacts = contacts;
        const excludedCount = Object.values(excluded).reduce((sum, value) => sum + value, 0);
        if (excludedCount) this.app.showToast(`Público preparado: ${contacts.length} contato(s) elegíveis. Excluídos — sem telefone: ${excluded.phone}, Black list: ${excluded.blacklist}, spam: ${excluded.spam}, descadastro: ${excluded.optout}.`, 'info', 8000);
        close();
        this.app.campaignForm.show();
      }
    });
    await refresh();
  }

  async showNicheManager() {
    const response = await this.app.api.getNicheTaxonomy();
    if (!response?.success) { this.app.showToast(response?.error || 'Não foi possível carregar os nichos.', 'error'); return; }
    const modal = document.createElement('div'); modal.className = 'modal-overlay open';
    modal.innerHTML = `<div class="modal modal-lg"><div class="modal-header"><h3 class="modal-title"><i class="fas fa-sitemap"></i> Inteligência de nichos e etiquetas</h3><button class="modal-close" aria-label="Fechar">&times;</button></div><div class="modal-body" id="crm-niche-manager-body"></div><div class="modal-footer"><button type="button" class="btn btn-secondary modal-close">Fechar</button></div></div>`;
    document.body.appendChild(modal); const close = () => modal.remove(); modal.querySelectorAll('.modal-close').forEach((button) => button.addEventListener('click', close)); modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    const render = (taxonomy) => {
      const nodes = taxonomy.nodes || []; const niches = nodes.filter((node) => node.type === 'niche'); const tags = nodes.filter((node) => node.type === 'tag');
      const tree = this.renderNicheTree(niches, null, 0);
      const parentOptions = [`<option value="">Nicho principal (sem pai)</option>`, ...niches.map((node) => `<option value="${this.escapeHtml(node.id)}">${this.escapeHtml(this.taxonomyNodePath(node, niches))}</option>`)].join('');
      modal.querySelector('#crm-niche-manager-body').innerHTML = `<p class="text-muted">A IA pode criar nichos, subnichos e etiquetas conforme identifica informações sustentadas pelas conversas. Não há um limite comercial fixo para as classificações internas. Use Inteligência comercial para revisar nomes semelhantes; toda consolidação exige sua confirmação.</p><div class="crm-taxonomy-summary"><div class="stat-card"><span class="stat-number">${niches.length}</span><span class="stat-label">Nichos e subnichos</span></div><div class="stat-card"><span class="stat-number">${tags.length}</span><span class="stat-label">Etiquetas internas</span></div></div><h4>Árvore de nichos</h4><div class="crm-taxonomy-tree">${tree || '<p class="text-muted">Ainda não existem nichos. A IA poderá criá-los durante as conversas ou você pode adicionar abaixo.</p>'}</div><h4 style="margin-top:18px">Etiquetas livres</h4><div class="crm-taxonomy-tags">${tags.length ? tags.map((node) => this.taxonomyNodeRow(node, 0, true)).join('') : '<p class="text-muted">Nenhuma etiqueta livre cadastrada.</p>'}</div><form id="crm-niche-add-form" class="crm-niche-add-form"><h4>Adicionar classificação</h4><div class="form-row"><label>Tipo<select id="crm-niche-type" class="form-select"><option value="niche">Nicho / subnicho</option><option value="tag">Etiqueta livre</option></select></label><label>Nome<input id="crm-niche-name" class="form-input" maxlength="120" placeholder="Ex.: Fisioterapia esportiva" required></label><label id="crm-niche-parent-wrap">Nicho pai<select id="crm-niche-parent" class="form-select">${parentOptions}</select></label><button class="btn btn-primary" type="submit"><i class="fas fa-plus"></i> Adicionar</button></div></form>`;
    };
    render(response.data);
    modal.querySelector('#crm-niche-manager-body').addEventListener('change', (event) => { if (event.target.id === 'crm-niche-type') { const wrap = modal.querySelector('#crm-niche-parent-wrap'); if (wrap) wrap.style.display = event.target.value === 'tag' ? 'none' : ''; } });
    modal.querySelector('#crm-niche-manager-body').addEventListener('submit', async (event) => {
      if (event.target.id !== 'crm-niche-add-form') return; event.preventDefault();
      const name = modal.querySelector('#crm-niche-name').value.trim(); const type = modal.querySelector('#crm-niche-type').value; const parentId = type === 'tag' ? null : (modal.querySelector('#crm-niche-parent').value || null);
      const saved = await this.app.api.saveNicheNode({ name, type, parentId });
      if (!saved?.success) { this.app.showToast(saved?.error || 'Não foi possível adicionar a classificação.', 'error'); return; }
      if (saved.duplicate) this.app.showToast('Essa classificação já existe; a IA reutilizará a existente.', 'info'); else this.app.showToast('Classificação adicionada.', 'success');
      const refreshed = await this.app.api.getNicheTaxonomy(); if (refreshed?.success) render(refreshed.data); modal.querySelector('#crm-niche-name')?.focus();
    });
    modal.querySelector('#crm-niche-manager-body').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-tax-action]'); if (!button) return;
      const id = button.dataset.id; const action = button.dataset.taxAction;
      const latest = await this.app.api.getNicheTaxonomy(); const node = latest?.data?.nodes?.find((item) => item.id === id); if (!node) return;
      if (action === 'add-child') { const type = modal.querySelector('#crm-niche-type'); const parent = modal.querySelector('#crm-niche-parent'); type.value = 'niche'; modal.querySelector('#crm-niche-parent-wrap').style.display = ''; parent.value = id; modal.querySelector('#crm-niche-name').focus(); return; }
      if (action === 'rename') { const name = prompt('Novo nome para esta classificação:', node.name); if (!name || !name.trim() || name.trim() === node.name) return; const saved = await this.app.api.saveNicheNode({ id, name: name.trim(), parentId: node.parentId, aliases: node.aliases }); if (!saved?.success) { this.app.showToast(saved?.error || 'Não foi possível renomear.', 'error'); return; } this.app.showToast('Classificação renomeada.', 'success'); }
      if (action === 'delete') { if (!confirm(`Excluir a classificação "${node.name}"? Os leads não serão apagados, mas deixarão de usar esse nó da árvore.`)) return; const deleted = await this.app.api.deleteNicheNode(id); if (!deleted?.success) { this.app.showToast(deleted?.error || 'Não foi possível excluir.', 'error', 6000); return; } this.app.showToast('Classificação removida.', 'success'); }
      const refreshed = await this.app.api.getNicheTaxonomy(); if (refreshed?.success) render(refreshed.data);
    });
  }
  renderNicheTree(nodes, parentId = null, depth = 0) {
    const children = nodes.filter((node) => (node.parentId || null) === parentId).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return children.map((node) => `${this.taxonomyNodeRow(node, depth, false)}${this.renderNicheTree(nodes, node.id, depth + 1)}`).join('');
  }
  taxonomyNodePath(node, nodes) { const path = []; let cursor = node; let depth = 0; while (cursor && depth++ < 30) { path.unshift(cursor.name); cursor = nodes.find((item) => item.id === cursor.parentId) || null; } return path.join(' › '); }
  taxonomyNodeRow(node, depth = 0, tag = false) { return `<div class="crm-taxonomy-row" style="margin-left:${Math.min(depth, 12) * 18}px" data-taxonomy-id="${this.escapeHtml(node.id)}"><div class="crm-taxonomy-node-main"><strong>${this.escapeHtml(node.name)}</strong><span class="badge">${tag ? 'Etiqueta' : depth ? 'Subnicho' : 'Nicho'}</span><small class="text-muted">${Number(node.leadCount) || 0} lead(s)</small></div><div class="crm-taxonomy-node-actions">${!tag ? `<button type="button" class="btn btn-sm btn-secondary" data-tax-action="add-child" data-id="${this.escapeHtml(node.id)}" title="Adicionar subnicho"><i class="fas fa-level-down-alt"></i></button>` : ''}<button type="button" class="btn btn-sm btn-secondary" data-tax-action="rename" data-id="${this.escapeHtml(node.id)}">Renomear</button><button type="button" class="btn btn-sm btn-danger" data-tax-action="delete" data-id="${this.escapeHtml(node.id)}">Excluir</button></div></div>`; }
  allLeadTags(lead) { return getLeadTags(lead); }
  leadTagsHTML(lead, max = 4) { const tags = this.allLeadTags(lead); if (!tags.length) return ""; const shown = tags.slice(0, max).map(t => `<span class="badge">${this.escapeHtml(t)}</span>`).join(" "); const more = tags.length > max ? ` <span class="badge" title="Mais classificações">+${tags.length - max}</span>` : ""; return `<div class="crm-lead-tags">${shown}${more}</div>`; } formatSource(source) { const map = { google_maps: "Google Maps", whatsapp: "WhatsApp", whatsapp_group: "Grupo WhatsApp", whatsapp_private: "Oportunidade WhatsApp", manual: "Manual", import: "Importacao CSV" }; return map[source] || source || "-"; } formatStage(stage) { return stageTitle(stage); } getSourceColor(source) { const map = { google_maps: "#4285f4", whatsapp: "#25d366", whatsapp_group: "#25d366", whatsapp_private: "#25d366", manual: "#6b7280", import: "#f59e0b" }; return map[source] || "#6b7280"; } formatDate(isoString) { try { return new Date(isoString).toLocaleString("pt-BR"); } catch { return isoString; } } escapeHtml(text) { const div = document.createElement("div"); div.textContent = text == null ? "" : String(text); return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;"); } debounce(fn, delay) { let timeoutId; return (...args) => { clearTimeout(timeoutId); timeoutId = setTimeout(() => fn.apply(this, args), delay); }; } }

