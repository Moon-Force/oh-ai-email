import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmptyState from "./EmptyState";
import AppThemeProvider from "../../theme/AppThemeProvider";

test("renders empty copy and compose action", async () => {
  const user = userEvent.setup();
  const onCompose = vi.fn();
  render(
    <AppThemeProvider mode="light">
      <EmptyState onCompose={onCompose} />
    </AppThemeProvider>
  );
  expect(screen.getByText("收件箱已清空")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "写新邮件" }));
  expect(onCompose).toHaveBeenCalled();
});
