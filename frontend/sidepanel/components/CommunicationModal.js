import {
  DEFAULT_CRM_EMAIL_TEMPLATES,
  CRM_EMAIL_MAX_ATTACHMENTS,
  CRM_EMAIL_MAX_ATTACHMENT_BYTES,
  normalizeCrmEmailAddress,
  renderCrmEmailTemplate,
} from '../../lib/crm-communication.js';

export class CommunicationModal {
  constructor(app) {
    this.app = app;
    this.modal = null;
    this.lead = null;
    this.originModal = null;
    this.templates = [...DEFAULT_CRM_EMAIL_TEMPLATES];
    this.status = { connected: false, email: '', configured: false, permissionGranted: false, accounts: [] };
    this.requestId = '';
    this.sellerId = 'default';
  }

  show(lead, originModal = null) {
    if (!this.app.hasFeature?.('crm.communication.email')) {
      this.app.showAccessPrompt?.('crm.communication.email');
      return;
    }
    this.lead = lead || {};
    this.originModal = originModal;
    this.sellerId = String(lead?.commercialOwnerId || lead?.ownerId || 'default').slice(0, 100) || 'default';
    this.requestId = globalThis.crypto?.randomUUID?.() || `crm_email_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open crm-email-overlay';
    modal.innerHTML = this.getHTML(this.lead);
    document.body.appendChild(modal);
    this.modal = modal;
    this.bindEvents(modal);
    this.load().catch((error) => this.setStatusMessage(error?.message || 'Não foi possível carregar a integração Gmail.', 'error'));
  }

  getHTML(lead) {
    const optedOut = lead.emailOptedOut === true || lead.emailConsentStatus === 'opted_out';
    const email = String(lead.email || '').trim().slice(0, 254);
    return `<div class="modal modal-lg crm-email-modal" role="dialog" aria-modal="true" aria-label="Enviar e-mail pelo CRM">
      <div class="modal-header">
        <h3 class="modal-title"><i class="fas fa-envelope"></i> Comunicação · ${this.escapeHtml(lead.name || 'Lead')}</h3>
        <button type="button" class="modal-close" aria-label="Fechar">&times;</button>
      </div>
      <div class="modal-body">
        <div class="crm-email-account" id="crm-email-account" role="status">Verificando contas Google...</div>
        <div class="crm-email-account-picker">
          <label>Conta remetente
            <select class="form-select" id="crm-email-account-select"><option value="default">Conta Google padrão</option></select>
          </label>
          <small class="text-muted">Para adicionar outra conta, inclua-a no perfil do Chrome e clique em Atualizar contas.</small>
          <div class="crm-email-connection-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="crm-email-connect"><i class="fab fa-google"></i> Conectar conta</button>
            <button type="button" class="btn btn-secondary btn-sm" id="crm-email-refresh-accounts"><i class="fas fa-rotate"></i> Atualizar contas</button>
            <button type="button" class="btn btn-secondary btn-sm" id="crm-email-disconnect" hidden>Desconectar</button>
          </div>
        </div>
        <div class="crm-email-form">
          <label>Modelo de e-mail
            <select class="form-select" id="crm-email-template"><option value="">Escrever do zero</option>${DEFAULT_CRM_EMAIL_TEMPLATES.map((item) => `<option value="${this.escapeHtml(item.id)}">${this.escapeHtml(item.name)}</option>`).join('')}</select>
          </label>
          <label>Para
            <input class="form-input" id="crm-email-to" type="email" maxlength="254" autocomplete="email" value="${this.escapeHtml(email)}" placeholder="contato@empresa.com">
          </label>
          <label>Assunto
            <input class="form-input" id="crm-email-subject" type="text" maxlength="200" value="" placeholder="Assunto do e-mail">
          </label>
          <label>Mensagem
            <textarea class="form-input" id="crm-email-body" rows="9" maxlength="20000" placeholder="Escreva sua mensagem...">Olá, ${this.escapeHtml(lead.name || 'tudo bem')}!\n\nEstou entrando em contato para dar continuidade ao nosso atendimento.\n\nFico à disposição!</textarea>
          </label>
          <div class="crm-email-signature-panel">
            <label for="crm-email-signature">Assinatura do vendedor</label>
            <textarea class="form-input" id="crm-email-signature" rows="3" maxlength="2000" placeholder="Nome do vendedor, cargo, telefone e empresa"></textarea>
            <div class="crm-email-template-actions">
              <small class="text-muted">A assinatura é salva por vendedor e será anexada ao final da mensagem.</small>
              <button type="button" class="btn btn-sm btn-secondary" id="crm-email-save-signature"><i class="fas fa-signature"></i> Salvar assinatura</button>
            </div>
          </div>
          <label>Anexos (até ${CRM_EMAIL_MAX_ATTACHMENTS} arquivos · 10 MB no total)
            <input class="form-input" id="crm-email-attachments" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf,.odt,.ods,.csv,.txt,.png,.jpg,.jpeg,.webp">
          </label>
          <div class="crm-email-attachment-list text-muted" id="crm-email-attachment-list">Nenhum anexo selecionado.</div>
          <div class="crm-email-template-actions">
            <small class="text-muted">Variáveis: {{nome}}, {{empresa}}, {{produto}}, {{vendedor}}.</small>
            <button type="button" class="btn btn-sm btn-secondary" id="crm-email-save-template"><i class="fas fa-bookmark"></i> Salvar como modelo</button>
          </div>
          ${optedOut ? '<div class="crm-email-warning">Este lead está descadastrado de e-mails. O envio está bloqueado até existir nova autorização registrada.</div>' : ''}
          <label class="crm-email-authorization"><input type="checkbox" id="crm-email-authorized" ${optedOut ? 'disabled' : ''}> Confirmo que este contato pode receber este e-mail e que a mensagem está de acordo com a finalidade do contato.</label>
          <p class="crm-email-privacy-note">O i9Hub registra destinatário, assunto, nomes dos anexos, remetente e resultado. O corpo do e-mail enviado e os arquivos não são armazenados. Ao sincronizar respostas, apenas metadados e um trecho de até 500 caracteres são registrados no histórico.</p>
        </div>
        <div class="crm-email-reply-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="crm-email-sync-replies" data-feature="crm.communication.email.read"><i class="fas fa-inbox"></i> Sincronizar respostas</button>
          <small class="text-muted">A primeira sincronização solicitará permissão Gmail somente para leitura.</small>
        </div>
        <div class="crm-email-outlook-note"><i class="fab fa-microsoft"></i> Outlook / Microsoft 365: integração aguardando configuração OAuth do aplicativo Microsoft Entra.</div>
        <div class="crm-email-feedback" id="crm-email-feedback" hidden></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary modal-close">Cancelar</button>
        <button type="button" class="btn btn-primary" id="crm-email-send" ${optedOut ? 'disabled' : ''}><i class="fas fa-paper-plane"></i> Enviar e-mail</button>
      </div>
    </div>`;
  }

  bindEvents(modal) {
    modal.querySelectorAll('.modal-close').forEach((button) => button.addEventListener('click', () => this.close()));
    modal.addEventListener('click', (event) => { if (event.target === modal) this.close(); });
    modal.querySelector('#crm-email-connect')?.addEventListener('click', () => this.connectGmail());
    modal.querySelector('#crm-email-disconnect')?.addEventListener('click', () => this.disconnectGmail());
    modal.querySelector('#crm-email-refresh-accounts')?.addEventListener('click', () => this.refreshAccounts());
    modal.querySelector('#crm-email-account-select')?.addEventListener('change', (event) => this.selectAccount(event.target.value));
    modal.querySelector('#crm-email-template')?.addEventListener('change', (event) => this.applyTemplate(event.target.value));
    modal.querySelector('#crm-email-save-template')?.addEventListener('click', () => this.saveTemplate());
    modal.querySelector('#crm-email-save-signature')?.addEventListener('click', () => this.saveSignature());
    modal.querySelector('#crm-email-attachments')?.addEventListener('change', () => this.renderAttachmentList());
    modal.querySelector('#crm-email-sync-replies')?.addEventListener('click', () => this.syncReplies());
    modal.querySelector('#crm-email-send')?.addEventListener('click', () => this.sendEmail());
  }

  async load() {
    const [statusResult, templateResult, signatureResult] = await Promise.all([
      this.app.api.getCrmEmailStatus(),
      this.app.api.getCrmEmailTemplates(),
      this.app.api.getCrmEmailSignature(this.sellerId),
    ]);
    if (statusResult?.success) this.status = statusResult.data || this.status;
    if (templateResult?.success && Array.isArray(templateResult.data)) this.templates = templateResult.data;
    if (signatureResult?.success) {
      const field = this.modal?.querySelector('#crm-email-signature');
      if (field) field.value = signatureResult.data?.signature || '';
    }
    this.renderStatus();
    this.renderTemplates();
  }

  renderStatus() {
    const account = this.modal?.querySelector('#crm-email-account');
    const connect = this.modal?.querySelector('#crm-email-connect');
    const disconnect = this.modal?.querySelector('#crm-email-disconnect');
    const send = this.modal?.querySelector('#crm-email-send');
    const select = this.modal?.querySelector('#crm-email-account-select');
    if (!account || !select) return;
    const accounts = Array.isArray(this.status.accounts) ? this.status.accounts : [];
    const selectedId = String(this.status.accountId || 'default');
    const options = accounts.length ? accounts : [{ id: 'default', label: 'Conta Google padrão', connected: this.status.connected }];
    select.innerHTML = options.map((item) => `<option value="${this.escapeHtml(item.id)}">${this.escapeHtml(item.label || item.email || 'Conta Google')}${item.connected ? ' · conectada' : ''}</option>`).join('');
    if (!options.some((item) => String(item.id) === selectedId)) select.insertAdjacentHTML('beforeend', `<option value="${this.escapeHtml(selectedId)}">Conta selecionada</option>`);
    select.value = selectedId;
    if (this.status.connected && this.status.permissionGranted) {
      account.className = 'crm-email-account is-connected';
      account.innerHTML = this.status.email
        ? `<i class="fas fa-circle-check"></i> Gmail conectado como <strong>${this.escapeHtml(this.status.email)}</strong>`
        : '<i class="fas fa-circle-check"></i> Conta Gmail conectada. Os envios usarão a conta selecionada.';
      connect.hidden = true;
      disconnect.hidden = false;
      send.disabled = this.lead?.emailOptedOut === true || this.lead?.emailConsentStatus === 'opted_out';
    } else {
      account.className = 'crm-email-account is-disconnected';
      account.textContent = !this.status.configured ? 'O Client ID OAuth do Google não está configurado nesta extensão.' : (this.status.connected ? 'A permissão do Gmail precisa ser renovada. Clique em Conectar conta.' : 'Selecione uma conta e conecte o Gmail para enviar pelo CRM.');
      connect.hidden = false;
      connect.disabled = !this.status.configured;
      disconnect.hidden = true;
      send.disabled = true;
    }
  }

  async refreshAccounts() {
    const result = await this.app.api.getCrmEmailStatus();
    if (result?.success) { this.status = result.data || this.status; this.renderStatus(); this.setStatusMessage('Lista de contas Google atualizada.', 'success'); }
    else this.setStatusMessage(result?.error || 'Não foi possível atualizar as contas.', 'error');
  }

  async selectAccount(accountId) {
    const result = await this.app.api.selectCrmGmailAccount(accountId);
    if (!result?.success) { this.setStatusMessage(result?.error || 'Não foi possível selecionar a conta.', 'error'); return; }
    this.status = result.data || this.status;
    this.renderStatus();
  }

  renderTemplates() {
    const select = this.modal?.querySelector('#crm-email-template');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Escrever do zero</option>' + this.templates.map((item) => `<option value="${this.escapeHtml(item.id)}">${this.escapeHtml(item.name)}</option>`).join('');
    if (this.templates.some((item) => item.id === current)) select.value = current;
  }

  applyTemplate(id) {
    const template = this.templates.find((item) => item.id === String(id || ''));
    if (!template) return;
    const lead = this.lead || {};
    const sellerName = String(lead.commercialOwnerName || lead.ownerName || 'Equipe comercial');
    const subject = this.modal?.querySelector('#crm-email-subject');
    const body = this.modal?.querySelector('#crm-email-body');
    if (subject) subject.value = renderCrmEmailTemplate(template.subject, lead, { sellerName });
    if (body) body.value = renderCrmEmailTemplate(template.body, lead, { sellerName });
  }

  async connectGmail() {
    const button = this.modal?.querySelector('#crm-email-connect');
    const accountId = String(this.modal?.querySelector('#crm-email-account-select')?.value || 'default');
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...'; }
    try {
      const granted = await this.app.api.ensureGmailOrigin();
      if (!granted) { this.setStatusMessage('A permissão do Gmail não foi concedida. Você pode autorizar depois.', 'warning'); return; }
      const result = await this.app.api.connectCrmGmail(accountId);
      if (!result?.success) { this.setStatusMessage(result?.error || 'Não foi possível conectar ao Gmail.', 'error'); return; }
      this.status = result.data || { connected: true, accountId };
      this.renderStatus();
      this.setStatusMessage('Gmail conectado. Você já pode enviar e-mails pelo CRM.', 'success');
    } finally {
      if (button?.isConnected) { button.disabled = !this.status.configured || this.status.connected; button.innerHTML = '<i class="fab fa-google"></i> Conectar conta'; }
    }
  }

  async disconnectGmail() {
    const accountId = String(this.status.accountId || 'default');
    const result = await this.app.api.disconnectCrmGmail(accountId);
    if (!result?.success) { this.setStatusMessage(result?.error || 'Não foi possível desconectar.', 'error'); return; }
    this.status = result.data || { connected: false, accountId };
    this.renderStatus();
    this.setStatusMessage('Conta desconectada desta extensão. Para revogar o acesso, confira também as configurações da Conta Google.', 'success');
  }

  async saveTemplate() {
    const name = String(prompt('Nome para este modelo de e-mail:') || '').trim().slice(0, 80);
    if (!name) return;
    const subject = String(this.modal?.querySelector('#crm-email-subject')?.value || '').trim();
    const body = String(this.modal?.querySelector('#crm-email-body')?.value || '').trim();
    if (!subject || !body) { this.setStatusMessage('Preencha o assunto e a mensagem antes de salvar o modelo.', 'warning'); return; }
    const custom = this.templates.filter((item) => !DEFAULT_CRM_EMAIL_TEMPLATES.some((base) => base.id === item.id));
    custom.push({ id: `custom_${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`, name, subject, body, updatedAt: new Date().toISOString() });
    const result = await this.app.api.saveCrmEmailTemplates(custom);
    if (!result?.success) { this.setStatusMessage(result?.error || 'Não foi possível salvar o modelo.', 'error'); return; }
    this.templates = result.data || [...this.templates, custom.at(-1)];
    this.renderTemplates();
    const select = this.modal?.querySelector('#crm-email-template');
    if (select) select.value = custom.at(-1).id;
    this.setStatusMessage('Modelo salvo e incluído na sincronização do Google Drive, quando conectada.', 'success');
  }

  async saveSignature() {
    const signature = String(this.modal?.querySelector('#crm-email-signature')?.value || '').trim();
    const result = await this.app.api.saveCrmEmailSignature(this.sellerId, signature);
    if (!result?.success) { this.setStatusMessage(result?.error || 'Não foi possível salvar a assinatura.', 'error'); return; }
    this.setStatusMessage('Assinatura salva para o vendedor vinculado a este lead e sincronizável pelo Google Drive.', 'success');
  }

  async renderAttachmentList() {
    const input = this.modal?.querySelector('#crm-email-attachments');
    const target = this.modal?.querySelector('#crm-email-attachment-list');
    if (!input || !target) return;
    const files = [...(input.files || [])];
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (files.length > CRM_EMAIL_MAX_ATTACHMENTS || total > CRM_EMAIL_MAX_ATTACHMENT_BYTES) {
      input.value = '';
      target.textContent = 'Limite excedido. Selecione até 5 arquivos, somando no máximo 10 MB.';
      this.setStatusMessage('Os anexos excedem o limite permitido.', 'warning');
      return;
    }
    target.textContent = files.length ? files.map((file) => `${file.name} (${this.formatBytes(file.size)})`).join(' · ') : 'Nenhum anexo selecionado.';
  }

  async readAttachments() {
    const files = [...(this.modal?.querySelector('#crm-email-attachments')?.files || [])];
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (files.length > CRM_EMAIL_MAX_ATTACHMENTS || total > CRM_EMAIL_MAX_ATTACHMENT_BYTES) throw new Error('Selecione até 5 anexos, somando no máximo 10 MB.');
    const allowed = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/rtf', 'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet', 'text/csv', 'text/plain', 'image/png', 'image/jpeg', 'image/webp', 'application/octet-stream']);
    return Promise.all(files.map(async (file) => {
      const mimeType = allowed.has(file.type) ? file.type : (file.name.toLowerCase().endsWith('.csv') ? 'text/csv' : 'application/octet-stream');
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
      return { name: file.name, mimeType, data: btoa(binary), size: file.size };
    }));
  }

  async syncReplies() {
    const button = this.modal?.querySelector('#crm-email-sync-replies');
    const original = button?.innerHTML || '';
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...'; }
    try {
      const result = await this.app.api.syncCrmEmailReplies({ leadId: String(this.lead?.id || this.lead?.placeId || this.lead?.phone || ''), accountId: String(this.status.accountId || 'default') });
      if (!result?.success) { this.setStatusMessage(result?.error || 'Não foi possível sincronizar respostas.', 'error'); return; }
      const count = Number(result.data?.replies) || 0;
      this.setStatusMessage(count ? `${count} resposta(s) adicionada(s) ao histórico do lead.` : 'Nenhuma resposta nova encontrada.', 'success');
      const originModal = this.originModal;
      if (originModal?.isConnected && result.data?.lead) await this.app.leadModal?.refreshAfterHistoryChange?.(originModal, this.lead, { data: { lead: result.data.lead } });
    } finally {
      if (button?.isConnected) { button.disabled = false; button.innerHTML = original; }
    }
  }

  async sendEmail() {
    const button = this.modal?.querySelector('#crm-email-send');
    const to = normalizeCrmEmailAddress(this.modal?.querySelector('#crm-email-to')?.value);
    const subject = String(this.modal?.querySelector('#crm-email-subject')?.value || '').trim();
    const message = String(this.modal?.querySelector('#crm-email-body')?.value || '').trim();
    const signature = String(this.modal?.querySelector('#crm-email-signature')?.value || '').trim();
    const body = [message, signature].filter(Boolean).join('\n\n');
    const authorized = this.modal?.querySelector('#crm-email-authorized')?.checked === true;
    if (!to) { this.setStatusMessage('Informe um endereço de e-mail válido.', 'warning'); return; }
    if (!subject) { this.setStatusMessage('Informe o assunto do e-mail.', 'warning'); return; }
    if (!message) { this.setStatusMessage('Escreva sua mensagem antes de enviar.', 'warning'); return; }
    if (!authorized) { this.setStatusMessage('Confirme a autorização do contato antes de enviar.', 'warning'); return; }
    let attachments;
    try { attachments = await this.readAttachments(); }
    catch (error) { this.setStatusMessage(error.message, 'warning'); return; }
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; }
    const requestId = globalThis.crypto?.randomUUID?.() || `crm_email_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const result = await this.app.api.sendCrmEmail({
      leadId: String(this.lead?.id || this.lead?.placeId || this.lead?.phone || ''),
      requestId, to, subject, body, authorized, attachments,
      accountId: String(this.status.accountId || 'default'),
    });
    if (!result?.success) {
      this.setStatusMessage(result?.error || 'Não foi possível enviar o e-mail.', 'error');
      if (button) {
        button.disabled = result?.code === 'EMAIL_SEND_UNCERTAIN';
        button.innerHTML = result?.code === 'EMAIL_SEND_UNCERTAIN' ? '<i class="fas fa-circle-exclamation"></i> Verifique Enviados' : '<i class="fas fa-paper-plane"></i> Enviar e-mail';
      }
      return;
    }
    const updatedLead = result.data?.lead;
    if (updatedLead) Object.assign(this.lead, updatedLead);
    this.app.showToast(result.data?.warning || `E-mail enviado para ${to}.`, result.data?.warning ? 'warning' : 'success', 7000);
    const originModal = this.originModal;
    const lead = this.lead;
    this.close();
    if (originModal?.isConnected && updatedLead) {
      await this.app.leadModal?.refreshAfterHistoryChange?.(originModal, lead, { data: { lead: updatedLead } });
    } else {
      try { await this.app.views.crm?.loadLeads?.(); } catch { /* histórico será atualizado ao reabrir o lead */ }
    }
  }

  formatBytes(value) {
    const bytes = Number(value) || 0;
    return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  setStatusMessage(message, kind = 'info') {
    const feedback = this.modal?.querySelector('#crm-email-feedback');
    if (!feedback) return;
    feedback.hidden = false;
    feedback.className = `crm-email-feedback is-${kind}`;
    feedback.textContent = String(message || '').slice(0, 500);
  }

  close() {
    this.modal?.remove();
    this.modal = null;
    this.originModal = null;
  }

  escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
