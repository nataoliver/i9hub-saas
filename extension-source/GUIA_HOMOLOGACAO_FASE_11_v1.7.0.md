# Guia de homologação — i9Hub v1.7.0 / Fase 11

## Pré-requisitos
1. Instale a extensão 1.7.0 preservando o mesmo ID da instalação atual.
2. Use uma licença com `dashboard.commercial_performance`, `crm.leads` e `crm.kanban`.
3. Para o parecer de IA, configure e teste uma chave em Configurações → Atendimento IA.
4. Use leads fictícios ou de homologação antes de validar com dados comerciais reais.

## A — Projeção e meta
1. Selecione o mês atual no Dashboard.
2. Confira faturamento realizado com vendas ganhas e valores registrados.
3. Cadastre metas de receita individuais; confira o valor-alvo consolidado.
4. Se não houver metas individuais de receita, cadastre meta coletiva e confira o fallback.
5. Compare a projeção com `receita realizada ÷ fração do mês transcorrida`.
6. No início do mês, antes de 10% transcorrido, a projeção deve informar dados insuficientes.
7. Selecione um mês futuro: não deve haver previsão artificial.
8. Selecione um mês encerrado: a projeção deve ser igual ao realizado.

## B — Alertas de metas
1. Cadastre metas individuais e de equipe.
2. Crie cenários de meta alcançada, no ritmo, atenção, risco e não alcançada.
3. Confira o nome da meta, tipo, atingimento e recomendação.
4. Verifique que metas individuais e coletivas não são somadas no alvo consolidado de receita quando as individuais já existem.

## C — Oportunidades paradas
1. Crie leads abertos em diferentes etapas.
2. Atualize alguns para `stageUpdatedAt` recente e outros com data superior a 7 dias.
3. Inclua valor estimado e responsável.
4. Confira a lista, a ordenação por tempo e o desempate por valor.
5. Remova `stageUpdatedAt` de um lead de teste e mantenha `createdAt`: a interface deve sinalizar que a idade é baseada na criação.
6. Leads ganhos, perdidos e excluídos não devem aparecer como oportunidades paradas.

## D — Segmentos, nichos e produtos
1. Classifique leads de teste em nichos distintos.
2. Registre vendas ganhas com valor e data rastreável.
3. Confira leads, oportunidades abertas, pipeline e receita por nicho.
4. Confira o resultado por produto/serviço.
5. Leads sem classificação devem aparecer como "Não classificado".

## E — Parecer com IA
1. Configure provedor, modelo e chave em Configurações → Atendimento IA.
2. Teste a conexão do provedor.
3. Abra Dashboard → Inteligência gerencial.
4. Clique em "Gerar análise com IA".
5. Confira diagnóstico, riscos, oportunidades, plano de ação de 7 dias e limitações.
6. Clique novamente em menos de 1 minuto: a extensão deve informar o intervalo de segurança.
7. Confira no painel do provedor o consumo/custo da chamada.
8. Não use conteúdo real sensível para o teste. O payload deve conter apenas agregados e aliases.

## F — Privacidade
- O contexto para IA não deve conter nome de lead, telefone, e-mail, ID de lead ou mensagens.
- Nomes de vendedores e equipes devem ser substituídos por aliases no contexto da IA.
- O texto retornado deve ser inserido como texto simples, não HTML executável.

## G — Licenciamento
- Sem `dashboard.commercial_performance`: painel e ações bloqueados.
- Sem `crm.leads` ou `crm.kanban`: ações bloqueadas.
- Com os direitos: análise determinística liberada.
- A análise com IA usa a mesma licença comercial nesta versão; exige também chave/modelo local configurado.
- Entitlement efetivo: `dashboard.management_intelligence`. Licenças antigas com `dashboard.commercial_performance` são aceitas pela ponte de compatibilidade do catálogo.

## Testes automatizados
```bash
npm run check
npm test
npm run validate
```

A suíte automatizada não substitui a homologação visual no Chrome nem a conferência do consumo do provedor de IA.
