# i9Hub v1.2.7 — Fase 04: IA observadora

## Novidades

- Adicionado modo de operação por personalidade: `auto_reply` ou `observe_only`.
- IA observadora analisa mensagens autorizadas e atualiza a inteligência estruturada do lead no CRM.
- O modo observador não envia mensagens ao contato nem ao vendedor, não cria pedidos, não executa handoff e não movimenta estágios do funil.
- Adicionado prompt específico de observação, com proteção contra instruções contidas nas mensagens e orientação para ignorar dados pessoais sensíveis.
- Atualizações relevantes da IA observadora entram na linha do tempo do CRM como atividade automática, sem virar anotação manual editável.
- Card do CRM identifica quando a inteligência foi atualizada pela IA observadora.
- Central de Execução separa análises que atualizaram o CRM de respostas efetivamente enviadas.
- `AI_GET_STATUS`, `AI_INBOX_CHECK`, salvamento de configuração e ativação validam o entitlement `ai.mode.observe_only`.
- O catálogo de funcionalidades passou para a versão 5; `ai.mode.observe_only` está implementado e depende de `whatsapp.ai_support` e `crm.leads`.
- Versão técnica e comercial atualizadas para 1.2.7.

## Compatibilidade

- Perfis antigos sem `operationMode` continuam em `auto_reply`.
- O modo é salvo por personalidade e acompanha as atribuições de grupos/conversas existentes.
- Perfis de autoconhecimento não podem usar o modo observador.
- O contrato de tokens Ed25519 e a API do painel não foram alterados nesta entrega.

## Limites

- A extensão, o painel lateral e o WhatsApp Web precisam permanecer abertos/conectados para processar mensagens.
- A IA envia o contexto necessário ao provedor de IA escolhido pelo usuário. Custos e retenção do provedor seguem as condições do provedor.
- O conteúdo bruto só é registrado no Google Sheets se o usuário já tiver ativado explicitamente o histórico de conversas.
- A integração do catálogo no painel administrativo será feita posteriormente, conforme o fluxo combinado.
