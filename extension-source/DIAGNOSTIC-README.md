# i9Hub v1.0.3 — Instrumentação de Diagnóstico da Sincronização

## Objetivo
Tornar a falha de sincronização observável em ambiente real, identificando a fronteira exata onde os dados deixam de avançar. **Nenhuma correção funcional foi aplicada.**

## Arquivos Modificados (apenas na pasta `i9Hub-v1.0.3-diagnostic`)
- `sidepanel/components/DashboardView.js` — geração de `syncRunId`, logs de clique, envio, resposta, renderização e timeout
- `sidepanel/utils/api.js` — propagação de `syncRunId` no payload de `SYNC_PRIVATE_OPPORTUNITIES`
- `background/service-worker.js` — logs de recebimento do worker, seleção de aba, batch recebido, persistência e snapshot
- `content/content.js` — log de repasse assíncrono de batches (`BRIDGE_BATCH_FORWARD`)
- `content/injected.js` — logs de início da sincronização, descoberta de chats, envio de batches intermediários e final

## Como Abrir Cada Console no Chrome

### 1. Side Panel (Dashboard)
1. Abra o WhatsApp Web autenticado
2. Clique no ícone da extensão → abra o Side Panel
3. Pressione `F12` ou `Ctrl+Shift+I` dentro do Side Panel
4. Vá na aba **Console**
5. Filtre por `[i9Hub Sync]`

### 2. Service Worker (Background)
1. Navegue para `chrome://extensions/`
2. Ative o "Modo do desenvolvedor"
3. Localize o i9Hub v1.0.3-diagnostic
4. Clique em **"service worker"** (link azul na seção "Inspecionar views")
5. Um DevTools separado abrirá — vá na aba **Console**
6. Filtre por `[i9Hub Sync]`

### 3. Content Script / Injected Script (Aba WhatsApp Web)
1. Na aba do WhatsApp Web, pressione `F12`
2. Vá na aba **Console**
3. No dropdown superior esquerdo do console, selecione **"top"** para ver logs do Content Script
4. Selecione o frame do WhatsApp para ver logs do Injected Script
5. Filtre por `[i9Hub Sync]`

## Roteiro de Teste Manual Reproduzível

1. Recarregue a extensão em `chrome://extensions/` (clique no ícone de recarga ↻)
2. Abra o WhatsApp Web e aguarde carregar completamente
3. Abra os três consoles listados acima, todos filtrados por `[i9Hub Sync]`
4. No Side Panel, clique em **"Sincronizar conversas"**
5. Aguarde até o status mudar para "concluída", "parcial" ou "erro" (máximo 60s)
6. Copie **todos** os logs `[i9Hub Sync]` dos três consoles
7. Compare os `syncRunId` entre os consoles — devem ser idênticos
8. Identifique a última mensagem emitida antes do fluxo parar

## Sequência Esperada de Logs (Cenário Normal)

```
[Side Panel]   DASHBOARD_SYNC_CLICK        syncRunId=sync_m...
[Side Panel]   DASHBOARD_SYNC_REQUEST_SENT  syncRunId=sync_m...
[Service Worker] WORKER_SYNC_REQUEST_RECEIVED syncRunId=sync_m...
[Service Worker] WHATSAPP_TAB_SELECTED       syncRunId=sync_m... tabId=123
[Injected]     CONTENT_SCRIPT_SYNC_STARTED  syncRunId=sync_m... scanId=wa_priv_...
[Injected]     CHAT_DISCOVERY_RESULT        syncRunId=sync_m... privateChatCount=42
[Injected]     BATCH_SEND_START             syncRunId=sync_m... batchIndex=0 chatCount=10
[Content Script] BRIDGE_BATCH_FORWARD       syncRunId=wa_priv_... batchIndex=0 chatCount=10
[Service Worker] BATCH_RECEIVED             syncRunId=wa_priv_... batchIndex=0 chatCount=10
[Service Worker] BATCH_PERSISTED            syncRunId=wa_priv_... batchIndex=0 added=8 updated=2
[Injected]     BATCH_SEND_START             syncRunId=sync_m... batchIndex=1 chatCount=10
... (repete para cada batch) ...
[Injected]     FINAL_BATCH_SEND             syncRunId=sync_m... batchIndex=4 chatCount=2
[Content Script] BRIDGE_BATCH_FORWARD       syncRunId=wa_priv_... batchIndex=4 finalBatch=true
[Service Worker] FINAL_BATCH_RECEIVED       syncRunId=wa_priv_... batchIndex=4
[Service Worker] BATCH_PERSISTED            syncRunId=wa_priv_... finalBatch=true
[Service Worker] SNAPSHOT_READ              syncRunId=wa_priv_... pendingCount=5
[Side Panel]   DASHBOARD_SYNC_RESPONSE      syncRunId=sync_m... success=true scanned=42
[Side Panel]   DASHBOARD_DATA_RENDERED      syncRunId=sync_m... pendingCount=5
```

## Como Identificar a Fronteira da Falha

| Último log visto | Fronteira provável da falha |
|---|---|
| `DASHBOARD_SYNC_REQUEST_SENT` apenas | API não chegou ao Service Worker |
| `WORKER_SYNC_REQUEST_RECEIVED` mas sem `WHATSAPP_TAB_SELECTED` | Aba WhatsApp não encontrada ou injecção falhou |
| `WHATSAPP_TAB_SELECTED` mas sem `CONTENT_SCRIPT_SYNC_STARTED` | Bridge não entregou mensagem ao Injected |
| `CONTENT_SCRIPT_SYNC_STARTED` mas sem `CHAT_DISCOVERY_RESULT` | Store não pronta ou erro na leitura |
| `BATCH_SEND_START` mas sem `BRIDGE_BATCH_FORWARD` | `window.postMessage` não chegou ao Content Script |
| `BRIDGE_BATCH_FORWARD` mas sem `BATCH_RECEIVED` | `chrome.runtime.sendMessage` falhou |
| `BATCH_RECEIVED` mas sem `BATCH_PERSISTED` | Erro na fila de processamento ou `putLeads` |
| `BATCH_PERSISTED` final mas sem `SNAPSHOT_READ` | Cálculo de snapshot falhou silenciosamente |
| `SNAPSHOT_READ` com `pendingCount=0` mas dashboard mostra "parcial" | Dashboard não recebeu broadcast ou leu cache antigo |
| Todos os logs presentes mas dashboard travado | Problema de renderização no Side Panel |

## Limitações Conhecidas
- O `syncRunId` gerado no Dashboard é propagado via payload até o Injected Script, mas os batches usam `scanId` como identificador próprio. O log do Service Worker usa `payload.scanId` como `syncRunId` para manter correlação.
- O bridge (`content.js`) repassa `PRIVATE_CHATS_DETECTED` via `chrome.runtime.sendMessage` fire-and-forget. Não há confirmação de entrega nativa; o log `BRIDGE_BATCH_FORWARD` confirma apenas que o `sendMessage` foi chamado.
- O snapshot é gravado via `recordTelemetry` best-effort. Falhas são capturadas silenciosamente pelo código original; o log `SNAPSHOT_READ` só aparece se o cálculo for concluído.

## Versão
Manifesto mantido em `1.0.3`. Esta build é exclusivamente para diagnóstico.