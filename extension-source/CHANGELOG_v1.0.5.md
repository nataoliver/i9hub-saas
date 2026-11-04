# i9Hub v1.0.5 — Etiquetas e listas de campanha

## Objetivo
Sincronizar etiquetas existentes do WhatsApp Business com o CRM e permitir criar listas reutilizáveis para campanhas WhatsApp.

## Alterações
- Melhorada a leitura das coleções de etiquetas e de itens de etiqueta no WhatsApp Web, incluindo coleções expostas como arrays, models ou iteradores.
- As etiquetas sincronizadas passam a ser tags do contato, sem substituir o estágio comercial do CRM.
- Contatos novos com etiquetas entram em `Novo`; contatos existentes mantêm o estágio comercial.
- Migração de estágios sintéticos de etiquetas criados por versões anteriores: removidos do funil e os leads afetados voltam a `Novo`, mantendo as etiquetas como tags.
- Filtro de campanha permite escolher somente uma etiqueta ou grupo, sem obrigar seleção de estágio. A ausência de critérios continua bloqueando o envio acidental para todos.
- Adicionadas listas de campanha salvas localmente, com nome, estágios, etiquetas e grupos; ao carregar, a quantidade é recalculada com os dados atuais do CRM.
- Resumo de sincronização informa etiquetas, contatos, inclusões, atualizações, remoções e contatos adicionados à Black List.
- A etiqueta de Black List continua sendo tratada como bloqueio e nunca como público normal de campanha.

## Preservado
Backend e painel de licenciamento, catálogo de permissões, campanhas existentes, contatos, mapas, chats, licenciamento, layout 90/10 e remoções da v1.0.4C/E. A tela antiga de Públicos de Status não foi reintroduzida.

## Validação
Executar `npm run validate` no pacote. A compatibilidade final das coleções internas de etiquetas precisa ser confirmada na sessão real do WhatsApp Business, pois a interface interna do WhatsApp Web pode mudar.
