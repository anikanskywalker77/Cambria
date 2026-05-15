# Provider portal — functional & technical spec

*The "Cambria" platform that sits behind Peterson Medical Equipment.*

> **What this is.** The single design doc for the provider-facing web app at `portal.petersonmedicalequipment.com`. Captures user flows, the data model, integrations, the audit trail, the L0651 status logic, the Excel-roster differentiator, and a phased build plan. Where decisions are still open they're flagged in §13 with recommended picks and trade-offs. Update this doc as decisions land. **The marketing site is already live at petersonmedicalequipment.com — this is the next product.**
>
> **Companion docs:** [`CLAUDE.md`](../CLAUDE.md) (project context, regulatory constants), [`docs/build-log.md`](build-log.md) (dated change history), [`docs/marketing-site.md`](marketing-site.md), [`docs/ai-coverage-assistant.md`](ai-coverage-assistant.md).
>
> **Status:** spec — not implemented. Last updated 2026-05-14.

---

## 1. Overview

### 1.1 Why this exists

Spinal-DME ordering today moves on a fax-back loop: a partly-filled SWO goes out from the supplier, the prescriber's office completes it, faxes it back, the supplier finds something missing (one of the six required CMS elements, or face-to-face documentation, or — for L-codes — a Written Order Prior to Delivery), faxes back, and so on. This is slow, error-prone, and Peterson's own staff spend a meaningful chunk of every day chasing paperwork. The portal replaces that loop with a web flow where (a) the prescriber's identity is verified up front, (b) orders are checked for completeness *before* they're signed, (c) signatures happen electronically with a Certificate of Completion, and (d) signed orders are simultaneously delivered to Peterson's intake email, archived to Google Shared Drive at a canonical path, and recorded in Postgres — all atomically.

### 1.2 Audience and primary jobs

| User | What they want to do |
|---|---|
| **Referring physician** (the only role that can sign) | Sign one order, or sign 20 orders for a clinic's day in a single sitting, without re-doing data entry that an MA already did. |
| **Office staff** (MA, scheduler, intake coordinator) | Build draft orders for the physician to sign — usually one at a time today, eventually by uploading a roster spreadsheet. Never sign anything themselves. |
| **DME staff at Peterson** (intake/fitter) | See incoming orders in one queue. Confirm fit, dispense, and update status. Never sign anything either — they're the supplier. |
| **DME admin at Peterson** (Josh) | Provision practitioner accounts, see everything, audit. |
| **Auditor** (CMS, RAC, MAC contractor on a records request) | Time-boxed, read-only view of a specific date range or specific patient's records. Auto-revoked after the request closes. |
| **Patient** (Phase 2 only — minimal at launch) | See order status, get instructions for the device. |

### 1.3 Success criteria for v1 (the "we'd kill the fax line" bar)

1. ≥ 80% of new SWO volume comes through the portal within 3 months of pilot launch with the first 5 referring clinics.
2. Median time from "office staff submits a complete draft" to "order signed" < 24 hours.
3. Fewer than 5% of submitted orders need a documentation re-do (target is < 1%).
4. Zero PHI incidents in the first 12 months.
5. Audit-log retrieval for any historical order < 30 seconds.

---

## 2. Roles & accounts

The "Cambria" role model — six roles, role-based access enforced at the route, query (Postgres row-level security), and UI level.

| Role | Can sign? | Patient PHI access | Admin actions |
|---|---|---|---|
| **DME Admin** (Josh) | No | All patients across all practices | Provision practitioner accounts, impersonate (logged), invite/revoke staff, see audit log, run reports, manage sales reps and commission rules, run payout batches. |
| **DME Staff** (Peterson intake/fitters) | No | All patients in the order queue | Update fulfillment status, attach supporting docs, message a practice. |
| **Physician** | **Yes** | All patients in their practice + any patient they've personally signed for | Sign SWOs (only role that can). Cannot delete or alter a signed order. |
| **Office Staff** | No | All patients in their practice | Build draft orders, upload roster, attach F2F notes, send drafts to physician for signature. |
| **Sales Rep** | No | **None — zero PHI access** | See own assigned clinics' order count and revenue, own commission ledger, own payout history. Edit own profile (W-9, ACH). Sees the rep portal at `/rep`, never reaches `/admin` or any provider-facing route. See §17. |
| **Patient** | n/a | Their own record only | Phase 2 only — see status, download patient-facing instructions. |
| **Auditor** | No | Limited to a named records-request scope (date range, patient IDs, or both) | Read-only. Time-boxed; auto-revokes 30 days after issue (or earlier on request close). |

### 2.1 Default-deny on permission ambiguity

Any operation that doesn't have an explicit role-grant returns 403, surfaces to the DME Admin, and never silently degrades. Every permission denial is recorded in the audit log.

---

## 3. The user's first 5 minutes — onboarding & identity verification

The single biggest abuse vector for an SWO portal is identity fraud — someone signing as a practitioner they aren't. Verification happens at signup, not later.

### 3.1 Practitioner sign-up flow

```
[1] Practice sends physician an invite link from a verified office-staff account
    (or a DME Admin sends one directly).
       ↓
[2] Physician opens the link, enters: name, NPI, practice name, work email,
    phone, state license number.
       ↓
[3] Server-side checks (all three must pass before the account becomes "active"):
    a. NPPES API — name + NPI must match a non-deactivated record.
    b. OIG LEIE — NPI must NOT appear on the OIG Exclusion List
       (refreshed monthly via a scheduled job; never trust a stale snapshot).
    c. State license — board-of-medicine lookup (FSMB DocInfo, or
       per-state board scrape). Must be current and unrestricted.
       ↓
[4] Physician sets a password (zxcvbn ≥ 3) and enrols TOTP.
       ↓
[5] First-sign-in walkthrough: "what an SWO needs," the L0651 rule,
    how to send a draft to a colleague.
```

If any check fails, the account stays in `pending` state, the physician sees a clear "we'll reach out" message, and Josh gets a queue alert to manually triage.

### 3.2 Office-staff sign-up

Invited by a physician on the same practice. No external license check (they're not signing). Email verification + TOTP + sign in.

### 3.3 Sessions

- Idle timeout: **15 minutes** (HIPAA-pragmatic).
- Hard logout: **8 hours**.
- All sessions are server-side (httpOnly cookie); no JWT in localStorage.
- Re-authentication required for: signing an order (always); changing security settings; granting an Auditor.

### 3.4 Auditor provisioning (records-request flow)

Auditors aren't self-serve. Josh creates a record-request scope (e.g. *"PA-12345, dates 2026-01-01 → 2026-04-30, patients PT-118 and PT-219"*), the system mints a one-time activation link with a 30-day expiry, the auditor activates with their email + TOTP, and reads only what's in scope. Every page view, every PDF download is audit-logged. Auto-revoke 30 days from issue (or sooner on Josh's command).

---

## 4. The order lifecycle

The status engine is the heart of the portal. Every order moves through these states:

```
                   ┌──────────────┐
                   │ DRAFT        │  ←─ being assembled by office staff
                   └──────┬───────┘
                          │  (office staff: "send to physician")
                          ▼
                   ┌──────────────┐
                   │ AWAITING_SIG │  ←─ in the physician's inbox
                   └──────┬───────┘
                          │  (physician: signs in ceremony)
                          ▼
              ┌───────────────────────────┐
              │ Decision based on HCPCS   │
              │ + signature timestamp:    │
              │  - L0648 / L0650          │
              │    (always PA since 2022) │ → IN_PA_REVIEW
              │  - L0651, signed on/after │
              │    2026-04-13             │ → IN_PA_REVIEW
              │  - All other codes        │ → SUBMITTED
              └──────┬────────────┬───────┘
                     │            │
                     ▼            ▼
             ┌────────────┐  ┌────────────┐
             │ IN_PA_     │  │ SUBMITTED  │
             │ REVIEW     │  └─────┬──────┘
             └─────┬──────┘        │
                   │  (Medicare    │
                   │   PA decision)│
                   │               │
        ┌──────────┴──────────┐    │
        │ Affirmed            │    │
        ▼                     │    │
┌────────────┐                │    │
│ READY_TO_  │                │    │
│ FULFILL    │                │    │
└──────┬─────┘                │    │
       │  (DME staff:         │    │
       │   dispense/deliver)  │    │
       ▼                      │    │
┌────────────┐                │    │
│ FULFILLED  │                │    │
└────────────┘                │    │
                              │    │
                  ┌───────────┘    │
                  ▼                ▼
            ┌──────────┐    ┌──────────┐
            │ DENIED   │    │ FULFILLED│
            └──────────┘    │ (no-PA   │
                            │  path)   │
                            └──────────┘
```

### 4.1 The L0651 effective-date rule (encoded in the engine)

```ts
// /portal/lib/order-routing.ts — load-bearing logic
const L0651_PA_EFFECTIVE = "2026-04-13T00:00:00-07:00";

function requiresPriorAuth(item: OrderItem, signedAtISO: string): boolean {
  switch (item.hcpcs) {
    case "L0648":
    case "L0650":
      return true;                       // PA since 2022-04-13 (87 FR 2051)
    case "L0651":
      return signedAtISO >= L0651_PA_EFFECTIVE;  // CMS-6097-N, 91 FR 1250
    default:
      return false;                      // E0748, L0457, L0464, A6010-A6204
  }
}
```

This rule applies to the **signature timestamp**, not the draft date. An order drafted on 2026-04-12 but signed on 2026-04-13 routes through PA. The signature timestamp is the immutable on-paper trigger, by design.

### 4.2 The atomic three-way write on signature

When a physician signs, three operations happen as a single transaction. If any one fails, all three roll back, the order returns to `AWAITING_SIG`, and a toast tells the user to retry.

1. **Email** to `rx@petersonmedicalequipment.com` with the signed PDF attached. (Postmark.)
2. **Upload** to Google Shared Drive at `Peterson DMEPOS Records/SWOs/<YYYY>/<MM>/<PHYSICIAN_NPI>/SWO_<PatientLast>_<PatientFirst>_<MBI4>_<HCPCS>_<OrderDate-YYYYMMDD>_<PhysicianNPI>.pdf`. (Drive API.)
3. **Postgres write**: `orders.status = 'SUBMITTED'` (or `IN_PA_REVIEW`), `orders.signed_at = now()`, `orders.signed_pdf_url = <drive URL>`. Plus an `audit_log` insert via `recordAuditEvent()`.

Implementation: Postgres handles the local commit; Drive + Postmark are wrapped in a saga pattern (per-step retries, compensating delete on failure of any subsequent step). The orchestration runs in a Cloud Run job, not in the request thread, so the user sees an immediate "Signing…" → "Signed" UI without waiting on Drive's latency.

---

## 5. The SWO wizards (per product line)

Three wizards, one per product line. Each follows the same shape — patient → product → clinical → review — but the fields differ.

### 5.1 Bone growth stimulator (E0748)

Steps:
1. **Patient** — name, MBI, DOB, address, phone, insurance.
2. **Item** — confirm E0748; pick manufacturer (Zimmer Biomet SpinalPak II / Enovis SpinalLogic / Orthofix Spinal-Stim or Cervical-Stim).
3. **Clinical** — F2F encounter date (must be within 6 months of order date — hard validation, blocks submit), ICD-10 (the spinal-fusion diagnosis), date of fusion surgery, attach op note + radiology if available.
4. **Review** — generated SWO PDF preview, six-element check, confirm, send to physician for signature.

**Output on signature:** SWO PDF + Cert of Completion. Routes to `SUBMITTED` (no PA needed for E0748).

### 5.2 Spinal orthosis (L0457 / L0464 / L0648 / L0650 / L0651)

Steps:
1. **Patient** — same as above.
2. **Item** — pick HCPCS from the Trend product table (each carries its Trend SKU and product description). The wizard surfaces PA / WOPD requirements for the chosen code in real time so there are no surprises.
3. **Clinical** — F2F (≤ 6 months), ICD-10, indication code, length-of-need in months, supporting docs (op note / imaging / clinical findings supporting medical necessity per L33790).
4. **Review** — for L0648 / L0650 / L0651: explicit "this requires Prior Authorization and a Written Order Prior to Delivery — Peterson will not deliver until both are in hand" notice. Six-element check.

**Output on signature:** for L0648 / L0650 / L0651 → `IN_PA_REVIEW`. For L0457 / L0464 → `SUBMITTED`.

### 5.3 Surgical dressings (A6010 / A6021 / A6023 / A6203 / A6204)

Steps:
1. **Patient** — same as above.
2. **Items** — multi-select (a single order can include multiple dressings); pick HCPCS, size, quantity per HCPCS, frequency.
3. **Clinical** — wound description, ICD-10, expected duration of need.
4. **Review** — six-element check + LCD L33831 medical-necessity prompt.

**Output on signature:** `SUBMITTED` (no PA, no WOPD).

### 5.4 What every wizard rejects before allowing submit

- F2F date > 6 months before order date.
- State ∉ {WA, OR}.
- Missing any of the six SWO required elements.
- ICD-10 not valid for the current CMS code set.
- MBI doesn't match the format check (`[1-9][A-Z][0-9A-Z][0-9][A-Z][0-9A-Z][0-9][A-Z]{2}[0-9]{2}`, 11 chars, excluding `S L O I B Z`).

---

## 6. The Excel roster upload — the differentiator

This is the marquee feature. A clinic uploads `roster.xlsx`, gets N pre-validated draft SWOs back, and the physician signs them in a single ceremony.

### 6.1 Template

The `.xlsx` template (downloadable from the portal) has these columns. Office staff can fill any subset; the AI parser is tolerant of column reordering, missing columns, and reasonable header variations ("Patient Last" vs "patient_last" vs "Last Name").

```
patient_last, patient_first, patient_dob, patient_mbi, patient_addr1, patient_addr2,
patient_city, patient_state, patient_zip, patient_phone, hcpcs, size, indication_code,
f2f_date, icd10, length_of_need_months, clinical_notes, supporting_docs_file_urls
```

### 6.2 Upload flow

```
[1] Office staff uploads roster.xlsx (≤ 25 MB, ≤ 200 rows for the v1 cap).
       ↓
[2] Server: virus scan, parse with SheetJS, run the AI Roster Parser
    (Claude Agent SDK — see §6.3) to normalise + validate each row.
       ↓
[3] Output: N parsed rows. For each:
      VALID    → a Draft Order is created in DRAFT state.
      WARNING  → Draft Order created, with a "review before sending"
                 flag and an explanation per warning.
      ERROR    → No draft created; the row is shown in a "couldn't import"
                 panel with the reason (e.g. "patient_state must be WA or OR;
                 got 'NY'") so office staff can fix and re-upload.
       ↓
[4] Office staff scans the result, fixes any warnings inline, and
    "Send all valid drafts to physician" — they all enter AWAITING_SIG.
```

### 6.3 The Agent SDK roster parser

This is the portal's other AI feature, distinct from the marketing-site coverage assistant. It's a multi-step agentic flow — perfect fit for the **Claude Agent SDK**. The agent has these tools:

| Tool | What it does |
|---|---|
| `getProductLineForHCPCS(code)` | Returns product-line metadata (LCD, PA required?, WOPD?, F2F required?). |
| `validateMBI(mbi)` | Format check + (optional) MBI lookup against a Medicare eligibility cache. |
| `validateICD10(code, year)` | Checks against the current year's CMS ICD-10 code set. |
| `daysBetween(dateA, dateB)` | For F2F window math. |
| `parseLooseDate(input)` | Tolerant date parser ("3/4/26", "Mar 4 2026", "2026-03-04"). |
| `lookupPatientByMBI(mbi)` | Returns existing patient record if one exists, to avoid duplicate-patient creation. |

For each row the agent: normalises field names → validates each field → calls `getProductLineForHCPCS` to know what additional checks apply (F2F? PA? WOPD?) → determines if WOPD-required codes have all WOPD elements → returns a structured per-row verdict (`{status: "valid"|"warning"|"error", row: {…}, problems: […]}`).

**Why agent loop, not single-shot:** validation is multi-step and conditional (the checks for L0651 are different from those for E0748), missing fields can sometimes be inferred from neighbouring fields, and free-text "clinical_notes" can supply ICD-10 hints that should be surfaced. A single-shot LLM call doesn't model this naturally; an agent with structured tool calls does.

**Cost:** at ~150 tokens of input per row + a few tool calls per row, parsing a 50-row roster runs ~$0.05 with Sonnet 4.6. Cheaper with Haiku.

**Failure modes:** the agent never auto-submits an order. Worst case it produces a wrong-but-confident validation, which the physician would catch at signature review. Defense in depth: same row-validation logic also runs server-side (deterministic) before any draft order is created — the agent's output is treated as a parsing assist, not as authoritative.

### 6.4 Why Medicare requires per-order signatures (and what the UX does about it)

Medicare doesn't allow a single signature to cover SWOs across separate beneficiaries. Each patient's order needs its own signature event. We respect that — see the signing ceremony in §7.

---

## 7. The signing ceremony

A physician with 20 valid drafts in their queue shouldn't sign 20 times. They should authenticate once, signature-by-signature step through with one click each, with re-auth gating every N signatures for legal robustness.

### 7.1 The flow

```
[1] Physician clicks "Sign queue" → re-auths (password + TOTP). Session
    enters CEREMONY_MODE for the next ≤ 60 minutes or N signatures, whichever
    is shorter (N = 10 by default; configurable).
       ↓
[2] Each draft is shown in a focused review pane:
       - patient summary (top), item summary, clinical summary
       - the auto-generated SWO PDF (preview)
       - one "Sign and continue" button
       - one "Skip — needs more info" button (returns to DRAFT, surfaces a note to office staff)
       - one "Reject" button (terminates the order with a reason; rare)
       ↓
[3] On click, the order's signature event captures: signer NPI, signer
    name, timestamp, IP, user-agent, and a SHA-256 hash of the PDF. DocuSeal
    embeds these into a Cert of Completion.
       ↓
[4] Atomic three-way write fires (§4.2). UI moves to the next draft.
       ↓
[5] After N signatures or 60 minutes, ceremony mode ends. Physician
    re-auths to continue.
```

### 7.2 What about a physician signing for a patient they didn't see?

The portal cannot prevent that — it's a clinical and legal question for the physician, not a software question. But it can make it visible: on every draft the review pane shows the F2F date and visit summary alongside the order, and the audit log records that the physician saw that information at the moment they signed. If a denial later comes back, the audit trail is unambiguous about what the physician was shown.

### 7.3 Why DocuSeal (not DocuSign)

- **Self-hosted**, MIT-licensed → no third-party processor of PHI → no extra BAA needed.
- Produces a signed PDF + Certificate of Completion (signature, IP, user-agent, hash) that satisfies the ESIGN Act and 21 CFR Part 11 baseline.
- Runs as a sidecar container next to the Next.js app on Cloud Run.

If we want a hosted alternative (less ops burden), **SignWell** signs a HIPAA BAA on its Business plan. Decision is open — see §13.

---

## 8. After signing — outputs in detail

The three-way atomic write was sketched in §4.2. Here's what each leg looks like in practice.

### 8.1 Email (Postmark)

To: `rx@petersonmedicalequipment.com`
Subject: `SWO ${HCPCS} for ${PatientLast}, ${PatientFirst} — signed by ${SignerName} ${SignerNPI}`
Body: structured (Order ID, HCPCS, line description, signer, signed-at, status route, link to portal).
Attachment: signed PDF.

Postmark is on its HIPAA tier (BAA executed) and message metadata (subject, recipient, timing) is purged after 30 days. Body content is not retained on Postmark per their HIPAA configuration.

### 8.2 Drive archive

Path: `Peterson DMEPOS Records/SWOs/<YYYY>/<MM>/<PHYSICIAN_NPI>/SWO_<PatientLast>_<PatientFirst>_<MBI4>_<HCPCS>_<OrderDate-YYYYMMDD>_<PhysicianNPI>.pdf`
Permissions: inherited from the Shared Drive — only Peterson workforce members + auditors-in-scope can view.
File metadata: Drive properties carry the Order ID for back-reference.

### 8.3 Postgres write

```sql
UPDATE orders
   SET status        = 'SUBMITTED',  -- or 'IN_PA_REVIEW' per §4.1
       signed_at     = now(),
       signed_pdf_url= :drive_url,
       updated_at    = now()
 WHERE id = :order_id;

INSERT INTO audit_log (...) VALUES (...);  -- via recordAuditEvent(); see §9
```

### 8.4 Failure handling

- Postgres-only failure: rollback the transaction; UI shows retry. Never a partial DB state.
- Drive failure: compensating action — Postgres status reset to `AWAITING_SIG`, audit-log records the attempt. UI surfaces "we couldn't archive — try again or call support."
- Postmark failure: same compensating action. Email is the most-likely-to-fail leg (network) so we retry up to 3× with exponential backoff before giving up.

---

## 9. Records & audit log

CMS requires DMEPOS suppliers to retain documentation for at least 7 years (`42 CFR 424.57(c)(9)`). Peterson keeps it for 10. The audit log is the durable, tamper-evident record of every action against PHI.

### 9.1 Schema (sketch)

```sql
CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  prev_hash       BYTEA NOT NULL,        -- SHA-256 of the previous row's row_hash
  row_hash        BYTEA NOT NULL,        -- SHA-256(prev_hash || canonical_row_bytes)
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),  -- server-authoritative UTC
  actor_user_id   UUID NOT NULL REFERENCES users(id),
  actor_role      TEXT NOT NULL,
  action          TEXT NOT NULL,         -- e.g. 'order.sign', 'order.draft.create', 'auditor.read'
  subject_type    TEXT NOT NULL,         -- 'order' | 'patient' | 'user' | 'audit_log'
  subject_id      TEXT NOT NULL,
  data            JSONB NOT NULL,        -- redacted of PHI; typed per action
  request_id      UUID NOT NULL,         -- correlates to the HTTP request

  -- Per-event provenance (Phase 1) — captured automatically by recordAuditEvent
  actor_ip         INET NOT NULL,        -- real client IP (Cloudflare CF-Connecting-IP)
  actor_user_agent TEXT NOT NULL,        -- raw User-Agent string
  actor_geo        JSONB                 -- IP-derived geolocation: see §9.5
);

CREATE INDEX ON audit_log (occurred_at);
CREATE INDEX ON audit_log (subject_type, subject_id);
CREATE INDEX ON audit_log (actor_user_id);
CREATE INDEX ON audit_log USING GIN (actor_geo jsonb_path_ops);

-- Forbidden:
REVOKE UPDATE, DELETE ON audit_log FROM ALL;
-- Inserts are only allowed from a single Postgres role used by recordAuditEvent().
```

### 9.2 The hash chain

Every insert recomputes `row_hash = SHA256(prev_hash || canonical_bytes)`. A daily cron job validates the chain end-to-end and snapshots the day's rows to a GCS object-lock bucket configured with a 10-year retention lock. Any tampering surfaces as a chain mismatch and pages on-call.

### 9.3 The `recordAuditEvent()` helper

Every audit-log write goes through one helper function. Direct INSERTs into `audit_log` are forbidden by Postgres role permissions. The helper:

- Reads the latest `row_hash` (advisory-lock to prevent concurrent inserts racing the chain).
- Canonicalises the row (deterministic key order).
- Computes the new `row_hash`.
- Inserts.

### 9.4 Auditor retrieval

When a records request comes in (RAC, MAC, OIG), the DME Admin creates an Auditor scope (§3.4). The Auditor sees a search interface filtered to their scope, can download signed PDFs, and can export the audit_log subset. Every action is itself audit-logged.

### 9.5 Per-event provenance — IP, user-agent, and IP-derived geolocation

Every audit_log row captures the actor's IP, User-Agent, and an IP-derived coarse geolocation. These are populated by `recordAuditEvent()` automatically — callers don't pass them. They're especially load-bearing for `order.sign` events, where they document *who signed from where* alongside the signature itself.

**`actor_ip` (`INET`):** the real client IP, taken from the `CF-Connecting-IP` header that Cloudflare adds at the edge (never `X-Forwarded-For`, which is spoofable). Stored as PostgreSQL `INET` for clean indexing and CIDR queries.

**`actor_user_agent` (`TEXT`):** raw `User-Agent` header. Useful for spotting anomalies (a physician's account suddenly signing from a `curl` user-agent is a flag).

**`actor_geo` (`JSONB`):** populated by a free **MaxMind GeoLite2-City** lookup at insert time. Shape:

```json
{
  "country":         "US",
  "subdivision":     "WA",
  "city":            "Kennewick",
  "postal":          "99336",
  "latitude":        46.20,
  "longitude":       -119.13,
  "accuracy_radius_km": 20,
  "lookup_source":   "geolite2-city-2026-05",
  "is_anonymous_proxy": false,
  "is_satellite_provider": false
}
```

Accuracy is **city-level, not GPS-level** — typically 5–50 km radius. That's deliberate: it's enough to spot a signature event from an unexpected continent (fraud signal) without pretending we know what street the prescriber was on.

**Browser GPS geolocation** (the `navigator.geolocation` API that triggers a "this site wants your location" popup) is **NOT used.** Reasons: most physicians click No → those signatures would fail or fall back to IP-based anyway; precise location adds little real audit value over IP-derived geo for fraud detection; and prompting for location on a regulated medical workflow is the kind of UX choice that erodes trust without earning it back.

**Performance + cost.** GeoLite2 is a downloadable database (~70 MB, refreshed monthly). The portal keeps a recent copy on the Cloud Run image and looks up locally — sub-millisecond per call, free. A nightly cron pulls the latest database from MaxMind. No per-lookup external calls, no extra runtime cost, no hard dependency.

**Auditor exposure.** The auditor scope (§3.4) by default reveals `occurred_at`, `actor_role`, `action`, and `subject_id` for events in their date range; `actor_ip` and `actor_geo` are revealed only on a higher-tier scope flag explicitly set by the DME Admin when issuing the auditor's link. Default off because most records-request audits don't need IP-level detail.

**Hash-chain note.** `actor_ip`, `actor_user_agent`, and `actor_geo` are part of the canonical row bytes that go into `row_hash` (§9.2) — so tampering with provenance after the fact also breaks the chain.

---

## 10. Architecture (lighter — see §5.2 of CLAUDE.md for the canonical list)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Cloudflare (DNS + WAF + edge)                                       │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Google Cloud Run (auto-scale to zero)                               │
│   • Next.js 14 App Router (TypeScript) · server components default   │
│   • tRPC + Zod for type-safe API                                     │
│   • Prisma ORM                                                       │
│   • DocuSeal sidecar container                                       │
└─────────────────────────────────────────────────────────────────────┘
       │                       │                       │
       ▼                       ▼                       ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│ Cloud SQL    │    │ Keycloak         │    │ External integrations│
│ (Postgres 16 │    │ (self-host)      │    │  • NPPES API         │
│  us-west1)   │    │  password +TOTP  │    │  • OIG LEIE (cron)   │
│  RLS on every│    │  15-min idle     │    │  • State licensing   │
│  PHI table   │    │                  │    │  • Postmark (HIPAA)  │
└──────────────┘    └──────────────────┘    │  • Drive API         │
                                            │  • Anthropic API     │
                                            └──────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Storage                                                             │
│   • GCS Cloud Storage — ephemeral upload buffer (30-day TTL)         │
│   • GCS object-lock bucket — daily audit-log snapshots (10-yr lock) │
│   • Google Shared Drive — canonical SWO archive (workforce ACL)      │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.1 Data model — top-level tables

| Table | Notes |
|---|---|
| `users` | All accounts (DME admin/staff, physician, office staff, sales rep, auditor). Linked to one or more `practices` (or to a `sales_rep` row for reps). |
| `practices` | A clinic. Has a billing entity, address, NPIs (group + individual). |
| `practice_members` | Many-to-many users ↔ practices with role (physician / office_staff). |
| `patients` | PHI-bearing. RLS: a row is visible to a user iff the user belongs to a practice that has at least one order for the patient. **Never visible to sales reps.** |
| `orders` | One per intended SWO. Status, signed_at, signed_pdf_url, signer_user_id, prepared_by_user_id, hcpcs, in_pa_review_started_at, fulfillment_started_at, fulfilled_at. **Plus** `rep_id` (snapshot of the assigned rep at signing time, for commission attribution), `expected_revenue_cents` (from price book), `actual_revenue_cents` (from QBO when payment posts). |
| `order_items` | For multi-line orders (e.g. multiple dressing sizes). |
| `supporting_docs` | F2F notes, op notes, imaging — stored in GCS, referenced here. |
| `audit_log` | Append-only, hash-chained. |
| `roster_uploads` | Each `.xlsx` upload: hash, uploaded_by, parsed_at, summary stats. |
| `roster_rows` | Per-row parse output (status / problems / linked draft order id if created). |
| `auditor_scopes` | Records request id, date range, patient/order list, expires_at. |
| `auditor_grants` | Many-to-many user_id ↔ scope_id with revoked_at. |
| `price_book` | (Phase 3) HCPCS → expected revenue per unit, effective_dates. Drives `orders.expected_revenue_cents` for commission accrual. |
| `sales_reps` | (Phase 3) Rep records: name, email, status, tax info refs (W-9 doc id), payment refs (ACH last4), QBO vendor id. |
| `rep_assignments` | (Phase 3) Time-boxed mapping: rep_id, practice_id, start_at, end_at (NULL = current). One practice can have a history of reps; only one is active at any time. |
| `commission_rules` | (Phase 3) (rep_id, product_line, effective_dates) → rate type (percent of net / per-order flat / tiered) and parameters. |
| `commissions` | (Phase 3) Ledger entry per signed order per applicable rule: order_id, rep_id, rule_id, amount_cents, status (accrued / earned / paid / voided), earned_at, paid_at, payout_id. |
| `payouts` | (Phase 3) Batch-level: rep_id, period_start, period_end, total_cents, paid_at, qbo_bill_id (when integration is wired). |

**Non-PHI projection views** (Phase 3) — a set of read-only Postgres views that join `orders` ↔ `commissions` and project ONLY non-PHI columns. The Sales Rep role's API tokens are scoped to these views and have no SELECT grant on `patients` or PHI columns of `orders`. See §17.1.

### 10.2 Conventions (also in CLAUDE.md §11)

- TypeScript strict mode everywhere.
- Zod at every boundary (HTTP body, file upload, third-party API response).
- No PHI in logs ever — Sentry scrubbing rules block `patient_*`, `mbi`, `dob`, `address*`.
- Server Actions for mutations; never expose Drive credentials to the client.
- Tests: Vitest for unit, Playwright for end-to-end. Every wizard has an end-to-end signup→sign→Drive test on synthetic data.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). PR self-review checklist: HIPAA-impact, security-impact, audit-log-impact.

---

## 11. Phase plan

### Phase 1 — "kill the fax for one product line" (target: 8 weeks from build start; aligned with the August 2026 moratorium expiry)

Smallest end-to-end vertical that proves the model. Pick the simplest product line — **bone growth stimulators (E0748)** — and ship the full lifecycle. **Build proceeds despite no confirmed PTAN — moratorium expires August 2026, and Peterson can complete 855S enrollment in that window.**

In scope:
- Auth (Keycloak), practitioner sign-up with NPPES + LEIE + state license verification.
- E0748 wizard (single-line, no PA, no WOPD — the cleanest path).
- One-at-a-time draft creation (no roster upload yet).
- Signing ceremony (single-order signing — no stack).
- Atomic three-way write (Postmark email + Drive archive + Postgres status).
- Audit log + hash chain.
- DME Admin + DME Staff + Physician + Office Staff roles.
- **Phase 1 admin portal baseline** (§15.2) — order queue, practice list, user management, audit-log search, records-request flow, compliance dashboard. Same codebase as the provider portal, gated by role at `/admin`.
- Pilot with 1–2 friendly clinics.

Explicitly out of scope for Phase 1:
- L-codes (PA workflow adds complexity).
- A-codes (multi-line orders).
- Roster upload + Agent SDK parser.
- Stacked-signing ceremony.
- Patient role.
- Auditor role (the records-request flow is admin-only in Phase 1).
- Sales rep system (no rep accounts, no commissions).

### Phase 2 — "all three product lines + the differentiator" (~ +6 weeks)

- L0457 / L0464 (no PA) wizard.
- L0648 / L0650 / L0651 wizard with PA + WOPD branching (and the date-aware L0651 logic).
- A6010–A6204 multi-line dressing wizard.
- **Excel roster upload + Agent SDK parser.**
- **Stacked-signing ceremony.**
- Auditor role + records-request flow (the time-boxed external-auditor experience).
- Admin portal Phase 2 additions (§15.3) — analytics, bulk operations, health dashboards, configuration toggles. Sales rep management UI added but commission engine still off.
- Pilot expanded to 5 clinics.

### Phase 3 — "sales-rep system + accounting integration + polish" (~ +6 weeks)

- **Sales rep system** (§16) — `sales_reps`, `rep_assignments`, `commission_rules`, `commissions`, `payouts` tables; commission accrual on order signing; commission earning on QBO payment-posted; payout batch flow.
- **Sales Rep portal** (§17) — `/rep` route with non-PHI projections, dashboard, clinic list, commission ledger, payout history, profile management.
- **QBO integration** (§17.5) — read invoice + payment status to drive `accrued → earned`; write payout bills to drive `earned → paid`. Uses the existing QBO MCP server.
- **Patient role** (status visibility, instructions).
- **Reporting depth** — cycle-time, denial rate, top referrers, by-rep revenue and commission breakdowns.
- **Bulk patient document attachment** (drag-and-drop op notes).
- **Fulfillment tracking** (DME staff updates fitting/delivery/returns).

### Phase 4 — "scale" (when volume justifies)

- Real-time payer eligibility check (from a vendor like pVerify or Eligible).
- Patient e-sign for the assignment-of-benefits form.
- SMS notifications via a HIPAA-eligible provider.
- Mobile-app companion for physicians.

---

## 12. Pre-build checklist (the org needs these before code ships, not after)

These are operational, not code. They block go-live, not build start, but should be tracked in parallel:

- [ ] Cloudflare Enterprise BAA executed.
- [ ] Google Cloud BAA executed (covers Cloud SQL, Cloud Run, GCS, Drive).
- [ ] Postmark HIPAA plan + BAA executed.
- [ ] Sentry Business + HIPAA add-on + BAA executed.
- [ ] HIPAA Risk Analysis document drafted (NIST 800-30 methodology — there's a template).
- [ ] Notice of Privacy Practices written + posted on the marketing site.
- [ ] Workforce HIPAA training program (annual).
- [ ] Cyber liability insurance bound (recommend ≥ $1M aggregate).
- [ ] Third-party penetration test scheduled for after Phase 1 build, before pilot launch.
- [ ] Incident-response runbook drafted (who to call when).
- [ ] Backup + restore drill executed (Postgres + Drive).
- [ ] Data Processing Agreements with any third-party (NPPES is public; LEIE is public; state boards vary).

---

## 13. Open decisions (block build start of the corresponding piece)

These were flagged in `CLAUDE.md` §7.3. Revisit each before that piece is built; the rest of the work isn't blocked.

| # | Decision | Recommended | Why | Trade-off |
|---|---|---|---|---|
| **D1** | NSC 855S enrollment status under the 2026-02-27 moratorium | **Resolved 2026-05-14:** build proceeds anyway. Moratorium expires August 2026 (~3 months out) and Phase 1 timeline is ~8 weeks; Peterson can complete 855S enrollment in the post-moratorium window while pilot orders are running on a non-billable basis (or transferred to a contracted billing partner if needed during the gap). | Aligns build runway with regulatory runway; nothing in the code depends on PTAN status until orders are actually billed. | If 855S enrollment hits an unforeseen snag post-moratorium, Phase 1 portal usage stalls. Mitigation: track NSC application progress in the admin compliance dashboard. |
| **D2** | ~~Hosting: WP Engine vs. Kinsta~~ | **N/A** — moot since marketing shipped on Cloudflare Pages and the portal targets Cloud Run. | — | — |
| **D3** | Identity: Keycloak self-host vs. Auth0 (B2B + HIPAA add-on) | **Keycloak**, on Cloud Run | No vendor lock-in, no per-user fee at scale, full control of token lifecycles, no third-party processor of PHI. | Keycloak ops burden — patching, upgrades. Mitigated by running it as a managed Cloud Run container with infrequent redeploys. |
| **D4** | E-sign: DocuSeal self-host vs. SignWell hosted | **DocuSeal**, sidecar container | Same logic as Keycloak — no third-party processor, no extra BAA, MIT license. | Slightly more setup; DocuSeal's UI is functional but less polished than DocuSign or SignWell. Acceptable for B2B medical. |
| **D5** | Build approach: Claude-built / 1099 contractor / vertical SaaS (Brightree, Bonafide, Nikohealth) | **Resolved 2026-05-14:** Claude-built for Phase 1. Decision deferred for Phase 2+ — re-evaluate at Phase 1 retrospective with real cycle-time data. See [`docs/build-vs-buy-portal.md`](build-vs-buy-portal.md) for the steel-manned SaaS comparison. | Phase 1 is bounded (E0748 vertical) and the differentiator (Excel roster + AI parser + stacked signing) is unique to Peterson — not in any vertical SaaS. After Phase 1, you have real numbers to negotiate vendor pricing against. | If Phase 1 reveals significant back-office gaps (eligibility verification, ERA reconciliation, payer-specific edge cases) we'd rather not build, migration to Brightree/Bonafide for the back-office is still on the table — keeping the provider-facing portal as a thin custom layer on top of their billing engine. |
| **D6** | ~~Phase 1 scope: marketing + portal parallel vs. marketing-first~~ | **Resolved 2026-05-12**: marketing-first. Marketing shipped. Portal Phase 1 starts now. | — | — |
| **D7** | Pilot provider list: which 5 clinics | Josh names them. Recommend: 2 spinal-surgery practices already sending high E0748 volume, 2 family-practice / pain-management clinics (broader test of the workflow), 1 friendly-but-skeptical to stress the UX. | Mix of high-volume + diverse-workflow gives the most learning per pilot week. | A homogeneous pilot ships fewer surprises but produces less general feedback. |
| **D8** | Commission rate model for the sales-rep system (§16.3) — percent of net revenue / per-order flat fee / tiered, and the actual rate for each product line | Josh defines. Reasonable starting defaults for evaluation: **8% of net collected** on E0748 (high-margin), **6% of net** on the L-line, **5% of net** on dressings (low-margin, recurring). Tiered structures available if you want to drive specific growth behaviour. | Setting any rate at all unblocks the Phase 3 build — you can adjust the rates later without code changes (the engine is rule-driven). | Flat per-order fees are easier to forecast for reps; percentage-of-net aligns rep incentive with what Peterson actually collects. Most DME companies use percentage-of-net. |
| **D9** | Subdomain branding for the portal | **Resolved 2026-05-14:** `portal.petersonmedicalequipment.com`. Reps land at `portal.petersonmedicalequipment.com/rep`, admin at `/admin`. "Cambria" stays as internal codename. | — | — |

---

## 14. Open questions for Josh (in priority order)

1. ~~**D1 (NSC enrollment)**~~ → resolved 2026-05-14: build proceeds; moratorium expires August 2026; aligned with Phase 1 timeline.
2. **Phase 1 product line** — confirm bone stim (E0748) as the first wizard. Alternative is dressings (A-line) — also no PA, no WOPD, but multi-line orders add UI complexity. Recommend E0748.
3. ~~**Build approach (D5)**~~ → resolved 2026-05-14: Claude-built for Phase 1; revisit at Phase 1 retrospective. See [`docs/build-vs-buy-portal.md`](build-vs-buy-portal.md) for the steel-manned SaaS argument.
4. **Pilot clinic list (D7)** — when you have the names, drop them in `docs/pilot-clinics.md` (a file we'll create then). Until pilot starts, this isn't blocking.
5. ~~**Subdomain branding**~~ → resolved 2026-05-14: `portal.petersonmedicalequipment.com`.
6. **D8 — commission rate model (NEW)** — for each product line, what does Peterson want to pay reps? Options: percent of net collected (industry default), per-order flat fee, or tiered. The engine handles all three; you set the actual numbers. Reasonable defaults to evaluate: 8% E0748 / 6% L-line / 5% dressings. We need an answer before Phase 3 (sales rep system) starts; Phases 1 and 2 don't depend on this.
7. **Demo Brightree, Bonafide, and Nikohealth in parallel with the Phase 1 build** — book a 60-minute demo with each, free, ask the questions in [`docs/build-vs-buy-portal.md`](build-vs-buy-portal.md) §5. The Phase 1 retrospective decision is much sharper if you've seen what they actually offer at what price for Peterson's scale.
8. **NSC 855S status (operational, not blocking the build)** — track Peterson's 855S enrollment through the moratorium-expiry window in the admin compliance dashboard once that's live (Phase 1, §15.2). Need a billing partner contingency plan if there's any uncertainty about the post-August enrollment hitting clean.

---

## 15. Admin portal (internal)

A separate **admin portal** for Peterson's own staff — distinct from the provider portal. Same Next.js codebase, gated by role. Admins authenticate the same way (Keycloak + TOTP) but land on a different home and see different navigation. Lives at the same domain (`portal.petersonmedicalequipment.com`) under `/admin`, behind a hard role check.

### 15.1 Who uses it

| Role | Sees |
|---|---|
| **DME Admin** (Josh) | Everything across all practices. The "all-data" view. |
| **DME Staff** (intake / fitter) | Order queue, fulfillment status, supporting-doc attachment, message-a-practice. No commission data, no rep data, no audit search. |

External roles (physicians, office staff, sales reps, patients, auditors) **cannot reach `/admin`** — Postgres row-level security plus router-level role gates. Attempted access logs to the audit trail.

### 15.2 What it does — Phase 1 baseline

Even at Phase 1 (when only the E0748 wizard is live for prescribers), the admin portal needs:

- **Order queue.** All orders across all practices, filterable by status (DRAFT / AWAITING_SIG / IN_PA_REVIEW / SUBMITTED / READY_TO_FULFILL / FULFILLED / DENIED), HCPCS, practice, signing physician, date range. Click an order → full detail with PDF preview, status transitions, audit log for that order.
- **Practice list.** Every clinic with at least one user or one order. Click a practice → its members, its orders, its assigned sales rep (when §16 lands), its lifetime volume by HCPCS.
- **User management.** Provision practitioner accounts (kicks off the §3 verification flow), invite office staff, suspend/revoke, reset MFA, see active sessions.
- **Audit log search.** Query the append-only `audit_log` (§9) by actor, subject, action, date range. Used during real records requests and for internal investigations. Every audit-log query is itself audit-logged.
- **Records-request flow.** Create an Auditor scope (§3.4): name the request id, select date range and patient/order list, generate the time-boxed activation link for the auditor. Track active scopes; revoke early on demand.
- **Compliance dashboard.** A single screen with: orders awaiting PA decision (sorted by oldest first), orders with F2F documentation expiring within 30 days, signed PDFs that failed to archive (the saga-pattern compensating-rollback queue), audit-log hash-chain status (last verified at), monthly LEIE-refresh status.

### 15.3 What it does — Phase 2+ additions

- **Cross-cutting analytics.** Cycle-time by step (draft→sign, sign→PA-decision, PA-decision→fulfill), denial rate by HCPCS and by referring practice, top referrers by month, revenue mix by line.
- **Sales rep management.** Provision rep accounts, assign clinics to reps, set commission rules (see §16), run payout batches (see §17.3).
- **Commission reports.** Per-rep period summaries with drill-down to the orders behind the numbers. CSV export for accounting.
- **Bulk operations.** Export a date-range of signed PDFs as a zip for an external audit. Export an audit-log subset for legal review. Re-run an upload-archive saga on a stuck order.
- **Health dashboards.** API quotas (Anthropic, Postmark, NPPES), DocuSeal sidecar status, Cloud SQL connection pool, GCS object-lock snapshot freshness, Sentry error rate.
- **Configuration.** Toggle the LEIE-refresh schedule, edit the commission-rule defaults, update the assistant model env var (without a redeploy via wrangler).

### 15.4 What it deliberately does NOT do

- It is not a replacement for accounting. Accounts receivable / payable, cash posting, ERA reconciliation, sales tax — all handled by QuickBooks Online (and eventually whatever billing system Peterson adopts). The admin portal **reads from** QBO via API for revenue figures (§17.5); it does not own that data.
- It is not a payroll system. Commission *calculation* lives here; commission *payment* either lives in QBO (as bills) or in Gusto/whatever Peterson uses.
- It is not the back-office DMEPOS billing system. If Peterson eventually adopts Brightree (see [`docs/build-vs-buy-portal.md`](build-vs-buy-portal.md)), the admin portal becomes a thin layer on top of Brightree's data, not a replacement for it.

---

## 16. Sales representative tracking & commission system

Every clinic (practice) gets assigned to a sales rep. Reps earn commission on orders generated by their assigned clinics. This system tracks who's responsible for what, calculates what each rep is owed, and feeds payout records into accounting.

### 16.1 The model

```
                     ┌──────────────┐
                     │ sales_reps   │
                     └──────┬───────┘
                            │ (1)
                            │
                            ▼ (many)
                     ┌──────────────────┐
                     │ rep_assignments  │   ← time-boxed mapping
                     │  rep_id          │   ← (rep, practice, start, end)
                     │  practice_id     │   ← so historical orders
                     │  start_at        │     attribute correctly even
                     │  end_at  (null)  │     when reps change
                     └──────┬───────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ practices    │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ orders       │ ──► rep_id snapshot at signing time
                     └──────┬───────┘
                            │
                            ▼ (1 per signed order)
                     ┌──────────────────┐
                     │ commissions      │   ← ledger
                     │  order_id        │
                     │  rep_id          │
                     │  rule_id         │
                     │  amount_cents    │
                     │  status          │   ← accrued / earned / paid / voided
                     │  earned_at       │
                     │  paid_at  (null) │
                     │  payout_id (null)│
                     └──────┬───────────┘
                            │
                            ▼ (many per payout batch)
                     ┌──────────────┐
                     │ payouts      │
                     │  rep_id      │
                     │  period_start│
                     │  period_end  │
                     │  total_cents │
                     │  paid_at     │
                     │  qbo_bill_id │   ← ref to the bill created in QBO
                     └──────────────┘
```

### 16.2 Why "snapshot at signing time"

When a clinic's rep changes (rep leaves, territory reassignment), historical orders should still attribute to the rep who owned the relationship when the order was signed — not the new rep. So `orders.rep_id` is captured at signature time, not derived dynamically from the current `rep_assignments`. Same reason `orders.signed_pdf_url` is stored rather than re-derived: signature events are immutable on principle.

### 16.3 Commission rules

Rules are defined per `(rep_id, product_line, effective_dates)` triples and resolve to one of three rate types:

| Rate type | Example | When to use |
|---|---|---|
| **Percent of net revenue** | 8% of net collected | Default; aligns rep incentives with what Peterson actually gets paid |
| **Per-order flat fee** | $40 per signed order | Simpler bookkeeping; suitable for low-margin lines like dressings |
| **Tiered percent** | 6% on first $50K/quarter, 9% on next $50K, 12% above | Used to drive growth past a baseline |

Rules can stack: a rep might earn 6% of net on dressings + 10% of net on bone stim + a $30/unit kicker on L0651 braces. The commissions ledger records which rule applied to each order so the calculation is auditable.

### 16.4 What "earned" means — and the lifecycle

A commission has a status lifecycle that follows the order's revenue lifecycle:

```
order signed
    └──► commissions.status = 'accrued'  (potential, not yet earned)

payment posted in QBO (full or partial)
    └──► commission.status = 'earned'    (locked in, owed to rep)

payout batch closed
    └──► commission.status = 'paid'       payout_id populated
                                          paid_at timestamp set
                                          qbo_bill_id ref'd

denial / refund / recoupment
    └──► commission.status = 'voided'     amount written off, audit-logged
```

**Key rule:** a rep doesn't get paid commission on revenue Peterson hasn't collected. Commissions go from `accrued` to `earned` only when the underlying invoice is marked paid in QBO. This protects against paying out on orders that later get denied or returned.

### 16.5 Where the data comes from

- **`orders.rep_id`** — set by the portal at signature time, copied from the most recent active `rep_assignments` row for the order's practice.
- **`orders.expected_revenue_cents`** — used for the `accrued` calculation. Comes from a Peterson-maintained price book per HCPCS (or a direct cents value if the rule uses per-order flat fees).
- **`orders.actual_revenue_cents`** — populated when QBO confirms payment. Comes from the QBO MCP (read invoice + payment status). This is what `earned` is calculated from.

### 16.6 The commission-batch run (manual, monthly)

Josh (DME Admin) clicks **"Run commission batch"** in the admin portal. The system:

1. Queries every `commissions` row in `earned` status with `payout_id IS NULL` for each rep.
2. Groups by rep, sums by line, presents a per-rep summary for review.
3. On confirm, creates a `payouts` row per rep, flips the underlying commissions to `paid`, and (if QBO integration is wired) creates a Bill in QBO under the rep's vendor record so the AP flow handles actual payment.
4. Pushes a notification to each rep that their payout is ready to view.
5. Audit-logs the batch.

Initially the QBO bill creation is optional — Josh can skip the integration and pay reps via whatever mechanism (Bill.com, manual ACH, payroll module). The portal still tracks who got paid what.

---

## 17. Sales rep portal (non-PHI)

A third front-end role, distinct from the provider portal and the admin portal. Reps log in to see what they've sold, what they're owed, and what they've been paid. **Patient data never reaches this portal.**

### 17.1 The hard rule

A sales rep's portal must surface zero PHI. That includes patient names, MBIs, dates of birth, addresses, phone numbers, diagnosis codes, clinical notes — none of it. What a rep sees per order is:

- The order's HCPCS code
- The clinic (practice) it was signed for
- The signing physician's name and NPI (this is provider-identifying info, not patient PHI)
- The signature date
- The dollar amount (gross billed, net collected)
- The commission earned for them on that order

That's it. Enforced at the database query layer (a dedicated set of views that join `orders` ↔ `commissions` and project only non-PHI columns), not just at the UI. A rep's API token cannot retrieve `patients.*` or `orders.patient_id` even if the front-end is bypassed.

### 17.2 What reps see

- **Dashboard.** MTD and YTD: gross billed, gross collected, commission accrued (potential), commission earned (locked in), commission paid out, balance owed (earned − paid). Top 5 clinics by revenue. Last 5 commission events.
- **Clinics.** Their assigned clinics with: signed-order count, gross/net revenue, commission earned, last activity date. Click a clinic → list of that clinic's orders with the non-PHI projection above.
- **Commissions.** A ledger view: every commission event in date order, with order ref, status, amount, payout ref. Filter by status, line, period. CSV export.
- **Payouts.** History of payouts received: period, total, paid date, line-item drill-down.
- **Profile.** Contact info, tax (W-9) info, payment preferences (ACH details), notification preferences. Audit-logged on change.
- **Help.** A short "what does this mean" panel, contact info for Josh, how to dispute a commission calculation.

### 17.3 What reps do NOT see (and the corresponding UI affordance)

- Anything about patients. If a rep clicks an order they want to investigate, the portal shows them the non-PHI fields and a "Contact Peterson if you need more detail" button — which generates an email to Josh, not a magic patient view.
- Other reps' books. Each rep sees only their own assignments.
- Operational data (fulfillment status, denials, returns) unless those affect their commission calculation. If a commission goes from `earned` to `voided` due to a refund, the rep sees the void with a generic reason ("payment recoupment") — no clinical detail.

### 17.4 Authentication and onboarding

- Reps are invited by Josh via the admin portal. The invite carries a one-time link to set password + enrol TOTP — same flow as office staff (§3.2), minus the credentialing checks.
- Reps log in at `portal.petersonmedicalequipment.com/rep` (a sub-route, not a separate domain — keeps cert/DNS simple).
- Idle timeout: 30 minutes (less aggressive than the 15-minute provider portal because no PHI).
- Hard logout: 8 hours.

### 17.5 Accounting integration (Phase 3+)

Two-direction integration with QBO via the existing QBO MCP server (already connected in this environment for reading; we'd add scoped write access for bills and journal entries):

- **Read from QBO →** invoice + payment status. Drives the commission `accrued → earned` transition (§16.4).
- **Write to QBO ←** payout bills under the rep's vendor record. Drives the commission `earned → paid` transition.

The flow:

```
order signed in portal
    │
    ▼
expected revenue from price book → commissions.amount accrued
    │
    ▼ (Peterson back-office or Brightree creates the actual invoice in QBO)
QBO invoice created, status: open
    │
    ▼ (payer pays; ERA/EFT posted to QBO)
QBO invoice paid → portal polls QBO via MCP → commission flips to 'earned'
    │
    ▼ (monthly)
admin runs payout batch → portal creates QBO bill under rep vendor → commission flips to 'paid'
    │
    ▼ (Peterson AP pays the bill in QBO via Bill.com / ACH)
rep sees payout in their portal; QBO ledger reflects the cash out
```

If/when Peterson adopts Brightree (or another vertical SaaS for billing), the QBO read switches to a Brightree read. The data model doesn't change — only the source of `actual_revenue_cents` for orders.

### 17.6 What this is NOT

- Not a CRM. Reps don't manage their pipeline here, log calls, or schedule visits. If Peterson grows to need that, we integrate with a real CRM (HubSpot, Pipedrive) — the rep portal is the "what have I earned" view, not the "what am I working on" view.
- Not a 1099 generator. At year-end, QBO produces the rep's 1099-NEC based on bills paid through it. The portal tracks the same numbers but isn't the system of record for tax forms.
- Not a recruiting / KPI tool. No leaderboards by default (toxic rep dynamics aside, leaderboards leak whose book is bigger to other reps). If we add aggregated benchmarks later (e.g. "you're at the 60th percentile of reps by YoY growth"), they're aggregated and anonymous.

---

## 18. Change log for this file

| Date | What changed |
|---|---|
| 2026-05-14 | File created. |
| 2026-05-14 | Added §15 admin portal, §16 sales rep tracking & commission system, §17 sales rep (non-PHI) portal. Added `SalesRep` role to §2. Added sales-rep tables to §10 data model. Added Phase 3 work for the rep system. Locked subdomain as `portal.petersonmedicalequipment.com`. New open decision D8 (commission rate model). Resolved D5: Claude-built for Phase 1, decision deferred at Phase 1 retrospective — see [`docs/build-vs-buy-portal.md`](build-vs-buy-portal.md) for the steel-manned SaaS comparison. NSC moratorium update: building anyway; moratorium expires August 2026 and Phase 1 timeline aligns. |
| 2026-05-14 | Audit-log schema (§9.1) extended with `actor_ip` (`INET`), `actor_user_agent` (`TEXT`), `actor_geo` (`JSONB`). New §9.5 documents the IP-derived geolocation source (free MaxMind GeoLite2-City, city-level accuracy, no per-lookup network calls), why we deliberately don't use browser GPS, and how auditor visibility into IP/geo is gated. All three are covered by the SHA-256 row hash so tampering breaks the chain. Phase 1 deliverable. |

---

## Pointers

- Project context: [`CLAUDE.md`](../CLAUDE.md)
- Marketing site: [`docs/marketing-site.md`](marketing-site.md)
- Coverage assistant (the AI feature already shipped on the marketing site): [`docs/ai-coverage-assistant.md`](ai-coverage-assistant.md)
- Build journal: [`docs/build-log.md`](build-log.md)
- Secrets inventory + rotation: [`docs/secrets-rotation.md`](secrets-rotation.md)
