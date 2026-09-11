import { expect, test } from "@playwright/test";

test("cold stylesheet loading and resizing cannot expand the play area", async ({
  page,
}, testInfo) => {
  // A delayed font @import exposes Safari's initial zero-height board. Phaser
  // must not respond by writing height:100% onto the CSS-controlled container.
  let releaseFonts!: () => void;
  const fontsReady = new Promise<void>((resolve) => {
    releaseFonts = resolve;
  });
  await page.route("https://fonts.googleapis.com/**", async (route) => {
    await fontsReady;
    await route.fulfill({ contentType: "text/css", body: "" });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  try {
    await expect(page.locator("canvas")).toBeAttached();
  } finally {
    releaseFonts();
  }
  await expect(page.locator("canvas")).toBeVisible();
  expect(await page.locator("#board").evaluate((el) => el.style.height)).toBe(
    "",
  );

  for (const viewport of [
    { width: 1728, height: 1117 },
    { width: 1440, height: 900 },
    { width: 900, height: 500 },
    { width: 390, height: 844 },
    { width: 690, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const measure = () =>
      page.evaluate(() => {
        const board = document.querySelector<HTMLElement>("#board")!;
        const b = board.getBoundingClientRect();
        const canvas = board.querySelector("canvas")!.getBoundingClientRect();
        const transport = document
          .querySelector(".transport")!
          .getBoundingClientRect();
        const expectedHeight =
          innerWidth <= 700
            ? (b.width * 224) / 256
            : Math.max(280, Math.min(innerHeight * 0.52, 560));
        return {
          height: b.height,
          filled:
            Math.abs(canvas.width - b.width) <= 1 ||
            Math.abs(canvas.height - b.height) <= 1,
          expectedHeight,
          contained:
            canvas.top >= b.top - 1 &&
            canvas.bottom <= b.bottom + 1 &&
            canvas.left >= b.left - 1 &&
            canvas.right <= b.right + 1,
          controlsGap: transport.top - b.bottom,
          aspect: canvas.width / canvas.height,
        };
      });
    await expect
      .poll(async () => {
        const m = await measure();
        return (
          m.filled &&
          m.contained &&
          Math.abs(m.height - m.expectedHeight) <= 1 &&
          Math.abs(m.controlsGap) <= 1 &&
          Math.abs(m.aspect - 256 / 224) < 0.01
        );
      })
      .toBe(true);
    const before = await measure();
    // Sample multiple Phaser parent-size checks to catch the previous idle growth.
    await page.waitForTimeout(1200);
    const after = await measure();
    expect(after.height).toBeCloseTo(before.height, 0);
    expect(after.controlsGap).toBeCloseTo(0, 0);
  }
  // Exercise a parent-only resize: no window resize event is dispatched.
  await page.locator("#board").evaluate((el) => {
    el.style.height = "360px";
  });
  await expect
    .poll(async () => {
      const board = await page.locator("#board").boundingBox();
      const canvas = await page.locator("canvas").boundingBox();
      return Math.abs(canvas!.height - board!.height);
    })
    .toBeLessThanOrEqual(1);
  await page.locator("#board").evaluate((el) => {
    el.style.removeProperty("height");
  });
  await expect
    .poll(async () => (await page.locator("canvas").boundingBox())!.height)
    .toBeCloseTo(468, 0);
  const bounds = await page.locator("canvas").boundingBox();
  const scale = bounds!.width / 256;
  await page
    .locator("canvas")
    .click({ position: { x: 14 * scale, y: 46 * scale } });
  await page
    .locator("canvas")
    .click({ position: { x: 14 * scale, y: 46 * scale } });
  await expect(page.locator("#gold")).toHaveText("90");
  await page.screenshot({
    path: testInfo.outputPath("stable-board.png"),
    fullPage: true,
  });
});
