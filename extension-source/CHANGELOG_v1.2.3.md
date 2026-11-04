# i9Hub v1.2.3 — Fase 6: Confiabilidade, memória e fila durável

## Novidades
- Fila de entrada persistente em `chrome.storage.local`, processada em ordem, limitada a 100 mensagens ativas e com deduplicação por ID.
- Mensagens pendentes expiram após 24 horas; registros de revisão são mantidos por até 7 dias.
- Mensagem permanece na fila se o heartbeat do painel estiver ausente; o processamento é retomado quando o painel volta a sinalizar atividade.
- Em reinício do service worker durante um item `processing`, o item vira `needs_attention`, perde o payload da fila e aparece no monitoramento. O envio não é repetido automaticamente porque o resultado anterior é incerto.
- IDs finalizados, inclusive mensagens ignoradas por regras de grupo, são mantidos em deduplicação com retenção de até 1.000 IDs.
- Memória estruturada por conversa registra fatos profissionais e operacionais, sem telefone ou transcrição bruta. Networking guarda apenas fatos profissionais; Autoconhecimento não persiste conteúdo da conversa.
- Memória tem timestamp independente e é mesclada por hash de conversa entre dispositivos via configuração do Google Drive, sem sobrescrever prompts mais recentes.
- Central de Execução mostra quantidade de mensagens para revisão e contatos com memória profissional.

## Segurança e limitações
- A fila com conteúdo de mensagens fica somente no armazenamento local do Chrome e não é sincronizada para o Drive.
- Erros de envio ou respostas não confirmadas não são reenviados automaticamente; revise a conversa antes de agir para evitar mensagens duplicadas.
- A memória é estruturada a partir dos campos de qualificação retornados pela IA; ainda depende da qualidade e evidência da resposta do modelo.
- A validação automatizada não substitui testes manuais no Chrome e no WhatsApp Web conectado.
