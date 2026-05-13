/* Cloudflare Pages Function — POST /api/contact
 *
 * Backs the public contact form. The form collects ONLY: name, email, optional
 * phone, optional organization, and a free-text message. It must never collect
 * patient information — the page copy says so, and this handler refuses anything
 * that looks like PHI in the message body as a backstop.
 *
 * Delivery: if RESEND_API_KEY (and CONTACT_FROM / CONTACT_TO) are configured as
 * Cloudflare secrets, the message is emailed via Resend. If not configured, the
 * submission is accepted and a non-PHI line is logged, but no email is sent —
 * this is the current pre-launch state (see docs/build-log.md "Known gaps").
 *
 * Environment variables (all optional until launch):
 *   RESEND_API_KEY   Resend API key
 *   CONTACT_TO       destination address (default rx@petersonmedicalequipment.com)
 *   CONTACT_FROM     verified sender address on a domain you control in Resend
 */

const MAX = { name: 120, email: 200, phone: 40, org: 160, message: 4000 };
const DEFAULT_TO = "rx@petersonmedicalequipment.com";

const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b[1-9][A-Za-z][0-9A-Za-z]\d[A-Za-z][0-9A-Za-z]\d[A-Za-z]{2}\d{2}\b/,
  /\bMBI\b/i,
  /\bD\.?O\.?B\.?\b/i,
  /date of birth/i,
  /patient\s*(name|dob|address|phone|mbi)\s*[:#=]/i,
  /\bmedicare\s*(id|number|beneficiary)\s*[:#=]/i,
  /\bSSN\b/i
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
  });
}
function clean(v, max) { return (typeof v === "string" ? v : "").trim().slice(0, max); }

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch (_) { return json({ ok: false, error: "Invalid request." }, 400); }

  // Honeypot — bots fill hidden fields; humans don't.
  if (body && typeof body.company_website === "string" && body.company_website.trim() !== "") {
    return json({ ok: true }); // silently accept and drop
  }

  const name = clean(body && body.name, MAX.name);
  const email = clean(body && body.email, MAX.email);
  const phone = clean(body && body.phone, MAX.phone);
  const org = clean(body && body.org, MAX.org);
  const message = clean(body && body.message, MAX.message);

  if (!name) return json({ ok: false, error: "Please include your name." }, 400);
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: "Please include a valid email address." }, 400);
  if (!message) return json({ ok: false, error: "Please include a message." }, 400);
  if (PHI_PATTERNS.some((re) => re.test(message))) {
    return json({
      ok: false,
      error: "For your patients' privacy, please don't include any patient details in this form. " +
        "For patient-specific or order-specific questions, call us at 509-783-7501 or fax a Standard Written Order to 509-980-7062."
    }, 422);
  }

  const to = (env && env.CONTACT_TO && String(env.CONTACT_TO).trim()) || DEFAULT_TO;
  const from = env && env.CONTACT_FROM && String(env.CONTACT_FROM).trim();
  const resendKey = env && env.RESEND_API_KEY && String(env.RESEND_API_KEY).trim();

  const text =
    "New website contact form submission\n\n" +
    "Name:         " + name + "\n" +
    "Email:        " + email + "\n" +
    "Phone:        " + (phone || "(not provided)") + "\n" +
    "Organization: " + (org || "(not provided)") + "\n\n" +
    "Message:\n" + message + "\n";

  if (resendKey && from) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": "Bearer " + resendKey },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: email,
          subject: "Website contact — " + name + (org ? " (" + org + ")" : ""),
          text
        })
      });
      if (!r.ok) {
        // Accept the submission but tell the user a phone fallback exists.
        return json({ ok: false, error: "We couldn't send your message just now. Please call 509-783-7501 or email rx@petersonmedicalequipment.com." }, 502);
      }
      return json({ ok: true });
    } catch (_) {
      return json({ ok: false, error: "We couldn't send your message just now. Please call 509-783-7501 or email rx@petersonmedicalequipment.com." }, 502);
    }
  }

  // No email provider configured yet (pre-launch). Accept and log a non-PHI line.
  // This branch must be replaced before go-live — see docs/build-log.md.
  console.log("[contact] submission accepted (no email provider configured) from " + email);
  return json({ ok: true, note: "received" });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "allow": "POST, OPTIONS" } });
}
