import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import MarkdownView from "./MarkdownView";

describe("MarkdownView Component", () => {
  it("renders headers and paragraph content cleanly", () => {
    const markdown = `
# 一级大标题
这是一段普通段落，包含 **加粗文字** 和 \`行内代码\`。

## 二级分段标题
- 列表项 1
- 列表项 2
`;
    render(<MarkdownView content={markdown} />);

    expect(screen.getByText("一级大标题")).toBeInTheDocument();
    expect(screen.getByText("二级分段标题")).toBeInTheDocument();
    expect(screen.getByText("加粗文字")).toBeInTheDocument();
    expect(screen.getByText("行内代码")).toBeInTheDocument();
    expect(screen.getByText("列表项 1")).toBeInTheDocument();
  });

  it("renders markdown table properly", () => {
    const tableMarkdown = `
| 序号 | 主题 | 状态 |
|:---:|------|:----:|
| 1 | 超期交货提醒 | 🔴 高 |
| 2 | 你好问候 | ⚪ 低 |
`;
    render(<MarkdownView content={tableMarkdown} />);

    expect(screen.getByText("序号")).toBeInTheDocument();
    expect(screen.getByText("超期交货提醒")).toBeInTheDocument();
    expect(screen.getByText("你好问候")).toBeInTheDocument();
  });

  it("renders blockquotes and hides raw split_change JSON blocks by default", () => {
    const quoteMarkdown = `
> 💡 提醒：以上均为订单交货提醒系统自动发送。

\`\`\`json
{
  "split_change": [
    { "message_id": "123", "new_split": "important" }
  ]
}
\`\`\`
`;
    render(<MarkdownView content={quoteMarkdown} hideJsonBlocks={true} />);

    expect(screen.getByText(/提醒：以上均为订单交货提醒系统自动发送/)).toBeInTheDocument();
    expect(screen.getByText("查看原始结构化提案数据 (JSON)")).toBeInTheDocument();
  });
});
