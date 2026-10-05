import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it("allows relative paths", () => {
    expect(safeNextPath("/dashboard/filing?x=1")).toBe("/dashboard/filing?x=1");
  });

  it("falls back for empty values", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "evil.example", "javascript:alert(1)"])(
    "rejects %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/dashboard");
    },
  );

  it("uses a custom fallback", () => {
    expect(safeNextPath("//x", "/login")).toBe("/login");
  });
});
