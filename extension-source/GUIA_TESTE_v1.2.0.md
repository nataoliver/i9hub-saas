# Guia de teste manual — i9Hub 1.2.0

## 1. Preparação
1. Faça backup dos dados da extensão.
2. Atualize a pasta da extensão para a versão 1.2.0 em `chrome://extensions`.
3. Abra o WhatsApp Web e o painel do i9Hub.
4. Em **Chat com IA**, confirme que os perfis existentes e prompts foram preservados.

## 2. Personalidade por grupo
1. Entre em **Chat com IA → Grupos autorizados** e clique em **Atualizar grupos**.
2. Em um grupo de teste autorizado, selecione a caixa para permitir respostas.
3. Na coluna **Personalidade**, escolha um perfil diferente do global.
4. Clique em **Salvar regras de grupos** ou **Salvar configurações**.
5. Atualize o painel e confirme que o perfil continua selecionado.
6. Envie no grupo uma mensagem que satisfaça o gatilho configurado (menção, resposta à mensagem da IA, palavra-chave ou todas as mensagens).
7. Confirme que a resposta segue o prompt do perfil do grupo.
8. Teste outro grupo sem perfil específico e confirme que usa o perfil global.

## 3. Personalidade por campanha
1. Abra **Campanhas WhatsApp → Nova Campanha**.
2. Selecione uma personalidade em **Personalidade da IA para as respostas**.
3. Envie uma campanha de teste pequena para contatos que autorizaram a comunicação.
4. Confirme que o envio aparece como confirmado no relatório da campanha.
5. Quando um contato responder no privado, confirme que a IA usa o perfil escolhido na campanha.
6. Crie uma campanha sem perfil específico e confirme que ela usa a personalidade global.
7. Pause um rascunho/campanha elegível, edite o perfil e confirme que a alteração vale para envios futuros.

## 4. Expiração e fallback
- A atribuição privada deve valer por 30 dias a partir do envio confirmado.
- Após a expiração, o perfil global deve ser usado.
- Se o perfil atribuído for excluído, a resposta deve voltar ao perfil global sem travar o atendimento.

## 5. Google Drive
1. Salve as configurações e sincronize com o Drive.
2. Em outro dispositivo autorizado, restaure as preferências da IA.
3. Confira os perfis, as atribuições de grupo e os vínculos privados (armazenados por hash, não por número em texto aberto).

## 6. Regressão
- Teste modo privado/grupo/ambos.
- Teste todos os gatilhos globais de grupo.
- Teste pausa/ativação da IA, histórico, qualificação comercial e proteção de Black list.
- Confirme que o envio de campanha não ativa a IA automaticamente se ela estiver pausada.
