# Contrato para atualização posterior do painel — Fase 06 / i9Hub v1.0.0

O painel administrativo ainda não foi modificado. A extensão usa o catálogo local v7.

## Entitlements Calendar implementados

| ID | Nome | Dependências |
|---|---|---|
| `google.calendar.connect` | Conexão com Google Agenda | Nenhuma |
| `google.calendar.availability` | Consulta de disponibilidade | `google.calendar.connect` |
| `google.calendar.booking` | Reserva e gerenciamento de compromissos | `google.calendar.connect`, `google.calendar.availability` |

`google.calendar.automation` continua `implemented: false`, `status: planned`, reservado para a Fase 07. Não o libere em planos nesta etapa.

## Ações protegidas

- `CALENDAR_GET_STATUS` — `google.calendar.connect`
- `CALENDAR_CONNECT` — `google.calendar.connect`
- `CALENDAR_LIST_CALENDARS` — `google.calendar.connect`
- `CALENDAR_SAVE_SETTINGS` — `google.calendar.connect` + `google.calendar.booking`
- `CALENDAR_GET_AVAILABILITY` — `google.calendar.connect` + `google.calendar.availability`
- `CALENDAR_GET_LEAD_EVENTS` — `google.calendar.connect` + `google.calendar.booking`
- `CALENDAR_CREATE_EVENT` — `google.calendar.connect` + `google.calendar.availability` + `google.calendar.booking`
- `CALENDAR_UPDATE_EVENT` — `google.calendar.connect` + `google.calendar.booking`
- `CALENDAR_DELETE_EVENT` — `google.calendar.connect` + `google.calendar.booking`
- `CALENDAR_SYNC_LEAD_EVENTS` — `google.calendar.connect` + `google.calendar.booking`
- `CALENDAR_SEND_CONFIRMATION` — `google.calendar.connect` + `google.calendar.booking` + `whatsapp.connection` + `compliance.consent_tracking` + `compliance.optout_management` + `compliance.frequency_limits`

`CALENDAR_DISCONNECT` é ação de segurança e pode permanecer disponível para desconectar mesmo quando a licença expirar.

## Configuração OAuth externa

A extensão preserva o OAuth Client ID existente e adiciona estes escopos:

- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
- `https://www.googleapis.com/auth/calendar.freebusy`
- `https://www.googleapis.com/auth/calendar.events`

O painel não recebe tokens OAuth Google. O token é obtido pelo Chrome Identity e usado localmente na extensão.

## Requisitos do painel

1. Atualizar o catálogo canônico do backend para a versão 7.
2. Cadastrar os três entitlements Calendar com as dependências acima.
3. Não conceder os IDs automaticamente a todos os planos.
4. Configurar Starter, Pro e Enterprise segundo a estratégia comercial.
5. Não liberar `google.calendar.automation` antes da Fase 07.
6. Preservar a assinatura de licença, o endpoint atual e a compatibilidade das versões anteriores.
7. Testar licenças com acesso completo, parcial e sem Calendar.
8. A confirmação WhatsApp deve exigir os entitlements de WhatsApp e conformidade; não basta liberar `google.calendar.booking`.

## Observações de armazenamento e privacidade

- Eventos são persistidos na conta Google do usuário.
- Metadados de vínculo entre lead e evento são locais nesta fase.
- O conteúdo de conversas não é enviado ao Google Calendar automaticamente.
- A descrição do evento contém campos comerciais selecionados do card; o usuário deve revisar o compartilhamento do calendário.
- O painel não foi alterado nesta entrega.
