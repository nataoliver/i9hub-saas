# i9Hub v1.0.4E — Correção de sincronização PV

## Objetivo
Corrigir a sincronização manual de conversas privadas (PV) para que as oportunidades sejam importadas rapidamente no estágio **Novo**, com feedback real de progresso e confirmação de conclusão.

## Alterações
- Importação em lotes de metadados de conversas privadas antes de tentar carregar histórico antigo.
- Descoberta de conversas com resolução de telefone concorrente e timeout limitado para chats LID.
- Carregamento de histórico em pool limitado, sem bloquear a criação inicial das oportunidades.
- Progresso e resultado final correlacionados pelo `syncRunId` da solicitação manual.
- Botão permanece em estado de sincronização até concluir, falhar ou atingir timeout, e atualiza o CRM ao receber o resultado final.
- Versões internas de `content.js` e `injected.js` elevadas para forçar a substituição de scripts antigos já injetados no WhatsApp Web.
- Cada conversa privada vira uma oportunidade no CRM; os novos registros (e contatos que entram pela primeira vez no fluxo de PV) ficam no estágio **Novo**. O estágio de oportunidades PV já existentes é preservado para não apagar o avanço comercial manual. O conteúdo textual das mensagens não é copiado para o CRM; o histórico carregado é usado para metadados e classificação.

## Preservado
- Painel e backend de licenciamento, catálogo de permissões, CRM geral, campanhas, contatos, mapas, chats, botão Abrir WhatsApp e layout 90/10.
- Remoções da v1.0.4C permanecem.

## Validação
Executar `npm run check` e `npm test`. A validação automatizada não substitui teste manual no WhatsApp Web real.
