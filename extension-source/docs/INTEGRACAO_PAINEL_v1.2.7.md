# Contrato para atualização posterior do painel — i9Hub v1.2.7

A extensão passou a reconhecer o entitlement:

- `ai.mode.observe_only`

Dependências exigidas pela extensão:

- `whatsapp.ai_support`
- `crm.leads`

O catálogo canônico local foi atualizado para `FEATURE_CATALOG_VERSION = 5`.

## Alteração necessária no painel (não aplicada nesta entrega)

1. Incluir `ai.mode.observe_only` no catálogo de funcionalidades.
2. Associar ao módulo IA.
3. Exigir `whatsapp.ai_support` e `crm.leads` como dependências.
4. Disponibilizar o entitlement na UI de seleção de funcionalidades por plano.
5. Incluir o ID nos tokens de teste/planos que devam receber o recurso.
6. Garantir que atualização do catálogo e emissão de licença sejam aditivas, preservando tokens e conexões existentes.

## Compatibilidade

A extensão mantém o contrato de token Ed25519, o endpoint de licenciamento e os IDs anteriores. A ausência do novo entitlement não bloqueia o modo automático existente; apenas impede salvar/ativar/processar o modo observador.
