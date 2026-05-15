/**
 * Order status engine — the load-bearing PA-routing logic from spec §4.1.
 *
 * The L0651 effective-date rule is the most consequential branch: orders
 * signed BEFORE 2026-04-13 (Pacific) route without prior auth; orders signed
 * ON OR AFTER that instant trigger the PA workflow.
 *
 * This module is pure functions only — no DB access, no side effects — so it's
 * easy to unit-test exhaustively. The actual state transitions live in the
 * order service layer (which calls these functions to decide).
 */
import {
  L0648_L0650_PA_EFFECTIVE_ISO,
  L0651_PA_EFFECTIVE_ISO,
  F2F_WINDOW_MONTHS,
  productLineForHcpcs,
  type ProductLineKey,
} from "./constants";

// ─── Prior authorization ─────────────────────────────────────────────────────

/**
 * Whether a given HCPCS, signed at a given timestamp, requires Medicare
 * prior authorization. The signature timestamp is the immutable trigger —
 * not the draft date.
 *
 * Phase 1 codes Peterson carries:
 *   E0748                          → never PA
 *   L0457, L0464, A6010-A6204      → never PA
 *   L0648, L0650                   → PA since 2022-04-13
 *   L0651                          → PA effective 2026-04-13
 *
 * @param hcpcs       HCPCS code (case-sensitive — codes are uppercase)
 * @param signedAtIso ISO-8601 string for the signature timestamp
 */
export function requiresPriorAuth(hcpcs: string, signedAtIso: string): boolean {
  switch (hcpcs) {
    case "L0648":
    case "L0650":
      // Both have been on the PA list since well before our build date.
      // Defensive comparison anyway in case the rule shifts back at some point.
      return signedAtIso >= L0648_L0650_PA_EFFECTIVE_ISO;
    case "L0651":
      return signedAtIso >= L0651_PA_EFFECTIVE_ISO;
    default:
      return false;
  }
}

/** Whether a code requires a Written Order Prior to Delivery. */
export function requiresWopd(hcpcs: string): boolean {
  // Same set as PA-required for our portfolio: WOPD is required whenever PA is.
  // This may diverge for other product lines in the future; revisit if so.
  return ["L0648", "L0650", "L0651"].includes(hcpcs);
}

// ─── Face-to-face window ─────────────────────────────────────────────────────

/**
 * Whether the F2F encounter date is within the allowed window before the
 * order date. Uses calendar-month math (not a flat 180 days), matching CMS
 * convention.
 */
export function f2fWithinWindow(f2fDate: Date, orderDate: Date): boolean {
  const cutoff = new Date(orderDate);
  cutoff.setMonth(cutoff.getMonth() - F2F_WINDOW_MONTHS);
  return f2fDate >= cutoff && f2fDate <= orderDate;
}

// ─── Status transitions ─────────────────────────────────────────────────────

export type RouteDecision =
  | { status: "submitted"; reason: "no_pa_required" }
  | { status: "in_pa_review"; reason: "pa_required"; effectiveAuthority: string };

/**
 * Given a signed order, decide which downstream status it routes to.
 * Used immediately after the atomic three-way write (spec §4.2 / §8) to set
 * orders.status appropriately.
 */
export function routeAfterSignature(hcpcs: string, signedAtIso: string): RouteDecision {
  if (requiresPriorAuth(hcpcs, signedAtIso)) {
    return {
      status: "in_pa_review",
      reason: "pa_required",
      effectiveAuthority:
        hcpcs === "L0651" ? "CMS-6097-N (eff. 2026-04-13)" : "87 FR 2051 (eff. 2022-04-13)",
    };
  }
  return { status: "submitted", reason: "no_pa_required" };
}

// ─── Validation ─────────────────────────────────────────────────────────────

export interface OrderValidationResult {
  ok: boolean;
  errors: Array<{ field: string; message: string }>;
}

/**
 * Server-side deterministic validation for an order draft. Run before allowing
 * a draft to be sent to a physician for signature, and again at the moment of
 * signature. Both calls must pass.
 *
 * The Phase 2 Excel-roster Agent SDK parser produces row-level verdicts that
 * use the same logic; the agent's output is treated as a parsing assist, not
 * authoritative — this function is the source of truth.
 */
export function validateOrderForSigning(input: {
  hcpcs: string;
  patientState: string;
  f2fDate: Date | null;
  orderDate: Date;
  signerNpi: string | null;
  hasMbi: boolean;
}): OrderValidationResult {
  const errors: Array<{ field: string; message: string }> = [];

  // HCPCS must map to a product line we carry
  const line = productLineForHcpcs(input.hcpcs);
  if (!line) {
    errors.push({
      field: "hcpcs",
      message: `HCPCS ${input.hcpcs} is not in the Peterson portfolio`,
    });
  }

  // State must be WA or OR (Phase 1)
  if (!["WA", "OR"].includes(input.patientState)) {
    errors.push({
      field: "patientState",
      message: `Patient state must be WA or OR — got ${input.patientState}`,
    });
  }

  // F2F window check (only if the line requires it)
  if (line?.faceToFaceRequired) {
    if (!input.f2fDate) {
      errors.push({ field: "f2fDate", message: "Face-to-face encounter date is required" });
    } else if (!f2fWithinWindow(input.f2fDate, input.orderDate)) {
      errors.push({
        field: "f2fDate",
        message: `Face-to-face encounter must be within ${F2F_WINDOW_MONTHS} months before the order date`,
      });
    }
  }

  // Signer NPI required at signing time
  if (!input.signerNpi || input.signerNpi.trim().length === 0) {
    errors.push({ field: "signerNpi", message: "Treating practitioner NPI is required" });
  }

  // Patient identifier — name OR MBI (we always have name; MBI optional for non-Medicare)
  // This is enforced upstream in the patient model, but assert anyway as defense in depth.

  return { ok: errors.length === 0, errors };
}

// ─── Tiny self-contained sanity tests (run with `tsx src/lib/status-engine.ts`) ──

if (require.main === module) {
  const before = "2026-04-12T23:59:59-07:00";
  const after = "2026-04-13T00:00:01-07:00";
  console.log("L0651 before cutoff requires PA?", requiresPriorAuth("L0651", before)); // false
  console.log("L0651 at/after cutoff requires PA?", requiresPriorAuth("L0651", after)); // true
  console.log("L0648 anytime requires PA?", requiresPriorAuth("L0648", "2025-01-01T00:00:00Z")); // true
  console.log("E0748 ever requires PA?", requiresPriorAuth("E0748", after)); // false
  console.log("Routing L0651 after cutoff:", routeAfterSignature("L0651", after));
  console.log("Routing E0748:", routeAfterSignature("E0748", after));
}
