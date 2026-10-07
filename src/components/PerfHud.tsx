import { useEffect, useState } from 'react';
import { count, perf, type PerfStats } from '../lib/perf';

/** Frame/tile statistics in a corner, for profiling on a phone (`?perf=1`). */
export default function PerfHud() {
  const [s, setS] = useState<PerfStats & { fps: number }>({ ...perf, fps: 0 });
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      if (now - last > 34) count('longFrames');
      last = now;
      frames++;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const timer = window.setInterval(() => { setS({ ...perf, fps: frames * 2 }); frames = 0; }, 500);
    return () => { cancelAnimationFrame(raf); window.clearInterval(timer); };
  }, []);
  const f = (n: number) => n.toFixed(1);
  return (
    <pre className="perf-hud">
      {`fps ${s.fps}  long ${s.longFrames}\ntile ${f(s.tileMs)} / p95 ${f(s.tileP95)} / max ${f(s.tileMax)} ms ×${s.tiles}\nlevel switches ${s.levelSwitches}\ndpr ${window.devicePixelRatio}  ${window.innerWidth}×${window.innerHeight}`}
    </pre>
  );
}
