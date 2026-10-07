/** Tiny on-device profiler, enabled with `?perf=1`; read by the PerfHud overlay and the CI fling test. */
export interface PerfStats {
  tiles: number;
  tileMs: number;
  tileMax: number;
  tileP95: number;
  longFrames: number;
  levelSwitches: number;
}

const samples: number[] = [];

export const perf: PerfStats & { enabled: boolean } = {
  enabled: typeof location !== 'undefined' && /[?&]perf=1/.test(location.search),
  tiles: 0, tileMs: 0, tileMax: 0, tileP95: 0, longFrames: 0, levelSwitches: 0,
};

export function noteTile(ms: number) {
  if (!perf.enabled) return;
  perf.tiles++;
  perf.tileMs = ms;
  perf.tileMax = Math.max(perf.tileMax, ms);
  samples.push(ms);
  if (samples.length > 400) samples.shift();
  const sorted = [...samples].sort((a, b) => a - b);
  perf.tileP95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
}

export function count(key: 'longFrames' | 'levelSwitches') {
  if (perf.enabled) perf[key]++;
}

if (perf.enabled) (window as unknown as { __perf: PerfStats }).__perf = perf;
