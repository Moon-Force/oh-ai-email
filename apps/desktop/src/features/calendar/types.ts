import type { CalendarEventCategory, CalendarEventDto } from "../../lib/ipc";

export type { CalendarEventCategory, CalendarEventDto };

export type CalendarViewMode = "month" | "week" | "day" | "agenda";

export type CalendarEvent = CalendarEventDto;

export const CATEGORY_LABELS: Record<CalendarEventCategory, string> = {
  meeting: "会议 (Meeting)",
  work: "工作待办 (Work)",
  personal: "个人日程 (Personal)",
  reminder: "重要提醒 (Reminder)",
  travel: "差旅出行 (Travel)",
};

export const CATEGORY_COLORS: Record<CalendarEventCategory, string> = {
  meeting: "#2563EB", // Blue
  work: "#16A34A", // Green
  personal: "#7C3AED", // Purple
  reminder: "#D97706", // Amber
  travel: "#0D9488", // Teal
};
