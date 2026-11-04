# Contrato pendente — telemetria da extensão e usuários gratuitos

## Endpoint

`POST /api/v1/telemetry/collect`

### Licença ativa

Headers:

```http
Authorization: Bearer <token-de-licenca>
X-Device-Id: <uuid-do-dispositivo>
Content-Type: application/json
```

### Usuário sem licença paga

O cliente só envia depois do consentimento explícito e usa um identificador aleatório pseudônimo da instalação. Para cumprir o objetivo de medir uso gratuito sem identificar pessoas pelo conteúdo de mensagens, o painel precisa aceitar o modo anônimo abaixo, com limites de frequência e validação estrita:

```json
{
  "telemetryConsent": true,
  "anonymous": true,
  "installationId": "<id-aleatorio>",
  "extensionVersion": "5.3.2",
  "events": [
    {
      "eventId": "<id-unico-aleatorio>",
      "eventName": "feature_used",
      "occurredAt": 1792260000,
      "featureId": "crm.leads",
      "count": 1
    }
  ]
}
```

Regras:

- Aceitar até 50 eventos por lote e deduplicar por `eventId`.
- `occurredAt` em Unix epoch **segundos**.
- Aceitar somente a allowlist de eventos documentada em `FUNCOES_EXTENSAO_v5.3.2.md`.
- Não aceitar campos livres com texto, contato, lead, URL, credenciais ou dados pessoais.
- Aplicar rate limit por instalação e proteção contra abuso; não confiar em `installationId` como prova de identidade.
- Armazenar eventos por prazo limitado e mostrar agregados, não conteúdo individual.
- Respeitar a revogação de consentimento. A extensão apaga a fila local quando o consentimento é desligado.
- O endpoint original exige token ativo; portanto, o modo anônimo é uma mudança de contrato a implementar no painel. Até lá, o cliente mantém uma fila limitada e tenta novamente com backoff.

## Catálogo de funcionalidades

Após ativação/revalidação, a extensão reporta os IDs em `POST /api/v1/features/report`. IDs desconhecidos devem permanecer `PENDING` até revisão do administrador. Os tokens novos devem carregar os IDs liberados por plano; a extensão aplica controle estrito quando reconhece o novo catálogo. Para não quebrar licenças existentes, tokens que só tenham IDs genéricos antigos permanecem em compatibilidade até a migração.
