# Contrato de integração com painel — i9Hub v1.6.0 / Fase 10

**O painel administrativo não foi alterado nesta fase**, conforme o fluxo de entrega extensão-primeiro.

## Catálogo
- `FEATURE_CATALOG_VERSION`: 11
- Total de IDs: 87
- Funcionalidades implementadas: 86
- Novo ID: `dashboard.commercial_management`
- Dependências futuras: `dashboard.commercial_performance`, `crm.leads`, `crm.kanban`

## Compatibilidade nesta entrega
Para não exigir uma alteração simultânea do painel, as ações da Fase 10 continuam protegidas pelos entitlements já usados pela Fase 09:
- `dashboard.commercial_performance`
- `crm.leads`
- `crm.kanban`

Assim, uma licença que já possui os três direitos da Fase 09 consegue utilizar a gestão comercial da Fase 10. O ID dedicado `dashboard.commercial_management` já está no catálogo da extensão para o próximo ciclo de painel, mas ainda não é exigido pelo roteamento das ações nesta versão.

## Ações
- `COMMERCIAL_MANAGEMENT_GET`
- `COMMERCIAL_MANAGEMENT_SAVE_SELLER`
- `COMMERCIAL_MANAGEMENT_SAVE_TEAM`
- `COMMERCIAL_MANAGEMENT_SAVE_PRODUCT`
- `COMMERCIAL_MANAGEMENT_SAVE_GOAL`
- `COMMERCIAL_MANAGEMENT_DELETE_ENTITY`
- `COMMERCIAL_MANAGEMENT_UPDATE_COMMISSION_STATUS`

Todas exigem `dashboard.commercial_performance`, `crm.leads` e `crm.kanban`.

`UPDATE_LEAD_COMMERCIAL_FIELDS` permanece vinculado a `crm.leads`.

## Atualização futura do painel
Quando o painel for atualizado:
1. Importar o catálogo v11.
2. Exibir `dashboard.commercial_management` como recurso implementado.
3. Configurar dependências `dashboard.commercial_performance`, `crm.leads` e `crm.kanban`.
4. Definir planos comerciais que recebem o novo entitlement.
5. Migrar o roteamento das ações para o novo ID dedicado somente quando os tokens emitidos já contiverem esse direito.
6. Preservar compatibilidade dos tokens anteriores durante a transição.

## Dados e privacidade
Cadastros, metas, regras de comissão e snapshots ficam no armazenamento local da extensão. Esta fase não envia valores de venda, comissão, nomes de vendedores ou dados de leads ao painel administrativo.
