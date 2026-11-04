# Guia de homologação — i9Hub v1.2.6

## Preparação

1. Faça backup da pasta atual da extensão.
2. Atualize os arquivos da extensão para a versão 1.2.6 sem remover os dados do perfil Chrome.
3. Acesse `chrome://extensions` e clique em **Recarregar**.
4. Abra o WhatsApp Web e o painel i9Hub.
5. Utilize uma licença de homologação que contenha `crm.leads` e `crm.notes` ou a licença administrativa integral.

## Testes do histórico

- [ ] Abra o CRM e selecione um lead existente.
- [ ] Confirme que a seção **Histórico do relacionamento** aparece no card.
- [ ] Adicione uma anotação com texto simples.
- [ ] Feche e reabra o card; confirme que a anotação continua presente.
- [ ] Recarregue a extensão e confirme a persistência.
- [ ] Edite a anotação e salve.
- [ ] Edite novamente e cancele; confirme que o texto original permanece.
- [ ] Exclua uma anotação e confirme a solicitação de confirmação.
- [ ] Confirme que a anotação removida não aparece mais, mas o evento "Anotação excluída" permanece.
- [ ] Teste uma anotação com acentos, emojis e múltiplas linhas.
- [ ] Teste o limite de 5.000 caracteres.
- [ ] Confirme que notas antigas continuam visíveis.

## Testes da linha do tempo

- [ ] Mova um lead para outro estágio; confira o evento de mudança.
- [ ] Corrija nome ou telefone; confira o evento de dados corrigidos.
- [ ] Altere classificação; confira o evento.
- [ ] Atualize campos personalizados; confira o evento.
- [ ] Sincronize etiquetas do WhatsApp Business; confira a atividade correspondente.
- [ ] Remova etiquetas no WhatsApp e sincronize; confira o evento de remoção.

## Testes de preservação

- [ ] Execute deduplicação em leads de teste com anotações diferentes.
- [ ] Confirme que as anotações dos dois registros foram consolidadas no lead mantido.
- [ ] Confirme que os eventos anteriores também foram preservados.
- [ ] Faça nova sincronização do WhatsApp e confira que as anotações não foram sobrescritas.

## Testes de licença

- [ ] Com licença sem `crm.notes`, confirme que a seção fica bloqueada e as operações são negadas pelo service worker.
- [ ] Com licença contendo `crm.leads` e `crm.notes`, confirme que as operações funcionam.
- [ ] Confirme que `crm.notes` sem `crm.leads` não libera o recurso.

## Observações

- O histórico e as anotações são persistidos no armazenamento local do Chrome junto ao lead.
- O painel administrativo não foi atualizado nesta fase. Planos com entitlements explícitos precisam receber `crm.notes` quando o painel for atualizado.
- Eventos de IA observadora, follow-up e Google Agenda serão adicionados nas respectivas fases futuras.
- A extensão precisa estar instalada e recarregada para validar a interface real.
