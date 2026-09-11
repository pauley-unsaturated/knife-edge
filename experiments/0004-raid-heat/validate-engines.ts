/** Explicit frozen-config validation. Importing this module never starts runs.
 * pnpm exec tsx experiments/0004-raid-heat/validate-engines.ts <config-folder> <start> <count> <label>
 *   [--profiles=engineer-rookie,engineer,engineer-prepared]
 *   [--variants=raid,compound,pact] [--difficulties=easy,medium,hard]
 *   [--no-controls] [--loot-start=N --loot-count=N --loot-board=7]
 *   [--loot-profiles=engineer-prepared] [--loot-only] [--max-ticks=400000]
 * Default: all profiles × E/M/H on identical seeds, plus neutral-patch forced
 * Arc/Ember controls on Medium. Optional loot runs use Medium on one fixed board.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveData, withDifficulty, type Difficulty, type RawGameData } from "../../packages/sim/src/index.ts";
import { assertEngineRun, neutralEnginePatches, runEngineValidation, summarizeEngineValidation, type CheckedEngineRun } from "../../tools/balance/src/engine-validation.ts";
import { makePolicy } from "../../tools/balance/src/policies/index.ts";

const VARIANTS = ["raid", "compound", "pact"] as const;
const DEFAULT_PROFILES = ["engineer-rookie", "engineer", "engineer-prepared"] as const;
const PROFILES = [...DEFAULT_PROFILES, "engineer-apprentice", "engineer-deliberate"] as const;
type Variant = (typeof VARIANTS)[number];
type Profile = (typeof PROFILES)[number];
const REPO = fileURLToPath(new URL("../../", import.meta.url));
const USAGE = "validate-engines.ts <config-folder> <start> <count> <label> [--profiles=...] [--variants=...] [--difficulties=...] [--no-controls] [--loot-start=N --loot-count=N --loot-board=7] [--loot-profiles=...] [--loot-only] [--max-ticks=400000]";

export interface FrozenValidationOptions {
  configFolder: string;
  start: number;
  count: number;
  label: string;
  profiles: Profile[];
  variants: Variant[];
  difficulties: Difficulty[];
  neutralControls: boolean;
  lootStart: number | null;
  lootCount: number;
  lootBoard: number;
  lootProfiles: Profile[];
  lootOnly: boolean;
  maxTicks: number;
}

function integer(value: string, name: string, min: number, max: number): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) throw new Error(`Invalid ${name}: ${value}`);
  return result;
}

function list<T extends string>(value: string | undefined, allowed: readonly T[], name: string): T[] {
  const result = value === undefined ? [...allowed] : value.split(",");
  if (!result.length || result.some((v) => !allowed.includes(v as T)) || new Set(result).size !== result.length)
    throw new Error(`Invalid ${name}; choose distinct values from ${allowed.join(",")}`);
  return result as T[];
}

export function parseEngineValidationArgs(argv: readonly string[]): FrozenValidationOptions {
  if (argv.length < 4) throw new Error(USAGE);
  const [configFolder, first, countText, label] = argv as [string, string, string, string];
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(label)) throw new Error("Use a lowercase alphanumeric/hyphen label up to80 characters");
  const flags = new Map<string, string>();
  for (const argument of argv.slice(4)) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(argument);
    if (!match || flags.has(match[1]!)) throw new Error(`Invalid or repeated option: ${argument}`);
    const key = match[1]!;
    const boolean = ["no-controls", "loot-only"].includes(key);
    if (!["profiles", "variants", "difficulties", "no-controls", "loot-start", "loot-count", "loot-board", "loot-profiles", "loot-only", "max-ticks"].includes(key) ||
        (boolean ? match[2] !== undefined : !match[2])) throw new Error(`Unknown or malformed option: ${argument}`);
    flags.set(key, match[2] ?? "true");
  }
  const start = integer(first, "start seed", 0, 0xffffffff);
  const count = integer(countText, "count", 1, 1000);
  if (start + count - 1 > 0xffffffff) throw new Error("Seed range exceeds uint32");
  const lootStart = flags.has("loot-start") ? integer(flags.get("loot-start")!, "loot start", 0, 0xffffffff) : null;
  const lootCount = flags.has("loot-count") ? integer(flags.get("loot-count")!, "loot count", 1, 1000) : 0;
  if ((lootStart === null) !== (lootCount === 0) || (lootStart ?? 0) + lootCount - 1 > 0xffffffff)
    throw new Error("Provide both a valid --loot-start and --loot-count");
  if (flags.has("loot-only") && !lootCount) throw new Error("--loot-only requires an explicit loot range");
  const profiles = list(flags.get("profiles") ?? DEFAULT_PROFILES.join(","), PROFILES, "profiles");
  return {
    configFolder: resolve(configFolder), start, count, label, profiles,
    variants: list(flags.get("variants"), VARIANTS, "variants"),
    difficulties: list(flags.get("difficulties"), ["easy", "medium", "hard"] as const, "difficulties"),
    neutralControls: !flags.has("no-controls"),
    lootStart, lootCount, lootBoard: integer(flags.get("loot-board") ?? "7", "loot board", 0, 0xffffffff),
    lootProfiles: list(flags.get("loot-profiles") ?? profiles.join(","), PROFILES, "loot profiles"),
    lootOnly: flags.has("loot-only"), maxTicks: integer(flags.get("max-ticks") ?? "400000", "max ticks", 1, 400000),
  };
}

const sha = (value: string): string => createHash("sha256").update(value).digest("hex");
function sourceFingerprints(directory: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(result, sourceFingerprints(path));
    else if (entry.name.endsWith(".ts")) result[relative(REPO, path)] = sha(readFileSync(path, "utf8"));
  }
  return result;
}

/** Same contents may be reused, but neither changed rules nor changed evidence
 * silently replace a checkpoint. Use a new label for a new experimental run. */
function freezeJson(path: string, value: unknown): void {
  const text = JSON.stringify(value);
  if (existsSync(path)) {
    if (JSON.stringify(JSON.parse(readFileSync(path, "utf8"))) !== text)
      throw new Error(`Frozen artifact differs: ${path}; use a new label`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}
export { freezeJson as freezeEngineArtifact };

export function runFrozenEngineValidation(options: FrozenValidationOptions) {
  // Programmatic callers get the same bounds/path validation as CLI callers.
  options = parseEngineValidationArgs([
    options.configFolder, String(options.start), String(options.count), options.label,
    `--profiles=${options.profiles.join(",")}`, `--variants=${options.variants.join(",")}`,
    `--difficulties=${options.difficulties.join(",")}`, `--max-ticks=${options.maxTicks}`,
    `--loot-board=${options.lootBoard}`, `--loot-profiles=${options.lootProfiles.join(",")}`,
    ...(!options.neutralControls ? ["--no-controls"] : []),
    ...(options.lootStart !== null || options.lootCount ? [`--loot-start=${options.lootStart}`, `--loot-count=${options.lootCount}`] : []),
    ...(options.lootOnly ? ["--loot-only"] : []),
  ]);
  const configs = Object.fromEntries(VARIANTS.map((name) => {
    const raw = JSON.parse(readFileSync(join(options.configFolder, `${name}.json`), "utf8")) as RawGameData;
    deriveData(raw); // Validate before creating any output or simulating a run.
    return [name, raw];
  })) as Record<Variant, RawGameData>;
  const simSources = sourceFingerprints(join(REPO, "packages/sim/src"));
  const policySources = sourceFingerprints(join(REPO, "tools/balance/src/policies"));
  const helperSources = Object.fromEntries(["tools/balance/src/engine-validation.ts", "tools/balance/src/exploration.ts", "tools/balance/src/runner.ts", "tools/balance/src/policy.ts", "experiments/0004-raid-heat/validate-engines.ts"]
    .map((path) => [path, sha(readFileSync(join(REPO, path), "utf8"))]));
  const fingerprints = {
    configs: Object.fromEntries(VARIANTS.map((name) => [name, sha(JSON.stringify(configs[name]))])),
    sim: sha(JSON.stringify(simSources)), policies: sha(JSON.stringify(policySources)),
    helpers: sha(JSON.stringify(helperSources)), simSources, policySources, helperSources,
  };
  const output = fileURLToPath(new URL(`./out/validation-${options.label}/`, import.meta.url));
  if (existsSync(output) && readdirSync(output).length && !existsSync(join(output, "manifest.json")))
    throw new Error(`Nonempty output has no validation manifest: ${output}`);
  freezeJson(join(output, "manifest.json"), { options, fingerprints });
  for (const name of VARIANTS) freezeJson(join(output, "configs", `${name}.json`), configs[name]);
  const boardFingerprints = new Map<string, number>();

  function batch(variant: Variant, difficulty: Difficulty, profile: string, neutral = false, loot = false) {
    const group = loot ? "fixed-board-loot" : neutral ? "neutral-controls" : "matched-seeds";
    const directory = `${group}/${variant}/${difficulty}`;
    const rows: CheckedEngineRun[] = [];
    const artifacts: { seed: number; lootOffset: number | null; replayFile: string; metricsFile: string }[] = [];
    const samples = loot ? options.lootCount : options.count;
    for (let i = 0; i < samples; i++) {
      const raw = neutral ? neutralEnginePatches(configs[variant]) : structuredClone(configs[variant]);
      const offset = loot ? options.lootStart! + i : null;
      if (offset !== null) { raw.relicRules.offerSeedOffset = offset; raw.version += `/loot-${offset}`; }
      const configured = withDifficulty(raw, difficulty);
      const data = deriveData(configured);
      const seed = loot ? options.lootBoard : options.start + i;
      const driver = makePolicy(profile);
      const run = runEngineValidation(data, driver, seed, options.maxTicks);
      const stem = `${profile}-${seed}${offset === null ? "" : `-loot-${offset}`}`;
      const replayFile = `${directory}/${stem}.replay.json`;
      const metricsFile = `${directory}/${stem}.metrics.json`;
      const { replay, ...metrics } = run;
      const caseFingerprints = {
        data: sha(JSON.stringify(configured)), policy: sha(JSON.stringify({ profile, sources: policySources })),
        sim: fingerprints.sim, helpers: fingerprints.helpers,
      };
      freezeJson(join(output, replayFile), replay);
      freezeJson(join(output, metricsFile), { variant, difficulty, group, lootOffset: offset,
        fingerprints: caseFingerprints, ...metrics, replayFile });
      // Preserve the failing witness before stopping. No rejected input or
      // timeout silently becomes an acceptable balance observation.
      assertEngineRun(run);
      const boardKey = `${variant}/${seed}`;
      const previous = boardFingerprints.get(boardKey);
      if (previous !== undefined && previous !== run.boardFingerprint)
        throw new Error(`Matched difficulty/loot cases changed the board: ${boardKey}`);
      boardFingerprints.set(boardKey, run.boardFingerprint);
      rows.push(run);
      artifacts.push({ seed, lootOffset: offset, replayFile, metricsFile });
      if ((i + 1) % 10 === 0) console.log(JSON.stringify({ group, variant, difficulty, profile, completed: i + 1, samples }));
    }
    const report = {
      variant, difficulty, group, profile, ...summarizeEngineValidation(rows),
      skills: "Oracle-assisted heuristic policies, not calibrated human intelligence/dexterity. Prepared uses bounded next-wave safety forecasting and only public loot weights.",
      winners: rows.filter((r) => r.outcome === "won").map((r) => ({
        seed: r.seed, lives: r.lives, chosenDrops: r.chosenDrops, typeCounts: r.typeCounts,
        upgrades: r.upgrades, rerolls: r.rerolls, rerollFees: r.rerollFees,
      })),
      artifacts,
    };
    const reportFile = `${directory}/${profile}.report.json`;
    freezeJson(join(output, reportFile), report);
    const { artifacts: _artifacts, winners: _winners, ...compact } = report;
    console.log(JSON.stringify({ ...compact, reportFile }));
    return { ...compact, reportFile };
  }

  const reports: ReturnType<typeof batch>[] = [];
  if (!options.lootOnly) {
    for (const variant of options.variants)
      for (const difficulty of options.difficulties)
        for (const profile of options.profiles) reports.push(batch(variant, difficulty, profile));
    if (options.neutralControls)
      for (const variant of options.variants)
        for (const profile of ["force-arc", "force-ember"]) reports.push(batch(variant, "medium", profile, true));
  }
  if (options.lootCount)
    for (const variant of options.variants)
      for (const profile of options.lootProfiles) reports.push(batch(variant, "medium", profile, false, true));
  const summary = {
    options, fingerprints, runs: reports.reduce((n, r) => n + r.runs, 0),
    allReplaysVerified: reports.every((r) => r.allReplaysVerified),
    rejectedCommands: reports.reduce((n, r) => n + r.rejectedCommands, 0),
    allMatchedBoardsVerified: true,
    caveats: [
      "No acceptance bands are invented here. Judge/CI gates must cite observed distributions and keep tuning separate from held-out validation.",
      "Neutral controls rerun adaptive forced-type drivers with patch effects disabled; offers, prices, sacrifices, base interest, and coating mechanics remain.",
      "Loot arms hold the board fixed and change the offer stream; later player decisions and encounters may consequently diverge.",
      "Core loss from sacrifice is distinct from leaks. Unreached early waves are null, not automatically perfect clears.",
      "Kill events do not identify direct/status/burst sources; no kill-source attribution is inferred.",
    ],
    reports,
  };
  freezeJson(join(output, "summary.json"), summary);
  console.log(JSON.stringify({ summaryFile: join(output, "summary.json"), runs: summary.runs, allReplaysVerified: summary.allReplaysVerified }));
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--help")) console.log(USAGE);
  else runFrozenEngineValidation(parseEngineValidationArgs(process.argv.slice(2)));
}
