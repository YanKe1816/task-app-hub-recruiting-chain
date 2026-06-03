# Task App Workers Hub

Cloudflare Workers TypeScript hub for independent Task Apps. Current apps are Candidate Time Extractor and Resume Contact Extractor.

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
  resume_contact_extractor_index.html
  resume_contact_extractor_privacy.html
  resume_contact_extractor_terms.html
  resume_contact_extractor_support.html
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

Set `OPENAI_APPS_CHALLENGE` for deployed environments. The route `/.well-known/openai-apps-challenge` returns the exact environment variable value as plain text.

```bash
wrangler secret put OPENAI_APPS_CHALLENGE
```

For local verification, set the variable before starting Wrangler if you need a non-empty challenge response.

## Deploy

```bash
npm run deploy
```

## Online Verification URL Checklist

After deployment, replace `<worker-url>` with the deployed Worker URL:

- `<worker-url>/health`
- `<worker-url>/.well-known/openai-apps-challenge`
- `<worker-url>/`
- `<worker-url>/candidate-time-extractor`
- `<worker-url>/candidate-time-extractor/privacy`
- `<worker-url>/candidate-time-extractor/terms`
- `<worker-url>/candidate-time-extractor/support`
- POST `<worker-url>/candidate-time-extractor/mcp` with `initialize`
- POST `<worker-url>/candidate-time-extractor/mcp` with `tools/list`
- POST `<worker-url>/candidate-time-extractor/mcp` with `tools/call`
- `<worker-url>/resume-contact-extractor`
- `<worker-url>/resume-contact-extractor/privacy`
- `<worker-url>/resume-contact-extractor/terms`
- `<worker-url>/resume-contact-extractor/support`
- POST `<worker-url>/resume-contact-extractor/mcp` with `initialize`
- POST `<worker-url>/resume-contact-extractor/mcp` with `tools/list`
- POST `<worker-url>/resume-contact-extractor/mcp` with `tools/call`
- Confirm `/mcp` returns not found and no generic shared MCP endpoint is exposed.

## Common Failure Handling

- If `npm install` fails, confirm network access and retry.
- If `npm run typecheck` fails, fix TypeScript errors before running or deploying.
- If `/health` does not return `ok`, confirm the Worker is running and the route is not shadowed.
- If the challenge route is empty in production, configure `OPENAI_APPS_CHALLENGE`.
- If MCP calls fail, confirm the request is JSON-RPC 2.0 and targets the app-specific endpoint, such as `/candidate-time-extractor/mcp` or `/resume-contact-extractor/mcp`.
- If a review page is missing, confirm the related HTML file is present at the project root and imported by `src/index.ts`.
- If `tools/list` shows the wrong tool count, confirm each app route calls only its own MCP contract.
