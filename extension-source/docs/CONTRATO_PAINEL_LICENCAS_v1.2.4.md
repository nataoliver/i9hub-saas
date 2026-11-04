# Contrato de licenciamento Painel ↔ Extensão — i9Hub v1.2.4

## Situação
Este documento especifica a compatibilidade exigida do painel/backend. O repositório do painel não acompanha o ZIP da extensão e, portanto, não foi alterado nesta entrega.

## Token existente (sem quebra de formato)
- Formato: `base64url(payload).base64url(signature)`
- Assinatura: Ed25519; a extensão confia na chave pública `k1` já distribuída.
- Claims obrigatórios: `exp` (Unix seconds) e `did` (device UUID).
- Claims utilizados quando presentes: `kid`, `lid`, `sub`, `plan`, `ent`, `limits`, `iat`, `nbf`, `vu`.
- `ent` aceita lista de IDs, string separada por espaços/vírgulas ou mapa de permissões verdadeiro/falso. Preferir lista de IDs canônicos.
- `plan` é informativo. Nunca conceder acesso somente pelo nome do plano.
- Não mudar a chave pública, o algoritmo, o vínculo de dispositivo ou o formato do token sem uma migração coordenada.

## Catálogo
- `FEATURE_CATALOG_VERSION = 2`.
- Catálogo contém 84 entradas: 73 implementadas, 1 entrada legada reservada (`rcs.campaigns`, não implementada) e 10 entradas futuras do roadmap, também não implementadas.
- O painel deve obter/sincronizar os IDs canônicos e exibir somente `implemented: true` como permissões selecionáveis.
- Entradas `implemented: false` devem ser somente informativas/desabilitadas. Não as emitir no claim `ent`.
- O painel não deve inventar aliases, converter IDs para nomes ou usar nomes de exibição como permissões.

## Novos IDs reservados (não emitir ainda)
`ai.mode.observe_only`, `crm.notes`, `crm.lead.identity_edit`, `crm.followup.manage`, `crm.followup.send`, `crm.followup.automation`, `google.calendar.connect`, `google.calendar.availability`, `google.calendar.booking`, `google.calendar.automation`.

## Regras de autorização
1. Cada licença deve receber somente os IDs efetivamente contratados/configurados para a conta.
2. A extensão valida a assinatura, expiração e `did` antes de confiar em `ent`.
3. Ausência de entitlement, ID desconhecido, recurso não implementado ou dependência ausente resulta em acesso negado.
4. Dependências declaradas no catálogo são obrigatórias. Ex.: `whatsapp.ai_support.configure` exige `whatsapp.ai_support`; `whatsapp.status_audience` exige sincronização de etiquetas e conexão WhatsApp; `telemetry.sales_funnel` exige `telemetry.usage`.
5. `admin.full_access` deve ser emitido somente para a identidade/licença administrativa do proprietário. `*`/`all` não substituem esse privilégio. Se o backend utilizar claims de papel (`owner`, `admin`, `administrator` ou equivalentes), esses papéis devem ser atribuídos exclusivamente à identidade proprietária, pois a extensão os reconhece nas ações owner-only.
6. Ações operacionais não são liberadas sem licença. Exceções locais limitadas: ativação/consulta de licença e metadados, parada/pausa de operações e registro de sinais de consentimento/opt-out.
7. O backend deve repetir a autorização em todos os endpoints remotos e validar conta, licença, dispositivo, status e limites.

## Limites
`limits` deve ser um mapa de chaves estáveis para números finitos não negativos ou booleanos. Exemplos: `devices.max`, `campaigns.monthly`, `crm.leads.max`, `ai.messages.monthly`, `followup.active.max`, `calendar.events.monthly`. A extensão v1.2.4 normaliza e expõe esses valores; o backend continua responsável por impor limites em operações remotas.

## Compatibilidade e rollout
- Manter endpoints e respostas de ativação atuais.
- Não revogar ou reescrever licenças existentes apenas por causa da versão do catálogo.
- Manter os 74 IDs anteriores e seus significados.
- Atualizar o catálogo do painel de forma aditiva e idempotente.
- Antes de emitir qualquer um dos dez novos IDs, aguardar a implementação e os testes da respectiva fase da extensão.
- Mudanças de entitlements devem ser refletidas na próxima validação/renovação do token conforme o TTL operacional existente. A atualização imediata exige mecanismo backend adicional e não é afirmada nesta versão.
- A tolerância offline existente de até sete dias após a última validação bem-sucedida foi preservada para não alterar o comportamento de disponibilidade sem o backend. O painel deve considerar esse atraso ao revogar licenças; a redução ou remoção da janela exige política coordenada de renovação/revogação.
