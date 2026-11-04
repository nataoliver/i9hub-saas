
export const EXT_VERSION = (typeof chrome !== "undefined" && chrome.runtime?.getManifest?.().version_name) || "5.3.3";
const MAX_LOGS = 5000;

export async function logger(event = {}) {
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    timestamp: new Date().toISOString(),
    module: event.module || "system",
    action: event.action || "UNKNOWN",
    status: event.status || "info",
    message: event.message || "",
    data: { ...(event.data || {}), EXT_VERSION }
  };
  // v7.0.5: quem grava em systemLogs é só o service worker (fila serializada). Gravar daqui também
  // recriava a corrida "ler tudo / gravar tudo" entre o painel e o service worker e perdia registros.
  try {
    chrome.runtime.sendMessage({ type: "LOG", payload: { module: entry.module, action: entry.action, status: entry.status, message: entry.message, data: event.data || {} } }, () => { void chrome.runtime.lastError; });
  } catch (e) {
    console.warn("logger failed", e);
  }
  return entry;
}
