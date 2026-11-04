/**
 * Marca / créditos do projeto (v1.6.0-pro).
 * Compatível com SaaS web e extensão Chrome.
 * `placement` identifica de onde o clique saiu (rodape, sobre, ajuda, popup...).
 */
export const BRAND = { author: "Natã Oliver", siteLabel: "i9ads.com.br", siteBase: "https://i9ads.com.br/" };
const isExtension = typeof chrome !== "undefined" && !!chrome.runtime?.getManifest;

export function siteUrl(placement = "rodape") {
  let v = "";
  if (isExtension) {
    try { v = chrome.runtime.getManifest().version; } catch { /* ignora */ }
  }
  const p = new URLSearchParams({
    utm_source: "i9leads_flow",
    utm_medium: isExtension ? "extensao_chrome" : "saas_web",
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
