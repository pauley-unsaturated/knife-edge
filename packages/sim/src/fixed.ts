/**
 * Fixed-point helpers. Positions and ranges are integers in 1/SCALE cell units.
 * Rates are integers in basis points (BP = 10000 means 1.0). No floats in the sim.
 */
export const SCALE = 1024;
export const BP = 10000;

export function cellsToFp(cells: number): number {
  return Math.round(cells * SCALE);
}

/** value * rate_bp / BP, rounded half up. */
export function mulBp(value: number, rateBp: number): number {
  return Math.floor((value * rateBp + BP / 2) / BP);
}

/** Integer damage from a BP-scaled per-tick rate. Equivalent to the difference
 * of consecutive floor(tick * rate / BP) values, without a large tick * rate
 * product. Fractional phase products remain below BP² even on long replays. */
export function bpRateTick(rate: number, tick: number): number {
  const whole = Math.floor(rate / BP);
  const fraction = rate % BP;
  const phase = tick % BP;
  return whole + Math.floor((phase + 1) * fraction / BP) - Math.floor(phase * fraction / BP);
}

/** base * (rateBp/BP)^n computed iteratively so every engine rounds identically. */
export function growBp(base: number, rateBp: number, n: number): number {
  let v = base;
  for (let i = 0; i < n; i++) v = mulBp(v, rateBp);
  return v;
}

/** Integer square root (floor). */
export function isqrt(n: number): number {
  if (n < 0) throw new Error("isqrt of negative");
  if (n < 2) return n;
  let x = Math.floor(Math.sqrt(n));
  while (x * x > n) x--;
  while ((x + 1) * (x + 1) <= n) x++;
  return x;
}
