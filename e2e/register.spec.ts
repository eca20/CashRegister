import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function paste(page: Page, field: "owed" | "paid", value: string) {
  const input = page.getByLabel(`Amount ${field}`, { exact: true });
  await input.focus();
  await input.evaluate((element, text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, value);
}

test("starts ready, muted, with collapsed settings and cents keypad editing", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Register" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("details")).not.toHaveAttribute("open");
  await expect(page.locator("summary")).toContainText("USD · ÷3");
  await expect(
    page.getByRole("button", { name: "Sound", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("Amount owed", { exact: true })).toHaveValue(
    "0.00",
  );
  await expect(page.getByLabel("Amount paid", { exact: true })).toHaveValue(
    "0.00",
  );
  for (const digit of ["2", "1", "3"])
    await page.getByRole("button", { name: digit, exact: true }).click();
  await expect(page.getByLabel("Amount owed", { exact: true })).toHaveValue(
    "2.13",
  );
  await page.getByRole("button", { name: "00", exact: true }).click();
  await expect(page.getByLabel("Amount owed", { exact: true })).toHaveValue(
    "213.00",
  );
  await page.getByRole("button", { name: "Backspace" }).click();
  await expect(page.getByLabel("Amount owed", { exact: true })).toHaveValue(
    "21.30",
  );
  await page.getByRole("button", { name: "Clear active amount" }).click();
  await expect(page.getByLabel("Amount owed", { exact: true })).toHaveValue(
    "0.00",
  );
  await page.getByRole("button", { name: "Amount paid", exact: true }).click();
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "00", exact: true }).click();
  await expect(page.getByLabel("Amount paid", { exact: true })).toHaveValue(
    "5.00",
  );
  await expect(page.getByLabel("Amount owed", { exact: true })).toHaveValue(
    "0.00",
  );
});

test("keyboard matches cents entry, supports selection, navigation and submit", async ({
  page,
}) => {
  await page.goto("/");
  const owed = page.getByLabel("Amount owed", { exact: true });
  const paid = page.getByLabel("Amount paid", { exact: true });
  await owed.focus();
  await page.keyboard.type("213");
  await expect(owed).toHaveValue("2.13");
  await owed.press("Backspace");
  await expect(owed).toHaveValue("0.21");
  await owed.press("ControlOrMeta+a");
  await owed.press("5");
  await expect(owed).toHaveValue("0.05");
  await owed.press("ControlOrMeta+c");
  await owed.press("ControlOrMeta+1");
  await expect(owed).toHaveValue("0.05");
  await owed.press("Delete");
  await page.keyboard.type("212");
  await owed.press("Tab");
  await expect(paid).toBeFocused();
  await owed.focus();
  await owed.press("Enter");
  await expect(paid).toBeFocused();
  await page.keyboard.type("300");
  const request = page.waitForRequest("**/api/change");
  await paid.press("Enter");
  expect((await request).postDataJSON()).toEqual({
    input: "2.12,3.00",
    currency: "USD",
    divisor: 3,
  });
  await expect(page.locator(".receipt-amounts")).toContainText("2.12");
  await expect(page.locator(".receipt-amounts")).toContainText("3.00");
  await expect(page.locator(".receipt-total strong")).toHaveText("0.88");
  expect(
    await page
      .locator(".receipt-paper")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("receipt-feed");
  await expect(page.locator(".results li")).toHaveText(
    "3 quarters, 1 dime, 3 pennies",
  );
});

test("paste uses cents for digits and the shared parser for decimal amounts", async ({
  page,
}) => {
  await page.goto("/");
  const owed = page.getByLabel("Amount owed", { exact: true });
  await paste(page, "owed", "213");
  await expect(owed).toHaveValue("2.13");
  await paste(page, "owed", " 12.34 ");
  await expect(owed).toHaveValue("12.34");
  for (const value of [
    "1.234",
    "-1.00",
    "$2.00",
    "1e3",
    "",
    "10000000.01",
    "1000000001",
  ]) {
    await paste(page, "owed", value);
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(owed).toHaveValue("12.34");
  }
  await paste(page, "owed", "0000");
  await expect(owed).toHaveValue("0.00");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("amount limits reject extra digits without clamping or losing the accepted value", async ({
  page,
}) => {
  await page.goto("/");
  const owed = page.getByLabel("Amount owed", { exact: true });
  await owed.focus();
  await page.keyboard.type("1000000000");
  await expect(owed).toHaveValue("10000000.00");
  await owed.press("1");
  await expect(page.getByRole("alert")).toContainText(
    "The last entry was not applied",
  );
  await expect(owed).toHaveValue("10000000.00");
  await page.getByRole("button", { name: "00", exact: true }).click();
  await expect(owed).toHaveValue("10000000.00");
  await owed.press("Backspace");
  await expect(owed).toHaveValue("1000000.00");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await owed.press("Escape");
  await expect(owed).toHaveValue("0.00");
});

test("modes retain their inputs and invalidate receipts on edits, mode and settings changes", async ({
  page,
}) => {
  await page.goto("/");
  const calculate = page.getByRole("button", { name: "Calculate change" });
  const download = page.getByRole("button", { name: "Download .txt" });
  await paste(page, "owed", "212");
  await paste(page, "paid", "300");
  await calculate.click();
  await expect(download).toBeEnabled();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await expect(download).toBeDisabled();
  await paste(page, "paid", "300");
  await calculate.click();
  await expect(download).toBeEnabled();
  await page.getByRole("tab", { name: "Batch" }).click();
  await expect(download).toBeDisabled();
  await page.getByLabel("Amount owed, amount paid").fill("1.00,2.00");
  await calculate.click();
  await expect(download).toBeEnabled();
  await page.getByRole("tab", { name: "Register" }).click();
  await expect(download).toBeDisabled();
  await expect(page.getByLabel("Amount owed", { exact: true })).toHaveValue(
    "2.12",
  );
  await expect(page.getByLabel("Amount paid", { exact: true })).toHaveValue(
    "3.00",
  );
  await calculate.click();
  await expect(download).toBeEnabled();
  await page.locator("summary").click();
  await page.getByLabel("Currency", { exact: true }).selectOption("EUR");
  await expect(download).toBeDisabled();
  await page.locator("summary").click();
  await calculate.click();
  await expect(page.locator(".receipt-meta")).toContainText("EUR");
  await page.locator("summary").click();
  await page.getByLabel("Random divisor").fill("5");
  await expect(download).toBeDisabled();
  await page.locator("summary").click();
  await page.getByRole("tab", { name: "Register" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Amount owed, amount paid")).toHaveValue(
    "1.00,2.00",
  );
  await expect(page.getByRole("tab", { name: "Batch" })).toBeFocused();
});

test("an in-flight request locks mutable inputs and prints the server output from its snapshot", async ({
  page,
}) => {
  await page.goto("/");
  await paste(page, "owed", "212");
  await paste(page, "paid", "300");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/change", async (route) => {
    await gate;
    await route.fulfill({ json: { output: "88 pennies\n" } });
  });
  const request = page.waitForRequest("**/api/change");
  await page.getByRole("button", { name: "Calculate change" }).click();
  await request;
  await expect(page.getByLabel("Amount owed", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "1", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("tab", { name: "Batch" })).toBeDisabled();
  await page.locator("summary").click();
  await expect(page.getByLabel("Currency", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Random divisor")).toBeDisabled();
  await expect(
    page.getByText("Processing transaction", { exact: true }),
  ).toBeVisible();
  release();
  await expect(page.locator(".results li")).toHaveText("88 pennies");
  await expect(page.locator(".receipt-amounts")).toContainText("2.12");
  await expect(page.locator(".receipt-amounts")).toContainText("3.00");
  await page.locator("summary").click();
  await page.getByRole("button", { name: "Clear active amount" }).click();
  await expect(page.locator(".results li")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Download .txt" }),
  ).toBeDisabled();
});

test("underpayment and invalid settings explain the error and can recover", async ({
  page,
}) => {
  await page.goto("/");
  await paste(page, "owed", "212");
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Amount paid is less than amount owed",
  );
  await paste(page, "paid", "300");
  await page.locator("summary").click();
  await page.getByLabel("Random divisor").fill("");
  await page.locator("summary").click();
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(page.getByRole("alert")).toContainText("positive whole number");
  await page.locator("summary").click();
  await page.getByLabel("Random divisor").fill("3");
  await page.locator("summary").click();
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(
    page.getByText("1 transaction processed", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("audio is opt-in, can be muted, and unsupported audio never blocks a calculation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const sound = page.getByRole("button", { name: "Sound", exact: true });
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "1", exact: true }).click();
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await page.evaluate(() => {
    Object.defineProperty(window, "AudioContext", {
      value: class {
        constructor() {
          throw new Error("Audio unavailable");
        }
      },
    });
  });
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByText("Sound is unavailable. All register controls still work."),
  ).toBeAttached();
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(page.locator(".results li")).toHaveText("No change due");
  expect(errors).toEqual([]);
});

test("reduced motion removes receipt animation and retains visible keyboard focus", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByLabel("Amount owed", { exact: true }).focus();
  await page.keyboard.press("Tab");
  const paid = page.getByLabel("Amount paid", { exact: true });
  await expect(paid).toBeFocused();
  expect(
    await paid.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).toBe("solid");
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(page.locator(".receipt-paper")).toHaveClass(/is-printed/);
  expect(
    await page
      .locator(".receipt-paper")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
});

test("320px layout fits long amounts, error messages and long batch receipts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/");
  await paste(page, "owed", "10000000.00");
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await paste(page, "owed", "0");
  await paste(page, "paid", "10000000.00");
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(page.locator(".receipt-total strong")).toHaveText("10000000.00");
  expect(
    await page
      .getByLabel("Amount paid", { exact: true })
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".receipt-paper")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  const targets = await page
    .locator("button:visible, summary, .amount-field input")
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().height),
    );
  expect(targets.every((height) => height >= 44)).toBe(true);
  await page.getByRole("tab", { name: "Batch" }).click();
  await page
    .getByLabel("Amount owed, amount paid")
    .fill(Array(125).fill("2.12,10000000.00").join("\n"));
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(page.locator(".results li")).toHaveCount(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".results")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});
