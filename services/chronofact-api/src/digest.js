import { createHash } from "node:crypto";

export function toContentBuffer(input) {
  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (input?.content_base64) {
    return Buffer.from(input.content_base64, "base64");
  }

  if (input?.content_text !== undefined) {
    return Buffer.from(String(input.content_text), "utf8");
  }

  if (input?.content !== undefined) {
    return Buffer.from(String(input.content), "utf8");
  }

  throw new Error("content is required");
}

export function sha256Hex(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function isSha256Hex(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || ""));
}

export function normalizeSha256Hex(value) {
  if (!isSha256Hex(value)) {
    throw new Error("sha256 must be a 64-character hexadecimal digest");
  }
  return String(value).toLowerCase();
}
