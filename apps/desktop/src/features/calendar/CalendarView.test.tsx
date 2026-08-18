import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CalendarView from "./CalendarView";
import { useCalendarStore } from "./calendarStore";
import AppThemeProvider from "../../theme/AppThemeProvider";

function wrap(ui: React.ReactElement) {
  return <AppThemeProvider mode="light">{ui}</AppThemeProvider>;
}

describe("CalendarView Component", () => {
  beforeEach(() => {
    useCalendarStore.setState({
      events: [
        {
          id: "event-1",
          title: "产品需求讨论",
          startTime: "2026-08-17T09:00:00.000Z",
          endTime: "2026-08-17T10:00:00.000Z",
          startMs: new Date("2026-08-17T09:00:00.000Z").getTime(),
          endMs: new Date("2026-08-17T10:00:00.000Z").getTime(),
          allDay: false,
          category: "meeting",
          color: "#2563eb",
          status: "confirmed",
          recurrence: "none",
          remindMinutesBefore: 15,
          isReminded: false,
          attendees: ["dev@test.com"],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      selectedDate: "2026-08-17",
      viewMode: "month",
      eventDialogOpen: false,
      eventDraft: null,
      icsImportDialogOpen: false,
      loading: false,
    });
  });

  it("renders calendar top toolbar and month view", () => {
    render(wrap(<CalendarView />));

    expect(screen.getByText("今天")).toBeInTheDocument();
    expect(screen.getByText("新建日程")).toBeInTheDocument();
    expect(screen.getByText("导入 .ics")).toBeInTheDocument();
    expect(screen.getByText("导出")).toBeInTheDocument();
    expect(screen.getByText("周一")).toBeInTheDocument();
    expect(screen.getByText("产品需求讨论")).toBeInTheDocument();
  });

  it("switches to agenda view and shows event item", () => {
    render(wrap(<CalendarView />));

    const agendaTab = screen.getByRole("button", { name: "清单视图" });
    fireEvent.click(agendaTab);

    expect(useCalendarStore.getState().viewMode).toBe("agenda");
    expect(screen.getByText("产品需求讨论")).toBeInTheDocument();
  });

  it("opens create event dialog when clicking 新建日程", () => {
    render(wrap(<CalendarView />));

    const createBtn = screen.getByRole("button", { name: "新建日程" });
    fireEvent.click(createBtn);

    expect(useCalendarStore.getState().eventDialogOpen).toBe(true);
    expect(screen.getAllByText("新建日程").length).toBeGreaterThan(1);
  });
});
