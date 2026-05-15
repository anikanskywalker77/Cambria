/**
 * Regulatory constants — the load-bearing reference data from CLAUDE.md §3.
 *
 * Every value here is a date or rule that's encoded into business logic and
 * MUST NOT drift. Changes require explicit confirmation from Josh AND a
 * corresponding update to CLAUDE.md §3 + docs/build-log.md.
 *
 * The marketing-site equivalent is at marketing-site/assets/js/coverage-data.js
 * (browser copy) and marketing-site/functions/api/coverage-assistant.js
 * (server copy used by the AI assistant). All four must stay in sync.
 */

// ─── Effective dates (timezones matter for the L0651 cutoff) ─────────────────

/**
 * L0651 added to the Required Prior Authorization List.
 * Source: CMS-6097-N, 91 FR 1250.
 *
 * The cutoff is interpreted in Pacific time because Peterson is a WA/OR
 * supplier and CMS effective dates apply at midnight local-to-the-supplier.
 * Orders signed BEFORE this instant route without PA; orders signed ON or
 * AFTER it trigger the PA workflow. See spec §4.1 for the routing function.
 */
export const L0651_PA_EFFECTIVE_ISO = "2026-04-13T00:00:00-07:00" as const;

/**
 * L0648 / L0650 prior auth has been in effect since this date.
 * Source: 87 FR 2051.
 */
export const L0648_L0650_PA_EFFECTIVE_ISO = "2022-04-13T00:00:00-07:00" as const;

/**
 * DMEPOS supplier-enrollment moratorium effective date.
 * Source: CMS-6099-N, 91 FR 9855. Affects supplier 855S enrollment only;
 * no impact on prescriber portal usage.
 */
export const DMEPOS_MORATORIUM_EFFECTIVE_ISO = "2026-02-27T00:00:00-07:00" as const;

// ─── Documentation rules ─────────────────────────────────────────────────────

/** Face-to-face encounter must be documented within this many months of the order. 42 CFR 410.38. */
export const F2F_WINDOW_MONTHS = 6 as const;

/** DMEPOS record retention — Peterson keeps 10 years; CMS minimum is 7. 42 CFR 424.57(c)(9). */
export const RECORD_RETENTION_YEARS = 10 as const;

// ─── States Peterson is licensed in ──────────────────────────────────────────

export const LICENSED_STATES = ["WA", "OR"] as const;
export type LicensedState = (typeof LICENSED_STATES)[number];

// ─── Product portfolio (CLAUDE.md §2) ────────────────────────────────────────

export type ProductLineKey = "bone_stim" | "spinal_orthoses" | "surgical_dressings";

export interface ProductLineMeta {
  key: ProductLineKey;
  name: string;
  governingLcd: { code: string; label: string };
  hcpcsCodes: readonly string[];
  /** True if F2F documentation within F2F_WINDOW_MONTHS is required. */
  faceToFaceRequired: boolean;
}

export const PRODUCT_LINES: Readonly<Record<ProductLineKey, ProductLineMeta>> = Object.freeze({
  bone_stim: {
    key: "bone_stim",
    name: "Spinal bone growth stimulator",
    governingLcd: { code: "L33796", label: "LCD L33796 — Osteogenesis Stimulators" },
    hcpcsCodes: ["E0748"],
    faceToFaceRequired: true,
  },
  spinal_orthoses: {
    key: "spinal_orthoses",
    name: "Spinal orthoses (TLSO / LSO) — Trend line",
    governingLcd: { code: "L33790", label: "LCD L33790 — Spinal Orthoses: TLSO and LSO" },
    hcpcsCodes: ["L0457", "L0464", "L0648", "L0650", "L0651"],
    faceToFaceRequired: true,
  },
  surgical_dressings: {
    key: "surgical_dressings",
    name: "Surgical dressings — Vitalé line",
    governingLcd: { code: "L33831", label: "LCD L33831 — Surgical Dressings" },
    hcpcsCodes: ["A6010", "A6021", "A6023", "A6203", "A6204"],
    faceToFaceRequired: false,
  },
});

/** Reverse lookup: HCPCS → product line. */
export function productLineForHcpcs(hcpcs: string): ProductLineMeta | null {
  for (const line of Object.values(PRODUCT_LINES)) {
    if (line.hcpcsCodes.includes(hcpcs)) return line;
  }
  return null;
}

// ─── Six elements of an SWO (CMS Article A55426) ─────────────────────────────

export const SWO_REQUIRED_ELEMENTS = [
  "Beneficiary's name OR Medicare Beneficiary Identifier (MBI)",
  "Order date",
  "General description of the item (HCPCS code, brand/model, or narrative description)",
  "Quantity, if applicable",
  "Treating practitioner's name OR NPI",
  "Treating practitioner's signature",
] as const;

export const SWO_AUTHORITY_CITATION = {
  code: "A55426",
  label: "CMS Article A55426 — Standard Written Order requirements",
} as const;
