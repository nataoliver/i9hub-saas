# Guia de homologação — i9Hub v1.2.8 / Fase 05

## Preparação
1. Faça backup da pasta da extensão v1.2.7.
2. Instale a pasta extraída de `i9Hub-v1.2.8.zip` em `chrome://extensions` usando **Carregar sem compactação**.
3. Abra o WhatsApp Web, conecte a sessão e abra o painel i9Hub.
4. Use uma licença de teste que contenha os entitlements exigidos.
5. Use um contato de teste que tenha autorizado explicitamente receber mensagens.

## Teste A — Agendamento simples
1. Abra o CRM e abra um lead com telefone válido.
2. Entre em **Follow-up programado**.
3. Marque a confirmação de autorização se ainda não houver `opted_in` registrado.
4. Escreva uma mensagem de teste e programe para daqui a pelo menos 1 minuto (para homologação, prefira 2–3 minutos).
5. Confirme que aparece na lista com estado **Agendado**.
6. Mantenha Chrome e WhatsApp Web conectados.
7. Aguarde o horário e confira a mensagem e o estado **Enviado**.

## Teste B — Sequência
1. Crie duas ou três etapas com prazos diferentes (por exemplo, 1 dia, 3 dias e 7 dias).
2. Confirme que todas aparecem no card e na página Follow-ups.
3. Cancele uma etapa e confirme que as demais permanecem.
4. Use **Cancelar sequência** no card para interromper as etapas restantes.

## Teste C — Resposta do cliente
1. Crie uma sequência com `Interromper automaticamente quando o cliente responder` ativado.
2. Envie uma resposta a partir do contato de teste antes do próximo horário.
3. Confirme que as etapas pendentes mudam para **Cancelado**.
4. Confirme que o histórico do lead registra a interrupção.
5. Verifique que o texto da resposta não foi gravado no registro de follow-up.

## Teste D — Consentimento e bloqueios
- Sem consentimento e sem marcar a confirmação: o agendamento deve ser recusado.
- Com opt-out: agendamento deve ser recusado mesmo se a caixa de confirmação for marcada.
- Black list: envio bloqueado.
- Lead classificado como spam: envio bloqueado.
- Licença sem `crm.followup.send`: envio não liberado.
- Limite diário: envio bloqueado ao ultrapassar a configuração.

## Teste E — Horário de silêncio
1. Configure um horário de silêncio curto para teste, por exemplo, início em 00:00 e fim em 23:59 (ou use o período atual dentro da janela).
2. Faça um follow-up vencer durante o período.
3. Confirme que ele é reagendado para o próximo horário permitido, sem envio imediato.

## Teste F — Indisponibilidade
1. Programe um follow-up.
2. Feche o WhatsApp Web antes do horário.
3. Aguarde o horário.
4. Confirme que o item fica **Aguardando ação** e não é marcado como enviado.
5. Reconecte o WhatsApp e use **Enviar agora** ou **Reagendar**.
6. Repita com o Chrome fechado no horário e reabra-o; o item vencido deve exigir revisão manual.

## Teste G — Regressão
- Abrir WhatsApp pela extensão.
- Carregar CRM e cards.
- Editar dados do lead.
- Adicionar e editar anotações.
- Executar IA atendente.
- Executar IA observadora e confirmar que não envia mensagens.
- Abrir campanhas e Central de Execução.
- Confirmar que os fluxos anteriores permanecem disponíveis.

## Critério de aprovação
A fase só deve ser homologada depois de testar o envio real com contato autorizado, cancelamento por resposta, bloqueios de consentimento e comportamento quando o Chrome/WhatsApp estiver indisponível.
