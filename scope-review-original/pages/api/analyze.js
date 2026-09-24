// Server-side proxy to the Anthropic API. The API key never reaches the browser.
// Set ANTHROPIC_API_KEY in Vercel Project Settings -> Environment Variables.

const MODEL = "claude-sonnet-5";

// Raise the body size limit so a base64-encoded PDF upload can reach this
// route (Xactimate PDFs are usually well under this, but multi-page scans
// can get large once base64-inflated).
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "12mb",
    },
  },
};

const SYSTEM_EXTRACT = `You extract discrete billable line items from an insurance repair/replacement scope of work. The input may be pasted text (often copy-pasted from Xactimate or a similar estimating tool, so formatting is messy) or a PDF document.

Return ONLY a JSON array, no prose, no markdown fences. Each element: {"ref": string, "text": string}.
- "ref" is the line number or item code if one is visibly present (e.g. "12", "12-13", "6-7"); if none is visible, assign sequential "L1", "L2", etc.
- "text" is the full item description on that line, including quantity/unit/price if present, condensed to one line.
- Skip page headers, column headers (Description/Quantity/Unit Price/etc.), subtotal/total/tax rows, company letterhead, claim metadata, and blank lines.
- Preserve the original order.
- If the input is very short or is a single free-text description rather than a line-itemized estimate, still extract it as one item.
- If it's a multi-page PDF, extract line items from every page, not just the first.
- CRITICAL: your output must be strictly valid JSON. Never use a literal double-quote character (") inside a string value -- this includes inch marks (e.g. write "8 in" or "8-inch", never 8"). If you must represent a quote for any other reason, escape it as \\".`;

const SYSTEM_ANALYZE = `You are a senior roofing rebuttal analyst working for Freedom Exteriors LLC, a licensed roofing/siding/windows/doors contractor (MN BC 810020, WI 4811-DCFR) reviewing an insurance carrier's scope of work on a hail or wind damage claim, before the contractor sends a rebuttal to the adjuster.

For EACH line item given, classify it into exactly one category and explain accordingly:

- "cascade": the item is APPROVED/paid/scoped work whose physical execution necessarily disturbs an adjacent system (most often: the item requires lifting, cutting, or re-nailing shingles, siding, or flashing around it to be completed). Explain concretely what physical work is required to complete the repair, and exactly what gets disturbed as a result.
- "rebuttal": the item is DENIED, excluded, missing entirely from the scope, or looks undervalued/underscoped (unusually low quantity or a scope gap relative to a complete, standard trade approach). Give the strongest available factual/technical rebuttal argument -- material science, internal consistency with other accepted items, industry-standard complete-scope expectations, or measurement/quantity discrepancies if the input includes measurements. Do NOT invent a specific dollar figure as "correct." Do NOT cite a specific IRC/IBC section or insurance regulation/bulletin number unless it was given to you verbatim in the input -- describe requirements in plain trade terms instead.
- "note": the item is routine, non-cascading, and not itself in dispute. Give a brief one-sentence note, no invented issue.

Also assign:
- "tradeCategory": a short label mirroring how a carrier's own estimate groups line items, e.g. "Roofing - Field", "Roofing - Accessories", "Exterior - Trim/Gutters", "Exterior - Openings", "General/Labor".
- "strength": "high" | "medium" | "low" -- how much leverage this item gives in a rebuttal. "high" = drives the core cascade/material argument, has real scope or dollar footprint, or exposes a clear inconsistency in the carrier's own paperwork. "low" = minor or speculative. Notes are usually "low" unless something about them is still worth flagging as leverage.

Hard rules:
- NEVER discuss insurance policy language, coverage interpretation, exclusions-as-written, or legal/appraisal rights. That is exclusively the homeowner's domain. Stay strictly in the physical scope-of-work / trade-practice lane.
- NEVER invent a specific code section, statute, or bulletin number. If a citation would help, say the exact citation should be confirmed before it goes in writing, in plain language.
- Mark confidence "confirmed" only when the trade-sequence or material logic is well-established and doesn't depend on facts not given to you. Otherwise mark "needs_info" and say what specific fact (a photo, a measurement, a product spec) would confirm it.
- Keep each explanation to 2-4 sentences. Be concrete and specific to the item, not generic boilerplate.
- CRITICAL: your output must be strictly valid JSON. Never use a literal double-quote character (") inside any string value -- this includes inch marks (e.g. write "8 in" or "8-inch", never 8"), even when quoting or referencing the item text as given. If you must represent a quote for any other reason, escape it as \\".

Return ONLY a JSON array, no prose, no markdown fences, one object per input item in the same order:
{"ref": string, "itemText": string, "tradeCategory": string, "category": "cascade"|"rebuttal"|"note", "strength": "high"|"medium"|"low", "explanation": string, "confidence": "confirmed"|"needs_info"}`;

const SYSTEM_COVER_ADJUSTER = `You write the opening paragraph of a roofing contractor's scope-of-work rebuttal letter to an insurance carrier, following this proven structure: (1) claim reference and property, (2) what is being requested (reinspection, revised estimate, full-scope approval), (3) why, in one calm sentence referencing the pattern of findings below. Do not discuss policy language or coverage interpretation. Stay factual and calm, not adversarial. One paragraph, 3-5 sentences, no markdown.`;

const SYSTEM_COVER_HOMEOWNER = `You write a short, plain-language summary FOR THE HOMEOWNER (not the insurance carrier) explaining what their roofing contractor, Freedom Exteriors LLC, found when reviewing the carrier's scope of work, and why the contractor is pushing for a full roof replacement rather than accepting the carrier's itemized point repairs. Audience is a homeowner with no construction or insurance background.

Structure: (1) one sentence on what was reviewed, (2) plain-language explanation of the pattern found (approved repairs that require opening up more of the roof than priced, and/or scope gaps), (3) why that matters for them in practical terms (patch repairs vs. a uniform, fully sealed roof), (4) what happens next (the contractor is sending the carrier a request for reinspection/revised estimate).

Do not use jargon like "cascade" or "rebuttal" -- describe things plainly (e.g. "several of the repairs the insurance company approved can't actually be done without pulling up shingles around them"). Do not assert what the insurance policy covers or doesn't cover, or interpret policy language or legal rights -- that is the homeowner's own call, possibly with their own advisor. Stay factual, warm, and reassuring, not alarmist. One short paragraph, 4-6 sentences, no markdown.`;

const SYSTEM_SUPPLEMENT_ITEMS = `You are a senior roofing estimator for Freedom Exteriors LLC (MN BC 810020, WI 4811-DCFR) drafting a Xactimate-style insurance supplement -- an itemized request for additional funds after the carrier's original estimate was written, based on damage found or documented after that estimate (e.g. during tear-off, or damage the field notes describe that the original scope didn't address).

You'll be given: the carrier's original line items (for context on what's already approved/denied), and the contractor's field notes describing new or additional damage/findings that justify a supplement.

For EACH distinct supplement item implied by the field notes, produce an entry with:
- "itemLabel": short name for the item (e.g. "Skylight unit replacement")
- "suggestedLineItem": a plain-English, Xactimate-style line item description a desk adjuster would recognize -- action + component + material/size if known (e.g. "Replace - Skylight, fixed, insulated glass, approx. 2x4' -- 1 EA (hail-fractured glazing, not a flashing-only repair)"). Do NOT include a dollar amount or unit price -- pricing must come from the actual price list, which you don't have access to.
- "justification": 2-4 sentences of the strongest factual/technical argument for why this needs to be added or upgraded from what the carrier already approved -- damage evidence described in the notes, why a lesser repair (e.g. flashing-only) can't be done without addressing the underlying damage, or internal consistency with what the carrier already approved elsewhere in the estimate.
- "confidence": "confirmed" if the field notes clearly describe damage that supports the item, "needs_info" if it's plausible but would benefit from a photo, measurement, or manufacturer spec to lock down before submitting.
- "whatToConfirm": if needs_info, name the SPECIFIC thing that would firm this up (a photo of X, a measurement of Y). If confirmed, use an empty string.

Hard rules:
- NEVER discuss insurance policy language, coverage interpretation, or exclusions-as-written -- that's the homeowner's domain. Stay strictly in physical scope-of-work / trade-practice / damage-documentation lane.
- NEVER invent a specific code section, statute, or bulletin number, and NEVER invent a dollar amount or Xactimate unit price.
- NEVER invent damage that isn't stated or clearly implied by the field notes -- if the notes are ambiguous about scope (e.g. "skylight" without saying which one, when multiple exist), say so in whatToConfirm rather than guessing.
- CRITICAL: strictly valid JSON. Never use a literal double-quote character (") inside a string value -- write inches as "in", never with a quote mark. Escape any other quote as \\".

Return ONLY a JSON array, no prose, no markdown fences:
{"itemLabel": string, "suggestedLineItem": string, "justification": string, "confidence": "confirmed"|"needs_info", "whatToConfirm": string}`;

const SYSTEM_SUPPLEMENT_LETTER = `You draft a supplement request letter from a roofing contractor (Freedom Exteriors LLC, MN BC 810020, WI 4811-DCFR) to an insurance adjuster, requesting additional line items/funds beyond the carrier's original estimate on a hail or wind damage claim.

You'll be given the claim reference and a list of supplement items (label, suggested line item, justification, confidence).

Structure the letter as:
1. Opening: claim reference, property, brief statement that this is a supplement request following [inspection/tear-off/further review], not a dispute of the original scope.
2. One paragraph per supplement item (or grouped if closely related): what's being requested, the factual/technical justification, referencing photo documentation where relevant ("as documented in the attached photos").
3. Closing: request for review and a revised estimate/supplement approval, offer to provide additional documentation, professional sign-off placeholder ("Sincerely, [Your name], Freedom Exteriors LLC").

Hard rules:
- NEVER discuss insurance policy language, coverage interpretation, or exclusions-as-written -- that's the homeowner's domain.
- NEVER invent a specific code section, statute, or bulletin number, or a specific dollar amount.
- Stay factual and professional, not adversarial -- this is a routine supplement request, not a rebuttal of a denial.
- If any item's confidence is "needs_info", note in that paragraph that supporting documentation is being finalized and will follow, rather than overstating certainty.
- Plain text only, no markdown, no placeholder brackets other than [Your name] for the signature.`;

async function callAnthropic(system, content, maxTokens) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set on this deployment. Add it in Vercel -> Project Settings -> Environment Variables, then redeploy."
    );
  }
  for (let i = 0; i < apiKey.length; i++) {
    if (apiKey.charCodeAt(i) > 255) {
      throw new Error(
        "ANTHROPIC_API_KEY contains an invalid character at position " + i +
          " (likely picked up from a copy-paste with hidden formatting). Re-copy it from console.anthropic.com and update it in Vercel, then redeploy."
      );
    }
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
    }),
  });

  const rawText = await res.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    // The API didn't return JSON at all -- surface exactly what came back.
    throw new Error(
      "Anthropic API returned a non-JSON response (HTTP " + res.status + "): " + rawText.slice(0, 500)
    );
  }

  if (!res.ok) {
    // data.error is the normal shape for a 4xx/5xx from the Anthropic API.
    const apiErr = data && data.error ? data.error.type + ": " + data.error.message : JSON.stringify(data).slice(0, 500);
    throw new Error("Anthropic API error (" + res.status + "): " + apiErr);
  }

  const blocks = Array.isArray(data.content) ? data.content : [];
  const textBlock = blocks.find((b) => b.type === "text" && b.text && b.text.trim().length > 0);

  if (data.stop_reason === "max_tokens") {
    // The response was cut off before the model finished -- this produces
    // exactly the "unterminated string" JSON errors we were chasing, but the
    // cause is a token budget, not a formatting mistake. Say so plainly.
    throw new Error(
      "The model's response was cut off by the token limit (max_tokens=" + maxTokens +
        ") before it finished. Try again with fewer items per batch, or increase max_tokens for this call." +
        (textBlock ? " Partial output (last 200 chars): ..." + textBlock.text.slice(-200) : "")
    );
  }

  if (!textBlock) {
    // This is the bug we're chasing -- 200 OK but no usable text block.
    // Surface everything that could explain why: stop reason, what block
    // types actually came back, and token usage, so the next failure is
    // legible instead of a generic "no text returned."
    const blockTypes = blocks.map((b) => b.type).join(", ") || "(no content blocks at all)";
    const usage = data.usage ? JSON.stringify(data.usage) : "(no usage info)";
    throw new Error(
      "Model returned no usable text. stop_reason=" +
        (data.stop_reason || "unknown") +
        " | content block types=[" +
        blockTypes +
        "] | usage=" +
        usage +
        (blocks.length ? " | first block preview=" + JSON.stringify(blocks[0]).slice(0, 300) : "")
    );
  }

  return { text: textBlock.text, stopReason: data.stop_reason };
}

// Best-effort repair for the model's most common JSON mistake: a literal
// quote mark inside a string value (usually an inch mark, e.g. `8" flashing`)
// that isn't escaped and prematurely terminates the JSON string. Walks the
// text tracking whether we're inside a string; when a `"` appears mid-string
// and isn't actually closing it (i.e. not followed by whitespace then a
// structural character like , : } ]), treat it as a stray quote and escape it.
function repairUnescapedQuotes(text) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === "\\" && inString) {
      // Preserve existing escape sequences verbatim.
      out += ch + (text[i + 1] || "");
      i++;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        out += ch;
        continue;
      }
      // We're inside a string and hit a quote -- decide if it's the real
      // closing quote by peeking ahead past whitespace.
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      const next = text[j];
      const closesString = next === undefined || ",:}]".includes(next);
      if (closesString) {
        inString = false;
        out += ch;
      } else {
        // Stray quote (e.g. an inch mark) -- escape it and stay in-string.
        out += '\\"';
      }
      continue;
    }

    out += ch;
  }
  return out;
}

function parseJsonLoose(text) {
  let clean = text.trim();
  clean = clean.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(clean);
  } catch (firstErr) {
    try {
      return JSON.parse(repairUnescapedQuotes(clean));
    } catch (secondErr) {
      // Surface the actual text so a truncated/malformed response is
      // debuggable instead of just "Unexpected token".
      throw new Error(
        "Could not parse the model's JSON output (" + firstErr.message +
          "; repair attempt also failed: " + secondErr.message +
          "). Raw output (first 500 chars): " + clean.slice(0, 500)
      );
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { mode, payload } = req.body || {};

  try {
    if (mode === "extract") {
      if (!payload || !payload.scopeText || !payload.scopeText.trim()) {
        res.status(400).json({ error: "No scope text provided." });
        return;
      }
      const { text } = await callAnthropic(SYSTEM_EXTRACT, payload.scopeText, 2000);
      const items = parseJsonLoose(text);
      res.status(200).json({ items });
      return;
    }

    if (mode === "extractPdf") {
      if (!payload || !payload.pdfBase64) {
        res.status(400).json({ error: "No PDF data provided." });
        return;
      }
      const content = [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: payload.mediaType || "application/pdf",
            data: payload.pdfBase64,
          },
        },
        { type: "text", text: "Extract the discrete billable line items from this insurance scope-of-work PDF, covering every page." },
      ];
      // Larger budget than the plain-text path -- a scanned multi-page
      // Xactimate PDF has a lot more to transcribe than pasted text, and a
      // truncated response was one candidate cause of the earlier failure.
      const { text } = await callAnthropic(SYSTEM_EXTRACT, content, 4000);
      const items = parseJsonLoose(text);
      res.status(200).json({ items });
      return;
    }

    if (mode === "analyze") {
      if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
        res.status(400).json({ error: "No line items provided to analyze." });
        return;
      }
      const userText =
        "Line items to analyze:\n" +
        payload.items.map((it) => it.ref + ": " + it.text).join("\n");
      const { text } = await callAnthropic(SYSTEM_ANALYZE, userText, 4000);
      const results = parseJsonLoose(text);
      res.status(200).json({ results });
      return;
    }

    if (mode === "cover") {
      const audience = payload.audience === "homeowner" ? "homeowner" : "adjuster";
      const system = audience === "homeowner" ? SYSTEM_COVER_HOMEOWNER : SYSTEM_COVER_ADJUSTER;
      const userText =
        "Claim reference: " + (payload.claimLabel || "Not provided") + "\n\n" +
        "Cascade findings (approved work that disturbs adjacent systems):\n" +
        (payload.cascadeItems || []).join("\n") + "\n\n" +
        "Rebuttal findings (denied, missing, or undervalued items):\n" +
        (payload.rebuttalItems || []).join("\n");
      const { text } = await callAnthropic(system, userText, 900);
      res.status(200).json({ text: text.trim(), audience });
      return;
    }

    if (mode === "supplementItems") {
      if (!payload || !payload.supplementNotes || !payload.supplementNotes.trim()) {
        res.status(400).json({ error: "Describe the additional damage or findings first." });
        return;
      }
      const originalContext = Array.isArray(payload.originalItems) && payload.originalItems.length
        ? "Carrier's original line items, for context on what's already approved/denied:\n" +
          payload.originalItems.map((it) => "- [" + it.category + "] " + it.itemText).join("\n") + "\n\n"
        : "";
      const userText =
        originalContext +
        "Contractor's field notes describing additional damage or findings not covered by the original estimate:\n" +
        payload.supplementNotes;
      const { text } = await callAnthropic(SYSTEM_SUPPLEMENT_ITEMS, userText, 3000);
      const items = parseJsonLoose(text);
      res.status(200).json({ items });
      return;
    }

    if (mode === "supplementLetter") {
      if (!payload || !Array.isArray(payload.supplementItems) || payload.supplementItems.length === 0) {
        res.status(400).json({ error: "No supplement items to write a letter for." });
        return;
      }
      const userText =
        "Claim reference: " + (payload.claimLabel || "Not provided") + "\n\n" +
        "Supplement items:\n" +
        payload.supplementItems
          .map(
            (it, i) =>
              (i + 1) + ". " + it.itemLabel + "\n   Requested: " + it.suggestedLineItem +
              "\n   Justification: " + it.justification +
              "\n   Confidence: " + it.confidence
          )
          .join("\n\n");
      const { text } = await callAnthropic(SYSTEM_SUPPLEMENT_LETTER, userText, 900);
      res.status(200).json({ text: text.trim() });
      return;
    }

    res.status(400).json({ error: "Unknown mode: " + mode });
  } catch (err) {
    console.error("analyze.js error:", mode, err);
    res.status(500).json({ error: (err && err.message) || "Unexpected server error" });
  }
}
