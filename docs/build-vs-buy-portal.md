# Build vs. buy — the provider portal

> **Decision being weighed.** Should Peterson Medical Equipment build the provider portal as custom software (continuing what's already started — see [`docs/provider-portal-spec.md`](provider-portal-spec.md)), or adopt one of the established DMEPOS vertical-SaaS platforms (Brightree, Bonafide, Nikohealth)?
>
> **Brief written:** 2026-05-14 at Josh's request — to steel-man the SaaS case for evaluation.
>
> **TL;DR recommendation:** Build custom for **Phase 1 only** (the E0748 vertical, ~8 weeks), evaluate against actual cycle-time data at the end, then either keep building or migrate to vertical SaaS for Phase 2+. The reasoning below explains why a categorical "always build" or "always buy" answer would be wrong here.

---

## 1. The honest steel-man for buying

Three real arguments for adopting Brightree, Bonafide, or Nikohealth — none of which the custom-build path easily answers.

### 1.1 You're not a software company; software is overhead

Every line of custom code is a line Peterson now owns forever — patches, upgrades, security fixes, deprecation cycles, documentation, on-call. A vertical SaaS amortises all of that across thousands of customers. CMS changed the L0651 PA rule on 2026-04-13 — your custom code needs to encode that change (it does, it's in the spec); Brightree's customers got it via a release note. Multiply that by every CMS rule change, every payer policy update, every ICD-10 annual revision, every ANSI 837/835 change, every EHR integration spec drift. **The total compliance-maintenance burden of running custom DMEPOS software is substantial and recurring**, and it's the kind of work that doesn't grow Peterson's revenue.

### 1.2 The non-obvious DMEPOS workflows aren't in the spec — they exist in real operations

Our spec covers: SWO intake, signing, archive, audit, status engine, PA branching for L0651. Real DMEPOS operations also include:

- **ADRs** (Additional Documentation Requests) — when a payer asks for medical records mid-claim, you need a workflow to package and respond inside their deadline.
- **TPE / RAC / SMRC / UPIC audits** — Targeted Probe and Educate, Recovery Audit Contractor, Supplemental Medical Review Contractor, Unified Program Integrity Contractor — each a different audit flavor with its own response process and timeline.
- **Capped rentals** — for items dispensed under monthly rental terms (not currently in Peterson's catalog, but if dressings supply ever moves to recurring shipments, this matters), the billing logic is non-trivial.
- **Modifier sets** — KX, GA, GZ, RR, NU, UE, RB, etc. — per-claim, per-line, with payer-specific quirks.
- **Secondary / tertiary payer coordination** — when Medicare is primary and a supplemental is secondary, the claim flow is a known dance.
- **Returns and recoupments** — equipment comes back, claims get adjusted, money flows backward.
- **ERA / 835 reconciliation** — payers send back electronic remittances; you parse, post payments, identify denials, route to follow-up queues.
- **Eligibility verification** — before dispensing, real-time check of beneficiary coverage status.
- **NSC supplier-standards compliance** — the 30 supplier standards plus quality-standards documentation that NSC expects on audit.
- **Equipment serial-number tracking** — for capital items like bone stimulators, the serial number is a Medicare data element.

Brightree, Bonafide, and Nikohealth all have most or all of this built. **Peterson has none of it built**, and our spec doesn't cover it. Some of it isn't needed Day 1, but pretending it never matters is wishful thinking.

### 1.3 Time-to-operational

A realistic Phase 1 build (E0748 vertical) is ~8 weeks of focused engineering. **A vertical SaaS could have Peterson operational on the same workflow in 2–3 weeks** — most of that time is data setup and training, not software install. If the moratorium ending in August 2026 puts pressure on getting throughput up quickly to support CHAP accreditation order volume, a SaaS adoption is faster.

---

## 2. The vendors — what you'd actually be buying

Quick characterizations. None of this is a substitute for actual product demos, which are free and worth the hour.

### 2.1 Brightree (ResMed-owned)

- **Maturity:** Industry leader. Used by thousands of DMEs, including big regional and national operators.
- **Coverage:** Comprehensive — intake, eligibility, billing, ERA/EOB, inventory, fulfillment, accounting integration, reporting, patient portal, mobile field-tech app.
- **Compliance posture:** Strong. Updates ride on regular release cycles; you're running what other DMEs are running.
- **UX:** Functional but dated. Designed for billing/intake staff, not for prescribers (who don't typically interact with it directly — they fax in, the DME's staff enters the order).
- **Pricing:** Per-user plus volume tiers. Public pricing isn't published; expect roughly $200–500/user/month plus implementation fees in the low-to-mid five figures.
- **Integration:** Plug-ins for Brightree are an ecosystem. QBO integration is mature. ePrescribe (if Peterson ever wants to receive electronic SWOs via Surescripts) is supported.
- **The catch:** Brightree's UX assumes you're inputting orders behind the scenes (the prescribing physician faxes in, your staff types it in). It does **not** natively offer a provider-facing portal where physicians sign their own SWOs — that's a custom-built or partner-integrated layer on top. Adopting Brightree doesn't replace what Peterson is trying to build for providers; it replaces the back-office of intake, billing, and fulfillment that Peterson hasn't started building yet.

### 2.2 Bonafide

- **Maturity:** Established, mid-market focus. Smaller customer base than Brightree.
- **Coverage:** Comparable to Brightree on the back-office. Stronger on customer-experience tooling (patient communication, satisfaction surveys, retention).
- **Compliance posture:** Good. Less industry mindshare than Brightree but solid.
- **UX:** Cleaner and more modern than Brightree.
- **Pricing:** Generally competitive with Brightree, sometimes 10–25% cheaper. Same per-user model.
- **Integration:** Less of an ecosystem than Brightree, but covers the basics (accounting, eligibility, EHR connections).
- **The catch:** Same as Brightree — the provider-facing flow isn't the strong suit. You'd still need to build or buy a separate provider portal.

### 2.3 Nikohealth

- **Maturity:** Newer entrant; smaller customer base.
- **Coverage:** Modern stack, cloud-native, faster product iteration. May not have every legacy DMEPOS workflow that Brightree has, but covers the core well.
- **Compliance posture:** Adequate but less proven.
- **UX:** The most modern of the three. Feels like contemporary B2B SaaS.
- **Pricing:** Often more flexible — includes startup-friendly tiers. Public-ish pricing in the low-hundreds/user/month range.
- **Integration:** Modern API surface. Easier to integrate with newer accounting (QBO, Xero), CRM (HubSpot, Salesforce), and ePrescribe.
- **The catch:** You're betting on a smaller vendor's roadmap. If they get acquired or pivot, your operational dependency becomes a liability.

### 2.4 What none of them give you

The portal we've specified has features that aren't in any of these (verified by feature lists; demos may reveal more):

- **Provider-facing self-serve order signing.** The vertical-SaaS model assumes the DME's staff types orders into the system; the prescriber faxes/emails them in. We're flipping that — the prescriber signs directly. Brightree/Bonafide/Nikohealth would still leave you needing a separate provider portal.
- **Excel roster upload + AI-assisted parsing.** Nobody does this. The closest is "import from CSV" features that require fully clean data with exact column matches.
- **Stacked signing ceremony with re-auth gating.** You can simulate it with workarounds, but it's not native to any of the three.
- **The marketing-site coverage assistant.** Already shipped on the marketing site — that's not in scope for any of these vendors.

This last point is the **strategic gap**: Peterson's competitive differentiation isn't "we have a slick back-office" (table stakes for every DME). It's "we make ordering effortless for our referring providers." If you adopt Brightree/Bonafide/Nikohealth, you replace the back-office (which Peterson hasn't built anyway) but you still need to build the provider-facing portal. So the question isn't really "build vs. buy the portal" — it's "build the portal AND the back-office, or buy the back-office and build only the portal."

---

## 3. The honest steel-man for building

### 3.1 The differentiator isn't replicable in vertical SaaS

Excel roster upload → AI-parsed drafts → stacked signing ceremony is the marquee feature in your context doc and the spec. None of the vendors offer it. If Peterson's growth thesis is "easier to refer to than competitors," that thesis depends on owning the provider-facing UX. Buying the back-office doesn't kill that thesis (you can still build the portal on top of someone's billing engine), but buying the back-office doesn't deliver the differentiator either.

### 3.2 Per-user pricing scales badly with referring-provider growth

If Peterson's flywheel works, you'll have 50, then 100, then 200 referring physicians using the portal. At Brightree-style $300/user/month pricing applied broadly, that's $60K/year at 200 users for software you've already built. Custom software has near-zero marginal cost per user.

That said: vertical SaaS typically charges per **internal** seat (your staff), not per **provider** using a portal you build on top. So this argument applies if Peterson would expose a vendor's UI directly to providers — which I don't recommend doing anyway.

### 3.3 You already have momentum and architectural clarity

The spec is written. The marketing site is live. The AI assistant works. The Cloudflare/GitHub/Wrangler pipeline is set up. Pivoting to vendor-evaluation-and-implementation costs 6–8 weeks of time-to-operational that we'd otherwise spend on Phase 1 build.

### 3.4 Long-term cost — at scale, custom is cheaper

Brightree-style pricing at, say, 8 internal seats × $400/month × 12 months = $38K/year minimum. Over 5 years, $190K. Plus implementation fees ($25–50K). Plus per-transaction surcharges if any. Custom software at Peterson's current scale, even with continued part-time engineering, is probably under $100K total over the same period.

That math flips at higher scale (50 internal seats), but Peterson is small.

### 3.5 Owning the data model

When CMS changes a rule, when a payer drops a coverage policy, when a new HCPCS code lands — having the entire codebase in your control means you adapt in days. With a vendor, you wait for their release.

---

## 4. The middle path — and why it's actually the recommendation

**Build Phase 1 custom (E0748 vertical, ~8 weeks). Evaluate at the end with real data.**

Phase 1 is small enough to be tractable as a custom build. You'll come out the other side with:

- A working portal in production that proves the differentiator works (or doesn't).
- Real cycle-time data — average time-from-draft-to-signed, error rates, partner satisfaction.
- A clear understanding of how much ongoing engineering effort the portal needs.
- Genuine demos to show vertical-SaaS vendors when negotiating ("here's what we already do; what would you offer at what price to take this off our plate?").

At the Phase 1 retrospective, the question becomes informed:

- **If Phase 1 went smoothly and the differentiator is clearly working** → keep building Phase 2 (other product lines, roster upload, signing ceremony, the admin portal, the sales-rep system).
- **If Phase 1 was painful and the back-office gaps are biting** (eligibility checks, ERA reconciliation, payer-specific edge cases that aren't worth us building from scratch) → migrate to Brightree (or another vendor) for the back-office, keep the provider-facing portal as a thin custom layer that integrates with their API.
- **If everything is on fire** → hire a vendor, eat the loss on the build investment, get operational fast.

The Phase 1 cost is ~8 weeks of focused engineering. Whether that comes out of "Claude builds it" effort or contractor effort, it's a bounded investment. Worst case, you've got a working pilot demo that gives you negotiation leverage with vendors.

---

## 5. Recommendation, plainly

**Continue with Claude-built for Phase 1.**

- Phase 1 scope is bounded (E0748 vertical only) and architecturally clear (the spec is written).
- The differentiator (Excel roster, AI-assisted, stacked signing) is unique and can't be bought.
- The August moratorium expiry is the natural Phase 1 deadline — that's ~10–12 weeks from now, enough runway.
- The decision to keep building vs. migrate is **deferred**, not avoided — we revisit at the Phase 1 retrospective with real data.
- If Brightree's salesperson tells you their pricing today before you have Phase 1 data, you're negotiating from weakness. After Phase 1, you negotiate from "here's our metric, here's what your tool would have to beat to be worth the migration."

**One concrete ask:** book a demo with each of the three vendors anyway, in parallel with Phase 1 build. Demos are free, take 60 minutes each, and the questions you ask will sharpen as we build. Things I'd want to know after seeing them:

1. Does their system support an external provider portal layer? Via API? Via SSO?
2. What's their roster-upload story (any of them)?
3. What's their pricing for Peterson's expected scale (5–10 internal seats, 50–200 referring providers, ~5 product lines)?
4. What does their commission/sales-rep tracking look like (relevant to the new sales-rep portal request — see [`docs/provider-portal-spec.md`](provider-portal-spec.md) §17–18)?
5. If we built a custom portal that integrates with their billing engine, what's that look like?

Those answers, combined with Phase 1 in-production metrics, make the post-Phase-1 decision real.

---

## 6. Change log

| Date | What changed |
|---|---|
| 2026-05-14 | File created — Josh asked for the steel-man case for vertical SaaS to evaluate against the Claude-built path. |
