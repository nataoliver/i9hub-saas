/**
 * i9Leads Flow 5.3.3 - Extrator do Google Maps (content script)
 *
 * O service worker abre a busca e coordena a extração. Aqui rolamos a lista de resultados de UMA área
 * (uma "célula") e lemos os dados de cada estabelecimento. Ao terminar, devolvemos o resultado ao service
 * worker com a mensagem MAPS_CELL_DONE; ele decide se precisa buscar em outra área para completar a quantidade
 * pedida (o Google Maps costuma parar em cerca de 120 resultados por busca).
 *
 * Sem repetição: cada lead tem até três chaves (ID do lugar no Maps/CID, telefone e site). Se qualquer uma delas
 * já estiver no histórico permanente de extrações (chave "mapsHistory" em chrome.storage.local, separado do CRM)
 * ou já tiver sido extraída nesta rodada, o lead é ignorado e NÃO conta no limite pedido.
 */
(function () {
  if (window.__i9rcsMapsLoaded) return;
  window.__i9rcsMapsLoaded = true;

  const HKEY = 'mapsHistory';
  const HISTORY_CAP = 200000; // por tipo de chave
  const state = { running: false, stopped: false };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const mapsNames = globalThis.i9MapsName;

  function emit(type, payload = {}) {
    try { chrome.runtime.sendMessage({ type, payload, source: 'maps-extractor', timestamp: Date.now() }); } catch (e) { /* painel fechado */ }
  }

  // ---- Chaves de deduplicação (mantidas iguais às do service worker) ----------------------------
  const SITE_IGNORE = ['facebook.com', 'instagram.com', 'wa.me', 'whatsapp.com', 'linktr.ee', 'google.com', 'goo.gl',
    'youtube.com', 'tiktok.com', 'twitter.com', 'x.com', 'linkedin.com', 'bit.ly', 'ifood.com.br'];

  function idOf(url) {
    const s = String(url || '');
    const m = s.match(/!1s([^!?&#/]+)/) || s.match(/[?&]ftid=([^&#]+)/);
    if (!m) return '';
    try { return decodeURIComponent(m[1]).toLowerCase(); } catch (e) { return m[1].toLowerCase(); }
  }
  function phoneKey(p) {
    let d = String(p || '').replace(/\D/g, '');
    if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
    return d.length >= 8 ? d : '';
  }
  function siteKey(u) {
    if (!u) return '';
    try {
      const x = new URL(/^https?:\/\//i.test(u) ? u : 'http://' + u);
      const h = x.hostname.toLowerCase().replace(/^www\./, '');
      if (!h || SITE_IGNORE.some((d) => h === d || h.endsWith('.' + d))) return '';
      const path = x.pathname.replace(/\/+$/, '');
      return h + (path && path !== '/' ? path : '');
    } catch (e) { return ''; }
  }
  const keysOf = (p) => ({ id: idOf(p.url || p.placeId), phone: phoneKey(p.phone), site: siteKey(p.website) });

  function newKnown() { return { ids: new Set(), phones: new Set(), sites: new Set() }; }
  function addKeys(known, k) { if (k.id) known.ids.add(k.id); if (k.phone) known.phones.add(k.phone); if (k.site) known.sites.add(k.site); }
  const isKnown = (known, k) => !!((k.id && known.ids.has(k.id)) || (k.phone && known.phones.has(k.phone)) || (k.site && known.sites.has(k.site)));

  async function loadKnown(config) {
    const known = newKnown();
    if (config.useHistory !== false) {
      try {
        const h = (await chrome.storage.local.get(HKEY))[HKEY] || {};
        (h.ids || []).forEach((v) => known.ids.add(v));
        (h.phones || []).forEach((v) => known.phones.add(v));
        (h.sites || []).forEach((v) => known.sites.add(v));
      } catch (e) { /* segue sem histórico */ }
    }
    const rk = config.runKeys || {};
    (rk.ids || []).forEach((v) => known.ids.add(v));
    (rk.phones || []).forEach((v) => known.phones.add(v));
    (rk.sites || []).forEach((v) => known.sites.add(v));
    return known;
  }

  /** Acrescenta leads ao histórico permanente (sempre, mesmo com "não repetir" desligado). */
  async function appendHistory(places) {
    if (!places.length) return;
    try {
      const h = (await chrome.storage.local.get(HKEY))[HKEY] || {};
      const ids = new Set(h.ids || []); const phones = new Set(h.phones || []); const sites = new Set(h.sites || []);
      for (const p of places) {
        const k = keysOf(p);
        if (k.id) ids.add(k.id);
        if (k.phone) phones.add(k.phone);
        if (k.site) sites.add(k.site);
      }
      await chrome.storage.local.set({ [HKEY]: {
        ids: [...ids].slice(-HISTORY_CAP), phones: [...phones].slice(-HISTORY_CAP), sites: [...sites].slice(-HISTORY_CAP),
        n: (h.n || 0) + places.length, updatedAt: Date.now(),
      } });
    } catch (e) { /* ignora: pior caso, o lead pode repetir numa próxima rodada */ }
  }

  // ---- Leitura da página -----------------------------------------------------------------------
  const feed = () => document.querySelector('div[role="feed"]');
  const resultLinks = () => Array.from(document.querySelectorAll('div[role="feed"] a.hfpxzc, div[role="feed"] a[href*="/maps/place/"]'));
  const reachedEndOfList = () => /Você chegou ao final da lista|reached the end of the list/i.test(document.body.innerText);

  function text(el) { return el ? (el.getAttribute?.('aria-label') && !el.textContent.trim() ? el.getAttribute('aria-label') : el.textContent).trim() : ''; }

  function parseViewport(href) {
    const m = String(href || '').match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+(?:\.\d+)?)z/);
    return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]), zoom: parseFloat(m[3]) } : null;
  }

  function readDetails(fallbackIdentity, url, confirmedDetailsIdentity = null) {
    const q = (s) => document.querySelector(s);
    // O título dos detalhes só tem prioridade quando foi associado ao lugar clicado.
    const chosenIdentity = confirmedDetailsIdentity && mapsNames?.isValidName(confirmedDetailsIdentity.value)
      ? confirmedDetailsIdentity
      : (fallbackIdentity && mapsNames?.isValidName(fallbackIdentity.value) ? fallbackIdentity : null);
    const name = chosenIdentity?.value || '';
    const addrBtn = q('button[data-item-id="address"]');
    const phoneBtn = q('button[data-item-id^="phone"]');
    const siteA = q('a[data-item-id="authority"]');
    const ratingEl = q('div.F7nice span[aria-hidden="true"]');
    const reviewsEl = q('div.F7nice span[aria-label*="avalia"], div.F7nice span[aria-label*="review"]');
    const categoryEl = q('button.DkEaL');
    const cleanPhone = (phoneBtn?.getAttribute('aria-label') || phoneBtn?.textContent || '').replace(/^[^\d+]*/, '').trim();
    const address = (addrBtn?.getAttribute('aria-label') || addrBtn?.textContent || '').replace(/^Endereço:\s*/i, '').trim();
    const website = siteA?.href || '';
    const identityMeta = {};
    if (name) identityMeta.name = { source: chosenIdentity.source || 'google_maps_details', confidence: Number(chosenIdentity.confidence) || 0.9, observedAt: new Date().toISOString() };
    if (cleanPhone) identityMeta.phone = { source: 'google_maps_phone', confidence: 0.98, observedAt: new Date().toISOString() };
    if (address) identityMeta.address = { source: 'google_maps_address', confidence: 0.98, observedAt: new Date().toISOString() };
    if (website) identityMeta.website = { source: 'google_maps_website', confidence: 0.98, observedAt: new Date().toISOString() };
    const category = text(categoryEl);
    if (category) identityMeta.category = { source: 'google_maps_details', confidence: 0.96, observedAt: new Date().toISOString() };
    return {
      placeId: (url.match(/!1s([^!?]+)/) || [])[1] || url,
      name,
      nameSource: chosenIdentity?.source || '',
      phone: cleanPhone,
      address,
      website,
      category,
      rating: ratingEl ? parseFloat(ratingEl.textContent.replace(',', '.')) || null : null,
      reviewsCount: reviewsEl ? parseInt((reviewsEl.getAttribute('aria-label') || '').replace(/\D/g, '')) || null : null,
      url,
      identityMeta,
    };
  }

  async function waitFor(fn, timeout = 6000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { const v = fn(); if (v) return v; await sleep(250); }
    return null;
  }

  // ---- Uma área (célula) --------------------------------------------------------------------------
  async function run(config = {}) {
    // "remaining" = quantos leads NOVOS ainda faltam; "total"/"offset"/"skippedBase" são os números globais da rodada.
    const remaining = Math.max(1, Number(config.remaining) || Number(config.maxResults) || 20);
    const total = Math.max(1, Number(config.total) || remaining);
    const offset = Math.max(0, Number(config.offset) || 0);
    const skippedBase = Math.max(0, Number(config.skippedBase) || 0);

    const known = await loadKnown(config);
    const seen = new Set();
    const results = [];
    const pending = []; // ainda não gravados no histórico
    let skipped = 0; let error = ''; let ended = false; let viewport = null;
    state.running = true; state.stopped = false;

    const progress = (place, message) => emit('MAPS_EXTRACTION_PROGRESS', {
      place, current: offset + results.length, total, skipped: skippedBase + skipped,
      message: message || place?.name || 'Extraindo...',
    });
    const flush = async () => { if (pending.length) { const batch = pending.splice(0); await appendHistory(batch); } };

    try {
      if (!(await waitFor(feed, Number(config.feedTimeout) || 15000))) {
        throw new Error('Lista de resultados do Google Maps não encontrada. Verifique a busca.');
      }
      viewport = parseViewport(location.href); // lido antes de clicar em qualquer lugar (o clique move o mapa)
      let idleRounds = 0;
      while (state.running && results.length < remaining && idleRounds < 5) {
        const fresh = resultLinks().filter((a) => !seen.has(a.href));
        if (!fresh.length) {
          const f = feed();
          f.scrollTop = f.scrollHeight;
          await sleep(1800);
          idleRounds++;
          if (reachedEndOfList()) { ended = true; break; }
          continue;
        }
        idleRounds = 0;
        for (const link of fresh) {
          if (!state.running || results.length >= remaining) break;
          seen.add(link.href);
          const fallbackIdentity = mapsNames?.getResultIdentity(link, document, location.href) || null;
          const fallbackName = fallbackIdentity?.value || '';  
          const linkKeys = { id: idOf(link.href), phone: '', site: '' };
          if (isKnown(known, linkKeys)) { skipped++; progress(null, 'Já extraído antes, ignorando: ' + (fallbackName || 'resultado do Maps')); continue; }

          if (config.extractDetails === false) {
            const place = { name: fallbackName, nameSource: fallbackIdentity?.source || '', url: link.href, identityMeta: fallbackName ? { name: { source: fallbackIdentity?.source || 'google_maps_url_slug', confidence: Number(fallbackIdentity?.confidence) || 0.72, observedAt: new Date().toISOString() } } : {} };
            if (!mapsNames?.isValidName(place.name)) {
              skipped++;
              progress(null, 'Nome do estabelecimento não identificado; resultado ignorado para evitar salvar um título genérico.');
              continue;
            }
            addKeys(known, linkKeys);
            results.push(place); pending.push(place);
            progress(place);
          } else {
            const previousDetailsIdentity = mapsNames?.getDetailsIdentity(document) || null;
            const targetPlaceId = idOf(link.href);
            link.click();
            const confirmedDetailsIdentity = await waitFor(() => {
              const detailIdentity = mapsNames?.getDetailsIdentity(document) || null;
              const detailName = detailIdentity?.value || '';
              if (!mapsNames?.isValidName(detailName)) return null;
              const currentPlaceId = idOf(location.href);
              if (targetPlaceId && currentPlaceId && targetPlaceId === currentPlaceId) return detailIdentity;
              if (mapsNames.isValidName(fallbackName)) return mapsNames.sameName(detailName, fallbackName) ? detailIdentity : null;
              return previousDetailsIdentity && mapsNames.sameName(detailName, previousDetailsIdentity.value) ? null : detailIdentity;
            }, 6000);
            await sleep(450);
            const place = readDetails(fallbackIdentity, link.href, confirmedDetailsIdentity || null);
            if (!mapsNames?.isValidName(place.name)) {
              skipped++;
              progress(null, 'Nome do estabelecimento não identificado; resultado ignorado para evitar salvar um título genérico.');
              continue;
            }
            const k = keysOf(place);
            if (isKnown(known, k)) { // mesmo telefone ou site de um lead que já tínhamos
              addKeys(known, k); skipped++;
              progress(null, 'Repetido (telefone/site), ignorando: ' + place.name);
              continue;
            }
            addKeys(known, k);
            results.push(place); pending.push(place);
            progress(place);
          }
          if (pending.length >= 10) await flush(); // não perde tudo se a aba for fechada no meio
        }
      }
      if (!ended && reachedEndOfList()) ended = true;
    } catch (e) {
      error = e.message || String(e);
    } finally {
      await flush();
      const stopped = state.stopped;
      state.running = false;
      emit('MAPS_CELL_DONE', { results, skipped, error, ended, stopped, viewport });
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'MAPS_START_EXTRACTION') {
      if (state.running) { sendResponse({ success: false, error: 'Já existe uma extração em andamento.' }); return false; }
      run(message.payload);
      sendResponse({ success: true });
      return false;
    }
    if (message?.type === 'MAPS_STOP_EXTRACTION') {
      state.stopped = true;
      state.running = false;
      sendResponse({ success: true });
      return false;
    }
    return false;
  });
})();
