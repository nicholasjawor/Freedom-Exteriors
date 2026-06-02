const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const HOVER_TOKEN_URL = "https://hover.to/oauth/token";
const HOVER_API_BASE = "https://hover.to/api/v3";
const CLIENT_ID = process.env.HOVER_CLIENT_ID;
const CLIENT_SECRET = process.env.HOVER_CLIENT_SECRET;
const REDIRECT_URI = "https://freedom-exteriors.vercel.app/api/hover?action=callback";

// Store tokens in Supabase jobs table under a special row, or use a simple file approach
// We'll store the hover token in a dedicated supabase row with user_email = "hover_token"
async function getStoredToken() {
  const { data } = await supabase
    .from("jobs")
    .select("data")
    .eq("user_email", "hover_token")
    .single();
  return data?.data || null;
}

async function storeToken(tokenData) {
  const existing = await getStoredToken();
  if (existing) {
    await supabase
      .from("jobs")
      .update({ data: tokenData })
      .eq("user_email", "hover_token");
  } else {
    await supabase
      .from("jobs")
      .insert({ user_email: "hover_token", data: tokenData });
  }
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(HOVER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    const tokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    };
    await storeToken(tokenData);
    return tokenData.access_token;
  }
  throw new Error("Token refresh failed");
}

async function getValidToken() {
  const stored = await getStoredToken();
  if (!stored) throw new Error("Not authenticated with Hover");
  if (Date.now() > stored.expires_at - 60000) {
    return await refreshAccessToken(stored.refresh_token);
  }
  return stored.access_token;
}

module.exports = async (req, res) => {
  const action = req.query.action;

  // Step 1: Redirect to Hover OAuth
  if (action === "auth") {
    const authUrl = `https://hover.to/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=jobs:read`;
    return res.redirect(authUrl);
  }

  // Step 2: Handle OAuth callback
  if (action === "callback") {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: "No code received" });

    const tokenRes = await fetch(HOVER_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(400).json({ error: "Token exchange failed", details: tokenData });
    }

    await storeToken({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
    });

    return res.redirect("/?hover_connected=true");
  }

  // Step 3: Fetch measurements for a Hover job ID
  if (action === "measurements" && req.method === "GET") {
    const { hoverId } = req.query;
    if (!hoverId) return res.status(400).json({ error: "hoverId required" });

    try {
      const token = await getValidToken();

      const jobRes = await fetch(`${HOVER_API_BASE}/jobs/${hoverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!jobRes.ok) {
        return res.status(jobRes.status).json({ error: "Hover API error", status: jobRes.status });
      }

      const jobData = await jobRes.json();
      const job = jobData.job || jobData;

      // Extract the measurements we care about
      const measurements = {
        totalRoofArea: job.total_roof_area || null,
        predominantPitch: job.predominant_pitch || null,
        ridgeLength: job.ridge_length || null,
        valleyLength: job.valley_length || null,
        hipLength: job.hip_length || null,
        rakeLength: job.rake_length || null,
        eavesLength: job.eaves_length || null,
        flashingLength: job.flashing_length || null,
        stepFlashingLength: job.step_flashing_length || null,
        facets: job.facets?.length || null,
        address: job.address || null,
        fetchedAt: new Date().toISOString(),
      };

      return res.status(200).json({ success: true, measurements, raw: job });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: "Invalid action" });
};