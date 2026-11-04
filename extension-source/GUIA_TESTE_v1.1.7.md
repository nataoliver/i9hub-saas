# Guia de teste manual — i9Hub 1.1.7

## 1. Lista de grupos
1. Abra WhatsApp Web e confirme que os grupos estão carregados.
2. Abra Chat com IA e clique em “Atualizar grupos”.
3. Confirme que os nomes listados correspondem aos grupos reais disponíveis.
4. Pesquise por um grupo, marque-o e confirme que a contagem de selecionados muda.
5. Recarregue o painel, atualize a lista novamente e confirme que a seleção salva permanece marcada.

## 2. Abrangência
1. Configure “Somente grupos selecionados” e marque apenas um grupo de teste.
2. Envie uma mensagem sem menção no grupo selecionado usando o gatilho por menção/resposta; a IA não deve responder.
3. Mencione a conta da IA no grupo selecionado; a IA pode responder conforme o contexto e o restante das configurações.
4. Repita em outro grupo não selecionado; a IA não deve responder.
5. Teste “Todos os grupos” e “Todos, exceto os grupos selecionados” com mensagens de teste autorizadas.

## 3. Gatilhos
- **Menção:** a IA só deve responder quando a conta conectada for mencionada.
- **Resposta à IA:** responda diretamente a uma mensagem anterior da própria IA; respostas a mensagens de outras pessoas não devem acionar esse modo.
- **Menção ou resposta:** qualquer uma das duas condições pode acionar a IA.
- **Todas as mensagens:** qualquer mensagem textual recebida em grupo permitido pode acionar a IA; use com cautela.
- **Palavras-chave:** somente mensagens contendo uma das expressões cadastradas devem acionar a IA. Sem expressões, o sistema deve bloquear o gatilho.

## 4. Persistência
1. Altere abrangência, seleção, gatilho e palavras-chave.
2. Clique em “Salvar regras de grupos”.
3. Reabra Chat com IA e confirme que as opções permanecem salvas.
4. Se o Google Drive estiver configurado, confirme que as preferências são incluídas na sincronização.

## 5. Diagnóstico
No menu Execução, confira os motivos “Grupo não autorizado”, “Grupo excluído da seleção”, “Gatilho do grupo não atendido” e “Palavras-chave não configuradas” quando aplicável.

A validação automatizada não substitui este teste manual em uma sessão real do WhatsApp Web.
