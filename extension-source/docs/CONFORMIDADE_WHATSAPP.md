# Saúde e Conformidade do WhatsApp — i9Hub v1.0.1

> **Aviso importante:** O i9Hub não é uma ferramenta de envio em massa. A camada de conformidade existe para proteger sua conta e promover comunicação consciente.

## Visão Geral

A camada "Saúde e Conformidade do WhatsApp" adiciona:

- **Score de saúde da conta** (0–100) com indicadores visuais no Dashboard Comercial
- **Gestão de consentimentos** (opt-in/opt-out) por finalidade
- **Guarda de campanhas** que valida antes do envio e pausa automaticamente diante de riscos
- **Alertas visuais** sobre fatores de risco e recomendações conservadoras

## Score de Saúde da Conta

### Indicadores e Pesos

| Indicador | Peso | Descrição |
|-----------|------|-----------|
| Consentimentos registrados | 25% | Proporção de contatos com opt-in válido |
| Respostas positivas | 20% | Taxa de respostas favoráveis |
| Bloqueios e denúncias | 20% | Inverso: quanto menos, melhor |
| Descadastros (opt-out) | 15% | Inverso: quanto menos, melhor |
| Repetição de mensagens | 10% | Inverso: variação de conteúdo |
| Volume e velocidade recentes | 10% | Inverso: dentro do limite recomendado |

### Faixas de Score

| Faixa | Nível | Cor | Contatos Sugeridos |
|-------|-------|-----|--------------------|
| 80–100 | Saudável | Verde | Até 50 engajados |
| 60–79 | Atenção | Amarelo | Até 20 engajados |
| 40–59 | Risco | Laranja | Não iniciar campanhas |
| 20–39 | Crítico | Vermelho | Campanhas bloqueadas |
| 0–19 | Suspenso | Vermelho escuro | Aguardar e revisar |

### Aviso Legal

> Este indicador é uma estimativa interna do i9Hub. O WhatsApp pode aplicar critérios próprios de qualidade, limites ou bloqueio independentemente desta pontuação.

## Módulos

### `lib/compliance-score.js`
- Calcula o score de forma determinística e testável
- Não depende do DOM do WhatsApp Web
- Trata ausência de dados como "desconhecido"
- Nunca assume consentimento sem registro explícito

### `lib/compliance-store.js`
- Armazena consentimentos e opt-outs localmente (`chrome.storage.local`)
- Suporta descadastro global e por finalidade
- Filtra contatos automaticamente antes de campanhas
- Permite apagar todos os dados locais de conformidade

### `lib/compliance-guard.js`
- Valida campanhas antes do início (finalidade, consentimento, score, opt-out)
- Verifica condições de pausa automática durante execução
- Gera texto de confirmação consciente para envio em massa
- Controla retomada após pausa automática

## Finalidades de Campanha

Toda campanha deve ter uma finalidade obrigatória:

- Atendimento
- Resposta a solicitação
- Utilidade/Transacional
- Confirmação de pedido
- Pós-venda
- Marketing autorizado (exige consentimento)
- Reativação (exige consentimento)
- Outro

## Pausa Automática

Campanhas são pausadas automaticamente quando:

- Taxa de bloqueios ultrapassa 5%
- Taxa de descadastros ultrapassa 8%
- Repetição de mensagens excede 30%
- 5 ou mais falhas consecutivas no envio
- Score cai para nível "Risco" ou pior

A retomada exige confirmação consciente do usuário.

## Privacidade

- Dados armazenados apenas localmente (`chrome.storage.local`)
- Nenhum conteúdo de mensagem é enviado ao painel
- Métricas agregadas e pseudonimizadas quando sincronizadas
- Usuário pode apagar todos os dados de conformidade a qualquer momento

## Eventos Armazenados Localmente

| Evento | Descrição |
|--------|-----------|
| CAMPAIGN_VALIDATED | Campanha validada antes do início |
| CAMPAIGN_BLOCKED_NO_PURPOSE | Campanha bloqueada por falta de finalidade |
| CAMPAIGN_BLOCKED_LOW_SCORE | Campanha bloqueada por score baixo |
| CAMPAIGN_BLOCKED_NO_CONSENT | Campanha bloqueada por falta de consentimento |
| CONTACTS_EXCLUDED_OPTOUT | Contatos removidos por opt-out |
| CAMPAIGN_RESUMED_AFTER_PAUSE | Campanha retomada após pausa automática |

## Compatibilidade

A camada de conformidade é compatível com todas as licenças (Free, PRO, Enterprise). As features de conformidade estão disponíveis para todos os usuários como medida de proteção da conta.
