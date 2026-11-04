# Inventário de funcionalidades — i9Leads Flow

## Base analisada

- Pacote recebido: `i9Leads-Flow-Extensao-v5.3.2-fix1.zip`.
- `manifest.json`: `version = 5.3.2`, `version_name = 5.3.2`.
- Não foi alterada a versão do manifesto.
- O pacote histórico `i9Leads_Flow_v5.0.0_PRO.zip` tinha `version = 5.4.0` e `version_name = 5.0.0 PRO`; são identificadores diferentes e não devem ser confundidos.

## Funcionalidades mapeadas para o painel

| ID estável | Funcionalidade | Operações mapeadas |
|---|---|---|
| `crm.dashboard` | Dashboard comercial | Indicadores do CRM, campanhas e atendimento; filtros Hoje/7 dias/30 dias; funil; conversas aguardando resposta; atualização manual |
| `crm.leads` | Gestão de leads | Consultar, salvar, editar e excluir leads; limpeza de leads |
| `crm.pipeline` | Kanban e etapas do CRM | Etapas, movimentação de oportunidades, pipeline horizontal e arrastar/soltar |
| `crm.classification` | Classificação de contatos | Tipo de contato, campos personalizados, reclassificação, deduplicação e atualização em lote |
| `crm.blacklist` | Black list | Consultar, adicionar, remover e adicionar vários contatos à lista de bloqueio |
| `crm.whatsapp.private_sync` | Sincronização de conversas privadas | Importar conversas privadas do WhatsApp como oportunidades no CRM |
| `crm.whatsapp.labels` | Etiquetas WhatsApp | Diagnóstico e sincronização de etiquetas com etapas do CRM |
| `crm.export.csv` | Exportação CSV | Exportar leads selecionados ou filtrados |
| `crm.export.webhook` | Exportação por webhook | Enviar leads do CRM ao webhook configurado |
| `whatsapp.connection` | Conexão e controle WhatsApp | Abrir, conectar, consultar status, recarregar, diagnosticar e configurar o modo de visualização |
| `whatsapp.campaigns.manage` | Gestão de campanhas WhatsApp | Consultar, criar, editar e excluir campanhas |
| `whatsapp.campaigns.send` | Execução de campanhas WhatsApp | Iniciar, pausar, retomar, parar e reenviar campanhas |
| `whatsapp.chats` | Leitura de chats | Listar conversas disponíveis |
| `whatsapp.groups.members` | Participantes de grupos | Extrair participantes dos grupos selecionados |
| `whatsapp.chat_history` | Histórico da conversa | Extrair as mensagens disponíveis da conversa selecionada |
| `maps.extraction` | Extração Google Maps | Iniciar/parar extração e capturar resultados para o CRM |
| `rcs.templates` | Templates RCS | Consultar templates disponíveis |
| `rcs.campaigns` | Envio e campanhas RCS | Consultar saldo/campanhas, enviar teste e iniciar campanhas |
| `integrations.webhook` | Integração por webhook | Consultar, salvar, configurar e testar webhook |
| `backup.drive` | Backup Google Drive | Conectar/desconectar, consultar estado, sincronizar, restaurar e sobrescrever backup |
| `backup.drive.auto` | Sincronização automática com Drive | Ativar/desativar sincronização automática |
| `business.profile` | Perfil inteligente do negócio | Consultar catálogo, montar, salvar e redefinir perfil comercial |
| `settings.configuration` | Configurações gerais | Consultar/salvar configurações, atrasos, Spintax, classificador, aparência e preferências |
| `diagnostics.whatsapp` | Diagnóstico WhatsApp | Diagnóstico específico de conexão e compatibilidade |
| `telemetry.usage` | Telemetria de utilização | Eventos operacionais mínimos, condicionados ao consentimento do usuário |

## Funções de sistema que não devem depender de uma licença paga

- Ativar, validar ou remover uma licença e consultar o estado/uso da licença.
- Consultar o catálogo de funções e o estado de acesso.
- Consultar ou revogar o consentimento de telemetria.
- Limpar todos os dados locais (`CLEAR_ALL_DATA`), por ser uma ação de privacidade do usuário.
- Registrar logs de diagnóstico locais.

## Regras de autorização

1. Os IDs acima são estáveis e mapeiam comandos reais do service worker.
2. A extensão reporta o manifesto a `POST /api/v1/features/report` depois de uma ativação/revalidação válida. O endpoint documentado aceita até 25 funções por lote; o manifesto atual tem 25 funções, exatamente o limite por lote.
3. Uma função nova deve entrar como `PENDING` no painel e só deve ser liberada depois de revisão administrativa.
4. Tokens legados, que só contenham IDs antigos como `hello`, `batch`, `rcs_send` e `export`, continuam em modo compatível para não bloquear clientes antes da migração do painel.
5. Quando o token contiver IDs deste catálogo (ou `schemaVersion >= 2`), o controle passa a ser estrito: uma função não concedida é recusada no service worker com `FEATURE_NOT_ENTITLED`.
6. Para a licença administrativa de teste, o painel deve emitir todos os IDs acima ou um entitlement global de administrador compatível (`*` / `allFeatures: true`).
7. O painel ainda precisa emitir as permissões do plano gratuito ou um entitlement gratuito equivalente. Sem token de licença, a extensão preserva o comportamento gratuito legado até essa integração ser feita.

## Melhorias recuperadas nesta integração

### Kanban

- Área de rolagem horizontal própria, sem exigir zoom reduzido.
- Colunas com largura fixa e arrastar/soltar preservado.
- Controles Anterior/Próxima e indicador das etapas visíveis.
- Navegação por setas do teclado e barra horizontal nativa.
- A rolagem fica dentro do Kanban, não na página inteira.

### Dashboard

- Indicadores de leads, oportunidades, negócios fechados, valor do pipeline e conversão.
- Métricas WhatsApp: recebidas, enviadas, spam, respondidas, aguardando resposta e taxa de resposta.
- Filtros Hoje, Últimos 7 dias e Últimos 30 dias.
- Funil por etapa, conversas pendentes, campanhas recentes, atalhos e atualização manual.
- Correção do caminho de dados que podia exibir zero leads: o Dashboard passa a usar `computeDashboardMetrics()` com a mesma lista de leads retornada pelo CRM.
- Se não houver eventos do monitor WhatsApp, o Dashboard informa que o histórico não foi iniciado; não inventa métricas nem reconstrói mensagens antigas.

## Telemetria

- A opção de consentimento começa desmarcada e pode ser revogada.
- A fila local é limitada a 200 eventos; o envio é feito em lotes de até 50.
- Eventos permitidos: `extension_started`, `extension_active`, `dashboard_opened`, `crm_opened`, `feature_used`, `campaign_started`, `campaign_completed`, `maps_search`, `drive_sync`, `whatsapp_connected`, `whatsapp_disconnected`, `license_status_viewed`.
- O payload não aceita campos livres e não inclui texto de mensagens, nomes/telefones de contatos, leads, URLs privadas, credenciais ou chaves.
- Com licença ativa, o cliente usa `Authorization: Bearer` e `X-Device-Id`.
- Sem licença, o cliente prepara eventos anônimos com um `installationId` aleatório e `anonymous: true`, somente após consentimento. **O painel precisa aceitar explicitamente esse modo anônimo na próxima etapa**; o endpoint documentado originalmente exige token e pode rejeitar eventos sem licença até essa mudança. A fila tem retry/backoff e a telemetria não bloqueia os demais módulos.

## Compatibilidade preservada

- `lib/message-gate.js` foi mantido; apenas os dois eventos passivos necessários ao monitor foram incluídos na allowlist da origem oficial do WhatsApp.
- A lógica que diferencia páginas da extensão de content scripts não foi substituída.
- O módulo de Google Drive/OAuth e os handlers de RCS foram mantidos.
- RCS continua oculto na navegação lateral, sem remoção de rotas ou serviços.
- O manifesto e sua versão técnica permaneceram inalterados.

## Testes locais

Executar na raiz da extensão:

```bash
npm run validate
npm test
```

Os testes automatizados verificam sintaxe/estrutura do pacote, mapeamento dos handlers, autorização de mensagens, catálogo de permissões, privacidade do payload de telemetria, métricas do Dashboard e presença dos controles do Kanban. Ainda são necessários testes reais no Chrome.
