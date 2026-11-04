/**
 * CRM Handlers - Migrado do service-worker da extensão para SaaS
 * Todas as operações respeitam RLS via SET LOCAL app.current_tenant
 */
import { scoreLead } from '../lib/lead-scoring.js';
import { normalizeType } from '../lib/classifier.js';

export async function handleCrm(type, client, tenantId, userId, payload) {
  switch (type) {
    case 'GET_LEADS': {
      const { rows } = await client.query(
        `SELECT id, name, phone, email, stage, tipo, lead_score, blacklisted, data, created_at, updated_at
         FROM leads WHERE tenant_id = $1 ORDER BY updated_at DESC`,
        [tenantId]
      );
      return { success: true, data: rows };
    }

    case 'SAVE_LEAD': {
      const lead = payload;
      const id = lead.id || `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const tipo = normalizeType(lead.tipo || lead.category || 'a_classificar');
      const stage = lead.stage || 'novo';
      const leadScore = Number(lead.lead_score) || 0;
      const data = lead.data || {};

      await client.query(
        `INSERT INTO leads (id, tenant_id, seller_id, name, phone, email, stage, tipo, lead_score, blacklisted, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
         ON CONFLICT (tenant_id, id)
         DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email,
           stage = EXCLUDED.stage, tipo = EXCLUDED.tipo, lead_score = EXCLUDED.lead_score,
           blacklisted = EXCLUDED.blacklisted, data = EXCLUDED.data, updated_at = NOW()`,
        [id, tenantId, userId, lead.name || '', lead.phone || '', lead.email || '', stage, tipo, leadScore, !!lead.blacklisted, JSON.stringify(data)]
      );
      return { success: true, data: { id, name: lead.name, phone: lead.phone, stage, tipo, lead_score: leadScore } };
    }

    case 'DELETE_LEAD': {
      const { id } = payload;
      if (!id) return { success: false, error: 'ID do lead é obrigatório.' };
      await client.query(`DELETE FROM leads WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
      return { success: true, data: { deleted: id } };
    }

    case 'BULK_DELETE_LEADS': {
      const ids = Array.isArray(payload.ids) ? payload.ids : [];
      if (!ids.length) return { success: false, error: 'Nenhum ID fornecido.' };
      await client.query(`DELETE FROM leads WHERE tenant_id = $1 AND id = ANY($2)`, [tenantId, ids]);
      return { success: true, data: { deleted: ids.length } };
    }

    case 'UPDATE_LEAD_STAGE': {
      const { id, stage } = payload;
      if (!id || !stage) return { success: false, error: 'ID e estágio são obrigatórios.' };
      await client.query(
        `UPDATE leads SET stage = $3, updated_at = NOW() WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id, stage]
      );
      return { success: true, data: { id, stage } };
    }

    case 'BLACKLIST_ADD': {
      const entries = Array.isArray(payload.entries) ? payload.entries : [];
      const added = [];
      for (const entry of entries) {
        const phone = String(entry.phone || '').replace(/\D/g, '');
        if (!phone) continue;
        await client.query(
          `UPDATE leads SET blacklisted = true, stage = 'blacklist', updated_at = NOW()
           WHERE tenant_id = $1 AND REPLACE(phone, ' ', '') = $2`,
          [tenantId, phone]
        );
        // Adicionar ao KV store blacklist
        const { rows } = await client.query(
          `SELECT store_value FROM tenant_kv_store WHERE tenant_id = $1 AND store_key = 'blacklist'`,
          [tenantId]
        );
        const bl = rows[0]?.store_value || [];
        if (!bl.some(b => String(b.phone || '').replace(/\D/g, '') === phone)) {
          bl.push({ phone, name: entry.name || '', addedAt: new Date().toISOString(), source: payload.source || 'manual' });
          await client.query(
            `INSERT INTO tenant_kv_store (tenant_id, store_key, store_value, updated_at)
             VALUES ($1, 'blacklist', $2::jsonb, NOW())
             ON CONFLICT (tenant_id, store_key) DO UPDATE SET store_value = EXCLUDED.store_value, updated_at = NOW()`,
            [tenantId, JSON.stringify(bl)]
          );
        }
        added.push(phone);
      }
      return { success: true, data: { added, count: added.length } };
    }

    case 'BLACKLIST_REMOVE': {
      const phone = String(payload.phone || '').replace(/\D/g, '');
      if (!phone) return { success: false, error: 'Telefone obrigatório.' };
      await client.query(
        `UPDATE leads SET blacklisted = false, updated_at = NOW()
         WHERE tenant_id = $1 AND REPLACE(phone, ' ', '') = $2`,
        [tenantId, phone]
      );
      // Remover do KV blacklist
      const { rows } = await client.query(
        `SELECT store_value FROM tenant_kv_store WHERE tenant_id = $1 AND store_key = 'blacklist'`,
        [tenantId]
      );
      const bl = (rows[0]?.store_value || []).filter(b => String(b.phone || '').replace(/\D/g, '') !== phone);
      await client.query(
        `INSERT INTO tenant_kv_store (tenant_id, store_key, store_value, updated_at)
         VALUES ($1, 'blacklist', $2::jsonb, NOW())
         ON CONFLICT (tenant_id, store_key) DO UPDATE SET store_value = EXCLUDED.store_value, updated_at = NOW()`,
        [tenantId, JSON.stringify(bl)]
      );
      return { success: true, data: { removed: phone } };
    }

    case 'GET_BLACKLIST': {
      const { rows } = await client.query(
        `SELECT store_value FROM tenant_kv_store WHERE tenant_id = $1 AND store_key = 'blacklist'`,
        [tenantId]
      );
      return { success: true, data: rows[0]?.store_value || [] };
    }

    case 'GET_STAGES': {
      const { rows } = await client.query(
        `SELECT store_value FROM tenant_kv_store WHERE tenant_id = $1 AND store_key = 'crm_stages'`,
        [tenantId]
      );
      return { success: true, data: rows[0]?.store_value || null };
    }

    case 'SAVE_STAGES': {
      const stages = payload.stages || payload;
      await client.query(
        `INSERT INTO tenant_kv_store (tenant_id, store_key, store_value, updated_at)
         VALUES ($1, 'crm_stages', $2::jsonb, NOW())
         ON CONFLICT (tenant_id, store_key) DO UPDATE SET store_value = EXCLUDED.store_value, updated_at = NOW()`,
        [tenantId, JSON.stringify(stages)]
      );
      return { success: true, data: stages };
    }

    case 'GET_NICHE_TAXONOMY': {
      const { rows } = await client.query(
        `SELECT store_value FROM tenant_kv_store WHERE tenant_id = $1 AND store_key = 'niche_taxonomy'`,
        [tenantId]
      );
      return { success: true, data: rows[0]?.store_value || { nodes: [] } };
    }

    case 'SAVE_NICHE_TAXONOMY': {
      const taxonomy = payload.taxonomy || payload;
      await client.query(
        `INSERT INTO tenant_kv_store (tenant_id, store_key, store_value, updated_at)
         VALUES ($1, 'niche_taxonomy', $2::jsonb, NOW())
         ON CONFLICT (tenant_id, store_key) DO UPDATE SET store_value = EXCLUDED.store_value, updated_at = NOW()`,
        [tenantId, JSON.stringify(taxonomy)]
      );
      return { success: true, data: taxonomy };
    }

    default:
      return null; // Handler não encontrado neste módulo
  }
}