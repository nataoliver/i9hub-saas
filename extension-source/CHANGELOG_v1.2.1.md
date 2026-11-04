# i9Hub 1.2.1 — Fase 4: Inteligência comercial e otimização

## Novidades
- Comparativo consolidado de desempenho por nicho e subnicho com dados dos relatórios de campanhas da própria conta.
- Novo comparativo por personalidade da IA, usando o perfil salvo na campanha. Campanhas sem perfil explícito ou antigas entram em “Perfil global”.
- Recomendações explicáveis para continuar testando, revisar abordagem ou ajustar qualificação por nicho e personalidade, respeitando amostra mínima.
- Exportação CSV das métricas agregadas de nichos, subnichos e personalidades para Excel/Google Sheets. O arquivo não inclui telefones nem conteúdo das conversas.
- Preparação de público reforçada: contatos sem telefone válido, na Black list, classificados como spam ou com descadastro identificado ficam de fora; a interface informa os motivos de exclusão.
- Consolidação assistida de subnichos continua exigindo confirmação, preservando sinônimos e remapeando os leads sem misturar pais diferentes.

## Regras de interpretação
- Métricas são calculadas a partir de relatórios e dados sincronizados da própria conta; não são usados benchmarks externos inventados.
- Uma amostra pequena não é usada para recomendar escalar um segmento.
- O desempenho por personalidade é observacional: público, mensagem, horário e oferta também influenciam os resultados; não prova causalidade.
- Preparar um público não inicia o envio. A campanha continua dependendo de revisão e ação explícita do usuário.
- Contatos com descadastro identificado não entram no público preparado, independentemente dos pesos configurados no Lead Score.

## Validação
- Testes novos cobrem agregação por personalidade, recomendações com amostra mínima, CSV sem dados pessoais e proteções de público.
- `npm run validate` verifica manifesto, sintaxe, imports locais e toda a suíte automatizada.
- A validação automatizada não substitui o teste manual no Chrome com campanhas e dados reais.
