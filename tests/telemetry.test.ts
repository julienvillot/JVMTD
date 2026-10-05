import { describe, expect, it } from "vitest";
import { formatUtcOffset } from "@/hooks/useHmrcTelemetry";

describe("formatUtcOffset", () => {
  it("formats UTC+00:00 (GMT)", () => {
    // getTimezoneOffset() is 0
    expect(formatUtcOffset(0)).toBe("UTC+00:00");
  });

  it("formats UTC+01:00 (British Summer Time)", () => {
    // getTimezoneOffset() in BST is -60
    expect(formatUtcOffset(-60)).toBe("UTC+01:00");
  });

  it("formats negative UTC offsets correctly (e.g. US Eastern Time UTC-04:00)", () => {
    // getTimezoneOffset() for UTC-4 is +240
    expect(formatUtcOffset(240)).toBe("UTC-04:00");
  });

  it("formats half-hour timezone offsets (e.g. India UTC+05:30)", () => {
    // getTimezoneOffset() for UTC+5:30 is -330
    expect(formatUtcOffset(-330)).toBe("UTC+05:30");
  });
});
