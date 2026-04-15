# Chronestia Boundary

Chronofact is the course project. Chronestia is the private reusable kernel.

## Chronofact Owns

- teaching-file business semantics
- users, courses, assignments, reports, exams, and submissions
- original file storage
- file version lists and verification pages
- Ethereum course environment setup
- Remix, Ganache, MetaMask, Faucet, and demo walkthroughs
- UI and presentation-specific shortcuts

## Chronestia Owns

- generic subjects
- generic facts
- evidence and digest normalization
- anchor provider interfaces
- receipts
- trace and provenance semantics

## Data Translation

Chronofact should translate a file version into a Chronestia fact instead of
leaking teaching-file fields into the kernel.

```text
Chronofact file version
  file_id
  file_type
  course_id
  submitter_id
  version_no
  previous_version_id
  sha256

Chronestia fact
  subject.namespace = chronofact
  subject.type = teaching_file
  subject.id = file_id
  fact.kind = version_submitted
  fact.sequence = version_no
  fact.previous_fact_id = previous_fact_id
  evidence.digest_algorithm = sha256
  evidence.digest = file_digest
```

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
