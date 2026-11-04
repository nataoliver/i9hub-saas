# Guia de testes manuais — i9Hub v1.2.3

## A. Fila durável
1. Com WhatsApp Web conectado e Chat com IA ativo, receba uma mensagem em uma conversa autorizada.
2. Abra Execução > Central de Execução e confira que a fila de entrada oscila durante o processamento e retorna a zero quando concluído.
3. Envie duas mensagens seguidas; confirme que são processadas em ordem e que a mesma mensagem não recebe duas respostas.
4. Pause/feche o painel temporariamente e confirme que mensagens já enfileiradas não são descartadas enquanto aguardam o heartbeat. Reabra o painel e confirme retomada.
5. Não simule falhas que possam enviar mensagens reais para terceiros sem consentimento; use um contato de teste controlado.

## B. Revisão segura após reinício
1. Se ocorrer um reinício real durante o processamento, abra a Central de Execução.
2. Confira o contador “Mensagens para revisão”.
3. Abra a conversa no WhatsApp Web e confirme manualmente se houve resposta. O i9Hub não deve repetir automaticamente a mensagem com resultado incerto.

## C. Memória contextual
1. Em um perfil Networking, informe espontaneamente profissão, empresa e nicho.
2. Após a resposta, verifique a contagem de contatos com memória profissional.
3. Envie uma nova mensagem no mesmo contato; confirme que a IA usa os fatos profissionais sem repetir perguntas já respondidas.
4. No perfil Autoconhecimento, não devem ser guardados fatos pessoais na memória estruturada.
5. Confirme que a memória não inclui telefone nem transcrição bruta.

## D. Conflito entre dispositivos
1. No dispositivo A, atualize uma instrução e salve.
2. No dispositivo B, atualize uma informação profissional de um contato de teste e sincronize o Drive.
3. Execute a mesclagem nos dois dispositivos. Confirme que os prompts mais recentes não são substituídos por versões antigas e que memórias de contatos distintos são preservadas.

## E. Validação técnica
- `npm run check` — manifesto, sintaxe e imports locais.
- `npm test` — suíte automatizada.
- `npm run validate` — ambas as verificações.

Os testes automatizados não comprovam por si só o comportamento real no WhatsApp Web. Confirme manualmente os itens acima antes de ativar a IA em grupos ou campanhas maiores.
