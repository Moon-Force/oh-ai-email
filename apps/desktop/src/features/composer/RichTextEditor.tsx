import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontFamily } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import {
  Box,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import FontDownloadOutlinedIcon from "@mui/icons-material/FontDownloadOutlined";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import StrikethroughSIcon from "@mui/icons-material/StrikethroughS";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import FormatAlignJustifyIcon from "@mui/icons-material/FormatAlignJustify";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import FormatClearIcon from "@mui/icons-material/FormatClear";
import CodeIcon from "@mui/icons-material/Code";
import DataObjectIcon from "@mui/icons-material/DataObject";
import SubscriptIcon from "@mui/icons-material/Subscript";
import SuperscriptIcon from "@mui/icons-material/Superscript";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import FormatColorTextIcon from "@mui/icons-material/FormatColorText";
import HighlightIcon from "@mui/icons-material/Highlight";
import { useEffect, useState } from "react";

type Props = {
  valueHtml: string;
  onChange: (html: string, plainText: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

/** Font stacks that render well in desktop + common mail clients. */
const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "默认", value: "" },
  { label: "系统 UI", value: "system-ui, Segoe UI, Roboto, sans-serif" },
  { label: "微软雅黑", value: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  { label: "苹方 / 黑体", value: '"PingFang SC", "Hiragino Sans GB", "Heiti SC", sans-serif' },
  { label: "宋体", value: 'SimSun, "Songti SC", serif' },
  { label: "楷体", value: 'KaiTi, "Kaiti SC", serif' },
  { label: "仿宋", value: 'FangSong, "STFangsong", serif' },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times", value: "'Times New Roman', Times, serif" },
  { label: "Courier", value: "'Courier New', Courier, monospace" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
];

const TEXT_COLORS = [
  { label: "默认", value: "" },
  { label: "黑", value: "#1A1D24" },
  { label: "灰", value: "#5C6578" },
  { label: "红", value: "#D32F2F" },
  { label: "橙", value: "#ED6C02" },
  { label: "绿", value: "#2E7D32" },
  { label: "蓝", value: "#2F6BFF" },
  { label: "紫", value: "#7B1FA2" },
];

const HIGHLIGHT_COLORS = [
  { label: "无", value: "" },
  { label: "黄", value: "#FFF59D" },
  { label: "绿", value: "#C8E6C9" },
  { label: "蓝", value: "#BBDEFB" },
  { label: "粉", value: "#F8BBD9" },
  { label: "橙", value: "#FFE0B2" },
];

function canCmd(editor: Editor, name: string): boolean {
  try {
    const fn = (editor.can() as unknown as Record<string, unknown>)[name];
    return typeof fn === "function" ? Boolean((fn as () => boolean)()) : false;
  } catch {
    return false;
  }
}

function blockType(editor: Editor): string {
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  return "p";
}

function ToolBtn({
  title,
  active,
  disabled,
  onClick,
  children,
  "aria-label": ariaLabel,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  "aria-label": string;
}) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          color={active ? "primary" : "inherit"}
          disabled={disabled}
          aria-label={ariaLabel}
          onClick={onClick}
          sx={{ borderRadius: 1 }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

export default function RichTextEditor({
  valueHtml,
  onChange,
  placeholder = "写点什么…",
  disabled = false,
  "aria-label": ariaLabel = "正文",
}: Props) {
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [plainFallback, setPlainFallback] = useState(() =>
    valueHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  );

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Subscript,
      Superscript,
    ],
    content: valueHtml || "<p></p>",
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML(), ed.getText());
    },
    onSelectionUpdate: () => setTick((n) => n + 1),
    onTransaction: () => setTick((n) => n + 1),
    onCreate: () => setFailed(false),
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class: "composer-prose tiptap",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    try {
      editor.setEditable(!disabled);
    } catch {
      setFailed(true);
    }
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor || failed) return;
    try {
      const current = editor.getHTML();
      if (valueHtml && valueHtml !== current && editor.isEmpty) {
        editor.commands.setContent(valueHtml, { emitUpdate: false });
      }
    } catch {
      setFailed(true);
    }
  }, [editor, valueHtml, failed]);

  if (failed) {
    return (
      <TextField
        data-testid="rich-text-editor"
        multiline
        minRows={10}
        fullWidth
        disabled={disabled}
        placeholder={placeholder}
        value={plainFallback}
        onChange={(e) => {
          const t = e.target.value;
          setPlainFallback(t);
          const esc = t
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
          onChange(`<p>${esc.replace(/\n/g, "<br>")}</p>`, t);
        }}
        slotProps={{ htmlInput: { "aria-label": ariaLabel } }}
      />
    );
  }

  if (!editor) {
    return (
      <Box
        data-testid="rich-text-editor"
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          minHeight: 200,
          p: 2,
          color: "text.secondary",
        }}
      >
        编辑器加载中…
      </Box>
    );
  }

  // touch tick so toolbar active states re-render
  void tick;

  function run(cmd: () => boolean) {
    try {
      cmd();
    } catch (e) {
      console.error("[RichTextEditor] command failed", e);
      setFailed(true);
    }
  }

  function toggleLink() {
    if (!editor) return;
    try {
      if (editor.isActive("link")) {
        editor.chain().focus().unsetLink().run();
        return;
      }
      const prev = (editor.getAttributes("link").href as string | undefined) || "https://";
      const url = window.prompt("链接地址", prev);
      if (!url) return;
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  }

  function setBlock(value: string) {
    if (!editor) return;
    run(() => {
      const chain = editor.chain().focus();
      if (value === "p") return chain.setParagraph().run();
      if (value === "h1") return chain.toggleHeading({ level: 1 }).run();
      if (value === "h2") return chain.toggleHeading({ level: 2 }).run();
      if (value === "h3") return chain.toggleHeading({ level: 3 }).run();
      return false;
    });
  }

  const currentColor = (editor.getAttributes("textStyle").color as string | undefined) || "";
  const currentHighlight = (editor.getAttributes("highlight").color as string | undefined) || "";
  const currentFont =
    (editor.getAttributes("textStyle").fontFamily as string | undefined) || "";

  return (
    <Box
      data-testid="rich-text-editor"
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "background.paper",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {/* Row 1: block + font + emphasis + color */}
      <Stack
        direction="row"
        spacing={0.25}
        sx={{
          px: 0.75,
          py: 0.35,
          flexWrap: "wrap",
          alignItems: "center",
          gap: 0.25,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "action.hover",
        }}
      >
        <Select
          size="small"
          value={blockType(editor)}
          disabled={disabled}
          onChange={(e) => setBlock(String(e.target.value))}
          aria-label="段落样式"
          sx={{
            minWidth: 108,
            height: 30,
            fontSize: "0.8rem",
            mr: 0.25,
            bgcolor: "background.paper",
            "& .MuiSelect-select": { py: 0.5 },
          }}
        >
          <MenuItem value="p">正文</MenuItem>
          <MenuItem value="h1">标题 1</MenuItem>
          <MenuItem value="h2">标题 2</MenuItem>
          <MenuItem value="h3">标题 3</MenuItem>
        </Select>

        <Tooltip title="字体">
          <Stack direction="row" spacing={0.25} sx={{ alignItems: "center", mr: 0.25 }}>
            <FontDownloadOutlinedIcon fontSize="small" color="action" />
            <Select
              size="small"
              displayEmpty
              value={currentFont}
              disabled={disabled}
              aria-label="字体"
              data-testid="font-family-select"
              onChange={(e) => {
                const v = String(e.target.value);
                run(() =>
                  v
                    ? editor.chain().focus().setFontFamily(v).run()
                    : editor.chain().focus().unsetFontFamily().run(),
                );
              }}
              sx={{
                minWidth: 128,
                maxWidth: 180,
                height: 30,
                fontSize: "0.8rem",
                bgcolor: "background.paper",
                "& .MuiSelect-select": {
                  py: 0.5,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontFamily: currentFont || "inherit",
                },
              }}
              renderValue={(v) => {
                const hit = FONT_FAMILIES.find((f) => f.value === v) ?? FONT_FAMILIES[0];
                return (
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: hit.value || "inherit", lineHeight: 1.2 }}
                    noWrap
                  >
                    {hit.label}
                  </Typography>
                );
              }}
              MenuProps={{
                slotProps: { paper: { sx: { maxHeight: 320 } } },
              }}
            >
              {FONT_FAMILIES.map((f) => (
                <MenuItem key={f.label} value={f.value} sx={{ fontFamily: f.value || "inherit" }}>
                  {f.label}
                </MenuItem>
              ))}
            </Select>
          </Stack>
        </Tooltip>

        <ToolBtn
          title="粗体"
          aria-label="粗体"
          active={editor.isActive("bold")}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().toggleBold().run())}
        >
          <FormatBoldIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="斜体"
          aria-label="斜体"
          active={editor.isActive("italic")}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().toggleItalic().run())}
        >
          <FormatItalicIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="下划线"
          aria-label="下划线"
          active={editor.isActive("underline")}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().toggleUnderline().run())}
        >
          <FormatUnderlinedIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="删除线"
          aria-label="删除线"
          active={editor.isActive("strike")}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().toggleStrike().run())}
        >
          <StrikethroughSIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="行内代码"
          aria-label="行内代码"
          active={editor.isActive("code")}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().toggleCode().run())}
        >
          <CodeIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="下标"
          aria-label="下标"
          active={editor.isActive("subscript")}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().toggleSubscript().run())}
        >
          <SubscriptIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="上标"
          aria-label="上标"
          active={editor.isActive("superscript")}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().toggleSuperscript().run())}
        >
          <SuperscriptIcon fontSize="small" />
        </ToolBtn>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.75 }} />

        <Tooltip title="文字颜色">
          <Stack direction="row" spacing={0.25} sx={{ alignItems: "center", px: 0.25 }}>
            <FormatColorTextIcon fontSize="small" color="action" />
            <Select
              size="small"
              displayEmpty
              value={currentColor}
              disabled={disabled}
              aria-label="文字颜色"
              onChange={(e) => {
                const v = String(e.target.value);
                run(() =>
                  v
                    ? editor.chain().focus().setColor(v).run()
                    : editor.chain().focus().unsetColor().run(),
                );
              }}
              sx={{
                minWidth: 72,
                height: 30,
                fontSize: "0.75rem",
                bgcolor: "background.paper",
                "& .MuiSelect-select": { py: 0.5, display: "flex", alignItems: "center", gap: 0.5 },
              }}
              renderValue={(v) => {
                const hit = TEXT_COLORS.find((c) => c.value === v) ?? TEXT_COLORS[0];
                return (
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: 0.5,
                        bgcolor: hit.value || "text.primary",
                        border: 1,
                        borderColor: "divider",
                      }}
                    />
                    <Typography variant="caption">{hit.label}</Typography>
                  </Stack>
                );
              }}
            >
              {TEXT_COLORS.map((c) => (
                <MenuItem key={c.label} value={c.value}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Box
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: 0.5,
                        bgcolor: c.value || "text.primary",
                        border: 1,
                        borderColor: "divider",
                      }}
                    />
                    {c.label}
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </Stack>
        </Tooltip>

        <Tooltip title="高亮背景">
          <Stack direction="row" spacing={0.25} sx={{ alignItems: "center", px: 0.25 }}>
            <HighlightIcon fontSize="small" color="action" />
            <Select
              size="small"
              displayEmpty
              value={currentHighlight}
              disabled={disabled}
              aria-label="高亮"
              onChange={(e) => {
                const v = String(e.target.value);
                run(() =>
                  v
                    ? editor.chain().focus().toggleHighlight({ color: v }).run()
                    : editor.chain().focus().unsetHighlight().run(),
                );
              }}
              sx={{
                minWidth: 72,
                height: 30,
                fontSize: "0.75rem",
                bgcolor: "background.paper",
                "& .MuiSelect-select": { py: 0.5 },
              }}
              renderValue={(v) => {
                const hit = HIGHLIGHT_COLORS.find((c) => c.value === v) ?? HIGHLIGHT_COLORS[0];
                return (
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: 0.5,
                        bgcolor: hit.value || "transparent",
                        border: 1,
                        borderColor: "divider",
                      }}
                    />
                    <Typography variant="caption">{hit.label}</Typography>
                  </Stack>
                );
              }}
            >
              {HIGHLIGHT_COLORS.map((c) => (
                <MenuItem key={c.label} value={c.value}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Box
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: 0.5,
                        bgcolor: c.value || "transparent",
                        border: 1,
                        borderColor: "divider",
                      }}
                    />
                    {c.label}
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </Stack>
        </Tooltip>
      </Stack>

      {/* Row 2: lists, align, insert, clear, history */}
      <Stack
        direction="row"
        spacing={0.25}
        sx={{
          px: 0.75,
          py: 0.35,
          flexWrap: "wrap",
          alignItems: "center",
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "action.hover",
        }}
      >
        <ToolBtn
          title="无序列表"
          aria-label="无序列表"
          active={editor.isActive("bulletList")}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().toggleBulletList().run())}
        >
          <FormatListBulletedIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="有序列表"
          aria-label="有序列表"
          active={editor.isActive("orderedList")}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().toggleOrderedList().run())}
        >
          <FormatListNumberedIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="引用"
          aria-label="引用"
          active={editor.isActive("blockquote")}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().toggleBlockquote().run())}
        >
          <FormatQuoteIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="代码块"
          aria-label="代码块"
          active={editor.isActive("codeBlock")}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().toggleCodeBlock().run())}
        >
          <DataObjectIcon fontSize="small" />
        </ToolBtn>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.75 }} />

        <ToolBtn
          title="左对齐"
          aria-label="左对齐"
          active={editor.isActive({ textAlign: "left" })}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().setTextAlign("left").run())}
        >
          <FormatAlignLeftIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="居中"
          aria-label="居中"
          active={editor.isActive({ textAlign: "center" })}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().setTextAlign("center").run())}
        >
          <FormatAlignCenterIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="右对齐"
          aria-label="右对齐"
          active={editor.isActive({ textAlign: "right" })}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().setTextAlign("right").run())}
        >
          <FormatAlignRightIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="两端对齐"
          aria-label="两端对齐"
          active={editor.isActive({ textAlign: "justify" })}
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().setTextAlign("justify").run())}
        >
          <FormatAlignJustifyIcon fontSize="small" />
        </ToolBtn>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.75 }} />

        <ToolBtn
          title="插入链接"
          aria-label="链接"
          active={editor.isActive("link")}
          disabled={disabled}
          onClick={toggleLink}
        >
          <LinkIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="取消链接"
          aria-label="取消链接"
          disabled={disabled || !editor.isActive("link")}
          onClick={() => run(() => editor.chain().focus().unsetLink().run())}
        >
          <LinkOffIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="分隔线"
          aria-label="分隔线"
          disabled={disabled}
          onClick={() => run(() => editor.chain().focus().setHorizontalRule().run())}
        >
          <HorizontalRuleIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="清除格式"
          aria-label="清除格式"
          disabled={disabled}
          onClick={() =>
            run(() =>
              editor.chain().focus().unsetAllMarks().clearNodes().run(),
            )
          }
        >
          <FormatClearIcon fontSize="small" />
        </ToolBtn>

        <Box sx={{ flex: 1 }} />

        <ToolBtn
          title="撤销"
          aria-label="撤销"
          disabled={disabled || !canCmd(editor, "undo")}
          onClick={() => run(() => editor.chain().focus().undo().run())}
        >
          <UndoIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn
          title="重做"
          aria-label="重做"
          disabled={disabled || !canCmd(editor, "redo")}
          onClick={() => run(() => editor.chain().focus().redo().run())}
        >
          <RedoIcon fontSize="small" />
        </ToolBtn>
      </Stack>

      <Box
        sx={{
          minHeight: 220,
          maxHeight: 400,
          overflow: "auto",
          px: 1.5,
          py: 1,
          "& .composer-prose": {
            outline: "none",
            minHeight: 200,
            fontSize: "0.95rem",
            lineHeight: 1.65,
            fontFamily: "Roboto, Segoe UI, system-ui, sans-serif",
          },
          "& .composer-prose p": { margin: "0.45em 0" },
          "& .composer-prose h1": { fontSize: "1.5rem", fontWeight: 700, margin: "0.6em 0 0.35em" },
          "& .composer-prose h2": { fontSize: "1.25rem", fontWeight: 650, margin: "0.55em 0 0.3em" },
          "& .composer-prose h3": { fontSize: "1.1rem", fontWeight: 600, margin: "0.5em 0 0.25em" },
          "& .composer-prose ul, & .composer-prose ol": { paddingLeft: "1.5rem", margin: "0.4em 0" },
          "& .composer-prose blockquote": {
            borderLeft: "3px solid",
            borderColor: "divider",
            paddingLeft: "0.75rem",
            marginLeft: 0,
            color: "text.secondary",
          },
          "& .composer-prose a": { color: "primary.main" },
          "& .composer-prose code": {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: "0.88em",
            px: 0.5,
            py: 0.15,
            borderRadius: 0.5,
            bgcolor: "action.hover",
          },
          "& .composer-prose pre": {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: "0.85rem",
            p: 1.25,
            borderRadius: 1,
            bgcolor: "action.hover",
            overflow: "auto",
          },
          "& .composer-prose hr": {
            border: "none",
            borderTop: "1px solid",
            borderColor: "divider",
            my: 1.5,
          },
          "& .composer-prose mark": { borderRadius: 0.5, px: 0.25 },
          "& .tiptap p.is-editor-empty:first-of-type::before": {
            color: "text.disabled",
            content: "attr(data-placeholder)",
            float: "left",
            height: 0,
            pointerEvents: "none",
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
