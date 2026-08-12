import { describe, expect, it } from "vitest";

// Pure helpers mirrored for unit tests without spinning real SMTP
function splitAddresses(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

describe("smtp address parsing", () => {
  it("splits comma and semicolon lists", () => {
    expect(splitAddresses("a@b.com, c@d.com; e@f.com")).toEqual(["a@b.com", "c@d.com", "e@f.com"]);
  });

  it("drops invalid tokens", () => {
    expect(splitAddresses("not-an-email, ok@x.com")).toEqual(["ok@x.com"]);
  });
});
