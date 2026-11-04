 # Changelog v1.0.1

 > Data: 20/10/2026

 ## Novidades

 - **Botão "💡 Sugestões"** adicionado ao sidebar — abre formulário externo para coleta de feedback e sugestões de funcionalidades (visível para todos os níveis de conta).
 - **Documentação de planos atualizada** (`docs/PLANOS_E_FUNCIONALIDADES.md`):
   - Conta parceiro agora tem as mesmas funções do Nível 2 Pro.
   - Admin pode criar conta parceiro sem custo e escolher o nível de acesso (free, basic ou pro).
   - Gráfico Mermaid de classificação de contas adicionado.
   - Seção dedicada ao menu de sugestões de funcionalidades.
   - Seção dedicada ao fluxo de criação de conta parceiro no painel admin.

 ## Ajustes

 - Versão do `manifest.json` atualizada para `1.0.1`.
 - Botão "Sincronizar PV" (herdado da v1.0.0) mantido com ícone visível apenas no hover.

 
## Camada de Saúde e Conformidade do WhatsApp

- **Card "Saúde da conta WhatsApp"** adicionado ao Dashboard Comercial com score circular (0–100), nível, cor, fatores de risco e recomendação de contatos.
- **Módulo `lib/compliance-score.js`**: cálculo determinístico do score com 6 indicadores ponderados (consentimento 25%, respostas positivas 20%, bloqueios 20%, descadastros 15%, repetição 10%, volume 10%).
- **Módulo `lib/compliance-store.js`**: gestão local de consentimentos e opt-outs com suporte a descadastro global e por finalidade.
- **Módulo `lib/compliance-guard.js`**: validação pré-envio (finalidade obrigatória, consentimento, score mínimo, filtro de opt-out) e pausa automática por sinais de risco.
- **Finalidades obrigatórias** para campanhas: atendimento, resposta, utilidade, confirmação, pós-venda, marketing autorizado, reativação, outro.
- **Pausa automática** quando taxa de bloqueios > 5%, descadastros > 8%, repetição > 30%, 5+ falhas consecutivas ou queda de nível de score.
- **Confirmação consciente** exigida antes de envio em massa com alerta explícito sobre riscos de bloqueio e banimento.
- **Testes automatizados** do score (14/14 passando): sem dados, consentimento alto, bloqueios, descadastros, repetição, volume, determinismo, disclaimer.

## Prioridade 4 — Arquitetura Híbrida Web/API

- **Módulo `lib/whatsapp-transport.js`**: camada de transporte abstrata que isola toda interação com o DOM do WhatsApp Web. O restante da extensão (classificador, CRM, IA) agora chama métodos assíncronos (`sendToWhatsApp`, `getRecentMessages`, `sendMessage`, etc.) em vez de acessar seletores diretamente. Comunica-se via `postMessage` com a bridge existente (`content.js` ↔ `injected.js`).
- **Módulo `lib/api-sync.js`**: sincronização de modelos aprovados (templates, system prompts, respostas pré-aprovadas) via `chrome.storage.local` com busca em background; controle de rate limits por provedor com detecção automática de throttling via headers `x-ratelimit-*`; reconciliação de dados entre WhatsApp Web (fonte da verdade) e contexto da IA, preenchendo lacunas após recarregamento ou aba inativa.
- **Integração com IA Supervisionada**: `api-sync.js` importa `getRecentMessages` de `whatsapp-transport.js` para reconciliação, garantindo que o contexto enviado às LLMs esteja sempre alinhado com as mensagens visíveis na tela.
- **Zero código PHP/WordPress**: todos os módulos são ES Modules puros usando APIs do Chrome Extension (Manifest V3).

## Prioridade 5 — Oportunidades Comerciais

- **Módulo `lib/flow-builder.js`**: construtor de fluxos locais com regras lógicas baseadas em gatilhos de texto; envia respostas automáticas via `whatsapp-transport.js` com delays configuráveis; suporte a exportação/importação de fluxos em JSON.
- **Módulo `lib/crm-integrations.js`**: integração com CRMs externos (RD Station, Kommo, HubSpot, ActiveCampaign e webhooks genéricos); sincronização automática em background via `fetch()` quando leads são classificados ou mudam de status; log de tentativas de sincronização; mapeamento customizado de campos.
- **Módulo `lib/reengagement-engine.js`**: motor de reengajamento em massa com fila persistente, delays aleatórios humanizados (45–180s) e bloqueio automático de números em opt-out/spam via `compliance-store.js`; histórico de envios e estatísticas de fila.
- **Módulo `lib/niche-benchmarks.js`**: indicadores comparativos por nicho (contabilidade, dentistas, advogados, varejo, vendas recorrentes); métricas de conversão, objeções e tempo de resposta comparadas com benchmarks padrão; registro local de eventos por nicho.
- **Feature Catalog atualizado**: 5 novas features marcadas como implementadas (`whatsapp.flows_builder`, `whatsapp.status_segments`, `campaigns.reengagement`, `analytics.niche_benchmarks`, `integrations.crm_sync`).
- **Documentação** criada em `docs/CONFORMIDADE_WHATSAPP.md`.
- **Catálogo de features atualizado**: `dashboard.account_health`, `compliance.consent_tracking`, `compliance.optout_management`, `compliance.message_purpose`, `compliance.policy_alerts`, `compliance.campaign_auto_pause`, `compliance.frequency_limits` marcados como implementados.
- **Privacidade preservada**: dados locais, sem envio de conteúdo de mensagens, métricas agregadas, opção de apagar dados.
- O score é uma estimativa interna do i9Hub e **não representa o score oficial do WhatsApp**.

## Classificador de Leads 2.0 (classifier-2.0)

- **Classificação explicável** com tipo, score (0–100), nível de confiança, intenção, urgência, modelo de nicho, motivos positivos/negativos e sinais de atenção.
- **Separação entre tipo e estágio do funil**: classificação automática nunca altera `lead.stage`; leads em "Fechado" são sempre tratados como clientes.
- **Spam com níveis**: `confirmado` (≥85), `provavel` (≥65), `suspeito` (≥40) e `nao_identificado`; spam confirmado sugere arquivamento e bloqueia campanhas, mas **nunca exclui o lead automaticamente**.
- **Modelos de nicho** centralizados em `lib/niche-models.js`: contabilidade, dentistas, advogados, varejo de roupas, vendas recorrentes, imobiliária e fallback `personalizado`.
- **Detecção determinística de intenção** (`lib/intent-detector.js`) e **urgência** (`lib/urgency-detector.js`) com suporte a padrões genéricos e por nicho.
- **Feedback local progressivo** (`lib/classifier-feedback.js`): correções manuais são registradas e ajustam a confiança após mínimo de 3 correções semelhantes; separação por usuário e nicho.
- **Interface atualizada** no `LeadModal.js`: seção "Classificação automática v2.0" com detalhes completos, disclaimer obrigatório ("Esta classificação é uma recomendação do i9Hub. Revise o resultado quando a confiança for baixa.") e botões para marcar como spam/prospecto/cliente ou corrigir classificação com motivo.
- **Integração UI ↔ feedback**: correções via modal registram decisão anterior/nova, intenção, urgência, motivo, usuário, data, versão e modelo de nicho; indicação visual quando classificação foi ajustada por aprendizado local.
- **Testes automatizados** (`test/classifier-2.0.test.js`): 18/18 passando, cobrindo prospecto, cliente, spam (confirmado/provavel/suspeito), flood, link encurtado, mensagem ambígua, intenção de suporte, urgência alta/crítica, feedback local, modelos de nicho, conflito de sinais, preservação de estágio e ausência de exclusão automática.
- **Prioridade de classificação**: manual > cliente (estágio/label/interação) > spam > prospecto > a_classificar.

## Notas

 - Link do formulário de sugestões atualizado para o oficial: `https://forms.gle/8o1Xz2FTbLdWcCoo9`.
 - A comunicação com o painel administrativo para contas gratuitas liberadas por licença será implementada na próxima iteração.