import { test, expect } from "@playwright/test";

test.describe("oh-ai-email Desktop E2E Integration Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5173");
  });

  test("shell renders MVP three-pane layout", async ({ page }) => {
    await expect(page.getByText("oh-ai-email")).toBeVisible();
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.getByTestId("topbar")).toBeVisible();
    await expect(page.getByRole("button", { name: /写新邮件/ })).toBeVisible();
  });

  test("sidebar navigation includes smart folders and snoozed inbox", async ({ page }) => {
    const sidebar = page.getByTestId("sidebar");
    await expect(sidebar.getByText("收件箱")).toBeVisible();
    await expect(sidebar.getByText("稍后处理")).toBeVisible();
    await expect(sidebar.getByText("已发送")).toBeVisible();
    await expect(sidebar.getByText("草稿")).toBeVisible();
  });

  test("compose opens from toolbar and can be closed", async ({ page }) => {
    await page.getByRole("button", { name: /写新邮件/ }).click();
    await expect(page.getByTestId("composer")).toBeVisible();
    await expect(page.getByLabel("收件人")).toBeVisible();

    const sidebar = page.getByTestId("sidebar");
    await sidebar.getByText("收件箱").click();
    await expect(page.getByTestId("composer")).not.toBeVisible();
  });

  test("navigates to settings and checks version & updater UI", async ({ page }) => {
    await page.getByRole("button", { name: "设置" }).click();
    await expect(page.getByTestId("settings")).toBeVisible();

    // Click General Tab
    await page.getByRole("button", { name: "通用" }).click();
    await expect(page.getByText("系统集成")).toBeVisible();
    await expect(page.getByText("开机自动启动（并在后台静默常驻）")).toBeVisible();
    await expect(page.getByText("版本与更新")).toBeVisible();
    await expect(page.getByRole("button", { name: "检查更新" })).toBeVisible();
  });
});
