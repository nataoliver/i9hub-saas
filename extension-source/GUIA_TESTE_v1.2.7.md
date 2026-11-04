# Guia de homologação — i9Hub v1.2.7

## Preparação

1. Faça backup da pasta da extensão atualmente instalada.
2. Instale a pasta extraída do `i9Hub-v1.2.7.zip` em `chrome://extensions` usando **Carregar sem compactação**.
3. Atualize o WhatsApp Web com F5 e abra o painel lateral do i9Hub.
4. Use uma licença de homologação que contenha `whatsapp.ai_support`, `crm.leads` e `ai.mode.observe_only`, ou a licença administrativa com acesso integral.
5. Configure a chave e o modelo do provedor de IA, teste a conexão e preencha empresa, instruções e base de conhecimento.

## Teste A — modo automático preservado

1. Selecione uma personalidade.
2. Em **Modo de operação da IA**, selecione **Atendimento automático**.
3. Salve e ative.
4. Envie uma mensagem de teste a partir de uma conta autorizada.
5. Confirme que o comportamento anterior continua respondendo conforme o prompt.

## Teste B — IA observadora

1. Selecione uma personalidade Comercial ou Networking.
2. Em **Modo de operação da IA**, selecione **Somente observação**.
3. Salve as configurações e ative a IA observadora.
4. Em uma conversa de teste, envie informações profissionais/comerciais como empresa, serviço procurado, necessidade, prazo e orçamento comercial.
5. Aguarde o processamento.
6. Abra o card correspondente no CRM.
7. Confirme que os campos estruturados foram atualizados e que a linha do tempo contém uma atividade **IA observadora atualizou informações do lead** quando houver mudança relevante.
8. Confirme que nenhuma mensagem foi enviada ao contato.

## Teste C — prova de não interação

Durante o modo observador, envie mensagens que normalmente acionariam:

- pedido de orçamento;
- pedido de atendimento humano;
- solicitação de compra/pedido;
- pergunta em grupo.

Resultado esperado:

- a IA pode analisar e registrar fatos no CRM;
- não responde ao contato;
- não envia aviso ao vendedor;
- não cria pedido;
- não cria handoff;
- não muda o estágio comercial;
- não envia mensagem de limite de frequência.

## Teste D — grupos

1. Selecione `groups_only` ou `both` em **Onde a IA pode atuar**.
2. Configure o escopo de grupos autorizados.
3. Ative a IA observadora.
4. Envie mensagens de teste em um grupo selecionado e outro não selecionado.
5. Confirme que somente os grupos autorizados são analisados.
6. Confirme que gatilhos de resposta (menção/resposta/palavra-chave) não bloqueiam a observação; o escopo e a seleção de grupos continuam valendo.

## Teste E — proteção por licença

1. Use uma licença sem `ai.mode.observe_only`.
2. Tente salvar uma personalidade em modo observador.
3. Resultado esperado: o service worker recusa com `FEATURE_NOT_INCLUDED` e informa o ID ausente.
4. Tente processar uma mensagem com modo observador e sem entitlement.
5. Resultado esperado: a análise é bloqueada; nenhuma mensagem de saída é enviada.

## Teste F — privacidade e histórico

1. Envie uma mensagem de teste que contenha um dado pessoal sensível irrelevante para a contratação.
2. Confirme que o prompt orienta a IA a ignorar esse dado e não registrá-lo no CRM.
3. Verifique que o evento de atividade do CRM contém apenas nomes dos campos atualizados, sem transcrição ou telefone.
4. Confirme que o histórico bruto no Google Sheets só é enviado se o recurso de histórico já estiver ativado pelo usuário.

## Teste G — monitoramento

1. Abra a Central de Execução.
2. Confirme que **Análises registradas no CRM** aumenta quando a observação atualiza um lead.
3. Confirme que **Respostas confirmadas** não aumenta no modo observador.
4. Confirme que o desempenho por personalidade identifica **IA observadora · sem envio**.

## Comandos automatizados

```bash
npm run check
npm test
npm run validate
```

## Critérios de aprovação

- Nenhuma mensagem de saída em modo observador, inclusive em erro de provedor, rate limit, pedido humano ou criação de pedido.
- CRM atualizado somente com informações estruturadas sustentadas pela conversa.
- Nenhuma alteração automática de estágio no modo observador.
- Histórico manual do vendedor preservado.
- Entitlement obrigatório validado no service worker.
- Modo automático anterior continua funcionando.
