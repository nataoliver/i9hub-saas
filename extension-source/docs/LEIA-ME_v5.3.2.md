# i9Leads Flow 5.3.2 — versão de teste com hardening

Esta versão aplica melhorias de segurança na extensão e deve ser instalada para testes controlados antes de substituir qualquer versão usada em produção.

**Importante:** a versão comercial agora confia somente na chave de assinatura `k1`. Antes de distribuir, confirme no backend que as licenças são assinadas por essa chave e que o token inclui `exp` numérico e `did` igual ao UUID do dispositivo.

## Testes obrigatórios
1. Instalar como extensão descompactada em um perfil de teste do Chrome.
2. Ativar uma licença de teste no servidor.
3. Confirmar que um token expirado, malformado, com dispositivo divergente ou `kid` desconhecido é recusado.
4. Confirmar que uma falha HTTP 5xx/429 não apaga uma licença já ativada.
5. Testar exportação de webhook somente com HTTPS e domínio público, e verificar que o teste não envia API key para URL diferente.
6. Abrir Logs do Sistema e conferir que texto recebido de páginas aparece como texto, não como HTML.
7. Confirmar que a extração Maps, sincronização de privadas, campanhas, RCS e Drive continuam operacionais.
