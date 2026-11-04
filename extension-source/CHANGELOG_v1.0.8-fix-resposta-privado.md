# Correção v1.0.8 — Resposta da IA no privado

- Corrigido o monitoramento para detectar novas mensagens privadas pela lista de conversas do WhatsApp Web, não apenas dentro de `#main`.
- Quando a IA está ativada, o painel está aberto e o modo inclui conversas privadas, uma mensagem nova detectada na lista pode abrir o chat, ler a última mensagem de texto recebida e encaminhá-la para o fluxo de IA.
- O monitoramento cria um baseline inicial para não responder automaticamente a mensagens antigas já existentes quando a extensão é carregada.
- A fila não interrompe uma conversa que já está aberta; mensagens de outros chats ficam pendentes até a lista de conversas voltar a ficar visível.
- Corrigida a visibilidade dos botões “Ativar Chat com IA” e “Pausar atendimento”, que podiam aparecer juntos apesar do estado real.
- Adicionado um teste de estado da IA para impedir que o observador abra chats quando o atendimento estiver desativado.
- Versão comercial exibida mantida em `1.0.8` e versão do manifesto mantida em `1.0.8.0`; a revisão interna das pontes WhatsApp foi atualizada para `1.0.8.1` para substituir listeners antigos ao recarregar a página.

Observação: a validação automatizada cobre sintaxe e contratos locais; a confirmação definitiva depende de um teste real na sessão do WhatsApp Web, pois a interface DOM pode mudar.
