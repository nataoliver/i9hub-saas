# i9Hub 5.4.1 — correções de experiência e conexão

## Adicionado em 2026-10-19
- **Compliance:** Schema `compliance.consent_tracking` para registro de opt-in/opt-out por palavra-chave ou link.
- **Feature:** `compliance.auto_blacklist` adicionada ao catálogo central com proteção por licença.
- **Parser:** Detecção de palavras-chave QUERO/SAIR em mensagens recebidas (`.message-in`) com filtros contra falsos positivos e negações.
- **Integração:** Handler `CONSENT_UPDATE` no message-gate e service worker para persistência segura de consentimento via `chrome.storage.local`.
- **Segurança:** Bloqueio automático de campanhas promocionais para contatos em estado `opted_out`; estado `unknown` nunca é tratado como autorização.
- **Testes:** Suite `consent-tracking.test.js` com 12 cenários cobrindo parser, message-gate, catálogo e entitlements.

## Corrigido nesta candidata
- Adicionado botão persistente “Abrir WhatsApp” para reutilizar a aba existente e abrir o WhatsApp ao lado da extensão.
- Detecção de abas do WhatsApp mais robusta, incluindo URL pendente durante navegação.
- Removido “Marketing & Dados” da navegação e do tour da extensão; ações de configuração de pixels exigem papel/entitlement administrativo do proprietário no token emitido pelo painel.
- Apresentação inicial filtrada pelas permissões reais da licença; tour “Conhecer todos os módulos” é explicativo e não abre telas bloqueadas.
- Anúncio de rodapé separado do conteúdo das telas, para permanecer visível ao navegar entre módulos quando houver campanha ativa.
- Adicionadas preferências de telemetria opcionais nas Configurações; consentimento começa desativado, preferências antigas são migradas para desativado e o usuário pode revogar quando quiser.
- Atualizada a identidade visível para i9Hub.

## Limitações que permanecem
- A detecção e o layout lado a lado precisam ser testados no Chrome real, com licença que inclua `whatsapp.connection`.
- O editor de anúncios e as regras de segmentação continuam pertencendo ao backend/painel administrativo.
- Não é recomendável inserir Google AdSense diretamente no side panel da extensão; use o espaço de anúncio próprio do painel para campanhas e patrocínios, e Google AdSense em páginas web hospedadas que cumpram os requisitos do Google.
