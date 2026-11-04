import { STAGE_LIST, stageTitle } from "../utils/segments.js";
import { TYPE_VALUES, TYPE_META, normalizeType, INTENT_VALUES, URGENCY_LEVELS } from "../../lib/classifier.js";
import { buildFeedbackEntry, recordFeedback } from "../../lib/classifier-feedback.js";
import { buildCrmTimeline } from "../../lib/crm-history.js";

export class LeadModal {
  constructor(app) { this.app = app; }

  show(lead) {
    const modal = document.createElement("div");
    modal.className = "modal-overlay open";
    modal.innerHTML = this.getHTML(lead || {});
    document.body.appendChild(modal);
    this.bindEvents(modal, lead || {});
    this.bindClassifierEvents(modal, lead || {});
    this.loadFollowups(modal, lead || {}).catch(() => {});
    this.loadCalendar(modal, lead || {}).catch(() => {});
    this.loadCommercialOptions(modal).catch(() => {});
  }

  getHTML(lead) {
    const phone = String(lead.phone || "").trim().slice(0, 40);
    const phoneDigits = phone.replace(/\D/g, "").slice(0, 15);
    const email = String(lead.email || "").trim().slice(0, 254);
    const hasWhatsApp = phoneDigits.length >= 10;
    const hasEmail = email.includes("@");
    const website = this.safeHttpUrl(lead.website);
    const ratingValue = Number(lead.rating);
    const rating = Number.isFinite(ratingValue) && ratingValue > 0 && ratingValue <= 5
      ? `<i class="fas fa-star text-warning"></i> ${ratingValue.toFixed(1)}` : "-";
    const value = Number(lead.value);
    const valueLabel = Number.isFinite(value) && value > 0 ? `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-";

    return `<div class="modal modal-lg">
      <div class="modal-header"><h3 class="modal-title"><i class="fas fa-user"></i> ${this.escapeHtml(lead.name || "Sem nome")}</h3><button class="modal-close" aria-label="Fechar">&times;</button></div>
      <div class="modal-body"><div class="detail-grid">
        <div class="detail-item"><label>Telefone</label><div style="display:flex;gap:8px;align-items:center"><span>${this.escapeHtml(phone || "-")}</span>
          ${hasWhatsApp ? `<button type="button" class="btn-icon" data-action="open-whatsapp" data-feature="whatsapp.connection" data-phone="${this.escapeHtml(phoneDigits)}" title="Abrir no WhatsApp"><i class="fab fa-whatsapp text-success"></i></button>` : ""}
          ${hasWhatsApp ? `<button type="button" class="btn-icon" data-action="copy-value" data-copy="${this.escapeHtml(phone)}" title="Copiar telefone"><i class="fas fa-copy"></i></button>` : ""}
        </div></div>
        <div class="detail-item"><label>Email</label><div style="display:flex;gap:8px;align-items:center"><span>${this.escapeHtml(email || "-")}</span>
          ${hasEmail ? `<button type="button" class="btn-icon" data-action="send-email" data-feature="crm.communication.email" title="Enviar e-mail pelo CRM"><i class="fas fa-paper-plane"></i></button>` : ""}
          ${hasEmail ? `<button type="button" class="btn-icon" data-action="copy-value" data-copy="${this.escapeHtml(email)}" title="Copiar e-mail"><i class="fas fa-copy"></i></button>` : ""}
        </div></div>
        <div class="detail-item"><label>Categoria</label><span class="badge">${this.escapeHtml(lead.category || "-")}</span></div>
        <div class="detail-item"><label>Origem</label><span class="badge">${this.escapeHtml(this.formatSource(lead.source))}</span></div>
        <div class="detail-item"><label>Estágio</label><span class="badge badge-${this.getStageColor(lead.stage)}">${this.escapeHtml(this.formatStage(lead.stage))}</span></div>
        <div class="detail-item"><label>Tipo</label>${this.typeBadgeHTML(lead)}<small class="text-muted">${this.escapeHtml(lead.tipoMotivo || "")}</small></div>
        ${this.classifierDetailsHTML(lead)}
        <div class="detail-item"><label>Avaliação</label><span>${rating}</span></div>
        <div class="detail-item"><label>Valor</label><span>${valueLabel}</span></div>
        <div class="detail-item"><label>Data</label><span>${this.escapeHtml(lead.extractedAt ? this.formatDate(lead.extractedAt) : "-")}</span></div>
        ${lead.address ? `<div class="detail-item full-width"><label>Endereço</label><span>${this.escapeHtml(lead.address)}</span></div>` : ""}
        ${website ? `<div class="detail-item full-width"><label>Site</label><a href="${this.escapeHtml(website)}" target="_blank" rel="noopener noreferrer" style="color:var(--primary)">${this.escapeHtml(website)}</a></div>` : (lead.website ? `<div class="detail-item full-width"><label>Site</label><span>${this.escapeHtml(String(lead.website).slice(0, 500))}</span></div>` : "")}
      </div>
      ${this.identityEditorHTML(lead)}
      ${this.aiIntelligenceHTML(lead)}
      ${this.nicheClassificationHTML(lead)}
      ${this.customFieldsHTML(lead)}
      ${this.commercialFieldsHTML(lead)}
      ${this.crmCommunicationHistoryHTML(lead)}
      ${this.crmEmailConsentHTML(lead)}
      <div class="form-section" style="margin-top:20px"><div class="form-section-title"><i class="fas fa-exchange-alt"></i> Mover estágio</div>
        <div class="btn-group" style="flex-wrap:wrap">${STAGE_LIST.map(st => st.id).map(stage => `<button type="button" class="btn btn-${stage === lead.stage ? "primary" : "secondary"} stage-btn" data-stage="${this.escapeHtml(stage)}">${this.escapeHtml(this.formatStage(stage))}</button>`).join("")}</div>
      </div>
      <div class="form-section" style="margin-top:20px"><div class="form-section-title"><i class="fas fa-tags"></i> Classificação</div>
        <p class="text-muted" style="font-size:12px;margin-bottom:8px">Tipo: ${this.typeBadgeHTML(lead)}</p>
        <div class="btn-group" style="flex-wrap:wrap">${TYPE_VALUES.map(type => `<button type="button" class="btn btn-${normalizeType(lead.tipo) === type ? "primary" : "secondary"} type-btn" data-type="${this.escapeHtml(type)}"><i class="fas ${TYPE_META[type].icon}"></i> ${this.escapeHtml(TYPE_META[type].label)}</button>`).join("")}</div>
        <small class="text-muted" style="display:block;margin-top:8px">${this.escapeHtml(lead.tipoMotivo || "Sem motivo registrado.")}</small>
      </div>
      ${this.crmHistoryHTML(lead)}
      ${this.followupHTML(lead)}
      ${this.calendarHTML(lead)}
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-secondary modal-close">Fechar</button><button type="button" class="btn btn-danger" id="delete-lead"><i class="fas fa-trash"></i> Excluir</button></div>
    </div>`;
  }

  calendarHTML(lead) {
    const canConnect = this.app.hasFeature?.('google.calendar.connect') === true;
    const canAvailability = this.app.hasFeature?.('google.calendar.availability') === true;
    const canBooking = this.app.hasFeature?.('google.calendar.booking') === true;
    const canSendWhatsAppConfirmation = ['whatsapp.connection', 'compliance.consent_tracking', 'compliance.optout_management', 'compliance.frequency_limits'].every((id) => this.app.hasFeature?.(id) === true);
    if (!canConnect) return `<section class="form-section crm-calendar-section" data-feature="google.calendar.connect"><div class="form-section-title"><i class="fas fa-calendar-days"></i> Google Agenda</div><p class="text-muted">Integração disponível em planos com Google Agenda.</p><button type="button" class="btn btn-secondary" data-calendar-unlock="google.calendar.connect">Conhecer funcionalidade</button></section>`;
    if (!canAvailability || !canBooking) return `<section class="form-section crm-calendar-section" data-feature="google.calendar.connect"><div class="form-section-title"><i class="fas fa-calendar-days"></i> Google Agenda</div><p class="text-muted">Sua licença não libera consulta de disponibilidade e reservas.</p><button type="button" class="btn btn-secondary" data-calendar-unlock="google.calendar.booking">Solicitar liberação</button></section>`;
    const date = new Date();
    const dateValue = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const requestKey = (globalThis.crypto?.randomUUID?.() || `i9cal_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
    return `<section class="form-section crm-calendar-section" data-feature="google.calendar.booking" data-calendar-request-key="${this.escapeHtml(requestKey)}" style="margin-top:20px">
      <div class="form-section-title"><i class="fas fa-calendar-check"></i> Google Agenda</div>
      <p class="text-muted" style="font-size:12px;margin:0 0 10px">Consulte a disponibilidade real da sua agenda e reserve um horário para este lead. A reserva só é confirmada depois da resposta positiva do Google.</p>
      <div id="crm-calendar-status" class="crm-calendar-status">Verificando conexão...</div>
      <div class="crm-calendar-booking" id="crm-calendar-booking" hidden>
        <div class="crm-calendar-search-grid">
          <label>Data do atendimento<input class="form-input" id="crm-calendar-date" type="date" min="${dateValue}" value="${dateValue}"></label>
          <label>Duração<select class="form-select" id="crm-calendar-duration"><option value="15">15 minutos</option><option value="30" selected>30 minutos</option><option value="45">45 minutos</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option></select></label>
        </div>
        <button type="button" class="btn btn-secondary" id="crm-calendar-find-slots"><i class="fas fa-search"></i> Consultar horários livres</button>
        <div id="crm-calendar-slots" class="crm-calendar-slots"><small class="text-muted">Escolha uma data para consultar os horários.</small></div>
        <div id="crm-calendar-selected" class="crm-calendar-selected" hidden>
          <strong>Horário selecionado: <span id="crm-calendar-selected-label"></span></strong>
          <label>Título do compromisso<input class="form-input" id="crm-calendar-summary" maxlength="200" value="Atendimento — ${this.escapeHtml(lead.name || 'Lead')}"></label>
          <label>Observações para a agenda<textarea class="form-input" id="crm-calendar-note" rows="2" maxlength="1200" placeholder="Informações adicionais para este compromisso..."></textarea></label>
          ${lead.email ? `<label class="crm-calendar-invite"><input type="checkbox" id="crm-calendar-invite-email"> Enviar convite para ${this.escapeHtml(lead.email)} por e-mail</label>` : ''}
          ${canSendWhatsAppConfirmation ? '<label class="crm-calendar-invite"><input type="checkbox" id="crm-calendar-send-wa-confirmation"> Enviar confirmação pelo WhatsApp após reservar (exige consentimento válido)</label>' : ''}
          <small class="text-muted">O convite por e-mail só será enviado se você marcar a opção acima. ${canSendWhatsAppConfirmation ? 'A confirmação pelo WhatsApp exige consentimento registrado e respeita a Black list, os limites e o horário de silêncio.' : 'O envio de confirmação pelo WhatsApp depende também das permissões de conexão e conformidade da licença.'}</small>
          <button type="button" class="btn btn-primary" id="crm-calendar-book"><i class="fas fa-calendar-plus"></i> Confirmar reserva</button>
        </div>
      </div>
      <div class="crm-calendar-events-wrap"><div class="crm-calendar-events-head"><strong>Compromissos deste lead</strong><button type="button" class="btn btn-sm btn-secondary" id="crm-calendar-refresh"><i class="fas fa-rotate"></i> Atualizar</button></div><div id="crm-calendar-events" class="crm-calendar-events"><small class="text-muted">Carregando compromissos...</small></div></div>
    </section>`;
  }

  async loadCalendar(modal, lead) {
    const status = modal.querySelector('#crm-calendar-status');
    const booking = modal.querySelector('#crm-calendar-booking');
    const eventsContainer = modal.querySelector('#crm-calendar-events');
    if (!status) return;
    const result = await this.app.api.getGoogleCalendarStatus();
    const config = result?.data || {};
    const connected = config.connected === true && config.permissionGranted === true;
    if (!connected) {
      status.innerHTML = `<div class="crm-calendar-warning">Google Agenda não conectado neste navegador. <button type="button" class="btn btn-sm btn-secondary" id="crm-calendar-open-settings">Conectar agenda</button></div>`;
      if (booking) booking.hidden = true;
      modal.querySelector('#crm-calendar-open-settings')?.addEventListener('click', async () => {
        modal.remove(); this.app.router.navigate('settings');
        setTimeout(() => document.querySelector('.tab-btn[data-tab="calendar"]')?.click(), 250);
      });
    } else {
      status.innerHTML = `<div class="status-badge success"><i class="fas fa-calendar-check"></i> Conectado · ${this.escapeHtml(config.calendarSummary || 'Google Agenda')} · fuso local ${this.escapeHtml(config.timeZone || '')}</div>`;
      if (booking) booking.hidden = false;
      const duration = modal.querySelector('#crm-calendar-duration');
      if (duration) duration.value = String(config.defaultDurationMinutes || 30);
    }
    await this.loadCalendarEvents(modal, lead);
  }

  async findCalendarSlots(modal) {
    const date = modal.querySelector('#crm-calendar-date')?.value || '';
    const durationMinutes = Number(modal.querySelector('#crm-calendar-duration')?.value || 30);
    const container = modal.querySelector('#crm-calendar-slots');
    const button = modal.querySelector('#crm-calendar-find-slots');
    if (!date || !container) { this.app.showToast('Escolha uma data válida.', 'warning'); return; }
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Consultando...'; }
    container.innerHTML = '<small class="text-muted">Consultando disponibilidade no Google...</small>';
    const result = await this.app.api.getGoogleCalendarAvailability(date, durationMinutes);
    if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-search"></i> Consultar horários livres'; }
    if (!result?.success) { container.innerHTML = `<div class="crm-calendar-warning">${this.escapeHtml(result?.error || 'Não foi possível consultar a agenda.')}</div>`; return; }
    const slots = Array.isArray(result.data?.slots) ? result.data.slots : [];
    if (!slots.length) { container.innerHTML = '<div class="crm-calendar-empty">Nenhum horário livre encontrado nesta data e dentro do expediente configurado.</div>'; return; }
    container.innerHTML = `<div class="crm-calendar-slot-grid">${slots.map((slot) => `<button type="button" class="btn btn-sm btn-secondary crm-calendar-slot" data-calendar-slot="${this.escapeHtml(slot.start)}" data-calendar-end="${this.escapeHtml(slot.end)}">${this.escapeHtml(slot.label)}</button>`).join('')}</div>`;
    container.querySelectorAll('[data-calendar-slot]').forEach((slotButton) => slotButton.addEventListener('click', () => {
      container.querySelectorAll('[data-calendar-slot]').forEach((item) => item.classList.toggle('is-selected', item === slotButton));
      const selected = modal.querySelector('#crm-calendar-selected');
      const label = modal.querySelector('#crm-calendar-selected-label');
      if (label) label.textContent = `${new Date(slotButton.dataset.calendarSlot).toLocaleString('pt-BR')} (${result.data.durationMinutes} min)`;
      if (selected) { selected.hidden = false; selected.dataset.start = slotButton.dataset.calendarSlot; selected.dataset.end = slotButton.dataset.calendarEnd; }
    }));
  }

  async createCalendarBooking(modal, lead) {
    const selected = modal.querySelector('#crm-calendar-selected');
    const start = selected?.dataset.start || ''; const end = selected?.dataset.end || '';
    if (!start || !end) { this.app.showToast('Selecione um horário disponível.', 'warning'); return; }
    const button = modal.querySelector('#crm-calendar-book');
    const booking = {
      start, end,
      summary: modal.querySelector('#crm-calendar-summary')?.value || '',
      note: modal.querySelector('#crm-calendar-note')?.value || '',
      inviteLeadByEmail: modal.querySelector('#crm-calendar-invite-email')?.checked === true,
      sendWhatsAppConfirmation: modal.querySelector('#crm-calendar-send-wa-confirmation')?.checked === true,
    };
    if (booking.inviteLeadByEmail && !lead.email) { this.app.showToast('Este lead não possui e-mail válido.', 'warning'); return; }
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reservando...'; }
    const section = modal.querySelector('.crm-calendar-section');
    const requestKey = section?.dataset.calendarRequestKey || `i9cal_${Date.now()}`;
    const result = await this.app.api.createLeadCalendarEvent(lead.id || lead.placeId || lead.phone, booking, requestKey);
    if (!result?.success) {
      if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-calendar-plus"></i> Confirmar reserva'; }
      this.app.showToast(result?.error || 'Não foi possível reservar o horário.', 'error', 7000);
      if (result?.code === 'CALENDAR_SLOT_TAKEN') await this.findCalendarSlots(modal);
      return;
    }
    let confirmationResult = null;
    if (booking.sendWhatsAppConfirmation) confirmationResult = await this.app.api.sendCalendarConfirmation(lead.id || lead.placeId || lead.phone, result.data?.eventId);
    this.app.showToast(confirmationResult ? (confirmationResult.success ? 'Compromisso reservado e confirmação enviada pelo WhatsApp.' : `Compromisso reservado, mas a confirmação não foi enviada: ${confirmationResult.error || 'verifique o WhatsApp.'}`) : 'Compromisso reservado no Google Agenda.', confirmationResult && !confirmationResult.success ? 'warning' : 'success', 7000);
    const latest = await this.app.api.getSavedLeads();
    const updatedLead = latest?.data?.find((item) => String(item.id || item.placeId || item.phone) === String(lead.id || lead.placeId || lead.phone));
    if (updatedLead) Object.assign(lead, updatedLead);
    modal.remove(); this.show(lead);
  }

  async loadCalendarEvents(modal, lead) {
    const container = modal.querySelector('#crm-calendar-events');
    if (!container) return;
    const result = await this.app.api.getLeadCalendarEvents(lead.id || lead.placeId || lead.phone);
    if (!result?.success) { container.innerHTML = `<small class="text-muted">${this.escapeHtml(result?.error || 'Não foi possível carregar compromissos.')}</small>`; return; }
    const events = Array.isArray(result.data) ? result.data : [];
    const active = events.filter((event) => event.status !== 'cancelled');
    if (!active.length) { container.innerHTML = '<div class="crm-calendar-empty">Nenhum compromisso registrado para este lead.</div>'; return; }
    container.innerHTML = active.map((event) => {
      const date = new Date(event.start);
      const dateLabel = Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : 'Data não definida';
      const outcomeLabel = event.outcome === 'completed' ? ' · Realizada' : event.outcome === 'no_show' ? ' · Não compareceu' : '';
      const status = event.syncStatus === 'pending' ? 'Atualização pendente' : 'Sincronizado';
      const eventEnd = Date.parse(event.end || event.start || '');
      const eventStart = Date.parse(event.start || '');
      const canRecordOutcome = !event.outcome && Number.isFinite(eventEnd) && eventEnd <= Date.now();
      const canCancel = Number.isFinite(eventStart) && eventStart > Date.now();
      const canSendConfirmation = ['whatsapp.connection', 'compliance.consent_tracking', 'compliance.optout_management', 'compliance.frequency_limits'].every((id) => this.app.hasFeature?.(id) === true);
      return `<article class="crm-calendar-event"><div class="crm-calendar-event-main"><strong>${this.escapeHtml(event.summary || 'Atendimento')}</strong><small>${this.escapeHtml(dateLabel)} · ${this.escapeHtml(status + outcomeLabel)}</small>${event.htmlLink ? `<a href="${this.escapeHtml(event.htmlLink)}" target="_blank" rel="noopener noreferrer">Abrir no Google Agenda</a>` : ''}${event.lastSyncError ? `<small class="crm-calendar-warning">${this.escapeHtml(event.lastSyncError)}</small>` : ''}${event.confirmationStatus === 'failed' ? `<small class="crm-calendar-warning">Confirmação não enviada: ${this.escapeHtml(event.confirmationError || 'falha no WhatsApp')}</small>` : ''}</div><div class="crm-calendar-event-actions">${event.syncStatus === 'pending' ? `<button type="button" class="btn btn-sm btn-secondary" data-calendar-sync="${this.escapeHtml(event.eventId)}">Sincronizar dados</button>` : ''}${canSendConfirmation ? `<button type="button" class="btn btn-sm btn-secondary" data-calendar-confirm="${this.escapeHtml(event.eventId)}" ${event.confirmationStatus === 'sent' ? 'disabled' : ''}>${event.confirmationStatus === 'sent' ? 'Confirmação enviada' : 'Enviar confirmação'}</button>` : ''}${canRecordOutcome ? `<button type="button" class="btn btn-sm btn-primary" data-calendar-outcome="completed" data-event-id="${this.escapeHtml(event.eventId)}">Realizada</button><button type="button" class="btn btn-sm btn-secondary" data-calendar-outcome="no_show" data-event-id="${this.escapeHtml(event.eventId)}">Não compareceu</button>` : ''}${canCancel ? `<button type="button" class="btn btn-sm btn-secondary" data-calendar-reschedule="${this.escapeHtml(event.eventId)}">Reagendar</button><button type="button" class="btn btn-sm btn-danger" data-calendar-cancel="${this.escapeHtml(event.eventId)}">Cancelar</button>` : ''}</div></article>`;
    }).join('');
    container.querySelectorAll('[data-calendar-sync]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      const result = await this.app.api.syncLeadCalendarEvents(lead.id || lead.placeId || lead.phone, ['identity']);
      this.app.showToast(result?.success ? `${result.data?.synced || 0} compromisso(s) sincronizado(s).` : (result?.error || 'Não foi possível sincronizar.'), result?.success && !result.data?.pending ? 'success' : 'warning', 6000);
      await this.loadCalendarEvents(modal, lead);
    }));
    container.querySelectorAll('[data-calendar-confirm]').forEach((button) => button.addEventListener('click', async () => {
      const event = active.find((item) => item.eventId === button.dataset.calendarConfirm);
      if (event?.confirmationStatus === 'sent') { this.app.showToast('A confirmação deste compromisso já foi enviada.', 'info'); return; }
      if (!confirm('Enviar agora a confirmação deste compromisso pelo WhatsApp Web? O envio exige consentimento válido do contato e respeita os limites de segurança.')) return;
      button.disabled = true;
      const result = await this.app.api.sendCalendarConfirmation(lead.id || lead.placeId || lead.phone, event.eventId);
      this.app.showToast(result?.success ? 'Confirmação enviada pelo WhatsApp.' : (result?.error || 'Não foi possível enviar a confirmação.'), result?.success ? 'success' : 'error', 7000);
      await this.loadCalendarEvents(modal, lead);
    }));
    container.querySelectorAll('[data-calendar-reschedule]').forEach((button) => button.addEventListener('click', async () => {
      const event = active.find((item) => item.eventId === button.dataset.calendarReschedule);
      const current = new Date(event.start);
      const localValue = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}T${String(current.getHours()).padStart(2,'0')}:${String(current.getMinutes()).padStart(2,'0')}`;
      const nextValue = prompt('Novo horário local (AAAA-MM-DDTHH:mm):', localValue);
      if (!nextValue) return;
      const nextStart = new Date(nextValue);
      if (!Number.isFinite(nextStart.getTime())) { this.app.showToast('Data e horário inválidos.', 'warning'); return; }
      const duration = Math.max(15, (Date.parse(event.end) - Date.parse(event.start)) / 60000 || 30);
      const nextEnd = new Date(nextStart.getTime() + duration * 60000);
      const updated = await this.app.api.updateLeadCalendarEvent(lead.id || lead.placeId || lead.phone, event.eventId, { start: nextStart.toISOString(), end: nextEnd.toISOString(), summary: event.summary, note: event.note });
      this.app.showToast(updated?.success ? 'Compromisso reagendado.' : (updated?.error || 'Não foi possível reagendar.'), updated?.success ? 'success' : 'error', 6000);
      await this.loadCalendarEvents(modal, lead);
    }));
    container.querySelectorAll('[data-calendar-cancel]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Cancelar este compromisso no Google Agenda?')) return;
      const cancelled = await this.app.api.deleteLeadCalendarEvent(lead.id || lead.placeId || lead.phone, button.dataset.calendarCancel);
      this.app.showToast(cancelled?.success ? 'Compromisso cancelado.' : (cancelled?.error || 'Não foi possível cancelar.'), cancelled?.success ? 'success' : 'error');
      await this.loadCalendarEvents(modal, lead);
    }));
    container.querySelectorAll('[data-calendar-outcome]').forEach((button) => button.addEventListener('click', async () => {
      const outcome = button.dataset.calendarOutcome;
      const label = outcome === 'completed' ? 'registrar esta reunião como realizada' : 'registrar que o lead não compareceu';
      if (!confirm(`Deseja ${label}?`)) return;
      button.disabled = true;
      const result = await this.app.api.setCalendarEventOutcome(lead.id || lead.placeId || lead.phone, button.dataset.eventId, outcome);
      this.app.showToast(result?.success ? (outcome === 'completed' ? 'Reunião registrada como realizada.' : 'Ausência registrada.') : (result?.error || 'Não foi possível registrar o resultado.'), result?.success ? 'success' : 'error');
      await this.loadCalendarEvents(modal, lead);
    }));
  }

  crmCommunicationHistoryHTML(lead) {
    const items = buildCrmTimeline(lead, { limit: 100 }).filter((item) => String(item.type || '').startsWith('communication.'));
    const rows = items.length ? items.map((item) => {
      const type = String(item.type || '');
      const icon = type.startsWith('communication.whatsapp') ? 'fab fa-whatsapp' : 'fas fa-envelope';
      const title = this.escapeHtml(item.title || 'Atividade de comunicação');
      const actor = this.escapeHtml(item.actor || 'Usuário');
      const date = this.escapeHtml(this.formatDate(item.createdAt));
      const description = this.escapeHtml(item.description || '');
      return `<article class="crm-history-item crm-history-event"><div class="crm-history-head"><strong><i class="${icon}"></i> ${title}</strong><time>${date}</time></div><div class="crm-history-meta">${actor} · Comunicação</div>${description ? `<div class="crm-history-content">${description}</div>` : ''}</article>`;
    }).join('') : `<div class="crm-history-empty"><i class="fas fa-comments"></i><strong>Nenhum contato iniciado pelo CRM</strong><span>As conversas abertas e os e-mails enviados aparecerão aqui.</span></div>`;
    return `<section class="form-section crm-history-section crm-communication-history" data-feature="crm.leads" style="margin-top:20px"><div class="form-section-title"><i class="fas fa-comments"></i> Histórico de comunicação <span class="badge">${items.length}</span></div><div class="crm-history-list">${rows}</div></section>`;
  }

  crmEmailConsentHTML(lead) {
    const optedOut = lead.emailOptedOut === true || lead.emailConsentStatus === 'opted_out';
    const status = optedOut ? 'Descadastrado — envios bloqueados' : (lead.emailConsentStatus === 'opted_in' ? 'Autorização registrada' : 'Sem descadastro registrado');
    return `<section class="form-section crm-email-consent" data-feature="compliance.optout_management" style="margin-top:16px">
      <div class="form-section-title"><i class="fas fa-shield-alt"></i> Preferência de e-mail</div>
      <p class="text-muted">Status: <strong>${this.escapeHtml(status)}</strong>${lead.emailConsentUpdatedAt ? ` · Atualizado em ${this.escapeHtml(this.formatDate(lead.emailConsentUpdatedAt))}` : ''}</p>
      ${optedOut ? `<label class="form-label">Evidência da nova autorização</label><textarea class="form-textarea" id="crm-email-consent-evidence" rows="2" maxlength="500" placeholder="Ex.: autorização recebida em formulário ou e-mail em 30/10/2026"></textarea><label class="crm-email-authorization"><input type="checkbox" id="crm-email-consent-confirmed"> Confirmo que existe uma nova autorização válida para retomar os e-mails.</label><button type="button" class="btn btn-secondary" id="crm-email-consent-optin"><i class="fas fa-check"></i> Registrar nova autorização</button>` : `<button type="button" class="btn btn-secondary" id="crm-email-consent-optout"><i class="fas fa-ban"></i> Bloquear e-mails deste lead</button>`}
    </section>`;
  }

  crmHistoryHTML(lead) {
    const items = buildCrmTimeline(lead, { limit: 100 }).filter((item) => !String(item.type || '').startsWith('communication.'));
    const rows = items.length ? items.map((item) => {
      const note = item.kind === 'note';
      const noteId = note ? this.escapeHtml(item.id) : '';
      const actor = this.escapeHtml(item.actor || 'Sistema');
      const date = this.escapeHtml(this.formatDate(item.createdAt));
      const title = this.escapeHtml(item.title || (note ? 'Anotação' : 'Atividade'));
      const description = this.escapeHtml(item.description || item.text || '');
      const sourceLabel = item.source === 'manual' || item.source === 'legacy' ? 'Registro manual'
        : item.source === 'ai' ? 'Inteligência artificial'
          : item.source === 'automation' ? 'Automação'
            : item.source === 'communication' ? 'Comunicação' : 'Sistema';
      const eventIcon = String(item.type || '').startsWith('communication.whatsapp') ? 'fab fa-whatsapp'
        : String(item.type || '').startsWith('communication.email') ? 'fas fa-envelope'
          : note ? 'fas fa-sticky-note' : 'fas fa-history';
      if (note) {
        const editControls = item.editable ? `
          <div class="crm-history-actions">
            <button type="button" class="btn btn-sm btn-secondary" data-note-edit="${noteId}"><i class="fas fa-pen"></i> Editar</button>
            <button type="button" class="btn btn-sm btn-primary" data-note-save="${noteId}" hidden><i class="fas fa-save"></i> Salvar</button>
            <button type="button" class="btn btn-sm btn-secondary" data-note-cancel="${noteId}" hidden>Cancelar</button>
            <button type="button" class="btn btn-sm btn-danger" data-note-delete="${noteId}"><i class="fas fa-trash"></i> Excluir</button>
          </div>` : `<small class="crm-history-source">${this.escapeHtml(sourceLabel)} · Somente leitura</small>`;
        return `<article class="crm-history-item crm-history-note" data-note-card="${noteId}">
          <div class="crm-history-head"><strong><i class="fas fa-sticky-note"></i> ${title}</strong><time>${date}</time></div>
          <div class="crm-history-meta">${actor} · ${this.escapeHtml(sourceLabel)}</div>
          <div class="crm-history-content" data-note-content>${description}</div>
          <textarea class="form-input crm-note-editor" data-note-editor maxlength="5000" rows="4" hidden>${this.escapeHtml(item.text || '')}</textarea>
          ${editControls}
        </article>`;
      }
      return `<article class="crm-history-item crm-history-event">
        <div class="crm-history-head"><strong><i class="${eventIcon}"></i> ${title}</strong><time>${date}</time></div>
        <div class="crm-history-meta">${actor} · ${this.escapeHtml(sourceLabel)}</div>
        ${description ? `<div class="crm-history-content">${description}</div>` : ''}
      </article>`;
    }).join('') : `<div class="crm-history-empty"><i class="fas fa-history"></i><strong>Nenhuma atividade registrada ainda</strong><span>As anotações e movimentações importantes aparecerão aqui.</span></div>`;

    return `<section class="form-section crm-history-section" data-feature="crm.notes" style="margin-top:20px">
      <div class="form-section-title"><i class="fas fa-clock-rotate-left"></i> Histórico do relacionamento <span class="badge">${items.length}</span></div>
      <p class="text-muted" style="font-size:12px;margin:0 0 12px">Registre informações importantes e acompanhe as alterações deste lead. Suas anotações são separadas dos registros automáticos do i9Hub.</p>
      <div class="crm-note-composer">
        <label for="crm-note-input">Nova anotação</label>
        <textarea class="form-input" id="crm-note-input" maxlength="5000" rows="3" placeholder="Ex.: Conversou por telefone, prefere contato à tarde, solicitou proposta para sexta-feira..."></textarea>
        <div class="crm-note-composer-footer"><small>Até 5.000 caracteres · Visível no histórico deste lead</small><button type="button" class="btn btn-primary" id="crm-note-add"><i class="fas fa-plus"></i> Adicionar anotação</button></div>
      </div>
      <div class="crm-history-list" id="crm-history-list">${rows}</div>
    </section>`;
  }

  followupStepHTML(index = 0) {
    const removable = index > 0;
    return `<div class="crm-followup-step" data-followup-step>
      <div class="crm-followup-step-head"><strong>Etapa <span data-step-number>${index + 1}</span></strong>${removable ? '<button type="button" class="btn btn-sm btn-danger" data-step-remove><i class="fas fa-trash"></i> Remover</button>' : ''}</div>
      <div class="crm-followup-schedule-grid">
        <label>Enviar após
          <div class="crm-followup-delay"><input class="form-input" type="number" min="1" max="525600" value="${index === 0 ? 1 : 3}" data-step-value><select class="form-select" data-step-unit><option value="minutes">minutos</option><option value="hours">horas</option><option value="days" selected>dias</option></select></div>
        </label>
        <label>Ou em data e hora específicas
          <input class="form-input" type="datetime-local" data-step-datetime>
        </label>
      </div>
      <label class="crm-followup-message-label">Mensagem
        <textarea class="form-input" rows="3" maxlength="2500" data-step-message placeholder="Escreva a mensagem de acompanhamento...">${index === 0 ? 'Olá, {{nome}}! Passando para saber se conseguiu avaliar as informações que conversamos. Se tiver alguma dúvida, estou à disposição.' : ''}</textarea>
      </label>
      <small class="text-muted">Variáveis: {{nome}}, {{empresa}}, {{servico}}, {{nicho}}, {{proposta}}, {{vendedor}}.</small>
    </div>`;
  }

  followupHTML(lead) {
    const canManage = this.app.hasFeature?.('crm.followup.manage') === true;
    const canSend = this.app.hasFeature?.('crm.followup.send') === true;
    const phone = String(lead.phone || '').replace(/\D/g, '');
    const optedOut = lead.optedOut === true || lead.consentStatus === 'opted_out';
    const blocked = optedOut || lead.blacklisted === true || normalizeType(lead.tipo) === 'spam';
    if (!canManage) {
      return `<section class="form-section crm-followup-section" data-feature="crm.followup.manage"><div class="form-section-title"><i class="fas fa-clock"></i> Follow-up programado</div><p class="text-muted">Este módulo depende de uma licença que inclua gerenciamento de follow-ups.</p><button type="button" class="btn btn-secondary" data-followup-unlock="crm.followup.manage">Conhecer funcionalidade</button></section>`;
    }
    return `<section class="form-section crm-followup-section" data-feature="crm.followup.manage">
      <div class="form-section-title"><i class="fas fa-clock"></i> Follow-up programado</div>
      <p class="text-muted" style="font-size:12px">Programe retornos individuais ou uma sequência. O envio só acontece com Chrome e WhatsApp Web conectados, autorização registrada e dentro dos limites de segurança.</p>
      ${!canSend ? '<div class="crm-followup-warning">Sua licença permite gerenciar follow-ups, mas não libera o envio de mensagens. <button type="button" class="btn btn-sm btn-secondary" data-followup-unlock="crm.followup.send">Solicitar liberação</button></div>' : ''}
      ${optedOut ? '<div class="crm-followup-warning">Este contato solicitou descadastro. O i9Hub bloqueia novos follow-ups para este número.</div>' : ''}
      ${blocked && !optedOut ? '<div class="crm-followup-warning">Este lead está bloqueado ou classificado como spam. Revise a classificação antes de qualquer contato.</div>' : ''}
      <div class="crm-followup-composer">
        <div class="crm-followup-composer-head"><strong>Nova sequência</strong><span>Até 10 etapas</span></div>
        <label>Modelo de mensagem (opcional)<select class="form-select" id="crm-followup-template"><option value="">Escolha um modelo (opcional)</option></select></label>
        <small class="text-muted">Em uma sequência, os prazos relativos de cada etapa contam a partir do momento em que você agenda. Use data e hora específicas para definir um horário exato.</small>
      <div class="crm-followup-steps" id="crm-followup-steps">${this.followupStepHTML(0)}</div>
        <div class="crm-followup-composer-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="crm-followup-add-step"><i class="fas fa-plus"></i> Adicionar etapa</button>
        </div>
        <label class="crm-followup-check"><input type="checkbox" id="crm-followup-consent"> Confirmo que tenho autorização específica para este follow-up.</label>
        <label class="crm-followup-check"><input type="checkbox" id="crm-followup-cancel-on-reply" checked> Interromper automaticamente a sequência quando o cliente responder.</label>
        <div class="crm-followup-footer">
          <small>O sistema não enviará se houver descadastro, Black list, spam ou limite de frequência.</small>
          <button type="button" class="btn btn-primary" id="crm-followup-schedule" ${canSend && phone.length >= 10 && !blocked ? '' : 'disabled'}><i class="fas fa-calendar-check"></i> Agendar follow-up</button>
        </div>
        ${phone.length < 10 ? '<small class="crm-followup-warning">Cadastre um telefone válido no lead para programar mensagens.</small>' : ''}
      </div>
      <div class="crm-followup-list-wrap">
        <div class="crm-followup-list-head"><strong>Agendamentos deste lead</strong><button type="button" class="btn btn-sm btn-secondary" id="crm-followup-refresh"><i class="fas fa-rotate"></i> Atualizar</button></div>
        <div id="crm-followup-list" class="crm-followup-list"><div class="crm-history-empty">Carregando follow-ups...</div></div>
      </div>
    </section>`;
  }

  async loadFollowups(modal, lead) {
    const container = modal.querySelector('#crm-followup-list');
    if (!container || !this.app.hasFeature?.('crm.followup.manage')) return;
    const [result, templatesResult] = await Promise.all([
      this.app.api.getFollowups({ leadId: String(lead.id || lead.placeId || lead.phone || ''), limit: 50 }),
      this.app.api.getFollowupTemplates(),
    ]);
    this.followupTemplates = Array.isArray(templatesResult?.data) ? templatesResult.data : [];
    if (!result?.success) {
      container.innerHTML = `<div class="crm-history-empty">${this.escapeHtml(result?.error || 'Não foi possível carregar os follow-ups.')}</div>`;
      return;
    }
    const statusLabels = {
      scheduled: 'Agendado', processing: 'Enviando', sent: 'Enviado', failed: 'Falha no envio',
      overdue: 'Aguardando ação', cancelled: 'Cancelado', blocked_consent: 'Sem consentimento',
      blocked_blacklist: 'Black list', blocked_spam: 'Contato bloqueado', blocked_license: 'Licença sem permissão',
      blocked_frequency: 'Limite de frequência',
    };
    const items = result.data?.items || [];
    container.innerHTML = items.length ? items.map((item) => {
      const canSend = ['scheduled', 'overdue', 'failed', 'blocked_license', 'blocked_blacklist', 'blocked_spam', 'blocked_frequency'].includes(item.status) && this.app.hasFeature?.('crm.followup.send');
      const canCancel = ['scheduled', 'overdue', 'failed', 'blocked_license', 'blocked_blacklist', 'blocked_spam', 'blocked_frequency'].includes(item.status);
      const when = this.escapeHtml(this.formatDate(item.scheduledAt));
      const message = this.escapeHtml(item.message || item.messageTemplate || '');
      const actions = `<div class="crm-followup-item-actions">
        ${canSend ? `<button type="button" class="btn btn-sm btn-primary" data-followup-send="${this.escapeHtml(item.id)}"><i class="fas fa-paper-plane"></i> Enviar agora</button>` : ''}
        ${canCancel ? `<button type="button" class="btn btn-sm btn-secondary" data-followup-reschedule="${this.escapeHtml(item.id)}"><i class="fas fa-calendar-pen"></i> Reagendar</button><button type="button" class="btn btn-sm btn-danger" data-followup-cancel="${this.escapeHtml(item.id)}">Cancelar</button>${Number(item.stepCount) > 1 ? `<button type="button" class="btn btn-sm btn-danger" data-followup-cancel-sequence="${this.escapeHtml(item.id)}">Cancelar sequência</button>` : ''}` : ''}
        ${item.status === 'cancelled' || item.status === 'sent' || String(item.status || '').startsWith('blocked_') ? `<button type="button" class="btn btn-sm btn-secondary" data-followup-delete="${this.escapeHtml(item.id)}"><i class="fas fa-trash"></i></button>` : ''}
      </div>`;
      return `<article class="crm-followup-item">
        <div class="crm-followup-item-top"><strong>${item.stepCount > 1 ? `Etapa ${Number(item.stepIndex) || 1}/${Number(item.stepCount) || 1}` : 'Mensagem programada'}</strong><span class="crm-followup-status status-${this.escapeHtml(item.status)}">${this.escapeHtml(statusLabels[item.status] || item.status)}</span></div>
        <time>${when}</time><p>${message}</p>${item.lastError ? `<small class="crm-followup-warning">${this.escapeHtml(item.lastError)}</small>` : ''}${actions}
      </article>`;
    }).join('') : '<div class="crm-history-empty"><i class="fas fa-calendar-check"></i><strong>Nenhum follow-up programado</strong><span>Crie um agendamento acima para não deixar oportunidades sem retorno.</span></div>';
    container.querySelectorAll('[data-followup-send]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      const sent = await this.app.api.sendFollowupNow(button.dataset.followupSend);
      this.app.showToast(sent?.success ? 'Follow-up enviado pelo WhatsApp Web.' : (sent?.error || 'Não foi possível enviar.'), sent?.success ? 'success' : 'warning', 6000);
      await this.loadFollowups(modal, lead);
      try { await this.app.views.crm?.loadLeads?.(); } catch {}
    }));
    container.querySelectorAll('[data-followup-cancel]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Cancelar este follow-up?')) return;
      const cancelled = await this.app.api.cancelFollowup(button.dataset.followupCancel);
      this.app.showToast(cancelled?.success ? 'Follow-up cancelado.' : (cancelled?.error || 'Não foi possível cancelar.'), cancelled?.success ? 'success' : 'error');
      await this.loadFollowups(modal, lead);
    }));
    container.querySelectorAll('[data-followup-reschedule]').forEach((button) => button.addEventListener('click', async () => {
      const local = prompt('Informe a nova data e hora no formato AAAA-MM-DDTHH:mm (horário local):');
      if (!local) return;
      const timestamp = new Date(local);
      if (!Number.isFinite(timestamp.getTime())) { this.app.showToast('Data e hora inválidas.', 'warning'); return; }
      const updated = await this.app.api.rescheduleFollowup(button.dataset.followupReschedule, timestamp.toISOString());
      this.app.showToast(updated?.success ? 'Follow-up reagendado.' : (updated?.error || 'Não foi possível reagendar.'), updated?.success ? 'success' : 'error');
      await this.loadFollowups(modal, lead);
    }));
    container.querySelectorAll('[data-followup-cancel-sequence]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Cancelar todas as etapas pendentes desta sequência?')) return;
      const cancelled = await this.app.api.cancelFollowupSequence(button.dataset.followupCancelSequence);
      this.app.showToast(cancelled?.success ? `${cancelled.data?.cancelled || 0} etapa(s) cancelada(s).` : (cancelled?.error || 'Não foi possível cancelar a sequência.'), cancelled?.success ? 'success' : 'error');
      await this.loadFollowups(modal, lead);
    }));
    container.querySelectorAll('[data-followup-delete]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Excluir este registro do histórico de follow-ups?')) return;
      const deleted = await this.app.api.deleteFollowup(button.dataset.followupDelete);
      this.app.showToast(deleted?.success ? 'Registro excluído.' : (deleted?.error || 'Não foi possível excluir.'), deleted?.success ? 'success' : 'error');
      await this.loadFollowups(modal, lead);
    }));
    const templateSelect = modal.querySelector('#crm-followup-template');
    if (templateSelect && this.followupTemplates.length) {
      templateSelect.innerHTML = '<option value="">Escolha um modelo (opcional)</option>' + this.followupTemplates.map((item) => `<option value="${this.escapeHtml(item.id)}">${this.escapeHtml(item.name)}</option>`).join('');
    }
  }

  collectFollowupSteps(modal) {
    const rows = [...modal.querySelectorAll('[data-followup-step]')];
    return rows.map((row) => {
      const value = Math.max(1, Number(row.querySelector('[data-step-value]')?.value) || 1);
      const unit = row.querySelector('[data-step-unit]')?.value || 'days';
      const multiplier = unit === 'minutes' ? 1 : unit === 'hours' ? 60 : 1440;
      const custom = String(row.querySelector('[data-step-datetime]')?.value || '').trim();
      const messageTemplate = String(row.querySelector('[data-step-message]')?.value || '').trim();
      if (custom) {
        const parsed = new Date(custom);
        return { scheduledAt: Number.isFinite(parsed.getTime()) ? parsed.toISOString() : '', messageTemplate };
      }
      return { delayMinutes: value * multiplier, messageTemplate };
    });
  }

  async scheduleFollowups(modal, lead) {
    if (!this.app.hasFeature?.('crm.followup.manage')) { this.app.showAccessPrompt?.('crm.followup.manage'); return; }
    if (!this.app.hasFeature?.('crm.followup.send')) { this.app.showAccessPrompt?.('crm.followup.send'); return; }
    const steps = this.collectFollowupSteps(modal);
    if (!steps.length || steps.length > 10) { this.app.showToast('Adicione entre 1 e 10 etapas.', 'warning'); return; }
    if (steps.some((step) => !step.messageTemplate)) { this.app.showToast('Preencha a mensagem de todas as etapas.', 'warning'); return; }
    const button = modal.querySelector('#crm-followup-schedule');
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Agendando...'; }
    const options = {
      consentConfirmed: modal.querySelector('#crm-followup-consent')?.checked === true,
      cancelOnReply: modal.querySelector('#crm-followup-cancel-on-reply')?.checked !== false,
    };
    const leadId = lead.id || lead.placeId || lead.phone;
    const result = steps.length > 1
      ? await this.app.api.scheduleFollowupSequence(leadId, steps, options)
      : await this.app.api.scheduleFollowup(leadId, steps[0], options);
    if (!result?.success) {
      if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-calendar-check"></i> Agendar follow-up'; }
      this.app.showToast(result?.error || 'Não foi possível programar o follow-up.', 'error', 7000);
      return;
    }
    this.app.showToast(`${result.data?.followups?.length || steps.length} follow-up(s) programado(s).`, 'success', 5000);
    const latest = await this.app.api.getSavedLeads();
    const updatedLead = latest?.data?.find((item) => String(item.id || item.placeId || item.phone) === String(leadId));
    if (updatedLead) Object.assign(lead, updatedLead);
    modal.remove();
    this.show(lead);
    try { await this.app.views.crm?.loadLeads?.(); } catch {}
  }

  renumberFollowupSteps(modal) {
    modal.querySelectorAll('[data-followup-step]').forEach((row, index) => {
      const label = row.querySelector('[data-step-number]');
      if (label) label.textContent = String(index + 1);
      const remove = row.querySelector('[data-step-remove]');
      if (index === 0) remove?.remove();
      else if (!remove) {
        const head = row.querySelector('.crm-followup-step-head');
        if (head) {
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'btn btn-sm btn-danger'; button.dataset.stepRemove = '';
          button.innerHTML = '<i class="fas fa-trash"></i> Remover';
          button.addEventListener('click', () => { row.remove(); this.renumberFollowupSteps(modal); });
          head.append(button);
        }
      }
    });
  }

  bindEvents(modal, lead) {
    modal.querySelectorAll(".modal-close").forEach(button => button.addEventListener("click", () => modal.remove()));
    modal.addEventListener("click", event => { if (event.target === modal) modal.remove(); });
    modal.querySelectorAll(".stage-btn").forEach(button => button.addEventListener("click", async () => {
      const newStage = button.dataset.stage;
      modal.remove();
      await this.moveStage(lead, newStage);
    }));
    modal.querySelectorAll(".type-btn").forEach(button => button.addEventListener("click", async () => {
      const type = normalizeType(button.dataset.type);
      modal.remove();
      await this.setType(lead, type);
    }));
    modal.querySelectorAll('[data-action="open-whatsapp"]').forEach(button => button.addEventListener("click", async () => {
      button.disabled = true;
      const result = await this.app.api.openCrmLeadChat(lead);
      if (!result?.success) {
        button.disabled = false;
        this.app.showToast(result?.error || "Não foi possível abrir a conversa.", "error", 7000);
        return;
      }
      this.app.showToast(`Conversa de ${lead.name || result.data?.phone || "lead"} aberta no WhatsApp Web. Nenhuma mensagem foi enviada.`, "success", 5000);
      if (result.data?.lead) await this.refreshAfterHistoryChange(modal, lead, { data: { lead: result.data.lead } });
      else button.disabled = false;
    }));
    modal.querySelectorAll('[data-action="send-email"]').forEach(button => button.addEventListener("click", () => {
      this.app.communicationModal?.show(lead, modal);
    }));
    modal.querySelector('#crm-email-consent-optout')?.addEventListener('click', async () => {
      if (!confirm(`Registrar o descadastro de e-mail de ${lead.name || 'este lead'}? O i9Hub bloqueará novos envios pelo CRM.`)) return;
      const result = await this.app.api.setCrmEmailConsent({ leadId: lead.id || lead.placeId || lead.phone, status: 'opted_out', source: 'manual' });
      if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível registrar o descadastro.', 'error'); return; }
      this.app.showToast('Descadastro registrado. Os envios de e-mail foram bloqueados.', 'success');
      await this.refreshAfterHistoryChange(modal, lead, result);
    });
    modal.querySelector('#crm-email-consent-optin')?.addEventListener('click', async () => {
      const confirmed = modal.querySelector('#crm-email-consent-confirmed')?.checked === true;
      const evidence = String(modal.querySelector('#crm-email-consent-evidence')?.value || '').trim();
      if (!confirmed || evidence.length < 8) { this.app.showToast('Confirme a autorização e informe a evidência antes de reativar.', 'warning'); return; }
      const result = await this.app.api.setCrmEmailConsent({ leadId: lead.id || lead.placeId || lead.phone, status: 'opted_in', source: 'manual', evidence, confirmed });
      if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível registrar a autorização.', 'error'); return; }
      this.app.showToast('Nova autorização registrada. O envio de e-mails foi reativado.', 'success');
      await this.refreshAfterHistoryChange(modal, lead, result);
    });
    modal.querySelectorAll('[data-action="copy-value"]').forEach(button => button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(String(button.dataset.copy || "").slice(0, 500));
        this.app.showToast("Copiado.", "success");
      } catch { this.app.showToast("Não foi possível copiar. Verifique a permissão do navegador.", "warning"); }
    }));
    modal.querySelector("#save-custom-fields")?.addEventListener("click", async () => this.saveCustomFields(modal, lead));
    modal.querySelector("#save-lead-commercial-fields")?.addEventListener("click", async () => this.saveLeadCommercialFields(modal, lead));
    modal.querySelector("#save-lead-identity")?.addEventListener("click", async () => this.saveLeadIdentity(modal, lead));
    modal.querySelector("#crm-note-add")?.addEventListener("click", async () => this.addCrmNote(modal, lead));
    modal.querySelector("#crm-followup-add-step")?.addEventListener("click", () => {
      const steps = modal.querySelector("#crm-followup-steps");
      if (!steps || steps.querySelectorAll("[data-followup-step]").length >= 10) { this.app.showToast("O limite é de 10 etapas por sequência.", "warning"); return; }
      const index = steps.querySelectorAll("[data-followup-step]").length;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = this.followupStepHTML(index);
      const row = wrapper.firstElementChild;
      row.querySelector("[data-step-remove]")?.addEventListener("click", () => { row.remove(); this.renumberFollowupSteps(modal); });
      steps.append(row);
    });
    modal.querySelectorAll("[data-step-remove]").forEach((button) => button.addEventListener("click", () => {
      button.closest("[data-followup-step]")?.remove();
      this.renumberFollowupSteps(modal);
    }));
    modal.querySelector("#crm-followup-schedule")?.addEventListener("click", async () => this.scheduleFollowups(modal, lead));
    modal.querySelector("#crm-followup-refresh")?.addEventListener("click", async () => this.loadFollowups(modal, lead));
    modal.querySelector("#crm-calendar-find-slots")?.addEventListener("click", async () => this.findCalendarSlots(modal));
    modal.querySelector("#crm-calendar-book")?.addEventListener("click", async () => this.createCalendarBooking(modal, lead));
    modal.querySelector("#crm-calendar-refresh")?.addEventListener("click", async () => this.loadCalendarEvents(modal, lead));
    modal.querySelector('[data-calendar-unlock]')?.addEventListener('click', (event) => this.app.showAccessPrompt?.(event.currentTarget.dataset.calendarUnlock));
    modal.querySelector("#crm-followup-template")?.addEventListener("change", (event) => {
      const selected = this.followupTemplates?.find((item) => item.id === event.currentTarget.value);
      const firstMessage = modal.querySelector('[data-followup-step] [data-step-message]');
      if (selected && firstMessage) firstMessage.value = selected.message;
    });
    modal.querySelector('[data-followup-unlock]')?.addEventListener("click", (event) => this.app.showAccessPrompt?.(event.currentTarget.dataset.followupUnlock));
    modal.querySelectorAll("[data-note-edit]").forEach(button => button.addEventListener("click", () => {
      const card = button.closest("[data-note-card]");
      if (!card) return;
      card.querySelector("[data-note-content]")?.setAttribute("hidden", "");
      card.querySelector("[data-note-editor]")?.removeAttribute("hidden");
      button.setAttribute("hidden", "");
      card.querySelector(`[data-note-save="${CSS.escape(button.dataset.noteEdit || "")}"]`)?.removeAttribute("hidden");
      card.querySelector(`[data-note-cancel="${CSS.escape(button.dataset.noteEdit || "")}"]`)?.removeAttribute("hidden");
      card.querySelector("[data-note-editor]")?.focus();
    }));
    modal.querySelectorAll("[data-note-cancel]").forEach(button => button.addEventListener("click", () => {
      const card = button.closest("[data-note-card]");
      if (!card) return;
      card.querySelector("[data-note-content]")?.removeAttribute("hidden");
      card.querySelector("[data-note-editor]")?.setAttribute("hidden", "");
      card.querySelector("[data-note-edit]")?.removeAttribute("hidden");
      card.querySelector("[data-note-save]")?.setAttribute("hidden", "");
      button.setAttribute("hidden", "");
    }));
    modal.querySelectorAll("[data-note-save]").forEach(button => button.addEventListener("click", async () => this.updateCrmNote(modal, lead, button.dataset.noteSave, button)));
    modal.querySelectorAll("[data-note-delete]").forEach(button => button.addEventListener("click", async () => this.deleteCrmNote(modal, lead, button.dataset.noteDelete, button)));
    modal.querySelector("#delete-lead")?.addEventListener("click", async () => {
      if (!confirm("Excluir este lead?")) return;
      modal.remove();
      await this.deleteLead(lead);
    });
  }

  async refreshAfterHistoryChange(modal, lead, result) {
    const updatedLead = result?.data?.lead;
    if (updatedLead && typeof updatedLead === 'object') Object.assign(lead, updatedLead);
    modal.remove();
    this.show(lead);
    try { await this.app.views.crm?.loadLeads?.(); } catch { /* o card aberto já recebeu a atualização local */ }
  }

  async addCrmNote(modal, lead) {
    const input = modal.querySelector("#crm-note-input");
    const text = String(input?.value || '').trim();
    if (!text) { this.app.showToast("Escreva uma anotação antes de salvar.", "warning"); input?.focus(); return; }
    const button = modal.querySelector("#crm-note-add");
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }
    const result = await this.app.api.addLeadNote(lead.id || lead.placeId || lead.phone, text);
    if (!result?.success) {
      if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-plus"></i> Adicionar anotação'; }
      this.app.showToast(result?.error || "Não foi possível salvar a anotação.", "error", 6000);
      return;
    }
    await this.refreshAfterHistoryChange(modal, lead, result);
    this.app.showToast("Anotação adicionada ao histórico.", "success");
  }

  async updateCrmNote(modal, lead, noteId, button) {
    const card = button?.closest("[data-note-card]");
    const editor = card?.querySelector("[data-note-editor]");
    const text = String(editor?.value || '').trim();
    if (!text) { this.app.showToast("A anotação não pode ficar vazia.", "warning"); editor?.focus(); return; }
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando';
    const result = await this.app.api.updateLeadNote(lead.id || lead.placeId || lead.phone, noteId, text);
    if (!result?.success) {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-save"></i> Salvar';
      this.app.showToast(result?.error || "Não foi possível atualizar a anotação.", "error", 6000);
      return;
    }
    await this.refreshAfterHistoryChange(modal, lead, result);
    this.app.showToast("Anotação atualizada.", "success");
  }

  async deleteCrmNote(modal, lead, noteId, button) {
    if (!confirm("Excluir esta anotação? Esta ação não poderá ser desfeita.")) return;
    button.disabled = true;
    const result = await this.app.api.deleteLeadNote(lead.id || lead.placeId || lead.phone, noteId);
    if (!result?.success) {
      button.disabled = false;
      this.app.showToast(result?.error || "Não foi possível excluir a anotação.", "error", 6000);
      return;
    }
    await this.refreshAfterHistoryChange(modal, lead, result);
    this.app.showToast("Anotação excluída.", "success");
  }

  async moveStage(lead, newStage) {
    const id = lead.id || lead.placeId || lead.phone;
    const oldStage = lead.stage;
    lead.stage = newStage;
    lead.updatedAt = new Date().toISOString();
    try {
      const result = await this.app.api.updateLeadStage(id, newStage);
      if (result.success) {
        this.app.showToast(`Lead movido para ${this.formatStage(newStage)}`, "success");
        this.app.views.crm?.applyFilters();
      } else {
        lead.stage = oldStage;
        this.app.showToast(result.error || "Erro ao mover", "error");
      }
    } catch (error) {
      lead.stage = oldStage;
      this.app.showToast("Erro: " + String(error?.message || "falha inesperada").slice(0, 200), "error");
    }
  }

  async setType(lead, type) {
    const result = await this.app.api.updateLeadType(lead.id || lead.placeId || lead.phone, type);
    if (!result.success) { this.app.showToast(result.error || "Não foi possível atualizar o tipo.", "error"); return; }
    if (type === "spam" && String(lead.phone || "").replace(/\D/g, "").length >= 10) {
      if (confirm(`"${String(lead.name || lead.phone || "Este contato").slice(0, 120)}" foi marcado como Spam.\n\nDeseja também enviar este número para a Black List?\n\nA Black List só será alterada se você confirmar.`)) {
        const response = await this.app.api.blacklistAdd([{ phone: lead.phone, name: lead.name }], "crm");
        if (!response.success) this.app.showToast(response.error || "O tipo foi salvo, mas a Black List não foi atualizada.", "warning", 7000);
      }
    }
    this.app.showToast(`Marcado como ${TYPE_META[type].label}.`, "success");
    this.app.views.crm?.loadLeads?.();
  }

  identityMetaInfo(lead, field) {
    const meta = lead?.identityMeta?.[field] || lead?.fieldMeta?.[field] || {};
    const hasValue = String(lead?.[field] || '').trim().length > 0;
    const inferredSource = lead?.source === 'manual' ? 'manual'
      : lead?.source === 'google_maps' ? (field === 'name' ? lead?.nameSource || 'google_maps_details' : field === 'phone' ? 'google_maps_phone' : field === 'address' ? 'google_maps_address' : field === 'website' ? 'google_maps_website' : field === 'category' ? 'google_maps_details' : 'unknown')
        : (lead?.source === 'whatsapp_private' || lead?.source === 'whatsapp_group') ? (field === 'phone' ? 'whatsapp_store_phone' : field === 'name' ? lead?.nameSource || (lead?.source === 'whatsapp_group' ? 'whatsapp_group_member_dom' : 'whatsapp_chat_title') : 'unknown') : 'unknown';
    const source = String(meta.source || (!hasValue ? 'unknown' : inferredSource));
    const labels = {
      manual: 'Editado manualmente', whatsapp_saved_contact: 'Contato salvo no WhatsApp',
      whatsapp_verified_name: 'Nome verificado no WhatsApp', whatsapp_formatted_contact: 'Nome formatado do WhatsApp',
      whatsapp_push_name: 'Nome de perfil do WhatsApp', whatsapp_chat_title: 'Título da conversa WhatsApp', whatsapp_group_member_dom: 'Nome exibido no participante do grupo',
      whatsapp_store_phone: 'Telefone identificado no WhatsApp', google_maps_details: 'Detalhes do Google Maps',
      google_maps_card_title: 'Título do resultado no Google Maps', google_maps_aria_label: 'Rótulo do Google Maps',
      google_maps_url_slug: 'Nome do link do Google Maps', google_maps_phone: 'Telefone do Google Maps',
      google_maps_address: 'Endereço do Google Maps', google_maps_website: 'Site do Google Maps',
      import: 'Importação', unknown: 'Origem não identificada',
    };
    let confidence = Number(meta.confidence);
    if (!Number.isFinite(confidence)) confidence = !hasValue ? null : source === 'manual' ? 1 : source === 'google_maps_details' ? 0.98 : source === 'google_maps_card_title' ? 0.96 : source === 'whatsapp_saved_contact' ? 0.99 : source === 'whatsapp_push_name' ? 0.86 : source === 'whatsapp_chat_title' ? 0.78 : source === 'import' ? 0.65 : 0.5;
    return { source, label: labels[source] || (hasValue ? source.replace(/_/g, ' ') : 'Sem dado identificado'), confidence: confidence == null ? null : Math.max(0, Math.min(1, confidence)), manual: meta.manual === true || source === 'manual', cleared: meta.cleared === true };
  }

  identityEditorHTML(lead) {
    const fields = [
      { key: 'name', label: 'Nome / estabelecimento', type: 'text', max: 180, placeholder: 'Nome identificado do contato ou empresa' },
      { key: 'phone', label: 'Telefone', type: 'tel', max: 40, placeholder: 'DDD + número' },
      { key: 'email', label: 'E-mail', type: 'email', max: 254, placeholder: 'contato@empresa.com' },
      { key: 'company', label: 'Empresa', type: 'text', max: 180, placeholder: 'Nome da empresa' },
      { key: 'category', label: 'Categoria / segmento', type: 'text', max: 180, placeholder: 'Ex.: Clínica odontológica' },
      { key: 'address', label: 'Endereço', type: 'text', max: 500, placeholder: 'Endereço completo' },
      { key: 'website', label: 'Site', type: 'url', max: 2000, placeholder: 'https://empresa.com.br' },
    ];
    const input = fields.map((field) => {
      const meta = this.identityMetaInfo(lead, field.key);
      const value = this.escapeHtml(String(lead?.[field.key] || '').slice(0, field.max));
      return `<div class="detail-item"><label for="lead-identity-${field.key}">${this.escapeHtml(field.label)}</label><input class="form-input lead-identity-field" id="lead-identity-${field.key}" data-identity-field="${field.key}" type="${field.type}" maxlength="${field.max}" value="${value}" placeholder="${this.escapeHtml(field.placeholder)}"><small class="text-muted" style="display:block;margin-top:5px;line-height:1.35">Origem: ${this.escapeHtml(meta.label)} · Confiabilidade: ${meta.confidence == null ? 'não calculada' : `${Math.round(meta.confidence * 100)}%`}${meta.manual ? ' · Correção manual protegida' : ''}${meta.cleared ? ' · Campo limpo manualmente' : ''}</small></div>`;
    }).join('');
    return `<div class="form-section" data-feature="crm.lead.identity_edit" style="margin-top:20px"><div class="form-section-title"><i class="fas fa-id-card"></i> Identidade e dados do lead</div><p class="text-muted" style="font-size:12px;margin:0 0 12px">Confira e corrija os dados extraídos do WhatsApp ou Google Maps. A origem e a confiabilidade são exibidas em cada campo. Correções manuais ficam protegidas contra sobrescrita por novas sincronizações.</p><div class="detail-grid">${input}</div><div class="btn-group" style="justify-content:flex-end;margin-top:12px"><button type="button" class="btn btn-primary" id="save-lead-identity"><i class="fas fa-save"></i> Salvar correções</button></div></div>`;
  }

  async saveLeadIdentity(modal, lead) {
    const fields = {};
    modal.querySelectorAll('.lead-identity-field').forEach((element) => {
      const key = String(element.dataset.identityField || '');
      if (!key) return;
      const next = String(element.value || '').trim();
      const previous = String(lead?.[key] || '').trim();
      if (next !== previous) fields[key] = next;
    });
    if (!Object.keys(fields).length) {
      this.app.showToast('Nenhuma alteração nos dados de identidade.', 'info');
      return;
    }
    const button = modal.querySelector('#save-lead-identity');
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }
    const result = await this.app.api.updateLeadIdentity(lead.id || lead.placeId || lead.phone, fields);
    if (!result?.success) {
      if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-save"></i> Salvar correções'; }
      this.app.showToast(result?.error || 'Não foi possível salvar as correções.', 'error', 7000);
      return;
    }
    Object.assign(lead, result.data?.lead || {});
    modal.remove();
    await this.app.views.crm?.loadLeads?.();
    this.app.showToast(`Dados atualizados. ${Object.keys(fields).length} campo(s) protegido(s) contra sobrescrita automática.`, 'success', 6000);
  }

  aiIntelligenceHTML(lead) {
    const intel = lead?.aiIntelligence && typeof lead.aiIntelligence === "object" ? lead.aiIntelligence : {};
    const qualification = lead?.aiQualification && typeof lead.aiQualification === "object" ? lead.aiQualification : {};
    if (!Object.keys(intel).length && !Object.keys(qualification).length) return "";
    const status = String(intel.status || qualification.status || (qualification.qualified ? "qualified" : "in_qualification"));
    const statusLabels = { qualified: "Qualificado", nurture: "Nutrição · sem orçamento atual", in_qualification: "Em qualificação", not_qualified: "Não qualificado" };
    const confidence = Number(intel.confidence ?? qualification.confidence);
    const confidenceLabel = Number.isFinite(confidence) && confidence > 0 ? `${Math.round(confidence * 100)}% de confiança` : "Confiança ainda não definida";
    const fields = [
      ["Pedido exato", intel.exactRequest || qualification.exactRequest, true],
      ["Resumo comercial", intel.summary || qualification.summary, true],
      ["Empresa/organização", intel.company, false],
      ["Necessidade identificada", intel.need || qualification.need, true],
      ["Serviço de interesse", intel.service || qualification.service, false],
      ["Segmento", intel.segment || qualification.segment, false],
      ["Intenção de contratação", intel.intent || qualification.intent, false],
      ["Orçamento de mídia", intel.budget || qualification.budget, false],
      ["Situação do orçamento", intel.budgetStatus || qualification.budgetStatus, false],
      ["Prazo", intel.timeframe || qualification.timeframe, false],
      ["Poder de decisão", intel.decisionMaker || qualification.decisionMaker, false],
      ["Objeção", intel.objection || qualification.objection, true],
      ["Motivo da classificação", intel.reason || qualification.reason, true],
      ["Próxima ação sugerida", intel.nextStep || qualification.nextStep, true],
    ].filter(([, value]) => String(value || "").trim());
    const evidence = Array.isArray(intel.evidence || qualification.evidence) ? (intel.evidence || qualification.evidence).slice(-6) : [];
    const missing = Array.isArray(intel.missingFields || qualification.missingFields) ? (intel.missingFields || qualification.missingFields).slice(0, 8) : [];
    const observerNote = intel.analysisMode === 'observe_only' || intel.source === 'i9Hub-ai-observer'
      ? '<div class="text-muted" style="font-size:11px;margin:4px 0 8px"><i class="fas fa-eye"></i> Atualizado pela IA observadora · nenhuma mensagem foi enviada ao contato.</div>' : '';
    const syncNote = intel.syncStatus === "pending" ? `<div class="text-warning" style="margin-top:8px;font-size:12px"><i class="fas fa-cloud-upload-alt"></i> Sincronização com Google Sheets pendente${intel.syncError ? `: ${this.escapeHtml(intel.syncError)}` : "."}</div>` : (intel.sheetSyncedAt ? `<div class="text-muted" style="margin-top:8px;font-size:11px">Planilha atualizada em ${this.escapeHtml(this.formatDate(intel.sheetSyncedAt))}</div>` : "");
    return `<div class="form-section" style="margin-top:20px;padding:14px;border:1px solid var(--border-color,#dbe3ef);border-radius:10px;background:var(--bg-secondary,#f8fafc)">
      <div class="form-section-title" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span><i class="fas fa-brain"></i> Inteligência Comercial do Lead</span><span class="badge">${this.escapeHtml(statusLabels[status] || "Avaliação da IA")}</span></div>
      <div class="text-muted" style="font-size:12px;margin:4px 0 12px">${this.escapeHtml(confidenceLabel)} · Atualizado ${this.escapeHtml(this.formatDate(intel.updatedAt || intel.evaluatedAt || qualification.evaluatedAt || ""))}</div>${observerNote}
      <div class="detail-grid">${fields.map(([label, value, full]) => `<div class="detail-item${full ? " full-width" : ""}"><label>${this.escapeHtml(label)}</label><span style="white-space:pre-wrap;overflow-wrap:anywhere">${this.escapeHtml(String(value).slice(0, 1600))}</span></div>`).join("")}</div>
      ${evidence.length ? `<div style="margin-top:10px"><strong style="font-size:12px">Evidências da conversa</strong><ul style="margin:5px 0 0 18px;padding:0;font-size:12px">${evidence.map(item => `<li>${this.escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
      ${missing.length ? `<div style="margin-top:10px"><strong style="font-size:12px">Ainda precisamos descobrir</strong><div style="margin-top:5px">${missing.map(item => `<span class="badge" style="margin:0 4px 4px 0">${this.escapeHtml(item)}</span>`).join("")}</div></div>` : ""}
      ${syncNote}
    </div>`;
  }

  nicheClassificationHTML(lead) {
    const current = lead?.aiNicheClassification && typeof lead.aiNicheClassification === 'object' ? lead.aiNicheClassification : {};
    const classifications = Array.isArray(lead?.aiNicheClassifications) && lead.aiNicheClassifications.length ? lead.aiNicheClassifications : (current.path?.length ? [current] : []);
    const tags = [...new Set([...(Array.isArray(lead?.aiTags) ? lead.aiTags : []), ...(Array.isArray(lead?.tags) ? lead.tags : [])])];
    if (!classifications.length && !tags.length) return '';
    const pathsHTML = classifications.map((classification) => {
      const path = Array.isArray(classification.path) ? classification.path.filter(Boolean) : [];
      const confidence = Number(classification.confidence);
      const confidenceText = Number.isFinite(confidence) && confidence >= 0 ? `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%` : 'não informado';
      const evidence = Array.isArray(classification.evidence) ? classification.evidence.slice(0, 3) : [];
      return `<div class="crm-niche-classification-item"><div class="crm-lead-tags">${path.map((name, index) => `<span class="badge ${index === path.length - 1 ? 'tag-ai' : ''}">${this.escapeHtml(name)}</span>`).join('<span class="text-muted">›</span>')}</div><small class="text-muted">Confiança: ${this.escapeHtml(confidenceText)}</small>${evidence.length ? `<ul>${evidence.map((item) => `<li>${this.escapeHtml(item)}</li>`).join('')}</ul>` : ''}</div>`;
    }).join('');
    return `<div class="form-section" style="margin-top:18px"><div class="form-section-title"><i class="fas fa-sitemap"></i> Nichos e etiquetas inteligentes</div>
      ${pathsHTML ? `<div class="detail-item"><label>Classificações hierárquicas</label>${pathsHTML}</div>` : ''}
      ${tags.length ? `<div class="detail-item" style="margin-top:10px"><label>Etiquetas internas</label><div class="crm-lead-tags">${tags.map((tag) => `<span class="badge">${this.escapeHtml(tag)}</span>`).join(' ')}</div></div>` : ''}
      <small class="text-muted">As classificações automáticas são baseadas nas informações disponíveis e podem ser corrigidas pelo usuário.</small></div>`;
  }

  commercialFieldsHTML(lead) {
    const dealValue = lead?.dealValue === null || lead?.dealValue === undefined ? '' : String(lead.dealValue);
    const saleValue = lead?.saleValue === null || lead?.saleValue === undefined ? '' : String(lead.saleValue);
    return `<section class="form-section i9-lead-commercial-fields" data-feature="crm.leads" style="margin-top:20px">
      <div class="form-section-title"><i class="fas fa-chart-line"></i> Dados para performance e comissões</div>
      <p class="text-muted" style="font-size:12px;margin:0 0 12px">Vincule o vendedor cadastrado e, quando aplicável, o produto ou serviço. O valor estimado alimenta o funil; o valor vendido alimenta receita e comissões após o fechamento.</p>
      <div class="detail-grid">
        <div class="detail-item"><label for="lead-commercial-owner">Responsável comercial</label><input class="form-input" id="lead-commercial-owner" list="lead-commercial-owner-options" maxlength="120" value="${this.escapeHtml(String(lead?.commercialOwner || ''))}" placeholder="Nome do vendedor"><datalist id="lead-commercial-owner-options"></datalist></div>
        <div class="detail-item"><label for="lead-commercial-product">Produto/serviço</label><input class="form-input" id="lead-commercial-product" list="lead-commercial-product-options" maxlength="160" value="${this.escapeHtml(String(lead?.commercialProductName || lead?.commercialProduct || ''))}" placeholder="Selecione ou digite"><datalist id="lead-commercial-product-options"></datalist></div>
        <div class="detail-item"><label for="lead-deal-value">Valor estimado da oportunidade (R$)</label><input class="form-input" id="lead-deal-value" type="number" min="0" max="1000000000000" step="0.01" value="${this.escapeHtml(dealValue)}" placeholder="0,00"></div>
        <div class="detail-item"><label for="lead-sale-value">Valor efetivamente vendido (R$)</label><input class="form-input" id="lead-sale-value" type="number" min="0" max="1000000000000" step="0.01" value="${this.escapeHtml(saleValue)}" placeholder="0,00"></div>
      </div>
      <small class="text-muted" style="display:block;margin-top:8px;line-height:1.45">Para calcular comissão, cadastre o vendedor e o percentual padrão ou cadastre o produto/serviço com sua própria taxa. A taxa é congelada quando a venda é registrada; comissões já pagas exigem reabertura antes de alterar vendedor, produto ou valor vendido.</small>
      <div class="btn-group" style="justify-content:flex-end;margin-top:10px"><button type="button" class="btn btn-primary" id="save-lead-commercial-fields"><i class="fas fa-save"></i> Salvar dados comerciais</button></div>
    </section>`;
  }

  async loadCommercialOptions(modal) {
    if (!this.app.hasFeature?.('dashboard.commercial_performance')) return;
    const today = new Date();
    const result = await this.app.api.getCommercialManagement(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    if (!result?.success) return;
    const config = result.data?.config || {};
    const sellerList = modal.querySelector('#lead-commercial-owner-options');
    const productList = modal.querySelector('#lead-commercial-product-options');
    if (sellerList) sellerList.innerHTML = (config.sellers || []).filter((item) => item.active !== false).map((item) => `<option value="${this.escapeHtml(item.name)}"></option>`).join('');
    if (productList) productList.innerHTML = (config.products || []).filter((item) => item.active !== false).map((item) => `<option value="${this.escapeHtml(item.name)}"></option>`).join('');
  }

  async saveLeadCommercialFields(modal, lead) {
    const owner = String(modal.querySelector('#lead-commercial-owner')?.value || '').trim().slice(0, 120);
    const dealValue = String(modal.querySelector('#lead-deal-value')?.value || '').trim();
    const saleValue = String(modal.querySelector('#lead-sale-value')?.value || '').trim();
    const productName = String(modal.querySelector('#lead-commercial-product')?.value || '').trim().slice(0, 160);
    const fields = {
      commercialOwner: owner,
      commercialProductName: productName,
      dealValue: dealValue === '' ? null : Number(dealValue),
      saleValue: saleValue === '' ? null : Number(saleValue),
    };
    if ([fields.dealValue, fields.saleValue].some((value) => value !== null && (!Number.isFinite(value) || value < 0 || value > 1e12))) {
      this.app.showToast('Informe valores monetários válidos e positivos.', 'warning');
      return;
    }
    const button = modal.querySelector('#save-lead-commercial-fields');
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }
    const result = await this.app.api.updateLeadCommercialFields(lead.id || lead.placeId || lead.phone, fields);
    if (!result?.success) {
      if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-save"></i> Salvar dados comerciais'; }
      this.app.showToast(result?.error || 'Não foi possível salvar os dados comerciais.', 'error', 6000);
      return;
    }
    Object.assign(lead, result.data?.lead || {});
    modal.remove();
    await this.app.views.crm?.loadLeads?.();
    this.app.showToast('Dados comerciais salvos e disponíveis nos relatórios.', 'success');
  }

  customFieldsHTML(lead) {
    const fields = Array.isArray(this.app.businessProfile?.fields) ? this.app.businessProfile.fields.slice(0, 40) : [];
    if (!fields.length) return "";
    const values = lead.customFields && typeof lead.customFields === "object" && !Array.isArray(lead.customFields) ? lead.customFields : {};
    const inputFor = (field) => {
      const key = String(field?.key || "").slice(0, 100);
      if (!key) return "";
      const escapedKey = this.escapeHtml(key);
      const value = this.escapeHtml(String(values[key] ?? "").slice(0, 2000));
      const placeholder = this.escapeHtml(String(field?.placeholder || "").slice(0, 200));
      const type = ["textarea", "date", "number", "currency"].includes(field?.type) ? field.type : "text";
      if (type === "textarea") return `<textarea class="form-textarea custom-lead-field" rows="2" data-field="${escapedKey}" placeholder="${placeholder}">${value}</textarea>`;
      if (type === "date") return `<input type="date" class="form-input custom-lead-field" data-field="${escapedKey}" value="${value}">`;
      if (type === "number") return `<input type="number" class="form-input custom-lead-field" data-field="${escapedKey}" value="${value}" placeholder="${placeholder}">`;
      if (type === "currency") return `<input type="text" inputmode="decimal" class="form-input custom-lead-field" data-field="${escapedKey}" value="${value}" placeholder="0,00">`;
      return `<input type="text" class="form-input custom-lead-field" data-field="${escapedKey}" value="${value}" placeholder="${placeholder}">`;
    };
    return `<div class="form-section" style="margin-top:20px"><div class="form-section-title"><i class="fas fa-sliders"></i> Dados do perfil: ${this.escapeHtml(this.app.businessProfile?.name || "Personalizado")}</div>
      <div class="detail-grid custom-fields-grid">${fields.map(field => `<div class="detail-item"><label>${this.escapeHtml(field?.label || field?.key || "Campo")}</label>${inputFor(field)}</div>`).join("")}</div>
      <div class="btn-group" style="justify-content:flex-end;margin-top:10px"><button type="button" class="btn btn-primary" id="save-custom-fields"><i class="fas fa-save"></i> Salvar dados</button></div>
    </div>`;
  }

  async saveCustomFields(modal, lead) {
    const fields = {};
    modal.querySelectorAll(".custom-lead-field").forEach(element => {
      const key = String(element.dataset.field || "").slice(0, 100);
      if (key) fields[key] = String(element.value || "").trim().slice(0, 2000);
    });
    const result = await this.app.api.updateLeadCustomFields(lead.id || lead.placeId || lead.phone, fields);
    if (!result.success) { this.app.showToast(result.error || "Não foi possível salvar os dados.", "error"); return; }
    lead.customFields = result.data?.customFields || fields;
    this.app.showToast("Dados do perfil salvos.", "success");
    this.app.views.crm?.loadLeads?.();
  }

  classifierDetailsHTML(lead) {
    const cls = lead?.classification;
    if (!cls || typeof cls !== "object") return "";
    const confidenceColor = cls.nivelConfianca === "alta" ? "text-success" : cls.nivelConfianca === "media" ? "text-warning" : "text-danger";
    const motivosPositivos = (cls.motivos || []).filter(m => m.tipo === "positivo").slice(0, 5);
    const sinaisAtencao = (cls.sinaisAtencao || []).slice(0, 5);
    const motivosNegativos = (cls.motivos || []).filter(m => m.tipo === "negativo").slice(0, 5);
    const feedbackNote = cls.ajustadoPorFeedback ? `<div class="text-warning" style="margin-top:6px;font-size:0.85em"><i class="fas fa-sync-alt"></i> Classificação ajustada por aprendizado local</div>` : "";
    const disclaimer = `<div class="text-muted" style="margin-top:8px;font-size:0.8em;font-style:italic">Esta classificação é uma recomendação do i9Hub. Revise o resultado quando a confiança for baixa.</div>`;
    const motivosHTML = motivosPositivos.length > 0 ? `<div style="margin-top:6px"><small class="text-muted">Motivos positivos:</small><ul style="margin:2px 0 0 16px;padding:0;font-size:0.85em">${motivosPositivos.map(m => `<li>${this.escapeHtml(m.texto)}</li>`).join("")}</ul></div>` : "";
    const negativosHTML = motivosNegativos.length > 0 ? `<div style="margin-top:4px"><small class="text-muted">Sinais negativos:</small><ul style="margin:2px 0 0 16px;padding:0;font-size:0.85em">${motivosNegativos.map(m => `<li>${this.escapeHtml(m.texto)}</li>`).join("")}</ul></div>` : "";
    const sinaisHTML = sinaisAtencao.length > 0 ? `<div style="margin-top:4px"><small class="text-warning">Atenção:</small><ul style="margin:2px 0 0 16px;padding:0;font-size:0.85em">${sinaisAtencao.map(s => `<li>${this.escapeHtml(s)}</li>`).join("")}</ul></div>` : "";
    return `<div class="detail-item full-width" style="margin-top:12px;padding:12px;background:var(--bg-secondary,#f8f9fa);border-radius:8px;border:1px solid var(--border-color,#e0e0e0)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong style="font-size:0.95em"><i class="fas fa-brain"></i> Classificação automática v2.0</strong>
        <span class="badge badge-sm ${confidenceColor}">Confiança: ${cls.nivelConfianca || "-"}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;font-size:0.85em">
        <div><span class="text-muted">Score:</span> <strong>${cls.score ?? "-"}/100</strong></div>
        <div><span class="text-muted">Intenção:</span> <strong>${this.escapeHtml(cls.intencao?.nome || "-")}</strong></div>
        <div><span class="text-muted">Urgência:</span> <strong>${this.escapeHtml(cls.urgencia?.nivel || "-")}</strong></div>
        <div><span class="text-muted">Modelo nicho:</span> <strong>${this.escapeHtml(cls.modeloNicho || "-")}</strong></div>
        <div><span class="text-muted">Origem:</span> <strong>${this.escapeHtml(cls.origem || "-")}</strong></div>
        ${cls.spamLevel ? `<div><span class="text-muted">Spam level:</span> <strong class="text-danger">${this.escapeHtml(cls.spamLevel)}</strong></div>` : ""}
      </div>
      ${motivosHTML}${negativosHTML}${sinaisHTML}${feedbackNote}${disclaimer}
      <div class="btn-group" style="margin-top:10px;flex-wrap:wrap;gap:6px">
        <button type="button" class="btn btn-sm btn-outline-primary" data-action="classifier-correct" data-lead-id="${this.escapeHtml(lead.id || "")}"><i class="fas fa-edit"></i> Corrigir classificação</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="classifier-mark-spam" data-lead-id="${this.escapeHtml(lead.id || "")}"><i class="fas fa-ban"></i> Marcar como spam</button>
        <button type="button" class="btn btn-sm btn-outline-success" data-action="classifier-mark-prospecto" data-lead-id="${this.escapeHtml(lead.id || "")}"><i class="fas fa-user-plus"></i> Marcar como prospecto</button>
        <button type="button" class="btn btn-sm btn-outline-info" data-action="classifier-mark-cliente" data-lead-id="${this.escapeHtml(lead.id || "")}"><i class="fas fa-user-check"></i> Marcar como cliente</button>
      </div>
    </div>`;
  }

  typeBadgeHTML(lead) {
    const type = normalizeType(lead?.tipo);
    const meta = TYPE_META[type] || TYPE_META.a_classificar;
    const manual = lead?.tipoManual === true ? " · Manual" : "";
    return `<span class="badge type-badge ${meta.badge}" title="${this.escapeHtml(lead?.tipoMotivo || meta.description)}"><i class="fas ${meta.icon}"></i> ${this.escapeHtml(meta.label)}${manual}</span>`;
  }

  async deleteLead(lead) {
    const id = lead.id || lead.placeId || lead.phone;
    try {
      await this.app.api.deleteLead(id);
      this.app.views.crm?.applyFilters();
      this.app.showToast("Lead removido", "success");
    } catch (error) {
      this.app.showToast("Erro: " + String(error?.message || "falha inesperada").slice(0, 200), "error");
    }
  }

  formatSource(source) {
    const map = { google_maps: "Google Maps", whatsapp: "WhatsApp", whatsapp_group: "Grupo WhatsApp", whatsapp_private: "Oportunidade WhatsApp", manual: "Manual", import: "Importação CSV" };
    return map[source] || (typeof source === "string" ? source.slice(0, 80) : "-") || "-";
  }
  formatStage(stage) { return stageTitle(stage); }
  getStageColor(stage) { const map = { novo: "primary", contatado: "warning", qualificado: "info", proposta: "primary", fechado: "success", perdido: "danger" }; return map[stage] || "secondary"; }
  formatDate(value) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR"); }
  safeHttpUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return "";
      return url.href.slice(0, 2000);
    } catch { return ""; }
  }
  escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  bindClassifierEvents(modal, lead) {
    modal.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action^='classifier-']");
      if (!btn) return;
      const action = btn.dataset.action;
      const leadId = btn.dataset.leadId || lead?.id || "";
      const previousDecision = lead?.classification?.tipo || lead?.tipo || "a_classificar";
      const previousIntent = lead?.classification?.intencao?.nome || null;
      const previousUrgency = lead?.classification?.urgencia?.nivel || null;

      if (action === "classifier-mark-spam") {
        await this.applyClassifierCorrection(lead, leadId, "spam", previousDecision, previousIntent, previousUrgency, "Marcado como spam via UI");
      } else if (action === "classifier-mark-prospecto") {
        await this.applyClassifierCorrection(lead, leadId, "prospecto", previousDecision, previousIntent, previousUrgency, "Marcado como prospecto via UI");
      } else if (action === "classifier-mark-cliente") {
        await this.applyClassifierCorrection(lead, leadId, "cliente", previousDecision, previousIntent, previousUrgency, "Marcado como cliente via UI");
      } else if (action === "classifier-correct") {
        const newType = prompt("Novo tipo (spam, prospecto, cliente, a_classificar):", previousDecision);
        if (!newType || !TYPE_VALUES.includes(newType)) return;
        const reason = prompt("Motivo da correção:", "") || "";
        await this.applyClassifierCorrection(lead, leadId, newType, previousDecision, previousIntent, previousUrgency, reason);
      }
    });
  }

  async applyClassifierCorrection(lead, leadId, newDecision, previousDecision, previousIntent, previousUrgency, reason) {
    if (newDecision === previousDecision) {
      this.app.showToast("Tipo já é " + newDecision, "info");
      return;
    }
    const entry = buildFeedbackEntry({
      leadId,
      previousDecision,
      newDecision,
      previousIntent,
      newIntent: null,
      previousUrgency,
      newUrgency: null,
      reason,
      user: this.app.currentUser || "default",
      nicheModel: lead?.classification?.modeloNicho || "personalizado",
    });
    const recorded = await recordFeedback(entry, this.app.storage || chrome?.storage?.local);
    if (!recorded) {
      this.app.showToast("Falha ao registrar feedback local", "error");
      return;
    }
    // Atualiza o lead localmente para refletir a correção imediata
    lead.tipo = newDecision;
    lead.tipoManual = true;
    lead.tipoMotivo = reason || "Correção manual via UI";
    try {
      await this.app.api.updateLead(leadId, { tipo: newDecision, tipoManual: true, tipoMotivo: lead.tipoMotivo });
    } catch { /* best-effort sync */ }
    this.app.showToast(`Classificação alterada para ${newDecision}`, "success");
    this.app.views.crm?.loadLeads?.();
  }
}
