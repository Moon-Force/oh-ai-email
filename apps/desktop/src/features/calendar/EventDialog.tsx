import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import EmailIcon from "@mui/icons-material/Email";
import EventIcon from "@mui/icons-material/Event";
import { useCalendarStore } from "./calendarStore";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type CalendarEventCategory,
  type CalendarEventDto,
} from "./types";
import { useMailStore } from "../mail/store";

interface Props {
  open: boolean;
  onClose: () => void;
}

const REMINDER_OPTIONS = [
  { value: -1, label: "不提醒" },
  { value: 0, label: "准时提醒" },
  { value: 5, label: "提前 5 分钟" },
  { value: 10, label: "提前 10 分钟" },
  { value: 15, label: "提前 15 分钟 (推荐)" },
  { value: 30, label: "提前 30 分钟" },
  { value: 60, label: "提前 1 小时" },
  { value: 1440, label: "提前 1 天" },
];

function toLocalDatetimeInput(isoString?: string): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export default function EventDialog({ open, onClose }: Props) {
  const eventDraft = useCalendarStore((s) => s.eventDraft);
  const selectedEvent = useCalendarStore((s) => s.selectedEvent);
  const dialogMode = useCalendarStore((s) => s.eventDialogMode);
  const saveEvent = useCalendarStore((s) => s.saveEvent);
  const removeEvent = useCalendarStore((s) => s.removeEvent);
  const openEditDialog = useCalendarStore((s) => s.openEditDialog);

  const selectMessage = useMailStore((s) => s.select);
  const setView = useMailStore((s) => s.setView);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<CalendarEventCategory>("meeting");
  const [allDay, setAllDay] = useState(false);
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");
  const [remindMinutes, setRemindMinutes] = useState(15);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && eventDraft) {
      setTitle(eventDraft.title || "");
      setDescription(eventDraft.description || "");
      setLocation(eventDraft.location || "");
      setCategory(eventDraft.category || "meeting");
      setAllDay(Boolean(eventDraft.allDay));
      setStartTimeInput(toLocalDatetimeInput(eventDraft.startTime));
      setEndTimeInput(toLocalDatetimeInput(eventDraft.endTime));
      setRemindMinutes(
        eventDraft.remindMinutesBefore !== undefined ? eventDraft.remindMinutesBefore : 15
      );
      setAttendees(eventDraft.attendees || []);
      setAttendeeInput("");
    }
  }, [open, eventDraft]);

  const isViewOnly = dialogMode === "view";

  const handleAddAttendee = () => {
    const val = attendeeInput.trim();
    if (val && !attendees.includes(val)) {
      setAttendees([...attendees, val]);
      setAttendeeInput("");
    }
  };

  const handleRemoveAttendee = (att: string) => {
    setAttendees(attendees.filter((a) => a !== att));
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const startIso = startTimeInput
      ? new Date(startTimeInput).toISOString()
      : new Date().toISOString();
    let endIso = endTimeInput ? new Date(endTimeInput).toISOString() : "";
    if (!endIso || new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      endIso = new Date(new Date(startIso).getTime() + 3600_000).toISOString();
    }

    const payload: Partial<CalendarEventDto> = {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      category,
      color: CATEGORY_COLORS[category] || "#2563EB",
      allDay,
      startTime: startIso,
      endTime: endIso,
      remindMinutesBefore: remindMinutes,
      attendees,
      sourceMessageId: eventDraft?.sourceMessageId,
      sourceMessageSubject: eventDraft?.sourceMessageSubject,
      icsUid: eventDraft?.icsUid,
    };

    await saveEvent(payload);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (selectedEvent?.id) {
      await removeEvent(selectedEvent.id);
    }
  };

  const handleJumpToSourceEmail = () => {
    if (eventDraft?.sourceMessageId) {
      onClose();
      setView("mail");
      selectMessage(eventDraft.sourceMessageId);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <EventIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {isViewOnly ? "日程详情" : dialogMode === "edit" ? "编辑日程" : "新建日程"}
          </Typography>
        </Stack>
        <IconButton size="small" onClick={onClose} aria-label="关闭">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 2 }}>
        {/* Source Email Banner if converted from email */}
        {eventDraft?.sourceMessageId && (
          <Alert
            severity="info"
            icon={<EmailIcon fontSize="small" />}
            action={
              <Button size="small" color="inherit" onClick={handleJumpToSourceEmail}>
                查看邮件
              </Button>
            }
            sx={{ py: 0.5 }}
          >
            来自邮件：{eventDraft.sourceMessageSubject || "关联邮件"}
          </Alert>
        )}

        {/* Title */}
        <TextField
          label="日程标题"
          placeholder="例如：产品评审会、周五团队聚餐"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isViewOnly}
          fullWidth
          required
          autoFocus={dialogMode === "create"}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      bgcolor: CATEGORY_COLORS[category] || "#2563EB",
                    }}
                  />
                </InputAdornment>
              ),
            },
          }}
        />

        {/* Category & All day switch */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: "center" }}>
          <FormControl fullWidth size="small" sx={{ flex: 1.4 }}>
            <InputLabel id="category-label">分类属性</InputLabel>
            <Select
              labelId="category-label"
              value={category}
              label="分类属性"
              disabled={isViewOnly}
              onChange={(e) => setCategory(e.target.value as CalendarEventCategory)}
            >
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <MenuItem key={k} value={k}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: CATEGORY_COLORS[k as CalendarEventCategory],
                      }}
                    />
                    <Typography variant="body2">{label}</Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ flex: 1, display: "flex", alignItems: "center" }}>
            <FormControlLabel
              control={
                <Switch
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  disabled={isViewOnly}
                />
              }
              label="全天日程"
            />
          </Box>
        </Stack>

        {/* Date / Time Inputs */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="开始时间"
            type={allDay ? "date" : "datetime-local"}
            value={allDay ? startTimeInput.split("T")[0] : startTimeInput}
            onChange={(e) => setStartTimeInput(e.target.value)}
            disabled={isViewOnly}
            fullWidth
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="结束时间"
            type={allDay ? "date" : "datetime-local"}
            value={allDay ? endTimeInput.split("T")[0] : endTimeInput}
            onChange={(e) => setEndTimeInput(e.target.value)}
            disabled={isViewOnly}
            fullWidth
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>

        {/* Location & Reminder */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="地点 / 会议链接"
            placeholder="腾讯会议、Zoom、302 会议室"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={isViewOnly}
            fullWidth
            size="small"
            sx={{ flex: 1.4 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LocationOnIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControl fullWidth size="small" sx={{ flex: 1 }}>
            <InputLabel id="reminder-label">提醒设置</InputLabel>
            <Select
              labelId="reminder-label"
              value={remindMinutes}
              label="提醒设置"
              disabled={isViewOnly}
              onChange={(e) => setRemindMinutes(Number(e.target.value))}
              startAdornment={
                <InputAdornment position="start">
                  <NotificationsActiveIcon fontSize="small" color="action" />
                </InputAdornment>
              }
            >
              {REMINDER_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {/* Attendees */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            参与人 (Attendees)
          </Typography>
          {!isViewOnly && (
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField
                size="small"
                placeholder="输入参与人邮箱并回车添加"
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAttendee();
                  }
                }}
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <PeopleAltIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button size="small" variant="outlined" onClick={handleAddAttendee}>
                添加
              </Button>
            </Stack>
          )}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
            {attendees.map((att) => (
              <Chip
                key={att}
                label={att}
                size="small"
                variant="outlined"
                onDelete={!isViewOnly ? () => handleRemoveAttendee(att) : undefined}
              />
            ))}
            {attendees.length === 0 && isViewOnly && (
              <Typography variant="caption" color="text.secondary">
                无参与人
              </Typography>
            )}
          </Box>
        </Box>

        {/* Description / Notes */}
        <TextField
          label="详细描述 / 会议议程"
          placeholder="添加会议纪要、讨论要点或背景说明…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isViewOnly}
          multiline
          minRows={3}
          maxRows={6}
          fullWidth
        />
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, justifyContent: "space-between" }}>
        <Box>
          {selectedEvent && (
            <Tooltip title="删除该日程">
              <Button color="error" startIcon={<DeleteIcon />} onClick={handleDelete}>
                删除
              </Button>
            </Tooltip>
          )}
        </Box>
        <Stack direction="row" spacing={1.5}>
          {isViewOnly ? (
            <>
              <Button onClick={onClose}>关闭</Button>
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => selectedEvent && openEditDialog(selectedEvent)}
              >
                编辑
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onClose} disabled={saving}>
                取消
              </Button>
              <Button variant="contained" onClick={handleSave} disabled={!title.trim() || saving}>
                {saving ? "保存中..." : "保存日程"}
              </Button>
            </>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
