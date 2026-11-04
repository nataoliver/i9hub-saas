# Inteligência gerencial — i9Hub v1.7.0

## Onde encontrar
Dashboard → **Inteligência gerencial**.

## O que o painel analisa
- Receita realizada no mês.
- Meta de receita e percentual de atingimento.
- Projeção indicativa de faturamento.
- Metas individuais/coletivas em risco.
- Oportunidades abertas paradas há 7 dias ou mais.
- Performance por vendedor e equipe.
- Resultado por produto/serviço.
- Desempenho por nicho/segmento classificado no CRM.
- Qualidade dos dados comerciais e recomendações de ação.

## Projeção
A projeção é calculada por:

`receita realizada ÷ percentual do mês transcorrido`.

Ela só aparece quando pelo menos 10% do mês já passou. Para meses futuros, não se inventa uma previsão; para meses encerrados, o valor projetado é o próprio realizado.

É um run-rate linear, não um modelo estatístico. Não considera sazonalidade, recebimentos futuros, estornos, devoluções nem vendas ainda não registradas.

## Metas
O consolidado usa metas individuais de receita quando existem. Se não existirem, usa metas de equipe. Essa regra evita somar metas individuais e coletivas como se fossem alvos independentes do mesmo faturamento.

## Oportunidades paradas
São leads abertos sem mudança de etapa há pelo menos 7 dias. A lista é ordenada por maior tempo parado e, em caso de empate, pelo valor estimado.

A data usada é `stageUpdatedAt`; se ausente, é usado o último evento de mudança de etapa. Sem ambos, a data de criação/extracção é usada como aproximação e a interface sinaliza essa condição. Leads ganhos, perdidos e excluídos ficam fora da lista.

## Segmentos e nichos
O relatório usa as classificações já registradas nos leads (`aiNicheClassification`, `aiIntelligence.segment`, `aiQualification.segment` e campos equivalentes). Não cria classificações novas. Registros sem informação ficam em "Não classificado".

## Parecer executivo da IA
O botão **Gerar análise com IA** usa o provedor/modelo/chave já configurados em Configurações → Atendimento IA.

O usuário inicia a chamada explicitamente. A IA recebe indicadores agregados, aliases de vendedores/equipes e dados de segmento/nicho; não recebe nomes, telefones, e-mails, IDs ou conteúdo das conversas dos leads. O resultado apresenta:
- Diagnóstico executivo.
- Riscos prioritários.
- Oportunidades.
- Plano de ação para os próximos 7 dias.
- Limitações dos dados.

A IA não altera CRM, não move leads e não envia mensagens. O provedor pode cobrar pelo uso da API. A extensão limita a geração a uma chamada por minuto.

## Licenciamento
Novo ID no catálogo: `dashboard.management_intelligence`.

As ações são autorizadas por `dashboard.management_intelligence`, `crm.leads` e `crm.kanban`. Para preservar tokens já emitidos, o catálogo reconhece `dashboard.commercial_performance` como entitlement legado equivalente. O painel pode liberar o ID dedicado nos planos desejados. Tokens antigos que possuem dashboard.commercial_performance continuam compatíveis pela ponte de entitlement legado.

## Limitações
- Dados locais ao perfil Chrome.
- Sem consolidação entre computadores.
- Projeção linear.
- Qualidade depende do preenchimento do CRM.
- Leads antigos sem histórico de etapa usam a data de criação como aproximação.
- Parecer IA depende de configuração e disponibilidade do provedor.
