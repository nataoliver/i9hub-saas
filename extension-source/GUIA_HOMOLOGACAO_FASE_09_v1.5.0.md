# Guia de homologação — i9Hub v1.5.0 / Fase 09

## Pré-requisitos
1. Instale a extensão v1.5.0 em perfil Chrome de teste.
2. Ative licença com `dashboard.commercial_performance`, `crm.leads` e `crm.kanban`.
3. Para validar reuniões, tenha também os recursos Google Agenda das fases anteriores.
4. Use leads fictícios/de homologação. Não altere negócios reais apenas para testar métricas.

## Teste A — dados comerciais no card
1. Abra o CRM e selecione um lead de teste.
2. Em "Dados para performance comercial", informe um responsável, por exemplo "Vendedor Teste".
3. Informe `Valor estimado da oportunidade`.
4. Salve e abra o lead novamente: os dados devem permanecer.
5. Troque o responsável e salve; o histórico deve encerrar a atribuição anterior e iniciar a nova.
6. Limpe o responsável e confirme que a atribuição ativa foi encerrada.
7. Informe `Valor efetivamente vendido`, mas não feche o lead: o valor não deve entrar na receita realizada.

## Teste B — conversão por coorte
1. Crie leads de teste dentro do período selecionado.
2. Atribua responsáveis.
3. Mova alguns leads para uma etapa reconhecida como ganho.
4. Abra Dashboard → Relatórios e inteligência de performance.
5. Confira leads criados, ganhos da coorte e taxa.
6. Compare os números com a lista de leads; não use apenas a quantidade de fechamentos ocorridos no período como denominador.

## Teste C — vendas e receita
1. Feche um lead de teste.
2. Preencha `Valor efetivamente vendido`.
3. Confira vendas fechadas e receita registrada.
4. Feche outro lead sem valor: a quantidade de vendas deve aumentar, mas a receita registrada não.
5. Lead fechado antigo sem data de transição deve aparecer no indicador de qualidade e não deve ser colocado artificialmente em um período.

## Teste D — reuniões
1. Crie compromissos de teste pelo card de leads.
2. Depois do horário final, registre um como Realizada e outro como Não compareceu.
3. Deixe um terceiro sem resultado e cancele um quarto.
4. Confira que a taxa usa apenas realizada e não compareceu; evento sem resultado e cancelamento ficam fora do denominador.
5. Confira atribuição por vendedor de acordo com o responsável na data da reunião.

## Teste E — tempo de fechamento e etapa
1. Mova um lead entre etapas, aguardando datas de teste ou usando dados controlados.
2. Confira `stageUpdatedAt` e eventos `lead.stage_changed`.
3. Feche um lead com data de criação e fechamento rastreáveis.
4. Confira o tempo médio em dias.
5. Leads antigos sem data rastreável devem aparecer como indisponíveis, sem estimativa inventada.

## Teste F — previsão ponderada
1. Informe `Valor estimado da oportunidade` em leads abertos.
2. Confira o valor total do pipeline.
3. Abra "Probabilidades", altere uma etapa, salve e atualize.
4. Confira que a previsão ponderada muda.
5. Feche o lead e confira que ele sai do pipeline aberto.
6. Não confunda previsão ponderada com receita realizada ou previsão mensal.

## Teste G — períodos
1. Compare 30 dias, 90 dias, 12 meses e todo o histórico.
2. Confira que o filtro altera leads criados, vendas fechadas, reuniões e atribuições dentro do intervalo.
3. "Todo o histórico" usa os registros locais disponíveis; não recupera eventos apagados ou históricos que nunca foram gravados.

## Teste H — licenciamento
- Sem `dashboard.commercial_performance`: relatório e endpoint bloqueados.
- Sem `crm.leads` ou `crm.kanban`: relatório bloqueado.
- Sem `crm.leads`: edição dos dados comerciais bloqueada.
- Com os entitlements necessários: relatório e edição liberados.
- O recurso da Fase 08 (`dashboard.commercial_agenda`) continua independente.

## Testes automatizados
```bash
npm run check
npm test
npm run validate
```

A suíte automatizada não substitui a comparação manual dos relatórios com dados reais de homologação.
