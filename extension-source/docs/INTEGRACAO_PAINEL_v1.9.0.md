# Contrato de integração com painel — i9Hub v1.9.0 / Fase 13

## Catálogo
- `FEATURE_CATALOG_VERSION`: 13
- Total de IDs: 89
- Funcionalidades implementadas: 88
- Novo entitlement: `crm.communication.email`

## Descrição comercial sugerida
"Comunicação por e-mail diretamente pelo CRM, com conexão Gmail, modelos personalizados e registro de atividades no histórico do lead."

## Ações e permissões
| Ação | Entitlement principal | Dependências obrigatórias |
|---|---|---|
| `OPEN_CRM_LEAD_CHAT` | `crm.leads` | `crm.leads`, `whatsapp.connection` |
| `GET_CRM_EMAIL_STATUS` | `crm.communication.email` | `crm.leads`, `crm.communication.email` |
| `CONNECT_CRM_GMAIL` | `crm.communication.email` | `crm.leads`, `crm.communication.email` |
| `DISCONNECT_CRM_GMAIL` | `crm.communication.email` | `crm.leads`, `crm.communication.email` |
| `GET_CRM_EMAIL_TEMPLATES` | `crm.communication.email` | `crm.leads`, `crm.communication.email` |
| `SAVE_CRM_EMAIL_TEMPLATES` | `crm.communication.email` | `crm.leads`, `crm.communication.email` |
| `SEND_CRM_EMAIL` | `crm.communication.email` | `crm.leads`, `crm.communication.email` |

## Atualizações necessárias no painel
1. Importar o catálogo canônico v13 (89 IDs, 88 implementados).
2. Cadastrar `crm.communication.email` como funcionalidade ativa.
3. Exibir a descrição comercial acima no editor de planos.
4. Permitir seleção do novo entitlement nos planos desejados.
5. Manter `crm.leads` como dependência obrigatória.
6. Preservar o catálogo v12 e os direitos anteriores durante a migração; a atualização deve ser aditiva.
7. Não conceder `admin.full_access` a planos comerciais.
8. Testar tokens Starter, Pro e Enterprise com e sem o novo direito.

## Compatibilidade
- A abertura do WhatsApp pelo CRM usa direitos já existentes (`crm.leads` + `whatsapp.connection`).
- O envio Gmail requer o novo entitlement e fica bloqueado para tokens que ainda não o possuem.
- Tokens existentes não são invalidado pela extensão; para habilitar e-mail nos planos, o painel precisa emitir o novo direito.

## Dados e privacidade
- OAuth usa `https://www.googleapis.com/auth/gmail.send`.
- O token não é enviado ao painel e não é persistido manualmente em `chrome.storage`.
- A extensão não lê a caixa de entrada.
- O corpo do e-mail não é gravado no CRM; apenas destinatário, assunto, status, ID do Gmail e horário.
- Modelos personalizados são locais ao perfil Chrome nesta fase.
