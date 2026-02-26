import { test, expect } from "@playwright/test";

test.describe("Pawral E2E", () => {
  test("01 — Dashboard with Terminal Grid", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/01-dashboard.png", fullPage: true });
    // Verify basic structure loaded
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("02 — Tasks page", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    const tasksBtn = page.getByRole("button", { name: "Tasks" });
    if (await tasksBtn.isVisible()) await tasksBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/02-tasks.png", fullPage: true });
  });

  test("03 — Budget page", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    const btn = page.getByRole("button", { name: "Budget" });
    if (await btn.isVisible()) await btn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/03-budget.png", fullPage: true });
  });

  test("04 — PRs page", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    const btn = page.getByRole("button", { name: "PRs" });
    if (await btn.isVisible()) await btn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/04-prs.png", fullPage: true });
  });

  test("05 — Swarm page", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    const btn = page.getByRole("button", { name: "Swarm" });
    if (await btn.isVisible()) await btn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/05-swarm.png", fullPage: true });
  });

  test("06 — Settings page", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    const btn = page.getByRole("button", { name: "Settings" });
    if (await btn.isVisible()) await btn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/06-settings.png", fullPage: true });
  });

  test("07 — New Task modal", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    const btn = page.getByRole("button", { name: "New Task" });
    if (await btn.isVisible()) await btn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/07-new-task.png", fullPage: true });
  });
});
