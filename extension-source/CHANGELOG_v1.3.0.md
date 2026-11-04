# i9Hub v1.3.0 — Fase 07: Automações por estágio e etiqueta

## Resumo
Implementa automações locais do Google Agenda acionadas por transições novas no CRM. As regras podem criar compromissos futuros, solicitar que o vendedor escolha um horário ou criar um evento a partir de campos de data/hora do card.

## Novidades
- Catálogo de funcionalidades atualizado para v8.
- `google.calendar.automation` promovido de planejado para implementado.
- Cadastro, edição, ativação/pausa e exclusão de regras em Configurações → Google Agenda.
- Gatilhos por mudança de etapa e inclusão de etiqueta.
- Ação para criar evento após intervalo em horas ou dias, em horário preferencial.
- Ação para solicitar agendamento com revisão humana.
- Ação para criar evento com campos do lead (data `AAAA-MM-DD` e hora `HH:mm`, inclusive campos personalizados).
- Verificação de expediente, dias úteis e disponibilidade real via Google FreeBusy.
- Pendências de revisão para agenda desconectada, conflito de horário, data inválida e falha operacional.
- Idempotência por regra + lead + transição para reduzir duplicidades.
- Histórico do CRM para eventos criados e ações que aguardam revisão.
- Confirmação opcional por WhatsApp Web, sujeita a autorização de licença, consentimento, blacklist, horário de silêncio e limites.

## Identificadores e licenciamento
- Recurso: `google.calendar.automation`
- Dependências: `google.calendar.booking`, `google.calendar.connect` e `crm.kanban` (booking mantém sua dependência de disponibilidade).
- Ações administrativas locais mapeadas no catálogo: `CALENDAR_AUTOMATION_GET_RULES`, `CALENDAR_AUTOMATION_SAVE_RULES`, `CALENDAR_AUTOMATION_GET_TASKS`, `CALENDAR_AUTOMATION_DISMISS_TASK`.

O painel administrativo não foi alterado. O catálogo/seed do painel e os planos precisam ser sincronizados posteriormente.

## Persistência e limites
As regras, execuções e tarefas de revisão ficam no `chrome.storage.local` deste perfil do Chrome. Os eventos são criados na conta Google Calendar selecionada. Regras e pendências ainda não são sincronizadas entre computadores nem com o painel.

Os gatilhos são processados quando a extensão recebe a mudança de etapa ou a inclusão de etiqueta. Alterações ocorridas enquanto a extensão/navegador estiverem fechados não são reconstituídas retroativamente.

## Compatibilidade
- Base: i9Hub v1.0.0.
- Versão: 1.3.0 (Manifest técnico 1.3.0.0).
- Mantém o OAuth Google Calendar da Fase 06 e o envio via WhatsApp Web, sem API oficial.
