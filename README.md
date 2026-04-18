# Chronofact

Chronofact is the application shell for trustworthy asset intake, identity-aware
submission, and verifiable fact history.

It is not just a thin blockchain demo and it is not only a file upload page.
The root repository exists to integrate business-facing workflows with reusable
core services.

## Core Service Shape

Chronofact now centers around three reusable service boundaries:

- `Chronestia`: fact witnessing, receipts, and subject trace history
- `Limora`: identity, sessions, organizations, and memberships
- `Dualweave`: upload intake, local persistence, and downstream delivery

Chronofact owns the product-facing workflow that composes those services into a
coherent application.

## Current Product Direction

The minimum product flow is:

1. A user authenticates through `Limora`.
2. Chronofact accepts an asset or submission request.
3. `Dualweave` handles file intake and local-truth-first persistence.
4. Chronofact computes or confirms the stable digest and version linkage.
5. `Chronestia` records the corresponding fact and returns a receipt / traceable history.
6. Chronofact presents verification, history, and reviewer-facing status to the user.

This lets the product support reports, assignments, code bundles, screenshots,
result artifacts, and future evidence-backed assets without coupling the core
services to one narrow ontology.

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
│   ├── dualweave/   # Upload / delivery engine
│   └── limora/      # Identity authority
├── Makefile         # Common developer entry points
└── compose.yaml     # Local development workspace
```

## Development Principles

- Keep modules low-coupled and service-first
- Keep the root focused on integration, not shared business sprawl
- Prefer explicit HTTP / container boundaries over hidden cross-imports
- Treat chain backends as infrastructure, not the main product story
- Keep product-specific semantics in Chronofact, reusable semantics in submodules

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

- [docs/architecture.md](/Users/ln1/Projects/BlockChain-spec/Chronofact/docs/architecture.md)
- [docs/contributing.md](/Users/ln1/Projects/BlockChain-spec/Chronofact/docs/contributing.md)
