# i9Hub 1.1.3 — Gestão segura de campanhas

## Fase 1 aplicada
- Edição de campanhas já criadas, inclusive após o início, com pausa segura antes de alterar uma campanha em execução.
- Editor para nome, mensagem dos próximos envios, intervalo mínimo/máximo, tamanho do lote, pausa entre lotes, limite total, horário permitido, estágio após envio e proteção contra envio ao próprio número.
- As alterações afetam apenas contatos pendentes; os envios já concluídos e seus registros são preservados.
- Campo de limite total de envios: `0` significa todos os contatos; um limite alcançado pode ser aumentado para continuar a campanha.
- Status visual **Limite atingido**, com quantidade pendente e ações para editar/retomar.
- Histórico versionado das alterações de configuração e registro no log da campanha.
- Pausa segura aguarda confirmação do evento da execução antes de permitir edição; se a confirmação não chegar, nenhuma alteração é aplicada.
- Validação e limites para campos editáveis, com bloqueio de atualização enquanto a campanha está em execução.
- Central de Execução também identifica campanhas que atingiram o limite.

## Observações
- Reduzir intervalos não contorna limites ou políticas do WhatsApp. Use apenas para contatos adequados à finalidade, respeite consentimento e pedidos de descadastro.
- A edição não altera mensagens já enviadas. O modelo atualizado vale para os contatos que ainda estão pendentes.
- O funcionamento real da pausa segura depende de WhatsApp Web conectado e da extensão ativa.

## Validação
- `npm run check`
- `npm test`
