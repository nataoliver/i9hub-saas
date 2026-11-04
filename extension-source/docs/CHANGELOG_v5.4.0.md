# Changelog — i9Leads Flow 5.4.0 (build de teste)

## Novidades

- Adicionados os módulos de interface **Atendimento com IA**, **Públicos de Status** e **Marketing & Telemetria**.
- Criado fluxo local de configuração BYOK para OpenAI, Anthropic, Gemini, OpenRouter e endpoint compatível com OpenAI.
- Adicionado teste da API de IA, remoção da chave salva e teste de acesso ao Google Sheets.
- Implementado processamento assistido de mensagens novas na conversa aberta do WhatsApp Web, com deduplicação local, prompt/base de conhecimento, captura de pedido e confirmação condicionada.
- Adicionado registro de pedido no Google Sheets, verificação de IDs existentes antes de anexar, fila local quando a gravação falha, ação de nova tentativa e notificação ao vendedor pelo WhatsApp Web.
- Adicionado handoff para atendimento humano, detecção de pedido explícito de pessoa, notificação interna, pausa por conversa e ação manual para retomar a IA.
- Adicionados limites locais de frequência (por conversa e global) para reduzir loops e consumo inesperado da API.
- Adicionado catálogo de funcionalidades para IA, segmentação de Status, telemetria, marketing, notificações e anúncio de rodapé.
- Adicionados públicos de Status salvos a partir das etiquetas, prévia de contatos com telefone parcialmente mascarado, exclusões individuais, exportação CSV e prevenção de duplicidade de pedido em janela curta.
- Adicionada fila local de telemetria pseudonimizada e envio em lote para `POST /api/v1/telemetry/events`.
- Adicionada configuração de IDs públicos de GTM/GA4/Google Ads/Meta e sincronização opcional para o backend.
- Adicionada consulta de notificações e anúncios de rodapé via `GET /api/v1/extension/config`.
- Adicionados indicadores comerciais ao Dashboard: oportunidades, clientes fechados, vendas registradas, valor vendido nos pedidos IA, conversas/mensagens IA e pedidos pendentes.
- Adicionadas telas responsivas com cartões, estados, avisos e tratamento visual para módulos novos.
- Atualizada versão do manifesto e do pacote para 5.4.0.

## Segurança e licenças

- Os novos handlers operacionais têm IDs no catálogo e são bloqueados sem entitlement válido.
- Chave BYOK não é incluída nos eventos de telemetria nem enviada ao painel.
- URLs de campanhas/anúncios são limitadas a HTTPS; conteúdos administrativos são renderizados como texto, não como HTML executável.
- Telemetria não envia conteúdo completo de mensagens, nomes/telefones de contatos ou credenciais.
- Mensagens de entrada da IA só são aceitas como eventos passivos vindos do WhatsApp Web; o processador volta a verificar a licença antes de agir.

## Limitações conhecidas desta build

- **Integração backend pendente:** o painel/backend precisa implementar os contratos em `INTEGRACAO_PAINEL_BACKEND_v5.4.0.md` e emitir os entitlements novos.
- **IA/WhatsApp Web:** o processamento automático desta build observa mensagens novas da conversa aberta; não garante varredura de todas as conversas fechadas/arquivadas.
- **Públicos de Status:** a versão prepara, salva, pré-visualiza e exporta segmentos. Não aplica automaticamente a seleção na tela de privacidade nem publica Status.
- **Marketing:** IDs de tags são salvos localmente e enviados ao backend somente se o endpoint existir. A extensão não injeta GTM/JavaScript arbitrário no WhatsApp Web.
- **Google OAuth:** o cliente OAuth configurado precisa autorizar o escopo de Sheets adicionado ao manifesto.
- **Validação:** testes automatizados/estáticos aprovados; ainda são necessários testes manuais no Chrome com licença real, WhatsApp Web real, Google OAuth e backend integrado.

## Testes automatizados

Executar `npm run validate`. O pacote é considerado candidato de teste, não release comercial de produção.
