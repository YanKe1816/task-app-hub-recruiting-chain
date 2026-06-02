# Task App Workers Hub

Cloudflare Workers TypeScript hub for independent Task Apps. The first app is Candidate Time Extractor.

## Project Structure

```text
task-app-workers-hub/
  AGENTS.md
  README.md
  package.json
  wrangler.jsonc
  tsconfig.json
  candidate_time_extractor_index.html
  candidate_time_extractor_privacy.html
  candidate_time_extractor_terms.html
  candidate_time_extractor_support.html
  src/
    html.d.ts
    index.ts
```

## Local Setup

```bash
npm install
npm run typecheck
npm run dev
```

Wrangler prints the local URL, usually `http://127.0.0.1:8787`.

## Environment Variables

Set `OPENAI_APPS_CHALLENGE` for deployed environments:

```bash
wrangler secret put OPENAI_APPS_CHALLENGE
```

Local development uses the safe fallback value from `wrangler.jsonc` when the variable is not configured.

## Deploy

```bash
npm run deploy
```

## Online Verification URL Checklist

After deployment, replace `<worker-url>` with the deployed Worker URL:

- `<worker-url>/health`
- `<worker-url>/.well-known/openai-apps-challenge`
- `<worker-url>/candidate-time-extractor`
- `<worker-url>/candidate-time-extractor/privacy`
- `<worker-url>/candidate-time-extractor/terms`
- `<worker-url>/candidate-time-extractor/support`
- POST `<worker-url>/candidate-time-extractor/mcp` with `initialize`
- POST `<worker-url>/candidate-time-extractor/mcp` with `tools/list`
- POST `<worker-url>/candidate-time-extractor/mcp` with `tools/call`

## Common Failure Handling

- If `npm install` fails, confirm network access and retry.
- If `npm run typecheck` fails, fix TypeScript errors before running or deploying.
- If `/health` does not return `ok`, confirm the Worker is running and the route is not shadowed.
- If the challenge route returns the local fallback in production, configure `OPENAI_APPS_CHALLENGE`.
- If MCP calls fail, confirm the request is JSON-RPC 2.0 and targets `/candidate-time-extractor/mcp`.
- Deployment refresh: 2026-06-02
