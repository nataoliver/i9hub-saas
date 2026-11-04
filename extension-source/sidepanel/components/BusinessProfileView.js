import {
  BUSINESS_TYPES,
  MODULE_META,
  PROFILE_QUESTIONNAIRE,
  DEFAULT_PROFILE_ANSWERS,
  buildBusinessProfile,
  getBusinessProfile,
  detectProfileFromDescription,
} from "../../lib/profile-engine.js";

export class BusinessProfileView {
  constructor(app) {
    this.app = app;
    this.profile = null;
    this.step = 1;
    this.draft = this.emptyDraft();
    this.loading = false;
  }

  emptyDraft() {
    return {
      businessType: "generic",
      answers: {
        ...DEFAULT_PROFILE_ANSWERS,
        revenueModel: [...DEFAULT_PROFILE_ANSWERS.revenueModel],
        channels: [...DEFAULT_PROFILE_ANSWERS.channels],
        operations: [...DEFAULT_PROFILE_ANSWERS.operations],
      },
      description: "",
      name: "",
      selectedModules: [],
    };
  }

  async render(container) {
    this.container = container;
    await this.loadProfile();
    this.renderCurrent();
  }

  async loadProfile() {
    try {
      const r = await this.app.api.getBusinessProfile();
      this.profile = r?.success ? (r.data?.profile || null) : null;
      this.app.businessProfile = this.profile;
    } catch (e) {
      console.warn("[BusinessProfile] load:", e);
      this.profile = this.app.businessProfile || null;
    }
  }

  renderCurrent() {
    if (!this.container) return;
    this.container.innerHTML = this.profile && this.profile.configured
      ? this.profileHTML()
      : this.wizardHTML();
    this.bindEvents();
  }

  profileHTML() {
    const p = this.profile;
    const modules = (p.modules || []).map((id) => MODULE_META[id]).filter(Boolean);
    const fields = p.fields || [];
    const pipeline = p.pipeline || [];
    const terminology = p.terminology || {};
    return `<div class="business-profile-view">
      <header class="view-header">
        <div>
          <h2><i class="fas fa-sliders"></i> Meu negócio</h2>
          <p class="text-muted" style="margin-top:4px">O i9Leads se adapta ao seu segmento e ao seu jeito de vender.</p>
        </div>
        <button class="btn btn-primary" id="edit-business-profile"><i class="fas fa-wand-magic-sparkles"></i> Reconfigurar</button>
      </header>

      <div class="card bp-hero-card">
        <div class="bp-hero-icon"><i class="fas ${this.escapeHtml(p.icon || "fa-briefcase")}"></i></div>
        <div class="bp-hero-content">
          <span class="bp-kicker">PERFIL ATIVO</span>
          <h3>${this.escapeHtml(p.name || "Meu negócio")}</h3>
          <p>${this.escapeHtml(p.description || "Perfil personalizado pelo assistente.")}</p>
          <div class="bp-tags">
            <span class="badge">${this.escapeHtml(p.custom ? "Personalizado" : "Predefinido + personalizado")}</span>
            <span class="badge">${modules.length} módulos</span>
            <span class="badge">${fields.length} campos</span>
          </div>
        </div>
      </div>

      <div class="bp-grid-2">
        <div class="card">
          <div class="card-title"><i class="fas fa-cubes"></i> Módulos preparados</div>
          <div class="bp-module-grid">${modules.map(m => `<div class="bp-module"><i class="fas ${this.escapeHtml(m.icon)}"></i><span>${this.escapeHtml(m.label)}</span></div>`).join("")}</div>
          <small class="text-muted">O perfil apenas organiza e prepara a experiência. Você pode alterar a configuração a qualquer momento.</small>
        </div>

        <div class="card">
          <div class="card-title"><i class="fas fa-language"></i> Linguagem do CRM</div>
          <div class="bp-terminology">
            <div><span>Contato</span><strong>${this.escapeHtml(terminology.contact || "Contato")}</strong></div>
            <div><span>Oportunidade</span><strong>${this.escapeHtml(terminology.opportunity || "Oportunidade")}</strong></div>
            <div><span>Serviço</span><strong>${this.escapeHtml(terminology.service || "Serviço")}</strong></div>
            <div><span>Produto</span><strong>${this.escapeHtml(terminology.product || "Produto")}</strong></div>
            <div><span>Casos</span><strong>${this.escapeHtml(terminology.case || "Caso")}</strong></div>
          </div>
        </div>
      </div>

      <div class="bp-grid-2">
        <div class="card">
          <div class="card-title"><i class="fas fa-list"></i> Campos sugeridos</div>
          <div class="bp-field-list">${fields.slice(0, 30).map(f => `<div><span>${this.escapeHtml(f.label || f.key)}</span><small>${this.escapeHtml(f.type || "text")}</small></div>`).join("")}</div>
          ${fields.length > 30 ? `<small class="text-muted">+ ${fields.length - 30} campos</small>` : ""}
        </div>

        <div class="card">
          <div class="card-title"><i class="fas fa-filter-circle-dollar"></i> Funil sugerido</div>
          <div class="bp-pipeline">${pipeline.map((s, i) => `<div class="bp-stage"><span class="bp-stage-num">${i + 1}</span><span>${this.escapeHtml(s.title)}</span></div>`).join("")}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><i class="fas fa-robot"></i> Automações recomendadas</div>
        <div class="bp-automation-list">${(p.automations || []).map(a => `<span class="badge">${this.escapeHtml(a)}</span>`).join("") || '<span class="text-muted">Nenhuma automação específica.</span>'}</div>
      </div>

      <div class="bp-danger-zone">
        <button class="btn btn-secondary" id="reset-business-profile"><i class="fas fa-rotate-left"></i> Voltar ao perfil genérico</button>
        <span>Isso remove apenas a configuração do perfil; seus leads e campanhas permanecem.</span>
      </div>
    </div>`;
  }

  wizardHTML() {
    const d = this.draft;
    return `<div class="business-profile-view">
      <header class="view-header">
        <div>
          <h2><i class="fas fa-wand-magic-sparkles"></i> Configure seu negócio</h2>
          <p class="text-muted" style="margin-top:4px">Responda algumas perguntas. O i9Leads monta um perfil sob medida.</p>
        </div>
      </header>
      <div class="bp-stepper">
        ${[1,2,3,4].map(n => `<div class="bp-step ${n === this.step ? "active" : ""} ${n < this.step ? "done" : ""}"><span>${n < this.step ? "✓" : n}</span><small>${["Negócio","Como vende","O que controla","Revisão"][n-1]}</small></div>`).join("")}
      </div>
      <div class="card bp-wizard-card">
        ${this.step === 1 ? this.stepOne() : ""}
        ${this.step === 2 ? this.stepTwo() : ""}
        ${this.step === 3 ? this.stepThree() : ""}
        ${this.step === 4 ? this.stepFour() : ""}
        <div class="bp-wizard-footer">
          ${this.step > 1 ? `<button class="btn btn-secondary" id="bp-prev"><i class="fas fa-arrow-left"></i> Voltar</button>` : `<span></span>`}
          ${this.step < 4 ? `<button class="btn btn-primary" id="bp-next">Continuar <i class="fas fa-arrow-right"></i></button>` : `<button class="btn btn-primary" id="bp-save" ${this.loading ? "disabled" : ""}><i class="fas ${this.loading ? "fa-spinner fa-spin" : "fa-check"}"></i> ${this.loading ? "Aplicando..." : "Aplicar perfil ao CRM"}</button>`}
        </div>
      </div>
    </div>`;
  }

  stepOne() {
    return `<div class="bp-step-content">
      <span class="bp-kicker">PASSO 1 DE 4</span>
      <h3>Qual é o seu tipo de negócio?</h3>
      <p class="text-muted">Escolha o mais próximo. Depois vamos personalizar com suas respostas.</p>
      <div class="bp-business-grid">${BUSINESS_TYPES.map(p => `<button type="button" class="bp-business-card ${this.draft.businessType === p.id ? "selected" : ""}" data-business-type="${this.escapeHtml(p.id)}">
        <span class="bp-business-icon"><i class="fas ${this.escapeHtml(p.icon)}"></i></span><strong>${this.escapeHtml(p.name)}</strong><small>${this.escapeHtml(p.description)}</small>
      </button>`).join("")}
      <button type="button" class="bp-business-card custom ${this.draft.businessType === "custom" ? "selected" : ""}" data-business-type="custom">
        <span class="bp-business-icon"><i class="fas fa-wand-magic-sparkles"></i></span><strong>Outro / personalizado</strong><small>Conte como sua empresa funciona e deixe o perfil ser montado.</small>
      </button></div>
      <div class="form-group" style="margin-top:18px"><label class="form-label">Nome do perfil (opcional)</label><input class="form-input" id="bp-name" value="${this.escapeHtml(this.draft.name)}" placeholder="Ex.: Clínica Odonto Sorriso"></div>
      <div class="form-group"><label class="form-label">Descreva seu negócio (opcional, recomendado para "Outro")</label><textarea class="form-textarea" id="bp-description" rows="3" placeholder="Ex.: Somos uma empresa de manutenção de ar-condicionado e cobramos contratos mensais.">${this.escapeHtml(this.draft.description)}</textarea></div>
      ${this.draft.businessType === "custom" && this.draft.description ? this.detectedHint() : ""}
    </div>`;
  }

  detectedHint() {
    const d = detectProfileFromDescription(this.draft.description);
    if (!d?.score) return `<div class="status-badge info"><i class="fas fa-lightbulb"></i> Vou criar um perfil genérico e personalizá-lo pelas próximas respostas.</div>`;
    const p = getBusinessProfile(d.profileId);
    return `<div class="status-badge success"><i class="fas fa-wand-magic-sparkles"></i> Encontrei sinais de <strong>${this.escapeHtml(p.name)}</strong>. Você poderá ajustar tudo antes de salvar.</div>`;
  }

  stepTwo() {
    const qs = PROFILE_QUESTIONNAIRE.filter(q => q.id === "revenueModel" || q.id === "channels");
    return `<div class="bp-step-content">
      <span class="bp-kicker">PASSO 2 DE 4</span>
      <h3>Como você vende e atende?</h3>
      <p class="text-muted">Essas respostas ativam módulos importantes, como recorrência, produtos e WhatsApp.</p>
      ${qs.map(q => this.questionHTML(q)).join("")}
      <div class="form-group" style="margin-top:18px"><label class="form-label">Quantas pessoas trabalham no atendimento?</label>
        <select class="form-select" id="bp-scale">${["solo","small","medium","large"].map(v => `<option value="${v}" ${this.draft.answers.scale === v ? "selected" : ""}>${{solo:"Eu / uma pessoa",small:"2 a 5 pessoas",medium:"6 a 20 pessoas",large:"Mais de 20 pessoas"}[v]}</option>`).join("")}</select>
      </div>
    </div>`;
  }

  stepThree() {
    const q = PROFILE_QUESTIONNAIRE.find(x => x.id === "operations");
    const base = getBusinessProfile(this.draft.businessType === "custom" ? "generic" : this.draft.businessType);
    const suggested = new Set([...(base.modules || [])]);
    const options = q?.options || [];
    return `<div class="bp-step-content">
      <span class="bp-kicker">PASSO 3 DE 4</span>
      <h3>O que você quer controlar?</h3>
      <p class="text-muted">Você pode selecionar mais de uma opção. Nada é definitivo.</p>
      <div class="bp-check-grid">${options.map(o => {
        const selected = this.draft.answers.operations.includes(o.value) || (suggested.has(o.modules?.[0]) && !this.draft.answers.operations.length);
        return `<label class="bp-check-card"><input type="checkbox" data-operation="${this.escapeHtml(o.value)}" ${selected ? "checked" : ""}><span class="bp-check-content"><strong>${this.escapeHtml(o.label)}</strong><small>${(o.modules || []).map(m => this.escapeHtml(MODULE_META[m]?.label || m)).join(", ")}</small></span></label>`;
      }).join("")}</div>
      <div class="form-group" style="margin-top:18px"><label class="form-label">Você quer incluir algum módulo extra?</label>
        <div class="bp-check-grid">${Object.entries(MODULE_META).filter(([id]) => !["crm","whatsapp","campaigns","followup"].includes(id)).map(([id,m]) => `<label class="bp-mini-check"><input type="checkbox" data-module="${this.escapeHtml(id)}" ${this.draft.selectedModules.includes(id) ? "checked" : ""}><span><i class="fas ${this.escapeHtml(m.icon)}"></i> ${this.escapeHtml(m.label)}</span></label>`).join("")}</div>
      </div>
    </div>`;
  }

  stepFour() {
    const p = buildBusinessProfile(this.draft);
    const modules = p.modules.map(id => MODULE_META[id]).filter(Boolean);
    return `<div class="bp-step-content">
      <span class="bp-kicker">PASSO 4 DE 4</span>
      <h3>Pronto. Veja o que vamos configurar.</h3>
      <p class="text-muted">Você ainda pode voltar e alterar as respostas antes de aplicar.</p>
      <div class="bp-preview">
        <div class="bp-preview-head"><span class="bp-business-icon"><i class="fas ${this.escapeHtml(p.icon)}"></i></span><div><strong>${this.escapeHtml(p.name)}</strong><small>${this.escapeHtml(p.description || "Perfil personalizado")}</small></div></div>
        <div class="bp-preview-section"><strong>Módulos</strong><div class="bp-tags">${modules.map(m => `<span class="badge">${this.escapeHtml(m.label)}</span>`).join("")}</div></div>
        <div class="bp-preview-section"><strong>Campos</strong><p>${p.fields.length} campos preparados para a ficha do cliente.</p></div>
        <div class="bp-preview-section"><strong>Funil</strong><p>${p.pipeline.map(x => this.escapeHtml(x.title)).join(" → ")}</p></div>
        <div class="bp-preview-section"><strong>Classificador</strong><p>O perfil adicionará sinais comerciais específicos de ${this.escapeHtml(p.name)} às classificações de Prospecto.</p></div>
      </div>
    </div>`;
  }

  questionHTML(q) {
    const values = Array.isArray(this.draft.answers[q.id]) ? this.draft.answers[q.id] : [];
    return `<div class="bp-question"><h4>${this.escapeHtml(q.title)}</h4><div class="bp-option-grid">${q.options.map(o => `<label class="bp-option"><input type="${q.type === "single" ? "radio" : "checkbox"}" name="bp-${q.id}" data-question="${this.escapeHtml(q.id)}" data-value="${this.escapeHtml(o.value)}" ${values.includes(o.value) ? "checked" : ""}><span>${this.escapeHtml(o.label)}</span></label>`).join("")}</div></div>`;
  }

  bindEvents() {
    if (this.profile && this.profile.configured) {
      document.getElementById("edit-business-profile")?.addEventListener("click", () => {
        this.startWizard(this.profile);
      });
      document.getElementById("reset-business-profile")?.addEventListener("click", async () => {
        if (!confirm("Voltar ao perfil genérico?\n\nSeus leads, campanhas e dados não serão apagados.")) return;
        const r = await this.app.api.resetBusinessProfile();
        if (r.success) {
          this.profile = null;
          this.app.businessProfile = null;
          this.draft = this.emptyDraft();
          this.step = 1;
          this.app.showToast("Perfil removido. O CRM voltou ao modo genérico.", "success");
          this.renderCurrent();
        } else this.app.showToast(r.error || "Não foi possível remover o perfil.", "error");
      });
      return;
    }

    document.querySelectorAll("[data-business-type]").forEach(btn => btn.addEventListener("click", () => {
      this.draft.businessType = btn.dataset.businessType;
      if (this.draft.businessType !== "custom" && !this.draft.name) {
        const p = getBusinessProfile(this.draft.businessType);
        this.draft.name = p.name;
      }
      this.renderCurrent();
      const input = document.getElementById("bp-description");
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }));

    document.getElementById("bp-name")?.addEventListener("input", e => this.draft.name = e.target.value);
    document.getElementById("bp-description")?.addEventListener("input", e => { this.draft.description = e.target.value; });
    document.getElementById("bp-scale")?.addEventListener("change", e => this.draft.answers.scale = e.target.value);

    document.querySelectorAll("[data-question]").forEach(el => el.addEventListener("change", e => {
      const q = PROFILE_QUESTIONNAIRE.find(x => x.id === e.target.dataset.question);
      if (!q) return;
      if (q.type === "single") this.draft.answers[q.id] = e.target.checked ? e.target.dataset.value : "";
      else {
        const set = new Set(this.draft.answers[q.id] || []);
        if (e.target.checked) set.add(e.target.dataset.value); else set.delete(e.target.dataset.value);
        this.draft.answers[q.id] = [...set];
      }
    }));

    document.querySelectorAll("[data-operation]").forEach(el => el.addEventListener("change", e => {
      const set = new Set(this.draft.answers.operations || []);
      if (e.target.checked) set.add(e.target.dataset.operation); else set.delete(e.target.dataset.operation);
      this.draft.answers.operations = [...set];
    }));
    document.querySelectorAll("[data-module]").forEach(el => el.addEventListener("change", e => {
      const set = new Set(this.draft.selectedModules || []);
      if (e.target.checked) set.add(e.target.dataset.module); else set.delete(e.target.dataset.module);
      this.draft.selectedModules = [...set];
    }));

    document.getElementById("bp-next")?.addEventListener("click", () => {
      this.captureCurrent();
      this.step = Math.min(4, this.step + 1);
      this.renderCurrent();
    });
    document.getElementById("bp-prev")?.addEventListener("click", () => {
      this.captureCurrent();
      this.step = Math.max(1, this.step - 1);
      this.renderCurrent();
    });
    document.getElementById("bp-save")?.addEventListener("click", () => this.saveProfile());
  }

  captureCurrent() {
    const name = document.getElementById("bp-name");
    const desc = document.getElementById("bp-description");
    const scale = document.getElementById("bp-scale");
    if (name) this.draft.name = name.value;
    if (desc) this.draft.description = desc.value;
    if (scale) this.draft.answers.scale = scale.value;
    document.querySelectorAll("[data-question]").forEach(el => {
      const q = PROFILE_QUESTIONNAIRE.find(x => x.id === el.dataset.question);
      if (!q) return;
      if (q.type === "single") {
        if (el.checked) this.draft.answers[q.id] = el.dataset.value;
      } else {
        const current = new Set(this.draft.answers[q.id] || []);
        if (el.checked) current.add(el.dataset.value); else current.delete(el.dataset.value);
        this.draft.answers[q.id] = [...current];
      }
    });
    document.querySelectorAll("[data-operation]").forEach(el => {
      const current = new Set(this.draft.answers.operations || []);
      if (el.checked) current.add(el.dataset.operation); else current.delete(el.dataset.operation);
      this.draft.answers.operations = [...current];
    });
    document.querySelectorAll("[data-module]").forEach(el => {
      const current = new Set(this.draft.selectedModules || []);
      if (el.checked) current.add(el.dataset.module); else current.delete(el.dataset.module);
      this.draft.selectedModules = [...current];
    });
  }

  startWizard(profile) {
    this.step = 1;
    this.draft = this.emptyDraft();
    if (profile) {
      this.draft.businessType = profile.selectedBusinessType || profile.businessType || "generic";
      this.draft.name = profile.name || "";
      this.draft.description = profile.description || "";
      this.draft.selectedModules = (profile.modules || []).filter(m => !getBusinessProfile(this.draft.businessType).modules.includes(m));
      this.draft.answers = {
        ...this.draft.answers,
        ...(profile.answers || {}),
        revenueModel: Array.isArray(profile.answers?.revenueModel) ? [...profile.answers.revenueModel] : [...this.draft.answers.revenueModel],
        channels: Array.isArray(profile.answers?.channels) ? [...profile.answers.channels] : [...this.draft.answers.channels],
        operations: Array.isArray(profile.answers?.operations) ? [...profile.answers.operations] : [],
      };
    }
    this.profile = null;
    this.renderCurrent();
  }

  async saveProfile() {
    this.captureCurrent();
    const profile = buildBusinessProfile(this.draft);
    this.loading = true;
    this.renderCurrent();
    try {
      const r = await this.app.api.saveBusinessProfile(profile);
      if (!r.success) {
        this.app.showToast(r.error || "Não foi possível salvar o perfil.", "error", 7000);
        this.loading = false;
        return;
      }
      this.profile = r.data?.profile || profile;
      this.app.businessProfile = this.profile;
      this.loading = false;
      this.app.showToast("Perfil aplicado ao CRM. A classificação dos contatos foi atualizada.", "success", 7000);
      this.renderCurrent();
    } catch (e) {
      this.loading = false;
      this.app.showToast("Erro ao salvar perfil: " + e.message, "error");
    }
  }

  async refresh() {
    await this.loadProfile();
    this.renderCurrent();
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML.replace(/"/g, "&quot;").replace(/\'/g, "&#39;");
  }
}
