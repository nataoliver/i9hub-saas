/**
 * Campaign Handlers - Migrado do service-worker da extensão para SaaS
 */
export async function handleCampaigns(type, client, tenantId, userId, payload) {
  switch (type) {
    case 'GET_CAMPAIGNS': {
      const { rows } = await client.query(
        `SELECT id, name, status, data, created_at, updated_at FROM campaigns WHERE tenant_id = $1 ORDER BY created_at DESC`,
        [tenantId]
      );
      return { success: true, data: rows.map(r => ({ id: r.id, name: r.name, status: r.status, ...r.data, created_at: r.created_at, updated_at: r.updated_at })) };
    }

    case 'SAVE_CAMPAIGN': {
      const camp = payload;
      const id = camp.id || `camp_${Date.now().toString(36)}`;
      const data = {
        template: camp.template || '',
        contacts: (camp.contacts || []).map(c => ({ ...c, status: c.status || 'pending' })),
        total: (camp.contacts || []).length,
        sent: camp.sent || 0,
        failed: camp.failed || 0,
        skipped: camp.skipped || 0,
        spintax: camp.spintax || false,
        delays: camp.delays || { min: 30, max: 90 },
      };
      await client.query(
        `INSERT INTO campaigns (id, tenant_id, created_by, name, status, data)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (tenant_id, id)
         DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, data = EXCLUDED.data, updated_at = NOW()`,
        [id, tenantId, userId, camp.name || 'Sem nome', camp.status || 'draft', JSON.stringify(data)]
      );
      return { success: true, data: { id, name: camp.name, status: camp.status || 'draft' } };
    }

    case 'DELETE_CAMPAIGN': {
      const { id } = payload;
      if (!id) return { success: false, error: 'ID da campanha é obrigatório.' };
      await client.query(`DELETE FROM campaigns WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
      return { success: true, data: { deleted: id } };
    }

    case 'START_CAMPAIGN': {
      const { id } = payload;
      if (!id) return { success: false, error: 'ID da campanha é obrigatório.' };
      await client.query(
        `UPDATE campaigns SET status = 'running', updated_at = NOW() WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id]
      );
      // TODO: disparar worker de envio via BullMQ/Redis
      return { success: true, data: { id, status: 'running' } };
    }

    case 'PAUSE_CAMPAIGN': {
      const { id } = payload;
      if (!id) return { success: false, error: 'ID da campanha é obrigatório.' };
      await client.query(
        `UPDATE campaigns SET status = 'paused', updated_at = NOW() WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id]
      );
      return { success: true, data: { id, status: 'paused' } };
    }

    default:
      return null;
  }
}