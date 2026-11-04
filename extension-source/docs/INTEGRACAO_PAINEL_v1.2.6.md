# Contrato de integração com o painel — i9Hub v1.2.6

Esta documentação prepara a atualização futura do painel administrativo. O painel ainda não foi modificado.

## Catálogo

- `featureCatalogVersion`: 4
- Novo entitlement: `crm.notes`
- Nome: Histórico e anotações manuais do lead
- Categoria: CRM
- Estado na extensão: implementado
- Dependência: `crm.leads`

## Regras de concessão

Para habilitar o histórico, o token assinado deve incluir `crm.notes` e `crm.leads`, ou `admin.full_access`.

A extensão continua aplicando o princípio fail-closed: ausência do entitlement significa acesso negado.

## Ações protegidas na extensão

| Ação | Entitlement |
|---|---|
| `GET_LEAD_HISTORY` | `crm.notes` |
| `ADD_LEAD_NOTE` | `crm.notes` |
| `UPDATE_LEAD_NOTE` | `crm.notes` |
| `DELETE_LEAD_NOTE` | `crm.notes` |

## Compatibilidade

- Nenhum endpoint novo do painel é necessário.
- O formato do token Ed25519 permanece inalterado.
- A versão do contrato de licença não foi alterada.
- A extensão continua aceitando o fluxo de ativação atual.
- O painel deve atualizar o catálogo e os planos explícitos quando chegar a etapa de integração.

## Importante

Não conceder `crm.notes` a todos os planos automaticamente. A liberação deve ser configurada por plano e por licença individual no painel.
