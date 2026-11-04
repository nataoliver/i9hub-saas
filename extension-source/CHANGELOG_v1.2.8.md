# i9Hub v1.2.8 — Fase 05: Follow-up programado e relacionamento automático

## Resumo
Implementa agendamento local de mensagens individuais e sequências de follow-up pelo WhatsApp Web, com modelos, painel de acompanhamento, regras de frequência, horário de silêncio, consentimento explícito e interrupção automática quando o contato responde.

## Novidades
- Agendamento por minutos, horas, dias ou data/hora específica.
- Sequências com até 10 etapas.
- Modelos editáveis com variáveis `{{nome}}`, `{{empresa}}`, `{{servico}}`, `{{nicho}}`, `{{proposta}}` e `{{vendedor}}`.
- Página **Follow-ups** no menu e botão de acesso no CRM.
- Lista de agendados, vencidos, enviados, cancelados, falhas e bloqueios.
- Ações de enviar agora, reagendar, cancelar e excluir registros concluídos.
- Cancelamento automático das etapas pendentes quando uma nova mensagem recebida do contato é detectada, se a opção estiver ativada.
- Horário de silêncio configurável (padrão 20h–8h).
- Limite padrão de 4 horas entre mensagens para o mesmo contato, até 3 follow-ups por contato em 24h e 30 no total em 24h.
- Registro de atividades no histórico do lead.
- Armazenamento local persistente em `chrome.storage.local` e alarmes `chrome.alarms`.
- Envio pelo mecanismo de WhatsApp Web já existente, sem WhatsApp Business Platform/Cloud API.

## Segurança e limites
- É exigido consentimento `opted_in`. Se não houver registro, o usuário precisa confirmar explicitamente que possui autorização; a confirmação é registrada como consentimento manual.
- Contatos `opted_out`, Black list, classificados como spam ou bloqueados não recebem follow-up.
- A extensão não envia automaticamente mensagens atrasadas após reinício/indisponibilidade. O registro passa para **Aguardando ação** e exige envio manual ou reagendamento.
- Alarmes atrasados em mais de 15 minutos também passam para revisão manual.
- Envio depende do Chrome aberto, WhatsApp Web conectado e sessão disponível.
- Uma resposta recebida é encaminhada ao service worker somente com telefone, ID da mensagem e data/hora; o texto da conversa não é copiado para o registro de follow-up.
- Não há sincronização dos follow-ups entre dispositivos nesta fase.

## Licenciamento
Catálogo local atualizado para a versão 6. Os três direitos abaixo passaram de planejados para implementados:
- `crm.followup.manage`
- `crm.followup.send`
- `crm.followup.automation`

A integração do painel administrativo permanece pendente, conforme o plano de atualizar o painel somente após concluir as fases da extensão.

## Compatibilidade
- Mantém a versão-base 1.2.7 e os recursos anteriores.
- Versão comercial: `1.2.8`.
- Versão técnica Chrome: `1.2.8.0`.
- ID da extensão e OAuth client ID preservados.
