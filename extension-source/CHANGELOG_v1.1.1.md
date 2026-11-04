# i9Hub 1.1.1 — Campanhas inteligentes e atendimento coordenado

## Campanhas WhatsApp
- Filtro de origem dos destinatários: Google Maps, participantes de grupos, conversas privadas, contatos sincronizados do WhatsApp Business, etiquetas nativas do WhatsApp, etiquetas internas do i9Hub/IA, cadastro manual e importações.
- Separação visual entre etiquetas do WhatsApp Business e classificações internas do i9Hub/IA.
- Listas salvas passam a preservar origem e etiquetas separadas; listas antigas continuam carregáveis com tentativa de migração dos filtros.
- Ciclos de campanha com lote configurável e pausa entre lotes em minutos. Exemplo: 20 envios, pausa de 120 minutos, depois o próximo lote.
- O painel mostra o horário previsto para o próximo lote e informa que o Chat com IA continua ativo durante a pausa.

## Coordenação entre campanha e IA
- Fila compartilhada de saída para evitar envio simultâneo de campanha e resposta da IA.
- A campanha aguarda a fila de atendimento da IA antes de iniciar o próximo envio, reduzindo conflitos e preservando a ordem das respostas recebidas.
- Eventos de início e fim da pausa entre lotes são registrados no histórico da campanha.

## Ritmo do atendimento
- Novo ajuste no Chat com IA: pausa configurável de 0 a 10 segundos antes de enviar a resposta.
- O ajuste evita respostas instantâneas e não simula um indicador humano de digitação. Recomenda-se informar ao contato quando o atendimento for automatizado.

## Validação
- `npm run check`: aprovado.
- `npm test`: 161 testes aprovados.
- Testes reais no Chrome/WhatsApp Web ainda precisam ser feitos com a conta do usuário; a automação depende da interface do WhatsApp Web e da sessão conectada.
