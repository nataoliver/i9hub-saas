# i9Leads Flow 5.3.3 — autorização por licença e onboarding

## Alterações nesta versão candidata

- Removido o modelo antigo de três ações gratuitas locais. Sem licença válida, a extensão fica em modo de demonstração e não executa handlers operacionais.
- Adicionado catálogo canônico de funcionalidades e associação de handlers a IDs de entitlement.
- A autorização falha de forma fechada: handler operacional sem mapeamento, token sem permissões ou função não incluída no token é bloqueado.
- Mantidas exceções mínimas para consultar/ativar/remover licença e para ações de segurança como parar campanhas, parar extração e desconectar o Drive.
- Ao revogar/remover licença, a extensão tenta interromper campanhas em andamento.
- Adicionado onboarding simples: botão para solicitar conta gratuita via WhatsApp `+55 11 95472-1939`, com mensagem que identifica a origem na extensão.
- A chave continua sendo emitida pelo painel e ativada no endpoint de licenças existente.
- Atualizados popup, rodapé do menu, configurações, modal de licença, tutorial e ajuda para remover a referência às três ações gratuitas.
- Adicionado checklist visual de modo demonstração, mantendo a navegação dos módulos e bloqueando ações de interface locais.
- Adicionado ao Dashboard Comercial o bloco de conversas aguardando resposta, calculado pela última mensagem recebida versus a última enviada.
- Adicionado botão para abrir a conversa exata no WhatsApp Web. A abertura usa telefone validado e confirma o cabeçalho; se o número não estiver disponível, não abre um chat ambíguo.
- Adicionados scripts de verificação e testes do catálogo de autorização.

## Dependências para ativação comercial completa

- O backend/painel precisa emitir tokens assinados com `entitlements` compatíveis com `lib/feature-catalog.js`. A ausência de direitos bloqueia deliberadamente os recursos.
- O código atual do painel/backend não foi incluído no pacote de extensão analisado; portanto, a integração final do catálogo com o cadastro de planos ainda precisa ser feita e testada no repositório do painel.
- Telemetria, GTM/pixels, notificações administrativas e anúncios de rodapé dependem das APIs e armazenamento correspondentes no backend. Não devem ser ativados no painel até essa integração ser implementada.
- A ponte `window.postMessage` do WhatsApp continua sendo um risco de segurança conhecido e precisa de auditoria/hardening adicional antes de considerar a extensão “perfeita” para distribuição comercial.
