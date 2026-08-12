import { test, expect } from "@playwright/test";

test("shell renders MVP three-pane layout", async ({ page }) => {
  await page.goto("http://localhost:5173");
  await expect(page.getByText("oh-ai-email")).toBeVisible();
  await expect(page.getByTestId("sidebar")).toBeVisible();
  await expect(page.getByTestId("topbar")).toBeVisible();
  await expect(page.getByRole("button", { name: /写新邮件/ })).toBeVisible();
});

test("compose opens from toolbar", async ({ page }) => {
  await page.goto("http://localhost:5173");
  await page.getByRole("button", { name: /写新邮件/ }).click();
  await expect(page.getByTestId("composer")).toBeVisible();
  await expect(page.getByLabel("收件人")).toBeVisible();
});
