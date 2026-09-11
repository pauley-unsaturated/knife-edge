/**
 * Balance CLI.
 *   pnpm balance run    --policy greedy --seeds 1..50 [--data data/game.json] [--out experiments/x/out]
 *   pnpm balance replay --file experiments/x/out/greedy-7.replay.json
 * Every run writes a replay file when --out is given, so any claim is watchable later.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deriveData, runReplay, type RawGameData, type Replay } from "@knife-edge/sim";
import { makePolicy } from "./policies/index.js";
import { runPolicy, summarize, type RunSummary } from "./runner.js";

function parseArgs(argv: string[]): { cmd: string; opts: Record<string, string> } {
  const [cmd = "run", ...rest] = argv;
  const opts: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] as string;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        opts[key] = next;
        i++;
      } else opts[key] = "true";
    }
  }
  return { cmd, opts };
}

function parseSeeds(spec: string): number[] {
  const m = /^(\d+)\.\.(\d+)$/.exec(spec);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }
  return spec.split(",").map(Number);
}

/** Apply `--set a.b.c=value` overrides (numbers parsed; arrays addressed by index, e.g. towers.0.cost). */
function applyOverrides(raw: RawGameData, sets: string[]): RawGameData {
  for (const spec of sets) {
    const eq = spec.indexOf("=");
    if (eq < 0) throw new Error(`bad --set ${spec}`);
    const path = spec.slice(0, eq).split(".");
    const valueStr = spec.slice(eq + 1);
    const value = valueStr === "" || Number.isNaN(Number(valueStr)) ? valueStr : Number(valueStr);
    let node: Record<string, unknown> = raw as unknown as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      const next = node[path[i] as string];
      if (typeof next !== "object" || next === null) throw new Error(`no such path ${spec}`);
      node = next as Record<string, unknown>;
    }
    const leaf = path[path.length - 1] as string;
    if (!(leaf in node)) throw new Error(`no such key ${spec}`);
    node[leaf] = value;
  }
  return raw;
}

function loadData(path: string, sets: string[] = []) {
  const raw = applyOverrides(JSON.parse(readFileSync(path, "utf8")) as RawGameData, sets);
  if (sets.length) raw.version = `${raw.version}+${sets.join(",")}`;
  return deriveData(raw);
}

const { cmd, opts } = parseArgs(process.argv.slice(2));
const dataPath = opts["data"] ?? "data/game.json";
const sets = opts["set"] ? opts["set"].split(";") : [];

if (cmd === "run") {
  const data = loadData(dataPath, sets);
  const policies = (opts["policy"] ?? "greedy").split(",");
  const seeds = parseSeeds(opts["seeds"] ?? "1..20");
  const out = opts["out"];
  if (out) mkdirSync(out, { recursive: true });
  const started = Date.now();
  for (const pname of policies) {
    const policy = makePolicy(pname);
    const results: RunSummary[] = [];
    for (const seed of seeds) {
      const r = runPolicy(data, policy, seed);
      results.push(r);
      if (out) {
        writeFileSync(join(out, `${pname}-${seed}.replay.json`), JSON.stringify(r.replay));
        const { replay: _r, ...row } = r;
        writeFileSync(join(out, `${pname}.jsonl`), JSON.stringify(row) + "\n", { flag: "a" });
      }
    }
    const rep = summarize(results);
    console.log(JSON.stringify({ data: data.version, ...rep }));
    if (opts["verbose"]) for (const r of results) console.log(`  seed ${r.seed}: ${r.outcome} waves=${r.wavesCleared} min=${r.minutesAt1x} gold=${r.gold} towers=${r.towers} interest=${r.interestEarned} early=${r.earlyBonusEarned}`);
  }
  console.error(`done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
} else if (cmd === "replay") {
  const data = loadData(dataPath);
  const replay = JSON.parse(readFileSync(opts["file"] as string, "utf8")) as Replay;
  const r = runReplay(data, replay, Number(opts["maxTicks"] ?? 400_000));
  console.log(JSON.stringify({ outcome: r.state.outcome, wave: r.state.wave, ticks: r.ticks, finalHash: r.finalHash, waveHashes: r.waveHashes }));
} else {
  console.error("usage: balance run|replay ...");
  process.exit(2);
}
