#!/usr/bin/env node
/** Materialize pinned public JSON data without executing anything from the source repository. */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadCoverageInputs, validateCoverage } from './vulnerability-coverage.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = 'src/data/vulnerability-coverage.json';
const manifest = JSON.parse(readFileSync(resolve(root, manifestPath), 'utf8'));
const argv = process.argv.slice(2);
let source = process.env.ADVISORY_SOURCE; let force = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--source' && argv[i + 1]) source = argv[++i];
  else if (argv[i] === '--force') force = true;
  else throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
}
if (!force) {
  try {
    const inputs = loadCoverageInputs();
    if (!validateCoverage(inputs).length) {
      console.log(`Verified cached advisory artifacts: ${manifest.counts.includedRecords} records, ${manifest.source.snapshotSha}`);
      process.exit(0);
    }
  } catch { /* Missing/stale derived assets must be regenerated and checked below. */ }
}
if (manifest.source.repository !== 'https://github.com/github/advisory-database' || !/^[a-f0-9]{40}$/.test(manifest.source.snapshotSha)) throw new Error('Only the pinned official public advisory repository is permitted');
const suppliedSource = Boolean(source);
source = resolve(source ?? resolve(root, '.cache', 'advisory-database', manifest.source.snapshotSha));
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status ?? 'unknown'}`);
}
if (!existsSync(resolve(source, '.git'))) {
  if (suppliedSource) throw new Error('The supplied advisory source is not a git checkout');
  mkdirSync(source, { recursive: true });
  run('git', ['init', source]);
  run('git', ['-C', source, 'remote', 'add', 'origin', `${manifest.source.repository}.git`]);
  run('git', ['-C', source, 'sparse-checkout', 'init', '--cone']);
  run('git', ['-C', source, 'sparse-checkout', 'set', 'advisories/github-reviewed']);
}
const present = spawnSync('git', ['-C', source, 'cat-file', '-e', `${manifest.source.snapshotSha}^{commit}`], { stdio: 'ignore' });
if (present.status !== 0) run('git', ['-C', source, 'fetch', '--depth=1', `${manifest.source.repository}.git`, manifest.source.snapshotSha]);
run('git', ['-C', source, 'checkout', '--detach', manifest.source.snapshotSha]);
run(process.execPath, ['scripts/import-reviewed-advisories.mjs', '--source', source, '--snapshot', manifest.source.snapshotSha, '--verified-at', manifest.verifiedAt, '--from', manifest.window.publishedFrom, '--through', manifest.window.publishedThrough, '--verify-against', manifestPath]);
const errors = validateCoverage(loadCoverageInputs());
if (errors.length) throw new Error(errors.join('\n'));
console.log(`Pinned complete advisory data verified: ${manifest.counts.coveredEligibleAdvisories}/${manifest.counts.eligibleAdvisories} source advisories`);
