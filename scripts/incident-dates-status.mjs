const precisions = new Set(['day', 'month', 'year', 'period', 'approximate', 'unknown', 'notApplicable']);
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validateIncidentDates(incident, lastVerifiedDate) {
  const errors = [];
  if (incident.eventDates === undefined) return errors; // Legacy records remain readable, explicitly unreviewed.
  if (!incident.eventDates || typeof incident.eventDates !== 'object' || Array.isArray(incident.eventDates)) return ['invalid eventDates'];
  const urls = new Set(incident.sources.map(source => source.url));
  for (const [key, value] of Object.entries(incident.eventDates)) {
    const fail = message => errors.push(`${key}: ${message}`);
    if (!['attack', 'damageConfirmed'].includes(key)) fail('unknown date meaning');
    if (!value || typeof value !== 'object') { fail('invalid date evidence'); continue; }
    if (!precisions.has(value.precision)) fail('invalid precision');
    for (const field of ['label', 'note']) if (typeof value[field] !== 'string' || !value[field].trim()) fail(`missing ${field}`);
    if (!urls.has(value.sourceUrl)) fail('date source not in source list');
    if (!validDate(value.reviewedDate) || value.reviewedDate > lastVerifiedDate) fail('invalid reviewedDate');
    for (const field of ['startDate', 'endDate']) if (value[field] !== undefined && (!validDate(value[field]) || value[field] > lastVerifiedDate)) fail(`invalid ${field}`);
    if (value.endDate && (!value.startDate || value.endDate < value.startDate)) fail('invalid period order');
    if (value.precision === 'day' && (!value.startDate || value.endDate)) fail('day requires only startDate');
    if (value.precision === 'period' && !value.startDate) fail('period requires startDate');
    if (['unknown', 'notApplicable'].includes(value.precision) && (value.startDate || value.endDate)) fail('unknown or inapplicable date must not have bounds');
  }
  return errors;
}
