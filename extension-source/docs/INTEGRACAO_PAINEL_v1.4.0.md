# Contrato de integração com painel — i9Hub v1.4.0 / Fase 08

O painel administrativo não foi modificado nesta entrega.

## Catálogo
- `FEATURE_CATALOG_VERSION`: 9
- Total de IDs: 85
- Funcionalidades implementadas: 84
- Novo entitlement: `dashboard.commercial_agenda`

## Novo recurso
`dashboard.commercial_agenda`

Descrição sugerida:
"Central de agenda e atividades comerciais: compromissos vinculados aos leads, follow-ups, leads sem próxima ação, produtividade e pendências de automação."

Dependências:
- `google.calendar.connect`
- `google.calendar.booking`
- `crm.followup.manage`
- `crm.kanban`

O recurso `google.calendar.booking` mantém suas dependências existentes, inclusive disponibilidade e conexão.

## Ações protegidas
- `DASHBOARD_GET_COMMERCIAL_OVERVIEW` → `dashboard.commercial_agenda`
  - Requer `dashboard.commercial_agenda`, `google.calendar.connect`, `google.calendar.booking`, `crm.followup.manage` e `crm.kanban`.
- `CALENDAR_SET_EVENT_OUTCOME` → `google.calendar.booking`
  - Requer `google.calendar.connect` e `google.calendar.booking`.

## Atualizações necessárias no painel
1. Importar o catálogo canônico de 85 IDs da extensão v1.4.0.
2. Promover `dashboard.commercial_agenda` para implementado/ativo.
3. Configurar as dependências indicadas.
4. Definir os planos comerciais que receberão o novo entitlement.
5. Emitir tokens contendo o novo entitlement e suas dependências.
6. Preservar compatibilidade com tokens anteriores: a ausência do novo entitlement deve bloquear somente a nova central.
7. Não conceder `admin.full_access` a planos comerciais.

## Observações de arquitetura
- O endpoint agrega dados locais do perfil Chrome.
- O painel não recebe histórico, compromissos, resultados de reunião ou follow-ups nesta fase.
- Eventos e métricas não são consolidados entre computadores.
