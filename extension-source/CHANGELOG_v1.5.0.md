# i9Hub v1.5.0 — Fase 09: Relatórios e Inteligência de Performance Comercial

## Novidades
- Relatório de performance comercial no Dashboard, independente da seção de agenda.
- Filtros de período: últimos 30 dias, 90 dias, 12 meses e todo o histórico disponível.
- Conversão por coorte de leads criados no período.
- Performance por vendedor/responsável: leads atribuídos, ganhos da carteira, conversão da coorte, vendas fechadas no período, receita registrada e comparecimento.
- Taxa de comparecimento calculada somente com reuniões marcadas como realizadas ou não comparecimento.
- Tempo médio entre criação do lead e fechamento, quando as datas são rastreáveis.
- Desempenho por etapa: leads atuais, entradas no período, valor de oportunidades, previsão ponderada e tempo médio na etapa.
- Previsão ponderada do funil com probabilidades configuráveis por etapa.
- Indicadores de qualidade: vendas sem valor, fechamentos sem data rastreável, leads sem responsável e oportunidades sem valor.
- Novos campos comerciais no card do lead: responsável, valor estimado e valor efetivamente vendido.
- Histórico local de atribuição de responsável, sem retroagir a períodos anteriores.
- Histórico de mudança de etapa com `stageUpdatedAt` e eventos de transição manual, IA e campanha.
- Novo entitlement `dashboard.commercial_performance`.
- Catálogo atualizado para v10.
- Release da extensão atualizado para 1.5.0.

## Definições importantes
- `dealValue`: valor estimado da oportunidade; alimenta pipeline e previsão ponderada.
- `saleValue`: valor efetivamente vendido; só entra na receita quando o lead está em etapa de ganho e possui fechamento rastreável no período.
- `commercialOwner`: responsável comercial digitado no card do lead.
- `commercialOwnerHistory`: histórico de atribuições com início e término.
- Conversão geral: coorte de leads criados no período que atualmente estão em etapa de ganho.
- Comparecimento: realizadas ÷ (realizadas + não compareceu). Cancelamentos e reuniões sem resultado não entram no denominador.
- Previsão ponderada: soma de `dealValue × probabilidade da etapa`; não representa faturamento realizado nem previsão por data.

## Probabilidades padrão
- Novo: 10%
- Contatado: 20%
- Qualificado: 35%
- Proposta: 60%
- Etapas personalizadas reconhecidas como oportunidade: 40%
- Demais etapas abertas: 15%

As probabilidades podem ser ajustadas no próprio Dashboard. São parâmetros de planejamento, não taxas históricas calculadas automaticamente.

## Escopo e limites
- Os relatórios são calculados localmente com os leads e o histórico CRM do perfil Chrome atual.
- O responsável é informado manualmente; não existe autenticação individual de vendedores nesta fase.
- A atribuição começa quando o responsável é salvo e não reconstrói atribuições passadas.
- Leads antigos sem histórico de mudança de etapa ou `stageUpdatedAt` podem não ter data confiável de fechamento/tempo na etapa.
- Reuniões sem resultado registrado não entram na taxa de comparecimento.
- Pedidos do módulo Atendimento IA/Google Sheets permanecem em seu relatório próprio e não são somados ao faturamento CRM, evitando duplicidade sem vínculo explícito.
- Nenhum valor é criado automaticamente.

## Licenciamento
- Recurso: `dashboard.commercial_performance`
- Dependências: `crm.leads` e `crm.kanban`.
- Ações: `DASHBOARD_GET_COMMERCIAL_PERFORMANCE`, `SALES_ANALYTICS_SAVE_CONFIG`, `UPDATE_LEAD_COMMERCIAL_FIELDS`.
- Painel administrativo não foi alterado; catálogo v10 e entitlement novo precisam ser sincronizados para liberação por plano.

## Validação
`npm run validate`: manifesto e arquivos JavaScript/MJS verificados; 324 testes aprovados, zero falhas.
