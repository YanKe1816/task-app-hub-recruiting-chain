import indexHtml from "../candidate_time_extractor_index.html";
import privacyHtml from "../candidate_time_extractor_privacy.html";
import termsHtml from "../candidate_time_extractor_terms.html";
import supportHtml from "../candidate_time_extractor_support.html";
import resumeIndexHtml from "../resume_contact_extractor_index.html";
import resumePrivacyHtml from "../resume_contact_extractor_privacy.html";
import resumeTermsHtml from "../resume_contact_extractor_terms.html";
import resumeSupportHtml from "../resume_contact_extractor_support.html";

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

type ResumeContactOutput = {
  status: "success" | "error";
  candidate_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  missing_fields: string[];
  source_text: string;
  errors: ToolError[];
};

const CANDIDATE_APP_SLUG = "candidate-time-extractor";
const CANDIDATE_TOOL_NAME = "candidate_time_extractor";
const CANDIDATE_TOOL_TITLE = "Candidate Time Extractor";
const RESUME_APP_SLUG = "resume-contact-extractor";
const RESUME_TOOL_NAME = "resume_contact_extractor";
const RESUME_TOOL_TITLE = "Resume Contact Extractor";
const SERVER_VERSION = "0.1.0";

const CANDIDATE_TOOL_DESCRIPTION =
  "Use this tool when the user provides a candidate message and needs structured interview availability details. The tool returns available interview times, timezone, contact details, notes, missing fields, source text, and errors. Do not use this tool to schedule interviews, send invitations, contact candidates, update ATS systems, judge candidate quality, rank candidates, or make hiring decisions. This tool is useful when deterministic structured extraction is needed for a recruiting task workflow.";

const RESUME_TOOL_DESCRIPTION =
  "Use this tool when the user provides resume text and needs structured candidate contact fields. The tool returns candidate name, email, phone, city, missing fields, source text, and errors. Do not use this tool to decide whether to hire, rank candidates, contact applicants, schedule interviews, update ATS systems, or provide recruiting advice. This tool is useful when deterministic structured extraction is needed for an AI task workflow.";

const CANDIDATE_INPUT_SCHEMA = {
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

const RESUME_INPUT_SCHEMA = {
  type: "object",
  properties: {
    text: {
      type: "string",
      description: "Raw resume text provided by the user.",
    },
  },
  required: ["text"],
  additionalProperties: false,
} as const;

const CANDIDATE_OUTPUT_SCHEMA = {
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

const RESUME_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["success", "error"],
    },
    candidate_name: {
      type: ["string", "null"],
    },
    email: {
      type: ["string", "null"],
    },
    phone: {
      type: ["string", "null"],
    },
    city: {
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
    "candidate_name",
    "email",
    "phone",
    "city",
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

const CANDIDATE_TOOL_CONTRACT = {
  name: CANDIDATE_TOOL_NAME,
  title: CANDIDATE_TOOL_TITLE,
  description: CANDIDATE_TOOL_DESCRIPTION,
  inputSchema: CANDIDATE_INPUT_SCHEMA,
  outputSchema: CANDIDATE_OUTPUT_SCHEMA,
  annotations: ANNOTATIONS,
};

const RESUME_TOOL_CONTRACT = {
  name: RESUME_TOOL_NAME,
  title: RESUME_TOOL_TITLE,
  description: RESUME_TOOL_DESCRIPTION,
  inputSchema: RESUME_INPUT_SCHEMA,
  outputSchema: RESUME_OUTPUT_SCHEMA,
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

function resumeErrorOutput(
  code: ErrorCode,
  message: string,
  sourceText = "",
  missingFields: string[] = [],
): ResumeContactOutput {
  return {
    status: "error",
    candidate_name: null,
    email: null,
    phone: null,
    city: null,
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

function normalizeExtractedName(value: string): string | null {
  const cleaned = value
    .replace(/\b(?:is|as|a|an|the|based|located|from|email|phone|resume)\b.*$/i, "")
    .replace(/[,:;|()[\]{}]+$/g, "")
    .trim()
    .replace(/\s+/g, " ");

  if (/^[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){1,4}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

function isNameOnly(value: string): boolean {
  return /^[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){1,4}$/.test(value);
}

function extractCandidateName(textValue: string): string | null {
  const lines = textValue
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 6)) {
    const cleaned = line.replace(/^(?:candidate\s+)?name\s*:\s*/i, "").trim();
    if (!extractEmail(cleaned) && !extractPhone(cleaned) && !/[|@]/.test(cleaned)) {
      const lineName = normalizeExtractedName(cleaned);
      if (lineName) {
        return lineName;
      }
    }
  }

  const namePatterns = [
    /\b(?:candidate\s+)?name\s*:\s*([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){1,4})\b/,
    /^\s*([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){1,4})\s+(?:is|has|works|lives|resides|based|located)\b/im,
    /\b(?:resume|profile|candidate)\s+(?:for|of)\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){1,4})\b/i,
    /\b([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){1,4})\s+is\s+(?:a|an|the)\s+[A-Za-z]/,
  ];

  for (const pattern of namePatterns) {
    const match = textValue.match(pattern);
    if (match) {
      const words = match[1].trim().split(/\s+/);
      for (let length = Math.min(words.length, 5); length >= 2; length -= 1) {
        const candidate = words.slice(0, length).join(" ");
        if (isNameOnly(candidate)) {
          return candidate;
        }
      }
    }
  }

  return null;
}

function normalizeCity(value: string): string | null {
  const cleaned = value
    .replace(/^(?:based|located|resides|living|lives|from)\s+(?:in\s+)?/i, "")
    .replace(/\b(?:and|with|where|who|email|phone|resume)\b.*$/i, "")
    .replace(/[,:;|()[\]{}]+$/g, "")
    .trim()
    .replace(/\s+/g, " ");

  if (/^[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

function extractCity(textValue: string): string | null {
  const cityPatterns = [
    /\b(?:city|location)\s*:\s*([A-Z][A-Za-z.'-]*(?:[ \t]+[A-Z][A-Za-z.'-]*){0,3})(?:\s*,\s*(?:[A-Z]{2}|[A-Za-z .'-]{3,40}))?(?:\b|$)/,
    /\b(?:based|located|resides|living|lives)\s+in\s+([A-Z][A-Za-z.'-]*(?:[ \t]+[A-Z][A-Za-z.'-]*){0,3})(?:\s*,\s*(?:[A-Z]{2}|[A-Za-z .'-]{3,40}))?(?=\s|[.,;]|$)/,
    /\bfrom\s+([A-Z][A-Za-z.'-]*(?:[ \t]+[A-Z][A-Za-z.'-]*){0,3})(?:\s*,\s*(?:[A-Z]{2}|[A-Za-z .'-]{3,40}))?\b/i,
  ];

  for (const pattern of cityPatterns) {
    const match = textValue.match(pattern);
    const city = match ? normalizeCity(match[1]) : null;
    if (city) {
      return city;
    }
  }

  const lines = textValue.split(/\r?\n/).map((line) => line.trim());
  for (const line of lines) {
    const cityState = line.match(/^([A-Z][A-Za-z.'-]*(?:[ \t]+[A-Z][A-Za-z.'-]*){0,3}),\s*(?:[A-Z]{2}|[A-Za-z .'-]{3,40})(?:\b|$)/);
    const city = cityState ? normalizeCity(cityState[1]) : null;
    if (city) {
      return city;
    }
  }

  const knownCities = [
    "San Francisco",
    "New York",
    "Los Angeles",
    "Chicago",
    "Seattle",
    "Austin",
    "Boston",
    "Denver",
    "Atlanta",
    "Dallas",
    "Portland",
    "Miami",
    "Phoenix",
    "Philadelphia",
    "Washington",
  ];
  const city = knownCities.find((value) => new RegExp(`\\b${value}\\b`, "i").test(textValue));
  return city ?? null;
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

function isResumeContactOutOfScope(textValue: string): boolean {
  const outOfScopePatterns = [
    /\bshould\s+we\s+hire\b/i,
    /\bhire\s+this\s+candidate\b/i,
    /\brank\s+(?:this\s+)?candidate\b/i,
    /\bjudge\s+(?:this\s+)?candidate\b/i,
    /\bmake\s+(?:a\s+)?hiring\s+decision\b/i,
    /\bschedule\s+(?:an?\s+)?interview\b/i,
    /\bsend\s+(?:the\s+candidate\s+)?(?:a\s+)?(?:calendar\s+)?invite\b/i,
    /\bcontact\s+(?:the\s+)?(?:applicant|candidate)\b/i,
    /\bupdate\s+(?:the\s+)?ATS\b/i,
    /\brecruiting advice\b/i,
    /\bwrite\s+(?:an?\s+)?(?:email|message)\b/i,
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

function extractResumeContact(input: unknown): ResumeContactOutput {
  if (typeof input !== "object" || input === null || !("text" in input)) {
    return resumeErrorOutput(
      "missing_required_input",
      "The required input text is missing.",
      "",
      ["text"],
    );
  }

  const textValue = (input as { text: unknown }).text;
  if (typeof textValue !== "string") {
    return resumeErrorOutput(
      "invalid_input_type",
      "The input text must be a string.",
      "",
      ["text"],
    );
  }

  const sourceText = textValue;
  if (textValue.trim().length === 0) {
    return resumeErrorOutput("empty_input", "The input text is empty.", "", ["text"]);
  }

  if (isResumeContactOutOfScope(textValue)) {
    return resumeErrorOutput(
      "out_of_scope",
      "This tool only extracts candidate contact fields from resume text.",
      sourceText,
    );
  }

  try {
    const candidateName = extractCandidateName(textValue);
    const email = extractEmail(textValue);
    const phone = extractPhone(textValue);
    const city = extractCity(textValue);
    const missingFields: string[] = [];

    if (candidateName === null) missingFields.push("candidate_name");
    if (email === null) missingFields.push("email");
    if (phone === null) missingFields.push("phone");
    if (city === null) missingFields.push("city");

    return {
      status: "success",
      candidate_name: candidateName,
      email,
      phone,
      city,
      missing_fields: missingFields,
      source_text: sourceText,
      errors: [],
    };
  } catch {
    return resumeErrorOutput(
      "internal_error",
      "An unexpected error occurred while extracting candidate contact fields.",
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

async function handleMcp(
  request: Request,
  appSlug: string,
  toolName: string,
  toolContract: unknown,
  extract: (input: unknown) => CandidateAvailabilityOutput | ResumeContactOutput,
  endpointOnlyMessage: string,
  endpointErrorOutput: (code: ErrorCode, message: string) => CandidateAvailabilityOutput | ResumeContactOutput,
): Promise<Response> {
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
        name: appSlug,
        version: SERVER_VERSION,
      },
      capabilities: {
        tools: {},
      },
    });
  }

  if (payload.method === "tools/list") {
    return rpcResult(id, {
      tools: [toolContract],
    });
  }

  if (payload.method === "tools/call") {
    const params = typeof payload.params === "object" && payload.params !== null ? payload.params : {};
    const name = (params as { name?: unknown }).name;
    const args = (params as { arguments?: unknown }).arguments;

    if (name !== toolName) {
      const output = endpointErrorOutput(
        "out_of_scope",
        endpointOnlyMessage,
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

    const output = extract(args);
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

function hubIndex(): Response {
  return html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Task App Workers Hub</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.55; margin: 0; color: #1f2937; background: #f8fafc; }
      header, main { max-width: 860px; margin: 0 auto; padding: 24px; }
      section { background: #ffffff; border: 1px solid #dbe3ea; border-radius: 8px; margin: 16px 0; padding: 20px; }
      a { color: #0f766e; font-weight: 700; }
      h1, h2 { color: #111827; }
    </style>
  </head>
  <body>
    <header>
      <h1>Task App Workers Hub</h1>
    </header>
    <main>
      <section>
        <h2>Available Apps</h2>
        <p><a href="/candidate-time-extractor">Candidate Time Extractor</a></p>
        <p><a href="/resume-contact-extractor">Resume Contact Extractor</a></p>
      </section>
    </main>
  </body>
</html>`);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "GET" && pathname === "/") {
      return hubIndex();
    }

    if (request.method === "GET" && pathname === "/health") {
      return json({
        status: "ok",
        app: "task-app-workers-hub",
        apps: [CANDIDATE_APP_SLUG, RESUME_APP_SLUG],
        version: SERVER_VERSION,
      });
    }

    if (request.method === "GET" && pathname === "/.well-known/openai-apps-challenge") {
      return text(env.OPENAI_APPS_CHALLENGE ?? "");
    }

    if (request.method === "GET" && pathname === `/${CANDIDATE_APP_SLUG}`) {
      return html(indexHtml);
    }

    if (request.method === "GET" && pathname === `/${CANDIDATE_APP_SLUG}/privacy`) {
      return html(privacyHtml);
    }

    if (request.method === "GET" && pathname === `/${CANDIDATE_APP_SLUG}/terms`) {
      return html(termsHtml);
    }

    if (request.method === "GET" && pathname === `/${CANDIDATE_APP_SLUG}/support`) {
      return html(supportHtml);
    }

    if (request.method === "POST" && pathname === `/${CANDIDATE_APP_SLUG}/mcp`) {
      return handleMcp(
        request,
        CANDIDATE_APP_SLUG,
        CANDIDATE_TOOL_NAME,
        CANDIDATE_TOOL_CONTRACT,
        extractCandidateAvailability,
        "This MCP endpoint exposes only candidate_time_extractor.",
        (code, message) => errorOutput(code, message),
      );
    }

    if (request.method === "GET" && pathname === `/${RESUME_APP_SLUG}`) {
      return html(resumeIndexHtml);
    }

    if (request.method === "GET" && pathname === `/${RESUME_APP_SLUG}/privacy`) {
      return html(resumePrivacyHtml);
    }

    if (request.method === "GET" && pathname === `/${RESUME_APP_SLUG}/terms`) {
      return html(resumeTermsHtml);
    }

    if (request.method === "GET" && pathname === `/${RESUME_APP_SLUG}/support`) {
      return html(resumeSupportHtml);
    }

    if (request.method === "POST" && pathname === `/${RESUME_APP_SLUG}/mcp`) {
      return handleMcp(
        request,
        RESUME_APP_SLUG,
        RESUME_TOOL_NAME,
        RESUME_TOOL_CONTRACT,
        extractResumeContact,
        "This MCP endpoint exposes only resume_contact_extractor.",
        (code, message) => resumeErrorOutput(code, message),
      );
    }

    return notFound();
  },
};
