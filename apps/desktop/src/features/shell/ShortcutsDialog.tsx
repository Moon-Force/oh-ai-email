import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import { KEYBOARD_SHORTCUTS } from "./useKeyboardShortcuts";

export default function ShortcutsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const categories = Array.from(new Set(KEYBOARD_SHORTCUTS.map((s) => s.category)));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            p: 1,
          },
        },
      }}
      data-testid="shortcuts-dialog"
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <KeyboardIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1.1rem" }}>
            键盘快捷键指南
          </Typography>
        </Stack>
        <IconButton size="small" onClick={onClose} aria-label="关闭快捷键指南">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 1.5, pb: 2 }}>
        <Stack spacing={2}>
          {categories.map((category) => (
            <Box key={category}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  mb: 0.5,
                  display: "block",
                }}
              >
                {category}
              </Typography>
              <List dense disablePadding>
                {KEYBOARD_SHORTCUTS.filter((s) => s.category === category).map((shortcut) => (
                  <ListItem
                    key={shortcut.key}
                    disableGutters
                    sx={{
                      py: 0.5,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <ListItemText
                      primary={shortcut.label}
                      secondary={shortcut.description}
                      slotProps={{
                        primary: { variant: "body2", sx: { fontWeight: 500 } },
                        secondary: { variant: "caption", color: "text.secondary" },
                      }}
                    />
                    <Chip
                      label={shortcut.key}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontFamily: "monospace",
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        height: 24,
                        borderRadius: 1.5,
                        bgcolor: (t) =>
                          t.palette.mode === "dark"
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.04)",
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
