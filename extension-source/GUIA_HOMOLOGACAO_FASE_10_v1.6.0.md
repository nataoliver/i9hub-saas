# Guia de homologação — i9Hub v1.6.0 / Fase 10

## Pré-requisitos
1. Instale a extensão 1.6.0 em um perfil Chrome de teste.
2. Use uma licença com `dashboard.commercial_performance`, `crm.leads` e `crm.kanban`.
3. Faça os testes com leads fictícios ou de homologação.
4. A Fase 10 é local à extensão; o painel administrativo não precisa ser alterado nesta entrega.

## A — Equipes e vendedores
1. Abra Dashboard → Gestão de metas, equipes e comissões.
2. Cadastre uma equipe.
3. Cadastre dois vendedores e vincule-os à equipe.
4. Confira que os vendedores aparecem na tabela.
5. Edite um vendedor e altere sua equipe.
6. Confirme que a equipe antiga não é apagada do histórico.
7. Tente desativar uma equipe ainda vinculada a vendedores ativos; a operação deve ser bloqueada.
8. Desative um vendedor; seu histórico e vendas devem permanecer.

## B — Produtos e serviços
1. Cadastre um produto com comissão de 5%.
2. Cadastre um serviço com comissão de 8%.
3. Edite as taxas e confira a atualização do cadastro.
4. Desative um item e confirme que ele deixa de aparecer nas sugestões para novas atribuições, sem apagar vendas antigas.

## C — Metas mensais
1. Crie uma meta individual de receita.
2. Crie uma meta individual de quantidade de vendas.
3. Crie uma meta de leads atribuídos.
4. Crie uma meta coletiva para uma equipe.
5. Selecione o mês de referência e confira alvo, realizado e percentual.
6. Compare os números com os leads e vendas de teste.
7. Confira estados: agendada, no ritmo, atenção, em risco, alcançada e não alcançada.
8. Lembre que o alerta de risco é uma comparação de ritmo linear, não uma previsão estatística.

## D — Comissão por venda
1. Abra um lead de teste.
2. Selecione um vendedor cadastrado.
3. Selecione um produto ou serviço cadastrado.
4. Informe o valor efetivamente vendido.
5. Mova o lead para uma etapa de ganho.
6. Confira o percentual e o valor de comissão no Dashboard.
7. Confirme que a taxa do produto/serviço prevalece sobre a taxa padrão do vendedor.
8. Em outro lead sem produto/serviço, confira o uso da taxa padrão do vendedor.
9. Altere a taxa do cadastro depois de fechar a venda: o snapshot da venda anterior não deve mudar.

## E — Pagamento e proteção
1. Marque uma comissão pendente como paga.
2. Confira data e status no Dashboard e histórico do lead.
3. Tente alterar vendedor, produto, valor vendido ou etapa da venda paga; a extensão deve bloquear.
4. Reabra a comissão como pendente.
5. Faça a correção e confira o novo snapshot.

## F — Ranking e consolidação
1. Registre vendas para dois vendedores.
2. Confira o ranking por receita e quantidade.
3. Confira receita e comissão por equipe.
4. Confira receita e comissão por produto/serviço.
5. Transfira um vendedor de equipe e valide a atribuição histórica na data da venda.

## G — Dados antigos
1. Abra leads da Fase 09 com `commercialOwner` em texto.
2. Cadastre um vendedor com o mesmo nome.
3. Confira se o relatório reconhece o vendedor pelo nome normalizado.
4. Vendas sem snapshot devem aparecer sinalizadas para revisão.
5. Leads sem data de fechamento rastreável, sem valor vendido ou sem vendedor cadastrado não devem gerar comissão artificial.

## H — Licenciamento
- Sem `dashboard.commercial_performance`: seção e endpoints bloqueados.
- Sem `crm.leads` ou `crm.kanban`: ações da gestão bloqueadas.
- Com os três entitlements: gestão liberada.
- O ID `dashboard.commercial_management` já consta no catálogo v11, mas as ações usam temporariamente o entitlement da Fase 09 até a atualização do painel administrativo.

## Testes automatizados
```bash
npm run check
npm test
npm run validate
```
A suíte automatizada não substitui a conferência de valores reais e permissões no Chrome.
