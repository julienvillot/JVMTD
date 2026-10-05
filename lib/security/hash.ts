/**
 * Compute SHA-256 hex digest for an ArrayBuffer or Uint8Array.
 * Works in both browser (Web Crypto API) and Node.js (crypto module).
 */
export async function computeSha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const buffer = data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Node.js environment
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256");
  hash.update(data instanceof Uint8Array ? data : new Uint8Array(data));
  return hash.digest("hex");
}
