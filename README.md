# Chronofact

Chronofact is the blockchain course project shell for teaching-file notarization
and version tracking.

It focuses on electronic teaching files such as lab reports, assignments, and
exams. The system uses an on-chain/off-chain split: original files and business
data stay off-chain, while file digests, submitter identity, submitted time,
version numbers, and previous-version links are anchored through a blockchain
environment.

Chronofact may integrate Chronestia as a private reusable witness kernel.
Chronofact owns the course-facing application and demo workflow. Chronestia owns
the clean generic fact witnessing model.

## Project Goal

The minimum product flow is:

1. A user uploads a teaching file.
2. Chronofact stores the original file off-chain.
3. Chronofact computes a stable file digest.
4. Chronofact creates a new file version record.
5. Chronofact records or anchors the corresponding fact through Chronestia or a
   local chain adapter.
6. Later verification recomputes the file digest and compares it with the
   recorded proof.
7. A version chain shows how later submissions relate to previous versions.

## Course Blockchain Environment

The first environment target is the Ethereum development stack required by the
course:

- Remix
- Faucet or local test account funding
- Ganache
- MetaMask

This environment belongs in Chronofact because it is part of the course demo and
delivery surface. It should not leak into the Chronestia core model.

## Structure

```text
.
├── .github/         # Minimal collaboration templates
├── configs/         # Shared configuration templates and examples
├── contracts/       # Chain / contract-related modules
├── deployments/     # Deployment assets and environment overlays
├── docker/          # Dev container definitions
├── docs/            # Architecture and collaboration notes
├── scripts/         # Small repo-level utility scripts
├── services/        # Independent services or future submodules
├── Makefile         # Common developer entry points
└── compose.yaml     # Local development workspace
```

## Principles

- Modular by default
- Low coupling between modules
- Root owns shared conventions, not business logic
- Services can live directly under `services/` or be attached later as submodules
- Keep course demo, teaching-file business, and blockchain environment setup in
  Chronofact.
- Keep reusable fact witnessing semantics behind the Chronestia API boundary.
- Do not duplicate Chronestia internals in Chronofact.

## Extension

- Add a new standalone service under `services/<name>/`
- Promote large modules to independent repositories when needed
- Keep reusable assets in `configs/`, `deployments/`, `scripts/`, and `docs/`
- Use the root only for cross-cutting concerns and integration surfaces
