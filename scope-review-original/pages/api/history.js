// Server-side proxy to Supabase for shared "past analyses" history.
// Uses the service_role key so it bypasses RLS -- this route is the only
// place that key is ever used, and it never reaches the browser.

// HTTP header values must be Latin-1 (code points 0-255). A key or URL copied
// with hidden formatting (smart quotes, an arrow, a stray emoji) silently
// breaks every fetch with "Cannot convert argument to a ByteString" -- this
// finds the exact bad character so the fix is "re-copy this env var" instead
// of a guessing game.
function assertLatin1(value, label) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 255) {
      throw new Error(
        label + " contains an invalid character at position " + i +
          " (code point " + code + ", likely picked up from a copy-paste with hidden formatting). " +
          "Re-copy " + label + " from its source and update it in Vercel -> Project Settings -> Environment Variables, then redeploy."
      );
    }
  }
}

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Shared history isn't configured yet. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel -> Project Settings -> Environment Variables, then redeploy."
    );
  }
  assertLatin1(url, "SUPABASE_URL");
  assertLatin1(key, "SUPABASE_SERVICE_ROLE_KEY");
  return {
    base: url + "/rest/v1/analyses",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
  };
}

export default async function handler(req, res) {
  try {
    const { base, headers } = config();

    if (req.method === "GET") {
      const { id } = req.query;
      if (id) {
        const r = await fetch(base + "?id=eq." + encodeURIComponent(id) + "&select=*", { headers });
        if (!r.ok) throw new Error("Supabase error (" + r.status + "): " + (await r.text()).slice(0, 300));
        const data = await r.json();
        res.status(200).json({ record: data[0] || null });
        return;
      }
      const r = await fetch(base + "?select=id,claim_label,created_at&order=created_at.desc&limit=100", { headers });
      if (!r.ok) throw new Error("Supabase error (" + r.status + "): " + (await r.text()).slice(0, 300));
      const data = await r.json();
      res.status(200).json({ list: data });
      return;
    }

    if (req.method === "POST") {
      const { claimLabel, scopeText, results, coverParagraph, homeownerSummary, supplementNotes, supplementItems, supplementLetter } = req.body || {};
      const r = await fetch(base, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify([
          {
            claim_label: claimLabel || "Untitled",
            scope_text: scopeText || "",
            results,
            cover_paragraph: coverParagraph || null,
            homeowner_summary: homeownerSummary || null,
            supplement_notes: supplementNotes || null,
            supplement_items: supplementItems || null,
            supplement_letter: supplementLetter || null,
          },
        ]),
      });
      if (!r.ok) throw new Error("Supabase error (" + r.status + "): " + (await r.text()).slice(0, 300));
      const data = await r.json();
      res.status(200).json({ record: data[0] });
      return;
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) {
        res.status(400).json({ error: "Missing id" });
        return;
      }
      const r = await fetch(base + "?id=eq." + encodeURIComponent(id), { method: "DELETE", headers });
      if (!r.ok) throw new Error("Supabase error (" + r.status + "): " + (await r.text()).slice(0, 300));
      res.status(200).json({ deleted: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("history.js error:", err);
    res.status(500).json({ error: (err && err.message) || "Unexpected server error" });
  }
}
