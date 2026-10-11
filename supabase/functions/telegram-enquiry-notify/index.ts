// Sends a seller their "new enquiry" / "new booking" Telegram message through
// the platform bot. Callers: DB triggers notify_salesman_new_enquiry (on
// whatsapp_enquiries) and notify_salesman_new_booking (on appointments).
//
// Deployed for months without being committed (v17). That version had no
// check at all, verify_jwt=false and CORS *: anyone could POST {chat_id,
// message} and have the XDrive bot send any text to any seller who had linked
// Telegram. Now it fails CLOSED unless the caller presents the same
// x-webhook-secret telegram-notify already uses (vault
// `telegram_webhook_secret` on the DB side, WEBHOOK_SECRET env here).
//
// Deploy order: run the SQL that adds the header to both triggers FIRST, then
// deploy this. The other way round drops every enquiry notification until the
// SQL lands.

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const secret = (Deno.env.get("WEBHOOK_SECRET") || "").trim();
  const presented = (req.headers.get("x-webhook-secret") || "").trim();
  if (secret.length === 0 || presented !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!BOT_TOKEN) {
    return new Response("No bot token", { status: 500 });
  }

  let body: { chat_id?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const { chat_id, message } = body;
  if (!chat_id || !message) {
    return new Response("Missing fields", { status: 400 });
  }

  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id,
        text: message,
        parse_mode: "Markdown",
      }),
    },
  );

  const result = await res.json();
  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
});
