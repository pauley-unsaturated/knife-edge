/**
 * Grid, obstacle generation, and the distance field used for pathing.
 * Enemies always step to the orthogonal neighbour with the smallest distance to the core.
 * Ties break in a fixed direction order so movement is deterministic.
 */
import { nextInt, type RngState } from "./rng.js";

export type Cell = number; // index = y * width + x

export const UNREACHABLE = 0x3fffffff;

export interface Grid {
  width: number;
  height: number;
  entry: Cell;
  core: Cell;
  /** true where an obstacle blocks building and movement. */
  obstacle: Uint8Array;
}

export function cellOf(g: Grid, x: number, y: number): Cell {
  return y * g.width + x;
}
export function xOf(g: Grid, c: Cell): number {
  return c % g.width;
}
export function yOf(g: Grid, c: Cell): number {
  return Math.floor(c / g.width);
}

/** Neighbour order: E, S, W, N. */
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

export function neighbours(g: Grid, c: Cell): Cell[] {
  const x = xOf(g, c);
  const y = yOf(g, c);
  const out: Cell[] = [];
  for (let i = 0; i < 4; i++) {
    const nx = x + (DX[i] as number);
    const ny = y + (DY[i] as number);
    if (nx >= 0 && ny >= 0 && nx < g.width && ny < g.height) out.push(cellOf(g, nx, ny));
  }
  return out;
}

/**
 * Generate a board: entry on the left edge (middle row), core on the right edge, and
 * N random obstacles that never disconnect entry from core.
 */
export function generateGrid(rng: RngState, width: number, height: number, obstacles: number): Grid {
  const g: Grid = {
    width,
    height,
    entry: cellOf({ width, height } as Grid, 0, Math.floor(height / 2)),
    core: cellOf({ width, height } as Grid, width - 1, Math.floor(height / 2)),
    obstacle: new Uint8Array(width * height),
  };
  let placed = 0;
  let attempts = 0;
  while (placed < obstacles && attempts < obstacles * 20) {
    attempts++;
    const c = nextInt(rng, width * height);
    if (c === g.entry || c === g.core || g.obstacle[c]) continue;
    g.obstacle[c] = 1;
    const dist = distanceField(g, g.obstacle);
    if ((dist[g.entry] as number) >= UNREACHABLE) {
      g.obstacle[c] = 0;
      continue;
    }
    placed++;
  }
  return g;
}

/**
 * BFS from the core over cells that are not blocked. `blocked[c] != 0` means impassable
 * (obstacles plus towers). Returns distance in steps, UNREACHABLE where cut off.
 */
export function distanceField(g: Grid, blocked: Uint8Array): Int32Array {
  const n = g.width * g.height;
  const dist = new Int32Array(n).fill(UNREACHABLE);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  dist[g.core] = 0;
  queue[tail++] = g.core;
  while (head < tail) {
    const c = queue[head++] as number;
    const d = (dist[c] as number) + 1;
    for (const nb of neighbours(g, c)) {
      if (blocked[nb] || (dist[nb] as number) !== UNREACHABLE) continue;
      dist[nb] = d;
      queue[tail++] = nb;
    }
  }
  return dist;
}

/** Next cell on the way to the core, or -1 if at the core or unreachable. */
export function nextStep(g: Grid, dist: Int32Array, c: Cell): Cell {
  if (c === g.core) return -1;
  let best = -1;
  let bestD = dist[c] as number;
  for (const nb of neighbours(g, c)) {
    const d = dist[nb] as number;
    if (d < bestD) {
      bestD = d;
      best = nb;
    }
  }
  return best;
}

/** The path the next spawned enemy would take, entry to core. */
export function pathFromEntry(g: Grid, dist: Int32Array): Cell[] {
  const out: Cell[] = [];
  let c = g.entry;
  let guard = g.width * g.height + 1;
  while (c !== -1 && guard-- > 0) {
    out.push(c);
    c = nextStep(g, dist, c);
  }
  return out;
}
