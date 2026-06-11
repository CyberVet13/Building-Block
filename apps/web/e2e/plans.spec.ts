import { test, expect } from "@playwright/test";

test.describe("Plans history and detail", () => {
  test("plans list shows demo plan", async ({ page }) => {
    await page.goto("/plans");
    await expect(page.getByText("1 plans generated")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/FreelancerOS/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "PDF" })).toBeVisible();
  });

  test("clicking plan title navigates to detail page", async ({ page }) => {
    await page.goto("/plans");
    await page.getByText(/FreelancerOS/i).first().click();
    await expect(page).toHaveURL(/\/plans\/demo-plan/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("FreelancerOS");
  });

  test("plan detail shows all 5 sections", async ({ page }) => {
    await page.goto("/plans/demo-plan-00000000-0000-0000-0000-000000000001");
    await expect(page.getByRole("heading", { name: /executive summary/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("heading", { name: /market analysis/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /competitive landscape/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /operations/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /financial projections/i })).toBeVisible();
  });

  test("section nav hint says click to edit", async ({ page }) => {
    await page.goto("/plans/demo-plan-00000000-0000-0000-0000-000000000001");
    await expect(page.getByText(/click any section to edit/i)).toBeVisible({ timeout: 5_000 });
  });

  test("clicking section body opens inline editor", async ({ page }) => {
    await page.goto("/plans/demo-plan-00000000-0000-0000-0000-000000000001");
    await page.waitForTimeout(2_000); // wait for content to load
    const section = page.locator("[class*='cursor-text']").first();
    await section.click();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });
});
