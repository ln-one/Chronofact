# Contributing

- Keep the root repository minimal
- Prefer small, reviewable changes
- Avoid adding framework-specific scaffolding to the root unless multiple modules need it
- Place implementation inside the appropriate module directory
- Document new cross-cutting conventions in `docs/` when they affect more than one module
- Treat `services/chronestia` as an optional private maintainer submodule; the default contributor path is to use the published image over Docker/API
