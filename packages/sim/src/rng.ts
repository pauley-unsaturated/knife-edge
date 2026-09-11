/**
 * Seeded PRNG (sfc32). Pure 32-bit integer arithmetic via Math.imul and >>> so the
 * stream is identical on every JS engine. The sim never calls Math.random.
 */
export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let t = s ^ (s >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

export function seedRng(seed: number): RngState {
  const next = splitmix32(seed);
  const st: RngState = { a: next(), b: next(), c: next(), d: next() };
  for (let i = 0; i < 12; i++) nextU32(st);
  return st;
}

/** Advance the state and return a uniform u32. */
export function nextU32(s: RngState): number {
  const t = (((s.a + s.b) | 0) + s.d) | 0;
  s.d = (s.d + 1) | 0;
  s.a = s.b ^ (s.b >>> 9);
  s.b = (s.c + (s.c << 3)) | 0;
  s.c = (s.c << 21) | (s.c >>> 11);
  s.c = (s.c + t) | 0;
  return t >>> 0;
}

/** Uniform integer in [0, n). Rejection sampling, no modulo bias. */
export function nextInt(s: RngState, n: number): number {
  if (n <= 0) throw new Error(`nextInt: n must be positive, got ${n}`);
  const limit = 0x100000000 - (0x100000000 % n);
  let x = nextU32(s);
  while (x >= limit) x = nextU32(s);
  return x % n;
}

/** Deterministic in-place Fisher-Yates. */
export function shuffle<T>(s: RngState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextInt(s, i + 1);
    const t = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = t;
  }
  return arr;
}

export function cloneRng(s: RngState): RngState {
  return { a: s.a, b: s.b, c: s.c, d: s.d };
}
