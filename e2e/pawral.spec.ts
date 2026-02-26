import { test, expect } from "@playwright/test";

const BASE = "http://100.95.87.125:5180";

test.describe("Pawral E2E", () => {
  test("01 — Dashboard with Terminal Grid", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    await expect(page.getByRole("heading", { name: "Control Center" })).toBeVisible();
    await expect(page.getByText("worker-1").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/01-dashboard.png", fullPage: true });
  });

  test("02 — Tasks page", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Tasks" }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/02-tasks.png", fullPage: true });
  });

  test("03 — Budget page", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Budget" }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/03-budget.png", fullPage: true });
  });

  test("04 — PRs page", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "PRs" }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/04-prs.png", fullPage: true });
  });

  test("05 — Swarm page", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Swarm" }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/05-swarm.png", fullPage: true });
  });

  test("06 — Settings page", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Settings" }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/06-settings.png", fullPage: true });
  });

  test("07 — New Task modal", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "New Task" }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/07-new-task.png", fullPage: true });
  });

  test("08 — Terminal fullscreen", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    // Click maximize on worker-1
    await page.getByRole("button", { name: "Maximize" }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/08-terminal-fullscreen.png", fullPage: true });
  });
});
