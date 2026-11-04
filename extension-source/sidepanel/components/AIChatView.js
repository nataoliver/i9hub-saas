const PROVIDER_DEFAULTS = {
  openai: '',
  anthropic: '',
  gemini: '',
  openrouter: '',
  '8token': '',
  '9router': '',
  custom: '',
};
const PROVIDER_META = {
  openai: {
    label: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys', keyPage: 'OpenAI Platform',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    instructions: 'Na página da OpenAI, crie uma secret key, copie-a e volte para esta aba. O acesso à API e a cobrança são gerenciados separadamente da assinatura do ChatGPT.',
  },
  anthropic: {
    label: 'Anthropic / Claude', keyUrl: 'https://console.anthropic.com/settings/keys', keyPage: 'Console da Anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    instructions: 'No Console da Anthropic, crie uma chave de API e copie-a. Confira se a conta tem acesso à API e faturamento configurado.',
  },
  gemini: {
    label: 'Google Gemini', keyUrl: 'https://aistudio.google.com/app/apikey', keyPage: 'Google AI Studio',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{modelo-selecionado}:generateContent',
    instructions: 'No Google AI Studio, crie ou selecione uma chave de API, copie-a e volte para esta aba. A disponibilidade de uso gratuito e os limites dependem da conta, do modelo e da região.',
  },
  openrouter: {
    label: 'OpenRouter', keyUrl: 'https://openrouter.ai/keys', keyPage: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    instructions: 'No OpenRouter, crie uma chave e escolha um modelo compatível. Alguns modelos têm cota gratuita, mas disponibilidade e limites variam.',
  },
  '8token': {
    label: '8Token Gateway', keyUrl: 'https://8token.tech/painel', keyPage: 'Painel 8Token',
    endpoint: 'https://8token.tech/v1',
    instructions: 'No painel do 8Token, copie sua chave (8tk_...) e o endpoint https://8token.tech/v1. Você pode carregar os modelos disponíveis ou informar o nome do modelo.',
  },
  '9router': {
    label: '9Router Proxy', keyUrl: 'http://localhost:20128/dashboard', keyPage: '9Router Dashboard',
    endpoint: 'http://localhost:20128/v1',
    instructions: 'No painel do 9Router (ex.: http://localhost:20128/dashboard), copie sua API Key (sk-...) e o endpoint local ou túnel HTTPS.',
  },
  custom: {
    label: 'Outro (compatível com OpenAI)', keyUrl: '', keyPage: '', endpoint: '',
    instructions: 'Informe o endpoint (HTTPS ou http://localhost) e carregue a lista de modelos ou digite o nome exato do modelo fornecido pelo serviço.',
  },
};
const DEFAULT_BUSINESS_NAME = 'Minha empresa';
const DEFAULT_PROMPT = 'Você é o atendente comercial virtual da empresa. Responda em português brasileiro, de forma cordial, clara e natural. Use o histórico recente para manter o contexto e não repita perguntas já respondidas. Faça uma pergunta de qualificação por vez, entenda a necessidade e o prazo do cliente e registre apenas informações sustentadas pela conversa. Nunca invente preços, estoque, prazos, descontos, políticas ou características. Se não souber uma informação específica, diga que vai confirmar com uma pessoa da equipe. Se o cliente pedir atendimento humano, encaminhe a conversa e não insista. Seja breve e não envie mensagens repetidas.';
const DEFAULT_KNOWLEDGE = 'Nenhum catálogo de produtos, serviços ou tabela de preços foi informado ainda. Não invente preços, estoque, prazos, descontos nem políticas. Faça perguntas para entender a necessidade e encaminhe dúvidas específicas a uma pessoa da equipe.';
const AI_PERSONA_TEMPLATES = {
  networking: {
    mode: 'networking',
    name: 'Networking e parcerias', description: 'Criar conexão genuína, conhecer a atuação e identificar afinidades sem transformar a conversa em venda.', businessName: 'Comunidade / Networking',
    prompt: `Você é um assistente de relacionamento focado em networking genuíno, troca de experiências e construção de vínculos respeitosos. Seu objetivo principal é conhecer a pessoa, compreender sua atuação, seus interesses, projetos e desafios, e descobrir afinidades ou possibilidades de colaboração sem forçar uma venda.

COMO CONVERSAR
- Leia todo o histórico recente e responda primeiro ao que a pessoa realmente disse. Demonstre atenção a um detalhe concreto da mensagem, sem exagerar nos elogios.
- Seja caloroso, curioso, respeitoso e natural, com linguagem brasileira simples. Use emojis com moderação, quando combinarem com o contexto.
- Faça no máximo uma pergunta por mensagem. Alterne perguntas com comentários úteis; não transforme o papo em entrevista.
- Descubra aos poucos o nicho de atuação, o público atendido, os projetos, os interesses e os desafios. Não tente coletar tudo de uma vez.
- Se a pessoa compartilhar algo pessoal ou difícil, acolha o que ela contou e acompanhe o assunto dela. Não mude abruptamente para negócios, anúncios, CRM ou oferta comercial.
- Não apresente nem ofereça serviços do criador do CRM a menos que a pessoa pergunte diretamente ou manifeste interesse claro. Não trate a conversa como uma etapa de funil de vendas.
- Respeite respostas curtas, silêncio, limites e pedidos para encerrar. Se a pessoa não quiser conversar, agradeça e não insista.
- Nunca invente experiências pessoais, sentimentos, memórias ou uma identidade humana. Não diga que viveu algo que não viveu; se perguntarem, seja transparente sobre ser um assistente virtual.
- Não prometa amizade, parceria ou resultados. Uma parceria só deve ser sugerida quando houver afinidade concreta e de forma leve.

OBJETIVO DE REGISTRO
Ajude a identificar o nicho principal, subnicho, profissão/atividade, interesses e possíveis temas de afinidade, somente quando houver evidências na conversa. Não classifique a pessoa como lead comercial qualificado apenas por participar do diálogo.`,
    knowledge: 'Este perfil é destinado a networking, relacionamento e descoberta respeitosa de afinidades. Priorize conhecer a atuação, os projetos, os interesses e os desafios da pessoa. Não há oferta comercial ou tabela de preços vinculada a este perfil. Não invente informações sobre o criador, a comunidade ou possíveis parcerias. Se perguntarem sobre serviços comerciais, responda apenas com informações confirmadas e sem pressionar.',
    welcomeMessage: 'Olá! Tudo bem? Gosto de conhecer pessoas, suas histórias e o que estão construindo. Me conta: com o que você tem se envolvido ultimamente?',
    qualificationEnabled: false, qualifiedStage: 'qualificado', qualificationThreshold: 0.8,
    qualificationCriteria: 'Este perfil é de networking, não de pré-venda. Registre nicho, subnicho, atividade, interesses, projetos e afinidades apenas quando sustentados pela conversa. Não classifique como lead comercial qualificado por curiosidade, cordialidade ou participação no grupo.'
  },
  self_knowledge: {
    mode: 'self_knowledge',
    name: 'Autoconhecimento e acolhimento', description: 'Escuta cuidadosa e perguntas reflexivas, sem diagnóstico ou abordagem comercial.', businessName: 'Espaço de reflexão',
    prompt: `Você é um assistente de conversa reflexiva com foco em autoconhecimento, clareza pessoal e escuta respeitosa. Seu papel é ajudar a pessoa a organizar pensamentos e explorar o que ela própria deseja compreender, sem se apresentar como psicólogo, terapeuta ou profissional de saúde.

COMO CONVERSAR
- Leia o histórico antes de responder e reconheça o sentimento ou a ideia que a pessoa compartilhou, sem presumir que sabe exatamente como ela se sente.
- Use linguagem acolhedora, calma e simples. Não responda com frases prontas, elogios exagerados ou positividade forçada.
- Faça uma pergunta aberta e gentil por vez. Dê espaço para a pessoa pensar; não transforme a conversa em interrogatório nem tente resolver tudo imediatamente.
- Ajude a explorar valores, necessidades, escolhas, limites, hábitos e próximos passos pequenos, sem dizer à pessoa o que ela deve fazer.
- Não diagnostique, não prescreva tratamentos e não faça afirmações clínicas. Não minimize sofrimento, dependência, problemas financeiros ou conflitos familiares.
- Não use vulnerabilidades pessoais para vender produtos, serviços, anúncios ou ferramentas. Só fale de negócios se a própria pessoa levar a conversa para esse assunto.
- Não invente vivências pessoais nem finja ser humano. Se perguntarem, seja transparente que é um assistente virtual.
- Respeite limites, respostas curtas e o desejo de parar. Se surgir risco imediato de autoagressão, violência ou perigo, priorize segurança e incentive contato imediato com uma pessoa de confiança e serviços de emergência locais.
- Seja breve, presente e específico: uma resposta atenta vale mais do que um texto longo cheio de conselhos.`,
    knowledge: 'Este perfil oferece apenas conversa reflexiva geral e não substitui acompanhamento psicológico, médico ou outro cuidado profissional. Não há serviços comerciais a oferecer neste contexto. Não diagnostique nem prometa resultados. Em situações sensíveis, acolha sem pressionar e incentive apoio humano ou profissional apropriado.',
    welcomeMessage: 'Oi! Que bom ter você por aqui. Se fizer sentido para você, me conta: o que tem ocupado mais seus pensamentos nos últimos dias?',
    qualificationEnabled: false, qualifiedStage: 'qualificado', qualificationThreshold: 0.8,
    qualificationCriteria: 'Não aplicar qualificação comercial neste perfil. Se houver contexto profissional compartilhado espontaneamente, registre atividade ou nicho apenas quando houver evidência explícita. Não inferir intenção de compra a partir de relatos pessoais ou vulnerabilidade.'
  },
  commercial: {
    mode: 'commercial',
    name: 'Prospecção comercial consultiva', description: 'Entender o negócio, gerar confiança e avaliar oportunidade sem pressionar.', businessName: 'Minha empresa',
    prompt: `Você é um assistente comercial consultivo. Seu objetivo é criar uma conversa agradável e útil, entender o negócio e as prioridades do contato e, somente quando houver contexto e interesse, avaliar se existe uma oportunidade comercial real.

COMO CONVERSAR
- Comece respondendo ao que a pessoa disse; não ignore sua mensagem para seguir um roteiro. Demonstre curiosidade real pelo negócio e reconheça detalhes concretos, sem bajulação.
- Leia o histórico e nunca repita perguntas respondidas. Faça apenas uma pergunta por mensagem e avance gradualmente.
- Descubra o que a pessoa faz, para quem trabalha, seu nicho e o que está tentando melhorar. Não peça orçamento antes de entender a necessidade.
- Não transforme toda resposta em uma oferta. Construa contexto e conexão primeiro; fale sobre os serviços da empresa quando a pessoa perguntar ou quando houver uma ligação clara com a necessidade mencionada.
- Se fizer sentido avaliar contratação, investigue interesse, prazo e orçamento com naturalidade. Explique que verba de anúncios é separada dos honorários de gestão quando isso for relevante.
- Se não houver orçamento ou intenção agora, respeite o momento e encerre sem pressionar. Não classifique curiosidade como oportunidade qualificada.
- Nunca invente preços, resultados, garantias, clientes, depoimentos ou informações da empresa. Se não souber, diga que a equipe pode confirmar.
- Seja breve, humano no tom, claro e transparente. Não finja ser uma pessoa real nem invente experiências pessoais.`,
    knowledge: 'Serviço principal: gestão de tráfego pago para empresas e profissionais que desejam divulgar serviços e gerar oportunidades comerciais. Plataformas possíveis: Meta Ads (Facebook e Instagram) e Google Ads. O orçamento de mídia é separado dos honorários de gestão. Para esta oferta, o orçamento mínimo desejado é de R$ 1.000 por mês diretamente nas plataformas. Os honorários devem ser informados apenas conforme tabela oficial ou proposta da equipe. Não prometa resultados garantidos nem invente preços.',
    welcomeMessage: 'Olá! Tudo bem? Vi que podemos trocar algumas ideias sobre o seu trabalho. Me conta: com o que você atua hoje?',
    qualificationEnabled: true, qualifiedStage: 'qualificado', qualificationThreshold: 0.8,
    qualificationCriteria: 'Qualifique somente quando houver evidências de negócio ativo, interesse real em anunciar, orçamento explícito de pelo menos R$ 1.000 mensais para mídia além dos honorários, prazo razoável e intenção concreta de avançar. Se orçamento ou intenção forem desconhecidos, mantenha inconclusivo. Se estiver sem verba agora, classifique como nutrição, sem pressão.'
  }
};
const DEFAULT_STAGES = [
  { id: 'novo', title: 'Novo' }, { id: 'contatado', title: 'Contatado' },
  { id: 'qualificado', title: 'Qualificado' }, { id: 'proposta', title: 'Proposta' },
  { id: 'fechado', title: 'Fechado' }, { id: 'perdido', title: 'Perdido' },
];

// v1.1.3 - motivo real de cada mensagem recebida (antes o painel só mostrava erros).
const AI_PROCESSING_LABELS = {
  processed: 'respondida com sucesso',
  observed: 'analisada; informações atualizadas no CRM (sem resposta enviada)',
  'observer-no-change': 'analisada; nenhuma informação nova para o CRM',
  'license-blocked-observer': 'bloqueada: a licença não libera a IA observadora',
  'observer-persona-not-supported': 'bloqueada: IA observadora não é permitida no perfil de autoconhecimento',
  'reply-pending': 'resposta gerada, mas o envio ao WhatsApp não foi confirmado',
  paused: 'ignorada: atendimento pausado',
  'panel-not-open': 'ignorada: painel do i9Hub não detectado (mantenha esta tela aberta)',
  'license-blocked': 'ignorada: a licença não libera o Chat com IA',
  'invalid-message': 'ignorada: mensagem sem texto, nome ou identificador válido',
  'chat-type-disabled': 'ignorada: este tipo de conversa (privada ou grupo) está desativado em "Onde a IA pode responder"',
  'group-trigger-required': 'ignorada: o gatilho configurado para grupos não foi atendido',
  'group-not-selected': 'ignorada: este grupo não está autorizado na seleção atual',
  'group-excluded': 'ignorada: este grupo foi excluído da lista autorizada',
  'group-keywords-empty': 'ignorada: o modo por palavras-chave está ativo, mas nenhuma palavra-chave foi configurada',
  'human-handoff-active': 'ignorada: conversa em atendimento humano',
  duplicate: 'ignorada: mensagem já processada',
  'duplicate-in-flight': 'ignorada: mensagem já está sendo processada',
  'duplicate-content': 'ignorada: texto idêntico recebido segundos antes',
  'rate-limited': 'ignorada: limite de mensagens por conversa atingido',
  'rate-limit-storage-error': 'falha ao controlar o limite de mensagens',
  'configuration-incomplete': 'ignorada: configuração incompleta (empresa, instruções, base de conhecimento ou teste do provedor)',
  error: 'falha no processamento',
};
const AI_PROCESSING_PROBLEMS = new Set(['reply-pending', 'panel-not-open', 'license-blocked', 'license-blocked-observer', 'observer-persona-not-supported', 'invalid-message', 'configuration-incomplete', 'rate-limit-storage-error', 'error']);

export class AIChatView {
  constructor(app, options = {}) { this.app = app; this.forcedMode = options.mode; this.config = {}; this.status = {}; this.fallbackCounter = 0; this.modelCatalogReady = false; this.availableGroups = []; this.groupsLoaded = false; this.selectedGroupIds = new Set(); this.groupPersonaAssignments = {}; this.savedFormSnapshot = ''; this.configDirty = false; this.syncNotice = ''; this.syncNoticeKind = 'info'; this.aiPersonas = []; this.activePersonaId = ''; this.savedActivePersonaId = ''; this.personaMigrationPending = false; }

  onLeave() {
    if (this.statusPollTimer) clearInterval(this.statusPollTimer);
    this.statusPollTimer = null;
    this.activeContainer = null;
  }

  async render(container) {
    // Limpa qualquer timer de outra instância de AIChatView (Atendimento / Observador) para nunca alternar na mesma tela
    if (this.app?.views) {
      for (const v of Object.values(this.app.views)) {
        if (v && v.statusPollTimer) {
          clearInterval(v.statusPollTimer);
          v.statusPollTimer = null;
        }
      }
    }
    if (this.statusPollTimer) clearInterval(this.statusPollTimer);
    this.activeContainer = container;
    container.innerHTML = this.getHTML();
    this.bindEvents();
    await this.load();
    this.statusPollTimer = setInterval(async () => {
      const expectedRoute = this.forcedMode === 'observe_only' ? 'ai-observer' : 'ai-chat';
      if (this.app?.router?.currentRoute && this.app.router.currentRoute !== expectedRoute) {
        clearInterval(this.statusPollTimer);
        this.statusPollTimer = null;
        return;
      }
      if (!document.getElementById('ai-chat-state-badge')) { clearInterval(this.statusPollTimer); this.statusPollTimer = null; return; }
      try { const r = await this.app.api.sendMessage('AI_GET_STATUS'); if (r?.success) { this.status = r.data || {}; this.renderStatus(); this.renderHistoryUI({ ...this.config, ...this.status }); } } catch { /* a próxima consulta tentará novamente */ }
    }, 5000);
  }

  getHTML() {
    return `<section class="i9-product-view ai-view" data-feature="whatsapp.ai_support">
      <header class="view-header"><div><p class="i9-eyebrow">i9HUB 1.0.0 · INTELIGÊNCIA ARTIFICIAL</p><h2><i class="fas fa-${this.forcedMode === "observe_only" ? "eye" : "robot"}"></i> ${this.forcedMode === "observe_only" ? "IA - Observador" : "IA - Atendimento"}</h2><p class="i9-subtitle">${this.forcedMode === "observe_only" ? "Apenas observa conversas para enriquecer os cards do CRM silenciosamente." : "Atenda conversas automaticamente usando provedores conectados."}</p></div><span id="ai-chat-state-badge" class="i9-state-pill is-off">Não conectado</span></header>
      <section id="ai-chat-status-banner" class="ai-status-banner is-off" role="status" aria-live="polite">
        <span class="ai-status-icon"><i id="ai-chat-status-icon" class="fas fa-circle-exclamation"></i></span>
        <div class="ai-status-main"><strong id="ai-chat-status-title">Verificando conexão da IA…</strong><p id="ai-chat-status-detail">Consultando provedor, WhatsApp e painel.</p><div class="ai-status-meta"><span id="ai-chat-status-wa">WhatsApp: verificando</span><span id="ai-chat-status-provider">Provedor: verificando</span><span id="ai-chat-status-last">Última atividade: —</span></div></div>
        <button type="button" class="btn btn-primary" id="ai-chat-toggle"><i class="fas fa-play"></i> Ativar Chat com IA</button>
      </section>
      <div class="i9-hero-card ai-hero"><div class="i9-hero-icon"><i class="fas fa-brain"></i></div><div><h3>Um atendimento que entende a conversa</h3><p>A IA usa as mensagens recentes da conversa para responder com contexto, identificar intenção comercial e registrar a qualificação no CRM quando os critérios configurados forem atendidos.</p></div></div>
      <div class="i9-info-strip"><i class="fas fa-shield-halved"></i><span>As chaves ficam no perfil local do Chrome. Se você definir uma senha de sincronização, elas poderão ser guardadas no Google Drive criptografadas; a senha nunca é enviada ao Drive. O texto e o contexto necessários são enviados ao provedor de IA selecionado.</span></div>
      <div class="i9-warning-card"><i class="fas fa-triangle-exclamation"></i><div><strong>Importante sobre o WhatsApp Web</strong><p>O atendimento depende do WhatsApp Web conectado, desta extensão e do painel aberto. É uma automação pela interface do WhatsApp Web, não pela API oficial; mudanças na interface ou suspensão do navegador podem interromper o funcionamento.</p></div></div>

      <article class="card" data-feature="whatsapp.ai_support.configure"><div class="card-title"><i class="fas fa-comments"></i> 1. Onde e quando a IA pode responder</div>
        <div class="form-row"><div class="form-group"><label class="form-label" for="ai-chat-mode">Tipo de conversa</label><select class="form-select" id="ai-chat-mode"><option value="private_only">Somente conversas privadas</option><option value="groups_only">Somente grupos</option><option value="both">Conversas privadas e grupos</option></select></div>
        <div class="form-group"><label class="form-label" for="ai-group-scope">Quais grupos podem acionar a IA?</label><select class="form-select" id="ai-group-scope"><option value="selected">Somente grupos selecionados (recomendado)</option><option value="all">Todos os grupos</option><option value="except_selected">Todos, exceto os grupos selecionados</option></select></div></div>
        <div class="ai-group-picker" id="ai-group-picker">
          <div class="ai-group-picker-toolbar"><div><strong>Grupos autorizados</strong><p class="text-muted">A lista é lida do WhatsApp Web conectado. Se não carregar, atualize o WhatsApp e tente novamente.</p></div><button type="button" class="btn btn-secondary" id="ai-groups-refresh"><i class="fas fa-rotate"></i> Atualizar grupos</button></div>
          <div class="form-row ai-group-search-row"><div class="form-group"><label class="form-label" for="ai-group-search">Pesquisar grupo</label><input class="form-input" id="ai-group-search" placeholder="Digite parte do nome do grupo"></div><div class="ai-group-bulk-actions"><button type="button" class="btn btn-ghost" id="ai-group-select-visible">Marcar visíveis</button><button type="button" class="btn btn-ghost" id="ai-group-clear-selection">Limpar seleção</button></div></div>
          <div id="ai-group-list" class="ai-group-list" role="group" aria-label="Grupos do WhatsApp"><div class="ai-group-list-empty">Clique em “Atualizar grupos” para carregar a lista real do WhatsApp.</div></div>
          <div id="ai-group-selection-count" class="i9-muted-note">Nenhum grupo selecionado.</div>
        </div>
        <div class="i9-inline-actions"><button type="button" class="btn btn-primary" id="ai-group-save"><i class="fas fa-floppy-disk"></i> Salvar regras de grupos</button><small class="text-muted">As regras só entram em vigor depois de salvar.</small></div>
        <div class="form-group"><label class="form-label" for="ai-group-trigger">Quando responder nos grupos permitidos</label><select class="form-select" id="ai-group-trigger"><option value="reply_or_mention">Quando mencionarem a conta OU responderem à mensagem da IA</option><option value="mention_only">Somente quando mencionarem a conta</option><option value="reply_only">Somente quando responderem à mensagem da IA</option><option value="all_messages">Todas as mensagens recebidas</option><option value="keywords">Somente quando houver palavras-chave</option></select></div>
        <div class="form-group" id="ai-group-keywords-wrap" hidden><label class="form-label" for="ai-group-keywords">Palavras-chave (separadas por vírgula ou linha)</label><textarea class="form-textarea" id="ai-group-keywords" rows="2" placeholder="Ex.: alguém pode ajudar, tenho uma dúvida, indicação"></textarea><small class="text-muted">A IA só será acionada quando a mensagem contiver pelo menos uma dessas expressões. Sem palavras-chave, o modo fica bloqueado por segurança.</small></div>
        <p class="i9-muted-note" id="ai-group-safety-note">Recomendado: selecione grupos específicos e use menção ou resposta à IA. “Todas as mensagens” pode gerar muitas respostas e deve ser usado com cautela.</p>
        <div class="form-group" style="max-width:360px"><label class="form-label" for="ai-chat-reply-delay">Pausa antes de enviar a resposta (segundos)</label><input class="form-input" id="ai-chat-reply-delay" type="number" min="0" max="10" step="0.5" value="1.5"><small class="text-muted">A pausa controla o tempo antes do envio e não simula uma pessoa digitando. Informe com transparência quando o atendimento for automatizado.</small></div>
      </article>

      <div class="i9-grid-2">
        <article class="card ai-provider-card" data-feature="whatsapp.ai_support.configure"><div class="card-title"><i class="fas fa-key"></i> 2. Conecte sua IA em poucos passos</div>
          <div class="form-row"><div class="form-group"><label class="form-label" for="ai-chat-provider">Escolha a IA</label><select class="form-select" id="ai-chat-provider"><option value="openai">OpenAI</option><option value="anthropic">Anthropic / Claude</option><option value="gemini">Google Gemini</option><option value="openrouter">OpenRouter</option><option value="8token">8Token (Gateway API)</option><option value="9router">9Router (Proxy Local / Remoto)</option><option value="custom">Outro (API compatível com OpenAI)</option></select></div><div class="form-group"><label class="form-label" id="ai-chat-model-label" for="ai-chat-model">Modelo disponível na sua chave</label><select class="form-select" id="ai-chat-model"><option value="">Cole sua chave e carregue os modelos disponíveis</option></select><input class="form-input" id="ai-chat-model-custom" placeholder="Nome exato do modelo informado pelo serviço" hidden><small class="text-muted" id="ai-chat-model-state">Cole a chave da API e clique em “Carregar modelos disponíveis”.</small></div></div>
          <div class="ai-provider-guide" id="ai-chat-provider-guide" aria-live="polite"><strong id="ai-chat-provider-guide-title">OpenAI</strong><p id="ai-chat-provider-guide-copy">Na página da OpenAI, crie uma secret key, copie-a e volte para esta aba. O acesso à API e a cobrança são gerenciados separadamente da assinatura do ChatGPT.</p><div class="ai-provider-guide-actions"><button type="button" class="btn btn-primary" id="ai-chat-create-key"><i class="fas fa-arrow-up-right-from-square"></i> Abrir página para criar chave</button><span class="ai-provider-guide-step">1. Crie e copie a chave · 2. Volte e cole abaixo · 3. Salve e teste</span></div></div>
          <div class="form-group" id="ai-chat-endpoint-wrap"><label class="form-label" for="ai-chat-endpoint">Endpoint da API (preenchido automaticamente)</label><input class="form-input" id="ai-chat-endpoint" placeholder="Será preenchido conforme a IA selecionada" readonly></div>
          <div class="form-group"><label class="form-label" for="ai-chat-key">Cole aqui a chave gerada pelo provedor</label><input class="form-input" id="ai-chat-key" type="password" autocomplete="off" placeholder="Cole sua chave de API aqui"><div class="i9-inline-actions"><button type="button" class="btn btn-secondary" id="ai-chat-load-models"><i class="fas fa-list-check"></i> Carregar modelos disponíveis</button><small class="text-muted" id="ai-chat-key-state">A chave fica salva localmente neste perfil do Chrome e não é exibida novamente.</small></div></div>
          <div class="btn-group i9-wrap-actions"><button class="btn btn-primary" id="ai-chat-test"><i class="fas fa-plug"></i> Salvar, autorizar e testar</button><button class="btn btn-ghost" id="ai-chat-clear-keys">Remover chaves</button></div>
          <p class="i9-muted-note">Escolha a IA, gere a chave na página oficial, cole-a e carregue os modelos disponíveis para essa chave. Selecione um modelo da lista e clique em “Salvar, autorizar e testar”. Para provedores personalizados, informe o modelo manualmente.</p>
        </article>
        <article class="card" data-feature="whatsapp.ai_support.configure"><div class="card-title"><i class="fas fa-arrows-rotate"></i> 3. Rodízio de provedores reserva</div>
          <p class="i9-muted-note">Adicione outros provedores ou modelos. Se o principal retornar limite de uso, cota esgotada ou erro temporário, o i9Hub tentará o próximo configurado.</p>
          <div id="ai-chat-fallback-list" class="ai-fallback-list"></div>
          <div class="i9-inline-actions"><button class="btn btn-secondary" id="ai-chat-add-fallback"><i class="fas fa-plus"></i> Adicionar provedor reserva</button><span class="i9-small-status" id="ai-chat-fallback-count">0 reservas</span></div>
          <small class="text-muted">Cada reserva precisa de modelo, chave e permissão de acesso ao domínio do provedor. O rodízio não cria créditos gratuitos; apenas tenta credenciais já cadastradas.</small>
        </article>
      </div>

      <article class="card ai-drive-sync-card" data-feature="drive.sync"><div class="card-title"><i class="fas fa-cloud-arrow-up"></i> Sincronização da IA entre computadores</div>
        <p class="i9-muted-note">As instruções, o modelo, o modo de atendimento e os critérios de qualificação são sincronizados com o Google Drive quando ele está conectado. As chaves API não são enviadas em texto aberto.</p>
        <div id="ai-chat-sync-status" class="status-badge warning" aria-live="polite">Verificando sincronização com o Google Drive…</div>
        <div class="form-row" style="align-items:end"><div class="form-group" style="flex:1"><label class="form-label" for="ai-chat-sync-passphrase">Senha para proteger as chaves API no Drive</label><input class="form-input" id="ai-chat-sync-passphrase" type="password" autocomplete="new-password" placeholder="Crie uma senha com pelo menos 10 caracteres"><small class="text-muted">Use a mesma senha nos computadores em que quiser restaurar as chaves. Ela fica salva apenas neste perfil do Chrome; nunca é enviada ao Google Drive.</small></div>
        <div class="form-group ai-sync-actions"><button type="button" class="btn btn-primary" id="ai-chat-sync-passphrase-save"><i class="fas fa-lock"></i> Salvar senha e sincronizar</button><button type="button" class="btn btn-ghost" id="ai-chat-sync-passphrase-clear">Esquecer senha neste computador</button></div></div>
      </article>

      <article class="card ai-personas-card" data-feature="whatsapp.ai_support.configure">
        <div class="card-title"><i class="fas fa-masks-theater"></i> 4. Personalidades e públicos da IA</div>
        <p class="i9-muted-note">Crie assistentes com objetivos diferentes sem misturar os prompts. O perfil global é usado como padrão; uma personalidade definida para um grupo ou campanha tem prioridade naquele contexto. Respostas privadas a campanhas usam o perfil escolhido por até 30 dias após o envio. Salve as alterações para ativar as regras.</p>
        <div class="form-row ai-persona-toolbar">
          <div class="form-group"><label class="form-label" for="ai-chat-persona-select">Perfil selecionado</label><select class="form-select" id="ai-chat-persona-select" aria-describedby="ai-chat-persona-status"></select></div>
          <div class="form-group"><label class="form-label" for="ai-chat-persona-template">Criar a partir de um modelo</label><select class="form-select" id="ai-chat-persona-template"><option value="networking">Networking e parcerias</option><option value="self_knowledge">Autoconhecimento e acolhimento</option><option value="commercial">Prospecção comercial consultiva</option></select></div>
        </div>
        <div class="form-group ai-persona-mode-field"><label class="form-label" for="ai-chat-persona-mode">Comportamento principal</label><select class="form-select" id="ai-chat-persona-mode"><option value="networking">Networking e conexão — sem abordagem comercial</option><option value="self_knowledge">Autoconhecimento — conversa reflexiva</option><option value="commercial">Comercial consultivo — qualificação de oportunidades</option></select><small class="text-muted">O modo orienta a IA além do prompt. Networking registra apenas dados profissionais relevantes; Autoconhecimento não grava reflexões pessoais no card do CRM nem faz qualificação comercial.</small></div>
        <div class="form-group ai-persona-operation-field"><label class="form-label" for="ai-chat-operation-mode">Modo de operação da IA</label><select class="form-select" id="ai-chat-operation-mode" ${this.forcedMode ? "disabled" : ""}><option value="auto_reply" ${this.forcedMode !== "observe_only" ? "selected" : ""}>Atendimento automático — responde pelo WhatsApp e atualiza o CRM</option><option value="observe_only" ${this.forcedMode === "observe_only" ? "selected" : ""}>Somente observação — não responde; analisa e registra informações no CRM</option></select><small class="text-muted" id="ai-chat-operation-note">No modo automático, a IA pode responder conforme as regras configuradas. O modo observador exige a funcionalidade ai.mode.observe_only na licença.</small><div class="i9-info-strip" id="ai-chat-observer-warning" hidden style="margin-top:8px"><i class="fas fa-eye"></i><span><strong>IA observadora:</strong> nenhuma mensagem será enviada ao contato ou ao vendedor; pedidos, handoffs e mudanças automáticas de estágio ficam desativados. A IA registra somente fatos profissionais/comerciais sustentados pela conversa e ignora dados pessoais sensíveis.</span></div></div>
        <div class="form-row ai-persona-meta-row">
          <div class="form-group"><label class="form-label" for="ai-chat-persona-name">Nome do perfil</label><input class="form-input" id="ai-chat-persona-name" maxlength="80" placeholder="Ex.: Networking — grupo de empreendedores"></div>
          <div class="form-group"><label class="form-label" for="ai-chat-persona-description">Descrição interna</label><input class="form-input" id="ai-chat-persona-description" maxlength="220" placeholder="Para quem é e qual é o objetivo deste perfil"></div>
        </div>
        <div class="i9-inline-actions ai-persona-actions"><button type="button" class="btn btn-primary" id="ai-chat-persona-create"><i class="fas fa-plus"></i> Criar perfil</button><button type="button" class="btn btn-secondary" id="ai-chat-persona-duplicate"><i class="fas fa-copy"></i> Duplicar perfil</button><button type="button" class="btn btn-ghost" id="ai-chat-persona-delete"><i class="fas fa-trash"></i> Excluir perfil</button><span id="ai-chat-persona-status" class="status-badge info" role="status" aria-live="polite">Carregando perfis…</span></div>
        <p class="i9-muted-note">Dica: use Networking para conhecer nichos e criar parcerias, Autoconhecimento para conversas reflexivas e Prospecção comercial para avaliar oportunidades. Não use relatos pessoais ou vulnerabilidades como gatilho de venda.</p>
      </article>

      <div class="i9-grid-2">
        <article class="card" data-feature="whatsapp.ai_support.configure"><div class="card-title"><i class="fas fa-book-open"></i> 5. Contexto do atendimento</div><p class="i9-muted-note">Para começar, você não precisa preencher esta seção. O i9Hub inclui instruções padrão seguras; depois, personalize o nome da empresa e os produtos, serviços e preços para melhorar as respostas.</p>
          <div class="form-group"><label class="form-label" for="ai-chat-business">Nome da empresa</label><input class="form-input" id="ai-chat-business" placeholder="Ex.: Loja Exemplo"></div>
          <div class="form-group"><label class="form-label" for="ai-chat-prompt">Instruções do atendente</label><textarea class="form-textarea" id="ai-chat-prompt" rows="5" placeholder="Tom de voz, regras comerciais, perguntas para qualificar e quando chamar uma pessoa."></textarea></div>
          <div class="form-group"><label class="form-label" for="ai-chat-knowledge">Produtos, serviços, preços e perguntas frequentes</label><textarea class="form-textarea" id="ai-chat-knowledge" rows="6" placeholder="Inclua informações aprovadas pela empresa. A IA não deve inventar preços, estoque, prazos ou descontos."></textarea></div>
          <div class="form-group"><label class="form-label" for="ai-chat-welcome">Mensagem inicial (opcional)</label><input class="form-input" id="ai-chat-welcome" placeholder="Olá! Como posso ajudar?"></div>
        </article>
        <article class="card" data-feature="whatsapp.ai_support.configure"><div class="card-title"><i class="fas fa-bullseye"></i> 6. Qualificação automática de leads</div>
          <label class="toggle"><input type="checkbox" id="ai-chat-qualification-enabled" checked><span class="toggle-slider"></span> Identificar leads qualificados</label>
          <p class="i9-muted-note">A IA avalia a conversa e gera uma justificativa e um nível de confiança. A mudança de estágio só ocorre se a confiança atingir o limite definido e o lead for identificado sem ambiguidade no CRM.</p>
          <div class="form-row"><div class="form-group"><label class="form-label" for="ai-chat-qualified-stage">Mover lead qualificado para</label><select class="form-select" id="ai-chat-qualified-stage"></select></div><div class="form-group"><label class="form-label" for="ai-chat-confidence">Confiança mínima</label><select class="form-select" id="ai-chat-confidence"><option value="0.60">60%</option><option value="0.70">70%</option><option value="0.75">75%</option><option value="0.80" selected>80%</option><option value="0.85">85%</option><option value="0.90">90%</option><option value="0.95">95%</option></select></div></div>
          <div class="form-group"><label class="form-label" for="ai-chat-criteria">Critérios de qualificação</label><textarea class="form-textarea" id="ai-chat-criteria" rows="4" placeholder="Ex.: necessidade clara, interesse real, orçamento compatível, prazo e intenção de avançar."></textarea></div>
          <div class="i9-warning-card"><i class="fas fa-lock"></i><div><strong>Proteção do funil</strong><p>A IA não moverá leads da Black list nem substituirá estágios Fechado ou Perdido. Se não encontrar um único contato correspondente no CRM, guardará o contexto da conversa, mas não mudará nenhum registro.</p></div></div>
        </article>
      </div>

      <article class="card ai-config-save-card" data-feature="whatsapp.ai_support.configure">
        <div class="ai-config-save-copy"><div class="card-title"><i class="fas fa-floppy-disk"></i> Salvar configurações da IA</div><p class="i9-muted-note">Salve instruções, base de conhecimento, mensagem inicial, critérios de qualificação, regras de grupos e provedor. As alterações são gravadas neste computador e, se o Google Drive estiver conectado, o i9Hub tentará sincronizá-las imediatamente.</p><div id="ai-chat-config-save-status" class="status-badge info" role="status" aria-live="polite">Carregando configurações…</div></div>
        <div class="ai-config-save-actions"><button type="button" class="btn btn-primary" id="ai-chat-save-config"><i class="fas fa-floppy-disk"></i> Salvar configurações</button></div>
      </article>

      <article class="card ai-history-card" data-feature="whatsapp.ai_support.google_sheets"><div class="card-title"><i class="fas fa-file-lines"></i> 7. Histórico das conversas no Google Drive</div><p class="i9-muted-note">Crie uma planilha privada na sua conta Google para registrar mensagens recebidas, respostas da IA, horários e falhas de processamento. O histórico pode ajudar a recuperar contexto em outro computador. Só será gravado depois que você conectar e ativar esta opção.</p><div id="ai-chat-history-status" class="status-badge warning" aria-live="polite">Histórico não conectado.</div><div class="i9-inline-actions"><button type="button" class="btn btn-primary" id="ai-chat-history-connect"><i class="fas fa-cloud-arrow-up"></i> Criar / conectar histórico</button><button type="button" class="btn btn-secondary" id="ai-chat-history-toggle" hidden>Ativar registro</button><button type="button" class="btn btn-ghost" id="ai-chat-history-sync" hidden><i class="fas fa-rotate"></i> Sincronizar pendentes</button><a id="ai-chat-history-link" class="btn btn-ghost" href="#" target="_blank" rel="noopener noreferrer" hidden>Abrir planilha</a></div><p class="i9-muted-note">A planilha fica na sua conta Google. O conteúdo das mensagens pode conter dados pessoais; habilite o histórico apenas se tiver autorização para armazená-los. A fila local mantém os registros pendentes caso a internet ou o Drive falhe.</p></article>
      <div class="card ai-control-card" data-feature="whatsapp.ai_support"><div class="ai-control-copy"><div class="card-title"><i class="fas fa-power-off"></i> 8. Diagnóstico do atendimento</div><p id="ai-chat-runtime-copy">Salve e teste o provedor antes de ativar.</p><div class="i9-status-list"><span id="ai-chat-wa-status"><i class="fas fa-circle"></i> WhatsApp: verificando</span><span id="ai-chat-panel-status"><i class="fas fa-circle"></i> Painel aberto: verificando</span><span id="ai-chat-reader-status"><i class="fas fa-circle"></i> Leitura de mensagens: verificando</span><span id="ai-chat-last-processing">Última mensagem: nenhuma recebida ainda</span><span id="ai-chat-last-event">Última atividade: —</span><span id="ai-chat-provider-status">Último provedor: —</span><span id="ai-chat-queue-status">Fila: 0 registro(s) pendente(s) no Drive</span></div></div><div class="ai-control-actions"><button class="btn btn-secondary" id="ai-chat-refresh"><i class="fas fa-rotate"></i> Atualizar estado</button></div></div>
      <div class="i9-footnote"><i class="fas fa-shield-halved"></i> Use mensagens relevantes e respeite as regras do WhatsApp, a legislação aplicável e as preferências dos contatos. Teste primeiro com uma conta e poucos contatos autorizados.</div>
    </section>`;
  }

  bindEvents() {
    const $ = (id) => document.getElementById(id);
    $('ai-chat-provider')?.addEventListener('change', () => {
      this.updatePrimaryProviderUI(true);
      this.openProviderKeyPage($('ai-chat-provider')?.value, true);
    });
    $('ai-groups-refresh')?.addEventListener('click', () => this.loadAvailableGroups());
    $('ai-group-save')?.addEventListener('click', (event) => this.saveAllConfig(event.currentTarget));
    $('ai-chat-save-config')?.addEventListener('click', (event) => this.saveAllConfig(event.currentTarget));
    $('ai-chat-persona-select')?.addEventListener('change', () => this.changePersona());
    $('ai-chat-persona-mode')?.addEventListener('change', () => this.handlePersonaModeChange());
    $('ai-chat-operation-mode')?.addEventListener('change', () => { this.updateOperationModeUI(); this.updateConfigSaveState(); });
    $('ai-chat-persona-create')?.addEventListener('click', () => this.createPersonaFromTemplate());
    $('ai-chat-persona-duplicate')?.addEventListener('click', () => this.duplicatePersona());
    $('ai-chat-persona-delete')?.addEventListener('click', () => this.deletePersona());
    $('ai-group-search')?.addEventListener('input', () => this.renderGroupList());
    $('ai-group-scope')?.addEventListener('change', () => this.updateGroupControls());
    $('ai-group-trigger')?.addEventListener('change', () => this.updateGroupControls());
    $('ai-group-list')?.addEventListener('change', (event) => {
      const personaSelect = event.target.closest('[data-ai-group-persona]');
      if (personaSelect) {
        const groupId = personaSelect.dataset.aiGroupPersona;
        const personaId = String(personaSelect.value || '').trim();
        if (personaId) this.groupPersonaAssignments[groupId] = personaId; else delete this.groupPersonaAssignments[groupId];
        this.updateConfigSaveState();
        return;
      }
      const input = event.target.closest('[data-ai-group-id]'); if (!input) return;
      const id = input.dataset.aiGroupId;
      if (input.checked) this.selectedGroupIds.add(id); else this.selectedGroupIds.delete(id);
      this.renderGroupList();
      this.updateConfigSaveState();
    });
    $('ai-group-select-visible')?.addEventListener('click', () => {
      const search = ($('ai-group-search')?.value || '').trim().toLocaleLowerCase('pt-BR');
      this.availableGroups.filter(g => !search || g.name.toLocaleLowerCase('pt-BR').includes(search)).forEach(g => this.selectedGroupIds.add(g.id));
      this.renderGroupList();
      this.updateConfigSaveState();
    });
    $('ai-group-clear-selection')?.addEventListener('click', () => { this.selectedGroupIds.clear(); this.renderGroupList(); this.updateConfigSaveState(); });
    $('ai-chat-model')?.addEventListener('change', () => this.updateEndpointField());
    $('ai-chat-model-custom')?.addEventListener('input', () => this.updateEndpointField());
    $('ai-chat-key')?.addEventListener('input', () => {
      this.modelCatalogReady = false;
      const rawKey = $('ai-chat-key')?.value.trim() || '';
      const epInput = $('ai-chat-endpoint');
      if (rawKey.startsWith('8tk_') && ['custom', '8token'].includes($('ai-chat-provider')?.value)) {
        if (epInput && !epInput.value.trim()) epInput.value = 'https://8token.tech/v1';
      }
      const state = $('ai-chat-key-state');
      if (state && rawKey) state.textContent = 'Chave inserida. Clique em “Carregar modelos disponíveis” para consultar as versões compatíveis com ela.';
    });
    $('ai-chat-load-models')?.addEventListener('click', () => this.loadAvailableModels());
    $('ai-chat-create-key')?.addEventListener('click', () => this.openProviderKeyPage($('ai-chat-provider')?.value, false));
    $('ai-chat-test')?.addEventListener('click', () => this.testProvider());
    $('ai-chat-clear-keys')?.addEventListener('click', () => this.clearKeys());
    $('ai-chat-sync-passphrase-save')?.addEventListener('click', () => this.saveSyncPassphrase());
    $('ai-chat-sync-passphrase-clear')?.addEventListener('click', () => this.clearSyncPassphrase());
    $('ai-chat-add-fallback')?.addEventListener('click', () => { this.addFallbackRow({ provider: 'gemini', model: PROVIDER_DEFAULTS.gemini }); this.updateConfigSaveState(); });
    $('ai-chat-fallback-list')?.addEventListener('click', (event) => {
      const removeBtn = event.target.closest('[data-remove-fallback]');
      if (removeBtn) { removeBtn.closest('.ai-fallback-row')?.remove(); this.updateFallbackCount(); this.updateConfigSaveState(); return; }
      const loadBtn = event.target.closest('[data-load-fallback-models]');
      if (loadBtn) this.loadAvailableModels({ row: loadBtn.closest('.ai-fallback-row') });
    });
    $('ai-chat-fallback-list')?.addEventListener('input', (event) => {
      const row = event.target.closest('.ai-fallback-row'); if (!row) return;
      if (event.target.matches('[data-fallback-key]')) row.dataset.modelsLoaded = 'false';
    });
    $('ai-chat-fallback-list')?.addEventListener('change', (event) => {
      const row = event.target.closest('.ai-fallback-row'); if (!row) return;
      if (event.target.matches('[data-fallback-provider]')) {
        const provider = event.target.value;
        const previous = row.dataset.lastProvider || '';
        const model = row.querySelector('[data-fallback-model]');
        const customModel = row.querySelector('[data-fallback-model-custom]');
        if (previous && provider !== previous) {
          const key = row.querySelector('[data-fallback-key]'); if (key) { key.value = ''; key.placeholder = 'Cole a chave do novo provedor'; }
          const keyState = row.querySelector('[data-fallback-key-state]'); if (keyState) keyState.textContent = 'A chave precisa corresponder ao provedor selecionado.';
          this.setModelOptions(model, [], '', 'Carregue os modelos da chave reserva');
          if (customModel) customModel.value = '';
          this.openProviderKeyPage(provider, true);
        }
        if (customModel) customModel.hidden = provider !== 'custom';
        if (model) model.hidden = provider === 'custom';
        row.querySelector('[data-load-fallback-models]')?.toggleAttribute('hidden', provider === 'custom');
        row.dataset.lastProvider = provider;
        row.querySelector('[data-fallback-endpoint-wrap]').hidden = provider !== 'custom';
      }
    });
    $('ai-chat-toggle')?.addEventListener('click', () => {
      const savedMode = this.status?.operationMode === 'observe_only' ? 'observe_only' : 'auto_reply';
      const otherModeActive = !!this.status?.enabled && this.forcedMode && savedMode !== this.forcedMode;
      this.setEnabled(otherModeActive ? true : !this.status?.enabled);
    });
    $('ai-chat-history-connect')?.addEventListener('click', () => this.connectHistory());
    $('ai-chat-history-toggle')?.addEventListener('click', () => this.toggleHistory());
    $('ai-chat-history-sync')?.addEventListener('click', () => this.syncHistoryNow());
    $('ai-chat-refresh')?.addEventListener('click', () => this.load());
    const root = document.querySelector('.ai-view');
    const watchConfig = (event) => { if (this.isConfigControl(event.target)) this.updateConfigSaveState(); };
    root?.addEventListener('input', watchConfig);
    root?.addEventListener('change', watchConfig);
  }

  isConfigControl(target) {
    if (!(target instanceof Element)) return false;
    if (target.closest('.ai-fallback-row') || target.matches('[data-ai-group-id]') || target.matches('[data-ai-group-persona]')) return true;
    return new Set([
      'ai-chat-mode', 'ai-group-scope', 'ai-group-trigger', 'ai-group-keywords', 'ai-chat-reply-delay',
      'ai-chat-provider', 'ai-chat-model', 'ai-chat-model-custom', 'ai-chat-endpoint', 'ai-chat-key',
      'ai-chat-business', 'ai-chat-prompt', 'ai-chat-knowledge', 'ai-chat-welcome',
      'ai-chat-qualification-enabled', 'ai-chat-qualified-stage', 'ai-chat-confidence', 'ai-chat-criteria',
      'ai-chat-persona-select', 'ai-chat-persona-name', 'ai-chat-persona-description', 'ai-chat-persona-mode', 'ai-chat-operation-mode',
    ]).has(target.id);
  }

  getConfigFormSnapshot() {
    const draft = this.collectConfig();
    // As chaves são ocultadas após o salvamento; compare apenas se há uma chave nova no campo.
    draft.apiKey = draft.apiKey ? '[nova-chave]' : '';
    draft.fallbackProviders = (draft.fallbackProviders || []).map(({ apiKey, ...profile }) => ({ ...profile, apiKey: apiKey ? '[nova-chave]' : '' }));
    return JSON.stringify(draft);
  }

  captureSavedConfigSnapshot() {
    try { this.savedFormSnapshot = this.getConfigFormSnapshot(); } catch { this.savedFormSnapshot = ''; }
    this.updateConfigSaveState();
  }

  updateConfigSaveState() {
    const status = document.getElementById('ai-chat-config-save-status');
    if (!status) return;
    if (!this.savedFormSnapshot) {
      status.textContent = 'As configurações estão sendo carregadas.';
      status.className = 'status-badge info';
      this.configDirty = false;
      return;
    }
    let dirty = false;
    try { dirty = this.getConfigFormSnapshot() !== this.savedFormSnapshot || this.personaMigrationPending; } catch { dirty = this.personaMigrationPending === true; }
    this.configDirty = dirty;
    if (dirty) {
      status.textContent = 'Há alterações não salvas. Salve antes de sair ou sincronizar o histórico.';
      status.className = 'status-badge warning';
    } else if (this.syncNotice) {
      status.textContent = this.syncNotice;
      status.className = `status-badge ${this.syncNoticeKind || 'info'}`;
    } else if (this.config?.sync?.driveConnected) {
      status.textContent = 'Configurações salvas neste computador. O Google Drive está conectado e a sincronização está disponível.';
      status.className = 'status-badge success';
    } else {
      status.textContent = 'Configurações salvas neste computador. Conecte o Google Drive para sincronizá-las entre dispositivos.';
      status.className = 'status-badge info';
    }
  }

  makePersonaId() {
    return `persona_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  normalizePersonas(config = {}) {
    const saved = Array.isArray(config.aiPersonas) ? config.aiPersonas : [];
    if (saved.length) {
      return saved.slice(0, 20).map((persona, index) => ({
        id: String(persona?.id || `persona_${index + 1}`).slice(0, 100),
        mode: ['networking', 'self_knowledge', 'commercial'].includes(persona?.mode) ? persona.mode : 'commercial',
        operationMode: persona?.mode !== 'self_knowledge' && persona?.operationMode === 'observe_only' ? 'observe_only' : 'auto_reply',
        name: String(persona?.name || `Perfil ${index + 1}`).trim().slice(0, 80),
        description: String(persona?.description || '').trim().slice(0, 220),
        businessName: String(persona?.businessName ?? config.businessName ?? DEFAULT_BUSINESS_NAME).trim().slice(0, 180),
        prompt: String(persona?.prompt ?? config.prompt ?? DEFAULT_PROMPT).trim().slice(0, 10000),
        knowledge: String(persona?.knowledge ?? config.knowledge ?? DEFAULT_KNOWLEDGE).trim().slice(0, 20000),
        welcomeMessage: String(persona?.welcomeMessage ?? config.welcomeMessage ?? '').trim().slice(0, 500),
        qualificationEnabled: persona?.qualificationEnabled === undefined ? config.qualificationEnabled !== false : persona.qualificationEnabled === true,
        qualifiedStage: String(persona?.qualifiedStage ?? config.qualifiedStage ?? 'qualificado').trim().slice(0, 100) || 'qualificado',
        qualificationThreshold: Math.max(0.5, Math.min(0.99, Number(persona?.qualificationThreshold ?? config.qualificationThreshold ?? 0.8) || 0.8)),
        qualificationCriteria: String(persona?.qualificationCriteria ?? config.qualificationCriteria ?? 'Identifique necessidade clara, interesse real, orçamento ou faixa de preço, prazo e intenção de avançar.').trim().slice(0, 4000),
        updatedAt: String(persona?.updatedAt || config.updatedAt || '').slice(0, 40),
      }));
    }
    // Migra a configuração legada para um perfil sem alterar nenhum prompt existente.
    return [{
      id: 'persona_legacy', mode: 'commercial', operationMode: config.operationMode === 'observe_only' ? 'observe_only' : 'auto_reply', name: 'Atendimento atual',
      description: 'Configuração migrada automaticamente da versão anterior.',
      businessName: String(config.businessName || DEFAULT_BUSINESS_NAME),
      prompt: String(config.prompt || DEFAULT_PROMPT), knowledge: String(config.knowledge || DEFAULT_KNOWLEDGE),
      welcomeMessage: String(config.welcomeMessage || ''), qualificationEnabled: config.qualificationEnabled !== false,
      qualifiedStage: String(config.qualifiedStage || 'qualificado'),
      qualificationThreshold: Number(config.qualificationThreshold ?? 0.8),
      qualificationCriteria: String(config.qualificationCriteria || 'Identifique necessidade clara, interesse real, orçamento ou faixa de preço, prazo e intenção de avançar.'),
      updatedAt: String(config.updatedAt || ''),
    }];
  }

  getSelectedPersona() {
    return this.aiPersonas.find((persona) => persona.id === this.activePersonaId) || this.aiPersonas[0] || null;
  }

  getCurrentPersonaDraft() {
    const value = (id) => document.getElementById(id)?.value?.trim() || '';
    const id = this.activePersonaId || document.getElementById('ai-chat-persona-select')?.value || this.aiPersonas[0]?.id || 'persona_legacy';
    const existing = this.aiPersonas.find((persona) => persona.id === id) || {};
    return {
      id,
      mode: ['networking', 'self_knowledge', 'commercial'].includes(value('ai-chat-persona-mode')) ? value('ai-chat-persona-mode') : (existing.mode || 'commercial'),
      operationMode: this.forcedMode || (value('ai-chat-operation-mode') === 'observe_only' ? 'observe_only' : 'auto_reply'),
      name: value('ai-chat-persona-name') || existing.name || 'Meu perfil',
      description: value('ai-chat-persona-description') || '',
      businessName: value('ai-chat-business') || DEFAULT_BUSINESS_NAME,
      prompt: value('ai-chat-prompt') || DEFAULT_PROMPT,
      knowledge: value('ai-chat-knowledge') || DEFAULT_KNOWLEDGE,
      welcomeMessage: value('ai-chat-welcome'),
      qualificationEnabled: document.getElementById('ai-chat-qualification-enabled')?.checked === true,
      qualifiedStage: value('ai-chat-qualified-stage') || existing.qualifiedStage || 'qualificado',
      qualificationThreshold: Number(value('ai-chat-confidence') || existing.qualificationThreshold || 0.8),
      qualificationCriteria: value('ai-chat-criteria'),
      updatedAt: existing.updatedAt || '',
    };
  }

  getPersonasWithDraft() {
    const current = this.getCurrentPersonaDraft();
    const list = (this.aiPersonas || []).map((persona) => persona.id === current.id ? { ...persona, ...current } : { ...persona });
    if (!list.some((persona) => persona.id === current.id)) list.push(current);
    return list.slice(0, 20);
  }

  renderPersonaSelector() {
    const select = document.getElementById('ai-chat-persona-select');
    if (select) {
      select.innerHTML = this.aiPersonas.map((persona) => `<option value="${this.esc(persona.id)}">${this.esc(persona.name || 'Perfil sem nome')}</option>`).join('');
      select.value = this.activePersonaId;
    }
    const remove = document.getElementById('ai-chat-persona-delete');
    if (remove) remove.disabled = this.aiPersonas.length <= 1;
    const create = document.getElementById('ai-chat-persona-create');
    if (create) create.disabled = this.aiPersonas.length >= 20;
    this.renderGroupList();
    this.updatePersonaStatus();
  }

  updatePersonaStatus() {
    const status = document.getElementById('ai-chat-persona-status');
    if (!status) return;
    const persona = this.getSelectedPersona();
    if (!persona) { status.textContent = 'Nenhum perfil carregado.'; status.className = 'status-badge warning'; return; }
    if (this.activePersonaId !== this.savedActivePersonaId) {
      status.textContent = `“${persona.name}” será usado no atendimento depois de salvar.`;
      status.className = 'status-badge warning';
    } else if (this.configDirty || this.personaMigrationPending) {
      status.textContent = `Perfil selecionado: ${persona.name}. Há alterações que precisam ser salvas.`;
      status.className = 'status-badge warning';
    } else {
      status.textContent = `Perfil ativo no atendimento: ${persona.name}.`;
      status.className = 'status-badge success';
    }
  }

  loadPersonaFields(persona = {}) {
    const set = (id, value) => { const el = document.getElementById(id); if (el && value != null) el.value = value; };
    set('ai-chat-persona-name', persona.name || 'Atendimento atual');
    set('ai-chat-persona-mode', ['networking', 'self_knowledge', 'commercial'].includes(persona.mode) ? persona.mode : 'commercial');
    set('ai-chat-operation-mode', this.forcedMode || (persona.mode !== 'self_knowledge' && persona.operationMode === 'observe_only' ? 'observe_only' : 'auto_reply'));
    set('ai-chat-persona-description', persona.description || '');
    set('ai-chat-business', persona.businessName || DEFAULT_BUSINESS_NAME);
    set('ai-chat-prompt', persona.prompt || DEFAULT_PROMPT);
    set('ai-chat-knowledge', persona.knowledge || DEFAULT_KNOWLEDGE);
    set('ai-chat-welcome', persona.welcomeMessage || '');
    set('ai-chat-qualified-stage', persona.qualifiedStage || this.config.qualifiedStage || 'qualificado');
    set('ai-chat-confidence', String(persona.qualificationThreshold ?? this.config.qualificationThreshold ?? 0.8));
    set('ai-chat-criteria', persona.qualificationCriteria || this.config.qualificationCriteria || 'Identifique necessidade clara, interesse real, orçamento ou faixa de preço, prazo e intenção de avançar.');
    const enabled = document.getElementById('ai-chat-qualification-enabled');
    const mode = ['networking', 'self_knowledge', 'commercial'].includes(persona.mode) ? persona.mode : 'commercial';
    if (enabled) { enabled.disabled = mode !== 'commercial'; enabled.checked = mode === 'commercial' && persona.qualificationEnabled !== false; }
    this.updateOperationModeUI();
  }

  handlePersonaModeChange() {
    const mode = document.getElementById('ai-chat-persona-mode')?.value || 'commercial';
    const operation = document.getElementById('ai-chat-operation-mode');
    if (mode === 'self_knowledge' && operation?.value === 'observe_only') { operation.value = 'auto_reply'; this.app.showToast('O modo observador não é permitido em perfis de autoconhecimento para evitar registrar informações pessoais no CRM.', 'warning', 7000); }
    if (operation) { const observerOption = [...operation.options].find((option) => option.value === 'observe_only'); if (observerOption) observerOption.disabled = mode === 'self_knowledge'; }
    const enabled = document.getElementById('ai-chat-qualification-enabled');
    if (enabled) { enabled.disabled = mode !== 'commercial'; if (mode !== 'commercial') enabled.checked = false; }
    this.updateOperationModeUI();
    this.updateConfigSaveState();
  }

  updateOperationModeUI() {
    const mode = document.getElementById('ai-chat-operation-mode')?.value || 'auto_reply';
    const personaMode = document.getElementById('ai-chat-persona-mode')?.value || 'commercial';
    const note = document.getElementById('ai-chat-operation-note');
    const warning = document.getElementById('ai-chat-observer-warning');
    const observerOption = [...(document.getElementById('ai-chat-operation-mode')?.options || [])].find((option) => option.value === 'observe_only');
    if (observerOption) observerOption.disabled = personaMode === 'self_knowledge';
    if (note) note.textContent = mode === 'observe_only'
      ? 'A IA analisa conversas elegíveis e atualiza o CRM. O modo exige a permissão ai.mode.observe_only na licença e não envia mensagens.'
      : 'A IA responde pelo WhatsApp Web conforme o prompt, as regras e as permissões configuradas.';
    if (warning) warning.hidden = mode !== 'observe_only';
  }

  changePersona() {
    const select = document.getElementById('ai-chat-persona-select');
    if (!select?.value || select.value === this.activePersonaId) return;
    // Preserva o rascunho do perfil anterior na memória para que ele também seja salvo.
    this.aiPersonas = this.getPersonasWithDraft();
    this.activePersonaId = select.value;
    this.loadPersonaFields(this.getSelectedPersona());
    this.renderPersonaSelector();
    this.updateConfigSaveState();
  }

  createPersonaFromTemplate() {
    if (this.aiPersonas.length >= 20) { this.app.showToast('O limite é de 20 perfis de IA.', 'warning'); return; }
    this.aiPersonas = this.getPersonasWithDraft();
    const templateKey = document.getElementById('ai-chat-persona-template')?.value || 'networking';
    const template = AI_PERSONA_TEMPLATES[templateKey] || AI_PERSONA_TEMPLATES.networking;
    const duplicateCount = this.aiPersonas.filter((persona) => persona.name === template.name || persona.name.startsWith(`${template.name} `)).length;
    const persona = { ...template, id: this.makePersonaId(), name: duplicateCount ? `${template.name} ${duplicateCount + 1}` : template.name, updatedAt: '' };
    this.aiPersonas.push(persona);
    this.activePersonaId = persona.id;
    this.renderPersonaSelector();
    this.loadPersonaFields(persona);
    this.updateConfigSaveState();
    this.app.showToast(`Perfil “${persona.name}” criado como rascunho. Revise as informações e salve para ativá-lo.`, 'success', 7000);
  }

  duplicatePersona() {
    if (this.aiPersonas.length >= 20) { this.app.showToast('O limite é de 20 perfis de IA.', 'warning'); return; }
    this.aiPersonas = this.getPersonasWithDraft();
    const current = this.getSelectedPersona();
    if (!current) return;
    const copy = { ...current, id: this.makePersonaId(), name: `${current.name || 'Perfil'} (cópia)`.slice(0, 80), description: current.description || '', updatedAt: '' };
    this.aiPersonas.push(copy);
    this.activePersonaId = copy.id;
    this.renderPersonaSelector();
    this.loadPersonaFields(copy);
    this.updateConfigSaveState();
    this.app.showToast('Perfil duplicado. Edite o nome e as instruções antes de salvar.', 'success');
  }

  deletePersona() {
    if (this.aiPersonas.length <= 1) { this.app.showToast('Mantenha pelo menos um perfil de IA.', 'warning'); return; }
    this.aiPersonas = this.getPersonasWithDraft();
    const current = this.getSelectedPersona();
    if (!current || !confirm(`Excluir o perfil “${current.name}”? A exclusão será aplicada quando você salvar as configurações.`)) return;
    this.aiPersonas = this.aiPersonas.filter((persona) => persona.id !== current.id);
    this.activePersonaId = this.aiPersonas[0].id;
    this.loadPersonaFields(this.getSelectedPersona());
    this.renderPersonaSelector();
    this.updateConfigSaveState();
    this.app.showToast('Perfil removido do rascunho. Salve as configurações para confirmar a exclusão.', 'info', 6000);
  }

  async load() {
    const configRes = await this.app.api.sendMessage('AI_GET_CONFIG');
    if (!configRes?.success) { this.app.showToast(configRes?.error || 'Ative uma licença que inclua o Chat com IA para configurar este módulo.', 'warning', 6000); return; }
    this.config = configRes.data || {};
    const c = this.config;
    this.aiPersonas = this.normalizePersonas(c);
    this.activePersonaId = this.aiPersonas.some((persona) => persona.id === c.activePersonaId) ? c.activePersonaId : this.aiPersonas[0]?.id || 'persona_legacy';
    this.savedActivePersonaId = this.activePersonaId;
    this.personaMigrationPending = !Array.isArray(c.aiPersonas) || !c.aiPersonas.length;
    this.renderPersonaSelector();
    this.updateDriveSyncUI(c.sync || {});
    this.renderHistoryUI(c);
    const set = (id, value) => { const el = document.getElementById(id); if (el && value != null) el.value = value; };
    set('ai-chat-mode', c.chatMode || 'private_only'); set('ai-group-trigger', c.groupReplyMode || 'reply_or_mention'); set('ai-group-scope', c.groupScope || 'selected'); set('ai-group-keywords', c.groupReplyKeywords || ''); this.selectedGroupIds = new Set(Array.isArray(c.selectedGroupIds) ? c.selectedGroupIds.map(String) : []); this.groupPersonaAssignments = c.groupPersonaAssignments && typeof c.groupPersonaAssignments === 'object' ? { ...c.groupPersonaAssignments } : {}; set('ai-chat-reply-delay', String(c.replyDelaySeconds ?? 1.5)); this.updateGroupControls(); this.renderGroupList();
    set('ai-chat-provider', c.provider || 'openai');
    const currentProvider = c.provider || 'openai';
    const modelSelect = document.getElementById('ai-chat-model');
    this.setModelOptions(modelSelect, [], currentProvider === 'custom' ? '' : (c.model || ''), 'Carregue os modelos disponíveis para esta chave');
    set('ai-chat-model-custom', currentProvider === 'custom' ? (c.model || '') : '');
    set('ai-chat-endpoint', c.endpoint || '');
    const primaryProvider = document.getElementById('ai-chat-provider'); if (primaryProvider) primaryProvider.dataset.lastProvider = currentProvider;
    this.modelCatalogReady = false;
    this.loadPersonaFields(this.getSelectedPersona() || c);
    const keyState = document.getElementById('ai-chat-key-state'); if (keyState) { const cooldown = Number(c.providerCooldownUntil || 0); keyState.textContent = cooldown > Date.now() ? `Provedor principal em espera até ${new Date(cooldown).toLocaleString('pt-BR')}. O rodízio tentará outra chave.` : `${c.apiKeyConfigured ? 'Chave principal salva localmente.' : 'Nenhuma chave principal salva.'} ${c.providerVerified ? 'Provedor principal testado.' : 'Teste a conexão antes de ativar.'}${c.providerLastError ? ` Última falha: ${String(c.providerLastError).slice(0, 120)}` : ''}`; }
    const modelState = document.getElementById('ai-chat-model-state'); if (modelState) modelState.textContent = c.model ? `Modelo salvo: ${c.model}. Carregue a lista para confirmar que ele está disponível para sua chave.` : 'Cole a chave da API e clique em “Carregar modelos disponíveis”.';
    this.updatePrimaryProviderUI();
    this.renderFallbackProviders(Array.isArray(c.fallbackProviders) ? c.fallbackProviders : []);
    this.renderFallbackKeyStates();
    await this.loadStages();
    // loadStages atualiza as opções do funil; reaplica o estágio próprio do perfil ativo.
    this.loadPersonaFields(this.getSelectedPersona() || c);
    const statusRes = await this.app.api.sendMessage('AI_GET_STATUS');
    if (statusRes?.success) this.status = statusRes.data || {};
    this.renderStatus();
    this.renderHistoryUI({ ...this.config, ...this.status });
    this.captureSavedConfigSnapshot();
  }

  async loadAvailableGroups() {
    const button = document.getElementById('ai-groups-refresh');
    const list = document.getElementById('ai-group-list');
    const original = button?.innerHTML;
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando…'; }
    if (list) list.innerHTML = '<div class="ai-group-list-empty">Consultando grupos disponíveis no WhatsApp Web…</div>';
    try {
      const response = await this.app.api.sendMessage('EXTRACT_ALL_CHATS');
      if (!response?.success) throw new Error(response?.error || 'Não foi possível consultar os grupos. Verifique se o WhatsApp Web está conectado e atualizado.');
      const data = Array.isArray(response.data) ? response.data : (Array.isArray(response.data?.chats) ? response.data.chats : []);
      this.availableGroups = data.filter((item) => item && (item.isGroup === true || /@g\.us$/i.test(String(item.id || ''))))
        .map((item) => ({ id: String(item.id || '').trim(), name: String(item.name || item.subject || 'Grupo sem nome').trim(), size: Number(item.size) || 0, isCommunity: item.isCommunity === true, isCommunityAnnouncement: item.isCommunityAnnouncement === true }))
        .filter((item) => item.id && item.name)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      this.groupsLoaded = true;
      this.renderGroupList();
      if (!this.availableGroups.length) {
        this.app.showToast('Nenhum grupo foi encontrado. Abra/atualize o WhatsApp Web e tente novamente.', 'warning', 7000);
      } else {
        this.app.showToast(`${this.availableGroups.length} grupo(s) carregado(s) do WhatsApp.`, 'success');
      }
    } catch (error) {
      this.groupsLoaded = false;
      if (list) list.innerHTML = `<div class="ai-group-list-empty">${this.esc(String(error?.message || error))}</div>`;
      this.app.showToast(String(error?.message || error), 'error', 7000);
    } finally {
      if (button) { button.disabled = false; button.innerHTML = original || '<i class="fas fa-rotate"></i> Atualizar grupos'; }
      this.updateGroupControls();
    }
  }

  renderGroupList() {
    const list = document.getElementById('ai-group-list');
    const count = document.getElementById('ai-group-selection-count');
    if (!list) return;
    const query = (document.getElementById('ai-group-search')?.value || '').trim().toLocaleLowerCase('pt-BR');
    const groups = this.availableGroups.filter((group) => !query || group.name.toLocaleLowerCase('pt-BR').includes(query));
    if (!this.groupsLoaded && !this.availableGroups.length) {
      list.innerHTML = '<div class="ai-group-list-empty">Clique em “Atualizar grupos” para carregar a lista real do WhatsApp.</div>';
    } else if (!groups.length) {
      list.innerHTML = '<div class="ai-group-list-empty">Nenhum grupo corresponde à pesquisa.</div>';
    } else {
      const personaOptions = (selectedId) => `<option value="">Perfil global padrão</option>${this.aiPersonas.map((persona) => `<option value="${this.esc(persona.id)}" ${persona.id === selectedId ? 'selected' : ''}>${this.esc(persona.name || 'Perfil sem nome')}</option>`).join('')}`;
      list.innerHTML = groups.map((group) => `<div class="ai-group-option"><label class="ai-group-option-main"><input type="checkbox" data-ai-group-id="${this.esc(group.id)}" ${this.selectedGroupIds.has(group.id) ? 'checked' : ''}><span class="ai-group-option-copy"><strong>${this.esc(group.name)}</strong><small>${group.isCommunityAnnouncement ? 'Avisos da comunidade' : group.isCommunity ? 'Comunidade' : 'Grupo'}${group.size ? ` · ${group.size} participantes` : ''}</small></span></label><div class="ai-group-persona-assignment"><label for="ai-group-persona-${this.esc(group.id)}">Personalidade</label><select class="form-select" id="ai-group-persona-${this.esc(group.id)}" data-ai-group-persona="${this.esc(group.id)}">${personaOptions(this.groupPersonaAssignments[group.id] || '')}</select></div></div>`).join('');
    }
    if (count) {
      const selected = this.selectedGroupIds.size;
      count.textContent = selected ? `${selected} grupo(s) marcado(s). ${this.availableGroups.length ? `Lista atual: ${this.availableGroups.length} grupo(s).` : 'Atualize a lista para confirmar os grupos disponíveis.'}` : 'Nenhum grupo selecionado. No modo “Somente grupos selecionados”, a IA ficará bloqueada até marcar pelo menos um grupo.';
    }
  }

  updateGroupControls() {
    const scope = document.getElementById('ai-group-scope')?.value || 'selected';
    const picker = document.getElementById('ai-group-picker');
    const trigger = document.getElementById('ai-group-trigger')?.value || 'reply_or_mention';
    const keywords = document.getElementById('ai-group-keywords-wrap');
    if (picker) picker.hidden = scope === 'all';
    if (keywords) keywords.hidden = trigger !== 'keywords';
    const note = document.getElementById('ai-group-safety-note');
    if (note) {
      if (scope === 'all') note.textContent = 'A IA poderá atuar em todos os grupos acessíveis ao WhatsApp Web. Recomendado: use menção ou resposta à IA para evitar respostas fora de contexto.';
      else if (scope === 'except_selected') note.textContent = 'Os grupos marcados na lista serão excluídos. Os demais grupos poderão acionar a IA conforme o gatilho escolhido.';
      else note.textContent = 'Somente os grupos marcados poderão acionar a IA. Se nenhum grupo estiver marcado, todos os grupos serão bloqueados por segurança.';
      if (trigger === 'all_messages') note.textContent += ' Atenção: o modo “Todas as mensagens” pode gerar muitas respostas.';
      if (trigger === 'keywords' && !String(document.getElementById('ai-group-keywords')?.value || '').trim()) note.textContent += ' Configure pelo menos uma palavra-chave para habilitar este gatilho.';
    }
  }

  updateDriveSyncUI(sync = {}) {
    const status = document.getElementById('ai-chat-sync-status');
    const input = document.getElementById('ai-chat-sync-passphrase');
    const clear = document.getElementById('ai-chat-sync-passphrase-clear');
    if (input) input.placeholder = sync.passphraseConfigured ? 'Senha já salva neste computador; digite para alterar' : 'Crie uma senha com pelo menos 10 caracteres';
    if (clear) clear.disabled = !sync.passphraseConfigured;
    if (!status) return;
    let message = '';
    let kind = 'warning';
    if (!sync.driveConnected) {
      message = 'Conecte o Google Drive em Configurações › Dados. As preferências da IA serão sincronizadas automaticamente depois da conexão.';
    } else if (sync.secretBackupAvailable && sync.passphraseConfigured && sync.status?.state === 'restored') {
      message = 'Google Drive conectado. Preferências da IA e chaves API protegidas estão sincronizadas neste computador.'; kind = 'success';
    } else if (sync.secretBackupAvailable && sync.passphraseConfigured && sync.hasLocalKeys) {
      message = 'Google Drive conectado. Há um backup criptografado das chaves API e elas estão disponíveis neste computador.'; kind = 'success';
    } else if (sync.secretBackupAvailable && !sync.passphraseConfigured) {
      message = 'Configuração da IA disponível. Há chaves API criptografadas no Drive; informe a mesma senha usada no outro computador para restaurá-las.';
    } else if (sync.secretBackupAvailable && sync.status?.state === 'passphrase_invalid') {
      message = 'Não foi possível abrir o backup criptografado. Confira a senha de sincronização.';
    } else if (sync.passphraseConfigured && !sync.hasLocalKeys) {
      message = 'Senha salva, mas não há chaves API neste computador para criptografar. Cole a chave do provedor e salve/teste para criar o backup seguro.';
    } else if (sync.passphraseConfigured) {
      message = 'Senha salva neste computador. As chaves API serão criptografadas e incluídas no próximo backup automático.'; kind = 'success';
    } else {
      message = 'Google Drive conectado. As preferências da IA sincronizam automaticamente; para incluir as chaves API, defina uma senha de sincronização.'; kind = 'success';
    }
    status.className = `status-badge ${kind}`;
    status.textContent = message;
  }

  hasStoredAiConfig() {
    const c = this.config || {};
    return !!(c.updatedAt || c.apiKeyConfigured || c.model || c.businessName || c.prompt || c.knowledge || c.welcomeMessage || c.historySheetId || c.sheetId || (Array.isArray(c.aiPersonas) && c.aiPersonas.length) || (Array.isArray(c.fallbackProviders) && c.fallbackProviders.length));
  }

  getDraftChangedFields(draft) {
    const c = this.config || {};
    const provider = c.provider || 'openai';
    const model = c.model || '';
    const baseline = {
      provider,
      model,
      endpoint: c.endpoint || this.getConfiguredEndpoint(provider, model),
      chatMode: c.chatMode || 'private_only',
      groupReplyMode: c.groupReplyMode || 'reply_or_mention',
      groupScope: c.groupScope || 'selected',
      selectedGroupIds: Array.isArray(c.selectedGroupIds) ? c.selectedGroupIds.map(String) : [],
      groupReplyKeywords: c.groupReplyKeywords || '',
      replyDelaySeconds: Number(c.replyDelaySeconds ?? 1.5),
      businessName: c.businessName || DEFAULT_BUSINESS_NAME,
      prompt: c.prompt || DEFAULT_PROMPT,
      knowledge: c.knowledge || DEFAULT_KNOWLEDGE,
      welcomeMessage: c.welcomeMessage || '',
      qualificationEnabled: c.qualificationEnabled !== false,
      qualifiedStage: c.qualifiedStage || 'qualificado',
      qualificationThreshold: Number(c.qualificationThreshold ?? 0.8),
      qualificationCriteria: c.qualificationCriteria || 'Identifique necessidade clara, interesse real, orçamento ou faixa de preço, prazo de compra e intenção de avançar.',
      personaMode: c.personaMode || 'commercial',
      aiPersonas: Array.isArray(c.aiPersonas) ? c.aiPersonas : [],
      activePersonaId: c.activePersonaId || '',
    };
    baseline.groupPersonaAssignments = c.groupPersonaAssignments && typeof c.groupPersonaAssignments === 'object' ? c.groupPersonaAssignments : {};
    const fields = Object.keys(baseline).filter((field) => JSON.stringify(draft[field]) !== JSON.stringify(baseline[field]));
    if (draft.apiKey) fields.push('apiKey');
    const normalizeFallbacks = (items = []) => (Array.isArray(items) ? items : []).map((item) => ({
      id: String(item?.id || ''), provider: String(item?.provider || 'gemini'), model: String(item?.model || ''), endpoint: String(item?.endpoint || ''),
    }));
    const currentFallbacks = normalizeFallbacks(c.fallbackProviders);
    const draftFallbacks = normalizeFallbacks(draft.fallbackProviders);
    if (JSON.stringify(draftFallbacks) !== JSON.stringify(currentFallbacks) || (draft.fallbackProviders || []).some((item) => !!item.apiKey)) fields.push('fallbackProviders');
    return [...new Set(fields)];
  }

  mergeDraftIntoConfig(draft, fields = []) {
    const merged = { ...(this.config || {}) };
    for (const field of fields) {
      if (field === 'fallbackProviders') merged.fallbackProviders = draft.fallbackProviders || [];
      else if (field === 'apiKey') merged.apiKey = draft.apiKey || '';
      else if (Object.prototype.hasOwnProperty.call(draft, field)) merged[field] = draft[field];
    }
    return merged;
  }

  applyDraftChanges(draft, fields = []) {
    const changed = new Set(fields);
    const set = (id, value) => { const el = document.getElementById(id); if (el && value != null) el.value = value; };
    if (changed.has('provider')) {
      set('ai-chat-provider', draft.provider || 'openai');
      this.updatePrimaryProviderUI(true);
    }
    if (changed.has('model')) {
      const provider = document.getElementById('ai-chat-provider')?.value || draft.provider;
      if (provider === 'custom') set('ai-chat-model-custom', draft.model || '');
      else {
        const select = document.getElementById('ai-chat-model');
        if (select && draft.model && ![...select.options].some((option) => option.value === draft.model)) {
          const option = document.createElement('option'); option.value = draft.model; option.textContent = `Modelo salvo: ${draft.model}`; select.appendChild(option);
        }
        set('ai-chat-model', draft.model || '');
      }
      this.updateEndpointField();
    }
    if (changed.has('endpoint')) set('ai-chat-endpoint', draft.endpoint || '');
    if (changed.has('aiPersonas') || changed.has('activePersonaId')) {
      this.aiPersonas = Array.isArray(draft.aiPersonas) && draft.aiPersonas.length ? draft.aiPersonas.map((persona) => ({ ...persona })) : this.aiPersonas;
      this.activePersonaId = this.aiPersonas.some((persona) => persona.id === draft.activePersonaId) ? draft.activePersonaId : this.aiPersonas[0]?.id || this.activePersonaId;
      this.renderPersonaSelector();
      this.loadPersonaFields(this.getSelectedPersona());
    }
    const fieldMap = {
      chatMode: 'ai-chat-mode', groupReplyMode: 'ai-group-trigger', groupScope: 'ai-group-scope', groupReplyKeywords: 'ai-group-keywords', replyDelaySeconds: 'ai-chat-reply-delay', businessName: 'ai-chat-business',
      prompt: 'ai-chat-prompt', knowledge: 'ai-chat-knowledge', welcomeMessage: 'ai-chat-welcome', personaMode: 'ai-chat-persona-mode', operationMode: 'ai-chat-operation-mode',
      qualifiedStage: 'ai-chat-qualified-stage', qualificationThreshold: 'ai-chat-confidence', qualificationCriteria: 'ai-chat-criteria',
    };
    for (const field of Object.keys(fieldMap)) if (changed.has(field)) set(fieldMap[field], draft[field]);
    if (changed.has('selectedGroupIds')) { this.selectedGroupIds = new Set(Array.isArray(draft.selectedGroupIds) ? draft.selectedGroupIds.map(String) : []); this.renderGroupList(); }
    if (changed.has('groupPersonaAssignments')) { this.groupPersonaAssignments = draft.groupPersonaAssignments && typeof draft.groupPersonaAssignments === 'object' ? { ...draft.groupPersonaAssignments } : {}; this.renderGroupList(); }
    this.updateGroupControls();
    if (changed.has('qualificationEnabled')) {
      const checkbox = document.getElementById('ai-chat-qualification-enabled'); if (checkbox) checkbox.checked = draft.qualificationEnabled === true;
    }
    if (changed.has('apiKey') && draft.apiKey) set('ai-chat-key', draft.apiKey);
    if (changed.has('fallbackProviders')) this.renderFallbackProviders(draft.fallbackProviders || []);
    this.updatePrimaryProviderUI();
  }

  async refreshSyncStatusPreservingForm() {
    const configRes = await this.app.api.sendMessage('AI_GET_CONFIG');
    if (configRes?.success) {
      this.config = configRes.data || this.config;
      this.updateDriveSyncUI(this.config.sync || {});
      this.renderHistoryUI({ ...this.config, ...this.status });
    }
    const statusRes = await this.app.api.sendMessage('AI_GET_STATUS');
    if (statusRes?.success) this.status = statusRes.data || {};
    this.renderStatus();
    this.renderHistoryUI({ ...this.config, ...this.status });
    this.updateConfigSaveState();
  }

  async saveSyncPassphrase() {
    const input = document.getElementById('ai-chat-sync-passphrase');
    const button = document.getElementById('ai-chat-sync-passphrase-save');
    const passphrase = input?.value || '';
    if (passphrase.length < 10) { this.app.showToast('Use uma senha de sincronização com pelo menos 10 caracteres.', 'warning', 6000); input?.focus(); return; }
    const original = button?.innerHTML;
    const draft = this.collectConfig();
    const hadLocalConfig = this.hasStoredAiConfig();
    const changedFields = this.getDraftChangedFields(draft);
    const preserveDraft = changedFields.length > 0;
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Protegendo e sincronizando…'; }
    try {
      // Em uma máquina já configurada, marque as edições atuais como locais antes do merge.
      // Em uma instalação nova, não grave os campos padrão: primeiro recupere as preferências do Drive.
      if (hadLocalConfig && preserveDraft) {
        const saveDraft = await this.app.api.sendMessage('AI_SAVE_CONFIG', this.mergeDraftIntoConfig(draft, changedFields));
        if (!saveDraft?.success) throw new Error(saveDraft?.error || 'Não foi possível preservar as alterações atuais da IA.');
        this.config = { ...(saveDraft.data || this.config), sync: this.config?.sync || {} };
      }

      const result = await this.app.api.sendMessage('DRIVE_SET_AI_SYNC_PASSPHRASE', { passphrase });
      if (!result?.success) throw new Error(result?.error || 'Não foi possível configurar a senha de sincronização.');
      if (input) input.value = '';
      const data = result.data || {};

      // Recarrega o estado persistido (inclusive preferências recuperadas do Drive), mas reaplica
      // somente os campos que estavam diferentes antes do clique. Assim, nem um rascunho é perdido,
      // nem os valores padrão da instalação nova substituem a configuração remota.
      await this.load();
      if (preserveDraft) {
        this.applyDraftChanges(draft, changedFields);
        const saveMerged = await this.app.api.sendMessage('AI_SAVE_CONFIG', this.mergeDraftIntoConfig(draft, changedFields));
        if (!saveMerged?.success) this.app.showToast('A sincronização terminou, mas algumas alterações da tela não foram salvas. Elas continuam visíveis; salve a configuração da IA para persistir.', 'warning', 9000);
        else {
          this.config = { ...(saveMerged.data || this.config), sync: this.config?.sync || {} };
          this.aiPersonas = Array.isArray(this.config.aiPersonas) ? this.config.aiPersonas.map((persona) => ({ ...persona })) : this.aiPersonas;
          this.activePersonaId = this.config.activePersonaId || this.activePersonaId;
          this.savedActivePersonaId = this.activePersonaId;
          this.personaMigrationPending = false;
          this.renderPersonaSelector();
          this.captureSavedConfigSnapshot();
        }
        await this.refreshSyncStatusPreservingForm();
      }

      if (data.syncError) this.app.showToast(`Senha salva, mas a sincronização precisa de atenção: ${data.syncError}`, 'warning', 8000);
      else this.app.showToast(data.restored ? 'Chaves API restauradas do backup criptografado. As configurações da IA foram preservadas.' : data.driveConnected ? 'Senha salva e sincronização da IA concluída.' : 'Senha salva neste computador. Conecte o Google Drive para sincronizar.', 'success', 7000);
    } catch (error) { this.app.showToast(String(error?.message || error), 'error', 7000); }
    finally { if (button) { button.disabled = false; button.innerHTML = original || '<i class="fas fa-lock"></i> Salvar senha e sincronizar'; } }
  }

  async clearSyncPassphrase() {
    if (!confirm('Esquecer a senha neste computador? O backup criptografado continuará no Google Drive, mas você precisará digitar a senha novamente para restaurar as chaves.')) return;
    if (!(await this.ensureDraftSavedBeforeAuxAction())) return;
    const result = await this.app.api.sendMessage('DRIVE_CLEAR_AI_SYNC_PASSPHRASE');
    if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível esquecer a senha.', 'error'); return; }
    this.app.showToast('Senha esquecida neste computador. O backup criptografado foi mantido no Drive.', 'success', 6000);
    await this.refreshSyncStatusPreservingForm();
  }

  async loadStages() {
    const select = document.getElementById('ai-chat-qualified-stage'); if (!select) return;
    let stages = DEFAULT_STAGES;
    try { const r = await this.app.api.getStages(); if (r?.success && Array.isArray(r.data?.stages) && r.data.stages.length) stages = r.data.stages; } catch {}
    const selected = this.getSelectedPersona()?.qualifiedStage || this.config.qualifiedStage || 'qualificado';
    select.innerHTML = stages.filter(s => s?.id && s.id !== 'blacklist').map(s => `<option value="${this.esc(s.id)}">${this.esc(s.title || s.id)}</option>`).join('');
    if ([...select.options].some(o => o.value === selected)) select.value = selected;
  }

  setModelOptions(select, models = [], selected = '', placeholder = 'Selecione um modelo disponível') {
    if (!select) return;
    const wanted = String(selected || '').replace(/^models\//, '');
    select.replaceChildren();
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    select.appendChild(placeholderOption);
    const list = Array.isArray(models) ? models : [];
    if (!list.length && wanted) {
      const saved = document.createElement('option');
      saved.value = wanted;
      saved.textContent = `Modelo salvo (ainda não validado): ${wanted}`;
      select.appendChild(saved);
      select.value = wanted;
      return;
    }
    for (const item of list) {
      if (!item?.id) continue;
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.label || item.id;
      if (item.description) option.title = item.description;
      select.appendChild(option);
    }
    const ids = list.map((item) => item?.id).filter(Boolean);
    if (wanted && ids.includes(wanted)) select.value = wanted;
    else if (ids.length) select.value = ids[0];
    else select.value = '';
  }


  isCustomEndpointProvider(provider) {
    return ['custom', '8token', '9router'].includes(provider);
  }

  isValidEndpointUrl(endpoint) {
    try {
      const u = new URL(String(endpoint || '').trim());
      if (u.username || u.password) return false;
      if (u.protocol === 'https:') return true;
      const h = u.hostname.toLowerCase();
      if (u.protocol === 'http:' && (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h))) return true;
      return false;
    } catch { return false; }
  }

  updateEndpointField() {
    const provider = document.getElementById('ai-chat-provider')?.value || 'openai';
    const endpoint = document.getElementById('ai-chat-endpoint');
    if (this.isCustomEndpointProvider(provider)) return;
    const model = document.getElementById('ai-chat-model');
    if (endpoint) endpoint.value = this.getConfiguredEndpoint(provider, model?.value || '');
  }



  updatePrimaryProviderUI(providerChanged = false) {
    const select = document.getElementById('ai-chat-provider');
    const provider = select?.value || 'openai';
    const previous = select?.dataset.lastProvider || '';
    const model = document.getElementById('ai-chat-model');
    const customModel = document.getElementById('ai-chat-model-custom');
    const modelLabel = document.getElementById('ai-chat-model-label');
    const modelState = document.getElementById('ai-chat-model-state');
    const loadModelsButton = document.getElementById('ai-chat-load-models');
    const isCustomEp = this.isCustomEndpointProvider(provider);

    if (providerChanged && previous && provider !== previous) {
      const key = document.getElementById('ai-chat-key'); if (key) key.value = '';
      const keyState = document.getElementById('ai-chat-key-state'); if (keyState) keyState.textContent = 'IA alterada. Gere uma chave para o novo provedor e cole-a aqui.';
      this.setModelOptions(model, [], '', 'Cole a chave e carregue os modelos disponíveis');
      if (customModel) customModel.value = '';
      this.modelCatalogReady = false;
      if (modelState) modelState.textContent = 'Carregue os modelos disponíveis para a chave deste provedor ou informe manualmente.';
    }
    const meta = PROVIDER_META[provider] || PROVIDER_META.custom;
    const hasCatalogOptions = model && model.options && model.options.length > 1;
    if (model) model.hidden = isCustomEp && !hasCatalogOptions;
    if (customModel) customModel.hidden = !isCustomEp;
    if (modelLabel) {
      modelLabel.textContent = isCustomEp ? 'Modelo (selecione da lista ou digite abaixo)' : 'Modelo disponível na sua chave';
      modelLabel.htmlFor = isCustomEp && !hasCatalogOptions ? 'ai-chat-model-custom' : 'ai-chat-model';
    }
    if (loadModelsButton) loadModelsButton.hidden = false;
    const endpoint = document.getElementById('ai-chat-endpoint');
    const endpointLabel = document.querySelector('label[for="ai-chat-endpoint"]');
    if (endpointLabel) endpointLabel.textContent = isCustomEp ? 'Endpoint do seu provedor (HTTPS ou http://localhost)' : 'Endpoint da API (preenchido automaticamente)';
    if (endpoint) {
      endpoint.readOnly = !isCustomEp;
      endpoint.placeholder = provider === '9router' ? 'http://localhost:20128/v1' : provider === '8token' ? 'https://8token.tech/v1' : isCustomEp ? 'https://8token.tech/v1 ou http://localhost:20128/v1' : 'Preenchido conforme o provedor e modelo';
      if (isCustomEp) {
        if (providerChanged || !endpoint.value.trim()) endpoint.value = meta.endpoint || '';
      } else {
        endpoint.value = this.getConfiguredEndpoint(provider, model?.value || '');
      }
    }
    const guideTitle = document.getElementById('ai-chat-provider-guide-title');
    const guideCopy = document.getElementById('ai-chat-provider-guide-copy');
    const createButton = document.getElementById('ai-chat-create-key');
    if (guideTitle) guideTitle.textContent = meta.label;
    if (guideCopy) guideCopy.textContent = meta.instructions;
    if (createButton) {
      createButton.hidden = !meta.keyUrl;
      createButton.innerHTML = meta.keyUrl ? '<i class="fas fa-arrow-up-right-from-square"></i> Abrir página para criar chave' : '<i class="fas fa-circle-info"></i> Configure seu provedor';
    }
    if (select) select.dataset.lastProvider = provider;
  }





  async loadAvailableModels({ row = null, silent = false } = {}) {
    const provider = row?.querySelector('[data-fallback-provider]')?.value || document.getElementById('ai-chat-provider')?.value || 'openai';
    const apiKey = row ? (row.querySelector('[data-fallback-key]')?.value?.trim() || '') : (document.getElementById('ai-chat-key')?.value?.trim() || '');
    const endpoint = row ? (row.querySelector('[data-fallback-endpoint]')?.value?.trim() || '') : (document.getElementById('ai-chat-endpoint')?.value?.trim() || '');
    const fallbackId = row?.dataset?.fallbackId || '';
    const select = row?.querySelector('[data-fallback-model]') || document.getElementById('ai-chat-model');
    const customInput = row?.querySelector('[data-fallback-model-custom]') || document.getElementById('ai-chat-model-custom');
    const state = row?.querySelector('[data-fallback-model-state]') || document.getElementById('ai-chat-model-state');
    const button = row?.querySelector('[data-load-fallback-models]') || document.getElementById('ai-chat-load-models');

    const savedKeyAvailable = fallbackId
      ? (this.config.fallbackProviders || []).some((item) => item.id === fallbackId && item.provider === provider && item.apiKeyConfigured)
      : this.config.apiKeyConfigured && this.config.provider === provider;
    if (!apiKey && !savedKeyAvailable) {
      if (state) state.textContent = 'Cole a chave API antes de carregar os modelos.';
      if (!silent) this.app.showToast('Cole a chave API do provedor e tente novamente.', 'warning', 6000);
      return false;
    }
    const origin = this.getOrigin(provider, endpoint);
    if (!origin) {
      if (!silent) this.app.showToast('Informe um endpoint válido (ex.: https://8token.tech/v1 ou http://localhost:20128/v1).', 'warning', 6000);
      return false;
    }
    let granted = false;
    try { granted = await chrome.permissions.request({ origins: [origin] }); } catch { granted = false; }
    if (!granted) {
      if (state) state.textContent = 'Permissão não concedida. Autorize o acesso ao provedor para consultar os modelos.';
      if (!silent) this.app.showToast('Autorize o acesso ao domínio do provedor no aviso do Chrome.', 'warning', 7000);
      return false;
    }
    const original = button?.innerHTML;
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando modelos…'; }
    if (state) state.textContent = 'Consultando os modelos disponíveis para esta chave…';
    try {
      const result = await this.app.api.sendMessage('AI_LIST_MODELS', { provider, apiKey, endpoint, fallbackId });
      if (!result?.success) throw new Error(result?.error || 'Não foi possível consultar os modelos do provedor.');
      const models = Array.isArray(result.data?.models) ? result.data.models : [];
      const current = customInput?.value?.trim() || select?.value || (fallbackId ? (this.config.fallbackProviders || []).find((item) => item.id === fallbackId)?.model : this.config.model) || '';
      this.setModelOptions(select, models, current, 'Selecione um modelo disponível');
      if (select) select.hidden = false;
      if (customInput && select?.value) customInput.value = select.value;
      if (select && customInput && !select.dataset.boundCustomSync) {
        select.addEventListener('change', () => { if (select.value) customInput.value = select.value; });
        select.dataset.boundCustomSync = 'true';
      }
      if (row) row.dataset.modelsLoaded = 'true';
      else this.modelCatalogReady = true;
      if (!row) this.updateEndpointField();
      this.updateConfigSaveState();
      if (state) state.textContent = `${models.length} modelo(s) encontrados para esta chave. Selecione o modelo que deseja usar.${result.data?.sourceNote ? ` ${result.data.sourceNote}` : ''}`;
      if (!silent) this.app.showToast(`${models.length} modelo(s) carregados. Selecione uma opção na lista.`, 'success', 6000);
      return true;
    } catch (error) {
      if (state) state.textContent = String(error?.message || error).slice(0, 300);
      if (!silent) this.app.showToast(String(error?.message || error), 'error', 8000);
      return false;
    } finally {
      if (button) { button.disabled = false; button.innerHTML = original || '<i class="fas fa-list-check"></i> Carregar modelos disponíveis'; }
    }
  }

  async openProviderKeyPage(provider, automatic = false) {
    const meta = PROVIDER_META[provider] || PROVIDER_META.custom;
    if (!meta.keyUrl) {
      if (!automatic) this.app.showToast('Para um provedor personalizado, abra o painel dele e copie o endpoint e a chave fornecidos pelo serviço.', 'info', 6500);
      return false;
    }
    try {
      await chrome.tabs.create({ url: meta.keyUrl, active: true });
      if (!automatic) this.app.showToast(`Página oficial de chaves aberta: ${meta.keyPage}. Depois copie a chave e cole no i9Hub.`, 'info', 6000);
      return true;
    } catch {
      this.app.showToast(`Não foi possível abrir automaticamente. Acesse: ${meta.keyUrl}`, 'warning', 7000);
      return false;
    }
  }

  renderFallbackProviders(providers = []) {
    const list = document.getElementById('ai-chat-fallback-list'); if (!list) return;
    list.replaceChildren();
    providers.slice(0, 4).forEach(p => this.addFallbackRow(p));
    this.updateFallbackCount();
  }

  addFallbackRow(provider = {}) {
    const list = document.getElementById('ai-chat-fallback-list'); if (!list || list.children.length >= 4) { this.app.showToast('Você pode cadastrar até 4 provedores reserva.', 'warning'); return; }
    const id = String(provider.id || `fallback_${Date.now().toString(36)}_${(++this.fallbackCounter).toString(36)}`);
    const selected = ['openai','anthropic','gemini','openrouter','custom'].includes(provider.provider) ? provider.provider : 'gemini';
    const row = document.createElement('div'); row.className = 'ai-fallback-row'; row.dataset.fallbackId = id;
    row.innerHTML = `<div class="ai-fallback-heading"><strong>Provedor reserva</strong><button type="button" class="btn btn-sm btn-ghost" data-remove-fallback aria-label="Remover provedor reserva"><i class="fas fa-trash"></i> Remover</button></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Provedor</label><select class="form-select" data-fallback-provider><option value="openai">OpenAI</option><option value="anthropic">Anthropic / Claude</option><option value="gemini">Google Gemini</option><option value="openrouter">OpenRouter</option><option value="8token">8Token (Gateway API)</option><option value="9router">9Router (Proxy Local / Remoto)</option><option value="custom">Outro (API compatível com OpenAI)</option></select></div><div class="form-group"><label class="form-label">Modelo disponível</label><select class="form-select" data-fallback-model><option value="">Carregue os modelos da chave reserva</option></select><input class="form-input" data-fallback-model-custom placeholder="Nome exato do modelo informado pelo serviço" hidden><small class="text-muted" data-fallback-model-state>Selecione o provedor, cole a chave e carregue a lista.</small></div></div>
      <div class="form-group" data-fallback-endpoint-wrap hidden><label class="form-label">Endpoint HTTPS</label><input class="form-input" data-fallback-endpoint placeholder="https://api.seuprovedor.com/v1/chat/completions"></div>
      <div class="form-group"><label class="form-label">Chave da API reserva</label><input class="form-input" data-fallback-key type="password" autocomplete="off" placeholder="${provider.apiKeyConfigured ? 'Chave salva; vazio mantém a atual' : 'Cole a chave da API'}"><div class="i9-inline-actions"><button type="button" class="btn btn-secondary" data-load-fallback-models><i class="fas fa-list-check"></i> Carregar modelos</button><small class="text-muted" data-fallback-key-state>${provider.apiKeyConfigured ? 'Chave salva localmente.' : 'Chave ainda não configurada.'}</small></div></div>`;
    list.appendChild(row);
    row.querySelector('[data-fallback-provider]').value = selected;
    row.dataset.lastProvider = selected;
    this.setModelOptions(row.querySelector('[data-fallback-model]'), [], selected === 'custom' ? '' : (provider.model || ''), 'Carregue os modelos da chave reserva');
    row.querySelector('[data-fallback-model]').hidden = selected === 'custom';
    row.querySelector('[data-fallback-model-custom]').value = selected === 'custom' ? (provider.model || '') : '';
    row.querySelector('[data-fallback-model-custom]').hidden = selected !== 'custom';
    row.querySelector('[data-load-fallback-models]').hidden = selected === 'custom';
    row.querySelector('[data-fallback-model-state]').textContent = selected === 'custom' ? 'Informe manualmente o modelo do provedor.' : 'Cole a chave e carregue a lista de modelos.';
    row.querySelector('[data-fallback-endpoint]').value = provider.endpoint || '';
    row.querySelector('[data-fallback-endpoint-wrap]').hidden = selected !== 'custom';
    row.querySelector('[data-fallback-key]').value = String(provider.apiKey || '');
    this.updateFallbackCount();
  }

  updateFallbackCount() {
    const count = document.getElementById('ai-chat-fallback-count');
    const list = document.getElementById('ai-chat-fallback-list');
    if (count && list) count.textContent = `${list.children.length} de 4 reservas`;
    const add = document.getElementById('ai-chat-add-fallback'); if (add && list) add.disabled = list.children.length >= 4;
  }

  collectConfig() {
    const val = (id) => document.getElementById(id)?.value?.trim() || '';
    const fallbackProviders = [...(document.getElementById('ai-chat-fallback-list')?.querySelectorAll('.ai-fallback-row') || [])].map(row => {
      const provider = row.querySelector('[data-fallback-provider]')?.value || 'gemini';
      const isCustom = this.isCustomEndpointProvider(provider);
      const customVal = row.querySelector('[data-fallback-model-custom]')?.value?.trim() || '';
      const selectVal = row.querySelector('[data-fallback-model]')?.value?.trim() || '';
      return {
        id: row.dataset.fallbackId,
        provider,
        model: isCustom ? (customVal || selectVal) : selectVal,
        endpoint: row.querySelector('[data-fallback-endpoint]')?.value?.trim() || '',
        apiKey: row.querySelector('[data-fallback-key]')?.value?.trim() || '',
      };
    });
    const primaryProvider = val('ai-chat-provider');
    const primaryModel = this.isCustomEndpointProvider(primaryProvider)
      ? (val('ai-chat-model-custom') || val('ai-chat-model'))
      : val('ai-chat-model');
    const activePersona = this.getCurrentPersonaDraft();
    const personas = (this.aiPersonas || []).map((persona) => persona.id === activePersona.id ? { ...persona, ...activePersona } : { ...persona });
    if (!personas.some((persona) => persona.id === activePersona.id)) personas.push(activePersona);
    return {
      provider: primaryProvider, model: primaryModel, endpoint: val('ai-chat-endpoint'), apiKey: val('ai-chat-key'),
      fallbackProviders, chatMode: val('ai-chat-mode'), groupReplyMode: val('ai-group-trigger'), groupScope: val('ai-group-scope') || 'selected', selectedGroupIds: [...this.selectedGroupIds], groupReplyKeywords: val('ai-group-keywords'), groupPersonaAssignments: { ...(this.groupPersonaAssignments || {}) },
      activePersonaId: activePersona.id, aiPersonas: personas.slice(0, 20), personaMode: activePersona.mode, operationMode: activePersona.operationMode,
      businessName: activePersona.businessName, prompt: activePersona.prompt, knowledge: activePersona.knowledge, welcomeMessage: activePersona.welcomeMessage, replyDelaySeconds: Math.max(0, Math.min(10, Number(document.getElementById('ai-chat-reply-delay')?.value ?? 1.5) || 0)),
      qualificationEnabled: activePersona.qualificationEnabled,
      qualifiedStage: activePersona.qualifiedStage, qualificationThreshold: activePersona.qualificationThreshold,
      qualificationCriteria: activePersona.qualificationCriteria,
    };
  }

  async persistConfig(silent = false) {
    const config = this.collectConfig();
    const result = await this.app.api.sendMessage('AI_SAVE_CONFIG', config);
    if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível salvar a configuração.', 'error', 7000); return false; }
    this.config = { ...(result.data || {}), sync: this.config?.sync || {} };
    this.aiPersonas = Array.isArray(this.config.aiPersonas) ? this.config.aiPersonas.map((persona) => ({ ...persona })) : this.getPersonasWithDraft();
    this.activePersonaId = this.config.activePersonaId || this.activePersonaId;
    this.savedActivePersonaId = this.activePersonaId;
    this.personaMigrationPending = false;
    this.renderPersonaSelector();
    const key = document.getElementById('ai-chat-key'); if (key) key.value = '';
    this.renderFallbackKeyStates();
    const keyState = document.getElementById('ai-chat-key-state'); if (keyState) { const cooldown = Number(this.config.providerCooldownUntil || 0); keyState.textContent = cooldown > Date.now() ? `Provedor principal em espera até ${new Date(cooldown).toLocaleString('pt-BR')}. O rodízio tentará outra chave.` : `${this.config.apiKeyConfigured ? 'Chave principal salva localmente.' : 'Nenhuma chave principal salva.'} ${this.config.providerVerified ? 'Provedor principal testado.' : 'Teste a conexão antes de ativar.'}${this.config.providerLastError ? ` Última falha: ${String(this.config.providerLastError).slice(0, 120)}` : ''}`; }
    this.captureSavedConfigSnapshot();
    if (!silent) this.app.showToast('Configuração salva neste perfil do Chrome.', 'success');
    return true;
  }

  renderFallbackKeyStates() {
    const rows = [...(document.getElementById('ai-chat-fallback-list')?.querySelectorAll('.ai-fallback-row') || [])];
    rows.forEach(row => {
      const item = (this.config.fallbackProviders || []).find(p => p.id === row.dataset.fallbackId);
      const state = row.querySelector('[data-fallback-key-state]');
      const input = row.querySelector('[data-fallback-key]');
      if (state) { const cooldown = Number(item?.cooldownUntil || 0); state.textContent = cooldown > Date.now() ? `Em espera até ${new Date(cooldown).toLocaleString('pt-BR')}.` : item?.lastError ? `Última falha: ${String(item.lastError).slice(0, 120)}` : item?.apiKeyConfigured ? 'Chave salva localmente; deixe vazio para manter.' : 'Chave ainda não configurada.'; }
      if (input) input.value = '';
    });
  }

  validateConfig() {
    const c = this.collectConfig();
    if (c.operationMode === 'observe_only' && c.personaMode === 'self_knowledge') return 'A IA observadora não pode ser usada no perfil de autoconhecimento.';
    const primarySavedKeyMatches = this.config.apiKeyConfigured && this.config.provider === c.provider;
    if (!c.model || (!c.apiKey && !primarySavedKeyMatches)) return 'Informe o modelo e uma chave compatível com o provedor principal selecionado.';
    if (this.isCustomEndpointProvider(c.provider) && !this.isValidEndpointUrl(c.endpoint)) return 'O endpoint principal precisa usar HTTPS ou HTTP local (http://localhost / 127.0.0.1).';
    const invalidFallback = c.fallbackProviders.find(p => { const old = (this.config.fallbackProviders || []).find(item => item.id === p.id); const savedKeyMatches = old?.apiKeyConfigured && old.provider === p.provider; return !p.model || (!p.apiKey && !savedKeyMatches) || (this.isCustomEndpointProvider(p.provider) && !this.isValidEndpointUrl(p.endpoint)); });
    if (invalidFallback) return 'Complete modelo, chave e endpoint válido de cada provedor reserva ou remova a linha incompleta.';
    return '';
  }

  async saveConfig() {
    return this.saveAllConfig(document.getElementById('ai-chat-save-config'));
  }

  async saveAllConfig(button = null) {
    const original = button?.innerHTML;
    const driveConnected = this.config?.sync?.driveConnected === true;
    this.syncNotice = '';
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando…'; }
    try {
      const saved = await this.persistConfig(true);
      if (!saved) return false;
      if (!driveConnected) {
        this.syncNotice = 'Configurações salvas localmente. O Google Drive não está conectado; a sincronização entre dispositivos ainda não foi feita.';
        this.syncNoticeKind = 'info';
        this.updateConfigSaveState();
        this.app.showToast('Configurações salvas neste computador. Conecte o Google Drive em Configurações › Dados para sincronizá-las entre dispositivos.', 'success', 8000);
        return true;
      }
      const sync = await this.app.api.sendMessage('DRIVE_SYNC_NOW');
      await this.refreshSyncStatusPreservingForm();
      if (sync?.success && !sync.skipped) {
        this.syncNotice = 'Configurações salvas localmente e sincronizadas com o Google Drive.';
        this.syncNoticeKind = 'success';
        this.app.showToast('Configurações salvas localmente e sincronizadas com o Google Drive.', 'success', 7000);
      } else {
        const reason = sync?.error || (sync?.skipped === 'campaign-running' ? 'A sincronização será retomada quando a campanha em andamento terminar.' : 'O Drive não confirmou a sincronização.');
        this.syncNotice = `Configurações salvas localmente, mas a sincronização precisa de atenção: ${reason}`;
        this.syncNoticeKind = 'warning';
        this.app.showToast(`Configurações salvas neste computador, mas a sincronização precisa de atenção: ${reason}`, 'warning', 9000);
      }
      return true;
    } catch (error) {
      this.syncNotice = `A gravação local foi tentada, mas a sincronização apresentou erro: ${String(error?.message || error)}`;
      this.syncNoticeKind = 'warning';
      this.app.showToast(`As configurações podem ter sido salvas localmente, mas houve um erro ao sincronizar: ${String(error?.message || error)}`, 'warning', 9000);
      return false;
    } finally {
      if (button) { button.disabled = false; button.innerHTML = original || '<i class="fas fa-floppy-disk"></i> Salvar configurações'; }
      this.updateConfigSaveState();
    }
  }

  async ensureDraftSavedBeforeAuxAction() {
    if (!this.configDirty) return true;
    const driveConnected = this.config?.sync?.driveConnected === true;
    this.syncNotice = '';
    const saved = await this.persistConfig(true);
    if (!saved) {
      this.app.showToast('Não foi possível salvar as alterações da IA. A operação foi cancelada para evitar perda de dados.', 'error', 9000);
      return false;
    }
    this.syncNotice = driveConnected
      ? 'Alterações salvas localmente; a sincronização automática com o Google Drive foi solicitada.'
      : 'Alterações salvas localmente. Conecte o Google Drive para sincronizá-las entre dispositivos.';
    this.syncNoticeKind = 'info';
    this.updateConfigSaveState();
    this.app.showToast('Alterações da IA salvas antes de continuar.', 'success', 5000);
    return true;
  }

  getOrigin(provider, endpoint) {
    const map = { openai: 'https://api.openai.com/*', anthropic: 'https://api.anthropic.com/*', gemini: 'https://generativelanguage.googleapis.com/*', openrouter: 'https://openrouter.ai/*' };
    if (!this.isCustomEndpointProvider(provider)) return map[provider] || '';
    const raw = endpoint || (provider === '8token' ? 'https://8token.tech/v1' : provider === '9router' ? 'http://localhost:20128/v1' : '');
    if (!this.isValidEndpointUrl(raw)) return '';
    try { const u = new URL(raw); return `${u.protocol}//${u.hostname}/*`; } catch { return ''; }
  }

  async requestProviderPermissions() {
    const c = this.collectConfig();
    const origins = [...new Set([this.getOrigin(c.provider, c.endpoint), ...c.fallbackProviders.map(p => this.getOrigin(p.provider, p.endpoint))].filter(Boolean))];
    if (!origins.length) return false;
    try { return await chrome.permissions.request({ origins }); } catch { return false; }
  }

  async testProvider() {
    const selectedProvider = document.getElementById('ai-chat-provider')?.value || 'openai';
    if (selectedProvider !== 'custom' && !this.modelCatalogReady) {
      const loaded = await this.loadAvailableModels({ silent: true });
      if (!loaded) { this.app.showToast('Não foi possível carregar a lista de modelos. Confira a chave e a permissão do provedor e tente novamente.', 'warning', 8000); return; }
    }
    const validationError = this.validateConfig();
    if (validationError) { this.app.showToast(validationError, 'warning', 7000); return; }
    if (!await this.requestProviderPermissions()) { this.app.showToast('Autorize o acesso aos domínios dos provedores para testar a conexão.', 'warning', 7000); return; }
    if (!(await this.persistConfig(true))) return;
    const btn = document.getElementById('ai-chat-test'); const original = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testando provedores…'; }
    const r = await this.app.api.sendMessage('AI_TEST_PROVIDER');
    if (btn) { btn.disabled = false; btn.innerHTML = original || '<i class="fas fa-plug"></i> Autorizar e testar'; }
    if (r?.success) {
      const good = Number(r.data?.fallbackTested || 0); const total = Number(r.data?.fallbackTotal || 0);
      this.app.showToast(`Provedor principal OK${total ? ` · reservas testadas: ${good}/${total}` : ''}.`, 'success', 7000);
      await this.load();
    } else this.app.showToast(r?.error || 'Falha ao testar o provedor principal.', 'error', 8000);
  }

  async clearKeys() {
    if (!confirm('Remover a chave principal e todas as chaves reserva? O atendimento será pausado.')) return;
    if (!(await this.ensureDraftSavedBeforeAuxAction())) return;
    const r = await this.app.api.sendMessage('AI_CLEAR_KEY');
    if (!r?.success) { this.app.showToast(r?.error || 'Não foi possível remover as chaves.', 'error'); return; }
    await this.load(); this.app.showToast('Chaves removidas e atendimento pausado.', 'success');
  }

  async setEnabled(enabled) {
    if (enabled) {
      const validationError = this.validateConfig();
      if (validationError) { this.app.showToast(validationError, 'warning', 7000); return; }
      if (!(await this.persistConfig(true))) return;
      if (!this.config.providerVerified) { this.app.showToast('Teste o provedor principal antes de ativar o atendimento.', 'warning'); return; }
    }
    const r = await this.app.api.sendMessage('AI_SET_ENABLED', { enabled });
    if (!r?.success) { this.app.showToast(r?.error || 'Não foi possível alterar o atendimento.', 'error', 8000); return; }
    this.status = r.data || {}; await this.load();
    const observing = this.collectConfig().operationMode === 'observe_only';
    this.app.showToast(enabled ? (observing ? 'IA observadora ativada. Ela analisará conversas autorizadas sem enviar mensagens.' : 'Chat com IA ativado. Mantenha o painel aberto e o WhatsApp conectado.') : (observing ? 'IA observadora pausada.' : 'Atendimento pausado.'), enabled ? 'success' : 'info', 7000);
  }

  renderStatus() {
    const expectedRoute = this.forcedMode === 'observe_only' ? 'ai-observer' : 'ai-chat';
    if (this.forcedMode && this.app?.router?.currentRoute && this.app.router.currentRoute !== expectedRoute) return;
    const s = this.status || {};
    const configured = !!s.apiKeyConfigured && !!s.modelConfigured && !!s.providerVerified;
    const active = !!s.enabled && !!s.runtimeActive && !!s.whatsappConnected;
    const savedMode = s.operationMode === 'observe_only' ? 'observe_only' : 'auto_reply';
    const viewMode = this.forcedMode || savedMode;
    const observing = viewMode === 'observe_only';
    const otherModeActive = !!s.enabled && this.forcedMode && savedMode !== this.forcedMode;
    let state = 'off', title = 'Não conectado', detail = 'Cole a chave da API, carregue um modelo e teste o provedor para preparar o atendimento.', icon = 'fa-plug';
    if (!configured) {
      state = 'off'; title = 'IA não conectada';
      detail = s.providerLastError ? `O último teste falhou: ${String(s.providerLastError).slice(0, 180)}` : 'Falta concluir a configuração ou testar o provedor de IA.';
      icon = 'fa-circle-exclamation';
    } else if (otherModeActive) {
      state = 'waiting';
      title = observing ? 'Modo Atendimento Automático está ativo' : 'Modo IA Observadora está ativo';
      detail = observing
        ? 'O modo IA - Atendimento está ativo no momento. Como os dois modos não operam ao mesmo tempo, clique no botão ao lado para alternar para IA - Observador (apenas leitura e anotação no CRM).'
        : 'O modo IA - Observador está ativo no momento. Como os dois modos não operam ao mesmo tempo, clique no botão ao lado para alternar para IA - Atendimento (respostas automáticas).';
      icon = 'fa-arrows-rotate';
    } else if (!s.enabled) {
      state = 'off'; title = observing ? 'IA observadora pausada' : 'Atendimento pausado'; detail = observing ? 'A análise está configurada, mas não atualiza o CRM enquanto estiver pausada.' : 'A IA está configurada, mas não responde mensagens enquanto estiver pausada.'; icon = 'fa-pause';
    } else if (!s.whatsappConnected) {
      state = 'waiting'; title = 'Aguardando conexão do WhatsApp'; detail = observing ? 'Conecte o WhatsApp Web para que a IA observadora possa analisar conversas autorizadas.' : 'Conecte o WhatsApp Web para que a IA possa ler e responder mensagens.'; icon = 'fa-link';
    } else if (!s.panelActive) {
      state = 'waiting'; title = 'Aguardando painel aberto'; detail = observing ? 'A observação está ativada, mas o painel do i9Hub precisa permanecer aberto para analisar mensagens.' : 'O atendimento está ativado, mas o painel do i9Hub precisa permanecer aberto para processar mensagens.'; icon = 'fa-window-maximize';
    } else if (Array.isArray(s.setupMissing) && s.setupMissing.length) {
      state = 'waiting'; title = 'Configuração incompleta'; detail = `A IA está ligada, mas faltam: ${s.setupMissing.join(', ')}. Enquanto isso, as mensagens recebidas são descartadas.`; icon = 'fa-triangle-exclamation';
    } else {
      state = 'on'; title = observing ? 'IA OBSERVADORA · analisando conversas' : 'IA ATIVA · pronta para atender'; detail = observing ? 'O painel e o WhatsApp estão conectados. A IA analisa mensagens elegíveis e atualiza os cards do CRM sem enviar mensagens.' : 'O painel e o WhatsApp estão conectados. Mensagens elegíveis entram na fila e são processadas em ordem.'; icon = observing ? 'fa-eye' : 'fa-circle-check';
      const ls = s.lastProcessingStatus;
      const lsAge = ls?.at ? Date.now() - Date.parse(ls.at) : Infinity;
      if (ls?.status && lsAge < 30 * 60 * 1000) {
        const label = AI_PROCESSING_LABELS[ls.status] || String(ls.status);
        const extra = ls.error ? ` (${String(ls.error).slice(0, 120)})` : '';
        detail = `Última mensagem${ls.chatName ? ` de ${String(ls.chatName).slice(0, 40)}` : ''}: ${label}${extra}.`;
        if (AI_PROCESSING_PROBLEMS.has(ls.status)) { state = 'waiting'; title = observing ? 'IA observadora precisa de atenção' : 'IA ativa, mas a última mensagem não foi respondida'; icon = 'fa-triangle-exclamation'; }
      } else if (!s.storeWatcher?.active) {
        detail = observing ? 'O painel e o WhatsApp estão conectados, mas o leitor ainda não confirmou atividade. Atualize a aba do WhatsApp Web (F5) se nenhuma análise ocorrer.' : 'O painel e o WhatsApp estão conectados, mas o leitor de mensagens ainda não confirmou atividade. Atualize a aba do WhatsApp Web (F5) se nenhuma mensagem for respondida.';
      }
    }
    const badge = document.getElementById('ai-chat-state-badge');
    if (badge) { badge.textContent = title; badge.className = `i9-state-pill ${state === 'on' ? 'is-on' : state === 'waiting' ? 'is-waiting' : 'is-off'}`; }
    const banner = document.getElementById('ai-chat-status-banner');
    if (banner) banner.className = `ai-status-banner ${state === 'on' ? 'is-on' : state === 'waiting' ? 'is-waiting' : 'is-off'}`;
    const titleEl = document.getElementById('ai-chat-status-title'); if (titleEl) titleEl.textContent = title;
    const detailEl = document.getElementById('ai-chat-status-detail'); if (detailEl) detailEl.textContent = detail;
    const iconEl = document.getElementById('ai-chat-status-icon'); if (iconEl) iconEl.className = `fas ${icon}`;
    const toggle = document.getElementById('ai-chat-toggle');
    if (toggle) {
      toggle.disabled = !s.enabled && !configured;
      const isThisModeRunning = s.enabled && !otherModeActive;
      toggle.className = `btn ${isThisModeRunning ? 'btn-danger' : 'btn-primary'}`;
      toggle.innerHTML = isThisModeRunning
        ? (observing ? '<i class="fas fa-pause"></i> Pausar IA - Observador' : '<i class="fas fa-pause"></i> Pausar IA - Atendimento')
        : otherModeActive
          ? (observing ? '<i class="fas fa-eye"></i> Alternar para IA - Observador' : '<i class="fas fa-robot"></i> Alternar para IA - Atendimento')
          : (observing ? '<i class="fas fa-eye"></i> Ativar IA - Observador' : '<i class="fas fa-play"></i> Ativar IA - Atendimento');
      toggle.title = !configured && !s.enabled ? 'Configure e teste o provedor antes de ativar.' : '';
    }
    const copy = document.getElementById('ai-chat-runtime-copy'); if (copy) copy.textContent = detail;
    const waText = `WhatsApp: ${s.whatsappConnected ? 'conectado' : 'não conectado'}`;
    const providerText = `Provedor: ${configured ? `${s.provider || 'IA'} / ${s.model || ''} · testado` : 'não testado'}`;
    const wa = document.getElementById('ai-chat-wa-status'); if (wa) wa.innerHTML = `<i class="fas fa-circle"></i> ${waText}`;
    const panel = document.getElementById('ai-chat-panel-status'); if (panel) panel.innerHTML = `<i class="fas fa-circle"></i> Painel aberto: ${s.panelActive ? 'ativo' : 'não detectado'}`;
    const last = document.getElementById('ai-chat-last-event'); if (last) last.textContent = `Última atividade: ${s.lastActivity ? new Date(s.lastActivity).toLocaleString('pt-BR') : '—'}`;
    const provider = document.getElementById('ai-chat-provider-status'); if (provider) { const p = s.lastProvider; provider.textContent = p?.provider ? `Último provedor usado: ${p.provider} · ${p.model || ''}${p.fallbackUsed ? ' (reserva)' : ''}` : providerText; }
    const q = document.getElementById('ai-chat-queue-status'); if (q) q.textContent = `Fila de entrada: ${Number(s.incomingQueueCount || 0)} pendente(s) · ${Number(s.incomingQueueNeedsAttentionCount || 0)} para revisão. Google Sheets: ${Number(s.historyQueueCount || 0)} mensagem(ns) e ${Number(s.leadSyncQueueCount || 0)} ficha(s) pendente(s).`;
    const bannerWa = document.getElementById('ai-chat-status-wa'); if (bannerWa) bannerWa.textContent = waText;
    const bannerProvider = document.getElementById('ai-chat-status-provider'); if (bannerProvider) bannerProvider.textContent = providerText;
    const bannerLast = document.getElementById('ai-chat-status-last'); if (bannerLast) bannerLast.textContent = `Última atividade: ${s.lastActivity ? new Date(s.lastActivity).toLocaleTimeString('pt-BR') : '—'}`;
    const reader = document.getElementById('ai-chat-reader-status');
    if (reader) {
      const sw = s.storeWatcher;
      const readerText = sw?.active ? `Leitura de mensagens: Store interno ativo (${sw.via || 'ok'})`
        : sw ? 'Leitura de mensagens: Store indisponível — usando a leitura pela tela (menos estável)'
        : 'Leitura de mensagens: aguardando o WhatsApp Web (atualize a aba com F5)';
      reader.innerHTML = `<i class="fas fa-circle"></i> ${readerText}`;
    }
    const lastProc = document.getElementById('ai-chat-last-processing');
    if (lastProc) {
      const ls = s.lastProcessingStatus;
      lastProc.textContent = ls?.status
        ? `Última mensagem (${ls.at ? new Date(ls.at).toLocaleTimeString('pt-BR') : '—'}${ls.chatName ? ` · ${String(ls.chatName).slice(0, 30)}` : ''}): ${AI_PROCESSING_LABELS[ls.status] || ls.status}`
        : 'Última mensagem: nenhuma recebida ainda';
    }
  }

  renderHistoryUI(config = {}) {
    const status = document.getElementById('ai-chat-history-status');
    const connect = document.getElementById('ai-chat-history-connect');
    const toggle = document.getElementById('ai-chat-history-toggle');
    const sync = document.getElementById('ai-chat-history-sync');
    const link = document.getElementById('ai-chat-history-link');
    const hasSheet = !!config.historySheetId;
    if (status) {
      let message = 'Planilha não conectada. Conecte o Google Sheets para registrar o histórico e sincronizar as fichas comerciais da IA.'; let kind = 'warning';
      if (hasSheet && config.historyEnabled && config.historyPermissionGranted === false) { message = 'Planilha configurada, mas este computador ainda precisa autorizar o Google Sheets. Clique em “Reconectar histórico”.'; kind = 'warning'; }
      else if (hasSheet && config.historyEnabled && !config.historyLastError) { message = `Histórico ativo nas abas Mensagens e Leads · ${Number(this.status?.historyQueueCount || 0)} mensagem(ns) pendente(s) · última sincronização ${config.historyLastSyncAt ? new Date(config.historyLastSyncAt).toLocaleString('pt-BR') : 'ainda não realizada'}.`; kind = 'success'; }
      else if (hasSheet && config.historyEnabled && config.historyLastError) { message = `Histórico ativo, sincronização pendente: ${String(config.historyLastError).slice(0, 180)}`; kind = 'warning'; }
      else if (hasSheet) { message = 'Registro de mensagens pausado. A aba Leads continua disponível para sincronizar a Inteligência Comercial.'; kind = 'warning'; }
      status.textContent = message; status.className = `status-badge ${kind}`;
    }
    if (connect) connect.innerHTML = hasSheet ? '<i class="fas fa-link"></i> Reconectar histórico' : '<i class="fas fa-cloud-arrow-up"></i> Criar / conectar histórico';
    if (toggle) { toggle.hidden = !hasSheet; toggle.textContent = config.historyEnabled ? 'Pausar registro' : 'Ativar registro'; toggle.className = `btn ${config.historyEnabled ? 'btn-danger' : 'btn-secondary'}`; }
    if (sync) sync.hidden = !hasSheet;
    if (link) { link.hidden = !hasSheet; link.href = config.historySheetUrl || (config.historySheetId ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(config.historySheetId)}/edit` : '#'); }
  }

  async connectHistory() {
    if (!(await this.ensureDraftSavedBeforeAuxAction())) return;
    const button = document.getElementById('ai-chat-history-connect'); const original = button?.innerHTML;
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando…'; }
    try {
      let granted = false; try { granted = await chrome.permissions.request({ origins: ['https://sheets.googleapis.com/*'] }); } catch { granted = false; }
      if (!granted) { this.app.showToast('Autorize o acesso ao Google Sheets na janela do Chrome para criar ou conectar o histórico.', 'warning', 8000); return; }
      const result = await this.app.api.sendMessage('AI_CONNECT_HISTORY');
      if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível conectar o histórico ao Google Drive.', 'error', 9000); return; }
      await this.refreshSyncStatusPreservingForm(); this.captureSavedConfigSnapshot(); this.app.showToast('Planilha conectada. As abas Mensagens e Leads estão prontas para receber o histórico e a Inteligência Comercial. As configurações da IA foram preservadas.', 'success', 8000);
    } finally { if (button) { button.disabled = false; button.innerHTML = original || 'Criar / conectar histórico'; } }
  }

  async toggleHistory() {
    if (!(await this.ensureDraftSavedBeforeAuxAction())) return;
    const enabled = !this.config?.historyEnabled;
    if (enabled && !this.config?.historySheetId) { this.app.showToast('Conecte ou crie a planilha antes de ativar o histórico.', 'warning'); return; }
    if (enabled) {
      let granted = false; try { granted = await chrome.permissions.request({ origins: ['https://sheets.googleapis.com/*'] }); } catch { granted = false; }
      if (!granted) { this.app.showToast('Autorize o acesso ao Google Sheets para registrar o histórico.', 'warning', 7000); return; }
    }
    const result = await this.app.api.sendMessage('AI_SET_HISTORY_ENABLED', { enabled });
    if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível alterar o registro do histórico.', 'error', 7000); return; }
    await this.refreshSyncStatusPreservingForm(); this.captureSavedConfigSnapshot(); this.app.showToast(enabled ? 'Registro do histórico ativado.' : 'Registro do histórico pausado. As configurações da IA foram preservadas.', 'success');
  }

  async syncHistoryNow() {
    if (!(await this.ensureDraftSavedBeforeAuxAction())) return;
    const button = document.getElementById('ai-chat-history-sync'); const original = button?.innerHTML;
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando…'; }
    try {
      const result = await this.app.api.sendMessage('AI_HISTORY_SYNC_NOW');
      if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível sincronizar o histórico.', 'error', 7000); return; }
      await this.refreshSyncStatusPreservingForm(); this.captureSavedConfigSnapshot(); this.app.showToast(`Sincronização concluída. Mensagens enviadas: ${Number(result.data?.sent || 0)}; fichas comerciais sincronizadas: ${Number(result.data?.leadSync?.sent || 0)}. As configurações da IA foram preservadas.`, 'success', 8000);
    } finally { if (button) { button.disabled = false; button.innerHTML = original || '<i class="fas fa-rotate"></i> Sincronizar pendentes'; } }
  }

  esc(value) { return this.app.toast.escapeHtml(String(value ?? '')); }
}
