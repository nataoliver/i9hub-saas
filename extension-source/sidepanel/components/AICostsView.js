export class AICostsView {
  constructor(app) { 
    this.app = app; 
  }

  async render(container) {
    container.innerHTML = this.getHTML();
    await this.loadData();
    this.bindEvents();
  }

  getHTML() {
    return `
      <div class="cost-dashboard-view" style="padding: 24px; max-width: 1000px; margin: 0 auto; color: var(--text-color, #e0e0e0);">
        <header class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding-bottom: 12px;">
          <div>
            <h2 style="margin:0; font-size: 1.6rem; color: #fff;"><i class="fas fa-coins" style="color: #f59e0b; margin-right: 8px;"></i> ROI & Métricas de Tokens (IA)</h2>
            <p style="margin: 4px 0 0 0; font-size: 0.9rem; color: var(--text-muted, #aaa);">Análise de viabilidade e eficiência da IA vs. Atendimento Humano</p>
          </div>
          <button id="btn-refresh-costs" class="btn btn-secondary"><i class="fas fa-sync"></i> Atualizar Dados</button>
        </header>

        <!-- Seção 1: ROI e Eficiência -->
        <h3 style="margin-bottom: 16px; font-size: 1.2rem; color: #60a5fa;"><i class="fas fa-chart-line"></i> Eficiência e Retorno (Mês Atual)</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 32px;">
           <div class="stat-card" style="background: var(--bg-surface, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">
               <h4 style="margin:0 0 8px 0; font-size: 0.85rem; color: var(--text-muted, #aaa); text-transform: uppercase;">Custo por Interação</h4>
               <div id="cost-per-interaction" style="font-size: 1.8rem; font-weight: bold; color: #fff;">$ 0.000</div>
               <div style="font-size: 0.75rem; color: var(--text-muted, #888); margin-top: 4px;">Média de gasto por requisição IA</div>
           </div>
           
           <div class="stat-card" style="background: var(--bg-surface, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding: 16px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
               <h4 style="margin:0 0 8px 0; font-size: 0.85rem; color: var(--text-muted, #aaa); text-transform: uppercase;">Custo Estimado por Lead</h4>
               <div id="cost-per-lead" style="font-size: 1.8rem; font-weight: bold; color: #fff;">$ 0.00</div>
               <div style="font-size: 0.75rem; color: var(--text-muted, #888); margin-top: 4px;">Gasto total / Leads novos gerados</div>
           </div>

           <div class="stat-card" style="background: var(--bg-surface, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;">
               <h4 style="margin:0 0 8px 0; font-size: 0.85rem; color: var(--text-muted, #aaa); text-transform: uppercase;">Economia de Tempo Humano</h4>
               <div id="hours-saved" style="font-size: 1.8rem; font-weight: bold; color: #10b981;">0 h</div>
               <div style="font-size: 0.75rem; color: var(--text-muted, #888); margin-top: 4px;">Baseado em 3 min por atendimento manual</div>
           </div>
           
           <div class="stat-card" style="background: var(--bg-surface, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b;">
               <h4 style="margin:0 0 8px 0; font-size: 0.85rem; color: var(--text-muted, #aaa); text-transform: uppercase;">ROI Estimado (vs. SDR)</h4>
               <div id="roi-financial" style="font-size: 1.8rem; font-weight: bold; color: #f59e0b;">$ 0.00</div>
               <div style="font-size: 0.75rem; color: var(--text-muted, #888); margin-top: 4px;">Economia em salário base ($5/hora)</div>
           </div>
        </div>

        <!-- Seção 2: Consumo Bruto -->
        <h3 style="margin-bottom: 16px; font-size: 1.2rem; color: #ef4444;"><i class="fas fa-server"></i> Consumo de Infraestrutura</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
           <div class="stat-card" style="background: var(--bg-surface, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding: 16px; border-radius: 8px;">
               <h4 style="margin:0 0 8px 0; font-size: 0.85rem; color: var(--text-muted, #aaa);">Gasto Mensal (USD)</h4>
               <div id="cost-monthly-usd" style="font-size: 1.5rem; font-weight: bold; color: #ef4444;">$ 0.0000</div>
           </div>
           <div class="stat-card" style="background: var(--bg-surface, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding: 16px; border-radius: 8px;">
               <h4 style="margin:0 0 8px 0; font-size: 0.85rem; color: var(--text-muted, #aaa);">Gasto Diário (USD)</h4>
               <div id="cost-daily-usd" style="font-size: 1.5rem; font-weight: bold;">$ 0.0000</div>
           </div>
           <div class="stat-card" style="background: var(--bg-surface, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding: 16px; border-radius: 8px;">
               <h4 style="margin:0 0 8px 0; font-size: 0.85rem; color: var(--text-muted, #aaa);">Tokens Trafegados (Mês)</h4>
               <div id="cost-monthly-tokens" style="font-size: 1.5rem; font-weight: bold;">0</div>
           </div>
        </div>

        <h3 style="margin-bottom: 12px; font-size: 1.1rem; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding-bottom: 8px;">Uso Detalhado por Provedor (Total Histórico)</h3>
        <div id="cost-providers-list" style="display: flex; flex-direction: column; gap: 12px;">
           <!-- preenchido via JS -->
        </div>
      </div>
    `;
  }

  async loadData() {
    try {
      // 1. Obter dados de custo bruto do ai-cost-control
      const data = await chrome.storage.local.get(['i9hub_ai_cost_usage', 'i9hub_ai_cost_control']);
      const usage = data.i9hub_ai_cost_usage || { daily: {}, monthly: {}, byProvider: {} };
      
      const todayKey = new Date().toISOString().slice(0, 10);
      const monthKey = new Date().toISOString().slice(0, 7);

      const monthlyUsd = usage.monthly[monthKey]?.costUsd || 0;
      const dailyUsd = usage.daily[todayKey]?.costUsd || 0;
      const monthlyTokens = usage.monthly[monthKey]?.tokens || 0;
      
      // Contar requisições do mês atual somando dos provedores (simplificado p/ histórico, ou iterar daily)
      let totalInteractions = 0;
      for (const p of Object.values(usage.byProvider || {})) {
         totalInteractions += (p.requests || 0);
      }
      // Se não houver requisições, evitar divisão por zero
      const safeInteractions = totalInteractions > 0 ? totalInteractions : 1;

      // 2. Obter dados de performance/CRM para cruzar com o custo
      let leadsCreated = 1; // default fallback
      try {
        const crmStats = await this.app.api.getDashboardStats();
        if (crmStats && crmStats.data && crmStats.data.newLeads) {
            leadsCreated = parseInt(crmStats.data.newLeads) || 1;
        } else {
            // Tenta pegar da store local de métricas, se houver
            const localM = await chrome.storage.local.get('i9hub_metrics');
            if (localM && localM.i9hub_metrics && localM.i9hub_metrics.leadsCreated) {
                leadsCreated = parseInt(localM.i9hub_metrics.leadsCreated) || 1;
            }
        }
      } catch(e) { console.warn("CRM Stats não encontrados, usando fallback de leads = 1"); }

      // 3. Cálculos de ROI
      const costPerInteraction = monthlyUsd / safeInteractions;
      const costPerLead = monthlyUsd / leadsCreated;
      
      // Assumindo 3 minutos (0.05h) ganhos por requisição à IA que um humano teria que digitar
      const hoursSaved = (totalInteractions * 3) / 60;
      
      // Custo humano estimado (ex: $5 por hora para um SDR)
      const humanCostRatePerHour = 5.00;
      const humanCostTotal = hoursSaved * humanCostRatePerHour;
      const netSavings = humanCostTotal - monthlyUsd;

      // Atualiza DOM
      document.getElementById('cost-monthly-usd').textContent = '$ ' + monthlyUsd.toFixed(4);
      document.getElementById('cost-daily-usd').textContent = '$ ' + dailyUsd.toFixed(4);
      document.getElementById('cost-monthly-tokens').textContent = monthlyTokens.toLocaleString('pt-BR');
      
      document.getElementById('cost-per-interaction').textContent = '$ ' + costPerInteraction.toFixed(4);
      document.getElementById('cost-per-lead').textContent = '$ ' + costPerLead.toFixed(2);
      document.getElementById('hours-saved').textContent = hoursSaved.toFixed(1) + ' h';
      
      const roiEl = document.getElementById('roi-financial');
      roiEl.textContent = (netSavings >= 0 ? '+ $' : '- $') + Math.abs(netSavings).toFixed(2);
      roiEl.style.color = netSavings >= 0 ? '#10b981' : '#ef4444'; // verde se lucro, vermelho se prejuizo

      // 4. Renderizar lista de provedores
      const providersList = document.getElementById('cost-providers-list');
      providersList.innerHTML = '';

      if (!usage.byProvider || Object.keys(usage.byProvider).length === 0) {
         providersList.innerHTML = '<div style="color: var(--text-muted, #aaa); font-size: 0.9rem;">Nenhum uso registrado ainda.</div>';
         return;
      }

      for (const [providerId, stats] of Object.entries(usage.byProvider)) {
         const div = document.createElement('div');
         div.style.cssText = "background: var(--bg-surface, rgba(255,255,255,0.02)); border: 1px solid var(--border-color, rgba(255,255,255,0.05)); padding: 16px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;";
         
         const name = providerId.toUpperCase();
         const cost = (stats.costUsd || 0).toFixed(4);
         const tokens = (stats.tokens || 0).toLocaleString('pt-BR');
         const reqs = stats.requests || 0;

         div.innerHTML = `
            <div>
               <div style="font-weight: bold; font-size: 1.1rem; margin-bottom: 4px; color: #fff;">${name}</div>
               <div style="font-size: 0.85rem; color: var(--text-muted, #888);"><i class="fas fa-bolt" style="color: #fbbf24;"></i> ${reqs} requisições processadas</div>
            </div>
            <div style="text-align: right;">
               <div style="font-weight: bold; color: #ef4444; font-size: 1.1rem;">$ ${cost}</div>
               <div style="font-size: 0.85rem; color: var(--text-muted, #888);">${tokens} tokens consumidos</div>
            </div>
         `;
         providersList.appendChild(div);
      }
    } catch (err) {
      console.error('Erro ao carregar custos', err);
    }
  }

  bindEvents() {
    const btn = document.getElementById('btn-refresh-costs');
    if (btn) {
      btn.addEventListener('click', async () => {
        const icon = btn.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
        await this.loadData();
        if (icon) setTimeout(() => icon.classList.remove('fa-spin'), 500);
      });
    }
  }
}
