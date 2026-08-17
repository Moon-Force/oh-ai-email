import { useEffect, useRef } from "react";
import { Box, Typography, Tooltip } from "@mui/material";
import { useCalendarStore, formatIsoDate } from "./calendarStore";
import type { CalendarEventDto } from "./types";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export default function WeekView() {
  const selectedDate = useCalendarStore((s) => s.selectedDate);
  const events = useCalendarStore((s) => s.events);
  const openCreateDialog = useCalendarStore((s) => s.openCreateDialog);
  const openViewDialog = useCalendarStore((s) => s.openViewDialog);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const todayStr = formatIsoDate();
  const current = new Date(selectedDate);

  // Compute Monday of this week
  let dayOfWeek = current.getDay() - 1; // Mon = 0, Sun = 6
  if (dayOfWeek < 0) dayOfWeek = 6;
  const monday = new Date(current);
  monday.setDate(current.getDate() - dayOfWeek);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = formatIsoDate(d);
    return {
      date: d,
      dateStr,
      dayNum: d.getDate(),
      month: d.getMonth() + 1,
      weekdayName: WEEKDAYS[i],
      isToday: dateStr === todayStr,
    };
  });

  // Scroll to 8:00 AM on initial mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 8 * 52; // 52px per hour
    }
  }, []);

  const handleSlotClick = (dateStr: string, hour: number) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const startTime = `${dateStr}T${pad(hour)}:00:00`;
    const endTime = `${dateStr}T${pad(Math.min(hour + 1, 23))}:00:00`;
    openCreateDialog({ startTime, endTime });
  };

  const handleEventClick = (e: React.MouseEvent, evt: CalendarEventDto) => {
    e.stopPropagation();
    openViewDialog(evt);
  };

  return (
    <Box
      sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}
    >
      {/* Week Header */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "60px repeat(7, 1fr)",
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: (t) =>
            t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
          py: 1,
          pr: "16px", // scrollbar padding alignment
        }}
      >
        <Box />
        {weekDays.map((d) => (
          <Box
            key={d.dateStr}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.25,
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
              周{d.weekdayName}
            </Typography>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: d.isToday ? "primary.main" : "transparent",
                color: d.isToday ? "#fff" : "text.primary",
                fontWeight: d.isToday ? 700 : 600,
                fontSize: "0.85rem",
              }}
            >
              {d.dayNum}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Hourly Grid Scrollable Area */}
      <Box
        ref={scrollContainerRef}
        sx={{
          flex: 1,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "60px repeat(7, 1fr)",
          position: "relative",
        }}
      >
        {/* Time Labels Column */}
        <Box sx={{ borderRight: 1, borderColor: "divider", py: 0.5 }}>
          {HOURS.map((h) => (
            <Box
              key={h}
              sx={{
                height: 52,
                pr: 1,
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "flex-start",
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.7rem", mt: -0.75 }}
              >
                {String(h).padStart(2, "0")}:00
              </Typography>
            </Box>
          ))}
        </Box>

        {/* 7 Day Columns */}
        {weekDays.map((day) => {
          const dayEvents = events.filter((e) => {
            try {
              return formatIsoDate(new Date(e.startTime)) === day.dateStr;
            } catch {
              return false;
            }
          });

          return (
            <Box
              key={day.dateStr}
              sx={{
                borderRight: 1,
                borderColor: "divider",
                position: "relative",
                bgcolor: day.isToday
                  ? (t) =>
                      t.palette.mode === "dark" ? "rgba(37,99,235,0.03)" : "rgba(37,99,235,0.015)"
                  : "transparent",
              }}
            >
              {/* Hour Grid Lines */}
              {HOURS.map((h) => (
                <Box
                  key={h}
                  onClick={() => handleSlotClick(day.dateStr, h)}
                  sx={{
                    height: 52,
                    borderBottom: "1px dashed",
                    borderColor: (t) =>
                      t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                    cursor: "pointer",
                    "&:hover": {
                      bgcolor: (t) =>
                        t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    },
                  }}
                />
              ))}

              {/* Event Cards Positioned by Time */}
              {dayEvents.map((evt) => {
                const sDate = new Date(evt.startTime);
                const eDate = new Date(evt.endTime);
                const startHour = sDate.getHours() + sDate.getMinutes() / 60;
                let endHour = eDate.getHours() + eDate.getMinutes() / 60;
                if (endHour <= startHour) endHour = startHour + 1;
                const duration = Math.max(endHour - startHour, 0.5);

                const top = startHour * 52;
                const height = Math.max(duration * 52 - 2, 24);

                const timeStr = `${sDate.toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })} - ${eDate.toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}`;

                return (
                  <Tooltip
                    key={evt.id}
                    title={`${timeStr} · ${evt.title}${evt.location ? ` @ ${evt.location}` : ""}`}
                    arrow
                  >
                    <Box
                      onClick={(e) => handleEventClick(e, evt)}
                      sx={{
                        position: "absolute",
                        top: `${top}px`,
                        left: "4px",
                        right: "4px",
                        height: `${height}px`,
                        bgcolor: (t) =>
                          t.palette.mode === "dark"
                            ? "rgba(37,99,235,0.25)"
                            : "rgba(37,99,235,0.12)",
                        borderLeft: "3px solid",
                        borderLeftColor: evt.color || "#2563EB",
                        borderRadius: 1,
                        p: 0.5,
                        overflow: "hidden",
                        cursor: "pointer",
                        zIndex: 2,
                        transition: "all 0.1s ease",
                        "&:hover": {
                          zIndex: 5,
                          boxShadow: 2,
                          filter: "brightness(1.1)",
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.72rem",
                          display: "block",
                          lineHeight: 1.2,
                          color: "text.primary",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {evt.title}
                      </Typography>
                      {height > 36 && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: "0.65rem",
                            color: "text.secondary",
                            display: "block",
                            lineHeight: 1.1,
                          }}
                        >
                          {timeStr}
                        </Typography>
                      )}
                      {height > 50 && evt.location && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: "0.65rem",
                            color: "text.secondary",
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          📍 {evt.location}
                        </Typography>
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
