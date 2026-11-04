# Guia de homologação — Fase 13 / i9Hub v1.9.0

## Pré-requisitos
- Atualizar a extensão mantendo o mesmo ID.
- Licença válida com `crm.leads` e `whatsapp.connection` para testar WhatsApp.
- Para e-mail, licença com `crm.leads` e `crm.communication.email`.
- Gmail API habilitada no projeto Google Cloud do OAuth Client ID da extensão.
- Escopo `https://www.googleapis.com/auth/gmail.send` configurado na tela de consentimento OAuth. Se o app estiver em modo de teste, adicionar a conta como usuário de teste.
- Usar leads fictícios ou de homologação e um endereço de e-mail interno autorizado.

## A — WhatsApp pelo card
1. Abra WhatsApp Web e conecte a sessão.
2. Abra o i9Hub → CRM → Kanban.
3. Localize um lead com telefone válido.
4. Clique em **WhatsApp** no card.
5. Confirme que a aba/janela do WhatsApp fica em primeiro plano e abre a conversa correta.
6. Confirme que nenhuma mensagem foi enviada automaticamente.
7. Abra o lead e confira o evento **Conversa aberta no WhatsApp** no histórico.
8. Repita na visualização Tabela e no detalhe do lead.
9. Teste lead sem telefone e telefone inválido: a extensão deve bloquear a abertura.
10. Feche a sessão WhatsApp e clique novamente: a extensão deve abrir/reutilizar o WhatsApp Web e orientar a leitura do QR code.

## B — Conectar Gmail
1. Abra um lead com e-mail.
2. Clique no botão de e-mail.
3. Clique em **Conectar Gmail**.
4. Autorize a permissão opcional de host e a autorização Google solicitada pelo Chrome.
5. Confirme que a interface informa Gmail conectado.
6. Não deve ser solicitado acesso de leitura da caixa de entrada.

## C — Enviar e-mail
1. Selecione o modelo **Primeiro contato**.
2. Confira a substituição de `{{nome}}`, `{{empresa}}`, `{{produto}}` e `{{vendedor}}`.
3. Edite destinatário, assunto e corpo.
4. Marque a confirmação de autorização do contato.
5. Envie para um endereço interno de teste.
6. Confira a pasta Enviados do Gmail.
7. Confira o evento **E-mail enviado** no histórico do lead.
8. Confirme que o histórico guarda destinatário, assunto, status e ID do Gmail, mas não o corpo da mensagem.
9. Salve um modelo personalizado e confirme que ele aparece ao reabrir o editor no mesmo perfil Chrome.

## D — Proteções e falhas
1. Desmarque a confirmação de autorização: o envio deve ser bloqueado.
2. Defina `emailOptedOut=true` ou `emailConsentStatus='opted_out'` em lead de teste: o envio deve ser bloqueado.
3. Dê duplo clique no botão Enviar: não deve disparar duas chamadas com a mesma tentativa.
4. Simule erro de rede/servidor: o resultado deve ficar incerto e orientar verificar Enviados antes de reenviar.
5. Remova a permissão Gmail no Chrome e tente enviar: a extensão deve pedir nova conexão.
6. Desconecte Gmail e confira que o estado local fica desconectado.

## E — Licença e painel
1. Teste `OPEN_CRM_LEAD_CHAT` com `crm.leads` + `whatsapp.connection`.
2. Remova `whatsapp.connection`: abertura deve ser bloqueada.
3. Teste `SEND_CRM_EMAIL` com `crm.leads` + `crm.communication.email`.
4. Remova `crm.communication.email`: envio e conexão Gmail devem ser bloqueados.
5. Atualize o catálogo do painel para v13 antes de distribuir o entitlement aos planos comerciais.
