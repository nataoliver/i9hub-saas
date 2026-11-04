// Polyfill para executar os componentes do i9Hub diretamente no navegador como SaaS Web
window.chrome = window.chrome || {};
window.chrome.runtime = window.chrome.runtime || {
  id: 'i9hub-saas-web',
  lastError: null,
  getManifest: () => ({ name: 'i9Hub SaaS', version: '1.0.0', version_name: '1.0.0' }),
  getURL: (p) => '/' + String(p || '').replace(/^\/+/, ''),
  onMessage: { addListener: () => {}, removeListener: () => {} },
  sendMessage: (msg, cb) => {
    window.i9SaaSApi?.sendMessage(msg?.type, msg?.payload).then((r) => cb && cb(r));
  }
};
window.chrome.storage = window.chrome.storage || {
  local: {
    get: async (keys) => {
      const out = {};
      const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys || {});
      for (const k of list) {
        const raw = localStorage.getItem('i9_saas_' + k);
        if (raw !== null) { try { out[k] = JSON.parse(raw); } catch { out[k] = raw; } }
      }
      return out;
    },
    set: async (obj) => {
      for (const [k, v] of Object.entries(obj || {})) {
        localStorage.setItem('i9_saas_' + k, JSON.stringify(v));
      }
    },
    remove: async (keys) => {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) localStorage.removeItem('i9_saas_' + k);
    }
  },
  onChanged: { addListener: () => {} }
};
window.chrome.tabs = window.chrome.tabs || {
  create: ({ url }) => window.open(url, '_blank', 'noopener,noreferrer'),
  getCurrent: (cb) => cb && cb({ id: 1 })
};
window.chrome.permissions = window.chrome.permissions || {
  contains: async () => true,
  request: async () => true
};