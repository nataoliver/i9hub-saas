# i9Leads Flow --- Plano Mestre Consolidado

## Arquitetura, funcionalidades, licenciamento, telemetria, IA e plano de execução

**Documento de referência do projeto**\
**Data de consolidação:** 17 de outubro de 2026\
**Versão-base analisada:** `i9Leads-Flow-Extensao-v5.3.2-fix1.zip`\
**Versão candidata previamente preparada:**
`i9Leads-Flow-Extensao-v5.3.3-license-gate.zip`\
**Estado geral:** existe uma versão candidata com alterações na extensão
e validação estática; a integração com o painel/backend, os testes
manuais no Chrome e boa parte das novas funções ainda estão pendentes.

------------------------------------------------------------------------

# 1. Objetivo e regra principal

Este documento consolida os requisitos e as decisões de arquitetura
discutidos para evoluir o i9Leads Flow em uma ferramenta comercial
robusta, fácil de usar, mensurável e administrável por licença.

O produto deve ser tratado como um conjunto integrado:

-   **Extensão Chrome:** interface, CRM, interação com WhatsApp Web,
    automações locais, atendimento com IA e experiência do usuário.
-   **Painel administrativo/backend:** cadastro de contas, planos,
    licenças, permissões, telemetria, notificações, anúncios, relatórios
    e configuração de funcionalidades.
-   **Integrações do usuário:** provedor de IA escolhido pelo cliente,
    Google Sheets e outras conexões autorizadas.
-   **Site de vendas/marketing:** GTM, Analytics e pixels, separados da
    execução da extensão.
-   **WhatsApp Web:** utilizado pela extensão para as funções que
    dependem da sessão aberta do usuário. O módulo de IA **não utilizará
    a WhatsApp Business Platform/Cloud API oficial**.

## Princípios inegociáveis

-   [ ] As funções operacionais só podem ser usadas se estiverem
    autorizadas pela licença emitida pelo painel administrativo.
-   [ ] Sem licença, o usuário pode explorar a interface e conhecer as
    funções, mas não pode executar operações comerciais.
-   [ ] O painel deve permanecer compatível com as versões suportadas da
    extensão; atualizações não podem quebrar conexões, licenças ou
    módulos sem um plano de migração.
-   [ ] Nenhuma funcionalidade é considerada pronta apenas porque existe
    um botão. Ela precisa funcionar, respeitar a licença, tratar falhas
    e passar nos testes.
-   [ ] A telemetria deve medir o uso e os resultados comerciais com o
    máximo de informação operacional útil, mas sem coletar
    indiscriminadamente conteúdo de mensagens, credenciais ou dados
    pessoais sem necessidade.
-   [ ] O atendimento com IA funcionará localmente pela extensão,
    enquanto o Chrome, a extensão e o WhatsApp Web estiverem
    disponíveis. Não haverá processamento contínuo quando o computador
    estiver desligado ou a extensão estiver fechada.
-   [ ] O usuário poderá informar a própria chave de API de IA e
    escolher o provedor/modelo compatível. Os custos e limites serão do
    provedor escolhido.
-   [ ] O atendimento com IA deve confirmar pedidos somente depois de o
    registro e o encaminhamento necessários terem sido concluídos com
    sucesso.
-   [ ] Automação não oficial do WhatsApp Web deve ser tratada como
    sujeita a mudanças, interrupções e risco de restrições da conta.
-   [ ] Recursos novos devem ser liberados gradualmente, com testes,
    telemetria de saúde e possibilidade de desativação/rollback.

------------------------------------------------------------------------

# 2. Legenda de status

-   [x] **Preparado na versão candidata:** consta como implementado no
    pacote 5.3.3 descrito no relatório técnico, mas ainda precisa de
    validação real e integração com o painel.
-   \[!\] **Encontrado parcialmente ou precisa de confirmação:** há
    código ou recurso relacionado, mas não está comprovado que cumpra
    todo o requisito.
-   [ ] **Pendente:** precisa ser desenvolvido, integrado ou validado.
-   **Importante:** os itens \[x\] não significam que a funcionalidade
    já esteja publicada ou validada em produção.

------------------------------------------------------------------------

# 3. Arquivos e versões de referência

-   [x] ZIP original analisado: `i9Leads-Flow-Extensao-v5.3.2-fix1.zip`.
-   [x] Versão candidata preparada anteriormente:
    `i9Leads-Flow-Extensao-v5.3.3-license-gate.zip`.
-   [x] Plano mestre inicial:
    `i9Leads_Flow_Plano_Mestre_Melhorias_Checklist.md`.
-   [x] Relatório da candidata 5.3.3:
    `docs/RELATORIO_IMPLEMENTACAO_v5.3.3.md`.
-   [x] Contrato proposto para permissões do painel:
    `docs/CONTRATO_PAINEL_LICENCAS_v5.3.3.md`.
-   [x] Especificação de segmentação de Status:
    `i9Leads_Flow_Especificacao_Segmentacao_Status_WhatsApp.md`.
-   [x] Documento de status anterior:
    `i9Leads_Flow_Status_Atualizacoes_e_Pendencias_v5.3.3.md`.
-   [ ] Receber e auditar o código atual do painel administrativo e
    backend.
-   [ ] Confirmar qual versão está instalada no Chrome e se há
    alterações locais ainda não publicadas.
-   [ ] Comparar o código candidato com a versão efetivamente utilizada
    antes de integrar novas alterações.
-   [ ] Preservar uma cópia íntegra da base e manter um changelog por
    entrega.

------------------------------------------------------------------------

# 4. Resumo do que foi preparado até agora

## 4.1 Versão candidata 5.3.3

O relatório técnico da versão candidata registra:

-   [x] Atualização do manifesto para 5.3.3.
-   [x] Remoção do contador antigo de três ações gratuitas locais.
-   [x] Modo de demonstração sem licença: interface navegável, operações
    comerciais bloqueadas.
-   [x] Catálogo central de funcionalidades e mapeamento de handlers.
-   [x] Política de negar acesso quando a permissão está ausente ou não
    reconhecida (*fail closed*).
-   [x] Direitos derivados de permissões no token assinado, e não apenas
    do nome do plano.
-   [x] Exceções limitadas para algumas ações de segurança, como parar
    operações e desconectar o Drive.
-   [x] CTA para solicitar conta gratuita pelo WhatsApp, com mensagem
    pré-preenchida indicando a origem na extensão.
-   [x] Manutenção do fluxo de ativação da chave de licença já
    existente.
-   [x] Bloco inicial no Dashboard Comercial para conversas aguardando
    resposta.
-   [x] Botão inicial para tentar abrir o chat correto, com validação
    mais estrita do contato.
-   [x] Testes automatizados de catálogo, permissões, cobertura dos
    handlers e CTA de WhatsApp.
-   [x] Validação estática de manifesto, sintaxe e imports locais,
    conforme o relatório da candidata.

## 4.2 O que ainda não está comprovado

-   [ ] O painel/backend ainda precisa emitir tokens com as permissões
    esperadas pela extensão.
-   [ ] As licenças gratuitas, de teste, Pro Mensal, Pro Multitelas e
    administrativas precisam ser testadas com tokens reais.
-   [ ] A abertura do chat pendente precisa ser validada em uma sessão
    real do WhatsApp Web.
-   [ ] A integração de todas as funções com o catálogo precisa ser
    testada em cada ponto de execução.
-   [ ] A compatibilidade com versões antigas precisa ser testada com o
    backend real.
-   [ ] Telemetria administrativa completa ainda precisa ser
    desenvolvida.
-   [ ] GTM/pixels, notificações segmentadas, anúncios no rodapé,
    segmentação de Status e atendimento com IA continuam como requisitos
    de desenvolvimento, salvo se uma implementação posterior for
    comprovada por código e teste.
-   [ ] A ponte de mensagens entre scripts da página do WhatsApp e a
    extensão precisa de auditoria adicional.
-   [ ] A candidata não deve ser tratada como pronta para distribuição
    comercial geral antes dos testes de integração, segurança e
    regressão.

------------------------------------------------------------------------

# 5. Catálogo central de funcionalidades e licenciamento

## 5.1 Regra de autorização

O painel administrativo é a fonte de autorização. Ele determina quais
funcionalidades cada conta pode utilizar. A extensão aplica esses
direitos nos pontos reais de execução, e não apenas ocultando botões.

-   [x] Existe uma base de catálogo/permissões na candidata.
-   [ ] Confirmar e integrar os IDs com o painel real.
-   [ ] Mapear todos os handlers e comandos para IDs estáveis.
-   [ ] Configurar direitos por plano.
-   [ ] Permitir exceções por conta.
-   [ ] Permitir limites quantitativos por função, quando aplicável.
-   [ ] Fazer o service worker validar a permissão antes da execução.
-   [ ] Fazer APIs remotas validarem autorização no servidor quando
    aplicável.
-   [ ] Definir cache, atualização, expiração e comportamento offline.
-   [ ] Registrar mudanças administrativas e quem as realizou.
-   [ ] Garantir que função planejada ou ainda não implementada não seja
    liberada como pronta.
-   [ ] Manter ações essenciais de segurança disponíveis quando
    necessário, como interromper uma campanha em andamento.

## 5.2 Planos que precisam ser suportados

-   [ ] Sem licença: modo de demonstração, navegação e explicações; sem
    execução operacional.
-   [ ] Conta Gratuita: apenas as funções e os limites que o painel
    explicitamente autorizar.
-   [ ] Conta de Teste: direitos e duração configurados pelo painel.
-   [ ] Pro Mensal: direitos definidos para o plano.
-   [ ] Pro Multitelas: direitos e regras de dispositivos próprios.
-   [ ] Licença administrativa: acesso integral para testes, sem ignorar
    autenticação, auditoria ou controles de segurança do backend.
-   [ ] Licenças revogadas/expiradas: comportamento claro e previsível.
-   [ ] Alteração de permissões: refletida sem reinstalação, dentro do
    prazo de atualização definido.

## 5.3 IDs propostos

Os IDs abaixo são propostas a compatibilizar com o catálogo real antes
da integração.

  -----------------------------------------------------------------------------
  ID proposto                               Função
  ----------------------------------------- -----------------------------------
  `dashboard.analytics`                     Indicadores comerciais

  `dashboard.awaiting_reply`                Conversas aguardando resposta

  `crm.leads`                               Gestão de leads

  `crm.kanban`                              Funil e etapas

  `crm.custom_fields`                       Campos personalizados

  `crm.classification.auto`                 Classificação automática

  `crm.deduplication`                       Deduplicação

  `crm.export.csv`                          Exportação CSV

  `crm.export.webhook`                      Exportação por webhook

  `crm.blacklist`                           Lista de bloqueio

  `whatsapp.connection`                     Conexão e diagnóstico

  `whatsapp.chat_list`                      Lista de conversas

  `whatsapp.chat_messages`                  Recursos relacionados a mensagens

  `whatsapp.labels_sync`                    Leitura/sincronização de etiquetas

  `whatsapp.campaigns.manage`               Gestão de campanhas

  `whatsapp.campaigns.send`                 Execução de campanhas

  `whatsapp.status_audience`                Públicos de Status por etiquetas

  `whatsapp.ai_support`                     Atendimento com IA

  `whatsapp.ai_support.configure`           Configuração do assistente

  `whatsapp.ai_support.automated_replies`   Respostas automáticas

  `whatsapp.ai_support.order_capture`       Captura/estruturação de pedidos

  `whatsapp.ai_support.google_sheets`       Registro de pedidos no Sheets

  `whatsapp.ai_support.human_handoff`       Transferência para atendimento
                                            humano

  `maps.extraction`                         Extração do Google Maps

  `rcs.templates`                           Templates RCS

  `rcs.send_single`                         Envio individual RCS

  `rcs.campaigns`                           Campanhas RCS

  `business.profile`                        Perfil comercial

  `settings.webhook`                        Configuração de webhooks

  `settings.privacy`                        Preferências de privacidade

  `settings.appearance`                     Aparência

  `data.backup.manual`                      Backup manual

  `drive.sync`                              Sincronização com Google Drive

  `system.logs`                             Logs e diagnóstico

  `telemetry.usage`                         Telemetria de utilização

  `telemetry.sales_funnel`                  Métricas do funil comercial

  `marketing.integrations`                  Configuração de
                                            rastreamento/marketing

  `notifications.in_app`                    Notificações internas

  `ads.footer`                              Anúncios no rodapé
  -----------------------------------------------------------------------------

## 5.4 Regras para segurança do licenciamento

-   [ ] Direitos ausentes, inválidos ou desconhecidos devem ser negados.
-   [ ] Não conceder acesso somente porque o token diz `plan: "pro"`.
-   [ ] Verificar assinatura, validade, revogação e dispositivo conforme
    o contrato.
-   [ ] Definir comportamento quando o backend estiver indisponível.
-   [ ] Alinhar documentação e implementação da tolerância offline.
-   [ ] Não expor tokens completos em logs.
-   [ ] Não armazenar chaves de API de IA no token de licença.
-   [ ] Não enviar credenciais privadas para o painel como parte da
    telemetria.
-   [ ] Testar todas as funções protegidas com licença permitida e
    negada.

------------------------------------------------------------------------

# 6. Cadastro simples para usuários sem experiência

## 6.1 Experiência desejada

1.  A pessoa instala e abre a extensão.
2.  Pode conhecer a interface e entender os módulos, sem executar
    operações.
3.  Encontra o botão **Quero minha conta grátis**.
4.  O botão abre o WhatsApp para `+55 11 95472-1939` com uma mensagem
    pré-preenchida.
5.  O atendimento identifica a solicitação.
6.  A conta é cadastrada/aprovada no painel administrativo.
7.  O painel emite a licença gratuita com os direitos escolhidos.
8.  O usuário recebe a chave e ativa a licença na extensão.
9.  A extensão valida a licença e libera apenas as funções autorizadas.

Mensagem padrão sugerida:

> Olá! Vim pela extensão i9Leads Flow e gostaria de criar minha conta
> gratuita para começar a utilizar as funcionalidades.
>
> Poderiam me orientar sobre o cadastro e a ativação da minha licença
> gratuita?
>
> Origem: Extensão i9Leads Flow

## 6.2 Checklist

-   [x] CTA de solicitação por WhatsApp registrado na candidata.
-   [x] Mensagem com indicação de origem na extensão.
-   [x] O clique no WhatsApp não libera a licença por si só.
-   [ ] Testar o fluxo de ponta a ponta com o painel real.
-   [ ] Documentar o procedimento de atendimento e criação da conta.
-   [ ] Definir como entregar a chave com segurança.
-   [ ] Testar ativação, revogação e renovação.
-   [ ] Futuramente, avaliar cadastro automatizado por e-mail/telefone
    se o volume justificar.

------------------------------------------------------------------------

# 7. Telemetria: utilização do produto e resultados comerciais

## 7.1 Objetivo

A telemetria não deve ser apenas um contador de cliques. Ela deve dar ao
administrador uma visão do uso real da extensão e do desempenho
comercial dos clientes, com relatórios por período, plano,
profissão/nicho, versão e funcionalidade.

Perguntas que o painel deve responder:

-   Quantas instalações e contas estão ativas?
-   Quantas pessoas usam a extensão diariamente, semanalmente e
    mensalmente?
-   Quantas se declaram contadores, advogados, corretores, profissionais
    de marketing, vendedores ou de outros nichos?
-   Quais funções são mais usadas por cada nicho?
-   Quantas conversas foram detectadas/atendidas?
-   Quantos leads foram criados?
-   Quantas oportunidades foram abertas?
-   Quantas propostas foram enviadas?
-   Quantos pedidos foram registrados?
-   Quantas vendas foram fechadas?
-   Qual o valor de vendas registrado, quando o usuário fornece esse
    dado?
-   Quantos clientes foram convertidos?
-   Quantos atendimentos foram conduzidos pela IA?
-   Quantos foram transferidos para humanos?
-   Quantos pedidos foram gravados com sucesso no Google Sheets?
-   Quantas notificações ao vendedor falharam?
-   Quais versões têm mais erros?
-   Quais recursos são bloqueados por falta de licença?
-   Quais segmentos convertem do gratuito para o pago?
-   Quais notificações/anúncios geram cliques e conversões?
-   Em que ponto os usuários abandonam o funil?

## 7.2 Medir uso e medir resultado são coisas diferentes

A telemetria pode contar uma conversa detectada, uma oportunidade criada
ou uma mensagem enviada. Porém, não deve inferir que uma venda foi
fechada só porque houve uma conversa positiva.

Para medir vendas reais, precisamos de uma fonte de verdade:

-   [ ] Status de lead/oportunidade no CRM.
-   [ ] Ação explícita "Venda fechada" ou atualização equivalente.
-   [ ] Valor da venda, quando o usuário quiser registrá-lo.
-   [ ] Registro de pedido e estado de aprovação.
-   [ ] Sincronização de status com Google Sheets quando essa planilha
    for usada como fonte de verdade.
-   [ ] Deduplicação entre evento da extensão, CRM e planilha.
-   [ ] Definições documentadas para "lead", "oportunidade", "pedido",
    "cliente fechado" e "venda".

**Regra:** o painel deve distinguir "conversa detectada", "pedido
registrado", "venda declarada como fechada" e "venda confirmada por uma
integração". Não misturar essas métricas.

## 7.3 Perfil de profissão e segmento

-   [ ] Criar onboarding opcional para o usuário declarar sua
    profissão/área.
-   [ ] Categorias iniciais: contabilidade, advocacia, imobiliário,
    marketing/agência, vendas, serviços, comércio, saúde e outras
    categorias que façam sentido para o produto.
-   [ ] Permitir "Outra área" e "Prefiro não informar".
-   [ ] Permitir editar a informação.
-   [ ] Registrar se o segmento foi declarado ou inferido.
-   [ ] Se houver inferência comportamental, guardar o nível de
    confiança e não tratar a inferência como fato.
-   [ ] Usar dados agregados para relatórios de nicho.
-   [ ] Restringir acesso a dados de contas individuais conforme a
    função administrativa.

## 7.4 Eventos de telemetria propostos

  -----------------------------------------------------------------------
  Área                                Eventos/indicadores
  ----------------------------------- -----------------------------------
  Instalação                          Instalação/primeira abertura,
                                      versão, atualização detectada

  Engajamento                         Usuário ativo, sessão, módulo
                                      aberto, retorno ao produto

  Licença                             Ativação, expiração, revogação,
                                      permissão negada, limite atingido

  CRM                                 Lead criado/atualizado, etapa
                                      alterada, oportunidade aberta,
                                      proposta registrada, venda marcada
                                      como fechada

  Conversas                           Conversas identificadas, conversas
                                      com resposta pendente, respostas
                                      enviadas, tempo de resposta quando
                                      mensurável

  Campanhas                           Iniciadas, concluídas, pausadas,
                                      falhas, resultados agregados

  Maps                                Extrações iniciadas/concluídas,
                                      contagens agregadas e falhas

  Drive                               Conexão, sincronização,
                                      restauração, conflito e erro

  IA                                  Conversas processadas, respostas
                                      geradas/enviadas, falhas de
                                      provedor, handoffs, pedidos
                                      capturados

  Google Sheets                       Tentativas de gravação, gravações
                                      confirmadas, falhas e retentativas

  Vendedor                            Notificações
                                      preparadas/enviadas/confirmadas
                                      quando detectável, falhas e tempo
                                      até continuidade

  Pedidos                             Pedido criado, aguardando análise,
                                      aprovado, recusado, convertido em
                                      venda

  Marketing                           Visualização, clique, conversão
                                      atribuída e origem

  Notificações                        Elegível, obtida, exibida, clicada,
                                      dispensada

  Anúncios                            Impressão visível, clique, CTR e
                                      conversão atribuída

  Erros                               Código, módulo, versão e contexto
                                      técnico mínimo
  -----------------------------------------------------------------------

## 7.5 Métricas e fórmulas recomendadas

-   **Usuários ativos:** contas/instalações com atividade definida no
    período.
-   **Ativação:** usuários que completaram a primeira ação relevante /
    novos usuários elegíveis.
-   **Conversão de lead em oportunidade:** oportunidades abertas / leads
    qualificados, com definição explícita.
-   **Conversão de oportunidade em venda:** oportunidades marcadas como
    fechadas / oportunidades elegíveis.
-   **Taxa de fechamento:** vendas fechadas / oportunidades concluídas
    ou elegíveis, com denominador documentado.
-   **Tempo de primeira resposta:** diferença entre mensagem recebida e
    primeira resposta enviada, quando os eventos estiverem disponíveis.
-   **Tempo até fechamento:** diferença entre criação da oportunidade e
    data da venda registrada.
-   **Adoção de função:** contas que utilizaram uma função / contas
    elegíveis à função.
-   **Taxa de erro de integração:** operações falhas / operações
    tentadas.
-   **Taxa de gravação no Sheets:** gravações confirmadas / gravações
    tentadas.
-   **Taxa de handoff humano:** conversas transferidas / conversas
    atendidas pela IA.
-   **Conversão por nicho:** vendas registradas / oportunidades
    elegíveis de cada segmento.
-   **CTR de anúncio:** cliques / impressões visíveis válidas.

As fórmulas precisam ter definição consistente, e o painel deve mostrar
quando uma métrica é estimada, declarada pelo usuário ou confirmada por
uma integração.

## 7.6 Dados que devem ser minimizados

O objetivo é medir o produto e o funil comercial, não copiar a base de
clientes de cada usuário.

-   [ ] Não enviar conteúdo completo de mensagens como telemetria
    padrão.
-   [ ] Não enviar listas completas de contatos, nomes ou números para
    calcular uso.
-   [ ] Não enviar chaves de API, tokens completos, credenciais Google
    ou segredos.
-   [ ] Usar contagens agregadas e identificadores pseudônimos quando
    suficientes.
-   [ ] Separar telemetria técnica de dados operacionais necessários
    para o atendimento.
-   [ ] Definir finalidade, acesso, retenção, exclusão e transparência
    conforme a LGPD.
-   [ ] Permitir controles apropriados de privacidade e consentimento.
-   [ ] Evitar relatórios que exponham pessoas em segmentos muito
    pequenos.
-   [ ] Não transmitir dados sensíveis ou conteúdo de conversas para
    provedores externos sem configuração e finalidade claras.

## 7.7 Arquitetura da telemetria

-   [ ] Módulo de eventos na extensão.
-   [ ] Fila local resiliente e envio em lotes.
-   [ ] Retentativas com espera progressiva.
-   [ ] Identificadores de evento e deduplicação.
-   [ ] Endpoint autenticado no backend.
-   [ ] Validação de esquema, tamanho, frequência e versão.
-   [ ] Armazenamento de eventos e agregações.
-   [ ] Relatórios no painel, com filtros por período, plano, versão,
    nicho e função.
-   [ ] Controles de acesso administrativos.
-   [ ] Retenção e descarte definidos.
-   [ ] A telemetria não pode bloquear CRM, WhatsApp, Drive, IA ou
    outras funções se a rede falhar.

------------------------------------------------------------------------

# 8. Atendimento com IA executado pela extensão (sem API oficial do WhatsApp)

## 8.1 Requisito definitivo

**O módulo de atendimento com IA não utilizará a WhatsApp Business
Platform/Cloud API oficial.**

O processamento e a automação acontecerão pela extensão, interagindo com
o WhatsApp Web, e funcionarão apenas enquanto:

-   o computador/notebook estiver ligado;
-   o Chrome estiver aberto;
-   a extensão e sua interface operacional estiverem ativas;
-   o WhatsApp Web estiver conectado;
-   a sessão tiver acesso às conversas necessárias;
-   o provedor de IA e o Google Sheets estiverem acessíveis.

O service worker do Chrome Manifest V3 pode ser suspenso; por isso, não
se deve depender de um processo de fundo permanentemente ativo. A
solução precisa gerenciar reconexão, fila e estado da extensão, sem
prometer operação 24/7.

## 8.2 Arquitetura proposta

1.  WhatsApp Web recebe a mensagem.
2.  A extensão detecta a mensagem através da integração local com a
    interface.
3.  O módulo identifica se o atendimento está ativo e se a mensagem já
    foi processada.
4.  O sistema aplica o prompt e consulta a base de conhecimento da
    empresa.
5.  A extensão envia à API do provedor escolhido somente o contexto
    necessário.
6.  A IA prepara a resposta ou solicita os dados que faltam para o
    pedido.
7.  O sistema valida e estrutura o pedido.
8.  O pedido é registrado no Google Sheets.
9.  A extensão envia uma notificação para o número do
    vendedor/responsável através de uma conversa separada do WhatsApp
    Web.
10. Depois de confirmar os passos exigidos, a extensão responde ao
    cliente que a solicitação foi registrada e encaminhada para
    continuidade/aprovação humana.
11. O estado do pedido é atualizado e os eventos operacionais permitidos
    são enviados à telemetria.

## 8.3 Configuração BYOK (Bring Your Own Key)

O usuário poderá configurar a própria chave e selecionar o
provedor/modelo compatível.

-   [ ] Seleção de provedor.
-   [ ] Campo de chave de API.
-   [ ] Seleção de modelo.
-   [ ] Endpoint customizado apenas para provedores compatíveis e
    permitidos.
-   [ ] Botão para testar conexão.
-   [ ] Mensagens claras de erro, falta de saldo, limite e
    indisponibilidade.
-   [ ] Aviso de que os custos e limites são do provedor escolhido.
-   [ ] Limites locais configuráveis para evitar consumo inesperado.
-   [ ] Estimativa de consumo quando houver dados suficientes.
-   [ ] Não enviar chaves de API ao painel administrativo.
-   [ ] Não incluir chaves em telemetria, logs, backups compartilhados
    ou relatórios.
-   [ ] Guardar credenciais localmente com proteção razoável.
-   [ ] Explicar que armazenamento local não torna a chave imune a
    malware, comprometimento do perfil ou acesso ao computador.
-   [ ] Restringir provedores/hosts permitidos para evitar que um
    endpoint arbitrário receba dados sem controle.
-   [ ] Aplicar timeouts, limites de requisição e tratamento de erros.

**Nota técnica:** chamadas diretas à API do provedor podem exigir
permissões de host e compatibilidade com CORS. Isso precisa ser validado
por provedor. Uma camada de adaptadores permite suportar APIs
compatíveis sem acoplar o produto a um único fornecedor.

## 8.4 Base de conhecimento e prompt por empresa

-   [ ] Prompt de sistema por empresa.
-   [ ] Nome e identidade do assistente.
-   [ ] Serviços e produtos.
-   [ ] Preços, condições e limitações autorizadas.
-   [ ] Perguntas frequentes.
-   [ ] Regras sobre o que a IA não pode prometer.
-   [ ] Campos necessários para montar cada pedido.
-   [ ] Mensagem de boas-vindas e confirmação.
-   [ ] Horários e condições de atendimento.
-   [ ] Regras de transferência para humano.
-   [ ] Ferramenta de teste/simulação antes de ativar.
-   [ ] Controle de versão e histórico de alterações do prompt/base.

A IA não deve inventar preços, disponibilidade, prazos, descontos ou
aprovações. Se não tiver informação suficiente, deve perguntar, admitir
a limitação ou transferir para o responsável.

## 8.5 Registro de pedido no Google Sheets

-   [ ] Conexão do Google pelo fluxo de autorização apropriado.
-   [ ] Seleção de planilha e aba.
-   [ ] Mapeamento de campos para colunas.
-   [ ] Teste de gravação antes de ativar.
-   [ ] ID único por pedido.
-   [ ] Prevenção de duplicidades.
-   [ ] Fila de tentativas pendentes e retentativas seguras.
-   [ ] Confirmação de gravação antes de responder ao cliente.
-   [ ] Estado do pedido: rascunho, aguardando registro, aguardando
    análise, aprovado, recusado, em atendimento, concluído ou erro.
-   [ ] Data de criação e última atualização.
-   [ ] Registro do responsável.
-   [ ] Proteção contra sobrescrita acidental.
-   [ ] Logs sem conteúdo pessoal desnecessário.
-   [ ] Não confirmar sucesso se a gravação falhar.

Estrutura de colunas sugerida:

  Coluna          Conteúdo
  --------------- -----------------------------------------
  ID do pedido    Identificador único
  Criado em       Data/hora
  Cliente         Nome informado, se necessário
  WhatsApp        Referência necessária para continuidade
  Empresa         Empresa do cliente, se aplicável
  Serviço         Produto/serviço solicitado
  Detalhes        Resumo objetivo e necessário
  Responsável     Vendedor/equipe
  Status          Estado atual do pedido
  Origem          Atendimento IA
  Atualizado em   Última mudança

## 8.6 Notificação ao vendedor

-   [ ] Configurar número do vendedor/responsável.
-   [ ] Validar o destino antes de ativar.
-   [ ] Preparar notificação com ID do pedido, resumo e link/referência
    à planilha quando apropriado.
-   [ ] Enviar pela sessão do WhatsApp Web da extensão, sem usar API
    oficial do WhatsApp.
-   [ ] Tratar falhas e impedir duplicidade.
-   [ ] Distinguir "notificação preparada", "tentativa de envio" e
    "envio confirmado" conforme o que a interface permite verificar.
-   [ ] Não dizer ao cliente que o vendedor foi avisado se o envio não
    foi concluído.
-   [ ] Permitir reenvio seguro e revisão manual.
-   [ ] Não interromper silenciosamente o atendimento se o chat do
    vendedor não puder ser acessado.

## 8.7 Confirmação ao cliente

Modelo conceitual:

> Obrigado! Sua solicitação foi registrada e encaminhada ao responsável
> comercial. O pedido está aguardando análise, e a equipe dará
> continuidade ao atendimento.

Regras:

-   [ ] Só confirmar o registro após o Google Sheets confirmar a
    gravação.
-   [ ] Confirmar encaminhamento apenas depois que a notificação exigida
    tiver sido enviada ou, caso não seja possível, informar honestamente
    que o pedido foi registrado mas o encaminhamento está pendente.
-   [ ] Não afirmar que o pedido foi aprovado.
-   [ ] Não prometer prazo sem regra configurada.
-   [ ] Se a integração falhar, explicar a situação ou transferir para
    atendimento humano.

## 8.8 Controle de execução e segurança operacional

-   [ ] Estado visível: desligado, iniciando, ativo, pausado, WhatsApp
    desconectado, IA indisponível, Google desconectado, erro.
-   [ ] Botão de pausa e parada imediata.
-   [ ] Fila local de eventos ainda não processados.
-   [ ] Prevenção de mensagens repetidas.
-   [ ] Limites de frequência e concorrência.
-   [ ] Não responder a mensagens próprias da extensão como se fossem
    mensagens do cliente.
-   [ ] Não entrar em loop de respostas.
-   [ ] Não tratar grupos como conversas individuais sem regra
    explícita.
-   [ ] Handoff humano quando solicitado ou necessário.
-   [ ] Se a extensão fechar, deixar explícito que o atendimento ficará
    pausado.
-   [ ] Na retomada, reconciliar conversas/pendências com cautela e sem
    enviar respostas atrasadas sem verificação.
-   [ ] Respeitar consentimento, opt-out, regras aplicáveis e políticas
    dos serviços.
-   [ ] Informar que automação de WhatsApp Web é não oficial, pode
    quebrar e pode expor a conta a restrições.

## 8.9 Telemetria do módulo de IA

Enviar ao painel apenas os dados operacionais necessários,
preferencialmente agregados:

-   [ ] Quantidade de conversas atendidas pela IA.
-   [ ] Quantidade de respostas enviadas.
-   [ ] Quantidade de pedidos estruturados.
-   [ ] Quantidade de gravações confirmadas/falhas no Sheets.
-   [ ] Quantidade de notificações ao vendedor
    tentadas/confirmadas/falhas.
-   [ ] Quantidade de transferências para humano.
-   [ ] Tempo de processamento e códigos de erro.
-   [ ] Consumo aproximado de tokens, se o provedor disponibilizar sem
    enviar a chave.
-   [ ] Pedidos aguardando análise e mudanças de estado, se a fonte de
    dados estiver integrada.
-   [ ] Vendas fechadas somente quando registradas em fonte confiável.
-   [ ] Não enviar a chave da IA, corpo completo das mensagens ou base
    de conhecimento para telemetria padrão.

## 8.10 Licenciamento do módulo

-   [ ] Cadastrar `whatsapp.ai_support` no catálogo.
-   [ ] Definir quais planos podem utilizar o módulo.
-   [ ] Permissões separadas para configuração, respostas automáticas,
    captura de pedidos, Sheets e handoff, se necessário.
-   [ ] Limites por conta definidos pelo painel.
-   [ ] A extensão só ativa o processamento se a licença autorizar.
-   [ ] Ao revogar a licença, interromper novas automações com segurança
    e preservar acesso a dados/exportação conforme a política definida.
-   [ ] O painel não recebe as chaves BYOK do usuário.
-   [ ] Testar que a revogação de IA não quebra CRM, Drive ou outras
    funções licenciadas.

------------------------------------------------------------------------

# 9. Dashboard Comercial: abrir o chat exato de quem aguarda resposta

## Estado

-   [x] A candidata 5.3.3 inclui um bloco inicial de conversas
    aguardando resposta e um botão para abrir o chat correspondente.
-   [ ] Testar a funcionalidade em uma sessão real do WhatsApp Web.
-   [ ] Testar múltiplas abas, sessão desconectada, carregamento e QR
    code.
-   [ ] Testar números internacionais, contatos sem nome, chats
    arquivados e contatos duplicados.
-   [ ] Confirmar a atualização da pendência depois de uma resposta de
    saída.
-   [ ] Validar que o botão nunca abre um contato apenas por semelhança
    de nome.
-   [ ] Mostrar erro claro quando a conversa não puder ser identificada.
-   [ ] Proteger a função pelo entitlement `dashboard.awaiting_reply` e
    dependências necessárias.

## Indicadores complementares

-   [ ] Conversas aguardando resposta.
-   [ ] Tempo de espera por faixa.
-   [ ] Tempo médio de primeira resposta, quando calculável.
-   [ ] Pendências resolvidas por período.
-   [ ] Conversas que viraram leads/oportunidades.
-   [ ] Vendas vinculadas a oportunidades, se o usuário registrar esse
    vínculo.

------------------------------------------------------------------------

# 10. CRM: barra horizontal de etapas

A versão-base possui Kanban horizontal com rolagem. Isso não confirma
que a barra de etapas pedida esteja implementada exatamente como
desejado.

-   [x] Kanban encontrado na base.
-   \[!\] Navegação horizontal existe; requisito visual específico
    precisa ser validado.
-   [ ] Adicionar ou ajustar uma barra horizontal que permita
    visualizar/acessar todas as etapas.
-   [ ] Exibir nome da etapa e opcionalmente quantidade de leads.
-   [ ] Destacar a etapa selecionada.
-   [ ] Permitir navegar/filtrar por etapa sem mover leads
    acidentalmente.
-   [ ] Suportar nomes longos e muitas etapas em side panel estreita.
-   [ ] Testar teclado, foco e acessibilidade.
-   [ ] Controlar a função pelo catálogo do painel.

------------------------------------------------------------------------

# 11. Segmentação de Status do WhatsApp por etiquetas do Business

## Objetivo

Criar públicos reutilizáveis com base nas etiquetas do WhatsApp
Business, por exemplo Contabilidade, Advocacia e Imobiliário, para
facilitar a seleção da audiência dos Status.

**Limitação:** não se deve presumir a existência de uma API oficial que
vincule dinamicamente etiquetas do Business à audiência dos Status. A
preparação de públicos é viável; automatizar a seleção depende de
auditoria da interface atual do WhatsApp Web.

## Funções desejadas

-   [ ] Ler as etiquetas e contatos que a extensão consegue identificar
    com segurança.
-   [ ] Criar públicos salvos por nome.
-   [ ] Selecionar uma ou mais etiquetas.
-   [ ] Combinar etiquetas por "qualquer uma" ou "todas".
-   [ ] Excluir contatos específicos.
-   [ ] Mostrar prévia e quantidade real de contatos identificados.
-   [ ] Detectar dados desatualizados, duplicidades e identificadores
    ausentes.
-   [ ] Atualizar o público a partir das etiquetas atuais.
-   [ ] Aplicar a audiência manualmente ou por assistência de interface
    validada.
-   [ ] Nunca selecionar contatos por aproximação de nome.
-   [ ] Exigir confirmação explícita antes de alterar privacidade.
-   [ ] Nunca publicar um Status automaticamente.
-   [ ] Oferecer alternativa manual quando a automação não for
    confiável.
-   [ ] Manter listas de público localmente por padrão.
-   [ ] Não enviar listas completas de telefones ao painel para fins de
    licença ou telemetria.

## Licenciamento

ID proposto: `whatsapp.status_audience`.

-   [ ] Adicionar ao catálogo do painel.
-   [ ] Não conceder automaticamente por ter `whatsapp.labels_sync`.
-   [ ] Configurar por plano/conta.
-   [ ] Liberar apenas quando a função estiver implementada e testada.
-   [ ] Testar com contatos duplicados, números internacionais,
    etiquetas alteradas, lista vazia e mudanças de interface.

------------------------------------------------------------------------

# 12. Notificações discretas enviadas pelo painel

## Objetivo

Permitir que o administrador publique mensagens para todos os usuários
elegíveis ou para segmentos específicos, sem exigir uma nova versão da
extensão para cada campanha.

## Editor no painel

-   [ ] Título e texto.
-   [ ] Ícone/imagem opcional.
-   [ ] Texto do botão e URL/rota.
-   [ ] Público-alvo e exclusões.
-   [ ] Plano, profissão/nicho, versão, atividade e funcionalidades
    usadas como filtros permitidos.
-   [ ] Data/hora de início e fim.
-   [ ] Prioridade e frequência.
-   [ ] Rascunho, agendada, ativa, pausada e encerrada.
-   [ ] Pré-visualização e envio de teste.
-   [ ] Histórico de alterações e responsável.

## Experiência na extensão

-   [ ] Popup discreto, sem bloquear o trabalho.
-   [ ] Fechar/dispensar e marcar como lida.
-   [ ] Limite de frequência.
-   [ ] Não repetir excessivamente a mesma notificação.
-   [ ] Não executar HTML/JavaScript remoto.
-   [ ] Atualizar campanhas quando a extensão estiver ativa.
-   [ ] Tratar offline e service worker suspenso.
-   [ ] Não prometer entrega instantânea se a extensão estiver fechada.
-   [ ] Métricas separadas: elegível, obtida, exibida, clicada e
    dispensada.

## Licenciamento

ID proposto: `notifications.in_app`.

-   [ ] Controlar disponibilidade por plano/conta.
-   [ ] Permitir desativação global.
-   [ ] Garantir compatibilidade com versões antigas suportadas.

------------------------------------------------------------------------

# 13. Anúncio configurável no rodapé da extensão

## Objetivo

Manter uma área promocional discreta no rodapé da extensão, configurada
no painel administrativo.

## Campos

-   [ ] Imagem.
-   [ ] Título.
-   [ ] Texto.
-   [ ] Botão e URL.
-   [ ] Identificação de publicidade/oferta quando aplicável.
-   [ ] Início/fim, estado e prioridade.
-   [ ] Segmentação por plano, nicho e comportamento permitido.
-   [ ] Ocultar em planos pagos, se desejado.
-   [ ] Limite de frequência e rotação.
-   [ ] Prévia responsiva.

## Regras

-   [ ] Não cobrir controles do CRM nem interferir na interface do
    WhatsApp Web.
-   [ ] Não injetar anúncios em sites de terceiros.
-   [ ] Não aceitar HTML/JavaScript arbitrário vindo do painel.
-   [ ] Validar links e imagens.
-   [ ] Contar impressão somente quando visível segundo regra
    documentada.
-   [ ] Medir impressões válidas, cliques, CTR e conversões atribuídas.
-   [ ] Permitir desligamento global em caso de problema.

## Licenciamento

ID proposto: `ads.footer`.

-   [ ] Configurar por plano e conta.
-   [ ] Não mostrar campanha a público excluído.
-   [ ] Preservar o layout das versões suportadas.

------------------------------------------------------------------------

# 14. GTM, Google Analytics, Meta Pixel e outras integrações

## Objetivo

Configurar rastreamento de marketing e conversão no painel e acompanhar
aquisição, ativação, uso e venda.

## Arquitetura recomendada

-   Google Tag Manager deve ser executado nas páginas próprias do
    produto, como site de vendas, planos e checkout.
-   A extensão deve emitir eventos próprios controlados e, quando
    apropriado, encaminhá-los ao backend.
-   O backend pode enviar eventos às integrações configuradas, conforme
    autorização, consentimento e política de privacidade.
-   Não carregar um contêiner GTM que execute código remoto arbitrário
    dentro da extensão.
-   Não injetar pixels indiscriminadamente no WhatsApp Web ou em sites
    de terceiros.
-   Guardar tokens secretos de integrações no backend; não embutir
    segredos de conversão na extensão.

## Checklist do painel

-   [ ] ID do contêiner GTM para o site próprio.
-   [ ] Google Analytics 4.
-   [ ] Google Ads e eventos/rótulos de conversão.
-   [ ] Meta Pixel.
-   [ ] Meta Conversions API ou integração por servidor, se adotada.
-   [ ] Estrutura extensível para outros provedores.
-   [ ] Ativar/desativar cada integração.
-   [ ] Mapear eventos internos para eventos externos.
-   [ ] Testar eventos, erros e deduplicação.
-   [ ] Aplicar controles de consentimento e privacidade.
-   [ ] Relatórios por canal, campanha, segmento e período.

## Licenciamento

ID proposto: `marketing.integrations`.

-   [ ] Controlar quais contas administrativas podem configurar
    integrações.
-   [ ] Separar acesso administrativo à configuração de tags da
    permissão do usuário final.
-   [ ] Manter compatibilidade entre contratos de eventos antigos e
    novos.

------------------------------------------------------------------------

# 15. Compatibilidade permanente entre painel, backend e extensões

Esta é uma regra estrutural e prioritária.

## 15.1 API e contratos

-   [ ] Versionar APIs e contratos de licença.
-   [ ] Fazer mudanças aditivas sempre que possível.
-   [ ] Não remover campos/endpoints usados por versões suportadas sem
    período de transição.
-   [ ] Documentar a versão mínima da extensão suportada.
-   [ ] Manter testes de contrato com versões antigas e atuais.
-   [ ] Usar feature flags para liberar recursos novos gradualmente.
-   [ ] Detectar capacidades da extensão quando necessário, sem usar
    isso como substituto da autorização por licença.
-   [ ] Fornecer mensagens claras quando uma versão estiver obsoleta.

## 15.2 Banco de dados e migrações

-   [ ] Fazer migrações retrocompatíveis.
-   [ ] Preferir o padrão expandir → migrar dados → validar → remover
    legado somente depois da transição.
-   [ ] Não renomear/remover colunas em uso por uma versão antiga sem
    compatibilidade.
-   [ ] Fazer backup antes de migrações de risco.
-   [ ] Testar restauração e rollback.
-   [ ] Manter dados de licenças e contas intactos.

## 15.3 Publicação segura

-   [ ] Rodar testes de contrato e regressão antes de cada deploy.
-   [ ] Fazer liberação gradual.
-   [ ] Monitorar erros de ativação, conexão e endpoints.
-   [ ] Ter rollback de aplicação e plano de recuperação de dados.
-   [ ] Não publicar alterações incompatíveis sem comunicação e plano de
    atualização.
-   [ ] Testar os módulos WhatsApp, Drive, CRM, Maps e RCS após mudanças
    de backend.
-   [ ] Separar falha do painel de falha da extensão em logs e alertas.

------------------------------------------------------------------------

# 16. Segurança, privacidade e confiabilidade

## Riscos já identificados

-   [x] A candidata utiliza validação de token assinado.
-   [x] Existem verificações de segurança relacionadas a licenças.
-   \[!\] A ponte de comunicação `window.postMessage` precisa de
    auditoria adicional.
-   \[!\] A política offline documentada precisa ser alinhada com a
    implementação.
-   \[!\] A validação local não substitui autorização de APIs remotas.
-   [ ] A extensão interage com uma interface de terceiros que pode
    mudar sem aviso.

## Checklist

-   [ ] Validar origem, formato e autorização de mensagens entre
    scripts.
-   [ ] Não confiar em botões ocultos como proteção.
-   [ ] Não executar código remoto.
-   [ ] Validar URLs, webhooks e redirecionamentos.
-   [ ] Não expor credenciais nos logs.
-   [ ] Rate limiting em endpoints e operações.
-   [ ] Idempotência para pedidos, envios e eventos.
-   [ ] Respeitar blacklist em todas as rotas de envio.
-   [ ] Tratar falhas de rede sem perda silenciosa de dados.
-   [ ] Testar reinício/suspensão do service worker.
-   [ ] Testar backup, restauração e conflitos do Google Drive.
-   [ ] Definir retenção e descarte de telemetria.
-   [ ] Criar plano de resposta a incidentes.
-   [ ] Criar mecanismo de desligamento remoto/feature flag para funções
    problemáticas, sem quebrar ações essenciais de segurança.

------------------------------------------------------------------------

# 17. Funcionalidades existentes na base que precisam ser preservadas

A análise da versão-base encontrou módulos de:

-   [x] CRM e gestão de leads.

-   [x] Funil/Kanban.

-   [x] Dashboard e indicadores.

-   [x] Campanhas WhatsApp.

-   [x] Conexão/diagnóstico do WhatsApp.

-   [x] Chats, grupos e recursos de mensagens.

-   [x] Etiquetas e sincronização com etapas.

-   [x] Blacklist.

-   [x] Extração do Google Maps.

-   [x] RCS.

-   [x] Google Drive: conexão, sincronização e restauração.

-   [x] Webhooks.

-   [x] Perfil comercial e classificador.

-   [x] Configurações de aparência e privacidade.

-   [x] Logs locais e diagnóstico.

-   [ ] Reexecutar testes de regressão de todos esses módulos após o
    gate de licenças.

-   [ ] Preservar correções recentes de WhatsApp e Drive.

-   [ ] Confirmar por teste o estado real de cada módulo; presença de
    código não garante funcionamento em todos os cenários.

-   [ ] Não mesclar código antigo sem comparação explícita.

------------------------------------------------------------------------

# 18. A receita do bolo tech: arquitetura recomendada

A arquitetura abaixo separa responsabilidades para reduzir acoplamento e
permitir evolução sem quebrar usuários.

``` text
                       PAINEL ADMINISTRATIVO
        ┌─────────────────────────────────────────────┐
        │ Contas, planos, licenças, catálogo          │
        │ Telemetria, relatórios, notificações, ads   │
        │ Configuração de integrações e auditoria     │
        └──────────────────────┬──────────────────────┘
                               │
                    API versionada e autenticada
                               │
        ┌──────────────────────┴──────────────────────┐
        │                   BACKEND                    │
        │ Licenças e autorização                       │
        │ Recepção/deduplicação de telemetria          │
        │ Agregações e relatórios                      │
        │ Campanhas e configurações públicas           │
        │ Segredos de integrações administrativas      │
        └──────────────────────┬──────────────────────┘
                               │
                 contratos compatíveis por versão
                               │
        ┌──────────────────────┴──────────────────────┐
        │               EXTENSÃO CHROME                │
        │ CRM, Dashboard, WhatsApp Web, Maps, Drive     │
        │ Gate de licença e catálogo de funcionalidades│
        │ Telemetria local em fila                     │
        │ IA local/orquestração pela extensão          │
        │ Chave BYOK armazenada localmente             │
        │ Públicos de Status e interface de anúncios   │
        └───────────┬────────────────┬─────────────────┘
                    │                │
          WhatsApp Web         Provedor de IA escolhido
          (sessão aberta)      (API/chave do usuário)
                    │                │
                    └────────┬───────┘
                             │
                   Google Sheets / OAuth
                   Registro de pedidos
```

## 18.1 Princípios de arquitetura

-   O backend administra licenças e dados administrativos, mas não
    precisa receber as chaves BYOK da IA.
-   O atendimento por WhatsApp acontece pela extensão e depende da
    sessão aberta.
-   O painel recebe eventos de telemetria definidos, não o conteúdo
    completo das conversas por padrão.
-   Google Sheets recebe os pedidos autorizados pelo usuário, com
    credenciais e permissões apropriadas.
-   Campanhas de notificações/anúncios são entregues como dados, nunca
    como código executável remoto.
-   A API deve ser versionada e compatível com versões suportadas da
    extensão.
-   A licença controla o uso de cada recurso, mas não substitui
    autenticação, validação de dados ou segurança.
-   O usuário deve conseguir pausar a IA e verificar claramente o estado
    de conexão/atividade.

## 18.2 Stack e componentes sugeridos (a confirmar no repositório existente)

Não substituir a stack atual sem antes auditar o painel/backend.

-   **Extensão:** Chrome Manifest V3, JavaScript/ES modules, storage
    local, service worker e content scripts conforme a estrutura atual.
-   **Backend:** manter a linguagem/framework e o banco existentes,
    salvo necessidade demonstrada.
-   **API:** endpoints versionados, autenticação, validação de esquema,
    rate limiting e idempotência.
-   **Telemetria:** fila local na extensão, ingestão em lotes,
    armazenamento de eventos e tabelas/agregações para relatórios.
-   **Google Sheets:** OAuth/autorizações adequadas e API oficial do
    Google para planilhas.
-   **IA:** adaptadores de provedores, BYOK, seleção de modelo, limites
    e erros normalizados.
-   **Marketing:** GTM no site próprio e eventos encaminhados por
    integrações controladas.
-   **Entrega gradual:** feature flags, grupo de testes, métricas de
    saúde e rollback.
-   **Testes:** testes unitários, contratos API, integração, licença,
    Chrome real e regressão dos módulos.

------------------------------------------------------------------------

# 19. Plano de execução por prioridade

## P0 --- Congelar a base e revisar riscos

-   [ ] Confirmar ZIP e versão instalada.
-   [ ] Preservar backup e comparar alterações pendentes.
-   [ ] Auditar ponte de mensagens do WhatsApp.
-   [ ] Alinhar política offline.
-   [ ] Recuperar/criar suíte de testes.
-   [ ] Testar WhatsApp, Google Drive, CRM, Maps e RCS.

**Critério de saída:** base reproduzível e conjunto mínimo de testes de
regressão.

## P1 --- Compatibilidade e licenciamento

-   [ ] Receber o código do painel/backend.
-   [ ] Confirmar contrato de token atual.
-   [ ] Integrar catálogo de funções.
-   [ ] Implementar permissões por plano e conta.
-   [ ] Implementar limites e licença administrativa.
-   [ ] Criar testes de contrato para versões suportadas.
-   [ ] Garantir que atualizações do painel não quebrem conexões.
-   [ ] Testar licenças reais.

**Critério de saída:** o painel autoriza e a extensão aplica
corretamente as permissões, sem regressão nas versões suportadas.

## P2 --- Fluxo comercial do Dashboard

-   [ ] Validar lista de conversas aguardando resposta.
-   [ ] Validar abertura do chat exato.
-   [ ] Validar barra horizontal de etapas CRM.
-   [ ] Criar estados de erro e recuperação.

**Critério de saída:** o usuário identifica uma pendência e abre o chat
correto sem ambiguidade.

## P3 --- Telemetria e funil comercial

-   [ ] Definir esquema de eventos e fontes de verdade.
-   [ ] Implementar fila e endpoint de telemetria.
-   [ ] Criar perfil profissional opcional.
-   [ ] Instrumentar CRM, conversas, campanhas, IA, Sheets e resultados
    comerciais.
-   [ ] Implementar deduplicação e agregações.
-   [ ] Criar relatórios por nicho, plano, versão, módulo e período.
-   [ ] Implementar controles de privacidade e retenção.

**Critério de saída:** o painel mostra uso real e resultados comerciais,
distinguindo eventos detectados de vendas registradas.

## P4 --- Atendimento com IA pela extensão

-   [ ] Projetar adaptadores de provedores BYOK.
-   [ ] Implementar armazenamento local da chave.
-   [ ] Configurar prompt/base de conhecimento.
-   [ ] Implementar detecção e processamento de mensagens no WhatsApp
    Web.
-   [ ] Implementar estados de conexão, fila e prevenção de duplicidade.
-   [ ] Integrar Google Sheets.
-   [ ] Integrar notificação ao vendedor via WhatsApp Web.
-   [ ] Implementar confirmação condicional ao cliente.
-   [ ] Implementar handoff humano, limites e pausa.
-   [ ] Adicionar permissões no catálogo.
-   [ ] Testar falhas de IA, WhatsApp, rede e Sheets.

**Critério de saída:** o fluxo de pedido funciona ponta a ponta em teste
real, sem confirmações falsas ou duplicidade.

## P5 --- Segmentação de Status

-   [ ] Auditar leitura de etiquetas e contatos.
-   [ ] Criar públicos salvos, prévia e exclusões.
-   [ ] Validar aplicação assistida na interface.
-   [ ] Exigir confirmação explícita.
-   [ ] Integrar `whatsapp.status_audience` ao catálogo.
-   [ ] Testar mudanças da interface e fallback manual.

**Critério de saída:** o público é calculado corretamente e nenhuma
seleção ambígua é aplicada.

## P6 --- Notificações e anúncios

-   [ ] Criar editor e API de notificações.
-   [ ] Implementar segmentação, agendamento e frequência.
-   [ ] Criar editor de anúncios de rodapé.
-   [ ] Implementar entrega segura e métricas.
-   [ ] Integrar ao catálogo de licenças.
-   [ ] Testar campanhas pausadas, expiradas, offline e segmentadas.

**Critério de saída:** conteúdo correto chega ao público correto, sem
executar código remoto.

## P7 --- GTM e marketing

-   [ ] Configurar GTM no site próprio.
-   [ ] Integrar Analytics/Ads/Meta e provedores aprovados.
-   [ ] Mapear eventos e conversões.
-   [ ] Deduplicar eventos navegador/servidor.
-   [ ] Validar consentimento e atribuição.
-   [ ] Criar relatórios de aquisição e conversão.

**Critério de saída:** aquisição, ativação e conversão podem ser
analisadas de ponta a ponta.

## P8 --- Estabilização e publicação

-   [ ] Testes unitários e de integração.
-   [ ] Testes de contrato com versões antigas.
-   [ ] Testes manuais no Chrome.
-   [ ] Testes com WhatsApp Web conectado/desconectado.
-   [ ] Testes com licenças reais.
-   [ ] Testes de rede, duplicidade, suspensão e retomada.
-   [ ] Liberação gradual para grupo de teste.
-   [ ] Monitoramento pós-release.
-   [ ] Changelog e instruções.
-   [ ] Plano de rollback validado.

------------------------------------------------------------------------

# 20. Matriz mínima de testes de licenciamento

  -----------------------------------------------------------------------
  Cenário                             Resultado esperado
  ----------------------------------- -----------------------------------
  Sem licença                         Modo de demonstração; operações
                                      bloqueadas

  Licença gratuita                    Somente funções explicitamente
                                      autorizadas

  Licença de teste                    Direitos e limites definidos pelo
                                      painel

  Pro Mensal                          Direitos do plano, sem funções
                                      extras acidentais

  Pro Multitelas                      Direitos e política de dispositivos
                                      próprios

  Licença administrativa              Acesso de teste autorizado e
                                      auditado

  Token inválido/alterado             Recusa

  Token expirado                      Política documentada e consistente

  Licença revogada                    Bloquear novas operações e encerrar
                                      atividades de forma segura

  Permissão ausente                   Negar a função

  Permissão removida no painel        Atualizar dentro do prazo definido

  Backend indisponível                Comportamento previsível sem
                                      corromper dados

  Função desligada globalmente        Não iniciar novas operações

  Versão antiga suportada             Continua conectando e utilizando
                                      contratos antigos

  Nova função não suportada           Não quebrar módulos antigos;
                                      apresentar compatibilidade adequada
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 21. Critério de conclusão ("Definition of Done")

Uma função só pode ser marcada como concluída quando:

-   [ ] Está no catálogo com ID estável.
-   [ ] O painel consegue liberar/bloquear por plano e conta.
-   [ ] O token/contrato reflete a permissão real.
-   [ ] A extensão verifica a autorização no ponto de execução.
-   [ ] O backend valida operações remotas quando aplicável.
-   [ ] A interface apresenta estados e erros claros.
-   [ ] A telemetria registra os eventos pertinentes sem coleta
    excessiva.
-   [ ] Há tratamento de falhas e recuperação.
-   [ ] Há testes de sucesso, falha, falta de licença, limites e
    revogação.
-   [ ] Há testes de compatibilidade e regressão.
-   [ ] A documentação foi atualizada.
-   [ ] Foi validada em Chrome real com sessão de teste.
-   [ ] Há rollback ou feature flag para desativar a função.
-   [ ] Nenhuma atualização quebra as versões de extensão que o projeto
    promete suportar.

------------------------------------------------------------------------

# 22. O que é necessário para continuar

O próximo passo técnico é receber e analisar o código atual do **painel
administrativo e backend**, incluindo:

-   [ ] Cadastro de contas e usuários.
-   [ ] Emissão, ativação e revogação de licenças.
-   [ ] Geração e assinatura dos tokens.
-   [ ] Cadastro de planos e permissões.
-   [ ] Endpoint de ativação atual.
-   [ ] Autenticação e autorização administrativas.
-   [ ] Banco de dados e migrações.
-   [ ] Infraestrutura atual de telemetria, se houver.
-   [ ] Configuração do site de vendas/checkout.
-   [ ] Integrações de marketing existentes.

Não enviar senhas, arquivos `.env`, chaves privadas ou tokens reais de
produção. Usar uma cópia de desenvolvimento com segredos removidos.

------------------------------------------------------------------------

# 23. Resumo final

O i9Leads Flow deverá evoluir com uma base de licenciamento
centralizada, telemetria comercial útil, experiência simples para novos
usuários e módulos que funcionem de ponta a ponta.

As prioridades são:

1.  **Compatibilidade permanente:** atualizar o painel sem quebrar as
    extensões suportadas.
2.  **Licenciamento confiável:** somente o painel concede direitos; a
    extensão aplica os direitos em cada operação.
3.  **Telemetria comercial:** medir conversas, leads, oportunidades,
    pedidos, vendas e clientes fechados com fontes de dados confiáveis.
4.  **Atendimento com IA local à extensão:** BYOK, WhatsApp Web, Google
    Sheets, notificação ao vendedor e confirmação condicional, sem API
    oficial do WhatsApp.
5.  **Experiência comercial:** abrir chats pendentes, melhorar a
    navegação do CRM e segmentar Status por etiquetas quando
    tecnicamente viável.
6.  **Marketing administrável:** notificações segmentadas, anúncios no
    rodapé, GTM e integrações de conversão.
7.  **Segurança e qualidade:** privacidade, testes, rollout gradual,
    monitoramento e rollback.

**A receita do bolo tech:** primeiro estabilizar contratos e licenças;
depois instrumentar eventos e fontes de verdade; em seguida concluir o
fluxo comercial de IA e o Dashboard; por fim adicionar segmentação de
Status, notificações, anúncios e marketing. Cada etapa deve ser
integrada, testada e aprovada antes da próxima.

**Princípio final:** nenhuma função está pronta só porque aparece na
tela. Ela precisa ser autorizada pelo painel, funcionar no ambiente
real, registrar corretamente seus resultados, respeitar os dados do
usuário e continuar funcionando depois de uma atualização compatível.
