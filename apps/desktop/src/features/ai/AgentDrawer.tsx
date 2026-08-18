import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  Snackbar,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import EventIcon from "@mui/icons-material/Event";
import ReplyIcon from "@mui/icons-material/Reply";
import LabelIcon from "@mui/icons-material/Label";
import StarIcon from "@mui/icons-material/Star";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import TerminalIcon from "@mui/icons-material/Terminal";
import PsychologyIcon from "@mui/icons-material/Psychology";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import TranslateIcon from "@mui/icons-material/Translate";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useAgentStore } from "./agentStore";
import { useMailStore } from "../mail/store";
import MarkdownView from "./MarkdownView";
import type { AgentProposalItem, AgentType } from "../../lib/ipc";

const AGENT_OPTIONS: { type: AgentType; label: string; description: string }[] = [
  {
    type: "daily_briefing",
    label: "每日邮件简报",
    description: "汇总待办事项、重要未读与每日日程建议",
  },
  {
    type: "meeting_extractor",
    label: "会议提取与日历生成",
    description: "提取邮件中的会议时间、地点与参会人并生成 ICS 日历文件",
  },
  {
    type: "invoice_scanner",
    label: "财务发票与报销整理",
    description: "精准抽取发票与账单邮件中的开票方、发票号、金额及报销类别",
  },
  {
    type: "outreach_translator",
    label: "跨语种商务邮件外联",
    description: "支持中/英/日/德等商务外语邮件互译与得体语气润色",
  },
  {
    type: "smart_sorter",
    label: "批量分箱智能归类",
    description: "根据邮件特征自动评估重要与其它分箱建议",
  },
  {
    type: "followup_sequence",
    label: "跟进邮件与回复草稿",
    description: "检索需跟进的往来邮件并一键生成跟进回复草稿",
  },
  {
    type: "custom",
    label: "自定义智能工作流",
    description: "输入个性化指令分析邮件上下文",
  },
];

const STEPS = ["规划检索", "工具执行", "生成提议"];

export default function AgentDrawer() {
  const {
    open,
    closeDrawer,
    agentType,
    setAgentType,
    status,
    steps,
    currentStepIndex,
    thinkingText,
    streamText,
    proposal,
    error,
    prompt,
    setPrompt,
    context,
    clearContext,
    runWorkflow,
    abortWorkflow,
    toggleItemSelection,
    selectAllItems,
    acceptSelected,
    acceptAll,
    dismiss,
    skills,
    selectedSkillId,
    selectSkill,
  } = useAgentStore();

  const [showThinking, setShowThinking] = useState(true);
  const [showLog, setShowLog] = useState(true);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isAccepted, setIsAccepted] = useState(false);

  const isRunning = status === "planning" || status === "executing_tools" || status === "thinking";

  const allSelected = Boolean(
    proposal && proposal.items.length > 0 && proposal.items.every((i) => i.selected)
  );
  const someSelected = Boolean(proposal && proposal.items.some((i) => i.selected) && !allSelected);

  const handleStart = () => {
    setSuccessToast(null);
    setIsAccepted(false);
    void runWorkflow();
  };

  const handleAcceptSelected = async () => {
    const res = await acceptSelected();
    setIsAccepted(true);
    setSuccessToast(`已成功采纳 ${res.acceptedCount} 项操作！已同步更新分箱与数据。`);
  };

  const handleAcceptAll = async () => {
    const res = await acceptAll();
    setIsAccepted(true);
    setSuccessToast(`已成功全部采纳 ${res.acceptedCount} 项操作！已同步更新分箱与数据。`);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={closeDrawer}
      data-testid="agent-drawer"
      slotProps={{
        paper: {
          sx: {
            width: { xs: "100%", sm: 480, md: 540 },
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.paper",
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <AutoAwesomeIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            AI 智能体工作流
          </Typography>
          <Chip
            size="small"
            label={
              status === "idle"
                ? "就绪"
                : isRunning
                  ? "思考与执行中"
                  : status === "review_pending"
                    ? "待审阅"
                    : status === "completed"
                      ? "已完成"
                      : status === "cancelled"
                        ? "已取消"
                        : "错误"
            }
            color={
              isRunning
                ? "primary"
                : status === "completed"
                  ? "success"
                  : status === "review_pending"
                    ? "warning"
                    : status === "error"
                      ? "error"
                      : "default"
            }
            variant="outlined"
          />
        </Stack>
        <IconButton size="small" onClick={closeDrawer} aria-label="关闭抽屉">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Body Content */}
      <Box sx={{ flex: 1, overflowY: "auto", p: 2.5 }}>
        <Stack spacing={2.5}>
          {/* Quick Agent Skills Shortcuts */}
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600, mb: 1, display: "block" }}
            >
              场景专属技能 (Skills)
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              <Chip
                data-testid="quick-agent-daily-briefing"
                icon={<StarIcon fontSize="small" />}
                label="每日简报"
                size="small"
                clickable
                color={selectedSkillId === "daily_briefing" ? "primary" : "default"}
                onClick={() => {
                  selectSkill("daily_briefing");
                  setAgentType("daily_briefing");
                }}
              />
              <Chip
                data-testid="quick-agent-meeting"
                icon={<EventIcon fontSize="small" />}
                label="会议提取"
                size="small"
                clickable
                color={selectedSkillId === "meeting_extractor" ? "primary" : "default"}
                onClick={() => {
                  selectSkill("meeting_extractor");
                  setAgentType("meeting_extractor");
                }}
              />
              <Chip
                data-testid="quick-agent-followup"
                icon={<ReplyIcon fontSize="small" />}
                label="跟进草稿"
                size="small"
                clickable
                color={selectedSkillId === "followup_sequence" ? "primary" : "default"}
                onClick={() => {
                  selectSkill("followup_sequence");
                  setAgentType("followup_sequence");
                }}
              />
              <Chip
                data-testid="quick-agent-triage"
                icon={<LabelIcon fontSize="small" />}
                label="智能分箱"
                size="small"
                clickable
                color={
                  selectedSkillId === "smart_sorter" || selectedSkillId === "batch_triage"
                    ? "primary"
                    : "default"
                }
                onClick={() => {
                  selectSkill("smart_sorter");
                  setAgentType("smart_sorter");
                }}
              />
              <Chip
                data-testid="quick-agent-invoice"
                icon={<ReceiptLongIcon fontSize="small" />}
                label="发票报销"
                size="small"
                clickable
                color={selectedSkillId === "invoice_scanner" ? "primary" : "default"}
                onClick={() => {
                  selectSkill("invoice_scanner");
                  setAgentType("invoice_scanner");
                }}
              />
              <Chip
                data-testid="quick-agent-translator"
                icon={<TranslateIcon fontSize="small" />}
                label="商务外联"
                size="small"
                clickable
                color={selectedSkillId === "outreach_translator" ? "primary" : "default"}
                onClick={() => {
                  selectSkill("outreach_translator");
                  setAgentType("outreach_translator");
                }}
              />
              {skills
                .filter((s) => s.isCustom)
                .map((customSkill) => (
                  <Chip
                    key={customSkill.id}
                    icon={<SmartToyIcon fontSize="small" />}
                    label={customSkill.name}
                    size="small"
                    clickable
                    color={selectedSkillId === customSkill.id ? "primary" : "default"}
                    onClick={() => {
                      selectSkill(customSkill.id);
                      setAgentType("custom");
                    }}
                  />
                ))}
            </Box>
          </Paper>

          {/* Workflow Configuration Form */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack spacing={2}>
              {/* Context Indicator */}
              {context && (context.subject || context.messageId) ? (
                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    bgcolor: "action.hover",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
                    <Chip size="small" label="当前邮件" color="primary" variant="outlined" />
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {String(context.subject || "未命名邮件")}
                    </Typography>
                  </Stack>
                  <Button
                    size="small"
                    variant="text"
                    color="secondary"
                    onClick={() => clearContext()}
                    sx={{ fontSize: "0.75rem", p: 0.5, minWidth: "auto" }}
                  >
                    切换全局
                  </Button>
                </Box>
              ) : (
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1.5,
                    bgcolor: "action.hover",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Chip size="small" label="全局模式" variant="outlined" />
                  <Typography variant="caption" color="text.secondary">
                    AI 可自主通过检索工具查询所有本地邮件
                  </Typography>
                </Box>
              )}

              <FormControl size="small" fullWidth>
                <InputLabel id="agent-type-select-label">工作流类型</InputLabel>
                <Select
                  labelId="agent-type-select-label"
                  value={agentType}
                  label="工作流类型"
                  onChange={(e) => setAgentType(e.target.value as AgentType)}
                  disabled={isRunning}
                >
                  {AGENT_OPTIONS.map((opt) => (
                    <MenuItem key={opt.type} value={opt.type}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {opt.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {opt.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                size="small"
                label="自定义指令或补充需求 (可选)"
                placeholder="例如：重点提取明天的项目对接会时间，并草拟中文确认邮件..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isRunning}
                multiline
                rows={2}
                fullWidth
              />

              <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                {isRunning ? (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<StopIcon />}
                    onClick={() => void abortWorkflow()}
                  >
                    停止执行
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleStart}
                  >
                    开始运行
                  </Button>
                )}
              </Stack>
            </Stack>
          </Paper>

          {/* Stepper Progress */}
          {(isRunning || steps.length > 0) && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stepper activeStep={currentStepIndex - 1} alternativeLabel>
                {STEPS.map((label, idx) => (
                  <Step key={label} completed={currentStepIndex > idx + 1}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {isRunning && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 2 }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">
                    {steps[steps.length - 1]?.message || "正在执行工作流..."}
                  </Typography>
                </Box>
              )}
            </Paper>
          )}

          {/* Deep Thinking Block (Reasoning Stream) */}
          {thinkingText && (
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: "background.default",
                borderStyle: "dashed",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
                onClick={() => setShowThinking((v) => !v)}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <PsychologyIcon fontSize="small" color="primary" />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    深度思考过程 (Thinking Stream)
                  </Typography>
                </Stack>
                <IconButton size="small">
                  {showThinking ? (
                    <ExpandLessIcon fontSize="small" />
                  ) : (
                    <ExpandMoreIcon fontSize="small" />
                  )}
                </IconButton>
              </Box>

              <Collapse in={showThinking}>
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1.5,
                    bgcolor: "action.hover",
                    borderRadius: 1.5,
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    whiteSpace: "pre-wrap",
                    color: "text.secondary",
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {thinkingText}
                </Box>
              </Collapse>
            </Paper>
          )}

          {/* Execution Log & Stream output */}
          {streamText && (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
                onClick={() => setShowLog((v) => !v)}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <TerminalIcon fontSize="small" color="action" />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    工作流执行流
                  </Typography>
                </Stack>
                <IconButton size="small">
                  {showLog ? (
                    <ExpandLessIcon fontSize="small" />
                  ) : (
                    <ExpandMoreIcon fontSize="small" />
                  )}
                </IconButton>
              </Box>

              <Collapse in={showLog}>
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1.5,
                    bgcolor: "action.hover",
                    borderRadius: 1.5,
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    whiteSpace: "pre-wrap",
                    maxHeight: 180,
                    overflowY: "auto",
                  }}
                >
                  {streamText}
                </Box>
              </Collapse>
            </Paper>
          )}

          {/* Error Message */}
          {error && <Alert severity="error">{error}</Alert>}

          {/* Success Toast */}
          {successToast && (
            <Alert
              severity="success"
              onClose={() => setSuccessToast(null)}
              icon={<CheckCircleIcon fontSize="inherit" />}
            >
              {successToast}
            </Alert>
          )}

          {/* Proposal Review Section (HITL Gate) */}
          {proposal && (
            <Stack spacing={2} data-testid="agent-proposal-section">
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {proposal.title}
                </Typography>
                <Chip size="small" label={`${proposal.items.length} 项提议`} color="primary" />
              </Box>

              <MarkdownView content={proposal.summary} hideJsonBlocks={true} />

              {/* Select All Checkbox */}
              {proposal.items.length > 0 && (
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={(e) => selectAllItems(e.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      全选 / 取消全选待执行项
                    </Typography>
                  }
                />
              )}

              {/* Proposal Items List */}
              <Stack spacing={1.5}>
                {proposal.items.map((item) => (
                  <ProposalItemCard
                    key={item.id}
                    item={item}
                    onToggle={() => toggleItemSelection(item.id)}
                  />
                ))}
              </Stack>

              {/* Bottom Actions */}
              {isAccepted ? (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "success.main",
                    color: "success.contrastText",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <CheckCircleIcon fontSize="small" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      已成功采纳并应用变更！
                    </Typography>
                  </Stack>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{
                      bgcolor: "background.paper",
                      color: "text.primary",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                    onClick={() => {
                      useMailStore.getState().setView("mail");
                      closeDrawer();
                    }}
                  >
                    返回收件箱
                  </Button>
                </Box>
              ) : (
                <Stack direction="row" spacing={1} sx={{ pt: 1, justifyContent: "space-between" }}>
                  <Button size="small" color="inherit" onClick={dismiss}>
                    忽略放弃
                  </Button>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleAcceptSelected}
                      disabled={!proposal.items.some((i) => i.selected)}
                    >
                      采纳已选 ({proposal.items.filter((i) => i.selected).length})
                    </Button>
                    <Button size="small" variant="contained" onClick={handleAcceptAll}>
                      全部采纳
                    </Button>
                  </Stack>
                </Stack>
              )}
            </Stack>
          )}
        </Stack>
      </Box>

      {/* Global Floating Toast */}
      <Snackbar
        open={Boolean(successToast)}
        autoHideDuration={4000}
        onClose={() => setSuccessToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSuccessToast(null)}
          severity="success"
          variant="filled"
          sx={{ width: "100%", boxShadow: 4 }}
        >
          {successToast}
        </Alert>
      </Snackbar>
    </Drawer>
  );
}

function ProposalItemCard({ item, onToggle }: { item: AgentProposalItem; onToggle: () => void }) {
  if (item.kind === "calendar_event") {
    return (
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
            <Checkbox
              size="small"
              checked={item.selected}
              onChange={onToggle}
              sx={{ p: 0.5, mt: 0.2 }}
            />
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                <EventIcon fontSize="small" color="primary" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {item.title}
                </Typography>
                <Chip size="small" label="日历日程" color="info" variant="outlined" />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                时间: {item.startTime} {item.endTime ? `至 ${item.endTime}` : ""}
              </Typography>
              {item.location && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  地点: {item.location}
                </Typography>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (item.kind === "invoice_entry") {
    return (
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
            <Checkbox
              size="small"
              checked={item.selected}
              onChange={onToggle}
              sx={{ p: 0.5, mt: 0.2 }}
            />
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                <ReceiptLongIcon fontSize="small" color="warning" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {item.vendorName}
                </Typography>
                <Chip
                  size="small"
                  label={`¥${item.amount.toFixed(2)} (${item.currency})`}
                  color="warning"
                  variant="outlined"
                />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                报销类别: {item.category} | 日期: {item.date || "近期"}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (item.kind === "draft_reply") {
    return (
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
            <Checkbox
              size="small"
              checked={item.selected}
              onChange={onToggle}
              sx={{ p: 0.5, mt: 0.2 }}
            />
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                <ReplyIcon fontSize="small" color="primary" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {item.subject}
                </Typography>
                <Chip size="small" label="回复草稿" color="success" variant="outlined" />
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {item.body}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (item.kind === "split_change") {
    const isImportant = item.targetSplit === "important";
    return (
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
            <Checkbox
              size="small"
              checked={item.selected}
              onChange={onToggle}
              sx={{ p: 0.5, mt: 0.2 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", mb: 0.5, flexWrap: "wrap", gap: 0.5 }}
              >
                <LabelIcon fontSize="small" color={isImportant ? "primary" : "action"} />
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, flex: 1, minWidth: 120 }}
                  noWrap
                  title={item.subject}
                >
                  {item.subject || "邮件分箱调整"}
                </Typography>
                <Chip
                  size="small"
                  label={`调整为「${isImportant ? "重要" : "其它"}」`}
                  color={isImportant ? "primary" : "default"}
                  variant={isImportant ? "filled" : "outlined"}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {item.reason}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return null;
}
