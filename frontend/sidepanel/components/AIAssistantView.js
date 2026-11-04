export class AIAssistantView {
  constructor(app) { this.app = app; this.config = {}; this.status = {}; this.orders = []; this.handoffs = []; }

  async render(container) {
    container.innerHTML = this.getHTML();
    this.bindEvents();
    await this.load();
  }

  getHTML() {
    return `<section class="i9-product-view ai-view">
      <header class="view-header"><div><p class="i9-eyebrow">AUTOMAÇÃO COMERCIAL</p><h2><i class="fas fa-robot"></i> Atendimento com IA</h2><p class="i9-subtitle">Atenda, organize pedidos e encaminhe oportunidades sem sair do WhatsApp Web.</p></div><span id="ai-state-badge" class="i9-state-pill is-off">Desativado</span></header>
      <div class="i9-hero-card ai-hero"><div class="i9-hero-icon"><i class="fas fa-wand-magic-sparkles"></i></div><div><h3>Seu atendimento, do seu jeito</h3><p>Use sua própria API de IA. A chave fica no perfil local do Chrome e não é enviada ao painel. O texto/contexto necessário da conversa é enviado ao provedor escolhido para gerar respostas.</p></div></div>
      <div class="i9-info-strip"><i class="fas fa-laptop"></i><span>O atendimento só funciona enquanto este painel estiver aberto, o Chrome estiver ativo e o WhatsApp Web estiver conectado. Esta versão não usa a API oficial do WhatsApp.</span></div>
      <div class="i9-warning-card"><i class="fas fa-triangle-exclamation"></i><div><strong>Limitação desta build de teste</strong><p>O observador responde a mensagens novas da conversa aberta. Ainda não varre todas as conversas fechadas/arquivadas. A automação não oficial pode parar se o WhatsApp Web mudar.</p></div></div>
      <div class="i9-grid-2">
        <article class="card" data-feature="whatsapp.ai_support.configure"><div class="card-title"><i class="fas fa-brain"></i> 1. Configure sua IA</div>
          <div class="form-row"><div class="form-group"><label class="form-label" for="ai-provider">Provedor</label><select class="form-select" id="ai-provider"><option value="openai">OpenAI</option><option value="anthropic">Anthropic / Claude</option><option value="gemini">Google Gemini</option><option value="openrouter">OpenRouter</option><option value="custom">Outro (API compatível com OpenAI)</option></select></div><div class="form-group"><label class="form-label" for="ai-model">Modelo</label><input class="form-input" id="ai-model" placeholder="Ex.: gpt-4o-mini"></div></div>
          <div class="form-group" id="ai-endpoint-wrap" hidden><label class="form-label" for="ai-endpoint">Endpoint HTTPS</label><input class="form-input" id="ai-endpoint" placeholder="https://api.seuprovedor.com/v1/chat/completions"></div>
          <div class="form-group"><label class="form-label" for="ai-key">Chave da API</label><input class="form-input" id="ai-key" type="password" autocomplete="off" placeholder="Cole sua chave (deixe vazio para manter a atual)"><small class="text-muted" id="ai-key-state">A chave nunca será exibida novamente após salvar.</small><div class="i9-inline-actions"><button class="btn btn-ghost btn-sm" id="ai-clear-key" data-feature="whatsapp.ai_support.configure">Remover chave salva</button></div></div>
          <div class="btn-group i9-wrap-actions"><button class="btn btn-secondary" id="ai-test-provider" data-feature="whatsapp.ai_support.configure"><i class="fas fa-plug"></i> Testar conexão</button><button class="btn btn-primary" id="ai-save-config" data-feature="whatsapp.ai_support.configure"><i class="fas fa-floppy-disk"></i> Salvar configuração</button></div>
          <p class="i9-muted-note">Os custos, limites e políticas de uso são da conta do provedor que você escolher.</p>
        </article>
        <article class="card" data-feature="whatsapp.ai_support.configure"><div class="card-title"><i class="fas fa-book-open"></i> 2. Treine o atendimento</div>
          <div class="form-group"><label class="form-label" for="ai-business-name">Nome da empresa</label><input class="form-input" id="ai-business-name" placeholder="Ex.: Contabilidade Martins"></div>
          <div class="form-group"><label class="form-label" for="ai-prompt">Instruções do atendente</label><textarea class="form-textarea" id="ai-prompt" rows="5" placeholder="Defina o tom de voz, regras comerciais, o que pode prometer e quando chamar uma pessoa."></textarea></div>
          <div class="form-group"><label class="form-label" for="ai-knowledge">Serviços, preços e perguntas frequentes</label><textarea class="form-textarea" id="ai-knowledge" rows="6" placeholder="Cadastre aqui informações aprovadas pela empresa. Não inclua dados pessoais desnecessários."></textarea></div>
          <div class="form-group"><label class="form-label" for="ai-welcome">Mensagem de boas-vindas (opcional)</label><input class="form-input" id="ai-welcome" placeholder="Olá! Como posso ajudar?"></div>
        </article>
      </div>
      <div class="i9-grid-2">
        <article class="card" data-feature="whatsapp.ai_support.google_sheets"><div class="card-title"><i class="fas fa-file-excel"></i> 3. Pedidos no Google Sheets</div>
          <div class="form-group"><label class="form-label" for="ai-sheet-id">ID da planilha</label><input class="form-input" id="ai-sheet-id" placeholder="Cole o ID entre /d/ e /edit na URL do Sheets"></div>
          <div class="form-group"><label class="form-label" for="ai-sheet-tab">Nome da aba</label><input class="form-input" id="ai-sheet-tab" placeholder="Pedidos" value="Pedidos"></div>
          <div class="i9-inline-actions"><button class="btn btn-secondary" id="ai-test-sheets" data-feature="whatsapp.ai_support.google_sheets"><i class="fab fa-google"></i> Autorizar e testar planilha</button><span id="ai-sheet-state" class="i9-small-status">Não testada</span></div>
          <p class="i9-muted-note">A aba precisa existir com o nome exato. A linha gravada inclui ID, data, cliente, telefone, empresa, serviço, detalhes, responsável, status, origem e valor de venda.</p>
        </article>
        <article class="card" data-feature="whatsapp.ai_support"><div class="card-title"><i class="fas fa-user-tie"></i> 4. Responsável comercial</div>
          <div class="form-group"><label class="form-label" for="ai-seller-phone">WhatsApp separado do vendedor (com DDI)</label><input class="form-input" id="ai-seller-phone" inputmode="numeric" placeholder="5511999999999"></div>
          <div class="form-group"><label class="form-label" for="ai-order-instructions">Regras de pedido</label><textarea class="form-textarea" id="ai-order-instructions" rows="4" placeholder="Quais dados são obrigatórios? Quando considerar que há um pedido real?"></textarea></div>
          <div class="i9-warning-card"><i class="fas fa-triangle-exclamation"></i><div><strong>Confirmação segura</strong><p>O cliente só receberá confirmação de pedido depois da gravação no Sheets. Se a notificação ao vendedor falhar, a mensagem informará que o encaminhamento está pendente.</p></div></div>
        </article>
      </div>
      <div class="card ai-control-card" data-feature="whatsapp.ai_support"><div class="ai-control-copy"><div class="card-title"><i class="fas fa-toggle-on"></i> 5. Controle do atendimento</div><p id="ai-runtime-copy">Configure o provedor, a planilha e o vendedor antes de ativar.</p><div class="i9-status-list"><span id="ai-wa-status"><i class="fas fa-circle"></i> WhatsApp: aguardando verificação</span><span id="ai-heartbeat-status"><i class="fas fa-circle"></i> Painel aberto: verificando</span><span id="ai-last-event">Última atividade: —</span></div></div><div class="ai-control-actions"><button class="btn btn-primary btn-lg" id="ai-enable" data-feature="whatsapp.ai_support"><i class="fas fa-play"></i> Ativar atendimento</button><button class="btn btn-danger" id="ai-disable" data-feature="whatsapp.ai_support" hidden><i class="fas fa-pause"></i> Pausar atendimento</button><button class="btn btn-secondary" id="ai-refresh"><i class="fas fa-rotate"></i> Atualizar estado</button></div></div>
      <article class="card" data-feature="whatsapp.ai_support.order_capture"><div class="card-title"><i class="fas fa-clipboard-check"></i> Pedidos recentes</div><div id="ai-orders" class="i9-orders-list"><div class="i9-empty-state">Carregando pedidos...</div></div></article>
      <article class="card" data-feature="whatsapp.ai_support.human_handoff"><div class="card-title"><i class="fas fa-headset"></i> Conversas transferidas para atendimento humano</div><p class="i9-muted-note">Quando o cliente pede uma pessoa ou a IA precisa de ajuda, o assistente notifica o vendedor e pausa as respostas automáticas daquela conversa até você retomar.</p><div id="ai-handoffs" class="i9-orders-list"><div class="i9-empty-state">Carregando transferências...</div></div></article>
      <div class="i9-footnote"><i class="fas fa-shield-halved"></i> Automação pela interface do WhatsApp Web não é uma integração oficial. Mudanças na interface, sessão desconectada ou suspensão do Chrome podem interromper o atendimento. Teste com uma conta e um volume pequeno antes de usar em produção.</div>
    </section>`;
  }

  bindEvents() {
    const $ = (id) => document.getElementById(id);
    $('ai-provider')?.addEventListener('change', () => this.updateProviderUI());
    $('ai-save-config')?.addEventListener('click', () => this.saveConfig());
    $('ai-clear-key')?.addEventListener('click', () => this.clearKey());
    $('ai-test-provider')?.addEventListener('click', () => this.testProvider());
    $('ai-test-sheets')?.addEventListener('click', () => this.testSheets());
    $('ai-enable')?.addEventListener('click', () => this.setEnabled(true));
    $('ai-disable')?.addEventListener('click', () => this.setEnabled(false));
    $('ai-refresh')?.addEventListener('click', () => this.load());
    $('ai-orders')?.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-order-id]');
      if (!button) return;
      if (button.dataset.orderAction === 'renotify') this.renotifySeller(button.dataset.orderId);
      else if (button.dataset.orderAction === 'retry-sheet') this.retrySheetWrite(button.dataset.orderId);
      else if (button.dataset.status) this.updateOrder(button.dataset.orderId, button.dataset.status);
    });
    $('ai-handoffs')?.addEventListener('click', (event) => { const button = event.target.closest('button[data-handoff-id]'); if (button) this.resumeHandoff(button.dataset.handoffId); });
  }

  updateProviderUI() {
    const provider = document.getElementById('ai-provider')?.value;
    const wrap = document.getElementById('ai-endpoint-wrap');
    if (wrap) wrap.hidden = provider !== 'custom';
    const model = document.getElementById('ai-model');
    if (model && !model.value) model.value = ({openai:'gpt-4o-mini',anthropic:'claude-3-5-haiku-latest',gemini:'gemini-2.0-flash',openrouter:'openai/gpt-4o-mini'})[provider] || '';
  }

  async load() {
    const configRes = await this.app.api.sendMessage('AI_GET_CONFIG');
    if (configRes?.success) {
      this.config = configRes.data || {};
      const c = this.config;
      const set = (id, value) => { const el = document.getElementById(id); if (el && value != null) el.value = value; };
      set('ai-provider', c.provider || 'openai'); set('ai-model', c.model || 'gpt-4o-mini'); set('ai-endpoint', c.endpoint || '');
      set('ai-business-name', c.businessName || ''); set('ai-prompt', c.prompt || ''); set('ai-knowledge', c.knowledge || ''); set('ai-welcome', c.welcomeMessage || '');
      set('ai-sheet-id', c.sheetId || ''); set('ai-sheet-tab', c.sheetTab || 'Pedidos'); set('ai-seller-phone', c.sellerPhone || ''); set('ai-order-instructions', c.orderInstructions || '');
      document.getElementById('ai-key-state').textContent = `${c.apiKeyConfigured ? 'Chave salva localmente.' : 'Nenhuma chave salva.'} ${c.providerVerified ? 'API testada com sucesso.' : 'Teste a API antes de ativar.'}`;
      document.getElementById('ai-sheet-state').textContent = c.sheetsVerified ? 'Conexão verificada' : 'Ainda não testada';
      this.updateProviderUI();
    } else {
      this.app.showToast(configRes?.error || 'Ative uma licença que inclua o Atendimento com IA para configurar este módulo.', 'warning', 5000);
    }
    const statusRes = await this.app.api.sendMessage('AI_GET_STATUS');
    if (statusRes?.success) { this.status = statusRes.data || {}; this.renderStatus(); }
    const ordersRes = await this.app.api.sendMessage('AI_GET_ORDERS');
    if (ordersRes?.success) { this.orders = ordersRes.data || []; this.renderOrders(); }
    const handoffRes = await this.app.api.sendMessage('AI_GET_HANDOFFS');
    if (handoffRes?.success) { this.handoffs = handoffRes.data || []; this.renderHandoffs(); }
  }

  collectConfig() {
    const val = (id) => document.getElementById(id)?.value?.trim() || '';
    return { provider: val('ai-provider'), model: val('ai-model'), endpoint: val('ai-endpoint'), apiKey: val('ai-key'), businessName: val('ai-business-name'), prompt: val('ai-prompt'), knowledge: val('ai-knowledge'), welcomeMessage: val('ai-welcome'), sheetId: val('ai-sheet-id'), sheetTab: val('ai-sheet-tab') || 'Pedidos', sellerPhone: val('ai-seller-phone').replace(/\D/g,''), orderInstructions: val('ai-order-instructions') };
  }

  async persistConfig(silent = true) {
    const config = this.collectConfig();
    const wasEnabled = this.status?.enabled === true;
    const result = await this.app.api.sendMessage('AI_SAVE_CONFIG', config);
    if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível salvar a configuração.', 'error', 6000); return false; }
    this.config = result.data || {};
    const key = document.getElementById('ai-key'); if (key) key.value = '';
    const keyState = document.getElementById('ai-key-state');
    if (keyState) keyState.textContent = `${this.config.apiKeyConfigured ? 'Chave salva localmente.' : 'Nenhuma chave salva.'} ${this.config.providerVerified ? 'API testada com sucesso.' : 'Teste a API antes de ativar.'}`;
    if (wasEnabled && this.config.enabled === false) { this.status.enabled = false; this.renderStatus(); if (!silent) this.app.showToast('Configuração salva e atendimento pausado porque a chave, o modelo ou a planilha mudou. Teste novamente antes de reativar.', 'warning', 7000); }
    else if (!silent) this.app.showToast('Configuração salva neste perfil do Chrome.', 'success');
    return true;
  }

  async saveConfig(silent = false) {
    const config = this.collectConfig();
    if (!config.businessName || !config.prompt || !config.knowledge) { this.app.showToast('Preencha o nome da empresa, as instruções e a base de conhecimento.', 'warning'); return false; }
    if (config.provider === 'custom' && !/^https:\/\//i.test(config.endpoint)) { this.app.showToast('O endpoint personalizado precisa usar HTTPS.', 'warning'); return false; }
    return this.persistConfig(silent);
  }

  async clearKey() { if (!confirm('Remover a chave de IA salva neste perfil e pausar o atendimento?')) return; const r = await this.app.api.sendMessage('AI_CLEAR_KEY'); if (!r?.success) { this.app.showToast(r?.error || 'Não foi possível remover a chave.', 'error'); return; } await this.load(); this.app.showToast('Chave removida localmente e atendimento pausado.', 'success'); }

  async requestProviderPermission() {
    const provider = document.getElementById('ai-provider')?.value;
    const endpoint = document.getElementById('ai-endpoint')?.value?.trim();
    const originMap = { openai:'https://api.openai.com/*', anthropic:'https://api.anthropic.com/*', gemini:'https://generativelanguage.googleapis.com/*', openrouter:'https://openrouter.ai/*' };
    let origin = originMap[provider];
    if (provider === 'custom') { try { const u = new URL(endpoint); if (u.protocol !== 'https:') return false; origin = u.origin + '/*'; } catch { return false; } }
    if (!origin) return false;
    try { return await chrome.permissions.request({origins:[origin]}); }
    catch { return false; }
  }

  async testProvider() {
    const granted = await this.requestProviderPermission();
    if (!granted) { this.app.showToast('Autorize o acesso ao domínio do provedor para testar a API.', 'warning', 6000); return; }
    const config = this.collectConfig();
    if (!config.model || (!config.apiKey && !this.config.apiKeyConfigured)) { this.app.showToast('Informe a chave de API e o modelo antes de testar.', 'warning'); return; }
    if (!(await this.persistConfig(true))) return;
    const btn = document.getElementById('ai-test-provider'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testando...';
    const r = await this.app.api.sendMessage('AI_TEST_PROVIDER');
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-plug"></i> Testar conexão';
    this.app.showToast(r?.success ? `Conexão OK · ${r.data?.provider || 'IA'} respondeu.` : (r?.error || 'Falha ao testar a API.'), r?.success ? 'success' : 'error', 7000);
    if (r?.success) { document.getElementById('ai-key-state').textContent = 'API testada com sucesso. Chave salva localmente.'; }
  }

  async testSheets() {
    if (!this.collectConfig().sheetId) { this.app.showToast('Informe o ID da planilha antes de testar.', 'warning'); return; }
    let sheetPermission = false; try { sheetPermission = await chrome.permissions.request({origins:['https://sheets.googleapis.com/*']}); } catch {}
    if (!sheetPermission) { this.app.showToast('Autorize o acesso ao Google Sheets para continuar.', 'warning', 6000); return; }
    if (!(await this.persistConfig(true))) return;
    const btn = document.getElementById('ai-test-sheets'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    const r = await this.app.api.sendMessage('AI_TEST_SHEETS');
    btn.disabled = false; btn.innerHTML = '<i class="fab fa-google"></i> Autorizar e testar planilha';
    document.getElementById('ai-sheet-state').textContent = r?.success ? 'Conexão verificada' : 'Não verificada';
    this.app.showToast(r?.success ? 'Google Sheets conectado e planilha acessível.' : (r?.error || 'Não foi possível validar a planilha.'), r?.success ? 'success' : 'error', 7000);
    if (r?.success) await this.load();
  }

  async setEnabled(enabled) {
    if (enabled && !(await this.saveConfig(true))) return;
    const r = await this.app.api.sendMessage('AI_SET_ENABLED', {enabled});
    if (!r?.success) { this.app.showToast(r?.error || 'Não foi possível alterar o atendimento.', 'error', 7000); return; }
    this.status = r.data || {}; await this.load();
    this.app.showToast(enabled ? 'Atendimento ativado. Mantenha o painel aberto e o WhatsApp conectado.' : 'Atendimento pausado.', enabled ? 'success' : 'info', 6000);
  }

  async updateOrder(orderId, status) {
    let saleValue;
    if (status === 'closed_won') { const raw = prompt('Valor da venda em R$ (opcional; deixe vazio se não quiser informar):'); if (raw !== null && raw.trim() !== '') { const normalized = raw.trim().includes(',') ? raw.trim().replace(/\./g,'').replace(',','.') : raw.trim(); saleValue = Number(normalized); if (!Number.isFinite(saleValue) || saleValue < 0) { this.app.showToast('Informe um valor válido ou deixe vazio.','warning'); return; } } }
    const r = await this.app.api.sendMessage('AI_UPDATE_ORDER_STATUS', {orderId, status, ...(saleValue !== undefined ? {saleValue} : {})});
    if (!r?.success) { this.app.showToast(r?.error || 'Não foi possível atualizar o pedido.', 'error'); return; }
    await this.load(); this.app.showToast(r.data?.sheetUpdated ? 'Status atualizado no pedido e na planilha.' : 'Status atualizado localmente, mas a planilha não foi sincronizada. Confira a conexão Google Sheets.', r.data?.sheetUpdated ? 'success' : 'warning', 7000);
  }

  renderStatus() {
    const s = this.status || {};
    const active = !!s.enabled && !!s.runtimeActive;
    const badge = document.getElementById('ai-state-badge');
    if (badge) { badge.textContent = active ? 'Atendimento ativo' : s.enabled ? 'Aguardando painel / WhatsApp' : 'Desativado'; badge.className = `i9-state-pill ${active?'is-on':s.enabled?'is-waiting':'is-off'}`; }
    const enable = document.getElementById('ai-enable'), disable = document.getElementById('ai-disable');
    if (enable) enable.hidden = !!s.enabled; if (disable) disable.hidden = !s.enabled;
    const copy = document.getElementById('ai-runtime-copy');
    if (copy) copy.textContent = active ? 'Tudo pronto: o assistente pode responder mensagens novas da conversa aberta no WhatsApp Web.' : s.enabled ? 'O assistente está configurado, mas precisa de painel aberto e sessão do WhatsApp Web disponível.' : 'Ative o atendimento quando o provedor, a planilha e o vendedor estiverem configurados.';
    const wa = document.getElementById('ai-wa-status'); if (wa) wa.innerHTML = `<i class="fas fa-circle"></i> WhatsApp: ${s.whatsappConnected ? 'conectado' : 'não conectado'}`;
    const hb = document.getElementById('ai-heartbeat-status'); if (hb) hb.innerHTML = `<i class="fas fa-circle"></i> Painel aberto: ${s.runtimeActive ? 'ativo' : 'não detectado'}`;
    const last = document.getElementById('ai-last-event'); if (last) last.textContent = `Última atividade: ${s.lastActivity ? new Date(s.lastActivity).toLocaleString('pt-BR') : '—'}`;
  }

  renderOrders() {
    const container = document.getElementById('ai-orders'); if (!container) return;
    if (!this.orders.length) { container.innerHTML = '<div class="i9-empty-state"><i class="fas fa-inbox"></i><strong>Nenhum pedido registrado ainda</strong><span>Quando a IA registrar um pedido, ele aparecerá aqui.</span></div>'; return; }
    container.innerHTML = this.orders.slice(0,20).map((o) => `<article class="i9-order-row"><div class="i9-order-main"><strong>${this.esc(o.customerName || 'Cliente')}</strong><span>${this.esc(o.service || 'Solicitação')} · #${this.esc(o.id || '')}</span><small>${this.esc(o.createdAt ? new Date(o.createdAt).toLocaleString('pt-BR') : '')} · Planilha: ${o.sheetRecorded ? 'registrado' : 'pendente'} · Aviso ao vendedor: ${o.sellerNotificationStatus === 'sent' ? 'enviado' : o.sellerNotificationStatus === 'sent_pending_sheet' ? 'enviado (planilha pendente)' : 'pendente'}</small></div><span class="i9-state-pill ${o.status==='closed_won'?'is-on':o.status==='rejected'?'is-off':'is-waiting'}">${this.esc(this.statusLabel(o.status))}</span><div class="i9-order-actions">${!o.sheetRecorded ? `<button class="btn btn-sm btn-secondary" data-order-id="${this.esc(o.id)}" data-order-action="retry-sheet" data-feature="whatsapp.ai_support.order_capture">Reenviar para planilha</button>` : ''}${o.sellerNotificationStatus !== 'sent' ? `<button class="btn btn-sm btn-secondary" data-order-id="${this.esc(o.id)}" data-order-action="renotify" data-feature="whatsapp.ai_support.order_capture">Reenviar aviso</button>` : ''}<button class="btn btn-sm btn-secondary" data-order-id="${this.esc(o.id)}" data-status="approved" data-feature="whatsapp.ai_support.order_capture">Aprovar</button><button class="btn btn-sm btn-ghost" data-order-id="${this.esc(o.id)}" data-status="rejected" data-feature="whatsapp.ai_support.order_capture">Recusar</button><button class="btn btn-sm btn-primary" data-order-id="${this.esc(o.id)}" data-status="closed_won" data-feature="whatsapp.ai_support.order_capture">Venda fechada</button></div></article>`).join('');
  }
  async retrySheetWrite(orderId) { const r = await this.app.api.sendMessage('AI_RETRY_ORDER_WRITE', { orderId }); if (!r?.success) { this.app.showToast(r?.error || 'Não foi possível registrar o pedido na planilha.', 'error', 7000); return; } await this.load(); this.app.showToast(r.data?.alreadyRecorded ? 'O pedido já existia na planilha; nenhuma linha duplicada foi criada.' : 'Pedido sincronizado com o Google Sheets.', 'success', 7000); }
  async renotifySeller(orderId) { const r = await this.app.api.sendMessage('AI_RENOTIFY_SELLER', { orderId }); if (!r?.success) { this.app.showToast(r?.error || 'Não foi possível reenviar o aviso.', 'error', 6000); return; } await this.load(); this.app.showToast('Aviso reenviado ao vendedor pelo WhatsApp Web.', 'success'); }
  async resumeHandoff(handoffId) { const r = await this.app.api.sendMessage('AI_RESUME_CHAT', { handoffId }); if (!r?.success) { this.app.showToast(r?.error || 'Não foi possível retomar a IA nesta conversa.', 'error'); return; } await this.load(); this.app.showToast('A IA foi retomada para esta conversa.', 'success'); }
  renderHandoffs() { const container = document.getElementById('ai-handoffs'); if (!container) return; if (!this.handoffs.length) { container.innerHTML = '<div class="i9-empty-state"><i class="fas fa-headset"></i><strong>Nenhuma transferência pendente</strong><span>As conversas que precisarem de uma pessoa aparecerão aqui.</span></div>'; return; } container.innerHTML = this.handoffs.map(h => `<article class="i9-order-row"><div class="i9-order-main"><strong>${this.esc(h.chatName || 'Contato WhatsApp')}</strong><span>Telefone final: ${this.esc(h.phoneTail || 'não detectado')}</span><small>${this.esc(h.reason || 'Aguardando atendimento humano')} · ${this.esc(h.createdAt ? new Date(h.createdAt).toLocaleString('pt-BR') : '')}</small></div><span class="i9-state-pill is-waiting">Aguardando humano</span><div class="i9-order-actions"><button class="btn btn-sm btn-primary" data-handoff-id="${this.esc(h.id)}" data-feature="whatsapp.ai_support.human_handoff">Retomar IA</button></div></article>`).join(''); }
  statusLabel(status) { return ({awaiting_approval:'Aguardando análise',approved:'Aprovado',rejected:'Recusado',in_progress:'Em atendimento',closed_won:'Venda fechada',error:'Erro'})[status] || status || 'Aguardando análise'; }
  esc(value) { return this.app.toast.escapeHtml(String(value ?? '')); }
}
