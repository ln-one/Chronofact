# Chronofact Frontend Notes

This document is the current frontend handoff note for Chronofact.

## Active Frontend

The active frontend is:

```text
services/frontend
```

New agent-workspace development should happen in this project. It is the formal
frontend surface for the current Chronofact direction: an agent-assisted
evidence governance workspace where users primarily interact through
conversation, intent recognition, evidence tools, and project-file preservation
panels.

The old demo frontend is:

```text
services/frontend-demo
```

`services/frontend-demo` is legacy reference code. Do not add new agent
workspace features there unless the team explicitly decides to backport or use
it as visual reference.

## Current Product Direction

The frontend should present Chronofact as an AI-assisted evidence governance
system, not only as a file-hash upload page.

The proof boundary must stay clear:

- SHA-256 digests, structured evidence records, receipts, traces, and chain
  records are the proof sources.
- The agent helps users query, explain, compare, summarize, and orchestrate
  evidence work.
- AI-generated text must not be shown as the source of authenticity.

## Main Workspace Areas

The current agent workspace is organized around:

- conversation list in the left sidebar
- central agent chat surface
- composer `+` menu for files, intent mode, review mode, and agent tools
- collapsible right-side evidence module for project-file preservation

Agent tools are intentionally shown as a collapsible selection inside the
composer menu instead of a permanent left-sidebar section. The expected primary
workflow is user typing first, then the agent identifying intent and choosing
the right evidence operation.

## Local Development

Install and run from the active frontend:

```powershell
cd services/frontend
npm install
npm run dev
```

If the Chronofact API is running locally, point the frontend to it:

```powershell
$env:VITE_CHRONOFACT_API_URL="http://127.0.0.1:3001"
npm run dev
```

For a lightweight type check:

```powershell
npx tsc -b --pretty false
```

## Related Planning

The agent workspace planning note lives at:

```text
docs/frontend/agent-workspace-plan.md
```

Use it for product and UI planning context. Use this README as the quick
orientation note for where frontend work should happen.
