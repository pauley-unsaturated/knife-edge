import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { freezeEngineArtifact, parseEngineValidationArgs } from "../../../experiments/0004-raid-heat/validate-engines.js";

it("requires an explicit seed range and defaults to matched full difficulty/profile coverage", () => {
  expect(() => parseEngineValidationArgs([])).toThrow("config-folder");
  const args = parseEngineValidationArgs(["/tmp/unused-frozen-configs", "7", "2", "parser-unit-test"]);
  expect(args.profiles).toEqual(["engineer-rookie", "engineer", "engineer-prepared"]);
  expect(args.difficulties).toEqual(["easy", "medium", "hard"]);
  expect(args.neutralControls).toBe(true);
  expect(args.lootCount).toBe(0);
  expect(args.lootStart).toBeNull();
});

it("keeps independent loot ranges explicit and rejects malformed or escaping output labels", () => {
  const prefix = ["/tmp/unused-frozen-configs", "7", "2", "parser-unit-test"];
  const args = parseEngineValidationArgs([...prefix, "--profiles=engineer-prepared", "--loot-start=123", "--loot-count=3", "--loot-only"]);
  expect(args.lootStart).toBe(123);
  expect(args.lootCount).toBe(3);
  expect(args.lootProfiles).toEqual(["engineer-prepared"]);
  expect(parseEngineValidationArgs([...prefix, "--profiles=engineer-apprentice,engineer-deliberate"]).profiles)
    .toEqual(["engineer-apprentice", "engineer-deliberate"]);
  expect(() => parseEngineValidationArgs([...prefix, "--loot-start=123"])).toThrow("both");
  expect(() => parseEngineValidationArgs([...prefix, "--profiles=engineer,engineer"])).toThrow("distinct");
  expect(() => parseEngineValidationArgs([...prefix.slice(0, 3), "../escape"])).toThrow("label");
});

it("frozen artifacts refuse changed rules or fingerprints rather than overwrite evidence", () => {
  const temporary = mkdtempSync(join(tmpdir(), "knife-edge-frozen-validation-test-"));
  try {
    const file = join(temporary, "manifest.json");
    const original = { data: "rules-a", policy: "driver-a" };
    freezeEngineArtifact(file, original);
    freezeEngineArtifact(file, original);
    expect(() => freezeEngineArtifact(file, { ...original, data: "rules-b" })).toThrow("Frozen artifact differs");
    expect(() => freezeEngineArtifact(file, { ...original, policy: "driver-b" })).toThrow("Frozen artifact differs");
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(original);
  } finally {
    rmSync(temporary, { recursive: true });
  }
});
