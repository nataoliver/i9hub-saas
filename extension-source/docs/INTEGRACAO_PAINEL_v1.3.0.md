# Contrato para atualização posterior do painel — i9Hub v1.3.0

O painel não foi alterado nesta entrega.

## Catálogo
- `FEATURE_CATALOG_VERSION`: 8
- Total de IDs: 84
- Implementados: 83
- Novo recurso promovido: `google.calendar.automation`

## Entitlement
`google.calendar.automation`

Dependências no catálogo da extensão:
- `google.calendar.booking`
- `google.calendar.connect`
- `crm.kanban`

O recurso de booking continua dependendo de `google.calendar.connect` e `google.calendar.availability`.

## Ações protegidas
- `CALENDAR_AUTOMATION_GET_RULES`
- `CALENDAR_AUTOMATION_SAVE_RULES`
- `CALENDAR_AUTOMATION_GET_TASKS`
- `CALENDAR_AUTOMATION_DISMISS_TASK`

Todas são mapeadas para `google.calendar.automation` e exigem também `google.calendar.booking` e `google.calendar.connect`.

## Atualizações necessárias no painel
1. Importar os 84 IDs canônicos da extensão v1.3.0.
2. Promover `google.calendar.automation` para implementado/ativo.
3. Configurar dependências e descrição comercial.
4. Definir em quais planos o recurso será liberado.
5. Não liberar `admin.full_access` para planos comerciais.
6. Emitir tokens com os entitlements necessários.
7. Manter compatibilidade com tokens de versões anteriores; ausência do novo entitlement deve negar a automação, sem quebrar as demais funções.

## Observação
As regras e tarefas são locais nesta fase. O painel só controla o entitlement; ele não recebe nem sincroniza as regras de automação nesta entrega.
