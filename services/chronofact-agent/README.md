# Chronofact Agent

Thin conversation backend for the Chronofact Agent Notary MVP.

It does not own evidence truth. It keeps conversation context, uploaded-file
metadata, tool-call records, and proof snapshots, then calls
`services/chronofact-api` for preserve, verify, and explanation work.

## Run

```bash
npm install
npm --prefix services/chronofact-api start
CHRONOFACT_API_URL=http://127.0.0.1:3001 npm --prefix services/chronofact-agent start
```

Default agent URL:

```text
http://127.0.0.1:3002
```

## Endpoints

- `GET /health`
- `POST /agent/files`
- `POST /agent/chat`
- `GET /agent/conversations`
- `GET /agent/conversations/:conversation_id`

`POST /agent/files` accepts `filename`, `content_base64`, and optional
`conversation_id` / `mime_type`. The agent computes SHA-256 locally and stores
the file only under `.cache/chronofact-agent/uploads` for demo context.

`POST /agent/chat` routes simple Chinese/English preserve and verify intents to
Mastra tool definitions backed by Chronofact API calls. Preserve requires
`confirmed_action: true`; without it, the agent only asks for confirmation.

## Model Configuration

The service loads `.env.local` from the repo root or `services/chronofact-agent`.
It accepts Chronofact-specific variables first, then falls back to common
OpenAI-compatible variables:

```text
CHRONOFACT_AGENT_LLM_BASE_URL
CHRONOFACT_AGENT_LLM_API_KEY
CHRONOFACT_AGENT_LLM_MODEL
LLM_BASE_URL
LLM_API_KEY
LLM_MODEL
NOERYN_INFERENCE_API_BASE
NOERYN_INFERENCE_MODEL
NOERYN_INFERENCE_API_KEY_ENV
```

When a model is configured, the agent uses it only to polish short user-facing
replies. Tool routing and proof state remain deterministic.

## Check

```bash
npm --prefix services/chronofact-agent test
npm --prefix services/chronofact-agent run build
```
