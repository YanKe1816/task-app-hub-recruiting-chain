# Task App Hub Construction Rules

This repository is a shared Task App Hub for independent recruiting workflow task apps.

## Global Task App Standard

- Each app must perform one real, deterministic, stateless, read-only workflow task.
- Each app must expose its own MCP endpoint under its app slug. Do not create a generic shared `/mcp` endpoint.
- Each app MCP endpoint must expose only the tool or tools that belong to that app. For this first app, Candidate Time Extractor, expose exactly one tool: `candidate_time_extractor`.
- Tool outputs must use the shared baseline structure: `status`, task-specific fields, `missing_fields`, `source_text`, and `errors`.
- Error objects must include `code` and `message`.
- Prefer shared error codes when applicable: `missing_required_input`, `invalid_input_type`, `empty_input`, `out_of_scope`, `internal_error`.
- Review pages must use formal HTML pages with consistent top navigation: `Home | Privacy | Terms | Support`.
- Apps must not use external APIs, authentication, persistent state, destructive actions, or side effects unless a future standard explicitly allows it.

## Recruiting Workflow Task Apps Standard

- Recruiting tools may extract or normalize user-provided recruiting workflow information.
- Recruiting tools must not judge candidate quality, rank candidates, make hiring decisions, contact candidates, schedule interviews, update ATS systems, or modify external systems.
- Outputs should be concise structured data, not open-ended recruiting advice.
- Preserve the original user-provided source text in `source_text`.
- Use deterministic extraction rules and avoid aggressive inference.
