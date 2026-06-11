import { test, expect } from "@playwright/test";

test.describe("Business plan wizard", () => {
  test("completes 4-step wizard and reaches review screen", async ({ page }) => {
    await page.goto("/create");

    // Step 1 — idea
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    await page.getByPlaceholder(/describe your business/i).fill(
      "A SaaS platform for freelance developers that automates invoicing and tracks project hours."
    );
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2 — market
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await page.getByPlaceholder(/industry/i).fill("SaaS");
    await page.getByPlaceholder(/target customer/i).fill("Freelance developers");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3 — revenue
    await expect(page.getByText("Step 3 of 4")).toBeVisible();
    await page.getByPlaceholder(/revenue model/i).fill("Monthly subscription");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4 — review
    await expect(page.getByText("Step 4 of 4")).toBeVisible();
    await expect(page.getByText(/SaaS/)).toBeVisible();
    await expect(page.getByRole("button", { name: /preview.*free/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /generate full plan/i })).toBeVisible();
  });

  test("back button navigates to previous step", async ({ page }) => {
    await page.goto("/create");
    await page.getByPlaceholder(/describe your business/i).fill("Test idea here for testing the form");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
  });
});
