import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventById,
  listCalendarEvents,
  updateCalendarEvent,
  type CalendarEventRecord,
} from "../db";

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format Date to ICS UTC or Local date-time string (YYYYMMDDTHHMMSSZ) */
function formatIcsDate(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) {
    return new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** Parse ICS Date string to ISO string */
function parseIcsDate(raw: string): string {
  const clean = raw.trim();
  // Format: 20260820T140000Z or 20260820T140000 or 20260820
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!match) {
    const fallback = new Date(clean);
    return isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
  }
  const [, year, month, day, hour = "00", minute = "00", second = "00", isUtc] = match;
  if (isUtc) {
    return new Date(
      Date.UTC(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10),
        parseInt(second, 10)
      )
    ).toISOString();
  }
  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    parseInt(second, 10)
  ).toISOString();
}

/**
 * Generate RFC 5545 iCalendar (.ics) string for a single or multiple events.
 */
export function exportEventsToIcs(events: CalendarEventRecord[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Moon-Force//oh-ai-email Calendar//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const evt of events) {
    const uid = evt.icsUid || `event-${evt.id}@oh-ai-email.local`;
    const dtStart = formatIcsDate(evt.startTime);
    const dtEnd = formatIcsDate(evt.endTime);
    const dtStamp = formatIcsDate(new Date(evt.createdAt || Date.now()).toISOString());

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${evt.title.replace(/\n/g, "\\n")}`);
    if (evt.description) {
      lines.push(`DESCRIPTION:${evt.description.replace(/\n/g, "\\n")}`);
    }
    if (evt.location) {
      lines.push(`LOCATION:${evt.location.replace(/\n/g, "\\n")}`);
    }
    if (evt.category) {
      lines.push(`CATEGORIES:${evt.category.toUpperCase()}`);
    }
    if (evt.status) {
      lines.push(`STATUS:${evt.status.toUpperCase()}`);
    }
    if (evt.attendees && evt.attendees.length > 0) {
      for (const att of evt.attendees) {
        lines.push(`ATTENDEE;CN=${att.replace(/;/g, "")}:mailto:${att}`);
      }
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/**
 * Parse RFC 5545 .ics formatted text and return array of partial events.
 */
export function parseIcsContent(icsContent: string): Array<Partial<CalendarEventRecord>> {
  const unfolded = icsContent.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events: Array<Partial<CalendarEventRecord>> = [];

  let inEvent = false;
  let current: Partial<CalendarEventRecord> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      current = {
        attendees: [],
        category: "meeting",
        status: "confirmed",
        color: "#2563eb",
      };
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (inEvent && current.title && current.startTime) {
        if (!current.endTime) {
          // default 1 hour after startTime
          const s = new Date(current.startTime).getTime();
          current.endTime = new Date(s + 3600_000).toISOString();
        }
        current.startMs = new Date(current.startTime).getTime();
        current.endMs = new Date(current.endTime).getTime();
        events.push(current);
      }
      inEvent = false;
      current = {};
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const rawKey = trimmed.slice(0, colonIdx);
    const value = trimmed.slice(colonIdx + 1);
    const key = rawKey.split(";")[0].toUpperCase();

    switch (key) {
      case "SUMMARY":
        current.title = value.replace(/\\n/g, "\n").replace(/\\,/g, ",");
        break;
      case "DESCRIPTION":
        current.description = value.replace(/\\n/g, "\n").replace(/\\,/g, ",");
        break;
      case "LOCATION":
        current.location = value.replace(/\\n/g, "\n").replace(/\\,/g, ",");
        break;
      case "DTSTART":
        current.startTime = parseIcsDate(value);
        break;
      case "DTEND":
        current.endTime = parseIcsDate(value);
        break;
      case "UID":
        current.icsUid = value;
        break;
      case "CATEGORIES": {
        const cat = value.toLowerCase();
        if (cat.includes("work")) current.category = "work";
        else if (cat.includes("personal")) current.category = "personal";
        else if (cat.includes("reminder")) current.category = "reminder";
        else if (cat.includes("travel")) current.category = "travel";
        else current.category = "meeting";
        break;
      }
      case "STATUS": {
        const stat = value.toLowerCase();
        if (stat.includes("tentative")) current.status = "tentative";
        else if (stat.includes("cancel")) current.status = "cancelled";
        else current.status = "confirmed";
        break;
      }
      case "ATTENDEE": {
        const email = value.replace(/^mailto:/i, "").trim();
        if (email) {
          current.attendees = current.attendees || [];
          current.attendees.push(email);
        }
        break;
      }
    }
  }

  return events;
}

/**
 * Import ICS text content into local SQLite database.
 */
export function importIcsEvents(icsContent: string): {
  importedCount: number;
  events: CalendarEventRecord[];
} {
  const parsed = parseIcsContent(icsContent);
  const created: CalendarEventRecord[] = [];

  for (const item of parsed) {
    if (!item.title || !item.startTime) continue;
    const startTime = item.startTime;
    const endTime =
      item.endTime || new Date(new Date(startTime).getTime() + 3600_000).toISOString();
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();

    const evt = createCalendarEvent({
      title: item.title,
      description: item.description,
      location: item.location,
      startTime,
      endTime,
      startMs,
      endMs,
      allDay: item.allDay || false,
      category: item.category || "meeting",
      color: item.color || "#2563eb",
      status: item.status || "confirmed",
      attendees: item.attendees || [],
      icsUid: item.icsUid,
      recurrence: item.recurrence || "none",
      remindMinutesBefore: item.remindMinutesBefore ?? 15,
      isReminded: false,
    });
    created.push(evt);
  }

  return {
    importedCount: created.length,
    events: created,
  };
}

export {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventById,
  listCalendarEvents,
  updateCalendarEvent,
};
