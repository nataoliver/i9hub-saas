# Relatório de implementação — Fase 07
## i9Hub v1.3.0 — Automações por estágio e etiqueta

**Base:** i9Hub v1.0.0  
**Entrega:** i9Hub v1.3.0  
**Escopo:** automações locais do Google Agenda acionadas por mudanças de etapa e inclusão de etiquetas no CRM.  
**Painel administrativo:** não alterado nesta fase, conforme orientação do projeto.

## 1. Funcionalidades implementadas

- Cadastro, edição, pausa/reativação e exclusão de até 50 regras.
- Gatilho por mudança real de etapa do CRM.
- Gatilho por inclusão de etiqueta nova, incluindo sincronização de etiquetas do WhatsApp Business e tags recebidas por `SAVE_LEADS`.
- Ação para criar compromisso após intervalo em horas ou dias, com horário preferencial e duração.
- Ação para criar pendência solicitando que o vendedor escolha o horário.
- Ação para criar evento a partir de campos de data/hora existentes no lead ou em campos personalizados.
- Verificação do expediente, dias de atendimento e disponibilidade FreeBusy antes da criação.
- Pendências de revisão para agenda desconectada, conflito, data/hora inválida, horário fora do expediente e falhas de integração.
- Idempotência por regra + lead + transição; eventos recebem `i9HubEventKey` em propriedades privadas do Google Calendar.
- Recuperação de execuções que ficaram em `processing` por mais de cinco minutos.
- Histórico do CRM para eventos automáticos e tarefas que aguardam revisão.
- Pendência de agendamento concluída quando o vendedor cria manualmente um evento no card do lead.
- Confirmação opcional pelo WhatsApp Web, após criação do evento, com autorização composta de licença e validações de consentimento/compliance.

## 2. Interface

Em **Configurações → Google Agenda**, foi adicionada a seção **Automações por estágio e etiqueta**, com:
- Nome da regra.
- Tipo e valor do gatilho.
- Ação desejada.
- Intervalo e horário.
- Duração.
- Título e descrição do evento.
- Aprovação humana.
- Confirmação opcional pelo WhatsApp.
- Lista de regras com editar, pausar/ativar e excluir.
- Lista de ações aguardando revisão, com acesso direto ao lead e opção de dispensar.

## 3. Arquitetura e arquivos

### Novos
- `lib/calendar-automation.js` — normalização, validação, matching de transições, resolução de data e chave idempotente.
- `test/calendar-automation-v1.3.0.test.js` — testes unitários e de integração estrutural da Fase 07.
- `CHANGELOG_v1.3.0.md`
- `GUIA_TESTE_v1.3.0.md`
- `docs/CALENDAR_AUTOMATIONS_v1.3.0.md`
- `docs/INTEGRACAO_PAINEL_v1.3.0.md`
- `INSTALAR-i9Hub-1.3.0.txt`
- `RELATORIO_IMPLEMENTACAO_FASE_07_v1.3.0.md`

### Modificados
- `background/service-worker.js` — storage, execução das regras, gatilhos por etapa/tag, criação idempotente de eventos, pendências e handlers protegidos.
- `lib/feature-catalog.js` — catálogo v8 e ativação de `google.calendar.automation`.
- `sidepanel/components/SettingsView.js` — interface de gestão de regras e pendências.
- `sidepanel/utils/api.js` — ponte para regras e tarefas.
- `manifest.json`, `package.json`, `content/content.js`, `content/injected.js` — versão 1.3.0.
- Testes de regressão com expectativas da versão atual e catálogo atualizados.
- `README.md`.

## 4. Catálogo e licenciamento

- Versão do catálogo: **8**.
- Total de IDs: **84**.
- Funcionalidades implementadas: **83**.
- Funcionalidades planejadas: **0**.
- ID ativado: `google.calendar.automation`.
- Dependências: `google.calendar.booking`, `google.calendar.connect` e `crm.kanban`.
- `google.calendar.booking` continua exigindo conexão e disponibilidade.

Ações protegidas:
- `CALENDAR_AUTOMATION_GET_RULES`
- `CALENDAR_AUTOMATION_SAVE_RULES`
- `CALENDAR_AUTOMATION_GET_TASKS`
- `CALENDAR_AUTOMATION_DISMISS_TASK`

## 5. Persistência e limitações

- Regras, execuções e tarefas ficam em `chrome.storage.local`.
- Eventos são criados na agenda Google selecionada.
- Referências de eventos ficam no card local do lead.
- Regras e pendências não são sincronizadas entre computadores, Drive ou painel administrativo nesta fase.
- Gatilhos são processados quando a extensão recebe a transição. Alterações ocorridas enquanto o navegador/extensão estiverem fechados não são reprocessadas retroativamente.
- A criação automática usa o horário preferencial exato. Se estiver ocupado ou fora do expediente, a regra gera pendência para revisão; não escolhe outro horário silenciosamente.
- A confirmação WhatsApp depende de Chrome/WhatsApp Web disponíveis e passa pelo handler existente. Não utiliza API oficial do WhatsApp.
- Convites por e-mail não são enviados automaticamente pelas regras.

## 6. Validação executada

Comando: `npm run validate`

Resultado:
- `scripts/check.mjs`: manifesto e 124 arquivos JavaScript/MJS verificados.
- Testes automatizados: **308 aprovados, 0 falhas**.
- Manifesto validado.
- Testes unitários para normalização, gatilhos, datas, campos personalizados, tarefas e idempotência.

## 7. Homologação externa pendente

A suíte automatizada não substitui a homologação com uma conta Google real. Ainda é necessário testar:
1. OAuth no Chrome com o Client ID de produção.
2. FreeBusy e reserva automática na agenda real/de teste.
3. Regras acionadas por mudança de etapa no Kanban.
4. Etiquetas adicionadas/removidas no WhatsApp Business.
5. Conflito de horário e aprovação humana.
6. Confirmação opcional no WhatsApp Web com contato de teste que tenha consentimento válido.

## 8. Próxima integração com o painel

O painel deverá importar o catálogo v8, liberar `google.calendar.automation` nos planos escolhidos e emitir tokens com as dependências necessárias. O contrato está em `docs/INTEGRACAO_PAINEL_v1.3.0.md`.
