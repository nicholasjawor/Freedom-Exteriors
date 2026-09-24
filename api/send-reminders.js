// Daily Vercel cron (see vercel.json): texts homeowners whose install is
// tomorrow. Vercel sends "Authorization: Bearer $CRON_SECRET" automatically.
import { supabaseAdmin } from "./_lib/supabase.js";

// Tomorrow's date (YYYY-MM-DD) in Minnesota time, matching how installDate is entered.
function tomorrowCentral() {
  return new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function formatPhone(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits[0] === "1") return "+" + digits;
  return "+" + digits;
}

async function sendSms(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const credentials = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_PHONE_NUMBER, Body: body }).toString(),
  });
  const data = await res.json();
  if (!data.sid) throw new Error(data.message || `Twilio error ${res.status}`);
  return data.sid;
}

export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tomorrow = tomorrowCentral();
  const { data: rows, error } = await supabaseAdmin()
    .from("jobs").select("data").eq("user_email", "all").gt("job_id", 0);
  if (error) return res.status(500).json({ error: error.message });

  const toRemind = (rows || []).map(r => r.data)
    .filter(job => job && job.installDate === tomorrow && job.phone && job.stage === "scheduled");

  const results = [];
  for (const job of toRemind) {
    try {
      const sid = await sendSms(formatPhone(job.phone),
        `Hi ${job.name}! Reminder from Freedom Exteriors — your ${job.type} installation is scheduled for TOMORROW. We'll be there bright and early! Questions? Call (651) 283-1689.`);
      results.push({ job: job.id, sid, status: "sent" });
    } catch (e) {
      results.push({ job: job.id, status: "failed", error: e.message });
    }
  }
  return res.status(200).json({ date: tomorrow, reminded: results.length, results });
}
