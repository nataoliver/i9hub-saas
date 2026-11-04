# Arquitetura modular i9Hub — v1.2.4

## Fonte de verdade
- `lib/feature-catalog.js`: IDs estáveis, categoria, estado de implementação e dependências.
- `lib/module-registry.js`: agrupa funcionalidades em módulos de produto; não concede permissões.
- `lib/license-policy.js`: avalia ações, permissões, dependências, configurações e limites.
- `background/service-worker.js`: ponto final de execução e validação da licença.
- `sidepanel/sidepanel.js` e `sidepanel/utils/api.js`: refletem a mesma política na interface e evitam efeitos colaterais antes da autorização.

## Princípios
1. O painel administrativo é a fonte de concessão dos direitos.
2. A extensão verifica o token Ed25519 assinado e vinculado ao dispositivo.
3. `plan` é metadado; não concede acesso sozinho.
4. `ent` contém IDs canônicos do catálogo.
5. ID desconhecido, funcionalidade planejada, dependência ausente ou handler sem mapeamento resulta em negação.
6. `admin.full_access` é um privilégio explícito; `*` e `all` não concedem esse privilégio.
7. Recursos futuros não são ativados por wildcard nem por licença administrativa até serem implementados e testados.
8. Sem licença, a interface pode ser explorada em modo demonstração, mas operações comerciais, leitura de dados operacionais e escrita ficam bloqueadas.
9. Exceções: ações públicas estritamente necessárias à ativação/consulta de metadados e ações de segurança para interromper operações ou registrar consentimento/descadastro.
10. As APIs remotas devem repetir a autorização no servidor; o gate local não substitui a autorização backend.

## Módulos
`dashboard`, `crm`, `whatsapp`, `prospecting`, `ai`, `compliance`, `calendar`, `integrations`, `marketing`, `admin`, `settings`, `data`, `system`, `help`, `communications`, `platform`, `opportunities`.

## IDs reservados para v1.3.0
| ID | Fase prevista | Dependências | Estado
|---|---:|---|---|
| `ai.mode.observe_only` | 04 | `whatsapp.ai_support`, `crm.leads` | Planejado
| `crm.notes` | 03 | `crm.leads` | Planejado
| `crm.lead.identity_edit` | 02 | `crm.leads` | Planejado
| `crm.followup.manage` | 05 | `crm.leads` | Planejado
| `crm.followup.send` | 05 | gestão, WhatsApp e compliance | Planejado
| `crm.followup.automation` | 05 | gestão, envio e kanban | Planejado
| `google.calendar.connect` | 06 | — | Planejado
| `google.calendar.availability` | 06 | conexão | Planejado
| `google.calendar.booking` | 06 | conexão e disponibilidade | Planejado
| `google.calendar.automation` | 07 | reserva e kanban | Planejado

Todos permanecem `implemented: false`. Não devem aparecer como opções habilitáveis em planos até a entrega das respectivas fases.

## Limites assinados
O claim `limits` pode conter apenas valores escalares não negativos (números ou booleanos) com chaves estáveis, por exemplo `devices.max`, `campaigns.monthly`, `crm.leads.max`, `ai.messages.monthly`. A v1.2.4 normaliza e expõe esses limites no status da licença; limites operacionais específicos devem ser efetivamente aplicados por cada módulo quando implementado.
