# Especificação futura — Conversas aguardando resposta

**Status:** especificação para uma implementação futura. O recurso fica desativado/removido da interface da extensão v1.0.4. Este documento não autoriza reintroduzir o recurso nesta versão.

## 1. Objetivo

Exibir, no dashboard do i9Hub, conversas privadas do WhatsApp em que a última mensagem recebida do contato seja posterior à última mensagem enviada pela empresa, ajudando o usuário a identificar conversas que podem precisar de retorno.

## 2. Escopo funcional esperado

- Considerar apenas conversas privadas/individuais do WhatsApp.
- Excluir grupos, listas de transmissão quando identificáveis como tais, contatos bloqueados/blacklist e registros classificados como spam.
- Usar evidências temporais das mensagens recebidas e enviadas, inclusive mensagens anteriores à instalação da extensão quando o WhatsApp disponibilizar esse histórico.
- Não usar a quantidade de mensagens não lidas, isoladamente, como prova de que uma resposta é necessária.
- Ordenar os resultados de forma consistente pela data da última mensagem recebida, priorizando as conversas mais antigas que ainda aguardam retorno.
- Limitar a quantidade apresentada e definir paginação/carregamento incremental se necessário, sem bloquear o restante do dashboard.
- Permitir abrir a conversa correspondente no WhatsApp Web apenas quando houver identificador/telefone validado e uma sessão disponível.

## 3. Regra de classificação

Uma conversa pode ser classificada como aguardando resposta quando:

1. for uma conversa privada válida e não estiver excluída por blacklist/spam;
2. existir evidência confiável de uma mensagem recebida;
3. não existir mensagem enviada posterior ou igual à última mensagem recebida.

Se as datas estiverem ausentes, inválidas ou forem insuficientes para concluir o estado, a conversa deve ser tratada como **indeterminada**, e não como respondida nem como pendência confirmada. Se não houver mensagem enviada registrada, uma mensagem recebida válida pode ser apresentada como pendente, identificando internamente que a evidência de saída está ausente.

## 4. Sincronização e histórico

- A leitura do histórico deve ser incremental, tolerante a falhas e não bloquear o dashboard.
- O processamento deve contemplar mensagens de texto e mensagens recebidas sem texto, como áudio, imagem, vídeo, documento e sticker, desde que exista evidência confiável de data e direção da mensagem.
- A implementação futura deve distinguir claramente: histórico ainda não processado; nenhuma conversa privada encontrada; histórico processado sem pendências; e conversas pendentes encontradas.
- Nunca exibir “Tudo em dia” quando o histórico necessário ainda não tiver sido verificado.
- Uma falha ou timeout deve ser comunicado como estado inconclusivo, sem apresentar uma sincronização incompleta como concluída.
- Atualizações devem ocorrer após a persistência dos dados, com eventos/broadcasts que permitam atualizar a interface sem polling excessivo.
- A sincronização de oportunidades usada pelo CRM é compartilhada e não deve ser removida ou alterada apenas para implementar este recurso.

## 5. Interface futura

A seção, quando aprovada para uma versão futura, deverá conter:

- título “Conversas aguardando resposta”;
- lista com nome/identificação do contato, telefone quando disponível, horário da última mensagem recebida e ação para abrir a conversa;
- estados visuais distintos para carregamento, histórico incompleto, lista vazia confirmada, erro/timeout e resultados;
- ação explícita de sincronização somente se for confiável, com proteção contra cliques repetidos, feedback de progresso e tratamento de erros;
- layout responsivo e integração com o dashboard sem alterar outras áreas ou a divisão de janelas 90/10.

## 6. Segurança e privacidade

- Validar e normalizar telefone e identificador da conversa antes de abrir uma conversa.
- Não inferir ou fabricar telefone, nome, data ou estado de resposta quando os dados não forem confiáveis.
- Não enviar conteúdo de mensagens para telemetria. A telemetria deve ser agregada e limitada a eventos necessários.
- Respeitar os controles de licença/permissão já definidos pelo catálogo existente; qualquer mudança de permissão exige trabalho separado e revisão explícita.

## 7. Critérios de aceite para uma versão futura

1. Uma mensagem recebida mais recente que a última enviada gera uma pendência.
2. Uma mensagem enviada posterior ou no mesmo instante elimina a pendência.
3. Grupos, blacklist e spam não aparecem na lista.
4. Mensagens antigas anteriores à instalação são consideradas quando o histórico está disponível.
5. Áudio, mídia e stickers recebidos podem contar como mensagens quando há evidência confiável.
6. Ausência de histórico não é apresentada como lista vazia confirmada.
7. Datas ausentes/inválidas não geram classificação falsa.
8. Abrir conversa funciona apenas com destino validado e sessão disponível, com erro compreensível quando isso não for possível.
9. A interface permanece responsiva durante sincronização e recupera-se de timeout/falha sem afirmar sucesso indevido.
10. Testes automatizados cobrem classificação, histórico parcial, deduplicação, ordenação, exclusões e estados de interface.
11. Testes de regressão confirmam que CRM, campanhas, contatos, mapas, atendimento por IA, botão “Abrir WhatsApp” e layout 90/10 permanecem inalterados.

## 8. Fora do escopo da v1.0.4

- Corrigir ou reconstruir a sincronização.
- Alterar backend remoto, painel de licenciamento, catálogo de funcionalidades ou permissões.
- Alterar CRM, campanhas, contatos, mapas, atendimento por IA, botão “Abrir WhatsApp”, navegação, cores ou layout geral.
- Reintroduzir a seção ou o botão de sincronização no dashboard desta versão.
