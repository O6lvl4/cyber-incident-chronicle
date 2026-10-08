import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = text => createHash('sha256').update(text).digest('hex');
export function buildBrowseAssets(records, sourceHash) {
  const groups = new Map();
  const summaries = records.map(item => {
    const shard = digest(item.id).slice(0, 2);
    if (!groups.has(shard)) groups.set(shard, []);
    groups.get(shard).push(item);
    const ranges = item.affected.flatMap(pkg => pkg.ranges);
    const fixStatus = ranges.every(range => range.fixed !== null) ? 'fixed' : ranges.some(range => range.fixed !== null) ? 'partial' : 'unknown';
    return { id: item.id, aliases: item.aliases, title: item.title, ...(item.summary !== item.title ? { summary: item.summary } : {}),
      publishedAt: item.publishedAt, withdrawnAt: item.withdrawnAt, affected: item.affected.map(({ ecosystem, packageName }) => ({ ecosystem, packageName })),
      severity: { label: item.severity.label }, fixStatus, shard };
  });
  const files = new Map(), shards = {};
  for (const [key, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const body = `${JSON.stringify(group)}\n`;
    files.set(`${key}.json`, body);
    shards[key] = { file: `${key}.json`, sha256: digest(body), records: group.length };
  }
  files.set('index.json', `${JSON.stringify({ sourceSha256: sourceHash, records: summaries, shards })}\n`);
  return files;
}
export function prepareAdvisoryAssets({ check = false } = {}) {
  const source = readFileSync(resolve(root, 'src/data/vulnerability-imported.json'));
  const coverage = JSON.parse(readFileSync(resolve(root, 'src/data/vulnerability-coverage.json'), 'utf8'));
  const sourceHash = digest(source);
  if (sourceHash !== coverage.artifacts.data.sha256) throw new Error('Source corpus hash does not match the pinned coverage manifest');
  const records = JSON.parse(source);
  if (records.length !== coverage.counts.includedRecords) throw new Error('Source corpus count does not match coverage');
  const files = buildBrowseAssets(records, sourceHash);
  const output = resolve(root, 'public/advisories', sourceHash);
  for (const [name, body] of files) {
    const target = resolve(output, name);
    if (check) {
      if (!existsSync(target) || readFileSync(target, 'utf8') !== body) throw new Error(`Missing or stale advisory asset: ${name}`);
    } else { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, body); }
  }
  if (readdirSync(output).length !== files.size) throw new Error('Unexpected advisory assets in the source-hash directory');
  if (!check) {
    const base = dirname(output);
    for (const name of readdirSync(base)) if (/^[a-f0-9]{64}$/.test(name) && name !== sourceHash) rmSync(resolve(base, name), { recursive: true });
  }
  const indexBytes = Buffer.byteLength(files.get('index.json'));
  const maxShardBytes = Math.max(...[...files].filter(([name]) => name !== 'index.json').map(([, body]) => Buffer.byteLength(body)));
  console.log(`${check ? 'Verified' : 'Prepared'} ${records.length} advisory browse records, ${files.size - 1} detail shards; index ${indexBytes} bytes; largest shard ${maxShardBytes} bytes`);
  return { records: records.length, indexBytes, maxShardBytes };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepareAdvisoryAssets({ check: process.argv.includes('--check') });
