export default async function handler(req, res) {
  const { action } = req.query;

  if (action === "auth") {
    const params = new URLSearchParams({
      client_id: process.env.QB_CLIENT_ID,
      response_type: "code",
      scope: "com.intuit.quickbooks.accounting",
      redirect_uri: "https://freedom-exteriors.vercel.app/quickbooks/callback",
      state: "freedom-exteriors",
    });
    return res.redirect(`https://appcenter.intuit.com/connect/oauth2?${params}`);
  }

  if (action === "callback") {
    const { code, realmId } = req.query;
    try {
      const credentials = Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString("base64");
      const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: "https://freedom-exteriors.vercel.app/quickbooks/callback",
        }).toString(),
      });
      const tokens = await tokenRes.json();
      if (tokens.access_token) {
        return res.redirect(`https://freedom-exteriors.vercel.app?qb_token=${tokens.access_token}&qb_realm=${realmId}`);
      } else {
        return res.redirect(`https://freedom-exteriors.vercel.app?qb_error=token_failed`);
      }
    } catch(e) {
      return res.redirect(`https://freedom-exteriors.vercel.app?qb_error=${e.message}`);
    }
  }

  if (action === "invoice" && req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;`n      const { realmId, accessToken, job } = body;
    try {
      const invoiceRes = await fetch(`https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/invoice?minorversion=65`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          Line: [{
            Amount: job.estimate?.total || 0,
            DetailType: "SalesItemLineDetail",
            SalesItemLineDetail: {
              ItemRef: { value: "1", name: "Services" },
            },
            Description: `${job.type} - ${job.address}, ${job.city}, ${job.state}`,
          }],
          CustomerRef: { name: job.name },
        }),
      });
      const invoice = await invoiceRes.json();
      if (invoice.Invoice) {
        return res.status(200).json({ success: true, invoice: invoice.Invoice });
      } else {
        return res.status(400).json({ error: invoice });
      }
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(400).json({ error: "Invalid action" });
}
