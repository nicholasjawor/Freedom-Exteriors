// ABC Supply API — Individual Business integration (OAuth2 client
// credentials, no per-user login). Server-side only: the client secret must
// never reach the browser bundle, so this is a Vercel function the
// GoodBetterBest pricing-settings screen calls, not a client-side module.
//
// VERIFICATION STATUS: apidocs.abcsupply.com was unreachable from the
// environment this was written in, so the OAuth2 client-credentials grant
// below is standard/well-known and should be correct as-is, but the Price
// Items REQUEST/RESPONSE FIELD NAMES are inferred from a partner brief, not
// the real API spec — confirm against apidocs.abcsupply.com/price-items/
// (or a live sandbox response) and adjust only the marked spot.
//
// Required env vars (Vercel project settings):
//   ABC_SUPPLY_TOKEN_URL, ABC_SUPPLY_API_BASE,
//   ABC_SUPPLY_CLIENT_ID, ABC_SUPPLY_CLIENT_SECRET

let cachedToken = null; // { accessToken, expiresAt }

async function getAbcSupplyToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const tokenUrl = process.env.ABC_SUPPLY_TOKEN_URL;
  const clientId = process.env.ABC_SUPPLY_CLIENT_ID;
  const clientSecret = process.env.ABC_SUPPLY_CLIENT_SECRET;
  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error("ABC_SUPPLY_TOKEN_URL, ABC_SUPPLY_CLIENT_ID, and ABC_SUPPLY_CLIENT_SECRET must be set");
  }

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`ABC Supply auth failed (${res.status}): ${await res.text()}`);

  const data = await res.json();
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return cachedToken.accessToken;
}

// VERIFY: request/response field names inferred from the brief, not
// confirmed docs — the one confirmed detail (per apidocs.abcsupply.com
// search results) is that omitting unitOfMeasure returns pricing in ABC's
// internal "stocking" unit, which comes back in the response.
async function priceAbcItems(itemIds, shipToAccountNumber) {
  const apiBase = process.env.ABC_SUPPLY_API_BASE;
  if (!apiBase) throw new Error("ABC_SUPPLY_API_BASE must be set");
  if (!shipToAccountNumber) throw new Error("shipToAccountNumber is required");

  const token = await getAbcSupplyToken();
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/price-items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ shipToAccountNumber, items: itemIds.map((itemId) => ({ itemId })) }),
  });
  if (!res.ok) throw new Error(`ABC Supply price-items error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const priced = data.items || data.prices || [];
  return priced.map((it) => ({
    itemId: it.itemId ?? it.id,
    unitPrice: typeof it.unitPrice === "number" ? it.unitPrice : (typeof it.price === "number" ? it.price : null),
    unitOfMeasure: it.unitOfMeasure ?? it.uom ?? null,
  }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { itemIds, shipToAccountNumber } = req.body || {};
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({ error: "itemIds (non-empty array) is required" });
  }
  if (!shipToAccountNumber) return res.status(400).json({ error: "shipToAccountNumber is required" });

  try {
    const prices = await priceAbcItems(itemIds, shipToAccountNumber);
    return res.status(200).json({ prices, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
