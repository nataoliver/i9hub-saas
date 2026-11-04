 # Changelog v1.0.2 — i9Hub
 
 **Data:** 20/10/2026 | **Codinome:** Auditoria e Reconciliação | **Base:** Fork da v1.0.1
 
 ## 🎯 Resumo Executivo
 
 A versão 1.0.2 foca na reconciliação do catálogo de funcionalidades, corrigindo discrepâncias entre a documentação (68 features) e a implementação real (74 IDs). Esta release estabelece a base para a sincronização precisa com o Painel Administrativo e define o roadmap de atualização dos módulos P0 e P1.
 
 ## 🔍 Auditoria do Catálogo Real
 
 ### Discrepância Identificada
 - **Documentado no CHANGELOG v1.0.0:** 68 funcionalidades (42 herdadas + 26 planejadas).
 - **Implementado no código (feature-catalog.js):** 74 IDs únicos.
 - **Diferença:** +6 IDs não contabilizados ou agrupados incorretamente nas listas anteriores.
 
 ### Contagem Real por Categoria (v1.0.2)
 | Categoria | Qtd | Status |
 |---|---|---|
 | Dashboard | 3 | ✅ Implementado |
 | Conformidade | 7 | ✅ Implementado |
 | CRM | 14 | ✅ Implementado |
 | WhatsApp | 10 | ✅ Implementado |
 | Prospecção/RCS | 2 | ✅ Implementado |
 | Configurações/Integrações | 9 | ✅ Implementado |
 | Dados/Sistema | 4 | ✅ Implementado |
 | Automação/IA | 11 | ✅ Implementado |
 | Administração/Marketing | 4 | ✅ Implementado |
 | IA Supervisionada | 6 | ✅ Implementado |
 | **Total** | **74** | **100% Implementado** |
 
 ### Nomes Sobrepostos Reconciliados
 1. `whatsapp.status_audience` vs `whatsapp.status_segments`: Unificados sob `status_audience` (Públicos de Status por etiquetas).
 2. `ai_support` vs IA Supervisionada: `ai_support` é o módulo base; os novos IDs (`ai.mode.suggestion`, etc.) são extensões seguras.
 3. `marketing.tracking` vs Tag Manager: `marketing.tracking` atua como o hub central de pixels e scripts.
 4. `telemetry.usage` vs `telemetry.sales_funnel`: Separados intencionalmente — um foca em estabilidade técnica, o outro em métricas comerciais.
 
 ## 🛠️ Atualizações do Painel Administrativo (Roadmap)
 
 Para alinhar o backend (i9rcs-license-panel v5.0.3) com a extensão v1.0.2, as seguintes ações são necessárias:
 
 ### [P0] Prioridade Crítica
 - [ ] **Auditar Entitlements:** Atualizar o `seed.ts` e os planos (Starter/Pro) para incluir os 74 IDs canônicos em vez dos placeholders ['hello', 'export'].
 - [ ] **Validar Licenciamento:** Testar o ciclo completo de emissão, ativação e revogação usando a nova estrutura de direitos.
 - [ ] **Consentimento e Descadastro:** Garantir que o painel permita configurar regras globais de opt-out que sejam respeitadas pela extensão via `compliance-store.js`.
 
 ### [P1] Integrações e Telemetria
 - [ ] **Conectar Telemetria:** Definir os endpoints no painel para receber eventos agregados de uso e funil comercial sem violar a privacidade.
 - [ ] **Anúncios e Notificações:** Implementar a gestão de campanhas internas e notificações in-app no painel admin.
 
 ## ⚙️ Ajustes Técnicos
 - Versão do `manifest.json` atualizada para `1.0.2`.
 - Documentação de reconciliação de IDs adicionada para evitar duplicidade futura no painel.
 
 ---
 *Esta versão consolida a arquitetura de conformidade e prepara o ecossistema para a expansão das métricas de nicho.*