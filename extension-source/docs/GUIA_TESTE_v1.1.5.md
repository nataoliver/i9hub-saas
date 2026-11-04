# Guia de teste manual — i9Hub 1.1.5

## Antes do teste
- Faça backup da extensão e use uma campanha pequena de teste.
- Confirme que o CRM contém os leads usados e que as conversas foram sincronizadas.

## Relatório atual
1. Abra **Campanhas WhatsApp** e clique em **Relatório**.
2. Confira selecionados, enviados, falhas, ignorados e pendentes contra os dados da campanha.
3. Confirme que a taxa de resposta usa respostas identificadas divididas pelos envios.
4. Confirme que leads qualificados e quentes refletem os critérios atuais do Lead Score.
5. Verifique o agrupamento por nicho/subnicho e as listas individuais.
6. Clique em **Atualizar agora** depois de sincronizar novas conversas; confirme que os números são recalculados.

## PDF
1. Clique em **Exportar PDF**.
2. Na janela de impressão, escolha **Salvar como PDF**.
3. Confira se as tabelas e as listas estão legíveis e se os números coincidem com o painel.

## Marcos 24h/48h
- Os botões de registro manual ficam habilitados depois de completar o prazo contado de `finishedAt`.
- Para testar sem esperar, em ambiente de teste, crie snapshots de fixture ou teste a função de cálculo em Node; não altere os relógios do computador usado em produção.
- Em execução real, confirme que a campanha concluída tem alarmes `i9-campaign-report:<id>:<ciclo>:24h` e `...:48h` em `chrome://extensions` → serviço de worker → DevTools → Application/Console, conforme suporte do Chrome.
- Após 24h/48h, confira que o histórico mostra o marco com data e métricas agregadas.

## Precisão dos dados
- Contatos sem registro no CRM devem aparecer como dados insuficientes, não como resposta confirmada.
- Para campanhas antigas, os registros podem não ter a data individual de cada envio; nesses casos, o relatório sinaliza a limitação.
- O snapshot automático não percorre o WhatsApp para coletar novas mensagens. Sincronize as conversas antes de atualizar manualmente.
