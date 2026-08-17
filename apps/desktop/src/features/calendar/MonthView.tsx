import { Box, Typography, Tooltip } from "@mui/material";
import { useCalendarStore, formatIsoDate } from "./calendarStore";
import type { CalendarEventDto } from "./types";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export default function MonthView() {
  const selectedDate = useCalendarStore((s) => s.selectedDate);
  const events = useCalendarStore((s) => s.events);
  const openCreateDialog = useCalendarStore((s) => s.openCreateDialog);
  const openViewDialog = useCalendarStore((s) => s.openViewDialog);
  const setSelectedDate = useCalendarStore((s) => s.setSelectedDate);

  const currentDate = new Date(selectedDate);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const todayStr = formatIsoDate();

  // First day of month
  const firstDayOfMonth = new Date(year, month, 1);
  // Weekday (0 = Sun, 1 = Mon ... 6 = Sat) -> convert to Mon = 0, Sun = 6
  let firstDayWeekday = firstDayOfMonth.getDay() - 1;
  if (firstDayWeekday < 0) firstDayWeekday = 6;

  // Days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Days in previous month
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Total cells = 35 or 42
  const totalCells = firstDayWeekday + daysInMonth > 35 ? 42 : 35;

  const cells: Array<{
    dateStr: string;
    dayNum: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    events: CalendarEventDto[];
  }> = [];

  for (let i = 0; i < totalCells; i++) {
    let dayNum: number;
    let cellMonth = month;
    let cellYear = year;
    let isCurrentMonth = true;

    if (i < firstDayWeekday) {
      // Prev month
      dayNum = daysInPrevMonth - (firstDayWeekday - i - 1);
      cellMonth = month - 1;
      if (cellMonth < 0) {
        cellMonth = 11;
        cellYear = year - 1;
      }
      isCurrentMonth = false;
    } else if (i >= firstDayWeekday + daysInMonth) {
      // Next month
      dayNum = i - (firstDayWeekday + daysInMonth) + 1;
      cellMonth = month + 1;
      if (cellMonth > 11) {
        cellMonth = 0;
        cellYear = year + 1;
      }
      isCurrentMonth = false;
    } else {
      // Current month
      dayNum = i - firstDayWeekday + 1;
    }

    const d = new Date(cellYear, cellMonth, dayNum);
    const dateStr = formatIsoDate(d);
    const isToday = dateStr === todayStr;

    // Filter events for this cell
    const cellEvents = events.filter((e) => {
      try {
        const eDate = formatIsoDate(new Date(e.startTime));
        return eDate === dateStr;
      } catch {
        return false;
      }
    });

    cells.push({
      dateStr,
      dayNum,
      isCurrentMonth,
      isToday,
      events: cellEvents,
    });
  }

  const handleCellClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    openCreateDialog({
      startTime: `${dateStr}T09:00:00`,
      endTime: `${dateStr}T10:00:00`,
    });
  };

  const handleEventClick = (e: React.MouseEvent, evt: CalendarEventDto) => {
    e.stopPropagation();
    openViewDialog(evt);
  };

  return (
    <Box
      sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}
    >
      {/* Weekday Headers */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: (t) =>
            t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
          py: 1,
        }}
      >
        {WEEKDAYS.map((w, idx) => (
          <Typography
            key={w}
            variant="caption"
            sx={{
              textAlign: "center",
              fontWeight: 700,
              color: idx >= 5 ? "error.main" : "text.secondary",
            }}
          >
            周{w}
          </Typography>
        ))}
      </Box>

      {/* Days Grid */}
      <Box
        sx={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gridTemplateRows: `repeat(${totalCells / 7}, 1fr)`,
          minHeight: 0,
        }}
      >
        {cells.map((cell, idx) => {
          const maxVisible = 3;
          const visibleEvents = cell.events.slice(0, maxVisible);
          const overflowCount = cell.events.length - maxVisible;

          return (
            <Box
              key={cell.dateStr + "_" + idx}
              onClick={() => handleCellClick(cell.dateStr)}
              sx={{
                borderRight: (idx + 1) % 7 === 0 ? "none" : "1px solid",
                borderBottom: idx >= totalCells - 7 ? "none" : "1px solid",
                borderColor: "divider",
                p: 0.75,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                cursor: "pointer",
                transition: "background-color 0.15s ease",
                bgcolor: cell.isToday
                  ? (t) =>
                      t.palette.mode === "dark" ? "rgba(37,99,235,0.08)" : "rgba(37,99,235,0.04)"
                  : cell.isCurrentMonth
                    ? "transparent"
                    : (t) => (t.palette.mode === "dark" ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.02)"),
                "&:hover": {
                  bgcolor: (t) =>
                    t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                },
              }}
            >
              {/* Day Header */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 0.5,
                }}
              >
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: cell.isToday ? "primary.main" : "transparent",
                    color: cell.isToday
                      ? "#fff"
                      : cell.isCurrentMonth
                        ? "text.primary"
                        : "text.disabled",
                    fontWeight: cell.isToday ? 700 : 500,
                    fontSize: "0.8rem",
                  }}
                >
                  {cell.dayNum}
                </Box>
                {cell.events.length > 0 && (
                  <Typography
                    variant="caption"
                    sx={{ fontSize: "0.7rem", color: "text.secondary", pr: 0.5 }}
                  >
                    {cell.events.length}项
                  </Typography>
                )}
              </Box>

              {/* Event Pills */}
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                  overflow: "hidden",
                }}
              >
                {visibleEvents.map((evt) => {
                  const timeLabel = evt.allDay
                    ? "全天"
                    : new Date(evt.startTime).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      });

                  return (
                    <Tooltip
                      key={evt.id}
                      title={`${timeLabel} ${evt.title}${evt.location ? ` @ ${evt.location}` : ""}`}
                      arrow
                    >
                      <Box
                        onClick={(e) => handleEventClick(e, evt)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 1,
                          fontSize: "0.72rem",
                          fontWeight: 500,
                          bgcolor: (t) =>
                            t.palette.mode === "dark"
                              ? "rgba(255,255,255,0.08)"
                              : "rgba(0,0,0,0.05)",
                          borderLeft: "3px solid",
                          borderLeftColor: evt.color || "#2563EB",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                          transition: "transform 0.1s ease, filter 0.1s ease",
                          "&:hover": {
                            transform: "scale(1.02)",
                            filter: "brightness(1.1)",
                          },
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: "0.68rem",
                            color: "text.secondary",
                            flexShrink: 0,
                            lineHeight: 1,
                          }}
                        >
                          {timeLabel}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            lineHeight: 1,
                          }}
                        >
                          {evt.title}
                        </Typography>
                      </Box>
                    </Tooltip>
                  );
                })}

                {overflowCount > 0 && (
                  <Typography
                    variant="caption"
                    color="primary"
                    sx={{
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      pl: 0.5,
                      lineHeight: 1,
                    }}
                  >
                    +{overflowCount} 更多...
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
