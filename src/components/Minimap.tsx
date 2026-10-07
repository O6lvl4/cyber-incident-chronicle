import { memo, useMemo, useRef } from 'react';
import type { Thread, TimelineEvent, Weight } from '../types';
import { threadColor } from '../lib/palette';
import { ms } from '../lib/time';

const MM_H = 52;
const MM_LW = 80;
const NOM_W = 1000;
const DOT_R: Record<Weight, number> = { 1: 1.5, 2: 2, 3: 2.5 };

interface Props {
  threads: Thread[];
  events: TimelineEvent[];
  activeThreadIds: string[];
  dataStart: number;
  dataEnd: number;
  viewStart: number;
  viewEnd: number;
  dark: boolean;
  onViewChange: (s: number, e: number) => void;
}

function yearsBetween(start: number, end: number): number[] {
  const out: number[] = [];
  for (let y = new Date(start).getUTCFullYear() + 1; y <= new Date(end).getUTCFullYear(); y++) out.push(y);
  return out;
}

interface DotsProps {
  lanes: Thread[];
  events: TimelineEvent[];
  dark: boolean;
  laneH: number;
  xFor: (t: number) => number;
}

/** Event dots per lane; memoized so panning only redraws the brush. */
const MinimapDots = memo(function MinimapDots({ lanes, events, dark, laneH, xFor }: DotsProps) {
  return (
    <g>
      {lanes.map((th, li) => {
        const col = threadColor(th, dark);
        const cy = 4 + li * laneH + laneH / 2;
        return (
          <g key={th.id}>
            <rect x={MM_LW} y={4 + li * laneH} width={NOM_W - MM_LW} height={laneH} fill={col} opacity={li % 2 === 0 ? 0 : 0.04} />
            {events.filter(ev => ev.threadId === th.id).map(ev => (
              <circle key={ev.id} cx={xFor(ms(ev.date))} cy={cy} r={DOT_R[ev.weight]} fill={col} opacity={0.75} />
            ))}
          </g>
        );
      })}
    </g>
  );
});

/** Whole-range overview with the current viewport as a draggable brush. */
export default function Minimap({ threads, events, activeThreadIds, dataStart, dataEnd, viewStart, viewEnd, dark, onViewChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const totalSpan = dataEnd - dataStart;

  const xFor = useRef((t: number) => MM_LW + ((t - dataStart) / totalSpan) * (NOM_W - MM_LW)).current;
  const seek = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = (clientX - rect.left) * (NOM_W / rect.width);
    const ct = dataStart + ((nx - MM_LW) / (NOM_W - MM_LW)) * totalSpan;
    const half = (viewEnd - viewStart) / 2;
    onViewChange(ct - half, ct + half);
  };

  const lanes = useMemo(() => threads.filter(t => activeThreadIds.includes(t.id)), [threads, activeThreadIds]);
  const laneH = (MM_H - 4) / Math.max(lanes.length, 1);
  const surf = dark ? '#1E2036' : '#FFFFFF';
  const ink = dark ? 'rgba(240,238,248,0.2)' : '#1A1A2E';
  const accent = dark ? '#FF3B4E' : '#E4000F';
  const todayX = xFor(Date.now());
  const bx = Math.max(xFor(viewStart), MM_LW);
  const bw = Math.min(xFor(viewEnd), NOM_W) - bx;

  return (
    <div style={{ height: MM_H, flexShrink: 0, borderTop: `2px solid ${dark ? 'rgba(240,238,248,0.1)' : '#1A1A2E'}`, background: surf }}>
      <svg ref={svgRef} width="100%" height={MM_H} viewBox={`0 0 ${NOM_W} ${MM_H}`} preserveAspectRatio="none"
        style={{ display: 'block', cursor: 'crosshair' }}
        onPointerDown={e => { dragging.current = true; svgRef.current?.setPointerCapture(e.pointerId); seek(e.clientX); }}
        onPointerMove={e => { if (dragging.current) seek(e.clientX); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}>
        <rect x={0} y={0} width={MM_LW} height={MM_H} fill={surf} />
        <text x={MM_LW - 8} y={MM_H / 2 + 4} textAnchor="end" fontFamily="'DM Mono', monospace" fontSize={8}
          letterSpacing={1.5} fill="var(--text-sub)">
          OVERVIEW
        </text>
        <line x1={MM_LW} y1={0} x2={MM_LW} y2={MM_H} stroke={ink} strokeWidth={1} opacity={0.4} />

        {yearsBetween(dataStart, dataEnd).map(y => {
          const fx = xFor(Date.UTC(y, 0, 1));
          return (
            <g key={y}>
              <line x1={fx} y1={0} x2={fx} y2={MM_H} stroke={ink} strokeWidth={0.5} opacity={0.15} />
              <text x={fx + 3} y={10} fontFamily="'DM Mono', monospace" fontSize={7} fill="var(--text-sub)" opacity={0.8}>{y}</text>
            </g>
          );
        })}

        <MinimapDots lanes={lanes} events={events} dark={dark} laneH={laneH} xFor={xFor} />

        {todayX >= MM_LW && todayX <= NOM_W && (
          <line x1={todayX} y1={0} x2={todayX} y2={MM_H} stroke={accent} strokeWidth={1.5} opacity={0.7} />
        )}
        <rect x={bx} y={2} width={Math.max(bw, 4)} height={MM_H - 4} rx={3}
          fill={accent} fillOpacity={0.12} stroke={accent} strokeWidth={1.5} />
      </svg>
    </div>
  );
}
