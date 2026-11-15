import { mergeIncidentEntities } from '../lib/incidentEntityLinks.ts';
import part0 from './incident-entities/0-9.json' with { type: 'json' };
import part1 from './incident-entities/a-d.json' with { type: 'json' };
import part2 from './incident-entities/e-h.json' with { type: 'json' };
import part3 from './incident-entities/i-l.json' with { type: 'json' };
import part4 from './incident-entities/m-p.json' with { type: 'json' };
import part5 from './incident-entities/q-t.json' with { type: 'json' };
import part6 from './incident-entities/u-z.json' with { type: 'json' };

// Alphabetical shards keep the mapping readable without silently overwriting duplicate IDs.
export const INCIDENT_ENTITIES = mergeIncidentEntities([
  part0,
  part1,
  part2,
  part3,
  part4,
  part5,
  part6,
]);
