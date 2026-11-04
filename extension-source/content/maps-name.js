/* Helpers robustos para identificar o nome real de cada resultado do Google Maps.
 * Carregado antes de maps-extractor.js no mundo isolado da extensão.
 */
(function installI9MapsName(global) {
  const GENERIC_NAMES = new Set([
    'resultado', 'resultados', 'result', 'results', 'search results',
    'pesquisa', 'pesquisas', 'google maps', 'pesquisar no google maps',
    'search google maps', 'mapa', 'maps',
  ]);
  const TITLE_SELECTORS = ['.qBF1Pd', '.fontHeadlineSmall', '[role="heading"]', 'h3', '.NrDZNb', '.dbg0pd'];

  function cleanCandidate(value) {
    return String(value == null ? '' : value)
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^["“”']+|["“”']+$/g, '');
  }

  function normalizeName(value) {
    return cleanCandidate(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function isGenericName(value) {
    const normalized = normalizeName(value);
    if (!normalized) return true;
    if (GENERIC_NAMES.has(normalized)) return true;
    if (/^(?:resultado|resultados)(?:\s+(?:para|de|da|do|em)\b.*)?$/.test(normalized)) return true;
    return /^(?:result|results)(?:\s+(?:for|in)\b.*)?$/.test(normalized) || /^search results(?:\s+for\b.*)?$/.test(normalized);
  }

  function isValidName(value) {
    const name = cleanCandidate(value);
    if (name.length < 2 || name.length > 180 || isGenericName(name)) return false;
    if (/^(?:https?:\/\/|www\.)/i.test(name)) return false;
    if (/^[+\d\s()./-]{7,}$/.test(name)) return false;
    if (/^(?:endereço|telefone|site|website|como chegar|direções)$/i.test(name)) return false;
    if (global.i9LeadIdentity?.isValidName) return global.i9LeadIdentity.isValidName(name);
    return true;
  }

  function sameName(a, b) {
    const na = normalizeName(a);
    const nb = normalizeName(b);
    return !!na && na === nb;
  }

  function attr(element, name) {
    try { return element?.getAttribute?.(name) || ''; } catch { return ''; }
  }

  function elementText(element) {
    if (!element) return '';
    return cleanCandidate(element.innerText) || cleanCandidate(element.textContent) || cleanCandidate(attr(element, 'aria-label')) || cleanCandidate(attr(element, 'title'));
  }

  function nameFromPlaceUrl(href, baseHref) {
    if (!href) return '';
    try {
      const url = new URL(href, baseHref || 'https://www.google.com/maps/');
      const match = url.pathname.match(/\/maps\/place\/([^/]+)/i);
      if (!match) return '';
      const candidate = cleanCandidate(decodeURIComponent(match[1].replace(/\+/g, ' ')));
      if (/^(?:data|search|maps?)(?:[=/:]|$)/i.test(candidate)) return '';
      return isValidName(candidate) ? candidate : '';
    } catch {
      return '';
    }
  }

  function getResultIdentity(link, doc, baseHref) {
    if (!link) return null;
    const candidates = [];
    let ancestor = link;
    for (let depth = 0; ancestor && depth < 8; depth++, ancestor = ancestor.parentElement) {
      if (typeof ancestor.querySelectorAll !== 'function') continue;
      let placeLinks = [];
      try { placeLinks = Array.from(ancestor.querySelectorAll('a[href*="/maps/place/"]')); } catch { /* DOM parcial */ }
      if (placeLinks.length > 1) break;
      for (const selector of TITLE_SELECTORS) {
        let elements = [];
        try { elements = Array.from(ancestor.querySelectorAll(selector)); } catch { /* DOM parcial */ }
        for (const element of elements) {
          const candidate = elementText(element) || attr(element, 'aria-label') || attr(element, 'title');
          if (isValidName(candidate)) candidates.push({ value: cleanCandidate(candidate), source: 'google_maps_card_title', confidence: 0.96 });
        }
      }
    }

    // Rótulos acessíveis são úteis quando o cartão não expõe um título separado.
    for (const candidate of [attr(link, 'aria-label'), attr(link, 'title'), attr(link, 'data-tooltip')]) {
      if (isValidName(candidate)) candidates.push({ value: cleanCandidate(candidate), source: 'google_maps_aria_label', confidence: 0.88 });
    }

    const slug = nameFromPlaceUrl(attr(link, 'href') || link.href, baseHref || doc?.location?.href);
    if (slug) candidates.push({ value: slug, source: 'google_maps_url_slug', confidence: 0.72 });

    if (global.i9LeadIdentity?.selectBestNameCandidate) return global.i9LeadIdentity.selectBestNameCandidate(candidates);
    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates[0] || null;
  }

  function getResultName(link, doc, baseHref) {
    return getResultIdentity(link, doc, baseHref)?.value || '';
  }

  function getDetailsIdentity(doc) {
    if (!doc || typeof doc.querySelector !== 'function') return null;
    const selectors = ['h1.DUwDvf', 'h1.fontHeadlineLarge', '[role="main"] h1'];
    for (const selector of selectors) {
      let element = null;
      try { element = doc.querySelector(selector); } catch { /* DOM parcial */ }
      const candidate = elementText(element);
      if (isValidName(candidate)) return { value: cleanCandidate(candidate), source: 'google_maps_details', confidence: 0.99 };
    }
    return null;
  }

  function getDetailsName(doc) {
    return getDetailsIdentity(doc)?.value || '';
  }

  global.i9MapsName = Object.freeze({
    cleanCandidate,
    normalizeName,
    isGenericName,
    isValidName,
    sameName,
    nameFromPlaceUrl,
    getResultName,
    getResultIdentity,
    getDetailsName,
    getDetailsIdentity,
  });
})(globalThis);
