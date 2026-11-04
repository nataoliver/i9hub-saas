# Relatórios e Inteligência de Performance Comercial — i9Hub v1.5.0

## Onde encontrar
Dashboard → **Relatórios e inteligência de performance**.

## Períodos
- Últimos 30 dias.
- Últimos 90 dias.
- Últimos 12 meses.
- Todo o histórico local disponível.

O período se aplica às datas de criação, atribuição, fechamento e resultado da reunião, conforme cada indicador. A conversão por coorte acompanha leads criados no intervalo e verifica quantos já estão em etapa de ganho.

## Indicadores
- **Leads criados:** leads com `createdAt`/`extractedAt` dentro do período.
- **Conversão da coorte:** leads criados no período que atualmente estão em etapa reconhecida como ganho ÷ leads criados no período.
- **Vendas fechadas:** leads atualmente em etapa de ganho, com data de fechamento rastreável dentro do período.
- **Receita registrada:** soma de `saleValue` desses leads; vendas sem valor são contadas separadamente.
- **Taxa de comparecimento:** reuniões `completed` ÷ (`completed` + `no_show`). Cancelamentos e reuniões sem resultado não entram.
- **Tempo médio de fechamento:** média de dias entre a criação do lead e a data de fechamento rastreável, apenas para vendas fechadas no período.
- **Valor no funil aberto:** soma de `dealValue` dos leads que não estão ganhos, perdidos ou excluídos.
- **Previsão ponderada:** soma de `dealValue × probabilidade da etapa`.

## Performance por vendedor
O relatório usa `commercialOwner` e `commercialOwnerHistory`, não o autor genérico "Usuário" do histórico CRM.

A atribuição é manual no card do lead. Quando o nome muda, o i9Hub encerra a atribuição anterior e inicia uma nova com data/hora. Assim, reuniões e fechamentos podem ser atribuídos ao responsável vigente naquele momento.

A tabela mostra:
- Leads atribuídos no período.
- Quantos leads atribuídos já estão ganhos (conversão da coorte).
- Vendas fechadas no período.
- Receita efetivamente registrada.
- Comparecimento das reuniões com resultado.

A atribuição começa quando o responsável é salvo. Não existe reconstrução retroativa nem autenticação individual de vendedor nesta fase. Digite o mesmo nome de forma consistente para evitar dividir os números em variações.

## Desempenho por etapa
A tabela mostra:
- Leads atualmente na etapa.
- Entradas na etapa no período (criação inicial ou transições registradas).
- Valor das oportunidades abertas na etapa.
- Previsão ponderada da etapa.
- Tempo médio na etapa, quando há data rastreável.

Mudanças manuais, por IA e por campanha passam a gravar `stageUpdatedAt` e o evento `lead.stage_changed`. Dados antigos sem data confiável aparecem como indisponíveis.

## Previsão e probabilidades
Valores padrão:
- Novo: 10%.
- Contatado: 20%.
- Qualificado: 35%.
- Proposta: 60%.
- Etapas personalizadas reconhecidas como oportunidade: 40%.
- Demais etapas abertas: 15%.

A equipe pode abrir **Probabilidades** no Dashboard e definir 0% a 100% por etapa. São parâmetros de planejamento, não taxas históricas aprendidas automaticamente.

`dealValue` é o valor estimado da oportunidade. Oportunidades sem valor não entram no total nem na previsão e aparecem em qualidade dos dados.

A previsão ponderada é um potencial atual do pipeline. Não possui data prevista de fechamento e não deve ser tratada como receita realizada.

## Campos comerciais no card
- **Responsável comercial:** texto com o nome do vendedor.
- **Valor estimado da oportunidade (R$):** usado no pipeline e na previsão.
- **Valor efetivamente vendido (R$):** usado na receita apenas quando o lead está em etapa de ganho e tem data de fechamento rastreável.

Não use `dealValue` como se fosse valor vendido. Nenhum valor é preenchido automaticamente.

## Qualidade e limitações
- Leads sem responsável: não entram na conversão por vendedor.
- Vendas sem valor efetivamente vendido: contam como vendas, mas não aumentam receita registrada.
- Fechamentos sem data rastreável: não são atribuídos a um período nem usados no tempo médio.
- Reuniões sem resultado: não entram no cálculo de comparecimento.
- Pedidos do Atendimento IA/Google Sheets não são somados à receita CRM nesta fase; os relatórios permanecem separados para evitar duplicidade sem vínculo explícito.
- Os dados são locais ao perfil Chrome e não são consolidados entre computadores.

## Licenciamento
Entitlement: `dashboard.commercial_performance`

Dependências: `crm.leads` e `crm.kanban`.

Ações:
- `DASHBOARD_GET_COMMERCIAL_PERFORMANCE`
- `SALES_ANALYTICS_SAVE_CONFIG`
- `UPDATE_LEAD_COMMERCIAL_FIELDS`
