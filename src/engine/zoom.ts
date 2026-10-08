/** Version 2 adds a phone-sized overview without changing legacy shared zooms. */
export const PX_PER_DAY = [0.16, 0.25, 0.4, 0.64, 1, 1.6, 2.56, 4, 6.4, 10, 16, 26, 40];
export const MAX_LEVEL = PX_PER_DAY.length - 1;
export const ZOOM_VERSION = '2';
export const LEGACY_LEVEL_OFFSET = 1;
export const DAY = 86400000;

/** The finest level at which the complete span fits into the plot. */
export function fitLevel(spanMs: number, plotW: number): number {
  const days = spanMs / DAY;
  let best = 0;
  PX_PER_DAY.forEach((p, i) => { if (days * p <= plotW) best = i; });
  return best;
}
