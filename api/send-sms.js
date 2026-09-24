import { requireStaff } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await requireStaff(req, res))) return;
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { to, message } = body || {};
  if (!to || !message) return res.status(400).json({ error: "Missing to or message" });
  const formattedTo = to.startsWith("+") ? to : `+1${to.replace(/\D/g, "")}`;
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: formattedTo, From: from, Body: message }).toString()
    });
    const data = await response.json();
    if (data.sid) { return res.status(200).json({ success: true, sid: data.sid }); }
    else { return res.status(400).json({ error: data }); }
  } catch(e) { return res.status(500).json({ error: e.message }); }
}

