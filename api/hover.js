// Hover OAuth + measurements. The Hover token is stored in a reserved jobs row
// (user_email = "hover_token"), read/written only with the service role key.
import { requireStaff, supabaseAdmin } from "./_lib/supabase.js";

const HOVER_TOKEN_URL = "https://hover.to/oauth/token";
const HOVER_API_BASE = "https://hover.to/api/v3";
// Must exactly match the redirect URI registered on the Hover integration
// (Hover > Settings > Developer). vercel.json rewrites it to ?action=callback.
const REDIRECT_URI = "https://freedom-exteriors.vercel.app/hover/callback";

async function getStoredToken() {
  const { data } = await supabaseAdmin().from("jobs").select("data").eq("user_email", "hover_token").maybeSingle();
  return data?.data || null;
}

async function storeToken(tokenData) {
  const db = supabaseAdmin();
  if (await getStoredToken()) {
    await db.from("jobs").update({ data: tokenData }).eq("user_email", "hover_token");
  } else {
    await db.from("jobs").insert({ user_email: "hover_token", data: tokenData });
  }
}

async function requestToken(params) {
  const res = await fetch(HOVER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, client_id: process.env.HOVER_CLIENT_ID, client_secret: process.env.HOVER_CLIENT_SECRET }),
  });
  return res.json();
}

async function getValidToken() {
  const stored = await getStoredToken();
  if (!stored?.access_token) return null;
  if (Date.now() <= stored.expires_at - 60000) return stored.access_token;
  const data = await requestToken({ grant_type: "refresh_token", refresh_token: stored.refresh_token });
  if (!data.access_token) return null;
  await storeToken({
    access_token: data.access_token,
    refresh_token: data.refresh_token || stored.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  });
  return data.access_token;
}

export default async function handler(req, res) {
  const action = req.query.action;

  if (action === "auth") {
    const authUrl = `https://hover.to/oauth/authorize?client_id=${process.env.HOVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;
    return res.redirect(authUrl);
  }

  if (action === "callback") {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: "No code received" });
    const tokenData = await requestToken({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI });
    if (!tokenData.access_token) return res.status(400).json({ error: "Token exchange failed" });
    await storeToken({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
    });
    return res.redirect("/?hover_connected=true");
  }

  if (action === "measurements" && req.method === "GET") {
    if (!(await requireStaff(req, res))) return;
    const { hoverId } = req.query;
    if (!hoverId || !/^\d+$/.test(String(hoverId))) return res.status(400).json({ error: "Valid hoverId required" });

    try {
      const token = await getValidToken();
      // 401 tells the app to send the user through Hover's login (action=auth).
      if (!token) return res.status(401).json({ error: "Hover isn't connected yet" });

      const jobRes = await fetch(`${HOVER_API_BASE}/jobs/${hoverId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (jobRes.status === 401) return res.status(401).json({ error: "Hover session expired" });
      if (!jobRes.ok) return res.status(jobRes.status).json({ error: `Hover API error ${jobRes.status}` });

      const jobData = await jobRes.json();
      const job = jobData.job || jobData;
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
      return res.status(200).json({ success: true, measurements });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: "Invalid action" });
}
