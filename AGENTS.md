# Chronofact Agent Guide

> Repository contract for AI coding agents and contributors working on
> Chronofact. Chronofact is the blockchain course project shell for
> teaching-file notarization and version tracking.

## 1. Purpose

Chronofact exists to satisfy the blockchain course project while keeping the
reusable witness kernel outside this repository.

It owns:

- teaching-file upload and storage
- lab report, assignment, exam, and submission workflows
- file digest calculation and verification UI
- file version tracking and previous-version links
- Ethereum course environment setup
- Remix, Faucet, Ganache, and MetaMask walkthroughs
- demo scripts, presentation flow, and course-facing product surfaces

It does **not** own:

- Chronestia's reusable witness kernel
- general-purpose fact, receipt, and trace semantics
- Spectra/Ourograph formal-state semantics
- long-term blockchain abstraction across all future projects

Chronofact may be messy where the course/demo requires it. That mess must not
leak into Chronestia.

## 2. Read First

Before meaningful changes, read:

1. [README.md](/Users/ln1/Projects/Chronofact/README.md)
2. [docs/architecture.md](/Users/ln1/Projects/Chronofact/docs/architecture.md)
3. [docs/chronestia-boundary.md](/Users/ln1/Projects/Chronofact/docs/chronestia-boundary.md)
4. [docs/contributing.md](/Users/ln1/Projects/Chronofact/docs/contributing.md)
5. live code and tests once implementation exists

For the private reusable kernel context, read:

1. `/Users/ln1/Projects/Chronestia/AGENTS.md`
2. `/Users/ln1/Projects/Chronestia/README.md`
3. `/Users/ln1/Projects/Chronestia/docs/architecture.md`
4. `/Users/ln1/Projects/Chronestia/docs/integrations.md`

Trust order:

1. tested live code
2. current Chronofact docs and course requirements
3. Chronestia public API/contract docs
4. runtime behavior
5. historical planning notes

## 3. Core Product Flow

The minimum course flow is:

1. user uploads an electronic teaching file
2. Chronofact stores the original file off-chain
3. Chronofact computes a stable digest, initially SHA-256
4. Chronofact creates a file version record
5. Chronofact writes or anchors digest, submitter, time, version, and previous
   version linkage through the selected chain environment
6. later verification recomputes the digest and compares it with the recorded
   proof
7. the UI shows version history and tamper-detection results

The system should demonstrate on-chain/off-chain separation:

- chain: digest, submitter identity or reference, timestamp, version number,
  previous-version link, transaction/proof data
- off-chain: original file, business metadata, UI state, user/course data

## 4. Course Chain Environment

The first implementation should target the Ethereum option required by the
course:

- Remix
- Faucet or local funded test accounts
- Ganache
- MetaMask

This is the course/demo layer. It may live in:

- `contracts/`
- `deployments/`
- `configs/`
- `scripts/`
- course setup docs under `docs/`

FISCO BCOS and Hyperledger Fabric are possible future directions, but do not
design the first implementation around all three environments at once.

## 5. Chronestia Boundary

Chronofact should call Chronestia through Docker/API when the kernel exists.

Allowed in Chronofact:

- mapping teaching-file versions to generic Chronestia facts
- storing Chronestia fact IDs and receipt IDs
- showing anchor and verification status returned by Chronestia
- local demo adapters when Chronestia is unavailable during course work, as long
  as they are visibly demo-scoped

Forbidden in Chronofact:

- copying Chronestia internal packages
- redefining `Subject / Fact / Evidence / Anchor / Receipt / Trace` as a second
  core
- importing private Chronestia source code
- making Chronofact the source of reusable witness semantics

Dependency direction:

```text
Chronofact -> Chronestia Docker/API
```

## 6. Repository Structure

Use the root as a coordination shell.

Preferred placement:

- `services/`: application services
- `contracts/`: Solidity or chain-facing contracts
- `deployments/`: local chain deployment assets
- `configs/`: shared config examples
- `scripts/`: small repo-level helper scripts
- `docs/`: course setup, architecture, and demo instructions
- `docker/`: development container assets

Do not dump business logic into the root.

## 7. Implementation Rules

- Keep the course-facing implementation simple and demonstrable.
- Prefer explicit file-version records over clever generic abstractions.
- Keep blockchain calls behind a small service or adapter boundary.
- Do not put original files on-chain.
- Do not commit private keys, mnemonic phrases, real wallet secrets, or personal
  test accounts.
- Demo accounts and local Ganache seeds must be clearly marked as local-only.
- Do not silently treat a failed chain write as a successful notarization.
- Verification must distinguish digest mismatch from missing proof or chain
  access failure.

## 8. Contract Rules

The first Solidity contract should be minimal.

It may record:

- file or fact digest
- version number
- submitter reference
- previous version or previous fact reference
- timestamp or block-derived time
- event logs for UI/demo inspection

It should not store:

- full files
- sensitive business payloads
- large metadata blobs
- private user information

If a contract becomes generic enough to serve future projects, consider
promoting a clean version into Chronestia later.

## 9. Coding Discipline

- Keep code and repository-facing docs in English by default.
- Chinese is acceptable for course-facing explanation docs if the audience needs
  it.
- Prefer small explicit modules over broad utility packages.
- Name modules by responsibility, not by vague labels such as `misc` or `common`.
- Keep demo shortcuts documented and isolated.
- Do not make course shortcuts look like long-term architecture.

## 10. Validation

For early skeleton work:

1. check repository status
2. run lightweight formatting or linting once tools exist
3. validate docs and setup commands manually

For implementation work:

1. test digest calculation and version linking
2. test upload and off-chain storage
3. test verification success and tamper failure
4. test Ganache contract deployment
5. test MetaMask/Remix demo path where relevant
6. test Chronestia API integration if enabled

Avoid broad, slow suites unless the change crosses service boundaries.

## 11. Documentation Rules

Update docs when a stable project decision changes.

Use:

- `README.md` for project purpose and course flow
- `docs/architecture.md` for module boundaries and environment choice
- `docs/chronestia-boundary.md` for the Chronestia integration contract
- `AGENTS.md` for agent/contributor rules

Keep course-specific instructions in Chronofact, not Chronestia.
