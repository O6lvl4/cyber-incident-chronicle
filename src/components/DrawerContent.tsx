import { useMemo } from 'react';
import { INCIDENTS } from '../data';
import type { TimelineEvent } from '../types';
import type { AppState } from '../hooks/useAppState';
import type { DuckDBHandle } from '../hooks/useDuckDB';
import IncidentDetail from './panel/IncidentDetail';
import SqlConsole from './panel/SqlConsole';
import About from './panel/About';
interface Props { state: AppState; db: DuckDBHandle; eventsById: Map<string, TimelineEvent>; onSelect: (id: string) => void }
export default function DrawerContent({ state: st, db, eventsById, onSelect }: Props) {
  const knownIds = useMemo(() => new Set([...eventsById.keys(), ...INCIDENTS.map(item => item.id)]), [eventsById]);
  if (st.drawerMode === 'sql') return <SqlConsole db={db} knownIds={knownIds} onSelect={onSelect}/>;
  if (st.drawerMode === 'about') return <About/>;
  const ev = st.selectedId ? eventsById.get(st.selectedId) : undefined;
  return ev ? <IncidentDetail ev={ev}/> : null;
}
