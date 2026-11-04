# Contrato para atualização posterior do painel — Fase 05 / i9Hub v1.2.8

O painel administrativo ainda não foi modificado. A extensão passou a utilizar o catálogo local v6 e exige os IDs abaixo.

## Novos IDs implementados
| ID | Nome | Dependências |
|---|---|---|
| `crm.followup.manage` | Gerenciamento de follow-ups | `crm.leads` |
| `crm.followup.send` | Envio programado de mensagens | `crm.followup.manage`, `whatsapp.connection`, `compliance.consent_tracking`, `compliance.optout_management`, `compliance.frequency_limits` |
| `crm.followup.automation` | Sequências e interrupção automática | `crm.followup.manage`, `crm.followup.send`, `crm.kanban` |

## Ações protegidas
- `GET_FOLLOWUPS`
- `GET_FOLLOWUP_SETTINGS`
- `GET_FOLLOWUP_TEMPLATES`
- `SCHEDULE_FOLLOWUP`
- `SCHEDULE_FOLLOWUP_SEQUENCE`
- `CANCEL_FOLLOWUP`
- `CANCEL_FOLLOWUP_SEQUENCE`
- `RESCHEDULE_FOLLOWUP`
- `SEND_FOLLOWUP_NOW`
- `DELETE_FOLLOWUP`
- `SAVE_FOLLOWUP_SETTINGS`
- `SAVE_FOLLOWUP_TEMPLATES`

Ações de consulta também exigem o entitlement `crm.followup.manage`. O envio e o agendamento exigem os direitos compostos indicados acima.

## Requisitos do painel
1. Atualizar a fonte canônica do catálogo para a versão 6.
2. Incluir os três IDs e suas dependências no catálogo do backend e no `seed.ts`.
3. Não conceder esses IDs automaticamente a todos os planos.
4. Configurar Starter, Pro e Enterprise de acordo com a estratégia comercial.
5. Preservar o contrato de tokens assinado e a compatibilidade com extensões anteriores.
6. Não liberar `admin.full_access` por meio de um plano comercial.
7. Testar licença com permissões completas, parciais e sem follow-up.

## Observações
- A extensão mantém agendamentos no `chrome.storage.local`.
- O painel não recebe conteúdo de mensagens nem os textos dos follow-ups via telemetria.
- A sincronização entre dispositivos não está implementada.
- O envio depende do WhatsApp Web local e não cria uma operação na API oficial.
