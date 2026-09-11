import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  createState,
  deriveData,
  hashState,
  runReplay,
  validateReplay,
  withDifficulty,
  type RawGameData,
} from "../../../packages/sim/src/index.js";

test("build, upgrade, target, sell, bank, pause, export and restore", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".tower-choice")).toHaveCount(9);
  const bounds = await page.locator("canvas").boundingBox();
  const scale = bounds!.width / 256;
  // Pointer coordinates must map through the letterboxed virtual canvas.
  await page
    .locator("canvas")
    .click({ position: { x: 14 * scale, y: 46 * scale } });
  await page
    .locator("canvas")
    .click({ position: { x: 14 * scale, y: 46 * scale } });
  await expect(page.locator("#gold")).toHaveText("90");
  await expect(page.locator("#selection-title")).toHaveText("BOLT · LEVEL 1");
  await page.locator("#upgrade").click();
  await expect(page.locator("#selection-title")).toHaveText("BOLT · LEVEL 2");
  await page.locator("#target").selectOption("strongest");
  await page.locator("#sell").click();
  await expect(page.locator("#gold")).toHaveText("102");
  await page
    .locator("#notes")
    .fill("Browser playtest: upgraded then sold, testing replay parity.");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise,
    file = await download.path();
  const replay = validateReplay(JSON.parse(readFileSync(file!, "utf8")));
  expect(replay.commands.map((c) => c.cmd.kind)).toEqual([
    "build",
    "upgrade",
    "target",
    "sell",
  ]);
  expect(runReplay(deriveData(replay.data!), replay, 400000).finalHash).toBe(
    replay.finalHash,
  );
  await page.reload();
  await page.locator("#restore").click();
  await expect(page.locator("#gold")).toHaveText("102");
  await expect(page.locator("#verification")).toHaveText("Save verified");
  await page.locator("#call").click();
  await expect(page.locator("#wave")).toHaveText("1 / 18");
  await page.locator("#pause").click();
  await expect(page.locator("#pause")).toContainText("Pause");
  await page.locator('[data-speed="4"]').click();
  await expect(page.locator('[data-speed="4"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#pause").click();
  await expect(page.locator("#pause")).toContainText("Resume");
  expect(errors).toEqual([]);
});

test("same board across difficulties, invalid input, small-screen layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("#difficulty").selectOption("easy");
  await page.locator("#new-run").click();
  await expect(page.locator('[data-tower="bolt"]')).toContainText("21");
  await page.locator("#board").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("b");
  await expect(page.locator("#gold")).toHaveText("99");
  await page.locator("#seed").fill("-1");
  await page.locator("#new-run").click();
  await page.locator("#new-run").click();
  await expect(page.locator("#message")).toContainText("whole-number seed");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});

test("browser playback reproduces a headless bot win, including relics", async ({
  page,
}) => {
  const { runPolicy } = await import("../../../tools/balance/src/runner.js");
  const { makePolicy } =
    await import("../../../tools/balance/src/policies/index.js");
  const raw = JSON.parse(readFileSync("data/game.json", "utf8")) as RawGameData;
  const data = deriveData(withDifficulty(raw, "easy"));
  const run = runPolicy(data, makePolicy("engineer"), 7);
  expect(run.outcome).toBe("won");
  await page.goto("/");
  await page
    .locator("#import")
    .setInputFiles({
      name: "bot.replay.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(run.replay)),
    });
  await expect(page.locator("#message")).toContainText("Replay loaded");
  for (let wave = 1; wave <= 18; wave++) {
    await page.locator("#instant").click();
    await expect(page.locator("#wave")).toHaveText(`${wave} / 18`);
    if (wave < 18) await expect(page.locator("#instant")).toBeEnabled();
  }
  await expect(page.locator("#verification")).toHaveText(
    "Replay verified · exact match",
  );
  await expect(page.locator("#patches")).not.toContainText("No patches");
  await page.locator("#replay-restart").click();
  await expect(page.locator("#wave")).toHaveText("0 / 18");
});

test("rejects malformed replay without losing the active board", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("#import")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"commands":[]}'),
    });
  await expect(page.locator("#message")).toContainText("Could not load replay");
  await expect(page.locator("#gold")).toHaveText("120");
  await expect(page.locator("canvas")).toBeVisible();
});

test("bundled example loads and preserves a resumable Easy run", async ({ page }) => {
  await page.goto("/");
  await page.locator("#difficulty").selectOption("easy");
  await page.locator("#new-run").click();
  await page.locator("#board").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("b");
  await page.locator("#example").click();
  await expect(page.locator("#message")).toContainText("Raid/Heat example loaded");
  await page.locator("#instant").click();
  await expect(page.locator("#wave")).toHaveText("1 / 18");
  await page.locator("#restore").click();
  await expect(page.locator("#gold")).toHaveText("99");
  await expect(page.locator("#difficulty")).toHaveValue("easy");
  await expect(page.locator("#run-label")).toHaveText("EASY · SEED 7");
});
