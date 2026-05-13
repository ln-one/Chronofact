import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { startServer } from "../services/chronofact-api/src/app.js";

const aiPort = Number(process.env.CHRONOFACT_AI_PORT ?? 18080);
const apiPort = Number(process.env.CHRONOFACT_API_PORT ?? 13001);
const aiUrl = `http://127.0.0.1:${aiPort}`;
const apiUrl = `http://127.0.0.1:${apiPort}`;

let aiProcess;
let apiServer;

try {
  aiProcess = spawn("python", ["run_server.py"], {
    cwd: new URL("../services/ai-explanation/", import.meta.url),
    env: {
      ...process.env,
      CHRONOFACT_AI_PORT: String(aiPort),
      PYTHONUNBUFFERED: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  aiProcess.stdout.on("data", (chunk) => process.stdout.write(`[ai] ${chunk}`));
  aiProcess.stderr.on("data", (chunk) => process.stderr.write(`[ai] ${chunk}`));

  await waitForHealth(`${aiUrl}/health`, "AI explanation service");
  process.env.CHRONOFACT_AI_URL = aiUrl;
  apiServer = await startServer({ port: apiPort });
  await waitForHealth(`${apiUrl}/health`, "Chronofact API");

  const created = await postJson(`${apiUrl}/assets`, {
    filename: "integration-report-v1.txt",
    asset_type: "lab_report",
    content_text: "integration report v1"
  });
  assertEqual(created.verification_result.status, "verified", "created version should verify");
  assertArrayIncludes(created.ai_explanation.evidence_basis, "verification_result", "AI response should come from evidence");

  const second = await postJson(`${apiUrl}/assets/${created.asset_version.asset_id}/versions`, {
    filename: "integration-report-v2.txt",
    content_text: "integration report v2"
  });
  assertEqual(second.asset_version.previous_version_id, created.asset_version.version_id, "v2 should link to v1");

  const detail = await getJson(`${apiUrl}/assets/${created.asset_version.asset_id}`);
  assertEqual(detail.versions.length, 2, "asset timeline should include v1 and v2");

  const verified = await postJson(`${apiUrl}/verify`, {
    version_id: second.asset_version.version_id,
    content_text: "integration report v2"
  });
  assertEqual(verified.verification_result.status, "verified", "matching digest should verify");

  const tampered = await postJson(`${apiUrl}/verify`, {
    version_id: second.asset_version.version_id,
    content_text: "tampered"
  });
  assertEqual(tampered.verification_result.failure_reason, "digest_mismatch", "tampered digest should fail");

  const missingProof = await postJson(`${apiUrl}/verify`, {
    version_id: second.asset_version.version_id,
    scenario: "proof_missing"
  });
  assertEqual(missingProof.verification_result.failure_reason, "proof_missing", "missing proof should stay distinct");

  const chainUnavailable = await postJson(`${apiUrl}/verify`, {
    version_id: second.asset_version.version_id,
    scenario: "chain_unavailable"
  });
  assertEqual(chainUnavailable.verification_result.failure_reason, "chain_unavailable", "chain failure should stay distinct");

  const aiUnavailable = await postJson(`${apiUrl}/verify`, {
    version_id: second.asset_version.version_id,
    scenario: "ai_unavailable"
  });
  assertEqual(
    aiUnavailable.ai_explanation_error.failure_reason,
    "ai_explanation_unavailable",
    "AI outage should not hide verification result"
  );

  console.log("Chronofact integration smoke passed.");
} finally {
  if (apiServer) {
    await new Promise((resolve) => apiServer.close(resolve));
  }
  if (aiProcess) {
    aiProcess.kill();
  }
}

async function waitForHealth(url, label) {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await delay(250);
    }
  }
  throw new Error(`${label} did not become healthy at ${url}`);
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${url} returned ${response.status}: ${text}`);
  }
  return response.json();
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${expected}, received ${actual}`);
  }
}

function assertArrayIncludes(values, expected, message) {
  if (!Array.isArray(values) || !values.includes(expected)) {
    throw new Error(`${message}. Expected ${JSON.stringify(values)} to include ${expected}`);
  }
}
