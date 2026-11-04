# Contrato de integração — Extensão i9Leads Flow 5.4.0

Este documento descreve os contratos que o painel/backend deve implementar para que os novos módulos da extensão possam funcionar de ponta a ponta. A versão 5.4.0 é uma build de teste da extensão; os endpoints abaixo não são considerados existentes até serem implementados e testados no backend real.

## 1. Compatibilidade retroativa obrigatória

- Manter os endpoints e formatos usados por extensões suportadas.
- Preferir alterações aditivas e versionar alterações incompatíveis.
- Não remover campos, rotas ou permissões antigas sem período de transição.
- Testar contratos com a extensão 5.3.2-fix1, 5.3.3-license-gate e 5.4.0 conforme a política de suporte.
- Aplicar migrações de banco no padrão expandir → migrar → validar → remover legado após a transição.
- Usar feature flags, rollout gradual, logs de saúde e rollback.
- A revogação de um módulo não deve quebrar outros módulos licenciados.

## 2. Licenças e catálogo

A extensão verifica o token assinado localmente e aplica o entitlement no ponto de execução. O painel deve emitir `ent` com os IDs canônicos do arquivo `lib/feature-catalog.js` e não pode liberar um recurso somente pelo nome do plano.

IDs novos:

- `whatsapp.ai_support`
- `whatsapp.ai_support.configure`
- `whatsapp.ai_support.order_capture`
- `whatsapp.ai_support.google_sheets`
- `whatsapp.ai_support.human_handoff`
- `whatsapp.status_audience`
- `telemetry.usage`
- `telemetry.sales_funnel`
- `marketing.tracking`
- `notifications.in_app`
- `ads.footer`

A licença administrativa pode incluir `admin.full_access` ou `*` somente para contas administrativas autorizadas e auditadas. Mesmo nesse caso, assinatura, validade, dispositivo e controles de segurança continuam ativos.

## 3. POST `/api/v1/telemetry/events`

### Autenticação

- `Authorization: Bearer <license-token>`
- `X-Device-Id: <pseudonymous-device-id>`
- `Content-Type: application/json`

### Corpo

```json
{
  "schemaVersion": 1,
  "extVersion": "5.4.0",
  "deviceId": "pseudonymous-id",
  "events": [
    {
      "id": "evt_unique_id",
      "event": "crm.opportunity.opened",
      "featureId": "telemetry.sales_funnel",
      "timestamp": "2026-10-17T20:00:00.000Z",
      "extVersion": "5.4.0",
      "plan": "pro",
      "profile": {"industry": "accounting", "role": "owner", "companySize": "2-5"},
      "metadata": {"count": 2, "success": true}
    }
  ]
}
```

### Requisitos do endpoint

- Validar token, licença, dispositivo, entitlement `telemetry.usage`, esquema, tamanho e rate limit.
- Deduplicar por `events[].id`; a extensão pode tentar reenviar eventos após falha de rede.
- Aceitar lotes de até 100 eventos por requisição.
- Responder com HTTP 2xx quando o lote tiver sido persistido ou aceito com segurança.
- Não exigir conteúdo de conversas, números de telefone, nomes de contatos, chaves de IA ou tokens Google.
- Agregar eventos por período, plano, versão, nicho, função e recurso.
- Definir retenção, controle de acesso administrativo e descarte.

Eventos possíveis incluem uso de módulos, erros, ativação/revogação de licença, conversas detectadas, mensagens processadas pela IA, oportunidades abertas, pedidos gravados, handoff humano, notificações, cliques de anúncio e vendas marcadas como fechadas. Uma venda só deve ser considerada fechada quando o CRM ou outra fonte confiável registrar esse resultado; não inferir fechamento apenas por uma conversa.

## 4. GET `/api/v1/extension/config`

A extensão envia `extVersion`, `industry`, `role` e `plan` como parâmetros de consulta. `industry` e `role` são enviados vazios quando o usuário desativou a telemetria.

O endpoint deve autenticar a licença e retornar somente as campanhas elegíveis para a conta:

```json
{
  "schemaVersion": 1,
  "data": {
    "notifications": [
      {
        "id": "notification-id",
        "title": "Novidade",
        "text": "Texto curto e seguro",
        "buttonLabel": "Ver detalhes",
        "url": "https://example.com/novidade",
        "startsAt": "2026-10-17T00:00:00Z",
        "endsAt": "2026-10-24T00:00:00Z",
        "targetIndustries": ["accounting"],
        "targetRoles": ["owner"],
        "targetPlans": ["free"],
        "targetFeatures": ["crm.leads"],
        "excludeIndustries": []
      }
    ],
    "footerAd": {
      "id": "ad-id",
      "active": true,
      "title": "Conheça o plano Pro",
      "text": "Texto da oferta",
      "imageUrl": "https://example.com/banner.webp",
      "buttonLabel": "Conhecer",
      "url": "https://example.com/planos",
      "targetIndustries": ["accounting"],
      "targetRoles": ["owner"],
      "targetPlans": ["free"],
      "targetFeatures": ["crm.leads"]
    }
  }
}
```

- URLs devem ser HTTPS e os textos devem ser tratados como texto, não HTML.
- Nunca retornar JavaScript, HTML executável ou código remoto.
- A filtragem de plano, nicho, categoria, recursos e datas deve acontecer no servidor. A extensão aplica uma segunda filtragem defensiva.
- Respostas vazias são válidas quando não houver campanhas ativas.
- HTTP 404 significa endpoint não implementado; a extensão mostra estado de integração pendente sem quebrar o restante do produto.

## 5. POST `/api/v1/extension/marketing-config`

Este endpoint recebe IDs públicos de rastreamento configurados pelo usuário. Não deve receber segredos privados de conversão.

```json
{
  "schemaVersion": 1,
  "extVersion": "5.4.0",
  "config": {
    "gtmId": "GTM-XXXXXXX",
    "ga4Id": "G-XXXXXXXXXX",
    "googleAdsId": "AW-XXXXXXXXX",
    "metaPixelId": "123456789",
    "otherPixels": "TikTok=..."
  }
}
```

O endpoint deve validar os IDs, associar a configuração à conta licenciada e responder 2xx quando persistir. A execução do GTM deve ocorrer no site próprio do produto. Não executar scripts arbitrários dentro do WhatsApp Web ou de sites de terceiros. Tokens secretos de integração, quando usados, ficam no backend.

## 6. Google Sheets e OAuth

A extensão usa Google Identity/Sheets diretamente para registrar pedidos, com autorização explícita do usuário. A aba configurada precisa existir e ter nome exato. A extensão anexa as colunas A–K: ID do pedido, data/hora, cliente, telefone, empresa, serviço, detalhes, responsável, status, origem e valor de venda. O cliente OAuth do Chrome precisa autorizar o escopo `https://www.googleapis.com/auth/spreadsheets` além dos escopos já existentes. Se o cliente OAuth não estiver atualizado no Google Cloud, o botão de teste da planilha falhará até que a configuração seja corrigida.

A chave da API de IA do usuário é armazenada localmente na extensão e **não é enviada ao painel**. O backend não deve pedir nem armazenar essa chave como parte da telemetria.

## 7. Limitações do módulo IA nesta build

- O atendimento é executado localmente pela extensão, interagindo com o WhatsApp Web; não usa a API oficial do WhatsApp.
- Só funciona enquanto o painel da extensão estiver aberto, o Chrome estiver ativo e o WhatsApp Web conectado.
- A detecção automática está limitada às mensagens novas da conversa visível/aberta. Esta build não faz varredura confiável de todas as conversas fechadas ou arquivadas.
- O WhatsApp Web pode mudar sua interface e quebrar a automação.
- O pedido só é confirmado depois da gravação no Sheets; o encaminhamento ao vendedor só é confirmado se o envio interno for confirmado.
- O backend não processa mensagens em segundo plano quando o computador está desligado ou a extensão fechada.

## 8. Métricas e fontes de verdade

O painel deve distinguir:

- conversas detectadas/varridas;
- mensagens processadas pela IA;
- leads criados;
- oportunidades abertas;
- pedidos registrados;
- pedidos aprovados/recusados;
- vendas marcadas como fechadas;
- valor de venda informado, quando disponível;
- eventos confirmados por integração versus declarados pelo usuário.

Não somar uma mesma venda duas vezes quando ela aparecer no CRM e no pedido IA. Use IDs de evento, IDs de pedido e uma chave de negócio para deduplicação.

## 9. Testes de contrato

- [ ] Endpoint de telemetria aceita lote válido e deduplica o mesmo evento.
- [ ] Endpoint de telemetria rejeita token inválido, entitlement ausente, payload excessivo e rate limit.
- [ ] Endpoint de configuração retorna apenas campanhas permitidas para plano/nicho/recursos.
- [ ] URL HTTP ou conteúdo executável é recusado.
- [ ] Endpoint de marketing não armazena tokens privados recebidos do cliente.
- [ ] Versões antigas suportadas continuam ativando licença e usando os endpoints existentes.
- [ ] Uma falha em qualquer endpoint novo não quebra CRM, WhatsApp, Drive, Maps ou RCS.
- [ ] Rollback do backend mantém contratos anteriores.