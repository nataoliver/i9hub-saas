# Relatório de implementação — Fase 02 | i9Hub v1.2.5

## Escopo executado

A Fase 02 foi aplicada somente na extensão, mantendo o painel administrativo sem alterações conforme solicitado.

### Identidade e extração

- Resolvedor comum de identidade em `content/lead-identity.js`.
- WhatsApp: prioridade de nomes por fonte, descarte de placeholders e separação entre nome e telefone.
- Google Maps: identificação da origem do nome e confiança por campo; resultados genéricos são descartados.
- Metadados de identidade preservados nos registros do CRM.

### Edição e persistência

- Editor no card do CRM para nome, telefone, e-mail, empresa, categoria, endereço e site.
- Validação no Service Worker.
- Correção manual marcada como `manual`, `locked` e confiança 1.0.
- Limpeza manual registrada como `cleared`, impedindo repovoamento automático.

### Deduplicação e mesclagem

- Correspondência por WhatsApp Chat ID, placeId, telefone, nome/endereço e nome/site.
- Não utiliza domínio isolado como chave.
- Mesclagem automática respeita fonte, confiança e correções manuais.
- Exportação CSV passa a incluir `company`.

### Licenciamento

- Catálogo incrementado para v3.
- `crm.lead.identity_edit` ativado com dependência de `crm.leads`.
- `UPDATE_LEAD_IDENTITY` protegido pelo gate central do Service Worker.
- O painel/backend não foi alterado; o contrato para a próxima atualização está em `docs/INTEGRACAO_PAINEL_v1.2.5.md`.

## Arquivos principais alterados

- `content/lead-identity.js`
- `content/injected.js`
- `content/maps-name.js`
- `content/maps-extractor.js`
- `background/service-worker.js`
- `lib/feature-catalog.js`
- `sidepanel/components/LeadModal.js`
- `sidepanel/components/MapsView.js`
- `sidepanel/utils/api.js`
- `manifest.json`, `package.json`, documentação e testes.

## Validação automatizada

- `npm run check`: manifesto e 113 arquivos JavaScript/MJS verificados.
- `npm test`: 258 testes aprovados, 0 falhas.

## Validação ainda necessária

Não foi executado teste interativo em navegador real nesta execução. Antes da distribuição, homologar com Chrome, WhatsApp Web e Google Maps reais, seguindo `GUIA_TESTE_v1.2.5.md`.

## Dependência posterior

O painel deve atualizar o catálogo para v3 e emitir `crm.lead.identity_edit` junto com `crm.leads` para os planos comerciais autorizados. Enquanto isso, o teste da ação exige `admin.full_access` ou token de homologação com ambos os direitos.
