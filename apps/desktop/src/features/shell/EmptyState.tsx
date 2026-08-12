import { Box, Button, Stack, Typography } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import EditIcon from "@mui/icons-material/Edit";
import SyncIcon from "@mui/icons-material/Sync";

type Props = {
  title?: string;
  description?: string;
  onCompose?: () => void;
  onSync?: () => void;
};

export default function EmptyState({
  title = "收件箱已清空",
  description = "新邮件同步后会出现在这里。也可以先写一封试试。",
  onCompose,
  onSync,
}: Props) {
  return (
    <Box
      data-testid="empty-state"
      sx={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 4,
        textAlign: "center",
      }}
    >
      <Stack spacing={2} sx={{ alignItems: "center", maxWidth: 360 }}>
        <EmailIcon sx={{ fontSize: 56, color: "primary.main", opacity: 0.7 }} />
        <Typography variant="h5">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        <Stack direction="row" spacing={1}>
          {onSync && (
            <Button variant="outlined" startIcon={<SyncIcon />} onClick={onSync}>
              立即同步
            </Button>
          )}
          {onCompose && (
            <Button variant="contained" startIcon={<EditIcon />} onClick={onCompose}>
              写新邮件
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
