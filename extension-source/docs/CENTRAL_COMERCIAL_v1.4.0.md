# Central de Agenda e Atividades Comerciais — i9Hub v1.4.0

## Onde encontrar
Acesse o Dashboard. A nova seção aparece como **Agenda e atividades comerciais** quando a licença contém o entitlement `dashboard.commercial_agenda` e suas dependências.

## O que a central mostra

### Indicadores principais
- Compromissos de hoje.
- Compromissos futuros nos próximos 7 dias.
- Follow-ups vencidos.
- Leads sem próxima ação registrada.
- Reuniões realizadas nos últimos 7 dias.
- Pendências de automação aguardando revisão.
- Atividades registradas nos últimos 7 dias.

### Indicadores complementares
- Reuniões confirmadas.
- Reuniões realizadas.
- Reuniões canceladas.
- Registros de ausência ("Não compareceu").
- Follow-ups enviados nos últimos 7 dias.

### Agenda
A lista "Agenda de hoje" mostra compromissos locais associados a cards de leads com início no dia atual. "Próximos 7 dias" mostra eventos futuros vinculados aos leads. Cada item identifica o lead, a etapa, o título e o horário.

O botão "Abrir lead" abre o card CRM. O link "Abrir no Google Agenda" é exibido quando o Google fornece um link seguro para o evento.

Compromissos futuros podem ser cancelados no Dashboard. A exclusão é refletida no Google Calendar e no card do lead.

### Follow-ups
- **Vencidos:** registros em estado `overdue` ou agendamentos `scheduled` cujo horário já passou.
- **Próximos:** registros `scheduled` dentro dos próximos sete dias.
- A central permite abrir o lead e navegar para a tela completa de Follow-ups para enviar, reagendar ou cancelar.

A central não dispara mensagens. O envio continua sob as regras de consentimento, Black list, horário de silêncio, limites e licença do módulo de Follow-ups.

### Leads sem próxima ação
São leads abertos, não fechados e fora da Black list, que não possuem compromisso futuro vinculado nem follow-up futuro com estado `scheduled`.

Essa lista é um alerta operacional para o vendedor definir a próxima atividade no card. Não representa uma previsão automática de que o cliente deixou de responder.

### Pendências de automação
Exibe as tarefas da Fase 07 com status `needs_review`. O vendedor pode abrir o lead ou dispensar a pendência. Dispensar a tarefa não cancela nem exclui eventos que já existam na agenda.

### Atividades recentes
A lista reúne registros recentes do histórico do CRM, como anotações manuais, mudanças de etapa, eventos da agenda e atividades automáticas. Cada item abre o card do lead.

## Registrar o resultado de uma reunião
Depois do horário final do compromisso, o vendedor pode registrar:
- **Realizada:** o cliente compareceu e a reunião ocorreu.
- **Não compareceu:** a ausência do lead foi registrada.

O i9Hub salva `outcome`, `outcomeAt` e uma atividade no histórico local do lead. Essa informação é comercial/CRM; não altera o status do evento no Google Calendar. Se o resultado precisar ser corrigido, use o histórico e a operação do CRM conforme o procedimento interno.

## Atualização
- Botão Atualizar.
- Atualização periódica a cada 60 segundos enquanto o Dashboard está aberto.
- Atualização acionada por mensagens locais de mudança de agenda, automações, follow-ups e classificação.

## Fonte e limites dos dados
A central utiliza dados locais do CRM (`leads.calendarEvents`, `crmFollowups`, `activityLog`/notas e tarefas de automação). Não consulta todos os eventos da conta Google Calendar; eventos externos sem vínculo com lead não são exibidos. As métricas refletem o perfil Chrome atual, não um consolidado entre computadores.

A contagem de "atividades registradas" considera os itens do histórico CRM. A contagem de "follow-ups enviados" utiliza o estado e timestamp de envio registrados pelo módulo de follow-ups.

## Licença
Entitlement: `dashboard.commercial_agenda`

Dependências:
- `google.calendar.connect`
- `google.calendar.booking`
- `crm.followup.manage`
- `crm.kanban`

Ação de leitura: `DASHBOARD_GET_COMMERCIAL_OVERVIEW`.

Ação de resultado: `CALENDAR_SET_EVENT_OUTCOME`, protegida por `google.calendar.connect` e `google.calendar.booking`.
