"""
Build the spinal-bracing (Trend line, L0457–L0651) Standard Written Order PDF.

Output: marketing-site/assets/forms/swo-spinal-bracing.pdf
        Single page, US Letter, fillable AcroForm fields. Visual layout matches
        the two other custom-built Peterson SWO PDFs (E0748 + surgical
        dressings): Peterson letterhead at top-left, Phone+Fax top-right,
        same Patient/Provider table, same Insurance section, same attestation,
        same footer. Prescriber Signature is a real /FT /Sig signature field
        (not a typeable text field).

Replaces a previous vendor-supplied PDF that Peterson didn't own the source
to. Now Peterson has full rights + the ability to iterate.

This script is the source of truth for the form. To regenerate:

    pip install reportlab pypdf svglib
    python tools/build-swo-spinal-bracing.py

The output PDF should never contain PHI — it is a blank template downloaded
publicly from petersonmedicalequipment.com.
"""
import sys
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import black, white, HexColor

sys.path.insert(0, str(Path(__file__).parent))
from peterson_logo import draw_logo
from pdf_signature import add_signature_field

OUT = Path(__file__).parent.parent / "marketing-site" / "assets" / "forms" / "swo-spinal-bracing.pdf"

PAGE_W, PAGE_H = letter
MARGIN = 36
USABLE_W = PAGE_W - 2 * MARGIN
LEFT = MARGIN
RIGHT = PAGE_W - MARGIN
MID = PAGE_W / 2

BORDER = black
LABEL = black
FILL = white
SHADE = HexColor("#E5E5E5")


def tf(form, name, label, x, y, width, height=12, font_size=9):
    """Underlined fillable text field."""
    form.textfield(
        name=name, tooltip=label,
        x=x, y=y, width=width, height=height,
        borderStyle="underlined", borderWidth=0.5,
        borderColor=BORDER, fillColor=FILL,
        textColor=black, fontName="Helvetica", fontSize=font_size,
        forceBorder=False,
    )


def cb(form, name, label, x, y, size=10):
    """Square checkbox."""
    form.checkbox(
        name=name, tooltip=label,
        x=x, y=y,
        buttonStyle="check", borderStyle="solid",
        shape="square", borderColor=BORDER, fillColor=FILL,
        textColor=black, borderWidth=0.6, size=size,
    )


def cell_with_field(c, form, x, y, w, h, label, field_name, draw_border=True):
    """Bordered cell with an inline label + underlined fillable text field."""
    if draw_border:
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.rect(x, y - h, w, h, stroke=1, fill=0)
    c.setFont("Helvetica", 9)
    c.drawString(x + 4, y - 12, label)
    label_w = c.stringWidth(label, "Helvetica", 9)
    tf(form, field_name, label.rstrip(":"), x + 6 + label_w + 2, y - h + 3, w - label_w - 14, height=h - 6)


def build():
    c = canvas.Canvas(str(OUT), pagesize=letter)
    c.setTitle("Spinal Bracing — Standard Written Order")
    c.setAuthor("Peterson Medical Equipment")
    c.setSubject("Letter of Medical Necessity / Standard Written Order — Trend Spinal Orthosis line (HCPCS L0457–L0651, LCD L33790)")
    c.setCreator("Peterson Medical Equipment")
    c.setKeywords("SWO, spinal bracing, TLSO, LSO, L0457, L0464, L0648, L0650, L0651, L33790, DMEPOS, Trend orthosis")

    form = c.acroForm

    # ─── Letterhead: logo left, phone/fax right ────────────────────────────────
    y = PAGE_H - MARGIN
    LOGO_H = 34
    draw_logo(c, LEFT, y - LOGO_H, height_pt=LOGO_H)
    c.setFont("Helvetica", 9)
    c.drawRightString(RIGHT, y - 11, "Phone: (509) 783-7501")
    c.drawRightString(RIGHT, y - 24, "Fax: 1-509-980-7062")
    y -= LOGO_H + 4

    # Form-tracking line
    c.setFont("Helvetica-Bold", 9)
    c.drawString(LEFT, y - 9, "Total Pages Sent: ______")
    c.drawRightString(RIGHT, y - 9, "Patient Number: ______")
    y -= 28

    # ─── Title ────────────────────────────────────────────────────────────────
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(MID, y, "SPINAL BRACING")
    y -= 14
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(MID, y, "LETTER OF MEDICAL NECESSITY / STANDARD WRITTEN ORDER")
    y -= 6
    c.setLineWidth(1.2)
    c.line(LEFT, y, RIGHT, y)
    y -= 12

    # ─── PATIENT INFORMATION | ORDERING PHYSICIAN ─────────────────────────────
    c.setFillColor(SHADE)
    c.rect(LEFT, y - 14, USABLE_W, 14, stroke=0, fill=1)
    c.setFillColor(LABEL)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.rect(LEFT, y - 14, USABLE_W, 14, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(LEFT + 6, y - 11, "PATIENT INFORMATION")
    c.drawString(MID + 4, y - 11, "ORDERING PHYSICIAN")
    y -= 14

    row_h = 18
    col_w = USABLE_W / 2

    rows = [
        ("Patient Name:",   "patient_name",            "Practice Name:",      "practice_name"),
        ("Patient Phone:",  "patient_phone",           "Practitioner NPI:",   "practitioner_npi"),
        ("__DOB_GENDER__",  None,                      "Phone:",              "practitioner_phone"),
        ("Address:",        "patient_address",         "Address:",            "practitioner_address"),
        ("City/State/ZIP:", "patient_city_state_zip",  "City/State/ZIP:",     "practitioner_city_state_zip"),
    ]
    for left_label, left_field, right_label, right_field in rows:
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.rect(LEFT, y - row_h, col_w, row_h, stroke=1, fill=0)
        c.rect(LEFT + col_w, y - row_h, col_w, row_h, stroke=1, fill=0)
        c.setFont("Helvetica", 9)
        if left_label == "__DOB_GENDER__":
            c.drawString(LEFT + 4, y - 12, "DOB:")
            tf(form, "patient_dob", "Date of Birth (MM/DD/YYYY)", LEFT + 32, y - row_h + 3, 95, height=row_h - 6)
            c.drawString(LEFT + 138, y - 12, "Gender:")
            cb(form, "patient_gender_m", "Male", LEFT + 178, y - 13, size=10)
            c.drawString(LEFT + 192, y - 12, "M")
            cb(form, "patient_gender_f", "Female", LEFT + 210, y - 13, size=10)
            c.drawString(LEFT + 224, y - 12, "F")
        else:
            cell_with_field(c, form, LEFT, y, col_w, row_h, left_label, left_field, draw_border=False)
        cell_with_field(c, form, LEFT + col_w, y, col_w, row_h, right_label, right_field, draw_border=False)
        y -= row_h
    y -= 8

    # ─── ITEM PRESCRIBED — Mark One ────────────────────────────────────────────
    c.setFont("Helvetica-Bold", 10)
    c.drawString(LEFT, y, "ITEM PRESCRIBED  —  Mark One")
    c.setFont("Helvetica", 7.5)
    c.drawRightString(RIGHT, y, "Governing LCD: L33790 — Spinal Orthoses: TLSO and LSO")
    y -= 4
    c.setLineWidth(0.5)
    c.line(LEFT, y, RIGHT, y)
    y -= 10

    # Each item: checkbox | HCPCS | description | (optional PA+WOPD note)
    items = [
        ("brace_l0457", "L0457", "Trend Correx TLSO (DCT-5657)",       "TLSO, flexible trunk, sagittal-coronal",                ""),
        ("brace_l0464", "L0464", "Trend Correx SP TLSO (DCT-0464)",    "TLSO, 4 rigid panels, sacro-scapular",                  ""),
        ("brace_l0648", "L0648", "Trend LSO (DCT-31)",                 "LSO, sagittal, rigid ant/post panels",                  "PA + WOPD required"),
        ("brace_l0650", "L0650", "Trend Pro LSO (DCT-37)",             "LSO, sagittal-coronal, rigid ant/post panels",          "PA + WOPD required"),
        ("brace_l0651", "L0651", "Trend Extend LSO (DCT-3951)",        "LSO, sagittal-coronal, shell and panel",                "PA + WOPD required (eff. 2026-04-13)"),
    ]

    # Column layout: cb=14, hcpcs=42, model=200, desc=fill, note=right-aligned
    cb_x = LEFT + 4
    hcpcs_x = LEFT + 22
    model_x = LEFT + 60
    desc_x = LEFT + 252
    item_row_h = 14

    c.setFont("Helvetica-Bold", 8)
    c.drawString(hcpcs_x, y, "HCPCS")
    c.drawString(model_x, y, "Trend product")
    c.drawString(desc_x, y, "Description")
    y -= 4
    c.setLineWidth(0.3)
    c.line(LEFT, y, RIGHT, y)
    y -= 10

    for cb_name, hcpcs, model, desc, note in items:
        cb(form, cb_name, f"{hcpcs} {model}", cb_x, y - 3, size=10)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(hcpcs_x, y, hcpcs)
        c.setFont("Helvetica", 8.5)
        c.drawString(model_x, y, model)
        c.drawString(desc_x, y, desc)
        if note:
            c.setFont("Helvetica-Oblique", 7.5)
            c.drawRightString(RIGHT, y, note)
        y -= item_row_h

    # Other row
    cb(form, "brace_other_cb", "Other brace", cb_x, y - 3, size=10)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(hcpcs_x, y, "Other")
    tf(form, "brace_other_desc", "Other brace — describe (HCPCS, product, size)",
       model_x, y - 4, RIGHT - model_x - 4, height=item_row_h - 4, font_size=8.5)
    y -= item_row_h + 4

    # WOPD reminder for the PA codes — word-wrapped to fit page width
    c.setFont("Helvetica-Oblique", 8)
    c.setFillColor(HexColor("#444444"))
    note_text = (
        "Note: For L0648, L0650, and L0651, a complete Written Order Prior to Delivery (WOPD) "
        "must be on file before Peterson dispenses the brace. Prior authorization is also "
        "required for these codes."
    )
    note_lines = []
    cur = ""
    for w in note_text.split():
        candidate = (cur + " " + w).strip()
        if c.stringWidth(candidate, "Helvetica-Oblique", 8) > USABLE_W:
            note_lines.append(cur)
            cur = w
        else:
            cur = candidate
    if cur:
        note_lines.append(cur)
    for ln in note_lines:
        c.drawString(LEFT, y, ln)
        y -= 10
    c.setFillColor(LABEL)
    y -= 6

    # ─── DIAGNOSIS ICD10 ───────────────────────────────────────────────────────
    c.setFont("Helvetica-Bold", 10)
    c.drawString(LEFT, y, "DIAGNOSIS ICD10")
    y -= 4
    c.setLineWidth(0.5)
    c.line(LEFT, y, RIGHT, y)
    y -= 10

    c.setFont("Helvetica-Bold", 8)
    c.drawString(LEFT + 4, y, "Diagnosis")
    c.drawString(LEFT + 320, y, "ICD-10 Code")
    y -= 10
    for i in range(1, 4):
        tf(form, f"diagnosis_{i}_name", f"Diagnosis {i} description",
           LEFT + 4, y - 2, 310, height=12)
        tf(form, f"diagnosis_{i}_icd10", f"ICD-10 code for diagnosis {i}",
           LEFT + 320, y - 2, 200, height=12)
        y -= 14
    y -= 4

    # ─── INSURANCE INFORMATION ────────────────────────────────────────────────
    c.setFont("Helvetica-Bold", 10)
    c.drawString(LEFT, y, "INSURANCE INFORMATION  —  Primary Insurance")
    y -= 4
    c.setLineWidth(0.5)
    c.line(LEFT, y, RIGHT, y)
    y -= 14

    ins_rows = [
        ("Name of Insured:",       "insured_name",     "Relation to Patient:", "insured_relation"),
        ("Insured Date of Birth:", "insured_dob",      "Insurance Company:",   "insurance_company"),
        ("Policy Number:",         "policy_number",    "Group Number:",        "group_number"),
        ("Address:",               "insured_address",  "City / State / ZIP:",  "insured_city_state_zip"),
        ("__PHONE_SECONDARY__",    None,               None,                   None),
    ]
    for left_label, left_field, right_label, right_field in ins_rows:
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.rect(LEFT, y - row_h, col_w, row_h, stroke=1, fill=0)
        c.rect(LEFT + col_w, y - row_h, col_w, row_h, stroke=1, fill=0)
        c.setFont("Helvetica", 9)
        if left_label == "__PHONE_SECONDARY__":
            c.drawString(LEFT + 4, y - 12, "Phone:")
            tf(form, "insured_phone", "Insured Phone",
               LEFT + 36, y - row_h + 3, col_w - 44, height=row_h - 6)
            cb(form, "attach_secondary_insurance", "Attach Secondary Insurance",
               LEFT + col_w + 6, y - 13, size=10)
            c.drawString(LEFT + col_w + 22, y - 12, "Attach Secondary Insurance")
        else:
            cell_with_field(c, form, LEFT, y, col_w, row_h, left_label, left_field, draw_border=False)
            cell_with_field(c, form, LEFT + col_w, y, col_w, row_h, right_label, right_field, draw_border=False)
        y -= row_h
    y -= 8

    # ─── Attestation ──────────────────────────────────────────────────────────
    attestation = (
        "The information on this Standard Written Order is accurate and complete to the best of my knowledge. "
        "I confirm that this patient has the condition(s) noted above and is/was being treated by me and is "
        "able to use the ordered item. The medical records substantiate the prescribed condition(s). "
        "Supporting documentation will be provided upon request for Medicare/Insurance review."
    )
    c.setFont("Helvetica", 8.5)
    line = ""
    lines = []
    for w in attestation.split():
        test = (line + " " + w).strip()
        if c.stringWidth(test, "Helvetica", 8.5) > USABLE_W:
            lines.append(line)
            line = w
        else:
            line = test
    if line:
        lines.append(line)
    for ln in lines:
        c.drawString(LEFT, y, ln)
        y -= 10
    y -= 4

    # ─── Signature (real /Sig field — see post-process at end) ────────────────
    c.setFont("Helvetica", 9.5)
    c.drawString(LEFT, y, "Prescriber Signature:")
    sig_x, sig_y, sig_w, sig_h = LEFT + 110, y - 4, 240, 14
    c.setLineWidth(0.5)
    c.line(sig_x, sig_y, sig_x + sig_w, sig_y)  # printed underline beneath the /Sig field
    c.drawString(LEFT + 360, y, "Date:")
    tf(form, "signature_date", "Signature Date (MM/DD/YYYY)",
       LEFT + 392, y - 4, 130, height=14, font_size=10)
    y -= 18
    c.drawString(LEFT, y, "Printed Name:")
    tf(form, "prescriber_printed_name", "Prescriber Printed Name",
       LEFT + 80, y - 4, 270, height=14, font_size=10)
    y -= 18

    # ─── Footer ───────────────────────────────────────────────────────────────
    c.setLineWidth(0.6)
    c.line(LEFT, y, RIGHT, y)
    y -= 12
    c.setFont("Helvetica", 8)
    c.drawString(LEFT, y, "Peterson Medical LLC  |  DBA Peterson Medical Equipment")
    y -= 10
    c.drawString(LEFT, y, "4415 West Clearwater Avenue, Suite 11  |  Kennewick, WA 99336")
    y -= 10
    c.drawString(LEFT, y, "Phone: (509) 783-7501  |  Fax: 1-509-980-7062")

    c.showPage()
    c.save()

    # Post-process: inject the /Sig field at the signature line we drew above.
    add_signature_field(
        pdf_path=OUT,
        page_index=0,
        x=sig_x, y=sig_y - 2, width=sig_w, height=sig_h + 2,
        field_name="prescriber_signature",
        tooltip="Prescriber e-signature",
    )

    return OUT


if __name__ == "__main__":
    out = build()
    size = out.stat().st_size
    print(f"Wrote {out} ({size:,} bytes, {size / 1024:.1f} KB)")
