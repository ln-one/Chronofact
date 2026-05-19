import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { MOCK_CONTRACT } from "./mockContract.js";
import { addVersion, showAsset, submitAsset, verifyVersion } from "./tui/actions.js";
import { ask, createPromptSession, getArgValue, write } from "./tui/io.js";
import { printError, printJson, writeMenu } from "./tui/renderers.js";
import { createTuiState } from "./tui/state.js";

export async function runTui({
  storageDir = getArgValue("--storage-dir"),
  inputStream = input,
  outputStream = output,
} = {}) {
  const rl = createInterface({ input: inputStream, crlfDelay: Infinity });
  const prompt = createPromptSession(rl, outputStream);
  const { orchestrator } = createApp({ storageDir });
  const state = createTuiState();

  write(outputStream, "Chronofact backend TUI\n");
  write(outputStream, "Use this session to exercise the mock backend without the frontend.\n\n");

  try {
    while (true) {
      writeMenu(outputStream, state);
      const choice = await ask(prompt, "Select action: ");

      if (choice === "0" || choice.toLowerCase() === "q") {
        write(outputStream, "Bye.\n");
        return state;
      }

      try {
        await runSelectedAction({ choice, prompt, orchestrator, state, outputStream });
      } catch (error) {
        printError(outputStream, error);
      }
    }
  } finally {
    rl.close();
  }
}

async function runSelectedAction({ choice, prompt, orchestrator, state, outputStream }) {
  if (choice === "1") {
    await submitAsset({ prompt, orchestrator, state, outputStream });
  } else if (choice === "2") {
    await addVersion({ prompt, orchestrator, state, outputStream });
  } else if (choice === "3") {
    await verifyVersion({ prompt, orchestrator, state, outputStream });
  } else if (choice === "4") {
    await showAsset({ prompt, orchestrator, state, outputStream });
  } else if (choice === "5") {
    printJson(outputStream, MOCK_CONTRACT);
  } else if (choice === "6") {
    printJson(outputStream, state.lastResult ?? { message: "No result yet." });
  } else {
    write(outputStream, "Unknown action.\n");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runTui().catch((error) => {
    printError(output, error);
    process.exitCode = 1;
  });
}
