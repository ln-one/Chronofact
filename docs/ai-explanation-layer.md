# AI Explanation Layer

Chronofact may add an AI explanation layer above Chronestia.

This layer exists to make registered evidence easier to understand during demo,
review, and答辩. It does not replace hashes, receipts, proofs, or verification.

## Positioning

Correct project story:

- Chronestia and the underlying anchor provider produce trusted registration,
  receipt, trace, and verification data.
- Chronofact presents those outputs in a product workflow.
- AI turns that structured evidence into explanations, summaries, and risk
  prompts for humans.

Incorrect story:

- AI proves truth
- AI replaces verification
- AI decides misconduct
- AI is the trust root

## Allowed AI Responsibilities

AI is allowed to:

- explain a single `fact + registration + receipt + verification`
- summarize an asset trace as a version story
- highlight structured risks based on pending, missing, unsupported, invalid,
  or failed verification states
- suggest next checks for a reviewer or demo operator

AI is not allowed to:

- determine whether business content is objectively true
- generate receipt, digest, or proof material
- redefine a pending or failed verification state as successful
- infer academic misconduct or assign blame

## Recommended API Surface

Chronofact may implement an AI explanation service with these routes:

- `POST /ai/explain/fact`
- `POST /ai/explain/trace`
- `POST /ai/explain/risk`

The AI service should consume only:

- Chronestia `fact`
- Chronestia `registration`
- Chronestia `receipt`
- Chronestia `trace`
- Chronestia `verification`
- small Chronofact metadata such as asset name, asset type, and workspace name

It should not require raw original files to generate explanations.

## Output Shape

Recommended output fields:

- `summary`
- `confidence_note`
- `evidence_basis`
- `verification_status_explained`
- `risks`
- `next_checks`

Recommended guardrail language inside `confidence_note`:

> This explanation summarizes registered evidence and verification state. It
> does not independently prove business truth.

`evidence_basis` should explicitly name:

- fact id
- subject id
- subject type
- receipt provider
- anchor status
- verification status

## Demo Guidance

The AI layer should be demonstrated after the raw evidence view is already on
screen.

Recommended demo sequence:

1. show asset registration
2. show receipt and verification output
3. click an AI explanation action
4. show the AI summary and risk prompts
5. compare the AI wording to the raw structured evidence

The strongest demo line is:

> Blockchain gives us tamper-evident registration and verification surfaces;
> AI makes those surfaces understandable to humans.

## Implementation Rule

Chronofact may implement the AI layer as:

- a small internal module
- a standalone service under `services/`
- or a demo-only adapter

The AI layer must remain outside Chronestia and must never be imported into the
Chronestia kernel.
