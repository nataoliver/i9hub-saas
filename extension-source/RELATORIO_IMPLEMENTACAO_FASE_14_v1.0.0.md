# Relatório de implementação — Fase 14
## i9Hub 1.0.0 — Comunicação Avançada do CRM

**Base:** pacote i9Hub 1.9.0 (Fases 01 a 13)  
**Entrega:** i9Hub 1.0.0  
**Catálogo:** v14 — 91 IDs, 89 implementados, 1 planejado e 1 legado não implementado  
**Escopo:** extensão Chrome, integração Gmail e sincronização de modelos/assinaturas pelo Google Drive.

## 1. Entregas implementadas

### Anexos de e-mail
- Até 5 anexos por mensagem.
- Limite combinado de 10 MB.
- Tipos permitidos: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, RTF, ODT/ODS, CSV, TXT, PNG, JPG/JPEG e WEBP.
- Validação no painel e novamente no service worker; extensão, MIME e base64 são verificados antes de montar o MIME.
- O histórico guarda apenas nomes dos anexos, não o conteúdo dos arquivos.

### Assinatura por vendedor
- Campo de assinatura no editor do Gmail.
- Associação pelo ID do vendedor atribuído ao lead; assinatura padrão disponível quando não há vendedor específico.
- Assinaturas são armazenadas localmente por vendedor.
- Limpeza da assinatura gera tombstone com timestamp para que a remoção também seja propagada pelo Drive.

### Respostas recebidas
- A ação **Sincronizar respostas** consulta apenas `threadId` de e-mails enviados pelo i9Hub.
- Em outro computador, a extensão reconstrói os envios a partir dos eventos do lead sincronizados no backup principal, sem depender do registro de envio local original.
- O Gmail `gmail.readonly` é solicitado somente quando o usuário inicia a sincronização; o envio continua usando `gmail.send`.
- Mensagens já vistas são deduplicadas por `messageId`.
- Registra remetente, assunto, data e trecho de até 500 caracteres no histórico do lead.
- Não importa a caixa de entrada inteira nem baixa anexos recebidos.
- Limite de até 100 conversas por execução manual.

### Múltiplas contas Google
- Lista as contas disponíveis no perfil Chrome por `chrome.identity.getAccounts`, quando a API está disponível.
- Seleção, conexão e desconexão por `accountId`.
- Tokens permanecem sob gestão do Chrome Identity; IDs, tokens e contas conectadas não são enviados ao Drive.
- Quando a API do Chrome não expõe outras contas, o usuário precisa adicioná-las ao perfil do navegador e atualizar a lista.

### Indicadores por canal e vendedor
- Conversas WhatsApp abertas pelo CRM.
- E-mails enviados, respostas recebidas, falhas, tentativas incertas e descadastros.
- Visão agrupada por vendedor, usando o responsável associado ao evento/envio.
- Os indicadores são contagens de eventos registrados localmente; abrir WhatsApp não é contado como mensagem enviada.

### Descadastro e autorização
- O card do lead permite registrar descadastro de e-mail.
- Envios ficam bloqueados quando `emailOptedOut=true` ou `emailConsentStatus='opted_out'`.
- Reativação exige confirmação explícita e registro de evidência/origem da nova autorização.
- O histórico guarda eventos de descadastro e reativação.

### Sincronização de modelos e assinaturas
- Novo arquivo separado no Drive: `i9leads-communication-backup.json`.
- Sincroniza modelos personalizados e assinaturas por vendedor.
- Mescla registros por ID e `updatedAt`; tombstones de assinatura propagam exclusões.
- Snapshots diários com retenção de sete dias.
- O arquivo separado evita que versões antigas da extensão removam campos que desconhecem.
- Credenciais OAuth, tokens e contas conectadas não entram no backup.

## 2. Licenciamento

- Catálogo local promovido para v14.
- Novo direito implementado: `crm.communication.email.read`.
- Dependências: `crm.leads` e `crm.communication.email`.
- A ação `SYNC_CRM_EMAIL_REPLIES` exige os três direitos.
- `crm.communication.outlook` permanece `implemented: false` / `status: planned`.
- O painel administrativo/backend não foi modificado neste pacote.

## 3. Arquivos principais

- `lib/crm-communication.js`
- `lib/feature-catalog.js`
- `background/service-worker.js`
- `background/drive-sync.js`
- `sidepanel/components/CommunicationModal.js`
- `sidepanel/components/LeadModal.js`
- `sidepanel/components/CRMView.js`
- `sidepanel/utils/api.js`
- `manifest.json`
- `sidepanel/sidepanel.css`
- `test/crm-communication-phase14.test.js`

## 4. Validação automatizada

- `npm run check`: aprovado; manifesto e 137 arquivos JavaScript/MJS verificados.
- `npm test`: 358 testes aprovados, 0 falhas.
- `npm run validate`: aprovado.

Os testes automatizados validam lógica, contratos, montagem MIME, permissões, interface e estrutura de sincronização. Não substituem OAuth real, envio de mensagem, recebimento de respostas nem teste em dois computadores.

## 5. Pendências de produção

1. Atualizar o painel/backend com o catálogo v14 e disponibilizar `crm.communication.email.read` nos planos escolhidos.
2. Confirmar que `gmail.readonly` está autorizado na tela de consentimento OAuth do projeto Google Cloud. O escopo é solicitado apenas ao sincronizar respostas.
3. Homologar envio com anexos em Gmail real e confirmar os limites/formatos aceitos.
4. Homologar duas ou mais contas Google no mesmo perfil Chrome.
5. Homologar a sincronização do arquivo `i9leads-communication-backup.json` entre dois computadores.
6. Outlook/Microsoft 365 permanece pendente até existir configuração OAuth Microsoft Entra e fluxo Graph homologado.
7. Antes de publicar na Chrome Web Store, escolher uma versão superior à última publicada: o reset para `1.0.0` foi aplicado conforme pedido, mas a loja pode rejeitar downgrade.
