# i9Hub 1.2.0 — Fase 3: Personalidades por grupo e campanha

## Novidades
- Personalidade configurável individualmente para cada grupo autorizado do WhatsApp.
- Seletor de personalidade em novas campanhas e na edição de campanhas pausadas/rascunhos.
- Ao confirmar um envio de campanha, o contato privado fica vinculado à personalidade escolhida por 30 dias para as respostas subsequentes.
- Resolução de perfil por contexto: grupo configurado, vínculo da campanha e, como fallback, personalidade global ativa.
- Atribuições privadas usam hash do telefone, evitando armazenar o número em texto aberto dentro do mapa de personalidades.
- Atribuições e configurações de grupo permanecem dentro da configuração da IA já sincronizada com Google Drive.
- Payload de leitura do WhatsApp inclui o ID real do chat para que regras de grupo e personalidades correspondam ao grupo correto.
- Cards de campanha mostram a personalidade selecionada quando há uma atribuição explícita.
- Versão do manifesto, scripts do WhatsApp e pacote atualizada para 1.2.0.

## Regras
- Personalidade específica do grupo tem prioridade para mensagens daquele grupo.
- Em conversas privadas, a personalidade da campanha é usada por 30 dias após o envio confirmado; depois disso, vale a personalidade global.
- Sem atribuição específica válida, usa-se a personalidade global ativa.
- Se um perfil for excluído, atribuições inválidas são descartadas na próxima gravação e o sistema volta ao perfil global.
- A escolha de personalidade não altera os gatilhos globais de resposta em grupos, as permissões de licença ou o estado Ativo/Pausado da IA.

## Validação
- `npm run validate`: manifesto/imports e sintaxe verificados; testes automatizados aprovados.
- Ainda é necessário validar em navegador real a leitura do ID do grupo, a atribuição após envio confirmado e a sincronização Google Drive entre dispositivos.
