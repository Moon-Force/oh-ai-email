import { describe, expect, it } from "vitest";
import {
  formatBytes,
  totalAttachmentBytes,
  validateAttachmentBatch,
  MAX_FILE_BYTES,
} from "./attachments";

describe("attachments helpers", () => {
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toMatch(/KB/);
    expect(formatBytes(2 * 1024 * 1024)).toMatch(/MB/);
  });

  it("sums sizes", () => {
    expect(totalAttachmentBytes([{ size: 10 }, { size: 20 }])).toBe(30);
  });

  it("rejects oversized single file", () => {
    const err = validateAttachmentBatch([], [{ size: MAX_FILE_BYTES + 1, name: "big.bin" }]);
    expect(err).toMatch(/超过单文件上限/);
  });

  it("rejects oversized total", () => {
    const err = validateAttachmentBatch(
      [{ size: 20 * 1024 * 1024 }],
      [{ size: 10 * 1024 * 1024, name: "more.bin" }]
    );
    expect(err).toMatch(/合计不能超过/);
  });

  it("accepts small batch", () => {
    expect(validateAttachmentBatch([], [{ size: 100, name: "a.txt" }])).toBeNull();
  });
});
