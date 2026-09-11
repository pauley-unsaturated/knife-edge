import { expect, it } from "vitest";
import { createState, deriveData, distanceField, hashState, rawData, type Tower } from "@knife-edge/sim";
import { loadData } from "../../../packages/sim/test/helpers.js";
import { assessBuildRoute, preserveKillZone } from "../src/policies/path-guard.js";

function checkpoint() {
  const raw = rawData(loadData());
  raw.relics.find(r => r.id === "cold-front")!.slowDamageBp = 17500;
  const data = deriveData(raw), s = createState(data, 3);
  const positions: [number, string][] = [[152,"bolt"],[149,"bolt"],[146,"bolt"],[143,"bolt"],[144,"bolt"],
    [157,"bolt"],[177,"bolt"],[178,"bolt"],[197,"bolt"],[198,"bolt"],[158,"relay"],[217,"frost"],
    [218,"bolt"],[196,"mortar"],[193,"bolt"],[194,"bolt"],[195,"bolt"],[176,"lens"],
    [190,"bolt"],[191,"bolt"],[192,"bolt"],[187,"bolt"]];
  s.towers = positions.map(([cell, type]): Tower => ({ cell, type, level: 1, spent: data.towerById.get(type)!.cost, cooldown: 0, priority: "first" }));
  for (const tower of s.towers) s.blocked[tower.cell] = 1;
  s.dist = distanceField(s.grid, s.blocked);
  s.wave = 12;
  s.gold = 91;
  // Burst stacks do not change this geometric exposure estimate; retain the
  // cold connector whose real support coverage the route must preserve.
  s.relics = ["cold-front"];
  return { data, s };
}

it("rejects the legal equal-length northern bypass that strands the seed3 kill zone", () => {
  const { data, s } = checkpoint();
  const before = hashState(s);
  const assessment = assessBuildRoute(data, s, { kind: "build", cell: 162, type: "bolt" });
  expect(assessment.changed).toBe(true);
  expect(assessment.newPath).toHaveLength(assessment.oldPath.length);
  expect(assessment.after).toBeLessThan(assessment.before * 0.6);
  expect(assessment.safe).toBe(false);
  expect(hashState(s)).toBe(before); // Candidate inspection cannot mutate the sim.
});

it("replaces sabotage with an affordable legal investment, not repeated abstention", () => {
  const { data, s } = checkpoint();
  const replacement = preserveKillZone(data, s, [{ kind: "build", cell: 162, type: "bolt" }]);
  expect(replacement).toHaveLength(1);
  const command = replacement[0]!;
  expect(command.kind === "build" || command.kind === "upgrade").toBe(true);
  if (command.kind === "build") {
    expect(command.cell).not.toBe(162);
    expect(assessBuildRoute(data, s, command).safe).toBe(true);
  }
  if (command.kind === "upgrade") {
    const tower = s.towers.find(t => t.cell === command.cell)!;
    expect(data.towerById.get(tower.type)!.ladder[tower.level]!.cost).toBeLessThanOrEqual(s.gold);
  }
});

it("permits beneficial mazing instead of forbidding every route change", () => {
  const raw = rawData(loadData());
  raw.grid.obstacles = 0;
  const data = deriveData(raw), s = createState(data, 7);
  const cell = s.grid.entry + s.grid.width + 4;
  s.towers = [{ cell, type: "bolt", level: 1, spent: data.towerById.get("bolt")!.cost, cooldown: 0, priority: "first" }];
  s.blocked[cell] = 1;
  s.dist = distanceField(s.grid, s.blocked);
  const command = { kind: "build" as const, cell: s.grid.entry + 3, type: "bolt" };
  const assessment = assessBuildRoute(data, s, command);
  expect(assessment.changed).toBe(true);
  expect(assessment.after).toBeGreaterThan(assessment.before);
  expect(assessment.safe).toBe(true);
  expect(preserveKillZone(data, s, [command])).toEqual([command]);
});

it("leaves non-build decisions untouched", () => {
  const { data, s } = checkpoint();
  const commands = [{ kind: "upgrade" as const, cell: 217 }, { kind: "callWave" as const }];
  expect(preserveKillZone(data, s, commands)).toBe(commands);
});
