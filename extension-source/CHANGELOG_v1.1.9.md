# i9Hub 1.1.9 — Gerenciador de personalidades da IA

## Novidades
- Gerenciador de perfis no Chat com IA: criar a partir de modelos, duplicar, selecionar e excluir (mantendo pelo menos um perfil; limite de 20).
- Perfil independente para cada público com nome, descrição interna, modo de atuação, nome da empresa/contexto, instruções, base de conhecimento, mensagem inicial, ativação de qualificação, estágio, confiança e critérios.
- Modelos iniciais: Networking e parcerias; Autoconhecimento e acolhimento; Prospecção comercial consultiva.
- A configuração antiga é migrada para “Atendimento atual” sem substituir o prompt existente.
- O perfil selecionado só passa a atuar no atendimento automático depois de salvar.
- O modo de networking evita abordagem comercial não solicitada e restringe os dados escritos no CRM a informações profissionais relevantes.
- O modo de autoconhecimento desativa qualificação comercial e evita gravar reflexões pessoais no card do CRM.
- O modo comercial preserva o fluxo de qualificação e captura de pedidos.
- Perfis são armazenados junto às preferências da IA e acompanham a sincronização de configuração já existente no Google Drive; as chaves API continuam tratadas separadamente.

## Limites conhecidos
- A seleção de personalidade é global para as conversas autorizadas; seleção individual por campanha ou por grupo pode ser uma fase futura.
- O provedor, modelo e credenciais API são compartilhados entre perfis.
- A validação automatizada não substitui teste real no WhatsApp Web e no Google Drive.
