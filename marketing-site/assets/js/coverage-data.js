/* Peterson Medical Equipment — coverage knowledge base (browser copy).
 *
 * SOURCE OF TRUTH: CLAUDE.md §2 (product portfolio) and §3 (regulatory constants).
 * The server Function (functions/api/coverage-assistant.js) keeps its own copy of
 * this data and must be updated in lockstep with this file and with CLAUDE.md.
 *
 * NOTHING here is patient-specific. This is reference data only — never a coverage
 * guarantee. Coverage always depends on the individual record and the payer.
 */
window.PME_COVERAGE = Object.freeze({
  updated: "2026-05-12",

  /* The six required elements of a Standard Written Order, per CMS Article A55426. */
  swoElements: [
    "Beneficiary's name OR Medicare Beneficiary Identifier (MBI)",
    "Order date",
    "General description of the item (HCPCS, brand/model, or a narrative description)",
    "Quantity, if applicable",
    "Treating practitioner's name OR NPI",
    "Treating practitioner's signature"
  ],

  rules: Object.freeze({
    f2fWindowMonths: 6,                       // F2F encounter within 6 months of the order — 42 CFR 410.38
    f2fCite: "42 CFR 410.38",
    swoCite: "CMS Article A55426",
    recordRetentionYears: 10,                 // we keep 10; CMS minimum is 7 — 42 CFR 424.57(c)(9)
    l0651PaEffective: "2026-04-13",           // CMS-6097-N, 91 FR 1250
    l0648l0650PaEffective: "2022-04-13",      // 87 FR 2051
    dmeposMoratoriumEffective: "2026-02-27"   // CMS-6099-N, 91 FR 9855 (supplier enrollment; not a provider concern)
  }),

  /* Product lines, keyed by HCPCS where it makes sense. */
  lines: Object.freeze({
    boneStimulator: {
      key: "bone-stimulator",
      name: "Spinal bone growth stimulator",
      hcpcs: ["E0748"],
      lcd: "L33796",
      lcdName: "Osteogenesis Stimulators",
      priorAuth: false,
      wopd: false,
      f2fRequired: true,
      defaultDispense: "NU (new purchase)",
      episode: "270-day single treatment episode",
      manufacturers: ["Zimmer Biomet SpinalPak II", "Enovis/DJO SpinalLogic", "Orthofix Spinal-Stim", "Orthofix Cervical-Stim (on request)"],
      note: "No prior authorization is required for E0748. Coverage is decided on clinical review per the payer and LCD L33796.",
      page: "/products/bone-stimulators.html"
    },
    spinalOrthoses: {
      key: "spinal-orthoses",
      name: "Spinal orthoses (TLSO / LSO) — Trend line",
      hcpcs: ["L0457", "L0464", "L0648", "L0650", "L0651"],
      lcd: "L33790",
      lcdName: "Spinal Orthoses: TLSO and LSO",
      f2fRequired: true,
      page: "/products/spinal-orthoses.html",
      items: [
        { hcpcs: "L0457", product: "Trend Correx TLSO (DCT-5657)", desc: "TLSO, flexible trunk, SJ-SS, prefabricated OTS", priorAuth: false, wopd: false },
        { hcpcs: "L0464", product: "Trend Correx SP TLSO (DCT-0464)", desc: "TLSO, 4 rigid panels, sacro-scapular, prefabricated OTS", priorAuth: false, wopd: false },
        { hcpcs: "L0648", product: "Trend LSO (DCT-31)", desc: "LSO, sagittal, rigid anterior/posterior panels, prefabricated OTS", priorAuth: true, priorAuthSince: "2022-04-13", wopd: true },
        { hcpcs: "L0650", product: "Trend Pro LSO (DCT-37)", desc: "LSO, sagittal-coronal, rigid anterior/posterior panels, prefabricated OTS", priorAuth: true, priorAuthSince: "2022-04-13", wopd: true },
        { hcpcs: "L0651", product: "Trend Extend LSO (DCT-3951)", desc: "LSO, sagittal-coronal, shell & panel, prefabricated OTS", priorAuth: true, priorAuthSince: "2026-04-13", wopd: true }
      ],
      note: "L0648, L0650, and L0651 require prior authorization and a Written Order Prior to Delivery (WOPD). L0651's PA requirement is new — effective 2026-04-13 (CMS-6097-N). L0457 and L0464 do not require PA."
    },
    surgicalDressings: {
      key: "surgical-dressings",
      name: "Surgical dressings — Vitalé line",
      hcpcs: ["A6010", "A6021", "A6023", "A6203", "A6204"],
      lcd: "L33831",
      lcdName: "Surgical Dressings",
      priorAuth: false,
      wopd: false,
      f2fRequired: false,
      page: "/products/surgical-dressings.html",
      items: [
        { hcpcs: "A6010", product: "Collagen Powder", sizes: "1 g packets" },
        { hcpcs: "A6021", product: "Collagen Dressing", sizes: '2" x 2"' },
        { hcpcs: "A6023", product: "Collagen Dressing", sizes: '7" x 7"' },
        { hcpcs: "A6203", product: "Composite Island Dressing", sizes: '4" x 6", 4" x 10"' },
        { hcpcs: "A6203", product: "Silicone Composite Dressing", sizes: '3.5" x 4"' },
        { hcpcs: "A6204", product: "Composite Island Dressing", sizes: '4" x 14"' },
        { hcpcs: "A6204", product: "Silicone Composite Dressing", sizes: '9" x 9"' }
      ],
      note: "Surgical dressings are billed under LCD L33831. Other dressing categories (alginate, foam, hydrogel) can be sourced on request."
    }
  })
});

/* Suggested questions surfaced as chips next to the assistant widget. */
window.PME_ASSISTANT_PROMPTS = Object.freeze([
  "What does a Standard Written Order for E0748 need to include?",
  "Does L0651 require prior authorization, and when did that start?",
  "How recent does the face-to-face encounter have to be?",
  "Which of the Trend back braces need a WOPD?",
  "What's the difference between L0648, L0650 and L0651?"
]);
