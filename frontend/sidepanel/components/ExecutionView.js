/**
 * Central de Execução — estado real das campanhas, WhatsApp e Chat com IA.
 * Atualiza os indicadores por polling e eventos do service worker; nunca inventa contagens.
 */
export class ExecutionView {
  constructor(app) {
    this.app = app;
    this.container = null;
    this.timer = null;
    this.refreshing = false;
    this.campaigns = [];
    this.leads = [];
    this.ai = null;
    this.wa = null;
    this.aiLeadFilter = 'all';
    this.lastRefreshAt = null;
    this.onRuntimeMessage = (message) => {
      if (message?.type === 'CAMPAIGN_PROGRESS' || message?.type === 'PRIVATE_OPPORTUNITIES_UPDATED') {
        this.refresh();
      }
    };
  }

  async render(container) {
    this.container = container;
    container.innerHTML = this.getHTML();
    container.addEventListener('click', this.onClick);
    container.addEventListener('change', this.onChange);
    chrome.runtime.onMessage.addListener(this.onRuntimeMessage);
    await this.refresh();
    this.timer = setInterval(() => this.refresh(), 5000);
  }

  onChange = (event) => {
    const filterSelect = event.target.closest('#execution-ai-lead-filter');
    if (filterSelect) {
      this.aiLeadFilter = filterSelect.value || 'all';
      this.renderData({});
    }
  };

  onClick = async (event) => {
    const button = event.target.closest('[data-execution-action]');
    if (!button) return;
    const action = button.dataset.executionAction;
    const id = button.dataset.id;
    if (action === 'refresh') { await this.refresh(true); return; }
    if (action === 'campaigns') { this.app.router.navigate('campaigns-wa'); return; }
    if (action === 'ai') {
      const targetRoute = this.ai?.operationMode === 'observe_only' ? 'ai-observer' : 'ai-chat';
      this.app.router.navigate(targetRoute);
      return;
    }
    if (action === 'ai-chat-menu') { this.app.router.navigate('ai-chat'); return; }
    if (action === 'ai-observer-menu') { this.app.router.navigate('ai-observer'); return; }
    if (action === 'open-crm') {
      this.app.router.navigate('crm');
      const filterVal = button.dataset.crmFilter || '';
      if (filterVal) {
        setTimeout(() => {
          const el = document.getElementById('filter-qualification');
          if (el) { el.value = filterVal; el.dispatchEvent(new Event('change')); }
        }, 250);
      }
      return;
    }
    if (action === 'view-lead' && id) {
      const lead = (this.leads || []).find((l) => String(l.id || l.placeId || l.phone || '') === String(id));
      if (lead && this.app.leadModal) this.app.leadModal.show(lead);
      return;
    }
    if (action === 'wa-lead' && id) {
      const lead = (this.leads || []).find((l) => String(l.id || l.placeId || l.phone || '') === String(id));
      if (lead) {
        const res = await this.app.api.openCrmLeadChat(lead);
        if (!res?.success) this.app.showToast(res?.error || 'Não foi possível abrir a conversa.', 'error');
        else this.app.showToast(`Conversa de ${lead.name || lead.phone} aberta no WhatsApp Web.`, 'success');
      }
      return;
    }
    if (!id) return;
    try {
      let result;
      if (action === 'pause') result = await this.app.api.pauseCampaign(id);
      else if (action === 'resume') result = await this.app.api.resumeCampaign(id);
      else if (action === 'stop') {
        if (!confirm('Parar esta campanha? Os contatos ainda pendentes não serão enviados.')) return;
        result = await this.app.api.stopCampaign(id);
      }
      if (result?.success) {
        this.app.showToast(action === 'pause' ? 'Campanha pausada.' : action === 'resume' ? 'Campanha retomada.' : 'Campanha encerrada.', 'success');
        await this.refresh(true);
      } else if (result) this.app.showToast(result.error || 'Não foi possível executar a ação.', 'error');
    } catch (error) {
      this.app.showToast(error?.message || 'Falha ao controlar a campanha.', 'error');
    }
  };

  onLeave() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try { chrome.runtime.onMessage.removeListener(this.onRuntimeMessage); } catch { /* contexto encerrado */ }
    try { this.container?.removeEventListener('click', this.onClick); } catch { /* elemento desmontado */ }
    try { this.container?.removeEventListener('change', this.onChange); } catch { /* elemento desmontado */ }
    this.container = null;
  }

  getHTML() {
    return `<div class="i9-execution-view">
      <header class="view-header i9-execution-header">
        <div><p class="i9-eyebrow">MONITORAMENTO EM TEMPO REAL</p><h2><i class="fas fa-gauge-high"></i> Central de Execução</h2><p class="i9-subtitle">Acompanhe qual módulo de IA está ativo, leads qualificados, filas de atendimento e campanhas.</p></div>
        <button class="btn btn-secondary" data-execution-action="refresh"><i class="fas fa-rotate"></i> Atualizar agora</button>
      </header>
      <div class="i9-execution-body">
        <div class="i9-execution-refreshline"><span id="execution-refresh-state">Consultando o estado real da extensão…</span><span id="execution-last-refresh">Última atualização: —</span></div>
        <div id="execution-dynamic"><div class="empty-state"><div class="icon"><i class="fas fa-spinner fa-spin"></i></div><h3>Carregando central</h3><p>Consultando WhatsApp, IA, leads e campanhas.</p></div></div>
      </div>
    </div>`;
  }

  async refresh(manual = false) {
    if (this.refreshing || !this.container || !this.container.isConnected) return;
    this.refreshing = true;
    const stateEl = this.container.querySelector('#execution-refresh-state');
    if (manual && stateEl) stateEl.textContent = 'Atualizando…';
    try {
      const [campaignRes, aiRes, waRes, leadsRes] = await Promise.all([
        this.app.api.getCampaigns(),
        this.app.api.sendMessage('AI_GET_STATUS'),
        this.app.api.sendMessage('WA_STATUS'),
        this.app.api.getSavedLeads(),
      ]);
      this.campaigns = campaignRes?.success && Array.isArray(campaignRes.data) ? campaignRes.data : [];
      this.ai = aiRes?.success ? aiRes.data : null;
      this.wa = waRes?.success ? waRes.data : null;
      this.leads = leadsRes?.success && Array.isArray(leadsRes.data) ? leadsRes.data : [];
      this.lastRefreshAt = new Date();
      this.renderData({ campaignError: !campaignRes?.success, aiError: !aiRes?.success, waError: !waRes?.success });
    } catch (error) {
      if (stateEl) stateEl.textContent = `Não foi possível atualizar: ${error?.message || 'erro desconhecido'}`;
    } finally {
      this.refreshing = false;
    }
  }

  renderActiveModeBanner(ai, aiState) {
    const observing = ai?.operationMode === 'observe_only';
    const isEnabled = !!ai?.enabled;
    const modeTitle = !isEnabled
      ? `⏸️ MODO ATUAL: IA Pausada (${observing ? 'Último modo selecionado: IA - Observador' : 'Último modo selecionado: IA - Atendimento'})`
      : observing
        ? '👁️ MODO DE IA ATIVO: IA - Observador (Supervisionado · Apenas lê conversas e anota no CRM)'
        : '🤖 MODO DE IA ATIVO: IA - Atendimento (Automático · Responde mensagens e atualiza o CRM)';
    const modeDesc = !isEnabled
      ? 'Nenhum módulo de IA está processando mensagens neste momento. Escolha um dos menus abaixo para ativar.'
      : observing
        ? 'A IA está monitorando silenciosamente as conversas autorizadas para extrair necessidades, orçamento, resumo e qualificação nos cards do CRM, sem enviar nenhuma mensagem aos contatos. (O modo Atendimento Automático está desativado).'
        : 'A IA está respondendo ativamente às conversas autorizadas no WhatsApp Web e registrando a qualificação comercial nos cards do CRM. (O modo Somente Observação está desativado).';
    const bg = !isEnabled ? '#f8fafc' : observing ? '#eff6ff' : '#f0fdf4';
    const border = !isEnabled ? '#cbd5e1' : observing ? '#93c5fd' : '#86efac';
    const color = !isEnabled ? '#334155' : observing ? '#1e3a8a' : '#14532d';

    return `<div style="background:${bg};border:1px solid ${border};color:${color};border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:260px">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px">${this.escapeHtml(modeTitle)}</div>
        <div style="font-size:12px;opacity:0.9;line-height:1.45">${this.escapeHtml(modeDesc)}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm ${!observing && isEnabled ? 'btn-primary' : 'btn-secondary'}" data-execution-action="ai-chat-menu"><i class="fas fa-robot"></i> Configurar IA - Atendimento</button>
        <button class="btn btn-sm ${observing && isEnabled ? 'btn-primary' : 'btn-secondary'}" data-execution-action="ai-observer-menu"><i class="fas fa-eye"></i> Configurar IA - Observador</button>
      </div>
    </div>`;
  }

  getAiLeadsSummary() {
    const allLeads = Array.isArray(this.leads) ? this.leads : [];
    const aiLeads = [];

    for (const lead of allLeads) {
      const intel = lead?.aiIntelligence && typeof lead.aiIntelligence === 'object' ? lead.aiIntelligence : null;
      const qual = lead?.aiQualification && typeof lead.aiQualification === 'object' ? lead.aiQualification : null;
      const hasAi = !!(intel?.evaluatedAt || intel?.updatedAt || intel?.summary || intel?.exactRequest || intel?.need || qual?.evaluatedAt || qual?.status);
      if (!hasAi) continue;

      const mode = intel?.analysisMode === 'observe_only' || intel?.source === 'i9Hub-ai-observer' ? 'observe_only' : 'auto_reply';
      const rawStatus = String(intel?.status || qual?.status || (qual?.qualified ? 'qualified' : 'in_qualification'));
      const isQualified = qual?.qualified === true || rawStatus === 'qualified';
      const confidence = Number(intel?.confidence ?? qual?.confidence ?? 0);
      const summary = String(intel?.exactRequest || intel?.summary || qual?.summary || intel?.need || qual?.reason || '').trim();
      const budget = String(intel?.budget || qual?.budget || '').trim();
      const niche = Array.isArray(lead?.aiNicheClassification?.path) && lead.aiNicheClassification.path.length
        ? lead.aiNicheClassification.path.join(' > ')
        : String(intel?.segment || lead?.category || '').trim();
      const evaluatedAt = intel?.updatedAt || intel?.evaluatedAt || qual?.evaluatedAt || lead?.updatedAt || lead?.extractedAt || '';

      aiLeads.push({
        lead,
        id: String(lead.id || lead.placeId || lead.phone || ''),
        name: String(lead.name || lead.phone || 'Contato sem nome'),
        phone: String(lead.phone || '—'),
        stage: String(lead.stage || 'novo'),
        mode,
        status: isQualified ? 'qualified' : rawStatus,
        isQualified,
        confidence: Number.isFinite(confidence) ? confidence : 0,
        summary,
        budget,
        niche,
        evaluatedAt,
      });
    }

    aiLeads.sort((a, b) => (Date.parse(b.evaluatedAt || 0) || 0) - (Date.parse(a.evaluatedAt || 0) || 0));

    const autoLeads = aiLeads.filter((item) => item.mode === 'auto_reply');
    const observerLeads = aiLeads.filter((item) => item.mode === 'observe_only');

    const byStatus = {
      qualified: aiLeads.filter((item) => item.isQualified).length,
      in_qualification: aiLeads.filter((item) => !item.isQualified && item.status === 'in_qualification').length,
      nurture: aiLeads.filter((item) => !item.isQualified && item.status === 'nurture').length,
      not_qualified: aiLeads.filter((item) => !item.isQualified && item.status === 'not_qualified').length,
    };

    return {
      totalProcessed: aiLeads.length,
      totalQualified: byStatus.qualified,
      autoProcessed: autoLeads.length,
      autoQualified: autoLeads.filter((item) => item.isQualified).length,
      observerProcessed: observerLeads.length,
      observerQualified: observerLeads.filter((item) => item.isQualified).length,
      byStatus,
      items: aiLeads,
    };
  }

  renderAiLeadsQualificationSection() {
    const summary = this.getAiLeadsSummary();
    const filter = this.aiLeadFilter || 'all';
    const filteredItems = summary.items.filter((item) => {
      if (filter === 'qualified') return item.isQualified;
      if (filter === 'auto_reply') return item.mode === 'auto_reply';
      if (filter === 'observe_only') return item.mode === 'observe_only';
      if (filter === 'in_qualification') return !item.isQualified && item.status === 'in_qualification';
      if (filter === 'nurture') return !item.isQualified && item.status === 'nurture';
      return true;
    });

    const statusBadge = (item) => {
      const map = {
        qualified: { label: 'Qualificado', bg: '#dcfce7', color: '#166534' },
        in_qualification: { label: 'Em qualificação', bg: '#fef3c7', color: '#92400e' },
        nurture: { label: 'Nutrição · sem orçamento', bg: '#e0e7ff', color: '#1e40af' },
        not_qualified: { label: 'Não qualificado', bg: '#f3f4f6', color: '#374151' },
      };
      const meta = map[item.status] || map.in_qualification;
      const conf = item.confidence > 0 ? ` · ${Math.round(item.confidence * 100)}%` : '';
      return `<span style="display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color}">${this.escapeHtml(meta.label + conf)}</span>`;
    };

    const modeBadge = (item) => item.mode === 'observe_only'
      ? `<span style="display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:600;background:#eff6ff;color:#1d4ed8">👁️ IA - Observador</span>`
      : `<span style="display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:600;background:#f0fdf4;color:#15803d">🤖 IA - Atendimento</span>`;

    return `<section class="i9-execution-section" style="border:1px solid var(--border-color, #e2e8f0);border-radius:12px;padding:16px;margin-bottom:18px;background:var(--card-bg, #fff)">
      <div class="i9-execution-section-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px">
        <div>
          <h3 style="margin:0 0 4px 0"><i class="fas fa-user-check"></i> Confirmação e Visão Geral de Leads Atendidos / Qualificados pela IA</h3>
          <p style="margin:0;font-size:12px;color:var(--text-muted)">Acompanhe quantos e quais leads do CRM foram trabalhados por ambas as IAs e por cada módulo individualmente.</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select id="execution-ai-lead-filter" class="form-select" style="min-width:210px;font-size:12px;padding:5px 10px">
            <option value="all" ${filter === 'all' ? 'selected' : ''}>Mostrar: Ambas as IAs (${summary.totalProcessed})</option>
            <option value="qualified" ${filter === 'qualified' ? 'selected' : ''}>Somente Qualificados (${summary.totalQualified})</option>
            <option value="auto_reply" ${filter === 'auto_reply' ? 'selected' : ''}>Somente 🤖 IA - Atendimento (${summary.autoProcessed})</option>
            <option value="observe_only" ${filter === 'observe_only' ? 'selected' : ''}>Somente 👁️ IA - Observador (${summary.observerProcessed})</option>
            <option value="in_qualification" ${filter === 'in_qualification' ? 'selected' : ''}>Em Qualificação (${summary.byStatus.in_qualification})</option>
            <option value="nurture" ${filter === 'nurture' ? 'selected' : ''}>Nutrição (${summary.byStatus.nurture})</option>
          </select>
          <button class="btn btn-sm btn-primary" data-execution-action="open-crm" data-crm-filter="ai_all"><i class="fas fa-database"></i> Filtrar no CRM</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:12px;margin-bottom:14px">
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc">
          <div style="font-size:12px;color:#475569;font-weight:600">📊 AMBAS AS IAs (TOTAL NO CRM)</div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:8px">
            <div><span style="font-size:22px;font-weight:700;color:#0f172a">${summary.totalProcessed}</span> <small style="color:#64748b">leads analisados</small></div>
            <div><span style="font-size:20px;font-weight:700;color:#16a34a">${summary.totalQualified}</span> <small style="color:#166534">qualificados</small></div>
          </div>
        </div>
        <div style="border:1px solid #bbf7d0;border-radius:10px;padding:12px;background:#f0fdf4">
          <div style="font-size:12px;color:#166534;font-weight:600">🤖 IA - ATENDIMENTO (AUTOMÁTICO)</div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:8px">
            <div><span style="font-size:22px;font-weight:700;color:#14532d">${summary.autoProcessed}</span> <small style="color:#166534">leads atendidos</small></div>
            <div><span style="font-size:20px;font-weight:700;color:#15803d">${summary.autoQualified}</span> <small style="color:#166534">qualificados</small></div>
          </div>
        </div>
        <div style="border:1px solid #bfdbfe;border-radius:10px;padding:12px;background:#eff6ff">
          <div style="font-size:12px;color:#1e40af;font-weight:600">👁️ IA - OBSERVADOR (SUPERVISIONADO)</div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:8px">
            <div><span style="font-size:22px;font-weight:700;color:#1e3a8a">${summary.observerProcessed}</span> <small style="color:#1d4ed8">leads anotados</small></div>
            <div><span style="font-size:20px;font-weight:700;color:#2563eb">${summary.observerQualified}</span> <small style="color:#1d4ed8">qualificados</small></div>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;padding:10px 12px;background:#f8fafc;border-radius:8px;margin-bottom:14px;font-size:12px">
        <strong>Funil de Qualificação da IA:</strong>
        <span>✅ Qualificados: <strong>${summary.byStatus.qualified}</strong></span> ·
        <span>⏳ Em qualificação: <strong>${summary.byStatus.in_qualification}</strong></span> ·
        <span>🌱 Nutrição (sem orçamento): <strong>${summary.byStatus.nurture}</strong></span> ·
        <span>⚪ Não qualificados: <strong>${summary.byStatus.not_qualified}</strong></span>
      </div>

      ${filteredItems.length === 0 ? `<div class="i9-execution-empty" style="padding:18px"><i class="fas fa-user-clock"></i><strong>Nenhum lead encontrado neste filtro</strong><span>Assim que a IA atender ou observar conversas e anotar informações nos cards do CRM, a lista nominal de leads aparecerá aqui.</span></div>` : `
        <div class="table-responsive" style="max-height:360px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px">
          <table class="table" style="margin:0;font-size:12px">
            <thead style="position:sticky;top:0;background:#f8fafc;z-index:1">
              <tr>
                <th>Lead / Contato</th>
                <th>Módulo de IA</th>
                <th>Qualificação &amp; Confiança</th>
                <th>Resumo / Anotação no Card do CRM</th>
                <th>Última Análise</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${filteredItems.slice(0, 50).map((item) => `
                <tr>
                  <td>
                    <strong>${this.escapeHtml(item.name)}</strong><br>
                    <small class="text-muted">${this.escapeHtml(item.phone)} · Estágio: ${this.escapeHtml(item.stage)}</small>
                  </td>
                  <td>${modeBadge(item)}</td>
                  <td>
                    ${statusBadge(item)}
                    ${item.niche ? `<div style="font-size:11px;color:#64748b;margin-top:3px">Nicho: ${this.escapeHtml(item.niche)}</div>` : ''}
                  </td>
                  <td style="max-width:320px;white-space:normal">
                    ${item.summary ? `<div>${this.escapeHtml(item.summary.slice(0, 160))}${item.summary.length > 160 ? '…' : ''}</div>` : '<span class="text-muted">Sem resumo registrado</span>'}
                    ${item.budget ? `<div style="font-size:11px;color:#15803d;margin-top:2px"><strong>Orçamento:</strong> ${this.escapeHtml(item.budget)}</div>` : ''}
                  </td>
                  <td>${item.evaluatedAt && Number.isFinite(Date.parse(item.evaluatedAt)) ? this.escapeHtml(new Date(item.evaluatedAt).toLocaleString('pt-BR')) : '—'}</td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button type="button" class="btn btn-sm btn-secondary" data-execution-action="view-lead" data-id="${this.escapeHtml(item.id)}" title="Abrir ficha completa do lead">Ver Card</button>
                      <button type="button" class="btn btn-sm btn-primary" data-execution-action="wa-lead" data-id="${this.escapeHtml(item.id)}" title="Chamar no WhatsApp"><i class="fab fa-whatsapp"></i></button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </section>`;
  }

  renderData(errors = {}) {
    if (!this.container) return;
    const dynamic = this.container.querySelector('#execution-dynamic');
    const lastRefresh = this.container.querySelector('#execution-last-refresh');
    const refreshState = this.container.querySelector('#execution-refresh-state');
    if (!dynamic) return;
    if (lastRefresh) lastRefresh.textContent = `Última atualização: ${this.lastRefreshAt ? this.lastRefreshAt.toLocaleTimeString('pt-BR') : '—'}`;
    if (refreshState) refreshState.textContent = 'Atualização automática a cada 5 segundos · valores obtidos da extensão';

    const campaigns = [...this.campaigns].sort((a, b) => {
      const rank = (c) => c.status === 'running' ? 0 : c.status === 'paused' ? 1 : c.status === 'draft' ? 2 : 3;
      return rank(a) - rank(b) || Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0);
    });
    const active = campaigns.filter(c => c.status === 'running');
    const paused = campaigns.filter(c => c.status === 'paused');
    const sentToday = campaigns.reduce((sum, c) => sum + (Number(c.sentToday) || 0), 0);
    const ai = this.ai || {};
    const wa = this.wa || {};
    const aiState = this.getAiState(ai, errors.aiError);
    const waState = this.getWaState(wa, errors.waError);
    const incomingPending = Number.isFinite(Number(ai.pendingInboundCount)) ? Math.max(0, Number(ai.pendingInboundCount)) : null;
    const historyQueue = Number.isFinite(Number(ai.historyQueueCount)) ? Math.max(0, Number(ai.historyQueueCount)) : null;
    const leadQueue = Number.isFinite(Number(ai.leadSyncQueueCount)) ? Math.max(0, Number(ai.leadSyncQueueCount)) : null;
    const monitoring = ai.monitoring && typeof ai.monitoring === 'object' ? ai.monitoring : null;
    const monitorTotals = monitoring?.totals || {};
    const observing = ai.operationMode === 'observe_only';

    dynamic.innerHTML = `
      ${(errors.campaignError || errors.aiError || errors.waError) ? `<div class="i9-execution-warning"><i class="fas fa-triangle-exclamation"></i><div><strong>Alguns indicadores não puderam ser consultados.</strong><p>${[errors.campaignError ? 'Campanhas' : '', errors.aiError ? 'Chat com IA' : '', errors.waError ? 'WhatsApp' : ''].filter(Boolean).join(', ')}. Os campos correspondentes não serão tratados como zero.</p></div></div>` : ''}
      ${this.renderActiveModeBanner(ai, aiState)}
      <section class="i9-execution-status-grid" aria-label="Estado dos serviços">
        <article class="i9-execution-status-card ${aiState.tone}"><div class="i9-execution-card-top"><span class="i9-execution-card-icon"><i class="fas ${observing ? 'fa-eye' : 'fa-robot'}"></i></span><span class="i9-execution-pill ${aiState.tone}">${this.escapeHtml(aiState.label)}</span></div><h3>${observing ? 'IA - Observador' : 'IA - Atendimento'}</h3><p>${this.escapeHtml(aiState.detail)}</p><div class="i9-execution-card-foot">${this.escapeHtml(ai.provider || 'Provedor não identificado')}${ai.model ? ` · ${this.escapeHtml(ai.model)}` : ''}</div><button class="btn btn-sm btn-secondary" data-execution-action="ai">Abrir configurações da IA ativa</button></article>
        <article class="i9-execution-status-card ${waState.tone}"><div class="i9-execution-card-top"><span class="i9-execution-card-icon"><i class="fab fa-whatsapp"></i></span><span class="i9-execution-pill ${waState.tone}">${this.escapeHtml(waState.label)}</span></div><h3>WhatsApp Web</h3><p>${this.escapeHtml(waState.detail)}</p><div class="i9-execution-card-foot">${wa.mode ? `Modo: ${this.escapeHtml(wa.mode === 'tab' ? 'aba/janela do navegador' : wa.mode)}` : 'Modo de conexão não informado'}${wa.visible === false ? ' · fora de vista' : ''}</div><button class="btn btn-sm btn-secondary" data-execution-action="campaigns">Abrir campanhas</button></article>
        <article class="i9-execution-status-card ${active.length ? 'tone-active' : paused.length ? 'tone-waiting' : 'tone-neutral'}"><div class="i9-execution-card-top"><span class="i9-execution-card-icon"><i class="fas fa-paper-plane"></i></span><span class="i9-execution-pill ${active.length ? 'tone-active' : paused.length ? 'tone-waiting' : 'tone-neutral'}">${active.length ? 'Em execução' : paused.length ? 'Pausada' : 'Sem envio ativo'}</span></div><h3>Campanhas</h3><p>${errors.campaignError ? 'Não foi possível confirmar o estado das campanhas.' : `${active.length} em execução · ${paused.length} pausada(s) · ${campaigns.filter(c => c.status === 'draft').length} rascunho(s)`}</p><div class="i9-execution-card-foot">${errors.campaignError ? 'Contadores indisponíveis' : `${sentToday.toLocaleString('pt-BR')} envio(s) registrados hoje`}</div><button class="btn btn-sm btn-secondary" data-execution-action="campaigns">Gerenciar campanhas</button></article>
      </section>

      ${this.renderAiLeadsQualificationSection()}

      <section class="i9-execution-metrics" aria-label="Filas e resultados do Chat com IA">
        ${this.metricCard('Mensagens na fila de entrada', incomingPending, 'fa-inbox', 'Mensagens recebidas aguardando processamento agora.')}
        ${this.metricCard('Mensagens para revisão', Number.isFinite(Number(ai.incomingQueueNeedsAttentionCount)) ? Math.max(0, Number(ai.incomingQueueNeedsAttentionCount)) : null, 'fa-triangle-exclamation', 'Mensagens interrompidas por reinício ou situação incerta. O envio não é repetido automaticamente para evitar duplicação.')}
        ${this.metricCard('Contatos com memória profissional', Number.isFinite(Number(ai.conversationMemoryCount)) ? Math.max(0, Number(ai.conversationMemoryCount)) : null, 'fa-brain', 'Contatos com fatos profissionais estruturados disponíveis para continuidade contextual. A memória não guarda transcrições brutas.')}
        ${this.metricCard('Eventos aguardando histórico', historyQueue, 'fa-file-lines', 'Fila de gravação do histórico de conversas no Google Sheets.')}
        ${this.metricCard('Fichas aguardando sincronização', leadQueue, 'fa-address-card', 'Fila de atualização dos dados comerciais dos leads.')}
        ${this.metricCard('Campanhas ativas', errors.campaignError ? null : active.length, 'fa-bullhorn', 'Campanhas cujo estado salvo é “em execução”.')}
        ${this.metricCard('Respostas confirmadas', monitoring ? monitorTotals.responses : null, 'fa-reply', 'Respostas cujo envio foi confirmado pelo WhatsApp Web nos últimos eventos retidos.')}
        ${this.metricCard('Análises registradas no CRM', monitoring ? monitorTotals.analyzed : null, 'fa-eye', 'Mensagens analisadas pela IA observadora que produziram atualizações nos cards do CRM, sem envio de resposta.')}
        ${this.metricCard('Análises sem dados novos', monitoring ? monitorTotals.observerNoChange : null, 'fa-eye-slash', 'Mensagens analisadas em que a IA não identificou informação nova para atualizar o card.')}
        ${this.metricCard('Erros de processamento', monitoring ? monitorTotals.errors : null, 'fa-triangle-exclamation', 'Falhas de processamento registradas nos últimos eventos retidos.')}
        ${this.metricCard('Perfis classificados', monitoring ? monitorTotals.classified : null, 'fa-tags', 'Eventos com classificação ou nicho identificado; não equivale necessariamente a um lead comercial qualificado.')}
        ${this.metricCard('Leads qualificados (eventos)', monitoring ? monitorTotals.qualified : null, 'fa-bullseye', 'Classificações comerciais qualificadas confirmadas pelo perfil Comercial; networking não conta como qualificação comercial.')}
      </section>

      <section class="i9-execution-section">
        <div class="i9-execution-section-head"><div><h3><i class="fas fa-chart-line"></i> Desempenho por personalidade</h3><p>Resumo dos últimos ${Number(monitoring?.retainedEvents) || 0} eventos locais retidos (limite ${Number(monitoring?.retentionLimit) || 500}). A taxa considera apenas tentativas de resposta.</p></div></div>
        ${this.personaPerformance(monitoring)}
      </section>

      <section class="i9-execution-section">
        <div class="i9-execution-section-head"><div><h3><i class="fas fa-wave-square"></i> Atividade recente da IA</h3><p>Entradas, respostas, mensagens ignoradas e classificações. O conteúdo das mensagens não é exibido neste painel.</p></div></div>
        ${this.aiActivityList(monitoring)}
      </section>

      <section class="i9-execution-section">
        <div class="i9-execution-section-head"><div><h3><i class="fas fa-triangle-exclamation"></i> Erros e respostas pendentes</h3><p>Falhas recentes que podem exigir revisão no WhatsApp Web ou no provedor de IA.</p></div></div>
        ${this.aiErrorsList(monitoring)}
      </section>

      <section class="i9-execution-section">
        <div class="i9-execution-section-head"><div><h3><i class="fas fa-list-check"></i> Campanhas e lotes</h3><p>O próximo lote é mostrado apenas quando a campanha informa um horário de retomada.</p></div><button class="btn btn-primary btn-sm" data-execution-action="campaigns"><i class="fas fa-arrow-up-right-from-square"></i> Ver todas</button></div>
        <div class="i9-execution-campaign-list">${errors.campaignError ? '<div class="i9-execution-empty">Não foi possível ler as campanhas. Atualize para tentar novamente.</div>' : campaigns.length ? campaigns.slice(0, 8).map(c => this.campaignCard(c)).join('') : '<div class="i9-execution-empty"><i class="fas fa-inbox"></i><strong>Nenhuma campanha cadastrada</strong><span>Crie uma campanha para acompanhar lotes, progresso e falhas aqui.</span><button class="btn btn-primary btn-sm" data-execution-action="campaigns">Criar campanha</button></div>'}</div>
      </section>

      <section class="i9-execution-bottom-grid">
        <article class="i9-execution-section"><div class="i9-execution-section-head"><div><h3><i class="fas fa-message"></i> Última mensagem processada</h3><p>Resultado mais recente registrado pelo Chat com IA.</p></div></div>${this.lastProcessingCard(ai.lastProcessingStatus)}</article>
        <article class="i9-execution-section"><div class="i9-execution-section-head"><div><h3><i class="fas fa-heart-pulse"></i> Diagnóstico</h3><p>Indicadores que ajudam a descobrir por que uma tarefa não avança.</p></div></div>${this.diagnostics(ai, wa, errors)}</article>
      </section>
      <p class="i9-execution-footnote"><i class="fas fa-circle-info"></i> A central exibe os dados disponíveis na extensão. Como o atendimento usa o WhatsApp Web, o navegador, a sessão e o painel precisam permanecer funcionando para processar tarefas.</p>
    `;
  }

  personaPerformance(monitoring) {
    if (!monitoring) return '<div class="i9-execution-empty"><i class="fas fa-circle-question"></i><strong>Desempenho indisponível</strong><span>Atualize a extensão para carregar os indicadores de monitoramento.</span></div>';
    const rows = Array.isArray(monitoring.byPersona) ? monitoring.byPersona : [];
    if (!rows.length) return '<div class="i9-execution-empty"><i class="fas fa-chart-line"></i><strong>Ainda não há eventos da IA</strong><span>Quando mensagens forem processadas, o desempenho de cada personalidade aparecerá aqui.</span></div>';
    const modeLabels = { networking: 'Networking', self_knowledge: 'Autoconhecimento', commercial: 'Comercial' };
    return `<div class="i9-ai-persona-grid">${rows.map((row) => {
      const niches = (Array.isArray(row.niches) ? row.niches : []).map((item) => `${this.escapeHtml(item.name)} (${Number(item.count) || 0})`).join(' · ');
      const operationLabel = row.operationMode === 'observe_only' ? 'IA observadora · sem envio' : 'Atendimento automático';
      const rate = row.responseRate !== null && row.responseRate !== undefined && Number.isFinite(Number(row.responseRate)) ? `${Number(row.responseRate).toLocaleString('pt-BR')}%` : '—';
      return `<article class="i9-ai-persona-card"><div class="i9-ai-persona-card-head"><div><h4>${this.escapeHtml(row.personaName || 'Perfil global')}</h4><span>${this.escapeHtml(modeLabels[row.personaMode] || 'Perfil')} · ${this.escapeHtml(operationLabel)}</span></div><span class="i9-execution-pill tone-neutral">${Number(row.messages) || 0} eventos</span></div><div class="i9-ai-persona-stats"><div><span>Respostas</span><strong>${Number(row.responses) || 0}</strong></div><div><span>Análises CRM</span><strong>${Number(row.analyzed) || 0}</strong></div><div><span>Sem dados novos</span><strong>${Number(row.observerNoChange) || 0}</strong></div><div><span>Taxa de resposta</span><strong>${rate}</strong></div><div><span>Erros</span><strong>${Number(row.errors) || 0}</strong></div><div><span>Classificações</span><strong>${Number(row.classified) || 0}</strong></div><div><span>Qualificados</span><strong>${Number(row.qualified) || 0}</strong></div><div><span>Pendentes</span><strong>${Number(row.pendingReplies) || 0}</strong></div></div>${niches ? `<p class="i9-ai-persona-niches"><strong>Nichos identificados:</strong> ${niches}</p>` : ''}</article>`;
    }).join('')}</div>`;
  }

  aiActivityList(monitoring) {
    if (!monitoring) return '<div class="i9-execution-empty">Atividade não disponível no momento.</div>';
    const events = Array.isArray(monitoring.recentEvents) ? monitoring.recentEvents : [];
    if (!events.length) return '<div class="i9-execution-empty"><i class="fas fa-inbox"></i><strong>Nenhuma atividade registrada ainda</strong><span>As próximas mensagens elegíveis aparecerão aqui com status, personalidade e classificação, quando houver.</span></div>';
    const labels = { processed: 'Resposta enviada', observed: 'Análise atualizou o CRM', 'observer-no-change': 'Análise sem dados novos', 'license-blocked-observer': 'Licença sem IA observadora', 'observer-persona-not-supported': 'Perfil incompatível com observação', 'reply-pending': 'Resposta pendente', error: 'Erro', paused: 'IA pausada', 'panel-not-open': 'Painel inativo', 'chat-type-disabled': 'Tipo de conversa desativado', 'group-not-selected': 'Grupo não autorizado', 'group-excluded': 'Grupo excluído', 'group-keywords-empty': 'Palavras-chave ausentes', 'group-trigger-required': 'Gatilho não atendido', 'human-handoff-active': 'Atendimento humano assumido', 'rate-limited': 'Limite temporário', 'configuration-incomplete': 'Configuração incompleta', 'license-blocked': 'Bloqueio de licença', duplicate: 'Duplicada ignorada', 'duplicate-content': 'Conteúdo duplicado', 'duplicate-in-flight': 'Já em processamento', ignored: 'Ignorada', 'invalid-message': 'Mensagem inválida', 'rate-limit-storage-error': 'Erro no limite de frequência' };
    const classification = { qualified: 'Qualificado', nurture: 'Nutrição', in_qualification: 'Em qualificação', not_qualified: 'Não qualificado', profile_identified: 'Perfil identificado' };
    return `<div class="i9-ai-activity-list">${events.slice(0, 20).map((event) => {
      const tone = ['processed', 'observed'].includes(event.status) ? 'tone-active' : ['error', 'reply-pending', 'license-blocked-observer', 'observer-persona-not-supported'].includes(event.status) ? 'tone-danger' : 'tone-waiting';
      const when = event.at && Number.isFinite(Date.parse(event.at)) ? new Date(event.at).toLocaleString('pt-BR') : 'Horário não informado';
      const type = event.chatType === 'group' ? 'Grupo' : 'Privado';
      const modeName = event.operationMode === 'observe_only' ? '👁️ IA Observador' : '🤖 IA Atendimento';
      const classificationText = classification[event.qualificationStatus] || '';
      const details = [modeName, event.personaName || 'Perfil global', type, classificationText, event.niche || ''].filter(Boolean).join(' · ');
      return `<article class="i9-ai-activity-item"><div class="i9-ai-activity-top"><span class="i9-execution-pill ${tone}">${this.escapeHtml(labels[event.status] || event.status || 'Status desconhecido')}</span><time>${this.escapeHtml(when)}</time></div><strong>${this.escapeHtml(event.chatName || type)}</strong><p>${this.escapeHtml(details)}</p>${event.error ? `<p class="i9-execution-error-line">${this.escapeHtml(event.error)}</p>` : ''}${event.durationMs !== null && event.durationMs !== undefined && Number.isFinite(Number(event.durationMs)) ? `<small>Processamento: ${this.escapeHtml(String(Number(event.durationMs)))} ms</small>` : ''}</article>`;
    }).join('')}</div>`;
  }

  aiErrorsList(monitoring) {
    if (!monitoring) return '<div class="i9-execution-empty">Não foi possível consultar o histórico de erros.</div>';
    const events = Array.isArray(monitoring.recentErrors) ? monitoring.recentErrors : [];
    if (!events.length) return '<div class="i9-execution-empty"><i class="fas fa-circle-check"></i><strong>Nenhum erro recente registrado</strong><span>Isso significa que não há erros nos eventos retidos, não que o sistema tenha sido testado em todas as condições.</span></div>';
    return `<div class="i9-ai-error-list">${events.map((event) => `<article class="i9-ai-error-item"><div><strong>${this.escapeHtml(event.chatName || (event.chatType === 'group' ? 'Grupo' : 'Conversa privada'))}</strong><span>${this.escapeHtml(event.personaName || 'Perfil global')} · ${this.escapeHtml(event.at && Number.isFinite(Date.parse(event.at)) ? new Date(event.at).toLocaleString('pt-BR') : 'Horário não informado')}</span></div><span class="i9-execution-pill ${event.status === 'error' ? 'tone-danger' : 'tone-waiting'}">${event.status === 'error' ? 'Erro' : 'Envio pendente'}</span><p>${this.escapeHtml(event.error || (event.status === 'reply-pending' ? 'O WhatsApp não confirmou o envio da resposta.' : 'Falha sem detalhes adicionais.'))}</p></article>`).join('')}</div>`;
  }

  getAiState(ai, failed) {
    if (failed || !this.ai) return { label: 'Estado desconhecido', tone: 'tone-neutral', detail: 'O estado da IA não foi consultado. Tente atualizar.' };
    const configured = !!ai.apiKeyConfigured && !!ai.modelConfigured && !!ai.providerVerified;
    if (!configured) return { label: 'Não conectada', tone: 'tone-danger', detail: ai.providerLastError ? `Último erro: ${String(ai.providerLastError).slice(0, 120)}` : 'Falta chave, modelo válido ou teste do provedor.' };
    const observing = ai.operationMode === 'observe_only';
    if (!ai.enabled) return { label: 'Pausada', tone: 'tone-waiting', detail: observing ? 'A IA observadora está pausada e não registra no CRM.' : 'O atendimento está pausado e a IA não responde.' };
    if (!ai.whatsappConnected) return { label: 'Aguardando WhatsApp', tone: 'tone-danger', detail: 'O WhatsApp Web não está conectado.' };
    if (!ai.panelActive) return { label: 'Painel inativo', tone: 'tone-waiting', detail: 'Abra o painel lateral do i9Hub para renovar o sinal de atividade.' };
    if (Array.isArray(ai.setupMissing) && ai.setupMissing.length) return { label: 'Configuração incompleta', tone: 'tone-waiting', detail: `Faltam: ${ai.setupMissing.join(', ')}.` };
    const last = ai.lastProcessingStatus;
    if (last?.status === 'error' && last.at && Date.now() - Date.parse(last.at) < 30 * 60 * 1000) return { label: (observing ? 'Observadora ativa' : 'Atendimento ativo') + ' · verificar erro', tone: 'tone-waiting', detail: `Última mensagem com erro${last.chatName ? ` em ${last.chatName}` : ''}: ${last.error || 'erro não detalhado'}` };
    if (ai.storeWatcher && !ai.storeWatcher.active) return { label: (observing ? 'Observadora ativa' : 'Atendimento ativo') + ' · leitura incerta', tone: 'tone-waiting', detail: 'Conectada, mas o leitor de mensagens não confirmou atividade recente.' };
    return { label: observing ? 'Observadora ativa' : 'Atendimento ativo', tone: 'tone-active', detail: observing ? 'IA lendo as mensagens e atualizando os cards do CRM silenciosamente.' : 'IA respondendo automaticamente e qualificando leads no CRM.' };
  }

  getWaState(wa, failed) {
    if (failed || !this.wa) return { label: 'Estado desconhecido', tone: 'tone-neutral', detail: 'Não foi possível consultar a conexão.' };
    const states = {
      connected: { label: 'Conectado', tone: 'tone-active', detail: wa.visible === false ? 'Sessão conectada, mas a aba/janela está fora de vista.' : 'Sessão disponível para as ações compatíveis.' },
      qr: { label: 'Aguardando QR', tone: 'tone-waiting', detail: 'Escaneie o QR code no WhatsApp Web.' },
      opening: { label: 'Conectando', tone: 'tone-waiting', detail: 'O WhatsApp Web ainda está carregando.' },
      error: { label: 'Erro de conexão', tone: 'tone-danger', detail: wa.error || 'O WhatsApp Web apresentou um erro.' },
      none: { label: 'Desconectado', tone: 'tone-danger', detail: 'Abra o WhatsApp Web e confirme que a sessão está conectada.' },
    };
    return states[wa.state] || { label: 'Verificando', tone: 'tone-neutral', detail: 'Estado de conexão não reconhecido.' };
  }

  metricCard(title, value, icon, hint) {
    const display = value === null || value === undefined ? '—' : Number(value).toLocaleString('pt-BR');
    return `<article class="i9-execution-metric" title="${this.escapeHtml(hint)}"><span class="i9-execution-metric-icon"><i class="fas ${icon}"></i></span><div><span>${this.escapeHtml(title)}</span><strong>${display}</strong></div></article>`;
  }

  campaignCard(c) {
    const contacts = Array.isArray(c.contacts) ? c.contacts : [];
    const countStatus = (status) => contacts.filter(x => x?.status === status).length;
    const sent = Math.max(Number(c.sent) || 0, countStatus('sent'));
    const failed = Math.max(Number(c.failed) || 0, countStatus('failed'));
    const skipped = Math.max(Number(c.skipped) || 0, countStatus('skipped'));
    const pending = contacts.filter(x => !x?.status || x.status === 'pending').length;
    const total = Math.max(Number(c.total) || 0, contacts.length);
    const progress = total ? Math.min(100, Math.round(((sent + failed + skipped) / total) * 100)) : 0;
    const next = c.nextBatchAt ? Date.parse(c.nextBatchAt) : NaN;
    const inPause = c.status === 'running' && Number.isFinite(next) && next > Date.now();
    const label = c.status === 'running' ? (inPause ? 'Pausa entre lotes · IA pode atender' : 'Enviando lote') : c.status === 'paused' ? 'Pausada' : c.status === 'limit_reached' ? 'Limite atingido · aguardando ajuste' : c.status === 'completed' ? 'Concluída' : c.status === 'draft' ? 'Rascunho' : 'Estado desconhecido';
    const tone = c.status === 'running' ? (inPause ? 'tone-waiting' : 'tone-active') : ['paused', 'limit_reached'].includes(c.status) ? 'tone-waiting' : 'tone-neutral';
    const batch = (Number(c.batchSize) > 0 && Number(c.batchPauseMs) > 0 ? `${Number(c.batchSize)} por lote · pausa de ${this.formatDuration(Number(c.batchPauseMs))}` : 'Sem ciclo de lotes configurado') + (Number(c.sendLimit) > 0 ? ` · limite ${Number(c.sendLimit)}` : ' · sem limite adicional');
    const nextLine = inPause ? `<div class="i9-execution-next-batch"><i class="fas fa-hourglass-half"></i> Próximo lote: <strong>${this.escapeHtml(new Date(next).toLocaleTimeString('pt-BR'))}</strong> · em ${this.escapeHtml(this.countdown(next))}</div>` : '';
    const id = this.escapeHtml(String(c.id || ''));
    return `<article class="i9-execution-campaign"><div class="i9-execution-campaign-head"><div><h4>${this.escapeHtml(c.name || 'Campanha sem nome')}</h4><span class="i9-execution-campaign-meta">${this.escapeHtml(this.audienceLabel(c))} · ${this.escapeHtml(batch)}</span></div><span class="i9-execution-pill ${tone}">${this.escapeHtml(label)}</span></div><div class="i9-execution-progress"><div style="width:${progress}%"></div></div><div class="i9-execution-counts"><span><strong>${sent}</strong> enviadas</span><span><strong>${pending}</strong> pendentes</span><span><strong>${failed}</strong> falhas</span><span><strong>${skipped}</strong> ignoradas</span><span><strong>${total}</strong> total</span></div>${nextLine}${c.lastError ? `<p class="i9-execution-error-line"><i class="fas fa-triangle-exclamation"></i> ${this.escapeHtml(c.lastError)}</p>` : ''}<div class="i9-execution-actions">${c.status === 'running' ? `<button class="btn btn-sm btn-secondary" data-execution-action="pause" data-id="${id}"><i class="fas fa-pause"></i> Pausar</button><button class="btn btn-sm btn-danger" data-execution-action="stop" data-id="${id}"><i class="fas fa-stop"></i> Parar</button>` : ''}${c.status === 'paused' ? `<button class="btn btn-sm btn-primary" data-execution-action="resume" data-id="${id}"><i class="fas fa-play"></i> Retomar</button>` : ''}</div></article>`;
  }

  audienceLabel(c) {
    const a = c?.audience || {};
    const labels = { google_maps: 'Google Maps', whatsapp_group: 'Grupos do WhatsApp', whatsapp_private: 'Conversas privadas', whatsapp_business: 'WhatsApp Business', wa_label: 'Etiquetas WhatsApp', i9hub_tag: 'Etiquetas i9Hub', manual: 'Lista manual', import: 'Importação', all: 'Múltiplas origens' };
    const source = c?.source || a?.source || '';
    if (Array.isArray(a.sources) && a.sources.length) return a.sources.map(x => labels[x] || x).join(', ');
    return labels[source] || (source ? String(source).replaceAll('_', ' ') : 'Público selecionado');
  }

  lastProcessingCard(last) {
    if (!last) return '<div class="i9-execution-detail-empty">Ainda não há uma mensagem processada registrada nesta sessão.</div>';
    const labels = { processed: 'Processada', observed: 'Observada e anotada no CRM', 'observer-no-change': 'Observada (sem novos dados)', 'reply-pending': 'Resposta pendente', error: 'Erro', paused: 'IA pausada', 'panel-not-open': 'Painel não estava aberto', 'chat-type-disabled': 'Tipo de conversa desativado', 'group-trigger-required': 'Gatilho do grupo não atendido', 'group-not-selected': 'Grupo não autorizado', 'group-excluded': 'Grupo excluído da seleção', 'group-keywords-empty': 'Palavras-chave não configuradas', 'human-handoff-active': 'Atendimento humano assumido', 'rate-limited': 'Limite temporário atingido', 'configuration-incomplete': 'Configuração incompleta', 'license-blocked': 'Bloqueio de licença', duplicate: 'Duplicada ignorada', 'duplicate-content': 'Conteúdo duplicado ignorado', 'duplicate-in-flight': 'Já estava sendo processada', ignored: 'Ignorada', 'invalid-message': 'Mensagem inválida' };
    const tone = last.status === 'error' ? 'tone-danger' : ['processed', 'observed'].includes(last.status) ? 'tone-active' : 'tone-waiting';
    return `<div class="i9-execution-last-processing"><span class="i9-execution-pill ${tone}">${this.escapeHtml(labels[last.status] || last.status || 'Estado não informado')}</span><strong>${this.escapeHtml(last.chatName || 'Conversa não identificada')}</strong><span>${this.escapeHtml(last.chatType === 'group' ? 'Grupo' : 'Privado')} · ${this.escapeHtml(last.at ? new Date(last.at).toLocaleString('pt-BR') : 'Horário não informado')}</span>${last.error ? `<p class="i9-execution-error-line">${this.escapeHtml(last.error)}</p>` : ''}</div>`;
  }

  diagnostics(ai, wa, errors) {
    const checks = [];
    checks.push({ ok: !errors.waError && wa.state === 'connected', label: errors.waError ? 'Estado do WhatsApp não consultado' : wa.state === 'connected' ? 'WhatsApp Web conectado' : `WhatsApp Web: ${wa.state || 'desconhecido'}` });
    checks.push({ ok: !errors.aiError && !!ai.panelActive, label: errors.aiError ? 'Estado do painel IA não consultado' : ai.panelActive ? 'Painel i9Hub enviando sinal de atividade' : 'Painel IA não detectado pelo heartbeat' });
    checks.push({ ok: !errors.aiError && !!ai.apiKeyConfigured && !!ai.providerVerified, label: errors.aiError ? 'Provedor não consultado' : ai.apiKeyConfigured && ai.providerVerified ? 'Chave e provedor testados' : 'Chave/provedor precisam de configuração ou teste' });
    checks.push({ ok: !errors.aiError && (!ai.lastProcessingStatus || ai.lastProcessingStatus.status !== 'error'), label: errors.aiError ? 'Último processamento não consultado' : ai.lastProcessingStatus?.status === 'error' ? 'A última mensagem registrou erro' : 'Nenhum erro recente no último processamento' });
    checks.push({ ok: !errors.aiError && Number(ai.incomingQueueNeedsAttentionCount || 0) === 0, label: errors.aiError ? 'Fila de revisão não consultada' : Number(ai.incomingQueueNeedsAttentionCount || 0) > 0 ? `${Number(ai.incomingQueueNeedsAttentionCount)} mensagem(ns) exigem revisão manual; envio não foi repetido automaticamente` : 'Nenhuma mensagem aguardando revisão manual' });
    return `<ul class="i9-execution-checks">${checks.map(x => `<li class="${x.ok ? 'is-ok' : 'is-warn'}"><i class="fas ${x.ok ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><span>${this.escapeHtml(x.label)}</span></li>`).join('')}</ul>${ai.providerLastError ? `<p class="i9-execution-error-line">Último erro do provedor: ${this.escapeHtml(ai.providerLastError)}</p>` : ''}${ai.historyLastError ? `<p class="i9-execution-error-line">Último erro do histórico: ${this.escapeHtml(ai.historyLastError)}</p>` : ''}`;
  }

  countdown(timestamp) {
    const ms = Math.max(0, timestamp - Date.now());
    const total = Math.floor(ms / 1000);
    const hours = Math.floor(total / 3600), minutes = Math.floor((total % 3600) / 60), seconds = total % 60;
    return hours ? `${hours}h ${minutes}min` : minutes ? `${minutes}min ${seconds}s` : `${seconds}s`;
  }

  formatDuration(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return '0 min';
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60), rest = minutes % 60;
    return rest ? `${hours}h ${rest}min` : `${hours}h`;
  }

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
}
