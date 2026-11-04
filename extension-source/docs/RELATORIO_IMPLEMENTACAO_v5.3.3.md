# Relatório de implementação — i9Leads Flow 5.3.3

**Base de origem:** `i9Leads-Flow-Extensao-v5.3.2-fix1.zip`  
**Estado:** versão candidata para integração e teste manual no Chrome.  
**Validação automatizada:** `npm run validate` — concluída com sucesso no ambiente de desenvolvimento.

## Concluído nesta versão candidata

- [x] Atualizada a versão do manifesto para 5.3.3.
- [x] Removida a regra antiga de três ações gratuitas locais.
- [x] Sem licença válida, os handlers operacionais ficam bloqueados; a interface permanece navegável em modo de demonstração.
- [x] Criado catálogo central de funcionalidades e mapeamento explícito de handlers.
- [x] Direitos ausentes, desconhecidos ou não configurados são negados por padrão.
- [x] O token assinado é a fonte dos entitlements; o plano por nome, sozinho, não concede acesso.
- [x] Criadas exceções limitadas para parar/pausar operações já em andamento e desconectar o Drive.
- [x] Ao remover ou revogar uma licença, a extensão tenta parar campanhas em andamento.
- [x] Adicionado CTA para solicitar conta gratuita pelo WhatsApp `+55 11 95472-1939` no popup, menu lateral, modo de demonstração e modal de licença.
- [x] A mensagem pré-preenchida informa que o interessado veio da extensão e quer uma conta gratuita.
- [x] Mantida a ativação da chave recebida pelo endpoint de licenças existente; o WhatsApp não libera recursos sozinho.
- [x] Atualizados status, ajuda, tutorial, opções e configurações para remover o contador de ações gratuitas.
- [x] Criado contrato documentado para o painel emitir entitlements no token assinado.
- [x] Adicionado ao Dashboard Comercial o bloco de conversas aguardando resposta.
- [x] Adicionado o botão para abrir o chat correspondente no WhatsApp Web, usando telefone validado e confirmação estrita do cabeçalho; se a conversa não puder ser confirmada, a operação falha em vez de abrir um chat ambíguo.
- [x] Se o WhatsApp não estiver aberto, a extensão tenta abrir/reutilizar uma aba; se precisar de QR code, informa ao usuário para conectar e tentar novamente.
- [x] Criados testes automatizados para catálogo, entitlement fail-closed, cobertura dos handlers e CTA de WhatsApp.

## Resultado dos testes automatizados

- [x] Verificação estática de manifesto, sintaxe JS/MJS e imports locais.
- [x] Testes do catálogo e política de autorização: 7 testes aprovados.
- [ ] Teste manual no Chrome com a licença gratuita real emitida pelo painel.
- [ ] Teste manual com token Pro e token administrativo real.
- [ ] Teste manual no WhatsApp Web real para abertura de conversas pendentes.

## Bloqueios que dependem do repositório do painel/backend

O código do painel/backend não estava incluído no ZIP da extensão. Por isso, as seguintes etapas não podem ser consideradas concluídas até que o backend seja integrado e testado:

- [ ] Fazer o painel emitir `ent` com os IDs de `lib/feature-catalog.js` dentro do token assinado.
- [ ] Garantir que a conta gratuita criada pelo atendimento receba os direitos gratuitos selecionados no painel.
- [ ] Alinhar os direitos Pro e a licença administrativa integral.
- [ ] Confirmar que a revogação, limite de dispositivos e operações remotas continuam validados no servidor.
- [ ] Implementar API e armazenamento de telemetria.
- [ ] Implementar APIs para notificações segmentadas e anúncios de rodapé.
- [ ] Integrar Google Tag Manager no site de vendas e configurar encaminhamento seguro de eventos de marketing.
- [ ] Integrar o catálogo de funcionalidades ao formulário de planos e à tela de licenças do painel.

## Atenção antes de usar com clientes reais

1. **Token/entitlements:** se o painel ainda emitir tokens sem IDs reconhecidos, a extensão validará a assinatura mas bloqueará as funções deliberadamente. O painel precisa ser atualizado para emitir o contrato descrito em `CONTRATO_PAINEL_LICENCAS_v5.3.3.md`.
2. **Ponte MAIN-world do WhatsApp:** a ponte existente por `window.postMessage` ainda consta como risco conhecido na documentação da versão-base. A autorização dos handlers do service worker foi reforçada, mas não afirmamos que esse vetor de ponte tenha sido eliminado.
3. **Telemetria, tags, notificações e anúncios:** estão identificados no catálogo como planejados (`implemented: false`). Não habilite esses recursos no painel até implementar e testar as APIs correspondentes.
4. **Sem teste de interface real:** os testes automatizados não substituem o teste de instalação, conexão e execução no Chrome com WhatsApp Web e licença emitida pelo painel.
