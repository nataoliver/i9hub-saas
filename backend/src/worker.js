// backend/src/worker.js
// Worker BullMQ para processamento assíncrono de campanhas e webhooks
import 'dotenv/config';
import { Worker } from 'bullmq';
import { pool } from './config/db.js';
import { decryptSecret } from './config/crypto.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0';
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 5);

// Parse Redis URL into connection object for BullMQ
function parseRedisUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || 'localhost',
      port: Number(u.port) || 6379,
      password: u.password || undefined,
      db: Number(u.pathname?.replace('/', '') || 0),
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const connection = parseRedisUrl(REDIS_URL);

/**
 * Processa envio de mensagens de campanha via WhatsApp Gateway
 */
async function processCampaignMessage(job) {
  const { tenantId, campaignId, leadId, phone, message, instanceId } = job.data;
  console.log(`[Worker] Campaign message: tenant=${tenantId} campaign=${campaignId} lead=${leadId} phone=${phone}`);

  try {
    // Buscar configuração da instância WA do tenant
    const { rows } = await pool.query(
      `SELECT wa_gateway_url, wa_api_key_encrypted FROM tenant_settings WHERE tenant_id = $1`,
      [tenantId]
    );
    const settings = rows[0];
    if (!settings) throw new Error('Tenant settings not found');

    const apiKey = decryptSecret(settings.wa_api_key_encrypted);
    const gatewayUrl = settings.wa_gateway_url || process.env.WA_GATEWAY_URL;

    // Enviar via Evolution API
    const res = await fetch(`${gatewayUrl}/message/sendText/${instanceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey || process.env.WA_GATEWAY_API_KEY,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`WA Gateway error ${res.status}: ${errBody}`);
    }

    const result = await res.json();

    // Registrar envio no banco
    await pool.query(
      `INSERT INTO campaign_messages (tenant_id, campaign_id, lead_id, phone, status, sent_at, gateway_message_id)
       VALUES ($1, $2, $3, $4, 'sent', NOW(), $5)`,
      [tenantId, campaignId, leadId, phone, result?.id || null]
    );

    console.log(`[Worker] Message sent successfully: ${phone}`);
    return { success: true, gatewayId: result?.id };
  } catch (err) {
    console.error(`[Worker] Failed to send message to ${phone}:`, err.message);

    // Registrar falha
    await pool.query(
      `INSERT INTO campaign_messages (tenant_id, campaign_id, lead_id, phone, status, error, failed_at)
       VALUES ($1, $2, $3, $4, 'failed', $5, NOW())
       ON CONFLICT DO NOTHING`,
      [tenantId, campaignId, leadId, phone, err.message]
    ).catch(() => {});

    throw err; // Re-throw para BullMQ retry
  }
}

/**
 * Processa webhook recebido do WhatsApp Gateway
 */
async function processWebhook(job) {
  const { event, instance, data, receivedAt } = job.data;
  console.log(`[Worker] Webhook: ${event} from ${instance}`);

  try {
    switch (event) {
      case 'messages.upsert': {
        const msg = data?.message;
        if (!msg) break;
        const phone = msg.key?.remoteJid?.replace(/@.*$/, '') || '';
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const direction = msg.key?.fromMe ? 'out' : 'in';

        await pool.query(
          `INSERT INTO whatsapp_messages (tenant_id, instance_name, phone, direction, content, gateway_message_id, received_at)
           VALUES ((SELECT tenant_id FROM wa_instances WHERE name = $1 LIMIT 1), $1, $2, $3, $4, $5, $6)`,
          [instance, phone, direction, text, msg.key?.id || null, receivedAt || new Date()]
        );
        break;
      }

      case 'connection.update': {
        const state = data?.state || 'unknown';
        await pool.query(
          `UPDATE wa_instances SET connection_state = $1, updated_at = NOW() WHERE name = $2`,
          [state, instance]
        );
        console.log(`[Worker] Instance ${instance} state: ${state}`);
        break;
      }

      default:
        console.log(`[Worker] Unhandled webhook event: ${event}`);
    }
  } catch (err) {
    console.error(`[Worker] Webhook processing error (${event}):`, err.message);
    throw err;
  }
}

// ─── Workers ───

const campaignWorker = new Worker('campaign-messages', processCampaignMessage, {
  connection,
  concurrency: CONCURRENCY,
  limiter: { max: 30, duration: 1000 }, // Rate limit: 30 msg/s
});

const webhookWorker = new Worker('whatsapp-webhooks', processWebhook, {
  connection,
  concurrency: CONCURRENCY,
});

// Event listeners
for (const [name, worker] of [['campaign', campaignWorker], ['webhook', webhookWorker]]) {
  worker.on('completed', (job) => {
    console.log(`[Worker:${name}] Job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[Worker:${name}] Job ${job?.id} failed:`, err.message);
  });
  worker.on('error', (err) => {
    console.error(`[Worker:${name}] Worker error:`, err.message);
  });
}

console.log(`[i9Hub Worker] Started with concurrency=${CONCURRENCY}, Redis=${REDIS_URL}`);
console.log('[i9Hub Worker] Queues: campaign-messages, whatsapp-webhooks');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down...');
  await campaignWorker.close();
  await webhookWorker.close();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] Interrupted...');
  await campaignWorker.close();
  await webhookWorker.close();
  await pool.end();
  process.exit(0);
});