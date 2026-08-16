import { describe, it, expect, vi } from "vitest";
import { AgentLoop, type AgentToolExecutable } from "./loop";
import type { AgentStreamEvent } from "./types";

describe("AgentLoop", () => {
  it("emits thinking tokens and content tokens correctly", async () => {
    const events: AgentStreamEvent[] = [];
    const loop = new AgentLoop((e) => {
      events.push(e);
    });

    await loop.emitThinkingToken("Thinking deeply...");
    await loop.emitContentToken("Hello world");

    expect(events).toEqual([
      { type: "thinking_token", textChunk: "Thinking deeply..." },
      { type: "token", textChunk: "Hello world" },
    ]);
  });

  it("executes registered tool and triggers tool_start and tool_end events", async () => {
    const events: AgentStreamEvent[] = [];
    const mockTool: AgentToolExecutable = {
      name: "calculate_tax",
      description: "Calculates tax",
      execute: vi.fn().mockResolvedValue({ tax: 15.5 }),
    };

    const tools = new Map<string, AgentToolExecutable>();
    tools.set("calculate_tax", mockTool);

    const loop = new AgentLoop(
      (e) => {
        events.push(e);
      },
      { tools }
    );

    const res = await loop.executeTool("call_1", "calculate_tax", { amount: 100 });

    expect(res.success).toBe(true);
    expect(res.result).toEqual({ tax: 15.5 });
    expect(events.length).toBe(2);
    expect(events[0].type).toBe("tool_start");
    expect(events[1].type).toBe("tool_end");
    if (events[1].type === "tool_end") {
      expect(events[1].success).toBe(true);
      expect(events[1].result).toEqual({ tax: 15.5 });
    }
  });

  it("blocks dangerous tool call when beforeToolCall returns block: true", async () => {
    const events: AgentStreamEvent[] = [];
    const mockTool: AgentToolExecutable = {
      name: "send_mail_directly",
      description: "Direct send mail",
      execute: vi.fn(),
    };

    const tools = new Map<string, AgentToolExecutable>();
    tools.set("send_mail_directly", mockTool);

    const loop = new AgentLoop(
      (e) => {
        events.push(e);
      },
      {
        tools,
        beforeToolCall: (name) => {
          if (name === "send_mail_directly") {
            return { block: true, reason: "Direct send is prohibited by HITL safety policy" };
          }
          return {};
        },
      }
    );

    const res = await loop.executeTool("call_2", "send_mail_directly", {});

    expect(res.success).toBe(false);
    expect(mockTool.execute).not.toHaveBeenCalled();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("tool_end");
    if (events[0].type === "tool_end") {
      expect(events[0].success).toBe(false);
      expect(events[0].error).toContain("HITL safety policy");
    }
  });
});
