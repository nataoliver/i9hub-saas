/**
 * Tour — apresentação guiada por licença (v5, i9Hub comercial 1.0.0)
 *
 * - 5 capítulos: Início · Meu negócio · Menu e CRM · Configurações · Primeiros passos.
 *   Cada passo explica "o que é", "como usar" (passo a passo) e traz uma dica.
 * - Abre sozinha na primeira vez (e uma vez quando sai uma versão nova do tour). Termina quando o usuário
 *   conclui, marca "Não mostrar novamente" ou pula 2 vezes. Pode ser revista pelo menu e em Config › Aparência.
 * - A apresentação abre as telas explicadas, sem executar operações comerciais.
 *   Ao terminar ou pular, retorna à tela onde o usuário estava antes de iniciar.
 * - Estado em chrome.storage.local, chave "onboarding": { completed, hidden, skips, ver }.
 */
const KEY = "onboarding";
const MAX_SKIPS = 2;
const TOUR_VER = 7;

const CHAPTERS = [
  { n: 1, label: "Início" },
  { n: 2, label: "Meu negócio" },
  { n: 3, label: "Menu e CRM" },
  { n: 4, label: "Configurações" },
  { n: 5, label: "Primeiros passos" },
];

// hero: "welcome" (fluxo configurar → captar → organizar → acompanhar) | "done" (comemoração)
const STEPS = [
  // ---------------------------------------------------------------- 1. INÍCIO
  { ch: 1, center: true, hero: "welcome", title: "Bem-vindo ao i9Hub!",
    text: "Vamos conhecer os recursos da versão comercial <b>1.0.0</b>: configurar seu negócio, captar contatos, organizar oportunidades no CRM, acompanhar a execução de atividades e gerenciar o WhatsApp. Você não precisa conhecer tudo para começar.",
    tip: "Leva cerca de 5–7 minutos. Use as setas ← → do teclado ou clique nos capítulos para ir direto ao assunto. <b>Esc</b> fecha." },
  { ch: 1, center: true, icon: "🗺️", title: "Como esta apresentação funciona",
    text: "Cada etapa mostra o que aquela parte faz e como usá-la. Quando possível, a apresentação abre a tela correspondente e destaca o controle explicado.",
    how: ["Use <b>Próximo</b> para avançar e <b>Voltar</b> para rever.", "Clique nos capítulos para pular direto para um assunto.", "Para repetir depois, use <b>Ver apresentação</b>; para pesquisar uma dúvida, abra <b>Tutorial e Ajuda</b> ou pressione <b>F1</b>."],
    tip: "A apresentação é demonstrativa: ela não envia mensagens, não cria campanhas e não salva alterações por você." },
  { ch: 1, center: true, icon: "🧭", title: "Funções incluídas na versão 1.0.0",
    text: "Esta versão reúne os módulos disponíveis no menu e as funções comerciais centrais do i9Hub.",
    how: ["<b>Captação:</b> extração de empresas do Google Maps e de participantes de grupos do WhatsApp.", "<b>CRM:</b> contatos em tabela ou Kanban, etapas comerciais, Lead Score, inteligência comercial por nicho/subnicho, correção dos dados de identidade com origem e confiabilidade, etiquetas, exportação CSV e webhook.", "<b>WhatsApp:</b> conexão e campanhas com personalização de mensagens, variações Spintax e intervalos.", "<b>Chat com IA:</b> respostas com contexto, escolha de conversas privadas/grupos, rodízio de provedores e qualificação automática com atualização configurável do estágio no CRM.", "<b>Relacionamento:</b> follow-ups programados, sequências de mensagens, modelos e interrupção quando o cliente responde.", "<b>Follow-ups:</b> mensagens programadas, sequências de acompanhamento, modelos e interrupção automática quando o cliente responde.", "<b>Gestão:</b> Dashboard, perfil do negócio, configurações, privacidade e backups."],
    tip: "O acesso a cada função depende das permissões da sua licença. Esta apresentação não executa ações." },

// ---------------------------------------------------------------- 2. MEU NEGÓCIO
  { ch: 2, route: "business-profile", target: ".business-profile-view", icon: "🧩", title: "Configure o CRM para o seu negócio",
    text: "Em <b>Meu negócio</b>, escolha um perfil predefinido — por exemplo, contabilidade, odontologia, advocacia, imobiliária, loja de roupas ou serviços — ou monte um perfil personalizado.",
    how: ["<b>Passo 1:</b> escolha o segmento e, se quiser, dê um nome ao perfil e descreva a empresa.", "<b>Passo 2:</b> informe como vende, quais canais usa e o tamanho da equipe.", "<b>Passo 3:</b> selecione o que deseja acompanhar.", "<b>Passo 4:</b> revise as sugestões e clique em <b>Aplicar perfil ao CRM</b>.", "Se já existe um perfil, clique em <b>Reconfigurar</b> para editar as respostas."],
    tip: "O perfil prepara sugestões de campos, linguagem, funil e módulos. Agenda, financeiro, estoque e outros recursos só devem ser usados como funções completas quando estiverem disponíveis na extensão." },

  // ---------------------------------------------------------------- 3. MENU E CRM
  { ch: 3, route: "dashboard", target: ".view-dashboard", icon: "🏠", title: "Dashboard — seu resumo",
    text: "É a tela inicial: um <b>placar</b> com campanhas em andamento, mensagens enviadas hoje, taxa de sucesso e quantos leads você já salvou.",
    how: ["Olhe aqui para saber <b>como está o trabalho</b> do dia.", "Use os botões de <b>Ações Rápidas</b> para criar campanha, extrair do Google Maps ou abrir o CRM."],
    tip: "Um “lead” é só um contato de alguém que pode virar cliente." },
  { ch: 3, route: "execution", target: ".view-execution", icon: "⚡", title: "Execução — controle de atividades",
    text: "É a central que processa os agendamentos automáticos e as tarefas em massa disparadas pelas suas campanhas e automações.",
    how: ["Acompanhe o andamento dos disparos do WhatsApp.", "Monitore as pendências do CRM."],
    tip: "Sempre que acionar uma automação, é pela aba Execução que você verá o processamento ao vivo." },
  { ch: 3, route: "maps", target: ".maps-form", icon: "📍", title: "Extração Google Maps — encontrar clientes",
    text: "Aqui você <b>busca empresas no Google Maps</b> e a extensão coleta nome, telefone, endereço, site e avaliação, salvando tudo no CRM.",
    how: ["Em <b>O que buscar?</b> escreva o tipo de negócio (ex.: <i>dentistas</i>).", "Em <b>Onde?</b> escreva a cidade (ex.: <i>Campinas, SP</i>).", "Escolha <b>quantos leads</b> quer e inicie. Deixe a aba do Google Maps aberta."],
    tip: "Comece com <b>20 leads</b> só para ver como funciona. Repetidos são ignorados automaticamente." },
  { ch: 3, route: "chats", target: ".chats-view", icon: "👥", title: "Extração Grupos do WhatsApp",
    text: "Lista seus <b>grupos do WhatsApp</b> e extrai os membros para o CRM (ou para uma planilha CSV).",
    how: ["Deixe o <b>WhatsApp Web aberto e conectado</b>.", "Abra <b>Extração Grupos do WhatsApp</b>, escolha o grupo e extraia os participantes.", "Salve no <b>CRM</b> ou baixe em <b>CSV</b>."],
    tip: "Se a lista não aparecer, clique em “Tentar novamente”." },
  { ch: 3, route: "crm", target: "#filter-stage", icon: "🗂️", title: "CRM — sua lista de leads",
    text: "O CRM é a <b>agenda inteligente</b> onde ficam todos os contatos. Veja em <b>tabela</b> ou em <b>quadro (kanban)</b>, com estes estágios: <b>Novo → Contatado → Qualificado → Proposta → Fechado</b> (ou <b>Perdido</b>).",
    how: ["Todo lead captado começa em <b>Novo</b>.", "Abra o card para revisar e corrigir nome, telefone, e-mail, empresa, categoria, endereço e site.", "Confira a origem e a confiabilidade exibidas em cada campo; correções manuais ficam protegidas contra novas sincronizações.", "Conforme a conversa evolui, use <b>Mover</b> para trocar o estágio.", "Use os <b>filtros</b> e exporte em <b>CSV</b> ou por <b>webhook</b>.", "Quem pedir para parar de receber vai para a <b>Black list</b>."],
    tip: "O estágio mostra em que ponto da negociação o contato está. O tipo é uma classificação separada." },
  { ch: 3, route: "crm", target: "#filter-type", icon: "🏷️", title: "Tipo de contato não é estágio do funil",
    text: "No CRM, <b>estágio</b> é o avanço comercial (Novo, Contatado, Proposta...). <b>Tipo</b> descreve o relacionamento: Spam, Prospecto, Cliente ou A classificar.",
    how: ["Use o filtro <b>Todos os tipos</b> para encontrar cada grupo.", "Selecione contatos e use <b>Marcar como...</b> para classificar em massa, ou abra a ficha para agir individualmente.", "A classificação automática mostra um motivo; a decisão manual tem prioridade."],
    tip: "O sistema não coloca ninguém na Black List automaticamente. E um contato a quem você já respondeu não deve virar Spam pela classificação automática." },
  { ch: 3, route: "crm", target: "#btn-manage-lead-score", icon: "📊", title: "Lead Score — priorize os melhores contatos",
    text: "O <b>Lead Score</b> calcula uma pontuação comercial de 0 a 100 com base nos sinais disponíveis no CRM e na Inteligência Comercial da IA.",
    how: ["Clique em <b>Lead Score e qualificação</b> para ajustar o peso de cada ação.", "Defina a pontuação mínima, o que é um lead quente e se precisa haver orçamento ou necessidade identificados.", "Use os filtros <b>Qualificados</b> e <b>Leads quentes</b> para priorizar o atendimento.", "Filtre por <b>Nichos/subnichos</b> ou abra a árvore de nichos para analisar os segmentos."],
    tip: "O orçamento mínimo inicial é R$ 1.000/mês, mas você pode alterá-lo. A pontuação é uma recomendação configurável, não uma garantia de venda." },
  { ch: 3, route: "crm", target: "#btn-sync-private", icon: "📲", title: "Transforme conversas privadas em oportunidades",
    text: "Com o WhatsApp Web aberto e conectado, use <b>Sincronizar PV</b> no CRM para procurar conversas individuais e registrá-las como oportunidades.",
    how: ["Abra o <b>WhatsApp Web</b> e confirme que está conectado.", "No CRM, clique em <b>Sincronizar PV</b> e aguarde a confirmação.", "Contatos que já existem devem ser atualizados sem criar duplicatas; grupos, canais e status ficam de fora."],
    tip: "Se houver erro, atualize o WhatsApp Web e a extensão e tente novamente. O resultado depende dos dados que a versão atual do WhatsApp disponibiliza." },
  { ch: 3, route: "ai-chat", target: ".ai-view", icon: "🤖", title: "Chat com IA — qualifique leads",
    text: "No Chat com IA da versão 1.0.0, escolha se o atendimento responde no privado, em grupos ou nos dois. Para grupos, selecione todos ou apenas os grupos autorizados e defina se a IA responde a menções, respostas à própria IA, palavras-chave ou todas as mensagens.",
    how: ["Cadastre a chave e o modelo do seu provedor de IA.", "Adicione provedores reserva para tentar outra chave/modelo quando uma cota acabar ou um provedor falhar.", "Escreva as instruções e a base de conhecimento aprovadas da empresa.", "Configure os critérios de qualificação, a confiança mínima e o estágio do CRM para leads qualificados."],
    tip: "A IA considera o histórico recente e a mensagem citada quando disponível. A mudança de estágio só ocorre quando encontra um único lead correspondente e a licença permite a movimentação." },
  { ch: 3, route: "campaigns-wa", target: "#new-campaign-btn", icon: "💬", title: "WhatsApp — campanhas de mensagens",
    text: "Cria <b>campanhas</b>: a mesma mensagem enviada a vários leads, com pausas para parecer natural.",
    how: ["Dê um <b>nome</b> e escreva a <b>mensagem</b>. Use <code>{{primeiro_nome}}</code> para colocar o nome da pessoa.", "Use <b>spintax</b> como <code>{Oi|Olá}</code> para variar o texto.", "Em <b>Quem vai receber</b>, marque os estágios do CRM.", "Ajuste <b>intervalos e pausas</b> e deixe o WhatsApp Web visível."],
    tip: "Teste primeiro com 3 contatos (pode ser seu próprio número) antes de enviar para todos." },
  { ch: 3, route: "dashboard", target: "#privacy-btn", icon: "👁️", title: "Privacidade — esconder dados na tela",
    text: "Desfoca <b>nomes, telefones e conversas</b>. Ideal para gravar a tela, mostrar para alguém ou trabalhar em lugar público.",
    how: ["Clique no botão para ligar e desligar.", "Atalho: <b>Alt+Shift+P</b>.", "Passar o mouse sobre um item <b>revela</b> só aquele item."],
    tip: "Só muda a aparência: não altera mensagens nem envios." },
  { ch: 3, route: "dashboard", target: "#help-btn", icon: "📖", title: "Tutorial e Ajuda — pergunte o que quiser",
    text: "Abre um painel lateral com um <b>campo de pesquisa</b>. Digite sua dúvida com suas palavras e ele mostra a resposta passo a passo.",
    how: ["Clique em <b>📖 Tutorial e Ajuda</b> (ou tecle <b>F1</b>).", "Escreva, por exemplo: <i>como fazer backup no Drive?</i>", "Leia a resposta e use o botão <b>Abrir esta tela</b> para ir direto ao lugar certo."],
    tip: "Funciona sem internet e não envia suas perguntas para lugar nenhum." },
  { ch: 3, route: "dashboard", target: ".sidebar-footer", icon: "🔑", title: "Seu plano",
    text: "Você pode explorar os módulos em modo de demonstração. Para utilizar as funções, solicite sua conta gratuita e ative a licença emitida pelo painel administrativo.",
    how: ["Sem licença, você pode conhecer a interface, mas as operações ficam bloqueadas.", "Clique em <b>Quero conta grátis</b> para solicitar a licença pelo WhatsApp.", "Depois, cole a chave recebida e a extensão liberará somente as funções autorizadas no painel."],
    tip: "Já tem a chave? Ela é colada em Configurações › Licença (vamos ver já já)." },

  { ch: 3, route: "followups", target: ".followups-view", icon: "⏰", title: "Follow-ups — não deixe oportunidades esfriarem",
    text: "Programe retornos individuais ou sequências de mensagens para acompanhar propostas e oportunidades. Os agendamentos ficam registrados no CRM e podem ser revisados antes do envio.",
    how: ["Abra um lead no CRM e entre em <b>Follow-up programado</b>.", "Escolha o prazo em minutos, horas ou dias; se preferir, informe uma data e hora específicas.", "Escreva a mensagem ou selecione um modelo. Você pode adicionar até 10 etapas.", "Confirme que possui autorização para contato quando ainda não houver consentimento registrado.", "Acompanhe os estados em <b>Follow-ups</b> e use <b>Enviar agora</b> ou <b>Reagendar</b> quando necessário."],
    tip: "O envio exige Chrome e WhatsApp Web conectados. Descadastro, Black list, spam, horário de silêncio e limites de frequência bloqueiam o envio. Uma resposta do cliente pode cancelar a sequência automaticamente." },

  // ---------------------------------------------------------------- 4. CONFIGURAÇÕES
  { ch: 4, route: "settings", target: ".settings-tabs", icon: "⚙️", title: "Configurações — visão geral",
    text: "Em Configurações ficam <b>7 abas</b>: Licença, Webhook, Delays, Spintax, Classificador, Aparência e Dados. Há também atalhos para <b>Meu negócio</b> e <b>Diagnóstico</b>.",
    how: ["Clique numa aba para abrir o conteúdo dela.", "Você <b>não precisa mexer em tudo</b> para começar: as mais importantes são <b>Licença</b> e <b>Dados</b> (backup)."],
    tip: "Você pode começar sem configurar tudo. Ajuste apenas o que seu negócio realmente precisa." },

  { ch: 4, route: "settings", tab: "classifier", target: "#spam-keywords", icon: "🏷️", title: "Classificador — revise as regras de Spam",
    text: "O classificador sugere se um contato é <b>Spam, Prospecto, Cliente ou A classificar</b>. As regras podem ser calibradas para reduzir falsos positivos.",
    how: ["Revise as palavras-chave e os limites de flood/mensagens repetidas.", "Clique em <b>Salvar regras</b> para guardar as preferências.", "Use <b>Reclassificar agora</b> apenas quando quiser reanalisar os contatos."],
    tip: "A classificação automática nunca adiciona alguém à Black List. Se você já respondeu ao contato, ele não deve ser marcado como Spam automaticamente." },

  { ch: 4, route: "settings", tab: "license", target: '.tab-btn[data-tab="license"]', icon: "🔑", title: "Aba Licença — o que é",
    text: "É onde você ativa a chave emitida pelo painel. As funcionalidades disponíveis dependem das permissões da sua licença." },
  { ch: 4, route: "settings", tab: "license", target: "#license-key", icon: "🔑", title: "Licença — como usar",
    how: ["Cole a <b>chave</b> que você recebeu neste campo (sem espaços).", "Clique em <b>Validar</b>. O resultado aparece logo abaixo.", "Ainda não tem? Clique em <b>Upgrade Pro</b>."],
    tip: "Se der erro, confira se copiou a chave inteira e se está com internet." },

  { ch: 4, route: "settings", tab: "webhook", target: '.tab-btn[data-tab="webhook"]', icon: "🔌", title: "Aba Webhook — o que é",
    text: "Um webhook é um <b>“endereço de entrega”</b>: quando você exporta leads, a extensão manda os dados para outro sistema seu (um CRM, Zapier, n8n, Make…)." ,
    tip: "Não usa outro sistema? Pode pular esta aba tranquilamente." },
  { ch: 4, route: "settings", tab: "webhook", target: "#webhook-url", icon: "🔌", title: "Webhook — como usar",
    how: ["Cole a <b>URL</b> que o outro sistema te forneceu.", "Deixe <b>POST</b> e <b>application/json</b> (são os padrões mais comuns).", "Se o sistema exigir senha, use <b>Headers</b> ou <b>API Key</b>.", "Clique em <b>Salvar</b> e depois em <b>Testar Conexão</b>."],
    tip: "O Chrome pode pedir permissão para acessar o endereço no primeiro teste: aceite." },

  { ch: 4, route: "settings", tab: "delays", target: '.tab-btn[data-tab="delays"]', icon: "⏱️", title: "Aba Delays — o que é",
    text: "“Delay” é <b>tempo de espera</b>. Aqui ficam as esperas padrão: <b>entre mensagens</b>, <b>entre contatos</b> e <b>depois de um erro</b>. Esperar um pouco deixa o envio mais natural e mais seguro." },
  { ch: 4, route: "settings", tab: "delays", target: "#delay-msg-min", icon: "⏱️", title: "Delays — como usar",
    how: ["Os valores são em <b>milissegundos</b>: <b>1000 = 1 segundo</b>.", "Cada espera tem <b>mínimo</b> e <b>máximo</b>: o sistema usa um valor entre os dois.", "Depois de mudar, clique em <b>Salvar Delays</b>."],
    tip: "Na dúvida, <b>não mexa</b>. Esperas maiores = envio mais devagar e mais seguro." },

  { ch: 4, route: "settings", tab: "spintax", target: '.tab-btn[data-tab="spintax"]', icon: "🎲", title: "Aba Spintax — o que é",
    text: "Spintax é um jeito de <b>variar a mensagem</b>: você escreve opções entre chaves, como <code>{Oi|Olá|Bom dia}</code>, e o sistema <b>sorteia uma</b> para cada pessoa. Aqui você guarda <b>modelos prontos</b> (presets)." },
  { ch: 4, route: "settings", tab: "spintax", target: "#add-preset", icon: "🎲", title: "Spintax — como usar",
    how: ["Clique em <b>Adicionar Preset</b>.", "Dê um <b>nome</b> e escreva as opções: <code>{Tudo bem?|Como vai?}</code>.", "Para apagar, use o botão de lixeira do preset."],
    tip: "A variação evita textos totalmente idênticos, mas não garante que uma campanha não seja bloqueada. Envie somente mensagens relevantes e para contatos que esperam recebê-las." },

  { ch: 4, route: "settings", tab: "appearance", target: '.tab-btn[data-tab="appearance"]', icon: "🎨", title: "Aba Aparência — o que é",
    text: "Deixa o programa <b>do seu jeito</b>: tema, tamanho dos itens, privacidade e opções do WhatsApp. Também é onde você <b>revê esta apresentação</b>." },
  { ch: 4, route: "settings", tab: "appearance", target: "#dark-theme", icon: "🌗", title: "Aparência — tema e modo compacto",
    how: ["<b>Tema Escuro</b>: fundo escuro, mais confortável à noite.", "<b>Modo Compacto</b>: itens menores, cabe mais coisa na tela."],
    tip: "A mudança é imediata e fica guardada." },
  { ch: 4, route: "settings", tab: "appearance", target: "#priv-on", icon: "🙈", title: "Aparência — modo privacidade",
    how: ["Ligue <b>Modo privacidade</b> (ou use <b>Alt+Shift+P</b>).", "Escolha o que desfocar: nomes, mensagens, fotos ou o painel da extensão.", "<b>Revelar ao passar o mouse</b> mostra só o item sob o cursor."],
    tip: "Perfeito para gravar tutoriais sem expor seus clientes." },
  { ch: 4, route: "settings", tab: "appearance", target: "#tour-replay", icon: "🎓", title: "Aparência — esta apresentação",
    how: ["<b>Rever apresentação</b> abre este tour de novo.", "A caixa acima decide se ele abre sozinho ao iniciar."] },

  { ch: 4, route: "settings", tab: "data", target: '.tab-btn[data-tab="data"]', icon: "💾", title: "Aba Dados — o que é",
    text: "Aqui ficam as <b>cópias de segurança</b>. É a aba mais importante para <b>não perder seus leads</b>." },
  { ch: 4, route: "settings", tab: "data", target: "#export-backup", icon: "💾", title: "Dados — backup manual",
    how: ["<b>Exportar Backup</b>: baixa um arquivo com tudo (guarde em local seguro).", "<b>Importar Backup</b>: carrega um arquivo salvo antes.", "<b>Limpar Tudo</b> (vermelho): <b>apaga</b> os dados deste computador. Só use se tiver certeza."],
    tip: "Faça um backup antes de usar “Limpar Tudo”." },
  { ch: 4, route: "settings", tab: "data", target: "#drive-card", icon: "☁️", title: "Dados — backup automático no Google Drive",
    text: "Guarda leads, estágios e campanhas numa pasta do <b>seu</b> Google Drive e <b>sincroniza sozinho</b>. Se trocar de computador, é só conectar a mesma conta.",
    how: ["Clique em <b>Conectar Google Drive</b>, escolha sua conta e autorize.", "Deixe <b>Sincronização automática</b> ligada. <b>Sincronizar agora</b> força uma cópia na hora.", "<b>Opções avançadas</b> (restaurar / enviar) substituem dados: use com cuidado."],
    tip: "A extensão só enxerga os arquivos que ela mesma criou no seu Drive." },

  { ch: 4, route: "settings", target: "#diagnostic-btn", icon: "🩺", title: "Botão Diagnóstico",
    text: "É uma área <b>técnica</b> que mostra registros de eventos e erros para ajudar no suporte. Os registros ficam neste navegador; confira os dados antes de exportar e compartilhar." },

  // ---------------------------------------------------------------- 5. PRIMEIROS PASSOS
  { ch: 5, center: true, icon: "✅", title: "Seus primeiros passos",
    text: "Pronto! Para começar com segurança, siga esta sequência. Você pode fazer uma etapa de cada vez.",
    how: ["<b>1. Configure Meu negócio</b> para ver sugestões adequadas ao seu segmento.", "<b>2. Faça um backup</b> em Configurações › Dados.", "<b>3. Conecte o WhatsApp Web</b> e, no CRM, teste <b>Sincronizar privadas</b>.", "<b>4. Revise o CRM:</b> mova o estágio conforme a negociação e use o Tipo para separar Spam, Prospecto, Cliente e A classificar.", "<b>5. Faça uma campanha de teste</b> pequena, com contatos que esperam receber sua mensagem."],
    tip: "O perfil inteligente sugere uma estrutura; nem todos os módulos indicados são funcionalidades operacionais completas nesta versão. Para dúvidas, use Tutorial e Ajuda ou pressione F1.",
    actions: [{ label: "🧩 Configurar meu negócio", run: "profile" }, { label: "☁️ Configurar backup no Drive", run: "drive" }, { label: "📖 Abrir Ajuda", run: "help" }] },
  { ch: 5, center: true, hero: "done", title: "Tudo pronto! 🎉",
    text: "Bom trabalho e boas vendas! Você pode rever esta apresentação e consultar as funções incluídas na versão 1.0.0 quando quiser.",
    tip: "A extensão libera somente as funções autorizadas pela licença do painel administrativo." },
];

// Apresentação exploratória da versão comercial 1.0.0. Não abre telas nem executa ações.
const ALL_MODULES_STEPS = [
  { ch: 1, center: true, hero: "welcome", title: "Funções da versão 1.0.0", text: "Conheça os recursos que fazem parte desta versão do i9Hub. Esta apresentação é explicativa: não envia mensagens, não extrai dados nem altera sua conta.", tip: "O que pode ser usado na sua conta depende das permissões da licença." },
  { ch: 2, center: true, icon: "🏠", title: "Dashboard e Meu negócio", text: "O Dashboard resume a atividade comercial e oferece atalhos para as tarefas principais. Em Meu negócio, você configura o segmento e personaliza sugestões de campos e etapas do CRM.", how: ["Acompanhe campanhas ativas, mensagens enviadas, taxa de sucesso e leads salvos.", "Use as ações rápidas para iniciar uma campanha, extrair empresas ou abrir o CRM.", "Configure o perfil comercial para adaptar a linguagem e a organização dos contatos ao seu negócio."], tip: "O perfil gera sugestões; não significa que módulos não presentes nesta versão sejam ferramentas completas." },
  { ch: 3, center: true, icon: "📍", title: "Extração Google Maps", text: "Encontre empresas por tipo de negócio e localização e reúna dados disponíveis no Google Maps para organizar a prospecção.", how: ["Defina o que buscar e a cidade ou região.", "Escolha a quantidade de leads, o raio e os detalhes que deseja coletar.", "O histórico ajuda a evitar repetir empresas já extraídas.", "Revise os resultados, confira a origem e a confiabilidade do nome e salve os contatos no CRM."], tip: "Mantenha a aba do Google Maps aberta enquanto a extração estiver em andamento." },
  { ch: 3, center: true, icon: "👥", title: "Extração Grupos do WhatsApp", text: "Consulte os grupos disponíveis na sua sessão do WhatsApp Web e extraia participantes para trabalhar os contatos no CRM.", how: ["Mantenha o WhatsApp Web aberto e conectado.", "Atualize a lista de grupos e selecione um grupo.", "Filtre os participantes por período, participação, situação ou perfil.", "Copie telefones, baixe CSV ou salve os participantes com telefone disponível no CRM."], tip: "A quantidade de dados depende das informações que o WhatsApp Web disponibiliza para sua conta." },
  { ch: 3, center: true, icon: "🗂️", title: "CRM e oportunidades", text: "Centralize leads e oportunidades, acompanhe o estágio comercial e mantenha os contatos organizados.", how: ["Alterne entre a visualização em tabela e o quadro Kanban.", "Abra o card de um lead para corrigir nome, telefone, e-mail, empresa, categoria, endereço ou site.", "No histórico do relacionamento, registre observações próprias, edite ou exclua suas anotações e acompanhe mudanças de etapa, classificação e etiquetas.", "Confira a origem e a confiabilidade de cada informação; correções manuais são protegidas contra novas sincronizações.", "Filtre e classifique contatos por tipo, origem, estágio, grupo e etiqueta.", "Personalize etapas do funil e deixe a IA organizar nichos, subnichos e etiquetas internas com base nas conversas.", "Clique em <b>Inteligência comercial</b> para comparar respostas e qualificação por segmento e receber sugestões para testes futuros.", "Revise as sugestões de consolidação de subnichos: o i9Hub só unifica nomes depois da sua confirmação.", "Sincronize conversas privadas do WhatsApp como oportunidades e sincronize etiquetas compatíveis.", "Exporte contatos em CSV ou envie dados por webhook, quando a licença permitir."], tip: "Grupos, canais e status não são tratados como conversas privadas para sincronização de oportunidades." },
  { ch: 3, center: true, icon: "📊", title: "Lead Score e qualificação", text: "Priorize contatos por pontuação comercial e ajuste os critérios para a realidade do seu negócio.", how: ["Abra o CRM e clique em Lead Score e qualificação.", "Edite os pesos de resposta, necessidade, orçamento, urgência, decisão, proposta e outros sinais.", "Defina a pontuação mínima, o orçamento mínimo mensal e os bloqueios.", "Use os filtros de qualificação e nicho/subnicho para montar listas comerciais mais específicas."], tip: "Os sinais são calculados com dados existentes. O sistema não presume orçamento ou necessidade quando essas informações não foram coletadas." },
  { ch: 3, center: true, icon: "🤖", title: "Chat com IA — versão 1.0.0", text: "Configure um atendente de IA para responder com contexto e ajudar a qualificar leads.", how: ["Escolha conversas privadas, grupos ou ambos.", "Em grupos, selecione quais grupos podem acionar a IA e escolha entre menções, respostas à própria IA, palavras-chave ou todas as mensagens.", "Configure o provedor principal e até quatro reservas para rodízio de cotas.", "Defina critérios de qualificação e o estágio do CRM para atualizar quando houver evidência suficiente."], tip: "O recurso depende de licença, chave de API, WhatsApp Web conectado e painel aberto. As chaves ficam localmente neste perfil do Chrome." },
  { ch: 3, center: true, icon: "💬", title: "WhatsApp e campanhas", text: "Conecte o WhatsApp Web e gerencie campanhas de mensagens a partir dos contatos organizados no CRM.", how: ["Crie uma campanha e personalize mensagens com campos como o primeiro nome.", "Use Spintax para preparar variações de texto.", "Defina o público e os intervalos entre envios.", "Acompanhe o andamento e os resultados da campanha."], tip: "Envie apenas mensagens apropriadas a contatos que esperam recebê-las e respeite as regras do WhatsApp." },
  { ch: 4, center: true, icon: "⚙️", title: "Configurações, privacidade e dados", text: "Ajuste as preferências da extensão e configure as integrações disponíveis nesta versão.", how: ["Configure licença, webhook, intervalos de envio e modelos Spintax.", "Revise as regras do classificador e as opções de aparência.", "Use o modo de privacidade para desfocar informações na tela.", "Faça backup manual e configure a sincronização com Google Drive quando disponível na licença."], tip: "Faça uma cópia de segurança antes de importar dados ou limpar registros." },
  { ch: 5, center: true, icon: "🔐", title: "O que sua licença libera", text: "A versão 1.0.0 contém os módulos apresentados aqui, mas cada conta pode ter permissões diferentes.", how: ["A licença é validada pelo painel administrativo.", "As funções habilitadas são exibidas conforme as permissões recebidas.", "Se uma função esperada não aparecer como liberada, peça ao suporte para conferir a configuração da licença."], tip: "A apresentação descreve recursos da versão 1.0.0 e não altera permissões da conta." },
];

export class Tour {
  constructor(app) {
    this.app = app;
    this.i = 0;
    this.el = null;
    this.prevFocus = null;
    this.startRoute = null;
    this.navigated = false;
    this.token = 0;
    this._onKey = (e) => this.onKey(e);
    this._onResize = () => this.position(false);
  }

  // ---------------------------------------------------------------- estado
  async getState() {
    let st = { completed: false, hidden: false, skips: 0, ver: 0 };
    try { st = { ...st, ...((await chrome.storage.local.get(KEY))[KEY] || {}) }; } catch { /* ignora */ }
    // versão nova do tour: quem já viu a antiga vê a nova uma vez
    if (st.ver !== TOUR_VER) { st.completed = false; st.hidden = false; st.skips = 0; }
    return st;
  }
  async setState(patch) {
    const next = { ...(await this.getState()), ...patch, ver: TOUR_VER };
    try { await chrome.storage.local.set({ [KEY]: next }); } catch { /* ignora */ }
    return next;
  }

  async init() {
    const tools = document.querySelector(".sidebar-tools") || document.querySelector(".sidebar-footer");
    if (tools && !document.getElementById("tour-btn")) {
      const b = document.createElement("button");
      b.type = "button"; b.id = "tour-btn"; b.className = "btn btn-sm btn-secondary tour-launch";
      b.title = "Ver os recursos liberados pela sua licença"; b.textContent = "❓ Ver apresentação";
      b.addEventListener("click", () => this.start());
      tools.appendChild(b);
    }
    if (tools && !document.getElementById("tour-all-btn")) {
      const all = document.createElement("button");
      all.type = "button"; all.id = "tour-all-btn"; all.className = "btn btn-sm btn-secondary tour-launch";
      all.title = "Conheça as funções presentes na versão 1.0.0 sem executar ações"; all.textContent = "Funções da versão 1.0.0";
      all.addEventListener("click", () => this.start({ allFeatures: true }));
      tools.appendChild(all);
    }
    const st = await this.getState();
    if (!st.hidden && !st.completed && st.skips < MAX_SKIPS) setTimeout(() => this.start({ auto: true }), 900);
  }

  // ---------------------------------------------------------------- abrir / fechar
  async start({ auto = false, allFeatures = false } = {}) {
    if (this.el) return;
    const st = await this.getState();
    this.allFeatures = allFeatures;
    this.steps = allFeatures ? ALL_MODULES_STEPS : this.getAvailableSteps();
    if (!this.steps.length) this.steps = STEPS.slice(0, 2);
    this.i = 0; this.auto = auto; this.navigated = false;
    this.startRoute = this.app.router?.currentRoute || "dashboard";
    this.startTab = document.querySelector(".tab-btn.active")?.dataset.tab || "";
    this.prevFocus = document.activeElement;
    const root = document.createElement("div");
    root.className = "i9-tour"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Apresentação do i9Hub");
    root.innerHTML = `<div class="i9-tour-block"></div><div class="i9-tour-spot" hidden></div>
      <div class="i9-tour-card" tabindex="-1">
        <button type="button" aria-label="Fechar" title="Fechar apresentação" data-t="close" style="position: absolute; right: 16px; top: 16px; z-index: 99; background: transparent; border: none; font-size: 20px; cursor: pointer; color: var(--text-muted);">&times;</button>
        <div class="i9-tour-progress" aria-hidden="true"><i></i></div>
        <nav class="i9-tour-chapters" aria-label="Capítulos">${this.getChapters().map((c) => `<button type="button" data-ch="${c.n}"><b>${c.n}</b> ${c.label}</button>`).join("")}</nav>
        <div class="i9-tour-scroll">
          <div class="i9-tour-hero" aria-hidden="true"></div>
          <div class="i9-tour-body" aria-live="polite"></div>
        </div>
        <label class="i9-tour-never"><input type="checkbox" id="tour-never"> Não mostrar novamente ao abrir</label>
        <div class="i9-tour-foot">
          <span class="i9-tour-count"></span>
          <span class="i9-tour-btns">
            <button type="button" class="btn btn-sm btn-secondary" data-t="skip">Pular</button>
            <button type="button" class="btn btn-sm btn-secondary" data-t="back">← Voltar</button>
            <button type="button" class="btn btn-sm btn-primary" data-t="next">Próximo →</button>
          </span>
        </div>
      </div>`;
    document.body.appendChild(root);
    this.el = root;
    root.querySelector("#tour-never").checked = !!st.hidden;
    root.addEventListener("click", (e) => {
      const ch = e.target.closest("[data-ch]");
      if (ch) { this.go(this.steps.findIndex((s) => s.ch === Number(ch.dataset.ch))); return; }
      const act = e.target.closest("[data-act]");
      if (act) { this.runAction(act.dataset.act); return; }
      const t = e.target.closest("[data-t]")?.dataset.t;
      if (t === "next") {
          this.next(); 
      } else if (t === "back") {
          this.go(this.i - 1); 
      } else if (t === "skip" || t === "close") {
          this.close("skip"); 
      }
    });
    document.addEventListener("keydown", this._onKey, true);
    window.addEventListener("resize", this._onResize);
    this.render(true);
  }

  getChapters() {
    const used = new Set((this.steps || STEPS).map((step) => step.ch));
    return CHAPTERS.filter((chapter) => used.has(chapter.n));
  }

  featureForStep(step) {
    if (!step.route) return null;
    if (step.route === "business-profile") return "business.profile";
    if (step.route === "maps") return "maps.extraction";
    if (step.route === "chats") return "whatsapp.chat_list";
    if (step.route === "ai-chat") return "whatsapp.ai_support";
    if (step.route === "followups") return "crm.followup.manage";
    if (step.route === "crm") {
      if (step.target === "#btn-sync-private") return ["crm.leads", "whatsapp.private_opportunities", "whatsapp.connection"];
      if (step.target === "#filter-stage") return ["crm.leads", "crm.kanban"];
      if (step.target === "#filter-type") return ["crm.leads", "crm.classification.manual"];
      return "crm.leads";
    }
    if (step.route === "campaigns-wa") return step.target === "#new-campaign-btn" ? ["whatsapp.connection", "whatsapp.campaigns.manage"] : "whatsapp.connection";
    if (step.route === "dashboard") {
      if (step.target === "#privacy-btn") return "settings.privacy";
      if (step.target === "#help-btn") return "help.tour";
      if (step.target === ".sidebar-footer") return null;
      return "dashboard.analytics";
    }
    if (step.route === "settings") {
      if (step.tab === "license") return null;
      if (step.tab === "classifier") return "settings.classifier";
      if (step.tab === "webhook") return "settings.webhook";
      if (step.tab === "delays") return "settings.delays";
      if (step.tab === "spintax") return "settings.spintax";
      if (step.tab === "appearance") {
        if (step.target === "#tour-replay") return "help.tour";
        if (step.target === "#priv-on") return "settings.privacy";
        return "settings.appearance";
      }
      if (step.tab === "data") {
        if (step.target === "#drive-card") return "drive.sync";
        if (step.target === "#export-backup") return "data.backup.manual";
        return "data.management";
      }
      if (step.target === "#diagnostic-btn") return "system.logs";
      return "settings.general";
    }
    return null;
  }

  getAvailableSteps() {
    const license = this.app.state?.get?.("license");
    const canUse = !!(license?.licensed && license?.entitlementsConfigured);
    if (!canUse) {
      const allowedTitles = new Set(["Bem-vindo ao i9Hub!", "Como esta apresentação funciona", "Funções incluídas na versão 1.0.0", "Seu plano", "Aba Licença — o que é", "Licença — como usar", "Tudo pronto! 🎉"]);
      return STEPS.filter((step) => allowedTitles.has(step.title));
    }
    return STEPS.filter((step) => {
      const featureId = this.featureForStep(step);
      if (!featureId) return true;
      return Array.isArray(featureId) ? featureId.every((id) => this.app.hasFeature?.(id)) : this.app.hasFeature?.(featureId);
    });
  }

  async close(reason, { stay = false } = {}) {
    if (!this.el) return;
    this.token++;
    const never = this.el.querySelector("#tour-never")?.checked;
    this.el.classList.add("i9-tour-out");
    const el = this.el; this.el = null;
    document.removeEventListener("keydown", this._onKey, true);
    window.removeEventListener("resize", this._onResize);
    setTimeout(() => el.remove(), 220);
    // volta para a tela onde o usuário estava, se o tour abriu Configurações
    if (this.navigated && !stay && this.startRoute) {
      try {
        this.app.router.navigate(this.startRoute);
        if (this.startRoute === "settings" && this.startTab) setTimeout(() => { try { this.app.views.settings?.switchTab?.(this.startTab); } catch { /* ignora */ } }, 350);
      } catch { /* ignora */ }
    } else if (!stay && this.startRoute === "settings" && this.startTab) {
      try { this.app.views.settings?.switchTab?.(this.startTab); } catch { /* ignora */ }
    }
    const st = await this.getState();
    const patch = { hidden: !!never };
    if (reason === "done") patch.completed = true;
    else if (reason === "skip" && this.auto) patch.skips = (st.skips || 0) + 1;
    await this.setState(patch);
    try { this.prevFocus?.focus?.(); } catch { /* ignora */ }
  }

  next() { if (this.i >= this.steps.length - 1) this.close("done"); else this.go(this.i + 1); }
  go(n) { this.i = Math.max(0, Math.min(this.steps.length - 1, n)); this.render(false); }

  onKey(e) {
    if (!this.el) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.close("skip"); }
    else if (e.key === "ArrowRight") { e.preventDefault(); this.next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); this.go(this.i - 1); }
  }

  runAction(name) {
    if (name === "profile") {
      this.close("done", { stay: true });
      this.app.router.navigate("business-profile");
    } else if (name === "drive") {
      this.close("done", { stay: true });
      this.app.router.navigate("settings");
      setTimeout(() => this.app.views.settings?.switchTab?.("data"), 450);
    } else if (name === "help") {
      this.close("done");
      setTimeout(() => this.app.help?.show(), 320);
    }
  }

  // ---------------------------------------------------------------- preparar a tela do passo
  waitFor(sel, ms = 1800) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        const n = document.querySelector(sel);
        if (n) return resolve(n);
        if (Date.now() - t0 > ms) return resolve(null);
        setTimeout(tick, 60);
      };
      tick();
    });
  }
  async prepare(s) {
    if (this.allFeatures) return; // tour explicativo: nunca abre telas nem controles bloqueados
    if (s.route && this.app.router.currentRoute !== s.route) { this.navigated = true; this.app.router.navigate(s.route); }
    if (s.tab) {
      await this.waitFor(`.tab-btn[data-tab="${s.tab}"]`);
      try { this.app.views.settings?.switchTab?.(s.tab); } catch { /* ignora */ }
    }
    if (s.target) await this.waitFor(s.target, 1500);
  }

  // ---------------------------------------------------------------- desenho
  heroHTML(kind) {
    if (kind === "welcome") {
      return `<div class="i9-flow"><span class="n n1">🧩<small>Configurar</small></span><i class="ln"><b></b></i><span class="n n2">📍<small>Captar</small></span><i class="ln"><b></b></i><span class="n n3">🗂️<small>Organizar</small></span><i class="ln"><b></b></i><span class="n n4">🔁<small>Acompanhar</small></span></div>
        <i class="i9-tour-spark s1">✦</i><i class="i9-tour-spark s2">✦</i><i class="i9-tour-spark s3">✦</i>`;
    }
    if (kind === "done") {
      return `<span class="i9-tour-logo i9-tour-big">🏆</span>` + Array.from({ length: 12 }, (_, k) => `<i class="i9-confetti c${k % 6}" style="left:${6 + k * 7.6}%;animation-delay:${(k % 5) * 0.18}s"></i>`).join("");
    }
    return "";
  }

  async render(first) {
    if (!this.el) return;
    const my = ++this.token; const s = this.steps[this.i];
    const card = this.el.querySelector(".i9-tour-card");
    const last = this.i === this.steps.length - 1;
    const hero = this.el.querySelector(".i9-tour-hero");
    hero.innerHTML = this.heroHTML(s.hero); hero.style.display = s.hero ? "" : "none";
    const actions = s.actions || (s.action && s.action.run ? [s.action] : []);
    this.el.querySelector(".i9-tour-body").innerHTML =
      `<h3 class="i9-tour-title">${s.hero ? "" : `<span class="i9-tour-ico">${s.icon}</span> `}${s.title}</h3>` +
      (s.text ? `<p class="i9-tour-text">${s.text}</p>` : "") +
      (s.how ? `<div class="i9-tour-how"><div class="i9-tour-how-h">Como usar</div><ol>${s.how.map((h) => `<li>${h}</li>`).join("")}</ol></div>` : "") +
      (s.tip ? `<div class="i9-tour-tip"><span>💡</span><div>${s.tip}</div></div>` : "") +
      (actions.length ? `<div class="i9-tour-acts">${actions.map((a) => `<button type="button" class="btn btn-sm btn-primary i9-tour-act" data-act="${a.run}">${a.label}</button>`).join("")}</div>` : "");
    this.el.querySelector(".i9-tour-progress i").style.width = ((this.i + 1) / this.steps.length * 100) + "%";
    this.el.querySelectorAll("[data-ch]").forEach((b) => { const n = Number(b.dataset.ch); b.classList.toggle("on", n === s.ch); b.classList.toggle("past", n < s.ch); });
    this.el.querySelector(".i9-tour-count").textContent = "Passo " + (this.i + 1) + " de " + this.steps.length;
    this.el.querySelector('[data-t="back"]').style.visibility = this.i === 0 ? "hidden" : "visible";
    this.el.querySelector('[data-t="skip"]').style.display = last ? "none" : "";
    this.el.querySelector('[data-t="next"]').textContent = last ? "Concluir ✓" : (this.i === 0 ? "Começar →" : "Próximo →");
    card.classList.remove("i9-tour-pop"); void card.offsetWidth; card.classList.add("i9-tour-pop");
    if (first) this.el.classList.add("i9-tour-notrans");
    await this.prepare(s);
    if (!this.el || my !== this.token) return;           // o usuário já mudou de passo
    this.position(first);
    if (first) requestAnimationFrame(() => requestAnimationFrame(() => this.el?.classList.remove("i9-tour-notrans")));
    this.el.querySelector('[data-t="next"]').focus({ preventScroll: true });
  }

  /** Posiciona o destaque e o cartão. Sem alvo visível (ex.: menu escondido em janela estreita) → cartão centralizado. */
  position() {
    if (!this.el) return;
    const s = this.steps[this.i]; const spot = this.el.querySelector(".i9-tour-spot"); const card = this.el.querySelector(".i9-tour-card");
    const vw = window.innerWidth; const vh = window.innerHeight; const pad = 12;
    let r = null;
    if (s.target && !s.center) {
      const t = document.querySelector(s.target);
      if (t) { try { t.scrollIntoView({ block: "nearest" }); } catch { /* ignora */ } const b = t.getBoundingClientRect(); if (b.width > 0 && b.height > 0 && b.right > 0 && b.left < vw && b.bottom > 0 && b.top < vh) r = b; }
    }
    const cw = Math.min(420, vw - 24);
    card.style.width = cw + "px";
    card.style.maxHeight = (vh - 24) + "px";
    if (!r) {
      spot.hidden = true; this.el.classList.add("i9-tour-dim");
      card.style.left = Math.max(12, (vw - cw) / 2) + "px";
      card.style.top = Math.max(12, (vh - card.offsetHeight) / 2) + "px";
      return;
    }
    this.el.classList.remove("i9-tour-dim");
    spot.hidden = false;
    spot.style.left = r.left - 6 + "px"; spot.style.top = r.top - 6 + "px";
    spot.style.width = r.width + 12 + "px"; spot.style.height = r.height + 12 + "px";
    let ch = card.offsetHeight; let left; let top;
    const below = vh - r.bottom - 16 - pad; const above = r.top - 16 - pad;
    if (vw - r.right >= cw + 30) { left = r.right + 18; top = r.top + r.height / 2 - ch / 2; }       // à direita
    else if (below >= ch) { left = r.left; top = r.bottom + 16; }                                    // abaixo
    else if (above >= ch) { left = r.left; top = r.top - ch - 16; }                                  // acima
    else if (r.left >= cw + 30) { left = r.left - cw - 18; top = r.top + r.height / 2 - ch / 2; }    // à esquerda
    else if (Math.max(below, above) >= 220) {                                                        // alvo grande: usa o maior espaço livre e rola dentro do cartão
      const useBelow = below >= above; card.style.maxHeight = Math.max(below, above) + "px"; ch = card.offsetHeight;
      left = r.left; top = useBelow ? r.bottom + 16 : r.top - ch - 16;
    } else { left = (vw - cw) / 2; top = (vh - ch) / 2; }
    card.style.left = Math.max(pad, Math.min(left, vw - cw - pad)) + "px";
    card.style.top = Math.max(pad, Math.min(top, vh - ch - pad)) + "px";
  }
}
