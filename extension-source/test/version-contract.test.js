import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getApiExtensionVersion } from '../lib/version.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('rótulo comercial 1.0.8 não é enviado ao backend como extVersion', () => {
  assert.equal(getApiExtensionVersion({ version: '1.0.8.0', version_name: '1.0.8' }), '1.0.8');
  assert.equal(getApiExtensionVersion({ version: '1.0.8.0', version_name: '1.0.8E' }), '1.0.8');
});

test('rótulo já SemVer válido é preservado', () => {
  assert.equal(getApiExtensionVersion({ version: '1.0.8.0', version_name: '1.0.8-beta.1' }), '1.0.8-beta.1');
});

test('versão técnica com três componentes é preservada como SemVer', () => {
  assert.equal(getApiExtensionVersion({ version: '1.0.8', version_name: 'build comercial' }), '1.0.8');
});

test('ativação e metadados usam a versão normalizada, não o rótulo de exibição', () => {
  const worker = fs.readFileSync(path.join(root, 'background/service-worker.js'), 'utf8');
  const driveSync = fs.readFileSync(path.join(root, 'background/drive-sync.js'), 'utf8');
  assert.match(worker, /export const EXT_VERSION = getApiExtensionVersion\(\)/);
  assert.match(worker, /extVersion: EXT_VERSION/);
  assert.match(driveSync, /extVersion: getApiExtensionVersion\(\)/);
  assert.doesNotMatch(worker, /version_name \|\| chrome\.runtime\.getManifest\(\)\.version/);
});
