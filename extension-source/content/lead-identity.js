/*
 * Identidade de leads — funções compartilhadas entre o Service Worker e os
 * content scripts. Não coleta dados por conta própria; apenas normaliza,
 * classifica a origem e resolve conflitos entre dados já conhecidos.
 */
(function installI9LeadIdentity(root) {
  const FIELDS = Object.freeze(['name', 'phone', 'email', 'company', 'category', 'address', 'website']);
  const SOURCE_DEFAULTS = Object.freeze({
    manual: 1,
    whatsapp_saved_contact: 0.99,
    whatsapp_verified_name: 0.97,
    whatsapp_formatted_contact: 0.94,
    whatsapp_push_name: 0.86,
    whatsapp_chat_title: 0.78,
    whatsapp_group_member_dom: 0.78,
    whatsapp_store_phone: 0.98,
    google_maps_details: 0.98,
    google_maps_card_title: 0.95,
    google_maps_aria_label: 0.88,
    google_maps_url_slug: 0.72,
    google_maps_phone: 0.98,
    google_maps_address: 0.98,
    google_maps_website: 0.98,
    import: 0.65,
    unknown: 0.5,
  });
  const SOURCE_LABELS = Object.freeze({
    manual: 'Editado manualmente',
    whatsapp_saved_contact: 'Contato salvo no WhatsApp',
    whatsapp_verified_name: 'Nome comercial verificado no WhatsApp',
    whatsapp_formatted_contact: 'Nome formatado do contato WhatsApp',
    whatsapp_push_name: 'Nome de perfil do WhatsApp',
    whatsapp_chat_title: 'Título da conversa WhatsApp',
    whatsapp_group_member_dom: 'Nome exibido no participante do grupo',
    whatsapp_store_phone: 'Telefone identificado no WhatsApp',
    google_maps_details: 'Detalhes do estabelecimento no Google Maps',
    google_maps_card_title: 'Título do resultado no Google Maps',
    google_maps_aria_label: 'Rótulo acessível do Google Maps',
    google_maps_url_slug: 'Nome obtido do endereço do Google Maps',
    google_maps_phone: 'Telefone do perfil no Google Maps',
    google_maps_address: 'Endereço do perfil no Google Maps',
    google_maps_website: 'Site do perfil no Google Maps',
    import: 'Importação',
    unknown: 'Origem não identificada',
  });
  const PLACEHOLDER_NAMES = new Set([
    'sem nome', 'nome nao identificado', 'contato', 'contato whatsapp', 'usuario whatsapp', 'admin', 'administrador', 'participante', 'participant', 'you', 'voce',
    'whatsapp user', 'unknown', 'unknown contact', 'no name', 'sem identificacao',
    'resultado', 'resultados', 'result', 'results', 'search results', 'google maps',
    'pesquisar no google maps', 'pesquisa', 'mapa', 'maps', 'voce', 'you',
  ]);

  const clean = (value, max = 500) => String(value == null ? '' : value)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  const normalizeText = (value) => clean(value, 1000).normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  function normalizePhone(value) {
    let digits = clean(value, 40).replace(/\D/g, '').replace(/^0+/, '');
    if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
    return digits.length >= 8 && digits.length <= 15 ? digits : '';
  }

  function normalizeWebsite(value) {
    const raw = clean(value, 2000);
    if (!raw) return '';
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      const path = url.pathname.replace(/\/+$/, '');
      return host + (path && path !== '/' ? path : '');
    } catch { return ''; }
  }

  function normalizeMapsId(value) {
    const raw = clean(value, 2500);
    if (!raw) return '';
    try {
      const url = new URL(raw, 'https://www.google.com');
      const dataId = url.href.match(/!1s([^!?&]+)/)?.[1];
      if (dataId) return decodeURIComponent(dataId).toLowerCase();
      const slug = url.pathname.match(/\/maps\/place\/([^/]+)/i)?.[1];
      if (slug) return decodeURIComponent(slug).replace(/\+/g, ' ').toLowerCase();
    } catch { /* o identificador pode ser um placeId simples */ }
    return raw.replace(/^place_id:/i, '').toLowerCase();
  }

  function isValidName(value) {
    const name = clean(value, 180);
    const normalized = normalizeText(name);
    if (name.length < 2 || !normalized || PLACEHOLDER_NAMES.has(normalized)) return false;
    if (/^(?:resultado|resultados)(?:\s+(?:para|de|da|do|em)\b.*)?$/.test(normalized)) return false;
    if (/^(?:result|results)(?:\s+(?:for|in)\b.*)?$/.test(normalized)) return false;
    if (/^search results(?:\s+for\b.*)?$/.test(normalized)) return false;
    if (/^(?:https?:\/\/|www\.)/i.test(name)) return false;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name)) return false;
    if (/^[+\d\s()./-]+$/.test(name)) return false;
    if (/^(?:endereco|telefone|site|website|como chegar|direcoes|directions)$/i.test(normalized)) return false;
    return true;
  }

  function normalizeFieldValue(field, value) {
    const raw = clean(value, field === 'address' ? 500 : field === 'website' ? 2000 : field === 'email' ? 254 : 180);
    if (field === 'name' || field === 'company' || field === 'category') return raw;
    if (field === 'phone') return normalizePhone(raw);
    if (field === 'email') return raw.toLowerCase();
    if (field === 'website') {
      if (!raw) return '';
      try {
        const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href.slice(0, 2000) : '';
      } catch { return ''; }
    }
    return raw;
  }

  function isUsableValue(field, value) {
    const raw = clean(value, 2000);
    if (!raw) return false;
    if (field === 'name') return isValidName(raw);
    if (field === 'phone') return !!normalizePhone(raw);
    if (field === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw) && raw.length <= 254;
    if (field === 'website') return !!normalizeWebsite(raw);
    return raw.length >= 1;
  }

  function inferSource(lead, field) {
    if (lead?.source === 'manual') return 'manual';
    if (lead?.source === 'google_maps') {
      if (field === 'name') return lead?.nameSource || 'google_maps_details';
      if (field === 'phone') return 'google_maps_phone';
      if (field === 'address') return 'google_maps_address';
      if (field === 'website') return 'google_maps_website';
      if (field === 'category') return 'google_maps_details';
      return 'unknown';
    }
    if (lead?.source === 'whatsapp_private' || lead?.source === 'whatsapp' || lead?.source === 'whatsapp_group' || lead?.waChatId) {
      if (field === 'phone') return 'whatsapp_store_phone';
      if (field === 'name') return lead?.nameSource || (lead?.source === 'whatsapp_group' ? 'whatsapp_group_member_dom' : 'whatsapp_chat_title');
      return 'unknown';
    }
    if (lead?.source === 'import') return 'import';
    return 'unknown';
  }

  function makeMeta(source = 'unknown', confidence, options = {}) {
    const safeSource = SOURCE_DEFAULTS[source] == null ? 'unknown' : source;
    const value = Number(confidence);
    const score = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : SOURCE_DEFAULTS[safeSource];
    return {
      source: safeSource,
      confidence: score,
      observedAt: options.observedAt || options.updatedAt || new Date().toISOString(),
      manual: options.manual === true || safeSource === 'manual',
      locked: options.locked === true || options.manual === true || safeSource === 'manual',
      cleared: options.cleared === true,
    };
  }

  function getFieldMeta(lead, field) {
    const meta = lead?.identityMeta?.[field] || lead?.fieldMeta?.[field];
    if (meta && typeof meta === 'object') {
      return makeMeta(meta.source || inferSource(lead, field), meta.confidence, {
        observedAt: meta.observedAt || meta.updatedAt,
        manual: meta.manual === true,
        locked: meta.locked === true,
        cleared: meta.cleared === true,
      });
    }
    const source = inferSource(lead, field);
    const legacyManual = source === 'manual';
    return makeMeta(source, undefined, { observedAt: lead?.updatedAt || lead?.createdAt, manual: legacyManual, locked: legacyManual });
  }

  function incomingMeta(lead, field, source) {
    const meta = lead?.identityMeta?.[field] || lead?.fieldMeta?.[field];
    if (meta && typeof meta === 'object') return makeMeta(meta.source || source || inferSource(lead, field), meta.confidence, meta);
    const inferred = source || inferSource(lead, field);
    return makeMeta(inferred, undefined, { observedAt: lead?.extractedAt || lead?.updatedAt || new Date().toISOString() });
  }

  function mergeIdentityField(existing, incoming, field, meta, existingLead = {}) {
    const currentValue = normalizeFieldValue(field, existing);
    const nextValue = normalizeFieldValue(field, incoming);
    const currentMeta = getFieldMeta(existingLead, field);
    const nextMeta = meta && typeof meta === 'object' ? makeMeta(meta.source, meta.confidence, meta) : makeMeta('unknown');

    if (nextMeta.manual) {
      if (incoming === '' || incoming == null || String(incoming).trim() === '') {
        return { value: '', meta: makeMeta('manual', 1, { manual: true, locked: true, cleared: true }), changed: currentValue !== '' || !currentMeta.manual };
      }
      if (!isUsableValue(field, incoming)) return { value: existing, meta: currentMeta, changed: false };
      return { value: nextValue, meta: makeMeta('manual', 1, { manual: true, locked: true }), changed: currentValue !== nextValue || !currentMeta.manual };
    }

    // Um campo apagado/corrigido manualmente não pode ser repovoado por sincronização.
    if (currentMeta.manual || currentMeta.locked) return { value: existing, meta: currentMeta, changed: false };
    if (!isUsableValue(field, incoming)) return { value: existing, meta: currentMeta, changed: false };
    if (!isUsableValue(field, existing)) return { value: nextValue, meta: nextMeta, changed: currentValue !== nextValue };

    const same = field === 'phone'
      ? normalizePhone(existing) === normalizePhone(incoming)
      : field === 'website'
        ? normalizeWebsite(existing) === normalizeWebsite(incoming)
        : field === 'email'
          ? String(existing).trim().toLowerCase() === String(incoming).trim().toLowerCase()
          : normalizeText(existing) === normalizeText(incoming);
    if (same) {
      const bestMeta = nextMeta.confidence > currentMeta.confidence ? nextMeta : currentMeta;
      const metaChanged = bestMeta.source !== currentMeta.source || bestMeta.confidence !== currentMeta.confidence
        || bestMeta.manual !== currentMeta.manual || bestMeta.locked !== currentMeta.locked || bestMeta.cleared !== currentMeta.cleared;
      return { value: existing, meta: bestMeta, changed: metaChanged };
    }
    // Dados automáticos só substituem outro dado automático quando têm confiabilidade superior.
    if (nextMeta.confidence < currentMeta.confidence + 0.02) return { value: existing, meta: currentMeta, changed: false };
    return { value: nextValue, meta: nextMeta, changed: currentValue !== nextValue };
  }

  function mergeLeadIdentity(existing, incoming, options = {}) {
    const target = existing && typeof existing === 'object' ? existing : {};
    const raw = incoming && typeof incoming === 'object' ? incoming : {};
    const source = options.source || raw.source || 'unknown';
    const identityMeta = { ...(target.identityMeta || {}) };
    const changedFields = [];

    for (const field of FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(raw, field) && !raw.identityMeta?.[field] && !raw.fieldMeta?.[field]) continue;
      const fieldMeta = incomingMeta(raw, field, source);
      const result = mergeIdentityField(target[field], raw[field], field, fieldMeta, target);
      if (result.changed || target[field] !== result.value) {
        target[field] = result.value;
        changedFields.push(field);
      }
      if (result.meta) identityMeta[field] = result.meta;
    }
    target.identityMeta = identityMeta;
    if (changedFields.length) target.updatedAt = new Date().toISOString();
    return { lead: target, changed: changedFields.length > 0, changedFields, identityMeta };
  }

  function initializeIdentityMeta(lead, source = lead?.source || 'unknown') {
    const target = lead && typeof lead === 'object' ? lead : {};
    target.identityMeta = { ...(target.identityMeta || {}) };
    for (const field of FIELDS) {
      if (target.identityMeta[field]) continue;
      if (!isUsableValue(field, target[field])) continue;
      const inferred = inferSource({ ...target, source }, field);
      target.identityMeta[field] = makeMeta(inferred, undefined, {
        observedAt: target.extractedAt || target.createdAt || target.updatedAt,
        manual: inferred === 'manual', locked: inferred === 'manual',
      });
    }
    return target;
  }

  function identityKeys(lead) {
    const keys = [];
    const wa = clean(lead?.waChatId, 240).toLowerCase();
    const maps = normalizeMapsId(lead?.placeId || lead?.url || lead?.mapsUrl || '');
    const phone = normalizePhone(lead?.phone);
    const name = normalizeText(lead?.name);
    const address = normalizeText(lead?.address);
    const website = normalizeWebsite(lead?.website);
    if (wa) keys.push('wa:' + wa);
    if (maps) keys.push('maps:' + maps);
    if (phone) keys.push('phone:' + phone);
    if (name && address) keys.push('name-address:' + name + '|' + address);
    if (name && website) keys.push('name-website:' + name + '|' + website);
    return keys;
  }

  function createIdentityIndex(leads = []) {
    const index = new Map();
    for (const lead of Array.isArray(leads) ? leads : []) {
      for (const key of identityKeys(lead)) {
        const bucket = index.get(key) || [];
        if (!bucket.includes(lead)) bucket.push(lead);
        index.set(key, bucket);
      }
    }
    return index;
  }

  function findIdentityMatch(index, lead) {
    if (!(index instanceof Map)) return null;
    const incomingAddress = normalizeText(lead?.address);
    for (const key of identityKeys(lead)) {
      const candidates = index.get(key);
      if (!candidates) continue;
      const bucket = Array.isArray(candidates) ? candidates : [candidates];
      for (const match of bucket) {
        // Redes/franquias podem compartilhar nome e site; se os dois endereços
        // estão preenchidos e divergem, não consolidar unidades distintas.
        if (key.startsWith('name-website:') && incomingAddress) {
          const existingAddress = normalizeText(match?.address);
          if (existingAddress && existingAddress !== incomingAddress) continue;
        }
        return match;
      }
    }
    return null;
  }

  function indexIdentityLead(index, lead) {
    if (!(index instanceof Map) || !lead) return;
    for (const key of identityKeys(lead)) {
      const bucket = index.get(key) || [];
      if (!bucket.includes(lead)) bucket.push(lead);
      index.set(key, bucket);
    }
  }

  function selectBestNameCandidate(candidates = []) {
    const valid = (Array.isArray(candidates) ? candidates : [])
      .map((item) => ({ ...item, value: clean(item?.value, 180) }))
      .filter((item) => isValidName(item.value))
      .map((item) => ({ ...item, confidence: Number.isFinite(Number(item.confidence)) ? Math.max(0, Math.min(1, Number(item.confidence))) : (SOURCE_DEFAULTS[item.source] || 0.5) }))
      .sort((a, b) => b.confidence - a.confidence);
    return valid[0] || null;
  }

  root.i9LeadIdentity = Object.freeze({
    FIELDS, SOURCE_DEFAULTS, SOURCE_LABELS,
    clean, normalizeText, normalizePhone, normalizeWebsite, normalizeMapsId,
    isValidName, isUsableValue, normalizeFieldValue, makeMeta, getFieldMeta,
    mergeIdentityField, mergeLeadIdentity, initializeIdentityMeta,
    identityKeys, createIdentityIndex, findIdentityMatch, indexIdentityLead,
    selectBestNameCandidate,
  });
})(globalThis);
