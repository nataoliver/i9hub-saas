# i9Hub v1.2.6 — Fase 03: Histórico e anotações do CRM

## Novidades

- Novo entitlement `crm.notes`, dependente de `crm.leads`.
- CRUD de anotações manuais por lead: adicionar, editar e excluir.
- Histórico cronológico que reúne anotações e eventos operacionais.
- Eventos automáticos para mudanças de estágio, classificação, dados de identidade, campos personalizados e etiquetas sincronizadas do WhatsApp Business.
- Registro de edição e exclusão de anotações sem manter o conteúdo removido no histórico.
- Preservação de notas e eventos durante a deduplicação de leads.
- Migração de leitura compatível com anotações antigas (`date`, `author`, `text`).
- Interface responsiva dentro do card do CRM.
- Proteção das operações no service worker; handlers sem entitlement são bloqueados pelo gate central.

## Compatibilidade

- Mantém o armazenamento existente em `chrome.storage.local`.
- Não exige migração destrutiva dos leads existentes.
- Mantém os campos legados `lead.notes`; adiciona `lead.activityLog`.
- Não altera o painel administrativo nesta etapa.
- Não altera o formato do token Ed25519 nem o contrato de ativação.

## Limites locais

- Até 5.000 caracteres por anotação.
- Até 500 anotações por lead. Ao atingir o limite, novas anotações são recusadas; as antigas não são descartadas silenciosamente.
- Até 500 eventos automáticos por lead.
- A interface exibe os 100 registros mais recentes; a consulta `GET_LEAD_HISTORY` aceita até 250 eventos de timeline por chamada.

## Entitlement

`crm.notes` — Histórico e anotações manuais do lead.

Dependência: `crm.leads`.

Ações protegidas:
- `GET_LEAD_HISTORY`
- `ADD_LEAD_NOTE`
- `UPDATE_LEAD_NOTE`
- `DELETE_LEAD_NOTE`

## Testes

`npm run validate`

- Verificação do manifesto e imports: aprovada.
- Testes automatizados: 267 aprovados, 0 falhas.

A homologação visual no Chrome, com uma licença que contenha `crm.notes`, ainda deve ser realizada manualmente.
