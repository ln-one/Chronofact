# Architecture

## Root Responsibility

Chronofact is the application and integration shell.

The root repository defines:

- product-facing workflow boundaries
- shared environment wiring
- deployment and local development coordination
- service composition rules

The root should not absorb the internals of reusable services.

## Service Boundaries

Chronofact currently composes three reusable engines:

- `Chronestia`
  - owns subject / fact / evidence / receipt / trace semantics
  - does not own product identity or file-ingest workflow
- `Limora`
  - owns authentication, session authority, organizations, and memberships
  - does not own Chronofact product policy
- `Dualweave`
  - owns upload persistence and provider delivery orchestration
  - does not own Chronofact asset meaning or witness semantics

Chronofact itself owns:

- product-facing asset and submission flows
- mapping product actions into witness facts
- digest / version policy at the application layer
- reviewer-facing verification and history views
- environment composition for local development and demos

The current phase-one implementation of that product orchestration lives in
`services/chronofact-api`. It is a demo-scoped API that uses in-memory asset
version records plus mock Limora, Dualweave, Chronestia, and AI clients. It is
not a reusable witness kernel and must not absorb the internals of those
services.

## Dependency Rule

The intended composition direction is:

```text
Chronofact
  -> Limora
  -> Dualweave
  -> Chronestia
```

Meaning:

- identity is resolved through `Limora`
- file intake and persistence are delegated to `Dualweave`
- fact recording and trace history are delegated to `Chronestia`

Chronestia must not depend on Chronofact.
Limora must not depend on Chronofact.
Dualweave must not depend on Chronofact.

Chronofact may adapt their outputs into product-specific screens and workflows.

## Typical Flow

The current target system behavior is:

1. authenticate a user and establish identity context
2. accept an asset or submission
3. persist the uploaded material through the upload engine
4. compute or confirm a stable digest and version link
5. record a fact with evidence in the witness engine
6. return receipt, trace, and product-specific verification state

`services/chronofact-api` demonstrates the same flow with mock clients first, so
frontend, AI, and chain tracks can develop against stable JSON before real
service endpoints are available.

This keeps file truth, identity truth, and witness truth separated while still
forming a coherent application flow.

## Extension Model

- add new reusable services under `services/` only when they represent a real service boundary
- keep root-level logic focused on orchestration and product semantics
- prefer submodules for reusable engines with independent release cadence
- avoid pushing product vocabulary into shared service repositories
