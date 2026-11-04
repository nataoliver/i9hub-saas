# Guia de homologação — i9Hub v1.0.0 / Fase 06

## 1. Preparação
- Faça backup da pasta atual da extensão.
- Atualize a extensão pela pasta extraída do ZIP em `chrome://extensions` (modo desenvolvedor → Carregar sem compactação ou Recarregar).
- Confirme que o ID da extensão não mudou.
- No Google Cloud do OAuth Client ID já usado pelo i9Hub, habilite **Google Calendar API**.
- Na tela de consentimento OAuth, adicione:
  - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
  - `https://www.googleapis.com/auth/calendar.freebusy`
  - `https://www.googleapis.com/auth/calendar.events`
- Se o app OAuth estiver em modo de teste, inclua a conta Google de homologação como usuário de teste.

## 2. Conectar
1. Abra Configurações → Google Agenda.
2. Clique em **Conectar Google Agenda**.
3. Autorize a permissão de origem solicitada pelo Chrome.
4. Autorize os escopos na tela do Google.
5. Confirme que a lista de agendas aparece.
6. Selecione uma agenda em que a conta tenha permissão `owner` ou `writer`.
7. Salve as preferências.

Resultado esperado: status conectado, agenda selecionada, fuso local e preferências salvas.

## 3. Disponibilidade
1. Abra um lead com telefone e nome.
2. No card, abra Google Agenda.
3. Escolha uma data futura dentro de um dia de atendimento.
4. Clique em **Consultar horários livres**.
5. Compare os horários sugeridos com a agenda Google aberta em outra aba.
6. Crie um evento de teste em outro dispositivo/aba durante a consulta e tente reservar o mesmo intervalo.

Resultado esperado: horários ocupados não aparecem; a reserva revalida FreeBusy e recusa o horário que acabou de ficar ocupado.

## 4. Criar evento
1. Selecione um horário livre.
2. Edite o título e a observação.
3. Opcionalmente marque o convite por e-mail do lead.
4. Confirme a reserva.
5. Verifique o evento no Google Calendar.

Resultado esperado: título, descrição, data, hora, lembretes e propriedades privadas do i9Hub aparecem. O e-mail do lead só deve ser convidado se a caixa tiver sido marcada.

## 5. Confirmação pelo WhatsApp
Pré-requisitos: licença com `google.calendar.booking`, `whatsapp.connection`, `compliance.consent_tracking`, `compliance.optout_management` e `compliance.frequency_limits`; WhatsApp Web conectado; lead com consentimento geral `opted_in`; contato fora da Black list; horário permitido.

1. Em um novo evento, marque **Enviar confirmação pelo WhatsApp após reservar** ou use **Enviar confirmação** no evento existente.
2. Confirme o envio.
3. Verifique a mensagem no WhatsApp Web e o registro no histórico do lead.
4. Repita com contato sem consentimento, na Black list e durante horário de silêncio.

Resultado esperado: apenas o contato autorizado recebe a mensagem. Nos demais casos, o evento continua reservado e a confirmação é bloqueada com motivo explícito. O envio é feito pela extensão no WhatsApp Web, sem API oficial.

## 6. Reagendar e cancelar
- Reagende para um horário livre e confirme no Google Calendar.
- Tente reagendar para um horário ocupado; a operação deve ser recusada.
- Cancele um evento; confirme que o evento foi cancelado no Google Calendar.
- Se o evento teve convite por e-mail, verifique se o Google envia a atualização/cancelamento aos participantes.

## 7. Sincronização de dados do lead
1. Crie um compromisso.
2. Edite manualmente o nome, telefone, empresa ou e-mail do lead.
3. Salve.
4. Confira se a descrição do evento foi atualizada.
5. Desconecte o Google ou bloqueie temporariamente a rede e edite outro campo.
6. Reconecte e use **Sincronizar dados** no compromisso pendente.

Resultado esperado: a edição do lead não é perdida se a agenda estiver indisponível; a atualização fica marcada como pendente e pode ser repetida.

## 8. Regressão
- Teste Google Drive e Google Sheets; a integração de Sheets deve continuar solicitando explicitamente somente o escopo de planilhas.
- Teste ativação de licença e os módulos de IA, CRM, follow-up e WhatsApp.
- Confirme que `google.calendar.automation` continua bloqueado (Fase 07).
- Execute `npm run validate`.

## 9. Limites conhecidos
- Os metadados do evento vinculados ao lead ficam no armazenamento local da extensão; o evento em si fica na conta Google.
- A integração usa o fuso horário local do navegador.
- O Chrome precisa estar aberto para operar a extensão. Para enviar confirmação WhatsApp, WhatsApp Web também precisa estar conectado.
- Desconectar no i9Hub remove o token de acesso em cache, mas não apaga eventos nem necessariamente revoga o consentimento OAuth da Conta Google.
