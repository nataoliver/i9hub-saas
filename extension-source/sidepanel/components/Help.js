/**
 * Help — Central de Tutorial e Ajuda (v5.3.3)
 *
 * Central lateral com trilha inicial, atalhos para o perfil do negócio/CRM/WhatsApp,
 * pesquisa local, biblioteca por assunto e respostas passo a passo.
 *
 * A busca roda 100% local (sem internet, sem enviar nada): normaliza acentos, ignora palavras
 * comuns ("como", "posso", "de"...) e pontua título, palavras-chave e texto da resposta.
 */
import { SECTIONS, TOPICS, QUICK } from "../utils/helpData.js";
import { siteUrl, creditHTML } from "../utils/brand.js";

const STOP = new Set(("a o as os um uma uns umas de da do das dos em no na nos nas por para pra com sem sobre e ou que qual quais " +
  "como onde quando porque pq eu me meu minha meus minhas voce vc posso consigo quero preciso gostaria fazer faco usar uso " +
  "isso isto esse essa este esta ao aos se sua seu tem ter ser esta estao foi sao tela funcao funciona onde fica serve servem existe").split(" "));

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/<[^>]+>/g, " ").replace(/[^a-z0-9_{}| ]+/g, " ").replace(/\s+/g, " ").trim();
const stem = (w) => w.replace(/(mente|coes|cao|oes|ando|endo|indo|ar|er|ir|s)$/, "");
const tokens = (q) => norm(q).split(" ").filter((w) => w.length > 1 && !STOP.has(w));

// Sinônimos comuns para quem usa outras palavras
const SYN = { zap: "whatsapp", wpp: "whatsapp", whats: "whatsapp", planilha: "csv", excel: "csv", nuvem: "drive", cadastro: "lead", contato: "lead",
  contatos: "leads", cliente: "lead", clientes: "leads", disparo: "campanha", disparar: "campanha", mensagem: "campanha", cobrar: "licenca",
  pagar: "licenca", senha: "diagnostico", sumiu: "problema", bug: "problema", erro: "problema", travou: "parou", baixar: "exportar",
  segmento: "perfil", nicho: "perfil", setor: "perfil", imobiliaria: "perfil", corretor: "perfil", contador: "perfil", contabilidade: "perfil",
  dentista: "perfil", odontologia: "perfil", advogado: "perfil", advocacia: "perfil", roupas: "perfil", personalizar: "personalizado",
  classificar: "classificacao", classificacao: "classificacao", oportunidade: "privadas", oportunidades: "privadas", conversa: "privadas", conversas: "privadas", spam: "tipo", funil: "estagio" };

export class Help {
  constructor(app) { this.app = app; this.el = null; this.prevFocus = null; this.open = false; this._onKey = (e) => this.onKey(e); }

  // ------------------------------------------------------------------ botão no menu
  init() {
    const tools = document.querySelector(".sidebar-tools");
    if (tools && !document.getElementById("help-btn")) {
      const b = document.createElement("button");
      b.type = "button"; b.id = "help-btn"; b.className = "btn btn-sm btn-primary help-launch";
      b.title = "Central de ajuda: trilhas, tutoriais e pesquisa (F1)"; b.textContent = "📚 Tutorial e Ajuda";
      b.addEventListener("click", () => this.toggle());
      tools.insertBefore(b, tools.firstChild);
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "F1") { e.preventDefault(); this.toggle(); }
    });
  }

  // ------------------------------------------------------------------ abrir / fechar
  toggle() { this.open ? this.close() : this.show(); }

  show(query = "") {
    if (this.open) { if (query) this.ask(query); return; }
    this.open = true; this.prevFocus = document.activeElement;
    const el = document.createElement("aside");
    el.className = "i9-help"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Tutorial e Ajuda");
    el.innerHTML = `
      <div class="i9-help-backdrop" data-h="close"></div>
      <section class="i9-help-panel">
        <header class="i9-help-head">
          <div><h2>📚 Tutorial e Ajuda</h2><p>Trilhas práticas, tutoriais por assunto e busca em linguagem simples.</p></div>
          <button type="button" class="i9-help-x" data-h="close" aria-label="Fechar ajuda">✕</button>
        </header>
        <form class="i9-help-search" id="help-form" autocomplete="off">
          <input type="search" id="help-q" placeholder="Ex.: configurar perfil imobiliário, classificar lead..." aria-label="Pesquisar ou perguntar" maxlength="160">
          <button type="submit" class="btn btn-primary btn-sm">Perguntar</button>
        </form>
        <div class="i9-help-chips" id="help-chips">${QUICK.map((q) => `<button type="button" class="chip chip-sm" data-q="${q}">${q}</button>`).join("")}</div>
        <div class="i9-help-body" id="help-body" tabindex="0"></div>
        <footer class="i9-help-foot">
          <div class="i9-help-foot-actions">
            <button type="button" class="btn btn-sm btn-primary" data-go='{"route":"business-profile"}'>🧩 ${this.app.businessProfile?.configured ? "Abrir meu perfil" : "Configurar meu negócio"}</button>
            <button type="button" class="btn btn-sm btn-secondary" data-h="tour">▶ Ver apresentação guiada</button>
          </div>
          ${creditHTML("ajuda")}
        </footer>
      </section>`;
    document.body.appendChild(el);
    this.el = el;
    el.addEventListener("click", (e) => this.onClick(e));
    el.querySelector("#help-form").addEventListener("submit", (e) => { e.preventDefault(); this.ask(el.querySelector("#help-q").value); });
    el.querySelector("#help-q").addEventListener("input", (e) => { if (!e.target.value.trim()) this.renderIndex(); });
    document.addEventListener("keydown", this._onKey, true);
    requestAnimationFrame(() => el.classList.add("on"));
    if (query) { el.querySelector("#help-q").value = query; this.ask(query); } else this.renderIndex();
    setTimeout(() => el.querySelector("#help-q")?.focus({ preventScroll: true }), 260);
  }

  close() {
    if (!this.el) return;
    const el = this.el; this.el = null; this.open = false;
    document.removeEventListener("keydown", this._onKey, true);
    el.classList.remove("on");
    setTimeout(() => el.remove(), 260);
    try { this.prevFocus?.focus?.(); } catch { /* ignora */ }
  }

  onKey(e) { if (this.el && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.close(); } }

  // ------------------------------------------------------------------ cliques
  onClick(e) {
    const t = e.target.closest("[data-h],[data-q],[data-topic],[data-go]");
    if (!t) return;
    if (t.dataset.q) { this.el.querySelector("#help-q").value = t.dataset.q; this.ask(t.dataset.q); return; }
    if (t.dataset.topic) { this.showTopic(t.dataset.topic); return; }
    if (t.dataset.go) { this.go(JSON.parse(t.dataset.go)); return; }
    const h = t.dataset.h;
    if (h === "close") this.close();
    else if (h === "index") { this.el.querySelector("#help-q").value = ""; this.renderIndex(); }
    else if (h === "tour") { this.close(); setTimeout(() => this.app.tour?.start(), 280); }
  }

  go({ route, tab }) {
    this.close();
    if (route) this.app.router.navigate(route);
    if (tab) setTimeout(() => this.app.views.settings?.switchTab?.(tab), 450);
  }

  // ------------------------------------------------------------------ busca
  search(query) {
    const qt = tokens(query).map((w) => SYN[w] || w);
    if (!qt.length) return [];
    const qs = qt.map(stem).filter((w) => w.length > 1);
    // casa por palavra (início da palavra), não por pedaço: "tema" não deve achar "sistema"
    const hit = (hay, w, sw) => hay.split(" ").some((x) => x === w || (sw.length >= 3 && x.startsWith(sw)) || (x.length >= 4 && stem(x).length >= 4 && sw.startsWith(stem(x))));
    const scored = TOPICS.map((t) => {
      const title = norm(t.title), kw = norm(t.kw), body = norm([t.a, ...(t.steps || []), t.tip || ""].join(" "));
      let score = 0; let matched = 0;
      qt.forEach((w, i) => {
        const sw = qs[i]; let s = 0;
        if (hit(title, w, sw)) s += 5;
        if (hit(kw, w, sw)) s += 4;
        if (hit(body, w, sw)) s += 1.5;
        if (s) matched++; score += s;
      });
      if (score) score += (t.boost || 0);
      if (matched === qt.length && qt.length > 1) score += 4;      // casou todas as palavras
      if (norm(t.title).includes(norm(query)) && norm(query).length > 3) score += 6;
      return { t, score, matched };
    }).filter((r) => r.score >= 4 && r.matched >= (qt.length >= 3 ? 2 : 1)).sort((a, b) => b.score - a.score);
    return scored.map((r) => r.t);
  }

  ask(query) {
    query = String(query || "").trim();
    if (!query) { this.renderIndex(); return; }
    const res = this.search(query);
    const body = this.el.querySelector("#help-body");
    if (!res.length) {
      body.innerHTML = `<div class="i9-help-empty"><div class="i9-help-big">🤔</div>
        <h3>Não encontrei uma resposta exata</h3>
        <p>Tente outras palavras (ex.: <i>perfil</i>, <i>imobiliária</i>, <i>CRM</i>, <i>WhatsApp privado</i>, <i>Spam</i> ou <i>Drive</i>) ou escolha um assunto abaixo.</p>
        <div class="i9-help-chips">${QUICK.map((q) => `<button type="button" class="chip chip-sm" data-q="${q}">${q}</button>`).join("")}</div>
        <p class="i9-help-small">Ainda com dúvida? Veja o <a href="${siteUrl("ajuda_sem_resposta")}" target="_blank" rel="noopener noreferrer">site i9ads.com.br</a> ou fale com o suporte pelo ícone da extensão.</p>
        <button type="button" class="btn btn-sm btn-secondary" data-h="index">Ver todos os assuntos</button></div>`;
      return;
    }
    const [best, ...more] = res;
    body.innerHTML = `<div class="i9-help-q">Sua pergunta: <b>${this.esc(query)}</b></div>` + this.topicHTML(best, true) +
      (more.length ? `<h4 class="i9-help-sub">Veja também</h4><ul class="i9-help-list">${more.slice(0, 5).map((t) => `<li><button type="button" data-topic="${t.id}"><span>${t.icon}</span> ${t.title}</button></li>`).join("")}</ul>` : "") +
      `<button type="button" class="btn btn-sm btn-secondary" data-h="index">← Todos os assuntos</button>`;
    body.scrollTop = 0;
  }

  // ------------------------------------------------------------------ telas
  renderIndex() {
    const body = this.el?.querySelector("#help-body"); if (!body) return;
    const profile = this.app.businessProfile;
    const configured = !!profile?.configured;
    const profileName = configured ? this.esc(profile.name || "Perfil personalizado") : "Ainda não configurado";
    const sections = SECTIONS.map((s) => `<details class="i9-help-sec" ${s.id === "start" || (!configured && s.id === "business") ? "open" : ""}><summary><span>${s.icon}</span> ${s.title}</summary>
        <ul class="i9-help-list">${TOPICS.filter((t) => t.sec === s.id).map((t) => `<li><button type="button" data-topic="${t.id}"><span>${t.icon}</span> ${t.title}</button></li>`).join("")}</ul></details>`).join("");
    body.innerHTML = `
      <section class="i9-help-home">
        <div class="i9-help-welcome">
          <span class="i9-help-kicker">CENTRAL DE APRENDIZADO</span>
          <h3>Vamos colocar seu CRM para trabalhar</h3>
          <p>Siga a trilha recomendada ou abra só o assunto que precisa. As respostas são pesquisadas localmente; sua pergunta não é enviada para um serviço externo.</p>
          <div class="i9-help-profile-state ${configured ? "configured" : "not-configured"}">
            <span class="i9-help-profile-icon">${configured ? "✓" : "1"}</span>
            <div><strong>${configured ? "Perfil ativo: " + profileName : "Primeiro passo: configure seu negócio"}</strong><small>${configured ? "Você pode rever ou personalizar o perfil quando quiser." : "Escolha um segmento ou responda às perguntas para receber sugestões adequadas."}</small></div>
          </div>
        </div>
        <div class="i9-help-section-heading"><span>Comece por aqui</span><small>Recomendado para a primeira utilização</small></div>
        <div class="i9-help-start-grid">
          <button type="button" class="i9-help-start-card primary" data-go='{"route":"business-profile"}'><span class="i9-help-start-icon">🧩</span><strong>${configured ? "Rever meu perfil" : "1. Configurar meu negócio"}</strong><small>Segmento, perguntas e sugestões para o CRM</small><span class="i9-help-card-link">Abrir Meu negócio →</span></button>
          <button type="button" class="i9-help-start-card" data-topic="crm-visao"><span class="i9-help-start-icon">🗂️</span><strong>2. Aprender o CRM</strong><small>Estágios, Kanban, fichas e filtros</small><span class="i9-help-card-link">Ver tutorial →</span></button>
          <button type="button" class="i9-help-start-card" data-topic="private-opportunities"><span class="i9-help-start-icon">📲</span><strong>3. Sincronizar WhatsApp</strong><small>Transformar conversas privadas em oportunidades</small><span class="i9-help-card-link">Ver como fazer →</span></button>
          <button type="button" class="i9-help-start-card" data-topic="crm-classificacao"><span class="i9-help-start-icon">🏷️</span><strong>4. Classificar contatos</strong><small>Separar Spam, Prospectos, Clientes e pendentes</small><span class="i9-help-card-link">Aprender classificação →</span></button>
        </div>
        <div class="i9-help-path">
          <strong>Trilha sugerida</strong>
          <ol><li>Configure o perfil do negócio.</li><li>Conecte o WhatsApp e sincronize as conversas privadas.</li><li>Revise estágios e tipos no CRM.</li><li>Faça uma campanha pequena com contatos apropriados.</li><li>Configure seu backup em Dados.</li></ol>
        </div>
        <div class="i9-help-section-heading"><span>Biblioteca de tutoriais</span><small>${TOPICS.length} assuntos</small></div>
        <p class="i9-help-intro">Abra uma categoria ou pesquise acima. Cada artigo explica o que é, como usar e, quando disponível, oferece um atalho para a tela correspondente.</p>
        ${sections}
      </section>`;
    body.scrollTop = 0;
  }

  showTopic(id) {
    const t = TOPICS.find((x) => x.id === id); if (!t) return;
    const body = this.el.querySelector("#help-body");
    body.innerHTML = `<button type="button" class="btn btn-sm btn-secondary i9-help-back" data-h="index">← Todos os assuntos</button>` + this.topicHTML(t, false);
    body.scrollTop = 0;
  }

  topicHTML(t, best) {
    const sec = SECTIONS.find((s) => s.id === t.sec);
    return `<article class="i9-help-card ${best ? "best" : ""}">
      <div class="i9-help-tag">${sec ? sec.icon + " " + sec.title : ""}</div>
      <h3>${t.icon} ${t.title}</h3>
      <p>${t.a}</p>
      ${t.steps ? `<ol class="i9-help-steps">${t.steps.map((s) => `<li>${s}</li>`).join("")}</ol>` : ""}
      ${t.tip ? `<div class="i9-help-tip">💡 <span>${t.tip}</span></div>` : ""}
      ${t.go ? `<button type="button" class="btn btn-sm btn-primary" data-go='${JSON.stringify({ route: t.go.route, tab: t.go.tab || "" })}'>${t.go.label} →</button>` : ""}
    </article>`;
  }

  esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
}
