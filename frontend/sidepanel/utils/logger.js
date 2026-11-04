/**
 * Logger compatível com SaaS web e extensão Chrome.
 * No SaaS, envia logs via fetch para /api/rpc (tipo LOG) ou faz console.log como fallback.
 * Na extensão, mantém o comportamento original via chrome.runtime.sendMessage.
 */
export const EXT_VERSION = (typeof chrome !== "undefined" && chrome.runtime?.getManifest?.().version_name) || "1.0.0-saas";
const isExtension = typeof chrome !== "undefined" && !!chrome.runtime?.sendMessage;
const MAX_LOGS = 5000;

// Buffer circular de logs locais para o SaaS (substitui chrome.storage do service worker)
const localLogBuffer = [];

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

  if (isExtension) {
    // Extensão Chrome: enviar para o service worker
    try {
      chrome.runtime.sendMessage(
        { type: "LOG", payload: { module: entry.module, action: entry.action, status: entry.status, message: entry.message, data: event.data || {} } },
        () => { void chrome.runtime.lastError; }
      );
    } catch (e) {
      console.warn("logger failed", e);
    }
  } else {
    // SaaS web: buffer local + console + envio assíncrono para o backend
    localLogBuffer.push(entry);
    if (localLogBuffer.length > MAX_LOGS) localLogBuffer.splice(0, localLogBuffer.length - MAX_LOGS);

    const logLine = `[${entry.timestamp}] [${entry.module}] ${entry.action} (${entry.status}): ${entry.message}`;
    if (entry.status === "error") console.error(logLine, entry.data);
    else if (entry.status === "warn") console.warn(logLine, entry.data);
    else console.log(logLine, entry.data);

    // Enviar para o backend de forma não-bloqueante
    try {
      const token = localStorage.getItem("i9hub_jwt");
      if (token) {
        fetch("/api/rpc", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ type: "LOG", payload: { module: entry.module, action: entry.action, status: entry.status, message: entry.message, data: event.data || {} } })
        }).catch(() => {});
      }
    } catch { /* ignora falhas de rede */ }
  }

  return entry;
}

/** Retorna os logs armazenados localmente (para LogsView no SaaS) */
export function getLocalLogs() {
  return [...localLogBuffer];
}
