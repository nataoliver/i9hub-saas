import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function loadMapsNameHelper() {
  const sandbox = { URL };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read('content/maps-name.js'), sandbox, { filename: 'content/maps-name.js' });
  return sandbox.i9MapsName;
}

function element(text, attrs = {}, parentElement = null) {
  return {
    innerText: text,
    textContent: text,
    parentElement,
    getAttribute(name) { return attrs[name] || ''; },
    querySelectorAll() { return []; },
  };
}

test('rejeita o título genérico Resultados e aceita nomes reais de estabelecimentos', () => {
  const names = loadMapsNameHelper();
  assert.equal(names.isValidName('Resultados'), false);
  assert.equal(names.isValidName('Search results'), false);
  assert.equal(names.isValidName('Resultados para dentista em São Paulo'), false);
  assert.equal(names.isValidName('Clínica Odontológica Sorriso'), true);
});

test('quando aria-label é genérico, usa o título do cartão individual do Maps', () => {
  const names = loadMapsNameHelper();
  const title = element('Clínica Odontológica Sorriso');
  const link = element('', { 'aria-label': 'Resultados', href: 'https://www.google.com/maps/place/Cl%C3%ADnica+Sorriso/@-23.5,-46.6,15z' });
  const card = {
    parentElement: null,
    querySelectorAll(selector) {
      if (selector === 'a[href*="/maps/place/"]') return [link];
      if (selector.includes('.qBF1Pd')) return [title];
      return [];
    },
  };
  link.parentElement = card;
  assert.equal(names.getResultName(link, {}, 'https://www.google.com/maps/'), 'Clínica Odontológica Sorriso');
});

test('retorna a origem e a confiabilidade do nome identificado no cartão', () => {
  const names = loadMapsNameHelper();
  const title = element('Clínica Odontológica Sorriso');
  const link = element('', { 'aria-label': 'Resultados', href: 'https://www.google.com/maps/place/Cl%C3%ADnica+Sorriso/@-23.5,-46.6,15z' });
  const card = { parentElement: null, querySelectorAll(selector) { if (selector === 'a[href*="/maps/place/"]') return [link]; if (selector.includes('.qBF1Pd')) return [title]; return []; } };
  link.parentElement = card;
  const identity = names.getResultIdentity(link, {}, 'https://www.google.com/maps/');
  assert.equal(identity.value, 'Clínica Odontológica Sorriso');
  assert.equal(identity.source, 'google_maps_card_title');
  assert.equal(identity.confidence, 0.96);
  const details = names.getDetailsIdentity({ querySelector(selector) { return selector === 'h1.DUwDvf' ? element('Clínica Sorriso') : null; } });
  assert.equal(details.source, 'google_maps_details');
  assert.equal(details.confidence, 0.99);
});

test('usa o nome do slug individual quando o cartão não expõe um título legível', () => {
  const names = loadMapsNameHelper();
  const link = element('', { 'aria-label': 'Resultados', href: 'https://www.google.com/maps/place/Cl%C3%ADnica+Sorriso/@-23.5,-46.6,15z' });
  assert.equal(names.getResultName(link, {}, 'https://www.google.com/maps/'), 'Clínica Sorriso');
});

test('o título de detalhes genérico não substitui o nome do estabelecimento', () => {
  const names = loadMapsNameHelper();
  const doc = { querySelector(selector) { return selector === 'h1.DUwDvf' ? element('Resultados') : null; } };
  assert.equal(names.getDetailsName(doc), '');
});

test('manifesto e injeção dinâmica carregam o helper antes do extrator', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const mapsScript = manifest.content_scripts.find((entry) => entry.matches?.some((match) => match.includes('maps')));
  assert.deepEqual(mapsScript.js, ['content/lead-identity.js', 'content/maps-name.js', 'content/maps-extractor.js']);
  const worker = read('background/service-worker.js');
  assert.match(worker, /files: \['content\/lead-identity\.js'\]/);
  assert.match(worker, /files: \['content\/maps-name\.js'\]/);
  assert.match(worker, /files: \['content\/maps-extractor\.js'\]/);
});

test('extrator usa o nome do cartão e ignora resultados sem nome real', () => {
  const extractor = read('content/maps-extractor.js');
  const mapsView = read('sidepanel/components/MapsView.js');
  assert.match(extractor, /getResultIdentity\(link, document, location\.href\)/);
  assert.match(extractor, /Nome do estabelecimento não identificado/);
  assert.match(extractor, /confirmedDetailsIdentity/);
  assert.match(mapsView, /Nenhum lead foi salvo porque os nomes reais dos estabelecimentos não foram identificados/);
});
