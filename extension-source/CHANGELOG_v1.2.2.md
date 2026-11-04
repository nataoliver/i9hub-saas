# i9Hub 1.2.2 — Fase 5: monitoramento operacional da IA

## Novidades
- Registro local de eventos do Chat com IA: resposta enviada, resposta pendente, erro, pausa, gatilho não atendido, duplicidade e outros resultados do processamento.
- O registro de monitoramento guarda apenas metadados: horário, status, personalidade, tipo/nome da conversa, provedor/modelo, duração, classificação, nicho e erro resumido. Não guarda o texto bruto da mensagem nem o telefone.
- Histórico limitado aos 500 eventos mais recentes, com deduplicação por identificador técnico da mensagem.
- Central de Execução com métricas de respostas confirmadas, erros, classificações e leads qualificados, além das filas já existentes.
- Comparativo por personalidade com total de eventos, respostas, taxa de resposta sobre tentativas, erros, pendências, classificações, qualificados e principais nichos identificados.
- Lista de atividade recente e painel de erros/respostas pendentes, com horário, conversa, personalidade e motivo disponível.
- Status da IA continua exibindo filas de entrada, histórico e sincronização de fichas; valores desconhecidos não são tratados como zero.
- Versões do manifesto, pacote e pontes do WhatsApp atualizadas para 1.2.2.

## Regras de interpretação
- “Resposta confirmada” significa que o envio foi confirmado pela ponte do WhatsApp Web; não garante leitura ou resposta do contato.
- A taxa por personalidade considera somente tentativas de resposta (enviadas, pendentes e erros), não todas as mensagens ignoradas por gatilhos.
- “Qualificado” é contado somente para o perfil comercial e quando os critérios/limiar configurados são atendidos. Networking não vira qualificação comercial.
- O perfil de autoconhecimento não registra nichos nem classificações comerciais no monitoramento.
- Os indicadores são calculados a partir dos últimos 500 eventos locais; não são um histórico ilimitado nem sincronizado automaticamente entre computadores.
- O painel não exibe o conteúdo das mensagens; o nome da conversa pode aparecer para facilitar diagnóstico.

## Validação
- `npm run validate` verifica manifesto, sintaxe, imports locais e suíte automatizada.
- Testes cobrem agregação de métricas, limite de retenção, isolamento do perfil de autoconhecimento, ausência de conteúdo/telefone no evento e integração com a Central de Execução.
- A validação automatizada não substitui o teste manual no Chrome com WhatsApp Web conectado e mensagens reais autorizadas.
