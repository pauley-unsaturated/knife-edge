/**
 * Bounded replay-backed mechanic review, with fixed-schedule caveats.
 * pnpm exec tsx experiments/0004-raid-heat/judge-report.ts <replay-folder> \
 *   --limit=12 --policy=pact --seeds=1,7
 * Add --adaptive=force-ember --ablations=neutral-patches,no-hot-wire for
 * reoptimized policy runs alongside the fixed-input interventions.
 * --freeze=1,2,4,8,12 additionally checks opening purchase necessity.
 * Without explicit seeds, select the first half winners / half non-winners,
 * filling unused slots from the other group. This is a diagnostic sample,
 * NOT an unbiased win-rate estimate. Original batch reports supply win rates.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deriveData,
  makeReplay,
  rawData,
  runReplay,
  validateReplay,
  type GameData,
  type Replay,
  type TimedCommand,
} from "../../packages/sim/src/index.ts";
import {
  analyzeExploration,
  type ExplorationWitness,
  type Rejection,
} from "../../tools/balance/src/exploration.ts";
import { makePolicy } from "../../tools/balance/src/policies/index.ts";
import { runPolicy } from "../../tools/balance/src/runner.ts";

const MAX_TICKS = 400_000;
type Ablation = "neutral-patches" | "no-death-burst" | "no-patch-interest" | "no-low-life-damage" | "no-hot-wire" | "no-conductive"
  | "no-poison" | "no-confusion" | "no-hit-slow" | "no-on-hit-statuses"
  | "no-coatings" | "no-wet" | "no-oil";
const ABLATIONS: Ablation[] = [
  "neutral-patches", "no-death-burst", "no-patch-interest", "no-low-life-damage",
  "no-hot-wire", "no-conductive",
  "no-poison", "no-confusion", "no-hit-slow", "no-on-hit-statuses",
  "no-coatings", "no-wet", "no-oil",
];

function ablationData(source: Replay, name: Ablation): GameData {
  if (!source.data) throw new Error("Ablations require embedded data");
  const raw = rawData(deriveData(source.data));
  raw.version += `/judge-${name}`;
  raw.relics = raw.relics.map((relic) => {
    const r = { ...relic };
    if (name === "neutral-patches") {
      r.damageBp = 10000;
      r.slowDamageBp = 10000;
    }
    if (name === "neutral-patches" || name === "no-death-burst")
      r.deathBurstBp = 0;
    if (name === "neutral-patches" || name === "no-patch-interest") {
      r.interestBp = 0;
      r.interestCapBonusGold = 0;
      r.interestRateMultiplierBp = 10000;
    }
    if (name === "neutral-patches" || name === "no-low-life-damage")
      r.lowLifeDamageBp = 10000;
    const allStatuses = name === "neutral-patches" || name === "no-on-hit-statuses";
    if (allStatuses || name === "no-poison") {
      r.poisonDamageBp = 0;
      r.poisonTicks = 0;
    }
    if (allStatuses || name === "no-confusion") {
      r.confusionDamageBp = 0;
      r.confusionTicks = 0;
    }
    if (allStatuses || name === "no-hit-slow") {
      r.hitSlowBp = 10000;
      // A nominally neutral slow must not refresh a stronger Frost slow.
      r.hitSlowTicks = 0;
    }
    if ((name === "no-hot-wire" && r.id === "hot-wire") ||
        (name === "no-conductive" && r.id === "conductive"))
      r.damageBp = 10000;
    r.description = `Diagnostic ${name}; original patch: ${relic.description}. Sacrifice cost retained.`;
    return r;
  });
  if (name === "no-coatings" || name === "no-wet" || name === "no-oil") {
    raw.towers = raw.towers.map((tower) => {
      const remove = name === "no-coatings" ||
        (name === "no-wet" && tower.coating === "wet") ||
        (name === "no-oil" && tower.coating === "oil");
      if (!remove) return tower;
      // Preserve tower costs, positions, direct hits, and rare on-hit delivery;
      // remove only coating setup and its wet/oil payoff.
      const { coating: _coating, coatingTicks: _duration, preferFreshCoating: _fresh, ...plain } = tower;
      return plain;
    });
  }
  if (name === "neutral-patches" && raw.relics.some((r) =>
    r.damageBp !== 10000 || r.slowDamageBp !== 10000 || r.deathBurstBp ||
    r.interestBp || r.interestCapBonusGold || r.interestRateMultiplierBp !== 10000 ||
    r.lowLifeDamageBp !== 10000 || r.poisonDamageBp || r.poisonTicks ||
    r.confusionDamageBp || r.confusionTicks || r.hitSlowBp !== 10000 || r.hitSlowTicks))
    throw new Error("Neutral-patches ablation left an enabled patch effect");
  return deriveData(raw);
}

function ablate(source: Replay, name: Ablation): ExplorationWitness {
  return simulateWitness(source, ablationData(source, name), source.commands, name);
}

function simulateWitness(source: Replay, data: GameData, commands: TimedCommand[], name: string): ExplorationWitness {
  const input: Replay = {
    dataVersion: data.version,
    data: rawData(data),
    seed: source.seed,
    commands,
    ...(source.initialWave === undefined ? {} : { initialWave: source.initialWave }),
  };
  const rejections: Rejection[] = [];
  const result = runReplay(data, input, MAX_TICKS, (tick, events) => {
    for (const event of events)
      if (event.kind === "rejected")
        rejections.push({ tick, command: { ...event.cmd }, reason: event.reason });
  });
  const replay = makeReplay(data, result.state, input.commands.filter((c) => c.tick < result.ticks));
  if (source.initialWave !== undefined) replay.initialWave = source.initialWave;
  const verified = runReplay(data, replay, MAX_TICKS);
  if (verified.finalHash !== result.finalHash || verified.ticks !== result.ticks)
    throw new Error(`Ablation replay mismatch: ${name}, seed ${source.seed}`);
  return {
    outcome: result.state.outcome === "playing" ? "timeout" : result.state.outcome,
    wavesCleared: result.state.stats.wavesCleared,
    lives: result.state.lives,
    gold: result.state.gold,
    goldSpent: result.state.stats.goldSpent,
    ticks: result.ticks,
    finalHash: result.finalHash,
    rejections,
    replayVerified: true,
    replay,
  };
}

function parseArgs() {
  const folder = process.argv[2];
  if (!folder || folder.startsWith("--"))
    throw new Error("Usage: judge-report.ts <replay-folder> [--limit=12] [--policy=pact] [--seeds=1,7] [--adaptive=policy] [--ablations=name,name]");
  const options = new Map(process.argv.slice(3).map((arg) => {
    const match = /^--(limit|policy|seeds|adaptive|ablations|freeze)=(.+)$/.exec(arg);
    if (!match) throw new Error(`Unknown argument: ${arg}`);
    return [match[1]!, match[2]!] as const;
  }));
  const limit = Number(options.get("limit") ?? 12);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error("--limit must be an integer from 1 to 100");
  const seeds = options.has("seeds") ? options.get("seeds")!.split(",").map(Number) : null;
  if (seeds?.some((s) => !Number.isSafeInteger(s) || s < 0 || s > 0xffffffff))
    throw new Error("Invalid --seeds list");
  const ablations = options.has("ablations") ? options.get("ablations")!.split(",") as Ablation[] : ABLATIONS;
  if (ablations.some((name) => !ABLATIONS.includes(name))) throw new Error("Unknown ablation name");
  const freezeWaves = options.has("freeze") ? options.get("freeze")!.split(",").map(Number) : [4, 8, 12];
  if (freezeWaves.some((wave) => !Number.isInteger(wave) || wave < 1 || wave > 100)) throw new Error("Invalid --freeze waves");
  return { folder: resolve(folder), limit, policy: options.get("policy"), seeds, ablations, adaptive: options.get("adaptive"), freezeWaves };
}

const args = parseArgs();
const candidates: { file: string; replay: Replay; data: GameData; won: boolean }[] = [];
for (const file of readdirSync(args.folder).filter((f) => f.endsWith(".replay.json")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
  const policy = file.replace(/-\d+\.replay\.json$/, "");
  if (args.policy && policy !== args.policy) continue;
  const replay = validateReplay(JSON.parse(readFileSync(join(args.folder, file), "utf8")));
  if (args.seeds && !args.seeds.includes(replay.seed)) continue;
  if (!replay.data) throw new Error(`${file} has no embedded data`);
  if (args.adaptive && replay.initialWave !== undefined)
    throw new Error("Adaptive full-run comparisons require ordinary, non-isolated replays");
  const data = deriveData(replay.data);
  const result = runReplay(data, replay, MAX_TICKS);
  if (replay.finalHash === undefined || replay.finalHash !== result.finalHash)
    throw new Error(`${file} source hash is absent or mismatched`);
  candidates.push({ file, replay, data, won: result.state.outcome === "won" });
}
if (!candidates.length) throw new Error("No matching replays");
let selected = candidates.slice(0, args.limit);
if (!args.seeds) {
  const winners = candidates.filter((c) => c.won);
  const losses = candidates.filter((c) => !c.won);
  selected = [
    ...winners.slice(0, Math.ceil(args.limit / 2)),
    ...losses.slice(0, Math.floor(args.limit / 2)),
  ];
  for (const candidate of candidates)
    if (selected.length < args.limit && !selected.includes(candidate)) selected.push(candidate);
}
const selection = args.seeds
  ? `Explicit seeds ${args.seeds.join(",")}, limit ${args.limit}`
  : `Outcome-stratified diagnostic sample, up to ${Math.ceil(args.limit / 2)} winners and ${Math.floor(args.limit / 2)} non-winners; remaining slots filled in filename order`;
const experimentOut = fileURLToPath(new URL("./out/", import.meta.url));
const sourceRelative = relative(experimentOut, args.folder);
// Nested engine batches share leaf names such as medium/raid. Preserve their
// batch path so later candidates cannot overwrite another candidate's evidence.
const sourceFolder = sourceRelative.startsWith("..") || isAbsolute(sourceRelative)
  ? basename(args.folder) : sourceRelative;
const out = join(experimentOut, "judge", sourceFolder);
mkdirSync(out, { recursive: true });
function analyzeInput(input: (typeof selected)[number]) {
  const stem = input.file.replace(/\.replay\.json$/, "");
  const telemetryStem = args.adaptive ? `${stem}.adaptive-${args.adaptive}` : stem;
  const witnessDir = join(out, stem);
  mkdirSync(witnessDir, { recursive: true });
  let witnessCount = 0;
  function persist(name: string, witness: ExplorationWitness) {
    if (!witness.replayVerified) throw new Error(`Unverified witness: ${stem}/${name}`);
    const { replay, ...metrics } = witness;
    const filename = `${name}.replay.json`;
    writeFileSync(join(witnessDir, filename), JSON.stringify(replay));
    witnessCount++;
    return { ...metrics, replayFile: `${stem}/${filename}` };
  }
  const report = analyzeExploration(input.data, input.replay, { freezeWaves: args.freezeWaves });
  if (!report.verification.matchesExpectedHash || !report.verification.matchesIndependentReplay)
    throw new Error(`Exploration source mismatch: ${stem}`);
  const rerolls: { tick: number; gold: number; count: number }[] = [];
  const builds: Record<string, number> = {};
  let upgrades = 0;
  runReplay(input.data, input.replay, MAX_TICKS, (tick, events) => {
    for (const event of events) {
      if (event.kind === "reroll") rerolls.push({ tick, gold: event.gold, count: event.count });
      if (event.kind === "build") builds[event.type] = (builds[event.type] ?? 0) + 1;
      if (event.kind === "upgrade") upgrades++;
    }
  });
  const compact = {
    ...report,
    original: persist("original", report.original),
    noPatches: persist("no-patches", report.noPatches),
    frozenDefense: report.frozenDefense.map((f) => ({
      ...f,
      result: f.result ? persist(`freeze-${f.afterWave}`, f.result) : null,
    })),
    choiceBranches: report.choiceBranches.map((branch, i) => ({
      ...branch,
      alternatives: branch.alternatives.map((alternative, j) => ({
        ...alternative,
        result: persist(`choice-${i + 1}-${j + 1}`, alternative.result),
      })),
    })),
    ablations: Object.fromEntries(args.ablations.map((name) => [name, persist(name, ablate(input.replay, name))])),
  };
  const wave12 = report.waves.find((w) => w.wave === 12 && w.completed);
  const noBuildsAfter12 = wave12 ? persist("no-builds-after-12", simulateWitness(
    input.replay, input.data,
    input.replay.commands.filter((c) => c.tick < wave12.tick || c.cmd.kind !== "build"),
    "no-builds-after-12",
  )) : null;
  const adaptive = args.adaptive ? Object.fromEntries((["baseline", ...args.ablations] as const).map((name) => {
    const data = name === "baseline" ? input.data : ablationData(input.replay, name);
    const result = runPolicy(data, makePolicy(args.adaptive!), input.replay.seed);
    return [name, persist(`adaptive-${args.adaptive}-${name}`, simulateWitness(
      result.replay, data, result.replay.commands, `adaptive-${args.adaptive}-${name}`,
    ))];
  })) : null;
  const zeroRejectChoices = compact.choiceBranches.flatMap((b) => b.alternatives)
    .filter((a) => !a.wasOriginal && a.result.rejections.length === 0 && compact.original.rejections.length === 0);
  const row = {
    file: input.file,
    seed: input.replay.seed,
    dataVersion: input.replay.dataVersion,
    offerCount: input.data.relicRules.offerCount,
    outcome: compact.original.outcome,
    waves: compact.original.wavesCleared,
    lives: compact.original.lives,
    originalRejections: compact.original.rejections.length,
    purchases: { builds, upgrades, rerolls, rerollGold: rerolls.reduce((n, r) => n + r.gold, 0) },
    patches: compact.patchDecisions.map((d) => ({ wave: d.afterWave, chosen: d.chosen, offers: d.offers })),
    freeze: compact.frozenDefense.map((f) => ({ after: f.afterWave, outcome: f.result?.outcome ?? null, waves: f.result?.wavesCleared ?? null, lives: f.result?.lives ?? null })),
    ablations: Object.fromEntries(Object.entries(compact.ablations).map(([name, result]) => [name, {
      outcome: result.outcome, waves: result.wavesCleared, lives: result.lives,
      rejections: result.rejections.length,
      winToLoss: compact.original.outcome === "won" && result.outcome === "lost",
    }])),
    noPatchCommands: { outcome: compact.noPatches.outcome, waves: compact.noPatches.wavesCleared, rejections: compact.noPatches.rejections.length },
    choices: {
      alternatePicks: compact.choiceBranches.reduce((n, b) => n + b.alternatives.filter((a) => !a.wasOriginal).length, 0),
      zeroRejectionAlternatives: zeroRejectChoices.length,
      zeroRejectionOutcomeChanges: zeroRejectChoices.filter((a) => a.result.outcome !== compact.original.outcome).length,
      zeroRejectionWaveChanges: zeroRejectChoices.filter((a) => a.result.wavesCleared !== compact.original.wavesCleared).length,
      zeroRejectionLivesChanges: zeroRejectChoices.filter((a) => a.result.lives !== compact.original.lives).length,
    },
    noBuildsAfter12: noBuildsAfter12 ? {
      outcome: noBuildsAfter12.outcome, waves: noBuildsAfter12.wavesCleared,
      lives: noBuildsAfter12.lives, rejections: noBuildsAfter12.rejections.length,
      replayFile: noBuildsAfter12.replayFile,
    } : null,
    adaptive: adaptive ? Object.fromEntries(Object.entries(adaptive).map(([name, result]) => [name, {
      outcome: result.outcome, waves: result.wavesCleared, lives: result.lives,
      gold: result.gold, goldSpent: result.goldSpent, rejections: result.rejections.length,
      replayFile: result.replayFile,
    }])) : null,
    wave12: compact.waves.filter((w) => w.wave === 12).map((w) => ({
      completed: w.completed, lives: w.lives, bank: w.bank, goldSpent: w.goldSpent,
      spendByType: w.spendByType, nearestSurvivorCells: w.nearestSurvivorCells,
      relics: w.relics,
    }))[0] ?? null,
    witnessCount,
    telemetryFile: `${telemetryStem}.telemetry.json`,
  };
  writeFileSync(join(out, `${telemetryStem}.telemetry.json`), JSON.stringify({ ...compact, noBuildsAfter12, adaptive }, null, 2));
  console.log(JSON.stringify(row));
  return row;
}
const rows = selected.map(analyzeInput);
const summary = {
  source: args.folder,
  selection,
  caveat: "Diagnostic selection is not a population estimate. Ablations keep offered IDs, commands, purchase/reroll/sacrifice costs, and baseline economy interest. Neutral-patches removes ALL patch benefits including poison, confusion, and hit-slow duration; native tower/coating benefits remain. No-coatings keeps support direct hits and patch delivery but removes wet/oil setup. No-builds-after-12 removes only later build commands, retaining scheduled wave calls, patches, and other inputs; unlike a frozen defense, its call timing remains fixed. Later inputs are fixed, not adaptive; rejection counts and changed timing qualify causal interpretation. Neutral patches may lower the configured enemy response through existing rules. Simulated outcomes do not certify subjective fun.",
  inputCandidates: candidates.length,
  freezeWaves: args.freezeWaves,
  selected: rows.length,
  originalWins: rows.filter((r) => r.outcome === "won").length,
  adaptiveMethod: args.adaptive ? `Policy ${args.adaptive} reruns each embedded configuration from tick zero with the same seed, including a fresh baseline. These are reoptimized heuristic witnesses, not an optimal player or a checkpoint fork. Costs remain in force. Forced policies retain their named-drop preference even when that effect is neutralized, so they can choose a disabled drop; this may understate alternative-drop success.` : null,
  adaptiveWins: args.adaptive ? Object.fromEntries(["baseline", ...args.ablations].map((name) => [name, rows.filter((r) => r.adaptive?.[name]?.outcome === "won").length])) : null,
  engineDependenceWinToLoss: Object.fromEntries(args.ablations.map((name) => [name, rows.filter((r) => r.ablations[name]!.winToLoss).length])),
  zeroRejectionChoiceOutcomeChanges: rows.reduce((n, r) => n + r.choices.zeroRejectionOutcomeChanges, 0),
  zeroRejectionChoiceAlternatives: rows.reduce((n, r) => n + r.choices.zeroRejectionAlternatives, 0),
  witnessCount: rows.reduce((n, r) => n + r.witnessCount, 0),
  rows,
};
const suffix = [args.policy, args.seeds ? `seeds-${args.seeds.join("-")}` : `sample-${args.limit}`, args.adaptive ? `adaptive-${args.adaptive}` : undefined].filter(Boolean).join("-");
const summaryFile = join(out, `summary-${suffix}.json`);
writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ summaryFile, ...summary, rows: undefined }));
