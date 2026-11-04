# i9Hub 1.1.2 — Central de Execução visual

## Novidades
- Novo menu **Execução** no menu lateral.
- Cartões de estado do Chat com IA e WhatsApp Web, com estados explícitos: ativo, pausado, aguardando conexão, erro ou desconhecido.
- Monitoramento das campanhas: progresso, enviados, pendentes, falhas, ignorados, lotes configurados e horário/contagem regressiva para o próximo lote.
- Indicadores separados para mensagens recebidas em processamento, eventos aguardando histórico e fichas aguardando sincronização com o CRM.
- Exibição da última mensagem processada pela IA e de diagnósticos relevantes.
- Atualização automática a cada 5 segundos e atualização imediata ao receber eventos de campanha.
- Resumo de operação no Dashboard, com acesso rápido à Central de Execução.
- O status da IA expõe a contagem real de mensagens de entrada que estão aguardando/em processamento no service worker.

## Observações
- A fila de histórico do Google Sheets e a fila de sincronização de fichas são exibidas separadamente da fila de mensagens recebidas.
- Se um endpoint de estado falhar, o painel mostra o estado como desconhecido e não assume zero.
- O monitoramento visual não elimina a dependência do Chrome, da sessão conectada do WhatsApp Web e do painel lateral para o atendimento por IA.

## Validação
- Sintaxe e imports verificados com `npm run check`.
- Testes automatizados executados com `npm test`.
- O funcionamento real precisa ser confirmado no Chrome/WhatsApp Web do usuário, pois depende da sessão ativa e da interface externa.
