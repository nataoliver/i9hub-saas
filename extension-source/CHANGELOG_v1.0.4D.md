# i9Hub v1.0.4D — Correção do Sincronizar PV

## Objetivo
Corrigir o botão **Sincronizar PV** sem alterar o painel/backend de licenciamento nem outros módulos.

## Correções
- O botão `btn-sync-private` usa o ID canônico `whatsapp.private_opportunities`, alinhado ao catálogo e ao mapa da ação `SYNC_PRIVATE_OPPORTUNITIES`.
- A proteção de ações essenciais reconhece o ID canônico da sincronização de oportunidades privadas.
- `scanId` é inicializado antes do primeiro log que o utiliza; `syncRunId` é recebido como parâmetro explícito, evitando `ReferenceError` por acesso antes da inicialização.
- A sincronização manual encaminha `syncRunId` para o script injetado.
- Um clique manual durante uma varredura automática fica enfileirado para executar uma varredura forçada ao final da varredura ativa.

## Preservado
- Painel/backend e contrato de licenciamento.
- Catálogo e permissões existentes (somente referência de UI corrigida para o ID já cadastrado).
- Remoções da v1.0.4C: Saúde da conta WhatsApp, Atendimento IA no painel e Públicos de Status.
- CRM, campanhas, contatos, mapas, chats, botão Abrir WhatsApp e layout 90/10.

## Versão
- Manifesto Chrome: `1.0.4.5`
- Nome comercial exibido: `1.0.4D`
- Versão enviada à API de licenciamento: normalizada para `1.0.4` via `lib/version.js`.
