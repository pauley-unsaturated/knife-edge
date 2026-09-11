import { expect, test } from "@playwright/test";
import { createState, deriveData, makeReplay, runReplay, step, validateReplay, type TimedCommand } from "../../../packages/sim/src/index.js";
import { engines } from "../../../experiments/0004-raid-heat/engines.js";
import { readFileSync } from "node:fs";

// UI fixture, not a balance witness: an explicitly easy opening leaves enough
// legal gold to exercise the entire reroll ladder and reload persistence.
function offerCheckpoint() {
  const raw = engines("raid");
  raw.version += "/ui-fixture";
  raw.grid.obstacles = 0;
  raw.economy.startGold = 250;
  raw.composer.openingBudgets = [10];
  raw.enemies = raw.enemies.map(e => ({ ...e, hp: 1 }));
  raw.relicRules.firstOfferWave = 1;
  const data = deriveData(raw), s = createState(data, 7);
  const commands: TimedCommand[] = [];
  for (const cmd of [{ kind: "build", cell: s.grid.entry - s.grid.width + 1, type: "bolt" }, { kind: "callWave" }] as const) {
    commands.push({ tick: s.tick, cmd }); step(data, s, [cmd]);
  }
  while (!s.relicOffers.length && s.tick < 10000) step(data, s);
  expect(s.relicOffers.length).toBeGreaterThan(0);
  return makeReplay(data, s, commands);
}

test("all three mechanic labs create separate current-rules runs", async ({ page }) => {
  await page.goto("/");
  for (const mode of ["compound", "pact", "raid"]) {
    await page.locator("#mode").selectOption(mode);
    await page.locator("#new-run").click();
    await expect(page.locator("#version")).toHaveText(`demo-4-${mode}/medium`);
    await expect(page.locator("#wave")).toHaveText("0 / 18");
    await expect(page.locator(".tower-choice")).toHaveCount(9);
    if (mode === "raid") await expect(page.locator("#raid-panel")).toBeVisible();
    else await expect(page.locator("#raid-panel")).toBeHidden();
  }
});

test("rare offers, paid rerolls, save persistence, support shop and raid controls", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const checkpoint = offerCheckpoint();
  await page.goto("/");
  await page.evaluate(replay => localStorage.setItem("knife-edge-demo-1-save", JSON.stringify(replay)), checkpoint);
  await page.reload();
  await page.locator("#restore").click();
  await expect(page.locator("#verification")).toHaveText("Save verified");
  await expect(page.locator(".tower-choice")).toHaveCount(9);
  await expect(page.locator("#relic-panel")).toBeVisible();
  await expect(page.locator("#call")).toBeDisabled();
  await expect(page.locator("#reroll")).toContainText("25 gold");
  const gold = Number(await page.locator("#gold").textContent());
  await page.locator("#reroll").click();
  await expect(page.locator("#gold")).toHaveText(String(gold - 25));
  await expect(page.locator("#reroll")).toContainText("40 gold");
  await page.reload();
  await page.locator("#restore").click();
  await expect(page.locator("#reroll")).toContainText("40 gold");
  await page.locator("#reroll").click();
  await expect(page.locator("#reroll")).toContainText("64 gold");
  await page.locator("#reroll").click();
  await expect(page.locator("#reroll")).toBeDisabled();
  await expect(page.locator("#reroll")).toContainText("No rerolls left");
  await page.locator("[data-relic]").first().click();
  await expect(page.locator("#relic-panel")).toBeHidden();
  await page.locator('[data-tower="sprayer"]').click();
  await page.locator("#board").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#selection-copy")).toContainText("Soaks");
  await page.keyboard.press("9");
  await expect(page.locator('[data-tower="solvent"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#raid-panel")).toBeVisible();
  await page.locator("[data-raid]").first().click();
  await expect(page.locator("#message")).toContainText("Heat 1");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const file = await (await downloadPromise).path();
  const replay = validateReplay(JSON.parse(readFileSync(file!, "utf8")));
  expect(replay.commands.filter(c => c.cmd.kind === "reroll")).toHaveLength(3);
  expect(runReplay(deriveData(replay.data!), replay, 400000).finalHash).toBe(replay.finalHash);
  expect(errors).toEqual([]);
});
