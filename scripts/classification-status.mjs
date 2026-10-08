import { readdirSync, readFileSync } from 'node:fs';
import { CLASSIFICATION_OPTIONS } from '../src/lib/classification.ts';
const root = new URL('../src/data/', import.meta.url);
export function loadClassifications() {
  const load = name => JSON.parse(readFileSync(new URL(name, root), 'utf8'));
  const records = folder => Object.fromEntries(readdirSync(new URL(`${folder}/`, root)).filter(name => name.endsWith('.json')).sort().map(name => [name.slice(0, -5), load(`${folder}/${name}`)]));
  return { entities: records('entities'), links: load('incident-entities.json'), attacks: records('attack-classifications') };
}
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const https = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
function validateEntity(entity, fail) {
  if (!entity.name?.trim()) fail('missing entity name');
  for (const key of ['industry', 'manufacturingType', 'listingStatus']) {
    if (!Object.hasOwn(CLASSIFICATION_OPTIONS[key], entity[key])) fail(`invalid ${key}`);
  }
  if (!day(entity.listingAsOfDate)) fail('invalid listingAsOfDate');
  if (!Array.isArray(entity.sources)) { fail('missing entity sources'); return; }
  if (['industry', 'listingStatus'].some(key => !['unknown', 'notApplicable'].includes(entity[key])) && !entity.sources.length) fail('known entity classification requires evidence');
  for (const source of entity.sources) {
    if (!https(source.url) || !source.title?.trim() || !day(source.checkedDate)) fail('invalid entity evidence');
  }
  if (entity.listedParent && (!entity.listedParent.name?.trim() || !https(entity.listedParent.sourceUrl))) fail('invalid listed parent evidence');
  if (!['unknown', 'notApplicable'].includes(entity.manufacturingType) && entity.industry !== 'manufacturing') fail('manufacturing subtype requires manufacturing industry');
  if (entity.industry === 'manufacturing' && entity.manufacturingType === 'notApplicable') fail('manufacturer must have subtype or unknown');
}
function validateAttack(attack, fail) {
  for (const [axis, status] of [['attackKind', 'attackKindStatus'], ['initialAccess', 'initialAccessStatus']]) {
    if (!Object.hasOwn(CLASSIFICATION_OPTIONS[axis], attack[axis])) fail(`invalid ${axis}`);
    if (!Object.hasOwn(CLASSIFICATION_OPTIONS.confidence, attack[status])) fail(`invalid ${status}`);
    const special = ['unknown', 'notApplicable'].includes(attack[axis]);
    if (special ? attack[status] !== attack[axis] : !['confirmed', 'possible'].includes(attack[status])) fail(`inconsistent ${axis} confidence`);
  }
  if (!day(attack.reviewedDate) || !attack.note?.trim()) fail('missing attack review metadata');
  if (!Array.isArray(attack.sourceUrls) || !attack.sourceUrls.length || attack.sourceUrls.some(url => !https(url))) fail('attack classification requires HTTPS evidence');
}
export function validateClassifications({ entities, links, attacks }, incidents) {
  const errors = [];
  const ids = new Set(incidents.map(item => item.id));
  const referenced = new Set();
  for (const [id, entity] of Object.entries(entities)) validateEntity(entity, message => errors.push(`${id}: ${message}`));
  for (const id of ids) {
    const targets = links[id];
    if (!Array.isArray(targets) || !targets.length) errors.push(`${id}: missing target entities`);
    else for (const target of targets) {
      referenced.add(target);
      if (!Object.hasOwn(entities, target)) errors.push(`${id}: unknown entity ${target}`);
      if (new Set(targets).size !== targets.length) errors.push(`${id}: duplicate target entity`);
    }
    if (!Object.hasOwn(attacks, id)) errors.push(`${id}: missing attack classification`);
    else validateAttack(attacks[id], message => errors.push(`${id}: ${message}`));
  }
  for (const id of [...Object.keys(links), ...Object.keys(attacks)]) if (!ids.has(id)) errors.push(`${id}: orphan incident classification`);
  for (const id of Object.keys(entities)) if (!referenced.has(id)) errors.push(`${id}: orphan entity`);
  return errors;
}
