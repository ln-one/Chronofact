import { readFileSync } from "node:fs";
import { createAiExplanationHttpClient } from "../aiHttpClient.js";
import { assertChronofactAdapters } from "./contracts.js";
import { createChronestiaHttpAdapter } from "./chronestiaHttpAdapter.js";
import { createDualweaveHttpAdapter } from "./dualweaveHttpAdapter.js";
import { createLimoraHttpAdapter } from "./limoraHttpAdapter.js";
import {
  createAiExplanationMockAdapter,
  createChronestiaMockAdapter,
  createDemoLimoraAdapter,
  createDualweaveMockAdapter
} from "./mockAdapters.js";

export function createChronofactAdapters({ env = process.env, storageDir } = {}) {
  const timeoutMs = Number(env.CHRONOFACT_HTTP_TIMEOUT_MS || 0) || undefined;

  const clients = {
    limora: env.CHRONOFACT_LIMORA_URL
      ? createLimoraHttpAdapter({
          baseUrl: env.CHRONOFACT_LIMORA_URL,
          timeoutMs: Number(env.CHRONOFACT_LIMORA_TIMEOUT_MS || 0) || timeoutMs || 3000
        })
      : createDemoLimoraAdapter(),
    dualweave: env.CHRONOFACT_DUALWEAVE_URL
      ? createDualweaveHttpAdapter({
          baseUrl: env.CHRONOFACT_DUALWEAVE_URL,
          execution: readDualweaveExecution(env),
          timeoutMs: Number(env.CHRONOFACT_DUALWEAVE_TIMEOUT_MS || 0) || timeoutMs || 30000
        })
      : createDualweaveMockAdapter({ storageDir }),
    chronestia: env.CHRONOFACT_CHRONESTIA_URL
      ? createChronestiaHttpAdapter({
          baseUrl: env.CHRONOFACT_CHRONESTIA_URL,
          timeoutMs: Number(env.CHRONOFACT_CHRONESTIA_TIMEOUT_MS || 0) || timeoutMs || 5000
        })
      : createChronestiaMockAdapter(),
    ai: env.CHRONOFACT_AI_URL
      ? createAiExplanationHttpClient({
          baseUrl: env.CHRONOFACT_AI_URL,
          timeoutMs: Number(env.CHRONOFACT_AI_TIMEOUT_MS || 0) || timeoutMs || 3000
        })
      : createAiExplanationMockAdapter()
  };

  return assertChronofactAdapters(clients);
}

function readDualweaveExecution(env) {
  if (env.CHRONOFACT_DUALWEAVE_EXECUTION_JSON) {
    return env.CHRONOFACT_DUALWEAVE_EXECUTION_JSON;
  }

  if (env.CHRONOFACT_DUALWEAVE_EXECUTION_FILE) {
    return readFileSync(env.CHRONOFACT_DUALWEAVE_EXECUTION_FILE, "utf8");
  }

  throw new Error(
    "CHRONOFACT_DUALWEAVE_EXECUTION_JSON or CHRONOFACT_DUALWEAVE_EXECUTION_FILE is required when CHRONOFACT_DUALWEAVE_URL is set."
  );
}
