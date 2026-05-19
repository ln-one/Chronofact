import { readFile } from "node:fs/promises";
import { SCENARIOS } from "./constants.js";
import { askDefault, requireAnswer, write } from "./io.js";
import { printJson } from "./renderers.js";

export async function askContent(prompt) {
  const mode = (await askDefault(prompt, "Content source [text/file/base64]", "text")).toLowerCase();

  if (mode === "file") {
    const filePath = await requireAnswer(prompt, "File path: ");
    return { content_base64: (await readFile(filePath)).toString("base64") };
  }

  if (mode === "base64") {
    return { content_base64: await requireAnswer(prompt, "Base64 content: ") };
  }

  return { content_text: await requireAnswer(prompt, "Text content: ") };
}

export async function askScenario(prompt, outputStream) {
  write(outputStream, `Scenarios: ${SCENARIOS.join(", ")}\n`);
  const scenario = await askDefault(prompt, "Scenario", "none");
  return scenario === "none" ? undefined : scenario;
}

export async function maybePrintJson({ prompt, outputStream, result }) {
  const showJson = await askDefault(prompt, "Print full JSON? [y/N]", "N");
  if (showJson.toLowerCase().startsWith("y")) {
    printJson(outputStream, result);
  }
}
