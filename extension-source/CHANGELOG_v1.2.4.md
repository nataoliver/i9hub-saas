# i9Hub v1.2.4 — Fase 01: arquitetura e licenciamento

## Implementado
- Catálogo canônico versionado (v2), com 74 IDs anteriores preservados e 10 IDs reservados para o roadmap v1.3.0.
- Os 10 recursos futuros estão marcados `implemented: false` e não podem ser ativados nem mesmo por wildcard ou licença administrativa antes da implementação.
- Dependências de funcionalidades centralizadas no catálogo e verificadas de forma recursiva.
- Política de autorização extraída para `lib/license-policy.js`, reutilizada pelo service worker e pelo cliente da interface.
- Registro modular adicionado em `lib/module-registry.js`, derivado do catálogo canônico.
- Ações operacionais deixam de ser executáveis no modo demonstração sem licença; somente ações públicas de ativação/metadados e ações de segurança permanecem liberadas.
- Captura de `CONSENT_UPDATE` permanece disponível como ação de segurança e passa a usar o entitlement correto `compliance.consent_tracking`.
- Ingestão passiva de oportunidades privadas e entrada da fila de IA verificam licença antes de persistir dados.
- Ações de campanha exigem entitlement de envio e conexão com WhatsApp.
- Status da licença passa a informar versão do catálogo, contrato, módulos e limites escalares assinados pelo painel.
- Versão técnica/comercial atualizada para 1.2.4.

## Compatibilidade
- Formato do token Ed25519, chave pública `k1`, claims existentes (`exp`, `did`, `plan`, `ent`, `limits` etc.), ID da extensão, OAuth client e armazenamento local preservados.
- Nenhuma migração destrutiva de dados locais.
- Tolerância offline de sete dias preservada nesta fase; redução exige coordenação com o backend para não quebrar o uso durante indisponibilidade.
- Tokens legados continuam válidos se assinatura, dispositivo e expiração forem válidos; permissões continuam derivadas do claim `ent`.

## Dependência externa
O código do painel/backend não estava incluído neste pacote. O contrato atualizado para sincronização do catálogo e emissão de entitlements está em `docs/CONTRATO_PAINEL_LICENCAS_v1.2.4.md`.
