# i9Hub v1.0.0 — Fase 06: Integração com Google Agenda

## Resumo
Adiciona integração OAuth do Google Calendar à extensão, consulta de disponibilidade real, reserva e gerenciamento de compromissos pelo card do CRM, lembretes nativos do Google Agenda e atualização da descrição dos eventos quando os dados do lead são corrigidos.

## Novidades
- Nova aba **Google Agenda** em Configurações.
- Conexão da conta Google por `chrome.identity.getAuthToken`, com solicitação explícita da permissão de origem `https://www.googleapis.com/*`.
- Seleção de agendas com permissão de edição (`owner` ou `writer`).
- Configuração de dias úteis, expediente, duração padrão, intervalo entre horários e lembrete.
- Consulta de disponibilidade via Google Calendar FreeBusy.
- Reserva de compromissos diretamente no card do lead.
- Descrição do evento com nome, empresa, telefone, e-mail, serviço, nicho, estágio, etiquetas e observação disponível no CRM.
- Lembretes popup configurados no evento do Google Calendar.
- Convite por e-mail opcional; só é enviado quando o usuário marca a opção no agendamento.
- Reagendamento e cancelamento dos compromissos pelo card.
- Atualização automática da descrição de eventos associados quando o usuário corrige os dados do lead; falhas ficam pendentes e podem ser sincronizadas manualmente.
- Chave de idempotência privada no evento para reduzir reservas duplicadas em caso de repetição da solicitação.
- Confirmação WhatsApp opcional após a reserva, usando WhatsApp Web local e exigindo consentimento `opted_in`, ausência de Black list/spam, horário permitido e limites de frequência. O envio não usa WhatsApp Business Platform/Cloud API.

## Segurança e privacidade
- Tokens OAuth são gerenciados pelo Chrome Identity e não são gravados em `chrome.storage.local`.
- A desconexão remove o token em cache utilizado pela integração e preserva os eventos existentes no Google Calendar. Para revogar integralmente a autorização OAuth, o usuário deve removê-la nas configurações da própria Conta Google.
- O convite por e-mail é opcional e explícito.
- A confirmação por WhatsApp é opcional e só é tentada após ação/seleção explícita; se não houver consentimento, WhatsApp conectado ou condições de compliance, o evento permanece reservado e a mensagem não é enviada.
- A extensão usa o fuso horário local do navegador para montar os horários e envia esse fuso à API.
- A integração não lê conteúdo de e-mails nem outros dados da conta Google.

## Licenciamento
Catálogo local atualizado para v7. Os seguintes IDs passam a ser implementados:
- `google.calendar.connect`
- `google.calendar.availability`
- `google.calendar.booking`

A confirmação WhatsApp utiliza `google.calendar.booking` junto de `whatsapp.connection`, `compliance.consent_tracking`, `compliance.optout_management` e `compliance.frequency_limits`.

`google.calendar.automation` continua planejado e bloqueado para a Fase 07. O painel administrativo não foi alterado.

## Configuração externa necessária
- Habilitar Google Calendar API no projeto Google Cloud usado pelo OAuth client existente.
- Adicionar os três escopos Calendar ao consentimento OAuth do projeto.
- Manter o mesmo OAuth Client ID e o mesmo ID da extensão.
- Recarregar a extensão, autorizar a origem Google e conectar a conta na aba Configurações → Google Agenda.

Ver `docs/GOOGLE_CALENDAR_SETUP.md`.

## Limitações conhecidas
- A conexão e as preferências são locais ao perfil Chrome/dispositivo. Os eventos ficam na conta Google, mas os metadados do vínculo com o lead ficam no armazenamento local da extensão.
- O navegador precisa estar aberto para usar a interface e enviar confirmações pelo WhatsApp Web. A integração Calendar não usa servidor próprio nem WhatsApp API oficial.
- Regras automáticas por estágio e etiqueta pertencem à Fase 07 e não estão liberadas nesta versão.
- O OAuth e as chamadas reais ao Google precisam ser homologados com o projeto Google Cloud de produção; os testes automatizados não substituem esse teste de conta real.

## Compatibilidade
- Versão comercial: `1.0.0`.
- Versão técnica Chrome: `1.0.0.0`.
- ID da extensão e OAuth Client ID preservados.
- Escopo do Google Sheets permanece explícito no fluxo de autenticação do Sheets para não solicitar escopos Calendar quando o usuário só sincroniza planilhas.
