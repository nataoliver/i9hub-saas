# i9Hub 1.1.8 — Persistência segura das configurações da IA

## Fase 1 aplicada

- Adicionado o botão geral **Salvar configurações** ao Chat com IA.
- O salvamento persiste as configurações no armazenamento local e tenta sincronizar imediatamente com o Google Drive quando conectado.
- Adicionado indicador visual de alterações não salvas e feedback explícito sobre a gravação local/sincronização.
- As ações de conectar, ativar/pausar e sincronizar o histórico salvam primeiro qualquer rascunho pendente e não recarregam os campos de prompt após a operação.
- O salvamento mantém os metadados de conexão do Drive na interface, sem descartá-los ao receber a configuração pública do service worker.
- Corrigido o fluxo de conexão do histórico para reler a configuração mais recente antes de gravar os campos da planilha, evitando gravar um objeto antigo que possa substituir instruções editadas durante uma chamada de rede.
- Adicionado `historyUpdatedAt`, separado de `updatedAt` das preferências da IA.
- A mesclagem do Google Drive agora resolve separadamente as preferências do assistente e os metadados do histórico, evitando que uma operação de histórico sobrescreva um prompt mais recente ou que uma edição de prompt remova a planilha conectada.
- Preservada a criptografia das chaves de API; chaves e senhas não são colocadas em texto aberto no backup.

## Verificações

- `npm run check`: aprovado.
- `npm test`: 201 testes aprovados, 0 falhas.

## Testes manuais recomendados

1. Edite “Instruções do atendente”, “Produtos, serviços…” e “Mensagem inicial”. Confirme que o indicador muda para “Há alterações não salvas”.
2. Clique em **Salvar configurações** e confirme o aviso de salvamento local.
3. Com o Google Drive conectado, salve novamente e confirme a mensagem de sincronização concluída.
4. Edite o prompt e clique em “Sincronizar pendentes” no histórico. Confirme que os campos continuam com o texto salvo e que o indicador não retorna a um prompt antigo.
5. Conecte/reconecte o histórico e alterne “Ativar registro”/“Pausar registro”. Confirme que as instruções e critérios permanecem intactos.
6. Em um segundo perfil de Chrome, sincronize o Drive e confira as preferências. A ativação do atendimento continua exigindo validação local do provedor, conforme as proteções existentes.
