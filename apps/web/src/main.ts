import {
  canBuild,
  composeWave,
  deriveData,
  enemyHpAtWave,
  heatHpBp,
  spawnInterval,
  interestAtStart,
  interestTerms,
  rerollCost,
  stackedRelics,
  mulBp,
  towerAt,
  towerDamage,
  validateReplay,
  withDifficulty,
  type Command,
  type Difficulty,
  type RawGameData,
  type TargetPriority,
} from "@knife-edge/sim";
import { mountBoard, Session, towerColors } from "@knife-edge/render-phaser";
import "./style.css";

declare const __GAME_DATA__: RawGameData;
declare const __GAME_MODES__: Record<string, RawGameData>;
const raw = __GAME_DATA__;
const modes = { raid: raw, ...__GAME_MODES__ };
const modeNames: Record<string, string> = { raid: "Raid / Heat", compound: "Compound engine", pact: "Glass cannon" };
const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;
const escape = (v: string): string =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const descriptions: Record<string, string> = {
  bolt: "Reliable single-target damage. Strong against swifts; weak against armor.",
  ember: "Melts armor. Expensive upgrades scale into heavy damage.",
  frost:
    "Slows enemies to 55% speed. Give your other towers more time to fire.",
  mortar:
    "Hits up to 5 nearby enemies. Best when a maze bunches them together.",
  arc: "Hits up to 3 nearby enemies. Adjacent arcs gain 15% damage each.",
  lens: "Long range. Exposes shades so nearby towers can deal full damage.",
  relay:
    "Nearby towers gain 20% damage per relay level. Strongest aura applies.",
  sprayer: "Soaks nearby enemies: Arc hits deal 50% more and Frost slows harder. Overlap their firing lanes. More range with upgrades.",
  solvent: "Coats nearby enemies in flammable oil. The next Ember hit consumes it for 75% extra damage and a 3-second burn. Overlap Ember's firing lane.",
};

$("app").innerHTML = `
  <header><a class="wordmark" href="/">KNIFE<span> / </span>EDGE</a><span class="edition">PLAYTEST 02 · MECHANIC LAB</span></header>
  <main>
    <section class="setup" aria-label="Run setup"><div><p class="eyebrow">TAKE THE MONEY. INHERIT THE TROUBLE.</p><h1>Find your groove.<br>Break the odds.</h1></div>
      <div class="setup-controls"><label class="mode-choice">Mechanic lab<select id="mode">${Object.keys(modes).map(id => `<option value="${id}">${modeNames[id]}</option>`).join("")}</select></label><label>Difficulty<select id="difficulty"><option value="easy">Easy · find a build</option><option value="medium" selected>Medium · break the odds</option><option value="hard">Hard · earn the miracle</option></select></label><label>Board seed<input id="seed" type="number" min="0" max="4294967295" step="1" value="7"></label><button id="new-run">New run</button><button id="restore" hidden>Resume saved run</button><p id="difficulty-copy">${escape(raw.difficulties.medium.description)}</p></div>
    </section>
    <div class="game-layout">
      <section class="play-area" aria-label="Game board and playback controls">
        <div class="status-strip"><span>WAVE <strong id="wave">0 / 30</strong></span><span>CORE <strong id="lives">20</strong></span><span>GOLD <strong id="gold">120</strong></span><span id="run-label">MEDIUM · SEED 7</span></div>
        <div id="board" tabindex="0" role="application" aria-label="Tower defense board. Arrow keys select a cell. B builds, U upgrades, X sells. Space pauses. N calls the next wave."></div>
        <div class="transport"><button id="pause" class="primary">Start clock <kbd>Space</kbd></button><div class="speed" aria-label="Playback speed"><button data-speed="1" aria-pressed="true">1×</button><button data-speed="2" aria-pressed="false">2×</button><button data-speed="4" aria-pressed="false">4×</button></div><button id="instant">To wave end »</button><span id="clock">0:00</span></div>
        <div id="message" role="status" aria-live="polite">Clock paused. Start with bolts beside the route. Select a cell, then build.</div>
        <section id="result" class="result" hidden><p class="eyebrow">RUN COMPLETE</p><h2 id="result-title"></h2><p id="result-copy"></p><button id="retry">Retry this board</button><button id="result-export">Save replay + notes</button></section>
        <section class="preview"><div><p class="eyebrow" id="preview-label">NEXT WAVE</p><h2 id="preview-title"></h2><p id="preview-copy"></p></div><div class="call"><button id="call" class="primary">Call wave <kbd>N</kbd></button><p id="income"></p></div></section>
        <section id="relic-panel" class="relic-panel" hidden><p class="eyebrow">A BREAK IN THE RULES</p><h2>Choose a patch.</h2><p>These stack. Poison, confusion and explosions get a small extra boost with each copy. The clock pauses while you choose.</p><div id="offers"></div><button id="reroll" hidden></button><p id="reroll-copy"></p></section>
        <section id="raid-panel" class="raid-panel" aria-labelledby="raid-title"><div class="raid-heading"><div><p class="eyebrow">RAID OR CONTAIN</p><h2 id="raid-title">A little trouble money.</h2></div><strong id="heat"></strong></div><p id="raid-copy"></p><div id="hideouts"></div><p id="raid-timing"></p></section>
      </section>
      <aside aria-label="Build and inspect"><div class="aside-heading"><h2>Your defense</h2><span id="shop-keys">KEYS 1–9</span></div><div id="shop"></div>
        <section class="inspector"><p class="eyebrow" id="selection-label">SELECT A CELL</p><h2 id="selection-title">Make the route work.</h2><p id="selection-copy">Towers block the path. Enemies take the shortest open route to your core.</p><div class="build-actions"><button id="build" class="primary" disabled>Build <kbd>B</kbd></button><button id="upgrade" disabled>Upgrade <kbd>U</kbd></button><button id="sell" disabled>Sell <kbd>X</kbd></button></div><label id="target-label" hidden>Target priority<select id="target"><option value="first">First · closest to core</option><option value="last">Last · farthest from core</option><option value="strongest">Strongest · most HP</option><option value="weakest">Weakest · least HP</option></select></label></section>
        <section class="bank"><p class="eyebrow">YOUR ENGINE</p><p id="engine"></p><p id="bank-copy"></p><p id="patches"></p></section>
      </aside>
    </div>
    <details class="howto"><summary>How to play & what to test</summary><div><p>Keep enemies away from the core on the right. Towers are walls: bend the route through your firing ranges, but leave a path open. Select a tower with 1–9; click a cell then Build (B), or click it again. Upgrade (U), sell (X), and change targets in the inspector. Space pauses; N calls the next wave. Building during combat is allowed.</p><p>The new prototypes have 18 waves. The first is forgiving; waves 2–3 demand attention. Enemy pressure grows geometrically while ordinary bounty income flattens. Expect the late-game wall around wave 12: assemble an engine before it catches you. Speed controls and “To wave end” are always fair game.</p><p>Drops suggest a direction, not a locked class. Cold Front wants overlapping Frost coverage; Chain Reaction wants a first kill in a crowd; type boosts reward committing upgrades. In Compound, save only what your defense can afford. In Glass Cannon, sacrificing core before finding Last Stand can end the run. Sprayer water amplifies Arc hits and Frost slows; Solvent oil ignites on the next Ember hit. Poison can be maintained by weaker hits after a heavy dose. Blue/gold side marks mean wet/oiled; green/purple marks mean poisoned/confused; an orange ring means burning. Rerolls spend gold you could use for towers. Read each offer: effects and timing differ by prototype.</p><ol><li>Try Medium Raid / Heat. Does wave 2 ask for a different decision than wave 1?</li><li>Let the first two drops guide your towers. At the third, deepen the engine or pivot—what did you give up?</li><li>Raid one dangerous source, then retry without that raid. Was the payout worth stronger remaining enemies?</li><li>Try Compound and Glass Cannon. Note the exact wave an investment or risky pact paid off—or killed you.</li><li>Try Easy and Hard on the same board. Save a win and a loss with notes about whether you felt powerful, cornered, or merely unlucky.</li></ol></div></details>
    <section class="playtest"><div><p class="eyebrow">HELP FIND THE FUN</p><h2>What put you on the edge?</h2><p>Save a replay with your notes so we can reproduce the exact run.</p></div><div><label for="notes">Playtest notes</label><textarea id="notes" rows="3" placeholder="Wave / decision / what felt good or unfair / what you expected…"></textarea><div class="file-actions"><button id="export">Save replay + notes</button><label class="file-button">Watch a replay<input id="import" type="file" accept=".json,application/json"></label><button id="replay-restart" hidden>Restart replay</button></div><p id="verification"></p></div></section>
    <footer>Placeholder shapes. Real simulation. <span id="version"></span></footer>
  </main>`;

let difficulty: Difficulty = "medium";
let session = new Session(deriveData(withDifficulty(raw, difficulty)), 7);
let selectedCell = -1,
  selectedType = "bolt",
  instantTarget = 0,
  uiElapsed = 0;
let raidKey = "";
let previewKey = "",
  offersKey = "",
  newArmed = false;
let savedText: string | null = null;
const saveKey = "knife-edge-demo-1-save";
try {
  savedText = localStorage.getItem(saveKey);
} catch {
  /* Private browsing can disable storage. */
}
$("restore").hidden = !savedText;

function say(text: string): void {
  $("message").textContent = text;
}
function save(): void {
  if (session.replay || !session.state.tick) return;
  try {
    savedText = JSON.stringify({
        ...session.export(),
        difficulty,
        notes: $<HTMLTextAreaElement>("notes").value,
      });
    localStorage.setItem(saveKey, savedText);
  } catch {
    $("verification").textContent =
      "Autosave unavailable. Use Save replay to keep this run.";
  }
}
function connect(): void {
  session.onEvents = (events) => {
    for (const e of events) {
      if (e.kind === "rejected") say(`Cannot do that: ${e.reason}.`);
      if (e.kind === "build")
        say(
          `${e.type.toUpperCase()} built. The route updates around your towers.`,
        );
      if (e.kind === "upgrade") say(`Tower upgraded to level ${e.level}.`);
      if (e.kind === "sell") say(`Tower sold for ${e.refund} gold.`);
      if (e.kind === "raid") say(`Hideout raided: +${e.gold} gold. Heat ${e.heat}. That enemy source is closed; the others get stronger.`);
      if (e.kind === "leak")
        say(
          "An enemy reached the core. Extend coverage or check the next wave's counter.",
        );
      if (e.kind === "waveStart")
        say(
          `Wave ${e.wave}: +${e.earlyBonus} early call, +${e.interest} interest.`,
        );
      if (e.kind === "waveEnd") {
        say(`Wave ${e.wave} cleared. Take a breath and check what's next.`);
        if (!session.replay && session.state.relicOffers.length) {
          say(`Wave ${e.wave} cleared. Clock paused: choose a patch for your next move.`);
          requestAnimationFrame(() => { render(); $("relic-panel").scrollIntoView({ block: "nearest" }); });
        }
        save();
      }
    }
  };
}
connect();

function command(cmd: Command): void {
  if (instantTarget) return;
  session.command(cmd);
  save();
  render();
}
function newRun(force = false): void {
  if (
    !force &&
    session.state.tick > 0 &&
    session.state.outcome === "playing" &&
    !newArmed
  ) {
    session.paused = true;
    newArmed = true;
    $("new-run").textContent = "Confirm new run";
    say(
      "Current run paused. Save it if you want to keep it, then confirm a new run.",
    );
    return;
  }
  const seed = Number($<HTMLInputElement>("seed").value);
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    $<HTMLInputElement>("seed").value.trim() === ""
  ) {
    say("Enter a whole-number seed from 0 to 4294967295.");
    return;
  }
  difficulty = $<HTMLSelectElement>("difficulty").value as Difficulty;
  const modeData = modes[$<HTMLSelectElement>("mode").value as keyof typeof modes] ?? raw;
  session = new Session(deriveData(withDifficulty(modeData, difficulty)), seed);
  selectedCell = -1;
  selectedType = "bolt";
  instantTarget = 0;
  newArmed = false;
  previewKey = "";
  offersKey = "";
  $("new-run").textContent = "New run";
  $<HTMLTextAreaElement>("notes").value = "";
  connect();
  shop();
  render();
  say("Clock paused. Build beside the route, then start when you're ready.");
}
function shop(): void {
  $("shop-keys").textContent = `KEYS 1–${session.data.towers.length}`;
  $("shop").innerHTML = session.data.towers
    .map(
      (t, i) =>
        `<button class="tower-choice" data-tower="${escape(t.id)}" aria-pressed="${selectedType === t.id}"><span class="tower-swatch" style="--tower:#${(towerColors[t.id] ?? 0xe4bd65).toString(16)}">${i + 1}</span><span>${escape(t.id.toUpperCase())}<small>${escape(t.damageType)}</small></span><span>${t.cost}<small>gold</small></span></button>`,
    )
    .join("");
}
function select(cell: number): void {
  if (cell === selectedCell && !towerAt(session.state, cell) && !session.replay)
    command({ kind: "build", cell, type: selectedType });
  selectedCell = cell;
  render();
}
function togglePause(): void {
  if (
    (!session.replay && session.state.relicOffers.length > 0) ||
    instantTarget ||
    session.state.outcome !== "playing" ||
    (session.replay?.endTick !== undefined &&
      session.state.tick >= session.replay.endTick)
  )
    return;
  session.paused = !session.paused;
  render();
}
function exportRun(): void {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          ...session.export(),
          notes: $<HTMLTextAreaElement>("notes").value,
          difficulty,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `knife-edge-${session.state.seed}-wave${session.state.wave}.replay.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  say("Replay saved with your notes and the exact game data.");
}
function render(): void {
  const s = session.state,
    data = session.data,
    locked = !!session.replay || !!instantTarget || s.outcome !== "playing";
  $("wave").textContent = `${s.wave} / ${data.economy.maxWaves}`;
  $("lives").textContent = String(Math.max(0, s.lives));
  $("gold").textContent = String(s.gold);
  $("run-label").textContent =
    `${session.replay ? "REPLAY" : data.version.split("/").at(-1)?.toUpperCase()} · SEED ${s.seed}`;
  $("clock").textContent =
    `${Math.floor(s.tick / 1200)}:${String(Math.floor(s.tick / 20) % 60).padStart(2, "0")}`;
  $("pause").innerHTML =
    `${session.paused ? (s.tick === 0 && !session.replay ? "Start clock" : "Resume") : "Pause"} <kbd>Space</kbd>`;
  $<HTMLButtonElement>("pause").disabled =
    !!instantTarget ||
    (!session.replay && s.relicOffers.length > 0) ||
    s.outcome !== "playing" ||
    (session.replay?.endTick !== undefined && s.tick >= session.replay.endTick);
  $("board").setAttribute(
    "aria-label",
    `Board seed ${s.seed}. Wave ${s.wave}, ${s.gold} gold, ${Math.max(0, s.lives)} core. ${selectedCell >= 0 ? `Selected column ${(selectedCell % s.grid.width) + 1}, row ${Math.floor(selectedCell / s.grid.width) + 1}.` : "Arrow keys select a cell."} B builds, U upgrades, X sells.`,
  );
  document
    .querySelectorAll<HTMLButtonElement>("[data-speed]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.speed) === session.speed),
      ),
    );
  document.querySelectorAll<HTMLButtonElement>("[data-tower]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.tower === selectedType));
    b.disabled = !!session.replay;
  });
  const t = towerAt(s, selectedCell),
    type = data.towerById.get(t?.type ?? selectedType)!;
  const level = type.ladder[(t?.level ?? 1) - 1]!;
  $("selection-label").textContent =
    selectedCell < 0
      ? "CHOOSE A CELL ON THE BOARD"
      : `COLUMN ${(selectedCell % s.grid.width) + 1} · ROW ${Math.floor(selectedCell / s.grid.width) + 1}`;
  $("selection-title").textContent =
    `${type.id.toUpperCase()}${t ? ` · LEVEL ${t.level}` : ""}`;
  $("selection-copy").textContent =
    `${descriptions[type.id] ?? type.damageType} ${level.damage} damage / ${(level.cooldownTicks / data.economy.tickRate).toFixed(1)}s · ${(level.rangeFp / 1024).toFixed(1)} range.`;
  if (t) $("selection-copy").textContent += ` Current hit: ${towerDamage(data, s, t)} before enemy matchup and slow bonuses.`;
  const check =
    selectedCell >= 0
      ? canBuild(s, selectedCell)
      : { ok: false, reason: "select a cell" };
  if (!t && !check.ok)
    $("selection-copy").textContent += ` Cannot build here: ${check.reason}.`;
  $<HTMLButtonElement>("build").disabled =
    locked || !!t || !check.ok || s.gold < type.cost;
  $("build").textContent = t ? "Built" : `Build · ${type.cost}g`;
  $("build").title = check.ok ? "Build selected tower (B)" : check.reason;
  const next = t ? type.ladder[t.level] : undefined;
  $<HTMLButtonElement>("upgrade").disabled =
    locked || !next || s.gold < next.cost;
  $("upgrade").textContent =
    t && !next ? "Max level" : `Upgrade${next ? ` · ${next.cost}g` : ""}`;
  $<HTMLButtonElement>("sell").disabled = locked || !t;
  $("sell").textContent =
    `Sell${t ? ` · +${mulBp(t.spent, data.economy.sellRefundBp)}g` : ""}`;
  $("target-label").hidden = !t;
  if (t) $<HTMLSelectElement>("target").value = t.priority;
  $<HTMLSelectElement>("target").disabled = locked;
  const nextWave = Math.min(data.economy.maxWaves, s.wave + 1),
    key = `${data.version}/${s.seed}/${nextWave}/${s.raided?.join(",")}`;
  if (previewKey !== key) {
    previewKey = key;
    const specs = composeWave(data, s.seed, nextWave, s.raided),
      counts = new Map<string, number>();
    for (const e of specs) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    $("preview-title").textContent =
      `Wave ${nextWave}${data.composer.riddleEvery && nextWave % data.composer.riddleEvery === 0 ? " · counter check" : ""}`;
    const maxHp = Math.max(
      ...specs.map(
        (e) =>
          mulBp(enemyHpAtWave(data, data.enemyById.get(e.type)!, nextWave) * e.tier, heatHpBp(data, s)),
      ),
    );
    $("preview-copy").textContent =
      `${Array.from(counts, ([id, n]) => `${n} ${id}`).join(" · ")} · up to ${maxHp} HP · one every ${(spawnInterval(data, s) / data.economy.tickRate).toFixed(2)}s. ${counts.has("armored") ? "Bring Ember for armor. " : ""}${counts.has("shade") ? "Lens exposes shades. " : ""}${counts.has("swift") ? "Frost buys time against swifts." : ""}`;
  }
  $("raid-panel").hidden = !data.raids;
  if (data.raids) {
    const heat = s.raided?.length ?? 0;
    $("heat").textContent = `HEAT ${heat} / ${data.raids.hideouts.length}`;
    $("heat").dataset.hot = String(heat > 0);
    $("raid-copy").textContent = `Each raid pays once and removes that enemy type from future waves. Each also adds ${data.raids.hpPerRaidBp / 100}% enemy HP and ${data.raids.hastePerRaidBp / 100}% spawn rate for the rest of the run. Permanent. Current HP: ${heatHpBp(data, s) / 100}% of base.`;
    $("raid-timing").textContent = s.wave === 0 ? "Survive wave 1 to unlock raids." : s.inWave ? "Raids open between waves. Pause then to weigh the deal." : "Optional. Keep the hideouts open, or take one payout and prepare for retaliation.";
    const disabled = locked || s.inWave || s.wave < 1;
    const key = `${data.version}/${heat}/${disabled}/${s.raided?.join(",")}`;
    if (raidKey !== key) {
      raidKey = key;
      $("hideouts").innerHTML = data.raids.hideouts.map(h => {
        const closed = s.raided?.includes(h.id);
        return `<button data-raid="${escape(h.id)}" ${disabled || closed ? "disabled" : ""}><span><strong>${escape(h.name)}</strong><small>${closed ? "Shut down for this run" : `Remove ${escape(h.enemy)} · add 1 heat`}</small></span><span>${closed ? "RAIDED" : `Raid · +${h.gold}g`}</span></button>`;
      }).join("");
    }
  }
  $("preview-label").textContent =
    s.wave >= data.economy.maxWaves ? "FINAL WAVE" : "NEXT WAVE · PLAN AHEAD";
  const bonus = s.inWave
    ? 0
    : Math.floor(
        (s.waveTimer * data.economy.earlyCallBonusPerSec) /
          data.economy.tickRate,
      );
  $<HTMLButtonElement>("call").disabled =
    locked || s.inWave || s.relicOffers.length > 0 || s.wave >= data.economy.maxWaves;
  $("call").textContent = s.inWave
    ? "Wave in progress"
    : `Call wave · +${bonus}g`;
  $("income").textContent = s.inWave
    ? `${s.enemies.length} on board · ${s.spawnQueue.length} to spawn`
    : `Auto in ${Math.ceil(s.waveTimer / 20)}s · then +${interestAtStart(data, s, bonus)}g interest`;
  $<HTMLButtonElement>("instant").disabled =
    !!instantTarget ||
    s.outcome !== "playing" ||
    (!s.inWave && !session.replay) ||
    (session.replay?.endTick !== undefined && s.tick >= session.replay.endTick);
  $("instant").textContent = instantTarget ? "Advancing…" : "To wave end »";
  const { rate: interestRate, cap: bankCap } = interestTerms(data, s);
  const slowBonus = s.relics.reduce((n, id) => n * data.relics.find(r => r.id === id)!.slowDamageBp / 10000, 1);
  const effects = stackedRelics(data, s.relics);
  const burst = effects.reduce((n, r) => n + (r.deathBurstBp ?? 0), 0);
  const conditional = s.relics.filter(id => (data.relics.find(r => r.id === id)!.lowLifeDamageBp ?? 10000) > 10000);
  const typed = ["ember", "arc"].map(id => {
    const damageType = data.towerById.get(id)?.damageType;
    const power = s.relics.reduce((n, id) => { const r = data.relics.find(r => r.id === id)!; return n * (r.damageType === damageType ? r.damageBp / 10000 : 1); }, 1);
    return power > 1 ? `${id.toUpperCase()} ×${power.toFixed(2)}` : "";
  });
  $("engine").textContent = [...typed, slowBonus > 1 ? `Slowed targets ×${slowBonus.toFixed(2)} damage${(s.towers.some(t => t.type === "frost") || effects.some(r => r.hitSlowTicks)) ? "" : " — needs Frost or Black Ice"}` : "", burst ? `Death explosions: ${burst / 100}% max HP` : "", conditional.length ? `${conditional.length} Last Stand stack(s): ${s.lives <= 4 ? "ACTIVE" : "waiting for 4 core"}` : "", s.relics.some(id => data.relics.find(r => r.id === id)!.interestRateMultiplierBp) ? `Compound engine: +${interestAtStart(data, s)}g at the current bank` : ""].filter(Boolean).join(" · ") || "No engine yet. Let your first drops suggest a direction.";
  const statuses = [effects.some(r => r.poisonDamageBp) ? `Poison dose ${effects.reduce((n, r) => n + (r.poisonDamageBp ?? 0), 0) / 100}% hit damage` : "", effects.some(r => r.confusionDamageBp) ? `Mutiny ${effects.reduce((n, r) => n + (r.confusionDamageBp ?? 0), 0) / 100}% max HP / strike` : "", effects.some(r => r.hitSlowBp) ? "Black Ice enables slowed-target bonuses" : "", s.towers.some(t => t.type === "sprayer") ? "Water + Arc / Frost: overlap lanes" : "", s.towers.some(t => t.type === "solvent") ? "Oil + Ember: overlap lanes" : ""].filter(Boolean);
  if (statuses.length) $("engine").textContent += ` · ${statuses.join(" · ")}`;
  $("bank-copy").textContent =
    `${interestRate / 100}% interest on up to ${bankCap}g at each wave start. Earned so far: ${s.stats.interestEarned}g interest + ${s.stats.earlyBonusEarned}g early calls.`;
  $("patches").textContent = s.relics.length
    ? `Patches: ${s.relics.map((id) => data.relics.find((r) => r.id === id)!.name).join(" + ")}`
    : `No patches yet. First offer after wave ${data.relicRules.firstOfferWave ?? data.relicRules.everyWaves}.`;
  $("relic-panel").hidden = !s.relicOffers.length || !!session.replay;
  const offerKey = `${data.version}/${s.relicOffers.join(",")}/${s.relics.join(",")}`;
  if (offersKey !== offerKey) {
    offersKey = offerKey;
    $("offers").innerHTML = s.relicOffers
      .map((id) => {
        const r = data.relics.find((r) => r.id === id)!;
        const copies = s.relics.filter(owned => owned === id).length;
        const rarity = r.offerWeight === 1 ? "Rare" : r.offerWeight === 2 ? "Uncommon" : "Common";
        return `<button data-relic="${escape(id)}"><small>${rarity}${copies ? ` · copy ${copies + 1}` : ""}</small><strong>${escape(r.name)}</strong><span>${escape(r.description)}</span></button>`;
      })
      .join("");
  }
  document.querySelectorAll<HTMLButtonElement>("[data-relic]").forEach(b => {
    const r = data.relics.find(r => r.id === b.dataset.relic)!;
    const unaffordable = s.lives <= (r.sacrificeLives ?? 0);
    b.disabled = locked || unaffordable;
    b.title = unaffordable ? "Not enough core: this pact would end the run." : "";
  });
  const price = rerollCost(data, s);
  const reroll = $<HTMLButtonElement>("reroll");
  reroll.hidden = data.relicRules.rerollBaseGold === undefined;
  reroll.disabled = locked || s.inWave || !s.relicOffers.length || price === null || s.gold < price;
  reroll.textContent = price === null ? "No rerolls left this offer" : `Reroll all offers · ${price} gold`;
  $("reroll-copy").textContent = reroll.hidden ? "" : `${s.offerRerolls ?? 0}/${data.relicRules.maxRerolls} used. The price rises each time; it resets at the next drop. Spend your defense budget carefully.`;
  $("result").hidden = s.outcome === "playing" || !!session.replay;
  if (s.outcome !== "playing") {
    $("result-title").textContent =
      s.outcome === "won" ? "The line held." : "The edge found you.";
    $("result-copy").textContent =
      `${s.stats.wavesCleared} waves cleared · ${s.stats.kills} enemies stopped · ${s.stats.leaks} leaks. ${s.outcome === "lost" ? "Try the same board and change one decision." : "Try the next difficulty with the same seed."}`;
  }
  $("replay-restart").hidden = !session.replay;
  $("verification").textContent = session.verification;
  $("version").textContent = data.version;
  const runMode = Object.keys(modes).find(id => data.version.startsWith(modes[id as keyof typeof modes].version));
  $("patches").textContent += runMode === "pact" ? ` Core ${s.lives}: ${s.lives <= 4 ? "Last Stand is LIVE." : "Last Stand activates at 4 core."}` : "";
}

$("shop").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tower]");
  if (b) {
    selectedType = b.dataset.tower!;
    render();
  }
});
$("offers").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-relic]");
  if (b) {
    command({ kind: "pickRelic", id: b.dataset.relic! });
    say("Patch installed. Resume the clock when you're ready.");
  }
});
$("hideouts").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-raid]");
  if (b && !b.disabled) command({ kind: "raid", id: b.dataset.raid! });
});
$("reroll").onclick = () => {
  command({ kind: "reroll" });
  say("Offers rerolled. Your next wave and later drops are unchanged.");
};
$("build").onclick = () =>
  command({ kind: "build", cell: selectedCell, type: selectedType });
$("upgrade").onclick = () => command({ kind: "upgrade", cell: selectedCell });
$("sell").onclick = () => command({ kind: "sell", cell: selectedCell });
$("target").onchange = () =>
  command({
    kind: "target",
    cell: selectedCell,
    priority: $<HTMLSelectElement>("target").value as TargetPriority,
  });
$("pause").onclick = togglePause;
$("call").onclick = () => {
  command({ kind: "callWave" });
};
$("new-run").onclick = () => newRun();
$("retry").onclick = () => {
  $<HTMLInputElement>("seed").value = String(session.state.seed);
  $<HTMLSelectElement>("difficulty").value = difficulty;
  const id = Object.keys(modes).find(id => session.data.version.startsWith(modes[id as keyof typeof modes].version));
  if (id) $<HTMLSelectElement>("mode").value = id;
  newRun(true);
};
$("difficulty").onchange = () => {
  $("difficulty-copy").textContent =
    raw.difficulties[$<HTMLSelectElement>("difficulty").value as Difficulty]
      .description + " Applies to the next run.";
};
$("mode").onchange = () => say(`${modeNames[$<HTMLSelectElement>("mode").value]} selected. Applies when you start a new run; this run is unchanged.`);
document.querySelectorAll<HTMLButtonElement>("[data-speed]").forEach(
  (b) =>
    (b.onclick = () => {
      session.speed = Number(b.dataset.speed);
      render();
    }),
);
$("instant").onclick = () => {
  session.paused = true;
  instantTarget = session.state.wave + (session.state.inWave ? 0 : 1);
  render();
};
$("export").onclick = exportRun;
$("result-export").onclick = exportRun;
const exampleButton = document.createElement("button");
exampleButton.textContent = "Watch Raid/Heat example";
exampleButton.id = "example";
$("export").parentElement!.append(exampleButton);
exampleButton.onclick = async () => {
  session.paused = true;
  save();
  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}example.replay.json`,
    );
    if (!response.ok)
      throw new Error("Example replay could not be downloaded.");
    const replay = validateReplay(await response.json());
    const playback = new Session(session.data, replay.seed);
    playback.load(replay);
    session = playback;
    selectedCell = -1;
    instantTarget = 0;
    previewKey = "";
    offersKey = "";
    $<HTMLTextAreaElement>("notes").value = "";
    $("restore").hidden = !savedText;
    connect();
    shop();
    render();
    say(
      `Raid/Heat example loaded: Easy, seed ${replay.seed}, combo-aware strategy. Resume to watch.`,
    );
    $("board").scrollIntoView({ block: "center" });
  } catch (error) {
    say(String(error));
  }
};
$("notes").addEventListener("change", save);
$("restore").onclick = () => {
  try {
    const value = JSON.parse(savedText!);
    const replay = validateReplay(value);
    const restored = new Session(session.data, replay.seed);
    restored.resume(replay);
    session = restored;
    difficulty = (["easy", "medium", "hard"] as const).find(p => session.data.version.endsWith(`/${p}`)) ?? "medium";
    $<HTMLSelectElement>("difficulty").value = difficulty;
    const id = Object.keys(modes).find(id => session.data.version.startsWith(modes[id as keyof typeof modes].version));
    if (id) $<HTMLSelectElement>("mode").value = id;
    $<HTMLInputElement>("seed").value = String(session.state.seed);
    newArmed = false;
    $("new-run").textContent = "New run";
    $<HTMLTextAreaElement>("notes").value =
      typeof value.notes === "string" ? value.notes : "";
    selectedCell = -1;
    instantTarget = 0;
    previewKey = "";
    offersKey = "";
    connect();
    shop();
    render();
    say("Saved run restored and verified. Clock paused.");
    $("restore").hidden = true;
  } catch (error) {
    say(`Could not restore: ${String(error)}`);
  }
};
$("import").addEventListener("change", async () => {
  const input = $<HTMLInputElement>("import"),
    file = input.files?.[0];
  if (!file) return;
  session.paused = true;
  save();
  try {
    if (file.size > 10_000_000)
      throw new Error("Replay file is too large (10 MB limit).");
    const value = JSON.parse(await file.text());
    const replay = validateReplay(value);
    if (
      replay.data &&
      (replay.data.grid.width !== 20 || replay.data.grid.height !== 14)
    )
      throw new Error("This demo viewer supports 20 × 14 boards.");
    const playback = new Session(session.data, replay.seed);
    playback.load(replay);
    session = playback;
    selectedCell = -1;
    instantTarget = 0;
    previewKey = "";
    offersKey = "";
    $<HTMLTextAreaElement>("notes").value =
      typeof value.notes === "string" ? value.notes : "";
    $("restore").hidden = !savedText;
    connect();
    shop();
    render();
    say("Replay loaded. Resume to watch, or advance to the end of a wave.");
  } catch (error) {
    say(`Could not load replay: ${String(error)}`);
  }
  input.value = "";
});
$("replay-restart").onclick = () => {
  if (session.replay) {
    session.load(session.replay);
    instantTarget = 0;
    render();
  }
};
document.addEventListener("keydown", (e) => {
  if (
    (e.target as HTMLElement).matches("input, textarea, select, button") ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  const key = e.key.toLowerCase();
  if (key >= "1" && key <= "9") {
    selectedType = session.data.towers[Number(key) - 1]?.id ?? selectedType;
    render();
  } else if (key === " ") {
    e.preventDefault();
    togglePause();
  } else if (key === "n") $("call").click();
  else if (key === "b" || key === "enter") {
    e.preventDefault();
    $("build").click();
  } else if (key === "u") $("upgrade").click();
  else if (key === "x") $("sell").click();
  else if (key.startsWith("arrow")) {
    e.preventDefault();
    const s = session.state,
      current = Math.max(0, selectedCell),
      x = current % s.grid.width,
      y = Math.floor(current / s.grid.width);
    const nx = Math.max(
      0,
      Math.min(
        s.grid.width - 1,
        x + (key === "arrowright" ? 1 : key === "arrowleft" ? -1 : 0),
      ),
    );
    const ny = Math.max(
      0,
      Math.min(
        s.grid.height - 1,
        y + (key === "arrowdown" ? 1 : key === "arrowup" ? -1 : 0),
      ),
    );
    selectedCell = ny * s.grid.width + nx;
    render();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    session.paused = true;
    save();
    render();
  }
});
window.addEventListener("pagehide", save);
shop();
render();
mountBoard($("board"), {
  get session() {
    return session;
  },
  get selectedCell() {
    return selectedCell;
  },
  get selectedType() {
    return selectedType;
  },
  select,
  frame(delta) {
    if (instantTarget) {
      if (session.advanceToWaveEnd(instantTarget)) {
        instantTarget = 0;
        session.paused = true;
        save();
        render();
      }
    } else session.frame(delta);
    uiElapsed += delta;
    if (uiElapsed >= 100) {
      uiElapsed = 0;
      render();
    }
  },
});
