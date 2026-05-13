# Chronofact API

Phase-one backend orchestration service for Member A.

This service is intentionally root-owned Chronofact product code. It composes
mock clients for Limora, Dualweave, Chronestia, and the AI explanation layer
without importing their internal packages.

## Scope

Implemented phase-one flow:

1. resolve identity through the Limora mock client
2. accept an asset submission payload
3. compute a stable SHA-256 digest
4. store the original content off-chain through the Dualweave mock client
5. create an explicit asset version record
6. link new versions to the previous version and previous fact
7. register the version through the Chronestia mock client
8. verify the version and produce an AI explanation mock response

The service keeps original files under `.cache/chronofact/uploads` at runtime.
Those files are local demo artifacts and are not committed.

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
