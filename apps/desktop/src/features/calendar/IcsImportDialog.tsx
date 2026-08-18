import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import { useCalendarStore } from "./calendarStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function IcsImportDialog({ open, onClose }: Props) {
  const importIcs = useCalendarStore((s) => s.importIcs);
  const [icsText, setIcsText] = useState("");
  const [importing, setImporting] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setIcsText(content);
        setResultMsg(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!icsText.trim()) return;
    setImporting(true);
    setResultMsg(null);
    try {
      const count = await importIcs(icsText);
      if (count > 0) {
        setResultMsg({ type: "success", text: `成功导入 ${count} 项日程！` });
        setTimeout(() => {
          onClose();
          setIcsText("");
          setResultMsg(null);
        }, 1200);
      } else {
        setResultMsg({
          type: "error",
          text: "未能从内容中解析出有效日程，请检查 iCalendar (.ics) 格式",
        });
      }
    } catch {
      setResultMsg({ type: "error", text: "导入失败，请检查文件格式" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <FileUploadIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            导入 iCalendar 日历文件 (.ics)
          </Typography>
        </Stack>
        <IconButton size="small" onClick={onClose} aria-label="关闭">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          支持导入来自 Apple Calendar、Google Calendar、Outlook 或邮件导出的标准 RFC 5545{" "}
          <code>.ics</code> 文件。
        </Typography>

        {resultMsg && <Alert severity={resultMsg.type}>{resultMsg.text}</Alert>}

        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button variant="outlined" component="label" startIcon={<FileUploadIcon />}>
            选择 .ics 本地文件
            <input type="file" accept=".ics,text/calendar" hidden onChange={handleFileChange} />
          </Button>
        </Box>

        <TextField
          label="或直接粘贴 ICS 文件纯文本"
          placeholder="BEGIN:VCALENDAR&#10;VERSION:2.0&#10;BEGIN:VEVENT&#10;SUMMARY:会议...&#10;END:VEVENT&#10;END:VCALENDAR"
          value={icsText}
          onChange={(e) => {
            setIcsText(e.target.value);
            setResultMsg(null);
          }}
          multiline
          minRows={6}
          maxRows={10}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <ContentPasteIcon
                  fontSize="small"
                  color="action"
                  sx={{ mr: 1, alignSelf: "flex-start", mt: 1 }}
                />
              ),
            },
          }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button onClick={onClose} disabled={importing}>
          取消
        </Button>
        <Button variant="contained" onClick={handleImport} disabled={!icsText.trim() || importing}>
          {importing ? "正在解析导入..." : "开始导入"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
