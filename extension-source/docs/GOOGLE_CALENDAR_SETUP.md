# Configuração do Google Agenda — i9Hub

## Google Cloud

1. Acesse o projeto Google Cloud vinculado ao OAuth Client ID já utilizado pelo i9Hub.
2. Em **APIs e serviços → Biblioteca**, habilite **Google Calendar API**.
3. Em **Tela de consentimento OAuth → Acesso aos dados**, adicione os escopos:
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
   - `https://www.googleapis.com/auth/calendar.freebusy`
   - `https://www.googleapis.com/auth/calendar.events`
4. Preserve o OAuth Client ID existente e o ID da extensão Chrome. Não crie outro cliente sem necessidade.
5. Se o consentimento estiver em modo de teste, inclua a conta que será usada para homologação na lista de usuários de teste.
6. Verifique se o estado de publicação e a verificação OAuth do projeto permitem os escopos sensíveis solicitados. A Google pode exigir configuração ou verificação adicional antes de liberar o app para todos os usuários.

## Na extensão

1. Abra **Configurações → Google Agenda**.
2. Clique em **Conectar Google Agenda**.
3. Autorize a origem `https://www.googleapis.com/*` no Chrome.
4. Autorize o acesso solicitado na tela do Google.
5. Selecione uma agenda em que a conta tenha permissão de edição (`owner` ou `writer`).
6. Configure expediente, dias de atendimento, duração padrão, intervalo e lembrete.
7. Salve as preferências.

O i9Hub usa `chrome.identity.getAuthToken`; a senha Google não é solicitada nem armazenada pela extensão. Os tokens são gerenciados pelo Chrome.

## Dados gravados no evento

A descrição do evento pode conter nome, empresa, telefone, e-mail, serviço de interesse, nicho, estágio, etiquetas e observação fornecida no agendamento. Revise essa informação antes de criar compromissos se o calendário for compartilhado com outras pessoas.

O convite por e-mail do lead é opcional e só é enviado quando a caixa de convite é marcada no card do CRM. Os lembretes popup são configurados no próprio evento do Google Calendar.

## Confirmação pelo WhatsApp

A confirmação usa o WhatsApp Web aberto localmente pela extensão, sem WhatsApp Business Platform/Cloud API. Ela só é enviada se o usuário marcar a opção ao reservar ou clicar em **Enviar confirmação**, se o contato tiver consentimento geral `opted_in`, não estiver na Black list/spam e os limites/horário de silêncio permitirem. Se o envio falhar, o compromisso continua na agenda e o status da confirmação fica registrado no card.

## Desconectar e revogar

O botão **Desconectar** no i9Hub remove o token Calendar do cache do Chrome e desativa a conexão local. Ele não apaga compromissos existentes. Para revogar integralmente o acesso concedido ao aplicativo, remova a autorização do i9Hub nas configurações de segurança/conexões de terceiros da sua Conta Google.

## Fuso horário e armazenamento

A data e a hora selecionadas são interpretadas no fuso horário local do navegador e esse fuso é enviado ao Google Calendar. As preferências e o vínculo local entre lead e evento ficam no perfil Chrome deste dispositivo; os eventos permanecem na conta Google. Sincronização do vínculo CRM entre dispositivos não está incluída nesta fase.

## Fora do escopo desta fase

A criação automática de eventos por mudança de estágio ou etiqueta do CRM pertence à Fase 07 (`google.calendar.automation`) e permanece bloqueada nesta versão.
