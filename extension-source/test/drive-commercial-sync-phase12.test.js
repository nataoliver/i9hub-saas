import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mergeCommercialManagementConfig,
  mergeCommercialPerformanceConfig,
} from '../background/drive-sync.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Fase 12 mescla vendedores por ID, mantém a versão mais recente e une histórico de equipe', () => {
  const local = {
    updatedAt: '2026-10-30T10:00:00.000Z',
    sellers: [{
      id: 'seller-1', name: 'Ana', teamId: 'team-old', active: true,
      updatedAt: '2026-10-30T09:00:00.000Z',
      teamHistory: [{ teamId: 'team-old', assignedAt: '2026-01-01T00:00:00.000Z', unassignedAt: '2026-06-01T00:00:00.000Z' }],
    }],
    teams: [{ id: 'team-local', name: 'Equipe Local', active: true, updatedAt: '2026-10-30T09:00:00.000Z' }],
  };
  const remote = {
    updatedAt: '2026-10-30T11:00:00.000Z',
    sellers: [{
      id: 'seller-1', name: 'Ana', teamId: 'team-new', active: false,
      updatedAt: '2026-10-30T10:30:00.000Z',
      teamHistory: [{ teamId: 'team-new', assignedAt: '2026-06-01T00:00:00.000Z', unassignedAt: null }],
    }],
    teams: [{ id: 'team-remote', name: 'Equipe Remota', active: true, updatedAt: '2026-10-30T10:30:00.000Z' }],
  };
  const merged = mergeCommercialManagementConfig(local, remote);
  const seller = merged.sellers.find((item) => item.id === 'seller-1');
  assert.equal(seller.teamId, 'team-new');
  assert.equal(seller.active, false, 'desativação mais recente deve prevalecer');
  assert.equal(seller.teamHistory.length, 2, 'histórico dos dois dispositivos deve ser preservado');
  assert.deepEqual(new Set(merged.teams.map((item) => item.id)), new Set(['team-local', 'team-remote']));
});

test('Fase 12 preserva produtos e metas e respeita desativação/soft delete mais recente', () => {
  const local = {
    updatedAt: '2026-10-30T08:00:00.000Z',
    products: [{ id: 'product-1', name: 'Plano A', commissionRate: 5, active: true, updatedAt: '2026-10-30T08:00:00.000Z' }],
    goals: [{ id: 'goal-1', month: '2026-10', targetType: 'seller', targetId: 'seller-1', revenueTarget: 10000, active: true, updatedAt: '2026-10-30T08:00:00.000Z' }],
  };
  const remote = {
    updatedAt: '2026-10-30T09:00:00.000Z',
    products: [{ id: 'product-1', name: 'Plano A', commissionRate: 7, active: true, updatedAt: '2026-10-30T08:45:00.000Z' }],
    goals: [{ id: 'goal-1', month: '2026-10', targetType: 'seller', targetId: 'seller-1', revenueTarget: 10000, active: false, deletedAt: '2026-10-30T08:50:00.000Z', updatedAt: '2026-10-30T08:50:00.000Z' }],
  };
  const merged = mergeCommercialManagementConfig(local, remote);
  assert.equal(merged.products[0].commissionRate, 7);
  assert.equal(merged.goals[0].active, false);
  assert.equal(merged.goals[0].deletedAt, '2026-10-30T08:50:00.000Z');
});

test('Fase 12 mescla probabilidades comerciais pela configuração mais recente e valida valores', () => {
  const local = { updatedAt: '2026-10-30T10:00:00.000Z', stageProbabilities: { novo: 10, proposta: 40 } };
  const remote = { updatedAt: '2026-10-30T11:00:00.000Z', stageProbabilities: { novo: 20, proposta: 55, invalida: 120 } };
  const merged = mergeCommercialPerformanceConfig(local, remote);
  assert.deepEqual(merged.stageProbabilities, { novo: 20, proposta: 55 });
  const restoredToEmptyDevice = mergeCommercialPerformanceConfig({}, remote);
  assert.deepEqual(restoredToEmptyDevice.stageProbabilities, { novo: 20, proposta: 55 });
});

test('Fase 12 usa arquivo comercial separado para preservar compatibilidade com versões anteriores', () => {
  const drive = read('background/drive-sync.js');
  assert.match(drive, /MANAGEMENT_FILE_NAME = 'i9leads-commercial-backup\.json'/);
  assert.match(drive, /app: 'i9leads-flow-commercial', schema: 1/);
  assert.match(drive, /findManagementFile\(/);
  assert.match(drive, /syncCommercialData\(folderId/);
  assert.match(drive, /changes\[COMMERCIAL_MANAGEMENT_CONFIG_KEY\]/);
  assert.match(drive, /changes\[COMMERCIAL_PERFORMANCE_CONFIG_KEY\]/);
  assert.match(drive, /MANAGEMENT_CLEAR/);
});

test('interface do Google Drive informa os cadastros comerciais sincronizados', () => {
  const ui = read('sidepanel/components/SettingsView.js');
  assert.match(ui, /vendedores/);
  assert.match(ui, /equipes/);
  assert.match(ui, /produtos\/serviços/);
  assert.match(ui, /probabilidades comerciais/);
});
