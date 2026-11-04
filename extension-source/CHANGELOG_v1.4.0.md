# i9Hub v1.4.0 — Fase 08: Dashboard de agenda e atividades comerciais

## Resumo
A Fase 08 amplia o Dashboard com uma Central de Agenda e Atividades Comerciais conectada aos registros locais do CRM, aos compromissos Google Agenda vinculados aos leads, aos follow-ups e às pendências das automações da Fase 07.

## Novidades
- Indicadores: compromissos hoje, próximos 7 dias, follow-ups vencidos, leads sem próxima ação, reuniões realizadas nos últimos 7 dias, pendências de automação e atividades registradas nos últimos 7 dias.
- Resumo adicional de reuniões confirmadas, realizadas, canceladas, ausências registradas e follow-ups enviados.
- Agenda de hoje e próximos 7 dias, com acesso ao lead e ao Google Agenda.
- Lista de follow-ups vencidos e próximos follow-ups.
- Identificação de leads abertos sem evento futuro ou follow-up futuro registrado.
- Lista de pendências de automação da Fase 07, com acesso ao lead e opção de dispensar.
- Atividades recentes do histórico CRM, incluindo registros manuais e automáticos.
- Ações no Dashboard para registrar reunião realizada, registrar ausência e cancelar compromisso futuro.
- Registro de resultado da reunião também no card do lead.
- Atualização automática do Dashboard ao receber eventos de agenda, follow-up, classificação e automação; atualização manual e periódica.
- Novo entitlement `dashboard.commercial_agenda`.
- Catálogo atualizado para v9.
- Release da extensão atualizado para 1.4.0.

## Resultado de reunião
O vendedor pode registrar `Realizada` ou `Não compareceu` depois do horário final do evento. O resultado fica registrado no card do CRM e no histórico. Essa marcação não altera o estado do evento no Google Calendar; é um resultado comercial local.

## Escopo e limites
A agenda do Dashboard reúne os compromissos salvos nos cards de leads do i9Hub. Eventos externos do Google Calendar sem vínculo com um lead não aparecem nesta visão. Regras, pendências e resultados comerciais continuam locais ao perfil Chrome desta instalação.

## Licenciamento
- Recurso: `dashboard.commercial_agenda`
- Dependências: `google.calendar.connect`, `google.calendar.booking`, `crm.followup.manage` e `crm.kanban`.
- A ação `DASHBOARD_GET_COMMERCIAL_OVERVIEW` exige o novo entitlement e todas as dependências.
- `CALENDAR_SET_EVENT_OUTCOME` exige `google.calendar.connect` e `google.calendar.booking`.
- Painel administrativo não foi alterado; catálogo v9 e novo entitlement precisam ser sincronizados no painel para liberação por plano.

## Validação
`npm run validate`: manifesto e arquivos JavaScript/MJS verificados; 315 testes aprovados, zero falhas. A homologação OAuth/Google Calendar continua exigindo conta real de teste.
