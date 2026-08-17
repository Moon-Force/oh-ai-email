import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import BusinessIcon from "@mui/icons-material/Business";
import WorkIcon from "@mui/icons-material/Work";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { useContactsStore } from "./contactsStore";
import { DEFAULT_CONTACT_TAGS, type ContactDto } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ContactDialog({ open, onClose }: Props) {
  const contactDraft = useContactsStore((s) => s.contactDraft);
  const dialogMode = useContactsStore((s) => s.contactDialogMode);
  const saveContact = useContactsStore((s) => s.saveContact);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [isStarred, setIsStarred] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && contactDraft) {
      setName(contactDraft.name || "");
      setEmail(contactDraft.email || "");
      setPhone(contactDraft.phone || "");
      setCompany(contactDraft.company || "");
      setJobTitle(contactDraft.jobTitle || "");
      setNotes(contactDraft.notes || "");
      setIsStarred(Boolean(contactDraft.isStarred));
      setTags(contactDraft.tags || []);
      setTagInput("");
    }
  }, [open, contactDraft]);

  const handleAddTag = (tagToAdd?: string) => {
    const val = (tagToAdd || tagInput).trim();
    if (val && !tags.includes(val)) {
      setTags([...tags, val]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async () => {
    if (!email.trim()) return;
    setSaving(true);

    const payload: Partial<ContactDto> = {
      name: name.trim() || email.split("@")[0],
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
      notes: notes.trim() || undefined,
      tags,
      isStarred,
    };

    await saveContact(payload);
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <PersonIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {dialogMode === "edit" ? "编辑联系人" : "新建联系人"}
          </Typography>
        </Stack>
        <IconButton size="small" onClick={onClose} aria-label="关闭">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 2 }}>
        {/* Name and Star */}
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          <TextField
            label="姓名 / 昵称"
            placeholder="例如：张明"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            autoFocus
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <IconButton
            onClick={() => setIsStarred(!isStarred)}
            color={isStarred ? "warning" : "default"}
            title={isStarred ? "取消星标收藏" : "设为星标收藏"}
          >
            {isStarred ? <StarIcon /> : <StarBorderIcon />}
          </IconButton>
        </Box>

        {/* Email and Phone */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="电子邮箱"
            type="email"
            placeholder="example@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            sx={{ flex: 1.4 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            label="联系电话"
            placeholder="13800000000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
            sx={{ flex: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Stack>

        {/* Company and Job Title */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="公司 / 组织"
            placeholder="Moon Force Tech"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <BusinessIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            label="职位 / 头衔"
            placeholder="技术总监"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <WorkIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Stack>

        {/* Tags */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            分组标签 (Tags)
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <TextField
              size="small"
              placeholder="输入新标签并回车"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              fullWidth
            />
            <Button size="small" variant="outlined" onClick={() => handleAddTag()}>
              添加
            </Button>
          </Stack>

          {/* Quick presets */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
            {DEFAULT_CONTACT_TAGS.map((t) => (
              <Chip
                key={t}
                label={`+ ${t}`}
                size="small"
                variant="outlined"
                onClick={() => handleAddTag(t)}
                sx={{ fontSize: "0.7rem", height: 22 }}
              />
            ))}
          </Box>

          {/* Current tags */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
            {tags.map((t) => (
              <Chip
                key={t}
                label={t}
                size="small"
                color="primary"
                variant="filled"
                onDelete={() => handleRemoveTag(t)}
              />
            ))}
          </Box>
        </Box>

        {/* Notes */}
        <TextField
          label="备注信息"
          placeholder="个人背景、往来约定、重要备忘…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          minRows={2}
          maxRows={4}
          fullWidth
        />
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button onClick={onClose} disabled={saving}>
          取消
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={!email.trim() || saving}>
          {saving ? "保存中..." : "保存联系人"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
