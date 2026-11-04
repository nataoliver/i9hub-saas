# i9Hub v1.2.5 — Fase 02: Identidade e dados do lead

## Objetivo

Melhorar a identificação de contatos e estabelecimentos, registrar a origem/confiabilidade dos dados e permitir correções manuais persistentes no CRM. Esta entrega altera somente a extensão; o painel administrativo será atualizado em uma etapa posterior.

## Implementado

- Criado `content/lead-identity.js`, resolvedor compartilhado por Service Worker, WhatsApp Web e Google Maps.
- WhatsApp: prioriza nome salvo no contato, nome comercial verificado, nome formatado e nome de perfil nas conversas privadas e participantes de grupos; rejeita números e placeholders como `Contato WhatsApp` e `Sem nome` como nomes reais.
- Google Maps: identifica a fonte do nome (detalhes, título do cartão, rótulo acessível ou slug do link) e registra confiança por campo extraído.
- CRM: novo editor de identidade no card para nome, telefone, e-mail, empresa, categoria, endereço e site.
- Correções manuais ficam protegidas contra sobrescrita automática. A limpeza manual de um campo também é persistida como decisão do usuário.
- Mesclagem inteligente por ID de conversa WhatsApp, telefone, ID do lugar no Maps, nome/endereço ou nome/site.
- Deduplicação não utiliza domínio isolado como chave, evitando juntar negócios diferentes que compartilham o mesmo site institucional.
- Novo entitlement `crm.lead.identity_edit`; catálogo atualizado para versão 3.
- Versão comercial/técnica atualizada para `1.2.5` / `1.2.5.0`.

## Compatibilidade e integração administrativa

- Mantidos os IDs legados e a estrutura de tokens Ed25519.
- A ação `UPDATE_LEAD_IDENTITY` exige `crm.lead.identity_edit`, que depende de `crm.leads`.
- O painel/backend não foi alterado. Para liberar a edição aos planos Starter/Pro, o painel deverá emitir o novo entitlement e reconhecer o catálogo v3.
- Licenças com `admin.full_access` podem homologar a função enquanto a integração comercial do painel não é publicada.

## Validação automatizada

- `npm run check`: manifesto e 113 arquivos JavaScript/MJS verificados.
- `npm test`: 256 testes aprovados, 0 falhas.
- Testes automatizados não substituem a homologação manual com Chrome, WhatsApp Web e Google Maps reais.

## Fora do escopo desta versão

- IA observadora, anotações/histórico manual do CRM, follow-up e Google Agenda permanecem reservados para fases posteriores.
