import { describe, expect, it } from "vitest";
import {
  cleanContext,
  stripHtml,
  buildMailContext,
  redactSensitiveData,
  restoreRedactedData,
} from "./clean";

describe("cleanContext & stripHtml", () => {
  it("strips HTML tags and normalizes spaces", () => {
    const html = "<p>Hello <b>world</b>! &nbsp; Check &lt;this&gt; out.</p>";
    const text = stripHtml(html);
    expect(text).toBe("Hello world ! Check <this> out.");
  });

  it("removes quoted lines (>...)", () => {
    const raw = "Here is my reply.\n\n> On yesterday, you wrote:\n> Original message";
    const cleaned = cleanContext(raw);
    expect(cleaned).toBe("Here is my reply.");
  });

  it("truncates to max length", () => {
    const long = "A".repeat(100);
    const cleaned = cleanContext(long, 50);
    expect(cleaned.length).toBe(50);
  });

  it("builds formatted context", () => {
    const ctx = buildMailContext({
      from: "alice@example.com",
      subject: "Test Subject",
      body: "<p>Hello</p>",
    });
    expect(ctx).toContain("From: alice@example.com");
    expect(ctx).toContain("Subject: Test Subject");
    expect(ctx).toContain("Hello");
  });
});

describe("redactSensitiveData & restoreRedactedData", () => {
  it("replaces email addresses, phone numbers, and card numbers", () => {
    const input =
      "Please email alice@example.com or bob.test@company.co.uk. Call me at 13812345678 or +86 13987654321. Card: 6222-0212-3456-7890.";
    const { text, replacements } = redactSensitiveData(input);

    expect(text).not.toContain("alice@example.com");
    expect(text).not.toContain("13812345678");
    expect(text).not.toContain("6222-0212-3456-7890");

    expect(text).toContain("[EMAIL_1]");
    expect(text).toContain("[EMAIL_2]");
    expect(text).toContain("[PHONE_3]");
    expect(text).toContain("[PHONE_4]");
    expect(text).toContain("[NUM_5]");

    expect(replacements["[EMAIL_1]"]).toBe("alice@example.com");
    expect(replacements["[PHONE_3]"]).toBe("13812345678");

    // Test restoring
    const restored = restoreRedactedData(text, replacements);
    expect(restored).toBe(input);
  });

  it("handles input with no sensitive data", () => {
    const input = "This is a regular email about tomorrow's sync.";
    const { text, replacements } = redactSensitiveData(input);
    expect(text).toBe(input);
    expect(Object.keys(replacements)).toHaveLength(0);
  });
});
