/**
 * i9Hub - Injected Script (WhatsApp Web Automation Core)
 * Roda no contexto da página - tem acesso total ao DOM
 */

(function() {
  'use strict';
  // v7.0.2 - ignora subframes internos do WhatsApp (mesma origem do pai); roda na aba
  // comum e no WhatsApp Web embutido na extensão (pai de outra origem).
  let __sameOriginParent = false;
  try { __sameOriginParent = window !== window.parent && window.parent.location.origin === location.origin; }
  catch (e) { /* pai de outra origem: embutido na página da extensão */ }
  if (__sameOriginParent) return;
  const EMBEDDED = window !== window.parent; // true = rodando dentro do <iframe> da extensão
  const EXT_VER = '1.0.0.0';
  // Este script roda no contexto da página (MAIN): não tem chrome.runtime.
  // Os logs vão pela ponte (content.js) até o service worker -> tela de Logs.
  function diag(action, status="success", data={}) {
    try {
      window.postMessage({ source: 'i9rcs7-injected', type: 'LOG', payload: { module: 'whatsapp-web', action, status, message: action, data: { ...data, EXT_VERSION: EXT_VER } } }, '*');
    } catch(e) {}
  }
  window.addEventListener("error", e => diag("WINDOW_ERROR","error",{error:e.message,file:e.filename,line:e.lineno}));
  window.addEventListener("unhandledrejection", e => diag("PROMISE_REJECTION","error",{error:String(e.reason)}));
  // Singleton versionado: após atualizar a extensão, o WhatsApp pode manter o
  // script MAIN-world da versão anterior. A versão nova precisa poder assumir o
  // controle sem exigir F5. Scripts antigos passam a ignorar eventos quando a
  // versão global mudar.
  if (window.__i9rcsInjectedV7Version === EXT_VER) return;
  window.__i9rcsInjectedV7 = true;
  window.__i9rcsInjectedV7Version = EXT_VER;

  diag("WHATSAPP_WEB_READY");

  const SELECTORS = {
    searchInput: '[data-testid="chat-list-search-input"], #side [contenteditable="true"][role="textbox"], #side input[type="search"], #side input[type="text"], #side input[placeholder*="Pesquisar" i], #side input[placeholder*="Search" i], [contenteditable="true"][role="textbox"]',
    searchButton: '[data-testid="chat-list-search"], [data-testid="search"], #side button[aria-label*="Pesquisar" i], #side button[aria-label*="Search" i], #side button[title*="Pesquisar" i], #side button[title*="Search" i], #side [role="button"][aria-label*="Pesquisar" i], #side [role="button"][aria-label*="Search" i]',
    chatList: '#pane-side [role="list"], #pane-side',
    chatItem: '#pane-side [role="listitem"], #pane-side [data-testid="cell-frame-container"]',
    chatName: '[data-testid="cell-frame-title"], [data-testid="conversation-info-header-chat-title"], span[title], [title]',
    msgInput: '[data-testid="compose-box-input"], #main footer [contenteditable="true"][role="textbox"], #main footer [contenteditable="true"][data-tab], #main footer [contenteditable="true"]',
    sendBtn: '[data-testid="compose-box-send"], #main footer button[aria-label="Enviar"], #main footer button[aria-label="Send"], #main footer [role="button"][aria-label="Enviar"], #main footer [role="button"][aria-label="Send"], #main footer span[data-icon="send"], #main footer [data-icon="wds-ic-send-filled"], #main footer button[aria-label*="Enviar" i]',
    headerName: '[data-testid="conversation-header-name"], #main header [data-testid="conversation-info-header-chat-title"], #main header span[title], #main header [dir="auto"]',
    infoBtn: '[data-testid="header-info"], [data-testid="conversation-info-header"], header button[aria-label*="info" i], header button[aria-label*="dados" i]',
    drawerClose: '[data-testid="drawer-close"]',
    participantsList: '[data-testid="group-participants-list"], [data-testid="group-info-drawer"], [data-testid="drawer-right"], [role="dialog"]',
    participant: '[data-testid="group-participant"], [data-testid="group-participant-row"], [role="listitem"]',
    participantName: '[data-testid="group-participant-name"], [data-testid="cell-frame-title"], span[dir="auto"]',
    participantPhone: '[data-testid="group-participant-phone"]',
    adminBadge: '[data-testid="group-participant-admin"], [aria-label*="admin" i], [title*="admin" i]',
    inviteLink: '[data-testid="group-invite-link"]',
    copyLinkBtn: '[data-testid="copy-invite-link"]',
    newChatFab: '[data-testid="fab-new-chat"]',
    contactPickerSearch: '[data-testid="contact-picker-search"]',
    contactPickerList: '[data-testid="contact-picker-list"]',
    contactPickerItem: '[data-testid="contact-picker-item"]',
    contactPickerCheckbox: '[data-testid="contact-picker-checkbox"]',
    contactPickerNext: '[data-testid="contact-picker-next"]',
    groupNameInput: '[data-testid="group-name-input"]',
    groupCreate: '[data-testid="group-create"]',
    offlineBanner: '[data-testid="offline-banner"]',
    archivedItem: '[data-testid*="archived" i], [aria-label*="Arquiv" i], [title*="Arquiv" i]',
  };

  let isProcessing = false;
  let currentCampaign = null;
  // Atendimento e campanha compartilham a mesma fila de saída para não enviarem duas mensagens ao mesmo tempo.
  let outgoingSendTail = Promise.resolve();
  let aiPendingInbound = 0;
  let aiProcessingSequence = 0;
  let aiProcessingStateAt = 0;

  async function withOutgoingSendLock(task) {
    const previous = outgoingSendTail;
    let release;
    outgoingSendTail = new Promise((resolve) => { release = resolve; });
    await previous.catch(() => {});
    try { return await task(); }
    finally { release(); }
  }

  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function waitForElement(sel, timeout = 5000, root = document) {
    return new Promise((resolve, reject) => {
      const el = root.querySelector(sel);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const found = root.querySelector(sel);
        if (found) { observer.disconnect(); resolve(found); }
      });
      observer.observe(root, { childList: true, subtree: true, characterData: true });
      setTimeout(() => { observer.disconnect(); reject(new Error(`Timeout: ${sel}`)); }, timeout);
    });
  }
  // Digita no campo (contenteditable do WhatsApp). Usa insertText (compatível com o editor
  // do WhatsApp Web) e cai para o método antigo caso o navegador recuse.
  async function simulateInput(el, text) {
    el.focus();
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('delete');
      if (document.execCommand('insertText', false, text)) return;
    } catch (e) { /* segue para o fallback */ }
    for (const char of text) {
      el.textContent += char;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
      await wait(Math.random() * 120 + 30);
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function clickElement(el) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width/2, y = r.top + r.height/2;
    [new MouseEvent('mousedown', {bubbles:true,clientX:x,clientY:y}),
     new MouseEvent('mouseup', {bubbles:true,clientX:x,clientY:y}),
     new MouseEvent('click', {bubbles:true,clientX:x,clientY:y})].forEach(e=>el.dispatchEvent(e));
  }

  // v7.0.4 - Clique "de verdade" numa linha da lista de conversas.
  // Na v7.0.3 o clique era disparado só no contêiner externo da linha; o WhatsApp registra o clique
  // num elemento INTERNO (e usa eventos de ponteiro), então a linha era achada mas a conversa não abria.
  function pointerClick(target, x, y) {
    const base = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0 };
    const ptr = (type, extra = {}) => new PointerEvent(type, { ...base, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true, ...extra });
    target.dispatchEvent(ptr('pointerdown'));
    target.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
    target.dispatchEvent(ptr('pointerup', { buttons: 0 }));
    target.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
    target.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
  }
  // Estratégias, da mais fiel ao clique humano à mais simples. Cada uma é tentada só se a anterior não abriu a conversa.
  const CLICK_STRATEGIES = ['ponto-interno', 'titulo', 'nativo'];
  function clickChatRow(row, strategy) {
    try { row.scrollIntoView({ block: 'center' }); } catch (e) { /* ignora */ }
    const r = row.getBoundingClientRect();
    const x = r.left + r.width * 0.4, y = r.top + r.height / 2; // 40% da largura: evita o ícone de fixar/menu à direita
    if (strategy === 'ponto-interno') {
      let t = null;
      try { t = document.elementFromPoint(x, y); } catch (e) { /* ignora */ }
      if (!t || !row.contains(t)) t = row.querySelector('[role="gridcell"], [role="row"], [data-testid="cell-frame-container"], div[tabindex]') || row;
      return pointerClick(t, x, y);
    }
    if (strategy === 'titulo') {
      const t = row.querySelector('span[title], [title], span[dir="auto"]') || row;
      return pointerClick(t, x, y);
    }
    // nativo: HTMLElement.click() no elemento interno e na linha
    const inner = row.querySelector('[role="gridcell"], [data-testid="cell-frame-container"], div[tabindex]');
    try { inner && inner.click(); } catch (e) { /* ignora */ }
    try { row.click(); } catch (e) { /* ignora */ }
  }
  function openChatHeader() { return $('#main header') || $(SELECTORS.headerName); }
  // Clica na linha e CONFIRMA que a conversa certa abriu (senão tenta a próxima estratégia).
  async function openRowVerified(row, isOpen, label, pred) {
    for (let a = 0; a < CLICK_STRATEGIES.length; a++) {
      const strategy = CLICK_STRATEGIES[a];
      // O React pode recriar a linha entre tentativas: procura de novo antes de clicar outra vez.
      const target = (a === 0 || !pred) ? row : (pred() || row);
      clickChatRow(target, strategy);
      let opened = false;
      for (let i = 0; i < 8 && !opened; i++) { await wait(500); opened = isOpen(target); }
      const h = openChatHeader();
      diag('CHAT_CLICK_ATTEMPT', opened ? 'success' : 'warn', { label, strategy, opened, header: textOf(h).slice(0, 80), hasMain: !!$('#main') });
      if (opened) return true;
    }
    return false;
  }

  function sendToContentScript(type, payload) {
    window.postMessage({ source: 'i9rcs7-injected', type, payload }, '*');
  }

  // ============================================================================
  // SPINTAX & VARIABLES
  // ============================================================================

  // Spintax {a|b|c}: resolve também blocos aninhados, de dentro para fora.
  function parseSpintax(text) {
    let out = String(text), guard = 0;
    while (/\{[^{}]+\}/.test(out) && guard++ < 10) {
      out = out.replace(/\{([^{}]+)\}/g, (m, options) => {
        const choices = options.split('|').map(o => o.trim());
        return choices[Math.floor(Math.random() * choices.length)];
      });
    }
    return out;
  }

  function cleanName(n) {
    const name = String(n || '').trim();
    return !name || /^[\d\s+()-]+$/.test(name) ? '' : name;
  }

  function privateChatIdentity(chat, contact) {
    const candidates = [
      { value: contact?.name, source: 'whatsapp_saved_contact', confidence: 0.99 },
      { value: contact?.verifiedName || contact?.verifiedBizName, source: 'whatsapp_verified_name', confidence: 0.97 },
      { value: contact?.shortName, source: 'whatsapp_saved_contact', confidence: 0.96 },
      { value: contact?.formattedName, source: 'whatsapp_formatted_contact', confidence: 0.94 },
      { value: contact?.pushname || contact?.pushName, source: 'whatsapp_push_name', confidence: 0.86 },
      { value: contact?.notifyName, source: 'whatsapp_push_name', confidence: 0.84 },
      { value: chat?.formattedTitle, source: 'whatsapp_chat_title', confidence: 0.82 },
      { value: chat?.name, source: 'whatsapp_chat_title', confidence: 0.80 },
      { value: chat?.pushName || chat?.title, source: 'whatsapp_chat_title', confidence: 0.76 },
    ];
    const identity = window.i9LeadIdentity?.selectBestNameCandidate
      ? window.i9LeadIdentity.selectBestNameCandidate(candidates)
      : candidates.map((item) => ({ ...item, value: cleanName(item.value) })).filter((item) => item.value).sort((a, b) => b.confidence - a.confidence)[0] || null;
    return identity ? {
      name: identity.value,
      identityMeta: { name: { source: identity.source, confidence: identity.confidence, observedAt: new Date().toISOString() } },
      nameSource: identity.source,
    } : { name: '', identityMeta: {}, nameSource: '' };
  }

  // Variáveis {{nome}}, {{primeiro_nome}}, {{telefone}}, {{email}}, {{empresa}}, {{categoria}}, {{estagio}}, {{etiqueta}}.
  // Variável desconhecida/vazia vira texto vazio (antes sobrava "{{x}" na mensagem).
  function interpolateVariables(template, variables) {
    return String(template).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (m, key) => {
      const k = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
      return variables[k] !== undefined ? String(variables[k]) : '';
    });
  }

  function processTemplate(template, contact) {
    const name = cleanName(contact.name || contact.pushName);
    const variables = {
      nome: name || 'Amigo',
      primeiro_nome: name ? name.split(/\s+/)[0] : 'Amigo',
      telefone: contact.phone || '',
      email: contact.email || '',
      empresa: contact.company || '',
      categoria: contact.category || '',
      estagio: contact.stage || '',
      etiqueta: contact.labels || '',
    };
    return parseSpintax(interpolateVariables(template, variables)).replace(/[ \t]+\n/g, '\n').trim();
  }

  function normalizePhone(p) {
    let d = String(p || '').replace(/\D/g, '').replace(/^0+/, '');
    if (d.length === 10 || d.length === 11) d = '55' + d; // Brasil
    return d;
  }

  class SendError extends Error {
    constructor(message, code = 'TECH') { super(message); this.code = code; }
  }

  // ============================================================================
  // NAVEGAÇÃO
  // ============================================================================


  // Garante que o WhatsApp esteja na lista principal de conversas.
  // O WhatsApp Web mantém a última seção aberta (incluindo Arquivadas),
  // portanto nunca iniciamos busca/envio sem validar o contexto.
  async function ensureMainChatList() {
    diag('WHATSAPP_CONTEXT_CHECK','info',{url:location.href});

    // (fix da v6.2.11) o texto "Arquivadas" aparece SEMPRE na lista principal (linha de atalho
    // para as conversas arquivadas), então olhar o body inteiro dava falso positivo e
    // bloqueava todos os envios. Agora só consideramos "dentro de Arquivadas" quando o
    // CABEÇALHO do painel lateral é o título "Arquivadas".
    const isArchivedView = () => {
      const heads = $$('#side header, #side [data-testid="chatlist-header"], #side [data-testid="archived-title"]');
      return heads.some(h => /^(arquivadas|archived)\b/i.test(textOf(h)));
    };

    if (!isArchivedView()) {
      diag('MAIN_CHAT_LIST_CONFIRMED','success');
      return true;
    }

    diag('ARCHIVED_LIST_DETECTED','error');

    const back = $('#side [data-testid="back"], #side button[aria-label*="Voltar" i], #side button[aria-label*="Back" i], #side [role="button"][aria-label*="Voltar" i], #side [role="button"][aria-label*="Back" i]');
    if (back) {
      clickElement(back);
      diag('RETURNING_TO_MAIN_CHATS','info');
      await wait(1500);
    }

    if (isArchivedView()) {
      // A busca do WhatsApp é global (inclui arquivadas), então seguimos em vez de abortar.
      diag('MAIN_CHAT_LIST_FAILED','warn');
      return true;
    }

    diag('MAIN_CHAT_LIST_CONFIRMED','success');
    return true;
  }

  function findSearchInput() {
    return $('[data-testid="chat-list-search-input"]') || $('#side [contenteditable="true"][role="textbox"]') || $('#side input[type="search"]') || $('#side input[type="text"]') || $(SELECTORS.searchInput);
  }

  function searchRows() {
    return $$('#side [role="listitem"], #side [role="row"], #side [data-testid="cell-frame-container"]').filter(el => textOf(el));
  }

  // Alternativa por interface (usada quando o acesso interno ao WhatsApp não está disponível).
  // Só abre a conversa se conseguir CONFIRMAR que é o número certo — nunca clica "no primeiro item".
  // v7.0.5: o próprio número NÃO é buscado (a busca não o lista): falha na hora, sem gastar ~35 s.
  function isOwnNumber(tail) { const me = String(getMyNumber() || '').replace(/\D/g, ''); return !!me && me.slice(-8) === tail; }
  const OWN_NUMBER_MSG = 'Este é o número da própria conta conectada ao WhatsApp. Use outro número (não é possível enviar para si mesmo pela campanha).';

  async function openChatByPhoneDOM(phone, { strict = false } = {}) {
    const cleanPhone = phone.replace(/\D/g, '');
    const tail = cleanPhone.slice(-8);
    // v7.0.5: defesa extra (a campanha já recusa antes de chegar aqui).
    if (isOwnNumber(tail)) { diag('OWN_NUMBER_SKIPPED','warn',{targetPhone:cleanPhone, where:'openChatByPhoneDOM'}); throw new SendError(OWN_NUMBER_MSG, 'INVALID'); }
    diag('LOCATE_CONVERSATION_START','info',{targetPhone:cleanPhone});
    await ensureMainChatList();

    const hdr0 = openChatHeader();
    if (hdr0 && textOf(hdr0).replace(/\D/g, '').includes(tail)) return true;

    let searchInput = findSearchInput();
    if (!searchInput) {
      const sb = $(SELECTORS.searchButton);
      if (sb) { clickElement(sb); await wait(400); searchInput = findSearchInput(); }
    }
    if (!searchInput) throw new SendError('Campo de pesquisa do WhatsApp não está disponível.', 'TECH');

    const byDigits = (el) => textOf(el).replace(/\D/g, '').includes(tail);
    const findRow = (pred) => searchRows().find(pred) || null;

    let match = null; const usedPred = byDigits;
    await simulateInput(searchInput, cleanPhone);
    for (let i = 0; i < 14 && !match; i++) {
      await wait(500);
      match = findRow(byDigits);
      const noResult = /nenhum resultado|no results|nenhuma conversa|no chats/i.test(textOf($('#side')) || '');
      if (noResult && i >= 3) break;
    }
    if (!match) {
      diag('CONTACT_NOT_FOUND','error',{targetPhone:cleanPhone});
      try { await simulateInput(searchInput, ''); } catch {}
      throw new SendError('Número não encontrado no WhatsApp (ou não verificável pela busca).', 'NOT_ON_WHATSAPP');
    }
    diag('CHAT_SELECTED','info',{targetPhone:cleanPhone, text:textOf(match).slice(0,100)});

    // v7.0.4 - clica (3 estratégias) e só segue quando o CABEÇALHO mostra a conversa certa.
    // (Antes bastava existir "algum" cabeçalho: com a conversa anterior aberta, isso daria falso positivo.)
    const before = textOf(openChatHeader());
    const rowName = chatNameFromElement(match).toLowerCase().trim();
    const normalizeChatName = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const isOpen = () => {
      const h = openChatHeader();
      if (!h) return false;
      const ht = textOf(h);
      if (ht.replace(/\D/g, '').includes(tail)) return true;
      const headerName = normalizeChatName(ht);
      const expectedName = normalizeChatName(rowName);
      const nameConfirmed = expectedName.length >= 4 && (headerName === expectedName || headerName.startsWith(expectedName));
      if (nameConfirmed) return true;
      // No Dashboard Comercial, falha fechada: cabeçalho diferente não prova que o chat certo abriu.
      if (strict) return false;
      return !!ht && ht !== before; // fallback legado usado no envio de campanhas
    };
    const opened = await openRowVerified(match, isOpen, 'phone:' + cleanPhone, () => findRow(usedPred));
    if (!opened) {
      diag('CHAT_OPEN_FAILED','error',{targetPhone:cleanPhone, rowName, before: before.slice(0,60), header: textOf(openChatHeader()).slice(0,60), hasMain: !!$('#main'), viewport: innerWidth + 'x' + innerHeight});
      throw new SendError('A conversa não abriu.', 'TECH');
    }
    diag('CHAT_OPENED','success',{header:textOf(openChatHeader()), expected:cleanPhone});
    return true;
  }

  function textOf(el) {
    return (el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function chatNameFromElement(el) {
    const nameEl = el?.querySelector(SELECTORS.chatName);
    const title = nameEl?.getAttribute('title') || el?.getAttribute('title') || '';
    return textOf(nameEl) || title || textOf(el).split(/\n|\r/).map(s => s.trim()).filter(Boolean)[0] || '';
  }

  function findChatItemByName(name) {
    const target = String(name || '').trim().toLowerCase();
    if (!target) return null;
    const selectors = '#pane-side [role="listitem"], #pane-side [data-testid="cell-frame-container"], #pane-side [data-testid*="cell-frame"]';
    const items = $$(selectors);
    return items.find(el => chatNameFromElement(el).toLowerCase() === target)
      || items.find(el => chatNameFromElement(el).toLowerCase().includes(target))
      || items.find(el => textOf(el).toLowerCase().includes(target));
  }

  async function openChatByName(name) {
    const target = String(name || '').trim().toLowerCase();
    if (!target) throw new Error('Nome do grupo não informado');
    const header = $(SELECTORS.headerName);
    if (header && textOf(header).toLowerCase() === target) return true;

    // Em muitas versões recentes o grupo já está na lista, mas o campo de
    // busca só existe depois que o usuário clica no ícone de lupa. Primeiro
    // tentamos clicar diretamente na conversa para evitar esse timeout.
    const wantedName = String(name || '').toLowerCase();
    const beforeHdr = textOf(openChatHeader());
    const nameOpen = () => { const h = openChatHeader(); const t = textOf(h); return !!h && (t.toLowerCase().includes(wantedName) || (!!t && t !== beforeHdr)); };
    const directItem = findChatItemByName(name);
    if (directItem) return openRowVerified(directItem, nameOpen, 'group:' + name, () => findChatItemByName(name));

    let searchInput = $(SELECTORS.searchInput);
    if (!searchInput) {
      const searchButton = $(SELECTORS.searchButton);
      if (searchButton) clickElement(searchButton);
      await wait(350);
      searchInput = $(SELECTORS.searchInput);
    }
    if (!searchInput) throw new Error('Grupo não localizado na lista. Abra a conversa do grupo no WhatsApp Web e tente novamente.');
    await simulateInput(searchInput, name);
    await wait(700);
    const item = findChatItemByName(name);
    if (!item) throw new Error(`Grupo "${name}" não encontrado na lista do WhatsApp`);
    return openRowVerified(item, nameOpen, 'group:' + name, () => findChatItemByName(name));
  }

  async function openGroupInfo() {
    const infoBtn = $(SELECTORS.infoBtn);
    if (infoBtn) clickElement(infoBtn);
    else {
      const header = $(SELECTORS.headerName);
      if (!header) throw new Error('Cabeçalho do grupo não encontrado');
      clickElement(header.closest('header button, header [role="button"], button') || header);
    }
    try { await waitForElement(SELECTORS.participantsList, 5000); } catch { /* segue: usamos o body como raiz */ }
    return true;
  }

  function closeDrawer() {
    const closeBtn = $(SELECTORS.drawerClose);
    if (closeBtn) clickElement(closeBtn);
  }

  // ============================================================================
  // ENVIO DE MENSAGEM
  // ============================================================================

  // Digita texto com quebras de linha no campo de mensagem (sem enviar com Enter).
  async function typeInto(el, text) {
    el.focus();
    try {
      const sel = window.getSelection(); const range = document.createRange();
      range.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(range);
      document.execCommand('delete');
    } catch (e) { /* segue */ }
    const lines = String(text).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) document.execCommand('insertLineBreak');
      if (lines[i]) document.execCommand('insertText', false, lines[i]);
    }
    await wait(150);
    if (!textOf(el)) {
      // alternativa: colar o texto
      try {
        const dt = new DataTransfer(); dt.setData('text/plain', text);
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      } catch (e) { /* ignora */ }
      await wait(150);
    }
  }

  function findSendButton() {
    const el = $(SELECTORS.sendBtn);
    return el ? (el.closest('button, [role="button"]') || el) : null;
  }

  function pressEnter(el) {
    const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', opts));
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  async function sendMessageDOM(message) {
    diag('MESSAGE_INSERT_START','info',{size:message.length});
    const input = await waitForElement(SELECTORS.msgInput, 8000).catch(() => null);
    if (!input) throw new SendError('Campo de mensagem não encontrado (conversa não abriu).', 'TECH');
    await typeInto(input, message);
    await wait(250);
    if (!textOf(input)) throw new SendError('Não foi possível digitar a mensagem no campo do WhatsApp.', 'TECH');

    const btn = findSendButton();
    if (btn) { diag('SEND_BUTTON_CLICK','info'); clickElement(btn); }
    else { diag('SEND_ENTER_KEY','info'); pressEnter(input); }

    for (let i = 0; i < 12; i++) { await wait(300); if (!textOf(input)) break; }
    if (textOf(input)) {
      pressEnter(input);
      await wait(1200);
      if (textOf(input)) throw new SendError('A mensagem não foi enviada (texto permaneceu no campo).', 'TECH');
    }
    diag('MESSAGE_SENT_CONFIRM','success');
    return { success: true, timestamp: Date.now() };
  }

  function currentChatLabel() {
    const el = $(SELECTORS.headerName);
    return String(el?.getAttribute('title') || el?.textContent || '').trim().slice(0, 180);
  }

  // ============================================================================
  // EXTRAÇÃO DE DADOS
  // ============================================================================

  function extractContactFromElement(el) {
    const raw = textOf(el);
    const nameEl = el.querySelector(SELECTORS.participantName);
    const phoneEl = el.querySelector(SELECTORS.participantPhone);
    const adminEl = el.querySelector(SELECTORS.adminBadge);
    const lines = raw.split(/\n|\r/).map(s => s.trim()).filter(Boolean);
    const phone = textOf(phoneEl).replace(/\D/g, '') || (raw.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] || '').replace(/\D/g, '');
    const rawName = textOf(nameEl) || lines.find(line => !/admin|participant|participante|you|você/i.test(line) && !/\d{6,}/.test(line)) || '';
    const name = rawName.replace(/\s*\(?(admin|administrador)\)?\s*$/i, '').trim();
    const validName = window.i9LeadIdentity?.isValidName ? window.i9LeadIdentity.isValidName(name) : !!name && !/^[+\d\s()./-]+$/.test(name);
    return {
      name: validName ? name : '',
      nameSource: validName ? 'whatsapp_group_member_dom' : '',
      identityMeta: validName ? { name: { source: 'whatsapp_group_member_dom', confidence: 0.78, observedAt: new Date().toISOString() } } : {},
      phone,
      isAdmin: !!adminEl || /\b(admin|administrador|group admin|adm do grupo)\b/i.test(raw),
      isActive: true,
      extractedAt: Date.now(),
    };
  }

  function findScrollable(root) {
    const els = [root, ...$$('*', root)];
    return els.filter(e => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY))
      .sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || null;
  }

  function participantRows(root) {
    const explicit = $$(SELECTORS.participant, root).filter(el => textOf(el));
    if (explicit.length) return explicit;
    return $$('div[role="button"], div[tabindex="0"]', root).filter(el => {
      const t = textOf(el);
      return t && (t.match(/\d{6,}/) || /admin|participante/i.test(t));
    });
  }

  async function extractGroupMembersDOM(groupName = '') {
    if (groupName) await openChatByName(groupName);
    await openGroupInfo();
    await wait(500);
    
    const list = $(SELECTORS.participantsList) || document.body;
    if (!list) throw new Error('Lista de participantes não encontrada');

    // A lista do WhatsApp é virtualizada: só as linhas visíveis existem no DOM.
    // Por isso acumulamos os membros a cada passo da rolagem.
    const scroller = findScrollable(list) || list;
    const acc = new Map();
    const collect = () => participantRows(list).map(extractContactFromElement).filter(m => m.name || m.phone)
      .forEach(m => { const k = m.phone ? 'p:' + m.phone : 'n:' + m.name; if (!acc.has(k)) acc.set(k, m); });
    scroller.scrollTop = 0; await wait(300);
    let stuck = 0;
    for (let i = 0; i < 400 && stuck < 3; i++) {
      collect();
      const before = scroller.scrollTop;
      scroller.scrollTop = before + Math.max(200, scroller.clientHeight * 0.8);
      await wait(350);
      stuck = scroller.scrollTop === before ? stuck + 1 : 0;
    }
    collect();
    const members = Array.from(acc.values());
    closeDrawer();
    
    return members;
  }

  async function extractAllChatsDOM() {
    const chats = [];
    const list = $(SELECTORS.chatList);
    if (!list) return chats;
    
    let lastCount = 0;
    for (let i = 0; i < 20; i++) {
      const items = $$(SELECTORS.chatItem, list);
      if (items.length === lastCount) break;
      lastCount = items.length;
      list.scrollTop = list.scrollHeight;
      await wait(200);
    }
    
    $$(SELECTORS.chatItem, list).forEach(item => {
      const name = chatNameFromElement(item);
      if (!name || chats.some(c => c.name === name)) return;
      const raw = textOf(item);
      const digits = name.replace(/\D/g, '');
      const icon = item.querySelector('[data-icon], [data-testid*="group" i], svg');
      const iconText = `${icon?.getAttribute('data-icon') || ''} ${icon?.getAttribute('data-testid') || ''} ${icon?.getAttribute('aria-label') || ''}`;
      const isGroup = /group|grupo|default-group|community|comunidade/i.test(`${iconText} ${item.getAttribute('aria-label') || ''}`)
        || !!item.querySelector('[data-icon="default-group"], [data-testid="default-group"], [data-testid*="group"]');
      chats.push({ id: item.getAttribute('data-id') || name, name, phone: digits.length >= 10 && !isGroup ? digits : '', isGroup, isActive: true, raw });
    });
    
    return chats;
  }

  // ============================================================================
  // STORE INTERNO DO WHATSAPP WEB (fonte principal de grupos e participantes)
  // ----------------------------------------------------------------------------
  // O DOM do WhatsApp Web muda toda semana (data-testid removidos, lista virtualizada,
  // números ocultos por LID). Os dados estruturados vivem nas coleções internas
  // (Chat, GroupMetadata, Contact), acessíveis pelo carregador de módulos da página.
  // O DOM fica apenas como alternativa.
  // ============================================================================

  const asArray = (c) => {
    if (!c) return [];
    if (Array.isArray(c)) return c;
    try {
      if (typeof c.getModelsArray === 'function') return c.getModelsArray() || [];
      if (Array.isArray(c.models)) return c.models;
      if (Array.isArray(c._models)) return c._models;
      if (typeof c.toArray === 'function') return c.toArray() || [];
      if (typeof c.values === 'function') return Array.from(c.values());
    } catch { /* ignora */ }
    return [];
  };
  const serialize = (w) => {
    if (!w) return '';
    if (typeof w === 'string') return w;
    if (w._serialized) return w._serialized;
    if (w.user && w.server) return `${w.user}@${w.server}`;
    if (w.id && w.id !== w) return serialize(w.id);
    return '';
  };
  const widServer = (w) => w?.server || serialize(w).split('@')[1] || '';
  const widUser = (w) => w?.user || serialize(w).split('@')[0] || '';
  const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

  function tryRequire(name) {
    try { return typeof window.require === 'function' ? window.require(name) : null; } catch { return null; }
  }

  function loadStore() {
    // 1) Carregador de módulos nomeados (WhatsApp Web atual)
    const col = tryRequire('WAWebCollections');
    if (col && (col.Chat || col.GroupMetadata)) {
      return { via: 'require', Collections: col, mod: tryRequire };
    }
    // 2) Fallback webpack: varre só módulos JÁ carregados (cache), sem executar nenhum novo
    try {
      const chunk = window.webpackChunkwhatsapp_web_client;
      if (chunk && typeof chunk.push === 'function') {
        let wreq;
        chunk.push([[`i9rcs_${Date.now()}`], {}, (r) => { wreq = r; }]);
        const cache = wreq && wreq.c;
        if (cache) {
          for (const id of Object.keys(cache)) {
            const ex = cache[id] && cache[id].exports;
            const c = ex && (ex.Chat ? ex : ex.default && ex.default.Chat ? ex.default : null);
            if (c && c.Chat && typeof (c.Chat.getModelsArray || c.Chat.get) === 'function' && c.GroupMetadata) {
              return { via: 'webpack', Collections: c, mod: () => null };
            }
          }
        }
      }
    } catch { /* ignora */ }
    return null;
  }

  async function getStore(timeout = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const st = loadStore();
      // "pronto" = a lista de chats já foi sincronizada
      if (st && asArray(st.Collections.Chat).length > 0) return st;
      await wait(500);
    }
    return null;
  }

  function storeStatus() {
    try {
      const st = loadStore();
      if (!st) return { ok: false };
      return { ok: true, via: st.via, chats: asArray(st.Collections.Chat).length, contacts: asArray(st.Collections.Contact).length };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  /** v7.0.5 - Diagnóstico do acesso interno (sem dados de conversas): o que existe e o que foi encontrado. */
  function storeInternals() {
    const o = { hasRequire: typeof window.require, hasWebpack: !!window.webpackChunkwhatsapp_web_client, modules: {} };
    for (const n of ['WAWebCollections', 'WAWebSendTextMsgChatAction', 'WAWebWidFactory', 'WAWebQueryExistsJob']) o.modules[n] = !!tryRequire(n);
    try { const st = loadStore(); o.via = st ? st.via : null; o.chats = st ? asArray(st.Collections.Chat).length : 0; } catch (e) { o.error = e.message; }
    o.disabledAfterFailure = !!storeDisabled;
    return o;
  }

  function groupMetaOf(st, chat, wid) {
    return chat?.groupMetadata || st.Collections.GroupMetadata?.get?.(wid) || null;
  }

  function listGroupsFromStore(st) {
    const out = new Map();
    const add = (wid, chat, gm) => {
      const id = serialize(wid);
      if (!id || out.has(id)) return;
      const parts = asArray(gm?.participants);
      out.set(id, {
        id,
        name: chat?.formattedTitle || chat?.name || gm?.subject || 'Grupo sem nome',
        phone: '',
        isGroup: true,
        isCommunity: !!gm?.isParentGroup,
        isCommunityAnnouncement: !!(gm?.isDefaultSubgroup || gm?.defaultSubgroup),
        size: parts.length || gm?.size || 0,
        isActive: true,
        raw: '',
      });
    };
    for (const chat of asArray(st.Collections.Chat)) {
      if (widServer(chat.id) !== 'g.us') continue;
      add(chat.id, chat, groupMetaOf(st, chat, chat.id));
    }
    // Comunidades (grupo-pai) e grupos que existem só nos metadados
    for (const gm of asArray(st.Collections.GroupMetadata)) {
      if (widServer(gm.id) !== 'g.us') continue;
      add(gm.id, st.Collections.Chat?.get?.(gm.id), gm);
    }
    return Array.from(out.values());
  }

  async function asPhone(v) {
    try { v = await Promise.resolve(v); } catch { return ''; }
    if (!v) return '';
    if (typeof v === 'string') {
      if (/@(c\.us|s\.whatsapp\.net)$/.test(v)) return onlyDigits(v.split('@')[0]);
      return /^\+?\d{8,15}$/.test(v) ? onlyDigits(v) : '';
    }
    if (typeof v === 'object' && /^(c\.us|s\.whatsapp\.net)$/.test(widServer(v))) return onlyDigits(widUser(v));
    return '';
  }

  // Contas novas usam LID (xxxx@lid) nos grupos; o telefone real precisa ser resolvido.
  async function resolvePhone(st, wid, participant, contact) {
    if (/^(c\.us|s\.whatsapp\.net)$/.test(widServer(wid))) return onlyDigits(widUser(wid));
    const tries = [
      () => participant?.phoneNumber,
      () => contact?.phoneNumber,
      () => contact?.id && /^(c\.us|s\.whatsapp\.net)$/.test(widServer(contact.id)) ? contact.id : null,
      () => st.mod('WAWebApiContact')?.getPhoneNumber?.(wid),
      () => st.mod('WAWebLidMigrationUtils')?.toPn?.(wid),
      () => st.mod('WAWebLidMigrationUtils')?.getPhoneNumber?.(wid),
      () => st.mod('WAWebLidPnCache')?.lidPnCache?.getPhoneNumber?.(wid),
    ];
    for (const fn of tries) {
      let v; try { v = fn(); } catch { continue; }
      const phone = await asPhone(v);
      if (phone) return phone;
    }
    return '';
  }

  // v1.1.0: ids do próprio usuário (telefone e LID) para marcar/ocultar o "eu" na lista do grupo.
  function myUserIds(st) {
    const ids = new Set(); const phone = onlyDigits(getMyNumber());
    if (phone) ids.add(phone);
    for (const [mod, fn] of [['WAWebUserPrefsMeUser', 'getMaybeMePnUser'], ['WAWebUserPrefsMeUser', 'getMaybeMeLidUser'], ['WAWebUserPrefsMeUser', 'getMaybeMeUser']]) {
      try { const w = st.mod(mod)?.[fn]?.(); const u = widUser(w); if (u) ids.add(onlyDigits(u) || u); } catch { /* ignora */ }
    }
    return ids;
  }
  const isMeId = (ids, pid, phone) => {
    const u = widUser(pid); const p = onlyDigits(phone);
    for (const me of ids) { if (me === u || me === onlyDigits(u)) return true; if (p && me.length >= 8 && p.slice(-8) === me.slice(-8)) return true; }
    return false;
  };


  // ============================================================================
  // OPORTUNIDADES AUTOMÁTICAS — CONVERSAS PRIVADAS DO WHATSAPP
  // ----------------------------------------------------------------------------
  // A coleção Chat é a fonte principal. Não lemos nem armazenamos o conteúdo das
  // mensagens: apenas metadados necessários para representar a conversa no CRM.
  // Grupos, canais, broadcasts e status ficam fora desta rotina.
  // ============================================================================

  let privateOpportunityTimer = null;
  let privateScanInFlight = null;
  let privateChatFingerprints = new Map();
  let privateMonitorAccount = '';
  let privateMonitorHasSynced = false;

  function privateChatServer(chat) {
    return String(widServer(chat?.id) || '').toLowerCase();
  }

  function isPrivateChat(chat) {
    if (!chat?.id) return false;
    if (chat.isGroup || chat.isBroadcast || chat.isNewsletter || chat.isStatus) return false;
    const id = serialize(chat.id);
    if (!id || /^(status|broadcast)@broadcast$/i.test(id)) return false;
    const server = privateChatServer(chat);
    if (/^(g\.us|broadcast|newsletter)$/i.test(server)) return false;
    // c.us/s.whatsapp.net são os IDs tradicionais; lid é usado por contas novas.
    // Para futuras mudanças internas, aceitamos também um ID não bloqueado quando
    // o próprio objeto diz explicitamente que não é grupo/broadcast.
    return /^(c\.us|s\.whatsapp\.net|lid)$/i.test(server) || (!!server && !/@(?:g\.us|broadcast|newsletter)$/i.test(id));
  }

  function contactForPrivateChat(st, chat, contactMap) {
    const C = st.Collections;
    const ids = [chat?.id, chat?.contact?.id, chat?.contactId].filter(Boolean);
    for (const id of ids) {
      try { const c = C.Contact?.get?.(id); if (c) return c; } catch { /* ignora */ }
      const key = serialize(id);
      if (key && contactMap?.has(key)) return contactMap.get(key);
    }
    return null;
  }

  function timestampMs(value) {
    if (value == null || value === '') return 0;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n < 100000000000 ? n * 1000 : n;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function privateChatLastMessageAt(chat) {
    const direct = [
      chat?.t,
      chat?.timestamp,
      chat?.lastMessage?.t,
      chat?.lastMessage?.timestamp,
      chat?.lastReceivedMsg?.t,
      chat?.lastReceivedMessage?.t,
    ];
    for (const v of direct) {
      const t = timestampMs(v);
      if (t) return t;
    }
    try {
      const msgs = chat?.msgs;
      const models = Array.isArray(msgs?.models) ? msgs.models : (Array.isArray(msgs) ? msgs : null);
      if (models?.length) {
        for (let i = models.length - 1; i >= 0; i--) {
          const t = timestampMs(models[i]?.t ?? models[i]?.timestamp);
          if (t) return t;
        }
      }
    } catch { /* ignora */ }
    return 0;
  }

  function privateMessageModels(chat) {
    try {
      const raw = chat?.msgs;
      const models = Array.isArray(raw?.models) ? raw.models : (Array.isArray(raw) ? raw : []);
      return models.filter(Boolean).slice().sort((a, b) => timestampMs(a?.t ?? a?.timestamp) - timestampMs(b?.t ?? b?.timestamp));
    } catch { return []; }
  }

  function privateMessageText(m) {
    const candidates = [
      m?.body, m?.caption, m?.text, m?.content,
      m?.msg?.body, m?.msg?.caption, m?._data?.body, m?._data?.caption,
    ];
    for (const v of candidates) {
      const s = String(v ?? '').replace(/\u200b/g, '').trim();
      if (s) return s.slice(0, 2000);
    }
    return '';
  }

  function privateMessageFromMe(m, meIds) {
    if (m?.fromMe === true || m?.isFromMe === true || m?.id?.fromMe === true) return true;
    const author = m?.author || m?.senderObj?.id || m?.id?.participant || m?.from || null;
    if (author && isMeId(meIds, author, widUser(author))) return true;
    return false;
  }

  function stableMessageFingerprint(text) {
    const s = String(text || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!s) return '';
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'm_' + (h >>> 0).toString(16);
  }

  function savedContactState(contact, chat) {
    const values = [contact?.isMyContact, contact?.isContact, contact?.isAddressBookContact, chat?.isMyContact];
    if (values.some((v) => v === true)) return true;
    if (values.some((v) => v === false)) return false;
    return null;
  }

  function privateClassificationEvidence(chat, contact, meIds) {
    const models = privateMessageModels(chat);
    const rows = models.map((m) => {
      const t = timestampMs(m?.t ?? m?.timestamp);
      return { t, fromMe: privateMessageFromMe(m, meIds), text: privateMessageText(m) };
    }).filter((x) => x.t || x.text);

    // v1.0.3-fix5: considera mensagens incoming mesmo sem texto (midia, sticker, audio)
    // para nao perder a classificacao de aguardando resposta quando a ultima mensagem
    // recebida nao tem corpo de texto. O filtro original exigia x.text.
    const incoming = rows.filter((x) => !x.fromMe && (x.text || x.t));
    const outgoing = rows.filter((x) => x.fromMe);
    const first = rows.find((x) => !x.fromMe && (x.text || x.t)) || null;
    const incomingTimes = incoming.map((x) => x.t).filter(Boolean).slice(-40);
    const incomingTexts = incoming.slice(-10).map((x) => x.text).filter(Boolean);
    const firstText = first?.text || '';
    const saved = savedContactState(contact, chat);

    // Sinais derivados e sem conteúdo bruto persistente no CRM.
    const normalizedFirst = firstText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const firstHasUrl = /\bhttps?:\/\/[^\s]+|\b(?:www\.)?[a-z0-9-]+\.(?:com|com\.br|net|org|io|co|me|app|site|online)(?:\/[^\s]*)?/i.test(firstText);
    const firstShortened = /(?:^|[^\w])(?:bit\.ly|tinyurl\.com|t\.co|is\.gd|ow\.ly|cutt\.ly|rebrand\.ly|shorturl\.at|buff\.ly|lnkd\.in|tiny\.cc|rb\.gy|s\.id)(?:[/?#\s]|$)/i.test(firstText);
    const firstPromo = /\b(?:promo(?:ção|cao)?|oferta|desconto|cupom|imperd[ií]vel|imperdivel|liquida(?:ção|cao)?|s[oó] hoje|so hoje|gr[aá]tis|gratis|ganhe|brinde|b[oô]nus|clique|compr(?:e|ar)|venda|black friday|frete gr[aá]tis|frete gratis)\b/i.test(firstText);
    const allText = [firstText, ...incomingTexts].join('\n');
    const keywordProbe = /\b(?:aposta|apostas|bet|bets|cassino|casino|roleta|criptomoeda|cripto|bitcoin|ethereum|airdrop|forex|ganhe dinheiro|ganhar dinheiro|renda extra|dinheiro facil|investimento garantido|lucro garantido|multiplique seu dinheiro)\b/i.exec(allText);

    return {
      userReplied: outgoing.length > 0,
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
      lastIncomingAt: incoming.length ? new Date(incoming[incoming.length - 1].t).toISOString() : null,
      lastOutgoingAt: outgoing.length && outgoing[outgoing.length - 1].t ? new Date(outgoing[outgoing.length - 1].t).toISOString() : null,
      incomingTimestamps: incomingTimes,
      incomingTexts,
      firstIncomingText: firstText,
      firstIncomingAt: first?.t ? new Date(first.t).toISOString() : null,
      firstMessageHasShortenedLink: firstShortened,
      firstMessagePromotional: firstPromo,
      firstMessagePromotionalLink: firstHasUrl && firstPromo,
      spamKeywordMatch: keywordProbe ? keywordProbe[0] : '',
      firstIncomingFingerprint: stableMessageFingerprint(normalizedFirst),
      isSavedContact: saved,
      // Preenchido pelo Service Worker com base na data de envio da campanha.
      respondedToCampaign: false,
      twoWayRecent: false,
    };
  }

  async function listPrivateChatsFromStore(st, meIds) {
    const C = st.Collections;
    const contactMap = new Map();
    for (const c of asArray(C.Contact)) {
      const id = serialize(c?.id);
      if (id) contactMap.set(id, c);
    }

    const candidates = asArray(C.Chat).filter((chat) => isPrivateChat(chat));
    const out = new Array(candidates.length);
    let cursor = 0;
    const worker = async () => {
      while (true) {
        const index = cursor++;
        if (index >= candidates.length) return;
        const chat = candidates[index];
        const waChatId = serialize(chat?.id);
        if (!waChatId) continue;
        const contact = contactForPrivateChat(st, chat, contactMap);
        // Resolução de LID pode depender de módulos internos que não respondem em
        // algumas versões do WhatsApp. Um contato não deve bloquear a descoberta
        // de todas as outras conversas.
        const resolvedPhone = await Promise.race([
          resolvePhone(st, chat.id, chat?.contact, contact).catch(() => ''),
          wait(900).then(() => ''),
        ]);
        const phone = normalizePhone(resolvedPhone);
        const validPhone = phone.length >= 10 && phone.length <= 15 ? phone : '';
        const identity = privateChatIdentity(chat, contact);
        const lastMs = privateChatLastMessageAt(chat);
        const msgCount = asArray(chat?.msgs).length;
        out[index] = {
          waChatId,
          name: identity.name,
          nameSource: identity.nameSource,
          identityMeta: {
            ...identity.identityMeta,
            ...(validPhone ? { phone: { source: 'whatsapp_store_phone', confidence: 0.98, observedAt: new Date().toISOString() } } : {}),
          },
          phone: validPhone,
          lastMessageAt: lastMs ? new Date(lastMs).toISOString() : null,
          unreadCount: Number(chat?.unreadCount ?? chat?.unread ?? 0) || 0,
          messageCount: msgCount,
          archived: !!(chat?.archive ?? chat?.archived),
          pinned: !!(chat?.pin ?? chat?.pinned),
          muted: !!chat?.mute,
          classifierEvidence: privateClassificationEvidence(chat, contact, meIds),
        };
      }
    };
    await Promise.all(Array.from({ length: Math.min(8, candidates.length) }, () => worker()));
    return out.filter(Boolean);
  }

  function privateChatFingerprint(chat) {
    const e = chat.classifierEvidence || {};
    return [
      chat.waChatId,
      chat.name,
      chat.nameSource || chat.identityMeta?.name?.source || '',
      Number(chat.identityMeta?.name?.confidence) || 0,
      chat.phone,
      chat.lastMessageAt || '',
      chat.unreadCount || 0,
      chat.messageCount || 0,
      chat.archived ? 1 : 0,
      chat.pinned ? 1 : 0,
      chat.muted ? 1 : 0,
      e.userReplied ? 1 : 0,
      e.lastIncomingAt || '',
      e.lastOutgoingAt || '',
      e.firstIncomingFingerprint || '',
      e.isSavedContact == null ? '' : (e.isSavedContact ? '1' : '0'),
    ].join('|');
  }

  // v1.0.3-fix3: carrega histórico de mensagens para conversas privadas antes da classificação.
  // Garante que mensagens antigas (anteriores à instalação) sejam consideradas.
  async function loadPrivateChatHistory(st, chat, maxMs = 8000, maxIter = 30) {
    if (!chat || !st) return { loaded: 0, complete: false };
    let reachedStart = false;
   const beforeCount = asArray(chat?.msgs).length;
    try {
      const lm = st.mod("WAWebChatLoadMessages");
     if (typeof lm?.loadEarlierMsgs !== "function") {
       diag('PRIVATE_HISTORY_LOAD_SKIP', 'warn', { waChatId: serialize(chat?.id), reason: 'MODULE_NOT_FOUND', msgsBefore: beforeCount });
       return { loaded: beforeCount, complete: false };
     }
      let prev = -1; const t0 = Date.now();
      for (let k = 0; k < maxIter && (Date.now() - t0) < maxMs; k++) {
        const n = asArray(chat.msgs).length;
        if (n === prev) { reachedStart = true; break; }
        prev = n;
        await lm.loadEarlierMsgs(chat, chat.msgs);
      }
    } catch { /* usa o que já está carregado */ }
   const afterCount = asArray(chat?.msgs).length;
   diag('PRIVATE_HISTORY_LOADED', 'info', {
     waChatId: serialize(chat?.id),
     msgsBefore: beforeCount,
     msgsAfter: afterCount,
     gained: afterCount - beforeCount,
     complete: reachedStart,
   });
   return { loaded: afterCount, complete: reachedStart };
  }

  async function syncPrivateChatsToCrm({ force = false, syncRunId = null } = {}) {
    if (privateScanInFlight) {
      // If a manual sync arrives during an automatic scan, queue it instead of
      // dropping the click and tell the panel why the manual pass is waiting.
      if (force) {
        if (syncRunId) sendToContentScript('PRIVATE_CHATS_SYNC_PROGRESS', {
          syncRunId, phase: 'queued', processedSoFar: 0, totalChats: 0,
          message: 'Aguardando a varredura em andamento terminar',
        });
        return privateScanInFlight.then(() => syncPrivateChatsToCrm({ force, syncRunId }));
      }
      return privateScanInFlight;
    }

    privateScanInFlight = (async () => {
      const st = loadStore();
      const rawChats = asArray(st?.Collections?.Chat);
      if (!st || !rawChats.length) {
        const result = { success: false, scanned: 0, changed: 0, reason: 'STORE_NOT_READY' };
        if (syncRunId) sendToContentScript('PRIVATE_CHATS_SYNC_FAILED', { syncRunId, error: 'STORE_NOT_READY', message: 'O WhatsApp ainda está carregando as conversas.' });
        return result;
      }

      const scanId = 'wa_priv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const meIds = myUserIds(st);
      const accountSignature = [...meIds].sort().join('|') || String(getMyNumber() || '');
      if (privateMonitorAccount && accountSignature && privateMonitorAccount !== accountSignature) {
        privateChatFingerprints.clear();
        privateMonitorHasSynced = false;
        diag('PRIVATE_OPPORTUNITY_ACCOUNT_CHANGED', 'info');
      }
      if (accountSignature) privateMonitorAccount = accountSignature;

      sendToContentScript('PRIVATE_CHATS_SYNC_PROGRESS', {
        syncRunId, scanId, phase: 'discover', processedSoFar: 0,
        totalChats: rawChats.length, message: 'Localizando conversas privadas do WhatsApp',
      });
      const all = await listPrivateChatsFromStore(st, meIds);
      const rawById = new Map(rawChats.map((chat) => [serialize(chat?.id), chat]).filter(([id]) => !!id));
      const contactMap = new Map();
      for (const contact of asArray(st.Collections.Contact)) {
        const id = serialize(contact?.id);
        if (id) contactMap.set(id, contact);
      }
      const firstSync = !privateMonitorHasSynced;
      const shouldLoadHistory = firstSync || force;
      const batchSize = 20;
      let historyLoadedCount = 0;
      let historyCompleteCount = 0;
      let errorsCount = 0;
      let changed = 0;

      const currentSnapshot = (item) => {
        const rawChat = rawById.get(item.waChatId);
        if (!rawChat) return item;
        const contact = contactForPrivateChat(st, rawChat, contactMap);
        const lastMs = privateChatLastMessageAt(rawChat);
        const liveIdentity = privateChatIdentity(rawChat, contact);
        const snapshot = {
          ...item,
          ...(liveIdentity.name ? { name: liveIdentity.name, nameSource: liveIdentity.nameSource, identityMeta: { ...(item.identityMeta || {}), ...liveIdentity.identityMeta } } : {}),
          classifierEvidence: privateClassificationEvidence(rawChat, contact, meIds),
          messageCount: asArray(rawChat?.msgs).length,
          lastMessageAt: lastMs ? new Date(lastMs).toISOString() : item.lastMessageAt,
        };
        const fp = privateChatFingerprint(snapshot);
        if (force || privateChatFingerprints.get(snapshot.waChatId) !== fp) changed++;
        privateChatFingerprints.set(snapshot.waChatId, fp);
        return snapshot;
      };
      const baseChats = all.map(currentSnapshot).filter((chat) => {
        if (isMeId(meIds, chat.waChatId, chat.phone)) return false;
        return true;
      });
      console.log('[i9Hub Sync] ' + JSON.stringify({ event: 'CHAT_DISCOVERY_RESULT', syncRunId, scanId, privateChatCount: baseChats.length, timestamp: new Date().toISOString(), context: 'injected' }));
      console.log('[i9Hub Sync] ' + JSON.stringify({ event: 'CONTENT_SCRIPT_SYNC_STARTED', syncRunId, scanId, totalChats: rawChats.length, force, firstSync, timestamp: new Date().toISOString(), context: 'injected' }));

      // Phase 1: import contact/opportunity metadata immediately. This is deliberately
      // independent from historical-message loading so the first CRM column fills early.
      for (let offset = 0; offset < baseChats.length; offset += batchSize) {
        const batch = baseChats.slice(offset, offset + batchSize);
        const processedSoFar = Math.min(offset + batch.length, baseChats.length);
        const lastImportBatch = !shouldLoadHistory && processedSoFar >= baseChats.length;
        sendToContentScript('PRIVATE_CHATS_DETECTED', {
          scanId, syncRunId, batchIndex: Math.floor(offset / batchSize),
          batchTotal: Math.max(1, Math.ceil(baseChats.length / batchSize)),
          finalBatch: lastImportBatch, phase: 'import', fullSync: firstSync,
          automatic: !force, totalChats: baseChats.length,
          historyLoaded: 0, historyComplete: 0, chats: batch, processedSoFar,
        });
        sendToContentScript('PRIVATE_CHATS_SYNC_PROGRESS', {
          syncRunId, scanId, phase: 'import', processedSoFar,
          totalChats: baseChats.length, message: 'Importando conversas para o CRM',
        });
      }

      if (!shouldLoadHistory) {
        if (!baseChats.length) {
          sendToContentScript('PRIVATE_CHATS_DETECTED', {
            scanId, syncRunId, batchIndex: 0, batchTotal: 1, finalBatch: true,
            phase: 'import', fullSync: firstSync, automatic: !force,
            totalChats: 0, chats: [], processedSoFar: 0,
          });
        }
      } else {
        // Phase 2: enrich the already-imported leads with older history. A small worker
        // pool prevents one slow LID or chat-history request from serially blocking all PVs.
        const enrichedChats = new Array(baseChats.length);
        let cursor = 0;
        let historyProcessed = 0;
        const historyWorker = async () => {
          while (true) {
            const index = cursor++;
            if (index >= baseChats.length) return;
            let item = baseChats[index];
            const rawChat = rawById.get(item.waChatId);
            if (rawChat) {
              try {
                const beforeCount = asArray(rawChat?.msgs).length;
                const histTimeout = 2200;
                const coverage = await Promise.race([
                  loadPrivateChatHistory(st, rawChat, histTimeout, 12),
                  wait(histTimeout + 300).then(() => ({ loaded: beforeCount, complete: false, timedOut: true })),
                ]);
                if (Number(coverage.loaded) > beforeCount) historyLoadedCount++;
                if (coverage.complete) historyCompleteCount++;
                const contact = contactForPrivateChat(st, rawChat, contactMap);
                const resolvedPhone = await Promise.race([
                  resolvePhone(st, rawChat.id, rawChat?.contact, contact).catch(() => ''),
                  wait(500).then(() => ''),
                ]);
                const phone = normalizePhone(resolvedPhone);
                const lastMs = privateChatLastMessageAt(rawChat);
                item = {
                  ...item,
                  phone: phone.length >= 10 && phone.length <= 15 ? phone : item.phone,
                  classifierEvidence: privateClassificationEvidence(rawChat, contact, meIds),
                  messageCount: asArray(rawChat?.msgs).length,
                  lastMessageAt: lastMs ? new Date(lastMs).toISOString() : item.lastMessageAt,
                };
              } catch (error) {
                errorsCount++;
                diag('PRIVATE_CHAT_PROCESS_ERROR', 'warn', { waChatId: String(item.waChatId || '').slice(-8), error: error?.message || String(error) });
              }
            }
            enrichedChats[index] = item;
            historyProcessed++;
            if (historyProcessed % 5 === 0 || historyProcessed === baseChats.length) {
              sendToContentScript('PRIVATE_CHATS_SYNC_PROGRESS', {
                syncRunId, scanId, phase: 'history', processedSoFar: historyProcessed,
                totalChats: baseChats.length, historyLoaded: historyLoadedCount,
                historyComplete: historyCompleteCount, errors: errorsCount,
                message: 'Lendo histórico das conversas privadas',
              });
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(4, baseChats.length) }, () => historyWorker()));

        if (!enrichedChats.length) {
          sendToContentScript('PRIVATE_CHATS_DETECTED', {
            scanId, syncRunId, batchIndex: 0, batchTotal: 1, finalBatch: true,
            phase: 'history', fullSync: firstSync, automatic: !force,
            totalChats: 0, chats: [], processedSoFar: 0,
            historyLoaded: historyLoadedCount, historyComplete: historyCompleteCount,
            errorsCount,
          });
        } else {
          for (let offset = 0; offset < enrichedChats.length; offset += batchSize) {
            const batch = enrichedChats.slice(offset, offset + batchSize);
            const processedSoFar = Math.min(offset + batch.length, enrichedChats.length);
            const finalBatch = processedSoFar >= enrichedChats.length;
            sendToContentScript('PRIVATE_CHATS_DETECTED', {
              scanId, syncRunId, batchIndex: Math.floor(offset / batchSize),
              batchTotal: Math.ceil(enrichedChats.length / batchSize), finalBatch,
              phase: 'history', fullSync: firstSync, automatic: !force,
              totalChats: enrichedChats.length, chats: batch, processedSoFar,
              historyLoaded: historyLoadedCount, historyComplete: historyCompleteCount,
              errorsCount,
            });
          }
        }
      }

      privateMonitorHasSynced = true;
      if (firstSync || changed) {
        diag('PRIVATE_OPPORTUNITY_SCAN', 'info', {
          scanned: baseChats.length, changed, firstSync, force,
          historyLoaded: historyLoadedCount, historyComplete: historyCompleteCount,
          errors: errorsCount,
        });
      }
      return { success: true, scanned: baseChats.length, changed, firstSync, syncRunId };
    })().catch((error) => {
      const message = error?.message || String(error);
      diag('PRIVATE_OPPORTUNITY_SCAN_ERROR', 'warn', { error: message });
      if (syncRunId) sendToContentScript('PRIVATE_CHATS_SYNC_FAILED', { syncRunId, error: message, message: 'A sincronização das conversas privadas foi interrompida.' });
      return { success: false, scanned: 0, changed: 0, error: message };
    }).finally(() => {
      privateScanInFlight = null;
    });
    return privateScanInFlight;
  }

  function startPrivateOpportunityMonitor() {
    if (privateOpportunityTimer) return;
    const tick = () => {
      if (window.__i9rcsInjectedV7Version !== EXT_VER) return;
      // v1.0.3-fix: permite varredura mesmo sem conversa aberta (#pane-side visível).
      // A lista de chats existe no Store mesmo quando o painel lateral está oculto ou
      // nenhuma conversa privada está selecionada. O gate anterior bloqueava a primeira
      // sincronização automática em contas recém-carregadas.
      const pg = pageState();
      if (pg === 'qr' || pg === 'error') return;
      syncPrivateChatsToCrm().catch(() => {});
    };
    // Dá tempo para o Store terminar de sincronizar após o carregamento do WhatsApp.
    setTimeout(tick, 2500);
    privateOpportunityTimer = setInterval(tick, 7000);
  }

  // v5.1.0: carrega o histórico do grupo até cobrir `periodDays` (padrão 90). Devolve a cobertura real:
  // `oldest` = mensagem mais antiga carregada; `complete` = true se o período inteiro foi coberto
  // (ou se o WhatsApp não tem mais mensagens antigas para carregar).
  async function loadGroupHistory(st, chat, periodDays) {
    const since = periodDays > 0 ? Date.now() - periodDays * 86400000 : 0;
    const oldestOf = () => { let o = Infinity; for (const m of asArray(chat?.msgs)) { const t = (Number(m?.t) || 0) * 1000; if (t && t < o) o = t; } return o === Infinity ? 0 : o; };
    let reachedStart = false;
    try {
      const lm = st.mod('WAWebChatLoadMessages'); let prev = -1; const t0 = Date.now();
      const maxMs = periodDays > 0 ? 45000 : 6000; const maxIter = periodDays > 0 ? 150 : 20;
      for (let k = 0; k < maxIter && Date.now() - t0 < maxMs && typeof lm?.loadEarlierMsgs === 'function'; k++) {
        const o = oldestOf(); if (since && o && o <= since) { reachedStart = true; break; }
        const n = asArray(chat.msgs).length; if (n === prev) { reachedStart = true; break; } prev = n;
        await lm.loadEarlierMsgs(chat, chat.msgs);
      }
    } catch { /* usa o que já está carregado */ }
    const oldest = oldestOf();
    return { since, oldest, complete: reachedStart || (since > 0 && oldest > 0 && oldest <= since) };
  }

  const speakInfo = (map, pid) => { const e = map.get(serialize(pid)) || map.get(widUser(pid)); return { msgCount: e ? e.count : 0, lastMessageAt: e ? e.last || null : null, isSpeaker: !!e }; };
  const NON_SPEECH_TYPES = new Set(['gp2', 'notification', 'notification_template', 'e2e_notification', 'protocol', 'call_log', 'broadcast_notification', 'groups_v4_invite', 'ciphertext']);
  /** Conta mensagens por autor no período. Chave: id serializado e, como reserva, só o número (user) do id. */
  function countSpeakers(chat, since) {
    const byKey = new Map();
    for (const m of asArray(chat?.msgs)) {
      if (!m || NON_SPEECH_TYPES.has(m.type)) continue;
      const t = (Number(m.t) || 0) * 1000; if (since && t && t < since) continue;
      const author = m.author || m.senderObj?.id || (m.id?.participant) || null; if (!author) continue;
      for (const k of [serialize(author), widUser(author)]) {
        if (!k) continue; const e = byKey.get(k) || { count: 0, last: 0 }; e.count++; if (t > e.last) e.last = t; byKey.set(k, e);
      }
    }
    return byKey;
  }

  // v1.1.0: quem saiu / foi removido, lido das mensagens de sistema do grupo (as que o WhatsApp Web tem carregadas;
  // tenta carregar um pouco mais de histórico antes). Quem voltou ao grupo não entra.
  async function leftFromHistory(st, chat, currentKeys, meIds, opts = {}) {
    const out = new Map();
    if (!chat) return [];
    if (!opts.historyLoaded) await loadGroupHistory(st, chat, 0);
    const C = st.Collections;
    for (const m of asArray(chat.msgs)) {
      if (m?.type !== 'gp2' || !['remove', 'leave'].includes(m.subtype)) continue;
      let who = Array.isArray(m.recipients) ? m.recipients : [];
      if (!who.length && m.subtype === 'leave') who = [m.author || m.from];
      for (const pid of who) {
        const key = serialize(pid); if (!key || currentKeys.has(key)) continue;
        const t = (Number(m.t) || 0) * 1000; const prevEntry = out.get(key);
        if (!prevEntry || t > prevEntry.leftAt) out.set(key, { pid, leftAt: t, reason: m.subtype === 'leave' ? 'saiu' : 'removido' });
      }
    }
    const res = [];
    for (const [key, e] of out) {
      const contact = C.Contact?.get?.(e.pid) || null;
      const phone = await resolvePhone(st, e.pid, null, contact);
      const identity = privateChatIdentity({}, contact);
      if (isMeId(meIds, e.pid, phone)) continue;
      res.push({ id: key, name: identity.name, nameSource: identity.nameSource, identityMeta: { ...identity.identityMeta, ...(phone ? { phone: { source: 'whatsapp_store_phone', confidence: 0.98, observedAt: new Date().toISOString() } } : {}) }, pushName: contact?.pushname || contact?.verifiedName || '', phone, phoneHidden: !phone, isAdmin: false, isSuperAdmin: false, isMe: false, isActive: false, status: 'left', leftAt: e.leftAt || null, leftReason: e.reason, fromHistory: true, extractedAt: Date.now() });
    }
    return res;
  }

  async function membersFromStore(st, groupId, opts = {}) {
    const C = st.Collections;
    const wid = C.Chat?.get?.(groupId)?.id || C.GroupMetadata?.get?.(groupId)?.id || groupId;
    const chat = C.Chat?.get?.(wid);
    let gm = groupMetaOf(st, chat, wid);
    let parts = asArray(gm?.participants);

    if (!parts.length) {
      // Metadados ainda não carregados: pede ao WhatsApp (Collection.find busca no servidor)
      try { gm = (await C.GroupMetadata?.find?.(wid)) || gm; } catch { /* tenta o próximo */ }
      parts = asArray(gm?.participants);
    }
    if (!parts.length) {
      try { await st.mod('WAWebGroupQueryJob')?.queryAndUpdateGroupMetadataById?.(wid); } catch { /* ignora */ }
      gm = groupMetaOf(st, chat, wid);
      parts = asArray(gm?.participants);
    }
    if (!parts.length) throw new Error('O WhatsApp não retornou os participantes deste grupo. Abra o grupo no WhatsApp Web e tente de novo.');

    const members = []; const meIds = myUserIds(st); const currentKeys = new Set();
    const periodDays = Number.isFinite(Number(opts.periodDays)) ? Number(opts.periodDays) : 90;
    const cov = await loadGroupHistory(st, chat, periodDays);
    const speakers = countSpeakers(chat, cov.since);
    for (const p of parts) {
      const pid = p.id || p; currentKeys.add(serialize(pid));
      const contact = C.Contact?.get?.(pid) || null;
      const phone = await resolvePhone(st, pid, p, contact);
      const identity = privateChatIdentity({}, contact);
      const push = contact?.pushname || contact?.verifiedName || '';
      members.push({
        id: serialize(pid),
        name: identity.name,
        nameSource: identity.nameSource,
        identityMeta: { ...identity.identityMeta, ...(phone ? { phone: { source: 'whatsapp_store_phone', confidence: 0.98, observedAt: new Date().toISOString() } } : {}) },
        pushName: push,
        phone,
        phoneHidden: !phone,
        isAdmin: !!(p.isAdmin || p.isSuperAdmin),
        isSuperAdmin: !!p.isSuperAdmin,
        isMe: isMeId(meIds, pid, phone),
        isActive: true,
        ...speakInfo(speakers, pid),
        periodDays, historySince: cov.oldest || null, historyComplete: cov.complete,
        extractedAt: Date.now(),
      });
    }
    if (opts.includeLeft) {
      try { const lf = await leftFromHistory(st, chat, currentKeys, meIds, { historyLoaded: true }); for (const l of lf) Object.assign(l, speakInfo(speakers, l.id), { periodDays, historySince: cov.oldest || null, historyComplete: cov.complete }); members.push(...lf); } catch (e) { console.warn('[i9Hub] Histórico de saídas indisponível:', e); }
    }
    return members;
  }

  // ----------------------------------------------------------------------------
  // ENVIO PELO STORE INTERNO (método principal): não depende da interface, não troca
  // de conversa e confirma se o número existe no WhatsApp antes de enviar.
  // Se algum módulo interno mudar de nome, cai automaticamente no método por interface.
  // ----------------------------------------------------------------------------
  let storeDisabled = false; // vira true se o Store não existir (evita esperar 8s a cada contato)

  async function sendViaStore(phone, text) {
    if (storeDisabled) throw Object.assign(new Error('Store desativado'), { fallback: true });
    const st = await getStore(8000);
    const sendMod = st && st.mod('WAWebSendTextMsgChatAction');
    if (!st || !sendMod || typeof sendMod.sendTextMsgToChat !== 'function') {
      storeDisabled = true;
      throw Object.assign(new Error('Módulos internos do WhatsApp indisponíveis'), { fallback: true });
    }
    const C = st.Collections;
    let wid = st.mod('WAWebWidFactory')?.createWid?.(`${phone}@c.us`) || `${phone}@c.us`;

    // 1) o número tem WhatsApp?
    let existsConfirmed = false;
    const q = st.mod('WAWebQueryExistsJob');
    if (q && typeof q.queryExists === 'function') {
      let r;
      try { r = await q.queryExists(wid); }
      catch (e) { throw Object.assign(new Error('Falha ao consultar o número: ' + (e?.message || e)), { fallback: true }); }
      // Resposta vazia pode ser "não existe" OU mudança interna: a interface confirma antes de descartar.
      if (!r) throw Object.assign(new Error('Consulta sem resposta'), { fallback: true });
      if (r.wid) wid = r.wid;
      existsConfirmed = true;
      diag('STORE_NUMBER_EXISTS', 'info', { phone, resolvedWid: serialize(wid) });
    }

    // 2) conversa (v7.1.2: várias estratégias; o WhatsApp mudou o Chat.find -> "this.findImpl is not a function")
    const attempts = [];
    const tryStrategy = async (name, fn) => {
      try {
        const out = await fn();
        const c = out && (out.chat || out);
        if (c && typeof c === 'object') { diag('STORE_CHAT_RESOLVED', 'info', { phone, strategy: name }); return c; }
        attempts.push(name + ': sem resultado');
      } catch (e) { attempts.push(name + ': ' + (e?.message || e)); }
      return null;
    };
    let chat = await tryStrategy('Chat.get', async () => C.Chat?.get?.(wid));
    if (!chat) {
      for (const modName of ['WAWebFindChatAction', 'WAWebChatFindAction']) {
        const m = st.mod(modName);
        const fn = m && (m.findOrCreateLatestChat || m.findChat);
        if (typeof fn === 'function') { chat = await tryStrategy(modName, () => fn.call(m, wid)); if (chat) break; }
      }
    }
    if (!chat) chat = await tryStrategy('Chat.find', async () => C.Chat?.find?.(wid));
    if (!chat) chat = await tryStrategy('Chat.gadd', async () => C.Chat?.gadd?.(wid));
    if (!chat) {
      diag('STORE_CHAT_FAILED', 'error', { phone, attempts, chatKeys: Object.keys(C.Chat || {}).slice(0, 25), protoKeys: Object.getOwnPropertyNames(Object.getPrototypeOf(C.Chat || {}) || {}).slice(0, 40) });
      throw Object.assign(new Error('Não foi possível abrir a conversa: ' + (attempts.join(' | ') || 'indisponível')), { fallback: true, existsConfirmed });
    }

    // 3) envio (a partir daqui NÃO há fallback: evita mensagem duplicada)
    let res;
    try { res = await sendMod.sendTextMsgToChat(chat, text, {}); }
    catch (e) { throw Object.assign(new Error('Falha ao enviar: ' + (e?.message || e)), { fallback: e instanceof TypeError }); }
    try {
      let out = res?.messageSendResult ?? (Array.isArray(res) ? res[1] : res);
      out = await Promise.resolve(out);
      if (out && typeof out === 'object' && 'messageSendResult' in out) out = await Promise.resolve(out.messageSendResult);
      if (typeof out === 'string' && out !== 'OK') throw new Error(out);
    } catch (e) {
      throw new SendError('O WhatsApp recusou o envio: ' + (e?.message || e), 'SEND_FAILED');
    }
    return true;
  }

  // v7.0.5: devolve { via, storeReason } — o motivo de o envio rápido não ter sido usado vai para o registro do contato.
  async function deliver(phone, message, backgroundOnly = false) {
    let storeReason = '';
    let existsConfirmed = false;
    try { await sendViaStore(phone, message); diag('SENT_VIA_STORE', 'success', { phone }); return { via: 'store', storeReason: '' }; }
    catch (e) {
      if (!e.fallback) throw e;
      storeReason = String(e.message || 'motivo desconhecido');
      existsConfirmed = !!e.existsConfirmed;
      diag('STORE_FALLBACK_TO_DOM', 'warn', { phone, reason: storeReason, internals: storeInternals() });
    }
    // v1.0.0-pro: em segundo plano (janela oculta/coberta) só o envio pelo Store é permitido; o método por
    // interface precisa da tela visível. Nesse caso o contato NÃO falha: a campanha espera a janela voltar.
    if (backgroundOnly && document.hidden) {
      throw new SendError('Envio em segundo plano indisponível para este contato (' + storeReason + '); aguardando o WhatsApp ficar visível.', 'NEEDS_VISIBLE');
    }
    try { await openChatByPhoneDOM(phone); }
    catch (e) {
      // v7.0.4: "A conversa não abriu" é técnico e costuma ser momentâneo: uma nova tentativa completa antes de falhar.
      if (e.code === 'TECH' && /conversa não abriu/i.test(e.message)) { diag('OPEN_CHAT_RETRY', 'warn', { phone }); await wait(1500); await openChatByPhoneDOM(phone); }
      else if (e.code === 'NOT_ON_WHATSAPP' && existsConfirmed) {
        // v7.1.2: o WhatsApp CONFIRMOU que o número existe; só a busca da interface não o lista (não é contato salvo).
        diag('FALSE_NOT_ON_WHATSAPP', 'warn', { phone, storeReason });
        throw new SendError('O número existe no WhatsApp, mas não foi possível abrir a conversa (falha interna: ' + storeReason + ').', 'TECH');
      }
      else throw e;
    }
    await wait(500);
    await sendMessageDOM(message);
    diag('SENT_VIA_DOM', 'success', { phone, storeReason });
    return { via: 'dom', storeReason };
  }

  async function extractAllChats() {
    let storeErr = '';
    const st = await getStore(15000);
    if (st) {
      try {
        const groups = listGroupsFromStore(st);
        if (groups.length) {
          // grupos primeiro (os de comunidade logo depois), em ordem alfabética
          return groups.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        }
      } catch (e) { storeErr = e.message; }
    }
    console.warn('[i9Hub] Store indisponível para listar grupos; usando leitura do DOM.', storeErr);
    return extractAllChatsDOM();
  }

  async function extractGroupMembers(groupName = '', groupId = '', opts = {}) {
    let storeErr = '';
    if (/@g\.us$/.test(groupId || '')) {
      const st = await getStore(15000);
      if (st) {
        try { return await membersFromStore(st, groupId, opts); }
        catch (e) { storeErr = e.message; console.warn('[i9Hub] Falha no Store:', e); }
      }
    }
    try {
      const members = await extractGroupMembersDOM(groupName);
      if (members.length) return members;
    } catch (e) { storeErr = storeErr || e.message; }
    throw new Error(storeErr || 'Não foi possível ler os participantes. Atualize a página do WhatsApp Web (F5) e tente novamente.');
  }

  // Diagnóstico: no console da aba do WhatsApp Web, rode  await __i9rcsDebug()
  window.__i9rcsDebug = async function () {
    const st = await getStore(8000);
    const info = { status: storeStatus(), hasRequire: typeof window.require, hasWebpack: !!window.webpackChunkwhatsapp_web_client, internals: storeInternals() };
    if (st) {
      const groups = listGroupsFromStore(st);
      info.groups = groups.length;
      info.communities = groups.filter(g => g.isCommunity).length;
      const g = groups.find(x => !x.isCommunity) || groups[0];
      if (g) {
        const gm = st.Collections.GroupMetadata.get(g.id);
        const p = asArray(gm?.participants)[0];
        info.sample = { group: g.name, participantKeys: p ? Object.keys(p.attributes || p).slice(0, 30) : null, participantServer: p ? widServer(p.id) : null };
        try { info.sampleMembers = (await membersFromStore(st, g.id)).slice(0, 3); } catch (e) { info.sampleError = e.message; }
      }
    }
    console.log('[i9Hub debug]', info);
    return info;
  };

  // ============================================================================
  // v1.5.0 - ETIQUETAS DO WHATSAPP Business -> tags para segmentação do CRM/campanhas
  // ----------------------------------------------------------------------------
  // Os nomes dos módulos internos do WhatsApp Web mudam com as atualizações. Por isso a
  // leitura tenta vários caminhos e o diagnóstico mostra qual deles funcionou no SEU WhatsApp.
  // O relatório NÃO contém telefones nem nomes de contatos; só nomes de etiquetas e contagens.
  // No console da aba do WhatsApp:  await __i9rcsLabelsDebug()
  // ============================================================================

  const LABEL_MODULE_CANDIDATES = [
    'WAWebCollections', 'WAWebLabelCollection', 'WAWebLabelItemCollection', 'WAWebLabelModel', 'WAWebLabelItemModel',
    'WAWebLabelAddAction', 'WAWebLabelsAction', 'WAWebLabelUtils', 'WAWebBizLabelUtils', 'WAWebSchemaLabel',
    'WAWebWidFactory', 'WAWebUserPrefsMeUser',
  ];
  const LABEL_FALLBACK_COLORS = ['#25d366', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#e11d48'];
  let __labelCollCache = null;

  function webpackCache() {
    try {
      const chunk = window.webpackChunkwhatsapp_web_client;
      if (!chunk || typeof chunk.push !== 'function') return null;
      let wreq; chunk.push([[`i9rcs_lbl_${Date.now()}`], {}, (r) => { wreq = r; }]);
      return (wreq && wreq.c) || null;
    } catch { return null; }
  }

  const attrsOf = (m) => (m && (m.attributes || m)) || {};
  function looksLikeLabel(m) {
    const a = attrsOf(m);
    const id = a.id ?? m?.id;
    const name = typeof a.name === 'string' ? a.name.trim() : '';
    const hasLabelMarker = ['hexColor', 'colorIndex', 'color', 'deleted', 'isDeleted', 'labelItemCollection'].some((key) => key in a);
    return !!name && id != null && id !== '' && hasLabelMarker && !('formattedTitle' in a) && !('body' in a);
  }
  function collectionLooksLikeLabels(c) {
    const arr = asArray(c);
    return arr.length > 0 && arr.slice(0, 10).some(looksLikeLabel);
  }

  /** Acha a coleção de etiquetas: coleções expostas, módulos nomeados ou cache webpack já carregado. */
  function findLabelCollection(st) {
    if (__labelCollCache && (__labelCollCache.coll === st.Collections.Label || __labelCollCache.coll === st.Collections.Labels || __labelCollCache.via.startsWith('varredura'))) return __labelCollCache;
    const direct = st.Collections.Label || st.Collections.Labels || st.Collections.LabelCollection;
    if (direct) return (__labelCollCache = { coll: direct, via: st.Collections.Label ? 'Collections.Label' : st.Collections.Labels ? 'Collections.Labels' : 'Collections.LabelCollection' });
    for (const [mod, keys] of [['WAWebLabelCollection', ['LabelCollection', 'Label', 'default']], ['WAWebLabelModel', ['LabelCollection', 'Label', 'default']]]) {
      const m = tryRequire(mod); if (!m) continue;
      for (const k of keys) { const c = m[k]; if (c && asArray(c).length >= 0 && (typeof c.getModelsArray === 'function' || Array.isArray(c.models))) return (__labelCollCache = { coll: c, via: `require(${mod}).${k}` }); }
    }
    const cache = webpackCache();
    if (cache) {
      try {
        for (const id of Object.keys(cache)) {
          const ex = cache[id] && cache[id].exports; if (!ex || typeof ex !== 'object') continue;
          for (const k of Object.keys(ex).slice(0, 40)) {
            let v; try { v = ex[k]; } catch { continue; }
            if (v && typeof v === 'object' && (typeof v.getModelsArray === 'function' || Array.isArray(v.models)) && collectionLooksLikeLabels(v)) return (__labelCollCache = { coll: v, via: `varredura webpack (módulo ${id}, chave ${k})` });
          }
        }
      } catch { /* ignora */ }
    }
    return null;
  }

  function findLabelItemCollection(st) {
    const direct = st.Collections.LabelItem || st.Collections.LabelItems || st.Collections.LabelItemCollection;
    if (direct) return direct;
    const mod = tryRequire('WAWebLabelItemCollection');
    if (mod) for (const key of ['LabelItemCollection', 'LabelItem', 'LabelItems', 'default']) {
      const candidate = mod[key];
      if (candidate && (typeof candidate.getModelsArray === 'function' || Array.isArray(candidate.models) || Array.isArray(candidate._models))) return candidate;
    }
    return null;
  }

  function labelColor(a, i) {
    const hx = a.hexColor || a.color;
    if (typeof hx === 'string' && /^#?[0-9a-f]{6}$/i.test(hx)) return hx.startsWith('#') ? hx : '#' + hx;
    return LABEL_FALLBACK_COLORS[(Number.isFinite(Number(a.colorIndex)) ? Number(a.colorIndex) : i) % LABEL_FALLBACK_COLORS.length];
  }
  function labelFromModel(m, i) {
    const a = attrsOf(m);
    const rawId = a.id ?? m?.id ?? '';
    const id = rawId && typeof rawId === 'object' ? String(rawId._serialized ?? rawId.id ?? '') : String(rawId);
    return { id, name: String(a.name ?? '').trim(), color: labelColor(a, i), deleted: !!(a.deleted || a.isDeleted) };
  }

  /** IDs de etiqueta presentes num chat (chat.labels = lista de ids). */
  function chatLabelIds(chat) {
    const a = attrsOf(chat);
    const v = chat.labels ?? a.labels ?? a.labelIds;
    if (!v) return [];
    let arr = [];
    try { arr = Array.isArray(v) ? v : (typeof v.toArray === 'function' ? v.toArray() : asArray(v)); } catch { arr = []; }
    return arr.map((x) => (x && typeof x === 'object' ? String(attrsOf(x).id ?? attrsOf(x).labelId ?? '') : String(x))).filter(Boolean);
  }
  /** Item de etiqueta (LabelItem): qual etiqueta e qual chat. */
  function labelItemPair(m, fallbackLabelId) {
    const a = attrsOf(m);
    const rawLabelId = a.labelId ?? a.label?.id ?? a.labelID ?? fallbackLabelId ?? '';
    const labelId = rawLabelId && typeof rawLabelId === 'object' ? String(rawLabelId._serialized ?? rawLabelId.id ?? '') : String(rawLabelId);
    const parent = a.parentId ?? a.parent ?? a.itemId ?? a.chatId ?? '';
    const parentId = typeof parent === 'object' ? (serialize(parent) || serialize(parent.id) || String(parent._serialized || '')) : String(parent || '');
    return labelId && /@/.test(parentId) ? { labelId, parentId } : null;
  }

  const skipChatServer = (srv) => /^(g\.us|broadcast|newsletter|status)$/.test(srv);

  /** Etiquetas + quais conversas individuais têm cada uma. Sem telefones de grupos. */
  async function readLabels(st) {
    const found = findLabelCollection(st);
    const out = { via: found ? found.via : null, labels: [], contacts: [], unlabeledPhones: [], stats: { chats: 0, labeledChats: 0, groupsSkipped: 0, noPhone: 0, sources: { chatLabels: 0, labelItems: 0, labelNested: 0 } } };
    if (!found) return out;
    const models = asArray(found.coll);
    out.labels = models.map(labelFromModel).filter((l) => l.id && l.name);
    const known = new Set(out.labels.filter((l) => !l.deleted).map((l) => l.id));
    const byChat = new Map(); // chatId -> { wid, ids:Set }
    const add = (wid, labelId, src) => {
      if (!known.has(String(labelId))) return;
      const id = serialize(wid); if (!id) return;
      if (!byChat.has(id)) byChat.set(id, { wid, ids: new Set() });
      const e = byChat.get(id); if (!e.ids.has(String(labelId))) { e.ids.add(String(labelId)); out.stats.sources[src]++; }
    };
    const chats = asArray(st.Collections.Chat); out.stats.chats = chats.length;
    for (const ch of chats) for (const lid of chatLabelIds(ch)) add(ch.id, lid, 'chatLabels');
    const items = findLabelItemCollection(st);
    if (items) for (const m of asArray(items)) { const p = labelItemPair(m); if (p) add(p.parentId, p.labelId, 'labelItems'); }
    for (const lm of models) {
      const nested = lm.labelItemCollection || attrsOf(lm).labelItemCollection; if (!nested) continue;
      const lid = String(attrsOf(lm).id ?? lm.id ?? '');
      for (const m of asArray(nested)) { const p = labelItemPair(m, lid); if (p) add(p.parentId, p.labelId, 'labelNested'); }
    }
    const contactOf = (wid) => { try { return st.Collections.Contact?.get?.(wid) || null; } catch { return null; } };
    for (const [id, e] of byChat) {
      const srv = widServer(e.wid) || id.split('@')[1] || '';
      if (skipChatServer(srv)) { out.stats.groupsSkipped++; continue; }
      const contact = contactOf(e.wid);
      let phone = ''; try { phone = await resolvePhone(st, e.wid, null, contact); } catch { /* ignora */ }
      const chat = chats.find((c) => serialize(c.id) === id);
      const name = String(chat?.formattedTitle || chat?.name || contact?.name || contact?.pushname || '').trim();
      out.stats.labeledChats++;
      if (!phone) { out.stats.noPhone++; continue; }
      out.contacts.push({ phone, name: /^[\d\s+()-]+$/.test(name) ? '' : name, labelIds: [...e.ids] });
    }
    // Conversas individuais SEM etiqueta (para o CRM tirar o estágio de quem perdeu a etiqueta)
    for (const ch of chats) {
      if (out.unlabeledPhones.length >= 5000) break;
      const id = serialize(ch.id); const srv = widServer(ch.id);
      if (!id || skipChatServer(srv) || byChat.has(id)) continue;
      let phone = ''; try { phone = await resolvePhone(st, ch.id, null, contactOf(ch.id)); } catch { /* ignora */ }
      if (phone) out.unlabeledPhones.push(phone);
    }
    return out;
  }

  function requireRegistryNames() {
    try {
      const dbg = tryRequire('__debug');
      const map = dbg?.modulesMap || window.require?.__debug?.modulesMap;
      if (map && typeof map === 'object') return Object.keys(map).filter((n) => /label/i.test(n)).slice(0, 60);
    } catch { /* ignora */ }
    return null;
  }

  async function labelsDiagnostic() {
    const rep = { version: EXT_VER, at: new Date().toISOString(), verdict: 'nao_encontrado', notes: [] };
    rep.internals = storeInternals();
    const st = await getStore(8000);
    if (!st) { rep.verdict = 'store_indisponivel'; rep.notes.push('O Store do WhatsApp não carregou. Espere a lista de conversas aparecer, recarregue (F5) e rode de novo.'); return rep; }
    rep.store = { via: st.via, chats: asArray(st.Collections.Chat).length };
    rep.modules = {}; for (const n of LABEL_MODULE_CANDIDATES) rep.modules[n] = !!tryRequire(n);
    rep.collectionKeys = Object.keys(st.Collections || {}).filter((k) => /label|tag|biz|smb|conn|catalog/i.test(k)).slice(0, 40);
    rep.registryLabelModules = requireRegistryNames();
    try {
      const conn = st.Collections.Conn; const c = {};
      for (const k of ['platform', 'isSMB', 'isBusiness', 'smb']) { const v = conn?.[k] ?? conn?.attributes?.[k]; if (['boolean', 'string'].includes(typeof v)) c[k] = v; }
      rep.conn = c;
    } catch { /* ignora */ }
    const found = findLabelCollection(st);
    rep.labelCollection = found ? { via: found.via, models: asArray(found.coll).length } : null;
    const items = findLabelItemCollection(st);
    rep.labelItemCollection = items ? { models: asArray(items).length, sampleKeys: Object.keys(attrsOf(asArray(items)[0])).slice(0, 20) } : null;
    try { const w = labelWriterFns(st); rep.labelFunctions = { createCandidates: w.create.map((x) => x.name), assignCandidates: w.assign.map((x) => x.name), withLabelInName: w.all.slice(0, 40) }; } catch { /* ignora */ }
    const chats = asArray(st.Collections.Chat);
    const chatKeys = new Set(); for (const ch of chats.slice(0, 50)) for (const k of Object.keys(attrsOf(ch))) if (/label/i.test(k)) chatKeys.add(k);
    rep.chatLabelAttributes = [...chatKeys];
    rep.chatsWithLabelIds = chats.filter((ch) => chatLabelIds(ch).length).length;
    if (!found) { rep.notes.push('Nenhuma coleção de etiquetas foi localizada. Em conta WhatsApp normal isso é esperado (etiquetas só existem no WhatsApp Business). Se sua conta é Business, envie este relatório.'); return rep; }
    const data = await readLabels(st);
    const perLabel = {}; for (const l of data.labels) perLabel[l.id] = 0;
    for (const c of data.contacts) for (const id of c.labelIds) if (id in perLabel) perLabel[id]++;
    rep.labels = data.labels.map((l) => ({ name: l.name, color: l.color, deleted: l.deleted, chats: perLabel[l.id] || 0 }));
    const sample = asArray(found.coll)[0]; rep.labelModelKeys = sample ? Object.keys(attrsOf(sample)).slice(0, 20) : [];
    rep.sync = { labeledChats: data.stats.labeledChats, withPhone: data.contacts.length, noPhone: data.stats.noPhone, groupsSkipped: data.stats.groupsSkipped, unlabeledChats: data.unlabeledPhones.length, sources: data.stats.sources };
    if (!data.labels.length) { rep.verdict = 'sem_etiquetas'; rep.notes.push('A coleção de etiquetas existe, mas está vazia: crie etiquetas no WhatsApp Business (ou a conta é normal).'); }
    else if (!data.stats.labeledChats) { rep.verdict = 'etiquetas_sem_conversas'; rep.notes.push('As etiquetas foram lidas, mas nenhuma conversa aparece ligada a elas. Ou ninguém foi etiquetado, ou o vínculo está em um campo que ainda não conheço: envie este relatório.'); }
    else rep.verdict = 'ok';
    return rep;
  }

  // Diagnóstico: no console da aba do WhatsApp Web, rode  await __i9rcsLabelsDebug()
  window.__i9rcsLabelsDebug = async function () { const r = await labelsDiagnostic(); console.log('[i9Hub etiquetas]', r); return r; };

  // ============================================================================
  // v1.5.0 - BLACK LIST: botão nas mensagens RECEBIDAS do WhatsApp Web
  // ----------------------------------------------------------------------------
  // Passa o mouse numa mensagem recebida e clique em "Black list": o contato vai para o banco de
  // black list, para o estágio "Black list" do CRM, sai de todas as campanhas e (em conta Business)
  // recebe a etiqueta "Black list". A etiqueta depende dos módulos internos do WhatsApp, por isso é
  // "melhor esforço": o resultado é conferido (lê de volta) e o aviso diz se foi aplicada.
  // ============================================================================

  const BL_LABEL_NAME = 'Black list';
  const normLabelName = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const isBlacklistLabelName = (n) => normLabelName(n) === 'blacklist';
  let blockedTails = new Set();            // últimos 10 dígitos dos números da black list (atualizado pelo painel)
  const blPending = new Map(); let blReq = 0;

  // ============================================================================
  // v1.6.0 - CONSENT TRACKING: parser de palavras-chave QUERO/SAIR em mensagens recebidas
  // --------------------------------------------------------------------------
  // Detecta opt-in/opt-out em mensagens RECEBIDAS (não do próprio usuário) e envia
  // CONSENT_UPDATE ao service worker para persistência. Evita falsos positivos com
  // negação ("não quero") e contexto ("quero saber o preço").
  // ============================================================================
  const CONSENT_KEYWORDS = {
    opted_in: [/\b(?:quero|sim|autorizo|aceito|permito|ok|confirmo)\s*$/i, /^\s*(?:quero|sim|autorizo|aceito|permito|ok|confirmo)\s*$/i],
    opted_out: [/\b(?:sair|cancelar|descadastrar|remover|parar|stop|unsubscribe)\s*$/i, /^\s*(?:sair|cancelar|descadastrar|remover|parar|stop|unsubscribe)\s*$/i],
  };
  const CONSENT_NEGATION = /\b(?:n[aã]o|nunca|jamais|sem)\s+(?:quero|desejo|aceito|autorizo|permito)/i;
  const CONSENT_CONTEXT_FALSE_POSITIVE = /\b(?:quero|desejo)\s+(?:saber|ver|conhecer|entender|perguntar|falar|comprar|receber\s+(?:mais|informa))/i;
  const processedConsentMsgIds = new Set();

  function detectConsentKeyword(text) {
    if (!text || typeof text !== 'string') return null;
    const cleaned = text.trim().replace(/\s+/g, ' ');
    if (!cleaned || cleaned.length > 200) return null;
    // Negação explícita anula qualquer opt-in
    if (CONSENT_NEGATION.test(cleaned)) return null;
    // Falso positivo: "quero saber", "quero ver" não é consentimento
    if (CONSENT_CONTEXT_FALSE_POSITIVE.test(cleaned)) return null;
    for (const status of ['opted_out', 'opted_in']) {
      for (const pattern of CONSENT_KEYWORDS[status]) {
        if (pattern.test(cleaned)) return status;
      }
    }
    return null;
  }

  function sendConsentUpdate(phone, status, source, message) {
    const tail = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!tail || tail.length < 7) return;
    sendToContentScript('CONSENT_UPDATE', { phone, status, source, message: String(message || '').slice(0, 200) });
    diag('CONSENT_DETECTED', 'info', { phoneTail: tail, status, source });
  }

  function callBlacklistBackend(payload) {
    return new Promise((resolve) => {
      const id = `bl_${++blReq}`;
      const t = setTimeout(() => { blPending.delete(id); resolve({ success: false, error: 'A extensão não respondeu. Recarregue o painel e tente de novo.' }); }, 15000);
      blPending.set(id, (r) => { clearTimeout(t); resolve(r); });
      sendToContentScript('BLACKLIST_ADD_REQUEST', { ...payload, requestId: id });
    });
  }

  function blToast(text, kind = 'info') {
    try {
      const el = document.createElement('div');
      el.textContent = text;
      el.style.cssText = `position:fixed;left:16px;bottom:20px;z-index:2147483647;max-width:360px;padding:10px 14px;border-radius:8px;font:13px/1.35 system-ui,sans-serif;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.35);background:${kind === 'error' ? '#b91c1c' : kind === 'success' ? '#15803d' : '#374151'}`;
      document.body.appendChild(el); setTimeout(() => el.remove(), 7000);
    } catch { /* ignora */ }
  }

  const toWid = (st, str) => { try { return st.mod?.('WAWebWidFactory')?.createWid?.(str) || str; } catch { return str; } };
  function chatByWid(st, wid) {
    const key = serialize(wid); if (!key) return null;
    try { const c = st.Collections.Chat.get?.(wid) || st.Collections.Chat.get?.(key); if (c) return c; } catch { /* ignora */ }
    return asArray(st.Collections.Chat).find((c) => serialize(c.id) === key) || null;
  }

  /** Funções do WhatsApp que parecem criar/aplicar etiquetas (só nomes; usado no diagnóstico e na aplicação). */
  function labelWriterFns(st) {
    const found = findLabelCollection(st);
    const srcs = [];
    if (found) srcs.push(['Label', found.coll]);
    for (const n of ['WAWebLabelCollection', 'WAWebLabelAddAction', 'WAWebLabelsAction', 'WAWebLabelUtils', 'WAWebBizLabelUtils', 'WAWebLabelItemCollection']) { const m = tryRequire(n); if (m) srcs.push([n, m]); }
    const out = { create: [], assign: [], all: [] };
    for (const [src, o] of srcs) {
      let keys = []; try { keys = Object.keys(o).concat(Object.getOwnPropertyNames(Object.getPrototypeOf(o) || {})); } catch { /* ignora */ }
      for (const k of keys) {
        let fn; try { fn = o[k]; } catch { continue; }
        if (typeof fn !== 'function') continue;
        if (/label/i.test(k) || /^(addOrRemoveLabels|addNewLabel)$/i.test(k)) out.all.push(`${src}.${k}`);
        if (/^(addNewLabel|createLabel|addLabel|saveLabel|labelAdd)$/i.test(k)) out.create.push({ name: `${src}.${k}`, fn: fn.bind(o) });
        if (/^(addOrRemoveLabels|addLabelsToChats|applyLabels|labelChats|updateLabelItems)$/i.test(k)) out.assign.push({ name: `${src}.${k}`, fn: fn.bind(o) });
      }
    }
    return out;
  }

  const waitUntil = async (cond, ms = 1500) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (cond()) return true; } catch { /* ignora */ } await wait(150); } return false; };
  const findBlacklistLabel = (st) => { const f = findLabelCollection(st); return f ? asArray(f.coll).map(labelFromModel).find((l) => l.id && !l.deleted && isBlacklistLabelName(l.name)) || null : null; };

  async function ensureBlacklistLabel(st) {
    let label = findBlacklistLabel(st); if (label) return { label, created: false };
    const w = labelWriterFns(st);
    for (const { name, fn } of w.create) {
      for (const args of [[BL_LABEL_NAME, 0], [{ name: BL_LABEL_NAME, colorIndex: 0 }], [BL_LABEL_NAME]]) {
        try { await fn(...args); } catch { continue; }
        if (await waitUntil(() => findBlacklistLabel(st))) { diag('BLACKLIST_LABEL_CREATED', 'info', { via: name }); return { label: findBlacklistLabel(st), created: true }; }
      }
    }
    return { label: null, created: false, writers: w.create.map((x) => x.name) };
  }

  /** Aplica a etiqueta "Black list" na conversa do contato (primeira que existir entre os ids candidatos). */
  async function applyBlacklistLabelTo(st, candidates) {
    const res = { applied: false, created: false, note: '' };
    if (!findLabelCollection(st)) { res.note = 'sem área de etiquetas (conta normal?)'; return res; }
    const chat = candidates.map((c) => chatByWid(st, toWid(st, c))).find(Boolean);
    if (!chat) { res.note = 'sem conversa individual com o contato'; return res; }
    const ens = await ensureBlacklistLabel(st); res.created = !!ens.created;
    if (!ens.label) { res.note = 'não consegui criar a etiqueta'; return res; }
    if (chatLabelIds(chat).includes(ens.label.id)) { res.applied = true; return res; }
    const w = labelWriterFns(st); const lid = ens.label.id;
    const attempts = [(f) => f([{ labelId: lid, type: 'add' }], [chat]), (f) => f([chat], [{ labelId: lid, type: 'add' }]), (f) => f(chat, [lid]), (f) => f([lid], [chat])];
    for (const { name, fn } of w.assign) {
      for (const at of attempts) {
        try { await at(fn); } catch { continue; }
        if (await waitUntil(() => chatLabelIds(chat).includes(lid))) { res.applied = true; diag('BLACKLIST_LABEL_APPLIED', 'info', { via: name }); return res; }
      }
    }
    res.note = w.assign.length ? 'o WhatsApp não aceitou a etiqueta' : 'função de aplicar etiqueta não encontrada';
    return res;
  }

  const parseMsgId = (did) => {
    const p = String(did || '').split('_');
    if (p.length < 3 || p[0] !== 'false') return null;          // false_<chat>_<idMsg>[_<participante>] = recebida
    const chat = p[1]; return { chat, participant: /@g\.us$/.test(chat) ? (p[3] || '') : '' };
  };

  async function blacklistFromMessage(row) {
    const info = parseMsgId(row.getAttribute('data-id'));
    if (!info || /^(status|.*@broadcast|.*@newsletter)$/.test(info.chat) || /@(broadcast|newsletter)$/.test(info.chat) || /^status@/.test(info.chat)) { blToast('Não consigo usar esta mensagem (status, canal ou sistema).', 'error'); return; }
    if (info.chat.endsWith('@g.us') && !info.participant) { blToast('Não consegui identificar quem enviou esta mensagem do grupo.', 'error'); return; }
    const st = await getStore(5000); if (!st) { blToast('O WhatsApp ainda está carregando. Tente de novo em instantes.', 'error'); return; }
    const targetStr = info.participant || info.chat; const wid = toWid(st, targetStr);
    let contact = null; try { contact = st.Collections.Contact?.get?.(wid) || null; } catch { /* ignora */ }
    const phone = await resolvePhone(st, wid, null, contact);
    if (!phone || phone.length < 10) { blToast('O WhatsApp esconde o número deste contato, então não dá para colocá-lo na Black list.', 'error'); return; }
    if (isOwnNumber(phone.slice(-8))) { blToast('Este é o seu próprio número.', 'error'); return; }
    const chat0 = chatByWid(st, wid);
    const name = String(contact?.name || contact?.pushname || chat0?.formattedTitle || chat0?.name || '').trim();
    const shown = /^[\d\s+()-]+$/.test(name) ? '' : name;
    if (!window.confirm(`Colocar ${shown || phone} (+${phone}) na Black list?\n\n• sai de todas as campanhas\n• vai para o estágio "Black list" no CRM\n• recebe a etiqueta "Black list" (WhatsApp Business)`)) return;
    let label = { applied: false, note: '' };
    try { label = await applyBlacklistLabelTo(st, [...new Set([info.participant ? '' : info.chat, `${phone}@c.us`].filter(Boolean))]); } catch (e) { label = { applied: false, note: 'erro ao aplicar a etiqueta' }; }
    const r = await callBlacklistBackend({ phone, name: shown, source: 'whatsapp_msg', labelApplied: label.applied, labelNote: label.applied ? '' : label.note });
    if (!r.success) { blToast(r.error || 'Não foi possível salvar na Black list.', 'error'); return; }
    blockedTails.add(phone.slice(-10));
    blToast(`${shown || phone} na Black list.` + (label.applied ? ' Etiqueta aplicada.' : ` Etiqueta não aplicada (${label.note || 'indisponível'}).`), label.applied ? 'success' : 'info');
    markBlacklisted(row);
  }

  function markBlacklisted(row) { const b = row.querySelector('.i9bl-btn'); if (b) { b.textContent = 'Na Black list'; b.disabled = true; b.style.opacity = '.7'; } }

  function installBlacklistUi() {
    if (document.getElementById('i9bl-style')) return;
    const css = document.createElement('style'); css.id = 'i9bl-style';
    css.textContent = `.i9bl-btn{position:absolute;right:10px;top:50%;transform:translateY(-50%);z-index:20;display:none;padding:3px 8px;border:0;border-radius:6px;background:#111827;color:#fff;font:600 11px system-ui,sans-serif;cursor:pointer;opacity:.9}[data-i9bl]:hover>.i9bl-btn{display:inline-block}.i9bl-btn:hover{background:#b91c1c;opacity:1}`;
    document.head.appendChild(css);
    const scan = () => {
      const rows = document.querySelectorAll('#main [data-id^="false_"]:not([data-i9bl])');
      if (!rows.length) return;
      const anyIn = !!document.querySelector('#main .message-in');
      rows.forEach((el) => {
        if (el.querySelector('[data-id]')) return;                                         // só o elemento mais interno
        if (anyIn && !(el.classList.contains('message-in') || el.querySelector('.message-in') || el.closest('.message-in'))) return;
        el.setAttribute('data-i9bl', '1');
        try { if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; } catch { /* ignora */ }
        const b = document.createElement('button'); b.type = 'button'; b.className = 'i9bl-btn'; b.textContent = 'Black list'; b.title = 'Colocar o remetente desta mensagem na Black list';
        b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); blacklistFromMessage(el).catch((err) => blToast('Erro: ' + err.message, 'error')); });
        el.appendChild(b);
      });
    };
    setInterval(scan, 1500); scan();
  }

  // ============================================================================
  // CAMPANHA - LÓGICA PRINCIPAL
  // ============================================================================

  let runId = 0;

  function inScheduleWindow(sch) {
    const [h1, m1] = String(sch.start || '00:00').split(':').map(Number);
    const [h2, m2] = String(sch.end || '23:59').split(':').map(Number);
    const now = new Date(); const cur = now.getHours() * 60 + now.getMinutes();
    const a = h1 * 60 + (m1 || 0), b = h2 * 60 + (m2 || 0);
    return a <= b ? (cur >= a && cur < b) : (cur >= a || cur < b);
  }

  async function processCampaign(campaign) {
    if (isProcessing) { diag('CAMPAIGN_ALREADY_RUNNING', 'warn', { id: campaign.id }); return { sent: 0, failed: 0, status: 'running' }; }
    const myRun = ++runId;
    const cancelled = () => !isProcessing || myRun !== runId;
    // Espera em fatias de 500 ms para que "Pausar" funcione na hora, mesmo durante o intervalo.
    const sleep = async (ms) => { const end = Date.now() + ms; while (Date.now() < end && !cancelled()) await wait(Math.min(500, end - Date.now())); };
    const waitForAiIdle = async () => {
      while (!cancelled() && aiPendingInbound > 0) {
        // Recupera de um evento de status perdido se a ponte do content script for reiniciada.
        if (aiProcessingStateAt && Date.now() - aiProcessingStateAt > 180000) {
          diag('AI_BUSY_STATE_STALE', 'warn', { pending: aiPendingInbound, hint: 'status de processamento expirado; liberando a campanha' });
          aiPendingInbound = 0;
          break;
        }
        await sleep(250);
      }
      return !cancelled();
    };

    if (Array.isArray(campaign.blacklist)) blockedTails = new Set(campaign.blacklist);
    currentCampaign = campaign;
    isProcessing = true;
    storeDisabled = false;
    sendToContentScript('CAMPAIGN_STARTED', { campaignId: campaign.id });
    diag('CAMPAIGN_START', 'info', { id: campaign.id, contacts: (campaign.contacts || []).length });

    const { template, contacts = [], delayRange, schedule, batch } = campaign;
    const dMin = Math.max(1000, Number(delayRange?.min) || 8000);
    const dMax = Math.max(dMin, Number(delayRange?.max) || dMin + 12000);
    let sent = 0, failed = 0, consecutiveTech = 0, sinceBatch = 0, announcedWait = false, announcedHidden = false;

    const paused = (reason) => {
      isProcessing = false;
      sendToContentScript('CAMPAIGN_PAUSED', { campaignId: campaign.id, sent, failed, reason });
      return { sent, failed, status: 'paused' };
    };

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      if (cancelled()) { if (myRun === runId) return paused(); return { sent, failed, status: 'paused' }; }
      // A IA tem prioridade: ao detectar uma entrada, a campanha não inicia o próximo envio
      // até que a resposta dessa fila seja concluída ou o estado expire por falha da ponte.
      if (!(await waitForAiIdle())) { if (myRun === runId) return paused(); return { sent, failed, status: 'paused' }; }

      // Janela de horário (agendamento)
      if (schedule && !inScheduleWindow(schedule)) {
        if (!announcedWait) { diag('WAITING_SCHEDULE', 'info', schedule); announcedWait = true; }
        while (!cancelled() && !inScheduleWindow(schedule)) await sleep(15000);
        if (cancelled()) { if (myRun === runId) return paused(); return { sent, failed, status: 'paused' }; }
        announcedWait = false;
      }

      // v7.0.5 - Vale para QUALQUER modo (aba comum, janela lateral ou embutido): o Chrome só trata o
      // WhatsApp como "desperto" enquanto a página está visível. Se estiver oculta (aba em segundo
      // plano, janela coberta ou minimizada), esperamos em vez de falhar e seguimos sozinhos ao voltar.
      if (document.hidden && campaign.allowHidden) {
        // Modo de teste (diagnóstico): segue mesmo oculto, só registra — para provar se a visibilidade é necessária.
        if (!announcedHidden) { diag('HIDDEN_SEND_ATTEMPT', 'info', { embedded: EMBEDDED, contact: contact.phone, hint: 'modo segundo plano: enviando pelo Store com a página oculta' }); announcedHidden = true; }
      } else if (document.hidden) {
        const t0 = Date.now();
        diag('WAITING_TAB_VISIBLE', 'warn', { embedded: EMBEDDED, contact: contact.phone, hint: 'WhatsApp fora de vista; envio em espera até ficar visível' });
        sendToContentScript('CAMPAIGN_WAITING_VISIBLE', { campaignId: campaign.id });
        while (!cancelled() && document.hidden) await sleep(1000);
        if (cancelled()) { if (myRun === runId) return paused(); return { sent, failed, status: 'paused' }; }
        diag('TAB_VISIBLE_AGAIN', 'info', { waitedMs: Date.now() - t0 });
      }
      if (EMBEDDED) { try { window.focus(); } catch (e) { /* sem foco: o Store não precisa */ } }

      let delayAfter = 0;
      let batchPauseHandled = false;
      try {
        sendToContentScript('CONTACT_PROCESSING', { campaignId: campaign.id, contact });
        const phone = normalizePhone(contact.phone);
        if (phone.length < 10) throw new SendError('Telefone inválido: ' + (contact.phone || 'vazio'), 'INVALID');
        // v1.5.0: black list (inclusive quem foi adicionado durante o envio): ignora sem contar falha.
        if (blockedTails.has(phone.slice(-10))) {
          diag('BLACKLIST_SKIPPED', 'warn', { phone, where: 'campaign' });
          sendToContentScript('MESSAGE_SKIPPED', { campaignId: campaign.id, contact: { ...contact, phone }, reason: 'blacklist', sent, failed });
          continue;
        }
        // v1.6.0: consent tracking - opt-out bloqueia envio promocional (verificado via storage local).
        // A consulta é feita pelo service worker antes da campanha iniciar; aqui é uma defesa extra
        // caso o contato tenha feito opt-out durante o envio (atualização em tempo real).
        if (campaign.requireConsent && blockedTails.has(phone.slice(-10))) {
          diag('CONSENT_OPTOUT_SKIPPED', 'warn', { phone, where: 'campaign' });
          sendToContentScript('MESSAGE_SKIPPED', { campaignId: campaign.id, contact: { ...contact, phone }, reason: 'consent_optout', sent, failed });
          continue;
        }
        // v7.0.5: o próprio número da conta falha ANTES de qualquer busca/envio (< 1 s) e a campanha segue.
        if (isOwnNumber(phone.slice(-8))) {
          diag('OWN_NUMBER_SKIPPED', 'warn', { phone, where: 'campaign', skipOwn: campaign.skipOwn !== false });
          if (campaign.skipOwn !== false) {
            // v1.1.0: opção "Não enviar para o meu próprio número" (padrão ligado): ignora em silêncio, sem contar falha, sem espera.
            sendToContentScript('MESSAGE_SKIPPED', { campaignId: campaign.id, contact: { ...contact, phone }, reason: 'own_number', sent, failed });
            continue;
          }
          throw new SendError(OWN_NUMBER_MSG, 'INVALID');
        }
        const message = processTemplate(template, contact);
        if (!message) throw new SendError('A mensagem ficou vazia.', 'INVALID');

        const delivered = await withOutgoingSendLock(() => deliver(phone, message, !!campaign.allowHidden && document.hidden));

        sent++; consecutiveTech = 0; sinceBatch++;
        sendToContentScript('MESSAGE_SENT', { campaignId: campaign.id, contact: { ...contact, phone }, message, sent, failed, via: delivered?.via, storeReason: delivered?.storeReason || '' });
        delayAfter = Math.floor(Math.random() * (dMax - dMin + 1)) + dMin;

        if (batch && batch.size > 0 && batch.pauseMs > 0 && sinceBatch >= batch.size && i < contacts.length - 1) {
          const pauseMs = Math.max(0, Number(batch.pauseMs) || 0);
          const resumeAt = new Date(Date.now() + pauseMs).toISOString();
          diag('BATCH_PAUSE', 'info', { everyMessages: batch.size, pauseMs, aiRemainsActive: true });
          sinceBatch = 0;
          batchPauseHandled = true;
          sendToContentScript('CAMPAIGN_BATCH_PAUSE_STARTED', { campaignId: campaign.id, sent, pauseMs, resumeAt });
          await sleep(pauseMs);
          if (cancelled()) { if (myRun === runId) return paused(); return { sent, failed, status: 'paused' }; }
          sendToContentScript('CAMPAIGN_BATCH_PAUSE_ENDED', { campaignId: campaign.id, sent });
        }
      } catch (error) {
        const code = error.code || 'TECH';
        if (code === 'NEEDS_VISIBLE') {
          // Não é falha do contato: espera a janela ficar visível e tenta o MESMO contato de novo.
          diag('BACKGROUND_NEEDS_VISIBLE', 'warn', { phone: contact.phone, reason: error.message });
          sendToContentScript('CAMPAIGN_WAITING_VISIBLE', { campaignId: campaign.id });
          const tw = Date.now();
          while (!cancelled() && document.hidden) await sleep(1000);
          if (cancelled()) { if (myRun === runId) return paused(); return { sent, failed, status: 'paused' }; }
          diag('TAB_VISIBLE_AGAIN', 'info', { waitedMs: Date.now() - tw });
          i--; continue;
        }
        failed++;
        const soft = code === 'NOT_ON_WHATSAPP' || code === 'INVALID'; // problema do número, não do envio
        if (!soft) consecutiveTech++;
        diag('MESSAGE_FAILED', 'error', { phone: contact.phone, code, error: error.message });
        sendToContentScript('MESSAGE_FAILED', { campaignId: campaign.id, contact: { ...contact, phone: normalizePhone(contact.phone) }, error: error.message, code, sent, failed });
        if (consecutiveTech >= 3) {
          diag('CAMPAIGN_AUTO_PAUSED', 'error', { reason: '3 falhas técnicas seguidas', lastError: error.message });
          return paused('Pausada automaticamente após 3 falhas técnicas seguidas: ' + error.message);
        }
        delayAfter = soft ? 1500 : 4000;
      }
      // Quando houve pausa de lote, ela já foi aguardada acima. Nos demais casos,
      // respeita o intervalo normal entre contatos.
      if (i < contacts.length - 1 && !(typeof batchPauseHandled !== 'undefined' && batchPauseHandled)) await sleep(delayAfter);
    }

    if (myRun === runId) { isProcessing = false; currentCampaign = null; }
    sendToContentScript('CAMPAIGN_COMPLETED', { campaignId: campaign.id, sent, failed });
    diag('CAMPAIGN_COMPLETED', 'success', { sent, failed });
    return { sent, failed, status: 'completed' };
  }

  // ============================================================================
  // CONEXÃO: QR code e número conectado
  // ============================================================================

  // Captura a imagem do QR code exibido pelo WhatsApp Web (para mostrar dentro da extensão).
  function getQrCode() {
    const holder = $('[data-ref]');
    const canvas = (holder && holder.querySelector('canvas')) || $('canvas[aria-label*="QR" i]') || $('canvas[aria-label*="scan" i]');
    if (!canvas || !canvas.width) return null;
    try { return { dataUrl: canvas.toDataURL('image/png'), ref: holder?.getAttribute('data-ref') || '' }; }
    catch { return null; }
  }


  // v7.0.3 - Que tela o WhatsApp Web está mostrando? 'chat' | 'qr' | 'error' | 'loading'
  // (antes, qualquer página sem chats era tratada como "QR code", inclusive a página de erro).
  const QR_TEXT_RE = /scan (this )?qr|escaneie|link a device|conectar um aparelho|log in with phone number|entrar com n[uú]mero|aparelhos conectados|linked devices/i;
  const ERROR_RE = /something went wrong|algo deu errado|algo salio mal|algo sali[oó] mal|ocorreu um erro|sorry,? something|desculpe,? algo/i;
  function pageState() {
    try {
      if (document.querySelector('#pane-side')) return 'chat';
      const body = document.body;
      const text = ((body && body.innerText) || '').trim();
      // Página de erro do próprio WhatsApp: texto curto + frase de erro, sem o app (#app vazio/ausente).
      const app = document.querySelector('#app');
      const appEmpty = !app || app.children.length === 0;
      if (text && text.length < 600 && ERROR_RE.test(text) && appEmpty) return 'error';
      const holder = document.querySelector('[data-ref]');
      if ((holder && holder.querySelector('canvas')) || document.querySelector('canvas[aria-label*="QR" i], canvas[aria-label*="scan" i]') || (holder && QR_TEXT_RE.test(text)) || (!appEmpty && QR_TEXT_RE.test(text) && !document.querySelector('#pane-side'))) return 'qr';
      if (text && text.length < 600 && ERROR_RE.test(text)) return 'error';
      return 'loading';
    } catch { return 'loading'; }
  }
  // Dados para diagnóstico (sem conteúdo de conversas): status HTTP da página, referrer, armazenamento...
  function pageInfo() {
    const info = { url: location.href, title: document.title || '', referrer: document.referrer || '', embedded: EMBEDDED };
    try { const nav = performance.getEntriesByType('navigation')[0]; if (nav) { info.httpStatus = nav.responseStatus ?? null; info.navType = nav.type; info.transferSize = nav.transferSize; } } catch {}
    try { info.text = ((document.body && document.body.innerText) || '').trim().slice(0, 240); } catch {}
    try { info.ancestors = Array.from(location.ancestorOrigins || []); } catch {}
    try { info.cookieEnabled = navigator.cookieEnabled; } catch {}
    try { info.serviceWorker = 'serviceWorker' in navigator; info.secureContext = window.isSecureContext; } catch {}
    try { localStorage.setItem('__i9t', '1'); localStorage.removeItem('__i9t'); info.localStorage = true; } catch (e) { info.localStorage = 'ERRO: ' + e.name; }
    return info;
  }

  function getMyNumber() {
    try {
      const raw = JSON.parse(localStorage.getItem('last-wid-md') || localStorage.getItem('last-wid') || 'null');
      return typeof raw === 'string' ? raw.split(/[:@]/)[0] : '';
    } catch { return ''; }
  }

  // ============================================================================
  // COMANDOS RECEBIDOS DO CONTENT SCRIPT
  // ============================================================================

  window.addEventListener('message', async (event) => {
    if (window.__i9rcsInjectedV7Version !== EXT_VER) return;
    if (event.source !== window || event.data?.source !== 'i9rcs7-content') return;
    
    const { type, payload } = event.data;
    const rid = payload?.requestId;
    const reply = (t, data) => sendToContentScript(t, { ...data, requestId: rid });
    
    try {
      switch (type) {
        case 'START_CAMPAIGN':
          const result = await processCampaign(payload);
          sendToContentScript('CAMPAIGN_RESULT', { ...result, campaignId: payload.id });
          break;

        case 'PAUSE_CAMPAIGN':
          isProcessing = false;
          break; // o laço detecta, para e envia CAMPAIGN_PAUSED com os totais

        case 'RESUME_CAMPAIGN':
          break; // retomar = o painel reenvia START_CAMPAIGN só com os contatos pendentes

        case 'AI_PROCESSING_STATE': {
          const sequence = Number(payload?.sequence) || 0;
          if (sequence >= aiProcessingSequence) {
            aiProcessingSequence = sequence;
            aiPendingInbound = Math.max(0, Math.floor(Number(payload?.pending) || 0));
            aiProcessingStateAt = Date.now();
          }
          reply('AI_PROCESSING_STATE_ACK', { sequence: aiProcessingSequence, pending: aiPendingInbound });
          break;
        }

        case 'STOP_CAMPAIGN':
          isProcessing = false;
          currentCampaign = null;
          sendToContentScript('CAMPAIGN_STOPPED', { campaignId: payload.campaignId });
          break;

        case 'SYNC_PRIVATE_OPPORTUNITIES': {
          let ready = false;
          try {
            const st = loadStore();
            ready = !!(st && asArray(st.Collections.Chat).length);
          } catch { ready = false; }
          if (!ready) {
            reply('PRIVATE_CHATS_SYNCED', { sync: { success: false, scanned: 0, changed: 0, error: 'STORE_NOT_READY' } });
            break;
          }
          // Não aguarda a varredura inteira: ela pode envolver resolução de LID
          // e muitas conversas. Os lotes seguem para o service worker em paralelo.
          syncPrivateChatsToCrm({ force: true, syncRunId: payload?.syncRunId || null }).catch((error) => {
            diag('PRIVATE_OPPORTUNITY_SCAN_ERROR', 'warn', { error: error?.message || String(error), manual: true });
          });
          reply('PRIVATE_CHATS_SYNCED', { sync: { success: true, started: true }, injectedVersion: EXT_VER });
          break;
        }

        case 'EXTRACT_GROUP_MEMBERS':
          const members = await extractGroupMembers(payload?.groupName || '', payload?.groupId || '', { includeLeft: payload?.includeLeft !== false, periodDays: payload?.periodDays });
          reply('GROUP_MEMBERS_EXTRACTED', { groupId: payload.groupId, members });
          break;

        case 'EXTRACT_ALL_CHATS':
          const chats = await extractAllChats();
          reply('CHATS_EXTRACTED', { chats });
          break;

        case 'OPEN_CHAT_BY_PHONE': {
          const phone = String(payload?.phone || '').replace(/\D/g, '');
          if (phone.length < 10 || phone.length > 15) throw new Error('Telefone inválido ou indisponível; a extensão não abrirá uma conversa ambígua.');
          await openChatByPhoneDOM(phone, { strict: true });
          reply('CHAT_OPENED', { success: true, phone, waChatId: String(payload?.waChatId || ''), header: textOf(openChatHeader()) });
          break;
        }

        case 'EXTRACT_CHAT_MESSAGES': {
          const limit = payload?.limit || 50;
          const header = $(SELECTORS.headerName);
          const rows = $$('[data-pre-plain-text]').slice(-limit);
          const messages = rows.map((el) => ({
            meta: el.getAttribute('data-pre-plain-text') || '',
            text: (el.querySelector('span.selectable-text, .copyable-text') || el).textContent.trim(),
          }));
          reply('CHAT_MESSAGES_EXTRACTED', { name: header?.textContent || '', messages });
          break;
        }

        case 'AI_SEND_REPLY': {
          const outcome = await withOutgoingSendLock(async () => {
            const targetChatId = String(payload?.chatId || '').trim();
            const replyText = String(payload?.text || '').slice(0, 4000);
            if (targetChatId && replyText) {
              try {
                await sendToChatIdViaStore(targetChatId, replyText);
                diag('AI_REPLY_SENT_VIA_STORE', 'success', {});
                return { success: true, via: 'store' };
              } catch (e) {
                if (!e.fallback) throw e;
                diag('AI_REPLY_STORE_FALLBACK', 'warn', { reason: String(e?.message || e).slice(0, 160) });
              }
            }
            const expected = String(payload?.expectedChatName || '').trim().toLowerCase();
            const actual = currentChatLabel().trim().toLowerCase();
            if (!expected || !actual || expected !== actual) throw new Error('A conversa aberta mudou durante o processamento. A resposta foi cancelada para evitar envio ao contato errado.');
            await sendMessageDOM(String(payload?.text || '').slice(0, 4000));
            return { success: true, chatName: actual };
          });
          reply('AI_REPLY_SENT', outcome);
          break;
        }

        case 'AI_SEND_TO_PHONE': {
          const phone = String(payload?.phone || '').replace(/\D/g, '');
          const text = String(payload?.text || '').trim().slice(0, 2500);
          if (phone.length < 10 || phone.length > 15 || !text) throw new Error('Telefone do responsável ou texto de notificação inválido.');
          await withOutgoingSendLock(() => sendViaStore(phone, text));
          reply('AI_SELLER_NOTIFIED', { success: true, phoneTail: phone.slice(-4) });
          break;
        }
        case 'FOLLOWUP_SEND_TO_PHONE': {
          const phone = String(payload?.phone || '').replace(/\D/g, '');
          const text = String(payload?.text || '').trim().slice(0, 2500);
          if (phone.length < 10 || phone.length > 15 || !text) throw new Error('Telefone ou mensagem de follow-up inválidos.');
          await withOutgoingSendLock(() => sendViaStore(phone, text));
          reply('FOLLOWUP_SENT', { success: true, phoneTail: phone.slice(-4), followupId: String(payload?.followupId || '').slice(0, 100) });
          break;
        }

        case 'GET_CURRENT_CHAT_INFO':
          const headerName = $(SELECTORS.headerName);
          reply('CURRENT_CHAT_INFO', { name: headerName?.textContent || '', phone: headerName?.textContent?.match(/\d+/)?.[0] || '' });
          break;

        case 'PING':
          const pg = pageState(); reply('PONG', { timestamp: Date.now(), loggedIn: pg === 'chat', page: pg, pageInfo: pg === 'error' ? pageInfo() : null, me: getMyNumber(), store: storeStatus(), storeInternals: storeInternals(), embedded: EMBEDDED, hidden: document.hidden, injectedVersion: EXT_VER });
          break;

        case 'GET_QR':
          reply('QR', { qr: getQrCode() });
          break;

        case 'BLACKLIST_RESULT': {
          const cb = blPending.get(payload?.requestId); if (cb) { blPending.delete(payload.requestId); cb(payload); }
          break;
        }

        case 'BLACKLIST_SYNC':
          blockedTails = new Set(payload?.tails || []);
          reply('BLACKLIST_SYNCED', { count: blockedTails.size });
          break;

        case 'BLACKLIST_APPLY_LABELS': {
          const stB = await getStore(15000);
          if (!stB) throw new Error('O WhatsApp Web ainda não carregou as conversas.');
          let applied = 0; let failed = 0; let note = ''; let created = false;
          for (const ph of payload?.phones || []) {
            const r = await applyBlacklistLabelTo(stB, [`${ph}@c.us`]);
            if (r.applied) applied++; else { failed++; note = note || r.note; }
            created = created || r.created;
          }
          reply('BLACKLIST_LABELS_APPLIED', { applied, failed, note, created });
          break;
        }

        case 'LABELS_DIAGNOSTIC': {
          const report = await labelsDiagnostic();
          diag('LABELS_DIAGNOSTIC', report.verdict === 'ok' ? 'info' : 'warn', { report });
          reply('LABELS_DIAGNOSTIC_RESULT', { report });
          break;
        }

        case 'LABELS_LIST': {
          const stL = await getStore(15000);
          if (!stL) throw new Error('O WhatsApp Web ainda não carregou as conversas. Aguarde e tente de novo.');
          const dataL = await readLabels(stL);
          if (!dataL.via) throw new Error('NO_LABEL_COLLECTION');
          reply('LABELS_LISTED', dataL);
          break;
        }
      }
    } catch (error) {
      sendToContentScript('ERROR', { type, error: error.message, requestId: rid });
    }
  });

  // ============================================================================
  // DETECÇÃO DE ERROS / RATE LIMIT
  // ============================================================================

  function observeErrors() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches?.(SELECTORS.offlineBanner)) {
              sendToContentScript('WHATSAPP_OFFLINE', {});
            }
          }
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
  }

  // ============================================================================
  // INIT
  // ============================================================================

  // ============================================================================
  // CHAT COM IA — CAPTURA DE MENSAGENS RECEBIDAS PELO STORE (v1.0.9)
  // ----------------------------------------------------------------------------
  // A leitura por DOM (.message-in / lista #pane-side) quebra a cada mudança de HTML do
  // WhatsApp Web. A sincronização de leads já usa o Store interno e funciona; aqui a IA
  // passa a usar a mesma fonte: evento Msg 'add' + varredura de reserva a cada 2,5 s.
  // O DOM continua como alternativa (content.js) enquanto este monitor estiver indisponível.
  // ============================================================================
  const AI_STORE_MAX_AGE_MS = 10 * 60 * 1000;
  const aiStoreStartedAt = Date.now();
  const aiStoreSeen = new Set();
  let aiStoreWatcherStarted = false;

  function aiChatRefHash(chatId) {
    // Mesmo cálculo do content.js (DOM), para manter o histórico das conversas já existentes.
    const raw = String(chatId || '') + '|chat-ref';
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'msg_' + (h >>> 0).toString(16);
  }

  function aiStoreMessageText(m) {
    // Em mídia o campo body guarda a miniatura em base64; só a legenda (caption) é texto.
    const type = String(m?.type || '');
    if (type === 'chat') return String(m?.body ?? '').replace(/\u200b/g, '').trim();
    if (type === 'image' || type === 'video' || type === 'document') return String(m?.caption ?? '').replace(/\u200b/g, '').trim();
    return '';
  }

  function aiStoreBuildPayload(st, m, source) {
    if (!m || m.isNotification === true || m.isStatusV3 === true) return null;
    const remote = m.id?.remote || m.from || null;
    const chatId = serialize(remote);
    const server = String(widServer(remote) || '').toLowerCase();
    if (!chatId || !['c.us', 's.whatsapp.net', 'lid', 'g.us'].includes(server)) return null;
    const meIds = myUserIds(st);
    if (privateMessageFromMe(m, meIds)) return null;
    const text = aiStoreMessageText(m).slice(0, 4000);
    if (!text) return null;
    const ts = timestampMs(m.t ?? m.timestamp);
    if (ts && (ts < aiStoreStartedAt - 15000 || Date.now() - ts > AI_STORE_MAX_AGE_MS)) return null;
    const rawId = String(m.id?._serialized || serialize(m.id) || '');
    if (!rawId) return null;
    const messageId = ('store_' + rawId).slice(0, 280);
    if (aiStoreSeen.has(messageId)) return null;
    aiStoreSeen.add(messageId);
    while (aiStoreSeen.size > 800) aiStoreSeen.delete(aiStoreSeen.values().next().value);

    const C = st.Collections;
    let chat = null;
    try { chat = C.Chat?.get?.(remote) || null; } catch { /* ignora */ }
    if (!chat) chat = asArray(C.Chat).find((c) => serialize(c.id) === chatId) || null;
    const contact = chat?.contact || (() => { try { return C.Contact?.get?.(remote) || null; } catch { return null; } })();
    const isGroup = server === 'g.us';
    let phone = '';
    if (!isGroup) {
      if (server === 'c.us' || server === 's.whatsapp.net') phone = onlyDigits(widUser(remote));
      else { const pn = serialize(contact?.phoneNumber); if (/@c\.us$/.test(pn)) phone = onlyDigits(pn.split('@')[0]); }
    }
    const chatName = String(chat?.formattedTitle || chat?.name || contact?.name || contact?.pushname || contact?.formattedName || contact?.shortName || phone || widUser(remote) || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    if (!chatName) return null;

    const authorSer = serialize(m.author || m.senderObj?.id || m.id?.participant || null);
    const senderName = isGroup ? String(m.senderObj?.name || m.senderObj?.pushname || m.notifyName || m.senderObj?.formattedName || '').trim().slice(0, 120) : '';
    const senderPhone = isGroup && /@c\.us$/.test(authorSer) ? onlyDigits(authorSer.split('@')[0]).slice(0, 15) : '';
    const mentioned = Array.isArray(m.mentionedJidList) ? m.mentionedJidList : [];
    const isMention = isGroup && mentioned.some((w) => isMeId(meIds, w, widUser(w)));
    const quoted = m.quotedMsg || null;
    const isReply = !!(m.quotedStanzaID || quoted);
    const replyContext = quoted ? String(aiStoreMessageText(quoted) || '').replace(/\s+/g, ' ').trim().slice(0, 700) : '';

    return {
      messageId, chatId, chatRef: aiChatRefHash(chatId), chatName, chatType: isGroup ? 'group' : 'private', isGroup,
      phone: phone.slice(0, 15), senderName, senderPhone, isReply, isMention, replyContext,
      text, receivedAt: ts ? new Date(ts).toISOString() : new Date().toISOString(), source,
    };
  }

  function aiStoreHandleMessage(st, m, source) {
    try {
      const payload = aiStoreBuildPayload(st, m, source);
      if (payload) sendToContentScript('AI_STORE_MESSAGE', payload);
    } catch (e) { diag('AI_STORE_MESSAGE_ERROR', 'warn', { error: String(e?.message || e).slice(0, 160) }); }
  }

  async function startAiStoreWatcher() {
    if (aiStoreWatcherStarted) return;
    aiStoreWatcherStarted = true;
    let st = null;
    while (!st) {
      st = await getStore(20000);
      if (!st) { sendToContentScript('AI_STORE_STATUS', { ok: false, reason: 'store-unavailable' }); await wait(5000); }
    }
    let via = 'poll';
    try {
      const Msg = st.Collections.Msg;
      if (Msg && typeof Msg.on === 'function') { Msg.on('add', (m) => { aiStoreHandleMessage(st, m, 'store-event'); }); via = 'event+poll'; }
    } catch (e) { diag('AI_STORE_EVENT_BIND_FAILED', 'warn', { error: String(e?.message || e).slice(0, 160) }); }

    const poll = () => {
      try {
        const threshold = aiStoreStartedAt - 20000;
        for (const chat of asArray(st.Collections.Chat)) {
          const server = privateChatServer(chat);
          if (server !== 'c.us' && server !== 's.whatsapp.net' && server !== 'lid' && server !== 'g.us') continue;
          const last = privateChatLastMessageAt(chat);
          if (last && last < threshold) continue;
          const raw = chat?.msgs;
          const models = Array.isArray(raw?.models) ? raw.models : (Array.isArray(raw) ? raw : (typeof raw?.getModelsArray === 'function' ? raw.getModelsArray() : []));
          for (const m of models.slice(-6)) aiStoreHandleMessage(st, m, 'store-poll');
        }
      } catch (e) { diag('AI_STORE_POLL_ERROR', 'warn', { error: String(e?.message || e).slice(0, 160) }); }
    };
    const beat = () => sendToContentScript('AI_STORE_STATUS', { ok: true, via, chats: asArray(st.Collections.Chat).length });
    beat();
    setInterval(poll, 2500);
    setInterval(beat, 5000);
    diag('AI_STORE_WATCHER_READY', 'success', { via });
  }

  // Envio da resposta da IA pelo ID da conversa: não depende de qual chat está aberto na tela.
  async function sendToChatIdViaStore(chatId, text) {
    const st = await getStore(8000);
    const sendMod = st && st.mod('WAWebSendTextMsgChatAction');
    if (!st || !sendMod || typeof sendMod.sendTextMsgToChat !== 'function') throw Object.assign(new Error('Módulos internos do WhatsApp indisponíveis'), { fallback: true });
    const C = st.Collections;
    const id = String(chatId || '').trim();
    let chat = null;
    try { chat = C.Chat?.get?.(id) || null; } catch { /* ignora */ }
    if (!chat) chat = asArray(C.Chat).find((c) => serialize(c.id) === id) || null;
    if (!chat) { try { const wid = st.mod('WAWebWidFactory')?.createWid?.(id); if (wid) chat = C.Chat?.get?.(wid) || null; } catch { /* ignora */ } }
    if (!chat) throw Object.assign(new Error('Conversa não encontrada no Store'), { fallback: true });
    let res;
    try { res = await sendMod.sendTextMsgToChat(chat, text, {}); }
    catch (e) { throw Object.assign(new Error('Falha ao enviar: ' + (e?.message || e)), { fallback: e instanceof TypeError }); }
    try {
      let out = res?.messageSendResult ?? (Array.isArray(res) ? res[1] : res);
      out = await Promise.resolve(out);
      if (out && typeof out === 'object' && 'messageSendResult' in out) out = await Promise.resolve(out.messageSendResult);
      if (typeof out === 'string' && out !== 'OK') throw new Error(out);
    } catch (e) { throw new SendError('O WhatsApp recusou o envio: ' + (e?.message || e), 'SEND_FAILED'); }
    return true;
  }


  function init() {
    console.log('[i9Hub] Injected script iniciado v' + EXT_VER);
    observeErrors();
    try { installBlacklistUi(); } catch (e) { diag('BLACKLIST_UI_ERROR', 'warn', { error: e.message }); }
    try { startPrivateOpportunityMonitor(); } catch (e) { diag('PRIVATE_OPPORTUNITY_MONITOR_ERROR', 'warn', { error: e.message }); }
    try { startAiStoreWatcher().catch((e) => diag('AI_STORE_WATCHER_ERROR', 'warn', { error: String(e?.message || e).slice(0, 160) })); } catch (e) { diag('AI_STORE_WATCHER_ERROR', 'warn', { error: e.message }); }
    // Segurar um Web Lock reduz a limitação de timers do Chrome quando a aba fica em segundo plano.
    try { navigator.locks?.request('i9rcs-keepalive', () => new Promise(() => {})); } catch (e) { /* ignora */ }
    sendToContentScript('READY', { version: EXT_VER });
    // v7.0.3 - Se o WhatsApp mostrar a página de erro, registra os detalhes (uma vez) nos Logs.
    let reported = false;
    const watch = setInterval(() => {
      if (reported) return clearInterval(watch);
      if (pageState() === 'error') { reported = true; diag('WA_ERROR_PAGE', 'error', pageInfo()); }
    }, 3000);
    setTimeout(() => clearInterval(watch), 90000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();


// Mantém a aba ativa reproduzindo um som inaudível ou enviando pings
setInterval(() => {
    window.postMessage({ source: 'i9rcs7-injected', type: 'KEEPALIVE_PING' }, '*');
}, 25000);

