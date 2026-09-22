// ABC Supply API — Individual Business integration (OAuth2 client
// credentials, no per-user login). Server-side only: the client secret must
// never reach the browser bundle, so this is a Vercel function the
// GoodBetterBest pricing-settings screen calls, not a client-side module.
//
// Endpoints/shapes below are confirmed against the real Developer Portal
// app config (Source System ID 1016, Sandbox active) and the documented
// Price Items request/response — not inferred.
//
// Required env vars (Vercel project settings):
//   ABC_SUPPLY_ENV            — "sandbox" (default) or "production"
//   ABC_SUPPLY_CLIENT_ID, ABC_SUPPLY_CLIENT_SECRET

const ENDPOINTS = {
  sandbox: {
    tokenUrl: "https://sandbox.auth.partners.abcsupply.com/oauth2/aus1vp07knpuqf6Xz0h8/v1/token",
    pricingUrl: "https://partners-sb.abcsupply.com/api/pricing/v2/prices",
  },
  production: {
    tokenUrl: "https://auth.partners.abcsupply.com/oauth2/ausvvp0xuwGKLenYy357/v1/token",
    pricingUrl: "https://partners.abcsupply.com/api/pricing/v2/prices",
  },
};

function getEndpoints() {
  const env = (process.env.ABC_SUPPLY_ENV || "sandbox").toLowerCase();
  const endpoints = ENDPOINTS[env];
  if (!endpoints) throw new Error(`ABC_SUPPLY_ENV must be "sandbox" or "production", got "${env}"`);
  return endpoints;
}

let cachedToken = null; // { accessToken, expiresAt }

// Access tokens last 30 minutes per ABC's docs; refresh a little early.
async function getAbcSupplyToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.accessToken;

  const { tokenUrl } = getEndpoints();
  const clientId = process.env.ABC_SUPPLY_CLIENT_ID;
  const clientSecret = process.env.ABC_SUPPLY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("ABC_SUPPLY_CLIENT_ID and ABC_SUPPLY_CLIENT_SECRET must be set");

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/x-www-form-urlencoded" },
    // Only the 4 scopes this app was actually granted at signup.
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "location.read product.read account.read pricing.read" }),
  });
  if (!res.ok) throw new Error(`ABC Supply auth failed (${res.status}): ${await res.text()}`);

  const data = await res.json();
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 1800) * 1000 };
  return cachedToken.accessToken;
}

const MAX_LINES_PER_REQUEST = 50;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// items: [{ itemNumber, quantity?, uom }]
async function priceAbcItems(items, shipToNumber, branchNumber) {
  const { pricingUrl } = getEndpoints();
  const token = await getAbcSupplyToken();
  const results = [];

  for (const batch of chunk(items, MAX_LINES_PER_REQUEST)) {
    const res = await fetch(pricingUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: `freedom-exteriors-${Date.now()}`,
        shipToNumber,
        branchNumber,
        purpose: "estimating",
        lines: batch.map((it, i) => ({ id: String(i + 1), itemNumber: it.itemNumber, quantity: it.quantity || 1, uom: it.uom })),
      }),
    });
    if (!res.ok) throw new Error(`ABC Supply price-items error ${res.status}: ${await res.text()}`);
    const data = await res.json();

    // HTTP 200 doesn't mean every line priced — check status.code per line.
    // A $0 unitPrice with status.code "OK" means the branch hasn't entered
    // pricing for that item yet, not a real free price.
    for (let i = 0; i < batch.length; i++) {
      const line = (data.lines || [])[i];
      const zeroButOk = line && line.status?.code === "OK" && line.unitPrice === 0;
      const priced = line && line.status?.code === "OK" && line.unitPrice > 0;
      let statusMessage = line?.status?.message || (line ? undefined : "No line returned for this item");
      if (zeroButOk) statusMessage = "Branch hasn't entered pricing for this item yet ($0.00, not a real rate)";
      results.push({
        itemNumber: batch[i].itemNumber,
        unitPrice: priced ? line.unitPrice : null,
        uom: line?.uom || batch[i].uom,
        statusCode: line?.status?.code || "MISSING",
        statusMessage,
      });
    }
  }

  return results;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { items, shipToNumber, branchNumber } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items (non-empty array of {itemNumber, uom}) is required" });
  if (!shipToNumber) return res.status(400).json({ error: "shipToNumber is required" });
  if (!branchNumber) return res.status(400).json({ error: "branchNumber is required" });

  try {
    const prices = await priceAbcItems(items, shipToNumber, branchNumber);
    return res.status(200).json({ prices, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
