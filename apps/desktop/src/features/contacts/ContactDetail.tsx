import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SendIcon from "@mui/icons-material/Send";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import BusinessIcon from "@mui/icons-material/Business";
import NotesIcon from "@mui/icons-material/Notes";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";

import { useContactsStore } from "./contactsStore";
import { useMailStore } from "../mail/store";
import type { ContactDto } from "./types";

interface Props {
  contact: ContactDto | null;
}

export default function ContactDetail({ contact }: Props) {
  const toggleStar = useContactsStore((s) => s.toggleStar);
  const openEditDialog = useContactsStore((s) => s.openEditDialog);
  const removeContact = useContactsStore((s) => s.removeContact);

  const openCompose = useMailStore((s) => s.openCompose);
  const setView = useMailStore((s) => s.setView);
  const selectMessage = useMailStore((s) => s.select);
  const allMessages = useMailStore((s) => s.messages);

  if (!contact) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "text.disabled",
        }}
      >
        <Typography variant="body1">请从左侧选择一位联系人查看详情</Typography>
      </Box>
    );
  }

  // Filter messages exchanged with this contact
  const targetEmail = contact.email.toLowerCase();
  const relatedMessages = allMessages.filter((m) => {
    const fromMatch = m.from?.toLowerCase().includes(targetEmail);
    const toMatch = m.to?.toLowerCase().includes(targetEmail);
    return fromMatch || toMatch;
  });

  const handleCompose = () => {
    openCompose({ to: contact.email });
    setView("mail");
  };

  const handleOpenMessage = (msgId: string) => {
    setView("mail");
    selectMessage(msgId);
  };

  const firstLetter = (contact.name || contact.email).slice(0, 1).toUpperCase();

  return (
    <Box sx={{ height: "100%", overflowY: "auto", p: 3, bgcolor: "background.paper" }}>
      <Stack spacing={3} sx={{ maxWidth: 720, mx: "auto" }}>
        {/* Header Profile */}
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Stack direction="row" spacing={2.5} sx={{ alignItems: "center" }}>
            <Avatar
              sx={{
                width: 64,
                height: 64,
                bgcolor: contact.avatarColor || "#2563EB",
                fontSize: "1.75rem",
                fontWeight: 700,
                boxShadow: 2,
              }}
            >
              {firstLetter}
            </Avatar>
            <Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {contact.name}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => toggleStar(contact.id)}
                  color={contact.isStarred ? "warning" : "default"}
                >
                  {contact.isStarred ? <StarIcon /> : <StarBorderIcon />}
                </IconButton>
              </Stack>
              {(contact.jobTitle || contact.company) && (
                <Typography variant="body2" color="text.secondary">
                  {[contact.jobTitle, contact.company].filter(Boolean).join(" · ")}
                </Typography>
              )}
            </Box>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={handleCompose}
              size="small"
            >
              发送邮件
            </Button>
            <Tooltip title="编辑联系人">
              <IconButton size="small" onClick={() => openEditDialog(contact)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除联系人">
              <IconButton size="small" color="error" onClick={() => removeContact(contact.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Divider />

        {/* Info Cards */}
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
                <EmailIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  电子邮箱
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                {contact.email}
              </Typography>
              {contact.secondaryEmails && contact.secondaryEmails.length > 0 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  备用：{contact.secondaryEmails.join(", ")}
                </Typography>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
                <PhoneIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  联系电话
                </Typography>
              </Stack>
              <Typography variant="body2" color={contact.phone ? "text.primary" : "text.disabled"}>
                {contact.phone || "未设置电话"}
              </Typography>
            </Paper>
          </Stack>

          {(contact.company || contact.jobTitle) && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
                <BusinessIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  组织职位
                </Typography>
              </Stack>
              <Typography variant="body2">
                {[contact.company, contact.jobTitle].filter(Boolean).join(" · ")}
              </Typography>
            </Paper>
          )}

          {contact.tags && contact.tags.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
                <LocalOfferIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  分类标签
                </Typography>
              </Stack>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
                {contact.tags.map((t) => (
                  <Chip key={t} label={t} size="small" color="primary" variant="outlined" />
                ))}
              </Box>
            </Paper>
          )}

          {contact.notes && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
                <NotesIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  备注信息
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: "text.secondary" }}>
                {contact.notes}
              </Typography>
            </Paper>
          )}
        </Stack>

        {/* Exchanged Messages Timeline */}
        <Box sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.5 }}>
            <MarkEmailReadIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              往来邮件历史 ({relatedMessages.length})
            </Typography>
          </Stack>

          {relatedMessages.length === 0 ? (
            <Typography variant="body2" color="text.disabled" sx={{ pl: 1 }}>
              暂未检索到与该邮箱的历史往来邮件
            </Typography>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <List dense sx={{ py: 0 }}>
                {relatedMessages.slice(0, 10).map((msg, idx) => (
                  <ListItem
                    key={msg.id}
                    divider={idx < relatedMessages.length - 1}
                    onClick={() => handleOpenMessage(msg.id)}
                    sx={{
                      cursor: "pointer",
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: "center", justifyContent: "space-between" }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: msg.unread ? 700 : 500 }}>
                            {msg.subject || "（无主题）"}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ flexShrink: 0 }}
                          >
                            {msg.date || "刚刚"}
                          </Typography>
                        </Stack>
                      }
                      secondary={
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            mt: 0.25,
                          }}
                        >
                          {msg.snippet || "无正文摘要"}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
