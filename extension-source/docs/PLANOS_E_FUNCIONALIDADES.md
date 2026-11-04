 # i9Hub v1.0.1 — Matriz de Planos, Classificação e Sugestões

 > Documento atualizado em 20/10/2026 para a versão **v1.0.1**.
 > A liberação é controlada via token assinado pelo painel administrativo; os links de pagamento são gerados pelo **Asaas**.
 > O admin pode criar contas de parceiro sem custo e escolher o nível de acesso individualmente.

 ---

 ## 1. Níveis de Conta

 | Nível | Identificador no Token | Descrição | Custo | Link Asaas (exemplo) |
 |-------|----------------------|-----------|-------|---------------------|
 | **Sem Cadastro** | `unregistered` | Usuário que instalou a extensão mas não validou nenhuma licença. Acesso read-only ao Dashboard básico e tela de licenciamento. | Grátis | — |
 | **Gratuita** | `free` | Conta validada com chave gratuita ou link Asaas R$ 0. Desbloqueia CRM básico, campanhas limitadas e configurações essenciais. | Grátis | `https://www.asaas.com/c/i9hub-free` |
 | **Paga Nível 1** | `paid_basic` | Plano de entrada para pequenos negócios. Libera campanhas ilimitadas, CRM completo, webhooks e classificador automático. | Mensal / Asaas | `https://www.asaas.com/c/i9hub-basic` |
 | **Paga Nível 2** | `paid_pro` | Plano avançado. Inclui IA, RCS, públicos de status, logs, telemetria e todos os recursos de conformidade. | Mensal / Asaas | `https://www.asaas.com/c/i9hub-pro` |
 | **Parceiro / Cliente Distribuído** | `partner` | Licença especial sem custo para parceiros estratégicos e clientes white-label. **Mesmas funções do Nível 2 Pro.** O admin escolhe o nível de acesso (free, basic ou pro) ao criar a conta no painel. | Isento (admin) | Gerado no painel admin |

 ---

 ## 2. Versão Sem Cadastro (`unregistered`)

 Quando a extensão é instalada e nenhuma chave é validada:

 - **Dashboard**: exibe apenas cards vazios com mensagem "Valide sua licença para acessar".
 - **CRM**: bloqueado; botão "Solicitar liberação" abre modal de licença.
 - **Campanhas WA/RCS**: bloqueadas.
 - **Maps / Chats / AI / Audiences / Logs**: bloqueados.
 - **Configurações**: apenas aba "Licença" acessível; demais abas mostram estado locked.
 - **Meu Negócio**: acessível somente leitura (terminologia padrão).
 - **Botão "Quero minha conta grátis"** na aba Licença direciona para o link Asaas do plano gratuito.
 - Nenhum dado é sincronizado com o backend; storage local permanece vazio.

 ---

 ## 3. Matriz de Funcionalidades por Plano

 Legenda: ✅ = liberado · ❌ = bloqueado · ⚠️ = limitado

 ### 3.1 Dashboard
 | Feature ID | Nome | Sem Cadastro | Grátis | Nível 1 | Nível 2 | Parceiro |
 |-----------|------|:---:|:---:|:---:|:---:|:---:|
 | `dashboard.analytics` | Dashboard comercial | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `dashboard.awaiting_reply` | Conversas aguardando resposta | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `dashboard.account_health` | Saúde da conta WhatsApp | ❌ | ❌ | ❌ | ✅ | ✅ |

 ### 3.2 CRM
 | Feature ID | Nome | Sem Cadastro | Grátis | Nível 1 | Nível 2 | Parceiro |
 |-----------|------|:---:|:---:|:---:|:---:|:---:|
 | `crm.leads` | Gestão de leads | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `crm.kanban` | Funil e etapas comerciais | ❌ | ⚠️ 3 etapas | ✅ | ✅ | ✅ |
 | `crm.custom_fields` | Campos personalizados | ❌ | ❌ | ✅ | ✅ | ✅ |
 | `crm.classification.manual` | Classificação manual | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `crm.classification.auto` | Classificação automática | ❌ | ❌ | ✅ | ✅ | ✅ |
 | `crm.deduplication` | Remoção de duplicidades | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `crm.export.csv` | Exportação CSV | ❌ | ⚠️ 50 linhas | ✅ | ✅ | ✅ |
 | `crm.export.webhook` | Exportação por webhook | ❌ | ❌ | ✅ | ✅ | ✅ |
 | `crm.blacklist` | Lista de bloqueio | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `crm.scoring_explainable` | Pontuação explicável | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `crm.classifier.niche_models` | Modelos por nicho | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `crm.intent_detection` | Detecção de intenção | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `crm.classifier.feedback_loop` | Aprendizado com correções | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `crm.spam_confidence_levels` | Spam confirmado vs suspeito | ❌ | ❌ | ❌ | ✅ | ✅ |

 ### 3.3 WhatsApp
 | Feature ID | Nome | Sem Cadastro | Grátis | Nível 1 | Nível 2 | Parceiro |
 |-----------|------|:---:|:---:|:---:|:---:|:---:|
 | `whatsapp.connection` | Conexão WhatsApp Web | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `whatsapp.chat_list` | Lista de conversas | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `whatsapp.group_members` | Extração de participantes | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `whatsapp.chat_messages` | Extração de mensagens | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `whatsapp.private_opportunities` | Oportunidades privadas | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `whatsapp.labels_sync` | Sincronização de etiquetas | ❌ | ❌ | ✅ | ✅ | ✅ |
 | `whatsapp.campaigns.manage` | Gestão de campanhas WA | ❌ | ⚠️ 1 ativa | ✅ | ✅ | ✅ |
 | `whatsapp.campaigns.send` | Envio de campanhas WA | ❌ | ⚠️ 100/dia | ✅ | ✅ | ✅ |
 | `whatsapp.status_audience` | Públicos de Status | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `whatsapp.ai_support` | Atendimento IA | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `whatsapp.ai_support.configure` | Configurar IA | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `whatsapp.ai_support.google_sheets` | IA + Google Sheets | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `whatsapp.ai_support.order_capture` | Captura de pedidos | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `whatsapp.ai_support.human_handoff` | Transbordo humano | ❌ | ❌ | ❌ | ✅ | ✅ |

 ### 3.4 RCS
 | Feature ID | Nome | Sem Cadastro | Grátis | Nível 1 | Nível 2 | Parceiro |
 |-----------|------|:---:|:---:|:---:|:---:|:---:|
 | `rcs.campaigns.manage` | Gestão de campanhas RCS | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `rcs.campaigns.send` | Envio de campanhas RCS | ❌ | ❌ | ❌ | ✅ | ✅ |

 ### 3.5 Maps
 | Feature ID | Nome | Sem Cadastro | Grátis | Nível 1 | Nível 2 | Parceiro |
 |-----------|------|:---:|:---:|:---:|:---:|:---:|
 | `maps.extraction` | Extração Google Maps | ❌ | ⚠️ 20 resultados | ✅ | ✅ | ✅ |
 | `maps.export` | Exportar extração | ❌ | ✅ | ✅ | ✅ | ✅ |

 ### 3.6 Conformidade
 | Feature ID | Nome | Sem Cadastro | Grátis | Nível 1 | Nível 2 | Parceiro |
 |-----------|------|:---:|:---:|:---:|:---:|:---:|
 | `compliance.auto_blacklist` | Blacklist automática | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `compliance.consent_tracking` | Registro de opt-in | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `compliance.optout_management` | Descadastro global | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `compliance.message_purpose` | Classificação por finalidade | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `compliance.policy_alerts` | Alertas de violação | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `compliance.campaign_auto_pause` | Pausa automática por risco | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `compliance.frequency_limits` | Limites de frequência | ❌ | ❌ | ❌ | ✅ | ✅ |

 ### 3.7 Configurações e Sistema
 | Feature ID | Nome | Sem Cadastro | Grátis | Nível 1 | Nível 2 | Parceiro |
 |-----------|------|:---:|:---:|:---:|:---:|:---:|
 | `settings.general` | Configurações gerais | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `settings.webhook` | Webhook | ❌ | ❌ | ✅ | ✅ | ✅ |
 | `settings.delays` | Delays | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `settings.spintax` | Spintax | ❌ | ⚠️ 1 preset | ✅ | ✅ | ✅ |
 | `settings.classifier` | Classificador | ❌ | ❌ | ✅ | ✅ | ✅ |
 | `settings.appearance` | Aparência | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `settings.data` | Backup e dados | ❌ | ✅ | ✅ | ✅ | ✅ |
 | `system.logs` | Logs do sistema | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `telemetry.usage` | Telemetria de uso | ❌ | ❌ | ❌ | ✅ | ✅ |
 | `marketing.tracking` | Tracking de marketing | ❌ | ❌ | ❌ | ✅ | ✅ |

 ---

 ## 4. Gráfico de Classificação de Contas

 ```mermaid
 graph TD
   A[Usuário instala extensão] --> B{Tem licença?}
   B -- Não --> C[Sem Cadastro<br/>unregistered]
   B -- Sim --> D{Tipo de licença}
   D -- Free / Asaas R$0 --> E[Conta Gratuita<br/>free]
   D -- Paid Basic --> F[Paga Nível 1<br/>paid_basic]
   D -- Paid Pro --> G[Paga Nível 2 Pro<br/>paid_pro]
   D -- Partner --> H{Admin definiu nível?}
   H -- free --> E
   H -- basic --> F
   H -- pro --> G
   C --> I[Sugere upgrade via link Asaas]
   E --> J[Sugere upgrade para Nível 1]
   F --> K[Sugere upgrade para Nível 2 Pro]
   G --> L[Acesso completo + Sugestões]
   I --> M[Formulário de Sugestões]
   J --> M
   K --> M
   L --> M
 ```

 ### Critérios de Classificação Automática
 | Critério | Sem Cadastro | Gratuita | Nível 1 | Nível 2 Pro | Parceiro |
 |----------|:---:|:---:|:---:|:---:|:---:|
 | CRM básico (leads + filtros) | ❌ | ✅ | ✅ | ✅ | ✅ |
 | Campanhas WhatsApp (ilimitadas) | ❌ | ⚠️ 100/dia | ✅ | ✅ | ✅ |
 | Classificador automático + Webhook | ❌ | ❌ | ✅ | ✅ | ✅ |
 | IA + RCS + Públicos Status | ❌ | ❌ | ❌ | ✅ | ✅ |
 | Logs + Telemetria + Conformidade | ❌ | ❌ | ❌ | ✅ | ✅ |
 | Admin define nível individual | — | — | — | — | ✅ |

 ---

 ## 5. Menu de Sugestões de Funcionalidades

 Um botão **"💡 Sugestões"** foi adicionado ao sidebar da extensão (v1.0.1+) que abre um formulário externo onde o usuário pode:
 - Sugerir novas funcionalidades
 - Reportar melhorias de usabilidade
 - Votar em features já sugeridas pela comunidade

 **Link do formulário:** `https://forms.gle/8o1Xz2FTbLdWcCoo9`

 O botão aparece para **todos os níveis de conta**, incentivando feedback contínuo e fazendo o usuário se sentir parte do desenvolvimento do produto.

 ---

 ## 6. Fluxo de Liberação via Asaas

 ```
 Usuário clica "Quero minha conta grátis" ou "Fazer upgrade"
   → Abre link Asaas correspondente ao plano
   → Pagamento aprovado (ou isenção parceiro)
   → Webhook Asaas → Backend i9Hub gera token JWT com entitlements
   → Usuário cola chave na aba Licença OU token é injetado automaticamente
   → Extensão valida assinatura e desbloqueia features conforme matriz acima
 ```

 ### Links Asaas por Plano
 | Plano | Endpoint Asaas | Observação |
 |-------|---------------|------------|
 | Gratuita | `https://www.asaas.com/c/i9hub-free` | Checkout R$ 0; gera token `free` |
 | Nível 1 | `https://www.asaas.com/c/i9hub-basic` | Recorrência mensal |
 | Nível 2 | `https://www.asaas.com/c/i9hub-pro` | Recorrência mensal |
 | Parceiro | Gerado no painel admin | Token `partner` com `admin.full_access` |

 ---

 ## 7. Painel Admin — Criação de Conta Parceiro

 O administrador pode criar contas de parceiro diretamente no painel administrativo com as seguintes opções:

 1. **Nome / Email do parceiro**
 2. **Nível de acesso** (dropdown): Gratuita · Nível 1 · Nível 2 Pro
 3. **Token gerado automaticamente** com os entitlements correspondentes ao nível escolhido
 4. **Custo**: sempre R$ 0 (isenção automática)
 5. **Observação**: campo livre para anotar o motivo da isenção (ex: "parceiro agência X", "cliente Y indicação Z")

 O token gerado usa o identificador `partner` mas carrega os mesmos direitos do nível selecionado, permitindo flexibilidade total sem alterar o catálogo de features.

 ---

 ## 8. Notas Técnicas

 - O catálogo canônico está em `lib/feature-catalog.js`; qualquer nova feature deve ser adicionada lá.
 - A função `hasFeatureEntitlement()` implementa fail-closed: ausência = negado.
 - O direito `admin.full_access` concede todas as features independentemente do plano.
 - Features com `implemented: false` no catálogo existem como placeholder e não são desbloqueáveis até implementação.
 - O botão "Sincronizar PV" no CRM usa a classe `.btn-sync-pv` com ícone visível apenas no hover.
 - A versão sem cadastro não armazena dados sensíveis; todo o conteúdo é bloqueado por `data-feature` nos componentes.
 - O botão "💡 Sugestões" no sidebar abre link externo configurável em `sidepanel/utils/brand.js` (`SUGGESTIONS_FORM_URL`).
 - Contas parceiro usam o mesmo conjunto de features do nível escolhido pelo admin; não há feature exclusiva de parceiro.