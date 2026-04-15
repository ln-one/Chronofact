# Chronofact

Lean monorepo root for multi-module, multi-service development.

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

## Extension

- Add a new standalone service under `services/<name>/`
- Promote large modules to independent repositories when needed
- Keep reusable assets in `configs/`, `deployments/`, `scripts/`, and `docs/`
- Use the root only for cross-cutting concerns and integration surfaces
