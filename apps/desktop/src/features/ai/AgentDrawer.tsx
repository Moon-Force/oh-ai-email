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
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import EventIcon from "@mui/icons-material/Event";
import ReplyIcon from "@mui/icons-material/Reply";
import LabelIcon from "@mui/icons-material/Label";
import StarIcon from "@mui/icons-material/Star";
import DownloadIcon from "@mui/icons-material/Download";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import TerminalIcon from "@mui/icons-material/Terminal";
import { useAgentStore } from "./agentStore";
import type {
  AgentProposalItem,
  AgentType,
} from "../../lib/ipc";

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
    type: "batch_triage",
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
    streamText,
    proposal,
    error,
    prompt,
    setPrompt,
    runWorkflow,
    abortWorkflow,
    toggleItemSelection,
    selectAllItems,
    acceptSelected,
    acceptAll,
    dismiss,
  } = useAgentStore();

  const [showLog, setShowLog] = useState(true);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const isRunning =
    status === "planning" || status === "executing_tools";

  const allSelected =
    Boolean(proposal && proposal.items.length > 0 && proposal.items.every((i) => i.selected));
  const someSelected =
    Boolean(proposal && proposal.items.some((i) => i.selected) && !allSelected);

  const handleStart = () => {
    setSuccessToast(null);
    void runWorkflow();
  };

  const handleAcceptSelected = async () => {
    const res = await acceptSelected();
    setSuccessToast(`已成功采纳 ${res.acceptedCount} 项操作！`);
  };

  const handleAcceptAll = async () => {
    const res = await acceptAll();
    setSuccessToast(`已成功全部采纳 ${res.acceptedCount} 项操作！`);
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
            AI 智能工作流
          </Typography>
          <Chip
            size="small"
            label={
              status === "idle"
                ? "就绪"
                : isRunning
                  ? "运行中"
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
          {/* Agent Type Selector */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
              <InputLabel id="agent-type-select-label">选择工作流类型</InputLabel>
              <Select
                labelId="agent-type-select-label"
                value={agentType}
                label="选择工作流类型"
                disabled={isRunning}
                onChange={(e) => setAgentType(e.target.value as AgentType)}
              >
                {AGENT_OPTIONS.map((opt) => (
                  <MenuItem key={opt.type} value={opt.type}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
              {AGENT_OPTIONS.find((o) => o.type === agentType)?.description}
            </Typography>

            {agentType === "custom" && (
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                label="自定义指令 Prompt"
                placeholder="例如：提取邮件中的行动项并撰写感谢回复..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isRunning}
                sx={{ mb: 1.5 }}
              />
            )}

            <Button
              fullWidth
              variant="contained"
              startIcon={isRunning ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              disabled={isRunning}
              onClick={handleStart}
            >
              {isRunning ? "正在执行智能工作流..." : "运行工作流"}
            </Button>
          </Paper>

          {/* Stepper Progress */}
          {(isRunning || status === "review_pending" || status === "completed") && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1.5, display: "block" }}>
                执行流程进度
              </Typography>
              <Stepper activeStep={Math.max(0, currentStepIndex - 1)} alternativeLabel>
                {STEPS.map((label, idx) => (
                  <Step key={label} completed={currentStepIndex > idx + 1 || status === "completed" || status === "review_pending"}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {steps.length > 0 && (
                <Box sx={{ mt: 1.5, pt: 1, borderTop: 1, borderColor: "divider" }}>
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500 }}>
                    {steps[steps.length - 1]?.message}
                  </Typography>
                </Box>
              )}
            </Paper>
          )}

          {/* Error Message */}
          {error && (
            <Alert severity="error" onClose={() => dismiss()}>
              {error}
            </Alert>
          )}

          {/* Success Message */}
          {successToast && (
            <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />} onClose={() => setSuccessToast(null)}>
              {successToast}
            </Alert>
          )}

          {/* Stream Log / Reasoning Output */}
          {streamText && (
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: "action.hover",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
                onClick={() => setShowLog(!showLog)}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <TerminalIcon fontSize="small" color="action" />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    推理与工具执行日志
                  </Typography>
                </Stack>
                <IconButton size="small">
                  {showLog ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
              </Box>
              <Collapse in={showLog}>
                <Box
                  component="pre"
                  sx={{
                    mt: 1,
                    p: 1,
                    maxHeight: 180,
                    overflowY: "auto",
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    bgcolor: "background.paper",
                    borderRadius: 1,
                    border: 1,
                    borderColor: "divider",
                  }}
                >
                  {streamText}
                </Box>
              </Collapse>
            </Paper>
          )}

          {/* Proposal Review Section */}
          {proposal && (
            <Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 1.5,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {proposal.title}
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={(e) => selectAllItems(e.target.checked)}
                      disabled={status === "completed"}
                    />
                  }
                  label={
                    <Typography variant="caption">
                      {allSelected ? "取消全选" : "全选"}
                    </Typography>
                  }
                />
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {proposal.summary}
              </Typography>

              <Stack spacing={1.5}>
                {proposal.items.map((item) => (
                  <ProposalItemCard
                    key={item.id}
                    item={item}
                    disabled={status === "completed"}
                    onToggle={() => toggleItemSelection(item.id)}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </Box>

      {/* Footer Actions */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        {isRunning ? (
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<StopIcon />}
            onClick={() => void abortWorkflow()}
          >
            取消任务
          </Button>
        ) : proposal ? (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                fullWidth
                size="small"
                onClick={handleAcceptAll}
                disabled={status === "completed"}
              >
                一键全部采纳
              </Button>
              <Button
                variant="contained"
                fullWidth
                size="small"
                onClick={handleAcceptSelected}
                disabled={status === "completed" || !proposal.items.some((i) => i.selected)}
              >
                确认采纳所选项
              </Button>
            </Stack>
            <Button
              variant="text"
              fullWidth
              size="small"
              color="inherit"
              onClick={dismiss}
            >
              放弃 / 清空
            </Button>
          </Stack>
        ) : (
          <Button fullWidth variant="outlined" size="small" onClick={closeDrawer}>
            关闭
          </Button>
        )}
      </Box>
    </Drawer>
  );
}

function ProposalItemCard({
  item,
  disabled,
  onToggle,
}: {
  item: AgentProposalItem;
  disabled: boolean;
  onToggle: () => void;
}) {
  if (item.kind === "calendar_event") {
    return (
      <Card
        variant="outlined"
        sx={{
          borderColor: item.selected ? "primary.main" : "divider",
          borderWidth: item.selected ? 2 : 1,
          transition: "border-color 0.2s",
        }}
      >
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <Checkbox
              size="small"
              checked={item.selected}
              disabled={disabled}
              onChange={onToggle}
              sx={{ p: 0.5, mt: 0.25 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                <EventIcon fontSize="small" color="primary" />
                <Chip size="small" label="日历日程" color="primary" variant="outlined" />
                <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: 600 }}>
                  {item.title}
                </Typography>
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                时间：{item.startTime} {item.endTime ? `~ ${item.endTime}` : ""}
              </Typography>
              {item.location && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  地点：{item.location}
                </Typography>
              )}
              {item.attendees && item.attendees.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  参会人：{item.attendees.join(", ")}
                </Typography>
              )}

              {item.icsContent && (
                <Tooltip title="下载 .ics 日历文件">
                  <IconButton
                    size="small"
                    sx={{ mt: 0.5 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const blob = new Blob([item.icsContent || ""], {
                        type: "text/calendar;charset=utf-8",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${item.title}.ics`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (item.kind === "draft_reply") {
    return (
      <Card
        variant="outlined"
        sx={{
          borderColor: item.selected ? "primary.main" : "divider",
          borderWidth: item.selected ? 2 : 1,
          transition: "border-color 0.2s",
        }}
      >
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <Checkbox
              size="small"
              checked={item.selected}
              disabled={disabled}
              onChange={onToggle}
              sx={{ p: 0.5, mt: 0.25 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                <ReplyIcon fontSize="small" color="secondary" />
                <Chip size="small" label="回复草稿" color="secondary" variant="outlined" />
                <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: 600 }}>
                  {item.subject}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                收件人：{item.targetTo}
              </Typography>
              <Box
                sx={{
                  p: 1,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  fontFamily: "inherit",
                  fontSize: "0.8rem",
                  whiteSpace: "pre-wrap",
                }}
              >
                {item.body}
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (item.kind === "split_change") {
    return (
      <Card
        variant="outlined"
        sx={{
          borderColor: item.selected ? "primary.main" : "divider",
          borderWidth: item.selected ? 2 : 1,
          transition: "border-color 0.2s",
        }}
      >
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <Checkbox
              size="small"
              checked={item.selected}
              disabled={disabled}
              onChange={onToggle}
              sx={{ p: 0.5, mt: 0.25 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                {item.targetSplit === "important" ? (
                  <StarIcon fontSize="small" color="warning" />
                ) : (
                  <LabelIcon fontSize="small" color="action" />
                )}
                <Chip
                  size="small"
                  label={`调整至：${item.targetSplit === "important" ? "重要分箱" : "其他分箱"}`}
                  color={item.targetSplit === "important" ? "warning" : "default"}
                  variant="outlined"
                />
              </Stack>
              <Typography variant="body2" noWrap sx={{ mb: 0.25, fontWeight: 600 }}>
                {item.subject || "邮件分箱调整"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                理由：{item.reason}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return null;
}
