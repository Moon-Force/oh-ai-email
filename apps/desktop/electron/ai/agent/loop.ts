import type {
  AgentStreamEvent,
  AgentToolStartEvent,
  AgentToolEndEvent,
  BeforeToolCallResult,
  AfterToolCallResult,
} from "./types";

export type AgentEventSink = (event: AgentStreamEvent) => void | Promise<void>;

export interface AgentToolExecutable {
  name: string;
  description: string;
  execute: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
}

export interface AgentLoopOptions {
  tools?: Map<string, AgentToolExecutable>;
  beforeToolCall?: (toolName: string, args: Record<string, unknown>) => Promise<BeforeToolCallResult> | BeforeToolCallResult;
  afterToolCall?: (toolName: string, result: unknown, isError: boolean) => Promise<AfterToolCallResult> | AfterToolCallResult;
  maxTurns?: number;
  signal?: AbortSignal;
}

export interface AgentLoopResult {
  completed: boolean;
  finalContent: string;
  thinkingContent: string;
  toolExecutionsCount: number;
  stoppedReason?: "completed" | "aborted" | "max_turns" | "blocked" | "error";
  error?: string;
}

/**
 * Core Agent Loop inspired by pi-agent-core.
 * Manages streaming events, thinking process, tool lifecycle, and execution sandbox.
 */
export class AgentLoop {
  private emit: AgentEventSink;
  private options: AgentLoopOptions;

  constructor(emit: AgentEventSink, options: AgentLoopOptions = {}) {
    this.emit = emit;
    this.options = {
      maxTurns: 10,
      ...options,
    };
  }

  /**
   * Dispatches an event safely to the sink.
   */
  public async dispatchEvent(event: AgentStreamEvent): Promise<void> {
    try {
      await this.emit(event);
    } catch {
      // Ignore sink dispatch errors
    }
  }

  /**
   * Streams thinking tokens.
   */
  public async emitThinkingToken(chunk: string): Promise<void> {
    if (!chunk) return;
    await this.dispatchEvent({
      type: "thinking_token",
      textChunk: chunk,
    });
  }

  /**
   * Streams content tokens.
   */
  public async emitContentToken(chunk: string): Promise<void> {
    if (!chunk) return;
    await this.dispatchEvent({
      type: "token",
      textChunk: chunk,
    });
  }

  /**
   * Executes a registered tool with before/after sandbox hooks.
   */
  public async executeTool(
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; result: unknown; terminate?: boolean }> {
    const startTime = Date.now();

    // Check cancellation
    if (this.options.signal?.aborted) {
      return { success: false, result: "Operation aborted by user", terminate: true };
    }

    // 1. Before Tool Call Hook
    if (this.options.beforeToolCall) {
      try {
        const beforeRes = await this.options.beforeToolCall(toolName, args);
        if (beforeRes.block) {
          const reason = beforeRes.reason || `Tool execution for '${toolName}' was blocked by safety policy.`;
          const endEvt: AgentToolEndEvent = {
            type: "tool_end",
            toolCallId,
            toolName,
            success: false,
            error: reason,
            durationMs: Date.now() - startTime,
          };
          await this.dispatchEvent(endEvt);
          return { success: false, result: reason, terminate: beforeRes.terminate ?? false };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { success: false, result: `Pre-execution hook error: ${errorMsg}`, terminate: true };
      }
    }

    // 2. Emit Tool Start Event
    const startEvt: AgentToolStartEvent = {
      type: "tool_start",
      toolCallId,
      toolName,
      args,
    };
    await this.dispatchEvent(startEvt);

    const tool = this.options.tools?.get(toolName);
    if (!tool) {
      const errorMsg = `Tool '${toolName}' is not registered in this agent environment.`;
      const endEvt: AgentToolEndEvent = {
        type: "tool_end",
        toolCallId,
        toolName,
        success: false,
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };
      await this.dispatchEvent(endEvt);
      return { success: false, result: errorMsg };
    }

    // 3. Execute Tool
    let rawResult: unknown;
    let isError = false;
    try {
      rawResult = await tool.execute(args, this.options.signal);
    } catch (err) {
      isError = true;
      rawResult = err instanceof Error ? err.message : String(err);
    }

    // 4. After Tool Call Hook
    let finalResult = rawResult;
    let shouldTerminate = false;

    if (this.options.afterToolCall) {
      try {
        const afterRes = await this.options.afterToolCall(toolName, rawResult, isError);
        if (afterRes.content !== undefined) {
          finalResult = afterRes.content;
        }
        if (afterRes.isError !== undefined) {
          isError = afterRes.isError;
        }
        if (afterRes.terminate !== undefined) {
          shouldTerminate = afterRes.terminate;
        }
      } catch {
        // Fallback to raw result if after hook fails
      }
    }

    // 5. Emit Tool End Event
    const endEvt: AgentToolEndEvent = {
      type: "tool_end",
      toolCallId,
      toolName,
      success: !isError,
      result: isError ? undefined : finalResult,
      error: isError ? String(finalResult) : undefined,
      durationMs: Date.now() - startTime,
    };
    await this.dispatchEvent(endEvt);

    return {
      success: !isError,
      result: finalResult,
      terminate: shouldTerminate,
    };
  }
}
