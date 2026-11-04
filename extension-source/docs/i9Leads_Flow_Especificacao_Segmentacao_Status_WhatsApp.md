# i9Leads Flow --- Especificação funcional e técnica

# Segmentação de público para Status do WhatsApp por etiquetas do Business

**Documento:** Requisitos, usabilidade, arquitetura, licenciamento e
plano de implementação\
**Data:** 17 de outubro de 2026\
**Versão de referência do projeto:** extensão candidata
`5.3.3-license-gate`\
**Identificador de funcionalidade proposto:**
`whatsapp.status_audience`\
**Integração relacionada:** `whatsapp.labels_sync`\
**Estado:** especificação da melhoria; não significa que a
funcionalidade já esteja implementada.

------------------------------------------------------------------------

## 1. Resumo executivo

O i9Leads Flow deverá oferecer uma função para organizar públicos de
Status do WhatsApp com base nas etiquetas existentes no WhatsApp
Business. A intenção é permitir que uma empresa que atende vários nichos
--- por exemplo, contabilidade, advocacia e imobiliário --- crie
públicos salvos e reutilizáveis, sem precisar reconstruir manualmente a
lista de contatos a cada publicação.

A função deverá:

1.  Ler as etiquetas e os contatos que a extensão consegue identificar
    com segurança na interface atual do WhatsApp Web.
2.  Permitir selecionar uma ou mais etiquetas para formar um público.
3.  Mostrar uma prévia dos contatos incluídos e permitir exclusões
    individuais.
4.  Salvar públicos com nomes claros, como "Contabilidade", "Advocacia"
    e "Imobiliário".
5.  Orientar o usuário para aplicar o público nas opções de privacidade
    dos Status do WhatsApp.
6.  Automatizar a seleção na interface apenas se a auditoria confirmar
    que o fluxo é estável e seguro na versão atual do WhatsApp Web.
7.  Exigir confirmação explícita antes de alterar a audiência e nunca
    publicar um Status sem ação explícita do usuário.
8.  Respeitar o catálogo de funcionalidades e as licenças emitidas pelo
    painel administrativo.

**Limitação fundamental:** o WhatsApp não oferece uma API oficial que
vincule dinamicamente etiquetas do WhatsApp Business à audiência dos
Status. Portanto, a segmentação e a preparação dos públicos são viáveis,
mas a aplicação automática da audiência depende da interface do WhatsApp
Web e não deve ser apresentada como integração oficial.

------------------------------------------------------------------------

## 2. Problema que a função resolve

Empresas e profissionais podem ter centenas ou milhares de contatos,
organizados por nicho ou etapa comercial. O WhatsApp oferece opções de
privacidade para determinar quem pode visualizar um Status, mas não
oferece um vínculo oficial e dinâmico entre uma etiqueta do Business e
uma audiência de Status.

Sem uma ferramenta de apoio, o usuário precisa:

-   localizar os contatos de determinado nicho;
-   lembrar quais pessoas pertencem a cada público;
-   selecionar os contatos nas configurações de privacidade;
-   repetir o processo para outras campanhas;
-   revisar a seleção para evitar expor um Status comercial ao público
    errado.

O i9Leads Flow pode simplificar a preparação desses públicos e reduzir
erros, mantendo a decisão final de publicação com o usuário.

### Exemplo de utilização

Uma empresa atende três nichos:

-   **Contabilidade:** contatos com a etiqueta "Contabilidade".
-   **Advocacia:** contatos com a etiqueta "Advocacia".
-   **Imobiliário:** contatos com a etiqueta "Imobiliário".

A empresa cria três públicos salvos e utiliza o público correspondente
ao assunto do Status. Uma divulgação de serviços contábeis é preparada
para o público "Contabilidade"; uma divulgação jurídica, para
"Advocacia"; e uma oferta imobiliária, para "Imobiliário".

Os públicos salvos devem ser tratados como uma seleção reutilizável que
precisa ser revisada quando os contatos, as etiquetas ou as regras de
privacidade mudarem. Não se deve presumir que a audiência de um Status
já publicado seja atualizada retroativamente.

------------------------------------------------------------------------

## 3. Objetivos e limites do produto

### Objetivos

-   [ ] Diminuir o trabalho manual para organizar a audiência dos
    Status.
-   [ ] Aproveitar as etiquetas existentes no WhatsApp Business.
-   [ ] Criar públicos reutilizáveis por nicho, categoria ou finalidade
    comercial.
-   [ ] Permitir inclusão por uma ou várias etiquetas.
-   [ ] Permitir exclusões individuais.
-   [ ] Mostrar a lista e a quantidade de contatos antes de aplicar a
    seleção.
-   [ ] Avisar sobre contatos duplicados, ausentes ou não
    identificáveis.
-   [ ] Integrar a função ao catálogo central de licenças.
-   [ ] Criar testes de compatibilidade com atualizações do WhatsApp
    Web.

### Limites que precisam ficar claros

-   A função não cria uma API oficial de segmentação de Status.
-   Uma etiqueta não garante que o contato seja elegível para visualizar
    um Status.
-   A extensão não deve publicar o Status automaticamente.
-   A extensão não deve prometer entrega ou visualização por todos os
    contatos selecionados.
-   A automação de interface, se viável, é não oficial e pode quebrar
    quando o WhatsApp Web mudar.
-   A extensão não deve enviar ao painel a lista completa de contatos ou
    o conteúdo das conversas apenas para administrar a licença ou medir
    uso.

------------------------------------------------------------------------

## 4. Experiência do usuário proposta

A experiência precisa ser simples para usuários sem conhecimento
técnico. Os nomes das ações devem explicar o que acontecerá, e a
extensão deve mostrar uma prévia antes de alterar qualquer configuração
de privacidade.

### Fluxo recomendado

1.  O usuário abre o i9Leads Flow.
2.  A extensão valida a licença e verifica se `whatsapp.status_audience`
    está autorizada.
3.  O usuário abre **WhatsApp → Segmentação de Status**.
4.  A extensão verifica a conexão com o WhatsApp Web.
5.  O usuário atualiza ou carrega as etiquetas disponíveis.
6.  O usuário escolhe uma ou mais etiquetas.
7.  A extensão calcula a lista de contatos correspondentes, remove
    duplicidades e aplica exclusões configuradas.
8.  O usuário revisa a prévia.
9.  O usuário salva o público com um nome.
10. Ao preparar um Status, o usuário escolhe um público salvo.
11. A extensão verifica se a lista está atualizada e explica como
    aplicar a audiência.
12. Se a automação de interface tiver sido validada, a extensão poderá
    auxiliar na seleção dos contatos.
13. A extensão mostra a confirmação final; o usuário revisa e confirma a
    privacidade no WhatsApp.
14. O usuário publica o Status manualmente no WhatsApp.

### Estados de interface necessários

-   **WhatsApp desconectado:** orientar a conectar o WhatsApp Web.
-   **Carregando etiquetas:** mostrar progresso e permitir tentar
    novamente.
-   **Nenhuma etiqueta encontrada:** explicar que não foi possível ler
    etiquetas ou que não há etiquetas disponíveis.
-   **Público vazio:** impedir aplicação e explicar que nenhuma pessoa
    corresponde aos critérios.
-   **Público pronto:** mostrar quantidade e permitir revisar os
    contatos.
-   **Dados desatualizados:** solicitar nova leitura das etiquetas antes
    de aplicar.
-   **Automação indisponível:** mostrar instruções para completar a
    seleção manualmente.
-   **Licença sem permissão:** mostrar que a função exige uma licença
    que inclua Segmentação de Status.
-   **Erro de compatibilidade:** não alterar a audiência e informar que
    o WhatsApp Web pode ter mudado.
-   **Confirmação pendente:** indicar que o usuário ainda precisa
    revisar/aplicar a seleção no WhatsApp.

------------------------------------------------------------------------

## 5. Interface funcional sugerida

A tela de Segmentação de Status deve incluir:

### 5.1 Lista de públicos salvos

Cada público pode apresentar:

-   Nome do público.
-   Etiquetas utilizadas.
-   Quantidade de contatos identificados na última leitura.
-   Data da última atualização.
-   Estado de atualização: atualizado, desatualizado ou precisa de
    revisão.
-   Ações: abrir, atualizar, duplicar, editar e excluir.

Exemplos de nomes:

-   Contabilidade.
-   Advocacia.
-   Imobiliário.
-   Clientes ativos.
-   Novos contatos.
-   Interessados em planos.

Os nomes são definidos pelo usuário; não devem ser presumidos a partir
da profissão de cada contato.

### 5.2 Criar ou editar público

Campos:

-   Nome do público.
-   Uma ou mais etiquetas incluídas.
-   Regra de combinação:
    -   **Qualquer etiqueta:** incluir o contato se possuir pelo menos
        uma das etiquetas selecionadas.
    -   **Todas as etiquetas:** incluir somente contatos que possuam
        todas as etiquetas selecionadas.
-   Lista de contatos excluídos manualmente.
-   Opção para revisar a lista completa.
-   Botão "Atualizar contatos".
-   Botão "Salvar público".

A regra padrão recomendada é **qualquer etiqueta**, porque costuma ser a
expectativa mais simples ao selecionar vários nichos. A interface deve
explicar claramente a diferença entre "qualquer" e "todas".

### 5.3 Prévia do público

Antes de aplicar, mostrar:

-   Quantidade de contatos encontrados.
-   Quantidade de contatos duplicados removidos.
-   Quantidade de contatos excluídos manualmente.
-   Contatos sem identificador confiável.
-   Data/hora da última leitura.
-   Aviso de que a elegibilidade final depende das regras do WhatsApp.

A prévia deve permitir buscar um contato, conferir sua identificação e
removê-lo do público salvo. A remoção do público não deve apagar o
contato da agenda nem alterar a etiqueta no WhatsApp Business.

### 5.4 Aplicar um público ao Status

A tela deve mostrar uma confirmação semelhante a:

> Você está preparando o Status para o público **Contabilidade**.\
> Contatos identificados na última leitura: **N**.\
> Revise a lista e confirme a audiência nas opções de privacidade do
> WhatsApp. A extensão não publicará o Status por você.

O valor **N** deverá ser calculado com dados reais da sessão; nunca deve
ser inventado ou exibido como estimativa sem identificação.

------------------------------------------------------------------------

## 6. Viabilidade técnica: três níveis

### Nível 1 --- Segmentação e preparação do público

**Viabilidade esperada: maior, sujeita à leitura real das etiquetas e
contatos.**

A extensão lê os dados que estiverem acessíveis na interface atual do
WhatsApp Web, relaciona contatos e etiquetas, cria públicos salvos e
apresenta a lista para revisão. O usuário aplica a seleção nas opções
nativas de privacidade do Status.

Esse é o primeiro nível recomendado porque entrega valor mesmo sem
automação completa da interface de privacidade.

### Nível 2 --- Aplicação assistida na interface do WhatsApp Web

**Viabilidade: depende de auditoria e teste com a versão real do
WhatsApp Web.**

Se a interface permitir localizar os controles e selecionar os contatos
com segurança, a extensão poderá ajudar a aplicar o público. Essa
automação depende da interface visual e dos elementos internos do
WhatsApp Web, que não constituem uma API pública estável.

Requisitos obrigatórios:

-   [ ] Confirmar que o diálogo correto de privacidade foi aberto.
-   [ ] Identificar cada contato por um identificador confiável,
    preferencialmente número/ID, e não apenas pelo nome.
-   [ ] Confirmar a correspondência antes de selecionar.
-   [ ] Detectar alterações na estrutura da interface.
-   [ ] Interromper a operação se houver ambiguidade.
-   [ ] Não selecionar contatos aproximados ou com nomes parecidos.
-   [ ] Não confirmar ou publicar automaticamente o Status.
-   [ ] Mostrar resumo da seleção antes de o usuário confirmar.
-   [ ] Fornecer caminho manual alternativo quando a automação falhar.

### Nível 3 --- Integração oficial completa

**Limite atual conhecido:** não se deve presumir que exista uma API
oficial que aceite etiquetas do WhatsApp Business como regra dinâmica da
audiência dos Status.

A solução deve ser projetada para continuar útil sem depender desse
recurso. Se o WhatsApp disponibilizar futuramente uma API oficial
apropriada, a arquitetura poderá ser ampliada.

------------------------------------------------------------------------

## 7. Como identificar contatos e etiquetas

A extensão atual possui recursos relacionados a etiquetas, incluindo
diagnóstico/sincronização de etiquetas e associação com estágios
comerciais. Isso não comprova que já consiga ler todas as etiquetas e os
contatos necessários para configurar a audiência de Status.

Antes de implementar, auditar:

-   [ ] Como a versão atual obtém etiquetas do WhatsApp Business.
-   [ ] Se cada etiqueta pode ser relacionada a um identificador de
    contato estável.
-   [ ] Como são representados números internacionais e contatos sem
    nome.
-   [ ] Se a leitura inclui todos os contatos ou apenas os carregados na
    interface.
-   [ ] Se etiquetas e contatos podem estar paginados ou carregados sob
    demanda.
-   [ ] Como detectar contatos duplicados.
-   [ ] Como identificar etiquetas removidas ou alteradas.
-   [ ] Se os dados mudam quando a sessão é desconectada ou reconectada.
-   [ ] Quais seletores/elementos da interface são necessários para o
    fluxo de privacidade do Status.
-   [ ] Como reconhecer falhas de compatibilidade sem aplicar seleção
    parcial.

### Identificadores

-   Usar um ID estável do chat/contato quando disponível.
-   Usar número normalizado apenas quando for obtido e validado
    legitimamente.
-   Não usar o nome visível como único identificador.
-   Não tentar adivinhar IDs.
-   Não misturar contatos de contas WhatsApp diferentes.
-   Não aplicar seleções quando o contato não puder ser confirmado.

------------------------------------------------------------------------

## 8. Armazenamento e privacidade

### Dados do público

Recomendação: guardar localmente na extensão a configuração dos públicos
e as referências mínimas necessárias para reutilizá-los. Isso reduz a
transmissão de dados pessoais ao servidor.

Estrutura conceitual local:

-   ID local do público.
-   Nome escolhido pelo usuário.
-   IDs das etiquetas incluídas.
-   Regra de combinação: qualquer/todas.
-   IDs de contatos excluídos.
-   Referências de contato estritamente necessárias.
-   Data da última leitura.
-   Estado de validade da lista.
-   Versão do formato de dados.

### Dados que não devem ser enviados ao painel por padrão

-   Conteúdo de mensagens.
-   Fotos de perfil.
-   Lista completa de números de telefone.
-   Lista completa de contatos por nicho.
-   Conteúdo de Status.
-   Informações de conversas sem necessidade para a função.

O painel precisa saber se a licença autoriza a funcionalidade, mas não
precisa receber a lista de contatos para conceder essa permissão.

Se houver telemetria, limitar-se a eventos operacionais agregados, por
exemplo:

-   Segmentação aberta.
-   Público criado.
-   Quantidade agregada de contatos processados, quando necessária.
-   Erro técnico da operação.
-   Aplicação assistida concluída ou cancelada.

Não transmitir nomes, telefones ou conteúdo de mensagens como
telemetria. Definir finalidade, transparência, acesso, retenção e
controles compatíveis com a LGPD.

------------------------------------------------------------------------

## 9. Integração ao catálogo e ao painel administrativo

### Identificador proposto

`whatsapp.status_audience`

Descrição administrativa:

> Criar e gerenciar públicos de Status do WhatsApp a partir das
> etiquetas do WhatsApp Business, com prévia, exclusões e aplicação
> assistida quando compatível.

### Identificador relacionado

`whatsapp.labels_sync`

Essa função já é relacionada à leitura/sincronização de etiquetas, mas
não deve ser tratada automaticamente como autorização para segmentação
de Status. A nova funcionalidade deve ter permissão própria, pois
envolve um fluxo diferente.

### Checklist do painel

-   [ ] Cadastrar `whatsapp.status_audience` no catálogo global.
-   [ ] Marcar a função como planejada até a implementação e os testes
    estarem concluídos.
-   [ ] Configurar disponibilidade por plano.
-   [ ] Permitir exceções individuais por conta.
-   [ ] Definir limites, se forem necessários, como quantidade de
    públicos salvos.
-   [ ] Exibir descrição, dependências e estado de implementação.
-   [ ] Não permitir que uma função planejada seja liberada como
    funcional sem a validação correspondente.
-   [ ] Registrar mudanças de permissão e responsável administrativo.
-   [ ] Incluir a função nos relatórios de autorização e nos testes de
    licença.

### Regra de autorização na extensão

-   A função só aparece como disponível quando o token/licença válido
    concede `whatsapp.status_audience`.
-   O simples fato de o usuário possuir `whatsapp.labels_sync` não
    concede automaticamente `whatsapp.status_audience`.
-   Permissões ausentes, desconhecidas, expiradas ou revogadas devem
    resultar em bloqueio.
-   O controle deve ser aplicado na interface e no ponto de execução do
    service worker.
-   Nenhum bloqueio comercial pode desativar ações essenciais de
    segurança, como interromper uma operação em andamento.
-   O painel/backend é a fonte da autorização; não confiar em uma
    configuração local editável.

### Compatibilidade com a versão candidata 5.3.3

A versão candidata do projeto utiliza um catálogo de funcionalidades e
permissões explícitas no token. Para integrar a nova função:

-   [ ] Adicionar `whatsapp.status_audience` ao catálogo.
-   [ ] Mapear seus comandos e handlers.
-   [ ] Definir as permissões dos planos no painel.
-   [ ] Atualizar o contrato de emissão do token.
-   [ ] Confirmar que o backend assina o entitlement correto.
-   [ ] Testar licença sem permissão, licença com permissão, token
    expirado e revogação.
-   [ ] Não habilitar a função no painel antes de a implementação real
    estar pronta.

------------------------------------------------------------------------

## 10. Testes obrigatórios

### Testes de etiquetas e contatos

-   [ ] Uma etiqueta com vários contatos.
-   [ ] Várias etiquetas selecionadas com regra "qualquer".
-   [ ] Várias etiquetas com regra "todas".
-   [ ] Contato com múltiplas etiquetas.
-   [ ] Contatos duplicados.
-   [ ] Contato sem nome, mas com identificador confiável.
-   [ ] Contato sem identificador confiável.
-   [ ] Etiqueta removida após salvar o público.
-   [ ] Contato removido da etiqueta.
-   [ ] Contatos adicionados depois da última leitura.
-   [ ] Lista vazia.
-   [ ] Contatos carregados sob demanda/paginação.
-   [ ] Mudança de conta ou reconexão do WhatsApp.

### Testes de aplicação da audiência

-   [ ] WhatsApp Web conectado.
-   [ ] WhatsApp Web desconectado.
-   [ ] Diálogo de privacidade não encontrado.
-   [ ] Interface do WhatsApp alterada.
-   [ ] Contato não encontrado.
-   [ ] Contatos com nomes iguais.
-   [ ] Seleção parcialmente concluída.
-   [ ] Usuário cancela antes de confirmar.
-   [ ] Usuário confirma a seleção.
-   [ ] A extensão não publica o Status automaticamente.
-   [ ] A seleção manual alternativa é apresentada quando necessário.
-   [ ] A audiência anterior não é alterada silenciosamente.
-   [ ] O sistema não deixa uma configuração de privacidade inesperada
    para a próxima publicação.

### Testes de licença

-   [ ] Sem licença.
-   [ ] Licença válida sem `whatsapp.status_audience`.
-   [ ] Licença com `whatsapp.status_audience`.
-   [ ] Licença com `whatsapp.labels_sync`, mas sem
    `whatsapp.status_audience`.
-   [ ] Token expirado.
-   [ ] Licença revogada.
-   [ ] Permissão removida no painel.
-   [ ] Licença administrativa de teste.
-   [ ] Atualização de permissões sem reinstalar a extensão.

### Critérios para aprovar a função

A função só deve ser marcada como concluída quando:

-   [ ] Os públicos são calculados de forma determinística.
-   [ ] A prévia corresponde aos contatos identificados na leitura.
-   [ ] A seleção nunca usa apenas correspondência aproximada de nome.
-   [ ] A extensão interrompe a automação diante de ambiguidade.
-   [ ] A publicação do Status continua sob controle explícito do
    usuário.
-   [ ] O catálogo e a licença bloqueiam corretamente o recurso.
-   [ ] Os dados de contato não são enviados desnecessariamente ao
    painel.
-   [ ] Há um caminho manual utilizável se a interface não puder ser
    automatizada.
-   [ ] Os testes passam em uma sessão real de teste do WhatsApp Web.

------------------------------------------------------------------------

## 11. Plano de implementação recomendado

### Fase 1 --- Auditoria de viabilidade

-   [ ] Inspecionar o código atual de etiquetas e contatos.
-   [ ] Mapear os componentes do WhatsApp Web envolvidos na privacidade
    dos Status.
-   [ ] Confirmar quais dados podem ser lidos de forma estável.
-   [ ] Testar manualmente a criação de uma audiência personalizada na
    versão atual do WhatsApp Web.
-   [ ] Produzir uma decisão técnica: segmentação assistida apenas ou
    aplicação assistida automatizada.

**Entrega:** relatório de viabilidade baseado na versão real do código,
sem presumir que a API oficial oferece o vínculo entre etiquetas e
Status.

### Fase 2 --- Públicos salvos

-   [ ] Criar a tela de Segmentação de Status.
-   [ ] Implementar leitura de etiquetas.
-   [ ] Criar regras "qualquer etiqueta" e "todas as etiquetas".
-   [ ] Implementar exclusões.
-   [ ] Criar prévia e deduplicação.
-   [ ] Salvar os públicos localmente.
-   [ ] Implementar atualização e indicação de dados desatualizados.

**Entrega:** o usuário consegue criar, revisar, salvar e atualizar
públicos sem alterar automaticamente a privacidade do WhatsApp.

### Fase 3 --- Aplicação assistida

-   [ ] Implementar a automação apenas se a auditoria confirmar que é
    viável.
-   [ ] Validar o diálogo de privacidade antes de qualquer interação.
-   [ ] Selecionar contatos por identificadores confiáveis.
-   [ ] Interromper em caso de ambiguidade ou mudança de interface.
-   [ ] Mostrar resumo e exigir confirmação.
-   [ ] Manter alternativa manual.
-   [ ] Não publicar o Status automaticamente.

**Entrega:** a extensão auxilia na seleção, mas o usuário revisa e
confirma a audiência e a publicação.

### Fase 4 --- Licenciamento e painel

-   [ ] Adicionar `whatsapp.status_audience` ao catálogo.
-   [ ] Configurar planos e exceções.
-   [ ] Atualizar o token assinado.
-   [ ] Testar bloqueio e liberação reais.
-   [ ] Documentar a função no painel e na extensão.

**Entrega:** somente contas com licença autorizada podem usar o recurso.

### Fase 5 --- Estabilização

-   [ ] Testar com diferentes quantidades de contatos e etiquetas.
-   [ ] Testar após mudanças na interface do WhatsApp Web.
-   [ ] Testar falhas e retomada.
-   [ ] Validar privacidade e minimização de dados.
-   [ ] Fazer liberação gradual para licença administrativa e grupo de
    testes.
-   [ ] Manter opção de desativar globalmente a automação se o WhatsApp
    mudar.

**Entrega:** função validada e monitorável, com plano de fallback.

------------------------------------------------------------------------

## 12. Melhorias adicionais recomendadas

-   [ ] **Públicos dinâmicos:** ao abrir um público salvo, recalcular os
    contatos a partir das etiquetas atuais em vez de assumir que a lista
    antiga permanece correta.
-   [ ] **Histórico de atualização:** registrar a última leitura e
    avisar quando o público estiver desatualizado.
-   [ ] **Modo de simulação:** mostrar quais contatos seriam incluídos
    sem alterar a privacidade do WhatsApp.
-   [ ] **Exclusões permanentes por público:** permitir que o usuário
    mantenha uma lista de contatos que não deseja incluir em determinada
    audiência.
-   [ ] **Detecção de alterações de conta:** invalidar referências
    quando a conta WhatsApp conectada mudar.
-   [ ] **Proteção contra seleção incompleta:** se a extensão não
    conseguir ler todos os contatos correspondentes, não afirmar que o
    público foi aplicado integralmente.
-   [ ] **Compatibilidade controlada:** detectar mudanças na interface e
    desativar a automação em vez de arriscar selecionar destinatários
    incorretos.
-   [ ] **Métricas mínimas:** medir sucesso/falha e quantidade agregada
    de contatos processados, sem enviar a lista de contatos ao backend.
-   [ ] **Ajuda contextual:** explicar em linguagem simples o que as
    configurações nativas de privacidade do Status fazem.
-   [ ] **Separação entre preparar e publicar:** a extensão prepara a
    audiência; o usuário continua responsável por confirmar a
    privacidade e publicar.

------------------------------------------------------------------------

## 13. Decisão técnica recomendada

A implementação deve começar pela **segmentação assistida baseada em
etiquetas**, com públicos salvos, prévia, exclusões e atualização da
lista.

Em paralelo, deve ser feita uma auditoria da interface atual do WhatsApp
Web para descobrir se a seleção de contatos nas configurações de
privacidade pode ser automatizada com confiabilidade. Se não for
possível garantir a identificação correta dos destinatários, a extensão
deve fornecer instruções e uma lista de referência para seleção manual.

A função não deve ser anunciada como integração oficial entre etiquetas
e Status, nem como automação garantida. A aplicação automática só pode
ser habilitada depois de testes reais e deve ser interrompida quando
houver ambiguidade.

## 14. Resumo final

-   **Necessidade comercial:** permitir separar públicos de Status por
    nicho utilizando etiquetas do WhatsApp Business.
-   **Valor principal:** reduzir trabalho manual e diminuir erros na
    seleção de audiência.
-   **Caminho técnico inicial:** ler etiquetas, criar públicos
    reutilizáveis, mostrar prévia e permitir exclusões.
-   **Automação:** possível apenas como assistência baseada na
    interface, sujeita a auditoria e mudanças do WhatsApp Web.
-   **Publicação:** sempre sob confirmação explícita do usuário.
-   **Licenciamento:** `whatsapp.status_audience`, controlado pelo
    catálogo e pelas licenças emitidas no painel administrativo.
-   **Privacidade:** manter as listas de contatos localmente por padrão;
    enviar ao painel somente dados administrativos e métricas agregadas
    necessárias.
-   **Próxima ação:** auditar o código atual da extensão e validar a
    leitura de etiquetas e a interface de privacidade do Status antes de
    desenvolver a automação.

**Princípio de implementação:** simplificar a segmentação sem fingir que
existe uma API oficial que não existe, sem selecionar contatos por
aproximação e sem publicar um Status sem confirmação explícita.
