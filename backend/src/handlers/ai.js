/**
 * AI Handlers - Configuração, status e monitoramento de IA
 * Suporta roteamento multi-modelo (DeepSeek + Claude)
 */
import { encryptSecret } from '../config/crypto.js';

export async function handleAi(type, client, tenantId, userId, payload, getKv, setKv) {
  switch (type) {
    case 'GET_AI_CONFIG': {
      const cfg = await getKv(client, tenantId, 'ai_config', {
        enabled: false,
        provider: 'deepseek',
        model: 'deepseek-v3.2',
        fallbackModel: 'claude-3.5-haiku',
        operationMode: 'observe_only',
        personaMode: 'commercial',
        chatMode: 'private_only',
        apiKeyConfigured: false,
        providerVerified: false,
        routingEnabled: true,
        cacheTtlDays: 7
      });
      return { success: true, data: { ...cfg, apiKey: '', encryptedApiKey: undefined } };
    }

    case 'SAVE_AI_CONFIG': {
      const current = await getKv(client, tenantId, 'ai_config', {});
      const encryptedKey = payload.apiKey ? encryptSecret(payload.apiKey) : current.encryptedApiKey || '';
      const merged = {
        ...current,
        ...payload,
        apiKey: '',
        encryptedApiKey: encryptedKey,
        apiKeyConfigured: !!encryptedKey,
        modelConfigured: !!(payload.model || current.model),
        providerVerified: !!(encryptedKey && (payload.model || current.model)),
        updatedAt: new Date().toISOString()
      };
      delete merged.encryptedApiKey; // Não retornar chave criptografada
      await setKv(client, tenantId, 'ai_config', { ...merged, encryptedApiKey: encryptedKey });
      return { success: true, data: merged };
    }

    case 'AI_SET_ENABLED': {
      const current = await getKv(client, tenantId, 'ai_config', {});
      current.enabled = !!payload.enabled;
      current.updatedAt = new Date().toISOString();
      await setKv(client, tenantId, 'ai_config', current);
      return { success: true, data: { enabled: current.enabled } };
    }

    case 'GET_AI_STATUS': {
      const cfg = await getKv(client, tenantId, 'ai_config', {});
      const events = await getKv(client, tenantId, 'ai_monitor_events', []);
      return {
        success: true,
        data: {
          enabled: !!cfg.enabled,
          runtimeActive: true,
          panelActive: true,
          whatsappConnected: true,
          provider: cfg.provider || 'deepseek',
          model: cfg.model || 'deepseek-v3.2',
          fallbackModel: cfg.fallbackModel || 'claude-3.5-haiku',
          operationMode: cfg.operationMode || 'observe_only',
          personaMode: cfg.personaMode || 'commercial',
          apiKeyConfigured: !!cfg.apiKeyConfigured,
          routingEnabled: cfg.routingEnabled !== false,
          monitoring: {
            retainedEvents: events.length,
            retentionLimit: 500,
            recentEvents: events.slice(0, 20)
          }
        }
      };
    }

    case 'GET_AI_COSTS': {
      const usage = await getKv(client, tenantId, 'ia_usage', { tokens: 0, cost: 0, messages: 0, byModel: {} });
      return { success: true, data: usage };
    }

    case 'AI_HEARTBEAT': {
      // Apenas registrar atividade, não precisa persistir
      return { success: true, data: { active: !!payload.active, timestamp: new Date().toISOString() } };
    }

    default:
      return null;
  }
}