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
