/**
 * Testes da lógica de classificação de conversas aguardando resposta.
 * Regra: lastIncomingAt > lastOutgoingAt => pendente.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

function classifyAwaitingReplies(leads) {
  let hasPrivateWithEvidence = false;
  const pending = leads.map((lead) => {
    const evidence = lead?.tipoEvidence || lead?.classifierEvidence || {};
    const incomingAt = evidence.lastIncomingAt || lead?.lastIncomingAt || null;
    const outgoingAt = evidence.lastOutgoingAt || lead?.lastOutgoingAt || null;
    const incomingMs = Date.parse(incomingAt || '');
    const outgoingMs = Date.parse(outgoingAt || '');
    const isPrivateWhatsAppLead = lead?.whatsappPrivate === true || lead?.source === 'whatsapp_private' || !!lead?.waChatId;
    if (!isPrivateWhatsAppLead || lead?.blacklisted || lead?.stage === 'blacklist') return null;
    if (Number.isFinite(incomingMs)) hasPrivateWithEvidence = true;
    if (!Number.isFinite(incomingMs) || (Number.isFinite(outgoingMs) && outgoingMs >= incomingMs)) return null;
    return { id: String(lead.id || ''), name: String(lead.name || ''), lastIncomingAt: incomingAt, lastOutgoingAt: outgoingAt };
  }).filter(Boolean).sort((a, b) => Date.parse(a.lastIncomingAt) - Date.parse(b.lastIncomingAt));
  return { data: pending, meta: { hasSyncedHistory: hasPrivateWithEvidence, totalPrivateLeads: leads.filter(l => l?.whatsappPrivate || l?.source === 'whatsapp_private' || !!l?.waChatId).length } };
}

test('Classificação de respostas pendentes', async (t) => {
  await t.test('mensagem recebida após a última resposta fica pendente', () => {
    const result = classifyAwaitingReplies([{ id: '1', whatsappPrivate: true, waChatId: '5511999999999@c.us', tipoEvidence: { lastIncomingAt: '2026-10-22T10:05:00Z', lastOutgoingAt: '2026-10-22T10:00:00Z' } }]);
    assert.equal(result.data.length, 1); assert.equal(result.data[0].id, '1'); assert.equal(result.meta.hasSyncedHistory, true);
  });
  await t.test('mensagem enviada após a recebida não fica pendente', () => {
    const result = classifyAwaitingReplies([{ id: '2', whatsappPrivate: true, waChatId: '5511888888888@c.us', tipoEvidence: { lastIncomingAt: '2026-10-22T10:00:00Z', lastOutgoingAt: '2026-10-22T10:05:00Z' } }]);
    assert.equal(result.data.length, 0); assert.equal(result.meta.hasSyncedHistory, true);
  });
  await t.test('conversa sem evidência suficiente permanece indeterminada', () => {
    const result = classifyAwaitingReplies([{ id: '3', whatsappPrivate: true, waChatId: '5511777777777@c.us', tipoEvidence: {} }]);
    assert.equal(result.data.length, 0); assert.equal(result.meta.hasSyncedHistory, false);
  });
  await t.test('histórico parcial sem saída não presume resposta', () => {
    const result = classifyAwaitingReplies([{ id: '4', whatsappPrivate: true, waChatId: '5511666666666@c.us', tipoEvidence: { lastIncomingAt: '2026-10-22T09:00:00Z', lastOutgoingAt: null } }]);
    assert.equal(result.data.length, 1);
  });
  await t.test('grupo não entra na lista de conversas privadas', () => {
    const result = classifyAwaitingReplies([{ id: '5', source: 'whatsapp_group', waChatId: '', tipoEvidence: { lastIncomingAt: '2026-10-22T10:05:00Z', lastOutgoingAt: '2026-10-22T10:00:00Z' } }]);
    assert.equal(result.data.length, 0); assert.equal(result.meta.totalPrivateLeads, 0);
  });
  await t.test('mensagens não lidas sem necessidade de resposta não ficam pendentes', () => {
    const result = classifyAwaitingReplies([{ id: '6', whatsappPrivate: true, waChatId: '5511555555555@c.us', whatsappUnreadCount: 5, tipoEvidence: { lastIncomingAt: '2026-10-22T10:00:00Z', lastOutgoingAt: '2026-10-22T10:05:00Z' } }]);
    assert.equal(result.data.length, 0);
  });
  await t.test('datas iguais não ficam pendentes', () => {
    const result = classifyAwaitingReplies([{ id: '7', whatsappPrivate: true, waChatId: '5511444444444@c.us', tipoEvidence: { lastIncomingAt: '2026-10-22T10:00:00Z', lastOutgoingAt: '2026-10-22T10:00:00Z' } }]);
    assert.equal(result.data.length, 0);
  });
  await t.test('datas ausentes ou inválidas não geram conclusão falsa', () => {
    const result = classifyAwaitingReplies([{ id: '8', whatsappPrivate: true, waChatId: '5511333333333@c.us', tipoEvidence: { lastIncomingAt: 'invalid-date', lastOutgoingAt: '' } }]);
    assert.equal(result.data.length, 0); assert.equal(result.meta.hasSyncedHistory, false);
  });
});
