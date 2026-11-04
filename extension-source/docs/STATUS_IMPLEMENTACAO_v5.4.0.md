# Estado de implementação — i9Leads Flow 5.4.0

**Tipo:** pacote de teste para carregamento manual no Chrome.  
**Base:** candidata 5.3.3 construída sobre a 5.3.2-fix1.  
**Validação automatizada:** `npm run validate` aprovado no ambiente de desenvolvimento.  
**Não é release de produção:** faltam integração real com o painel/backend e testes manuais em Chrome/WhatsApp/Google OAuth.

## 1. Preparado no código da extensão

- [x] Atualização do manifesto e do pacote para 5.4.0.
- [x] Catálogo de funcionalidades atualizado com IDs dos novos módulos.
- [x] Novos handlers operacionais mapeados a entitlements; direitos ausentes continuam negados.
- [x] Bloqueio visual por recurso não incluído quando existe licença válida, mantendo modo de demonstração explorável sem licença.
- [x] Tela responsiva de Atendimento com IA e configuração BYOK para OpenAI, Anthropic, Gemini, OpenRouter e API compatível com OpenAI.
- [x] Permissão de host solicitada no clique de teste do provedor; chave de API não é incluída na telemetria nem enviada ao painel.
- [x] Teste de acesso ao Google Sheets com validação do nome da aba.
- [x] Remoção explícita da chave local e limites locais de frequência por conversa/global.
- [x] Requisito de painel aberto, WhatsApp conectado, provedor testado e planilha testada para ativar o atendimento.
- [x] Observador isolado da conversa aberta no WhatsApp Web; mensagens recebidas são encaminhadas ao service worker sem usar a ponte MAIN `postMessage` para o evento da IA.
- [x] Respostas automáticas com prompt/base de conhecimento e JSON estruturado.
- [x] Captura de pedidos, ID, gravação no Sheets, prevenção de duplicidade por conversa/serviço/detalhes dentro de uma janela curta e estado local do pedido.
- [x] Pedidos que falham ao gravar ficam em estado local de erro, com tentativa de sincronização segura por ID e ação para reenviar à planilha.
- [x] Notificação ao vendedor pelo WhatsApp Web, confirmação condicional ao cliente e tratamento de falhas de gravação/encaminhamento.
- [x] Transferência para humano, pausa das respostas automáticas da conversa transferida e ação de retomada manual.
- [x] Status de pedido e valor opcional de venda; sincronização de status/valor para a planilha quando a API está disponível.
- [x] Tela de públicos de Status: leitura de etiquetas, prévia, exclusão individual, salvamento local e exportação CSV.
- [x] Fila local de telemetria pseudonimizada, perfil opcional de nicho/função, contadores de uso, snapshots de pendências e envio em lote condicionado à licença.
- [x] Configuração local de IDs públicos GTM/GA4/Google Ads/Meta e tentativa de sincronização com backend.
- [x] Consulta de notificações/anúncios, popup discreto, filtros locais por plano/nicho/função/recurso e anúncio de rodapé.
- [x] Indicadores adicionais no Dashboard Comercial.
- [x] Testes automatizados de catálogo, entitlements, cobertura de handlers, CTA de conta gratuita e origem do evento passivo da IA.

## 2. Parcial — requer teste real

- [!] Atendimento IA: nesta build, a detecção automática observa **a conversa aberta/ativa**. Não há garantia de monitorar todas as conversas fechadas/arquivadas nem de responder em segundo plano.
- [!] WhatsApp Web: comandos de resposta/notificação dependem dos internos/DOM atuais do WhatsApp; a interface pode mudar.
- [!] Google Sheets: o OAuth client configurado no Chrome precisa aceitar o escopo `https://www.googleapis.com/auth/spreadsheets`; não foi possível validar o cliente de produção nesta sessão.
- [!] Públicos de Status: prepara, salva, pré-visualiza e exporta públicos, mas não aplica automaticamente a seleção à privacidade do Status nem publica Status.
- [!] GTM/pixels: IDs são armazenados localmente e enviados ao backend se o endpoint existir; GTM não é executado dentro do WhatsApp Web.
- [!] Anúncios/notificações: a extensão possui consumidor de configuração, mas depende da API administrativa do backend.
- [!] Métricas do Dashboard: os contadores locais funcionam para eventos capturados pela extensão; o painel central precisa persistir/agregar eventos para relatórios entre dispositivos/contas.
- [!] `sender.url` do comando interno de IA precisa ser confirmado no Chrome real; se o navegador reportar origem diferente da URL exata do service worker, os comandos internos serão recusados por segurança.

## 3. Pendente no painel/backend

- [ ] Cadastrar todos os IDs da v5.4.0 no catálogo administrativo e emitir tokens com `ent` correspondente.
- [ ] Garantir compatibilidade retroativa dos endpoints de licença existentes.
- [ ] Implementar `POST /api/v1/telemetry/events`, com validação de token, rate limiting, deduplicação por ID de evento, armazenamento, retenção e relatórios.
- [ ] Implementar `GET /api/v1/extension/config` para notificações e anúncios, com segmentação no servidor por plano, nicho, função, recursos e datas.
- [ ] Implementar `POST /api/v1/extension/marketing-config`.
- [ ] Construir editor administrativo de notificações, anúncios, tags/pixels e segmentos.
- [ ] Criar relatórios por nicho, plano, versão, funcionalidade, conversa, lead, oportunidade, pedido, venda e conversão.
- [ ] Definir fontes de verdade para venda fechada e deduplicação entre CRM e pedidos IA.
- [ ] Testar rollout gradual, contratos com versões antigas e rollback do backend.

## 4. Testes manuais obrigatórios antes de liberar

- [ ] Instalar em perfil Chrome separado.
- [ ] Testar licenças reais: sem licença, gratuita, Pro, administrativa, expirada e revogada.
- [ ] Confirmar que cada recurso fica bloqueado quando seu entitlement não existe.
- [ ] Testar o fluxo de atendimento IA com uma conta WhatsApp de laboratório e um contato de teste.
- [ ] Testar mensagens repetidas, conversa trocada durante a geração, provedor indisponível, planilha indisponível e falha de notificação.
- [ ] Confirmar que nenhum cliente recebe confirmação falsa.
- [ ] Testar handoff humano e retomada.
- [ ] Testar público por etiquetas e CSV, incluindo contatos excluídos.
- [ ] Testar endpoints do backend e métricas de notificação/anúncio.
- [ ] Regressão de CRM, campanhas WhatsApp, Maps, Drive e RCS.

## 5. Decisão de release

**Status: candidata de teste.** O `npm run validate` passou, mas isso cobre sintaxe, manifesto, imports e testes unitários de catálogo/gate; não prova a execução real no Chrome nem a integração com o backend. A build não deve ser distribuída comercialmente em larga escala até concluir a integração e os testes manuais acima.