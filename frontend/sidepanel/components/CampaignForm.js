import { STAGE_LIST, leadToContact, loadLeadSegments, normPhone, refreshStages, campaignStages, leadGroups, leadStageOf, leadInternalTags, leadWaLabels } from "../utils/segments.js";
import { normalizeType } from "../../lib/classifier.js";

const VARIABLES = [
  ["{{nome}}", "Nome"],
  ["{{primeiro_nome}}", "Primeiro nome"],
  ["{{empresa}}", "Empresa"],
  ["{{telefone}}", "Telefone"],
  ["{{estagio}}", "Nível"],
  ["{{etiqueta}}", "Etiqueta"],
];

/**
 * Nova campanha de WhatsApp em massa.
 * Destinatários: (1) filtros do CRM — escolha estágios, etiquetas e/ou grupos,
 * (2) seleção vinda da tela do CRM, ou (3) lista colada (nome,telefone).
 */
export class CampaignForm {
  constructor(app) { this.app = app; this.savedLists = []; this.aiPersonas = []; }

  async show() {
    const modal = document.createElement("div");
    modal.className = "modal-overlay open";
    document.body.appendChild(modal);

    this.modal = modal;
    this.sel = { stages: new Set(), tags: new Set(), waLabels: new Set(), groups: new Set() };
    this.sourceFilter = "all";
    this.seg = { leads: [], groups: new Map(), tags: new Map(), i9Tags: new Map(), waLabels: new Map(), sources: new Map(), stages: new Map() };
    this.includeSpam = false;
    this.selection = (this.app.pendingContacts || []).filter((l) => normPhone(l.phone).length >= 10);
    this.app.pendingContacts = null;
    this.mode = this.selection.length ? "selection" : "crm";
    await refreshStages(this.app.api);
    this.savedLists = await this.readSavedLists();
    this.aiPersonas = [];
    try {
      const aiConfig = await this.app.api.sendMessage('AI_GET_CONFIG');
      if (aiConfig?.success && Array.isArray(aiConfig.data?.aiPersonas)) this.aiPersonas = aiConfig.data.aiPersonas.filter((persona) => persona?.id && persona?.name).slice(0, 20);
    } catch { /* campanhas continuam disponíveis mesmo se a IA não estiver configurada */ }

    modal.innerHTML = this.getHTML();
    this.bindEvents();
    try { this.seg = await loadLeadSegments(this.app.api); } catch { /* segue sem CRM */ }
    if (!this.selection.length && !this.seg.leads.length) this.mode = "paste";
    this.renderLevels();
    this.setMode(this.mode);
  }

  getHTML() {
    const stageOpts = campaignStages().map((s) => `<option value="${this.esc(s.id)}">${this.esc(s.title)}</option>`).join("");
    const personaOpts = `<option value="">Usar perfil global do Chat com IA</option>${this.aiPersonas.map((persona) => `<option value="${this.esc(persona.id)}">${this.esc(persona.name)}</option>`).join("")}`;
    return `<div class="modal modal-lg">
      <div class="modal-header"><h3 class="modal-title"><i class="fas fa-plus"></i> Nova Campanha WhatsApp</h3><button class="modal-close" type="button">&times;</button></div>
      <div class="modal-body">
        <form id="campaign-form">
          <div class="form-group"><label class="form-label">Nome da campanha</label><input type="text" class="form-input" id="campaign-name" placeholder="Ex: Promoção de outubro" required></div>

          <div class="form-group"><label class="form-label">Mensagem (variáveis + spintax)</label>
            <textarea class="form-textarea" id="campaign-template" rows="5" placeholder="{Oi|Olá} {{primeiro_nome}}! {Tudo bem?|Como vai?} Temos uma oferta especial para você..." required></textarea>
            <div class="var-chips" id="var-chips">${VARIABLES.map(([v, l]) => `<button type="button" class="chip chip-sm" data-var="${v}" title="Inserir ${v}">${l}</button>`).join("")}</div>
          </div>
          <div class="form-group"><label class="form-label" for="campaign-ai-persona">Personalidade da IA para as respostas</label><select class="form-select" id="campaign-ai-persona">${personaOpts}</select><small class="text-muted">Se escolher um perfil, as respostas privadas dos contatos desta campanha usarão essa personalidade por até 30 dias após o envio. Sem escolha, será usado o perfil global. A IA precisa estar ativa para responder.</small></div>

          <div class="form-section" id="campaign-saved-lists">
            <div class="form-section-title"><i class="fas fa-list-check"></i> Listas de campanha salvas</div>
            <div class="form-row" style="align-items:end">
              <div class="form-group" style="flex:1"><label class="form-label" for="campaign-list-select">Usar uma lista salva</label><select class="form-select" id="campaign-list-select">${this.savedLists.length ? `<option value="">Selecione uma lista…</option>${this.savedLists.map((list) => `<option value="${this.esc(list.id)}">${this.esc(list.name)}</option>`).join("")}` : '<option value="">Nenhuma lista salva ainda</option>'}</select></div>
              <button type="button" class="btn btn-secondary" id="campaign-list-load"><i class="fas fa-filter"></i> Carregar</button>
            </div>
            <div class="form-row" style="align-items:end;margin-top:4px">
              <div class="form-group" style="flex:1"><label class="form-label" for="campaign-list-name">Nome da lista</label><input type="text" class="form-input" id="campaign-list-name" maxlength="100" placeholder="Ex.: Clientes VIP"></div>
              <button type="button" class="btn btn-secondary" id="campaign-list-save"><i class="fas fa-save"></i> Salvar filtros</button>
            </div>
            <div class="btn-group"><button type="button" class="btn btn-ghost" id="campaign-list-delete"><i class="fas fa-trash"></i> Excluir lista selecionada</button></div>
            <small class="text-muted">As listas guardam filtros de estágio, etiqueta e grupo. Ao carregar, os destinatários são recalculados com os dados atuais do CRM.</small>
          </div>

          <div class="form-group"><label class="form-label">Quem vai receber</label>
            <div class="mode-tabs" id="mode-tabs">
              <button type="button" class="mode-tab" data-mode="crm">Por nível ou etiqueta</button>
              <button type="button" class="mode-tab" data-mode="selection" id="tab-selection" style="display:none">Seleção do CRM</button>
              <button type="button" class="mode-tab" data-mode="paste">Colar lista</button>
            </div>

            <div id="mode-crm">
              <div class="form-group"><label class="form-label" for="campaign-source-filter">Fonte dos leads</label>
                <select class="form-select" id="campaign-source-filter">
                  <option value="all">Todas as origens do CRM</option>
                  <option value="google_maps">Google Maps</option>
                  <option value="whatsapp_group">Participantes de grupos do WhatsApp</option>
                  <option value="whatsapp_private">Conversas privadas do WhatsApp</option>
                  <option value="whatsapp">Contatos sincronizados do WhatsApp Business</option>
                  <option value="wa_labels">Contatos por etiqueta do WhatsApp Business</option>
                  <option value="i9_tags">Contatos por etiquetas inteligentes do i9Hub/IA</option>
                  <option value="manual">Cadastrados manualmente</option>
                  <option value="import">Importados de arquivo</option>
                </select>
                <small class="text-muted">A origem limita a base. Estágios, etiquetas e grupos selecionados abaixo refinam a lista.</small>
              </div>
              <div class="form-label">Estágios do CRM</div>
              <div class="chip-row" id="stage-chips"></div>
              <div class="chip-actions"><button type="button" class="btn btn-sm btn-secondary" id="stages-all">Todos os níveis</button> <button type="button" class="btn btn-sm btn-secondary" id="stages-none">Limpar filtros</button></div>
              <details class="seg-extra" id="seg-tags-box"><summary>Etiquetas inteligentes do i9Hub/IA <small class="text-muted" id="seg-tags-n"></small></summary><div class="chip-row chip-scroll" id="tag-chips"></div></details>
              <details class="seg-extra" id="seg-wa-labels-box"><summary>Etiquetas do WhatsApp Business <small class="text-muted" id="seg-wa-labels-n"></small></summary><div class="chip-row chip-scroll" id="wa-label-chips"></div></details>
              <details class="seg-extra" id="seg-groups-box"><summary>Grupos do WhatsApp <small class="text-muted" id="seg-groups-n"></small></summary><div class="chip-row chip-scroll" id="group-chips"></div></details>
            </div>

            <div id="mode-selection" style="display:none"><div class="info-box" id="selection-info"></div></div>

            <div id="mode-paste" style="display:none">
              <textarea class="form-textarea" id="campaign-contacts" rows="6" placeholder="Um por linha: nome,telefone&#10;Joao,11999999999&#10;Maria,5511988888888"></textarea>
            </div>

            <div class="form-group" style="margin-top:10px"><label class="toggle"><input type="checkbox" id="include-spam"><span class="toggle-slider"></span> Incluir contatos classificados como Spam</label><small class="text-muted">Desligado por padrão. Mesmo selecionados no CRM, os contatos Spam ficam fora da campanha até você marcar esta opção.</small></div>
            <div class="audience-summary" id="audience-summary"></div>
          </div>

          <div class="form-group"><label class="form-label">Depois de enviar, mover o lead para</label>
            <select class="form-select" id="move-stage"><option value="">Não alterar o nível</option>${stageOpts}</select>
            <small class="text-muted">Só se aplica a contatos que vieram do CRM.</small>
          </div>

          <div class="form-row">
            <div class="form-group"><label class="form-label">Intervalo mín. (segundos)</label><input type="number" min="1" class="form-input" id="delay-min" value="8"></div>
            <div class="form-group"><label class="form-label">Intervalo máx. (segundos)</label><input type="number" min="1" class="form-input" id="delay-max" value="20"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Enviar por lote (mensagens)</label><input type="number" min="0" max="1000" class="form-input" id="batch-size" value="20"></div>
            <div class="form-group"><label class="form-label">Aguardar entre lotes (minutos)</label><input type="number" min="0" max="10080" class="form-input" id="batch-pause" value="120"></div>
          </div>
          <div class="info-box" style="margin:-4px 0 12px"><strong>Campanha em ciclos</strong><br>Exemplo: lote de 20 mensagens + pausa de 120 minutos (2 horas) + próximo lote de 20. Durante a pausa, o Chat com IA continua atendendo as conversas recebidas, se estiver ativo. O envio será suspenso se a IA estiver processando uma resposta, para evitar conflito entre mensagens.</div>
          <small class="text-muted" style="display:block;margin:-4px 0 12px">Use 0 no lote ou na pausa para desativar os ciclos. Envie somente para contatos adequados à finalidade e respeite pedidos de descadastro.</small>
          <div class="form-group"><label class="form-label" for="campaign-send-limit">Limite total de envios da campanha</label><input type="number" min="0" max="10000" class="form-input" id="campaign-send-limit" value="0"><small class="text-muted">0 = todos os contatos selecionados. Você poderá aumentar ou reduzir esse limite depois, sem perder o histórico dos envios já realizados.</small></div>

          <div class="form-group"><label class="toggle"><input type="checkbox" id="skip-own" checked><span class="toggle-slider"></span> Não enviar para o meu próprio número</label><small class="text-muted" style="display:block;margin-top:4px">Se o número da conta conectada estiver na lista (comum em contatos vindos de grupos), ele é ignorado sem contar como falha.</small></div>

          <div class="form-group"><label class="toggle"><input type="checkbox" id="schedule-enabled"><span class="toggle-slider"></span> Enviar apenas dentro de um horário</label></div>
          <div class="form-row" id="schedule-row" style="display:none">
            <div class="form-group"><label class="form-label">Das</label><input type="time" class="form-input" id="schedule-start" value="09:00"></div>
            <div class="form-group"><label class="form-label">Até</label><input type="time" class="form-input" id="schedule-end" value="18:00"></div>
          </div>

          <div class="btn-group">
            <button type="button" class="btn btn-secondary" id="test-spintax"><i class="fas fa-flask"></i> Testar mensagem</button>
            <button type="submit" class="btn btn-secondary" id="btn-create"><i class="fas fa-save"></i> Criar (rascunho)</button>
            <button type="button" class="btn btn-primary" id="btn-create-start"><i class="fas fa-rocket"></i> Criar e iniciar</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  $(sel) { return this.modal.querySelector(sel); }

  bindEvents() {
    const m = this.modal;
    m.querySelector(".modal-close")?.addEventListener("click", () => m.remove());
    m.addEventListener("click", (e) => { if (e.target === m) m.remove(); });

    this.$("#mode-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b) this.setMode(b.dataset.mode); });
    this.$("#campaign-list-load").addEventListener("click", () => this.applySavedList());
    this.$("#campaign-list-save").addEventListener("click", () => this.saveCurrentList());
    this.$("#campaign-list-delete").addEventListener("click", () => this.deleteSavedList());
    this.$("#var-chips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-var]"); if (!b) return;
      const ta = this.$("#campaign-template"); const v = b.dataset.var;
      const a = ta.selectionStart ?? ta.value.length, z = ta.selectionEnd ?? a;
      ta.value = ta.value.slice(0, a) + v + ta.value.slice(z); ta.focus(); ta.selectionStart = ta.selectionEnd = a + v.length;
    });

    const toggle = (set, key, chip) => { set.has(key) ? set.delete(key) : set.add(key); chip.classList.toggle("on", set.has(key)); this.updateSummary(); };
    this.$("#stage-chips").addEventListener("click", (e) => { const c = e.target.closest("[data-key]"); if (c) toggle(this.sel.stages, c.dataset.key, c); });
    this.$("#tag-chips").addEventListener("click", (e) => { const c = e.target.closest("[data-key]"); if (c) toggle(this.sel.tags, c.dataset.key, c); });
    this.$("#wa-label-chips").addEventListener("click", (e) => { const c = e.target.closest("[data-key]"); if (c) toggle(this.sel.waLabels, c.dataset.key, c); });
    this.$("#group-chips").addEventListener("click", (e) => { const c = e.target.closest("[data-key]"); if (c) toggle(this.sel.groups, c.dataset.key, c); });
    this.$("#campaign-source-filter").addEventListener("change", (e) => { this.sourceFilter = e.target.value || "all"; if (this.sourceFilter === "wa_labels") this.$("#seg-wa-labels-box").open = true; if (this.sourceFilter === "i9_tags") this.$("#seg-tags-box").open = true; this.updateSummary(); });
    this.$("#stages-all").addEventListener("click", () => { campaignStages().forEach((s) => this.sel.stages.add(s.id)); this.renderLevels(); this.updateSummary(); });
    this.$("#stages-none").addEventListener("click", () => { this.sel.stages.clear(); this.sel.tags.clear(); this.sel.waLabels.clear(); this.sel.groups.clear(); this.sourceFilter = "all"; this.$("#campaign-source-filter").value = "all"; this.renderLevels(); this.updateSummary(); });

    this.$("#campaign-contacts").addEventListener("input", () => this.updateSummary());
    this.$("#include-spam").addEventListener("change", (e) => { this.includeSpam = e.target.checked; this.renderLevels(); this.updateSummary(); });
    this.$("#schedule-enabled").addEventListener("change", (e) => { this.$("#schedule-row").style.display = e.target.checked ? "" : "none"; });
    this.$("#test-spintax").addEventListener("click", () => this.testMessage());
    this.$("#campaign-form").addEventListener("submit", (e) => { e.preventDefault(); this.save(false); });
    this.$("#btn-create-start").addEventListener("click", () => { if (this.$("#campaign-form").reportValidity()) this.save(true); });
  }

  setMode(mode) {
    this.mode = mode;
    this.$("#tab-selection").style.display = this.selection.length ? "" : "none";
    this.modal.querySelectorAll(".mode-tab").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
    ["crm", "selection", "paste"].forEach((k) => { this.$(`#mode-${k}`).style.display = k === mode ? "" : "none"; });
    this.$("#campaign-saved-lists").style.display = mode === "crm" ? "" : "none";
    if (mode === "selection") this.$("#selection-info").innerHTML = `<strong>${this.selection.length}</strong> contatos selecionados na tela do CRM serão usados nesta campanha.`;
    this.updateSummary();
  }

  renderLevels() {
    const eligible = this.seg.leads.filter((l) => this.includeSpam || normalizeType(l.tipo) !== "spam");
    const counts = { stages: new Map(), tags: new Map(), waLabels: new Map(), groups: new Map() };
    const inc = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
    for (const l of eligible) {
      inc(counts.stages, leadStageOf(l));
      leadInternalTags(l).forEach((t) => inc(counts.tags, t));
      leadWaLabels(l).forEach((t) => inc(counts.waLabels, t));
      leadGroups(l).forEach((g) => inc(counts.groups, g));
    }
    const chip = (key, label, n, on, color) => `<button type="button" class="chip ${on ? "on" : ""}" data-key="${this.esc(key)}" ${color ? `style="--chip-color:${color}"` : ""}>${color ? `<i class="chip-dot"></i>` : ""}${this.esc(label)} <b>${n}</b></button>`;
    this.$("#stage-chips").innerHTML = campaignStages().map((s) => chip(s.id, s.title, counts.stages.get(s.id) || 0, this.sel.stages.has(s.id), s.color)).join("");
    const sorted = (map) => [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), "pt-BR"));
    this.$("#tag-chips").innerHTML = sorted(counts.tags).map(([k, n]) => chip(k, k, n, this.sel.tags.has(k))).join("");
    this.$("#wa-label-chips").innerHTML = sorted(counts.waLabels).map(([k, n]) => chip(k, k, n, this.sel.waLabels.has(k))).join("");
    this.$("#group-chips").innerHTML = sorted(counts.groups).map(([k, n]) => chip(k, k, n, this.sel.groups.has(k))).join("");
    this.$("#seg-tags-n").textContent = counts.tags.size ? `(${counts.tags.size})` : "";
    this.$("#seg-wa-labels-n").textContent = counts.waLabels.size ? `(${counts.waLabels.size})` : "";
    this.$("#seg-groups-n").textContent = counts.groups.size ? `(${counts.groups.size})` : "";
    this.$("#seg-tags-box").style.display = counts.tags.size ? "" : "none";
    this.$("#seg-wa-labels-box").style.display = counts.waLabels.size ? "" : "none";
    this.$("#seg-groups-box").style.display = counts.groups.size ? "" : "none";
  }

  async readSavedLists() {
    try {
      const stored = await chrome.storage.local.get("i9hubCampaignListsV1");
      return Array.isArray(stored?.i9hubCampaignListsV1) ? stored.i9hubCampaignListsV1.filter((x) => x && x.id && x.name) : [];
    } catch { return []; }
  }

  async persistSavedLists() {
    try { await chrome.storage.local.set({ i9hubCampaignListsV1: this.savedLists.slice(0, 100) }); return true; }
    catch (error) { this.app.showToast("Não foi possível salvar a lista neste computador: " + error.message, "error", 7000); return false; }
  }

  renderSavedLists(selectedId = "") {
    const select = this.$("#campaign-list-select"); if (!select) return;
    select.innerHTML = this.savedLists.length
      ? `<option value="">Selecione uma lista…</option>${this.savedLists.map((list) => `<option value="${this.esc(list.id)}">${this.esc(list.name)}</option>`).join("")}`
      : '<option value="">Nenhuma lista salva ainda</option>';
    if (selectedId && this.savedLists.some((list) => list.id === selectedId)) select.value = selectedId;
  }

  async saveCurrentList() {
    if (this.mode !== "crm") { this.app.showToast("Abra a opção de filtros do CRM antes de salvar uma lista.", "warning"); return; }
    if (!this.hasAudienceCriteria()) { this.app.showToast("Selecione uma fonte, etiqueta, estágio ou grupo antes de salvar.", "warning"); return; }
    const nameInput = this.$("#campaign-list-name");
    const name = String(nameInput?.value || "").trim().slice(0, 100);
    if (!name) { this.app.showToast("Informe um nome para a lista.", "warning"); nameInput?.focus(); return; }
    const normalized = name.toLocaleLowerCase("pt-BR");
    const existing = this.savedLists.find((list) => String(list.name).trim().toLocaleLowerCase("pt-BR") === normalized);
    if (existing && !confirm(`A lista "${name}" já existe. Deseja atualizar seus filtros?`)) return;
    const record = {
      id: existing?.id || `camp_list_${Date.now().toString(36)}`,
      name, sourceFilter: this.sourceFilter || "all", stages: [...this.sel.stages], tags: [...this.sel.tags], waLabels: [...this.sel.waLabels], groups: [...this.sel.groups],
      createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    this.savedLists = existing ? this.savedLists.map((list) => list.id === existing.id ? record : list) : [record, ...this.savedLists];
    if (!await this.persistSavedLists()) return;
    this.renderSavedLists(record.id);
    if (nameInput) nameInput.value = name;
    this.app.showToast(`Lista "${name}" salva. Prévia atual: ${this.resolveContacts().contacts.length} contato(s).`, "success", 6000);
  }

  applySavedList() {
    const id = this.$("#campaign-list-select")?.value;
    const list = this.savedLists.find((item) => item.id === id);
    if (!list) { this.app.showToast("Selecione uma lista salva.", "warning"); return; }
    const legacyTags = Array.isArray(list.tags) ? list.tags : [];
    const currentWaLabels = new Set(this.seg.leads.flatMap((lead) => leadWaLabels(lead)));
    const legacyWasUnsplit = !Array.isArray(list.waLabels);
    this.sel = {
      stages: new Set(list.stages || []),
      tags: new Set(legacyWasUnsplit ? legacyTags.filter((tag) => !currentWaLabels.has(tag)) : legacyTags),
      waLabels: new Set(legacyWasUnsplit ? legacyTags.filter((tag) => currentWaLabels.has(tag)) : (list.waLabels || [])),
      groups: new Set(list.groups || []),
    };
    this.sourceFilter = list.sourceFilter || "all";
    this.$("#campaign-source-filter").value = this.sourceFilter;
    this.setMode("crm"); this.renderLevels(); this.updateSummary();
    const nameInput = this.$("#campaign-list-name"); if (nameInput) nameInput.value = list.name;
    const count = this.resolveContacts().contacts.length;
    this.app.showToast(`Lista "${list.name}" carregada: ${count} contato(s) elegível(is) agora.`, count ? "success" : "warning", 6000);
  }

  async deleteSavedList() {
    const id = this.$("#campaign-list-select")?.value;
    const list = this.savedLists.find((item) => item.id === id);
    if (!list) { this.app.showToast("Selecione uma lista salva para excluir.", "warning"); return; }
    if (!confirm(`Excluir a lista "${list.name}"? Os contatos do CRM não serão apagados.`)) return;
    this.savedLists = this.savedLists.filter((item) => item.id !== id);
    if (!await this.persistSavedLists()) return;
    this.renderSavedLists();
    const nameInput = this.$("#campaign-list-name"); if (nameInput?.value === list.name) nameInput.value = "";
    this.app.showToast("Lista de campanha excluída.", "success");
  }

  parsePasted(text) {
    const out = [];
    for (const line of String(text || "").split(/\r?\n/)) {
      const parts = line.split(/[;,\t]/).map((p) => p.trim()).filter(Boolean);
      if (!parts.length) continue;
      const phoneIdx = parts.findIndex((p) => normPhone(p).length >= 8);
      if (phoneIdx < 0) continue;
      const name = parts.find((_, i) => i !== phoneIdx) || "";
      out.push({ name, phone: normPhone(parts[phoneIdx]) });
    }
    return out;
  }

  hasAudienceCriteria() {
    return this.sourceFilter !== "all" || this.sel.stages.size > 0 || this.sel.tags.size > 0 || this.sel.waLabels.size > 0 || this.sel.groups.size > 0;
  }

  sourceMatches(lead) {
    const source = String(lead?.source || "manual");
    switch (this.sourceFilter) {
      case "google_maps": case "whatsapp_group": case "whatsapp_private": case "whatsapp": case "manual": case "import":
        return source === this.sourceFilter;
      case "wa_labels": return leadWaLabels(lead).length > 0;
      case "i9_tags": return leadInternalTags(lead).length > 0;
      default: return true;
    }
  }

  // Contatos conforme o modo atual (sem duplicados por telefone)
  resolveContacts() {
    let raw = [];
    if (this.mode === "crm") {
      if (!this.hasAudienceCriteria()) return { contacts: [], dupes: 0, spamExcluded: 0, empty: true };
      raw = this.seg.leads.filter((lead) =>
        this.sourceMatches(lead) &&
        (!this.sel.stages.size || this.sel.stages.has(leadStageOf(lead))) &&
        (!this.sel.tags.size || leadInternalTags(lead).some((tag) => this.sel.tags.has(tag))) &&
        (!this.sel.waLabels.size || leadWaLabels(lead).some((tag) => this.sel.waLabels.has(tag))) &&
        (!this.sel.groups.size || leadGroups(lead).some((group) => this.sel.groups.has(group)))
      ).map(leadToContact);
    } else if (this.mode === "selection") {
      raw = this.selection.map(leadToContact);
    } else {
      raw = this.parsePasted(this.$("#campaign-contacts").value);
    }
    let spamExcluded = 0;
    if (!this.includeSpam && this.mode !== "paste") {
      const before = raw.length;
      raw = raw.filter((c) => {
        const lead = this.seg.leads.find((l) => normPhone(l.phone) === normPhone(c.phone));
        const spam = lead && normalizeType(lead.tipo) === "spam";
        if (spam) spamExcluded++;
        return !spam;
      });
      if (!spamExcluded && before !== raw.length) spamExcluded = before - raw.length;
    }
    const seen = new Set(); const contacts = []; let dupes = 0;
    for (const c of raw) {
      const key = normPhone(c.phone).slice(-10);
      if (seen.has(key)) { dupes++; continue; }
      seen.add(key); contacts.push(c);
    }
    return { contacts, dupes, spamExcluded, empty: false };
  }

  updateSummary() {
    const box = this.$("#audience-summary"); if (!box) return;
    const r = this.resolveContacts();
    if (this.mode === "crm" && r.empty) { box.innerHTML = `<span class="text-muted">Escolha uma fonte ou selecione ao menos um estágio, etiqueta ou grupo para definir a lista de destinatários.</span>`; return; }
    const names = r.contacts.slice(0, 3).map((c) => this.esc(c.name || c.phone)).join(", ");
    const excludedNote = r.spamExcluded ? ` <small class="text-muted">(${r.spamExcluded} Spam excluído${r.spamExcluded > 1 ? "s" : ""})</small>` : "";
    box.innerHTML = r.contacts.length
      ? `<strong>${r.contacts.length}</strong> contatos receberão a campanha${r.dupes ? ` <small class="text-muted">(${r.dupes} duplicados ignorados)</small>` : ""}${excludedNote}<br><small class="text-muted">${names}${r.contacts.length > 3 ? "…" : ""}</small>`
      : `<span style="color:var(--warning)">Nenhum contato com telefone neste filtro.${excludedNote}</span>`;
  }

  testMessage() {
    const t = this.$("#campaign-template").value;
    if (!t.trim()) { this.app.showToast("Escreva a mensagem primeiro.", "warning"); return; }
    const first = this.resolveContacts().contacts[0] || { name: "Maria Silva", phone: "11999999999" };
    const name = first.name || "Maria Silva";
    const vars = { nome: name, primeiro_nome: name.split(/\s+/)[0], empresa: first.company || "Empresa Teste", telefone: first.phone, estagio: first.stage || "novo", etiqueta: first.labels || "", email: first.email || "" };
    try {
      const withVars = t.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (m, k) => {
        const key = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
        return vars[key] !== undefined ? vars[key] : "";
      });
      let out = withVars, guard = 0;
      while (/\{[^{}]+\}/.test(out) && guard++ < 10) out = out.replace(/\{([^{}]+)\}/g, (m, o) => { const c = o.split("|").map((x) => x.trim()); return c[Math.floor(Math.random() * c.length)]; });
      this.app.showToast("Exemplo: " + out, "info", 8000);
    } catch (error) { this.app.showToast("Erro na mensagem: " + error.message, "error"); }
  }

  async save(startNow) {
    const name = this.$("#campaign-name").value.trim();
    const template = this.$("#campaign-template").value.trim();
    if (!name || !template) { this.app.showToast("Preencha o nome e a mensagem.", "warning"); return; }
    const r = this.resolveContacts();
    if (!r.contacts.length) { this.app.showToast(this.mode === "crm" ? "Selecione ao menos um estágio, etiqueta ou grupo do CRM com contatos." : "Nenhum contato válido.", "warning"); return; }

    const secs = (id, d) => Math.max(1, Number(this.$(id).value) || d);
    const delayMin = secs("#delay-min", 8) * 1000;
    const data = {
      name, template,
      source: this.mode === "crm" || this.mode === "selection" ? "crm" : "manual",
      audience: this.mode === "crm" ? { sourceFilter: this.sourceFilter || "all", stages: [...this.sel.stages], tags: [...this.sel.tags], waLabels: [...this.sel.waLabels], groups: [...this.sel.groups] } : null,
      contacts: r.contacts,
      delayMin, delayMax: Math.max(delayMin, secs("#delay-max", 20) * 1000),
      batchSize: Math.max(0, Math.floor(Number(this.$("#batch-size").value) || 0)),
      batchPauseMs: Math.max(0, Number(this.$("#batch-pause").value) || 0) * 60000,
      sendLimit: Math.max(0, Math.min(10000, Math.floor(Number(this.$("#campaign-send-limit").value) || 0))),
      scheduleEnabled: this.$("#schedule-enabled").checked,
      scheduleStart: this.$("#schedule-start").value, scheduleEnd: this.$("#schedule-end").value,
      moveToStage: this.mode === "paste" ? "" : this.$("#move-stage").value,
      aiPersonaId: this.$("#campaign-ai-persona")?.value || "",
      skipOwn: this.$("#skip-own").checked,
      includeSpam: this.includeSpam === true,
    };

    const btns = this.modal.querySelectorAll("#btn-create, #btn-create-start");
    btns.forEach((b) => { b.disabled = true; });
    try {
      const res = await this.app.api.createCampaign(data);
      if (!res.success) { this.app.showToast(res.error || "Erro ao criar a campanha", "error"); return; }
      this.modal.remove();
      if (this.app.router.currentRoute === "campaigns-wa") await this.app.views["campaigns-wa"]?.loadCampaigns();
      else this.app.router.navigate("campaigns-wa");
      if (startNow) {
        const s = await this.app.api.startCampaign({ campaignId: res.data.id });
        if (s.success) this.app.showToast(`Campanha iniciada para ${res.data.total} contatos!`, "success");
        else if (! ["LICENSE_REQUIRED", "FEATURE_NOT_INCLUDED", "LICENSE_PERMISSIONS_MISSING", "FEATURE_NOT_CONFIGURED"].includes(s.code)) this.app.showToast((s.error || "Não foi possível iniciar.") + " A campanha ficou salva como rascunho.", "error", 7000);
        await this.app.views["campaigns-wa"]?.loadCampaigns();
      } else this.app.showToast(`Campanha criada com ${res.data.total} contatos.`, "success");
    } catch (error) {
      this.app.showToast("Erro: " + error.message, "error");
    } finally { btns.forEach((b) => { b.disabled = false; }); }
  }

  esc(text) { const d = document.createElement("div"); d.textContent = String(text ?? ""); return d.innerHTML.replace(/"/g, "&quot;"); }
}
