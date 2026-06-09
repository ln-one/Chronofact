import { readFile } from "node:fs/promises";
import type { StoredFile } from "./schema.js";

const maxExtractedChars = 20_000;

export type FileContentAnalysis = {
  file_id: string;
  filename: string;
  mime_type: string | null;
  sha256: string;
  size: number;
  kind: "text" | "docx" | "pdf" | "unsupported" | "missing";
  extracted_chars: number;
  truncated: boolean;
  preview: string;
  warnings: string[];
};

export async function extractFileContent(file: StoredFile): Promise<FileContentAnalysis> {
  const base = {
    file_id: file.fileId,
    filename: file.filename,
    mime_type: file.mimeType,
    sha256: file.sha256,
    size: file.size
  };
  if (!file.storagePath) {
    return {
      ...base,
      kind: "missing",
      extracted_chars: 0,
      truncated: false,
      preview: "",
      warnings: ["文件缓存不存在，暂时只能分析文件名、大小和存证状态。"]
    };
  }

  const buffer = await readFile(file.storagePath);
  const extension = file.filename.split(".").at(-1)?.toLocaleLowerCase() ?? "";
  const mimeType = file.mimeType ?? "";
  let kind: FileContentAnalysis["kind"] = "unsupported";
  let text = "";
  const warnings: string[] = [];

  if (isTextLike(extension, mimeType)) {
    kind = "text";
    text = buffer.toString("utf8");
  } else if (extension === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    kind = "docx";
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value ?? "";
      for (const message of result.messages ?? []) {
        if (message.message) warnings.push(message.message);
      }
    } catch {
      warnings.push("DOCX 内容解析失败，暂时只能分析文件名、大小和存证状态。");
    }
  } else if (extension === "pdf" || mimeType === "application/pdf") {
    kind = "pdf";
    let parser: { getText: () => Promise<{ text?: string }>; destroy?: () => Promise<void> | void } | null = null;
    try {
      const { PDFParse } = await import("pdf-parse");
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      text = result.text ?? "";
    } catch {
      warnings.push("PDF 内容解析失败，暂时只能分析文件名、大小和存证状态。");
    } finally {
      await parser?.destroy?.();
    }
  } else {
    warnings.push("这个文件类型暂时不支持正文抽取，已改为分析文件名、大小和存证状态。");
  }

  const normalized = normalizeExtractedText(text);
  const truncated = normalized.length > maxExtractedChars;
  const preview = truncated ? normalized.slice(0, maxExtractedChars) : normalized;
  return {
    ...base,
    kind,
    extracted_chars: normalized.length,
    truncated,
    preview,
    warnings
  };
}

function isTextLike(extension: string, mimeType: string) {
  if (mimeType.startsWith("text/")) return true;
  return [
    "txt",
    "md",
    "markdown",
    "csv",
    "json",
    "xml",
    "html",
    "htm",
    "log",
    "yaml",
    "yml",
    "ts",
    "tsx",
    "js",
    "jsx",
    "py",
    "java",
    "sol",
    "go",
    "rs"
  ].includes(extension);
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}
