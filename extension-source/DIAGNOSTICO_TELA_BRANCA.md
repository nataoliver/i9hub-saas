# Diagnóstico: Tela Branca no Sidepanel (i9Hub v1.0.1)

**Data:** 19/10/2026
**Status:** ✅ Corrigido (requer recarregamento manual)

## 1. Causa Raiz Exata

O problema **não era cache do navegador** nem versão incorreta no manifest. A causa foi um **erro de linkagem de ES Module** silencioso que abortava a inicialização do JavaScript.

### O Mecanismo da Falha
1.  O arquivo `sidepanel/sidepanel.html` contém o badge de versão `v5.4.1` **hardcoded** no HTML estático (linha 19).
2.  O script `sidepanel/sidepanel.js` é responsável por atualizar esse badge e renderizar o menu/conteúdo.
3.  O `sidepanel.js` importa o componente `SettingsView.js`.
4.  O `SettingsView.js` tentava importar `{ DEFAULT_CLASSIFIER_SETTINGS, normalizeClassifierSettings }` de `lib/classifier.js`.
5.  **Esses símbolos não existiam** no `lib/classifier.js` (foram removidos ou nunca criados nessa versão).
6.  Quando o Chrome encontra um `import` de um símbolo inexistente, ele lança um `SyntaxError` imediato e **aborta todo o módulo** antes de executar qualquer linha de código.
7.  Resultado: O HTML estático carregou (mostrando header/footer e `v5.4.1`), mas o JS nunca rodou, deixando a tela branca sem menu.

### Evidência Técnica
-   **Botão "Erros" vermelho** em `chrome://extensions`: Confirmava falha de runtime/linkagem.
-   **Badge `v5.4.1` persistente**: Provava que o JS não executou a lógica de atualização de versão.
-   **Análise Estática (`analyze_deps.cjs`)**: Identificou exatamente os imports quebrados.

## 2. Arquivos Corrigidos

### `lib/classifier.js`
**Problema:** Faltavam as exportações `DEFAULT_CLASSIFIER_SETTINGS` e `normalizeClassifierSettings` exigidas pelo `SettingsView.js` e `background/service-worker.js`.

**Solução Aplicada:** Adicionados os exports faltantes com implementação coerente:
```javascript
export const DEFAULT_CLASSIFIER_SETTINGS = Object.freeze({
  spamKeywords: [...SPAM_KEYWORDS],
  floodMessageCount: 5,
  floodWindowSeconds: 60,
  sameMessageNumbers: 3,
  recentDays: 7,
  shortenedLinkFirstMessage: true,
  promotionalFirstMessage: true,
  outsideContactsNeverReplied: false,
});

export function normalizeClassifierSettings(settings = {}) {
  // ... lógica de normalização com fallback para defaults
}
```

### `manifest.json`
**Problema Anterior:** Chaves duplicadas `version` e `version_name` (já corrigido em sessão anterior, validado nesta).
**Status Atual:** ✅ Válido (versão 1.0.1).

## 3. Passo a Passo para Restaurar a Interface

Como as correções foram feitas nos arquivos em disco, o Chrome ainda está com a versão antiga em memória. Você precisa forçar o recarregamento.

1.  Abra o Chrome e acesse: `chrome://extensions`
2.  Localize o cartão da extensão **"i9Hub — CRM com Comunicação Consciente"**.
3.  Clique no botão **"Erros"** (vermelho) para limpar os logs antigos (opcional, mas recomendado).
4.  Clique no ícone de **Recarregar** (↻) no canto inferior direito do cartão da extensão.
    *   *Alternativa:* Desative e ative novamente a chave azul no topo do cartão.
5.  Feche qualquer painel lateral aberto e abra novamente clicando no ícone da extensão.

**Resultado Esperado:**
-   O badge de versão deve mudar de `v5.4.1` para `v1.0.1`.
-   O menu lateral (Dashboard, Campanhas, CRM, etc.) deve aparecer.
-   O conteúdo principal deve renderizar normalmente.

## 4. Notas Adicionais

-   **Módulos Novos:** Os arquivos `niche-benchmarks.js`, `reengagement-engine.js`, etc., foram verificados e possuem sintaxe válida. Eles não estavam sendo importados diretamente pelo sidepanel no ponto de falha, mas agora estão disponíveis para uso futuro.
-   **BOM UTF-8:** Alguns arquivos possuem BOM (Byte Order Mark) no início. O Chrome tolera isso em módulos ES, então não foi necessário remover.
-   **verify-token.js:** O analisador estático reportou um erro falso positivo neste arquivo (import de `ed25519`). Isso ocorre porque o `noble-ed25519.js` é minificado e o export está na última linha de forma que o regex simples não capturou, mas o arquivo é válido. Como o sidepanel não importa `verify-token.js`, isso não afeta a UI.

---
*Diagnóstico gerado automaticamente pelo assistente de código.*