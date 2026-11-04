# Relatório de implementação — Fase 13 / i9Hub v1.9.0

## Resultado
Implementada a Central de Comunicação do CRM, preservando as funcionalidades das Fases 01 a 12.

## 1. WhatsApp pelo card do CRM
- Botões de abertura de conversa adicionados à visualização Tabela e Kanban.
- Ação também disponível no detalhe do lead.
- A extensão resolve o lead pelo identificador persistido e usa o telefone atual cadastrado.
- Valida telefone com 10 a 15 dígitos antes de abrir.
- Reutiliza a sessão conectada do WhatsApp Web; quando não existe sessão pronta, abre/reutiliza a aba e orienta a conexão pelo QR code.
- Ativa a aba/janela do WhatsApp antes de abrir a conversa.
- Usa a ponte já existente `OPEN_CHAT_BY_PHONE`; não envia mensagem automaticamente.
- Registra `communication.whatsapp.opened` no histórico do lead depois que a conversa é aberta com sucesso.

## 2. Envio de e-mail pelo CRM
- Botões de e-mail adicionados aos cards Tabela/Kanban e ao detalhe do lead.
- Composer com destinatário, assunto, corpo, seleção de modelos e salvamento de modelos personalizados.
- Modelos iniciais: primeiro contato, proposta e acompanhamento.
- Variáveis: `{{nome}}`, `{{empresa}}`, `{{produto}}`, `{{vendedor}}`.
- Envio pela Gmail API `users.messages.send` usando OAuth do Chrome Identity e escopo `gmail.send`.
- Permissão de host `https://gmail.googleapis.com/*` é opcional e solicitada no botão de conexão.
- Token OAuth não é gravado em `chrome.storage`; o cache é administrado pelo Chrome Identity.
- Não é feita leitura da caixa de entrada, nem consulta ao perfil Gmail. O escopo concedido nesta fase é somente de envio.
- O operador precisa marcar a confirmação de autorização antes do envio.
- O envio é bloqueado se o lead possuir `emailOptedOut=true` ou `emailConsentStatus='opted_out'`.
- O corpo do e-mail não é armazenado no CRM; o histórico guarda destinatário, assunto, status, ID retornado pelo Gmail e horário.

## 3. Proteção e auditoria
- Request ID por tentativa e registro local limitado às 200 tentativas mais recentes.
- Duplo clique com a mesma tentativa não gera novo envio.
- Resposta de rede/servidor incerta é marcada como `uncertain`; a interface orienta verificar a pasta Enviados antes de tentar novamente.
- A resposta positiva do Gmail é tratada como envio confirmado, mesmo que uma gravação posterior no histórico falhe.
- Eventos de comunicação são exibidos no histórico do lead com ícones próprios para WhatsApp e e-mail.

## 4. Catálogo e licenciamento
- `FEATURE_CATALOG_VERSION`: 13.
- Total: 89 IDs.
- Implementados: 88.
- Novo entitlement: `crm.communication.email`.
- Ações de e-mail exigem `crm.leads` + `crm.communication.email`.
- A abertura de WhatsApp pelo CRM exige `crm.leads` + `whatsapp.connection`.
- O catálogo do painel administrativo precisa ser atualizado para emitir o novo entitlement. Tokens sem esse direito continuam bloqueados para envio de e-mail; `admin.full_access` mantém acesso.

## 5. Arquivos centrais
- `lib/crm-communication.js`
- `lib/feature-catalog.js`
- `lib/license-policy.js`
- `background/service-worker.js`
- `sidepanel/utils/api.js`
- `sidepanel/components/CRMView.js`
- `sidepanel/components/LeadModal.js`
- `sidepanel/components/CommunicationModal.js`
- `sidepanel/sidepanel.js`
- `sidepanel/sidepanel.css`
- `manifest.json`
- `content/content.js`
- `content/injected.js`
- `test/crm-communication-v1.9.0.test.js`

## 6. Validação automatizada
- `npm run check`: aprovado; manifesto e 136 arquivos JavaScript/MJS verificados.
- `npm test`: 353 testes aprovados, 0 falhas.
- `npm run validate`: concluído com sucesso.

## 7. Validação ainda necessária
Os testes automatizados não substituem homologação real. Validar no Chrome:
1. Abrir conversas de leads com números nacionais e internacionais no WhatsApp Web conectado.
2. Com WhatsApp desconectado, confirmar abertura da aba e comportamento do QR code.
3. Conectar Gmail, autorizar `gmail.send` e enviar para uma caixa de teste.
4. Conferir o remetente selecionado pelo Chrome, a pasta Enviados e o histórico do CRM.
5. Simular cancelamento OAuth, permissão removida, erro 403, limite 429 e falha de rede.
6. Confirmar que leads com descadastro de e-mail são bloqueados.
7. Atualizar o painel administrativo com o catálogo v13 e testar licenças Starter/Pro/Enterprise.

## 8. Limites
- Não há anexos nesta versão.
- Não há sincronização de respostas recebidas nem leitura de caixa de entrada.
- Não há integração Outlook/Microsoft 365.
- Modelos personalizados ficam locais ao perfil Chrome e não são sincronizados pelo Google Drive nesta fase.
- Não há painel de indicadores de e-mail por vendedor/canal.
- A confirmação do operador é um controle de fluxo; não substitui a definição e comprovação da base legal/consentimento aplicável à comunicação por e-mail.
- O painel/backend não foi alterado porque não faz parte do pacote de extensão disponibilizado.
