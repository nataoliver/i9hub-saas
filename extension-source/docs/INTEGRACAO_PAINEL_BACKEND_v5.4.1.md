# Contrato de integração — i9Hub 5.4.1

## 1. Licenças e recursos

- A extensão continua negando operações sem licença válida e entitlement explícito.
- O botão de conexão usa `whatsapp.connection`.
- A apresentação normal lê o catálogo de recursos autorizado pelo token e omite os passos indisponíveis.
- As ações de configuração privada de marketing (`MARKETING_GET_CONFIG`, `MARKETING_SAVE_CONFIG`) exigem papel administrativo reconhecido ou `admin.full_access` no token assinado. Esse entitlement deve ser emitido somente para a licença do proprietário.

## 2. Configuração pública de anúncios e notificações

Endpoint esperado: `GET /api/v1/extension/config`.

A extensão envia token de licença e identificador do dispositivo. O backend deve devolver somente conteúdo que o usuário daquela licença possa receber, por exemplo:

- `notifications`: avisos com título, texto, botão, URL HTTPS, datas e segmentação;
- `footerAd`: campanha de rodapé com `active`, `id`, `title`, `text`, `imageUrl`, `buttonLabel`, `url`, `startsAt`, `endsAt`, `targetPlans`, `targetIndustries`, `targetRoles` e `targetFeatures`.

O backend deve validar autorização, data de início/fim, público e plano. Não devolver configurações privadas do proprietário nesse endpoint.

## 3. Telemetria

Endpoint de ingestão esperado: `POST /api/v1/telemetry/events`.

- O envio só ocorre se a licença incluir `telemetry.usage` e o usuário tiver consentido.
- O consentimento inicia desativado.
- Eventos operacionais não devem incluir texto de mensagens, nomes de contatos ou telefones.
- Se o usuário revogar o consentimento, a fila local pendente é limpa e novos eventos não são enviados.
- O segmento profissional só é incluído no pedido de configuração quando há consentimento.

## 4. Google Ads / AdSense

Não enviar scripts de anúncio remotos para a extensão. O slot nativo exibe conteúdo HTTPS vindo do backend. Para Google AdSense, usar um site ou painel web hospedado que cumpra os requisitos do Google.

## 5. Compatibilidade

Manter contratos aditivos e versionados. Não remover campos existentes sem migração; testar primeiro com a build 5.4.1 em um grupo controlado e manter opção de rollback.
