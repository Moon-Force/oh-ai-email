import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import { useContactsStore } from "./contactsStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ContactHarvesterDialog({ open, onClose }: Props) {
  const candidates = useContactsStore((s) => s.harvestedCandidates);
  const importContact = useContactsStore((s) => s.importHarvestedContact);

  const handleImportAll = async () => {
    for (const c of candidates) {
      await importContact(c);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <AutoAwesomeIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            邮件智能联系人发现
          </Typography>
        </Stack>
        <IconButton size="small" onClick={onClose} aria-label="关闭">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box
          sx={{
            p: 2,
            bgcolor: (t) =>
              t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            AI 扫描了您的本地邮件往来，已为您发现 <strong>{candidates.length}</strong>{" "}
            位经常沟通但尚未录入通讯录的联系人：
          </Typography>
        </Box>

        {candidates.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              太棒了！所有经常往来的发件人均已录入通讯录。
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight: 380, overflowY: "auto", py: 0 }}>
            {candidates.map((c) => (
              <ListItem
                key={c.email}
                divider
                secondaryAction={
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PersonAddAlt1Icon />}
                    onClick={() => importContact(c)}
                  >
                    添加
                  </Button>
                }
              >
                <ListItemAvatar>
                  <Avatar
                    sx={{ bgcolor: "primary.main", width: 36, height: 36, fontSize: "0.9rem" }}
                  >
                    {c.name.slice(0, 1).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {c.name}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {c.email} · 来往 {c.count} 封邮件
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, justifyContent: "space-between" }}>
        <Button onClick={onClose}>完成</Button>
        {candidates.length > 0 && (
          <Button variant="contained" onClick={handleImportAll}>
            全部一键导入 ({candidates.length})
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
