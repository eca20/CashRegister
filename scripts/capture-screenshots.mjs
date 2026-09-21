import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const baseURL = process.argv[2] ?? "http://127.0.0.1:3000";
const output = new URL("../docs/screenshots/", import.meta.url);
await mkdir(output, { recursive: true });

const browser = await chromium.launch();
try {
  for (const [name, viewport, mobile] of [
    ["desktop", { width: 1440, height: 1000 }, false],
    ["mobile", { width: 390, height: 844 }, true],
  ]) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      isMobile: mobile,
      hasTouch: mobile,
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto(baseURL);
    for (const digit of "212")
      await page.getByRole("button", { name: digit, exact: true }).click();
    await page
      .getByRole("button", { name: "Amount paid", exact: true })
      .click();
    for (const digit of "300")
      await page.getByRole("button", { name: digit, exact: true }).click();
    await page.getByRole("button", { name: "Calculate change" }).click();
    await expect(page.locator(".receipt-total strong")).toHaveText("0.88");
    await expect(page.locator(".results li")).toHaveText(
      "3 quarters, 1 dime, 3 pennies",
    );
    await expect(
      page.getByRole("button", { name: "Download .txt" }),
    ).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
    const path = fileURLToPath(new URL(`register-${name}.png`, output));
    await page.screenshot({ path, fullPage: true, animations: "disabled" });
    console.log(
      `Captured ${name}: ${viewport.width} × ${viewport.height} viewport`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
