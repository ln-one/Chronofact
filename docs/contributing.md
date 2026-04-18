# Contributing

- Keep the root repository focused on integration and product semantics
- Do not copy internals out of `Chronestia`, `Limora`, or `Dualweave` into the root
- Prefer small, reviewable changes with clear service boundaries
- Put reusable engine changes in the relevant submodule repository
- Put Chronofact-specific orchestration, adapters, and UI/API work in the root project
- Document any new cross-service contract or environment rule in `docs/`
