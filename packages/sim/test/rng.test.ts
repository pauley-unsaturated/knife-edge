import { describe, expect, it } from "vitest";
import { nextInt, nextU32, seedRng } from "../src/index.js";

describe("rng", () => {
  it("is deterministic for a seed", () => {
    const a = seedRng(42);
    const b = seedRng(42);
    for (let i = 0; i < 1000; i++) expect(nextU32(a)).toBe(nextU32(b));
  });
  it("differs across seeds", () => {
    const a = seedRng(1);
    const b = seedRng(2);
    expect(nextU32(a)).not.toBe(nextU32(b));
  });
  it("nextInt stays in range and is roughly uniform", () => {
    const r = seedRng(7);
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 60000; i++) counts[nextInt(r, 6)]!++;
    for (const c of counts) expect(Math.abs(c - 10000)).toBeLessThan(600);
  });
  it("pins the first values so engine drift is caught", () => {
    const r = seedRng(123);
    expect([nextU32(r), nextU32(r), nextU32(r)]).toMatchInlineSnapshot(`
      [
        107548207,
        3334661609,
        458788363,
      ]
    `);
  });
});
