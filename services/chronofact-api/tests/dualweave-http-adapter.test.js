import assert from "node:assert/strict";
import test from "node:test";
import { createDualweaveHttpAdapter } from "../src/adapters/dualweaveHttpAdapter.js";

test("Dualweave HTTP adapter uploads multipart file content with an execution spec", async () => {
  let captured;
  const adapter = createDualweaveHttpAdapter({
    baseUrl: "http://dualweave.example.test/",
    execution: {
      local: { kind: "localfs", config: { base_dir: "./data" } },
      send: { kind: "http_raw", config: { url: "https://provider.example/upload" } },
      workflow: { kind: "none" }
    },
    fetchImpl: async (url, options) => {
      captured = {
        url,
        file: await options.body.get("file").text(),
        filename: options.body.get("file").name,
        execution: JSON.parse(options.body.get("execution"))
      };
      return Response.json({
        upload_id: "dw_upl_001",
        status: "completed",
        content_hash: "abc123",
        content_hash_algorithm: "sha256"
      });
    }
  });

  const result = await adapter.storeUpload({
    uploadId: "upl_001",
    filename: "report.pdf",
    content: Buffer.from("hello"),
    sha256: "abc123"
  });

  assert.equal(captured.url, "http://dualweave.example.test/uploads");
  assert.equal(captured.file, "hello");
  assert.equal(captured.filename, "report.pdf");
  assert.equal(captured.execution.local.kind, "localfs");
  assert.equal(result.upload_id, "dw_upl_001");
  assert.equal(result.requested_upload_id, "upl_001");
  assert.equal(result.storage_ref, "dualweave://dw_upl_001");
  assert.equal(result.status, "stored");
});

test("Dualweave HTTP adapter rejects service-reported hash mismatches", async () => {
  const adapter = createDualweaveHttpAdapter({
    baseUrl: "http://dualweave.example.test",
    execution: { local: { kind: "localfs" }, send: { kind: "http_raw", config: { url: "https://provider.example/upload" } } },
    fetchImpl: async () =>
      Response.json({
        upload_id: "dw_upl_001",
        status: "completed",
        content_hash: "different",
        content_hash_algorithm: "sha256"
      })
  });

  await assert.rejects(
    () =>
      adapter.storeUpload({
        uploadId: "upl_001",
        filename: "report.pdf",
        content: Buffer.from("hello"),
        sha256: "abc123"
      }),
    {
      code: "upload_digest_mismatch"
    }
  );
});

