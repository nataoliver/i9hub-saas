# i9Hub 1.0.9 — Correção da leitura de mensagens do Chat com IA

## Problema
A IA não lia as mensagens recebidas no privado. A sincronização de leads funcionava (usa o Store interno
do WhatsApp Web), mas a leitura para a IA dependia só do HTML da página (`.message-in`, `#pane-side`),
que o WhatsApp muda com frequência. A resposta também exigia que a conversa estivesse aberta na tela.
O painel mostrava "IA ATIVA" em verde mesmo quando as mensagens eram descartadas.

## Correções
1. **Leitura pelo Store interno** (`content/injected.js`): novo monitor que captura mensagens recebidas
   (evento `Msg add` + varredura de reserva a cada 2,5 s), no privado e em grupos, com remetente, menção e
   mensagem citada. Ignora mensagens próprias, notificações, status/broadcast, mídia sem legenda e mensagens
   anteriores ao carregamento da extensão (janela de 10 min).
2. **Resposta pelo ID da conversa**: `AI_SEND_REPLY` envia pelo Store usando `chatId`, sem depender de qual chat
   está aberto. Se o Store não achar a conversa, cai no método anterior (por tela), sem risco de envio duplicado.
3. **Sem resposta duplicada**: enquanto o monitor do Store está ativo (sinal a cada 5 s), a leitura por DOM fica
   desligada. Se o Store ficar indisponível, o DOM volta a funcionar como alternativa. O service worker também
   descarta o mesmo texto da mesma conversa/remetente recebido em até 20 s por dois caminhos.
4. **Painel mostra o motivo real**: a última mensagem recebida aparece com o resultado (respondida, ignorada por
   modo privado/grupo, painel fechado, configuração incompleta, limite, etc.). O banner deixa de ficar verde quando
   a última mensagem não foi respondida por um problema. Novas linhas de diagnóstico: "Leitura de mensagens" e
   "Última mensagem". Se faltarem nome da empresa, instruções ou base de conhecimento, o painel avisa.
5. **Sinal de vida do painel**: validade aumentada de 45 s para 120 s. Abas em segundo plano têm timers reduzidos
   pelo Chrome (~1/min) e o painel era dado como fechado por engano.
6. Consentimento (QUERO/SAIR) continua sendo registrado também para mensagens lidas pelo Store.

## Segurança
- `AI_STORE_STATUS` foi adicionado ao `message-gate` apenas como evento passivo do WhatsApp Web.
- O `content.js` valida e limita cada campo do payload do Store antes de enviar ao service worker e só aceita IDs
  iniciados por `store_`. A mensagem do Store chega por `window.postMessage` (mundo MAIN), o mesmo canal já usado
  pela sincronização de leads; o filtro de modo (privado/grupo), a licença e o sinal de vida continuam sendo
  verificados no service worker.

## Atualização
Depois de recarregar a extensão em `chrome://extensions`, **atualize a aba do WhatsApp Web (F5)** para que os
scripts novos sejam injetados. Confira em Chat com IA → "7. Diagnóstico": "Leitura de mensagens: Store interno ativo".
Conversas existentes mantêm o histórico (o identificador interno do chat é calculado como antes).

## Testes
`npm run validate` — inclui `test/ai-store-watcher-v1.0.9.test.js` (executa o `injected.js` real com um Store
simulado) e `test/ai-store-bridge-v1.0.9.test.js` (executa o `content.js` real com a API do Chrome simulada).

## Limitações conhecidas
- O Store é uma API interna do WhatsApp Web: nomes de módulos podem mudar. O código já cai para a leitura por
  tela quando o Store some, e o painel informa qual leitor está ativo.
- Não testado contra um WhatsApp Web real neste ambiente.
