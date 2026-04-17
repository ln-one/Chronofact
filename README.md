# Chronofact

Chronofact is the blockchain course project shell for trustworthy experiment
assets, delivery records, and versioned evidence chains.

It should not be pitched as a narrow teaching-file upload tool. Reports,
assignments, code snapshots, result screenshots, logs, release bundles, and
other experiment artifacts are all valid inputs to the same evidence workflow.

The system uses an on-chain/off-chain split: original files and business data
stay off-chain, while digests, issuer references, registration time, version
links, receipt data, and verification state are anchored or recorded through a
blockchain-facing environment.

Chronofact may integrate Chronestia as a private reusable witness kernel.
Chronofact owns the course-facing application and demo workflow. Chronestia owns
the clean generic fact witnessing model.

## Project Goal

The minimum product flow is:

1. A user registers an experiment asset or delivery artifact.
2. Chronofact stores the original asset off-chain.
3. Chronofact computes a stable digest.
4. Chronofact creates a new asset-version record.
5. Chronofact records or anchors the corresponding fact through Chronestia or a
   demo-scoped chain adapter.
6. Later verification recomputes the digest and compares it with the recorded
   proof and receipt.
7. A version chain shows how later submissions, revisions, and derived outputs
   relate to previous versions.

## AI Layer

Chronofact may add an AI explanation layer on top of Chronestia. The AI layer
does not replace hashes, receipts, proofs, or verification. Its only job is to
turn structured evidence into reviewer-facing explanations:

- explain a receipt in human language
- summarize an asset history trace
- highlight structured risks and next checks

This keeps the project's “AI + blockchain” story honest:

- blockchain and Chronestia provide the trust surface
- AI provides explanation, navigation, and risk narration

The AI layer must remain outside Chronestia's witness kernel.

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
- Keep course demo, experiment-asset business, and blockchain environment setup
  in Chronofact.
- Keep reusable fact witnessing semantics behind the Chronestia API boundary.
- Do not duplicate Chronestia internals in Chronofact.
- Do not present AI as a trust root or automatic judge.

## Extension

- Add a new standalone service under `services/<name>/`
- Promote large modules to independent repositories when needed
- Keep reusable assets in `configs/`, `deployments/`, `scripts/`, and `docs/`
- Use the root only for cross-cutting concerns and integration surfaces

## Chronestia Access Modes

Chronestia stays private. Chronofact should support two access modes in the same
repository:

- default/team mode: pull a published Chronestia image and call it over Docker/API
- maintainer mode: initialize the private `services/chronestia` submodule and
  switch that service to a local source build automatically

`services/chronestia` is already attached to this repository as a Git submodule.
That means the root repo keeps a stable pointer to the current Chronestia commit
without exposing the private implementation to collaborators who do not have
access.

Collaborators should not need private kernel source access to develop or demo
Chronofact.

Team mode:

```bash
python3 ./scripts/compose_smart.py up -d chronestia
```

Maintainer mode:

```bash
make chronestia-source
python3 ./scripts/compose_smart.py up -d chronestia
```

Fresh clone with private access:

```bash
git clone --recurse-submodules git@github.com:ln-one/Chronofact.git
```

Check the active mode with:

```bash
python3 ./scripts/compose_smart.py status
```

If you publish a different tag, override `CHRONESTIA_IMAGE` before starting the
service.

## Design Docs

- [docs/architecture.md](/Users/ln1/Projects/BlockChain-spec/Chronofact/docs/architecture.md)
- [docs/chronestia-boundary.md](/Users/ln1/Projects/BlockChain-spec/Chronofact/docs/chronestia-boundary.md)
- [docs/ai-explanation-layer.md](/Users/ln1/Projects/BlockChain-spec/Chronofact/docs/ai-explanation-layer.md)
