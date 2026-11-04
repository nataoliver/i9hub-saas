# Guia de teste manual — i9Hub 1.1.8

## 1. Salvar as configurações da IA

1. Abra **Chat com IA**.
2. Altere os campos “Instruções do atendente”, “Produtos, serviços, preços e perguntas frequentes” ou “Mensagem inicial”.
3. Verifique se o indicador informa que há alterações não salvas.
4. Clique em **Salvar configurações**.
5. Confirme que o indicador informa que as configurações foram salvas localmente.
6. Altere uma regra de grupo e use “Salvar regras de grupos”; confirme que o mesmo fluxo salva todas as configurações, não apenas a seleção de grupos.

## 2. Sincronização com o Google Drive

1. Em **Configurações > Dados**, confirme que o backup do Google Drive está conectado.
2. Edite um prompt e clique em **Salvar configurações**.
3. Confirme a mensagem de sincronização com o Drive.
4. Se houver uma campanha em andamento ou falha de rede, confirme que o painel informa que o salvamento local foi concluído e que a sincronização precisa ser retomada.

## 3. Histórico sem perda dos prompts

1. Edite o prompt sem salvar.
2. Clique em “Sincronizar pendentes”. A extensão deve salvar primeiro o rascunho e depois sincronizar o histórico.
3. Confira que os campos continuam preenchidos com o mesmo texto e que a interface não volta a um prompt anterior.
4. Repita para “Criar / conectar histórico” e “Ativar registro”/“Pausar registro”.
5. Confira na planilha se as mensagens pendentes foram enviadas e se o histórico continua ligado à planilha correta.

## 4. Mesclagem entre dispositivos

1. No computador A, salve um prompt novo.
2. No computador B, conecte o Drive e sincronize o histórico.
3. Faça a sincronização entre dispositivos e confirme que o prompt mais recente e a conexão da planilha de histórico permanecem presentes.
4. Lembre-se de que a IA precisa ser testada e ativada localmente; a sincronização não deve ativar respostas automaticamente em um computador novo.

## 5. Segurança e regressão

- Confirme que as chaves de API não aparecem no JSON aberto do backup.
- Confirme que a senha de sincronização não é enviada ao Drive.
- Confirme que seleção de grupos, gatilhos, rodízio de provedores, critérios de qualificação e status da IA continuam funcionando.
- Validação automatizada: `npm run validate`.
