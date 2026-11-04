# i9Hub v1.7.0 — Fase 11: Inteligência Gerencial

## Novidades
- Nova seção **Inteligência gerencial** no Dashboard.
- Projeção indicativa de faturamento até o fim do mês pelo ritmo linear realizado.
- Comparação entre faturamento realizado, meta e atingimento projetado.
- Identificação de metas individuais/coletivas em atenção, risco ou não alcançadas.
- Identificação de oportunidades abertas sem alteração de etapa há 7 dias ou mais.
- Priorização das oportunidades paradas por tempo e valor estimado.
- Análise de desempenho por vendedor e equipe.
- Análise de resultados por produto/serviço e por segmento/nicho identificado no CRM.
- Recomendações operacionais determinísticas para metas, oportunidades paradas, atribuição e comissão.
- Parecer executivo sob demanda com IA usando o provedor/chave já configurados em Atendimento IA.
- Prompt da IA recebe somente indicadores agregados; não envia nomes, telefones, e-mails ou conteúdo das conversas dos leads.
- Limite local de uma geração com IA por minuto para reduzir chamadas acidentais e custos.
- Novo ID de catálogo `dashboard.management_intelligence`.
- Catálogo atualizado para v12.
- Release da extensão atualizado para 1.7.0.

## Regras de análise
- Projeção mensal: receita registrada ÷ fração do mês transcorrida. Não é previsão estatística e não considera sazonalidade, recebimentos futuros, estornos ou vendas ainda não registradas.
- A projeção só é exibida quando pelo menos 10% do mês já transcorreu; meses futuros ou início de mês não recebem estimativa artificial.
- Metas individuais são priorizadas para o total de meta de receita; metas coletivas são usadas quando não há metas individuais de receita, evitando somar os dois níveis e duplicar o mesmo alvo.
- Oportunidade parada: lead aberto sem alteração de etapa há 7 dias ou mais.
- A idade usa `stageUpdatedAt`, depois histórico de transição de etapa; sem esses dados, usa `createdAt`/`extractedAt` e sinaliza a aproximação.
- Segmentos/nichos dependem das classificações existentes no lead. Sem classificação, entram em "Não classificado".
- A análise da IA diferencia fatos e hipóteses e não deve criar números ou causas ausentes.

## Privacidade e custos
- Cálculos determinísticos são locais no perfil Chrome.
- A chamada externa de IA só ocorre quando o usuário clica em "Gerar análise com IA".
- O provedor usa a chave já cadastrada localmente em Configurações → Atendimento IA.
- O payload enviado contém indicadores agregados e rótulos de segmento/nicho; não contém nomes/telefones/e-mails de leads nem mensagens.
- O provedor escolhido pode cobrar pelo uso da API.
- Uma nova solicitação fica limitada a uma chamada por minuto.

## Licenciamento e compatibilidade
- Novo entitlement efetivo no catálogo e na autorização local: `dashboard.management_intelligence`.
- Catálogo v12: 88 IDs, 87 implementados.
- Para preservar licenças já emitidas, as ações exigem `dashboard.management_intelligence`, `dashboard.commercial_performance`, `crm.leads` e `crm.kanban`. O catálogo mantém uma ponte de compatibilidade: licenças antigas com `dashboard.commercial_performance` também recebem acesso.
- O painel administrativo não foi alterado. Para controlar a liberação separadamente por plano, ele ainda precisa sincronizar o novo ID; tokens antigos com `dashboard.commercial_performance` continuam funcionando pela ponte retrocompatível.

## Limites conhecidos
- A projeção é run-rate linear, não previsão de machine learning.
- Não existe histórico mensal consolidado suficiente nesta fase para sazonalidade ou tendência estatística.
- O relatório depende de vendedores, metas, produtos e classificações preenchidos corretamente.
- Os dados continuam locais ao perfil Chrome; não há consolidação entre dispositivos.
- A IA não atualiza o CRM, não muda estágios e não envia mensagens: apenas produz um parecer gerencial.

## Validação
- `npm run check`: manifesto e 132 arquivos JavaScript/MJS verificados.
- `npm test`: 342 testes aprovados, zero falhas.
- `npm run validate`: concluído com sucesso.
