# Contrato de integração com painel — i9Hub v1.5.0 / Fase 09

O painel administrativo não foi modificado nesta entrega.

## Catálogo
- `FEATURE_CATALOG_VERSION`: 10
- Total de IDs: 86
- Funcionalidades implementadas: 85
- Novo entitlement: `dashboard.commercial_performance`

## Descrição sugerida do recurso
"Relatórios e inteligência de performance comercial: conversão por coorte, desempenho por responsável, comparecimento, tempo de fechamento, desempenho por etapa e previsão ponderada do funil."

## Dependências
- `crm.leads`
- `crm.kanban`

A Fase 09 é independente de `dashboard.commercial_agenda`. O relatório pode ser liberado sem a agenda Google, mas os indicadores de reuniões só terão dados se houver eventos CRM com resultado registrado.

## Ações protegidas
- `DASHBOARD_GET_COMMERCIAL_PERFORMANCE` → `dashboard.commercial_performance`
  - Requer também `crm.leads` e `crm.kanban`.
- `SALES_ANALYTICS_SAVE_CONFIG` → `dashboard.commercial_performance`
  - Requer também `crm.leads` e `crm.kanban`.
- `UPDATE_LEAD_COMMERCIAL_FIELDS` → `crm.leads`.

## Atualizações necessárias no painel
1. Importar o catálogo canônico de 86 IDs da extensão v1.5.0.
2. Promover `dashboard.commercial_performance` para implementado/ativo.
3. Configurar dependências `crm.leads` e `crm.kanban`.
4. Definir quais planos comerciais recebem o novo entitlement.
5. Emitir tokens contendo `dashboard.commercial_performance`, `crm.leads` e `crm.kanban`.
6. Preservar compatibilidade retroativa: ausência do novo entitlement bloqueia somente a seção de performance e suas ações.
7. Manter `dashboard.commercial_agenda` separado, conforme Fase 08.

## Dados e privacidade
- Relatórios, valores e histórico de responsáveis são agregados localmente na extensão.
- Esta fase não envia receita, valores de oportunidades ou nomes de vendedores ao painel.
- Probabilidades por etapa são armazenadas em `chrome.storage.local`.
- O painel não recebe os dados pessoais dos leads.
