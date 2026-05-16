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
2. create an experiment or delivery workspace when the demo needs grouping
3. accept an asset submission payload
4. compute a stable SHA-256 digest
5. store the original content off-chain through the Dualweave adapter
6. create an explicit asset version record
7. link new versions to the previous version and previous fact
8. register the version through the Chronestia adapter
9. create a preservation record and audit timeline entry
10. verify the version and produce an AI explanation response

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

### `POST /workspaces`

Creates a course-facing experiment or delivery workspace.

```bash
curl -s http://localhost:3001/workspaces \
  -H "content-type: application/json" \
  -d '{"title":"Experiment 1 Delivery","workspace_type":"experiment","description":"Report and evidence package"}'
```

### `GET /workspaces`

Lists workspaces. Optional filters: `status`, `workspace_type`, `q`,
`created_from`, and `created_to`.

### `GET /workspaces/:workspace_id`

Returns a workspace with its asset list and audit timeline.

### `POST /workspaces/:workspace_id/assets`

Creates the first version of an asset inside a workspace.

```bash
curl -s http://localhost:3001/workspaces/ws_001/assets \
  -H "content-type: application/json" \
  -d '{"asset_title":"Final report","filename":"report.pdf","asset_type":"lab_report","content_text":"first version"}'
```

### `GET /workspaces/:workspace_id/report`

Returns a lightweight Markdown report payload for demo export and答辩.

### `GET /evidence`

Lists preservation records with asset and version context. Optional filters:
`workspace_id`, `asset_id`, `version_id`, `verification_status`,
`failure_reason`, `created_from`, and `created_to`.

```bash
curl -s "http://localhost:3001/evidence?workspace_id=ws_001&verification_status=verified"
```

### `GET /versions/:version_id/evidence`

Returns the evidence bundle for one version, including the asset, asset version,
preservation record, witness record, and audit log.

```bash
curl -s http://localhost:3001/versions/ver_001/evidence
```

### `GET /versions/:version_id/report`

Returns a lightweight Markdown verification report for one version. The report
includes the asset fact, digest, preservation record, current verification
state, AI explanation, and reviewer next checks.

```bash
curl -s http://localhost:3001/versions/ver_001/report
```

### `POST /versions/:version_id/reviews`

Records a manual review decision for a version. This is intentionally separate
from AI explanation and does not change proof data.

```bash
curl -s http://localhost:3001/versions/ver_001/reviews \
  -H "content-type: application/json" \
  -d '{"decision":"needs_revision","summary":"Missing screenshot","notes":"Ask for result evidence.","next_checks":["Upload screenshot"]}'
```

Allowed decisions: `approved`, `needs_revision`, `rejected`, and `pending`.

### `GET /versions/:version_id/reviews`

Lists manual review records for one version.

### `GET /reviews`

Lists manual review records. Optional filters: `workspace_id`, `asset_id`,
`version_id`, `decision`, `reviewer_id`, `created_from`, and `created_to`.

### `POST /workspaces/:workspace_id/status`

Updates a workspace status and writes an audit event.

```bash
curl -s http://localhost:3001/workspaces/ws_001/status \
  -H "content-type: application/json" \
  -d '{"status":"under_review"}'
```

### `GET /audit-log`

Lists audit events. Optional filters: `workspace_id`, `asset_id`, `version_id`,
`action`, `created_from`, and `created_to`.

### `GET /assets`

Lists assets. Optional filters: `workspace_id`, `status`, `asset_type`, `q`,
`verification_status`, `failure_reason`, `created_from`, and `created_to`.
Each asset includes its latest version.

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

### `POST /ai/explain/fact`

Explains a single registered asset version from structured evidence. This
endpoint does not require the original file.

```bash
curl -s http://localhost:3001/ai/explain/fact \
  -H "content-type: application/json" \
  -d '{"version_id":"ver_001"}'
```

### `POST /ai/explain/trace`

Explains an asset version timeline, including previous-version links.

```bash
curl -s http://localhost:3001/ai/explain/trace \
  -H "content-type: application/json" \
  -d '{"asset_id":"asset_001"}'
```

### `POST /ai/explain/risk`

Returns a reviewer-facing risk summary plus AI explanation for a version. It is
an interpretation layer, not a proof source.

```bash
curl -s http://localhost:3001/ai/explain/risk \
  -H "content-type: application/json" \
  -d '{"version_id":"ver_001","scenario":"proof_missing"}'
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

- Workspace flow: `POST /workspaces`, then `POST /workspaces/:id/assets`, then
  `GET /workspaces/:id/report`.
- Retrieval flow: `GET /assets?verification_status=verified`, `GET /evidence`,
  then `GET /versions/:id/evidence`.
- Verification report: `GET /versions/:id/report`.
- Manual review: `POST /versions/:id/reviews`, then `GET /reviews` and
  `GET /audit-log?action=review_record_created`.
- Normal submission: `POST /assets`, then `POST /verify` with the same content.
- Tampered file: `POST /verify` with different content.
- Missing proof: `POST /verify` with `scenario=proof_missing`.
- Chain unavailable: `POST /verify` with `scenario=chain_unavailable`.
- AI unavailable: `POST /verify` with `scenario=ai_unavailable`.
- Multi-version timeline: `POST /assets`, `POST /assets/:asset_id/versions`,
  then `GET /assets/:asset_id`.
- Explicit AI explanation: `POST /ai/explain/fact`,
  `POST /ai/explain/trace`, and `POST /ai/explain/risk`.

AI explanation fields are interpreter output only. The proof source remains the
SHA-256 digest, receipt status, trace status, and verification result.
