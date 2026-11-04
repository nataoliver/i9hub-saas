# i9Leads Flow --- Status consolidado das atualizações e pendências

**Documento:** histórico técnico-funcional e checklist de execução\
**Data de referência:** 17 de outubro de 2026\
**Versão-base analisada:** `i9Leads-Flow-Extensao-v5.3.2-fix1.zip`\
**Versão candidata preparada:**
`i9Leads-Flow-Extensao-v5.3.3-license-gate.zip`\
**Estado geral:** versão candidata criada e validada estaticamente;
integração com o painel/backend e testes manuais reais ainda pendentes.

------------------------------------------------------------------------

## 1. Objetivo deste documento

Este arquivo consolida o que foi discutido e atualizado até agora no
projeto i9Leads Flow, separando claramente:

-   o que foi encontrado na extensão original;
-   o que foi alterado no pacote candidato 5.3.3;
-   o que já passou por validação automatizada;
-   o que depende do painel administrativo/backend;
-   o que ainda precisa ser desenvolvido;
-   o que precisa ser testado antes de liberar a extensão para usuários
    reais.

**Regra fundamental:** uma função não deve ser considerada pronta apenas
porque existe um botão ou código relacionado. Ela precisa funcionar de
ponta a ponta, respeitar a licença emitida pelo painel, tratar falhas
com segurança e passar pelos testes pertinentes.

## 2. Arquivos de referência

-   [x] ZIP original usado como base:
    `i9Leads-Flow-Extensao-v5.3.2-fix1.zip`.
-   [x] Pacote candidato:
    `i9Leads-Flow-Extensao-v5.3.3-license-gate.zip`.
-   [x] Relatório de implementação da versão candidata:
    `docs/RELATORIO_IMPLEMENTACAO_v5.3.3.md`.
-   [x] Contrato proposto entre painel e extensão:
    `docs/CONTRATO_PAINEL_LICENCAS_v5.3.3.md`.
-   [x] Changelog da versão candidata: `docs/CHANGELOG_v5.3.3.md`.
-   [x] Plano mestre anterior:
    `i9Leads_Flow_Plano_Mestre_Melhorias_Checklist.md`.
-   [ ] Receber/analisar o repositório atual do painel administrativo e
    backend.
-   [ ] Confirmar qual versão está instalada atualmente no Chrome e
    comparar com alterações locais não publicadas, se houver.

Os documentos técnicos dentro do pacote candidato descrevem os contratos
esperados, mas não substituem a implementação do backend.

## 3. Resumo executivo

A versão candidata 5.3.3 foi preparada para mudar o modelo de acesso: em
vez de permitir algumas ações gratuitas por contador local, as funções
operacionais exigem permissões explícitas em uma licença válida assinada
pelo backend.

Também foram adicionados o fluxo inicial para solicitar uma conta
gratuita pelo WhatsApp e uma área no Dashboard Comercial para conversas
aguardando resposta, com botão para tentar abrir o chat exato.

Ainda não estão concluídos a integração com o painel/backend, a
telemetria, a central de Google Tag Manager/pixels, as notificações
segmentadas e os anúncios no rodapé. A barra horizontal de etapas do CRM
precisa de validação visual e funcional. A ponte de mensagens do
WhatsApp também requer uma revisão de segurança adicional.

### Estado geral por área

  -----------------------------------------------------------------------
  Área                                Estado atual
  ----------------------------------- -----------------------------------
  Pacote base e inventário            \[x\] Analisados

  Catálogo de funcionalidades na      \[x\] Criado na versão candidata
  extensão                            

  Bloqueio por licença na extensão    \[x\] Implementado na candidata;
                                      integração real com tokens do
                                      painel pendente

  Conta gratuita por WhatsApp         \[x\] Botão e mensagem
                                      pré-preenchida na candidata

  Cadastro efetivo no painel          \[ \] Depende do atendimento e do
                                      fluxo existente do painel

  Dashboard: aguardando resposta      \[x\] Interface e lógica inicial na
                                      candidata; teste real pendente

  Abrir chat exato                    \[x\] Implementação inicial na
                                      candidata; teste manual com
                                      WhatsApp Web pendente

  Barra horizontal de etapas CRM      \[!\] Kanban horizontal existe;
                                      confirmar se atende ao requisito
                                      específico

  Telemetria administrativa           \[ \] Não implementada de ponta a
                                      ponta

  Perfil profissional e segmentação   \[ \] Pendente
  por nicho                           

  Google Tag Manager, Analytics e     \[ \] Pendente
  pixels                              

  Notificações segmentadas            \[ \] Pendente

  Anúncio persistente no rodapé       \[ \] Pendente

  Relatórios de marketing e conversão \[ \] Pendente

  Hardening da ponte WhatsApp         \[!\] Revisão adicional necessária

  Teste funcional completo no Chrome  \[ \] Pendente

  Aprovação para distribuição         \[ \] Ainda não recomendada
  comercial                           
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 4. O que foi atualizado na extensão candidata 5.3.3

### 4.1 Licenciamento e bloqueio por funcionalidade

-   [x] Removido o modelo antigo de três ações gratuitas locais.
-   [x] Sem licença válida, a extensão entra em modo de demonstração.
-   [x] No modo de demonstração, o usuário pode navegar pela interface e
    conhecer os módulos, mas as operações comerciais ficam bloqueadas.
-   [x] Criado o catálogo central em `lib/feature-catalog.js`.
-   [x] Criado o mapeamento entre funcionalidades e handlers
    operacionais.
-   [x] Implementada a regra *fail closed*: permissões ausentes,
    desconhecidas ou não mapeadas não concedem acesso.
-   [x] O nome do plano, isoladamente, não concede direitos; os direitos
    devem vir do token assinado.
-   [x] Adicionadas exceções limitadas para ações de segurança, como
    interromper operações em andamento e desconectar o Google Drive.
-   [x] Ao remover/revogar a licença, a extensão tenta interromper
    campanhas em andamento.
-   [x] Atualizados textos e pontos da interface que mencionavam o
    antigo contador de ações gratuitas.
-   [ ] Integrar o catálogo com o cadastro de planos e a emissão real de
    licenças no painel.
-   [ ] Confirmar no backend a semântica real de `ent`, `limits`,
    dispositivo, expiração e revogação.
-   [ ] Validar que as APIs remotas também protegem operações de alto
    impacto.
-   [ ] Testar licenças Gratuito, Teste, Pro Mensal, Pro Multitelas e
    Administrativa com tokens emitidos pelo painel real.
-   [ ] Definir e testar a política de atualização de permissões, cache
    e operação offline.

**Importante:** se o painel ainda emitir tokens sem os entitlements
reconhecidos pela extensão, a assinatura poderá ser válida, mas as
funções serão bloqueadas. Esse bloqueio é intencional até que o painel
seja compatível.

### 4.2 Catálogo de funcionalidades

A candidata possui identificadores de funcionalidades que podem ser
incluídos no contrato do painel. Entre os grupos previstos estão:

-   Dashboard e conversas aguardando resposta.

-   CRM, leads, Kanban, campos personalizados, classificação,
    deduplicação e exportações.

-   Conversas, grupos, etiquetas, conexão WhatsApp e campanhas.

-   Extração do Google Maps.

-   RCS.

-   Perfil comercial e configurações.

-   Backup e sincronização com Google Drive.

-   Logs, ajuda e diagnóstico.

-   Telemetria, rastreamento de marketing, notificações e anúncios ---
    identificados como planejados, não como funções já concluídas.

-   [x] Catálogo central adicionado à extensão candidata.

-   [x] Estado de implementação diferencia recursos existentes dos
    planejados.

-   [ ] Fazer o painel importar ou manter os mesmos IDs.

-   [ ] Exibir os recursos no painel com descrição, estado de
    implementação e controles por plano.

-   [ ] Permitir exceções por conta e limites por funcionalidade.

-   [ ] Evitar que o painel ofereça como ativo um recurso que ainda
    esteja marcado como não implementado.

-   [ ] Registrar alterações administrativas e o responsável por elas.

### 4.3 Cadastro inicial por WhatsApp

A experiência pretendida é deliberadamente simples para quem não tem
experiência técnica.

**Fluxo proposto:**

1.  O usuário instala e abre a extensão.
2.  Sem licença, pode conhecer os módulos em modo de demonstração, sem
    executar operações comerciais.
3.  Clica em **Quero minha conta grátis**.
4.  O WhatsApp abre para o número `+55 11 95472-1939`, com uma mensagem
    pré-preenchida informando que a pessoa veio da extensão e quer uma
    conta gratuita.
5.  O atendimento cadastra/aprova o usuário no painel.
6.  O painel emite a licença gratuita com os direitos selecionados.
7.  O usuário recebe a chave e ativa a licença na extensão.
8.  A extensão valida a licença e libera apenas as funcionalidades
    autorizadas.

Mensagem sugerida:

> Olá! Vim pela extensão i9Leads Flow e gostaria de criar minha conta
> gratuita para começar a utilizar as funcionalidades.
>
> Poderiam me orientar sobre o cadastro e a ativação da minha licença
> gratuita?
>
> Origem: Extensão i9Leads Flow

Atualizações feitas:

-   [x] Botão para solicitar conta gratuita via WhatsApp.
-   [x] Mensagem pré-preenchida com a origem do contato.
-   [x] CTA presente em pontos de onboarding, como popup, menu lateral e
    modal de licença.
-   [x] Mantido o endpoint de ativação de licença já existente.
-   [x] O clique no WhatsApp não concede acesso sozinho.
-   [ ] Integrar o fluxo de atendimento ao processo real de cadastro no
    painel.
-   [ ] Documentar como o atendimento identifica o pedido e cria a
    conta.
-   [ ] Testar recebimento da mensagem, criação da conta, emissão da
    chave e ativação.
-   [ ] Avaliar futuramente um cadastro automatizado com e-mail/telefone
    e verificação, se o volume de atendimento justificar.

**Decisão de produto:** neste momento, o WhatsApp é o canal de
solicitação, não um sistema de autenticação ou emissão automática de
licença.

### 4.4 Dashboard Comercial --- conversas aguardando resposta

Foi adicionada uma implementação inicial no Dashboard Comercial.

-   [x] Bloco/lista de conversas aguardando resposta.
-   [x] Lógica inicial baseada na comparação entre a última mensagem
    recebida e a última enviada.
-   [x] Botão **Abrir conversa** por contato.
-   [x] Tentativa de reutilizar ou abrir uma aba do WhatsApp Web.
-   [x] Uso de telefone validado e confirmação estrita do cabeçalho para
    evitar selecionar uma pessoa por coincidência de nome.
-   [x] Se o contato não puder ser confirmado, a operação deve falhar em
    vez de abrir um chat ambíguo.
-   [ ] Testar no WhatsApp Web real, com sessão conectada.
-   [ ] Testar quando o WhatsApp não está aberto, está desconectado ou
    ainda está carregando.
-   [ ] Testar números internacionais, contatos sem nome, conversas
    arquivadas e múltiplas abas.
-   [ ] Confirmar que a lista é atualizada após uma resposta de saída.
-   [ ] Validar casos de mensagens de sistema, grupos e conversas em que
    os dados disponíveis sejam incompletos.
-   [ ] Confirmar que a função exige `dashboard.awaiting_reply` e
    `whatsapp.connection` conforme o contrato de permissões.
-   [ ] Definir uma mensagem clara quando o contato não tem
    identificador confiável.

### 4.5 CRM e barra horizontal de etapas

Na versão-base já existia Kanban horizontal com rolagem. Isso não prova
que a barra de etapas pedida esteja implementada com o comportamento
desejado.

-   [x] Kanban encontrado no código.
-   \[!\] Navegação horizontal existente; requisito específico ainda
    precisa de validação visual.
-   [ ] Testar se todas as etapas são fáceis de acessar na side panel.
-   [ ] Se necessário, adicionar uma barra horizontal com nomes das
    etapas e destaque da etapa selecionada.
-   [ ] Considerar contagem de leads por etapa.
-   [ ] Testar muitos estágios, nomes longos e telas estreitas.
-   [ ] Garantir acessibilidade por teclado e que navegar entre etapas
    não altere leads acidentalmente.

------------------------------------------------------------------------

## 5. Funcionalidades existentes na base que devem ser preservadas

O pacote 5.3.2-fix1 foi usado como origem. Os módulos abaixo foram
encontrados no código; a presença no pacote não significa que todos os
cenários estejam validados em produção.

-   [x] CRM e gestão de leads.
-   [x] Funil comercial e Kanban.
-   [x] Dashboard e indicadores.
-   [x] Campanhas WhatsApp.
-   [x] Conexão, estado e diagnóstico do WhatsApp.
-   [x] Chats, grupos e extração de mensagens.
-   [x] Etiquetas WhatsApp e sincronização com estágios.
-   [x] Blacklist.
-   [x] Extração de empresas pelo Google Maps.
-   [x] Módulo RCS, embora sua entrada esteja oculta em determinada
    interface.
-   [x] Google Drive: conexão, sincronização, restauração e sobrescrita.
-   [x] Webhooks e exportação.
-   [x] Perfil comercial e classificador.
-   [x] Configurações de aparência e privacidade.
-   [x] Logs locais e diagnóstico.
-   [ ] Executar testes de regressão para garantir que o gate de
    licenciamento não quebre esses módulos.
-   [ ] Revalidar as correções recentes de WhatsApp e Google Drive antes
    de publicar.

------------------------------------------------------------------------

## 6. O que ainda precisa ser desenvolvido

### 6.1 Telemetria comportamental

**Estado:** não implementada de ponta a ponta.

Objetivo: permitir que o painel responda a perguntas como quantos
usuários ativos existem, quantos se declaram contadores/advogados, quais
funções cada nicho utiliza, quais módulos geram retenção e quais
segmentos convertem para planos pagos.

Checklist:

-   [ ] Definir um perfil profissional opcional.
-   [ ] Incluir categorias como contabilidade, advocacia, imobiliário,
    marketing/agência, vendas, serviços e outras.
-   [ ] Permitir "outra profissão" e "prefiro não informar".
-   [ ] Distinguir profissão declarada de segmento inferido por uso.
-   [ ] Padronizar eventos com nome, versão, data, instalação
    pseudônima, módulo, resultado e atributos permitidos.
-   [ ] Implementar fila local, envio em lote, retentativas e
    deduplicação.
-   [ ] Criar endpoint autenticado no backend.
-   [ ] Implementar validação de formato, tamanho e frequência.
-   [ ] Criar armazenamento e política de retenção.
-   [ ] Criar relatórios de usuários ativos, adoção, retenção, erros,
    planos e conversão.
-   [ ] Permitir filtros por período, plano, versão, profissão/nicho e
    módulo.
-   [ ] Medir uso agregado sem copiar conteúdo de mensagens,
    nomes/telefones de contatos ou listas completas de leads.
-   [ ] Não transmitir chaves, tokens completos, senhas ou credenciais.
-   [ ] Documentar finalidade, acesso, retenção e preferências de
    privacidade compatíveis com a LGPD.
-   [ ] Testar a telemetria com rede indisponível e garantir que a
    extensão continue funcionando.

Eventos relevantes: abertura da extensão, acesso a módulos, operações do
CRM, campanhas, extração do Maps, sincronização do Drive, erros, limites
atingidos, notificações, anúncios e conversões quando disponíveis.

### 6.2 Google Tag Manager e pixels

**Estado:** pendente.

Arquitetura recomendada:

-   O Google Tag Manager é executado no site próprio do i9Leads Flow,
    como site de vendas, página de planos e checkout.
-   A extensão registra eventos próprios e os envia ao backend.
-   O backend encaminha eventos compatíveis para analytics e plataformas
    de conversão, conforme configuração e consentimento aplicável.
-   Não carregar um contêiner remoto capaz de executar código arbitrário
    dentro da extensão Manifest V3.
-   Não injetar pixels ou tags indiscriminadamente no WhatsApp Web ou em
    sites de terceiros.

Checklist:

-   [ ] Configuração de GTM para o site de vendas.
-   [ ] Google Analytics 4.
-   [ ] Google Ads: identificadores/rótulos de conversão.
-   [ ] Meta Pixel.
-   [ ] Meta Conversions API ou equivalente por servidor, se adotado.
-   [ ] Estrutura extensível para outros provedores.
-   [ ] Ativar/desativar integrações no painel.
-   [ ] Mapear eventos próprios para eventos externos.
-   [ ] Testar envio, erros, deduplicação e atribuição.
-   [ ] Armazenar segredos apenas no backend.
-   [ ] Aplicar controles de consentimento e privacidade pertinentes.
-   [ ] Criar relatórios de aquisição, ativação, teste, assinatura e
    conversão.

### 6.3 Central de notificações

**Estado:** pendente.

Objetivo: enviar pop-ups discretos a todos os usuários ou a segmentos
escolhidos pelo painel.

Checklist do editor:

-   [ ] Criar, editar, duplicar, pré-visualizar, agendar, pausar e
    encerrar.
-   [ ] Título, texto, ícone/imagem opcional, botão e URL de destino.
-   [ ] Segmentação por todos, plano, nicho, profissão declarada,
    versão, uso de módulos e inatividade.
-   [ ] Data de início e fim.
-   [ ] Prioridade e estado da campanha.
-   [ ] Estimativa do público elegível antes da publicação.
-   [ ] Envio de teste para licença administrativa.
-   [ ] Histórico de alterações e responsável.

Checklist da extensão:

-   [ ] Consultar campanhas ao abrir a extensão.
-   [ ] Atualizar campanhas periodicamente quando estiver ativa.
-   [ ] Tratar service worker suspenso, extensão fechada e modo offline.
-   [ ] Limitar frequência por usuário.
-   [ ] Evitar repetir notificações já dispensadas quando aplicável.
-   [ ] Permitir fechar/dispensar.
-   [ ] Renderizar conteúdo como texto e componentes seguros; não
    executar HTML/JavaScript remoto.
-   [ ] Distinguir campanha publicada, obtida, exibida, clicada e
    dispensada.
-   [ ] Considerar notificação nativa do navegador como opção separada,
    com permissões próprias.

### 6.4 Gerenciador de anúncios no rodapé

**Estado:** pendente.

Objetivo: manter um espaço promocional compacto no rodapé da extensão,
controlado pelo painel.

Checklist:

-   [ ] Imagem.
-   [ ] Título.
-   [ ] Texto complementar.
-   [ ] Botão de chamada para ação.
-   [ ] Link de destino.
-   [ ] Identificação de publicidade/oferta, quando aplicável.
-   [ ] Aparência dentro de limites seguros.
-   [ ] Início/fim, estado e prioridade.
-   [ ] Segmentação por plano, profissão/nicho e comportamento
    permitido.
-   [ ] Opção de ocultar anúncios em planos pagos.
-   [ ] Opção de dispensar, quando apropriado.
-   [ ] Rotação e limites de frequência.
-   [ ] Layout responsivo para a side panel.
-   [ ] Não cobrir controles e não injetar anúncios em sites de
    terceiros.
-   [ ] Validar links e imagens.
-   [ ] Não aceitar HTML ou JavaScript arbitrário vindo do painel.
-   [ ] Contar impressão somente quando a peça estiver visível conforme
    regra definida.
-   [ ] Registrar impressões, cliques, CTR e conversões atribuídas.
-   [ ] Permitir desligamento global em caso de incidente.

### 6.5 Relatórios de segmentos e marketing

-   [ ] Usuários ativos por dia/semana/mês.
-   [ ] Quantidade de profissões declaradas.
-   [ ] Funções mais usadas por nicho.
-   [ ] Utilização por plano.
-   [ ] Usuários gratuitos que atingiram limites.
-   [ ] Conversão de gratuito para pago.
-   [ ] Resultado de notificações e anúncios por segmento.
-   [ ] Retenção por coorte.
-   [ ] Erros por módulo e versão.
-   [ ] Funis de aquisição, ativação, primeiro uso, teste e assinatura.
-   [ ] Filtros e exportações administrativas com controle de acesso.
-   [ ] Proteções para evitar exposição de grupos muito pequenos ou
    dados individuais sem necessidade.

------------------------------------------------------------------------

## 7. Painel administrativo/backend: alterações necessárias

O repositório do painel/backend não estava incluído no pacote da
extensão analisado. Portanto, as integrações a seguir não podem ser
consideradas concluídas.

### Licenciamento

-   [ ] Manter catálogo global de funções com os mesmos IDs da extensão.
-   [ ] Permitir configuração de permissões por plano.
-   [ ] Permitir exceções por conta.
-   [ ] Definir limites quantitativos por funcionalidade.
-   [ ] Emitir tokens assinados com os entitlements no payload.
-   [ ] Validar assinatura, expiração, revogação, dispositivo e limites
    no servidor.
-   [ ] Integrar Gratuito, Teste, Pro Mensal, Pro Multitelas e licença
    administrativa.
-   [ ] Criar fluxo operacional para o atendimento cadastrar o
    interessado que chamou pelo WhatsApp.
-   [ ] Emitir a licença e entregar a chave ao usuário.
-   [ ] Manter auditoria das alterações administrativas.
-   [ ] Testar ativação e revogação reais.

### Contrato de token recomendado

O contrato proposto recomenda uma lista de IDs estáveis no campo `ent`,
assinada junto com o restante do token. Exemplo apenas ilustrativo:

``` json
{
  "plan": "free",
  "ent": [
    "dashboard.analytics",
    "crm.leads",
    "crm.kanban"
  ],
  "limits": {}
}
```

O painel deve emitir o token real com os campos, datas, assinatura,
dispositivo e identificadores corretos. O exemplo acima não é um token
pronto.

-   [ ] Confirmar o formato real do token atual antes de mudar o
    backend.
-   [ ] Emitir somente IDs implementados e liberados para a conta.
-   [ ] Não liberar recurso apenas com base no nome do plano.
-   [ ] Reservar `admin.full_access` ou `*` a licenças administrativas
    autorizadas e auditadas.
-   [ ] Não permitir que acesso administrativo ignore autenticação ou
    segurança do servidor.
-   [ ] Definir a semântica dos limites em `limits`.
-   [ ] Garantir que APIs remotas de alto impacto validem autorização no
    servidor.
-   [ ] Manter compatibilidade com o endpoint de ativação atual ou
    atualizar os dois lados juntos.

### Telemetria e campanhas

-   [ ] API de telemetria.
-   [ ] Armazenamento de eventos e agregações.
-   [ ] API de consulta para relatórios administrativos.
-   [ ] CRUD de campanhas de notificações.
-   [ ] API de entrega/consulta de notificações por público.
-   [ ] CRUD de anúncios do rodapé.
-   [ ] API para conteúdo publicitário segmentado.
-   [ ] Armazenamento/validação de imagens.
-   [ ] Métricas de visualização, clique e conversão.
-   [ ] Configuração das integrações de marketing.
-   [ ] Gestão segura de segredos.
-   [ ] Controles de acesso por função administrativa.
-   [ ] Auditoria de publicações e mudanças.

------------------------------------------------------------------------

## 8. Segurança e confiabilidade ainda pendentes

### Pontos já identificados

-   [x] A extensão verifica assinatura de token Ed25519.
-   [x] Há validações no fluxo de webhooks.
-   [x] Há controles de privacidade para ocultar dados na interface.
-   \[!\] A ponte de comunicação baseada em `window.postMessage` entre
    scripts do WhatsApp continua sendo um risco conhecido.
-   \[!\] A tolerância offline documentada precisa ser alinhada com a
    implementação.
-   \[!\] A proteção na extensão não substitui autorização no servidor.

### Checklist de hardening

-   [ ] Revisar mensagens entre service worker, content scripts e
    scripts injetados.
-   [ ] Validar origem, estrutura e permissões de mensagens.
-   [ ] Não confiar em controles apenas visuais.
-   [ ] Não executar código remoto.
-   [ ] Validar URLs, uploads, redirecionamentos e destinos de webhooks.
-   [ ] Proteger credenciais e tokens.
-   [ ] Implementar rate limiting nas APIs.
-   [ ] Garantir que a blacklist seja respeitada em todas as rotas de
    envio.
-   [ ] Tratar falhas de rede sem corromper dados ou interromper a
    interface.
-   [ ] Testar recuperação após reinício/suspensão do service worker.
-   [ ] Testar backup, restauração, sobrescrita e conflitos do Google
    Drive.
-   [ ] Definir política offline coerente e documentada.
-   [ ] Criar logs técnicos sem conteúdo pessoal desnecessário.
-   [ ] Criar plano de resposta a incidentes e rollback.

------------------------------------------------------------------------

## 9. Testes já executados e testes ainda necessários

### Validação automatizada executada

-   [x] Pacote ZIP candidato criado e reextraído para validação.
-   [x] Verificação estática de manifesto.
-   [x] Verificação de sintaxe JavaScript/MJS.
-   [x] Verificação de imports locais.
-   [x] Testes do catálogo e da política de autorização: 7 testes
    aprovados.
-   [x] Verificação de cobertura dos handlers pelo catálogo.
-   [x] Verificação do CTA de WhatsApp.
-   [x] Pacote candidato identificado como versão 5.3.3.

### Testes manuais ainda pendentes

-   [ ] Instalar a candidata em um perfil de teste do Chrome.
-   [ ] Ativar licença gratuita real emitida pelo painel.
-   [ ] Ativar licença Pro real.
-   [ ] Ativar licença administrativa real.
-   [ ] Confirmar que função não autorizada é bloqueada em cada plano.
-   [ ] Testar token inválido, expirado, revogado e sem entitlements.
-   [ ] Testar alterações de permissões sem reinstalação.
-   [ ] Testar WhatsApp Web com sessão conectada.
-   [ ] Testar abertura do chat exato e casos de falha.
-   [ ] Testar CRM, campanhas, Maps, RCS e Drive após o novo gate.
-   [ ] Testar rede indisponível e recuperação.
-   [ ] Testar telemetria quando implementada.
-   [ ] Testar campanhas de notificações e anúncios quando
    implementadas.
-   [ ] Executar regressão completa antes de distribuir.

**Atenção:** os testes automatizados não substituem o teste real no
Chrome, com backend e WhatsApp Web. A versão candidata não deve ser
tratada como pronta para distribuição comercial geral até passar pelos
testes de integração e segurança.

------------------------------------------------------------------------

## 10. Ordem de execução recomendada

### P0 --- Preservar a base e revisar riscos críticos

-   [ ] Confirmar o ZIP de referência e guardar cópia íntegra.
-   [ ] Revisar a ponte do WhatsApp.
-   [ ] Alinhar a política offline.
-   [ ] Recuperar/criar testes de regressão.
-   [ ] Validar conexão WhatsApp e Google Drive.

### P1 --- Concluir o licenciamento com o painel

-   [ ] Analisar o repositório do painel/backend.
-   [ ] Confirmar formato real dos tokens.
-   [ ] Integrar catálogo e permissões por plano/conta.
-   [ ] Configurar licença gratuita e licença administrativa.
-   [ ] Testar autorização real em todos os módulos.

### P2 --- Concluir o fluxo comercial de atendimento

-   [ ] Testar e ajustar lista de conversas aguardando resposta.
-   [ ] Testar o botão de abertura do chat exato.
-   [ ] Validar a barra horizontal de etapas do CRM.

### P3 --- Implementar telemetria e segmentação

-   [ ] Definir eventos e perfil profissional opcional.
-   [ ] Criar API, armazenamento e relatórios.
-   [ ] Criar segmentos por nicho, plano e comportamento.
-   [ ] Implementar retenção, privacidade e controles de acesso.

### P4 --- Implementar notificações e anúncios

-   [ ] Criar gerenciador de notificações.
-   [ ] Criar entrega segmentada e agendada.
-   [ ] Criar gerenciador de anúncios no rodapé.
-   [ ] Implementar métricas e limites de frequência.

### P5 --- Integrar marketing

-   [ ] Configurar GTM no site de vendas.
-   [ ] Integrar Analytics e pixels aprovados.
-   [ ] Implementar eventos de conversão.
-   [ ] Testar consentimento, deduplicação e atribuição.

### P6 --- Estabilizar e publicar

-   [ ] Executar testes automatizados e manuais.
-   [ ] Testar licenças reais e cenários de erro.
-   [ ] Fazer liberação gradual.
-   [ ] Monitorar erros.
-   [ ] Preparar changelog e rollback.
-   [ ] Publicar apenas depois da aprovação.

------------------------------------------------------------------------

## 11. Critério de conclusão de cada funcionalidade

Marcar uma função como concluída somente quando:

-   [ ] Existe no catálogo com ID estável.
-   [ ] O painel permite configurá-la para plano/conta.
-   [ ] O token ou autorização reflete a configuração real.
-   [ ] A extensão verifica a permissão no ponto de execução.
-   [ ] O servidor verifica autorização para operações remotas quando
    aplicável.
-   [ ] A interface mostra estados e erros claros.
-   [ ] A telemetria registra o evento pertinente, se aplicável.
-   [ ] Há testes de sucesso, falha e falta de permissão.
-   [ ] Há teste de regressão dos módulos afetados.
-   [ ] A documentação está atualizada.
-   [ ] A versão pode ser revertida com segurança.

------------------------------------------------------------------------

## 12. O que precisamos receber para continuar

O próximo material necessário é o código atual do **painel
administrativo e do backend**, principalmente:

-   [ ] cadastro de contas e usuários;
-   [ ] emissão e ativação de licenças;
-   [ ] geração/assinatura dos tokens;
-   [ ] cadastro dos planos e permissões;
-   [ ] endpoint de ativação atual;
-   [ ] autenticação e autorização administrativas;
-   [ ] banco de dados e migrações;
-   [ ] configuração do site de vendas/checkout;
-   [ ] integrações de marketing já existentes.

Não é necessário enviar senhas, `.env`, chaves privadas, tokens reais ou
credenciais de produção. Use uma cópia de desenvolvimento com segredos
removidos.

------------------------------------------------------------------------

## 13. Conclusão

A versão candidata 5.3.3 estabelece a base para que as funções
operacionais dependam de uma licença assinada e dos direitos concedidos
pelo painel. Também adiciona o pedido de conta gratuita via WhatsApp e a
implementação inicial de conversas aguardando resposta no Dashboard.

Ainda falta concluir a integração com o painel/backend, testar licenças
reais, revisar a ponte de segurança do WhatsApp e implementar
telemetria, segmentação, marketing, notificações e anúncios.

**Princípio central do i9Leads Flow:** o painel é a fonte de autorização
das contas e das funcionalidades; a extensão aplica essas permissões,
coleta somente os eventos necessários e oferece uma experiência
comercial simples, confiável e segura.
