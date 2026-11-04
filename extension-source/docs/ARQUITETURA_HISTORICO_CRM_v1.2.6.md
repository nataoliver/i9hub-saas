# Arquitetura — Histórico do CRM i9Hub v1.2.6

## Modelo de dados

O histórico fica associado ao próprio lead em `chrome.storage.local`.

### `lead.notes`

Array de anotações. A estrutura nova contém:

- `id`: identificador estável.
- `text`: conteúdo da anotação.
- `author`: autor exibido (`Usuário` na versão atual).
- `source`: `manual`, `legacy`, `ai` ou `system`.
- `manual`: indica se o registro pode ser editado pelo usuário.
- `createdAt` e `date`: data de criação, mantendo compatibilidade com versões antigas.
- `updatedAt`: última edição.
- `edited`: sinaliza edição posterior.

Anotações legadas com `date`, `author` e `text` são normalizadas durante a leitura. IDs legados são determinísticos para evitar duplicação de registros em consultas repetidas.

### `lead.activityLog`

Array de eventos automáticos/auditáveis:

- `id`
- `type`
- `title`
- `description`
- `actor`
- `source`
- `createdAt`
- `metadata`

Tipos registrados na v1.2.6:

- `lead.stage_changed`
- `lead.classification_changed`
- `lead.classification_reset`
- `lead.identity_updated`
- `lead.custom_fields_updated`
- `lead.labels_synced`
- `lead.labels_removed`
- `note.updated`
- `note.deleted`

O texto de uma anotação excluída não é copiado para o evento de exclusão.

## Linha do tempo

`buildCrmTimeline(lead)` combina `notes` e `activityLog`, normaliza os registros, ordena por data decrescente e devolve uma visão unificada. O card exibe os 100 itens mais recentes.

## Operações protegidas

A interface usa `data-feature="crm.notes"`, e o service worker é a autoridade final de autorização.

O catálogo canônico foi atualizado para `FEATURE_CATALOG_VERSION = 4`.

A funcionalidade `crm.notes` está marcada como implementada e depende de `crm.leads`.

Handlers:
- `GET_LEAD_HISTORY`
- `ADD_LEAD_NOTE`
- `UPDATE_LEAD_NOTE`
- `DELETE_LEAD_NOTE`

Todos os handlers estão mapeados em `ACTION_FEATURE_MAP` e passam pelo gate central de licenciamento.

## Concorrência e integridade

As operações de adicionar, editar e excluir anotações passam por uma fila serial no service worker para reduzir conflitos read-modify-write.

A deduplicação consolida notas e eventos dos registros combinados, sem substituir os registros históricos do lead mantido.

Os eventos são limitados a 500 por lead. As anotações não são descartadas automaticamente: ao atingir 500, novas anotações são recusadas com mensagem explicativa.

## Limites desta fase

- Não sincroniza o histórico com o painel administrativo.
- Não implementa sincronização multi-dispositivo.
- Não registra ainda as análises da IA observadora (Fase 04).
- Não registra follow-ups ou compromissos do Google Calendar (Fases 05–07).
- O autor é genérico (`Usuário`) porque a extensão atual não possui identidade individual de operador por usuário local.
