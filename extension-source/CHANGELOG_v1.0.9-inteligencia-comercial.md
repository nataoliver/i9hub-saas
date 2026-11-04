# i9Hub 1.0.9 — Inteligência Comercial do Lead

## Objetivo
Transformar as conversas do Chat com IA em informações comerciais estruturadas no card do CRM e na planilha Google Sheets, sem perder o histórico original.

## Implementações
1. A IA agora extrai e atualiza o pedido exato, resumo comercial, necessidade, serviço, segmento, intenção, orçamento, situação do orçamento, prazo, poder de decisão, objeção, evidências, informações pendentes e próxima ação.
2. A ficha comercial é salva no lead local mesmo quando ele ainda não está qualificado. Os estados possíveis são `qualified`, `nurture`, `in_qualification` e `not_qualified`.
3. Quando houver telefone confiável e o lead ainda não existir, a extensão pode criar um card de oportunidade no CRM. Contatos ambíguos não são atualizados por nome.
4. O estágio do CRM só muda para o estágio de qualificado quando os critérios e a confiança configurados são atendidos. A automação não regride leads que já avançaram para Proposta, Fechado, Perdido ou Black list.
5. O card do CRM mostra a Inteligência Comercial, com pedido, resumo, orçamento, status, evidências e próximos passos. A pesquisa do CRM também consulta os campos comerciais.
6. A planilha do histórico agora recebe uma aba `Leads`, com uma linha por lead. A aba `Mensagens` continua preservando os eventos originais.
7. A sincronização da aba `Leads` usa o ID estável do lead para atualizar a linha existente em vez de criar uma linha por mensagem. Falhas ficam em fila local para nova tentativa.
8. O backup existente do Google Drive continua guardando os objetos de lead, incluindo os novos campos de inteligência, por meio do mecanismo de sincronização já existente.

## Compatibilidade e segurança
- A aba `Leads` é criada automaticamente quando o histórico é conectado ou quando a extensão sincroniza a inteligência comercial.
- Os campos não informados permanecem vazios ou são mantidos a partir de dados anteriores; a IA é instruída a não inventar valores.
- A classificação comercial não sobrescreve Black list e não altera automaticamente os estágios Fechado ou Perdido.
- A chave da API não é gravada na planilha de inteligência comercial.

## Testes
Validação de sintaxe, imports locais e testes automatizados da extensão. O acesso real ao WhatsApp Web e à conta Google do usuário precisa ser validado no navegador após a instalação.
