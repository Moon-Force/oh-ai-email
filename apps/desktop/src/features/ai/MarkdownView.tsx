import React, { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import CodeIcon from "@mui/icons-material/Code";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

interface MarkdownViewProps {
  content: string;
  hideJsonBlocks?: boolean;
}

/**
 * Renders inline formatting (bold, italic, code, chips/badges).
 */
export function renderInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  // Split by inline code, bold, italic, and badge tags
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // 1. Inline code: `code`
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`([\s\S]*)$/);
    // 2. Bold text: **bold** or __bold__
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*([\s\S]*)$/);
    // 3. Status badges: 🔴 高, ✅ 重要, ⚪ 低, ❌ 其他, ⚠️ 需立即处理
    const badgeMatch = remaining.match(
      /^(.*?)(🔴\s*高|✅\s*重要|⚪\s*低|❌\s*其他|❌\s*其它|⚠️\s*需立即处理|⚠️\s*紧急)([\s\S]*)$/
    );

    // Find the earliest match
    const matches = [
      { type: "code", match: codeMatch, index: codeMatch ? codeMatch[1].length : Infinity },
      { type: "bold", match: boldMatch, index: boldMatch ? boldMatch[1].length : Infinity },
      { type: "badge", match: badgeMatch, index: badgeMatch ? badgeMatch[1].length : Infinity },
    ].sort((a, b) => a.index - b.index);

    const best = matches[0];

    if (!best.match || best.index === Infinity) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    const before = best.match[1];
    if (before) {
      parts.push(<span key={key++}>{before}</span>);
    }

    if (best.type === "code") {
      parts.push(
        <Box
          component="code"
          key={key++}
          sx={{
            px: 0.75,
            py: 0.2,
            borderRadius: 1,
            bgcolor: "action.hover",
            fontFamily: "monospace",
            fontSize: "0.825em",
            color: "primary.main",
            border: 1,
            borderColor: "divider",
            mx: 0.25,
          }}
        >
          {best.match[2]}
        </Box>
      );
      remaining = best.match[3];
    } else if (best.type === "bold") {
      parts.push(
        <Typography
          component="strong"
          key={key++}
          sx={{
            fontWeight: 700,
            color: "text.primary",
            display: "inline",
          }}
        >
          {renderInlineMarkdown(best.match[2])}
        </Typography>
      );
      remaining = best.match[3];
    } else if (best.type === "badge") {
      const badgeText = best.match[2];
      const isImportant =
        badgeText.includes("高") || badgeText.includes("重要") || badgeText.includes("紧急");
      parts.push(
        <Chip
          key={key++}
          size="small"
          label={badgeText}
          color={isImportant ? "error" : "default"}
          variant={isImportant ? "filled" : "outlined"}
          sx={{
            height: 20,
            fontSize: "0.7rem",
            fontWeight: 600,
            mx: 0.5,
            verticalAlign: "middle",
          }}
        />
      );
      remaining = best.match[3];
    }
  }

  return <>{parts}</>;
}

type Block =
  | { type: "h1" | "h2" | "h3" | "h4"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "blockquote"; text: string }
  | { type: "hr" }
  | { type: "code"; language: string; code: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; ordered: boolean; items: string[] };

/**
 * Tokenizes markdown string into structured semantic blocks.
 */
function parseMarkdownBlocks(rawText: string, hideJsonBlocks: boolean): { blocks: Block[]; jsonBlocks: string[] } {
  const blocks: Block[] = [];
  const jsonBlocks: string[] = [];

  // Normalize line endings
  const text = rawText.replace(/\r\n/g, "\n");
  const lines = text.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Code Blocks (``` ... ```)
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim().toLowerCase();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```

      const codeString = codeLines.join("\n");
      if (lang === "json" && (codeString.includes("split_change") || codeString.includes("proposal"))) {
        jsonBlocks.push(codeString);
        if (!hideJsonBlocks) {
          blocks.push({ type: "code", language: "json", code: codeString });
        }
      } else {
        blocks.push({ type: "code", language: lang || "text", code: codeString });
      }
      continue;
    }

    // 2. Horizontal Rules (---, ___, ***)
    if (/^(\-{3,}|\_{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // 3. Headings (#, ##, ###, ####)
    if (trimmed.startsWith("#")) {
      const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const type = level === 1 ? "h1" : level === 2 ? "h2" : level === 3 ? "h3" : "h4";
        blocks.push({ type, text: headingMatch[2] });
        i++;
        continue;
      }
    }

    // 4. Blockquotes (> ...)
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join("\n") });
      continue;
    }

    // 5. Tables (| ... |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const parseRow = (r: string) =>
          r
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim());

        const headers = parseRow(tableLines[0]);
        // Filter out delimiter row (|:---|:---|)
        const contentRows = tableLines.slice(1).filter((r) => !/^[\|\:\-\s]+$/.test(r));
        const rows = contentRows.map(parseRow);

        blocks.push({ type: "table", headers, rows });
        continue;
      }
    }

    // 6. Lists (ordered or unordered)
    const isUnordered = /^[-*+]\s+/.test(trimmed);
    const isOrdered = /^\d+\.\s+/.test(trimmed);

    if (isUnordered || isOrdered) {
      const items: string[] = [];
      const ordered = isOrdered;

      while (i < lines.length) {
        const current = lines[i].trim();
        if (!current) break;

        const currentUnordered = /^[-*+]\s+/.test(current);
        const currentOrdered = /^\d+\.\s+/.test(current);

        if ((ordered && currentOrdered) || (!ordered && currentUnordered)) {
          const content = current.replace(ordered ? /^\d+\.\s+/ : /^[-*+]\s+/, "");
          items.push(content);
          i++;
        } else if (/^\s{2,}/.test(lines[i])) {
          // Sub-item / indented continuation
          if (items.length > 0) {
            items[items.length - 1] += "\n" + current;
          }
          i++;
        } else {
          break;
        }
      }

      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // 7. Standard Paragraphs
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i].trim();
      if (!cur) break;
      if (
        cur.startsWith("#") ||
        cur.startsWith("```") ||
        cur.startsWith(">") ||
        (cur.startsWith("|") && cur.endsWith("|")) ||
        /^[-*+]\s+/.test(cur) ||
        /^\d+\.\s+/.test(cur) ||
        /^(\-{3,}|\_{3,}|\*{3,})$/.test(cur)
      ) {
        break;
      }
      paraLines.push(cur);
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", text: paraLines.join(" ") });
    }
  }

  return { blocks, jsonBlocks };
}

/**
 * Premium Modern Markdown Renderer for AI Email Insights and Reports.
 */
export default function MarkdownView({ content, hideJsonBlocks = true }: MarkdownViewProps) {
  const [copied, setCopied] = useState(false);
  const [showJsonInspector, setShowJsonInspector] = useState(false);

  const { blocks, jsonBlocks } = parseMarkdownBlocks(content || "", hideJsonBlocks);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!content || !content.trim()) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
        暂无详细分析内容
      </Typography>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2.5,
        bgcolor: "background.paper",
        boxShadow: (t) =>
          t.palette.mode === "dark"
            ? "0 4px 20px rgba(0,0,0,0.3)"
            : "0 2px 12px rgba(0,0,0,0.04)",
        border: 1,
        borderColor: "divider",
        position: "relative",
      }}
    >
      {/* Top Action Bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1.5,
          mb: 1.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <AutoAwesomeIcon fontSize="small" color="primary" />
          <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
            AI 分析洞察与总结报告
          </Typography>
        </Stack>
        <Tooltip title={copied ? "已复制到剪贴板" : "复制报告全文"}>
          <IconButton size="small" onClick={handleCopy} sx={{ p: 0.5 }}>
            {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Rendered Markdown Blocks */}
      <Stack spacing={1.5}>
        {blocks.map((block, idx) => {
          switch (block.type) {
            case "h1":
              return (
                <Box key={idx} sx={{ mt: 1.5, mb: 0.5 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 800,
                      color: "primary.main",
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    {renderInlineMarkdown(block.text)}
                  </Typography>
                  <Divider sx={{ mt: 0.5, borderColor: "primary.light", opacity: 0.4 }} />
                </Box>
              );

            case "h2":
              return (
                <Box key={idx} sx={{ mt: 2, mb: 0.5 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.925rem",
                      color: "text.primary",
                      display: "flex",
                      alignItems: "center",
                      gap: 0.75,
                    }}
                  >
                    {renderInlineMarkdown(block.text)}
                  </Typography>
                  <Divider sx={{ mt: 0.5 }} />
                </Box>
              );

            case "h3":
              return (
                <Typography
                  key={idx}
                  variant="body2"
                  sx={{
                    fontWeight: 700,
                    color: "text.primary",
                    mt: 1.25,
                    mb: 0.25,
                  }}
                >
                  {renderInlineMarkdown(block.text)}
                </Typography>
              );

            case "h4":
              return (
                <Typography
                  key={idx}
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    display: "block",
                    mt: 1,
                  }}
                >
                  {renderInlineMarkdown(block.text)}
                </Typography>
              );

            case "paragraph":
              return (
                <Typography
                  key={idx}
                  variant="body2"
                  sx={{
                    lineHeight: 1.7,
                    color: "text.secondary",
                    "& strong": { color: "text.primary" },
                  }}
                >
                  {renderInlineMarkdown(block.text)}
                </Typography>
              );

            case "blockquote":
              return (
                <Paper
                  key={idx}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    my: 1,
                    borderRadius: "0 8px 8px 0",
                    borderLeft: 4,
                    borderColor: "primary.main",
                    bgcolor: "action.hover",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontStyle: "normal",
                      color: "text.primary",
                      lineHeight: 1.6,
                    }}
                  >
                    {renderInlineMarkdown(block.text)}
                  </Typography>
                </Paper>
              );

            case "hr":
              return <Divider key={idx} sx={{ my: 1.5 }} />;

            case "list":
              return (
                <Box key={idx} sx={{ pl: 1, my: 0.5 }}>
                  <Stack spacing={0.75}>
                    {block.items.map((item, itemIdx) => (
                      <Box
                        key={itemIdx}
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 1,
                        }}
                      >
                        <Box
                          sx={{
                            minWidth: 16,
                            textAlign: "center",
                            color: "primary.main",
                            fontWeight: block.ordered ? 700 : 900,
                            fontSize: block.ordered ? "0.75rem" : "1rem",
                            lineHeight: 1.6,
                            userSelect: "none",
                          }}
                        >
                          {block.ordered ? `${itemIdx + 1}.` : "•"}
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            lineHeight: 1.65,
                            color: "text.secondary",
                            flex: 1,
                            "& strong": { color: "text.primary" },
                          }}
                        >
                          {renderInlineMarkdown(item)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              );

            case "table":
              return (
                <TableContainer
                  key={idx}
                  component={Paper}
                  variant="outlined"
                  sx={{
                    my: 1.5,
                    borderRadius: 2,
                    overflow: "hidden",
                    border: 1,
                    borderColor: "divider",
                  }}
                >
                  <Table size="small" sx={{ minWidth: 280 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: "action.hover" }}>
                        {block.headers.map((h, hIdx) => (
                          <TableCell
                            key={hIdx}
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              py: 1,
                              color: "text.primary",
                              borderBottom: 1,
                              borderColor: "divider",
                            }}
                          >
                            {renderInlineMarkdown(h)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {block.rows.map((row, rIdx) => (
                        <TableRow
                          key={rIdx}
                          sx={{
                            "&:last-child td, &:last-child th": { border: 0 },
                            "&:hover": { bgcolor: "action.hover" },
                          }}
                        >
                          {row.map((cell, cIdx) => (
                            <TableCell
                              key={cIdx}
                              sx={{
                                fontSize: "0.75rem",
                                py: 1,
                                color: "text.secondary",
                              }}
                            >
                              {renderInlineMarkdown(cell)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              );

            case "code":
              return (
                <Paper
                  key={idx}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    my: 1,
                    borderRadius: 2,
                    bgcolor: (t) => (t.palette.mode === "dark" ? "grey.900" : "grey.100"),
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    overflowX: "auto",
                    color: "text.primary",
                  }}
                >
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{block.code}</pre>
                </Paper>
              );

            default:
              return null;
          }
        })}
      </Stack>

      {/* Collapsible JSON Proposals Metadata Inspector (if any) */}
      {hideJsonBlocks && jsonBlocks.length > 0 && (
        <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
          <Button
            size="small"
            color="inherit"
            startIcon={<CodeIcon fontSize="small" />}
            endIcon={showJsonInspector ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            onClick={() => setShowJsonInspector((v) => !v)}
            sx={{ fontSize: "0.75rem", color: "text.secondary" }}
          >
            {showJsonInspector ? "收起原始结构化提案数据" : "查看原始结构化提案数据 (JSON)"}
          </Button>
          <Collapse in={showJsonInspector}>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {jsonBlocks.map((jsonStr, jIdx) => (
                <Paper
                  key={jIdx}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: (t) => (t.palette.mode === "dark" ? "grey.900" : "grey.100"),
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    maxHeight: 180,
                    overflowY: "auto",
                  }}
                >
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{jsonStr}</pre>
                </Paper>
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}
    </Paper>
  );
}
