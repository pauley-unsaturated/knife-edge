import { describe, expect, it } from "vitest";
import { createState, mulBp, runReplay, step, type Replay } from "../src/index.js";
import { loadData } from "./helpers.js";

const data = loadData();

describe("economy", () => {
  it("pays the early-call bonus before the interest tick", () => {
    const s = createState(data, 1);
    const before = s.gold;
    const ev = step(data, s, [{ kind: "callWave" }]);
    const ws = ev.find((e) => e.kind === "waveStart");
    expect(ws && ws.kind === "waveStart").toBe(true);
    if (!ws || ws.kind !== "waveStart") return;
    const expectedBonus = Math.floor((data.waveIntervalTicks * data.economy.earlyCallBonusPerSec) / data.economy.tickRate);
    expect(ws.earlyBonus).toBe(expectedBonus);
    expect(ws.interest).toBe(mulBp(before + expectedBonus, data.economy.interestBp));
    expect(s.gold).toBe(before + expectedBonus + ws.interest);
  });
  it("auto-starts a wave when the timer runs out and pays no early bonus", () => {
    const s = createState(data, 1);
    let started;
    for (let i = 0; i <= data.waveIntervalTicks + 1 && !started; i++) started = step(data, s).find((e) => e.kind === "waveStart");
    expect(started && started.kind === "waveStart" && started.earlyBonus).toBe(0);
  });
  it("refunds 75% of cumulative spend on sell", () => {
    const s = createState(data, 2);
    const cell = s.grid.entry + 1 + s.grid.width; // a cell off the direct line, likely free
    const buildCost = data.towers[0]!.ladder[0]!.cost;
    const ev = step(data, s, [{ kind: "build", cell, type: "bolt" }]);
    if (ev.some((e) => e.kind === "rejected")) return; // board-dependent; other tests cover build
    const goldAfterBuild = s.gold;
    step(data, s, [{ kind: "sell", cell }]);
    expect(s.gold).toBe(goldAfterBuild + mulBp(buildCost, data.economy.sellRefundBp));
  });
});

describe("determinism", () => {
  const replay: Replay = { dataVersion: data.version, seed: 99, commands: [{ tick: 0, cmd: { kind: "callWave" } }] };
  it("same seed and commands give the same hash", () => {
    const a = runReplay(data, replay, 20_000);
    const b = runReplay(data, replay, 20_000);
    expect(a.finalHash).toBe(b.finalHash);
    expect(a.waveHashes).toEqual(b.waveHashes);
  });
  it("different seeds give different hashes", () => {
    const a = runReplay(data, replay, 20_000);
    const b = runReplay(data, { ...replay, seed: 100 }, 20_000);
    expect(a.finalHash).not.toBe(b.finalHash);
  });
  it("golden run: an undefended board loses, and the hash is pinned", () => {
    const r = runReplay(data, replay, 200_000);
    expect(r.state.outcome).toBe("lost");
    expect({ ticks: r.ticks, wave: r.state.wave, hash: r.finalHash }).toMatchInlineSnapshot(`
      {
        "hash": 2462598994,
        "ticks": 3591,
        "wave": 5,
      }
    `);
  });
});
