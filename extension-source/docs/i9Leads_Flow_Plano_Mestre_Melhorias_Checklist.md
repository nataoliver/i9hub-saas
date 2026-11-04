# i9Leads Flow --- Plano Mestre de Melhorias e Checklist Comercial

**Documento de referência do projeto**\
**Data:** 17 de outubro de 2026\
**Versão-base da extensão:** `i9Leads-Flow-Extensao-v5.3.2-fix1.zip`\
**Objetivo:** consolidar as melhorias discutidas, distinguir o que já
existe do que precisa ser implementado e definir critérios para
transformar o i9Leads Flow em uma extensão comercial robusta, segura,
mensurável e fácil de administrar.

------------------------------------------------------------------------

## 1. Como usar este documento

Este é o checklist mestre para orientar a auditoria, o desenvolvimento,
os testes e a integração com o painel administrativo.

### Legenda de status

-   [x] **Encontrado no ZIP analisado:** existe no código da
    versão-base, mas ainda pode precisar de testes funcionais.
-   [ ] **Pendente:** precisa ser desenvolvido, integrado ou validado.
-   \[!\] **Parcial / precisa de confirmação:** existe algo relacionado,
    mas a implementação atual não atende necessariamente ao requisito
    completo.
-   **Importante:** uma funcionalidade visualmente presente não
    significa que esteja protegida por licença, conectada ao backend ou
    testada em produção.

### Regras de trabalho

-   [x] Usar o ZIP `i9Leads-Flow-Extensao-v5.3.2-fix1.zip` como base da
    análise.
-   [x] Preservar as correções recentes de WhatsApp e Google Drive.
-   [x] Manter o RCS como módulo existente, mesmo que sua entrada esteja
    oculta no menu desta versão.
-   [ ] Não substituir arquivos por versões antigas nem misturar código
    da 5.2.1 com a base 5.3.2-fix1 sem comparação explícita.
-   [ ] Antes de publicar, comparar a versão candidata com a base e
    verificar regressões.
-   [ ] Só considerar uma função concluída depois de validar interface,
    autorização, backend quando aplicável, telemetria e testes.

------------------------------------------------------------------------

## 2. Resumo executivo

O projeto precisa evoluir em seis frentes integradas:

1.  **Catálogo central de funcionalidades e licenciamento por recurso.**
2.  **Telemetria comportamental e segmentação comercial por profissão,
    nicho, plano e utilização.**
3.  **Central de marketing e rastreamento:** Google Tag Manager no site
    de vendas, eventos próprios da extensão e integrações compatíveis
    com Google Analytics, Google Ads, Meta e outros serviços.
4.  **Central de notificações segmentadas** enviadas pelo painel
    administrativo.
5.  **Gerenciador de anúncios no rodapé da extensão**, com imagem,
    texto, link, botão, segmentação e métricas.
6.  **Melhorias operacionais na experiência comercial**, incluindo abrir
    o chat exato de quem aguarda resposta, melhorar a navegação pelas
    etapas do CRM, segurança, confiabilidade e testes.

A recomendação é evitar sistemas paralelos: o painel administrativo, o
backend e a extensão devem compartilhar contratos claros para licenças,
funcionalidades, eventos, segmentos e campanhas.

------------------------------------------------------------------------

## 3. Estado da versão-base analisada

### 3.1 Pacote e estrutura

-   [x] ZIP válido analisado:
    `i9Leads-Flow-Extensao-v5.3.2-fix1(1).zip`.
-   [x] O pacote contém 59 arquivos, incluindo 42 arquivos JavaScript.
-   [x] Manifesto da extensão na versão 5.3.2.
-   [x] Extensão Chrome Manifest V3.
-   [x] Service worker em módulo ES.
-   [x] Código separado em `background`, `content`, `lib`, `sidepanel`,
    `popup` e `options`.
-   \[!\] O README descreve scripts e testes (`package.json`,
    `scripts/check.mjs` e pasta `test/`) que não estão presentes neste
    ZIP. Precisamos recuperar ou recriar os testes antes de depender
    deles no processo de publicação.
-   [ ] Executar uma suíte de validação completa na versão de trabalho,
    além da inspeção estática.
-   [ ] Testar a versão instalada no Chrome com uma conta de teste e
    WhatsApp Web real.

### 3.2 Funcionalidades encontradas

  -------------------------------------------------------------------------
  Módulo                  Estado observado na     Próximo passo
                          versão-base             
  ----------------------- ----------------------- -------------------------
  CRM e leads             \[x\] Cadastro,         \[ \] Auditar cada
                          consulta, edição,       operação e associar
                          exclusão, classificação permissões individuais
                          e organização de leads  

  Funil e Kanban          \[x\] Estágios          \[!\] Confirmar se a
                          comerciais e            barra horizontal de
                          visualização Kanban     etapas solicitada está
                          existentes              implementada como
                                                  desejado

  Dashboard               \[x\] Indicadores de    \[ \] Adicionar a lista
                          campanhas, mensagens    de contatos aguardando
                          enviadas, taxa de       resposta e o botão para
                          sucesso, leads e        abrir o chat exato
                          campanhas recentes      

  Campanhas WhatsApp      \[x\] Criar, editar,    \[ \] Testar limites,
                          excluir, iniciar,       falhas, duplicidades,
                          pausar, retomar e       autorização e telemetria
                          reenviar campanhas      

  Conexão WhatsApp        \[x\] Estado da         \[ \] Revalidar a
                          conexão,                correção de conexão da
                          abertura/seleção de     versão atual em testes de
                          aba, janela, recarga e  regressão
                          diagnóstico             

  Chats e grupos          \[x\] Extração de       \[ \] Proteger por
                          chats, participantes e  funcionalidade e revisar
                          mensagens, além de      privacidade/minimização
                          sincronização de        de dados
                          oportunidades           

  Etiquetas WhatsApp      \[x\] Diagnóstico e     \[ \] Adicionar testes de
                          sincronização de        sincronização e
                          etiquetas com estágios  permissões

  Blacklist               \[x\] Consulta, adição, \[ \] Testar se todas as
                          remoção e inclusão em   rotas de envio respeitam
                          lote                    a lista de bloqueio

  Google Maps             \[x\] Extração de       \[ \] Testar limites,
                          empresas e controle de  deduplicação, erros e
                          execução                autorização por plano

  RCS                     \[x\] Templates, saldo, \[ \] Preservar o módulo;
                          campanhas e envio       confirmar o motivo da
                          individual/em lote      entrada oculta e testar
                                                  sua autorização

  Google Drive            \[x\] Conexão,          \[ \] Testar conflitos,
                          sincronização,          falhas e recuperação;
                          restauração,            preservar correções
                          sobrescrita e           recentes
                          sincronização           
                          automática              

  Webhooks                \[x\] Configuração,     \[ \] Revisar testes de
                          teste, método,          segurança e garantir que
                          cabeçalhos e API Key    credenciais nunca vazem

  Perfil comercial        \[x\] Perfil do negócio \[ \] Integrar alterações
                          e catálogo de perfis    e recursos aos direitos
                                                  de licença

  Classificador           \[x\] Classificação de  \[ \] Definir permissões
                          leads e regras de       separadas para funções
                          perfil                  relevantes

  Configurações e         \[x\] Preferências de   \[ \] Documentar coleta,
  privacidade             aparência, privacidade  retenção, consentimento e
                          e configurações         preferências de
                          operacionais            telemetria

  Logs locais             \[x\] Registro local de \[ \] Separar logs locais
                          eventos operacionais    de telemetria enviada ao
                                                  backend

  Licenciamento           \[x\]                   \[ \] Integrar catálogo
                          Ativação/validação de   de permissões por recurso
                          licença e verificação   e confirmar contrato real
                          local de token assinado do backend

  Telemetria              \[ \] Não foi           \[ \] Desenvolver coleta,
  administrativa          encontrado um mecanismo fila, API, armazenamento
                          geral dedicado para     e relatórios
                          enviar eventos de       
                          utilização ao painel    

  GTM/pixels              \[ \] Não foi           \[ \] Implementar central
                          encontrada uma central  de rastreamento e
                          integrada de            integrações seguras
                          configuração de         
                          tags/pixels             

  Notificações            \[ \] Não foi           \[ \] Desenvolver
  administrativas         encontrada uma central  criação, segmentação,
                          para enviar             entrega e métricas
                          notificações            
                          segmentadas             

  Anúncios no rodapé      \[ \] Não foi           \[ \] Desenvolver slot
                          encontrado um           publicitário, campanhas e
                          gerenciador de anúncios métricas
                          administrável pelo      
                          painel                  

  Atalho para chat        \[ \] O Dashboard atual \[ \] Implementar
  pendente                não apresenta a lista   identificação de conversa
                          solicitada com botão    e navegação segura
                          para abrir a conversa   
                          exata                   

  Barra horizontal de     \[!\] Há Kanban         \[ \] Validar o
  etapas CRM              horizontal com rolagem; comportamento e
                          não está confirmado que complementar se
                          exista a barra          necessário
                          horizontal de navegação 
                          por todas as etapas     
                          solicitada              
  -------------------------------------------------------------------------

### 3.3 Dashboard atual: limite confirmado

O `DashboardView.js` da versão-base apresenta:

-   [x] Campanhas ativas.
-   [x] Mensagens enviadas hoje.
-   [x] Taxa de sucesso.
-   [x] Leads salvos, conforme o caminho de carregamento de dados.
-   [x] Ações rápidas para nova campanha, extração do Maps e CRM.
-   [x] Campanhas recentes com ações de visualização, pausa, retomada e
    exclusão, conforme o estado da campanha.

Ainda precisa ser implementado:

-   [ ] Lista de conversas em que o cliente enviou uma mensagem e a
    empresa ainda não respondeu.
-   [ ] Tempo desde a última mensagem recebida.
-   [ ] Botão **Abrir conversa** para abrir o chat exato daquela pessoa.
-   [ ] Atualização do estado pendente depois que uma resposta for
    enviada.
-   [ ] Tratamento de contatos que não podem ser localizados.
-   [ ] Métricas de atendimento, como pendências por período e tempo de
    resposta, se houver dados confiáveis.

------------------------------------------------------------------------

## 4. Catálogo central de funcionalidades e controle por licença

### 4.1 Objetivo

Todas as funções reais da extensão devem constar em um catálogo central
no painel administrativo. O catálogo deverá permitir que o administrador
libere ou bloqueie cada função para cada plano e, quando necessário,
para uma conta específica.

A configuração do painel só será efetiva quando a extensão e as APIs
protegidas realmente aplicarem as permissões.

### 4.2 Checklist de implementação

-   [x] Existe licenciamento com ativação e verificação de token.
-   [x] Existe um limite geral de três ações gratuitas na versão
    analisada.
-   [x] O código lista dez tipos de operação que contam para o limite
    gratuito.
-   \[!\] O token descrito no README contém campos como `plan`, `ent` e
    `limits`, mas a auditoria inicial não encontrou aplicação
    generalizada desses direitos em cada handler.
-   [ ] Criar o catálogo canônico de funções, com identificadores
    estáveis.
-   [ ] Associar cada função a um ou mais handlers e pontos reais de
    execução.
-   [ ] Associar cada função às permissões disponíveis por plano.
-   [ ] Permitir exceções individuais por conta.
-   [ ] Implementar limites quantitativos quando necessários, por
    exemplo, quantidade de operações, contatos ou execuções por período.
-   [ ] Validar permissões na interface e no service worker.
-   [ ] Aplicar validação no backend para operações que dependem de APIs
    remotas.
-   [ ] Atualizar permissões sem exigir reinstalação da extensão.
-   [ ] Definir cache e prazo de atualização das permissões.
-   [ ] Registrar alterações administrativas e o responsável pela
    alteração.
-   [ ] Implementar mensagens claras para recurso bloqueado, limite
    atingido, licença inválida e falha temporária.
-   [ ] Criar testes de autorização para todos os módulos.
-   [ ] Criar licença administrativa de teste com acesso integral,
    mantendo autenticação e controles de segurança.
-   [ ] Garantir que uma licença administrativa de teste não se
    transforme em uma forma de contornar autenticação no backend.

### 4.3 Identificadores iniciais propostos

Os nomes abaixo são uma proposta de organização; não significa que já
existam no código com esses identificadores.

  Identificador proposto             Escopo
  ---------------------------------- ---------------------------------------
  `dashboard.analytics`              Indicadores do Dashboard
  `dashboard.awaiting_reply`         Lista de contatos aguardando resposta
  `crm.leads`                        Gestão de leads
  `crm.kanban`                       Funil e etapas
  `crm.custom_fields`                Campos personalizados
  `crm.classification.manual`        Classificação manual
  `crm.classification.auto`          Classificação automática
  `crm.deduplication`                Remoção de duplicidades
  `crm.export.csv`                   Exportação CSV
  `crm.export.webhook`               Exportação por webhook
  `crm.blacklist`                    Lista de bloqueio
  `whatsapp.chat_list`               Lista de conversas
  `whatsapp.group_members`           Extração de participantes
  `whatsapp.chat_messages`           Extração de mensagens
  `whatsapp.private_opportunities`   Sincronização de oportunidades
  `whatsapp.labels_sync`             Sincronização de etiquetas
  `whatsapp.campaigns.manage`        Gestão de campanhas
  `whatsapp.campaigns.send`          Execução e reenvio de campanhas
  `whatsapp.connection`              Conexão e diagnóstico
  `whatsapp.background_mode`         Recursos de operação em segundo plano
  `maps.extraction`                  Extração do Google Maps
  `rcs.templates`                    Consulta de templates RCS
  `rcs.balance`                      Consulta de saldo RCS
  `rcs.send_single`                  Envio individual RCS
  `rcs.campaigns`                    Campanhas RCS
  `business.profile`                 Perfil comercial
  `settings.webhook`                 Configuração de webhooks
  `settings.spintax`                 Presets Spintax
  `settings.delays`                  Intervalos de envio
  `settings.classifier`              Regras do classificador
  `settings.privacy`                 Preferências de privacidade
  `settings.appearance`              Aparência
  `data.backup.manual`               Backup manual
  `drive.sync`                       Sincronização com Google Drive
  `system.logs`                      Logs e diagnóstico
  `help.tour`                        Tutorial e ajuda
  `telemetry.usage`                  Coleta e envio de telemetria
  `notifications.in_app`             Notificações dentro da extensão
  `ads.footer`                       Anúncios no rodapé

### 4.4 Regras recomendadas de autorização

-   [ ] Definir a precedência entre bloqueio de segurança, bloqueio
    global, plano, exceção da conta e acesso administrativo.
-   [ ] Fazer com que bloqueios críticos de segurança nunca sejam
    ignorados por permissões comerciais.
-   [ ] Tratar os direitos do token como uma autorização verificável e
    assinada, não como valores arbitrários editáveis na extensão.
-   [ ] Validar no servidor operações de alto impacto, envio e consumo
    de recursos quando aplicável.
-   [ ] Registrar a versão do catálogo e a data de atualização das
    permissões.
-   [ ] Definir comportamento offline seguro e coerente.
-   [ ] Corrigir a divergência observada entre a tolerância offline
    indicada no código e a documentada no README antes de alterar a
    política.
-   [ ] Confirmar com o backend o formato real dos campos de permissões
    e limites antes de implementar o consumo desses campos.

------------------------------------------------------------------------

## 5. Telemetria comportamental e inteligência de uso

### 5.1 Objetivo comercial

A telemetria deverá ajudar a responder perguntas reais sobre adoção,
comportamento e conversão:

-   Quantas contas ativas existem por período?
-   Quantas pessoas declararam ser contadores, advogados, corretores,
    profissionais de marketing ou atuar em outros segmentos?
-   Quais funções cada nicho utiliza mais?
-   Quais módulos são utilizados com frequência e quais são ignorados?
-   Quais usuários gratuitos atingem limites ou demonstram interesse em
    recursos premium?
-   Quais segmentos iniciam testes e contratam planos pagos?
-   Quais versões apresentam mais erros?
-   Quais ações estão associadas à retenção e ao uso recorrente?
-   Qual é o tempo entre instalação, primeiro uso e primeira conversão?
-   Quais campanhas administrativas geram visualizações, cliques e
    conversões?

### 5.2 Perfil profissional e de negócio

-   [ ] Criar um perfil opcional que pergunte profissão ou área de
    atuação.
-   [ ] Permitir categorias como contabilidade, advocacia, imobiliário,
    marketing/agência, vendas, serviços e outras.
-   [ ] Permitir "outra profissão" e "prefiro não informar".
-   [ ] Permitir declarar tipo de negócio, tamanho da equipe e objetivos
    de utilização.
-   [ ] Permitir alterar o perfil posteriormente.
-   [ ] Distinguir no banco de dados informação **declarada** pelo
    usuário de segmento **inferido** por comportamento.
-   [ ] Não apresentar uma profissão inferida como fato confirmado.
-   [ ] Informar a finalidade da coleta e oferecer controles de
    privacidade apropriados.
-   [ ] Definir a base legal e as regras de transparência com avaliação
    compatível com a LGPD.

### 5.3 Eventos que devem ser registrados

  -----------------------------------------------------------------------
  Categoria                           Exemplos
  ----------------------------------- -----------------------------------
  Instalação e versão                 Primeira abertura, versão
                                      instalada, atualização detectada

  Engajamento                         Extensão aberta, módulo acessado,
                                      retorno ao produto

  CRM                                 Leads cadastrados, etapas
                                      alteradas, duplicidades removidas,
                                      exportações

  WhatsApp                            Campanhas iniciadas/concluídas,
                                      falhas, pausas, resultados
                                      agregados

  Google Maps                         Extrações iniciadas/concluídas,
                                      volume agregado e erros

  RCS                                 Envios e campanhas, quando
                                      aplicável

  Google Drive                        Conexão, sincronização, restauração
                                      e falhas

  Licenciamento                       Plano, permissão negada, limite
                                      atingido e estado da licença

  Conversão                           Visualização de planos, início de
                                      teste, contratação ou cancelamento,
                                      quando integrados

  Notificações                        Elegibilidade, mensagem obtida,
                                      exibida, clicada ou dispensada

  Anúncios                            Impressão visível, clique e
                                      conversão atribuída

  Erros                               Código de erro, módulo, versão e
                                      contexto técnico mínimo
  -----------------------------------------------------------------------

### 5.4 Dados que não devem ser enviados indiscriminadamente

O objetivo é obter informações operacionais e comportamentais úteis, não
copiar o conteúdo comercial dos usuários.

-   [ ] Não enviar corpo de mensagens do WhatsApp como telemetria
    padrão.
-   [ ] Não enviar nomes e telefones de contatos nem listas completas de
    leads para medir utilização.
-   [ ] Não enviar credenciais, tokens de licença completos, API Keys ou
    segredos.
-   [ ] Não transmitir conteúdo de páginas de terceiros sem finalidade,
    autorização e análise específicas.
-   [ ] Registrar contagens agregadas quando isso for suficiente.
-   [ ] Permitir que erros sejam diagnosticados com códigos e contexto
    técnico minimizado.
-   [ ] Documentar finalidade, acesso, retenção e descarte dos dados.

### 5.5 Arquitetura técnica da telemetria

-   [ ] Criar um módulo de eventos na extensão.
-   [ ] Padronizar nome, versão do evento, horário, instalação
    pseudônima, versão da extensão, módulo, resultado e atributos
    permitidos.
-   [ ] Criar fila local resiliente para eventos pendentes.
-   [ ] Enviar eventos em lotes para reduzir requisições.
-   [ ] Implementar novas tentativas com espera progressiva.
-   [ ] Implementar identificadores únicos e deduplicação no backend.
-   [ ] Evitar que a telemetria interrompa CRM, WhatsApp, Maps, Drive ou
    campanhas quando a rede estiver indisponível.
-   [ ] Criar endpoint autenticado no backend.
-   [ ] Validar tamanho, formato e frequência de envio.
-   [ ] Armazenar eventos com política de retenção definida.
-   [ ] Criar agregações para relatórios, sem precisar consultar todos
    os eventos brutos a cada abertura do painel.
-   [ ] Criar indicadores de falha da própria telemetria.
-   [ ] Documentar o que é obrigatório, opcional e dependente de
    consentimento ou preferência.

### 5.6 Relatórios administrativos necessários

-   [ ] Usuários ativos por dia, semana e mês.
-   [ ] Ativação: instalação, primeiro acesso e primeira ação relevante.
-   [ ] Retenção por coorte.
-   [ ] Adoção por funcionalidade e módulo.
-   [ ] Utilização por plano.
-   [ ] Utilização por profissão/nicho declarado.
-   [ ] Combinação de profissão, plano e funcionalidades.
-   [ ] Limites atingidos e recursos bloqueados.
-   [ ] Erros por módulo e versão.
-   [ ] Conversão de gratuito para pago.
-   [ ] Resultados de notificações e anúncios por segmento.
-   [ ] Filtros por período, versão, plano, nicho e funcionalidade.
-   [ ] Proteções contra acesso indevido a dados individuais e
    divulgação de grupos muito pequenos.

------------------------------------------------------------------------

## 6. Google Tag Manager, pixels e rastreamento de marketing

### 6.1 Arquitetura recomendada

O Google Tag Manager deve ser utilizado nas páginas web próprias do
produto --- por exemplo, site de vendas, página de planos e checkout. A
extensão deve registrar seus próprios eventos e enviá-los à API do
i9Leads Flow. O backend poderá encaminhar eventos compatíveis às
integrações configuradas.

**Não carregar um contêiner GTM capaz de executar código remoto
arbitrário dentro da extensão.** O Manifest V3 impõe restrições a código
remoto e a execução de tags de terceiros dentro da extensão pode criar
riscos de segurança e conformidade.

### 6.2 Configurações no painel

-   [ ] ID do contêiner do Google Tag Manager para o site.
-   [ ] ID de medição do Google Analytics 4, quando aplicável.
-   [ ] Google Ads: identificadores e rótulos de conversão.
-   [ ] Meta Pixel: identificador do pixel.
-   [ ] Meta Conversions API ou integrações equivalentes por servidor,
    quando configuradas.
-   [ ] Estrutura extensível para outras plataformas compatíveis.
-   [ ] Ativar/desativar cada integração.
-   [ ] Mapear eventos internos para eventos externos.
-   [ ] Enviar evento de teste e apresentar resultado.
-   [ ] Exibir estado, último envio e erros.
-   [ ] Guardar segredos exclusivamente no backend, com controles de
    acesso.
-   [ ] Não distribuir tokens de API de conversão dentro da extensão.
-   [ ] Não executar tags dentro do WhatsApp Web ou de outros sites de
    terceiros.
-   [ ] Separar analytics de publicidade e aplicar os controles de
    consentimento e privacidade pertinentes.
-   [ ] Definir deduplicação entre eventos enviados pelo navegador e
    pelo servidor.
-   [ ] Associar conversões a contas autenticadas apenas quando
    permitido e necessário.

### 6.3 Medição ponta a ponta

-   [ ] Medir aquisição no site.
-   [ ] Registrar instalação/ativação quando houver vínculo legítimo.
-   [ ] Medir primeira utilização e adoção de recursos.
-   [ ] Medir início de teste e assinatura.
-   [ ] Medir conversões de campanhas administrativas.
-   [ ] Criar relatórios de desempenho por canal, campanha e segmento.
-   [ ] Definir como tratar usuários que recusam rastreamento
    publicitário, sem impedir funções essenciais do produto.

------------------------------------------------------------------------

## 7. Central de notificações administrada pelo painel

### 7.1 Objetivo

Permitir criar e enviar mensagens discretas para todos os usuários ou
para grupos específicos, sem precisar publicar uma nova versão da
extensão a cada alteração de conteúdo.

### 7.2 Recursos do editor de notificações

-   [ ] Criar, editar, duplicar, pré-visualizar, agendar, pausar,
    publicar e encerrar notificações.
-   [ ] Título e texto.
-   [ ] Ícone ou imagem opcional.
-   [ ] Texto do botão.
-   [ ] URL de destino ou rota interna da extensão.
-   [ ] Público-alvo.
-   [ ] Data/hora de início e encerramento.
-   [ ] Prioridade.
-   [ ] Estado de rascunho, agendada, ativa, pausada e encerrada.
-   [ ] Envio de teste para a licença administrativa.
-   [ ] Histórico de alterações e responsável pela publicação.
-   [ ] Validação de URL e conteúdo antes da publicação.

### 7.3 Segmentação

-   [ ] Todos os usuários elegíveis.
-   [ ] Plano ou tipo de licença.
-   [ ] Profissão/nicho declarado.
-   [ ] Categoria de negócio.
-   [ ] Versão da extensão.
-   [ ] Módulos e funcionalidades utilizados.
-   [ ] Usuários ativos ou inativos, segundo uma definição configurável.
-   [ ] Usuários gratuitos que atingiram limites.
-   [ ] Usuários que demonstraram interesse em um recurso, quando esse
    sinal estiver disponível e for adequado.
-   [ ] Exclusões de segmentos e listas de supressão.
-   [ ] Prévia da estimativa de público antes de publicar.

### 7.4 Experiência do usuário e frequência

-   [ ] Popup discreto, sem bloquear o trabalho.
-   [ ] Botão para fechar.
-   [ ] Opção para dispensar ou marcar como lida.
-   [ ] Limite de frequência por usuário.
-   [ ] Evitar mostrar repetidamente a mesma notificação.
-   [ ] Definir regras de prioridade quando houver várias campanhas.
-   [ ] Não mostrar uma sequência excessiva de popups.
-   [ ] Respeitar preferências de comunicação e requisitos legais
    aplicáveis.
-   [ ] Definir se notificações promocionais e avisos operacionais terão
    regras distintas.

### 7.5 Entrega técnica

-   [ ] Consultar notificações ao abrir a extensão.
-   [ ] Atualizar campanhas periodicamente enquanto a extensão estiver
    ativa, com intervalo configurável e razoável.
-   [ ] Não depender de execução contínua do service worker Manifest V3.
-   [ ] Guardar localmente os identificadores já exibidos e o estado de
    leitura, quando adequado.
-   [ ] Tratar modo offline e retomar consultas depois da reconexão.
-   [ ] Considerar notificações nativas do navegador como recurso
    opcional, com permissões próprias.
-   [ ] Não prometer entrega instantânea se a extensão estiver fechada
    ou offline.
-   [ ] Garantir que conteúdo remoto seja renderizado como texto e
    elementos seguros, nunca como JavaScript remoto.

### 7.6 Métricas

-   [ ] Público elegível.
-   [ ] Notificação publicada.
-   [ ] Notificação obtida pela extensão.
-   [ ] Notificação efetivamente exibida.
-   [ ] Clique no botão.
-   [ ] Fechamento/dispensa.
-   [ ] Conversão atribuída, se houver integração.
-   [ ] Desempenho por nicho, plano, versão e período.
-   [ ] Separar "enviada ao sistema", "obtida pela extensão" e "vista
    pelo usuário"; não tratar esses estados como equivalentes.

------------------------------------------------------------------------

## 8. Gerenciador de anúncios no rodapé da extensão

### 8.1 Objetivo

Manter um espaço publicitário compacto e administrável no rodapé da
interface da extensão. O conteúdo pode promover planos, novos recursos,
campanhas ou ofertas específicas.

### 8.2 Campos configuráveis

-   [ ] Imagem.
-   [ ] Título.
-   [ ] Texto/descrição.
-   [ ] Texto do botão.
-   [ ] URL de destino.
-   [ ] Texto de identificação, por exemplo, "Anúncio" ou "Oferta".
-   [ ] Estilo visual dentro de limites seguros.
-   [ ] Data de início e fim.
-   [ ] Estado ativo/pausado/encerrado.
-   [ ] Prioridade e ordem de exibição.
-   [ ] Segmentos elegíveis.
-   [ ] Planos incluídos ou excluídos.
-   [ ] Opção de ocultar anúncios em planos pagos.
-   [ ] Opção de dispensar/fechar quando apropriado.
-   [ ] Limite de frequência e regras de rotação, se houver várias
    campanhas.
-   [ ] Pré-visualização em diferentes dimensões da side panel.

### 8.3 Regras de experiência

-   [ ] O anúncio ocupa apenas o espaço reservado no rodapé.
-   [ ] Não cobre botões, listas, campos ou controles do CRM.
-   [ ] Não sobrepõe o WhatsApp Web nem injeta anúncios em páginas de
    terceiros.
-   [ ] Adapta-se à largura da side panel.
-   [ ] Tem imagem otimizada e texto legível.
-   [ ] Não utiliza animações agressivas nem altera o foco sem ação do
    usuário.
-   [ ] O link é validado e aberto de forma segura.
-   [ ] Conteúdo é renderizado com componentes da extensão; não aceitar
    HTML/JS arbitrário vindo do painel.
-   [ ] O anúncio só conta como impressão quando realmente estiver
    visível, conforme uma regra de medição documentada.

### 8.4 Métricas dos anúncios

-   [ ] Impressões visíveis.
-   [ ] Cliques.
-   [ ] Taxa de clique.
-   [ ] Conversões atribuídas.
-   [ ] Resultados por segmento, plano e período.
-   [ ] Frequência média de exposição.
-   [ ] Relatório por campanha e criativo.
-   [ ] Deduplicação de eventos e proteção contra contagens repetidas.

### 8.5 Integração com o restante do produto

-   [ ] Usar a mesma infraestrutura de campanhas do backend, mas manter
    notificações e anúncios como tipos de campanha distintos.
-   [ ] Reutilizar segmentação, agendamento, autorização, armazenamento
    de mídia e relatórios quando apropriado.
-   [ ] Permitir que o administrador escolha se uma campanha é
    notificação, anúncio de rodapé ou ambas, sem misturar as métricas.
-   [ ] Permitir desligar globalmente o espaço publicitário em caso de
    incidente.

------------------------------------------------------------------------

## 9. Dashboard Comercial: abrir o chat exato de quem aguarda resposta

### 9.1 Comportamento desejado

O Dashboard deve identificar contatos cuja última mensagem recebida foi
do cliente e que ainda não têm uma resposta posterior da empresa,
conforme as informações disponíveis e confiáveis no WhatsApp.

Cada contato deve ter um botão **Abrir conversa** que leve ao chat exato
da pessoa.

### 9.2 Interface sugerida

Cada item poderá apresentar:

-   [ ] Nome do contato, se disponível.
-   [ ] Data/hora da última mensagem recebida.
-   [ ] Tempo de espera.
-   [ ] Indicador de pendência.
-   [ ] Botão **Abrir conversa**.
-   [ ] Estado de erro caso o chat não possa ser localizado.
-   [ ] Opção de marcar como resolvido apenas se essa ação fizer sentido
    para o fluxo e não substituir a confirmação real de uma resposta.

O conteúdo da mensagem deve ser opcional e minimizado; não é necessário
copiar a mensagem completa para o painel de telemetria.

### 9.3 Regras técnicas

-   [ ] Identificar a conversa por um identificador estável do chat,
    quando disponível.
-   [ ] Utilizar telefone/identificador do WhatsApp como alternativa
    validada; nunca depender apenas do nome.
-   [ ] Reutilizar a aba do WhatsApp Web existente quando possível.
-   [ ] Confirmar que a conta correta do WhatsApp está conectada.
-   [ ] Navegar para a conversa específica por um mecanismo compatível
    com a versão atual do WhatsApp Web.
-   [ ] Evitar abrir várias abas sem necessidade.
-   [ ] Se a conversa não puder ser localizada, informar o motivo e
    oferecer uma alternativa segura.
-   [ ] Não abrir um contato diferente por coincidência de nome.
-   [ ] Atualizar a pendência depois que uma resposta de saída for
    detectada.
-   [ ] Tratar conversas arquivadas, contatos sem nome, números
    internacionais e chats que deixaram de existir.
-   [ ] Testar a função com WhatsApp conectado, desconectado, carregando
    e com múltiplas abas.
-   [ ] Integrar a função ao catálogo como `dashboard.awaiting_reply` ou
    identificador equivalente.

### 9.4 Indicadores adicionais recomendados

-   [ ] Total de conversas aguardando resposta.
-   [ ] Pendências por faixa de tempo.
-   [ ] Tempo médio de resposta, quando os eventos disponíveis
    permitirem calcular isso corretamente.
-   [ ] Quantidade de pendências resolvidas por período.
-   [ ] Filtros por data e estado.
-   [ ] Não confundir uma mensagem recebida com uma conversa que já foi
    respondida posteriormente.

------------------------------------------------------------------------

## 10. CRM: barra horizontal de etapas

Foi discutida a necessidade de uma barra horizontal para visualizar
todas as etapas do CRM.

A versão-base contém visualização Kanban horizontal com rolagem. Isso
não confirma, por si só, que a barra de etapas desejada esteja
implementada com o comportamento esperado.

-   [x] Visualização Kanban encontrada.
-   \[!\] Kanban com rolagem horizontal encontrado; requisito da barra
    de etapas ainda precisa ser validado visualmente.
-   [ ] Confirmar se todas as etapas podem ser vistas e acessadas de
    forma clara.
-   [ ] Se necessário, adicionar uma barra horizontal de etapas com
    rolagem acessível.
-   [ ] Mostrar nome da etapa e, se útil, quantidade de leads.
-   [ ] Permitir selecionar uma etapa para filtrar ou navegar até a
    coluna.
-   [ ] Destacar a etapa ativa sem depender apenas de cor.
-   [ ] Manter a experiência utilizável em larguras menores da side
    panel.
-   [ ] Evitar que nomes longos de etapas quebrem o layout.
-   [ ] Testar com poucas etapas, muitas etapas e nomes personalizados.
-   [ ] Confirmar que a navegação visual não altera acidentalmente o
    estágio dos leads.

------------------------------------------------------------------------

## 11. Segurança, privacidade e confiabilidade

### 11.1 Pontos já identificados para revisão

-   [x] A versão utiliza tokens assinados e verificação Ed25519.
-   [x] Existem verificações relacionadas à licença, expiração e
    dispositivo.
-   [x] Existem validações de segurança no fluxo de webhook.
-   [x] Existe um módulo de privacidade para ocultar informações
    visíveis.
-   \[!\] A documentação atual registra risco na comunicação
    `window.postMessage` entre scripts da página do WhatsApp e a
    extensão.
-   \[!\] A tolerância offline descrita no código e no README precisa
    ser alinhada.
-   \[!\] A verificação local da licença não substitui controles no
    backend para revogação, limites e operações protegidas.
-   [ ] Revisar os fluxos de mensagens e garantir que páginas externas
    não consigam forjar comandos privilegiados.
-   [ ] Validar origem, formato e permissões de todas as mensagens entre
    scripts.
-   [ ] Não confiar em botões ocultos como mecanismo de autorização.
-   [ ] Não aceitar código executável remoto na extensão.
-   [ ] Guardar segredos e credenciais no backend.
-   [ ] Validar URLs, uploads, redirecionamentos e destinos de webhooks.
-   [ ] Proteger APIs administrativas por autenticação, autorização e
    registro de auditoria.
-   [ ] Definir controle de acesso aos dados de telemetria por função
    administrativa.
-   [ ] Definir política de retenção, descarte e atendimento de
    solicitações dos titulares.
-   [ ] Criar procedimento de resposta a incidentes e desligamento de
    campanhas/configurações problemáticas.

### 11.2 Confiabilidade de campanhas

-   [ ] Prevenir envio duplicado quando houver repetição de requisição.
-   [ ] Aplicar identificadores de operação/idempotência quando
    apropriado.
-   [ ] Tratar rate limits e erros temporários.
-   [ ] Permitir pausa e interrupção confiáveis.
-   [ ] Separar contatos falhos, ignorados, pendentes e concluídos.
-   [ ] Garantir que a blacklist seja respeitada por todas as rotas de
    envio.
-   [ ] Exibir resultados reais, não apenas mensagens genéricas de
    sucesso.
-   [ ] Respeitar regras aplicáveis de consentimento, opt-out e
    políticas dos serviços integrados.
-   [ ] Testar recuperação depois de reinício do service worker ou do
    navegador.

### 11.3 Dados e backup

-   [ ] Testar backup, restauração e sincronização em contas com muitos
    leads.
-   [ ] Validar conflitos entre cópia local e Google Drive.
-   [ ] Evitar perda silenciosa de dados em sobrescritas.
-   [ ] Informar claramente operações destrutivas.
-   [ ] Testar desconexão e reconexão da conta Google.
-   [ ] Definir quais preferências são locais e quais são sincronizadas.
-   [ ] Garantir que o comando de limpeza deixe explícito o que será
    mantido.

------------------------------------------------------------------------

## 12. Qualidade da experiência comercial

Para uma extensão comercial robusta, além das funções específicas,
recomenda-se:

-   [ ] Onboarding claro para novos usuários.
-   [ ] Explicação dos módulos e dos recursos disponíveis em cada plano.
-   [ ] Estados vazios com orientação útil, sem telas confusas.
-   [ ] Indicadores de carregamento e erros recuperáveis.
-   [ ] Mensagens de erro com ações possíveis, não apenas códigos
    técnicos.
-   [ ] Acessibilidade de teclado e foco visível.
-   [ ] Contraste adequado e estados que não dependam apenas de cor.
-   [ ] Interface adaptável à largura da side panel.
-   [ ] Confirmação para operações destrutivas.
-   [ ] Desfazer/recuperar quando for viável.
-   [ ] Busca, filtros e ordenação nos módulos com listas grandes.
-   [ ] Paginação ou carregamento progressivo quando necessário.
-   [ ] Performance testada com milhares de leads.
-   [ ] Registro de diagnóstico que não exponha dados pessoais
    desnecessários.
-   [ ] Textos consistentes em português e revisão de traduções em
    inglês/espanhol.
-   [ ] Documentação do usuário e guia de resolução de problemas.
-   [ ] Página de novidades para comunicar mudanças de versão.
-   [ ] Feature flags para liberar novos recursos gradualmente.

------------------------------------------------------------------------

## 13. Plano de implementação recomendado

A ordem abaixo reduz retrabalho e evita criar telas que ainda não tenham
suporte real no backend.

### Fase 0 --- Congelar e validar a base

-   [ ] Confirmar o ZIP de referência e preservar uma cópia íntegra.
-   [ ] Confirmar a versão instalada no Chrome.
-   [ ] Comparar com alterações de trabalho ainda não publicadas, se
    houver.
-   [ ] Recuperar ou recriar testes automatizados ausentes do ZIP.
-   [ ] Revalidar conexão WhatsApp, Google Drive, campanhas e RCS.
-   [ ] Registrar resultados de teste antes de alterar código.

**Critério de saída:** existe uma base reproduzível e um conjunto mínimo
de testes de regressão.

### Fase 1 --- Backend, licenças e catálogo

-   [ ] Analisar o backend e o painel administrativos atuais.
-   [ ] Confirmar o contrato real de tokens, permissões e limites.
-   [ ] Criar catálogo canônico e mapeamento dos handlers.
-   [ ] Aplicar autorização por plano e por conta.
-   [ ] Implementar limites e acesso integral da licença administrativa.
-   [ ] Testar permissões e bloqueios em cada módulo.

**Critério de saída:** as permissões configuradas no painel são
efetivamente respeitadas na execução.

### Fase 2 --- Melhorias de operação comercial

-   [ ] Implementar a lista de contatos aguardando resposta.
-   [ ] Implementar o botão para abrir o chat exato.
-   [ ] Validar a barra horizontal de etapas do CRM e completar o que
    faltar.
-   [ ] Testar a navegação e o comportamento com diferentes estados do
    WhatsApp.

**Critério de saída:** o usuário consegue identificar uma pendência e
abrir a conversa correta com um clique.

### Fase 3 --- Telemetria e segmentação

-   [ ] Definir eventos e perfil profissional.
-   [ ] Implementar fila, API, armazenamento e deduplicação.
-   [ ] Criar relatórios por plano, profissão, módulo e período.
-   [ ] Criar métricas de ativação, retenção, erros e conversão.
-   [ ] Aplicar controles de privacidade, acesso e retenção.

**Critério de saída:** os eventos de teste aparecem corretamente no
painel e podem ser filtrados por segmentos.

### Fase 4 --- Notificações e anúncios

-   [ ] Criar o gerenciador de notificações.
-   [ ] Criar segmentação e agendamento.
-   [ ] Implementar exibição discreta e limites de frequência.
-   [ ] Criar o gerenciador de anúncios do rodapé.
-   [ ] Implementar imagens, texto, botão, links e segmentação.
-   [ ] Registrar visualizações, cliques e conversões sem duplicidade.
-   [ ] Testar campanha ativa, pausada, agendada, expirada e sem
    conexão.

**Critério de saída:** uma campanha criada no painel aparece somente ao
público correto e os relatórios refletem as ações observadas.

### Fase 5 --- Marketing e rastreamento

-   [ ] Configurar GTM no site de vendas.
-   [ ] Implementar mapeamento dos eventos do produto.
-   [ ] Integrar analytics e plataformas de conversão aprovadas.
-   [ ] Proteger credenciais no servidor.
-   [ ] Testar consentimento, deduplicação e atribuição de conversões.

**Critério de saída:** é possível relacionar aquisição e conversão sem
executar código publicitário remoto dentro da extensão.

### Fase 6 --- Estabilização e publicação

-   [ ] Executar testes unitários, de integração, autorização e
    interface.
-   [ ] Testar Chrome com WhatsApp Web real.
-   [ ] Testar falhas de rede, service worker suspenso e reconexão.
-   [ ] Testar licença gratuita, teste, Pro Mensal, Pro Multitelas e
    licença administrativa.
-   [ ] Testar versões antigas e novas do catálogo.
-   [ ] Fazer liberação gradual para grupo de teste.
-   [ ] Verificar erros e telemetria antes da liberação geral.
-   [ ] Preparar changelog, instruções de atualização e plano de
    rollback.
-   [ ] Só publicar após aprovação do checklist de regressão.

**Critério de saída:** todas as funcionalidades prioritárias passam nos
testes e há um plano de reversão.

------------------------------------------------------------------------

## 14. Matriz mínima de testes de licenciamento

  -----------------------------------------------------------------------
  Cenário                             Resultado esperado
  ----------------------------------- -----------------------------------
  Sem licença                         Apenas funções explicitamente
                                      gratuitas e dentro dos limites

  Licença de teste                    Somente funções e limites definidos
                                      para o teste

  Pro Mensal                          Permissões configuradas para o
                                      plano, sem funções extras por
                                      acidente

  Pro Multitelas                      Permissões e limites próprios,
                                      incluindo regras de dispositivos

  Licença administrativa              Acesso integral para teste, com
                                      autenticação e auditoria mantidas

  Token expirado                      Bloqueio ou política offline
                                      documentada e coerente

  Token de outro dispositivo          Recusa conforme política de
                                      licenciamento

  Backend indisponível                Comportamento previsível, sem
                                      apagar licença válida indevidamente

  Função desativada globalmente       Não executa, mesmo que apareça em
                                      uma interface antiga

  Conta com exceção individual        Respeita a exceção registrada e
                                      auditada

  Limite atingido                     Bloqueio claro e contador
                                      consistente

  Permissão alterada no painel        Atualização dentro do prazo
                                      definido, sem reinstalação
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 15. Critérios gerais de conclusão ("Definition of Done")

Uma funcionalidade só pode ser marcada como concluída quando:

-   [ ] Está no catálogo de funcionalidades.
-   [ ] Tem identificador estável e descrição administrativa.
-   [ ] Tem regras explícitas por plano e conta.
-   [ ] A interface reflete corretamente a permissão.
-   [ ] O ponto de execução valida a autorização.
-   [ ] APIs remotas validam autorização no servidor quando necessário.
-   [ ] A telemetria registra o evento operacional pertinente,
    respeitando privacidade.
-   [ ] Há tratamento de erro e recuperação.
-   [ ] Há testes de sucesso, falha, falta de licença e limite atingido.
-   [ ] Há teste de regressão para WhatsApp, Google Drive, CRM, Maps e
    RCS quando aplicável.
-   [ ] A documentação foi atualizada.
-   [ ] O comportamento foi validado em uma versão instalada do Chrome.
-   [ ] A alteração pode ser revertida sem perda de dados.

------------------------------------------------------------------------

## 16. Informações necessárias para integrar extensão e painel

A extensão analisada não é suficiente para definir com segurança os
contratos de integração do backend. Antes de implementar os endpoints,
será necessário analisar o código atual do painel e do servidor.

-   [ ] Código atual do backend e do painel administrativo.
-   [ ] Implementação de criação e emissão de licenças.
-   [ ] Formato real dos tokens e significado de `plan`, `ent` e
    `limits`.
-   [ ] Estrutura atual do catálogo de funcionalidades no painel.
-   [ ] APIs existentes de licenças e permissões.
-   [ ] Modelo atual de contas, usuários e planos.
-   [ ] Banco de dados e padrão de migrações.
-   [ ] Infraestrutura de autenticação administrativa.
-   [ ] Configuração atual do site de vendas e checkout.
-   [ ] Integrações de marketing já existentes, se houver.

**Não criar endpoints ou estruturas de banco definitivos por
suposição.** Primeiro identificar o que já existe, manter
compatibilidade e propor migrações pequenas e reversíveis.

------------------------------------------------------------------------

## 17. Prioridades resumidas

### P0 --- Preservar a base e fechar riscos críticos

-   [ ] Validar versão-base, testes e regressões.
-   [ ] Revisar a ponte de mensagens do WhatsApp.
-   [ ] Alinhar a política offline e os direitos do token.
-   [ ] Confirmar contratos reais do backend.

### P1 --- Controle comercial de funcionalidades

-   [ ] Catálogo central.
-   [ ] Permissões por plano e conta.
-   [ ] Limites por recurso.
-   [ ] Licença administrativa de teste.

### P2 --- Operação diária do usuário

-   [ ] Dashboard de conversas aguardando resposta.
-   [ ] Abrir o chat exato com um clique.
-   [ ] Barra horizontal de etapas do CRM.

### P3 --- Inteligência de produto

-   [ ] Telemetria resiliente.
-   [ ] Perfil profissional opcional.
-   [ ] Segmentação por nicho, plano e comportamento.
-   [ ] Relatórios de adoção, retenção e conversão.

### P4 --- Comunicação e monetização dentro da extensão

-   [ ] Notificações segmentadas.
-   [ ] Anúncios no rodapé.
-   [ ] Métricas de impressões, cliques e conversões.
-   [ ] Regras de frequência e privacidade.

### P5 --- Aquisição e marketing

-   [ ] GTM no site de vendas.
-   [ ] Analytics e pixels por integração segura.
-   [ ] Conversões de ponta a ponta.
-   [ ] Relatórios por canal e segmento.

### P6 --- Qualidade e escala

-   [ ] Testes automatizados e de integração.
-   [ ] Liberação gradual.
-   [ ] Monitoramento de erros.
-   [ ] Documentação, changelog e rollback.

------------------------------------------------------------------------

## 18. Recomendação final

O caminho mais seguro para construir uma extensão comercial de alta
qualidade é tratar o i9Leads Flow como um produto integrado, não como
uma coleção de botões.

-   O **catálogo e o licenciamento** definem o que cada conta pode
    fazer.
-   A **telemetria** explica como o produto é usado e quais segmentos
    encontram valor nele.
-   As **notificações e os anúncios** criam canais de comunicação e
    promoção administrados pelo painel.
-   A **central de rastreamento** conecta aquisição e conversão sem
    inserir código remoto arbitrário na extensão.
-   O **Dashboard Comercial** ajuda o usuário a agir rapidamente,
    especialmente ao abrir a conversa exata que precisa de resposta.
-   Os **testes, controles de segurança e métricas operacionais** mantêm
    o sistema confiável conforme ele cresce.

O próximo passo prático é auditar o backend e o painel administrativo
atuais, confirmar seus contratos e só então implementar as mudanças em
etapas, preservando a versão 5.3.2-fix1 como referência e validando cada
entrega antes da próxima.

**Princípio do projeto:** nenhuma função deve ser considerada concluída
só porque aparece na interface. Ela precisa funcionar, respeitar a
licença, registrar os eventos necessários, proteger os dados e passar
pelos testes de regressão.
