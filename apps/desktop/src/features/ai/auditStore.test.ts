import { describe, expect, it, beforeEach } from "vitest";
import { useAiAuditStore } from "./auditStore";

describe("useAiAuditStore", () => {
  beforeEach(() => {
    useAiAuditStore.getState().clearRecords();
  });

  it("records an entry without bodies or keys", () => {
    useAiAuditStore.getState().recordCall({
      task: "summarize",
      charCount: 120,
      mode: "cloud",
      durationMs: 450,
      status: "success",
    });

    const records = useAiAuditStore.getState().records;
    expect(records).toHaveLength(1);
    expect(records[0].task).toBe("summarize");
    expect(records[0].charCount).toBe(120);
    expect(records[0].mode).toBe("cloud");
    expect(records[0].durationMs).toBe(450);
    expect(records[0].status).toBe("success");
    expect(records[0].timestamp).toBeGreaterThan(0);
    expect((records[0] as unknown as Record<string, unknown>).body).toBeUndefined();
    expect((records[0] as unknown as Record<string, unknown>).apiKey).toBeUndefined();
  });

  it("caps records at MAX_AUDIT_RECORDS", () => {
    for (let i = 0; i < 35; i++) {
      useAiAuditStore.getState().recordCall({
        task: `task_${i}`,
        charCount: i,
        mode: "local",
        durationMs: 10,
        status: "success",
      });
    }

    const records = useAiAuditStore.getState().records;
    expect(records).toHaveLength(30);
    expect(records[0].task).toBe("task_34");
  });

  it("clears records", () => {
    useAiAuditStore.getState().recordCall({
      task: "draftReply",
      charCount: 50,
      mode: "cloud",
      durationMs: 300,
      status: "success",
    });
    expect(useAiAuditStore.getState().records).toHaveLength(1);

    useAiAuditStore.getState().clearRecords();
    expect(useAiAuditStore.getState().records).toHaveLength(0);
  });
});
