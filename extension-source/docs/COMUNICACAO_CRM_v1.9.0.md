# Central de Comunicação do CRM — Fase 13

## Abrir WhatsApp
A ação usa o telefone atual persistido no lead, valida o número e abre a conversa pela ponte local do WhatsApp Web. Se o WhatsApp não estiver conectado, a extensão abre/reutiliza a aba e orienta o usuário a conectar a sessão. Abrir a conversa não envia uma mensagem. O evento de abertura é registrado no histórico.

## Enviar Gmail
O envio ocorre pelo endpoint Gmail API `users.messages.send`, com escopo OAuth `gmail.send`. O usuário conecta a conta pelo botão no editor e autoriza a permissão de host opcional do Gmail. O Chrome Identity administra o token; a extensão não o grava em seu storage.

## Modelos
Modelos padrão: Primeiro contato, Envio de proposta e Acompanhamento. Modelos personalizados ficam no perfil Chrome local. Variáveis suportadas: `{{nome}}`, `{{empresa}}`, `{{produto}}`, `{{vendedor}}`.

## Histórico
- WhatsApp: `communication.whatsapp.opened`.
- E-mail enviado: `communication.email.sent`.
- Falha/resultado incerto: `communication.email.failed`.

O corpo do e-mail não é armazenado. A atividade contém o canal, destinatário, assunto, estado, identificador da mensagem quando fornecido pelo Gmail e data/hora.

## Controles
- Envio iniciado manualmente pelo usuário.
- Confirmação de autorização obrigatória no editor.
- Descadastro explícito de e-mail (`emailOptedOut` ou `emailConsentStatus='opted_out'`) bloqueia o envio.
- Request ID reduz duplicidade por duplo clique/repetição da mesma solicitação.
- Falhas de rede/servidor são marcadas como incertas e exigem conferência da pasta Enviados.

## Fora do escopo desta versão
Anexos, Outlook/Microsoft 365, sincronização de respostas recebidas, gestão visual de descadastro de e-mail, assinatura por vendedor, múltiplas contas Gmail selecionáveis e indicadores por canal.
