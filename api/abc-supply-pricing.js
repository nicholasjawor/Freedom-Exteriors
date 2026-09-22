// Thin forwarder to the shared ABC Supply pricing Edge Function.
//
// The actual OAuth2/Price Items integration lives in exactly one place —
// the `abc-supply-pricing` Supabase Edge Function, deployed in this app's
// own Supabase project (klfrqwplazjryeppamtk) — so it isn't duplicated
// between this app and the bid-estimator, and the ABC client secret lives
// only in that function's Supabase secrets, never in either app's env vars.
//
// The function's verify_jwt is off (the bid-estimator's Supabase anon key
// belongs to a different project and could never produce a valid JWT
// against this one), so auth is a shared internal secret header instead —
// still server-to-server only: this file only ever runs as a Vercel
// function, never in the browser, and the browser only ever gets a price
// back from here, never the secret.
//
// Required env vars (Vercel project settings):
//   ABC_SUPPLY_EDGE_FUNCTION_URL  — https://klfrqwplazjryeppamtk.supabase.co/functions/v1/abc-supply-pricing
//   ABC_SUPPLY_INTERNAL_API_KEY   — must match the Edge Function's INTERNAL_API_KEY secret

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { items, shipToNumber, branchNumber } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items (non-empty array of {itemNumber, uom}) is required" });
  }
  if (!shipToNumber) return res.status(400).json({ error: "shipToNumber is required" });
  if (!branchNumber) return res.status(400).json({ error: "branchNumber is required" });

  const functionUrl = process.env.ABC_SUPPLY_EDGE_FUNCTION_URL;
  const internalKey = process.env.ABC_SUPPLY_INTERNAL_API_KEY;
  if (!functionUrl || !internalKey) {
    return res.status(500).json({ error: "ABC_SUPPLY_EDGE_FUNCTION_URL and ABC_SUPPLY_INTERNAL_API_KEY must be set" });
  }

  try {
    const upstream = await fetch(functionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-api-key": internalKey },
      body: JSON.stringify({ items, shipToNumber, branchNumber }),
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
