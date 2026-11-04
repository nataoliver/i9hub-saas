/**
 * Versão enviada às APIs do painel/licenciamento.
 *
 * `version_name` é apenas um rótulo de exibição (ex.: "1.0.4E") e pode conter
 * letras; o backend exige SemVer. Preferimos o rótulo somente quando ele já é
 * SemVer válido. Caso contrário, normalizamos a versão técnica do Chrome para
 * major.minor.patch (ex.: 1.0.4.6 -> 1.0.4).
 */
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function getApiExtensionVersion(manifest = chrome.runtime.getManifest()) {
  const displayVersion = typeof manifest?.version_name === 'string' ? manifest.version_name.trim() : '';
  if (SEMVER_RE.test(displayVersion)) return displayVersion;

  const technicalVersion = typeof manifest?.version === 'string' ? manifest.version.trim() : '';
  const core = technicalVersion.split('.').slice(0, 3);
  if (core.length === 3 && core.every((part) => /^\d+$/.test(part))) {
    return core.map((part) => String(Number(part))).join('.');
  }
  return '0.0.0';
}
