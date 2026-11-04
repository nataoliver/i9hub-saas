# Relatório de implementação — Fase 05 / i9Hub v1.2.8

## Escopo
Implementar follow-up programado e relacionamento automático na extensão, sem alterar o painel administrativo.

## Implementado
1. Catálogo de funcionalidades v6 e ativação dos IDs de follow-up.
2. Módulo puro `lib/followup-scheduler.js` para validação de horários, modelos, estados, limites e horário de silêncio.
3. Persistência local de agendamentos, configurações e modelos em `chrome.storage.local`.
4. Alarmes individuais `chrome.alarms` para cada follow-up.
5. Reconciliação na inicialização: itens vencidos durante indisponibilidade passam para revisão manual, sem envio automático atrasado.
6. Ações no service worker para consultar, criar, sequenciar, cancelar, reagendar, enviar agora, excluir e configurar follow-ups.
7. Envio direcionado ao número do lead por meio da ponte existente do WhatsApp Web.
8. Detecção de mensagens recebidas em conversas privadas e cancelamento das etapas pendentes quando configurado.
9. Proteções de consentimento, opt-out, Black list, spam, licença, horário de silêncio e frequência.
10. Histórico do CRM recebe eventos de agendamento, envio, cancelamento, reagendamento e bloqueio.
11. Nova página Follow-ups com indicadores, filtros, regras de envio e biblioteca de modelos.
12. Composer dentro do card do lead com sequências de até 10 etapas, prazos relativos e datas personalizadas.
13. Tour atualizado para explicar a funcionalidade.

## Estados
`scheduled`, `processing`, `sent`, `failed`, `overdue`, `cancelled`, `blocked_consent`, `blocked_blacklist`, `blocked_spam`, `blocked_license` e `blocked_frequency`.

## Regras padrão
- Janela de silêncio: 20:00–08:00 (horário local), habilitada.
- Intervalo mínimo entre mensagens para o mesmo contato: 240 minutos.
- Máximo por contato em 24 horas: 3.
- Máximo global em 24 horas: 30.
- Até 10 etapas por sequência.
- Agendamento máximo: 365 dias.
- Atraso máximo tolerado de alarme automático: 15 minutos; depois disso exige revisão manual.

## Arquivos principais
- `lib/followup-scheduler.js`
- `lib/feature-catalog.js`
- `lib/message-gate.js`
- `background/service-worker.js`
- `content/content.js`
- `content/injected.js`
- `sidepanel/utils/api.js`
- `sidepanel/components/LeadModal.js`
- `sidepanel/components/FollowupsView.js`
- `sidepanel/components/CRMView.js`
- `sidepanel/components/Header.js`
- `sidepanel/utils/router.js`
- `sidepanel/sidepanel.js`
- `sidepanel/sidepanel.css`
- `sidepanel/components/Tour.js`

## Resultado dos validadores
- `npm run check`: aprovado; manifesto e 120 arquivos JS/MJS verificados.
- `npm test`: 289 testes aprovados, 0 falhas.
- `npm run validate`: aprovado.

## Não executado
- Não foi feito teste manual em uma sessão real do WhatsApp Web.
- Não foi feito teste real de envio, resposta, desconexão ou reinício do Chrome.
- Não foi alterado nem implantado o painel administrativo.
- Não existe sincronização de follow-ups entre dispositivos.
- Não há automação por estágio/etiqueta nesta fase; isso permanece na Fase 07.
- Google Calendar permanece na Fase 06.

## Observações de produção
O mecanismo utiliza automação local da interface/Store do WhatsApp Web e depende da estrutura interna do WhatsApp, que pode mudar. O uso de automação não oficial pode estar sujeito às regras e limitações do WhatsApp e pode gerar risco operacional para a conta. A extensão não usa a API oficial.
