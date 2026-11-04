# Central de Comunicação do CRM — Fase 14

## Gmail

- Conta remetente selecionável entre as contas Google disponíveis no perfil do Chrome.
- Conexão e desconexão independentes por conta.
- Anexos: até 5 arquivos e 10 MB somados. Tipos: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, RTF, ODT/ODS, CSV, TXT, PNG, JPG/JPEG e WEBP.
- Assinatura vinculada ao vendedor responsável pelo lead; assinatura padrão usada quando não há vendedor específico.
- Modelos e assinaturas são sincronizados no Drive, em arquivo separado do backup principal.

## Respostas

- A sincronização é manual, iniciada pelo botão no editor do lead.
- O i9Hub consulta apenas as conversas (`threadId`) de e-mails que ele enviou.
- Solicita o escopo `gmail.readonly` no primeiro uso desta função; o envio continua com `gmail.send`.
- Registra apenas metadados e um trecho de até 500 caracteres; não importa a caixa inteira nem baixa anexos recebidos.
- Deduplica por `messageId`.

## Descadastro

- O descadastro é registrado no lead e bloqueia envios pelo CRM.
- Reativação exige nova autorização confirmada e evidência registrada pelo usuário.

## Indicadores

- WhatsApp: conversas abertas pelo botão do CRM (não significa mensagem enviada).
- E-mail: enviados, respostas sincronizadas, falhas e tentativas incertas.
- Descadastros e agrupamento por vendedor.

## Outlook / Microsoft 365

Ainda não implementado. Exige app registration no Microsoft Entra, Client ID, redirect URI e homologação do Microsoft Graph. O catálogo mantém o ID planejado e bloqueado.
