import { describe, expect, it } from "vitest";
import {
  canBuild,
  cloneState,
  composeWave,
  createState,
  damageMultiplier,
  deriveData,
  enemyHpAtWave,
  hashState,
  interestAtStart,
  makeReplay,
  mulBp,
  nextStep,
  rawData,
  runReplay,
  step,
  towerDamage,
  validateReplay,
  waveBudget,
  withDifficulty,
  type Enemy,
  type State,
  type Tower,
} from "../src/index.js";
import { loadData } from "./helpers.js";

const data = loadData();
const openData = () =>
  deriveData({ ...rawData(data), grid: { ...data.grid, obstacles: 0 } });
function enemy(
  s: State,
  id = 1,
  cell = s.grid.entry + 3,
  type = "grunt",
  hp = 1000,
): Enemy {
  return {
    id,
    type,
    hp,
    maxHp: hp,
    cell,
    next: nextStep(s.grid, s.dist, cell),
    progress: 0,
    slowBp: 10000,
    slowUntil: 0,
    revealedUntil: 0,
  };
}
function combat(type = "bolt") {
  const d = openData(),
    s = createState(d, 7);
  const tower: Tower = {
    cell: s.grid.entry + 3 - s.grid.width,
    type,
    level: 1,
    spent: d.towerById.get(type)!.cost,
    cooldown: 0,
    priority: "first",
  };
  s.towers = [tower];
  s.inWave = true;
  s.wave = 1;
  s.enemies = [enemy(s)];
  return { d, s, tower };
}

describe("composer and difficulty", () => {
  it("caps counts, spends budget on tiers, and makes previews independent of world RNG", () => {
    for (let seed = 1; seed <= 30; seed++)
      for (let wave = 1; wave <= data.economy.maxWaves; wave++) {
        const preview = composeWave(data, seed, wave);
        expect(preview.length).toBeGreaterThan(0);
        expect(preview.length).toBeLessThanOrEqual(
          data.composer.maxEnemiesPerWave,
        );
        expect(
          preview.reduce(
            (n, e) => n + data.enemyById.get(e.type)!.budgetCost * e.tier,
            0,
          ),
        ).toBeLessThanOrEqual(waveBudget(data, wave));
        for (const e of preview) {
          expect(data.enemyById.get(e.type)!.unlockWave).toBeLessThanOrEqual(
            wave,
          );
          expect(Number.isInteger(e.tier)).toBe(true);
        }
        if (wave % data.composer.riddleEvery === 0)
          expect(new Set(preview.map((e) => e.type)).size).toBe(1);
        const s = createState(data, seed);
        s.wave = wave - 1;
        const hash = hashState(s);
        composeWave(data, seed, wave);
        expect(hashState(s)).toBe(hash);
        step(data, s, [{ kind: "callWave" }]);
        expect(s.spawnQueue).toEqual(preview.slice(1));
        expect(s.enemies[0]!.maxHp).toBe(
          enemyHpAtWave(data, data.enemyById.get(preview[0]!.type)!, wave) *
            preview[0]!.tier,
        );
      }
    expect(composeWave(data, 7, 30).some((e) => e.tier > 1)).toBe(true);
  });
  it("changes defense prices while preserving boards and enemies", () => {
    const variants = ["easy", "medium", "hard"].map((d) =>
      deriveData(
        withDifficulty(rawData(data), d as "easy" | "medium" | "hard"),
      ),
    );
    expect(variants.map((d) => d.towers[0]!.cost)).toEqual([21, 30, 38]);
    for (const d of variants) {
      expect(createState(d, 19).grid).toEqual(createState(data, 19).grid);
      expect(d.enemies).toEqual(data.enemies);
      for (let wave = 1; wave <= 30; wave++)
        expect(composeWave(d, 19, wave)).toEqual(composeWave(data, 19, wave));
    }
  });
  it("rejects broken tunables instead of hanging or dividing by zero", () => {
    const raw = rawData(data);
    expect(() =>
      deriveData({
        ...raw,
        composer: { ...raw.composer, maxEnemiesPerWave: 0 },
      }),
    ).toThrow();
    expect(() =>
      deriveData({ ...raw, economy: { ...raw.economy, tickRate: 60 } }),
    ).toThrow();
    expect(() =>
      deriveData({
        ...raw,
        enemies: raw.enemies.map((e) => ({ ...e, budgetCost: 0 })),
      }),
    ).toThrow();
    const missing = JSON.parse(JSON.stringify(raw));
    delete missing.economy.startGold;
    expect(() => deriveData(missing)).toThrow("startGold");
    expect(() => deriveData({ ...raw, economy: { ...raw.economy, maxWaves: 60 }, relicRules: { ...raw.relicRules, everyWaves: 1 }, relics: raw.relics.map(r => ({ ...r, damageBp: 20000, slowDamageBp: 20000 })) })).toThrow("safe fixed-point bounds");
  });
});

describe("combat roles and exploits", () => {
  it("armor favors thermal over kinetic", () => {
    expect(
      damageMultiplier(
        data,
        data.towerById.get("ember")!,
        data.enemyById.get("armored")!,
      ),
    ).toBe(17500);
    expect(
      damageMultiplier(
        data,
        data.towerById.get("bolt")!,
        data.enemyById.get("armored")!,
      ),
    ).toBe(5500);
  });
  it("fires on the advertised cooldown, without an extra tick", () => {
    const { d, s } = combat();
    const hits: number[] = [];
    for (let tick = 0; tick < 22; tick++)
      if (step(d, s).some((e) => e.kind === "hit")) hits.push(tick);
    expect(hits).toEqual([0, 10, 20]);
  });
  it("targets strongest and weakest instead of array order", () => {
    for (const priority of ["strongest", "weakest"] as const) {
      const { d, s, tower } = combat();
      tower.priority = priority;
      s.enemies = [
        enemy(s, 1, s.grid.entry + 3, "grunt", 100),
        enemy(s, 2, s.grid.entry + 4, "grunt", 500),
      ];
      const hit = step(d, s).find((e) => e.kind === "hit");
      expect(hit && hit.kind === "hit" && hit.enemy).toBe(
        priority === "strongest" ? 2 : 1,
      );
    }
  });
  it("slows movement and expires the effect", () => {
    const { d, s } = combat("frost");
    const e = s.enemies[0]!;
    step(d, s);
    expect(e.progress).toBe(mulBp(64, 5500));
    s.towers = [];
    e.slowUntil = s.tick;
    const before = e.progress;
    step(d, s);
    expect(e.progress - before).toBe(64);
  });
  it("caps splash and chain secondary targets", () => {
    for (const [type, count] of [
      ["mortar", 5],
      ["arc", 3],
    ] as const) {
      const { d, s } = combat(type);
      s.enemies = Array.from({ length: 8 }, (_, i) => enemy(s, i + 1));
      expect(step(d, s).filter((e) => e.kind === "hit")).toHaveLength(count);
    }
  });
  it("lens reveals shades for other towers", () => {
    const { d, s, tower } = combat("lens");
    s.enemies = [enemy(s, 1, s.grid.entry + 3, "shade")];
    s.towers.push({ ...tower, type: "bolt", cell: tower.cell + 1 });
    const hits = step(d, s).filter((e) => e.kind === "hit");
    expect(hits.map((e) => e.kind === "hit" && e.damage)).toEqual([9, 8]);
    const hidden = combat("bolt");
    hidden.s.enemies = [enemy(hidden.s, 1, hidden.s.grid.entry + 3, "shade")];
    expect(
      step(hidden.d, hidden.s).find((e) => e.kind === "hit"),
    ).toMatchObject({ damage: 5 });
  });
  it("uses the strongest aura, and stacks matching relics multiplicatively", () => {
    const { d, s, tower } = combat();
    s.towers.push(
      { ...tower, type: "relay", cell: tower.cell + 1 },
      { ...tower, type: "relay", cell: tower.cell - 1 },
    );
    expect(towerDamage(d, s, tower)).toBe(10);
    s.towers = [tower];
    s.relics = ["overclock", "overclock"];
    expect(towerDamage(d, s, tower)).toBe(13); // 8 ×1.25=10, then ×1.25 rounds to13.
  });
  it("a fatal last enemy on the final wave loses", () => {
    const d = openData(),
      s = createState(d, 1);
    s.wave = d.economy.maxWaves;
    s.inWave = true;
    s.lives = 1;
    s.enemies = [enemy(s, 1, s.grid.core)];
    const events = step(d, s);
    expect(s.outcome).toBe("lost");
    expect(events.some((e) => e.kind === "won")).toBe(false);
    expect(s.stats.wavesCleared).toBeLessThan(d.economy.maxWaves);
  });
  it("selling cannot reset enemy progress to stall a wave", () => {
    const d = openData(),
      s = createState(d, 1),
      cell = s.grid.entry + 4;
    step(d, s, [{ kind: "build", cell, type: "bolt" }]);
    s.inWave = true;
    s.wave = 1;
    s.enemies = [enemy(s, 1, s.grid.entry + 3)];
    s.enemies[0]!.progress = 500;
    step(d, s, [{ kind: "sell", cell }]);
    expect(s.enemies[0]!.progress).toBe(564);
  });
  it("rejects a full wall, fractional cells, and building on live enemies", () => {
    const d = openData(),
      s = createState(d, 1);
    s.gold = 100000;
    for (let y = 0; y < s.grid.height - 1; y++)
      step(d, s, [
        { kind: "build", cell: y * s.grid.width + 10, type: "bolt" },
      ]);
    expect(canBuild(s, (s.grid.height - 1) * s.grid.width + 10)).toMatchObject({
      ok: false,
    });
    expect(canBuild(s, 1.5)).toMatchObject({ ok: false });
    s.enemies = [enemy(s)];
    expect(canBuild(s, s.enemies[0]!.cell)).toMatchObject({ ok: false });
  });
});

describe("economy, offers and replay integrity", () => {
  it("caps interest even when the bank is very large", () => {
    const s = createState(data, 1);
    s.gold = 10000;
    expect(interestAtStart(data, s)).toBe(
      mulBp(data.economy.interestCapGold, data.economy.interestBp),
    );
  });
  it("offers deterministically and rejects duplicate picks", () => {
    const a = createState(data, 7),
      b = createState(data, 7);
    for (const s of [a, b]) {
      s.wave = 5;
      s.inWave = true;
      step(data, s);
    }
    expect(a.relicOffers).toEqual(b.relicOffers);
    expect(new Set(a.relicOffers).size).toBe(data.relicRules.offerCount);
    const id = a.relicOffers[0]!;
    step(data, a, [{ kind: "pickRelic", id }]);
    expect(step(data, a, [{ kind: "pickRelic", id }])).toContainEqual(
      expect.objectContaining({ kind: "rejected" }),
    );
    expect(a.relics).toEqual([id]);
  });
  it("hashes future-affecting fields and clones mutable queues", () => {
    const s = createState(data, 7);
    step(data, s, [{ kind: "callWave" }]);
    for (const mutate of [
      (c: State) => c.spawnCooldown++,
      (c: State) => c.nextEnemyId++,
      (c: State) => c.enemies[0]!.maxHp++,
      (c: State) => c.relics.push("overclock"),
      (c: State) => c.stats.interestEarned++,
    ]) {
      const c = cloneState(s);
      mutate(c);
      expect(hashState(c)).not.toBe(hashState(s));
    }
    const clone = cloneState(s);
    clone.spawnQueue[0]!.tier++;
    expect(clone.spawnQueue[0]).not.toEqual(s.spawnQueue[0]);
  });
  it("preserves partial replay checkpoints and rejects malformed commands", () => {
    const s = createState(data, 7),
      commands = [{ tick: 0, cmd: { kind: "callWave" as const } }];
    step(data, s, [commands[0]!.cmd]);
    for (let i = 0; i < 100; i++) step(data, s);
    const replay = makeReplay(data, s, commands);
    expect(runReplay(data, replay, 400000).finalHash).toBe(hashState(s));
    expect(() =>
      validateReplay({
        ...replay,
        commands: [{ tick: -1, cmd: { kind: "callWave" } }],
      }),
    ).toThrow();
    expect(() => validateReplay({ ...replay, endTick: Infinity })).toThrow();
    expect(() =>
      validateReplay({
        ...replay,
        commands: [
          { tick: 0, cmd: { kind: "target", cell: 1, priority: "oops" } },
        ],
      }),
    ).toThrow();
  });
});
