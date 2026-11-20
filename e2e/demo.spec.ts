import { test, expect } from "@playwright/test";

test("demo fixture reaches roadmap with dual clocks", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/demo");
  await expect(page.getByRole("heading")).toBeVisible();

  await page.getByRole("button", { name: /Open this case|কেস খুলুন/i }).click();
  await page.waitForURL(/\/case\/[^/]+\/story/);

  await page.getByRole("link", { name: /Documents|ডকুমেন্ট/i }).first().click();
  await page.waitForURL(/\/documents/);

  await page.getByRole("link", { name: /Confirm|নিশ্চিত/i }).first().click();
  await page.waitForURL(/\/confirm/);

  const confirmBtns = page.getByRole("button", { name: /Confirm|নিশ্চিত$/i });
  const n = await confirmBtns.count();
  for (let i = 0; i < Math.min(n, 8); i++) {
    await confirmBtns.nth(i).click().catch(() => {});
  }

  await page.getByRole("button", { name: /Run the analysis|বিশ্লেষণ/i }).click();
  await page.waitForURL(/\/compare/, { timeout: 90_000 });

  await page.getByRole("link", { name: /Next steps|পরের ধাপ|Roadmap/i }).first().click();
  await page.waitForURL(/\/roadmap/);
  await expect(page.locator("ol li").first()).toBeVisible({ timeout: 15_000 });
  // Dual-clock strip (plan differentiator)
  await expect(page.getByText(/CRPA_S60_30D|DARAZ_RETURN_14D/i).first()).toBeVisible({
    timeout: 10_000,
  });
});

test("facebook sample shows missing-proof attention", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/demo");
  await page.getByRole("button", { name: /Facebook|ফেসবুক/i }).first().click();
  await page.getByRole("button", { name: /Open this case|কেস খুলুন/i }).click();
  await page.waitForURL(/\/case\/[^/]+\/story/);

  await page.getByRole("link", { name: /Documents|ডকুমেন্ট/i }).first().click();
  await page.getByRole("link", { name: /Confirm|নিশ্চিত/i }).first().click();
  await page.waitForURL(/\/confirm/);

  const confirmBtns = page.getByRole("button", { name: /Confirm|নিশ্চিত$/i });
  const n = await confirmBtns.count();
  for (let i = 0; i < Math.min(n, 8); i++) {
    await confirmBtns.nth(i).click().catch(() => {});
  }

  await page.getByRole("button", { name: /Run the analysis|বিশ্লেষণ/i }).click();
  await page.waitForURL(/\/compare/, { timeout: 90_000 });
  await page.getByRole("link", { name: /Next steps|পরের ধাপ|Roadmap/i }).first().click();
  await page.waitForURL(/\/roadmap/);

  await expect(page.getByText(/Attention|সতর্কতা/i).first()).toBeVisible({ timeout: 15_000 });
});

test("mobile viewport loads demo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await expect(page.getByRole("heading")).toBeVisible();
});
