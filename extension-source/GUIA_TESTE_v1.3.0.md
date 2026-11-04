# Guia de homologação — i9Hub v1.3.0

## Pré-requisitos
1. Instalar a extensão v1.3.0 em perfil de teste do Chrome.
2. Ativar uma licença que contenha `google.calendar.automation`, `google.calendar.connect`, `google.calendar.availability`, `google.calendar.booking` e `crm.kanban`.
3. Conectar uma conta Google Calendar com permissão de edição.
4. Configurar dias úteis e horário de expediente.
5. Usar leads de teste sem dados reais desnecessários.

## Teste A — regra por etapa com retorno relativo
1. Em Configurações → Google Agenda, crie uma regra com gatilho "Lead entrar em uma etapa".
2. Selecione a etapa Proposta.
3. Ação: "Criar compromisso após um intervalo".
4. Configure 2 dias, 10:00, 30 minutos.
5. Deixe aprovação desmarcada e confirmação WhatsApp desmarcada.
6. Mova um lead de outra etapa para Proposta.
7. Verifique se o evento é criado na agenda escolhida, com dados do lead e propriedade privada de idempotência.
8. Mova o mesmo lead novamente dentro da mesma etapa: não deve duplicar.
9. Faça uma transição nova para outra etapa e depois retorne à etapa de gatilho: deve ser tratada como nova transição.

## Teste B — etiqueta que solicita agendamento
1. Crie regra por etiqueta exata `visita`.
2. Ação: "Solicitar agendamento ao vendedor".
3. Sincronize a etiqueta do WhatsApp Business ou adicione a etiqueta por importação de CRM.
4. Confira a pendência em "Ações aguardando revisão".
5. Clique em "Abrir lead", selecione o horário no card e reserve manualmente.
6. A pendência deve ser marcada como concluída depois da reserva.

## Teste C — etiqueta de reunião confirmada usando dados do card
1. Preencha os campos `appointmentDate` (`AAAA-MM-DD`) e `appointmentTime` (`HH:mm`) no lead, ou crie campos personalizados equivalentes.
2. Crie regra por etiqueta `reuniao_confirmada`.
3. Ação: "Criar compromisso usando data/hora do card".
4. Adicione/sincronize a etiqueta.
5. Confirme evento criado no horário do card.
6. Teste data ausente, data inválida, horário ocupado e data passada: deve gerar pendência, não evento falso.

## Teste D — conflito e expediente
1. Crie uma regra para um horário que já esteja ocupado.
2. Dispare a regra.
3. Deve surgir pendência com horário sugerido e motivo do conflito.
4. Teste fim de semana e horário fora do expediente: não deve criar evento.

## Teste E — aprovação humana
1. Ative "Exigir aprovação do vendedor" numa regra de evento relativo.
2. Dispare a regra.
3. Nenhum evento deve ser criado automaticamente.
4. A pendência deve exibir o horário sugerido quando calculável.

## Teste F — confirmação WhatsApp
1. Use apenas um contato de teste que tenha consentimento `opted_in`.
2. Ative confirmação WhatsApp numa regra.
3. Confirme que a reserva ocorre primeiro.
4. Com WhatsApp conectado e dentro do horário permitido, a confirmação pode ser enviada.
5. Teste sem consentimento, Black list, horário de silêncio e limite diário: não enviar; o evento permanece na agenda.

## Teste G — licença
- Sem `google.calendar.automation`: não listar/salvar regras nem executar automações.
- Com `google.calendar.automation`, mas sem dependências: acesso negado.
- Com todas as dependências: regras podem ser gerenciadas.
- Revogar licença: nenhuma nova automação pode criar eventos.

## Testes automatizados
Executar:
```bash
npm run check
npm test
npm run validate
```

A aprovação automatizada não substitui o teste OAuth/FreeBusy/eventos com uma conta Google real.
