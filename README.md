# Chronofact

Chronofact is an agent-assisted evidence governance system.

It starts from a plain evidence workflow:

```text
file / content -> SHA-256 -> evidence record -> witness receipt -> verification
```

but the product direction is larger than a file-hash-on-chain demo. The useful
problem is not only writing one digest to a chain. The harder problem is helping
people maintain, query, explain, audit, and review a growing evidence space
without losing the proof boundary.

Chronofact therefore separates the system into two layers:

- a trustworthy evidence substrate that owns hashes, versions, receipts, traces,
  permissions, and audit records
- an agent-assisted governance layer that helps users query evidence, explain
  failures, find missing proofs, prepare reports, and decide when human review is
  needed

The proof still comes from structured records and witness receipts. AI is only a
query, explanation, and workflow assistant.

## Core Service Shape

Chronofact composes reusable service boundaries instead of putting every concern
inside one application:

- `Chronestia`: fact witnessing, receipts, subject trace history, and optional
  EVM / Ganache anchoring
- `Limora`: identity, sessions, organizations, memberships, and explicit
  permission grants
- `Dualweave`: upload intake, local persistence, and downstream delivery
- `Noeryn` (planned integration): agent run, step, tool call, memory, and
  checkpoint process truth
- `Stratumind` (planned integration): retrieval, evidence packing, and
  source-grounded search over evidence spaces

Chronofact owns the product-facing evidence workflow. It may shape user tasks
such as "preserve this file", "verify this file", or "find unconfirmed
evidence", but it should not absorb the reusable truth owned by the services
above.

The phase-one Member A backend lives in `services/chronofact-api`. It is an
adapter-driven orchestration API for asset submission, digest calculation,
version linking, upload handoff, witness registration, verification, and AI
explanation handoff. It defaults to demo adapters, and can call the real AI,
Dualweave, and Chronestia HTTP services through environment variables.

## Current Product Direction

The current backend path is deliberately simple and real:

1. A user authenticates through `Limora`.
2. Chronofact forwards the session context and checks organization-scoped
   permissions such as `chronofact.evidence.create`,
   `chronofact.evidence.read`, and `chronofact.evidence.verify`.
3. Chronofact accepts content or a supplied SHA-256 digest.
4. The backend stores an organization-scoped evidence/version record.
5. `Chronestia` registers a fact and returns a receipt.
6. When configured with the EVM provider, Chronestia submits a Solidity contract
   transaction and refreshes the receipt to `confirmed`.
7. Verification recomputes the digest and returns `preserved`,
   `not_preserved`, `mismatch`, `pending`, or `proof_unavailable`.

This keeps the first user-facing promise easy to understand:

```text
Upload a file.
Chronofact computes its SHA-256 digest.
The system records the digest-backed fact.
Later, verification recomputes the digest and compares it with recorded evidence.
```

Versioning is explicit. A changed file becomes a new version only when the user
submits it under an existing `asset_id`; the hash alone does not decide whether
two files belong to the same asset.

## Agent-Assisted Evidence Governance

The next product step is to make Chronofact less like an upload form and more
like an evidence governance workspace.

Target user questions include:

- "Which files in this organization are still pending chain confirmation?"
- "Why did this verification fail?"
- "Which records have missing proof or unavailable chain receipts?"
- "Give me a review summary for this batch of submissions."
- "Show the evidence basis behind this AI explanation."

The intended agent architecture follows this boundary:

```text
Limora       -> who can act
Chronofact   -> evidence, asset, version, and workflow truth
Chronestia   -> witness, receipt, trace, and chain proof truth
Noeryn       -> agent run / step / tool call / memory / checkpoint truth
Stratumind   -> retrieval and evidence-packing truth
AI model     -> language and reasoning backend, not proof authority
```

In this design, Noeryn does not own Chronofact evidence. Chronofact exposes
tools such as `chronofact.list_evidence`, `chronofact.verify_receipt`,
`chronofact.find_digest`, and `chronofact.get_trace`. Noeryn records the
AgentRun, AgentSteps, ToolCalls, Memory entries, and human-review Checkpoints.

This lets the system keep an audit trail of how an AI-assisted answer was
produced, instead of returning an opaque paragraph.

## Blockchain Boundary

Chronofact uses blockchain anchoring as a proof layer, not as a file storage
layer.

- original files are not written on-chain
- large or private teaching materials stay off-chain
- the stable digest and Chronestia fact are witnessed
- EVM receipts and event logs can be queried through the local Ganache RPC during
  coursework demos

The local EVM path is:

```text
Chronofact evidence -> Chronestia fact -> factDigest -> EVM anchor transaction
```

The demo provider currently uses Ganache for a local EVM chain. A successful
anchor can be checked through `eth_getTransactionReceipt`, where the transaction
status, block number, contract address, and event logs prove that the anchor was
actually submitted to the local chain.

## Design Rules

- AI must not claim to prove authenticity.
- Proof comes from SHA-256 digests, evidence records, receipts, traces, and chain
  transaction/event data.
- Limora stays role-free inside the kernel: there are identities, memberships,
  and permission grants, not hard-coded teacher/student/admin roles.
- Chain backends are infrastructure. The product story is evidence governance.
- Frontend surfaces should project simple user states instead of dumping raw
  backend objects.

## Repository Structure

```text
.
├── .github/         # Minimal collaboration templates
├── configs/         # Shared configuration templates and examples
├── contracts/       # Chain / contract-related modules
├── deployments/     # Deployment assets and environment overlays
├── docker/          # Dev container definitions
├── docs/            # Architecture and collaboration notes
├── scripts/         # Small repo-level utility scripts
├── services/        # Independent services and reusable submodules
│   ├── chronestia/  # Witness kernel
│   ├── chronofact-api/ # Chronofact-owned phase-one orchestration API
│   ├── dualweave/   # Upload / delivery engine
│   └── limora/      # Identity authority
├── Makefile         # Common developer entry points
└── compose.yaml     # Local development workspace
```

## Development Principles

- Keep modules low-coupled and service-first
- Keep the root focused on integration, not shared business sprawl
- Prefer explicit HTTP / container boundaries over hidden cross-imports
- Treat chain backends as infrastructure, not the whole product story
- Keep product-specific semantics in Chronofact, reusable semantics in submodules
- Keep AI explanations grounded in structured evidence and receipt state

## Submodule Strategy

`services/` is the integration layer for reusable engines. A service may stay as:

- a checked-in module owned inside this repository, or
- an independent repository attached as a submodule

Current submodules:

- `services/chronestia`
- `services/limora`
- `services/dualweave`

Fresh clone with submodules:

```bash
git clone --recurse-submodules git@github.com:ln-one/Chronofact.git
```

Initialize later if needed:

```bash
git submodule update --init --recursive
```

## Design Docs

- [docs/architecture.md](docs/architecture.md)
- [docs/ai-explanation-layer.md](docs/ai-explanation-layer.md)
- [docs/chronestia-boundary.md](docs/chronestia-boundary.md)
- [docs/course-chain-walkthrough.md](docs/course-chain-walkthrough.md)
- [docs/evidence-workbench-design.md](docs/evidence-workbench-design.md)
- [docs/future-roadmap.md](docs/future-roadmap.md)
- [docs/contributing.md](docs/contributing.md)

## Local Backend Demo

```bash
cd services/chronofact-api
npm test
npm start
```

See `services/chronofact-api/README.md` for endpoint examples, adapter
environment variables, and failure-state scenarios.

## Integrated Check

After dependencies are installed, run the root verification gate:

```bash
npm run check:phase-one
```

It runs:

- Chronofact API tests
- AI explanation tests
- Solidity contract compilation
- frontend production build
- API-to-AI integration smoke test

For the live frontend demo, start the API and then run the frontend with:

```powershell
$env:VITE_CHRONOFACT_API_URL="http://127.0.0.1:3001"
npm --prefix services/frontend-demo run dev
```

## EVM Smoke

Chronestia can run a local EVM smoke against Ganache:

```bash
cd services/chronestia
make smoke-evm
```

The smoke starts Ganache, deploys the minimal anchor contract when allowed,
registers a fact, refreshes the transaction receipt, verifies event inclusion,
and reads the subject trace.
