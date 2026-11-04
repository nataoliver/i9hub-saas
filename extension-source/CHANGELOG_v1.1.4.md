# i9Hub 1.1.4 — Lead Score e qualificação inteligente

## Fase 2 aplicada
- Lead Score explicável de 0 a 100, calculado com sinais disponíveis no CRM e na Inteligência Comercial da IA.
- Pesos editáveis de -100 a +100 para resposta à campanha, conversa bidirecional, necessidade, serviço/segmento, orçamento, orçamento mínimo, urgência, poder de decisão, qualificação da IA, movimentação no CRM, proposta, venda, ausência de resposta, orçamento abaixo do mínimo, falta de interesse, spam, Black list e descadastro.
- Critérios configuráveis: pontuação mínima para qualificar, pontuação para lead quente, orçamento mínimo mensal, exigência de orçamento e necessidade identificados e bloqueios para spam, Black list e descadastro.
- Filtro de CRM para leads qualificados, quentes, não qualificados e bloqueados.
- Filtro de nichos e subnichos derivados das classificações de IA/CRM.
- Score visível na tabela e nos cards Kanban, com explicação dos sinais no tooltip.
- Contadores de leads qualificados e leads quentes.
- Ação rápida para abrir a lista de qualificados e para consultar a árvore de nichos/subnichos.
- Configuração armazenada nas preferências do i9Hub e incluída no backup/sincronização geral do Google Drive quando conectado; não modifica mensagens já enviadas nem altera dados de origem do lead.

## Regras e observações
- O orçamento mínimo inicial é R$ 1.000/mês, editável pelo usuário. A exigência de orçamento mínimo fica desativada por padrão para não desqualificar automaticamente leads cujos dados ainda não foram coletados.
- O Lead Score não inventa dados ausentes: sem orçamento, urgência ou poder de decisão identificados, esses sinais não recebem pontos.
- A pontuação é uma recomendação comercial configurável, não uma garantia de conversão. A lista de qualificados respeita os bloqueios selecionados.
- Para criar uma campanha apenas com leads qualificados, selecione o filtro **Qualificados** no CRM e use **Campanha WhatsApp**.

## Validação
- `npm run check`
- `npm test`
