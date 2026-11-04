# Automações do Google Agenda — i9Hub v1.3.0

## Onde configurar
Configurações → Google Agenda → Automações por estágio e etiqueta.

## Tipos de gatilho
- **Etapa:** executa quando `UPDATE_LEAD_STAGE` efetivamente muda o estágio do lead.
- **Etiqueta:** executa somente quando uma etiqueta nova é adicionada por sincronização/importação. A presença contínua da mesma etiqueta não dispara novamente.

A sincronização das etiquetas do WhatsApp continua mantendo etiquetas como tags; elas não são convertidas em estágios comerciais.

## Tipos de ação
### 1. Criar compromisso após um intervalo
Define horas ou dias após a transição e um horário preferencial. O i9Hub consulta o Google FreeBusy antes de criar o evento. Se o horário estiver ocupado, fora do expediente, em dia não atendido ou se a agenda estiver desconectada, cria uma pendência para revisão; não escolhe outro horário silenciosamente.

### 2. Solicitar agendamento ao vendedor
Cria uma pendência no painel de automações. O vendedor abre o lead e usa o agendamento manual do card para escolher um horário. A pendência é concluída quando um compromisso é criado manualmente para aquele lead.

### 3. Criar compromisso usando data/hora do card
Lê os campos configurados na regra. O padrão é `appointmentDate` e `appointmentTime`; também pode ler campos personalizados do CRM.
- Data: `AAAA-MM-DD`
- Hora: `HH:mm`

Se os campos estiverem ausentes ou inválidos, a automação cria uma pendência em vez de inventar um horário.

## Aprovação e confirmação
- `Exigir aprovação do vendedor` impede a criação automática e gera pendência.
- `Enviar confirmação pelo WhatsApp` é opcional e desmarcado por padrão.
- A confirmação só é tentada depois que o evento existe.
- Antes de enviar, o service worker valida novamente as permissões compostas de WhatsApp e conformidade e o handler valida consentimento, Black list, expediente de silêncio e limites.
- O envio utiliza WhatsApp Web pela extensão; não utiliza a API oficial.

## Idempotência
Cada execução é identificada por regra, lead e ID da transição. Eventos criados recebem uma chave privada `i9HubEventKey` no Google Calendar. Isso reduz duplicações em repetição de mensagens/transições e em recuperação de uma tentativa.

## Persistência e escopo
- Regras: `chrome.storage.local`.
- Histórico de execuções: `chrome.storage.local`.
- Pendências: `chrome.storage.local`.
- Eventos: Google Calendar selecionado.
- Referência do evento no lead: armazenamento local do CRM.

Nesta fase, as regras e pendências não são sincronizadas com Google Drive, backend ou painel administrativo. Cada computador precisa ser configurado separadamente.

## Operação
Os gatilhos são executados quando a extensão recebe a mudança de etapa ou etiqueta. Se o navegador estiver fechado no momento da alteração, o evento não é reprocessado automaticamente ao abrir; o usuário deve provocar uma nova transição ou criar o compromisso manualmente.
