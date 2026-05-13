/* Cloudflare Pages Function — POST /api/coverage-assistant
 *
 * The "Coverage & SWO Requirements" assistant. Takes a provider's general question
 * about ordering / documentation requirements, asks the Anthropic Messages API
 * (single shot — no tool loop, so no Agent SDK needed), and returns:
 *     { answer: string, citations: [{code,label,url?}], disclaimer: string }
 * or, if the input looks like patient data:
 *     { refused: true, message: string }
 *
 * Environment variables (set as Cloudflare Pages secrets — never commit them):
 *   ANTHROPIC_API_KEY   (required)  the Anthropic API key
 *   ASSISTANT_MODEL     (optional)  model id; defaults to claude-sonnet-4-6
 *
 * SOURCE OF TRUTH for the regulatory facts below: CLAUDE.md §2 and §3. The
 * browser copy lives at assets/js/coverage-data.js. Keep all three in sync.
 *
 * Nothing patient-specific is ever logged. The request body is not logged.
 */

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_QUESTION_LEN = 600;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const PHONE = "509-783-7501";
const ORDERS_EMAIL = "rx@petersonmedicalequipment.com";

const DISCLAIMER =
  "This is general reference information drawn from the governing LCDs and federal rules — " +
  "not a coverage determination and not a guarantee of payment. Coverage always depends on the " +
  "individual patient's medical record and their payer. For a patient-specific question, call " +
  "Peterson Medical Equipment at " + PHONE + ".";

/* Loose PHI sniff — same intent as the client-side check; false positives are fine. */
const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,                                                  // SSN-like
  /\b[1-9][A-Za-z][0-9A-Za-z]\d[A-Za-z][0-9A-Za-z]\d[A-Za-z]{2}\d{2}\b/,    // MBI-like
  /\bMBI\b/i,
  /\bD\.?O\.?B\.?\b/i,
  /date of birth/i,
  /patient\s*(name|dob|d\.o\.b|address|phone|mbi)\s*[:#=]/i,
  /\bmedicare\s*(id|number|beneficiary)\s*[:#=]/i,
  /\bSSN\b/i
];

function looksLikePHI(text) {
  return PHI_PATTERNS.some((re) => re.test(text));
}

/* Compact knowledge base passed to the model. Mirrors CLAUDE.md §2/§3. */
const COVERAGE = {
  supplier: {
    name: "Peterson Medical Equipment (DBA of Peterson Medical LLC)",
    npi: "1528924479",
    location: "Kennewick, WA",
    statesLicensed: ["WA", "OR"],
    dmeMac: "Noridian (Jurisdiction D — covers WA and OR)",
    phone: PHONE,
    ordersEmail: ORDERS_EMAIL,
    fax: "509-980-7062"
  },
  swoRequiredElements: [
    "Beneficiary's name OR Medicare Beneficiary Identifier (MBI)",
    "Order date",
    "General description of the item (HCPCS code, brand/model, or a narrative description)",
    "Quantity, if applicable",
    "Treating practitioner's name OR NPI",
    "Treating practitioner's signature"
  ],
  rules: {
    swoAuthority: { code: "A55426", label: "CMS Article A55426 — Standard Written Order (SWO) requirements" },
    faceToFace: { code: "42 CFR 410.38", label: "Face-to-face encounter requirement", windowMonths: 6,
      detail: "For applicable DME, the treating practitioner must have a face-to-face encounter with the patient within the 6 months before the order, documented in the medical record." },
    recordRetention: { code: "42 CFR 424.57(c)(9)", label: "DMEPOS supplier record retention — 7-year minimum", note: "Peterson retains records for 10 years." },
    l0651PriorAuth: { code: "CMS-6097-N (91 FR 1250)", label: "L0651 added to the Required Prior Authorization List", effectiveDate: "2026-04-13" },
    l0648l0650PriorAuth: { code: "87 FR 2051", label: "L0648 and L0650 prior authorization requirement", effectiveDate: "2022-04-13" },
    supplierMoratorium: { code: "CMS-6099-N (91 FR 9855)", label: "Temporary moratorium on new DMEPOS supplier enrollment", effectiveDate: "2026-02-27",
      note: "This affects supplier enrollment, not referring providers — mention it only if specifically asked about becoming a DMEPOS supplier." }
  },
  productLines: {
    "bone growth stimulator (E0748)": {
      hcpcs: ["E0748"],
      governingLCD: { code: "L33796", label: "LCD L33796 — Osteogenesis Stimulators" },
      priorAuthRequired: false,
      wopdRequired: false,
      faceToFaceRequired: true,
      defaultDispensing: "NU (new purchase)",
      treatmentEpisode: "270-day single treatment episode",
      manufacturersCarried: ["Zimmer Biomet SpinalPak II", "Enovis/DJO SpinalLogic", "Orthofix Spinal-Stim", "Orthofix Cervical-Stim (on request)"],
      notes: "No prior authorization. Coverage is decided on clinical review per the payer under LCD L33796."
    },
    "spinal orthoses — Trend line (TLSO / LSO)": {
      governingLCD: { code: "L33790", label: "LCD L33790 — Spinal Orthoses: TLSO and LSO" },
      faceToFaceRequired: true,
      items: [
        { hcpcs: "L0457", product: "Trend Correx TLSO (DCT-5657)", description: "TLSO, flexible trunk, sacro-scapular, prefabricated OTS", priorAuthRequired: false, wopdRequired: false },
        { hcpcs: "L0464", product: "Trend Correx SP TLSO (DCT-0464)", description: "TLSO, 4 rigid panels, sacro-scapular, prefabricated OTS", priorAuthRequired: false, wopdRequired: false },
        { hcpcs: "L0648", product: "Trend LSO (DCT-31)", description: "LSO, sagittal, rigid anterior/posterior panels, prefabricated OTS", priorAuthRequired: true, priorAuthSince: "2022-04-13", wopdRequired: true },
        { hcpcs: "L0650", product: "Trend Pro LSO (DCT-37)", description: "LSO, sagittal-coronal, rigid anterior/posterior panels, prefabricated OTS", priorAuthRequired: true, priorAuthSince: "2022-04-13", wopdRequired: true },
        { hcpcs: "L0651", product: "Trend Extend LSO (DCT-3951)", description: "LSO, sagittal-coronal, shell & panel, prefabricated OTS", priorAuthRequired: true, priorAuthSince: "2026-04-13", wopdRequired: true }
      ],
      notes: "L0648, L0650 and L0651 require prior authorization AND a Written Order Prior to Delivery (WOPD). L0651's PA requirement is new — effective 2026-04-13. L0457 and L0464 do not require PA or a WOPD."
    },
    "surgical dressings — Vitalé line": {
      governingLCD: { code: "L33831", label: "LCD L33831 — Surgical Dressings" },
      priorAuthRequired: false,
      wopdRequired: false,
      faceToFaceRequired: false,
      items: [
        { hcpcs: "A6010", product: "Collagen Powder", sizes: "1 g packets" },
        { hcpcs: "A6021", product: "Collagen Dressing", sizes: "2 in x 2 in" },
        { hcpcs: "A6023", product: "Collagen Dressing", sizes: "7 in x 7 in" },
        { hcpcs: "A6203", product: "Composite Island Dressing", sizes: "4 in x 6 in; 4 in x 10 in" },
        { hcpcs: "A6203", product: "Silicone Composite Dressing", sizes: "3.5 in x 4 in" },
        { hcpcs: "A6204", product: "Composite Island Dressing", sizes: "4 in x 14 in" },
        { hcpcs: "A6204", product: "Silicone Composite Dressing", sizes: "9 in x 9 in" }
      ],
      notes: "Billed under LCD L33831. Other dressing categories (alginate, foam, hydrogel) can be sourced on request."
    }
  },
  howToOrder: "Fax a completed Standard Written Order to " + "509-980-7062" + ", email " + ORDERS_EMAIL + ", or call " + PHONE +
    ". A verified web ordering portal is in development; ask Peterson to be added to the early-access list."
};

/* Map of citation code -> authoritative URL. The model returns code + label; the
   Function attaches the URL so the model can't invent links. Codes the model
   returns that aren't in this map are still passed through (without a url). */
const CITE_URLS = {
  "A55426": "https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=55426",
  "L33796": "https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdId=33796",
  "L33790": "https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdId=33790",
  "L33831": "https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdId=33831",
  "42 CFR 410.38": "https://www.ecfr.gov/current/title-42/section-410.38",
  "42 CFR 424.57(c)(9)": "https://www.ecfr.gov/current/title-42/section-424.57",
  "CMS-6097-N (91 FR 1250)": "https://www.federalregister.gov/",
  "87 FR 2051": "https://www.federalregister.gov/",
  "CMS-6099-N (91 FR 9855)": "https://www.federalregister.gov/"
};

function systemPrompt(todayISO) {
  return [
    "You are the \"Coverage & SWO Requirements\" assistant for Peterson Medical Equipment, a DMEPOS supplier in Kennewick, Washington that serves Washington and Oregon. Your audience is referring physicians and their office staff — treat them as professional peers: be concise, direct, and precise.",
    "",
    "Today's date is " + todayISO + ". Use it when a rule has an effective date (e.g. say whether a prior-authorization requirement is currently in effect).",
    "",
    "SCOPE — answer ONLY using the KNOWLEDGE BASE below. You may answer questions about:",
    "  • what a Standard Written Order (SWO) must contain;",
    "  • the face-to-face encounter requirement and its timing;",
    "  • Written Order Prior to Delivery (WOPD) requirements;",
    "  • prior-authorization rules for the specific HCPCS codes Peterson carries (and their effective dates);",
    "  • the product lines Peterson carries, their governing LCDs, and the manufacturers/products in each line;",
    "  • how to place an order with Peterson.",
    "If the question is outside that scope — general clinical advice, coding for items Peterson does not carry, billing rates, anything you do not have a fact for in the KNOWLEDGE BASE — do not guess. Briefly say it's outside what you can answer and tell them to call " + PHONE + ".",
    "",
    "HARD RULES:",
    "  1. Never state or imply that an item \"will be covered\" or \"is approved\". Speak only in terms of requirements and documentation. Coverage is never guaranteed.",
    "  2. If the question contains anything resembling patient-identifying information (a person's name used as a patient, date of birth, MBI/Medicare number, address, phone), do NOT answer the question. Instead respond with the JSON {\"refused\": true, \"message\": \"...\"} where the message politely asks them to remove patient details and ask in general terms (e.g. by HCPCS code), and gives the phone number for patient-specific questions.",
    "  3. Every regulatory or coverage claim you make must be backed by a citation from the KNOWLEDGE BASE — put each one in the citations array using the exact `code` strings shown in the KB (LCD numbers like \"L33790\", CFR cites like \"42 CFR 410.38\", article numbers like \"A55426\", Federal Register cites). Do not invent citation codes or URLs.",
    "  4. Keep answers tight: usually 2–6 sentences, or a short bulleted list. No headings. No markdown links. Plain text only in the `answer` field; use \"- \" at the start of a line for bullet items.",
    "",
    "OUTPUT — respond with exactly one JSON object and nothing else. Either:",
    "  {\"answer\": \"<plain-text answer>\", \"citations\": [{\"code\": \"<KB code>\", \"label\": \"<short human label>\"}, ...]}",
    "or, if rule 2 applies:",
    "  {\"refused\": true, \"message\": \"<polite redirect>\"}",
    "",
    "KNOWLEDGE BASE (JSON):",
    JSON.stringify(COVERAGE, null, 2)
  ].join("\n");
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders
    }
  });
}

/* Pull the JSON object out of the model's reply, tolerant of stray prose. */
function parseModelJSON(text) {
  if (!text) return null;
  let s = text.indexOf("{");
  let e = text.lastIndexOf("}");
  if (s === -1 || e === -1 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch (_) { return null; }
}

function attachCitationUrls(citations) {
  if (!Array.isArray(citations)) return [];
  return citations
    .filter((c) => c && (c.code || c.label))
    .slice(0, 8)
    .map((c) => {
      const code = typeof c.code === "string" ? c.code.trim() : "";
      const out = { code, label: typeof c.label === "string" ? c.label.trim() : "" };
      if (code && CITE_URLS[code]) out.url = CITE_URLS[code];
      return out;
    });
}

export async function onRequestPost({ request, env }) {
  if (!env || !env.ANTHROPIC_API_KEY) {
    return json({ error: "The assistant isn't configured yet. Please call " + PHONE + " or email " + ORDERS_EMAIL + "." }, 503);
  }

  let body;
  try { body = await request.json(); }
  catch (_) { return json({ error: "Invalid request." }, 400); }

  const question = body && typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return json({ error: "Please include a question." }, 400);
  if (question.length > MAX_QUESTION_LEN) {
    return json({ error: "That question is too long — please shorten it to under " + MAX_QUESTION_LEN + " characters." }, 413);
  }
  if (looksLikePHI(question)) {
    return json({
      refused: true,
      message: "Please remove any patient details (names, dates of birth, Medicare numbers, addresses) and ask in general terms — " +
        "for example by HCPCS code or product name. For a patient-specific question, call us at " + PHONE + "."
    });
  }

  const model = (env.ASSISTANT_MODEL && String(env.ASSISTANT_MODEL).trim()) || DEFAULT_MODEL;
  const todayISO = new Date().toISOString().slice(0, 10);

  const payload = {
    model,
    max_tokens: 1024,
    temperature: 0.2,
    system: systemPrompt(todayISO),
    messages: [
      { role: "user", content: question },
      { role: "assistant", content: "{" } // prefill to force a JSON object
    ]
  };

  let apiRes;
  try {
    apiRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(payload)
    });
  } catch (_) {
    return json({ error: "Couldn't reach the assistant service. Please call " + PHONE + "." }, 502);
  }

  if (!apiRes.ok) {
    // Don't leak provider error bodies to the client.
    return json({ error: "The assistant is unavailable right now. Please call " + PHONE + " or email " + ORDERS_EMAIL + "." }, 502);
  }

  let data;
  try { data = await apiRes.json(); } catch (_) { return json({ error: "The assistant returned an unexpected response. Please call " + PHONE + "." }, 502); }

  const raw = Array.isArray(data && data.content)
    ? data.content.filter((b) => b && b.type === "text").map((b) => b.text).join("")
    : "";
  // We prefilled with "{", so the model's continuation completes that object.
  const parsed = parseModelJSON("{" + raw);

  if (parsed && parsed.refused) {
    return json({ refused: true, message: typeof parsed.message === "string" && parsed.message.trim()
      ? parsed.message.trim()
      : "Please ask in general terms without patient details. For patient-specific questions, call " + PHONE + "." });
  }

  const answer = parsed && typeof parsed.answer === "string" ? parsed.answer.trim() : (raw ? raw.trim() : "");
  if (!answer) {
    return json({ error: "The assistant couldn't produce an answer. Please call " + PHONE + " or email " + ORDERS_EMAIL + "." }, 502);
  }

  return json({
    answer,
    citations: attachCitationUrls(parsed && parsed.citations),
    disclaimer: DISCLAIMER
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "allow": "POST, OPTIONS" } });
}

/* Other verbs fall through to Cloudflare's default 405 for this route, which is
   what we want — only POST and OPTIONS are meaningful here. */
