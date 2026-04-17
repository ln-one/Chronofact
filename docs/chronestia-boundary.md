# Chronestia Boundary

Chronofact is the course project. Chronestia is the private reusable kernel.

## Chronofact Owns

- experiment-asset business semantics
- users, courses, reports, code snapshots, logs, result bundles, and other
  course-facing assets
- original asset storage
- asset version lists, verification pages, and explanation pages
- Ethereum course environment setup
- Remix, Ganache, MetaMask, Faucet, and demo walkthroughs
- UI and presentation-specific shortcuts
- AI explanation and reviewer-facing summary logic

## Chronestia Owns

- generic subjects
- generic facts
- evidence and digest normalization
- anchor provider interfaces
- receipts
- trace and provenance semantics

## Data Translation

Chronofact should translate an asset version into a Chronestia fact instead of
leaking product-specific fields into the kernel.

```text
Chronofact asset version
  asset_id
  asset_type
  workspace_id
  submitter_id
  version_no
  previous_version_id
  sha256

Chronestia fact
  subject.namespace = chronofact
  subject.type = experiment_asset
  subject.id = asset_id
  fact.kind = registered / revised / derived_from / published
  fact.sequence = version_no
  fact.previous_fact_id = previous_fact_id
  evidence.digest_algorithm = sha256
  evidence.digest = asset_digest
```

AI explanation consumes Chronestia outputs after this translation step:

```text
Chronestia fact / registration / receipt / verification
  -> Chronofact AI explanation layer
  -> human-readable summary, risks, and next checks
```

The AI layer must not call itself the proof source. It is only a structured
interpreter of registered evidence.

## Dependency Rule

The dependency direction is:

```text
Chronofact -> Chronestia Docker/API
```

Chronestia must not depend on Chronofact.

## Access Policy

Chronestia remains a private kernel repository.

- the default Chronofact workflow consumes a published Chronestia image
- only the private maintainer should initialize `services/chronestia`
- collaborators must be able to run Chronofact integration flows without seeing Chronestia source code
- Chronofact docs should describe Chronestia's external contract only
