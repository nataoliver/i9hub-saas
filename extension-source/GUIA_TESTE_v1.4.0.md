# Guia de homologação — i9Hub v1.4.0 / Fase 08

## Pré-requisitos
1. Instale a extensão v1.4.0 em perfil Chrome de teste.
2. Use licença com `dashboard.commercial_agenda`, `google.calendar.connect`, `google.calendar.availability`, `google.calendar.booking`, `crm.leads`, `crm.kanban` e `crm.followup.manage`.
3. Conecte Google Agenda nas Configurações.
4. Tenha leads de teste com eventos vinculados, follow-ups e histórico CRM.

## Teste A — acesso e atualização
1. Abra o Dashboard.
2. Verifique a seção "Agenda e atividades comerciais".
3. Confirme o nome da agenda e fuso horário exibidos.
4. Clique em Atualizar.
5. Desconecte o Google Agenda: os registros locais devem continuar visíveis e o aviso de conexão deve mudar.

## Teste B — agenda de hoje e próximos 7 dias
1. Crie pelo card de um lead um evento para hoje e outro para os próximos dias.
2. Volte ao Dashboard ou clique em Atualizar.
3. Confirme os eventos na seção correta, com horário, lead e etapa.
4. Clique em Abrir lead e confirme que o card correto aparece.
5. Clique em Abrir no Google Agenda e confirme que o evento correspondente é aberto.
6. Eventos externos sem vínculo com lead não devem ser apresentados como se fossem eventos CRM.

## Teste C — cancelar compromisso futuro
1. Na agenda do Dashboard, selecione um evento futuro.
2. Clique em Cancelar e confirme.
3. O evento deve ser cancelado no Google Agenda e marcado como cancelado no card.
4. Atualize o Dashboard; ele não deve aparecer entre os próximos compromissos.

## Teste D — resultado da reunião
1. Use um compromisso cujo horário final já passou.
2. Clique em Realizada.
3. Confirme que a ação é registrada no card do lead e no histórico.
4. Faça outro teste com Não compareceu.
5. Tente marcar um evento futuro: o service worker deve rejeitar a operação.
6. Atualize o Dashboard e confirme os indicadores de realizadas/ausências.
7. Reagende um evento que já tenha resultado apenas se o fluxo de negócio permitir; confirme manualmente o histórico, pois o resultado é um registro comercial local.

## Teste E — follow-ups
1. Tenha um follow-up agendado com horário passado e outro futuro.
2. Confirme a separação entre "Follow-ups vencidos" e "Próximos follow-ups".
3. Clique em Abrir lead.
4. Clique em Ver todos os follow-ups e confirme que a tela Follow-ups abre.

## Teste F — leads sem próxima ação
1. Mantenha um lead em estágio aberto sem evento futuro e sem follow-up futuro.
2. Confirme que aparece em "Leads sem próxima ação".
3. Adicione um compromisso futuro ou follow-up futuro e atualize o Dashboard.
4. O lead deve sair da lista.
5. Leads fechados e leads na Black list não devem entrar nessa lista.

## Teste G — pendências e atividades
1. Gere uma pendência de automação na Fase 07.
2. Confirme que aparece em "Pendências de automação".
3. Abra o lead pela pendência.
4. Dispense uma pendência de teste e confirme que ela sai da lista.
5. Registre uma anotação ou mude o estágio de um lead; confira "Atividades recentes".

## Teste H — licenciamento
- Sem `dashboard.commercial_agenda`: seção bloqueada e nenhuma consulta do endpoint.
- Sem dependências de Google Agenda/CRM: acesso negado.
- Com todos os entitlements: consulta e ações liberadas.
- Sem `google.calendar.booking`: registrar resultado de reunião deve ser bloqueado.

## Testes automatizados
Executar:
```bash
npm run check
npm test
npm run validate
```

A suíte automatizada não substitui testes com Google OAuth e uma agenda real de homologação.
