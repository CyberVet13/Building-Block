import { test, expect } from "@playwright/test";

/**
 * Generation flow tests — require DEMO_MODE=true on the API (default in dev).
 * The demo returns the FreelancerOS fixture plan immediately.
 */

async function completeWizard(page: import("@playwright/test").Page) {
  await page.goto("/create");
  await page.getByPlaceholder(/describe your business/i).fill(
    "A SaaS platform for freelance developers that automates invoicing and tracks hours."
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByPlaceholder(/industry/i).fill("SaaS");
  await page.getByPlaceholder(/target customer/i).fill("Freelancers");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByPlaceholder(/revenue model/i).fill("Subscription");
  await page.getByRole("button", { name: "Continue" }).click();
}

test.describe("Generation flow (demo mode)", () => {
  test("generates full plan and shows plan viewer with sections", async ({ page }) => {
    await completeWizard(page);
    await page.getByRole("button", { name: /generate full plan/i }).click();

    // Should show spinner
    await expect(page.getByText(/building your plan/i)).toBeVisible();

    // Should transition to plan viewer
    await expect(page.getByText(/FreelancerOS/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /executive summary/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /market analysis/i })).toBeVisible();
  });

  test("plan viewer shows PDF and DOCX export buttons", async ({ page }) => {
    await completeWizard(page);
    await page.getByRole("button", { name: /generate full plan/i }).click();
    await expect(page.getByRole("button", { name: "PDF" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "DOCX" })).toBeVisible();
  });

  test("preview generation shows paywall CTA", async ({ page }) => {
    await completeWizard(page);
    await page.getByRole("button", { name: /preview.*free/i }).click();
    // In demo mode preview also shows the full plan (fixture is always full)
    await expect(page.getByText(/FreelancerOS/i)).toBeVisible({ timeout: 10_000 });
  });
});
