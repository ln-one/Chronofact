# Architecture

## Root Responsibility

The root repository defines shared conventions, integration boundaries, and
lightweight operational assets for the blockchain course project.

Chronofact is allowed to contain course-facing application logic, demo scripts,
and blockchain environment setup. It should still keep those concerns in
separate modules instead of accumulating unrelated business logic at the root.

## Product Boundary

Chronofact owns the teaching-file notarization system:

- lab reports, assignments, exams, and other teaching files
- upload and off-chain file storage
- file digest calculation
- file version records and previous-version links
- verification workflows
- course demo UI and scripts
- Ethereum development environment setup required by the course

Chronofact does not own the reusable witness kernel if Chronestia is available.
It should consume Chronestia through Docker/API boundaries.

```text
Chronofact
  teaching file business
  course demo environment
  Ethereum/Ganache/MetaMask/Remix setup
  calls Chronestia API

Chronestia
  Subject / Fact / Evidence / Anchor / Receipt / Trace
  reusable across future projects
```

## Module Boundaries

- `services/` holds independent services or future submodules
- `contracts/` holds contract-facing or chain-facing modules
- `configs/` holds shared configuration templates
- `deployments/` holds deployment-level assets only
- `scripts/` holds small root-level helpers

## Extension Model

- Start small modules inside this repository
- Extract to separate repositories when ownership or release cadence diverges
- Reattach extracted modules as submodules if the root still needs a stable integration point
- Keep shared standards in the root, keep implementation details inside modules

## First Implementation Direction

The initial course implementation should prefer the Ethereum option:

- Remix for simple contract inspection and classroom demonstration
- Ganache as the local chain
- MetaMask for account connection and transaction visibility
- a minimal Solidity anchoring contract for file-version digests or batch roots

The contract and demo environment may start in Chronofact. If the anchoring
contract becomes generic and reusable, a clean version can later be promoted to
Chronestia.

## Integration Rule

Chronofact translates teaching-file versions into generic witness facts. It
should not copy Chronestia's internal model or bypass the Chronestia API once
that service exists.

## Private Source Access

Chronestia source access is maintainer-only.

- the default Chronofact integration mode uses a published Chronestia image
- normal collaborators should not need the `services/chronestia` source tree
- maintainer machines may initialize the private submodule and build Chronestia locally
- Chronofact should document the Docker/API contract, not private kernel implementation details
