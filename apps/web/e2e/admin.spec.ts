import { test, expect } from "@playwright/test";

test.describe("Admin dashboard (demo mode)", () => {
  test("overview shows KPI cards", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("$426")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("47")).toBeVisible();
    await expect(page.getByText("21")).toBeVisible();
    await expect(page.getByText("$38.42")).toBeVisible();
  });

  test("jobs page shows demo jobs table", async ({ page }) => {
    await page.goto("/admin/jobs");
    await expect(page.getByText("alice@example.com")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("bob@example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: "Debug" }).first()).toBeVisible();
  });

  test("prompts page lists pipeline stages", async ({ page }) => {
    await page.goto("/admin/prompts");
    await expect(page.getByText("Outline")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Executive Summary")).toBeVisible();
  });

  test("corpus page shows document list", async ({ page }) => {
    await page.goto("/admin/corpus");
    await expect(page.getByText("executive_summary")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("6 active docs")).not.toBeVisible(); // rendered differently
    await expect(page.getByText("Re-ingest all active")).toBeVisible();
  });

  test("users page shows user table", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByText("alice@example.com")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("admin@build-block.com")).toBeVisible();
  });
});
