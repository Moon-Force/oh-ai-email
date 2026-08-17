import { BrowserWindow, Notification } from "electron";
import { getUpcomingReminders, markCalendarEventReminded, type CalendarEventRecord } from "../db";

let schedulerTimer: NodeJS.Timeout | null = null;
let currentWindow: BrowserWindow | null = null;

function formatEventTime(event: CalendarEventRecord): string {
  try {
    const d = new Date(event.startTime);
    const dateStr = d.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    });
    const timeStr = d.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    if (event.allDay) return `${dateStr} (全天)`;
    return `${dateStr} ${timeStr}`;
  } catch {
    return event.startTime;
  }
}

export function showCalendarReminderNotification(
  event: CalendarEventRecord,
  mainWindow?: BrowserWindow | null
): void {
  if (!Notification.isSupported()) return;

  const timeLabel = formatEventTime(event);
  const locationLabel = event.location ? ` @ ${event.location}` : "";
  const title = `📅 日程提醒 · ${event.title}`;
  const body = `${timeLabel}${locationLabel}${event.description ? `\n${event.description}` : ""}`;

  const notification = new Notification({
    title,
    body,
    silent: false,
  });

  notification.on("click", () => {
    const win = mainWindow || currentWindow;
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      win.webContents.send("calendar:open-event", {
        eventId: event.id,
        sourceMessageId: event.sourceMessageId,
      });
    }
  });

  notification.show();
}

/**
 * Check upcoming reminders and trigger desktop notifications.
 */
export function checkUpcomingReminders(mainWindow?: BrowserWindow | null): void {
  try {
    const now = Date.now();
    const upcoming = getUpcomingReminders(now, 60_000);
    for (const event of upcoming) {
      showCalendarReminderNotification(event, mainWindow || currentWindow);
      markCalendarEventReminded(event.id);
    }
  } catch (err) {
    console.error("[CalendarScheduler] Error polling reminders:", err);
  }
}

export function startCalendarScheduler(mainWindow?: BrowserWindow | null): void {
  if (schedulerTimer) return;
  currentWindow = mainWindow || null;

  // Run initial check after 3 seconds
  setTimeout(() => {
    checkUpcomingReminders(currentWindow);
  }, 3000);

  // Poll every 30 seconds
  schedulerTimer = setInterval(() => {
    checkUpcomingReminders(currentWindow);
  }, 30_000);
}

export function stopCalendarScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
