# i9Hub 1.1.6 — Inteligência de nichos e otimização comercial

## Fase 4 aplicada
- Painel de inteligência comercial acessível pelo CRM.
- Agregação do desempenho de campanhas por nicho e subnicho: envios, respostas, taxa de resposta, qualificados, taxa de qualificação, leads quentes e número de campanhas com dados.
- Recomendações explicáveis baseadas exclusivamente nos relatórios históricos da própria conta. A análise considera amostra mínima de 5 envios por segmento e sinaliza quando os dados ainda são insuficientes.
- Sugestões de otimização para priorizar novos testes em segmentos com melhor desempenho, revisar abordagem em segmentos abaixo da média e melhorar a qualificação quando há resposta sem qualidade comercial suficiente.
- Ação para preparar uma campanha com contatos classificados no nicho/subnicho escolhido, respeitando a seleção de contatos e os filtros do formulário de campanha.
- Detecção de nomes de subnichos muito semelhantes dentro do mesmo nicho pai.
- Consolidação manual com confirmação: preserva o nome de origem como sinônimo, remapeia referências dos leads, atualiza a taxonomia e reparenta subnichos filhos.
- Novo handler `MERGE_NICHE_NODES` protegido pelo entitlement `crm.classifier.niche_models`.
- Não são usados benchmarks externos inventados. O painel informa que correlação histórica é uma hipótese para testes, não garantia de resultado.

## Observações
- As métricas dependem de campanhas com envios registrados e dos dados sincronizados no CRM/WhatsApp.
- Relatórios inacessíveis por permissão/licença são contados separadamente; a tela não os trata como campanha sem resultado.
- A consolidação não é automática. O usuário revisa e confirma cada par de classificações.
- As sugestões de similaridade são restritas a subnichos irmãos para evitar misturar classificações de áreas diferentes.

## Validação
- `npm run check`
- `npm test`
- 190 testes aprovados.
