# Guia de teste — i9Leads Flow 5.4.0

## 1. Instalação de teste

1. Faça uma cópia de segurança da extensão atual e dos dados locais importantes.
2. Descompacte o ZIP em uma pasta própria.
3. Abra `chrome://extensions`, ative o Modo do desenvolvedor e carregue a pasta que contém `manifest.json`.
4. Não substitua a instalação de produção até concluir os testes em perfil de Chrome separado.
5. Use uma licença de teste emitida pelo painel com os entitlements da v5.4.0.

## 2. Gate de licença

- [ ] Sem licença, é possível explorar a interface, mas não executar ações.
- [ ] Licença sem `ent` não libera módulos.
- [ ] Licença com `admin.full_access` libera os módulos de teste.
- [ ] Licença com apenas `crm.leads` não libera atendimento IA, públicos, marketing, notificações ou anúncios.
- [ ] Revogar licença impede novas ações protegidas.
- [ ] Nenhum módulo novo quebra a ativação da licença antiga.

## 3. Atendimento IA (teste controlado)

Pré-requisitos: WhatsApp Web conectado, painel da extensão aberto, provedor e modelo válidos, chave BYOK, permissão do host do provedor, planilha Google Sheets acessível e aba com o nome configurado, número do vendedor configurado.

- [ ] Salvar configuração sem chave não substitui uma chave existente.
- [ ] Teste de API válido retorna sucesso; chave inválida apresenta erro claro.
- [ ] Testar limite de 8 mensagens por conversa/minuto e 40 mensagens globais/minuto.
- [ ] Teste Google Sheets confirma planilha e nome exato da aba.
- [ ] Ativar sem os pré-requisitos é recusado.
- [ ] Com o atendimento ativo, uma mensagem nova recebida na conversa aberta pode gerar resposta.
- [ ] A mesma mensagem não deve gerar respostas duplicadas.
- [ ] Pergunta sem intenção de pedido não cria linha de pedido.
- [ ] Pedido válido grava uma linha com ID único e status `awaiting_approval`.
- [ ] Repetir a mesma solicitação dentro da janela de deduplicação não cria uma segunda linha.
- [ ] A notificação ao vendedor é enviada pela sessão do WhatsApp Web, sem API oficial do WhatsApp.
- [ ] A confirmação ao cliente só é enviada após o registro; se o aviso ao vendedor falhar, o texto não afirma que o encaminhamento foi concluído.
- [ ] Simular falha de gravação, confirmar que o pedido fica em erro local, testar “Reenviar para planilha” e verificar que uma tentativa repetida não duplica a linha.
- [ ] Pedido de atendimento humano cria uma transferência e pausa respostas automáticas daquele chat.
- [ ] A ação “Retomar IA” libera a conversa para novas respostas automáticas.
- [ ] Marcar venda fechada permite informar valor opcional e atualiza as colunas de status/valor quando o Sheets está acessível.
- [ ] Fechar o painel por mais de 45 segundos faz o runtime ficar inativo.
- [ ] Desconectar WhatsApp ou perder acesso ao provedor/Sheets não produz confirmação falsa.

**Limitação:** testar primeiro com uma conta de WhatsApp de laboratório e um contato de teste. Esta build não varre confiavelmente conversas fechadas/arquivadas.

## 4. Públicos de Status

- [ ] Carregar etiquetas com WhatsApp Business conectado.
- [ ] Selecionar etiquetas e confirmar a prévia dos contatos.
- [ ] Excluir um contato da prévia e verificar que ele não entra no CSV.
- [ ] Salvar, carregar e excluir um público.
- [ ] Exportar CSV e verificar cabeçalho e acentuação.
- [ ] Confirmar que a extensão não publica Status nem altera a privacidade automaticamente.

## 5. Telemetria

- [ ] Definir nicho/ocupação opcional e salvar preferências.
- [ ] Conferir que a fila local aumenta após ações de uso.
- [ ] Desativar telemetria e confirmar que a fila é limpa e não enviada.
- [ ] Com entitlement de telemetria, testar `POST /api/v1/telemetry/events`.
- [ ] Simular endpoint 404 e confirmar que a interface informa a pendência sem quebrar outros módulos.
- [ ] Reenviar o mesmo lote e confirmar deduplicação pelo ID do evento no backend.
- [ ] Confirmar ausência de conteúdo de mensagem, telefones, nomes de contato e chaves de API nos eventos.

## 6. Notificações e anúncios

- [ ] O backend implementa `GET /api/v1/extension/config`.
- [ ] Testar campanha para todos e campanha segmentada por plano, nicho, função e recurso.
- [ ] Testar datas de início/fim, dispensar, botão e URL HTTPS.
- [ ] Testar anúncio de rodapé com imagem, texto, botão e link HTTPS.
- [ ] Confirmar que não é executado HTML/JavaScript remoto.
- [ ] Conferir eventos de exibição, clique e dispensa na telemetria.

## 7. Marketing

- [ ] Salvar IDs públicos de GTM/GA4/Google Ads/Meta.
- [ ] Confirmar que a configuração fica local mesmo se o endpoint do backend não existir.
- [ ] Com `POST /api/v1/extension/marketing-config` implementado, confirmar sincronização.
- [ ] Confirmar que GTM roda no site próprio, não dentro do WhatsApp Web.

## 8. Regressão obrigatória

- [ ] CRM: criar/editar/excluir lead, alterar etapa, deduplicar e exportar.
- [ ] WhatsApp: conectar, desconectar, abrir chat pendente e testar envio existente.
- [ ] Campanhas WhatsApp: criar, pausar, retomar e parar.
- [ ] Google Maps: iniciar e parar extração.
- [ ] Google Drive: conectar, sincronizar e restaurar em conta de teste.
- [ ] RCS: verificar telas e permissões sem enviar campanhas reais.
- [ ] Painel de licenças: ativar, atualizar, expirar e revogar licença.
- [ ] Atualizar o backend e confirmar que as versões de extensão suportadas continuam conectando.

## 9. Aprovação de release

Não publicar para todos os usuários até os testes de integração, segurança e regressão serem concluídos com o backend real e uma sessão real do WhatsApp Web. O resultado do `npm run validate` é uma validação automatizada, não uma certificação de operação em produção.
