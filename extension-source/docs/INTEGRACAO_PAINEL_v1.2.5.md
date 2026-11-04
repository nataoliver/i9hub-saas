# Integração posterior do painel administrativo — i9Hub v1.2.5

Esta especificação é entregue junto da extensão. O painel não foi modificado nesta fase, conforme a decisão de concluir primeiro o código da extensão.

## Contrato atualizado

- `featureCatalogVersion`: **3**
- `licenseContractVersion`: permanece **1**
- Novo ID implementado: `crm.lead.identity_edit`
- Dependência obrigatória: `crm.leads`
- Handler da extensão: `UPDATE_LEAD_IDENTITY`

## Trabalho necessário no painel

1. Atualizar o catálogo de funcionalidades para versão 3.
2. Incluir `crm.lead.identity_edit` como funcionalidade implementada, vinculada ao módulo CRM.
3. Disponibilizar a funcionalidade na UI de seleção de planos personalizados.
4. Atualizar os planos Starter/Pro conforme a matriz comercial decidida pelo administrador.
5. Incluir o entitlement nos tokens assinados das contas que receberem a função.
6. Preservar `admin.full_access` como acesso administrativo às funcionalidades implementadas, sem liberar funcionalidades futuras ainda não implementadas.
7. Registrar auditoria das alterações de plano/entitlement.
8. Testar emissão, renovação, revogação e atualização de permissões sem reinstalar a extensão.

## Regra de segurança

A extensão bloqueia a ação se o token não contiver `crm.lead.identity_edit` e `crm.leads`. Não usar wildcard para conceder o novo direito. Não liberar os recursos ainda planejados (IA observadora, anotações, follow-up ou Google Agenda) nesta atualização.

## Dados registrados pela extensão

Cada campo de identidade pode conter `source`, `confidence`, `observedAt`, `manual`, `locked` e `cleared`. Esses metadados ficam no registro do lead local. A ação de edição manual grava os campos corrigidos e marca a origem como `manual`.
