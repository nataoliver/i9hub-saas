# Follow-up programado — i9Hub v1.2.8

## Visão geral
O módulo permite programar mensagens de acompanhamento diretamente no card do lead, criar sequências com até 10 etapas e acompanhar o resultado em **Follow-ups**.

## Prazos
Cada etapa aceita (os prazos relativos contam a partir do momento em que a sequência é criada):
- Prazo relativo em minutos, horas ou dias.
- Data e hora local específicas.
- Janela máxima de 365 dias.
- Pelo menos 1 minuto de antecedência.

## Variáveis
- `{{nome}}`
- `{{empresa}}`
- `{{servico}}`
- `{{nicho}}`
- `{{proposta}}`
- `{{vendedor}}`

As variáveis são resolvidas com os dados disponíveis no card no momento do agendamento. Se um campo não existir, o conteúdo correspondente fica vazio ou usa um fallback seguro para nome/vendedor.

## Consentimento
- Só é permitido enviar quando existe registro `opted_in`.
- Se não existir registro, o usuário deve confirmar explicitamente que possui autorização específica para follow-up. O i9Hub grava um consentimento separado, limitado a `followup_only`; isso não libera campanhas de marketing.
- Um registro `opted_out` prevalece e não pode ser sobrescrito pela caixa de confirmação.
- Black list, spam e bloqueios prevalecem sobre qualquer configuração de follow-up.

## Interrupção por resposta
O content script detecta novas mensagens recebidas em conversas privadas do WhatsApp Web. Para o service worker, envia somente telefone, ID da mensagem, chatId e data/hora. Não envia o texto da mensagem para o mecanismo de cancelamento.

Se `cancelOnReply` estiver habilitado:
- Follow-ups agendados, vencidos ou com falha são cancelados.
- Um envio em processamento recebe uma marca de cancelamento e é revalidado antes do disparo.
- Se a mensagem já tiver sido entregue ao WhatsApp, não é possível recolhê-la.

A detecção depende de o WhatsApp Web expor um telefone/identificador de conversa válido. Se não for possível identificar o número, o cancelamento por resposta pode não ser detectado.

## Motor de agendamento
- Um alarme `chrome.alarms` por follow-up.
- Estado e dados persistidos em `chrome.storage.local`.
- O service worker recupera alarmes pendentes ao iniciar.
- Se o horário passou enquanto o navegador estava fechado ou a extensão indisponível, o item vira `overdue` e exige ação manual.
- Se o alarme atrasar mais de 15 minutos, não há envio automático.
- Se o WhatsApp estiver desconectado, o item fica aguardando ação.

## Limites padrão
| Regra | Padrão |
|---|---:|
| Intervalo mínimo por contato | 240 minutos |
| Mensagens por contato em 24h | 3 |
| Mensagens totais em 24h | 30 |
| Horário de silêncio | 20h–8h |
| Etapas por sequência | 10 |
| Antecedência mínima | 1 minuto |

Os limites podem ser ajustados em **Follow-ups → Regras de envio e segurança**, respeitando as faixas permitidas.

## Dependências operacionais
- Chrome em execução.
- Extensão habilitada.
- WhatsApp Web conectado.
- Sessão ativa.
- Licença com entitlements correspondentes.
- Contato com autorização aplicável.

## Limitações
- Armazenamento é local ao perfil do Chrome; não sincroniza com outro computador nesta fase.
- A automação usa a ponte existente do WhatsApp Web, não a API oficial.
- Mudanças internas do WhatsApp podem afetar a operação.
- A automação não oficial pode estar sujeita a limitações contratuais e risco para a conta.
- Automações por estágio/etiqueta pertencem à Fase 07 e não estão incluídas nesta entrega.
