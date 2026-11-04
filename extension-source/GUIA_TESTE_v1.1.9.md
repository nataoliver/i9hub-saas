# Guia de teste manual — i9Hub 1.1.9

## 1. Instalação e migração
1. Faça um backup em Configurações → Dados → Exportar Backup.
2. Carregue a pasta da versão 1.1.9 em `chrome://extensions` com o modo do desenvolvedor ativado.
3. Abra Chat com IA. A configuração anterior deve aparecer como perfil “Atendimento atual”, com os prompts existentes preservados.
4. Clique em “Salvar configurações” para registrar a migração.

## 2. Criar perfis
1. Em “Personalidades e públicos da IA”, escolha “Networking e parcerias” e clique em “Criar perfil”.
2. Confirme que modo, nome, descrição, instruções, base de conhecimento, mensagem inicial e critérios são preenchidos.
3. Edite nome e prompt, salve, atualize o painel e confirme que os dados continuam presentes.
4. Duplique o perfil, altere o nome e confirme que os dois perfis permanecem independentes.
5. Exclua a cópia e salve. A interface não deve permitir excluir o último perfil.

## 3. Testar comportamento
- Networking: uma mensagem sobre profissão deve permitir perguntar com naturalidade sobre a atuação, sem perguntar orçamento ou oferecer tráfego pago sem convite. O CRM só deve receber nicho/subnicho e informações profissionais sustentadas pela conversa.
- Autoconhecimento: uma mensagem pessoal deve receber acolhimento e uma pergunta cuidadosa, sem diagnóstico, oferta comercial ou registro da reflexão no card do CRM.
- Comercial consultivo: confirme que a qualificação e os critérios comerciais voltam a funcionar somente nesse perfil.
- Troque de perfil, salve e confirme que o perfil escolhido aparece como ativo. Sem salvar, o painel deve indicar que a mudança está pendente.

## 4. Persistência e Drive
1. Edite um perfil, salve e clique em conectar/sincronizar histórico.
2. Confirme que os prompts não foram revertidos.
3. Com o Drive conectado, aguarde a sincronização e confira o perfil em outra instalação autorizada.
4. Confirme que as chaves API não aparecem em texto aberto no backup.

## 5. Regressão
- Teste respostas em conversa privada e em grupo autorizado.
- Teste pausa/ativação, gatilhos de grupo e histórico.
- Verifique console do service worker e do painel se alguma ação falhar.
