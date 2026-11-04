/**
 * Marca / créditos do projeto (v1.6.0-pro).
 * O link do site leva UTM para o i9ads.com.br saber que o visitante veio da extensão.
 * `placement` identifica de onde o clique saiu (rodape, sobre, ajuda, popup...).
 */
export const BRAND = { author: "Natã Oliver", siteLabel: "i9ads.com.br", siteBase: "https://i9ads.com.br/" };

export function siteUrl(placement = "rodape") {
  let v = "";
  try { v = chrome.runtime.getManifest().version; } catch { /* ignora */ }
  const p = new URLSearchParams({
    utm_source: "i9leads_flow",
    utm_medium: "extensao_chrome",
    utm_campaign: "origem_extensao",
    utm_content: placement,
  });
  if (v) p.set("utm_term", "v" + v);
  return BRAND.siteBase + "?" + p.toString();
}

/** HTML do crédito: "Desenvolvido por Natã Oliver · i9ads.com.br" */
export function creditHTML(placement = "rodape") {
  return `<div class="app-credit">Desenvolvido por <strong>${BRAND.author}</strong>` +
    `<a href="${siteUrl(placement)}" target="_blank" rel="noopener noreferrer" title="Abrir ${BRAND.siteLabel} em uma nova aba">${BRAND.siteLabel}</a></div>`;
}
