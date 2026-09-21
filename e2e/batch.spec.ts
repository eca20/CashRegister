import { test, expect } from "@playwright/test";

test("large batches have a bounded preview and a complete download", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Batch" }).click();
  await page
    .getByLabel("Amount owed, amount paid")
    .fill(Array(125).fill("1.00,1.00").join("\n"));
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(page.getByText("125 transactions processed")).toBeVisible();
  await expect(page.locator(".results li")).toHaveCount(100);
  await expect(
    page.getByText("Showing the first 100 results.", { exact: false }),
  ).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .txt" }).click();
  const stream = await (await pending).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe("No change due\n".repeat(125));
});

test("process samples, download exact output and clear stale results on edit", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("tab", { name: "Batch" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Cash Register",
  );
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(page.getByText("3 transactions processed")).toBeVisible();
  const results = page.locator(".results li");
  await expect(results).toHaveCount(3);
  await expect(results.first()).toContainText("3 quarters, 1 dime, 3 pennies");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .txt" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("change.txt");
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toMatch(
    /^3 quarters,1 dime,3 pennies\n3 pennies\n.+\n$/,
  );
  await page.getByLabel("Amount owed, amount paid").fill("1.00,1.00");
  await expect(
    page.getByRole("button", { name: "Download .txt" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(page.getByText("No change due", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("upload a file, change currency/divisor, and report line-specific errors", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Batch" }).click();
  await page.getByLabel("Upload transactions").setInputFiles({
    name: "input.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("3.33,5.00\r\n"),
  });
  await expect(page.getByLabel("Amount owed, amount paid")).toHaveValue(
    "3.33,5.00\n",
  );
  await page.locator("summary").click();
  await page.getByLabel("Currency").selectOption("EUR");
  await page.getByLabel("Random divisor").fill("5");
  await page.locator("summary").click();
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(page.locator(".results")).toContainText(
    "1 1-euro coin, 1 50-cent coin, 1 10-cent coin, 1 5-cent coin, 1 2-cent coin",
  );
  await page
    .getByLabel("Amount owed, amount paid")
    .fill("2.12,3.00\n2.00,1.00");
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Line 2: Amount paid is less than amount owed.",
  );
  await expect(
    page.getByRole("button", { name: "Download .txt" }),
  ).toBeDisabled();
});

test("network failure is visible and a later request can recover", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Batch" }).click();
  await page.route("**/api/change", (route) => route.abort());
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Calculate change" }),
  ).toBeEnabled();
  await page.unroute("**/api/change");
  await page.getByRole("button", { name: "Calculate change" }).click();
  await expect(page.getByText("3 transactions processed")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
