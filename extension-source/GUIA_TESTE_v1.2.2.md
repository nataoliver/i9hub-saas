# Guia de testes — i9Hub 1.2.2 (Fase 5)

## 1. Estado e filas
1. Abra o WhatsApp Web e conecte a sessão.
2. Abra o painel lateral do i9Hub e vá a **Execução → Central de Execução**.
3. Confira o estado da IA, do WhatsApp e das campanhas.
4. Verifique os contadores de mensagens na fila, eventos aguardando histórico e fichas aguardando sincronização.
5. Se um indicador não puder ser consultado, confirme que aparece como indisponível, não como zero.

## 2. Atividade da IA
1. Use um contato de teste autorizado e envie uma mensagem de entrada.
2. Aguarde o processamento e clique em **Atualizar agora**.
3. Confira se aparece um evento com status, horário, nome da personalidade, tipo de conversa e duração.
4. Confirme que o painel não exibe o texto da mensagem nem o telefone no evento de monitoramento.
5. Teste uma mensagem que não acione o gatilho de um grupo: deve aparecer como ignorada/gatilho não atendido, sem resposta enviada.

## 3. Erros e respostas pendentes
1. Se ocorrer uma falha real do provedor ou do envio, confira a lista **Erros e respostas pendentes**.
2. Confira se o motivo disponível está visível e se o painel não afirma que uma resposta foi enviada quando o WhatsApp não confirmou o envio.
3. Não provoque falhas de envio em contatos reais; use um ambiente de teste autorizado.

## 4. Desempenho por personalidade
1. Processe algumas mensagens de teste usando perfis diferentes.
2. Confira se cada evento aparece associado ao perfil realmente utilizado.
3. A taxa de resposta deve considerar tentativas de resposta (enviadas, pendentes e erros), não mensagens ignoradas.
4. Teste um perfil de networking: ele não deve incrementar a contagem de leads comerciais qualificados.
5. Teste um perfil de autoconhecimento: o monitor não deve registrar nicho ou classificação comercial para esse perfil.

## 5. Limite e retenção
- O monitor mantém até 500 eventos recentes localmente.
- A atividade mostra até 20 eventos; erros e pendências mostram até 10.
- O histórico não é sincronizado automaticamente entre dispositivos nesta fase.

## Resultado esperado
O painel ajuda a entender se a IA está ativa, se as filas estão avançando, quais mensagens foram respondidas ou ignoradas, quais erros ocorreram e como cada personalidade está se comportando. Faça a validação com mensagens autorizadas e confirme o funcionamento no Chrome real.
