import { useEffect } from "react";
import {
  Avatar,
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import AddIcon from "@mui/icons-material/Add";
import StarIcon from "@mui/icons-material/Star";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";

import { useContactsStore } from "./contactsStore";
import ContactDetail from "./ContactDetail";
import ContactDialog from "./ContactDialog";
import ContactHarvesterDialog from "./ContactHarvesterDialog";
import VcfImportDialog from "./VcfImportDialog";

export default function ContactsView() {
  const contacts = useContactsStore((s) => s.contacts);
  const selectedContactId = useContactsStore((s) => s.selectedContactId);
  const searchQuery = useContactsStore((s) => s.searchQuery);
  const selectedTag = useContactsStore((s) => s.selectedTag);
  const starredOnly = useContactsStore((s) => s.starredOnly);
  const contactDialogOpen = useContactsStore((s) => s.contactDialogOpen);
  const harvesterOpen = useContactsStore((s) => s.harvesterOpen);
  const vcfImportDialogOpen = useContactsStore((s) => s.vcfImportDialogOpen);

  const loadContacts = useContactsStore((s) => s.loadContacts);
  const selectContact = useContactsStore((s) => s.selectContact);
  const setSearchQuery = useContactsStore((s) => s.setSearchQuery);
  const setSelectedTag = useContactsStore((s) => s.setSelectedTag);
  const toggleStarredFilter = useContactsStore((s) => s.toggleStarredFilter);
  const openCreateDialog = useContactsStore((s) => s.openCreateDialog);
  const closeDialog = useContactsStore((s) => s.closeDialog);
  const openHarvester = useContactsStore((s) => s.openHarvester);
  const closeHarvester = useContactsStore((s) => s.closeHarvester);
  const setVcfImportDialogOpen = useContactsStore((s) => s.setVcfImportDialogOpen);
  const exportVcf = useContactsStore((s) => s.exportVcf);

  const selectedContact = contacts.find((c) => c.id === selectedContactId) || null;
  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags || [])));
  const filteredContacts = contacts.filter((c) => {
    if (starredOnly && !c.isStarred) return false;
    if (selectedTag && !c.tags?.includes(selectedTag)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const mName = c.name?.toLowerCase().includes(q);
      const mEmail = c.email?.toLowerCase().includes(q);
      const mComp = c.company?.toLowerCase().includes(q);
      if (!mName && !mEmail && !mComp) return false;
    }
    return true;
  });

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const starredCount = contacts.filter((c) => c.isStarred).length;

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top Contacts Toolbar */}
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
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <PeopleAltIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            联系人通讯录
          </Typography>
          <Typography variant="body2" color="text.secondary">
            共 {contacts.length} 位联系人
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Tooltip title="从收发邮件中智能提取未录入的发件人">
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<AutoAwesomeIcon />}
              onClick={openHarvester}
            >
              发现新联系人
            </Button>
          </Tooltip>

          <Tooltip title="从 .vcf 通讯录文件导入">
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileUploadIcon />}
              onClick={() => setVcfImportDialogOpen(true)}
            >
              导入 .vcf
            </Button>
          </Tooltip>

          <Tooltip title="导出全部联系人为 .vcf 文件">
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={() => exportVcf()}
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
            新建联系人
          </Button>
        </Stack>
      </Box>

      {/* Main 3-Column Body */}
      <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Left Sub-Sidebar: Categories and Tags */}
        <Box
          sx={{
            width: 200,
            borderRight: 1,
            borderColor: "divider",
            height: "100%",
            overflowY: "auto",
            p: 1.5,
            bgcolor: (t) =>
              t.palette.mode === "dark" ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
          }}
        >
          <List dense disablePadding>
            <ListItemButton
              selected={!starredOnly && selectedTag === null}
              onClick={() => {
                if (starredOnly) toggleStarredFilter();
                setSelectedTag(null);
              }}
              sx={{ borderRadius: 1.5, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <PeopleAltIcon
                  fontSize="small"
                  color={!starredOnly && selectedTag === null ? "primary" : "inherit"}
                />
              </ListItemIcon>
              <ListItemText primary="全部联系人" />
              <Typography variant="caption" color="text.secondary">
                {contacts.length}
              </Typography>
            </ListItemButton>

            <ListItemButton
              selected={starredOnly}
              onClick={() => {
                if (!starredOnly) toggleStarredFilter();
                setSelectedTag(null);
              }}
              sx={{ borderRadius: 1.5, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <StarIcon fontSize="small" color="warning" />
              </ListItemIcon>
              <ListItemText primary="星标收藏" />
              <Typography variant="caption" color="text.secondary">
                {starredCount}
              </Typography>
            </ListItemButton>
          </List>

          {allTags.length > 0 && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 700, px: 1, display: "block", mb: 1 }}
              >
                标签分组
              </Typography>
              <List dense disablePadding>
                {allTags.map((tag) => {
                  const tagCount = contacts.filter((c) => c.tags.includes(tag)).length;
                  return (
                    <ListItemButton
                      key={tag}
                      selected={selectedTag === tag}
                      onClick={() => {
                        if (starredOnly) toggleStarredFilter();
                        setSelectedTag(selectedTag === tag ? null : tag);
                      }}
                      sx={{ borderRadius: 1.5, mb: 0.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <LocalOfferIcon
                          fontSize="small"
                          color={selectedTag === tag ? "primary" : "inherit"}
                        />
                      </ListItemIcon>
                      <ListItemText primary={tag} />
                      <Typography variant="caption" color="text.secondary">
                        {tagCount}
                      </Typography>
                    </ListItemButton>
                  );
                })}
              </List>
            </>
          )}
        </Box>

        {/* Middle Column: Search + Contacts List */}
        <Box
          sx={{
            width: 320,
            borderRight: 1,
            borderColor: "divider",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.paper",
          }}
        >
          {/* Search Header */}
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
            <TextField
              size="small"
              placeholder="搜索联系人、邮箱、公司…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery("")}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined,
                },
              }}
            />
          </Box>

          {/* List */}
          <Box sx={{ flex: 1, overflowY: "auto" }}>
            {filteredContacts.length === 0 ? (
              <Box sx={{ p: 3, textAlign: "center", color: "text.disabled" }}>
                <Typography variant="body2">未找到匹配的联系人</Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {filteredContacts.map((c) => {
                  const isSelected = c.id === selectedContactId;
                  const firstLetter = (c.name || c.email).slice(0, 1).toUpperCase();

                  return (
                    <ListItemButton
                      key={c.id}
                      selected={isSelected}
                      onClick={() => selectContact(c.id)}
                      sx={{
                        py: 1,
                        px: 1.5,
                        borderBottom: "1px solid",
                        borderColor: (t) =>
                          t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 44 }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: "0.85rem",
                            bgcolor: c.avatarColor || "#2563EB",
                            fontWeight: 600,
                          }}
                        >
                          {firstLetter}
                        </Avatar>
                      </ListItemIcon>

                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                            <Typography
                              variant="subtitle2"
                              sx={{ fontWeight: isSelected ? 700 : 600 }}
                            >
                              {c.name}
                            </Typography>
                            {c.isStarred && (
                              <StarIcon sx={{ fontSize: 14, color: "warning.main" }} />
                            )}
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
                            }}
                          >
                            {c.company ? `${c.company} · ` : ""}
                            {c.email}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            )}
          </Box>
        </Box>

        {/* Right Column: Contact Details */}
        <Box sx={{ flex: 1, minWidth: 0, height: "100%" }}>
          <ContactDetail contact={selectedContact} />
        </Box>
      </Box>

      {/* Modals */}
      <ContactDialog open={contactDialogOpen} onClose={closeDialog} />
      <ContactHarvesterDialog open={harvesterOpen} onClose={closeHarvester} />
      <VcfImportDialog open={vcfImportDialogOpen} onClose={() => setVcfImportDialogOpen(false)} />
    </Box>
  );
}
