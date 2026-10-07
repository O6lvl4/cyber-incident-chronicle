import { memo } from 'react';
import type { Thread } from '../types';
import type { Row } from '../engine/tileLayer';

interface Props {
  threads: Thread[];
  rows: Row[];
  labelW: number;
  totalH: number;
}

/** Sticky left-hand column with one label per visible lane; heights come from the layout. */
function LaneLabels({ threads, rows, labelW, totalH }: Props) {
  const byId = new Map(threads.map(t => [t.id, t]));
  const narrow = labelW < 100;
  return (
    <div className="lane-labels" style={{ width: labelW, height: totalH }}>
      {rows.filter(r => !r.axis).map(r => {
        const t = byId.get(r.id);
        if (!t) return null;
        return (
          <div key={r.id} className={`lane-label${narrow ? ' narrow' : ''}`} style={{ top: r.top, height: r.height, '--lane': r.color } as React.CSSProperties}>
            <span className="lane-bar" />
            <span className="lane-name">{t.name}</span>
            {!narrow && <span className="lane-en">{t.en}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default memo(LaneLabels);
