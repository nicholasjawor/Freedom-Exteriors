const twilio = require("twilio");
const { createClient } = require("@supabase/supabase-js");

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits[0] === "1") return "+" + digits;
  return "+" + digits;
}

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tomorrow = getTomorrow();

  const { data: rows, error } = await supabase
    .from("jobs")
    .select("data")
    .eq("user_email", "all");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const toRemind = (rows || [])
    .map((r) => r.data)
    .filter((job) => job.installDate === tomorrow && job.phone && job.stage === "scheduled");

  const results = [];
  for (const job of toRemind) {
    try {
      const msg = await twilioClient.messages.create({
        body: `Hi ${job.name}! Reminder from Freedom Exteriors — your ${job.type} installation is scheduled for TOMORROW. We'll be there bright and early! Questions? Call (651) 283-1689.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formatPhone(job.phone),
      });
      results.push({ name: job.name, sid: msg.sid, status