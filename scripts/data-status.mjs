import { loadVulnerabilities, validateVulnerabilities } from './vulnerability-status.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dataRoot = new URL('../src/data/', import.meta.url);
export function loadData() {
  const meta = JSON.parse(readFileSync(new URL('meta.json', dataRoot), 'utf8'));
  const incidents = readdirSync(new URL('incidents/', dataRoot)).filter(file => file.endsWith('.json')).sort()
    .map(file => JSON.parse(readFileSync(new URL(`incidents/${file}`, dataRoot), 'utf8')));
  return { meta, incidents };
}
const impactTypes = new Set(['leak', 'outage', 'unauthorizedAccess']);
const statuses = new Set(['confirmed', 'possible', 'investigating', 'noConfirmedLeak']);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value;
export function validateData({ meta, incidents }) {
  const errors = [];
  const ids = new Set();
  for (const incident of incidents) {
    const fail = message => errors.push(`${incident.id}: ${message}`);
    if (!incident.id || ids.has(incident.id)) fail('missing or duplicate id');
    ids.add(incident.id);
    for (const field of ['company', 'title', 'summary', 'geography']) if (!incident[field]?.trim()) fail(`missing ${field}`);
    for (const field of ['announcementDate', 'updatedDate', 'lastVerifiedDate', 'statusAsOfDate']) {
      if (!validDate(incident[field])) fail(`invalid ${field}`);
      if (incident[field] > meta.lastVerifiedDate) fail(`future ${field}`);
    }
    if (incident.occurredDate !== null && !validDate(incident.occurredDate)) fail('invalid occurredDate');
    if (incident.updatedDate < incident.announcementDate) fail('update before disclosure');
    if (incident.updatedDate < meta.windowStart || incident.announcementDate > meta.windowEnd) fail('outside coverage window');
    if (incident.announcementDate < `${meta.windowStart.slice(0, 4)}-01-01`) fail('announcement before timeline start');
    if (!statuses.has(incident.disclosureStatus)) fail('unknown disclosure status');
    if (!incident.impactTypes.length || incident.impactTypes.some(type => !impactTypes.has(type))) fail('invalid impact');
    if (new Set(incident.impactTypes).size !== incident.impactTypes.length) fail('duplicate impact');
    if (!incident.sources.length) fail('missing primary source');
    const urls = new Set();
    for (const source of incident.sources) {
      try { if (new URL(source.url).protocol !== 'https:') fail('non-HTTPS source'); } catch { fail('invalid source URL'); }
      if (!source.title || !validDate(source.publishedDate)) fail('invalid source metadata');
      if (source.publishedDate > meta.lastVerifiedDate) fail('future source');
      urls.add(source.url);
    }
    for (const update of incident.timeline) {
      if (!validDate(update.date) || update.date > meta.lastVerifiedDate) fail('invalid timeline date');
      if (!urls.has(update.sourceUrl)) fail('timeline source not in source list');
      if (!['occurrence', 'disclosure', 'update'].includes(update.kind)) fail('invalid timeline kind');
    }
    for (const count of incident.counts) if (!Number.isFinite(count.value) || count.value < 0 || !count.unit || !count.status || !count.label) fail('invalid scale count');
  }
  if (meta.incidentCount !== incidents.length) errors.push('meta incidentCount does not match');
  return errors;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const data = loadData();
  const vulnerabilities = loadVulnerabilities();
  const errors = [...validateData(data), ...validateVulnerabilities(vulnerabilities)];
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log(JSON.stringify({ ok: true, vulnerabilities: vulnerabilities.length, incidents: data.incidents.length, companies: new Set(data.incidents.map(i => i.company)).size,
    sources: data.incidents.reduce((sum, i) => sum + i.sources.length, 0), verified: data.meta.lastVerifiedDate }, null, 2));
}
