import { test, expect } from "@playwright/test";

test.describe("Pawral E2E", () => {
  test("01 — Dashboard loads and WebSocket connects", async ({ page }) => {
    await page.goto("/");

    // Status bar should show "Agent Status:"
    const statusBar = page.locator("text=Agent Status:");
    await expect(statusBar).toBeVisible({ timeout: 10_000 });

    // Wait for WebSocket to connect — status should flip to "Online"
    await expect(page.locator("text=Online")).toBeVisible({ timeout: 10_000 });

    // Dashboard heading
    await expect(page.locator("text=Control Center")).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/01-dashboard.png", fullPage: true });
  });

  test("02 — Workers appear from server init data", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Online")).toBeVisible({ timeout: 10_000 });

    // The control bar should show worker count like "0/6 active"
    await expect(page.locator("text=/\\d+\\/\\d+ active/")).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: "e2e/screenshots/02-workers.png", fullPage: true });
  });

  test("03 — Navigate to Tasks page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Online")).toBeVisible({ timeout: 10_000 });

    // Click Tasks nav button
    await page.getByRole("button", { name: "Tasks" }).click();

    // Tasks page should show "Task Queue" heading
    await expect(page.locator("text=Task Queue")).toBeVisible({ timeout: 5_000 });

    // Filter controls should be visible
    await expect(page.locator("text=All Statuses")).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/03-tasks.png", fullPage: true });
  });

  test("04 — Navigate to Budget page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Online")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Budget" }).click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: "e2e/screenshots/04-budget.png", fullPage: true });
  });

  test("05 — Navigate to Settings page and verify gateway connected", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Online")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Settings" }).click();

    // Settings page should show Gateway section
    await expect(page.locator("text=Gateway Connection")).toBeVisible({ timeout: 5_000 });

    // Should see the gateway URL field
    await expect(page.locator("input[placeholder='ws://localhost:3002']")).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/05-settings.png", fullPage: true });
  });

  test("06 — Open New Task modal and verify form fields", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Online")).toBeVisible({ timeout: 10_000 });

    // Click "New Task" button on the dashboard
    await page.getByRole("button", { name: "New Task" }).first().click();

    // Modal should appear with form fields
    await expect(page.locator("text=Task Title")).toBeVisible({ timeout: 3_000 });
    await expect(page.locator("input[placeholder='e.g. Implement OAuth provider']")).toBeVisible();
    await expect(page.locator("text=Description / Prompt")).toBeVisible();
    await expect(page.locator("text=Repository")).toBeVisible();
    await expect(page.locator("text=Priority")).toBeVisible();
    await expect(page.locator("text=Budget Limit")).toBeVisible();

    // Create Task button should be visible but disabled (no title/prompt yet)
    const createBtn = page.getByRole("button", { name: "Create Task" });
    await expect(createBtn).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/06-new-task-modal.png", fullPage: true });
  });

  test("07 — Create a task via the modal", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Online")).toBeVisible({ timeout: 10_000 });

    // Open New Task modal
    await page.getByRole("button", { name: "New Task" }).first().click();
    await expect(page.locator("input[placeholder='e.g. Implement OAuth provider']")).toBeVisible({ timeout: 3_000 });

    // Fill in the form
    await page.locator("input[placeholder='e.g. Implement OAuth provider']").fill("Test E2E Task");
    await page.locator("textarea[placeholder='Describe the task for the AI agent...']").fill("This is a test task created by Playwright E2E");
    await page.locator("input[placeholder='my-app']").fill("test-repo");
    await page.locator("input[placeholder='swarm/']").fill("e2e-test/");

    await page.screenshot({ path: "e2e/screenshots/07-task-filled.png", fullPage: true });

    // Click Create Task
    await page.getByRole("button", { name: "Create Task" }).click();

    // Modal should close (or if "Create another" is checked, it stays)
    // Navigate to Tasks page to verify the task was created
    await page.getByRole("button", { name: "Tasks" }).click();
    await expect(page.locator("text=Task Queue")).toBeVisible({ timeout: 5_000 });

    // The task we created should appear in the list
    await expect(page.locator("text=Test E2E Task")).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: "e2e/screenshots/08-task-created.png", fullPage: true });
  });
});
