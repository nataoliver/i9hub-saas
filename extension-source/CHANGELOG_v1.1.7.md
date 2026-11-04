# i9Hub 1.1.7 — Controle de respostas da IA em grupos

## Novidades
- Seletor de abrangência: todos os grupos, somente grupos selecionados ou todos exceto os grupos selecionados.
- Botão para carregar a lista real de grupos disponíveis no WhatsApp Web conectado.
- Pesquisa de grupos, seleção múltipla, marcar os resultados visíveis e limpar a seleção.
- Gatilhos de resposta: todas as mensagens, somente menções, somente respostas à própria IA, menção ou resposta, e palavras-chave.
- Campo de palavras-chave com separação por vírgula, ponto e vírgula ou nova linha.
- Botão independente para salvar regras de grupos sem exigir novo teste da chave API.
- Verificação dos grupos permitidos e gatilhos no service worker, antes da geração de resposta.
- Estados de execução para grupo não selecionado, grupo excluído, gatilho não atendido e palavras-chave ausentes.
- Configurações de grupo preservadas no backup/sincronização das preferências da IA.

## Regras de segurança
- O modo “Somente grupos selecionados” não responde a nenhum grupo se a lista estiver vazia.
- A opção “responder à mensagem da IA” exige evidência de que a mensagem citada corresponde à resposta anterior do próprio assistente naquele grupo.
- O modo por palavras-chave não funciona sem pelo menos uma palavra-chave configurada.
- A lista de grupos precisa ser carregada do WhatsApp Web; a interface não inventa grupos.

## Validação
- Verificação de sintaxe do manifesto e scripts concluída.
- 195 testes automatizados aprovados.
- Ainda é necessária validação manual no Chrome/WhatsApp Web conectado, especialmente para confirmar a leitura da lista de grupos e o reconhecimento de menções/respostas na versão atual do WhatsApp.
