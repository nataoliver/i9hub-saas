# i9Leads Flow 5.3.2 — Hardening de segurança

## Alterações
- A distribuição comercial confia apenas na chave de assinatura `k1`; a chave `k1_local` de desenvolvimento foi removida. O backend precisa emitir tokens assinados pela chave de produção.
- O verificador rejeita tokens sem expiração numérica válida, com identificador de dispositivo ausente ou com `kid` desconhecido; não tenta outras chaves quando o token declara um `kid`.
- A extensão não registra mais a resposta bruta de ativação, que podia conter token de licença.
- Revalidações não removem a licença por falhas transitórias de rede/servidor; revogações explícitas continuam removendo o token local.
- O service worker aceita eventos de content scripts somente de origens permitidas e não permite que um content script invoque handlers administrativos/de licença.
- Logs têm limites de tamanho/volume, redação de segredos e exibição segura no painel.
- Webhooks exigem HTTPS, bloqueiam destinos locais/privados/reservados, verificam a permissão de host e não seguem redirecionamentos. Credenciais salvas só são usadas no endereço exato configurado.
- A fila de ações gratuitas é serializada e retomar/repetir uma campanha passa pela mesma política de limite.
- Cartões de campanhas escapam valores externos antes de inseri-los no HTML.

## Dependências antes de distribuição comercial
- Confirmar que `rcs.i9ads.com.br` emite tokens com `kid: k1` e `exp` numérico. Se o backend ainda assinar com `k1_local`, a ativação será rejeitada intencionalmente até alinhar o servidor.
- Validar no backend a aplicação do limite de dispositivos, revogação, permissões por recurso e limites de uso.
- Testar no Chrome real o WhatsApp, RCS, Drive, webhooks e ativação de licença.
