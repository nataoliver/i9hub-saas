# Gestão de metas, equipes e comissões — i9Hub v1.6.0

## Onde encontrar
Dashboard → **Gestão de metas, equipes e comissões**.

## Cadastros

### Vendedores
Cada vendedor tem nome, equipe atual, status e percentual padrão de comissão. A atribuição do lead continua sendo feita manualmente no card. Cadastros desativados não são apagados e permanecem disponíveis para interpretar vendas históricas.

### Equipes
Equipes agrupam vendedores e recebem metas coletivas. Não é permitido desativar uma equipe enquanto houver vendedores ativos vinculados a ela; primeiro transfira os vendedores.

### Produtos e serviços
Cada item tem nome, tipo e percentual de comissão. A taxa do item prevalece sobre a comissão padrão do vendedor. Se nenhum produto/serviço for vinculado ao lead, usa-se a taxa padrão do vendedor.

## Metas
As metas podem ser mensais e individuais ou coletivas. Cada meta pode incluir uma ou mais dimensões:
- Receita efetivamente vendida (R$).
- Quantidade de vendas fechadas.
- Quantidade de leads atribuídos no mês.

O relatório mostra alvo, realizado e percentual para cada dimensão. Uma meta pode combinar receita, vendas e leads; o status geral usa o menor percentual entre as dimensões configuradas. Para leads, contam-se IDs distintos cuja atribuição ao vendedor/equipe começou dentro do mês. Para vendas, contam-se fechamentos rastreáveis no mês.

### Alertas
- **Agendada:** mês futuro.
- **No ritmo:** atingimento compatível com o ritmo linear do mês.
- **Atenção:** atingimento abaixo de 80% do ritmo transcorrido.
- **Em risco:** atingimento abaixo de 50% do ritmo transcorrido.
- **Meta alcançada:** 100% ou mais.
- **Meta não alcançada:** mês encerrado abaixo de 100%.

O ritmo linear é um alerta operacional simples; não representa previsão estatística nem considera sazonalidade ou concentração de vendas no fim do mês.

## Comissões
A fórmula é:

`Comissão = valor efetivamente vendido × percentual de comissão ÷ 100`.

A taxa do produto/serviço tem prioridade. Sem produto/serviço vinculado, vale a taxa padrão do vendedor.

O i9Hub grava um snapshot do percentual, valor da comissão, produto/serviço e equipe quando o lead passa para ganho com valor vendido informado. Se o valor for preenchido depois do fechamento, o snapshot é feito quando o dado é salvo. Alterações futuras na regra não recalculam vendas já registradas.

Cada comissão aparece como **Pendente** ou **Paga**. O usuário marca o pagamento manualmente. Isso não faz transferência bancária nem gera folha de pagamento.

Depois que a comissão está paga, vendedor, produto/serviço, valor vendido e etapa de ganho ficam protegidos. Para corrigir uma venda, primeiro reabra a comissão como pendente.

## Relatórios
- Ranking de vendedores por receita e quantidade de vendas.
- Resultado por equipe.
- Resultado por produto/serviço.
- Comissões pendentes e pagas.
- Exportação CSV do conjunto gerencial, com ranking, metas, comissões, equipes e produtos/serviços.
- Metas individuais e coletivas com alertas.

## Dados e limites
- Os dados são locais ao perfil Chrome atual.
- Não existe autenticação individual de vendedor nesta fase.
- Vendas antigas sem snapshot podem usar a regra atual para estimar comissão; são sinalizadas para revisão.
- Sem vendedor cadastrado, percentual positivo ou data rastreável de fechamento, não há comissão calculável.
- A comissão é calculada sobre o valor efetivamente vendido informado; impostos, estornos, devoluções, taxas de cartão, descontos ou regras trabalhistas não são modelados.
- Pedidos do Atendimento IA/Google Sheets continuam separados da receita CRM para evitar duplicidade.

## Licenciamento
Ações da Fase 10 exigem `dashboard.commercial_performance`, `crm.leads` e `crm.kanban` nesta entrega. O catálogo v11 também inclui o ID dedicado `dashboard.commercial_management`, reservado para a futura atualização do painel administrativo.
