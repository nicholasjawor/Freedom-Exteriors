const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { amount, customerName, jobType, portalToken } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Freedom Exteriors — ${jobType || "Project"} Deposit`,
              description: `Down payment deposit for ${customerName}`,
            },
            unit_amount: Math.round(amount * 100), // dollars to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.origin}/portal/${portalToken}?paid=true`,
      cancel_url: `${req.headers.origin}/portal/${portalToken}`,
      metadata: {
        portalToken,
        customerName,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error("Stripe error:", e.message);
    return res.status(500).json({ error: e.message });
  }
};