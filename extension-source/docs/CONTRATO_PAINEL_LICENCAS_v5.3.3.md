# Contrato de integração — painel administrativo e extensão i9Leads Flow 5.3.3

Este documento define o contrato que o backend/painel precisa respeitar para que as permissões aplicadas pela extensão correspondam às licenças geradas pelo administrador.

## 1. Regra principal

- Sem token de licença válido: a extensão opera em **modo de demonstração**. O usuário pode navegar pelos módulos e conhecer a interface, mas operações comerciais e alterações de dados ficam bloqueadas.
- Com token válido: cada handler operacional exige o entitlement correspondente, assinado no token emitido pelo backend.
- Ausência de `ent`, entitlement vazio, entitlement desconhecido ou handler sem mapeamento não concede acesso.
- A interface não é a autoridade. A autorização é aplicada no service worker e, para operações remotas, também deve ser validada pelo servidor.
- Ações de segurança limitadas (parar/pausar uma operação já iniciada e desconectar o Drive) continuam disponíveis para que o usuário consiga interromper ou desconectar algo mesmo se a licença expirar/revogar.

## 2. Fluxo simples para usuário iniciante

1. Instala e abre a extensão.
2. Pode explorar os módulos em modo de demonstração.
3. Clica em **Quero minha conta grátis**.
4. O WhatsApp abre para `+55 11 95472-1939`, com mensagem pronta dizendo que a pessoa veio da extensão e quer uma conta gratuita.
5. O atendimento cadastra/aprova a conta no painel e emite uma licença do plano gratuito com as permissões escolhidas.
6. O usuário recebe a chave e a cola na extensão.
7. A extensão envia a chave para o endpoint de ativação existente, valida a assinatura Ed25519, confirma o dispositivo e libera somente os direitos do token.

O botão do WhatsApp não cria uma conta nem concede acesso sozinho. A licença precisa ser gerada no painel administrativo. Isso evita contas automáticas sem controle e mantém o painel como fonte única de autorização.

## 3. Token assinado

A versão-base documenta o token como `base64url(payload).base64url(assinatura)`, assinado com Ed25519 e com os campos `kid`, `lid`, `did`, `sub`, `plan`, `ent`, `limits`, `iat`, `vu` e `exp`.

### Formato canônico recomendado para `ent`

Use uma lista de IDs estáveis de funcionalidades, por exemplo:

```json
{
  "kid": "k1",
  "lid": "lic_123",
  "did": "<UUID do dispositivo autorizado>",
  "sub": "<identificador da conta>",
  "plan": "free",
  "ent": [
    "dashboard.analytics",
    "crm.leads",
    "crm.kanban",
    "settings.general"
  ],
  "limits": {},
  "iat": 1792260000,
  "exp": 1792864800
}
```

O exemplo é ilustrativo; o painel deve preencher identificadores reais, datas e campos de acordo com sua implementação. **Não copie o exemplo como token pronto.** A assinatura deve cobrir o payload inteiro, incluindo `ent`.

A extensão também entende, por compatibilidade, mapas de permissões (`{"crm.leads": true}`) e objetos aninhados `features`, `permissions` ou `entitlements`. Para reduzir ambiguidades, recomendamos padronizar o backend para uma lista de strings em `ent`. `settings.general` é o entitlement guarda-chuva para as subfunções `settings.*`; se o painel quiser liberar configurações separadamente, pode emitir somente `settings.webhook`, `settings.delays`, `settings.spintax`, `settings.classifier` ou `settings.appearance`.

### Acesso administrativo integral

O painel pode emitir `ent: ["admin.full_access"]` ou `ent: ["*"]` apenas para licenças administrativas de teste devidamente autorizadas. O acesso integral não deve desabilitar autenticação, assinatura do token, auditoria, validação de dispositivo nem verificações de segurança do servidor.

### Sem entitlement

Se `ent` estiver ausente ou vazio, a extensão nega as funções operacionais, mesmo que `plan` seja `free`, `pro` ou `admin`. Isso é intencional: nome de plano sozinho não libera recursos.

## 4. IDs do catálogo

O catálogo canônico inicial está em `lib/feature-catalog.js`. Os IDs mapeados para handlers operacionais incluem:

- `dashboard.analytics`, `dashboard.awaiting_reply`
- `crm.leads`, `crm.kanban`, `crm.custom_fields`, `crm.classification.manual`, `crm.classification.auto`, `crm.deduplication`, `crm.export.csv`, `crm.export.webhook`, `crm.blacklist`
- `whatsapp.chat_list`, `whatsapp.group_members`, `whatsapp.chat_messages`, `whatsapp.private_opportunities`, `whatsapp.labels_sync`, `whatsapp.campaigns.manage`, `whatsapp.campaigns.send`, `whatsapp.connection`, `whatsapp.background_mode`
- `maps.extraction`, `rcs.campaigns`, `business.profile`
- `settings.general`, `settings.webhook`, `settings.spintax`, `settings.delays`, `settings.classifier`, `settings.privacy`, `settings.appearance`
- `data.management`, `data.backup.manual`, `drive.sync`, `system.logs`, `help.tour`
- Recursos planejados: `telemetry.usage`, `marketing.tracking`, `notifications.in_app`, `ads.footer`

A propriedade `implemented` diferencia funções disponíveis nesta extensão de recursos planejados. Não ofereça como operacional no painel uma função marcada como não implementada.

## 5. O que o painel precisa fazer

- [ ] Manter o catálogo global com IDs idênticos aos da extensão.
- [ ] Permitir marcar os direitos de cada plano e exceções por conta.
- [ ] Ao gerar licença gratuita, incluir apenas os recursos que o administrador decidiu liberar.
- [ ] Ao gerar licença Pro, incluir os direitos configurados para o plano.
- [ ] Emitir tokens assinados com os entitlements e limites dentro do payload assinado.
- [ ] Validar licença, dispositivo, expiração, revogação e limite de dispositivos no servidor.
- [ ] Garantir que a licença administrativa integral seja explícita, auditada e restrita.
- [ ] Preservar o endpoint de ativação que a extensão já utiliza (`/api/v1/activate`) ou ajustar ambos os lados em conjunto.
- [ ] Implementar API de telemetria, campanhas de notificação, anúncios de rodapé e integrações de marketing antes de habilitar esses módulos no painel.
- [ ] Não assumir que telemetria, notificação ou anúncio está funcional até que endpoints e armazenamento estejam implementados no backend.

## 6. Códigos de resposta de autorização

A abertura de conversa pendente exige simultaneamente `dashboard.awaiting_reply` e `whatsapp.connection`; listar as pendências exige `dashboard.awaiting_reply`. A extensão utiliza estes códigos de resposta para orientar a interface:

- `LICENSE_REQUIRED`: não existe uma licença válida ativada.
- `LICENSE_PERMISSIONS_MISSING`: token válido, mas sem direitos reconhecidos/implementados.
- `FEATURE_NOT_INCLUDED`: a licença não inclui o ID necessário.
- `FEATURE_NOT_CONFIGURED`: handler ainda sem vínculo explícito ao catálogo; a operação é negada.
- `CONTACT_PHONE_MISSING`: o Dashboard não possui telefone validado para abrir a conversa com segurança.

As mensagens de erro não devem incluir tokens, chaves de licença, credenciais ou dados pessoais desnecessários.

## 7. Limites e autoridade do servidor

O gate de extensão aplica os entitlements para todas as mensagens operacionais conhecidas. O campo `limits` está presente no contrato de token, mas a semântica dos limites quantitativos ainda precisa ser alinhada ao backend antes de depender dele para quotas. Limites de dispositivos, revogação, rate limit, consumo de recursos remotos e operações de envio devem ser verificados no servidor quando aplicável; não confiar apenas em contadores locais.

## 8. Testes de integração necessários

- [ ] Token gratuito emitido pelo painel com permissões limitadas.
- [ ] Token Pro com conjunto diferente de permissões.
- [ ] Token sem `ent` e token com `ent` vazio — ambos devem bloquear funções.
- [ ] Token com entitlement desconhecido — não deve liberar funções conhecidas por aproximação.
- [ ] Token com uma função permitida e outra negada.
- [ ] Revogação de licença durante uma sessão e interrupção de campanhas em andamento.
- [ ] Limite de dispositivos e token associado a outro dispositivo.
- [ ] Renovação/expiração e política offline.
- [ ] Chave inválida e falha temporária do servidor.
- [ ] Conta gratuita solicitada pelo WhatsApp, criada no painel e ativada pela chave recebida.
- [ ] Licença administrativa de teste com acesso integral e auditoria mantida.
