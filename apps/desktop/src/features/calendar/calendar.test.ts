import { describe, expect, it, beforeEach } from "vitest";
import { useCalendarStore, formatIsoDate } from "./calendarStore";
import type { CalendarEventDto } from "./types";

describe("Calendar Store and ICS Utilities", () => {
  beforeEach(() => {
    useCalendarStore.setState({
      events: [],
      selectedDate: "2026-08-17",
      viewMode: "month",
      eventDialogOpen: false,
      eventDraft: null,
      icsImportDialogOpen: false,
      loading: false,
    });
  });

  it("navigates through periods correctly in month mode", () => {
    const store = useCalendarStore.getState();
    expect(store.selectedDate).toBe("2026-08-17");

    store.nextPeriod();
    expect(useCalendarStore.getState().selectedDate).toBe("2026-09-17");

    store.prevPeriod();
    expect(useCalendarStore.getState().selectedDate).toBe("2026-08-17");

    store.prevPeriod();
    expect(useCalendarStore.getState().selectedDate).toBe("2026-07-17");

    store.goToday();
    expect(useCalendarStore.getState().selectedDate).toBe(formatIsoDate());
  });

  it("navigates through periods correctly in week and day modes", () => {
    useCalendarStore.setState({ selectedDate: "2026-08-17", viewMode: "week" });
    useCalendarStore.getState().nextPeriod();
    expect(useCalendarStore.getState().selectedDate).toBe("2026-08-24");

    useCalendarStore.setState({ selectedDate: "2026-08-17", viewMode: "day" });
    useCalendarStore.getState().nextPeriod();
    expect(useCalendarStore.getState().selectedDate).toBe("2026-08-18");
  });

  it("creates, updates and removes events", async () => {
    const store = useCalendarStore.getState();

    // Create event
    const created = await store.saveEvent({
      title: "Q3 业务规划会议",
      startTime: "2026-08-17T14:00:00.000Z",
      endTime: "2026-08-17T15:30:00.000Z",
      location: "9楼 3号会议室",
      description: "讨论 Q3 核心路线图与资源分配",
      category: "meeting",
      remindMinutesBefore: 15,
    });

    expect(created).toBeDefined();
    expect(created!.id).toBeTruthy();
    expect(created!.title).toBe("Q3 业务规划会议");
    expect(useCalendarStore.getState().events.some((e) => e.id === created!.id)).toBe(true);

    // Update event
    useCalendarStore.getState().openEditDialog(created!);
    await useCalendarStore.getState().saveEvent({
      title: "Q3 业务规划会议 (调整后)",
    });

    const updated = useCalendarStore.getState().events.find((e) => e.id === created!.id);
    expect(updated?.title).toBe("Q3 业务规划会议 (调整后)");

    // Remove event
    await useCalendarStore.getState().removeEvent(created!.id);
    expect(useCalendarStore.getState().events.some((e) => e.id === created!.id)).toBe(false);
  });

  it("filters today events properly", () => {
    const today = formatIsoDate();
    const now = Date.now();
    const mockEvents: CalendarEventDto[] = [
      {
        id: "e1",
        title: "今日例会",
        startTime: `${today}T10:00:00.000Z`,
        endTime: `${today}T11:00:00.000Z`,
        startMs: new Date(`${today}T10:00:00.000Z`).getTime(),
        endMs: new Date(`${today}T11:00:00.000Z`).getTime(),
        allDay: false,
        category: "meeting",
        color: "#2563eb",
        status: "confirmed",
        recurrence: "none",
        remindMinutesBefore: 10,
        isReminded: false,
        attendees: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "e2",
        title: "下周日程",
        startTime: "2099-01-01T10:00:00.000Z",
        endTime: "2099-01-01T11:00:00.000Z",
        startMs: new Date("2099-01-01T10:00:00.000Z").getTime(),
        endMs: new Date("2099-01-01T11:00:00.000Z").getTime(),
        allDay: false,
        category: "work",
        color: "#16a34a",
        status: "confirmed",
        recurrence: "none",
        remindMinutesBefore: -1,
        isReminded: false,
        attendees: [],
        createdAt: now,
        updatedAt: now,
      },
    ];

    useCalendarStore.setState({ events: mockEvents });
    const todays = useCalendarStore.getState().todayEvents();
    expect(todays.length).toBe(1);
    expect(todays[0].title).toBe("今日例会");
  });

  it("imports valid iCalendar text content", async () => {
    const sampleIcs = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//oh-ai-email//Calendar//CN",
      "BEGIN:VEVENT",
      "UID:event-12345",
      "SUMMARY:全员架构设计研讨会",
      "LOCATION:线上腾讯会议",
      "DESCRIPTION:讨论跨平台桌面端架构细节",
      "DTSTART:20260818T100000Z",
      "DTEND:20260818T113000Z",
      "ATTENDEE:mailto:developer@company.com",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const count = await useCalendarStore.getState().importIcs(sampleIcs);
    expect(count).toBe(1);
    const imported = useCalendarStore
      .getState()
      .events.find((e) => e.title === "全员架构设计研讨会");
    expect(imported).toBeDefined();
    expect(imported?.location).toBe("线上腾讯会议");
  });
});
