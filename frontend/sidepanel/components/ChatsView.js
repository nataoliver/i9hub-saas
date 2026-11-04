import { normPhone } from '../utils/segments.js';

function readMigratedLocalStorage(key, legacyKey, fallback = null) {
  try {
    const current = localStorage.getItem(key);
    if (current !== null) return current;
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null) { localStorage.setItem(key, legacy); return legacy; }
  } catch { /* armazenamento indisponível: usar padrão */ }
  return fallback;
}

export class ChatsView {
  constructor(app) { this.app = app; this.groups = []; this.members = []; this.previousMembers = []; this.selectedGroup = null; this.loading = false; this.skipSelf = readMigratedLocalStorage('i9hub-members-skip-self', 'i9rcs-members-skip-self', '1') !== '0'; }

  async render(container) { container.innerHTML = this.getHTML(); this.bindEvents(); await this.loadChats(); }

  getHTML() { return `<div class="chats-view">
    <header class="view-header"><h2><i class="fas fa-users"></i> Extração Grupos do WhatsApp</h2><button class="btn btn-secondary" id="refresh-chats"><i class="fas fa-sync"></i> Atualizar grupos</button></header>
    <div class="form-section"><div class="form-section-title">Grupos dos quais você participa</div><p class="text-muted" style="margin-bottom:12px">Abra o WhatsApp Web e mantenha a sessão conectada. A lista é carregada diretamente da sua conta.</p><input class="form-input" id="chats-search" placeholder="Buscar grupo pelo nome..."><div id="chats-list" class="chats-list"></div></div>
    <div class="form-section" id="members-section" style="display:none"><div class="form-section-title" id="members-title">Participantes</div><div class="form-row" style="margin-bottom:12px"><input class="form-input" id="members-search" placeholder="Buscar participante ou telefone..."></div><div class="form-row" style="margin-bottom:12px"><div class="form-group"><label class="form-label">Extrair</label><select class="form-select" id="members-preset"><option value="all">Todos os membros (falantes e mudos)</option><option value="speakers">Só falantes</option><option value="speakers-noadmin">Falantes sem adm</option><option value="mute">Só mudos</option><option value="noadmin">Todos sem adm</option><option value="admin">Só administradores</option><option value="left">Quem saiu do grupo</option><option value="custom">Personalizado (filtros abaixo)</option></select></div><div class="form-group"><label class="form-label">Período analisado</label><select class="form-select" id="members-period"><option value="30">Últimos 30 dias</option><option value="60">Últimos 60 dias</option><option value="90" selected>Últimos 90 dias</option><option value="180">Últimos 180 dias</option><option value="0">Todo o histórico disponível</option></select></div></div><details id="members-advanced" style="margin-bottom:12px"><summary class="text-muted" style="cursor:pointer">Filtros avançados</summary><div class="form-row" style="margin-top:10px"><div class="form-group"><label class="form-label">Participação</label><select class="form-select" id="members-speech"><option value="all">Falantes e mudos</option><option value="speaker">Só falantes</option><option value="mute">Só mudos</option></select></div><div class="form-group"><label class="form-label">Situação no grupo</label><select class="form-select" id="members-status"><option value="active">Estão no grupo</option><option value="left">Saíram</option><option value="all">Estão + saíram</option></select></div><div class="form-group"><label class="form-label">Perfil</label><select class="form-select" id="members-role"><option value="all">Todos</option><option value="admin">Só administradores</option><option value="member">Sem administradores</option></select></div></div></details><div class="form-group" style="margin-bottom:12px"><label class="toggle"><input type="checkbox" id="members-skip-self"${this.skipSelf ? ' checked' : ''}><span class="toggle-slider"></span> Não incluir o meu próprio número</label></div><div id="members-summary" class="group-summary"></div><div id="group-members"></div></div>
  </div>`; }

  bindEvents() {
    document.getElementById('refresh-chats')?.addEventListener('click', () => this.loadChats());
    document.getElementById('chats-search')?.addEventListener('input', this.debounce(() => this.renderGroups(), 200));
    document.getElementById('members-search')?.addEventListener('input', this.debounce(() => this.renderMembers(), 200));
    document.getElementById('members-preset')?.addEventListener('change', (e) => { this.applyPreset(e.target.value); this.renderMembers(); });
    for (const id of ['members-speech', 'members-status', 'members-role']) document.getElementById(id)?.addEventListener('change', () => { const pr = document.getElementById('members-preset'); if (pr) pr.value = 'custom'; this.renderMembers(); });
    document.getElementById('members-period')?.addEventListener('change', () => { if (this.selectedGroup) this.selectGroup(this.selectedGroup.id); });
    document.getElementById('members-skip-self')?.addEventListener('change', (e) => { this.skipSelf = e.target.checked; try { localStorage.setItem('i9hub-members-skip-self', this.skipSelf ? '1' : '0'); } catch {} this.renderMembers(); });
  }

  async loadChats() {
    if (this.loading) return; this.loading = true; this.renderLoading();
    try {
      const res = await this.app.api.extractAllChats();
      if (!res.success) throw new Error(res.error || 'Não foi possível carregar os grupos');
      this.groups = (res.data || []).filter(c => c.isGroup); this.renderGroups();
      if (!this.groups.length) this.app.showToast('Nenhum grupo identificado. Aguarde o WhatsApp Web terminar de carregar no painel da direita (ou use o botão de recarregar do painel) e tente novamente.', 'warning');
    } catch (e) { this.renderError(e.message); this.app.showToast('Erro ao carregar grupos: ' + e.message, 'error'); }
    finally { this.loading = false; }
  }

  renderLoading() { const el = document.getElementById('chats-list'); if (el) el.innerHTML = '<div class="empty-state"><p><i class="fas fa-spinner fa-spin"></i> Carregando grupos...</p></div>'; }
  renderError(msg) { const el = document.getElementById('chats-list'); if (el) el.innerHTML = `<div class="empty-state"><p>${this.escapeHtml(msg)}</p><button class="btn btn-secondary" id="retry-groups">Tentar novamente</button></div>`; document.getElementById('retry-groups')?.addEventListener('click', () => this.loadChats()); }

  renderGroups() {
    const el = document.getElementById('chats-list'); if (!el) return;
    const q = (document.getElementById('chats-search')?.value || '').toLowerCase();
    const groups = this.groups.filter(g => !q || g.name.toLowerCase().includes(q));
    if (!groups.length) { el.innerHTML = '<div class="empty-state"><p>Nenhum grupo encontrado</p></div>'; return; }
    el.innerHTML = groups.map(g => `<div class="chat-item group-row" data-group-id="${this.escapeHtml(g.id)}"><div class="chat-avatar"><i class="fas fa-users"></i></div><div class="chat-info"><div class="chat-name">${this.escapeHtml(g.name)} <span class="badge badge-info">${g.isCommunity ? 'Comunidade' : (g.isCommunityAnnouncement ? 'Avisos da comunidade' : 'Grupo')}</span></div><div class="chat-meta">${g.size ? g.size + ' participantes · ' : ''}Clique para ver participantes</div></div><button class="btn btn-primary btn-load-group" data-group-id="${this.escapeHtml(g.id)}"><i class="fas fa-user-group"></i> Ver participantes</button></div>`).join('');
    el.querySelectorAll('.group-row').forEach(row => row.addEventListener('click', () => this.selectGroup(row.dataset.groupId)));
  }

  /** Atalhos -> (participação, situação no grupo, perfil). */
  applyPreset(preset) {
    const map = { all: ['all', 'active', 'all'], speakers: ['speaker', 'active', 'all'], 'speakers-noadmin': ['speaker', 'active', 'member'], mute: ['mute', 'active', 'all'], noadmin: ['all', 'active', 'member'], admin: ['all', 'active', 'admin'], left: ['all', 'left', 'all'] };
    const v = map[preset]; if (!v) return;
    document.getElementById('members-speech').value = v[0]; document.getElementById('members-status').value = v[1]; document.getElementById('members-role').value = v[2];
  }

  async selectGroup(groupId) {
    const group = this.groups.find(g => String(g.id) === String(groupId)); if (!group) return; this.selectedGroup = group;
    const groupKey = `${group.id || group.name}`;
    const key = `i9hub-group-members:${groupKey}`;
    const legacyKey = `i9rcs-group-members:${groupKey}`;
    try { this.previousMembers = JSON.parse(readMigratedLocalStorage(key, legacyKey, '[]') || '[]'); } catch { this.previousMembers = []; }
    this.app.showToast(`Carregando participantes de ${group.name}...`, 'info');
    const res = await this.app.api.sendMessage('EXTRACT_GROUP_MEMBERS', { groupId: group.id, groupName: group.name, includeLeft: true, periodDays: Number(document.getElementById('members-period')?.value ?? 90) });
    if (!res.success) { this.app.showToast(res.error || 'Erro ao extrair participantes', 'error'); return; }
    this.members = (res.data || []).map(m => m.isActive === false ? { ...m, isActive: false, status: 'left' } : { ...m, isActive: true, status: 'active' });
    // Quem saiu: (1) lido do histórico do grupo no WhatsApp; (2) quem estava na coleta anterior e não está mais.
    const known = new Set(this.members.map(m => this.memberKey(m)));
    const current = new Set(this.members.filter(m => m.isActive).map(m => this.memberKey(m)));
    const left = this.previousMembers.filter(m => !current.has(this.memberKey(m)) && !known.has(this.memberKey(m))).map(m => ({ ...m, isActive: false, status: 'left', leftReason: m.leftReason || 'não está mais no grupo' }));
    this.members = [...this.members, ...left];
    try { localStorage.setItem(key, JSON.stringify(this.members.filter(m => m.isActive))); } catch {}
    { const pr = document.getElementById('members-preset'); if (pr && pr.value !== 'custom') this.applyPreset(pr.value); }
    document.getElementById('members-section').style.display = 'block'; document.getElementById('members-title').textContent = `Participantes — ${group.name}`; this.renderMembers();
    // A tabela fica abaixo da lista de grupos: leva a tela até ela para o usuário ver os botões de CRM / CSV.
    document.getElementById('members-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const visibleActive = this.members.filter(m => m.isActive && !(this.skipSelf && m.isMe));
    const hidden = visibleActive.filter(m => !m.phone).length;
    this.app.showToast(`${visibleActive.length} participantes atuais carregados` + (hidden ? ` (${hidden} sem telefone: o WhatsApp oculta o número desses membros)` : ''), hidden ? 'warning' : 'success');
  }

  /** Lista do filtro atual (situação + perfil + "não incluir meu número"), sem a busca por texto. */
  filteredMembers() {
    const speech = document.getElementById('members-speech')?.value || 'all'; const status = document.getElementById('members-status')?.value || 'active'; const role = document.getElementById('members-role')?.value || 'all';
    return this.members.filter(m => {
      if (this.skipSelf && m.isMe) return false;
      if (status === 'active' && !m.isActive) return false;
      if (status === 'left' && m.isActive) return false;
      if (speech === 'speaker' && !m.isSpeaker) return false;
      if (speech === 'mute' && m.isSpeaker) return false;
      if (role === 'admin' && !m.isAdmin) return false;
      if (role === 'member' && m.isAdmin) return false;
      return true;
    });
  }

  /** Texto de cobertura: período pedido x histórico que o WhatsApp realmente tinha. */
  coverageNote() {
    const m = this.members.find(x => x.periodDays !== undefined); if (!m) return '';
    if (!m.periodDays) return m.historySince ? `Histórico disponível desde ${new Date(m.historySince).toLocaleDateString('pt-BR')}.` : '';
    if (m.historyComplete) return `Últimos ${m.periodDays} dias analisados por completo.`;
    return `Atenção: o WhatsApp só tinha mensagens desde ${m.historySince ? new Date(m.historySince).toLocaleDateString('pt-BR') : '?'} (menos que ${m.periodDays} dias). Quem aparece como mudo pode ter falado antes disso.`;
  }

  renderMembers() {
    const el = document.getElementById('group-members'); if (!el) return;
    const q = (document.getElementById('members-search')?.value || '').toLowerCase();
    const shown = this.filteredMembers().filter(m => !q || `${m.name || ''} ${m.phone || ''}`.toLowerCase().includes(q));
    const base = this.members.filter(m => !(this.skipSelf && m.isMe));
    const active = base.filter(m => m.isActive).length; const speakers = base.filter(m => m.isActive && m.isSpeaker).length; const mutes = active - speakers; const admins = base.filter(m => m.isActive && m.isAdmin).length; const left = base.filter(m => !m.isActive).length; const hasSpeech = base.some(m => m.isSpeaker !== undefined); const selfHidden = this.skipSelf && this.members.some(m => m.isMe);
    document.getElementById('members-summary').innerHTML = `<span class="badge badge-info">${active} no grupo</span> ${hasSpeech ? `<span class="badge badge-success">${speakers} falantes</span> <span class="badge">${mutes} mudos</span>` : ''} <span class="badge badge-warning">${admins} admins</span> ${left ? `<span class="badge badge-danger">${left} saíram</span>` : ''} ${selfHidden ? '<span class="badge badge-info">seu número oculto</span>' : ''} <span class="badge badge-info">${this.filteredMembers().length} no filtro atual</span>${this.coverageNote() ? `<div class="text-muted" style="margin-top:6px">${this.escapeHtml(this.coverageNote())}</div>` : ''}`;
    if (!shown.length) { el.innerHTML = '<div class="empty-state"><p>Nenhum participante corresponde ao filtro.</p></div>'; return; }
    el.innerHTML = `<div style="max-height:380px;overflow:auto"><table class="table"><thead><tr><th>Nome</th><th>Telefone</th><th>Perfil</th><th>Participação</th><th>Msgs</th><th>Última msg</th></tr></thead><tbody>${shown.map(m => `<tr><td>${this.escapeHtml(m.name || 'Sem nome')}</td><td>${this.escapeHtml(m.phone || 'Não disponível')}</td><td>${m.isAdmin ? '<span class="badge badge-warning"><i class="fas fa-shield-alt"></i> Admin</span>' : 'Participante'}</td><td>${this.speechBadge(m)}</td><td>${m.msgCount ?? '-'}</td><td>${m.lastMessageAt ? new Date(m.lastMessageAt).toLocaleDateString('pt-BR') : '-'}</td></tr>`).join('')}</tbody></table></div><div class="btn-group" style="margin-top:12px"><button class="btn btn-secondary" id="copy-active-members"><i class="fas fa-copy"></i> Copiar telefones</button><button class="btn btn-secondary" id="download-members-csv"><i class="fas fa-download"></i> Baixar CSV</button><button class="btn btn-primary" id="save-members-crm"><i class="fas fa-database"></i> Salvar no CRM</button></div>`;
    document.getElementById('copy-active-members')?.addEventListener('click', () => { const phones = this.activeLeads().map(l => l.phone); if (!phones.length) { this.app.showToast('Nenhum telefone disponível no filtro atual.', 'warning'); return; } navigator.clipboard.writeText(phones.join('\n')); this.app.showToast(`${phones.length} telefones copiados!`, 'success'); });
    document.getElementById('save-members-crm')?.addEventListener('click', () => this.showCRMImportModal());
    document.getElementById('download-members-csv')?.addEventListener('click', () => this.downloadMembersCSV());
  }

  showCRMImportModal() {
    const modal = document.createElement('div'); modal.className = 'modal-overlay open';
    modal.innerHTML = `<div class="modal"><div class="modal-header"><h3 class="modal-title"><i class="fas fa-database"></i> Enviar participantes ao CRM</h3><button class="modal-close">&times;</button></div><div class="modal-body"><p style="margin-bottom:12px">Serão enviados <strong>${this.activeLeads().length}</strong> participantes do filtro atual (com telefone disponível) de <strong>${this.escapeHtml(this.selectedGroup?.name || '')}</strong>.</p><label class="form-label">Estágio do CRM</label><select class="form-select" id="crm-import-stage" style="margin:6px 0 14px"><option value="novo">Novo</option><option value="contatado">Contatado</option><option value="qualificado">Qualificado</option><option value="proposta">Proposta</option><option value="fechado">Fechado</option><option value="perdido">Perdido</option></select><label class="form-label">Etiquetas personalizadas</label><input class="form-input" id="crm-import-tags" placeholder="Ex.: grupo-vip, campanha-outubro, cliente-potencial"><small class="text-muted">Separe várias etiquetas por vírgula.</small><div class="btn-group" style="margin-top:18px;justify-content:flex-end"><button class="btn btn-secondary modal-cancel">Cancelar</button><button class="btn btn-primary" id="confirm-crm-import"><i class="fas fa-save"></i> Enviar ao CRM</button></div></div></div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove(); modal.querySelector('.modal-close')?.addEventListener('click', close); modal.querySelector('.modal-cancel')?.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.querySelector('#confirm-crm-import')?.addEventListener('click', async () => {
      const stage = modal.querySelector('#crm-import-stage').value; const tags = modal.querySelector('#crm-import-tags').value.split(',').map(t => t.trim()).filter(Boolean);
      const leads = this.activeLeads({ stage, tags });
      const r = await this.app.api.saveLeads(leads, 'whatsapp_group'); close();
      if (r.success) { const d = r.data || {}; this.app.showToast(`CRM: ${d.added ?? leads.length} novos, ${d.updated ?? 0} já existiam (atualizados). Abrindo o CRM...`, 'success'); setTimeout(() => this.app.router.navigate('crm'), 900); }
      else this.app.showToast(r.error || 'Erro ao salvar', 'error');
    });
  }

  activeLeads(extra = {}) {
    const seen = new Set();
    return this.filteredMembers().filter(m => normPhone(m.phone).length >= 8 && !seen.has(normPhone(m.phone)) && seen.add(normPhone(m.phone)))
      .map(m => ({ name: m.name || 'Sem nome', phone: normPhone(m.phone), source: 'whatsapp_group', groupName: this.selectedGroup.name, groups: [this.selectedGroup.name], isAdmin: !!m.isAdmin, perfil: m.isAdmin ? 'Admin' : 'Participante', situacao: m.isActive ? 'No grupo' : 'Saiu', participacao: this.speechLabel(m), mensagens: m.msgCount ?? 0, ultima_mensagem: m.lastMessageAt ? new Date(m.lastMessageAt).toISOString() : '', extractedAt: new Date().toISOString(), ...extra }));
  }

  async downloadMembersCSV() {
    const leads = this.activeLeads({ stage: 'novo' });
    if (!leads.length) { this.app.showToast('Nenhum participante com telefone no filtro atual para baixar.', 'warning'); return; }
    const safe = String(this.selectedGroup?.name || 'grupo').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'grupo';
    const r = await this.app.api.exportCSV(leads, `participantes_${safe}_${new Date().toISOString().slice(0, 10)}.csv`);
    this.app.showToast(r.success ? `${leads.length} participantes exportados em CSV.` : (r.error || 'Erro ao exportar'), r.success ? 'success' : 'error');
  }

  speechLabel(m) { if (!m.isActive) return m.leftReason === 'removido' ? 'Removido' : 'Saiu'; if (m.isSpeaker === undefined) return 'Não apurado'; return m.isSpeaker ? 'Falante' : 'Mudo'; }
  speechBadge(m) {
    if (!m.isActive) return `<span class="badge badge-danger" title="${this.escapeHtml(m.leftReason || '')}">${m.leftReason === 'removido' ? 'Removido' : 'Saiu'}${m.leftAt ? ' · ' + new Date(m.leftAt).toLocaleDateString('pt-BR') : ''}</span>`;
    if (m.isSpeaker === undefined) return '<span class="badge">Não apurado</span>';
    return m.isSpeaker ? '<span class="badge badge-success">Falante</span>' : '<span class="badge">Mudo</span>';
  }
  memberKey(m) { return m.phone ? `phone:${m.phone}` : `name:${String(m.name || '').trim().toLowerCase()}`; }
  escapeHtml(t) { const d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; }
  debounce(fn, delay) { let id; return (...args) => { clearTimeout(id); id = setTimeout(() => fn.apply(this, args), delay); }; }
}
