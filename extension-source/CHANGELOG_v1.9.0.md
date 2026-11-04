# i9Hub v1.9.0 — Fase 13

## Comunicação Inteligente e Atendimento pelo CRM

### Novidades
- Ação **Chamar no WhatsApp** nos cards do CRM em Tabela e Kanban.
- Abertura da conversa correspondente pelo número do lead no WhatsApp Web, reutilizando a sessão conectada; se necessário, abre o WhatsApp Web para conexão.
- Ação **Enviar e-mail** nos cards e no detalhe do lead.
- Composer de e-mail dentro do CRM, com destinatário editável, assunto, mensagem e modelos.
- Integração de envio com Gmail API usando o escopo mínimo `gmail.send`.
- Modelos padrão: primeiro contato, envio de proposta e acompanhamento.
- Modelos personalizados salvos localmente no perfil Chrome.
- Variáveis nos modelos: `{{nome}}`, `{{empresa}}`, `{{produto}}` e `{{vendedor}}`.
- Histórico do CRM registra abertura da conversa WhatsApp e resultado de envio de e-mail, sem guardar o corpo da mensagem.
- Confirmação manual de autorização antes de cada envio de e-mail.
- Bloqueio de envio quando o lead tem `emailOptedOut=true` ou `emailConsentStatus='opted_out'`.
- Proteção contra duplo clique e tratamento de envio com resultado incerto.

### Licenciamento
- Catálogo atualizado para v13: 89 IDs, 88 implementados.
- Novo entitlement: `crm.communication.email`.
- Abrir WhatsApp exige `crm.leads` e `whatsapp.connection`.
- Envio Gmail exige `crm.leads` e `crm.communication.email`.

### Limites desta entrega
- O Gmail é o único provedor de e-mail implementado nesta fase.
- Anexos, sincronização de respostas recebidas, Outlook/Microsoft 365, indicadores de e-mail e gestão visual de descadastro de e-mail ainda não foram implementados.
- O painel administrativo/backend não está incluído no pacote da extensão; deve receber o catálogo v13.
- A integração ainda precisa de homologação manual no Chrome, com WhatsApp Web e Gmail reais.
