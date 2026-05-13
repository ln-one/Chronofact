# Chronofact API

Phase-one backend orchestration service for Member A.

This service is intentionally root-owned Chronofact product code. It composes
Limora, Dualweave, Chronestia, and the AI explanation layer through explicit
adapter interfaces without importing their internal packages.

By default, the service uses demo adapters so the frontend and course demo can
run without all dependent services. Set the HTTP adapter environment variables
below to call real services.

## Scope

Implemented phase-one flow:

1. resolve identity through the fixed demo Limora identity adapter
2. accept an asset submission payload
3. compute a stable SHA-256 digest
4. store the original content off-chain through the Dualweave adapter
5. create an explicit asset version record
6. link new versions to the previous version and previous fact
7. register the version through the Chronestia adapter
8. verify the version and produce an AI explanation response

The demo Dualweave adapter keeps original files under `.cache/chronofact/uploads`
at runtime. Those files are local demo artifacts and are not committed.

## Run

```bash
cd services/chronofact-api
npm test
npm start
```

The default URL is:

```text
http://localhost:3001
```

Use a different port:

```bash
PORT=3010 npm start
```

## Adapter Configuration

Default behavior uses local demo adapters. The adapter contracts are:

- Limora: `resolveIdentity`
- Dualweave: `storeUpload`
- Chronestia: `registerVersion`, `verifyVersion`
- AI: `explain`

Environment variables:

| Variable | Effect |
| --- | --- |
| `CHRONOFACT_AI_URL` | Calls the real AI explanation HTTP service at `POST /api/ai/explain`. |
| `CHRONOFACT_CHRONESTIA_URL` | Calls the real Chronestia HTTP or Docker-exposed API at `POST /facts` and `POST /facts/{fact_id}/verify`. |
| `CHRONOFACT_DUALWEAVE_URL` | Calls the real Dualweave upload service at `POST /uploads`. |
| `CHRONOFACT_DUALWEAVE_EXECUTION_JSON` | Inline Dualweave execution spec sent with each upload. Required when `CHRONOFACT_DUALWEAVE_URL` is set unless a file is configured. |
| `CHRONOFACT_DUALWEAVE_EXECUTION_FILE` | Path to a Dualweave execution spec JSON file. |
| `CHRONOFACT_HTTP_TIMEOUT_MS` | Shared adapter timeout override. |
| `CHRONOFACT_AI_TIMEOUT_MS` | AI adapter timeout override. |
| `CHRONOFACT_CHRONESTIA_TIMEOUT_MS` | Chronestia adapter timeout override. |
| `CHRONOFACT_DUALWEAVE_TIMEOUT_MS` | Dualweave adapter timeout override. |

Example with real AI and Docker-exposed Chronestia:

```powershell
$env:CHRONOFACT_AI_URL="http://127.0.0.1:8000"
$env:CHRONOFACT_CHRONESTIA_URL="http://127.0.0.1:8080"
npm start
```

Example Dualweave execution file:

```json
{
  "local": {
    "kind": "localfs",
    "config": {
      "base_dir": "./data"
    }
  },
  "send": {
    "kind": "http_raw",
    "config": {
      "url": "https://provider.example.invalid/upload",
      "label": "chronofact-upload"
    }
  },
  "workflow": {
    "kind": "none"
  }
}
```

Run with Dualweave:

```powershell
$env:CHRONOFACT_DUALWEAVE_URL="http://127.0.0.1:8081"
$env:CHRONOFACT_DUALWEAVE_EXECUTION_FILE="configs\dualweave.execution.json"
npm start
```

Limora is intentionally still a fixed demo identity adapter in this phase. Swap
it after the upload and witness adapters are stable.

## Endpoints

### `GET /health`

Returns service health.

### `GET /mock-contract`

Returns the unified first-phase mock object used by all tracks.

### `POST /assets`

Creates a new asset and its first version.

```bash
curl -s http://localhost:3001/assets \
  -H "content-type: application/json" \
  -d '{"filename":"report.pdf","asset_type":"lab_report","content_text":"first version"}'
```

### `POST /assets/:asset_id/versions`

Creates the next version for an existing asset and links it to the previous
version.

```bash
curl -s http://localhost:3001/assets/asset_001/versions \
  -H "content-type: application/json" \
  -d '{"filename":"report-v2.pdf","content_text":"second version"}'
```

### `GET /assets/:asset_id`

Returns the asset detail with its version timeline.

### `POST /verify`

Verifies the latest asset version or a specific version.

```bash
curl -s http://localhost:3001/verify \
  -H "content-type: application/json" \
  -d '{"version_id":"ver_001","content_text":"first version"}'
```

## Failure Scenarios

Each scenario can be passed as a query string or JSON field named `scenario`.

| Scenario | API stage | Status / error |
| --- | --- | --- |
| `upload_failed` | submission | HTTP error `upload_failed` |
| `proof_missing` | verification | `pending`, failure reason `proof_missing` |
| `chain_unavailable` | verification | `unsupported`, failure reason `chain_unavailable` |
| `ai_unavailable` | explanation | `ai_explanation_error.failure_reason = ai_explanation_unavailable` |

Digest mismatch is triggered by verifying with content different from the
recorded version content:

```bash
curl -s http://localhost:3001/verify \
  -H "content-type: application/json" \
  -d '{"version_id":"ver_001","content_text":"tampered file"}'
```

The result is `failed` with `failure_reason = digest_mismatch`.

## Demo Checklist

- Normal submission: `POST /assets`, then `POST /verify` with the same content.
- Tampered file: `POST /verify` with different content.
- Missing proof: `POST /verify` with `scenario=proof_missing`.
- Chain unavailable: `POST /verify` with `scenario=chain_unavailable`.
- AI unavailable: `POST /verify` with `scenario=ai_unavailable`.
- Multi-version timeline: `POST /assets`, `POST /assets/:asset_id/versions`,
  then `GET /assets/:asset_id`.

AI explanation fields are interpreter output only. The proof source remains the
SHA-256 digest, receipt status, trace status, and verification result.
