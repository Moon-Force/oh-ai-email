import { Box, Button, Chip, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import EmailIcon from "@mui/icons-material/Email";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import AddIcon from "@mui/icons-material/Add";
import { useCalendarStore, formatIsoDate } from "./calendarStore";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type CalendarEventCategory,
  type CalendarEventDto,
} from "./types";
import { useMailStore } from "../mail/store";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export default function AgendaView() {
  const events = useCalendarStore((s) => s.events);
  const openCreateDialog = useCalendarStore((s) => s.openCreateDialog);
  const openEditDialog = useCalendarStore((s) => s.openEditDialog);
  const openViewDialog = useCalendarStore((s) => s.openViewDialog);
  const removeEvent = useCalendarStore((s) => s.removeEvent);

  const selectMessage = useMailStore((s) => s.select);
  const setView = useMailStore((s) => s.setView);

  const todayStr = formatIsoDate();

  // Group events by date string
  const sorted = [...events].sort((a, b) => a.startMs - b.startMs);
  const grouped: Record<string, CalendarEventDto[]> = {};

  for (const evt of sorted) {
    try {
      const dStr = formatIsoDate(new Date(evt.startTime));
      grouped[dStr] = grouped[dStr] || [];
      grouped[dStr].push(evt);
    } catch {
      // ignore
    }
  }

  const dateKeys = Object.keys(grouped);

  const getDateLabel = (dateStr: string): string => {
    const d = new Date(dateStr);
    const weekday = WEEKDAYS[d.getDay()];
    if (dateStr === todayStr) {
      return `今天 · ${d.getMonth() + 1}月${d.getDate()}日 (${weekday})`;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateStr === formatIsoDate(tomorrow)) {
      return `明天 · ${d.getMonth() + 1}月${d.getDate()}日 (${weekday})`;
    }
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${weekday})`;
  };

  const handleJumpToEmail = (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    setView("mail");
    selectMessage(msgId);
  };

  if (dateKeys.length === 0) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          p: 4,
          bgcolor: "background.paper",
        }}
      >
        <EventBusyIcon sx={{ fontSize: 56, color: "text.disabled" }} />
        <Typography variant="h6" color="text.secondary">
          暂无日程安排
        </Typography>
        <Typography variant="body2" color="text.disabled">
          点击下方按钮或在读信时一键将邮件转为日程
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreateDialog()}>
          新建日程
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", overflowY: "auto", p: 3, bgcolor: "background.paper" }}>
      <Stack spacing={3} sx={{ maxWidth: 880, mx: "auto" }}>
        {dateKeys.map((dateStr) => {
          const dayList = grouped[dateStr];
          const isToday = dateStr === todayStr;

          return (
            <Box key={dateStr}>
              {/* Date Header */}
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.5 }}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 700,
                    color: isToday ? "primary.main" : "text.primary",
                  }}
                >
                  {getDateLabel(dateStr)}
                </Typography>
                <Chip
                  label={`${dayList.length} 项日程`}
                  size="small"
                  variant={isToday ? "filled" : "outlined"}
                  color={isToday ? "primary" : "default"}
                  sx={{ height: 20, fontSize: "0.7rem" }}
                />
              </Stack>

              {/* Event Cards */}
              <Stack spacing={1.5}>
                {dayList.map((evt) => {
                  const sDate = new Date(evt.startTime);
                  const eDate = new Date(evt.endTime);
                  const timeLabel = evt.allDay
                    ? "全天日程"
                    : `${sDate.toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })} - ${eDate.toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}`;

                  return (
                    <Paper
                      key={evt.id}
                      elevation={0}
                      onClick={() => openViewDialog(evt)}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        border: 1,
                        borderColor: "divider",
                        borderLeft: "5px solid",
                        borderLeftColor: evt.color || "#2563EB",
                        cursor: "pointer",
                        transition: "transform 0.15s ease, box-shadow 0.15s ease",
                        "&:hover": {
                          transform: "translateY(-1px)",
                          boxShadow: 2,
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 2,
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.5 }}
                          >
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {evt.title}
                            </Typography>
                            <Chip
                              label={timeLabel}
                              size="small"
                              variant="outlined"
                              sx={{ fontWeight: 600 }}
                            />
                            <Chip
                              label={
                                CATEGORY_LABELS[evt.category as CalendarEventCategory] ||
                                evt.category
                              }
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: "0.7rem",
                                bgcolor: (t) =>
                                  t.palette.mode === "dark"
                                    ? `${CATEGORY_COLORS[evt.category as CalendarEventCategory]}33`
                                    : `${CATEGORY_COLORS[evt.category as CalendarEventCategory]}1A`,
                                color:
                                  CATEGORY_COLORS[evt.category as CalendarEventCategory] ||
                                  "primary.main",
                              }}
                            />
                            {evt.remindMinutesBefore >= 0 && (
                              <Tooltip
                                title={`提前 ${evt.remindMinutesBefore === 0 ? "准时" : `${evt.remindMinutesBefore}分钟`} 提醒`}
                              >
                                <NotificationsActiveIcon
                                  fontSize="small"
                                  color="action"
                                  sx={{ fontSize: 16 }}
                                />
                              </Tooltip>
                            )}
                          </Stack>

                          {evt.location && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}
                            >
                              <LocationOnIcon fontSize="small" sx={{ fontSize: 16 }} />
                              {evt.location}
                            </Typography>
                          )}

                          {evt.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                whiteSpace: "pre-wrap",
                                mb: 1,
                                bgcolor: (t) =>
                                  t.palette.mode === "dark"
                                    ? "rgba(255,255,255,0.02)"
                                    : "rgba(0,0,0,0.02)",
                                p: 1,
                                borderRadius: 1,
                              }}
                            >
                              {evt.description}
                            </Typography>
                          )}

                          {/* Source Email Chip */}
                          {evt.sourceMessageId && (
                            <Chip
                              icon={<EmailIcon fontSize="small" />}
                              label={`来源邮件: ${evt.sourceMessageSubject || "点击查看"}`}
                              size="small"
                              variant="outlined"
                              color="primary"
                              onClick={(e) => handleJumpToEmail(e, evt.sourceMessageId!)}
                              sx={{ mt: 0.5 }}
                            />
                          )}
                        </Box>

                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="编辑日程">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(evt);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="删除日程">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeEvent(evt.id);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
