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
import { useContactsStore } from "./contactsStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function VcfImportDialog({ open, onClose }: Props) {
  const importVcf = useContactsStore((s) => s.importVcf);
  const [vcfText, setVcfText] = useState("");
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
        setVcfText(content);
        setResultMsg(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!vcfText.trim()) return;
    setImporting(true);
    setResultMsg(null);
    try {
      const count = await importVcf(vcfText);
      if (count > 0) {
        setResultMsg({ type: "success", text: `成功导入 ${count} 位联系人！` });
        setTimeout(() => {
          onClose();
          setVcfText("");
          setResultMsg(null);
        }, 1200);
      } else {
        setResultMsg({
          type: "error",
          text: "未能从内容中解析出有效联系人，请检查 vCard (.vcf) 格式",
        });
      }
    } catch {
      setResultMsg({ type: "error", text: "导入失败，请检查文件内容格式" });
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
            导入通讯录 vCard 文件 (.vcf)
          </Typography>
        </Stack>
        <IconButton size="small" onClick={onClose} aria-label="关闭">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          支持从 iPhone、Android、macOS 通讯录、Outlook 导出的标准 <code>.vcf</code> (vCard 3.0)
          文件。
        </Typography>

        {resultMsg && <Alert severity={resultMsg.type}>{resultMsg.text}</Alert>}

        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button variant="outlined" component="label" startIcon={<FileUploadIcon />}>
            选择 .vcf 本地文件
            <input type="file" accept=".vcf,text/vcard" hidden onChange={handleFileChange} />
          </Button>
        </Box>

        <TextField
          label="或直接粘贴 vCard 纯文本"
          placeholder="BEGIN:VCARD&#10;VERSION:3.0&#10;FN:张三&#10;EMAIL:zhangsan@example.com&#10;END:VCARD"
          value={vcfText}
          onChange={(e) => {
            setVcfText(e.target.value);
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
        <Button variant="contained" onClick={handleImport} disabled={!vcfText.trim() || importing}>
          {importing ? "正在解析导入..." : "开始导入"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
