import { describe, expect, it } from "vitest";
import { computeSha256 } from "@/lib/security/hash";

describe("computeSha256", () => {
  it("calculates known SHA-256 hash for hello world", async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode("hello world");
    const hash = await computeSha256(data);

    // b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  });

  it("calculates SHA-256 hash for empty buffer", async () => {
    const data = new Uint8Array(0);
    const hash = await computeSha256(data);

    // e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});
