// Scope Review: carrier-estimate analysis for a CRM job (ported from the
// standalone scope-review app). Same six modes and prompts; admin-only; PDFs
// are read from the private scope-documents bucket instead of the request body.
import Anthropic from "@anthropic-ai/sdk";
import { requireStaff, supabaseAdmin } from "./_lib/supabase.js";
import {
  SYSTEM_EXTRACT, SYSTEM_ANALYZE, SYSTEM_COVER_ADJUSTER, SYSTEM_COVER_HOMEOWNER,
  SYSTEM_SUPPLEMENT_ITEMS, SYSTEM_SUPPLEMENT_LETTER,
} from "./_lib/scopeReviewPrompts.js";

const MODEL = "claude-sonnet-5";
// Adaptive thinking shares max_tokens with the answer; the original app's
// 900-4000 budgets were what truncated responses. Give every call room.
const MAX_TOKENS = 16000;
const BUCKET = "scope-documents";

// JSON schemas for the structured-output modes. Wrapped in an object because
// the prompts ask for a bare array; the instruction below maps one to the other.
const str = { type: "string" };
const enumOf = (...values) => ({ type: "string", enum: values });
const arrayOf = (properties) => ({
  type: "object",
  properties: {
    items: {
      type: "array",
      items: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
    },
  },
  required: ["items"],
  additionalProperties: false,
});
const SCHEMAS = {
  extract: arrayOf({ ref: str, text: str }),
  analyze: arrayOf({
    ref: str, itemText: str, tradeCategory: str,
    category: enumOf("cascade", "rebuttal", "note"),
    strength: enumOf("high", "medium", "low"),
    explanation: str,
    confidence: enumOf("confirmed", "needs_info"),
  }),
  supplementItems: arrayOf({
    itemLabel: str, suggestedLineItem: str, justification: str,
    confidence: enumOf("confirmed", "needs_info"), whatToConfirm: str,
  }),
};
const WRAP_NOTE = "\n\n(Return the JSON array as the \"items\" field of a JSON object.)";

let client = null;
function anthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set on the CRM's Vercel project. Add it in Project Settings -> Environment Variables, then redeploy.");
  }
  for (let i = 0; i < apiKey.length; i++) {
    if (apiKey.charCodeAt(i) > 255) {
      throw new Error("ANTHROPIC_API_KEY contains an invalid character at position " + i + " (likely hidden formatting from a copy-paste). Re-copy it and update it in Vercel, then redeploy.");
    }
  }
  if (!client) client = new Anthropic({ apiKey, timeout: 280_000, maxRetries: 1 });
  return client;
}

// One Claude call. With a schema, output is constrained to valid JSON; if the
// API rejects the format parameter itself we retry once without it and fall
// back to the original app's lenient parser.
async function callClaude(system, content, schema) {
  const base = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content }],
  };
  let response;
  try {
    response = await anthropic().messages.create(schema ? { ...base, output_config: { format: { type: "json_schema", schema } } } : base);
  } catch (err) {
    if (schema && err instanceof Anthropic.BadRequestError && /output_config|format|schema/i.test(err.message)) {
      console.warn("scope-review: structured output rejected, retrying without it:", err.message);
      response = await anthropic().messages.create(base);
    } else {
      throw err;
    }
  }

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined this request" + (response.stop_details?.explanation ? ": " + response.stop_details.explanation : "."));
  }
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  if (response.stop_reason === "max_tokens") {
    throw new Error("The response hit the length limit before finishing. Try again, or split the estimate into smaller parts.");
  }
  if (!text) {
    throw new Error("Claude returned no text (stop_reason=" + response.stop_reason + ").");
  }
  if (!schema) return text;
  const parsed = parseJsonLoose(text);
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
}

// From the original app: escape stray quote marks (usually inch marks) that
// break JSON. Only needed if structured output is unavailable.
function repairUnescapedQuotes(text) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && inString) { out += ch + (text[i + 1] || ""); i++; continue; }
    if (ch === '"') {
      if (!inString) { inString = true; out += ch; continue; }
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      const next = text[j];
      if (next === undefined || ",:}]".includes(next)) { inString = false; out += ch; } else { out += '\\"'; }
      continue;
    }
    out += ch;
  }
  return out;
}

function parseJsonLoose(text) {
  const clean = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(clean);
  } catch (firstErr) {
    try {
      return JSON.parse(repairUnescapedQuotes(clean));
    } catch {
      throw new Error("Could not read Claude's answer as JSON (" + firstErr.message + "). Try again.");
    }
  }
}

async function loadPdfBase64(jobId, pdfPath) {
  if (typeof pdfPath !== "string" || !pdfPath.startsWith(jobId + "/") || pdfPath.includes("..")) {
    throw Object.assign(new Error("That PDF doesn't belong to this job."), { status: 400 });
  }
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).download(pdfPath);
  if (error || !data) throw Object.assign(new Error("Could not open the uploaded PDF."), { status: 404 });
  return Buffer.from(await data.arrayBuffer()).toString("base64");
}

const lines = (arr) => (Array.isArray(arr) ? arr : []).map(String).join("\n");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await requireStaff(req, res, { role: "admin" }))) return;

  const { mode, jobId, payload = {} } = req.body || {};
  const jobKey = String(jobId ?? "");
  if (!/^\d+$/.test(jobKey)) return res.status(400).json({ error: "Missing job." });
  const { data: job } = await supabaseAdmin().from("jobs").select("job_id").eq("job_id", jobKey).maybeSingle();
  if (!job) return res.status(404).json({ error: "Job not found." });

  try {
    if (mode === "extract") {
      if (!payload.scopeText || !String(payload.scopeText).trim()) return res.status(400).json({ error: "No scope text provided." });
      const items = await callClaude(SYSTEM_EXTRACT, String(payload.scopeText) + WRAP_NOTE, SCHEMAS.extract);
      return res.status(200).json({ items });
    }

    if (mode === "extractPdf") {
      const pdfBase64 = await loadPdfBase64(jobKey, payload.pdfPath);
      const content = [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
        { type: "text", text: "Extract the discrete billable line items from this insurance scope-of-work PDF, covering every page." + WRAP_NOTE },
      ];
      const items = await callClaude(SYSTEM_EXTRACT, content, SCHEMAS.extract);
      return res.status(200).json({ items });
    }

    if (mode === "analyze") {
      if (!Array.isArray(payload.items) || payload.items.length === 0) return res.status(400).json({ error: "No line items provided to analyze." });
      const userText = "Line items to analyze:\n" + payload.items.map((it) => it.ref + ": " + it.text).join("\n");
      const results = await callClaude(SYSTEM_ANALYZE, userText + WRAP_NOTE, SCHEMAS.analyze);
      return res.status(200).json({ results });
    }

    if (mode === "cover") {
      const audience = payload.audience === "homeowner" ? "homeowner" : "adjuster";
      const system = audience === "homeowner" ? SYSTEM_COVER_HOMEOWNER : SYSTEM_COVER_ADJUSTER;
      const userText =
        "Claim reference: " + (payload.claimLabel || "Not provided") + "\n\n" +
        "Cascade findings (approved work that disturbs adjacent systems):\n" + lines(payload.cascadeItems) + "\n\n" +
        "Rebuttal findings (denied, missing, or undervalued items):\n" + lines(payload.rebuttalItems);
      const text = await callClaude(system, userText, null);
      return res.status(200).json({ text, audience });
    }

    if (mode === "supplementItems") {
      if (!payload.supplementNotes || !String(payload.supplementNotes).trim()) return res.status(400).json({ error: "Describe the additional damage or findings first." });
      const originalContext = Array.isArray(payload.originalItems) && payload.originalItems.length
        ? "Carrier's original line items, for context on what's already approved/denied:\n" +
          payload.originalItems.map((it) => "- [" + it.category + "] " + it.itemText).join("\n") + "\n\n"
        : "";
      const userText = originalContext +
        "Contractor's field notes describing additional damage or findings not covered by the original estimate:\n" +
        payload.supplementNotes;
      const items = await callClaude(SYSTEM_SUPPLEMENT_ITEMS, userText + WRAP_NOTE, SCHEMAS.supplementItems);
      return res.status(200).json({ items });
    }

    if (mode === "supplementLetter") {
      if (!Array.isArray(payload.supplementItems) || payload.supplementItems.length === 0) return res.status(400).json({ error: "No supplement items to write a letter for." });
      const userText =
        "Claim reference: " + (payload.claimLabel || "Not provided") + "\n\n" +
        "Supplement items:\n" +
        payload.supplementItems.map((it, i) =>
          (i + 1) + ". " + it.itemLabel + "\n   Requested: " + it.suggestedLineItem +
          "\n   Justification: " + it.justification + "\n   Confidence: " + it.confidence
        ).join("\n\n");
      const text = await callClaude(SYSTEM_SUPPLEMENT_LETTER, userText, null);
      return res.status(200).json({ text });
    }

    return res.status(400).json({ error: "Unknown mode: " + mode });
  } catch (err) {
    console.error("scope-review error:", mode, err);
    const status = err.status && err.status < 500 && !(err instanceof Anthropic.APIError) ? err.status : 500;
    let message = err.message || "Unexpected server error";
    if (err instanceof Anthropic.RateLimitError) message = "Claude is busy right now (rate limited). Wait a minute and try again.";
    else if (err instanceof Anthropic.AuthenticationError) message = "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in Vercel.";
    else if (err instanceof Anthropic.APIConnectionError) message = "Couldn't reach Claude. Try again.";
    return res.status(status).json({ error: message });
  }
}
