import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Grid,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import ExtensionIcon from "@mui/icons-material/Extension";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import HubIcon from "@mui/icons-material/Hub";
import {
  agentListSkills,
  agentSaveSkill,
  agentDeleteSkill,
  agentExportSkill,
  agentGetMcpConfig,
  type AgentSkillDefinition,
} from "../../lib/ipc";

const AVAILABLE_TOOLS = [
  { id: "calendar_proposal", label: "日历日程提案 (RFC 5545)" },
  { id: "invoice_proposal", label: "发票报销明细提取" },
  { id: "draft_proposal", label: "回复草稿拟定" },
  { id: "split_proposal", label: "收件箱智能分箱建议" },
  { id: "extract_action_items", label: "待办事项与紧急度分析" },
];

export default function SkillsTab(): React.ReactElement {
  const [skills, setSkills] = useState<AgentSkillDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [mcpConfigJson, setMcpConfigJson] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formAllowedTools, setFormAllowedTools] = useState<string[]>([]);
  const [formSystemPrompt, setFormSystemPrompt] = useState("");

  const refreshSkills = async () => {
    setLoading(true);
    try {
      const list = await agentListSkills();
      setSkills(list);
      const mcp = await agentGetMcpConfig();
      setMcpConfigJson(JSON.stringify(mcp, null, 2));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSkills();
  }, []);

  const handleOpenCreate = () => {
    setEditingSkillId(null);
    setFormId(`skill_${Date.now().toString(36)}`);
    setFormName("");
    setFormDescription("");
    setFormTags("自定义, 助手");
    setFormAllowedTools(["draft_proposal", "extract_action_items"]);
    setFormSystemPrompt("你是一位专属业务邮件助手，请根据邮件内容进行专业分析。");
    setDialogOpen(true);
  };

  const handleOpenEdit = (skill: AgentSkillDefinition) => {
    setEditingSkillId(skill.id);
    setFormId(skill.id);
    setFormName(skill.name);
    setFormDescription(skill.description);
    setFormTags((skill.tags || []).join(", "));
    setFormAllowedTools(skill.allowedTools || []);
    setFormSystemPrompt(skill.systemPrompt);
    setDialogOpen(true);
  };

  const handleSaveSkill = async () => {
    if (!formName.trim() || !formSystemPrompt.trim()) {
      setToastMessage("请填写技能名称和提示词模板");
      return;
    }

    const tags = formTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    await agentSaveSkill({
      id: formId,
      name: formName.trim(),
      description: formDescription.trim(),
      tags,
      allowedTools: formAllowedTools,
      systemPrompt: formSystemPrompt.trim(),
      version: "1.0.0",
    });

    setDialogOpen(false);
    setToastMessage(editingSkillId ? "技能已更新" : "新技能已创建并保存");
    refreshSkills();
  };

  const handleDeleteSkill = async (id: string) => {
    if (confirm("确定要删除这个自定义技能吗？")) {
      await agentDeleteSkill(id);
      setToastMessage("技能已删除");
      refreshSkills();
    }
  };

  const handleExportSkill = async (id: string) => {
    const md = await agentExportSkill(id);
    navigator.clipboard.writeText(md);
    setToastMessage("技能 Markdown 已复制到剪贴板");
  };

  const handleCopyMcpConfig = () => {
    navigator.clipboard.writeText(mcpConfigJson);
    setToastMessage("MCP 配置 JSON 已复制到剪贴板");
  };

  const toggleTool = (toolId: string) => {
    setFormAllowedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Top Banner & Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
            <ExtensionIcon color="primary" /> 智能体技能生态 (Skills Ecosystem)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            基于 pi 架构标准解耦的场景技能包。支持自定义 System Prompt、权限沙箱及工具调用白名单。
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
          sx={{ borderRadius: 999 }}
        >
          新建自定义技能
        </Button>
      </Box>

      {/* Skills Grid List */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        {skills.map((skill) => (
          <Box key={skill.id}>
            <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
                    <SmartToyIcon fontSize="small" color={skill.isCustom ? "secondary" : "primary"} />
                    {skill.name}
                  </Typography>
                  <Chip
                    size="small"
                    label={skill.isCustom ? "自定义" : "内置核心"}
                    color={skill.isCustom ? "default" : "primary"}
                    variant={skill.isCustom ? "outlined" : "filled"}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, minHeight: 40 }}>
                  {skill.description || "暂无描述"}
                </Typography>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    允许调用的工具：
                  </Typography>
                  <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                    {skill.allowedTools && skill.allowedTools.length > 0 ? (
                      skill.allowedTools.map((t) => (
                        <Chip key={t} label={t} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                      ))
                    ) : (
                      <Typography variant="caption" color="text.secondary">无工具限制</Typography>
                    )}
                  </Stack>
                </Box>

                {skill.tags && skill.tags.length > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                    {skill.tags.map((tag) => (
                      <Chip key={tag} label={`#${tag}`} size="small" sx={{ fontSize: 10, height: 20 }} />
                    ))}
                  </Stack>
                )}
              </CardContent>
              <Divider />
              <CardActions sx={{ justifyContent: "flex-end", px: 2 }}>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleExportSkill(skill.id)}
                >
                  导出 Markdown
                </Button>
                {skill.isCustom && (
                  <>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleOpenEdit(skill)}
                    >
                      编辑
                    </Button>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteSkill(skill.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </CardActions>
            </Card>
          </Box>
        ))}
      </Box>

      {/* Model Context Protocol (MCP) Integration Section */}
      <Card variant="outlined" sx={{ bgcolor: "background.paper", mt: 2 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
              <HubIcon color="secondary" /> Model Context Protocol (MCP) 邮件服务
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopyMcpConfig}
            >
              复制 Claude / Cursor 配置 JSON
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            oh-ai-email 内置标准 MCP 协议端点。你可以将本地邮件检索、未读概览和草稿拟定能力暴露给 Claude Desktop、Cursor 或自定义智能体。
          </Typography>

          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>安全红线承诺</strong>：MCP 服务仅提供邮件只读检索与本地草稿创建能力，<strong>绝不暴露无监督直接发送邮件接口</strong>。
          </Alert>

          <Box
            component="pre"
            sx={{
              p: 2,
              bgcolor: (t) => (t.palette.mode === "dark" ? "grey.900" : "grey.100"),
              borderRadius: 1,
              fontSize: 12,
              overflowX: "auto",
              fontFamily: "monospace",
              m: 0,
            }}
          >
            {mcpConfigJson || "正在加载 MCP 配置..."}
          </Box>
        </CardContent>
      </Card>

      {/* Create / Edit Skill Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingSkillId ? "编辑智能体技能" : "新建场景专属技能"}</DialogTitle>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="技能唯一标识 (ID)"
            value={formId}
            disabled={Boolean(editingSkillId)}
            onChange={(e) => setFormId(e.target.value)}
            fullWidth
            size="small"
            helperText="唯一英文/拼音标识，创建后不可更改"
          />
          <TextField
            label="技能名称"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            fullWidth
            size="small"
            placeholder="如：技术面试反馈整理"
          />
          <TextField
            label="简短描述"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            fullWidth
            size="small"
            placeholder="说明此技能在何种场景下发挥作用"
          />
          <TextField
            label="标签 (逗号分隔)"
            value={formTags}
            onChange={(e) => setFormTags(e.target.value)}
            fullWidth
            size="small"
            placeholder="招聘, 面试, 技术"
          />

          <FormControl component="fieldset" variant="standard">
            <Typography variant="caption" sx={{ fontWeight: 600, mb: 1, display: "block" }}>
              允许调用的安全沙箱工具 (Allowed Tools)
            </Typography>
            <FormGroup>
              {AVAILABLE_TOOLS.map((tool) => (
                <FormControlLabel
                  key={tool.id}
                  control={
                    <Checkbox
                      size="small"
                      checked={formAllowedTools.includes(tool.id)}
                      onChange={() => toggleTool(tool.id)}
                    />
                  }
                  label={<Typography variant="body2">{tool.label} (<code>{tool.id}</code>)</Typography>}
                />
              ))}
            </FormGroup>
          </FormControl>

          <TextField
            label="系统提示词模板 (System Prompt)"
            value={formSystemPrompt}
            onChange={(e) => setFormSystemPrompt(e.target.value)}
            fullWidth
            multiline
            rows={5}
            placeholder="编写该场景专属的专家指令设定与输出格式规范..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSaveSkill}>
            保存技能
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Notification */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3000}
        onClose={() => setToastMessage(null)}
        message={toastMessage}
      />
    </Box>
  );
}
