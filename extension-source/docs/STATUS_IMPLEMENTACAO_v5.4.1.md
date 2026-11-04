# i9Hub 5.4.1 — status da candidata de correção

**Tipo:** build de teste, não publicação pública.

## Correções incluídas

- [x] Adicionado botão permanente **Abrir WhatsApp** no menu lateral. A ação respeita a licença e tenta reutilizar a aba do WhatsApp Web antes de criar outra; o fluxo abre a janela ao lado da extensão.
- [x] Melhorada a detecção de abas do WhatsApp, incluindo `pendingUrl` e validação do host por URL.
- [x] Removido o menu/rota **Marketing & Dados** da extensão distribuída ao usuário.
- [x] Adicionada proteção de proprietário para `MARKETING_GET_CONFIG` e `MARKETING_SAVE_CONFIG`: requer papel administrativo ou entitlement `admin.full_access` no token assinado.
- [x] Apresentação inicial filtrada pelas funcionalidades liberadas na licença.
- [x] Adicionada a apresentação **Conhecer todos os módulos**, somente explicativa e sem navegação para telas bloqueadas.
- [x] Criado slot de anúncio persistente fora do conteúdo das páginas; a troca de tela não remove o rodapé.
- [x] Imagem e destino de anúncios aceitam somente URLs HTTPS e o texto é renderizado sem HTML remoto.
- [x] Adicionadas preferências de telemetria na área Configurações, com nicho, função, tamanho de equipe e consentimento opcional.
- [x] Consentimento de telemetria começa desativado. Perfis antigos com consentimento presumido são migrados para desativado; eventos não são enviados sem consentimento e licença com `telemetry.usage`.
- [x] O nicho não é enviado ao endpoint de configuração se o usuário não consentiu a telemetria.
- [x] Aplicada a identidade i9Hub na extensão, nos ícones e na paleta principal azul-marinho/azul/ciano; modo claro é o padrão inicial e o tema respeita a configuração.

## Validação automatizada

- [x] Manifesto e referências de arquivos verificados.
- [x] Sintaxe dos 48 arquivos JavaScript/MJS verificada.
- [x] 16 testes automatizados aprovados.

**Limite da validação:** os testes automatizados não substituem a execução real no Chrome. Não foi possível validar daqui a sessão do WhatsApp Web do computador, a janela lado a lado, o token emitido pelo painel nem as respostas reais do backend.

## Testes manuais obrigatórios no Chrome

1. Instalar em perfil de teste separado.
2. Usar licença de teste com `whatsapp.connection` e confirmar que o botão abre/reutiliza o WhatsApp.
3. Testar com WhatsApp já conectado, com QR code, em carregamento e sem nenhuma aba aberta.
4. Confirmar que o WhatsApp é movido para uma janela ao lado da extensão sem criar abas duplicadas.
5. Confirmar que usuários comuns não veem nem conseguem executar configurações de marketing.
6. Testar o tour com licença de poucas funções e depois a apresentação geral sem licença.
7. Configurar no backend um `footerAd` ativo e confirmar que aparece no rodapé em diferentes telas.
8. Verificar que, sem consentimento, a telemetria não é enviada e o perfil profissional não é transmitido no pedido de configuração.
9. Testar tema claro/escuro e largura estreita do painel.

## Dependências externas ainda necessárias

- [ ] O painel/backend deve emitir `admin.full_access` (ou uma claim de papel reconhecida) apenas para a licença do proprietário. Sem isso, as ações privadas de marketing ficam bloqueadas.
- [ ] O backend precisa disponibilizar `GET /api/v1/extension/config` e retornar anúncios/notificações públicos já filtrados por plano e regras de campanha.
- [ ] O painel administrativo precisa ter o editor de anúncios e a segmentação; esses arquivos não fazem parte deste pacote da extensão.
- [ ] A integração de telemetria precisa do endpoint de ingestão configurado no backend.
- [ ] Validar a compatibilidade de versões com o painel real antes de distribuir a build.

## Anúncios do Google

A extensão usa um slot nativo de anúncio controlado pelo painel. Não foi incluído script remoto do Google AdSense no side panel. Para anúncios servidos pelo Google, a recomendação é usar uma propriedade web hospedada e elegível; na extensão, usar o slot nativo para campanhas próprias e patrocinadores autorizados.
