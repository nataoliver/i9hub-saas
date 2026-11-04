# Relatório de implementação — Fase 06 / i9Hub v1.0.0

## Escopo executado
Integração do Google Calendar à extensão i9Hub, preservando a base v1.2.8 e as funcionalidades anteriores.

## Entregas no código

### OAuth e conexão
- Escopos `calendar.calendarlist.readonly`, `calendar.freebusy` e `calendar.events` adicionados ao manifesto.
- Permissão opcional `https://www.googleapis.com/*` solicitada somente pelo botão Conectar.
- Cliente OAuth existente preservado.
- Token obtido via Chrome Identity; token não é persistido manualmente.
- Lista de calendários e seleção de agenda editável.
- Desconexão local com remoção do token em cache da integração.

### Disponibilidade e reservas
- Consulta FreeBusy real para a agenda selecionada.
- Geração de opções conforme expediente, dias úteis, duração e intervalo configurados.
- Revalidação FreeBusy imediatamente antes da criação.
- Criação de evento com descrição comercial e propriedades privadas para associar lead/evento.
- Chave de idempotência para reaproveitar eventos encontrados após repetição de uma solicitação.
- Lembretes popup nativos do Google Calendar.
- Convite por e-mail apenas mediante marcação explícita.

### CRM
- Seção Google Agenda no card do lead.
- Lista de compromissos associados, links, reagendamento e cancelamento.
- Sincronização da descrição do evento quando dados de identidade do lead são corrigidos.
- Estado `pending` e botão de sincronização manual quando a atualização remota não é possível.

### Confirmação WhatsApp
- Opção para enviar confirmação após a reserva e botão de envio posterior no evento.
- Envio pela ponte já existente do WhatsApp Web, sem Cloud API.
- Verificação de consentimento geral `opted_in`, Black list, classificação spam, horário de silêncio, limites diários e intervalo mínimo.
- Registro do resultado no histórico do CRM e no próprio evento.
- O evento permanece criado mesmo se a confirmação falhar.

### Licenciamento
- Catálogo local v7.
- Ativos: `google.calendar.connect`, `google.calendar.availability`, `google.calendar.booking`.
- `google.calendar.automation` permanece não implementado e bloqueado para Fase 07.
- A ação `CALENDAR_SEND_CONFIRMATION` exige também `whatsapp.connection` e permissões de conformidade.
- Painel administrativo não alterado.

## Arquivos principais
- `manifest.json`
- `lib/google-calendar.js`
- `lib/feature-catalog.js`
- `background/service-worker.js`
- `sidepanel/components/SettingsView.js`
- `sidepanel/components/LeadModal.js`
- `sidepanel/utils/api.js`
- `sidepanel/sidepanel.css`
- `test/google-calendar-v1.0.0.test.js`

## Validação
Executar `npm run validate` na raiz do projeto. O resultado esperado desta entrega é:
- Manifesto e arquivos JS/MJS validados.
- Testes automatizados de catálogo, OAuth/manifesto, geração de disponibilidade, payloads de evento, licenciamento, interface e conformidade.
- Nenhum teste automatizado substitui a homologação de OAuth e Google Calendar com uma conta real.

## Pendências externas
1. Habilitar Google Calendar API no Google Cloud.
2. Adicionar os escopos ao consentimento OAuth e revisar o estado de publicação/verificação do aplicativo.
3. Testar conexão, FreeBusy, criação, convite por e-mail, lembretes, reagendamento e cancelamento com uma conta Google real.
4. Atualizar posteriormente o painel administrativo com os três IDs Calendar e dependências.

## Limites intencionais
- Nenhuma automação por estágio/etiqueta foi ativada; pertence à Fase 07.
- A extensão não usa API oficial do WhatsApp.
- A confirmação WhatsApp só é enviada com consentimento e compliance aprovados; não há bypass quando faltam permissões.
