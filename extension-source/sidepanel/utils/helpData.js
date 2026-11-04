/**
 * Base de conhecimento da Ajuda (v1.6.0-pro).
 * Cada tópico: { id, sec, icon, title, kw, a, steps?, tip?, go? }
 *  - kw: palavras-chave e sinônimos (a busca ignora acentos e maiúsculas)
 *  - a: resposta curta (HTML simples)
 *  - steps: passo a passo numerado
 *  - go: { route, tab?, label } -> botão "Abrir esta tela"
 */
export const SECTIONS = [
  { id: "start", icon: "🚀", title: "Comece aqui" },
  { id: "business", icon: "🧩", title: "Meu negócio e perfil inteligente" },
  { id: "crm", icon: "🗂️", title: "CRM e classificação" },
  { id: "private", icon: "📲", title: "WhatsApp privado e oportunidades" },
  { id: "maps", icon: "📍", title: "Extração Google Maps" },
  { id: "chats", icon: "👥", title: "Extração Grupos do WhatsApp" },
  { id: "wa", icon: "💬", title: "Campanhas WhatsApp" },
  { id: "ai", icon: "🤖", title: "Chat com IA e qualificação de leads" },
  { id: "cfg", icon: "⚙️", title: "Configurações" },
  { id: "fix", icon: "🛟", title: "Deu algum problema?" },
];

export const TOPICS = [
  // ------------------------------------------------------------------ Começando
  { id: "inicio", boost: 2, sec: "start", icon: "🚀", title: "Por onde começar (3 passos)",
    kw: "comecar iniciar inicio primeiros passos tutorial novato iniciante basico como usar funciona o que e para que serve",
    a: "O i9Hub ajuda a <b>configurar o seu negócio</b>, captar ou receber contatos, organizá-los no CRM e acompanhar conversas e campanhas. Para começar, siga esta ordem.",
    steps: [
      "<b>Configure:</b> abra <b>Meu negócio</b> e escolha um perfil predefinido ou personalizado.",
      "<b>Proteja:</b> abra <b>Config › Dados</b> e configure um backup.",
      "<b>Receba contatos:</b> use <b>Extração Google Maps</b> para captar empresas ou conecte o WhatsApp e sincronize conversas privadas no CRM.",
      "<b>Organize:</b> no CRM, mova o estágio conforme a negociação e use o campo <b>Tipo</b> para separar Spam, Prospecto, Cliente e A classificar.",
      "<b>Comunique:</b> crie uma campanha pequena apenas para contatos apropriados e que possam esperar sua mensagem.",
    ],
    tip: "O perfil inteligente sugere campos, terminologia e um funil. Nem todos os módulos sugeridos (por exemplo, agenda, estoque ou financeiro) são ferramentas completas nesta versão.",
    go: { route: "business-profile", label: "Configurar Meu negócio" } },

  { id: "menu", sec: "start", icon: "🧭", title: "Para que serve cada item do menu lateral",
    kw: "menu lateral barra itens botoes navegacao dashboard whatsapp crm maps chats config privacidade",
    a: "O menu à esquerda é o seu painel de controle. Clique num item para trocar de tela:",
    steps: [
      "<b>Dashboard</b>: resumo (campanhas ativas, envios de hoje, taxa de sucesso e leads salvos) e atalhos.",
      "<b>WhatsApp</b>: cria e acompanha campanhas de mensagens.",
      "<b>CRM</b>: sua lista de leads, em tabela ou quadro.",
      "<b>Extração Google Maps</b>: capta leads de empresas.",
      "<b>Extração Grupos do WhatsApp</b>: lista grupos e extrai participantes.",
      "<b>Chat com IA</b>: responde com contexto, qualifica leads e pode mover o estágio do CRM conforme a configuração.",
      "<b>Meu negócio</b>: escolha ou personalize o perfil do seu segmento.",
      "<b>Config</b>: licença, webhook, tempos, spintax, classificador, aparência, dados e Drive.",
      "<b>Tutorial e Ajuda</b>: trilha inicial, busca e artigos passo a passo.",
    ],
    tip: "Embaixo do menu ficam Privacidade, Ver apresentação, Tutorial e Ajuda e as informações do plano." },

  { id: "dashboard", sec: "start", icon: "🏠", title: "Dashboard: o que significam os números",
    kw: "dashboard painel resumo estatisticas numeros campanhas ativas enviadas hoje taxa sucesso leads salvos acoes rapidas",
    a: "É a tela inicial. Mostra <b>Campanhas Ativas</b>, <b>Mensagens Enviadas Hoje</b>, <b>Taxa de Sucesso</b> e <b>Leads Salvos</b>. Embaixo ficam as <b>Ações Rápidas</b> (nova campanha, extrair do Google Maps, ver CRM) e as <b>Campanhas Recentes</b>.",
    go: { route: "dashboard", label: "Abrir o Dashboard" } },

  { id: "plano", sec: "start", icon: "🔑", title: "Conta gratuita e licença",
    kw: "plano gratuito free pro licenca acoes limite 3 upgrade obter comprar ilimitado saldo quantas vezes",
    a: "Sem licença, você pode explorar os módulos em modo de demonstração, mas não pode executar operações. Clique em <b>Quero conta grátis</b> para abrir o WhatsApp com uma mensagem pronta. Depois que o atendimento cadastrar/liberar a licença no painel, cole a chave recebida na extensão. Cada funcionalidade será liberada conforme as permissões dessa licença.",
    steps: ["Clique em <b>Obter licença</b> no rodapé do menu (ou em Config › Licença).", "Receba a chave e cole em <b>Config › Licença</b>.", "Clique em <b>Validar</b>."],
    go: { route: "settings", tab: "license", label: "Abrir Licença" } },

  // ------------------------------------------------------------------ Meu negócio e perfil inteligente
  { id: "business-profile", boost: 5, sec: "business", icon: "🧩", title: "Configurar meu negócio (perfil inteligente)",
    kw: "perfil inteligente meu negocio segmento setor nicho tipo negocio questionario configurar perfil imobiliaria corretor contabilidade dentista odontologia advogado advocacia loja roupas salão barbearia academia servicos personalizado",
    a: "O perfil inteligente ajuda a preparar o i9Leads para o seu segmento. Você pode escolher uma opção pronta ou montar um perfil personalizado.",
    steps: [
      "Abra <b>Meu negócio</b> no menu lateral.",
      "Escolha o segmento mais próximo (por exemplo, imobiliária, contabilidade, odontologia, advocacia, loja de roupas ou serviços). Se não encontrar, escolha <b>Outro / personalizado</b>.",
      "No perfil personalizado, descreva o que a empresa faz. Depois responda como vende, quais canais usa e o que deseja controlar.",
      "Revise a sugestão de módulos, campos, linguagem e funil.",
      "Clique em <b>Aplicar perfil ao CRM</b>. Para alterar depois, volte a <b>Meu negócio</b> e clique em <b>Reconfigurar</b>.",
    ],
    tip: "O perfil prepara sugestões e campos. Ele não transforma automaticamente agenda, financeiro, estoque, processos ou tratamentos em módulos operacionais completos; verifique quais recursos já existem na versão instalada.",
    go: { route: "business-profile", label: "Configurar meu negócio" } },

  { id: "business-custom", sec: "business", icon: "🪄", title: "Criar ou alterar um perfil personalizado",
    kw: "perfil personalizado outro descrever empresa perguntas modelo negocio editar alterar reconfigurar trocar segmento",
    a: "Escolha <b>Outro / personalizado</b> em Meu negócio e descreva a operação com palavras simples. Exemplo: “Sou corretor autônomo, trabalho com venda e aluguel e preciso organizar interessados e visitas”. O assistente usa a descrição como pista e permite revisar as respostas antes de aplicar.",
    steps: ["Abra <b>Meu negócio</b>.", "Clique em <b>Reconfigurar</b> se já houver um perfil ativo.", "Escolha <b>Outro / personalizado</b>, escreva a descrição e responda às perguntas.", "Na etapa Revisão, confira as sugestões antes de aplicar."],
    tip: "Você pode combinar diferentes modelos de receita e selecionar mais de uma operação. O perfil pode ser revisto depois; não precisa acertar tudo na primeira tentativa.",
    go: { route: "business-profile", label: "Abrir Meu negócio" } },

  // ------------------------------------------------------------------ Maps
  { id: "maps-extrair", boost: 3, sec: "maps", icon: "📍", title: "Como extrair leads do Google Maps",
    kw: "maps google extrair captar coletar buscar leads empresas negocios clientes pesquisar nicho cidade raspar scraping prospectar",
    a: "A extensão pesquisa no Google Maps e salva nome, telefone, endereço, site e avaliação direto no seu CRM.",
    steps: [
      "Abra <b>Extração Google Maps</b> no menu.",
      "Em <b>O que buscar?</b> escreva o nicho (ex.: <i>restaurantes</i>, <i>dentistas</i>).",
      "Em <b>Onde?</b> escreva a cidade (ex.: <i>Campinas, SP</i>).",
      "Escolha <b>quantos leads novos</b> você quer (20, 50, 100, 200 ou 500, ou digite o número).",
      "Clique para iniciar e <b>deixe a aba do Google Maps aberta</b> até terminar.",
      "Quando acabar, os leads estão no <b>CRM</b>, no estágio <b>Novo</b>.",
    ],
    tip: "Comece com 20 leads para ver como funciona. Quantidades grandes levam vários minutos.",
    go: { route: "maps", label: "Abrir Extração Google Maps" } },

  { id: "maps-qtd", sec: "maps", icon: "🎯", title: "Quantidade de leads e raio de busca",
    kw: "quantidade quantos leads raio km 120 limite resultados poucos faltou area vizinha bairro grande cidade",
    a: "O campo <b>Quantos leads novos você quer?</b> aceita de 1 a 5000. O Google Maps costuma parar em cerca de <b>120 resultados</b> por busca; para passar disso a extensão repete a busca em áreas vizinhas, <b>dentro do Raio de busca</b> (padrão 5 km).",
    tip: "Quer 200 ou mais em cidade grande? Aumente o raio para 10 a 20 km. Se o raio acabar antes da meta, a extensão avisa.",
    go: { route: "maps", label: "Abrir Extração Google Maps" } },

  { id: "maps-repetidos", sec: "maps", icon: "♻️", title: "Leads repetidos e o histórico de extrações",
    kw: "repetido repetidos duplicado duplicados historico limpar nao repetir ja extraidos mesmo lead de novo",
    a: "Com <b>Não repetir leads já extraídos antes</b> ligado (padrão), o lead que já veio em outra busca é ignorado e <b>não conta</b> na sua quantidade. O histórico é separado do CRM: apagar o lead do CRM não o faz voltar. O botão <b>Limpar histórico</b> zera só o histórico (não mexe no CRM).",
    go: { route: "maps", label: "Abrir Extração Google Maps" } },

  { id: "maps-opcoes", sec: "maps", icon: "🔧", title: "Opções da Extração Google Maps: detalhes, avaliações, e-mails e telefones",
    kw: "opcoes detalhes site email e-mail telefone avaliacoes reviews buscar emails no site buscar telefones no site extrair mais dados",
    a: "<b>Extrair detalhes</b> pega site, e-mail e telefone do cartão do lugar. <b>Extrair avaliações</b> traz a nota e comentários. <b>Buscar e-mails / telefones no site</b> visita o site da empresa atrás de contatos extras. Quanto mais opções ligadas, mais completo o lead, porém <b>mais devagar</b> a extração.",
    go: { route: "maps", label: "Abrir Extração Google Maps" } },

  // ------------------------------------------------------------------ Chats
  { id: "chats", sec: "chats", icon: "👥", title: "Como extrair membros de grupos do WhatsApp",
    kw: "chats grupos grupo membros participantes extrair whatsapp contatos csv salvar crm listar baixar",
    a: "Liste seus grupos do WhatsApp, extraia os membros e salve no CRM (ou baixe em CSV).",
    steps: [
      "Deixe o <b>WhatsApp Web aberto e conectado</b> (QR Code lido).",
      "Abra <b>Extração Grupos do WhatsApp</b> no menu: seus grupos aparecem na lista.",
      "Escolha o grupo e extraia os participantes.",
      "Salve no <b>CRM</b> ou baixe em <b>CSV</b>.",
    ],
    tip: "Se a lista não carregar, clique em <b>Tentar novamente</b> e confira se o WhatsApp Web está conectado.",
    go: { route: "chats", label: "Abrir Extração Grupos do WhatsApp" } },

  // ------------------------------------------------------------------ CRM
  { id: "crm-visao", boost: 2, sec: "crm", icon: "🗂️", title: "CRM: tabela, quadro (kanban) e estágios",
    kw: "crm leads lista tabela quadro kanban estagios niveis funil novo contatado qualificado proposta fechado perdido organizar",
    a: "O CRM guarda os contatos e oportunidades. Você alterna entre <b>tabela</b> e <b>Kanban</b>. O estágio mostra o avanço comercial: <b>Novo</b> → <b>Contatado</b> → <b>Qualificado</b> → <b>Proposta</b> → <b>Fechado</b> ou <b>Perdido</b>. O campo <b>Tipo</b> é separado do estágio e classifica o relacionamento.",
    tip: "Atualize o estágio conforme a negociação avança. Use o Tipo para separar Spam, Prospecto, Cliente e A classificar; são duas informações diferentes.",
    go: { route: "crm", label: "Abrir CRM" } },

  { id: "crm-classificacao", boost: 4, sec: "crm", icon: "🏷️", title: "Tipo do contato: Spam, Prospecto, Cliente ou A classificar",
    kw: "tipo classificacao classificar spam prospecto cliente a classificar badge cor filtro motivo manual massa marcar como estágio estagio funil",
    a: "O campo <b>Tipo</b> é separado do estágio. Ele ajuda a distinguir o relacionamento sem mover o cartão no Kanban.",
    steps: ["No CRM, veja os contadores e os badges de tipo nos contatos.", "Use o filtro <b>Todos os tipos</b> para exibir apenas uma categoria.", "Para mudar manualmente, selecione um contato ou vários e clique em <b>Marcar como...</b>.", "Passe o mouse sobre o badge para consultar o motivo da classificação automática, quando disponível."],
    tip: "A decisão manual tem prioridade. A automação não adiciona contatos à Black List. Pela regra de segurança, alguém a quem você já respondeu não deve ser marcado como Spam automaticamente.",
    go: { route: "crm", label: "Abrir CRM" } },

  { id: "crm-mover", sec: "crm", icon: "↔️", title: "Como mudar o estágio de um lead",
    kw: "mover estagio nivel lead mudar trocar status etapa kanban arrastar",
    a: "No quadro, use o botão <b>Mover</b> do cartão e escolha o novo estágio. Clique em <b>Ver</b> para abrir a ficha do lead. Na campanha, você também pode pedir para mover o lead <b>automaticamente depois do envio</b>.",
    go: { route: "crm", label: "Abrir CRM" } },

  { id: "crm-exportar", sec: "crm", icon: "📤", title: "Filtrar, exportar e usar leads numa campanha",
    kw: "filtrar filtro origem etiqueta grupo exportar csv excel planilha webhook selecionar selecao enviar para campanha baixar",
    a: "Filtre por <b>origem</b>, <b>etiqueta</b> e <b>grupo</b>. Marque os leads desejados para <b>exportar em CSV</b>, enviar por <b>webhook</b> ou usar como público da campanha (aparece como <b>Seleção do CRM</b>).",
    go: { route: "crm", label: "Abrir CRM" } },

  { id: "blacklist", sec: "crm", icon: "🚫", title: "Black list: quem não deve receber mensagens",
    kw: "black list blacklist bloquear nao enviar proibido parar de receber sair opt out descadastrar remover",
    a: "Colocar um contato na <b>Black list</b> o tira de todas as campanhas (novas e pendentes) e o move para o estágio <b>Black list</b>. No WhatsApp Web, passe o mouse numa mensagem recebida e clique no botão <b>Black list</b>. No CRM, use o botão da Black list para ver, adicionar e remover números.",
    tip: "Respeitar quem pede para parar de receber evita denúncias e protege seu número.",
    go: { route: "crm", label: "Abrir CRM" } },

  // ------------------------------------------------------------------ WhatsApp privado e oportunidades
  { id: "private-opportunities", boost: 5, sec: "private", icon: "📲", title: "Transformar conversas privadas em oportunidades no CRM",
    kw: "whatsapp privado conversa conversas sincronizar sincronizacao oportunidade oportunidades chat individual criar lead automatico telefone contato sincronizar privadas erro zero",
    a: "O botão <b>Sincronizar privadas</b> pede à extensão para ler as conversas individuais disponíveis no WhatsApp Web e registrá-las como oportunidades no CRM.",
    steps: ["Abra <b>web.whatsapp.com</b> e confirme que a conta está conectada.", "Abra o i9Leads e entre em <b>CRM</b>.", "Clique em <b>Sincronizar privadas</b> e aguarde a mensagem de resultado.", "Confira o filtro de origem <b>Oportunidades WhatsApp</b> e os contadores do CRM."],
    tip: "A extensão tenta evitar duplicatas e não deve alterar o estágio de um lead existente. Grupos, canais e status não são oportunidades privadas. A leitura depende do que a versão atual do WhatsApp Web disponibiliza.",
    go: { route: "crm", label: "Abrir CRM" } },

  // ------------------------------------------------------------------ WhatsApp
  { id: "camp-criar", boost: 3, sec: "wa", icon: "💬", title: "Como criar e enviar uma campanha no WhatsApp",
    kw: "campanha whatsapp criar nova enviar mensagem disparo disparar massa lista envio em massa comecar campanha",
    a: "Uma campanha envia a mesma mensagem (personalizada) para vários leads, com pausas para parecer natural.",
    steps: [
      "Abra <b>WhatsApp</b> no menu e clique em nova campanha.",
      "Dê um <b>nome</b> (ex.: <i>Promoção de outubro</i>).",
      "Escreva a <b>mensagem</b> (veja “Variáveis e spintax”).",
      "Em <b>Quem vai receber</b>, escolha os estágios do CRM, a seleção do CRM ou cole uma lista.",
      "Ajuste <b>intervalos e pausas</b> (ou mantenha os padrões).",
      "Deixe o <b>WhatsApp Web visível</b> e inicie.",
    ],
    tip: "Faça um teste com 3 ou 5 contatos (inclusive o seu próprio número) antes de enviar para a lista toda.",
    go: { route: "campaigns-wa", label: "Abrir Campanhas WhatsApp" } },

  { id: "camp-variaveis", boost: 2, sec: "wa", icon: "✨", title: "Variáveis e spintax (mensagem personalizada)",
    kw: "variavel variaveis spintax nome primeiro_nome empresa telefone estagio etiqueta personalizar chaves variacao sorteio {oi|ola} mensagem diferente",
    a: "<b>Variáveis</b> são trocadas pelos dados do lead: <code>{{nome}}</code>, <code>{{primeiro_nome}}</code>, <code>{{empresa}}</code>, <code>{{telefone}}</code>, <code>{{estagio}}</code> e <code>{{etiqueta}}</code>. Use os botões abaixo do campo para inserir. <b>Spintax</b> sorteia uma opção entre chaves: <code>{Oi|Olá|E aí}</code>.",
    steps: [
      "Exemplo: <code>{Oi|Olá} {{primeiro_nome}}! {Tudo bem?|Como vai?}</code>",
      "Cada contato recebe uma versão ligeiramente diferente, por exemplo “Olá Maria! Como vai?”.",
    ],
    tip: "Mensagens todas iguais chamam atenção do WhatsApp. Use spintax em saudação e despedida.",
    go: { route: "campaigns-wa", label: "Abrir Campanhas WhatsApp" } },

  { id: "camp-publico", sec: "wa", icon: "🎯", title: "Quem vai receber: nível do CRM, seleção ou lista colada",
    kw: "publico quem vai receber destinatarios estagios nivel crm selecao colar lista numeros importar",
    a: "Há três formas de escolher o público: <b>Por nível do CRM</b> (marque os estágios, ex.: só <i>Novo</i>), <b>Seleção do CRM</b> (leads que você marcou no CRM) ou <b>Colar lista</b> (números digitados à mão). A <b>Black list</b> nunca recebe mensagens e os contatos classificados como <b>Spam</b> ficam excluídos por padrão; só inclua Spam se marcar a opção explícita para isso.",
    go: { route: "campaigns-wa", label: "Abrir Campanhas WhatsApp" } },

  { id: "camp-intervalos", sec: "wa", icon: "⏱️", title: "Intervalos, pausas e horário de envio",
    kw: "intervalo intervalos pausa pausar minimo maximo segundos horario das ate janela tempo entre mensagens devagar rapido lote",
    a: "<b>Intervalo mín./máx.</b> é o tempo (em segundos) sorteado entre uma mensagem e a próxima. <b>Pausar a cada X mensagens</b> faz uma <b>pausa de Y minutos</b>. Em <b>Enviar apenas dentro de um horário</b> você define <b>Das</b> e <b>Até</b>: fora dessa janela a campanha espera.",
    tip: "Quanto mais devagar e com mais variação, mais seguro. Para começar: 20 a 40 segundos entre mensagens e pausa de 3 minutos a cada 20.",
    go: { route: "campaigns-wa", label: "Abrir Campanhas WhatsApp" } },

  { id: "camp-mover", sec: "wa", icon: "➡️", title: "Mover o lead de estágio depois do envio",
    kw: "mover depois enviar estagio automatico contatado atualizar status apos envio",
    a: "No campo <b>Depois de enviar, mover o lead para</b> escolha, por exemplo, <b>Contatado</b>. Cada lead que receber a mensagem muda de estágio sozinho, e você não manda para a mesma pessoa duas vezes sem querer.",
    go: { route: "campaigns-wa", label: "Abrir Campanhas WhatsApp" } },

  { id: "camp-visivel", sec: "wa", icon: "👀", title: "O WhatsApp precisa ficar aberto durante o envio?",
    kw: "whatsapp visivel aberto segundo plano minimizado coberto aba oculta janela conectado qr code precisa ficar aberto",
    a: "Sim: o <b>WhatsApp Web precisa estar aberto e conectado</b>. Por padrão a extensão envia mesmo com a janela coberta, minimizada ou em outra aba (<b>Enviar em segundo plano</b>), mas pode ficar <b>mais lenta</b>, pois o Chrome reduz o ritmo de páginas ocultas. Se o WhatsApp não estiver visível ao iniciar, a extensão pergunta se pode trazê-lo para frente.",
    go: { route: "settings", tab: "appearance", label: "Ver opções de WhatsApp" } },

  { id: "camp-seguranca", sec: "wa", icon: "🛡️", title: "Boas práticas para não ter o número bloqueado",
    kw: "bloqueio bloqueado banido banir spam seguranca risco dicas boas praticas cuidado numero denuncia",
    a: "Nenhuma ferramenta elimina totalmente o risco de bloqueio, mas estes hábitos ajudam muito:",
    steps: [
      "Comece <b>pouco a pouco</b> (dezenas por dia) e aumente com o tempo.",
      "Use <b>spintax</b> e variáveis para as mensagens não serem idênticas.",
      "Mantenha <b>intervalos longos</b> e pausas.",
      "Envie só para quem <b>pode ter interesse</b> e coloque na <b>Black list</b> quem pedir para parar.",
      "Termine a mensagem convidando a pessoa a responder.",
    ] },


  // ------------------------------------------------------------------ Chat com IA
  { id: "ai-chat-setup", boost: 4, sec: "ai", icon: "🤖", title: "Configurar o Chat com IA e qualificar leads",
    kw: "chat ia inteligência artificial atendimento automatico bot responder whatsapp privado grupo menção mencao resposta citada provedor api key chave gratuita paga rodizio fallback token cota qualificar lead estagio crm",
    a: "O <b>Chat com IA</b> responde a mensagens novas da conversa aberta no WhatsApp Web, usando o histórico recente para manter o contexto. Também pode avaliar a intenção comercial e registrar a qualificação do lead no CRM.",
    steps: [
      "Abra <b>Chat com IA</b> no menu lateral e escolha se responde em conversas privadas, grupos ou ambos.",
      "Para grupos, prefira <b>Somente quando responderem à mensagem da IA ou mencionarem a conta</b>. O modo de todas as mensagens pode gerar muito volume.",
      "Escolha um provedor e modelo, informe a chave da API e clique em <b>Autorizar e testar</b>. Você pode cadastrar até quatro provedores reserva para rodízio quando houver limite de uso ou indisponibilidade.",
      "Preencha o nome da empresa, as instruções do atendente e a base de conhecimento com informações aprovadas.",
      "Ative a qualificação, configure os critérios, a confiança mínima e o estágio do CRM. O estágio só muda se o lead for identificado sem ambiguidade e as permissões permitirem a movimentação.",
      "Conecte o WhatsApp Web e mantenha o painel aberto. Comece testando com poucos contatos autorizados."
    ],
    tip: "As chaves ficam no armazenamento local deste perfil do Chrome, mas as mensagens e o contexto necessários são enviados ao provedor de IA escolhido. Planos gratuitos têm limites próprios; o rodízio usa apenas chaves que você cadastrou e não cria créditos gratuitos.",
    go: { route: "ai-chat", label: "Abrir Chat com IA" } },

  // ------------------------------------------------------------------ Configurações
  { id: "cfg-licenca", sec: "cfg", icon: "🔑", title: "Config › Licença",
    kw: "configuracoes licenca chave validar ativar upgrade pro codigo",
    a: "Aqui você cola a <b>chave de licença</b> e clica em <b>Validar</b>. O resultado aparece logo abaixo. Não tem chave? Use <b>Upgrade Pro</b>.",
    go: { route: "settings", tab: "license", label: "Abrir Licença" } },

  { id: "cfg-webhook", boost: 1, sec: "cfg", icon: "🔌", title: "Config › Webhook (enviar leads para outro sistema)",
    kw: "webhook integracao url post put headers api key zapier n8n make crm externo testar conexao enviar leads sistema",
    a: "Webhook é um “endereço” de outro sistema (seu CRM, Zapier, n8n, Make…) que recebe os leads quando você exporta. Preencha a <b>URL</b>, o <b>método</b> (POST é o mais comum), o <b>Content-Type</b>, os <b>Headers</b> (em JSON, se precisar) e a <b>API Key</b> (opcional).",
    steps: ["Cole a URL fornecida pelo outro sistema.", "Clique em <b>Salvar</b>.", "Clique em <b>Testar Conexão</b>. O Chrome pode pedir permissão para acessar aquele endereço: aceite."],
    tip: "Se você não usa outro sistema, pode ignorar esta aba.",
    go: { route: "settings", tab: "webhook", label: "Abrir Webhook" } },

  { id: "cfg-delays", sec: "cfg", icon: "⏱️", title: "Config › Delays (tempos de espera)",
    kw: "delays delay tempo espera milissegundos ms entre mensagens contatos erro padrao",
    a: "Define tempos de espera padrão, em <b>milissegundos</b> (1000 ms = 1 segundo): <b>entre mensagens</b>, <b>entre contatos</b> e <b>após erro</b>, sempre com mínimo e máximo (o sistema usa um valor entre os dois). Depois de ajustar, clique em <b>Salvar Delays</b>.",
    tip: "Na dúvida, mantenha os valores originais.",
    go: { route: "settings", tab: "delays", label: "Abrir Delays" } },

  { id: "cfg-spintax", boost: 1, sec: "cfg", icon: "🎲", title: "Config › Spintax (frases prontas)",
    kw: "spintax presets frases prontas modelos salvar variacoes preset adicionar",
    a: "Guarde modelos de variações para reaproveitar. Clique em <b>Adicionar Preset</b>, dê um nome e escreva as opções entre chaves separadas por barra, como <code>{Olá|Oi|Bom dia}</code>. Para excluir, use o botão de lixeira do preset.",
    go: { route: "settings", tab: "spintax", label: "Abrir Spintax" } },

  { id: "cfg-aparencia", sec: "cfg", icon: "🎨", title: "Config › Aparência (tema, compacto e apresentação)",
    kw: "aparencia tema escuro claro dark compacto modo compacto cores visual apresentacao guiada tour",
    a: "Ligue/desligue o <b>Tema Escuro</b> e o <b>Modo Compacto</b> (mais itens na tela). Há também o cartão <b>Apresentação guiada</b>, onde você escolhe se ela abre ao iniciar e pode <b>rever a apresentação</b> a qualquer momento.",
    go: { route: "settings", tab: "appearance", label: "Abrir Aparência" } },

  { id: "cfg-privacidade", sec: "cfg", icon: "🙈", title: "Modo privacidade (desfocar nomes e telefones)",
    kw: "privacidade blur desfocar borrar esconder nomes telefones gravar tela apresentar alt shift p atalho",
    a: "Desfoca nomes, telefones e conversas — ótimo para gravar a tela, mostrar para um cliente ou trabalhar em lugar público. Ligue pelo botão <b>👁️ Privacidade</b> no menu, pelo atalho <b>Alt+Shift+P</b> ou em <b>Config › Aparência</b>, onde escolhe o que desfocar. “Revelar ao passar o mouse” mostra só o item sob o cursor. Muda apenas a aparência: não altera mensagens nem envios.",
    go: { route: "settings", tab: "appearance", label: "Abrir Aparência" } },

  { id: "cfg-dados", sec: "cfg", icon: "💾", title: "Config › Dados: exportar, importar e limpar",
    kw: "dados backup exportar importar restaurar arquivo json limpar tudo apagar salvar copia seguranca",
    a: "<b>Exportar Backup</b> baixa um arquivo <code>.json</code> com seus dados. <b>Importar Backup</b> carrega esse arquivo de volta. <b>Limpar Tudo</b> apaga os dados da extensão <b>neste computador</b> (vermelho de propósito: cuidado!).",
    tip: "Exporte um backup antes de usar “Limpar Tudo” ou de importar outro arquivo.",
    go: { route: "settings", tab: "data", label: "Abrir Dados" } },

  { id: "cfg-drive", boost: 2, sec: "cfg", icon: "☁️", title: "Backup automático no Google Drive",
    kw: "google drive backup nuvem sincronizar sincronizacao automatica conectar desconectar conta gmail pasta guardar seguranca",
    a: "Guarda leads, estágios do CRM, campanhas e configurações numa pasta do <b>seu</b> Google Drive (<i>i9Hub - Backup</i>) e mantém tudo sincronizado. A extensão só enxerga os arquivos que ela mesma criou.",
    steps: [
      "Abra <b>Config › Dados</b>.",
      "Em <b>Backup no Google Drive</b>, clique em <b>Conectar Google Drive</b> e escolha sua conta.",
      "Autorize o acesso. O status mostra “Conectado como …” e a última sincronização.",
      "Deixe <b>Sincronização automática</b> ligada. Use <b>Sincronizar agora</b> quando quiser forçar.",
    ],
    tip: "Para trocar de conta, clique em <b>Desconectar</b> e conecte de novo.",
    go: { route: "settings", tab: "data", label: "Abrir Backup no Drive" } },

  { id: "drive-novo-pc", sec: "cfg", icon: "💻", title: "Recuperar meus dados em outro computador",
    kw: "novo computador trocar pc perdi formatei restaurar recuperar dados drive outro computador reinstalar substituir opcoes avancadas",
    a: "Instale a extensão no computador novo, vá em <b>Config › Dados</b>, conecte a <b>mesma conta Google</b> e seus dados voltam. Em <b>Opções avançadas</b> há duas ações perigosas: <b>Restaurar do Drive</b> (substitui os dados deste computador) e <b>Enviar este computador</b> (substitui o que está no Drive). Leia com atenção antes de clicar.",
    tip: "A Black list fica no navegador e não vai para o backup do Drive; os leads vão.",
    go: { route: "settings", tab: "data", label: "Abrir Dados" } },

  { id: "cfg-whatsapp", sec: "cfg", icon: "📲", title: "Config › Aparência › opções do WhatsApp",
    kw: "whatsapp embutido iframe experimental segundo plano oculto janela enviar coberto",
    a: "<b>Usar WhatsApp embutido</b> (experimental) mostra o WhatsApp dentro do painel; por padrão fica desligado e o WhatsApp Web abre numa aba normal. <b>Enviar em segundo plano</b> (ligado por padrão) permite que a campanha continue com o WhatsApp coberto ou minimizado.",
    go: { route: "settings", tab: "appearance", label: "Abrir Aparência" } },

  { id: "cfg-diag", sec: "cfg", icon: "🩺", title: "Botão Diagnóstico",
    kw: "diagnostico logs erros suporte tecnico relatorio senha",
    a: "O <b>Diagnóstico</b> abre os registros técnicos (logs) para ajudar a investigar falhas. Eles podem conter informações da sua operação; confira o conteúdo antes de exportar ou compartilhar.",
    go: { route: "settings", label: "Abrir Configurações" } },

  // ------------------------------------------------------------------ Problemas
  { id: "fix-whatsapp", sec: "fix", icon: "🛟", title: "A campanha não envia / o WhatsApp não responde",
    kw: "nao envia nao enviou parou travou erro falha whatsapp nao conecta qr code campanha parada pendente retomar reenviar",
    a: "Verifique nesta ordem:",
    steps: [
      "O <b>WhatsApp Web</b> está aberto e <b>conectado</b> (sem pedir QR Code)?",
      "O WhatsApp está <b>visível</b>? Se a extensão perguntar, aceite “Trazer o WhatsApp para frente”.",
      "Sua <b>licença</b> está ativa e tem as permissões corretas? Confira o rodapé do menu.",
      "O contato está na <b>Black list</b> ou o número é inválido? Esses são pulados.",
      "Use <b>Retomar</b> para continuar ou <b>Reenviar falhas</b> para tentar de novo só os que falharam.",
    ],
    tip: "O WhatsApp muda o site de vez em quando. Se nada resolver, fale com o suporte." },

  { id: "fix-maps", sec: "fix", icon: "🛟", title: "O Maps não extrai (ou extrai pouco)",
    kw: "maps nao extrai pouco leads parou travou zero resultados erro google maps aba fechada",
    a: "Confira:",
    steps: [
      "Mantenha a <b>aba do Google Maps aberta</b> durante a extração.",
      "Busca muito específica retorna poucos resultados: tente um termo mais geral.",
      "Aumente o <b>Raio de busca</b> para achar mais lugares.",
      "Se “repetidos” estão sendo ignorados, desligue <b>Não repetir leads já extraídos</b> ou <b>limpe o histórico</b>.",
    ] },

  { id: "fix-drive", sec: "fix", icon: "🛟", title: "O Google Drive não conecta",
    kw: "drive erro nao conecta bad client id invalid_client autorizar permissao login google falha sincronizacao reconectar",
    a: "Tente: <b>Desconectar</b> e conectar de novo; confirme que está logado no Chrome com a conta certa; clique em <b>Sincronizar agora</b>. Se aparecer erro de “client id”, avise o suporte: é uma configuração da extensão, não do seu computador.",
    go: { route: "settings", tab: "data", label: "Abrir Dados" } },

  { id: "fix-licenca", sec: "fix", icon: "🛟", title: "Minha licença não valida",
    kw: "licenca invalida nao valida chave erro expirou ativar problema",
    a: "Copie a chave sem espaços no começo ou no fim, cole em <b>Config › Licença</b> e clique em <b>Validar</b>. Confira também a conexão com a internet. Se continuar, clique no ícone da extensão e use o botão <b>Chamar no WhatsApp</b> para falar com o suporte.",
    go: { route: "settings", tab: "license", label: "Abrir Licença" } },

  { id: "autor", sec: "fix", icon: "👤", title: "Quem criou o projeto e como falar com o suporte",
    kw: "autor criou criador criei desenvolveu desenvolvedor quem fez natã nata oliver contato suporte site i9ads ajuda humana falar atendimento",
    a: "O i9Hub foi desenvolvido por <b>Natã Oliver</b>. Mais informações no site <b>i9ads.com.br</b> (link no rodapé do menu). Para solicitar uma conta gratuita, clique em <b>Quero conta grátis</b> e envie a mensagem pelo WhatsApp." },
];

/** Perguntas rápidas mostradas como botões. */
export const QUICK = [
  "Configurar perfil", "Usar CRM", "Conversas privadas",
  "Classificar contatos", "Criar campanha", "Backup no Drive",
];
