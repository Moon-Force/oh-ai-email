import { listAllMessages, getMessage, searchMessagesFts, upsertDraft, listAccounts } from "../../db";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const MAIL_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "search_messages",
    description: "Search local emails by keyword, sender, subject or body content.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keyword or query string",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default 10, max 50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_message_context",
    description: "Get the full body, headers, and metadata of a specific email message.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The unique ID of the message",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "create_mail_draft",
    description: "Create an email draft in the local drafts mailbox. NEVER sends mail directly.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient email address",
        },
        subject: {
          type: "string",
          description: "Subject line of the draft email",
        },
        body: {
          type: "string",
          description: "Plain text or markdown content of the draft body",
        },
        replyToMessageId: {
          type: "string",
          description: "Optional message ID if this is a reply draft",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "get_unread_summary",
    description: "Retrieve a summary list of recent unread emails across active accounts.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of unread messages to inspect (default 15)",
        },
      },
    },
  },
];

export class MailMcpServer {
  private serverInfo = {
    name: "oh-ai-email-mcp",
    version: "0.1.0",
  };

  /**
   * Process incoming JSON-RPC 2.0 / MCP request string and return response JSON string.
   */
  public async handleMessage(rawMessage: string): Promise<string | null> {
    let req: { jsonrpc?: string; id?: string | number; method?: string; params?: Record<string, unknown> };
    try {
      req = JSON.parse(rawMessage);
    } catch {
      return JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      });
    }

    if (!req.method) {
      return null;
    }

    // Handle notifications (no id)
    if (req.id === undefined || req.id === null) {
      return null;
    }

    const { id, method, params = {} } = req;

    switch (method) {
      case "initialize": {
        return JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: this.serverInfo,
          },
        });
      }

      case "ping": {
        return JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {},
        });
      }

      case "tools/list": {
        return JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            tools: MAIL_MCP_TOOLS,
          },
        });
      }

      case "tools/call": {
        const toolName = String(params.name || "");
        const args = (params.arguments || {}) as Record<string, unknown>;
        try {
          const result = await this.executeTool(toolName, args);
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
                },
              ],
            },
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Tool execution failed: ${errMsg}`,
                },
              ],
            },
          });
        }
      }

      default: {
        return JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method '${method}' not found` },
        });
      }
    }
  }

  /**
   * Execute an MCP tool by name.
   */
  public async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case "search_messages": {
        const query = String(args.query || "");
        const limit = Math.min(Math.max(Number(args.limit || 10), 1), 50);
        let results = searchMessagesFts(query);
        if (!results || results.length === 0) {
          // Fallback simple search
          const all = listAllMessages("");
          results = all.filter(
            (m) =>
              (m.subject && m.subject.toLowerCase().includes(query.toLowerCase())) ||
              (m.from && m.from.toLowerCase().includes(query.toLowerCase())) ||
              (m.snippet && m.snippet.toLowerCase().includes(query.toLowerCase()))
          );
        }
        return results.slice(0, limit).map((m) => ({
          id: m.id,
          subject: m.subject,
          from: m.from,
          fromName: m.fromName,
          dateMs: m.dateMs,
          dateLabel: m.dateLabel,
          snippet: m.snippet,
          unread: m.unread,
          split: m.split,
        }));
      }

      case "get_message_context": {
        const messageId = String(args.messageId || "");
        const message = getMessage(messageId);
        if (!message) {
          throw new Error(`Message not found: ${messageId}`);
        }
        return {
          id: message.id,
          subject: message.subject,
          from: message.from,
          fromName: message.fromName,
          dateMs: message.dateMs,
          dateLabel: message.dateLabel,
          bodyText: message.snippet || message.subject,
          html: message.html,
          snippet: message.snippet,
          split: message.split,
          unread: message.unread,
        };
      }

      case "create_mail_draft": {
        const to = String(args.to || "");
        const subject = String(args.subject || "");
        const body = String(args.body || "");
        const replyToMessageId = args.replyToMessageId ? String(args.replyToMessageId) : undefined;

        const accounts = listAccounts();
        const defaultAccountId = accounts[0]?.id || "default";

        const draftId = `mcp_draft_${Date.now()}`;
        upsertDraft({
          id: draftId,
          accountId: defaultAccountId,
          to,
          subject,
          body,
          replyToMessageId,
          updatedAt: Date.now(),
        });

        return {
          success: true,
          draftId,
          status: "saved_to_drafts",
          message: "Email draft successfully created in drafts folder for user review.",
        };
      }

      case "get_unread_summary": {
        const limit = Math.min(Math.max(Number(args.limit || 15), 1), 50);
        const all = listAllMessages("");
        const unread = all.filter((m) => m.unread).slice(0, limit);
        return {
          totalUnreadFound: unread.length,
          messages: unread.map((m) => ({
            id: m.id,
            subject: m.subject,
            from: m.from,
            fromName: m.fromName,
            dateMs: m.dateMs,
            snippet: m.snippet,
          })),
        };
      }

      default:
        throw new Error(`Unsupported tool: ${name}`);
    }
  }
}
