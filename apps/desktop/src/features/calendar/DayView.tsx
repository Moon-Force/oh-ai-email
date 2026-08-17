import { useEffect, useRef } from "react";
import { Box, Typography, Tooltip, Stack, Chip, Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useCalendarStore, formatIsoDate } from "./calendarStore";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export default function DayView() {
  const selectedDate = useCalendarStore((s) => s.selectedDate);
  const events = useCalendarStore((s) => s.events);
  const openCreateDialog = useCalendarStore((s) => s.openCreateDialog);
  const openViewDialog = useCalendarStore((s) => s.openViewDialog);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const curr = new Date(selectedDate);
  const dateStr = formatIsoDate(curr);
  const isToday = dateStr === formatIsoDate();
  const weekdayName = WEEKDAYS[curr.getDay()];

  const dayEvents = events.filter((e) => {
    try {
      return formatIsoDate(new Date(e.startTime)) === dateStr;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 8 * 56;
    }
  }, []);

  const handleSlotClick = (hour: number) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const startTime = `${dateStr}T${pad(hour)}:00:00`;
    const endTime = `${dateStr}T${pad(Math.min(hour + 1, 23))}:00:00`;
    openCreateDialog({ startTime, endTime });
  };

  return (
    <Box
      sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}
    >
      {/* Day Banner */}
      <Box
        sx={{
          px: 3,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: (t) =>
            t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {curr.getFullYear()} 年 {curr.getMonth() + 1} 月 {curr.getDate()} 日
          </Typography>
          <Chip
            label={weekdayName}
            size="small"
            color={isToday ? "primary" : "default"}
            variant={isToday ? "filled" : "outlined"}
          />
          {isToday && <Chip label="今天" size="small" color="success" variant="outlined" />}
          <Typography variant="body2" color="text.secondary">
            共 {dayEvents.length} 项日程
          </Typography>
        </Stack>

        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() =>
            openCreateDialog({
              startTime: `${dateStr}T09:00:00`,
              endTime: `${dateStr}T10:00:00`,
            })
          }
        >
          添加日程
        </Button>
      </Box>

      {/* Hourly Timeline */}
      <Box
        ref={scrollContainerRef}
        sx={{
          flex: 1,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "70px 1fr",
          position: "relative",
        }}
      >
        {/* Time Labels */}
        <Box sx={{ borderRight: 1, borderColor: "divider", py: 0.5 }}>
          {HOURS.map((h) => (
            <Box
              key={h}
              sx={{
                height: 56,
                pr: 1.5,
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "flex-start",
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem", mt: -0.75 }}
              >
                {String(h).padStart(2, "0")}:00
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Content Column */}
        <Box sx={{ position: "relative" }}>
          {HOURS.map((h) => (
            <Box
              key={h}
              onClick={() => handleSlotClick(h)}
              sx={{
                height: 56,
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

          {/* Events */}
          {dayEvents.map((evt) => {
            const sDate = new Date(evt.startTime);
            const eDate = new Date(evt.endTime);
            const startHour = sDate.getHours() + sDate.getMinutes() / 60;
            let endHour = eDate.getHours() + eDate.getMinutes() / 60;
            if (endHour <= startHour) endHour = startHour + 1;
            const duration = Math.max(endHour - startHour, 0.5);

            const top = startHour * 56;
            const height = Math.max(duration * 56 - 4, 32);

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
              <Tooltip key={evt.id} title={`${timeStr} · ${evt.title}`} arrow>
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                    openViewDialog(evt);
                  }}
                  sx={{
                    position: "absolute",
                    top: `${top}px`,
                    left: "12px",
                    right: "24px",
                    height: `${height}px`,
                    bgcolor: (t) =>
                      t.palette.mode === "dark" ? "rgba(37,99,235,0.25)" : "rgba(37,99,235,0.12)",
                    borderLeft: "4px solid",
                    borderLeftColor: evt.color || "#2563EB",
                    borderRadius: 1.5,
                    p: 1,
                    overflow: "hidden",
                    cursor: "pointer",
                    zIndex: 2,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    boxShadow: 1,
                    transition: "all 0.12s ease",
                    "&:hover": {
                      zIndex: 5,
                      boxShadow: 3,
                      filter: "brightness(1.1)",
                    },
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary" }}>
                      {evt.title}
                    </Typography>
                    <Chip
                      label={timeStr}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: "0.7rem" }}
                    />
                    {evt.location && (
                      <Typography variant="caption" color="text.secondary">
                        📍 {evt.location}
                      </Typography>
                    )}
                  </Stack>
                  {evt.description && height > 45 && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        mt: 0.5,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {evt.description}
                    </Typography>
                  )}
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
