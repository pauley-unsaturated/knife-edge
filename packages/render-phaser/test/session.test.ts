import { describe, expect, it } from "vitest";
import { deriveData, hashState, runReplay } from "@knife-edge/sim";
import { Session } from "../src/session.js";
import { loadData } from "../../sim/test/helpers.js";
import { readFileSync } from "node:fs";
import { rawData, validateReplay, withDifficulty } from "@knife-edge/sim";

describe("one simulation, three clocks", () => {
  const data = loadData();
  it("ships a verified example replay using the current Easy data", () => {
    const replay = validateReplay(
      JSON.parse(readFileSync("apps/web/public/example.replay.json", "utf8")),
    );
    const easy = deriveData(withDifficulty(rawData(data), "easy"));
    expect(replay.data).toEqual(rawData(easy));
    const played = runReplay(easy, replay, 400000);
    expect(played.state.outcome).toBe("won");
    expect(played.finalHash).toBe(replay.finalHash);
  });
  it("1x, 2x, 4x and manual stepping agree at the same tick", () => {
    const hashes = [];
    for (const speed of [1, 2, 4]) {
      const session = new Session(data, 7);
      session.paused = false;
      session.speed = speed;
      for (let n = 0; n < 100 / speed; n++) session.frame(50);
      expect(session.state.tick).toBe(100);
      hashes.push(hashState(session.state));
    }
    const direct = new Session(data, 7);
    for (let n = 0; n < 100; n++) direct.tick();
    expect(new Set([...hashes, hashState(direct.state)]).size).toBe(1);
  });
  it("pauses time and clamps background catch-up", () => {
    const s = new Session(data, 7);
    s.frame(10000);
    expect(s.state.tick).toBe(0);
    s.paused = false;
    s.frame(10000);
    expect(s.state.tick).toBe(5);
  });
  it("exports and resumes an exact partial checkpoint", () => {
    const s = new Session(data, 7);
    s.command({ kind: "build", cell: 20, type: "bolt" });
    s.command({ kind: "callWave" });
    for (let i = 0; i < 50; i++) s.tick();
    const replay = s.export(),
      restored = new Session(data, 1);
    restored.resume(replay);
    expect(hashState(restored.state)).toBe(hashState(s.state));
    restored.command({ kind: "sell", cell: 20 });
    expect(runReplay(data, restored.export(), 400000).finalHash).toBe(
      hashState(restored.state),
    );
  });
  it("verifies instant playback at the recorded endpoint and detects tampering", () => {
    const original = new Session(data, 7);
    original.command({ kind: "callWave" });
    for (let i = 0; i < 100; i++) original.tick();
    const replay = original.export();
    for (const corrupt of [false, true]) {
      const player = new Session(data, 1);
      player.load({ ...replay, finalHash: corrupt ? 0 : replay.finalHash! });
      while (!player.advanceToWaveEnd(1, 20)) {
        /* sliced playback */
      }
      expect(player.state.tick).toBe(replay.endTick);
      expect(player.verification).toContain(
        corrupt ? "MISMATCH" : "exact match",
      );
    }
  });
});
