// Called by the portal after Stripe redirects back. Marks the deposit paid only
// if Stripe confirms this checkout session was paid for this portal link.
import { supabaseAdmin } from "./_lib/supabase.js";
import { stripeRequest } from "./_lib/stripe.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { portalToken, sessionId } = req.body || {};
  if (!portalToken || !sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return res.status(400).json({ error: "Missing payment details" });
  }

  let session;
  try {
    session = await stripeRequest("GET", `checkout/sessions/${sessionId}`);
  } catch (e) {
    return res.status(400).json({ error: "Payment not found" });
  }
  if (session.payment_status !== "paid" || session.metadata?.portalToken !== portalToken) {
    return res.status(400).json({ error: "Payment not confirmed" });
  }

  const { data: job, error } = await supabaseAdmin().rpc("mark_deposit_paid", {
    p_token: portalToken,
    p_session_id: session.id,
    p_amount: (session.amount_total || 0) / 100,
  });
  if (error) return res.status(500).json({ error: "Could not record payment" });
  return res.status(200).json({ job });
}
