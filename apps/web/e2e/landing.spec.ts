import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders hero headline and CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Business plans that");
    await expect(page.getByRole("link", { name: /generate free preview/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /view plans/i })).toBeVisible();
  });

  test("shows all four pricing tiers", async ({ page }) => {
    await page.goto("/");
    for (const tier of ["Free", "Starter", "Pro", "Business"]) {
      await expect(page.getByRole("heading", { name: tier, level: 3 })).toBeVisible();
    }
  });

  test("nav links are present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Create" })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Plans" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pricing" })).toBeVisible();
  });

  test("pricing page renders", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /simple subscription pricing/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /get pro/i })).toBeVisible();
  });
});
