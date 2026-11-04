export class DashboardView {
  constructor(app) {
    this.app = app;
  }

  async render(container) {
    container.innerHTML = this.getHTML();
    await this.loadStats();
    this.bindEvents();
    await this.loadExecutionSummary();
    this.executionTimer = setInterval(() => this.loadExecutionSummary(), 15000);
    if (this.app.hasFeature?.('dashboard.commercial_agenda')) {
      await this.loadCommercialOverview();
      this.commercialTimer = setInterval(() => this.loadCommercialOverview(), 60000);
    }
    if (this.app.hasFeature?.('dashboard.management_intelligence')) {
      await this.loadCommercialPerformance();
      await this.loadCommercialManagement();
      await this.loadManagementIntelligence();
      this.performanceTimer = setInterval(() => { this.loadCommercialPerformance(); this.loadCommercialManagement(); this.loadManagementIntelligence(); }, 60000);
    }
  }

  getHTML() {
    return `<div class="view-dashboard">
      <header class="view-header"><h2>Dashboard Comercial</h2></header>
      <div class="stats-grid">
        <div class="stat-card"><h3>Campanhas Ativas</h3><div class="stat-value" id="stat-active-campaigns">0</div></div>
        <div class="stat-card"><h3>Mensagens Enviadas Hoje</h3><div class="stat-value success" id="stat-sent-today">0</div></div>
        <div class="stat-card"><h3>Taxa de Sucesso</h3><div class="stat-value" id="stat-success-rate">0%</div></div>
        <div class="stat-card"><h3>Leads Salvos</h3><div class="stat-value" id="stat-leads-saved">0</div></div>
        <div class="stat-card" data-feature="dashboard.analytics"><h3>Oportunidades no funil</h3><div class="stat-value" id="stat-opportunities">0</div></div>
        <div class="stat-card" data-feature="telemetry.sales_funnel"><h3>Oportunidades abertas (total)</h3><div class="stat-value" id="stat-opportunities-total">0</div></div>
        <div class="stat-card" data-feature="dashboard.analytics"><h3>Clientes Fechados</h3><div class="stat-value success" id="stat-closed-customers">0</div></div>
        <div class="stat-card" data-feature="telemetry.sales_funnel"><h3>Vendas Registradas</h3><div class="stat-value success" id="stat-sales-closed">0</div></div>
        <div class="stat-card" data-feature="telemetry.sales_funnel"><h3>Valor Vendido (IA)</h3><div class="stat-value" id="stat-sales-revenue">R$ 0,00</div></div>
      </div>
      <div class="form-section i9-dashboard-execution">
        <div class="i9-dashboard-execution-head"><div><div class="form-section-title">Status da operação</div><p>Resumo da campanha, conexão e atendimento com IA.</p></div><button class="btn btn-secondary btn-sm" id="quick-open-execution"><i class="fas fa-gauge-high"></i> Central de Execução</button></div>
        <div id="dashboard-execution-summary" class="i9-dashboard-execution-grid"><div class="i9-dashboard-execution-placeholder">Consultando o estado atual…</div></div>
      </div>
      ${this.getCommercialHTML()}
      ${this.getPerformanceHTML()}
      ${this.getCommercialManagementHTML()}
      ${this.getManagementIntelligenceHTML()}
      <div class="form-section">
        <div class="form-section-title">Ações Rápidas</div>
        <div class="btn-group">
          <button class="btn btn-primary" id="quick-new-campaign"><i class="fas fa-plus"></i> Nova Campanha WhatsApp</button>
          <button class="btn btn-secondary" id="quick-extract-maps"><i class="fas fa-map-marker-alt"></i> Extrair do Google Maps</button>
          <button class="btn btn-secondary" id="quick-view-crm"><i class="fas fa-database"></i> Ver CRM</button>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">Campanhas Recentes</div>
        <div id="recent-campaigns" class="campaign-list"></div>
      </div>
    </div>`;
  }

  getCommercialHTML() {
    return `<section class="form-section i9-commercial-overview" id="commercial-overview" data-feature="dashboard.commercial_agenda">
      <div class="i9-commercial-head">
        <div>
          <div class="form-section-title"><i class="fas fa-calendar-check"></i> Agenda e atividades comerciais</div>
          <p>Visão dos compromissos vinculados aos leads, follow-ups, pendências e movimentações registradas no CRM.</p>
          <div id="commercial-calendar-status" class="i9-commercial-connection">Verificando Google Agenda...</div>
        </div>
        <div class="i9-commercial-toolbar">
          <button class="btn btn-secondary btn-sm" id="commercial-refresh"><i class="fas fa-rotate"></i> Atualizar</button>
          <button class="btn btn-secondary btn-sm" id="commercial-calendar-settings"><i class="fas fa-gear"></i> Configurar agenda</button>
          <button class="btn btn-primary btn-sm" id="commercial-open-followups"><i class="fas fa-clock"></i> Follow-ups</button>
        </div>
      </div>
      <div class="i9-commercial-kpis" id="commercial-kpis"><div class="i9-dashboard-execution-placeholder">Carregando indicadores comerciais...</div></div>
      <div class="i9-commercial-grid">
        <article class="i9-commercial-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-calendar-day"></i> Agenda de hoje</strong><span id="commercial-today-count">0</span></div><div class="i9-commercial-list" id="commercial-today-events"><div class="i9-commercial-empty">Carregando compromissos...</div></div></article>
        <article class="i9-commercial-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-calendar-week"></i> Próximos 7 dias</strong><span id="commercial-upcoming-count">0</span></div><div class="i9-commercial-list" id="commercial-upcoming-events"><div class="i9-commercial-empty">Carregando compromissos...</div></div></article>
        <article class="i9-commercial-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-bell"></i> Follow-ups vencidos</strong><span id="commercial-overdue-count">0</span></div><div class="i9-commercial-list" id="commercial-overdue-followups"><div class="i9-commercial-empty">Carregando follow-ups...</div></div><button class="btn btn-sm btn-secondary i9-commercial-panel-link" data-commercial-action="followups">Ver todos os follow-ups</button></article>
        <article class="i9-commercial-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-hourglass-half"></i> Próximos follow-ups</strong><span id="commercial-followup-count">0</span></div><div class="i9-commercial-list" id="commercial-upcoming-followups"><div class="i9-commercial-empty">Carregando follow-ups...</div></div></article>
        <article class="i9-commercial-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-user-clock"></i> Leads sem próxima ação</strong><span id="commercial-no-action-count">0</span></div><div class="i9-commercial-list" id="commercial-leads-no-action"><div class="i9-commercial-empty">Carregando leads...</div></div><button class="btn btn-sm btn-secondary i9-commercial-panel-link" data-commercial-action="crm">Abrir CRM</button></article>
        <article class="i9-commercial-panel" data-feature="google.calendar.automation"><div class="i9-commercial-panel-head"><strong><i class="fas fa-list-check"></i> Pendências de automação</strong><span id="commercial-task-count">0</span></div><div class="i9-commercial-list" id="commercial-automation-tasks"><div class="i9-commercial-empty">Carregando pendências...</div></div></article>
        <article class="i9-commercial-panel i9-commercial-panel-wide"><div class="i9-commercial-panel-head"><strong><i class="fas fa-clock-rotate-left"></i> Atividades recentes</strong><span>Últimos registros</span></div><div class="i9-commercial-list" id="commercial-recent-activities"><div class="i9-commercial-empty">Carregando atividades...</div></div></article>
      </div>
      <div class="i9-commercial-productivity" id="commercial-productivity-summary"></div>
      <div class="i9-commercial-footnote">Os indicadores consideram os registros locais do i9Hub. A agenda exibe compromissos associados aos cards de leads; eventos externos sem vínculo com o CRM não entram nesta visão.</div>
    </section>`;
  }

  getPerformanceHTML() {
    return `<section class="form-section i9-performance-overview" id="commercial-performance" data-feature="dashboard.commercial_performance">
      <div class="i9-performance-head">
        <div>
          <div class="form-section-title"><i class="fas fa-chart-pie"></i> Relatórios e inteligência de performance</div>
          <p>Conversão por coorte, desempenho por responsável, comparecimento, tempo de fechamento e previsão ponderada do funil.</p>
        </div>
        <div class="i9-performance-toolbar">
          <select class="form-select" id="commercial-performance-range" aria-label="Período do relatório">
            <option value="30" selected>Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Últimos 12 meses</option>
            <option value="0">Todo o histórico disponível</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="commercial-performance-refresh"><i class="fas fa-rotate"></i> Atualizar</button>
          <button class="btn btn-secondary btn-sm" id="commercial-probability-toggle"><i class="fas fa-sliders"></i> Probabilidades</button>
        </div>
      </div>
      <div class="i9-performance-period" id="commercial-performance-period">Carregando relatório...</div>
      <div class="i9-performance-kpis" id="commercial-performance-kpis"><div class="i9-commercial-empty">Calculando indicadores...</div></div>
      <div class="i9-performance-grid">
        <article class="i9-performance-panel">
          <div class="i9-commercial-panel-head"><strong><i class="fas fa-user-tie"></i> Performance por vendedor</strong><span>Carteira atribuída no período</span></div>
          <div class="i9-performance-table-wrap"><table class="i9-performance-table"><thead><tr><th>Responsável</th><th>Leads atribuídos</th><th>Ganhos da carteira</th><th>Conversão</th><th>Vendas no período</th><th>Receita registrada</th><th>Comparecimento</th></tr></thead><tbody id="commercial-performance-sellers"><tr><td colspan="7">Carregando...</td></tr></tbody></table></div>
          <small class="i9-performance-note">A conversão por vendedor acompanha os leads atribuídos no período e verifica quantos já estão em etapa de ganho. Atribuições anteriores à implantação do responsável não são reconstruídas.</small>
        </article>
        <article class="i9-performance-panel">
          <div class="i9-commercial-panel-head"><strong><i class="fas fa-filter"></i> Desempenho por etapa</strong><span>Funil atual e movimentações</span></div>
          <div class="i9-performance-table-wrap"><table class="i9-performance-table"><thead><tr><th>Etapa</th><th>Leads atuais</th><th>Entradas no período</th><th>Valor no funil</th><th>Previsão ponderada</th><th>Dias médios na etapa</th></tr></thead><tbody id="commercial-performance-stages"><tr><td colspan="6">Carregando...</td></tr></tbody></table></div>
        </article>
      </div>
      <div class="i9-performance-grid i9-performance-grid-bottom">
        <article class="i9-performance-panel">
          <div class="i9-commercial-panel-head"><strong><i class="fas fa-bullseye"></i> Previsão ponderada de vendas</strong><span>Oportunidades abertas</span></div>
          <div id="commercial-performance-forecast" class="i9-performance-forecast"></div>
        </article>
        <article class="i9-performance-panel">
          <div class="i9-commercial-panel-head"><strong><i class="fas fa-clipboard-check"></i> Qualidade dos dados</strong><span>Limites de interpretação</span></div>
          <div id="commercial-performance-quality" class="i9-performance-quality"></div>
        </article>
      </div>
      <div class="i9-performance-config" id="commercial-probability-config" hidden>
        <div class="i9-commercial-panel-head"><strong>Probabilidade por etapa</strong><span>Edite a chance estimada de ganho</span></div>
        <p class="i9-performance-note">Os percentuais abaixo são parâmetros de planejamento definidos pela sua equipe. Não são taxas históricas calculadas automaticamente.</p>
        <div class="i9-performance-probability-grid" id="commercial-probability-fields"></div>
        <div class="i9-performance-config-actions"><button class="btn btn-secondary btn-sm" id="commercial-probability-cancel">Fechar</button><button class="btn btn-primary btn-sm" id="commercial-probability-save"><i class="fas fa-save"></i> Salvar probabilidades</button></div>
      </div>
      <div class="i9-performance-disclaimer">Receita realizada usa somente o campo "Valor efetivamente vendido" em leads com etapa de ganho. Previsão ponderada usa "Valor estimado da oportunidade" × probabilidade configurada. O i9Hub não cria valores automaticamente nem transforma previsão em venda.</div>
    </section>`;
  }

  async loadStats() {
    try {
      const dashboardRes = await this.app.api.getDashboardStats();
      if (dashboardRes.success && dashboardRes.data) {
        const data = dashboardRes.data;
        document.getElementById('stat-active-campaigns').textContent = data.activeCampaigns || 0;
        document.getElementById('stat-sent-today').textContent = data.sentToday || 0;
        document.getElementById('stat-success-rate').textContent = (data.successRate || 0) + '%';
        document.getElementById('stat-leads-saved').textContent = data.leadsSaved || 0;
        const setStat = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = Number(value || 0).toLocaleString('pt-BR'); };
        setStat('stat-conversations-detected', data.conversationsDetected);
        setStat('stat-opportunities', data.opportunitiesOpened);
        setStat('stat-opportunities-total', data.opportunitiesCreatedTotal);
        setStat('stat-closed-customers', data.closedCustomers);
        setStat('stat-sales-closed', data.salesClosed);
        const revenueEl = document.getElementById('stat-sales-revenue');
        if (revenueEl) revenueEl.textContent = Number(data.salesRevenue || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      }
      const campaignsRes = await this.app.api.getCampaigns();
      if (campaignsRes.success && Array.isArray(campaignsRes.data)) {
        this.renderRecentCampaigns(campaignsRes.data.slice(0, 5));
      }
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
    }
  }

  async loadExecutionSummary() {
    const container = document.getElementById('dashboard-execution-summary');
    if (!container) return;
    try {
      const [aiRes, waRes, campaignRes] = await Promise.all([
        this.app.api.sendMessage('AI_GET_STATUS'),
        this.app.api.sendMessage('WA_STATUS'),
        this.app.api.getCampaigns(),
      ]);
      const ai = aiRes?.success ? aiRes.data || {} : null;
      const wa = waRes?.success ? waRes.data || {} : null;
      const campaigns = campaignRes?.success && Array.isArray(campaignRes.data) ? campaignRes.data : null;
      const aiConfigured = !!(ai?.apiKeyConfigured && ai?.modelConfigured && ai?.providerVerified);
      const aiActive = !!(ai?.enabled && ai?.runtimeActive && ai?.whatsappConnected && aiConfigured && !(ai?.setupMissing || []).length);
      let aiLabel = 'Estado desconhecido';
      if (ai) aiLabel = !aiConfigured ? 'Não conectada' : !ai.enabled ? 'Pausada' : !ai.whatsappConnected ? 'WhatsApp desconectado' : !ai.panelActive ? 'Painel inativo' : (ai.setupMissing || []).length ? 'Configuração incompleta' : aiActive ? 'Ativa' : 'Aguardando';
      const waLabel = !wa ? 'Estado desconhecido' : wa.state === 'connected' ? 'Conectado' : wa.state === 'qr' ? 'Aguardando QR' : wa.state === 'opening' ? 'Conectando' : wa.state === 'error' ? 'Erro' : 'Desconectado';
      const activeCount = campaigns ? campaigns.filter(c => c.status === 'running').length : null;
      const pendingInbound = ai && Number.isFinite(Number(ai.pendingInboundCount)) ? Number(ai.pendingInboundCount) : null;
      const card = (icon, label, value, detail, tone = 'neutral') => `<article class="i9-dashboard-execution-card tone-${tone}"><span class="i9-dashboard-execution-icon"><i class="fas ${icon}"></i></span><div><span>${this.escapeHtml(label)}</span><strong>${this.escapeHtml(value)}</strong><small>${this.escapeHtml(detail)}</small></div></article>`;
      container.innerHTML = [
        card('fa-robot', 'Chat com IA', aiLabel, ai?.lastActivity ? `Última atividade ${new Date(ai.lastActivity).toLocaleTimeString('pt-BR')}` : 'Sem atividade recente informada', aiActive ? 'active' : aiConfigured && ai?.enabled ? 'waiting' : 'neutral'),
        card('fa-whatsapp', 'WhatsApp Web', waLabel, wa?.visible === false ? 'Sessão fora de vista' : 'Estado da conexão', wa?.state === 'connected' ? 'active' : 'waiting'),
        card('fa-paper-plane', 'Campanhas em execução', activeCount === null ? '—' : String(activeCount), campaigns === null ? 'Não foi possível consultar' : `${campaigns.filter(c => c.status === 'paused').length} pausada(s)`, activeCount > 0 ? 'active' : 'neutral'),
        card('fa-inbox', 'Entrada da IA', pendingInbound === null ? '—' : String(pendingInbound), 'Mensagem(ns) em processamento/fila', pendingInbound > 0 ? 'waiting' : 'neutral'),
      ].join('');
    } catch {
      container.innerHTML = '<div class="i9-dashboard-execution-placeholder">Não foi possível consultar o status. Abra a Central de Execução para tentar novamente.</div>';
    }
  }

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  onLeave() {
    if (this.executionTimer) clearInterval(this.executionTimer);
    if (this.commercialTimer) clearInterval(this.commercialTimer);
    if (this.performanceTimer) clearInterval(this.performanceTimer);
    this.executionTimer = null;
    this.commercialTimer = null;
    this.performanceTimer = null;
    if (this.managementTimer) clearInterval(this.managementTimer);
    this.managementTimer = null;
  }

  renderRecentCampaigns(campaigns) {
    const container = document.getElementById('recent-campaigns');
    if (!container) return;
    if (!campaigns || campaigns.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Nenhuma campanha recente.</p></div>';
      return;
    }
    container.innerHTML = campaigns.map(c => this.getCampaignItemHTML(c)).join('');
  }

  getCampaignItemHTML(campaign) {
    const status = campaign?.status || 'draft';
    const total = Number(campaign?.total) || 0;
    const sent = Number(campaign?.sent) || 0;
    const progress = total > 0 ? Math.round((sent / total) * 100) : 0;
    const statusClass = { running: 'status-running', paused: 'status-paused', completed: 'status-completed', draft: 'status-draft' }[status] || 'status-draft';
    const statusLabel = { running: 'Em andamento', paused: 'Pausada', completed: 'Concluída', draft: 'Rascunho' }[status] || status;
    const id = this.escapeHtml(String(campaign?.id ?? ''));
    return '<div class="campaign-item"><div class="campaign-header"><span class="campaign-name">' + this.escapeHtml(campaign?.name || '') + '</span><span class="campaign-status ' + statusClass + '">' + this.escapeHtml(statusLabel) + '</span></div><div class="campaign-meta"><span><i class="fas fa-paper-plane"></i> ' + sent + '/' + total + ' enviados</span><span><i class="fas fa-clock"></i> ' + this.escapeHtml(this.formatDate(campaign?.createdAt)) + '</span></div><div class="campaign-progress"><div class="campaign-progress-bar" style="width: ' + progress + '%"></div></div><div class="campaign-actions"><button class="btn btn-sm btn-secondary" data-action="view" data-id="' + id + '">Ver</button>' + (status === 'running' ? '<button class="btn btn-sm btn-secondary" data-action="pause" data-id="' + id + '">Pausar</button>' : status === 'paused' ? '<button class="btn btn-sm btn-primary" data-action="resume" data-id="' + id + '">Retomar</button>' : '') + '<button class="btn btn-sm btn-danger" data-action="delete" data-id="' + id + '">Excluir</button></div></div>';
  }

  formatDate(iso) {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
  }

  bindEvents() {
    document.getElementById('quick-new-campaign')?.addEventListener('click', () => this.app.router.navigate('campaigns-wa'));
    document.getElementById('quick-open-execution')?.addEventListener('click', () => this.app.router.navigate('execution'));
    document.getElementById('quick-extract-maps')?.addEventListener('click', () => this.app.router.navigate('maps'));
    document.getElementById('quick-view-crm')?.addEventListener('click', () => this.app.router.navigate('crm'));
    // Atualiza as estatísticas quando oportunidades privadas são atualizadas pelo CRM.
    if (!this._privateOppListenerAdded) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === 'PRIVATE_OPPORTUNITIES_UPDATED') { this.loadStats(); }
      });
      this._privateOppListenerAdded = true;
    }
    document.getElementById('recent-campaigns')?.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      this.handleCampaignAction(button.dataset.action, button.dataset.id);
    });
    if (!this._commercialListenerAdded) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (['CALENDAR_EVENTS_UPDATED', 'CALENDAR_AUTOMATION_TASKS_UPDATED', 'FOLLOWUPS_UPDATED', 'CLASSIFICATION_UPDATED', 'PRIVATE_OPPORTUNITIES_UPDATED', 'COMMERCIAL_PERFORMANCE_UPDATED', 'COMMERCIAL_MANAGEMENT_UPDATED', 'LEAD_CUSTOM_FIELDS_UPDATED', 'LEADS_UPDATED'].includes(msg?.type)) {
          if (this.app.router?.currentRoute === 'dashboard') { this.loadCommercialOverview(); this.loadCommercialPerformance(); this.loadCommercialManagement(); this.loadManagementIntelligence(); }
        }
      });
      this._commercialListenerAdded = true;
    }
    const commercial = document.getElementById('commercial-overview');
    if (commercial && !commercial.dataset.bound) {
      commercial.dataset.bound = '1';
      commercial.addEventListener('click', (event) => this.handleCommercialDashboardClick(event));
    }
    document.getElementById('commercial-performance-range')?.addEventListener('change', (event) => this.loadCommercialPerformance(Number(event.currentTarget.value)));
    document.getElementById('commercial-performance-refresh')?.addEventListener('click', () => this.loadCommercialPerformance());
    document.getElementById('commercial-probability-toggle')?.addEventListener('click', () => {
      const panel = document.getElementById('commercial-probability-config');
      if (panel) panel.hidden = !panel.hidden;
    });
    document.getElementById('commercial-probability-cancel')?.addEventListener('click', () => {
      const panel = document.getElementById('commercial-probability-config');
      if (panel) panel.hidden = true;
    });
    document.getElementById('commercial-probability-save')?.addEventListener('click', () => this.saveCommercialProbabilities());
    const management = document.getElementById('commercial-management');
    if (management && !management.dataset.bound) {
      management.dataset.bound = '1';
      management.addEventListener('click', (event) => this.handleCommercialManagementClick(event));
    }
    document.getElementById('commercial-management-month')?.addEventListener('change', async (event) => { await this.loadCommercialManagement(event.currentTarget.value); await this.loadManagementIntelligence(event.currentTarget.value); });
    document.getElementById('commercial-management-refresh')?.addEventListener('click', async () => { await this.loadCommercialManagement(); await this.loadManagementIntelligence(); });
    document.getElementById('management-intelligence-refresh')?.addEventListener('click', () => this.loadManagementIntelligence());
    document.getElementById('management-intelligence-generate-ai')?.addEventListener('click', () => this.generateManagementInsights());
    document.getElementById('commercial-management-export')?.addEventListener('click', () => this.exportCommercialManagementCSV());
    document.getElementById('cm-seller-form')?.addEventListener('submit', (event) => { event.preventDefault(); this.saveCommercialManagementForm('seller'); });
    document.getElementById('cm-team-form')?.addEventListener('submit', (event) => { event.preventDefault(); this.saveCommercialManagementForm('team'); });
    document.getElementById('cm-product-form')?.addEventListener('submit', (event) => { event.preventDefault(); this.saveCommercialManagementForm('product'); });
    document.getElementById('cm-goal-form')?.addEventListener('submit', (event) => { event.preventDefault(); this.saveCommercialManagementForm('goal'); });
    document.getElementById('cm-goal-type')?.addEventListener('change', () => this.updateCommercialGoalTargetOptions());
    document.getElementById('cm-seller-cancel')?.addEventListener('click', () => this.resetCommercialManagementForm('seller'));
    document.getElementById('cm-team-cancel')?.addEventListener('click', () => this.resetCommercialManagementForm('team'));
    document.getElementById('cm-product-cancel')?.addEventListener('click', () => this.resetCommercialManagementForm('product'));
    document.getElementById('cm-goal-cancel')?.addEventListener('click', () => this.resetCommercialManagementForm('goal'));
    document.getElementById('commercial-refresh')?.addEventListener('click', () => this.loadCommercialOverview());
    document.getElementById('commercial-calendar-settings')?.addEventListener('click', () => this.openCalendarSettings());
    document.getElementById('commercial-open-followups')?.addEventListener('click', () => this.app.router.navigate('followups'));
  }


  getManagementIntelligenceHTML() {
    return `<section class="form-section i9-management-intelligence" id="management-intelligence" data-feature="dashboard.management_intelligence">
      <div class="i9-intelligence-head">
        <div><div class="form-section-title"><i class="fas fa-brain"></i> Inteligência gerencial</div><p>Identifique metas em risco, oportunidades paradas, desempenho por vendedor, equipe, produto e nicho, além de estimar o ritmo de faturamento.</p><div id="management-intelligence-period" class="i9-intelligence-status">Aguardando indicadores comerciais...</div></div>
        <div class="i9-intelligence-toolbar"><button class="btn btn-secondary btn-sm" id="management-intelligence-refresh"><i class="fas fa-rotate"></i> Atualizar</button><button class="btn btn-primary btn-sm" id="management-intelligence-generate-ai"><i class="fas fa-wand-magic-sparkles"></i> Gerar análise com IA</button></div>
      </div>
      <div id="management-intelligence-kpis" class="i9-intelligence-kpis"><div class="i9-commercial-empty">Calculando indicadores gerenciais...</div></div>
      <div class="i9-intelligence-grid">
        <article class="i9-intelligence-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-chart-line"></i> Projeção de faturamento</strong><span>Ritmo do mês</span></div><div id="management-intelligence-forecast" class="i9-intelligence-forecast">Calculando projeção...</div></article>
        <article class="i9-intelligence-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-triangle-exclamation"></i> Pontos de atenção</strong><span>Prioridades sugeridas</span></div><div id="management-intelligence-recommendations" class="i9-intelligence-recommendations">Analisando...</div></article>
      </div>
      <div class="i9-intelligence-grid">
        <article class="i9-intelligence-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-users"></i> Performance por vendedor</strong><span>Resultado no período</span></div><div class="i9-management-table-wrap"><table class="i9-management-table"><thead><tr><th>Vendedor</th><th>Equipe</th><th>Vendas</th><th>Receita</th><th>Meta</th></tr></thead><tbody id="management-intelligence-sellers"><tr><td colspan="5">Carregando...</td></tr></tbody></table></div></article>
        <article class="i9-intelligence-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-layer-group"></i> Segmentos e nichos</strong><span>Classificação disponível no CRM</span></div><div class="i9-management-table-wrap"><table class="i9-management-table"><thead><tr><th>Segmento / nicho</th><th>Leads</th><th>Oportunidades</th><th>Pipeline</th><th>Receita</th></tr></thead><tbody id="management-intelligence-segments"><tr><td colspan="5">Carregando...</td></tr></tbody></table></div></article>
      </div>
      <div class="i9-intelligence-grid">
        <article class="i9-intelligence-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-hourglass-half"></i> Oportunidades paradas</strong><span>Sem mudança de etapa há 7 dias ou mais</span></div><div class="i9-management-table-wrap"><table class="i9-management-table"><thead><tr><th>Lead</th><th>Etapa</th><th>Responsável</th><th>Dias</th><th>Valor estimado</th></tr></thead><tbody id="management-intelligence-stalled"><tr><td colspan="5">Carregando...</td></tr></tbody></table></div><small class="i9-performance-note">A idade usa a última alteração de etapa disponível. Quando não há histórico, usa a data de criação como aproximação e sinaliza a limitação.</small></article>
        <article class="i9-intelligence-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-boxes-stacked"></i> Produtos e serviços</strong><span>Receita e vendas fechadas</span></div><div class="i9-management-table-wrap"><table class="i9-management-table"><thead><tr><th>Produto/serviço</th><th>Vendas</th><th>Receita</th><th>Comissão</th></tr></thead><tbody id="management-intelligence-products"><tr><td colspan="4">Carregando...</td></tr></tbody></table></div></article>
      </div>
      <article class="i9-intelligence-panel i9-intelligence-ai-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-robot"></i> Parecer executivo da IA</strong><span id="management-intelligence-ai-meta">Sob demanda</span></div><div id="management-intelligence-ai-result" class="i9-intelligence-ai-result" aria-live="polite">Clique em “Gerar análise com IA” para receber um diagnóstico executivo e um plano de ação. A análise usa o provedor e a chave configurados em Atendimento IA.</div><p class="i9-intelligence-privacy">Privacidade: a análise envia ao provedor somente indicadores agregados. Nomes, telefones e conteúdo das conversas dos leads não são enviados. O uso da API pode gerar custos conforme o provedor contratado.</p></article>
      <div class="i9-intelligence-disclaimer">A projeção é uma extrapolação linear do ritmo já realizado, não uma promessa de faturamento. Recomendações automáticas são apoio à decisão: valide os dados e o contexto comercial antes de agir.</div>
    </section>`;
  }

  async loadManagementIntelligence(month) {
    if (!this.app.hasFeature?.('dashboard.management_intelligence')) return;
    const container = document.getElementById('management-intelligence');
    if (!container) return;
    const monthInput = document.getElementById('commercial-management-month');
    const selectedMonth = month || monthInput?.value || '';
    const status = document.getElementById('management-intelligence-period');
    if (status) status.textContent = 'Atualizando indicadores gerenciais...';
    try {
      const response = await this.app.api.getManagementIntelligence(selectedMonth, 7);
      if (!response?.success) {
        if (status) status.textContent = response?.error || 'Não foi possível carregar a inteligência gerencial.';
        return;
      }
      this.managementIntelligenceData = response.data || {};
      this.renderManagementIntelligence();
    } catch (error) {
      if (status) status.textContent = `Falha ao atualizar a inteligência gerencial: ${error.message}`;
    }
  }

  renderManagementIntelligence() {
    const data = this.managementIntelligenceData || {};
    const forecast = data.forecast || {};
    const metrics = data.metrics || {};
    const status = document.getElementById('management-intelligence-period');
    if (status) status.textContent = `Referência ${data.period?.label || '—'} · Atualizado ${this.formatDate(data.generatedAt)}`;
    const kpiData = [
      ['Faturamento realizado', this.formatPerformanceCurrency(forecast.actualRevenue), 'fa-sack-dollar'],
      ['Projeção do mês', forecast.projectedRevenue === null ? 'Dados insuficientes' : this.formatPerformanceCurrency(forecast.projectedRevenue), 'fa-chart-line'],
      ['Atingimento da meta', this.formatPerformancePercent(forecast.goalAttainment), 'fa-bullseye'],
      ['Oportunidades paradas', Number(metrics.stalledOpportunities || 0).toLocaleString('pt-BR'), 'fa-hourglass-half'],
    ];
    const kpis = document.getElementById('management-intelligence-kpis');
    if (kpis) kpis.innerHTML = kpiData.map(([label, value, icon]) => `<article class="i9-intelligence-kpi"><span><i class="fas ${icon}"></i></span><div><small>${this.escapeHtml(label)}</small><strong>${this.escapeHtml(value)}</strong></div></article>`).join('');

    const forecastNode = document.getElementById('management-intelligence-forecast');
    if (forecastNode) {
      const projection = forecast.projectedRevenue === null ? 'Ainda não há dados suficientes para estimar.' : this.formatPerformanceCurrency(forecast.projectedRevenue);
      const attainment = forecast.projectedAttainment === null ? 'Meta de receita não cadastrada' : `${this.formatPerformancePercent(forecast.projectedAttainment)} projetados`;
      forecastNode.innerHTML = `<div class="i9-intelligence-forecast-main"><small>Receita estimada ao fim do período</small><strong>${this.escapeHtml(projection)}</strong><span>${this.escapeHtml(attainment)}</span></div><div class="i9-intelligence-forecast-pair"><span>Meta de receita<strong>${this.escapeHtml(forecast.revenueTarget > 0 ? this.formatPerformanceCurrency(forecast.revenueTarget) : 'Não cadastrada')}</strong></span><span>Dias restantes<strong>${Number(forecast.daysRemaining || 0).toLocaleString('pt-BR')}</strong></span></div><p>${this.escapeHtml(forecast.method || '')}. ${this.escapeHtml(forecast.disclaimer || '')}</p>`;
    }

    const recommendations = document.getElementById('management-intelligence-recommendations');
    if (recommendations) {
      const rows = Array.isArray(data.recommendations) ? data.recommendations : [];
      recommendations.innerHTML = rows.length ? rows.map((row) => `<div class="i9-intelligence-recommendation ${this.escapeHtml(row.priority || 'low')}"><strong>${this.escapeHtml(row.title)}</strong><span>${this.escapeHtml(row.detail)}</span></div>`).join('') : '<div class="i9-commercial-empty">Sem recomendações disponíveis para este período.</div>';
    }

    const sellerBody = document.getElementById('management-intelligence-sellers');
    const sellers = Array.isArray(data.sellerRows) ? data.sellerRows : [];
    if (sellerBody) sellerBody.innerHTML = sellers.length ? sellers.map((row) => `<tr><td><strong>${this.escapeHtml(row.sellerName)}</strong></td><td>${this.escapeHtml(row.teamName || 'Sem equipe')}</td><td>${Number(row.salesClosed || 0).toLocaleString('pt-BR')}</td><td>${this.escapeHtml(this.formatPerformanceCurrency(row.revenue))}</td><td>${row.goalAttainment === null ? '—' : this.escapeHtml(this.formatPerformancePercent(row.goalAttainment))}</td></tr>`).join('') : '<tr><td colspan="5" class="i9-performance-empty-cell">Cadastre vendedores e registre vendas para comparar resultados.</td></tr>';

    const segmentBody = document.getElementById('management-intelligence-segments');
    const segments = Array.isArray(data.segmentRows) ? data.segmentRows : [];
    if (segmentBody) segmentBody.innerHTML = segments.length ? segments.map((row) => `<tr><td><strong>${this.escapeHtml(row.segment)}</strong></td><td>${Number(row.leads || 0).toLocaleString('pt-BR')}</td><td>${Number(row.openOpportunities || 0).toLocaleString('pt-BR')}</td><td>${this.escapeHtml(this.formatPerformanceCurrency(row.pipelineValue))}</td><td>${this.escapeHtml(this.formatPerformanceCurrency(row.revenue))}</td></tr>`).join('') : '<tr><td colspan="5" class="i9-performance-empty-cell">Ainda não há classificação de segmento ou nicho nos leads.</td></tr>';

    const stalledBody = document.getElementById('management-intelligence-stalled');
    const stalled = Array.isArray(data.stalledRows) ? data.stalledRows.slice(0, 15) : [];
    if (stalledBody) stalledBody.innerHTML = stalled.length ? stalled.map((row) => `<tr><td><strong>${this.escapeHtml(row.name)}</strong><small>${this.escapeHtml(row.niche)}</small></td><td>${this.escapeHtml(row.stage)}</td><td>${this.escapeHtml(row.owner)}</td><td><strong>${Number(row.ageDays || 0).toLocaleString('pt-BR')} dias</strong>${row.ageSource === 'lead_created' ? '<small>Baseado na criação</small>' : ''}</td><td>${this.escapeHtml(this.formatPerformanceCurrency(row.dealValue))}</td></tr>`).join('') : '<tr><td colspan="5" class="i9-performance-empty-cell">Nenhuma oportunidade aberta está parada há 7 dias ou mais.</td></tr>';

    const productBody = document.getElementById('management-intelligence-products');
    const products = Array.isArray(data.productRows) ? data.productRows : [];
    if (productBody) productBody.innerHTML = products.length ? products.map((row) => `<tr><td><strong>${this.escapeHtml(row.productName || 'Sem identificação')}</strong></td><td>${Number(row.salesClosed || 0).toLocaleString('pt-BR')}</td><td>${this.escapeHtml(this.formatPerformanceCurrency(row.revenue))}</td><td>${this.escapeHtml(this.formatPerformanceCurrency(row.commissionTotal))}</td></tr>`).join('') : '<tr><td colspan="4" class="i9-performance-empty-cell">Cadastre produtos e serviços e vincule-os às vendas no CRM.</td></tr>';
  }

  async generateManagementInsights() {
    const button = document.getElementById('management-intelligence-generate-ai');
    const resultNode = document.getElementById('management-intelligence-ai-result');
    const metaNode = document.getElementById('management-intelligence-ai-meta');
    if (!button || !resultNode) return;
    const month = document.getElementById('commercial-management-month')?.value || '';
    button.disabled = true;
    resultNode.textContent = 'A IA está analisando os indicadores agregados. Isso pode levar alguns segundos...';
    if (metaNode) metaNode.textContent = 'Análise em andamento';
    try {
      const response = await this.app.api.generateManagementInsights(month, 7);
      if (!response?.success) {
        resultNode.textContent = response?.error || 'Não foi possível gerar a análise com IA.';
        if (metaNode) metaNode.textContent = 'Não concluída';
        return;
      }
      resultNode.textContent = response.data?.text || 'A IA não retornou um parecer.';
      if (metaNode) metaNode.textContent = `${response.data?.provider || 'IA'} · ${response.data?.model || ''} · ${this.formatDate(response.data?.generatedAt)}`;
      this.app.showToast('Análise gerencial com IA concluída.', 'success');
    } catch (error) {
      resultNode.textContent = `Falha ao gerar análise: ${error.message}`;
      if (metaNode) metaNode.textContent = 'Erro';
    } finally {
      button.disabled = false;
    }
  }

  getCommercialManagementHTML() {
    const today = new Date();
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    return `<section class="form-section i9-management-overview" id="commercial-management" data-feature="dashboard.commercial_performance">
      <div class="i9-management-head">
        <div><div class="form-section-title"><i class="fas fa-users-gear"></i> Gestão de metas, equipes e comissões</div><p>Cadastre vendedores, organize equipes, defina metas mensais e acompanhe comissões calculadas sobre vendas registradas.</p></div>
        <div class="i9-management-toolbar"><label>Mês de referência<input class="form-input" type="month" id="commercial-management-month" value="${month}"></label><button class="btn btn-secondary btn-sm" id="commercial-management-export"><i class="fas fa-file-csv"></i> Exportar CSV</button><button class="btn btn-secondary btn-sm" id="commercial-management-refresh"><i class="fas fa-rotate"></i> Atualizar</button></div>
      </div>
      <div class="i9-management-period" id="commercial-management-period">Carregando gestão comercial...</div>
      <div class="i9-management-kpis" id="commercial-management-kpis"><div class="i9-commercial-empty">Calculando metas e comissões...</div></div>
      <div class="i9-management-alerts" id="commercial-management-alerts"></div>
      <div class="i9-management-forms">
        <article class="i9-management-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-user-plus"></i> Cadastro de vendedor</strong><span>Comissão padrão opcional</span></div>
          <form id="cm-seller-form" class="i9-management-form"><input type="hidden" id="cm-seller-id"><label>Nome do vendedor<input class="form-input" id="cm-seller-name" maxlength="120" required placeholder="Nome completo"></label><label>Equipe<select class="form-select" id="cm-seller-team"><option value="">Sem equipe</option></select></label><label>Comissão padrão (%)<input class="form-input" id="cm-seller-rate" type="number" min="0" max="100" step="0.1" value="0" required></label><div class="i9-management-form-actions"><button type="button" class="btn btn-secondary btn-sm" id="cm-seller-cancel" hidden>Cancelar edição</button><button class="btn btn-primary btn-sm" type="submit">Salvar vendedor</button></div></form>
        </article>
        <article class="i9-management-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-people-group"></i> Cadastro de equipe</strong><span>Organização comercial</span></div>
          <form id="cm-team-form" class="i9-management-form"><input type="hidden" id="cm-team-id"><label>Nome da equipe<input class="form-input" id="cm-team-name" maxlength="120" required placeholder="Ex.: Equipe Centro"></label><div class="i9-management-form-actions"><button type="button" class="btn btn-secondary btn-sm" id="cm-team-cancel" hidden>Cancelar edição</button><button class="btn btn-primary btn-sm" type="submit">Salvar equipe</button></div></form>
        </article>
        <article class="i9-management-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-box-open"></i> Produto ou serviço</strong><span>Regra de comissão por item</span></div>
          <form id="cm-product-form" class="i9-management-form"><input type="hidden" id="cm-product-id"><label>Nome<input class="form-input" id="cm-product-name" maxlength="160" required placeholder="Produto ou serviço"></label><label>Tipo<select class="form-select" id="cm-product-kind"><option value="product">Produto</option><option value="service">Serviço</option></select></label><label>Comissão (%)<input class="form-input" id="cm-product-rate" type="number" min="0" max="100" step="0.1" value="0" required></label><div class="i9-management-form-actions"><button type="button" class="btn btn-secondary btn-sm" id="cm-product-cancel" hidden>Cancelar edição</button><button class="btn btn-primary btn-sm" type="submit">Salvar item</button></div></form>
        </article>
        <article class="i9-management-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-bullseye"></i> Definir meta mensal</strong><span>Individual ou coletiva</span></div>
          <form id="cm-goal-form" class="i9-management-form"><input type="hidden" id="cm-goal-id"><label>Mês<input class="form-input" id="cm-goal-month" type="month" value="${month}" required></label><label>Meta para<select class="form-select" id="cm-goal-type"><option value="seller">Vendedor</option><option value="team">Equipe</option></select></label><label>Vendedor/equipe<select class="form-select" id="cm-goal-target" required><option value="">Cadastre primeiro</option></select></label><label>Meta de receita (R$)<input class="form-input" id="cm-goal-revenue" type="number" min="0" step="0.01" placeholder="0,00"></label><div class="i9-management-inline-fields"><label>Meta de vendas<input class="form-input" id="cm-goal-sales" type="number" min="0" step="1" placeholder="0"></label><label>Meta de leads<input class="form-input" id="cm-goal-leads" type="number" min="0" step="1" placeholder="0"></label></div><div class="i9-management-form-actions"><button type="button" class="btn btn-secondary btn-sm" id="cm-goal-cancel" hidden>Cancelar edição</button><button class="btn btn-primary btn-sm" type="submit">Salvar meta</button></div></form>
        </article>
      </div>
      <div class="i9-management-grid">
        <article class="i9-management-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-trophy"></i> Ranking de vendedores</strong><span>Receita do mês</span></div><div class="i9-management-table-wrap"><table class="i9-management-table"><thead><tr><th>#</th><th>Vendedor</th><th>Equipe atual</th><th>Vendas</th><th>Receita</th><th>Meta receita</th><th>Comissão</th></tr></thead><tbody id="cm-ranking-rows"><tr><td colspan="7">Carregando...</td></tr></tbody></table></div></article>
        <article class="i9-management-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-chart-column"></i> Metas e alertas</strong><span>Realizado x planejado</span></div><div class="i9-management-table-wrap"><table class="i9-management-table"><thead><tr><th>Meta</th><th>Alvo</th><th>Realizado</th><th>Atingimento</th><th>Status</th><th></th></tr></thead><tbody id="cm-goal-rows"><tr><td colspan="6">Carregando...</td></tr></tbody></table></div></article>
      </div>
      <div class="i9-management-grid">
        <article class="i9-management-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-coins"></i> Comissões das vendas</strong><span>Controle de pagamento</span></div><div class="i9-management-table-wrap"><table class="i9-management-table"><thead><tr><th>Venda</th><th>Vendedor</th><th>Produto/serviço</th><th>Valor vendido</th><th>Taxa</th><th>Comissão</th><th>Status</th><th></th></tr></thead><tbody id="cm-commission-rows"><tr><td colspan="8">Carregando...</td></tr></tbody></table></div><small class="i9-performance-note">Marcar como paga é um controle interno do i9Hub; não executa transferência bancária nem folha de pagamento.</small></article>
        <article class="i9-management-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-chart-pie"></i> Resultado por equipe</strong><span>Receita e comissão</span></div><div class="i9-management-table-wrap"><table class="i9-management-table"><thead><tr><th>Equipe</th><th>Vendedores</th><th>Vendas</th><th>Receita</th><th>Comissão</th></tr></thead><tbody id="cm-team-performance"><tr><td colspan="5">Carregando...</td></tr></tbody></table></div></article>
        <article class="i9-management-panel"><div class="i9-commercial-panel-head"><strong><i class="fas fa-tags"></i> Resultado por produto/serviço</strong><span>Itens vendidos no mês</span></div><div class="i9-management-table-wrap"><table class="i9-management-table"><thead><tr><th>Produto/serviço</th><th>Vendas</th><th>Receita</th><th>Comissão</th></tr></thead><tbody id="cm-product-performance"><tr><td colspan="4">Carregando...</td></tr></tbody></table></div></article>
      </div>
      <div class="i9-management-grid i9-management-grid-three">
        <article class="i9-management-panel"><div class="i9-commercial-panel-head"><strong>Vendedores cadastrados</strong><span>Cadastro local</span></div><div class="i9-management-table-wrap"><table class="i9-management-table"><thead><tr><th>Nome</th><th>Equipe</th><th>Comissão padrão</th><th></th></tr></thead><tbody id="cm-seller-rows"><tr><td colspan="4">Carregando...</td></tr></tbody></table></div></article>
        <article class="i9-management-panel"><div class="i9-commercial-panel-head"><strong>Equipes cadastradas</strong><span>Organização</span></div><div class="i9-management-table-wrap"><table class="i9-management-table"><thead><tr><th>Equipe</th><th>Vendedores ativos</th><th></th></tr></thead><tbody id="cm-team-rows"><tr><td colspan="3">Carregando...</td></tr></tbody></table></div></article>
        <article class="i9-management-panel"><div class="i9-commercial-panel-head"><strong>Produtos e serviços</strong><span>Comissão por item</span></div><div class="i9-management-table-wrap"><table class="i9-management-table"><thead><tr><th>Item</th><th>Tipo</th><th>Comissão</th><th></th></tr></thead><tbody id="cm-product-rows"><tr><td colspan="4">Carregando...</td></tr></tbody></table></div></article>
      </div>
      <div class="i9-management-quality" id="cm-management-quality"></div>
      <div class="i9-management-disclaimer">Os dados são armazenados localmente neste perfil Chrome. Comissões são calculadas sobre o valor efetivamente vendido em leads na etapa de ganho. O percentual é congelado no registro da venda; alterações posteriores na regra não recalculam vendas já registradas. Metas em risco usam uma comparação indicativa de ritmo linear, não uma previsão estatística. O módulo não efetua pagamentos.</div>
    </section>`;
  }

  formatPerformanceCurrency(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
  }

  formatPerformancePercent(value) {
    const amount = Number(value);
    return value === null || value === undefined || !Number.isFinite(amount) ? '—' : `${amount.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  }

  async loadCommercialPerformance(rangeDays) {
    if (!this.app.hasFeature?.('dashboard.commercial_performance')) return;
    const container = document.getElementById('commercial-performance');
    if (!container) return;
    const select = document.getElementById('commercial-performance-range');
    const selectedRange = rangeDays === undefined ? Number(select?.value || 30) : Number(rangeDays);
    this.performanceRangeDays = [30, 90, 365, 0].includes(selectedRange) ? selectedRange : 30;
    if (select) select.value = String(this.performanceRangeDays);
    const refresh = document.getElementById('commercial-performance-refresh');
    if (refresh) refresh.disabled = true;
    try {
      const response = await this.app.api.getCommercialPerformance(this.performanceRangeDays);
      if (!response?.success) {
        const period = document.getElementById('commercial-performance-period');
        if (period) period.textContent = response?.error || 'Não foi possível carregar o relatório comercial.';
        return;
      }
      this.performanceData = response.data || {};
      this.renderCommercialPerformance();
    } catch (error) {
      const period = document.getElementById('commercial-performance-period');
      if (period) period.textContent = `Falha ao atualizar: ${error.message}`;
    } finally {
      if (refresh) refresh.disabled = false;
    }
  }

  renderCommercialPerformance() {
    const data = this.performanceData || {};
    const metrics = data.metrics || {};
    const period = document.getElementById('commercial-performance-period');
    if (period) period.textContent = `${data.period?.label || 'Período selecionado'} · Atualizado ${this.formatDate(data.generatedAt)}`;
    const cards = [
      ['Leads criados', Number(metrics.leadsCreated || 0).toLocaleString('pt-BR'), 'fa-user-plus'],
      ['Conversão da coorte', this.formatPerformancePercent(metrics.cohortConversionRate), 'fa-chart-line'],
      ['Vendas fechadas', Number(metrics.salesClosed || 0).toLocaleString('pt-BR'), 'fa-handshake'],
      ['Receita registrada', this.formatPerformanceCurrency(metrics.salesRevenue), 'fa-sack-dollar'],
      ['Taxa de comparecimento', this.formatPerformancePercent(metrics.attendanceRate), 'fa-calendar-check'],
      ['Tempo médio de fechamento', metrics.averageClosingDays === null || metrics.averageClosingDays === undefined ? '—' : `${Number(metrics.averageClosingDays).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`, 'fa-stopwatch'],
      ['Valor no funil aberto', this.formatPerformanceCurrency(metrics.pipelineValue), 'fa-filter'],
      ['Previsão ponderada', this.formatPerformanceCurrency(metrics.weightedForecast), 'fa-bullseye'],
    ];
    const kpis = document.getElementById('commercial-performance-kpis');
    if (kpis) kpis.innerHTML = cards.map(([label, value, icon]) => `<article class="i9-performance-kpi"><span><i class="fas ${icon}"></i></span><div><small>${this.escapeHtml(label)}</small><strong>${this.escapeHtml(value)}</strong></div></article>`).join('');

    const sellers = document.getElementById('commercial-performance-sellers');
    if (sellers) {
      const rows = Array.isArray(data.sellerRows) ? data.sellerRows : [];
      sellers.innerHTML = rows.length ? rows.map((item) => `<tr>
        <td><strong>${this.escapeHtml(item.seller)}</strong></td>
        <td>${Number(item.leadsAssigned || 0).toLocaleString('pt-BR')}</td>
        <td>${Number(item.cohortWon || 0).toLocaleString('pt-BR')}</td>
        <td>${this.formatPerformancePercent(item.cohortConversionRate)}</td>
        <td>${Number(item.salesClosed || 0).toLocaleString('pt-BR')}${item.salesWithoutValue ? `<small>${Number(item.salesWithoutValue)} sem valor</small>` : ''}</td>
        <td>${this.formatPerformanceCurrency(item.recordedRevenue)}</td>
        <td>${this.formatPerformancePercent(item.attendanceRate)}<small>${Number(item.meetingsCompleted || 0)} realizadas · ${Number(item.meetingsNoShow || 0)} ausências</small></td>
      </tr>`).join('') : '<tr><td colspan="7" class="i9-performance-empty-cell">Ainda não há atribuições de vendedor ou resultados comerciais registrados no período.</td></tr>';
    }

    const stages = document.getElementById('commercial-performance-stages');
    if (stages) {
      const rows = Array.isArray(data.stageRows) ? data.stageRows : [];
      stages.innerHTML = rows.length ? rows.map((item) => `<tr>
        <td><strong>${this.escapeHtml(item.title)}</strong><small>${Number(item.probability || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% de probabilidade</small></td>
        <td>${Number(item.currentLeads || 0).toLocaleString('pt-BR')}</td>
        <td>${Number(item.enteredInPeriod || 0).toLocaleString('pt-BR')}</td>
        <td>${this.formatPerformanceCurrency(item.pipelineValue)}</td>
        <td>${this.formatPerformanceCurrency(item.weightedForecast)}</td>
        <td>${item.averageDaysInStage === null || item.averageDaysInStage === undefined ? '—' : `${Number(item.averageDaysInStage).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`}<small>${Number(item.leadsWithStageAge || 0)} com data rastreável</small></td>
      </tr>`).join('') : '<tr><td colspan="6" class="i9-performance-empty-cell">Nenhuma etapa comercial foi encontrada.</td></tr>';
    }

    const forecast = document.getElementById('commercial-performance-forecast');
    if (forecast) forecast.innerHTML = `
      <div class="i9-performance-forecast-main"><small>Potencial ponderado atual</small><strong>${this.formatPerformanceCurrency(metrics.weightedForecast)}</strong></div>
      <div class="i9-performance-forecast-pair"><span>Valor total do funil<strong>${this.formatPerformanceCurrency(metrics.pipelineValue)}</strong></span><span>Leads em aberto<strong>${Number(metrics.openOpportunities || 0).toLocaleString('pt-BR')}</strong></span></div>
      <div class="i9-performance-forecast-pair"><span>Oportunidades sem valor informado<strong>${Number(metrics.opportunitiesWithoutValue || 0).toLocaleString('pt-BR')}</strong></span><span>Leads sem responsável<strong>${Number(metrics.leadsWithoutOwner || 0).toLocaleString('pt-BR')}</strong></span></div>
      <p class="i9-performance-note">${this.escapeHtml(data.notes?.forecast || '')}</p>`;

    const quality = document.getElementById('commercial-performance-quality');
    if (quality) quality.innerHTML = `
      <ul>
        <li><strong>${Number(metrics.salesWithoutValue || 0).toLocaleString('pt-BR')}</strong> venda(s) fechada(s) no período sem valor efetivamente vendido.</li>
        <li><strong>${Number(metrics.closedWonWithoutDate || 0).toLocaleString('pt-BR')}</strong> lead(s) em etapa de ganho sem data de fechamento rastreável.</li>
        <li><strong>${Number(metrics.unassignedCreatedLeads || 0).toLocaleString('pt-BR')}</strong> lead(s) criados no período sem responsável atribuído.</li>
        <li><strong>${Number(metrics.opportunitiesWithoutValue || 0).toLocaleString('pt-BR')}</strong> oportunidade(s) abertas sem valor estimado; não entram na previsão.</li>
      </ul>
      <p class="i9-performance-note">${this.escapeHtml(data.notes?.conversion || '')}</p>
      <p class="i9-performance-note">${this.escapeHtml(data.notes?.attendance || '')}</p>
      <p class="i9-performance-note">${this.escapeHtml(data.notes?.closingTime || '')}</p>`;

    const probabilityFields = document.getElementById('commercial-probability-fields');
    if (probabilityFields) {
      const rows = Array.isArray(data.stageRows) ? data.stageRows : [];
      probabilityFields.innerHTML = rows.map((item) => `<label>${this.escapeHtml(item.title)}<div class="i9-performance-probability-input"><input class="form-input" type="number" min="0" max="100" step="0.1" data-stage-probability="${this.escapeHtml(item.id)}" value="${Number(item.probability || 0)}"><span>%</span></div></label>`).join('');
    }
  }

  async saveCommercialProbabilities() {
    const fields = document.querySelectorAll('#commercial-probability-fields [data-stage-probability]');
    const probabilities = {};
    for (const input of fields) {
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        this.app.showToast('As probabilidades devem ficar entre 0% e 100%.', 'warning');
        input.focus();
        return;
      }
      probabilities[input.dataset.stageProbability] = value;
    }
    const button = document.getElementById('commercial-probability-save');
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }
    const result = await this.app.api.saveCommercialPerformanceConfig(probabilities);
    if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-save"></i> Salvar probabilidades'; }
    if (!result?.success) {
      this.app.showToast(result?.error || 'Não foi possível salvar as probabilidades.', 'error');
      return;
    }
    const panel = document.getElementById('commercial-probability-config');
    if (panel) panel.hidden = true;
    this.app.showToast('Probabilidades do funil atualizadas.', 'success');
    await this.loadCommercialPerformance();
  }

  async loadCommercialManagement(month) {
    if (!this.app.hasFeature?.('dashboard.commercial_performance')) return;
    const container = document.getElementById('commercial-management');
    if (!container) return;
    const monthInput = document.getElementById('commercial-management-month');
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const selectedMonth = month || monthInput?.value || currentMonth;
    if (monthInput) monthInput.value = selectedMonth;
    const refresh = document.getElementById('commercial-management-refresh');
    if (refresh) refresh.disabled = true;
    try {
      const response = await this.app.api.getCommercialManagement(selectedMonth);
      if (!response?.success) {
        const period = document.getElementById('commercial-management-period');
        if (period) period.textContent = response?.error || 'Não foi possível carregar a gestão comercial.';
        return;
      }
      this.commercialManagementData = response.data || {};
      this.renderCommercialManagement();
    } catch (error) {
      const period = document.getElementById('commercial-management-period');
      if (period) period.textContent = `Falha ao atualizar a gestão comercial: ${error.message}`;
    } finally {
      if (refresh) refresh.disabled = false;
    }
  }

  managementStatusLabel(status) {
    return ({
      scheduled: 'Agendada', achieved: 'Meta alcançada', missed: 'Meta não alcançada',
      at_risk: 'Em risco', attention: 'Atenção', on_track: 'No ritmo',
    })[status] || 'Sem status';
  }

  managementStatusClass(status) {
    return ({ achieved: 'success', on_track: 'success', attention: 'warning', at_risk: 'danger', missed: 'danger', scheduled: 'muted' })[status] || 'muted';
  }

  renderCommercialManagement() {
    const data = this.commercialManagementData || {};
    const config = data.config || {};
    const report = data.report || {};
    const metrics = report.metrics || {};
    const period = document.getElementById('commercial-management-period');
    if (period) period.textContent = `Referência ${report.period?.label || '—'} · Atualizado ${this.formatDate(report.generatedAt)}`;
    const cards = [
      ['Receita do mês', this.formatPerformanceCurrency(metrics.revenue), 'fa-sack-dollar'],
      ['Vendas fechadas', Number(metrics.salesClosed || 0).toLocaleString('pt-BR'), 'fa-handshake'],
      ['Comissões pendentes', this.formatPerformanceCurrency(metrics.commissionPending), 'fa-hourglass-half'],
      ['Metas em atenção/risco', Number(metrics.goalsAtRisk || 0).toLocaleString('pt-BR'), 'fa-triangle-exclamation'],
      ['Vendedores ativos', Number(metrics.activeSellers || 0).toLocaleString('pt-BR'), 'fa-user-tie'],
      ['Equipes ativas', Number(metrics.activeTeams || 0).toLocaleString('pt-BR'), 'fa-people-group'],
    ];
    const kpis = document.getElementById('commercial-management-kpis');
    if (kpis) kpis.innerHTML = cards.map(([label, value, icon]) => `<article class="i9-management-kpi"><span><i class="fas ${icon}"></i></span><div><small>${this.escapeHtml(label)}</small><strong>${this.escapeHtml(value)}</strong></div></article>`).join('');

    const goalRows = Array.isArray(report.goalRows) ? report.goalRows : [];
    const alerts = document.getElementById('commercial-management-alerts');
    const riskGoals = goalRows.filter((goal) => ['at_risk', 'attention', 'missed'].includes(goal.status));
    if (alerts) alerts.innerHTML = riskGoals.length
      ? `<div class="i9-management-alert-head"><strong><i class="fas fa-bell"></i> Alertas de metas</strong><span>${riskGoals.length} meta(s) precisam de atenção</span></div><div class="i9-management-alert-list">${riskGoals.map((goal) => `<div class="i9-management-alert ${this.managementStatusClass(goal.status)}"><strong>${this.escapeHtml(goal.targetName)}</strong><span>${this.managementStatusLabel(goal.status)} · ${goal.attainmentPercent === null ? '0%' : this.formatPerformancePercent(goal.attainmentPercent)} de atingimento</span></div>`).join('')}</div>`
      : `<div class="i9-management-alert-empty"><i class="fas fa-circle-check"></i> ${goalRows.length ? 'Nenhuma meta está em risco no ritmo atual.' : 'Cadastre metas mensais para acompanhar alertas de desempenho.'}</div>`;

    const ranking = document.getElementById('cm-ranking-rows');
    const rankingRows = Array.isArray(report.rankingRows) ? report.rankingRows : [];
    if (ranking) ranking.innerHTML = rankingRows.length ? rankingRows.map((row) => `<tr><td><strong>${row.rank}</strong></td><td><strong>${this.escapeHtml(row.sellerName)}</strong></td><td>${this.escapeHtml(row.teamName)}</td><td>${Number(row.salesClosed || 0).toLocaleString('pt-BR')}</td><td>${this.formatPerformanceCurrency(row.revenue)}</td><td>${row.revenueTarget > 0 ? `${this.formatPerformanceCurrency(row.revenueTarget)}<small>${this.formatPerformancePercent(row.revenueAttainment)}</small>` : '—'}</td><td>${this.formatPerformanceCurrency(row.commissionTotal)}</td></tr>`).join('') : '<tr><td colspan="7" class="i9-performance-empty-cell">Cadastre vendedores e registre vendas ganhas com valores para montar o ranking.</td></tr>';

    const goals = document.getElementById('cm-goal-rows');
    if (goals) goals.innerHTML = goalRows.length ? goalRows.map((goal) => {
      const metrics = [
        { label: 'Receita', target: Number(goal.revenueTarget || 0), actual: Number(goal.actualRevenue || 0), currency: true },
        { label: 'Vendas', target: Number(goal.salesTarget || 0), actual: Number(goal.actualSales || 0), currency: false },
        { label: 'Leads', target: Number(goal.leadsTarget || 0), actual: Number(goal.assignedLeads || 0), currency: false },
      ].filter((item) => item.target > 0);
      const target = metrics.map((item) => `<small>${item.label}: ${item.currency ? this.formatPerformanceCurrency(item.target) : item.target.toLocaleString('pt-BR')}</small>`).join('');
      const actual = metrics.map((item) => {
        const pct = item.target > 0 ? item.actual / item.target * 100 : null;
        return `<small>${item.label}: ${item.currency ? this.formatPerformanceCurrency(item.actual) : item.actual.toLocaleString('pt-BR')} · ${this.formatPerformancePercent(pct)}</small>`;
      }).join('');
      const progressLabel = metrics.length > 1 ? 'Pior indicador' : (metrics[0]?.label || 'Atingimento');
      return `<tr><td><strong>${this.escapeHtml(goal.targetName)}</strong><small>${goal.targetType === 'team' ? 'Equipe' : 'Vendedor'}</small></td><td>${target}</td><td>${actual}</td><td><strong>${this.formatPerformancePercent(goal.attainmentPercent)}</strong><small>${progressLabel}</small></td><td><span class="i9-management-status ${this.managementStatusClass(goal.status)}">${this.managementStatusLabel(goal.status)}</span></td><td><button type="button" class="btn btn-secondary btn-sm" data-cm-action="edit-goal" data-id="${this.escapeHtml(goal.id)}" title="Editar meta"><i class="fas fa-pen"></i></button><button type="button" class="btn btn-danger btn-sm" data-cm-action="delete-goal" data-id="${this.escapeHtml(goal.id)}" title="Excluir meta"><i class="fas fa-trash"></i></button></td></tr>`;
    }).join('') : '<tr><td colspan="6" class="i9-performance-empty-cell">Nenhuma meta cadastrada para este mês.</td></tr>';

    const commissions = document.getElementById('cm-commission-rows');
    const commissionRows = Array.isArray(report.commissionRows) ? report.commissionRows : [];
    if (commissions) commissions.innerHTML = commissionRows.length ? commissionRows.map((row) => `<tr><td><strong>${this.escapeHtml(row.leadName)}</strong><small>${this.escapeHtml(row.teamName)}</small></td><td>${this.escapeHtml(row.sellerName)}</td><td>${this.escapeHtml(row.productName)}${row.snapshotMissing ? '<small>Regra atual · revisar histórico</small>' : ''}</td><td>${this.formatPerformanceCurrency(row.saleValue)}</td><td>${this.formatPerformancePercent(row.commissionRate)}</td><td><strong>${this.formatPerformanceCurrency(row.commissionAmount)}</strong></td><td><span class="i9-management-status ${row.status === 'paid' ? 'success' : 'warning'}">${row.status === 'paid' ? 'Paga' : 'Pendente'}</span></td><td><button type="button" class="btn btn-${row.status === 'paid' ? 'secondary' : 'primary'} btn-sm" data-cm-action="toggle-commission" data-id="${this.escapeHtml(row.leadId)}" data-status="${row.status === 'paid' ? 'pending' : 'paid'}">${row.status === 'paid' ? 'Reabrir' : 'Marcar paga'}</button></td></tr>`).join('') : '<tr><td colspan="8" class="i9-performance-empty-cell">Nenhuma comissão calculável neste mês. Confira vendedor cadastrado, produto/serviço e percentual de comissão.</td></tr>';

    const teamPerformance = document.getElementById('cm-team-performance');
    const teamRows = Array.isArray(report.teamRows) ? report.teamRows : [];
    if (teamPerformance) teamPerformance.innerHTML = teamRows.length ? teamRows.map((row) => `<tr><td><strong>${this.escapeHtml(row.teamName)}</strong></td><td>${Number(row.sellers || 0).toLocaleString('pt-BR')}</td><td>${Number(row.salesClosed || 0).toLocaleString('pt-BR')}</td><td>${this.formatPerformanceCurrency(row.revenue)}</td><td>${this.formatPerformanceCurrency(row.commissionTotal)}</td></tr>`).join('') : '<tr><td colspan="5" class="i9-performance-empty-cell">Cadastre equipes e vincule vendedores.</td></tr>';

    const productPerformance = document.getElementById('cm-product-performance');
    const productPerformanceRows = Array.isArray(report.productRows) ? report.productRows : [];
    if (productPerformance) productPerformance.innerHTML = productPerformanceRows.length ? productPerformanceRows.map((row) => `<tr><td><strong>${this.escapeHtml(row.productName)}</strong></td><td>${Number(row.salesClosed || 0).toLocaleString('pt-BR')}</td><td>${this.formatPerformanceCurrency(row.revenue)}</td><td>${this.formatPerformanceCurrency(row.commissionTotal)}</td></tr>`).join('') : '<tr><td colspan="4" class="i9-performance-empty-cell">Nenhum item associado às vendas deste mês.</td></tr>';
    const quality = document.getElementById('cm-management-quality');
    if (quality) quality.innerHTML = `<span><strong>${Number(metrics.salesWithoutSeller || 0).toLocaleString('pt-BR')}</strong> venda(s) sem vendedor cadastrado e, por isso, fora das comissões.</span><span><strong>${Number(metrics.salesWithoutCommissionRule || 0).toLocaleString('pt-BR')}</strong> venda(s) sem percentual de comissão configurado.</span><span>${this.escapeHtml(report.notes?.commission || '')}</span>`;

    const sellers = Array.isArray(config.sellers) ? config.sellers : [];
    const teams = Array.isArray(config.teams) ? config.teams : [];
    const products = Array.isArray(config.products) ? config.products : [];
    const sellerTeamSelect = document.getElementById('cm-seller-team');
    if (sellerTeamSelect) {
      const previousTeam = sellerTeamSelect.value;
      const activeTeams = teams.filter((team) => team.active !== false);
      sellerTeamSelect.innerHTML = '<option value="">Sem equipe</option>' + activeTeams.map((team) => `<option value="${this.escapeHtml(team.id)}">${this.escapeHtml(team.name)}</option>`).join('');
      if (activeTeams.some((team) => team.id === previousTeam)) sellerTeamSelect.value = previousTeam;
    }
    const sellerRows = document.getElementById('cm-seller-rows');
    if (sellerRows) sellerRows.innerHTML = sellers.length ? sellers.map((seller) => `<tr class="${seller.active === false ? 'is-inactive' : ''}"><td><strong>${this.escapeHtml(seller.name)}</strong>${seller.active === false ? '<small>Inativo</small>' : ''}</td><td>${this.escapeHtml(teams.find((team) => team.id === seller.teamId)?.name || 'Sem equipe')}</td><td>${this.formatPerformancePercent(Number(seller.defaultCommissionRate || 0))}</td><td><button type="button" class="btn btn-secondary btn-sm" data-cm-action="edit-seller" data-id="${this.escapeHtml(seller.id)}"><i class="fas fa-pen"></i></button>${seller.active === false ? '' : `<button type="button" class="btn btn-danger btn-sm" data-cm-action="deactivate-seller" data-id="${this.escapeHtml(seller.id)}"><i class="fas fa-user-slash"></i></button>`}</td></tr>`).join('') : '<tr><td colspan="4" class="i9-performance-empty-cell">Nenhum vendedor cadastrado.</td></tr>';

    const teamList = document.getElementById('cm-team-rows');
    if (teamList) teamList.innerHTML = teams.length ? teams.map((team) => `<tr class="${team.active === false ? 'is-inactive' : ''}"><td><strong>${this.escapeHtml(team.name)}</strong>${team.active === false ? '<small>Inativa</small>' : ''}</td><td>${sellers.filter((seller) => seller.active !== false && seller.teamId === team.id).length}</td><td><button type="button" class="btn btn-secondary btn-sm" data-cm-action="edit-team" data-id="${this.escapeHtml(team.id)}"><i class="fas fa-pen"></i></button>${team.active === false ? '' : `<button type="button" class="btn btn-danger btn-sm" data-cm-action="deactivate-team" data-id="${this.escapeHtml(team.id)}"><i class="fas fa-ban"></i></button>`}</td></tr>`).join('') : '<tr><td colspan="3" class="i9-performance-empty-cell">Nenhuma equipe cadastrada.</td></tr>';

    const productList = document.getElementById('cm-product-rows');
    if (productList) productList.innerHTML = products.length ? products.map((product) => `<tr class="${product.active === false ? 'is-inactive' : ''}"><td><strong>${this.escapeHtml(product.name)}</strong>${product.active === false ? '<small>Inativo</small>' : ''}</td><td>${product.kind === 'service' ? 'Serviço' : 'Produto'}</td><td>${this.formatPerformancePercent(Number(product.commissionRate || 0))}</td><td><button type="button" class="btn btn-secondary btn-sm" data-cm-action="edit-product" data-id="${this.escapeHtml(product.id)}"><i class="fas fa-pen"></i></button>${product.active === false ? '' : `<button type="button" class="btn btn-danger btn-sm" data-cm-action="deactivate-product" data-id="${this.escapeHtml(product.id)}"><i class="fas fa-ban"></i></button>`}</td></tr>`).join('') : '<tr><td colspan="4" class="i9-performance-empty-cell">Nenhum produto/serviço cadastrado.</td></tr>';
    this.updateCommercialGoalTargetOptions();
  }

  updateCommercialGoalTargetOptions() {
    const select = document.getElementById('cm-goal-target');
    if (!select) return;
    const type = document.getElementById('cm-goal-type')?.value === 'team' ? 'team' : 'seller';
    const previous = select.value;
    const config = this.commercialManagementData?.config || {};
    const options = type === 'team' ? (config.teams || []).filter((item) => item.active !== false).map((item) => ({ id: item.id, name: item.name }))
      : (config.sellers || []).filter((item) => item.active !== false).map((item) => ({ id: item.id, name: item.name }));
    select.innerHTML = `<option value="">${options.length ? 'Selecione' : 'Cadastre primeiro'}</option>` + options.map((item) => `<option value="${this.escapeHtml(item.id)}">${this.escapeHtml(item.name)}</option>`).join('');
    if (options.some((item) => item.id === previous)) select.value = previous;
  }

  exportCommercialManagementCSV() {
    const report = this.commercialManagementData?.report;
    if (!report) { this.app.showToast('Atualize a gestão comercial antes de exportar.', 'warning'); return; }
    const header = ['secao', 'mes', 'identificador', 'nome', 'equipe', 'produto_servico', 'vendas', 'meta_vendas', 'leads_atribuidos', 'meta_leads', 'receita', 'meta_receita', 'atingimento_percentual', 'percentual_comissao', 'valor_comissao', 'status'];
    const rows = [header];
    const month = report.period?.month || '';
    for (const item of report.rankingRows || []) rows.push(['vendedor', month, item.sellerId, item.sellerName, item.teamName, '', item.salesClosed, '', '', '', item.revenue, item.revenueTarget, item.revenueAttainment, '', item.commissionTotal, '']);
    for (const item of report.teamRows || []) rows.push(['equipe', month, item.teamId, item.teamName, item.teamName, '', item.salesClosed, '', '', '', item.revenue, item.revenueTarget, item.revenueAttainment, '', item.commissionTotal, '']);
    for (const item of report.goalRows || []) rows.push(['meta', month, item.id, item.targetName, item.targetType, '', item.actualSales, item.salesTarget, item.assignedLeads, item.leadsTarget, item.actualRevenue, item.revenueTarget, item.attainmentPercent, '', '', this.managementStatusLabel(item.status)]);
    for (const item of report.commissionRows || []) rows.push(['comissao', month, item.leadId, item.leadName, item.teamName, item.productName, '', '', '', '', item.saleValue, '', '', item.commissionRate, item.commissionAmount, item.status === 'paid' ? 'paga' : 'pendente']);
    for (const item of report.productRows || []) rows.push(['produto_servico', month, '', item.productName, '', item.productName, item.salesClosed, '', '', '', item.revenue, '', '', '', item.commissionTotal, '']);
    const csvCell = (value) => {
      const raw = String(value ?? '');
      const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `i9hub-gestao-comercial-${month || 'relatorio'}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.app.showToast('Relatório gerencial exportado em CSV.', 'success');
  }

  async saveCommercialManagementForm(type) {
    const byId = (id) => document.getElementById(id);
    let result;
    if (type === 'seller') {
      result = await this.app.api.saveCommercialSeller({ id: byId('cm-seller-id')?.value || '', name: byId('cm-seller-name')?.value || '', teamId: byId('cm-seller-team')?.value || '', defaultCommissionRate: byId('cm-seller-rate')?.value || 0 });
    } else if (type === 'team') {
      result = await this.app.api.saveCommercialTeam({ id: byId('cm-team-id')?.value || '', name: byId('cm-team-name')?.value || '' });
    } else if (type === 'product') {
      result = await this.app.api.saveCommercialProduct({ id: byId('cm-product-id')?.value || '', name: byId('cm-product-name')?.value || '', kind: byId('cm-product-kind')?.value || 'product', commissionRate: byId('cm-product-rate')?.value || 0 });
    } else {
      result = await this.app.api.saveCommercialGoal({ id: byId('cm-goal-id')?.value || '', month: byId('cm-goal-month')?.value || '', targetType: byId('cm-goal-type')?.value || 'seller', targetId: byId('cm-goal-target')?.value || '', revenueTarget: byId('cm-goal-revenue')?.value || 0, salesTarget: byId('cm-goal-sales')?.value || 0, leadsTarget: byId('cm-goal-leads')?.value || 0 });
    }
    if (!result?.success) {
      this.app.showToast(result?.error || 'Não foi possível salvar o cadastro.', 'error', 6000);
      return;
    }
    const label = ({ seller: 'Vendedor', team: 'Equipe', product: 'Produto/serviço', goal: 'Meta' })[type];
    this.app.showToast(`${label} salvo(a) com sucesso.`, 'success');
    this.resetCommercialManagementForm(type);
    await this.loadCommercialManagement();
  }

  resetCommercialManagementForm(type) {
    const forms = {
      seller: { form: 'cm-seller-form', id: 'cm-seller-id', cancel: 'cm-seller-cancel', submit: 'Salvar vendedor' },
      team: { form: 'cm-team-form', id: 'cm-team-id', cancel: 'cm-team-cancel', submit: 'Salvar equipe' },
      product: { form: 'cm-product-form', id: 'cm-product-id', cancel: 'cm-product-cancel', submit: 'Salvar item' },
      goal: { form: 'cm-goal-form', id: 'cm-goal-id', cancel: 'cm-goal-cancel', submit: 'Salvar meta' },
    };
    const meta = forms[type];
    const form = document.getElementById(meta?.form);
    if (!form) return;
    form.reset();
    const id = document.getElementById(meta.id);
    if (id) id.value = '';
    const cancel = document.getElementById(meta.cancel);
    if (cancel) cancel.hidden = true;
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = meta.submit;
    if (type === 'seller') { const rate = document.getElementById('cm-seller-rate'); if (rate) rate.value = '0'; }
    if (type === 'product') { const rate = document.getElementById('cm-product-rate'); if (rate) rate.value = '0'; }
    if (type === 'goal') {
      const month = document.getElementById('cm-goal-month');
      if (month) { const today = new Date(); month.value = document.getElementById('commercial-management-month')?.value || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; }
      this.updateCommercialGoalTargetOptions();
    }
  }

  editCommercialManagementEntity(type, id) {
    const config = this.commercialManagementData?.config || {};
    const entity = ({
      seller: (config.sellers || []).find((item) => item.id === id),
      team: (config.teams || []).find((item) => item.id === id),
      product: (config.products || []).find((item) => item.id === id),
      goal: (config.goals || []).find((item) => item.id === id),
    })[type];
    if (!entity) return;
    const value = (field, content) => { const el = document.getElementById(field); if (el) el.value = content ?? ''; };
    if (type === 'seller') {
      value('cm-seller-id', entity.id); value('cm-seller-name', entity.name); value('cm-seller-team', entity.teamId); value('cm-seller-rate', entity.defaultCommissionRate ?? 0);
      document.getElementById('cm-seller-cancel').hidden = false;
      document.querySelector('#cm-seller-form button[type="submit"]').textContent = 'Atualizar vendedor';
    } else if (type === 'team') {
      value('cm-team-id', entity.id); value('cm-team-name', entity.name);
      document.getElementById('cm-team-cancel').hidden = false;
      document.querySelector('#cm-team-form button[type="submit"]').textContent = 'Atualizar equipe';
    } else if (type === 'product') {
      value('cm-product-id', entity.id); value('cm-product-name', entity.name); value('cm-product-kind', entity.kind); value('cm-product-rate', entity.commissionRate ?? 0);
      document.getElementById('cm-product-cancel').hidden = false;
      document.querySelector('#cm-product-form button[type="submit"]').textContent = 'Atualizar item';
    } else {
      value('cm-goal-id', entity.id); value('cm-goal-month', entity.month); value('cm-goal-type', entity.targetType);
      this.updateCommercialGoalTargetOptions();
      value('cm-goal-target', entity.targetId); value('cm-goal-revenue', entity.revenueTarget); value('cm-goal-sales', entity.salesTarget); value('cm-goal-leads', entity.leadsTarget);
      document.getElementById('cm-goal-cancel').hidden = false;
      document.querySelector('#cm-goal-form button[type="submit"]').textContent = 'Atualizar meta';
    }
    document.getElementById(({ seller: 'cm-seller-form', team: 'cm-team-form', product: 'cm-product-form', goal: 'cm-goal-form' })[type])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async handleCommercialManagementClick(event) {
    const button = event.target.closest('button[data-cm-action]');
    if (!button) return;
    const action = button.dataset.cmAction;
    const id = button.dataset.id || '';
    if (action.startsWith('edit-')) {
      this.editCommercialManagementEntity(action.slice(5), id);
      return;
    }
    if (action === 'toggle-commission') {
      button.disabled = true;
      const result = await this.app.api.updateCommercialCommissionStatus(id, button.dataset.status || 'pending');
      if (!result?.success) this.app.showToast(result?.error || 'Não foi possível atualizar a comissão.', 'error', 6000);
      else this.app.showToast(button.dataset.status === 'paid' ? 'Comissão marcada como paga.' : 'Comissão reaberta como pendente.', 'success');
      await this.loadCommercialManagement();
      return;
    }
    const deletion = {
      'deactivate-seller': ['seller', 'Desativar este vendedor? O histórico e as vendas serão preservados.'],
      'deactivate-team': ['team', 'Desativar esta equipe?'],
      'deactivate-product': ['product', 'Desativar este produto/serviço? As vendas antigas serão preservadas.'],
      'delete-goal': ['goal', 'Excluir esta meta mensal?'],
    }[action];
    if (!deletion || !window.confirm(deletion[1])) return;
    const result = await this.app.api.deleteCommercialEntity(deletion[0], id);
    if (!result?.success) this.app.showToast(result?.error || 'Não foi possível concluir a operação.', 'error', 6000);
    else this.app.showToast(deletion[0] === 'goal' ? 'Meta excluída.' : 'Cadastro desativado.', 'success');
    await this.loadCommercialManagement();
  }

  async loadCommercialOverview() {
    if (!this.app.hasFeature?.('dashboard.commercial_agenda')) return;
    const container = document.getElementById('commercial-overview');
    if (!container) return;
    const refresh = document.getElementById('commercial-refresh');
    if (refresh) refresh.disabled = true;
    try {
      const response = await this.app.api.getCommercialDashboardOverview();
      if (!response?.success) {
        const message = this.escapeHtml(response?.error || 'Não foi possível carregar a central comercial.');
        const status = document.getElementById('commercial-calendar-status');
        if (status) status.innerHTML = `<span class="i9-commercial-warning">${message}</span>`;
        return;
      }
      this.commercialData = response.data || {};
      this.commercialLeads = null;
      this.renderCommercialOverview();
    } catch (error) {
      const status = document.getElementById('commercial-calendar-status');
      if (status) status.textContent = `Falha ao atualizar: ${error.message}`;
    } finally {
      if (refresh) refresh.disabled = false;
    }
  }

  renderCommercialOverview() {
    const data = this.commercialData || {};
    const metrics = data.metrics || {};
    const status = document.getElementById('commercial-calendar-status');
    if (status) {
      status.innerHTML = data.calendar?.connected
        ? `<span class="i9-commercial-connected"><i class="fas fa-circle-check"></i> Conectado · ${this.escapeHtml(data.calendar.calendarSummary || 'Google Agenda')} · ${this.escapeHtml(data.calendar.timeZone || '')}</span>`
        : `<span class="i9-commercial-warning"><i class="fas fa-circle-exclamation"></i> Google Agenda não conectado. Os registros locais continuam visíveis; conecte a agenda para criar, reagendar ou cancelar compromissos.</span>`;
    }
    const kpis = [
      ['Compromissos hoje', metrics.todayMeetings, 'fa-calendar-day', 'agenda'],
      ['Próximos 7 dias', metrics.upcomingMeetings, 'fa-calendar-week', 'agenda'],
      ['Follow-ups vencidos', metrics.overdueFollowups, 'fa-bell', 'warning'],
      ['Leads sem próxima ação', metrics.leadsWithoutNextAction, 'fa-user-clock', 'warning'],
      ['Reuniões realizadas · 7 dias', metrics.meetingsCompletedLast7Days, 'fa-handshake', 'success'],
      ['Pendências de automação', metrics.pendingAutomationTasks, 'fa-list-check', 'warning'],
      ['Atividades registradas · 7 dias', metrics.activitiesLast7Days, 'fa-chart-line', 'neutral'],
    ];
    const kpiContainer = document.getElementById('commercial-kpis');
    if (kpiContainer) kpiContainer.innerHTML = kpis.map(([label, value, icon, tone]) => `<article class="i9-commercial-kpi tone-${tone}"><span><i class="fas ${icon}"></i></span><div><small>${this.escapeHtml(label)}</small><strong>${Number(value || 0).toLocaleString('pt-BR')}</strong></div></article>`).join('');
    const setCount = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = Number(value || 0).toLocaleString('pt-BR'); };
    setCount('commercial-today-count', metrics.todayMeetings);
    setCount('commercial-upcoming-count', metrics.upcomingMeetings);
    setCount('commercial-overdue-count', metrics.overdueFollowups);
    setCount('commercial-followup-count', metrics.upcomingFollowups);
    setCount('commercial-no-action-count', metrics.leadsWithoutNextAction);
    setCount('commercial-task-count', metrics.pendingAutomationTasks);
    this.renderCommercialEvents('commercial-today-events', data.todayEvents || []);
    this.renderCommercialEvents('commercial-upcoming-events', data.upcomingEvents || []);
    this.renderCommercialFollowups('commercial-overdue-followups', data.overdueFollowups || [], true);
    this.renderCommercialFollowups('commercial-upcoming-followups', data.upcomingFollowups || [], false);
    this.renderCommercialLeadsWithoutAction(data.leadsWithoutNextAction || []);
    this.renderCommercialTasks(data.pendingAutomationTasks || []);
    this.renderCommercialActivities(data.recentActivities || []);
    const productivity = document.getElementById('commercial-productivity-summary');
    if (productivity) productivity.innerHTML = [
      ['Confirmados', metrics.confirmedMeetings], ['Realizados', metrics.completedMeetings],
      ['Cancelados', metrics.cancelledMeetings], ['Não compareceu', metrics.noShowMeetings],
      ['Follow-ups enviados · 7 dias', metrics.followupsSentLast7Days],
    ].map(([label, value]) => `<span><strong>${Number(value || 0).toLocaleString('pt-BR')}</strong> ${this.escapeHtml(label)}</span>`).join('');
  }

  renderCommercialEvents(containerId, events) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!events.length) {
      el.innerHTML = '<div class="i9-commercial-empty">Nenhum compromisso registrado neste período.</div>';
      return;
    }
    const now = Date.now();
    el.innerHTML = events.map((item) => {
      const start = new Date(item.start);
      const end = new Date(item.end);
      const dateLabel = Number.isFinite(start.getTime()) ? start.toLocaleString('pt-BR') : 'Data não definida';
      const endLabel = Number.isFinite(end.getTime()) ? end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      const statusLabel = item.outcome === 'completed' ? 'Realizada'
        : item.outcome === 'no_show' ? 'Não compareceu'
          : item.status === 'cancelled' ? 'Cancelada'
            : item.status === 'pending' || item.syncStatus === 'pending' ? 'Sincronização pendente'
              : item.status === 'tentative' ? 'Provisória' : 'Confirmada';
      const canRecordOutcome = item.status !== 'cancelled' && item.eventId && !item.outcome && Number.isFinite(end.getTime()) && end.getTime() <= now;
      const canCancel = item.status !== 'cancelled' && item.eventId && Number.isFinite(start.getTime()) && start.getTime() > now;
      return `<article class="i9-commercial-item"><div class="i9-commercial-item-main"><div class="i9-commercial-item-title">${this.escapeHtml(item.summary || 'Atendimento comercial')} <span class="i9-commercial-status">${this.escapeHtml(statusLabel)}</span></div><small><i class="fas fa-clock"></i> ${this.escapeHtml(dateLabel)}${endLabel ? ` – ${this.escapeHtml(endLabel)}` : ''}</small><small><i class="fas fa-user"></i> ${this.escapeHtml(item.leadName || item.phone || "Sem Nome")}${item.leadStage ? ` · ${this.escapeHtml(item.leadStage)}` : ''}</small>${item.htmlLink ? `<a href="${this.escapeHtml(item.htmlLink)}" target="_blank" rel="noopener noreferrer">Abrir no Google Agenda</a>` : ''}</div><div class="i9-commercial-item-actions"><button class="btn btn-sm btn-secondary" data-commercial-open-lead="${this.escapeHtml(item.leadId)}">Abrir lead</button>${canRecordOutcome ? `<button class="btn btn-sm btn-primary" data-commercial-outcome="completed" data-lead-id="${this.escapeHtml(item.leadId)}" data-event-id="${this.escapeHtml(item.eventId)}">Realizada</button><button class="btn btn-sm btn-secondary" data-commercial-outcome="no_show" data-lead-id="${this.escapeHtml(item.leadId)}" data-event-id="${this.escapeHtml(item.eventId)}">Não compareceu</button>` : ''}${canCancel ? `<button class="btn btn-sm btn-danger" data-commercial-cancel-event data-lead-id="${this.escapeHtml(item.leadId)}" data-event-id="${this.escapeHtml(item.eventId)}">Cancelar</button>` : ''}</div></article>`;
    }).join('');
  }

  renderCommercialFollowups(containerId, items, overdue) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!items.length) {
      el.innerHTML = `<div class="i9-commercial-empty">${overdue ? 'Nenhum follow-up vencido. Ótimo!' : 'Nenhum follow-up previsto para os próximos 7 dias.'}</div>`;
      return;
    }
    el.innerHTML = items.map((item) => {
      const date = new Date(item.scheduledAt);
      const dateLabel = Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : 'Data não definida';
      const status = item.status === 'overdue' || (item.status === 'scheduled' && date.getTime() < Date.now()) ? 'Aguardando ação' : 'Agendado';
      return `<article class="i9-commercial-item"><div class="i9-commercial-item-main"><div class="i9-commercial-item-title">${this.escapeHtml(item.leadName || item.phone || "Sem Nome")} <span class="i9-commercial-status ${overdue ? 'is-warning' : ''}">${status}</span></div><small><i class="fas fa-clock"></i> ${this.escapeHtml(dateLabel)}</small><small>${this.escapeHtml(item.message || item.lastError || 'Follow-up programado')}</small></div><div class="i9-commercial-item-actions"><button class="btn btn-sm btn-secondary" data-commercial-open-lead="${this.escapeHtml(item.leadId)}">Abrir lead</button></div></article>`;
    }).join('');
  }

  renderCommercialLeadsWithoutAction(items) {
    const el = document.getElementById('commercial-leads-no-action');
    if (!el) return;
    if (!items.length) { el.innerHTML = '<div class="i9-commercial-empty">Todos os leads abertos têm uma próxima ação registrada.</div>'; return; }
    el.innerHTML = items.slice(0, 12).map((item) => `<article class="i9-commercial-item"><div class="i9-commercial-item-main"><div class="i9-commercial-item-title">${this.escapeHtml(item.leadName || item.phone || "Sem Nome")}</div><small>${this.escapeHtml(item.stage || 'Etapa não definida')} · ${item.updatedAt ? `Atualizado em ${this.escapeHtml(this.formatDate(item.updatedAt))}` : 'Sem atualização registrada'}</small></div><div class="i9-commercial-item-actions"><button class="btn btn-sm btn-secondary" data-commercial-open-lead="${this.escapeHtml(item.leadId)}">Definir próxima ação</button></div></article>`).join('');
  }

  renderCommercialTasks(items) {
    const el = document.getElementById('commercial-automation-tasks');
    if (!el) return;
    if (!items.length) { el.innerHTML = '<div class="i9-commercial-empty">Nenhuma pendência de automação aguardando revisão.</div>'; return; }
    el.innerHTML = items.slice(0, 12).map((item) => `<article class="i9-commercial-item"><div class="i9-commercial-item-main"><div class="i9-commercial-item-title">${this.escapeHtml(item.title)}</div><small>${this.escapeHtml(item.leadName || item.phone || "Sem Nome")} · ${this.escapeHtml(this.formatDate(item.createdAt))}</small><small>${this.escapeHtml(item.reason)}</small>${item.proposedStart ? `<small><strong>Horário sugerido:</strong> ${this.escapeHtml(this.formatDate(item.proposedStart))}</small>` : ''}</div><div class="i9-commercial-item-actions"><button class="btn btn-sm btn-secondary" data-commercial-open-lead="${this.escapeHtml(item.leadId)}">Abrir lead</button><button class="btn btn-sm btn-secondary" data-commercial-dismiss-task="${this.escapeHtml(item.id)}">Dispensar</button></div></article>`).join('');
  }

  renderCommercialActivities(items) {
    const el = document.getElementById('commercial-recent-activities');
    if (!el) return;
    if (!items.length) { el.innerHTML = '<div class="i9-commercial-empty">Ainda não há atividades registradas no histórico dos leads.</div>'; return; }
    el.innerHTML = items.slice(0, 20).map((item) => `<article class="i9-commercial-activity"><div class="i9-commercial-activity-dot"></div><div class="i9-commercial-item-main"><div class="i9-commercial-item-title">${this.escapeHtml(item.title)} <span class="i9-commercial-activity-lead">${this.escapeHtml(item.leadName || item.phone || "Sem Nome")}</span></div><small>${this.escapeHtml(this.formatDate(item.createdAt))} · ${this.escapeHtml(item.actor)}</small>${item.description ? `<p>${this.escapeHtml(item.description)}</p>` : ''}</div><button class="btn btn-sm btn-secondary" data-commercial-open-lead="${this.escapeHtml(item.leadId)}">Abrir</button></article>`).join('');
  }

  async openCommercialLead(leadId) {
    const id = String(leadId || '');
    if (!id) return;
    if (!this.commercialLeads) {
      const response = await this.app.api.getSavedLeads();
      this.commercialLeads = response?.success && Array.isArray(response.data) ? response.data : [];
    }
    const lead = this.commercialLeads.find((item) => String(item.id || item.placeId || item.phone) === id);
    if (lead) this.app.leadModal.show(lead);
    else this.app.showToast('Lead não encontrado. Atualize o CRM.', 'warning');
  }

  async openCalendarSettings() {
    this.app.router.navigate('settings');
    setTimeout(() => document.querySelector('.tab-btn[data-tab="calendar"]')?.click(), 250);
  }

  async handleCommercialDashboardClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.commercialAction === 'followups') { this.app.router.navigate('followups'); return; }
    if (button.dataset.commercialAction === 'crm') { this.app.router.navigate('crm'); return; }
    if (button.dataset.commercialOpenLead) { await this.openCommercialLead(button.dataset.commercialOpenLead); return; }
    if (button.dataset.commercialOutcome) {
      const outcome = button.dataset.commercialOutcome;
      const label = outcome === 'completed' ? 'registrar esta reunião como realizada' : 'registrar que o lead não compareceu';
      if (!confirm(`Deseja ${label}?`)) return;
      button.disabled = true;
      const result = await this.app.api.setCalendarEventOutcome(button.dataset.leadId, button.dataset.eventId, outcome);
      this.app.showToast(result?.success ? (outcome === 'completed' ? 'Reunião registrada como realizada.' : 'Ausência registrada.') : (result?.error || 'Não foi possível registrar o resultado.'), result?.success ? 'success' : 'error', 6000);
      if (result?.success) await this.loadCommercialOverview();
      else button.disabled = false;
      return;
    }
    if (button.hasAttribute('data-commercial-cancel-event')) {
      if (!confirm('Cancelar este compromisso também no Google Agenda?')) return;
      button.disabled = true;
      const result = await this.app.api.deleteLeadCalendarEvent(button.dataset.leadId, button.dataset.eventId);
      this.app.showToast(result?.success ? 'Compromisso cancelado.' : (result?.error || 'Não foi possível cancelar.'), result?.success ? 'success' : 'error', 6000);
      if (result?.success) await this.loadCommercialOverview();
      else button.disabled = false;
      return;
    }
    if (button.dataset.commercialDismissTask) {
      if (!confirm('Dispensar esta pendência de automação?')) return;
      const result = await this.app.api.dismissCalendarAutomationTask(button.dataset.commercialDismissTask);
      this.app.showToast(result?.success ? 'Pendência dispensada.' : (result?.error || 'Não foi possível dispensar.'), result?.success ? 'success' : 'error');
      if (result?.success) await this.loadCommercialOverview();
    }
  }

  async handleCampaignAction(action, id) {
    try {
      let response;
      switch (action) {
        case 'view': this.app.showToast('Abrindo campanha ' + id + '...', 'info'); break;
        case 'pause':
          response = await this.app.api.pauseCampaign(id);
          if (response.success) { this.app.showToast('Campanha pausada', 'success'); this.loadStats(); }
          break;
        case 'resume':
          response = await this.app.api.resumeCampaign(id);
          if (response.success) { this.app.showToast('Campanha retomada', 'success'); this.loadStats(); }
          break;
        case 'delete':
          if (!confirm('Excluir esta campanha?')) return;
          response = await this.app.api.deleteCampaign(id);
          if (response.success) { this.app.showToast('Campanha excluída', 'success'); this.loadStats(); }
          break;
      }
      if (response && !response.success && !['LICENSE_REQUIRED', 'FEATURE_NOT_INCLUDED'].includes(response.code)) {
        this.app.showToast(response.error || 'Não foi possível concluir a ação.', 'error');
      }
    } catch (error) {
      this.app.showToast('Erro: ' + error.message, 'error');
    }
  }

  escapeHtml(value) { return this.app.toast.escapeHtml(value); }
}
