import type { RawGameData } from "../../packages/sim/src/index.ts";
import { engines } from "./engines.ts";
import type { Variant } from "./variants.ts";

/** Candidate v4: independently tested changes combined before held-out review.
 * This function is not permission to overwrite an existing frozen manifest. */
export function convergence(name: Variant): RawGameData {
  const raw = engines(name);
  raw.version = `demo-4-${name}`;
  raw.composer.hpGrowthBp = name === "compound" ? 10600 : 10700;
  raw.relicRules.offerCount = 2;
  raw.enemies.find(e => e.id === "armored")!.unlockWave = 2;
  Object.assign(raw.towers.find(t => t.id === "ember")!, { damageGrowthBp: 22000, levels: 6 });
  for (const t of raw.towers) if (t.coating) t.preferFreshCoating = true;
  raw.difficulties.easy.defenseCostBp = 7000;
  raw.difficulties.easy.description = "Cheaper defense gives you room to learn the drops. Armor arrives on wave 2: read the preview.";
  raw.difficulties.medium.description = "Build an engine before the wave 12–15 wall. Offers steer your plan; they do not lock it.";
  raw.difficulties.hard.description = "Tight build prices. Strong combinations and a carefully preserved kill zone are essential.";
  return raw;
}
