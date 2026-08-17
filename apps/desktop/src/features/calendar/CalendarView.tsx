import { useEffect } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";
import AddIcon from "@mui/icons-material/Add";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import ViewDayIcon from "@mui/icons-material/ViewDay";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";

import { useCalendarStore } from "./calendarStore";
import type { CalendarViewMode } from "./types";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DayView from "./DayView";
import AgendaView from "./AgendaView";
import EventDialog from "./EventDialog";
import IcsImportDialog from "./IcsImportDialog";
import { onCalendarOpenEvent } from "../../lib/ipc";

export default function CalendarView() {
  const events = useCalendarStore((s) => s.events);
  const selectedDate = useCalendarStore((s) => s.selectedDate);
  const viewMode = useCalendarStore((s) => s.viewMode);
  const eventDialogOpen = useCalendarStore((s) => s.eventDialogOpen);
  const icsImportDialogOpen = useCalendarStore((s) => s.icsImportDialogOpen);

  const loadEvents = useCalendarStore((s) => s.loadEvents);
  const setViewMode = useCalendarStore((s) => s.setViewMode);
  const nextPeriod = useCalendarStore((s) => s.nextPeriod);
  const prevPeriod = useCalendarStore((s) => s.prevPeriod);
  const goToday = useCalendarStore((s) => s.goToday);
  const openCreateDialog = useCalendarStore((s) => s.openCreateDialog);
  const closeDialog = useCalendarStore((s) => s.closeDialog);
  const setIcsImportDialogOpen = useCalendarStore((s) => s.setIcsImportDialogOpen);
  const exportIcs = useCalendarStore((s) => s.exportIcs);
  const openViewDialog = useCalendarStore((s) => s.openViewDialog);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Listen to desktop notification click events
  useEffect(() => {
    const unsub = onCalendarOpenEvent(({ eventId }) => {
      const target = useCalendarStore.getState().events.find((e) => e.id === eventId);
      if (target) {
        openViewDialog(target);
      }
    });
    return unsub;
  }, [openViewDialog]);

  // Format header title
  const current = new Date(selectedDate);
  let titleText = "";
  if (viewMode === "month") {
    titleText = `${current.getFullYear()} 年 ${current.getMonth() + 1} 月`;
  } else if (viewMode === "week") {
    let dayOfWeek = current.getDay() - 1;
    if (dayOfWeek < 0) dayOfWeek = 6;
    const monday = new Date(current);
    monday.setDate(current.getDate() - dayOfWeek);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    titleText = `${monday.getMonth() + 1}月${monday.getDate()}日 - ${sunday.getMonth() + 1}月${sunday.getDate()}日 (${current.getFullYear()})`;
  } else if (viewMode === "day") {
    titleText = `${current.getFullYear()} 年 ${current.getMonth() + 1} 月 ${current.getDate()} 日`;
  } else {
    titleText = `日程清单 (${events.length} 项)`;
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top Calendar Toolbar */}
      <Box
        sx={{
          px: 2.5,
          py: 1.25,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          bgcolor: "background.paper",
        }}
      >
        {/* Left: Navigation Controls */}
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<TodayIcon />}
            onClick={goToday}
            sx={{ fontWeight: 600 }}
          >
            今天
          </Button>

          <ButtonGroup size="small" variant="outlined">
            <Tooltip title="上一周期">
              <IconButton size="small" onClick={prevPeriod}>
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="下一周期">
              <IconButton size="small" onClick={nextPeriod}>
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </ButtonGroup>

          <Typography variant="h6" sx={{ fontWeight: 700, minWidth: 200 }}>
            {titleText}
          </Typography>
        </Stack>

        {/* Right: View Switcher and Action Buttons */}
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <ToggleButtonGroup
            size="small"
            value={viewMode}
            exclusive
            onChange={(_e, val) => val && setViewMode(val as CalendarViewMode)}
            aria-label="日历视图切换"
          >
            <ToggleButton value="month" aria-label="月视图">
              <CalendarMonthIcon fontSize="small" sx={{ mr: 0.5 }} />月
            </ToggleButton>
            <ToggleButton value="week" aria-label="周视图">
              <ViewWeekIcon fontSize="small" sx={{ mr: 0.5 }} />周
            </ToggleButton>
            <ToggleButton value="day" aria-label="日视图">
              <ViewDayIcon fontSize="small" sx={{ mr: 0.5 }} />日
            </ToggleButton>
            <ToggleButton value="agenda" aria-label="清单视图">
              <FormatListBulletedIcon fontSize="small" sx={{ mr: 0.5 }} />
              清单
            </ToggleButton>
          </ToggleButtonGroup>

          <Tooltip title="从 .ics 文件导入日程">
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileUploadIcon />}
              onClick={() => setIcsImportDialogOpen(true)}
            >
              导入 .ics
            </Button>
          </Tooltip>

          <Tooltip title="导出当前日历为 .ics 文件">
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={() => exportIcs()}
            >
              导出
            </Button>
          </Tooltip>

          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openCreateDialog()}
          >
            新建日程
          </Button>
        </Stack>
      </Box>

      {/* Main View Area */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {viewMode === "month" && <MonthView />}
        {viewMode === "week" && <WeekView />}
        {viewMode === "day" && <DayView />}
        {viewMode === "agenda" && <AgendaView />}
      </Box>

      {/* Dialogs */}
      <EventDialog open={eventDialogOpen} onClose={closeDialog} />
      <IcsImportDialog open={icsImportDialogOpen} onClose={() => setIcsImportDialogOpen(false)} />
    </Box>
  );
}
