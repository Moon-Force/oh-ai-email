import { describe, it, expect } from "vitest";
import { isNewerVersion, getCurrentAppVersion } from "./updater";

describe("updater module", () => {
  it("correctly compares semver versions", () => {
    expect(isNewerVersion("0.1.0", "0.1.1")).toBe(true);
    expect(isNewerVersion("0.1.0", "0.2.0")).toBe(true);
    expect(isNewerVersion("0.1.0", "1.0.0")).toBe(true);
    expect(isNewerVersion("0.1.1", "0.1.0")).toBe(false);
    expect(isNewerVersion("0.1.0", "0.1.0")).toBe(false);
    expect(isNewerVersion("v0.1.0", "v0.1.2")).toBe(true);
  });

  it("returns a valid current app version string", () => {
    const v = getCurrentAppVersion();
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });
});
