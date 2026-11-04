export class LogsView {
  constructor(app) { this.app = app; this.logs = []; }

  async render(container) {
    container.innerHTML = this.getHTML();
    this.bind();
    await this.load();
  }

  getHTML() {
    return `<div class="logs-view">
      <header class="view-header"><h2>Logs do Sistema</h2>
        <div><button id="logs-refresh" class="btn btn-secondary">Atualizar</button>
        <button id="logs-export" class="btn btn-secondary">Exportar JSON</button>
        <button id="logs-clear" class="btn btn-danger">Limpar logs</button></div>
      </header>
      <div id="logs-list"></div></div>`;
  }

  async load() {
    const stored = (await chrome.storage.local.get('systemLogs')).systemLogs;
    this.logs = Array.isArray(stored) ? stored.slice().reverse() : [];
    const container = document.getElementById('logs-list');
    if (!container) return;
    container.replaceChildren();
    if (!this.logs.length) { container.textContent = 'Sem logs'; return; }

    // Limita a renderização visual para manter o painel responsivo; a exportação inclui o histórico carregado.
    for (const log of this.logs.slice(0, 500)) {
      const card = document.createElement('div'); card.className = 'card';
      const header = document.createElement('div');
      const time = document.createElement('b'); time.textContent = String(log?.timestamp || '');
      header.append(time, document.createTextNode(` | ${String(log?.module || '')} | ${String(log?.action || '')}`));
      const summary = document.createElement('div');
      summary.textContent = `${String(log?.status || '')}: ${String(log?.message || '')}`;
      const pre = document.createElement('pre');
      try { pre.textContent = JSON.stringify(log?.data ?? {}, null, 2); } catch { pre.textContent = '[Dados do log indisponíveis]'; }
      card.append(header, summary, pre); container.appendChild(card);
    }
    if (this.logs.length > 500) {
      const note = document.createElement('p'); note.className = 'text-muted';
      note.textContent = `Exibindo os 500 logs mais recentes de ${this.logs.length}. Exporte JSON para consultar o histórico completo.`;
      container.prepend(note);
    }
  }

  bind() {
    document.getElementById('logs-refresh').onclick = () => this.load();
    document.getElementById('logs-clear').onclick = async () => { await chrome.storage.local.set({ systemLogs: [] }); await this.load(); };
    document.getElementById('logs-export').onclick = async () => {
      const blob = new Blob([JSON.stringify(this.logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({ url, filename: 'systemLogs.json' });
    };
  }
}
