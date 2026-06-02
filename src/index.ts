import indexHtml from "../candidate_time_extractor_index.html";
import privacyHtml from "../candidate_time_extractor_privacy.html";
import termsHtml from "../candidate_time_extractor_terms.html";
import supportHtml from "../candidate_time_extractor_support.html";

type Env = {
  OPENAI_APPS_CHALLENGE?: string;
};

type ErrorCode =
  | "missing_required_input"
  | "invalid_input_type"
  | "empty_input"
  | "out_of_scope"
  | "internal_error";

type ToolError = {
  code: ErrorCode;
  message: string;
};

type CandidateAvailabilityOutput = {
  status: "success" | "error";
  available_times: string[];
  timezone: string | null;
  contact_details: {
    email: string | null;
    phone: string | null;
  };
  notes: string | null;
  missing_fields: string[];
  source_text: string;
  errors: ToolError[];
};

const APP_SLUG = "candidate-time-extractor";
const TOOL_NAME = "candidate_time_extractor";
const TOOL_TITLE = "Candidate Time Extractor";
const SERVER_VERSION = "0.1.0";
const LOCAL_CHALLENGE_FALLBACK = "local-openai-apps-challenge";

const TOOL_DESCRIPTION =
  "Use this tool when the user provides a candidate message and needs structured interview availability details. The tool returns available interview times, timezone, contact details, notes, missing fields, source text, and errors. Do not use this tool to schedule interviews, send invitations, contact candidates, update ATS systems, judge candidate quality, rank candidates, or make hiring decisions. This tool is useful when deterministic structured extraction is needed for a recruiting task workflow.";

const INPUT_SCHEMA = {
  type: "object",
  properties: {
    text: {
      type: "string",
      description: "Raw candidate message provided by the user.",
    },
  },
  required: ["text"],
  additionalProperties: false,
} as const;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["success", "error"],
    },
    available_times: {
      type: "array",
      items: {
        type: "string",
      },
    },
    timezone: {
      type: ["string", "null"],
    },
    contact_details: {
      type: "object",
      properties: {
        email: {
          type: ["string", "null"],
        },
        phone: {
          type: ["string", "null"],
        },
      },
      required: ["email", "phone"],
      additionalProperties: false,
    },
    notes: {
      type: ["string", "null"],
    },
    missing_fields: {
      type: "array",
      items: {
        type: "string",
      },
    },
    source_text: {
      type: "string",
    },
    errors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: {
            type: "string",
          },
          message: {
            type: "string",
          },
        },
        required: ["code", "message"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "status",
    "available_times",
    "timezone",
    "contact_details",
    "notes",
    "missing_fields",
    "source_text",
    "errors",
  ],
  additionalProperties: false,
} as const;

const ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const TOOL_CONTRACT = {
  name: TOOL_NAME,
  title: TOOL_TITLE,
  description: TOOL_DESCRIPTION,
  inputSchema: INPUT_SCHEMA,
  outputSchema: OUTPUT_SCHEMA,
  annotations: ANNOTATIONS,
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function html(body: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function text(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

function errorOutput(
  code: ErrorCode,
  message: string,
  sourceText = "",
  missingFields: string[] = [],
): CandidateAvailabilityOutput {
  return {
    status: "error",
    available_times: [],
    timezone: null,
    contact_details: {
      email: null,
      phone: null,
    },
    notes: null,
    missing_fields: missingFields,
    source_text: sourceText,
    errors: [
      {
        code,
        message,
      },
    ],
  };
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim().replace(/\s+/g, " ");
    const key = normalized.toLowerCase();
    if (normalized && !seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }
  return result;
}

function extractEmail(textValue: string): string | null {
  const match = textValue.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? null;
}

function extractPhone(textValue: string): string | null {
  const match = textValue.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/);
  return match?.[0].trim() ?? null;
}

function extractTimezone(textValue: string): string | null {
  const timezonePattern =
    /\b(Eastern Time|Central Time|Mountain Time|Pacific Time|Greenwich Mean Time|Coordinated Universal Time|EST|EDT|CST|CDT|MST|MDT|PST|PDT|UTC|GMT|CET|CEST|BST|IST|AEST)\b/i;
  const match = textValue.match(timezonePattern);
  return match?.[0] ?? null;
}

function extractAvailableTimes(textValue: string): string[] {
  const timePattern =
    /\b(?:(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|tomorrow|today|tonight|morning|afternoon|evening|january|february|march|april|may|june|july|august|september|october|november|december|any\s+time|after\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}(?::\d{2})?\s*(?:am|pm)(?:\s*-\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)/i;
  const availabilityHints =
    /\b(available|availability|free|can meet|could meet|works|open|after|before|from|between|morning|afternoon|evening|any time)\b/i;
  const boundaryPattern = /(?:^|[.!?;]\s+|\s+\bor\b\s+|\s+\band\b\s+)/i;
  const rawParts = textValue
    .split(boundaryPattern)
    .map((part) => part.trim().replace(/^I am\s+/i, "").replace(/^I'm\s+/i, ""));

  const matches = rawParts.filter((part) => timePattern.test(part) && availabilityHints.test(part));
  return unique(matches);
}

function extractNotes(textValue: string): string | null {
  const notePatterns = [
    /\bprefer(?:red|s)?\s+[^.!?;]+/gi,
    /\bonly available\s+[^.!?;]+/gi,
    /\bnot available\s+[^.!?;]+/gi,
    /\bplease use\s+[^.!?;]+/gi,
    /\bafter work\b/gi,
  ];
  const notes: string[] = [];
  for (const pattern of notePatterns) {
    const matches = textValue.match(pattern) ?? [];
    notes.push(...matches);
  }
  const cleaned = unique(notes.map((note) => note.replace(/\s+/g, " ").trim()));
  return cleaned.length > 0 ? cleaned.join("; ") : null;
}

function isOutOfScope(textValue: string): boolean {
  const outOfScopePatterns = [
    /\bshould\s+we\s+hire\b/i,
    /\bhire\s+this\s+candidate\b/i,
    /\brank\s+(?:this\s+)?candidate\b/i,
    /\bjudge\s+(?:this\s+)?candidate\b/i,
    /\bmake\s+(?:a\s+)?hiring\s+decision\b/i,
    /\bschedule\s+(?:an?\s+)?interview\b/i,
    /\bsend\s+(?:the\s+candidate\s+)?(?:a\s+)?(?:calendar\s+)?invite\b/i,
    /\bcontact\s+(?:the\s+)?candidate\b/i,
    /\bupdate\s+(?:the\s+)?ATS\b/i,
    /\brecruiting advice\b/i,
  ];
  return outOfScopePatterns.some((pattern) => pattern.test(textValue));
}

function extractCandidateAvailability(input: unknown): CandidateAvailabilityOutput {
  if (typeof input !== "object" || input === null || !("text" in input)) {
    return errorOutput(
      "missing_required_input",
      "The required input text is missing.",
      "",
      ["text"],
    );
  }

  const textValue = (input as { text: unknown }).text;
  if (typeof textValue !== "string") {
    return errorOutput(
      "invalid_input_type",
      "The required input text must be a string.",
      String(textValue),
    );
  }

  const sourceText = textValue;
  if (textValue.trim().length === 0) {
    return errorOutput("empty_input", "The required input text is empty.", sourceText, ["text"]);
  }

  if (isOutOfScope(textValue)) {
    return errorOutput(
      "out_of_scope",
      "This tool only extracts candidate availability details and cannot perform the requested recruiting action.",
      sourceText,
    );
  }

  try {
    const availableTimes = extractAvailableTimes(textValue);
    const timezone = extractTimezone(textValue);
    const email = extractEmail(textValue);
    const phone = extractPhone(textValue);
    const notes = extractNotes(textValue);
    const missingFields: string[] = [];

    if (availableTimes.length === 0) missingFields.push("available_times");
    if (timezone === null) missingFields.push("timezone");
    if (email === null) missingFields.push("contact_details.email");
    if (phone === null) missingFields.push("contact_details.phone");
    if (notes === null) missingFields.push("notes");

    return {
      status: "success",
      available_times: availableTimes,
      timezone,
      contact_details: {
        email,
        phone,
      },
      notes,
      missing_fields: missingFields,
      source_text: sourceText,
      errors: [],
    };
  } catch {
    return errorOutput(
      "internal_error",
      "An unexpected error occurred while extracting candidate availability details.",
      sourceText,
    );
  }
}

function rpcResult(id: unknown, result: unknown): Response {
  return json({
    jsonrpc: "2.0",
    id: id ?? null,
    result,
  });
}

function rpcError(id: unknown, code: number, message: string): Response {
  return json({
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
    },
  });
}

async function handleMcp(request: Request): Promise<Response> {
  let payload: { id?: unknown; method?: unknown; params?: unknown };
  try {
    payload = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const id = payload.id ?? null;
  if (payload.method === "initialize") {
    return rpcResult(id, {
      protocolVersion: "2024-11-05",
      serverInfo: {
        name: APP_SLUG,
        version: SERVER_VERSION,
      },
      capabilities: {
        tools: {},
      },
    });
  }

  if (payload.method === "tools/list") {
    return rpcResult(id, {
      tools: [TOOL_CONTRACT],
    });
  }

  if (payload.method === "tools/call") {
    const params = typeof payload.params === "object" && payload.params !== null ? payload.params : {};
    const name = (params as { name?: unknown }).name;
    const args = (params as { arguments?: unknown }).arguments;

    if (name !== TOOL_NAME) {
      const output = errorOutput(
        "out_of_scope",
        "This MCP endpoint exposes only candidate_time_extractor.",
      );
      return rpcResult(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(output),
          },
        ],
        structuredContent: output,
      });
    }

    const output = extractCandidateAvailability(args);
    return rpcResult(id, {
      content: [
        {
          type: "text",
          text: JSON.stringify(output),
        },
      ],
      structuredContent: output,
    });
  }

  return rpcError(id, -32601, "Method not found");
}

function notFound(): Response {
  return text("Not found", 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "GET" && pathname === "/health") {
      return json({
        status: "ok",
        app: APP_SLUG,
        version: SERVER_VERSION,
      });
    }

    if (request.method === "GET" && pathname === "/.well-known/openai-apps-challenge") {
      return text(env.OPENAI_APPS_CHALLENGE || LOCAL_CHALLENGE_FALLBACK);
    }

    if (request.method === "GET" && pathname === `/${APP_SLUG}`) {
      return html(indexHtml);
    }

    if (request.method === "GET" && pathname === `/${APP_SLUG}/privacy`) {
      return html(privacyHtml);
    }

    if (request.method === "GET" && pathname === `/${APP_SLUG}/terms`) {
      return html(termsHtml);
    }

    if (request.method === "GET" && pathname === `/${APP_SLUG}/support`) {
      return html(supportHtml);
    }

    if (request.method === "POST" && pathname === `/${APP_SLUG}/mcp`) {
      return handleMcp(request);
    }

    return notFound();
  },
};
