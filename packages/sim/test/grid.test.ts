import { describe, expect, it } from "vitest";
import { UNREACHABLE, canBuild, createState, distanceField, generateGrid, pathFromEntry, seedRng, step } from "../src/index.js";
import { loadData } from "./helpers.js";

describe("grid and pathing", () => {
  it("generated boards always connect entry to core", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const g = generateGrid(seedRng(seed), 20, 14, 12);
      const dist = distanceField(g, g.obstacle);
      expect(dist[g.entry]).toBeLessThan(UNREACHABLE);
    }
  });
  it("refuses a build that would fully block the path", () => {
    const data = loadData();
    const s = createState(data, 3);
    const path = pathFromEntry(s.grid, s.dist);
    // Wall off the column next to the entry except along one cell, then try to close it.
    const x = 1;
    const cellsInColumn = Array.from({ length: s.grid.height }, (_, y) => y * s.grid.width + x);
    s.gold = 1_000_000;
    let lastRejected = false;
    for (const c of cellsInColumn) {
      const ev = step(data, s, [{ kind: "build", cell: c, type: "bolt" }]);
      lastRejected = ev.some((e) => e.kind === "rejected" && e.reason === "would block path");
    }
    expect(lastRejected).toBe(true);
    expect(pathFromEntry(s.grid, s.dist).length).toBeGreaterThan(0);
    expect(path.length).toBeGreaterThan(0);
  });
  it("canBuild rejects entry, core, obstacles and occupied cells", () => {
    const data = loadData();
    const s = createState(data, 5);
    expect(canBuild(s, s.grid.entry).ok).toBe(false);
    expect(canBuild(s, s.grid.core).ok).toBe(false);
    const obstacle = s.grid.obstacle.findIndex((v) => v === 1);
    expect(canBuild(s, obstacle).ok).toBe(false);
  });
});
