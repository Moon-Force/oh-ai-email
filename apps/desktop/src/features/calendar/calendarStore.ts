import { create } from "zustand";
import type { CalendarEventCategory, CalendarEventDto, CalendarViewMode } from "./types";
import {
  calendarCreate,
  calendarDelete,
  calendarExportIcsDialog,
  calendarImportIcs,
  calendarList,
  calendarUpdate,
} from "../../lib/ipc";

export function formatIsoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface CalendarStoreState {
  events: CalendarEventDto[];
  selectedDate: string; // YYYY-MM-DD
  viewMode: CalendarViewMode;
  selectedEvent: CalendarEventDto | null;
  eventDialogOpen: boolean;
  eventDialogMode: "create" | "edit" | "view";
  eventDraft: Partial<CalendarEventDto> | null;
  loading: boolean;
  icsImportDialogOpen: boolean;

  loadEvents: (startMs?: number, endMs?: number) => Promise<void>;
  setSelectedDate: (date: string | Date) => void;
  setViewMode: (mode: CalendarViewMode) => void;
  nextPeriod: () => void;
  prevPeriod: () => void;
  goToday: () => void;

  openCreateDialog: (prefill?: Partial<CalendarEventDto>) => void;
  openEditDialog: (event: CalendarEventDto) => void;
  openViewDialog: (event: CalendarEventDto) => void;
  closeDialog: () => void;

  setIcsImportDialogOpen: (open: boolean) => void;

  saveEvent: (event: Partial<CalendarEventDto>) => Promise<CalendarEventDto | null>;
  removeEvent: (id: string) => Promise<boolean>;
  importIcs: (icsText: string) => Promise<number>;
  exportIcs: (eventIds?: string[]) => Promise<void>;

  todayEvents: () => CalendarEventDto[];
  eventsForDate: (dateStr: string) => CalendarEventDto[];
}

export const useCalendarStore = create<CalendarStoreState>((set, get) => ({
  events: [],
  selectedDate: formatIsoDate(),
  viewMode: "month",
  selectedEvent: null,
  eventDialogOpen: false,
  eventDialogMode: "create",
  eventDraft: null,
  loading: false,
  icsImportDialogOpen: false,

  loadEvents: async (startMs, endMs) => {
    set({ loading: true });
    try {
      const list = await calendarList(startMs, endMs);
      set({ events: list, loading: false });
    } catch (err) {
      console.error("[CalendarStore] Failed to load events:", err);
      set({ loading: false });
    }
  },

  setSelectedDate: (date) => {
    const dStr = typeof date === "string" ? date : formatIsoDate(date);
    set({ selectedDate: dStr });
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
  },

  nextPeriod: () => {
    const { selectedDate, viewMode } = get();
    const current = new Date(selectedDate);
    if (viewMode === "month") {
      current.setMonth(current.getMonth() + 1);
    } else if (viewMode === "week") {
      current.setDate(current.getDate() + 7);
    } else {
      current.setDate(current.getDate() + 1);
    }
    set({ selectedDate: formatIsoDate(current) });
  },

  prevPeriod: () => {
    const { selectedDate, viewMode } = get();
    const current = new Date(selectedDate);
    if (viewMode === "month") {
      current.setMonth(current.getMonth() - 1);
    } else if (viewMode === "week") {
      current.setDate(current.getDate() - 7);
    } else {
      current.setDate(current.getDate() - 1);
    }
    set({ selectedDate: formatIsoDate(current) });
  },

  goToday: () => {
    set({ selectedDate: formatIsoDate() });
  },

  openCreateDialog: (prefill) => {
    const defaultDate = get().selectedDate;
    const startTime = prefill?.startTime || new Date(`${defaultDate}T09:00:00`).toISOString();
    const endTime = prefill?.endTime || new Date(`${defaultDate}T10:00:00`).toISOString();

    set({
      eventDialogOpen: true,
      eventDialogMode: "create",
      selectedEvent: null,
      eventDraft: {
        title: "",
        category: "meeting" as CalendarEventCategory,
        color: "#2563EB",
        status: "confirmed",
        startTime,
        endTime,
        startMs: new Date(startTime).getTime(),
        endMs: new Date(endTime).getTime(),
        allDay: false,
        attendees: [],
        recurrence: "none",
        remindMinutesBefore: 15,
        ...prefill,
      },
    });
  },

  openEditDialog: (event) => {
    set({
      eventDialogOpen: true,
      eventDialogMode: "edit",
      selectedEvent: event,
      eventDraft: { ...event },
    });
  },

  openViewDialog: (event) => {
    set({
      eventDialogOpen: true,
      eventDialogMode: "view",
      selectedEvent: event,
      eventDraft: { ...event },
    });
  },

  closeDialog: () => {
    set({
      eventDialogOpen: false,
      selectedEvent: null,
      eventDraft: null,
    });
  },

  setIcsImportDialogOpen: (open) => {
    set({ icsImportDialogOpen: open });
  },

  saveEvent: async (data) => {
    try {
      const { selectedEvent } = get();
      const base = selectedEvent ? { ...selectedEvent, ...data } : data;
      let res: CalendarEventDto | null = null;

      const startTime = base.startTime || new Date().toISOString();
      const endTime =
        base.endTime || new Date(new Date(startTime).getTime() + 3600_000).toISOString();
      const startMs = new Date(startTime).getTime();
      const endMs = new Date(endTime).getTime();

      const payload = {
        title: base.title?.trim() || "未命名日程",
        description: base.description?.trim() || "",
        location: base.location?.trim() || "",
        startTime,
        endTime,
        startMs,
        endMs,
        allDay: Boolean(base.allDay),
        category: (base.category as CalendarEventCategory) || "meeting",
        color: base.color || "#2563EB",
        status: base.status || "confirmed",
        attendees: base.attendees || [],
        sourceMessageId: base.sourceMessageId,
        sourceMessageSubject: base.sourceMessageSubject,
        icsUid: base.icsUid,
        recurrence: base.recurrence || "none",
        remindMinutesBefore: base.remindMinutesBefore ?? 15,
        isReminded: false,
      };

      if (selectedEvent?.id) {
        res = await calendarUpdate(selectedEvent.id, payload);
      } else {
        res = await calendarCreate(payload);
      }

      await get().loadEvents();
      get().closeDialog();
      return res;
    } catch (err) {
      console.error("[CalendarStore] Failed to save event:", err);
      return null;
    }
  },

  removeEvent: async (id) => {
    try {
      const ok = await calendarDelete(id);
      if (ok) {
        set((s) => ({
          events: s.events.filter((e) => e.id !== id),
        }));
        get().closeDialog();
      }
      return ok;
    } catch (err) {
      console.error("[CalendarStore] Failed to delete event:", err);
      return false;
    }
  },

  importIcs: async (icsText) => {
    try {
      const res = await calendarImportIcs(icsText);
      await get().loadEvents();
      return res.importedCount;
    } catch (err) {
      console.error("[CalendarStore] Failed to import ICS:", err);
      return 0;
    }
  },

  exportIcs: async (eventIds) => {
    try {
      await calendarExportIcsDialog(eventIds);
    } catch (err) {
      console.error("[CalendarStore] Failed to export ICS:", err);
    }
  },

  todayEvents: () => {
    const todayStr = formatIsoDate();
    return get().eventsForDate(todayStr);
  },

  eventsForDate: (dateStr) => {
    const { events } = get();
    return events.filter((e) => {
      try {
        const d = formatIsoDate(new Date(e.startTime));
        return d === dateStr;
      } catch {
        return false;
      }
    });
  },
}));
