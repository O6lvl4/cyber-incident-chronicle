import { memo } from 'react';
import type { Link } from '../types';
import type { LevelLayout, Chip } from '../engine/layout';
import { chipCenter, type Pt } from '../engine/hit';
import type { Row } from '../engine/tileLayer';
import type { Theme } from '../engine/protocol';
import { RADIUS } from '../engine/levels';

interface Props {
  layout: LevelLayout;
  rows: Row[];
  links: Link[];
  selectedId: string | null;
  matches: Set<string>;
  theme: Theme;
}

function linkPath(a: Pt, b: Pt): string {
  if (Math.abs(a.y - b.y) < 1) return `M ${a.x} ${a.y} C ${a.x} ${a.y - 30}, ${b.x} ${b.y - 30}, ${b.x} ${b.y}`;
  const c1 = a.x + (b.x - a.x) * 0.42;
  const c2 = b.x - (b.x - a.x) * 0.42;
  return `M ${a.x} ${a.y} C ${c1} ${a.y}, ${c2} ${b.y}, ${b.x} ${b.y}`;
}

function chipOf(layout: LevelLayout, rows: Row[], id: string): { chip: Chip; at: Pt } | null {
  for (const lane of layout.lanes.values()) {
    const chip = lane.chips.find(c => c.id === id);
    if (!chip) continue;
    const at = chipCenter(chip, rows);
    return at ? { chip, at } : null;
  }
  return null;
}

/**
 * Everything that depends on selection or search sits here, above the tiles, so the tiles
 * themselves never change: causal links of the selected event and rings on matches.
 */
function Overlay({ layout, rows, links, selectedId, matches, theme }: Props) {
  const sel = selectedId ? chipOf(layout, rows, selectedId) : null;
  const related = sel ? links.filter(l => l.from === selectedId || l.to === selectedId) : [];
  return (
    <svg className="overlay" width={1} height={1} aria-hidden>
      {[...matches].map(id => {
        const m = chipOf(layout, rows, id);
        if (!m) return null;
        return <circle key={`q-${id}`} cx={m.at.x} cy={m.at.y} r={RADIUS[m.chip.weight] + 4} fill="none" stroke={theme.accent} strokeWidth={1.5} strokeDasharray="3 2" />;
      })}
      {sel && related.map(l => {
        const otherId = l.from === selectedId ? l.to : l.from;
        const other = chipOf(layout, rows, otherId);
        if (!other) return null;
        const [a, b] = l.from === selectedId ? [sel.at, other.at] : [other.at, sel.at];
        return (
          <g key={`${l.from}-${l.to}`}>
            <path d={linkPath(a, b)} fill="none" stroke={theme.accent} strokeWidth={2} opacity={0.9} />
            <circle cx={other.at.x} cy={other.at.y} r={RADIUS[other.chip.weight] + 3.5} fill="none" stroke={theme.accent} strokeWidth={2} />
          </g>
        );
      })}
      {sel && <circle cx={sel.at.x} cy={sel.at.y} r={RADIUS[sel.chip.weight] + 5} fill="none" stroke={theme.accent} strokeWidth={2.5} />}
    </svg>
  );
}

export default memo(Overlay);
