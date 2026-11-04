# Guia de homologação — Fase 14 / i9Hub 1.0.0

## Preparação
1. Faça backup em **Configurações → Dados → Exportar Backup**.
2. Atualize os arquivos na mesma pasta da extensão.
3. Não desinstale nem remova a extensão; preserve o mesmo ID.
4. Confirme que o Google Drive está conectado e a sincronização automática ativa.
5. Use leads e contas de teste antes de utilizar dados de clientes.

## A — Anexos Gmail
1. Abra um lead de teste e clique em **Enviar e-mail**.
2. Conecte a conta Gmail.
3. Anexe um PDF pequeno e envie para uma caixa de teste autorizada.
4. Confirme que o Gmail recebeu o arquivo e que o histórico do lead mostra apenas o nome do anexo.
5. Teste 6 arquivos, arquivo acima de 10 MB e extensão `.exe`; todos devem ser recusados antes do envio.

## B — Assinaturas por vendedor
1. Atribua o lead ao vendedor A e salve uma assinatura.
2. Abra outro lead atribuído ao vendedor B e salve assinatura diferente.
3. Reabra ambos e confirme que cada assinatura é carregada corretamente.
4. Limpe a assinatura de A e confirme que ela não reaparece após sincronizar o Drive.

## C — Respostas Gmail
1. Envie um e-mail de teste pelo CRM para uma caixa controlada.
2. Responda ao e-mail a partir da caixa destinatária.
3. No mesmo lead, clique em **Sincronizar respostas**.
4. Autorize o escopo Gmail somente leitura quando solicitado.
5. Confirme que remetente, assunto, data e trecho limitado são registrados no histórico.
6. Clique novamente; a mesma resposta não deve ser duplicada.
7. Confirme que o corpo integral e anexos recebidos não são importados.

## D — Múltiplas contas
1. Adicione uma segunda conta Google ao perfil do Chrome.
2. Clique em **Atualizar contas** no editor do e-mail.
3. Selecione cada conta, conecte e envie e-mails para caixas de teste diferentes.
4. Confirme que o envio usa a conta selecionada e que desconectar uma conta não desconecta as outras.
5. Confirme que a seleção de conta permanece local ao dispositivo e não vai para o Drive.

## E — Descadastro
1. No card de um lead de teste, registre o descadastro.
2. Abra o editor de e-mail e confirme que o envio está bloqueado.
3. Tente enviar por ação direta; o service worker também deve bloquear.
4. Tente reativar sem evidência ou sem confirmação; deve falhar.
5. Registre uma nova autorização válida com evidência, confirme a caixa e reative.
6. Confira os dois eventos no histórico do lead.

## F — Indicadores
1. Abra algumas conversas WhatsApp pelos cards do CRM.
2. Envie e-mails, responda a alguns e provoque uma falha controlada.
3. Abra **CRM → Comunicação comercial → Ver por vendedor**.
4. Confira conversas abertas, e-mails enviados, respostas, falhas e descadastros.
5. Confirme que os totais por vendedor correspondem aos eventos dos leads de teste.

## G — Sincronização Google Drive
1. No computador A, crie um modelo personalizado e uma assinatura para um vendedor.
2. Aguarde o push automático ou clique em **Sincronizar agora**.
3. No computador B, sincronize e confirme a chegada dos modelos e assinaturas.
4. Altere o mesmo modelo nos dois computadores em momentos diferentes e confirme a versão mais recente.
5. Apague uma assinatura no computador A; sincronize e confirme que o tombstone remove a assinatura no computador B.
6. Verifique o arquivo `i9leads-communication-backup.json` e os snapshots diários.

## H — Outlook / Microsoft 365

A integração ainda não está habilitada. Não considerar homologada nesta fase. A pendência depende de registro de aplicativo Microsoft Entra, Client ID, URI de redirecionamento e fluxo OAuth/Graph.

## Critérios de aprovação
- Anexos válidos chegam ao destinatário; tipos proibidos e limites são bloqueados.
- Assinaturas por vendedor são preservadas e exclusões sincronizam.
- Respostas do Gmail são importadas uma vez, sem baixar a caixa inteira.
- Múltiplas contas usam o remetente selecionado.
- Descadastro bloqueia o envio e reativação exige evidência.
- Indicadores batem com eventos registrados.
- Modelos e assinaturas chegam ao segundo computador sem sincronizar credenciais.
