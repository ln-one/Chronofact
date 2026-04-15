# Architecture

## Root Responsibility

The root repository defines shared conventions, integration boundaries, and lightweight operational assets.

It should not accumulate unrelated business logic.

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
