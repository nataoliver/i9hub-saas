export class FollowupsView {
  constructor(app) { this.app = app; this.container = null; this.items = []; this.counts = {}; this.settings = {}; this.templates = []; this.filter = 'all'; }

  async render(container) {
    this.container = container;
    if (!this.app.hasFeature?.('crm.followup.manage')) {
      container.innerHTML = `<div class="empty-state"><div class="icon"><i class="fas fa-lock"></i></div><h3>Follow-ups</h3><p>O gerenciamento de follow-ups depende de uma licença que inclua este módulo.</p><button class="btn btn-primary" id="followup-unlock">Conhecer funcionalidade</button></div>`;
      container.querySelector('#followup-unlock')?.addEventListener('click', () => this.app.showAccessPrompt?.('crm.followup.manage'));
      return;
    }
    container.innerHTML = this.getHTML();
    this.bindStaticEvents();
    await this.load();
  }

  getHTML() {
    return `<div class="followups-view">
      <div class="followups-header">
        <div><h2><i class="fas fa-clock"></i> Follow-ups</h2><p class="text-muted">Acompanhe mensagens programadas, retornos pendentes e sequências de relacionamento.</p></div>
        <button class="btn btn-secondary" id="followups-refresh"><i class="fas fa-rotate"></i> Atualizar</button>
      </div>
      <div class="followups-stats" id="followups-stats"></div>
      <section class="form-section followups-settings">
        <div class="form-section-title"><i class="fas fa-shield-halved"></i> Regras de envio e segurança</div>
        <div class="followups-settings-grid">
          <label>Intervalo mínimo entre mensagens (minutos)<input class="form-input" type="number" id="followup-min-interval" min="0" max="1440" value="240"></label>
          <label>Máximo por contato em 24h<input class="form-input" type="number" id="followup-max-contact" min="1" max="10" value="3"></label>
          <label>Máximo total em 24h<input class="form-input" type="number" id="followup-max-total" min="1" max="200" value="30"></label>
          <label class="followup-quiet-toggle"><input type="checkbox" id="followup-quiet-enabled" checked> Respeitar horário de silêncio</label>
          <label>Início do silêncio<input class="form-input" type="time" id="followup-quiet-start" value="20:00"></label>
          <label>Fim do silêncio<input class="form-input" type="time" id="followup-quiet-end" value="08:00"></label>
        </div>
        <p class="text-muted">Padrão: não enviar entre 20h e 8h; até 3 mensagens por contato em 24h e intervalo mínimo de 4 horas. Ajuste conforme sua política comercial e consentimento dos contatos.</p>
        <button class="btn btn-primary" id="followup-save-settings"><i class="fas fa-save"></i> Salvar regras</button>
      </section>
      <section class="form-section followups-template-section">
        <div class="form-section-title"><i class="fas fa-file-lines"></i> Modelos de mensagem</div>
        <div id="followup-templates" class="followup-templates"></div>
        <div class="followup-template-editor">
          <input class="form-input" id="followup-template-name" maxlength="80" placeholder="Nome do modelo">
          <textarea class="form-input" id="followup-template-message" maxlength="2500" rows="3" placeholder="Mensagem com variáveis como {{nome}} e {{servico}}"></textarea>
          <button class="btn btn-secondary" id="followup-template-add"><i class="fas fa-plus"></i> Adicionar modelo</button>
        </div>
        <small class="text-muted">Os modelos são apenas rascunhos reutilizáveis. O envio continua sujeito a autorização, licença e limites de segurança.</small>
      </section>
      <section class="form-section">
        <div class="followups-list-header">
          <div><div class="form-section-title"><i class="fas fa-list-check"></i> Agendamentos</div><p class="text-muted">Itens vencidos não são enviados automaticamente após indisponibilidade do navegador; revise e escolha enviar ou reagendar.</p></div>
          <select class="form-select" id="followups-filter"><option value="all">Todos os status</option><option value="scheduled">Agendados</option><option value="overdue">Aguardando ação</option><option value="sent">Enviados</option><option value="failed">Falhas</option><option value="cancelled">Cancelados</option><option value="blocked_consent">Sem consentimento</option><option value="blocked_blacklist">Black list</option><option value="blocked_frequency">Limite de frequência</option><option value="blocked_license">Licença</option><option value="blocked_spam">Spam/bloqueado</option></select>
        </div>
        <div id="followups-list" class="followups-list"><div class="crm-history-empty">Carregando...</div></div>
      </section>
    </div>`;
  }

  bindStaticEvents() {
    this.container.querySelector('#followups-refresh')?.addEventListener('click', () => this.load());
    this.container.querySelector('#followups-filter')?.addEventListener('change', (event) => { this.filter = event.target.value; this.renderItems(); });
    this.container.querySelector('#followup-save-settings')?.addEventListener('click', () => this.saveSettings());
    this.container.querySelector('#followup-template-add')?.addEventListener('click', () => this.addTemplate());
  }

  async load() {
    const [followups, settings, templates] = await Promise.all([
      this.app.api.getFollowups({ limit: 1000 }),
      this.app.api.getFollowupSettings(),
      this.app.api.getFollowupTemplates(),
    ]);
    if (!followups?.success) {
      const list = this.container.querySelector('#followups-list');
      if (list) list.innerHTML = `<div class="crm-history-empty">${this.escapeHtml(followups?.error || 'Não foi possível carregar os agendamentos.')}</div>`;
      return;
    }
    this.items = followups.data?.items || [];
    this.counts = followups.data?.counts || {};
    this.settings = settings?.data || {};
    this.templates = templates?.data || [];
    this.fillSettings();
    this.renderStats();
    this.renderTemplates();
    this.renderItems();
  }

  fillSettings() {
    const set = (id, value) => { const el = this.container.querySelector(`#${id}`); if (el) el.value = value; };
    set('followup-min-interval', this.settings.minIntervalMinutes ?? 240);
    set('followup-max-contact', this.settings.maxPerContactDaily ?? 3);
    set('followup-max-total', this.settings.maxDailyTotal ?? 30);
    set('followup-quiet-start', this.settings.quietHoursStart || '20:00');
    set('followup-quiet-end', this.settings.quietHoursEnd || '08:00');
    const quiet = this.container.querySelector('#followup-quiet-enabled');
    if (quiet) quiet.checked = this.settings.quietHoursEnabled !== false;
  }

  renderStats() {
    const data = [
      ['Agendados', this.counts.scheduled || 0, 'fa-calendar-check'],
      ['Aguardando ação', this.counts.overdue || 0, 'fa-bell'],
      ['Enviados', this.counts.sent || 0, 'fa-paper-plane'],
      ['Falhas', this.counts.failed || 0, 'fa-triangle-exclamation'],
      ['Cancelados', this.counts.cancelled || 0, 'fa-ban'],
    ];
    const el = this.container.querySelector('#followups-stats');
    if (el) el.innerHTML = data.map(([label, value, icon]) => `<div class="followups-stat"><i class="fas ${icon}"></i><strong>${Number(value)}</strong><span>${label}</span></div>`).join('');
  }

  renderTemplates() {
    const el = this.container.querySelector('#followup-templates');
    if (!el) return;
    el.innerHTML = this.templates.length ? this.templates.map((item) => `<div class="followup-template-chip"><div><strong>${this.escapeHtml(item.name)}</strong><small>${this.escapeHtml(item.message.slice(0, 100))}</small></div><button type="button" class="btn-icon" data-template-remove="${this.escapeHtml(item.id)}" title="Remover modelo"><i class="fas fa-trash"></i></button></div>`).join('') : '<p class="text-muted">Nenhum modelo salvo.</p>';
    el.querySelectorAll('[data-template-remove]').forEach((button) => button.addEventListener('click', async () => {
      this.templates = this.templates.filter((item) => item.id !== button.dataset.templateRemove);
      const saved = await this.app.api.saveFollowupTemplates(this.templates);
      if (saved?.success) this.renderTemplates();
      else this.app.showToast(saved?.error || 'Não foi possível remover o modelo.', 'error');
    }));
  }

  async addTemplate() {
    const name = String(this.container.querySelector('#followup-template-name')?.value || '').trim();
    const message = String(this.container.querySelector('#followup-template-message')?.value || '').trim();
    if (!name || !message) { this.app.showToast('Informe o nome e a mensagem do modelo.', 'warning'); return; }
    if (this.templates.some((item) => item.name.toLowerCase() === name.toLowerCase())) { this.app.showToast('Já existe um modelo com esse nome.', 'warning'); return; }
    this.templates.push({ id: `tpl_${Date.now().toString(36)}`, name, message });
    const saved = await this.app.api.saveFollowupTemplates(this.templates);
    if (!saved?.success) { this.app.showToast(saved?.error || 'Não foi possível salvar o modelo.', 'error'); return; }
    this.templates = saved.data || this.templates;
    this.container.querySelector('#followup-template-name').value = '';
    this.container.querySelector('#followup-template-message').value = '';
    this.renderTemplates();
    this.app.showToast('Modelo salvo.', 'success');
  }

  async saveSettings() {
    const read = (id) => this.container.querySelector(`#${id}`);
    const settings = {
      minIntervalMinutes: Number(read('followup-min-interval')?.value),
      maxPerContactDaily: Number(read('followup-max-contact')?.value),
      maxDailyTotal: Number(read('followup-max-total')?.value),
      quietHoursEnabled: read('followup-quiet-enabled')?.checked === true,
      quietHoursStart: read('followup-quiet-start')?.value || '20:00',
      quietHoursEnd: read('followup-quiet-end')?.value || '08:00',
    };
    const result = await this.app.api.saveFollowupSettings(settings);
    this.app.showToast(result?.success ? 'Regras de envio salvas.' : (result?.error || 'Não foi possível salvar.'), result?.success ? 'success' : 'error');
    if (result?.success) { this.settings = result.data; this.fillSettings(); }
  }

  renderItems() {
    const el = this.container.querySelector('#followups-list');
    if (!el) return;
    const statusLabels = {
      scheduled: 'Agendado', processing: 'Enviando', sent: 'Enviado', failed: 'Falha',
      overdue: 'Aguardando ação', cancelled: 'Cancelado', blocked_consent: 'Sem consentimento',
      blocked_blacklist: 'Black list', blocked_spam: 'Spam/bloqueado', blocked_license: 'Licença',
      blocked_frequency: 'Limite de frequência',
    };
    const items = this.items.filter((item) => this.filter === 'all' || item.status === this.filter);
    if (!items.length) {
      el.innerHTML = '<div class="crm-history-empty"><i class="fas fa-calendar-check"></i><strong>Nenhum agendamento encontrado</strong><span>Os follow-ups dos leads aparecerão aqui.</span></div>';
      return;
    }
    el.innerHTML = items.map((item) => {
      const canSend = ['scheduled', 'overdue', 'failed', 'blocked_license', 'blocked_blacklist', 'blocked_spam', 'blocked_frequency'].includes(item.status) && this.app.hasFeature?.('crm.followup.send');
      const canCancel = ['scheduled', 'overdue', 'failed', 'blocked_license', 'blocked_blacklist', 'blocked_spam', 'blocked_frequency'].includes(item.status);
      const canDelete = ['sent', 'cancelled'].includes(item.status) || String(item.status).startsWith('blocked_');
      const lead = this.escapeHtml(item.leadName || 'Lead');
      const phone = this.escapeHtml(item.phone || '');
      const message = this.escapeHtml(item.message || '');
      return `<article class="followup-row">
        <div class="followup-row-main">
          <div class="followup-row-top"><strong>${lead}</strong><span class="crm-followup-status status-${this.escapeHtml(item.status)}">${this.escapeHtml(statusLabels[item.status] || item.status)}</span></div>
          <small>${phone} · ${this.escapeHtml(this.formatDate(item.scheduledAt))}${item.stepCount > 1 ? ` · Etapa ${Number(item.stepIndex) || 1}/${Number(item.stepCount) || 1}` : ''}</small>
          <p>${message}</p>
          ${item.lastError ? `<small class="crm-followup-warning">${this.escapeHtml(item.lastError)}</small>` : ''}
        </div>
        <div class="followup-row-actions">
          <button type="button" class="btn btn-sm btn-secondary" data-followup-open="${this.escapeHtml(item.leadId)}">Abrir lead</button>
          ${canSend ? `<button type="button" class="btn btn-sm btn-primary" data-followup-send="${this.escapeHtml(item.id)}">Enviar agora</button>` : ''}
          ${canCancel ? `<button type="button" class="btn btn-sm btn-secondary" data-followup-reschedule="${this.escapeHtml(item.id)}">Reagendar</button><button type="button" class="btn btn-sm btn-danger" data-followup-cancel="${this.escapeHtml(item.id)}">Cancelar</button>` : ''}
          ${canDelete ? `<button type="button" class="btn btn-sm btn-secondary" data-followup-delete="${this.escapeHtml(item.id)}"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </article>`;
    }).join('');
    el.querySelectorAll('[data-followup-send]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      const result = await this.app.api.sendFollowupNow(button.dataset.followupSend);
      this.app.showToast(result?.success ? 'Follow-up enviado.' : (result?.error || 'Envio não confirmado.'), result?.success ? 'success' : 'warning', 6000);
      await this.load();
    }));
    el.querySelectorAll('[data-followup-cancel]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Cancelar este follow-up?')) return;
      const result = await this.app.api.cancelFollowup(button.dataset.followupCancel);
      this.app.showToast(result?.success ? 'Follow-up cancelado.' : (result?.error || 'Falha ao cancelar.'), result?.success ? 'success' : 'error');
      await this.load();
    }));
    el.querySelectorAll('[data-followup-reschedule]').forEach((button) => button.addEventListener('click', async () => {
      const value = prompt('Nova data e hora local (AAAA-MM-DDTHH:mm):');
      if (!value) return;
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) { this.app.showToast('Data inválida.', 'warning'); return; }
      const result = await this.app.api.rescheduleFollowup(button.dataset.followupReschedule, date.toISOString());
      this.app.showToast(result?.success ? 'Agendamento atualizado.' : (result?.error || 'Falha ao reagendar.'), result?.success ? 'success' : 'error');
      await this.load();
    }));
    el.querySelectorAll('[data-followup-delete]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Excluir este registro?')) return;
      const result = await this.app.api.deleteFollowup(button.dataset.followupDelete);
      this.app.showToast(result?.success ? 'Registro excluído.' : (result?.error || 'Falha ao excluir.'), result?.success ? 'success' : 'error');
      await this.load();
    }));
    el.querySelectorAll('[data-followup-open]').forEach((button) => button.addEventListener('click', async () => {
      const leads = await this.app.api.getSavedLeads();
      const lead = leads?.data?.find((item) => String(item.id || item.placeId || item.phone) === button.dataset.followupOpen);
      if (lead) this.app.leadModal.show(lead);
      else this.app.showToast('Lead não encontrado. Atualize o CRM.', 'warning');
    }));
  }

  formatDate(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : 'Data não definida';
  }
  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
}
