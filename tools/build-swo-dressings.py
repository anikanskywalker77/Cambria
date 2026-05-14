"""
Build the surgical-dressings Standard Written Order PDF.

Output: marketing-site/assets/forms/swo-surgical-dressings.pdf
        Single page, US Letter, fillable AcroForm fields. Matches the visual
        style of the two reference forms (swo-bone-stimulator-e0748.pdf and
        swo-spinal-bracing.pdf, both vendor-provided).

This script is the source of truth for the dressings form. To regenerate:

    pip install reportlab pypdf
    python tools/build-swo-dressings.py

The output PDF should never contain PHI — it is a blank template downloaded
publicly from petersonmedicalequipment.com.
"""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import black, white, HexColor

# Script lives in /tools; PDF output goes into the served marketing-site folder.
OUT = Path(__file__).parent.parent / "marketing-site" / "assets" / "forms" / "swo-surgical-dressings.pdf"

PAGE_W, PAGE_H = letter      # 612 x 792
MARGIN = 36                  # 0.5"
USABLE_W = PAGE_W - 2 * MARGIN
LEFT = MARGIN
RIGHT = PAGE_W - MARGIN
MID = PAGE_W / 2

# Colors (B&W, like the existing forms)
BORDER = black
LABEL = black
FILL = white

# Light gray shading for header rows (like the reference forms)
SHADE = HexColor("#E5E5E5")


def build():
    c = canvas.Canvas(str(OUT), pagesize=letter)
    c.setTitle("Surgical Dressings — Standard Written Order")
    c.setAuthor("Peterson Medical Equipment")
    c.setSubject("Letter of Medical Necessity / Standard Written Order — Surgical Dressings (CMS LCD L33831)")
    c.setCreator("Peterson Medical Equipment")
    c.setKeywords("SWO, surgical dressings, A6010, A6021, A6023, A6203, A6204, L33831, DMEPOS")

    form = c.acroForm

    # ---------------------------------------------------------------------------
    # Top strip: Fax left, Patient Number right
    # ---------------------------------------------------------------------------
    y = PAGE_H - MARGIN
    c.setFont("Helvetica-Bold", 9)
    c.drawString(LEFT, y - 9, "Fax: 1-509-980-7062")
    c.drawString(LEFT, y - 22, "Total Pages Sent: ______")
    c.drawRightString(RIGHT, y - 9, "Patient Number: ______")
    y -= 36

    # Title
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(MID, y, "SURGICAL DRESSINGS")
    y -= 14
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(MID, y, "LETTER OF MEDICAL NECESSITY / STANDARD WRITTEN ORDER")
    y -= 6
    c.setLineWidth(1.2)
    c.line(LEFT, y, RIGHT, y)
    y -= 12

    # ---------------------------------------------------------------------------
    # PATIENT INFORMATION | ORDERING PHYSICIAN
    # ---------------------------------------------------------------------------
    section_header(c, y, "PATIENT INFORMATION", LEFT, "ORDERING PHYSICIAN", MID + 4, USABLE_W / 2 - 4)
    y -= 14
    rows = [
        ("Patient Name:", "patient_name", "Practice Name:", "practice_name"),
        ("Patient Phone:", "patient_phone", "Practitioner NPI:", "practitioner_npi"),
        # DOB + Gender / Phone — special row (gender checkboxes)
        ("__DOB_GENDER__", None, "Phone:", "practitioner_phone"),
        ("Address:", "patient_address", "Address:", "practitioner_address"),
        ("City/State/ZIP:", "patient_city_state_zip", "City/State/ZIP:", "practitioner_city_state_zip"),
    ]
    row_h = 18
    col_w = USABLE_W / 2
    for left_label, left_field, right_label, right_field in rows:
        # left cell
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.rect(LEFT, y - row_h, col_w, row_h, stroke=1, fill=0)
        c.rect(LEFT + col_w, y - row_h, col_w, row_h, stroke=1, fill=0)
        c.setFont("Helvetica", 9)
        if left_label == "__DOB_GENDER__":
            c.drawString(LEFT + 4, y - 12, "DOB:")
            form.textfield(name="patient_dob", tooltip="Date of Birth",
                           x=LEFT + 32, y=y - row_h + 3,
                           width=80, height=row_h - 6,
                           borderStyle="underlined", borderWidth=0.5,
                           borderColor=BORDER, fillColor=FILL,
                           textColor=black, fontName="Helvetica", fontSize=9,
                           forceBorder=False)
            c.drawString(LEFT + 120, y - 12, "Gender:")
            form.checkbox(name="patient_gender_m", tooltip="Male",
                          x=LEFT + 158, y=y - 13,
                          buttonStyle="check", borderStyle="solid",
                          shape="square", borderColor=BORDER, fillColor=FILL,
                          textColor=black, borderWidth=0.6, size=10)
            c.drawString(LEFT + 172, y - 12, "M")
            form.checkbox(name="patient_gender_f", tooltip="Female",
                          x=LEFT + 188, y=y - 13,
                          buttonStyle="check", borderStyle="solid",
                          shape="square", borderColor=BORDER, fillColor=FILL,
                          textColor=black, borderWidth=0.6, size=10)
            c.drawString(LEFT + 202, y - 12, "F")
        else:
            c.drawString(LEFT + 4, y - 12, left_label)
            label_w = c.stringWidth(left_label, "Helvetica", 9)
            form.textfield(name=left_field, tooltip=left_label.rstrip(":"),
                           x=LEFT + 6 + label_w + 2, y=y - row_h + 3,
                           width=col_w - label_w - 14, height=row_h - 6,
                           borderStyle="underlined", borderWidth=0.5,
                           borderColor=BORDER, fillColor=FILL,
                           textColor=black, fontName="Helvetica", fontSize=9,
                           forceBorder=False)
        # right cell
        c.drawString(LEFT + col_w + 4, y - 12, right_label)
        rlabel_w = c.stringWidth(right_label, "Helvetica", 9)
        form.textfield(name=right_field, tooltip=right_label.rstrip(":"),
                       x=LEFT + col_w + 6 + rlabel_w + 2, y=y - row_h + 3,
                       width=col_w - rlabel_w - 14, height=row_h - 6,
                       borderStyle="underlined", borderWidth=0.5,
                       borderColor=BORDER, fillColor=FILL,
                       textColor=black, fontName="Helvetica", fontSize=9,
                       forceBorder=False)
        y -= row_h
    y -= 8

    # ---------------------------------------------------------------------------
    # ITEM PRESCRIBED — Mark All That Apply
    # ---------------------------------------------------------------------------
    c.setFont("Helvetica-Bold", 10)
    c.drawString(LEFT, y, "ITEM PRESCRIBED  —  Mark All That Apply")
    y -= 4
    c.setLineWidth(0.5)
    c.line(LEFT, y, RIGHT, y)
    y -= 10

    items = [
        ("hcpcs_a6010_collagen_powder",      "A6010", "Vitalé Collagen Powder, 1 g packets"),
        ("hcpcs_a6021_collagen_2x2",         "A6021", "Vitalé Collagen Dressing, 2\" x 2\""),
        ("hcpcs_a6023_collagen_7x7",         "A6023", "Vitalé Collagen Dressing, 7\" x 7\""),
        ("hcpcs_a6203_composite_4x6",        "A6203", "Vitalé Composite Island Dressing, 4\" x 6\""),
        ("hcpcs_a6203_composite_4x10",       "A6203", "Vitalé Composite Island Dressing, 4\" x 10\""),
        ("hcpcs_a6203_silicone_3_5x4",       "A6203", "Vitalé Silicone Composite Dressing, 3.5\" x 4\""),
        ("hcpcs_a6204_composite_4x14",       "A6204", "Vitalé Composite Island Dressing, 4\" x 14\""),
        ("hcpcs_a6204_silicone_9x9",         "A6204", "Vitalé Silicone Composite Dressing, 9\" x 9\""),
    ]
    item_row_h = 14
    # Column layout for items: checkbox | hcpcs | description | qty | per
    # Widths: cb=14, hcpcs=42, desc=fill, qty=70, per=70
    cb_x = LEFT + 4
    hcpcs_x = LEFT + 22
    desc_x = LEFT + 60
    qty_x = LEFT + 320
    per_x = LEFT + 410
    c.setFont("Helvetica-Bold", 8)
    c.drawString(hcpcs_x, y, "HCPCS")
    c.drawString(desc_x, y, "Product")
    c.drawString(qty_x, y, "Qty:")
    c.drawString(per_x, y, "per:")
    y -= 4
    c.setLineWidth(0.3)
    c.line(LEFT, y, RIGHT, y)
    y -= 10

    for cb_name, hcpcs, desc in items:
        form.checkbox(name=cb_name, tooltip=f"{hcpcs} {desc}",
                      x=cb_x, y=y - 3,
                      buttonStyle="check", borderStyle="solid",
                      shape="square", borderColor=BORDER, fillColor=FILL,
                      textColor=black, borderWidth=0.6, size=10)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(hcpcs_x, y, hcpcs)
        c.setFont("Helvetica", 8.5)
        c.drawString(desc_x, y, desc)
        # qty field
        form.textfield(name=cb_name + "_qty", tooltip=f"Quantity for {hcpcs}",
                       x=qty_x + 16, y=y - 4, width=60, height=item_row_h - 4,
                       borderStyle="underlined", borderWidth=0.5,
                       borderColor=BORDER, fillColor=FILL,
                       textColor=black, fontName="Helvetica", fontSize=8.5,
                       forceBorder=False)
        # per field
        form.textfield(name=cb_name + "_per", tooltip=f"Frequency unit for {hcpcs} (e.g. week, month)",
                       x=per_x + 18, y=y - 4, width=80, height=item_row_h - 4,
                       borderStyle="underlined", borderWidth=0.5,
                       borderColor=BORDER, fillColor=FILL,
                       textColor=black, fontName="Helvetica", fontSize=8.5,
                       forceBorder=False)
        y -= item_row_h

    # Other row
    form.checkbox(name="hcpcs_other_cb", tooltip="Other dressing",
                  x=cb_x, y=y - 3,
                  buttonStyle="check", borderStyle="solid",
                  shape="square", borderColor=BORDER, fillColor=FILL,
                  textColor=black, borderWidth=0.6, size=10)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(hcpcs_x, y, "Other")
    form.textfield(name="hcpcs_other_desc", tooltip="Other dressing — describe (HCPCS, product, size)",
                   x=desc_x, y=y - 4, width=qty_x - desc_x - 8, height=item_row_h - 4,
                   borderStyle="underlined", borderWidth=0.5,
                   borderColor=BORDER, fillColor=FILL,
                   textColor=black, fontName="Helvetica", fontSize=8.5,
                   forceBorder=False)
    form.textfield(name="hcpcs_other_qty", tooltip="Quantity for Other",
                   x=qty_x + 16, y=y - 4, width=60, height=item_row_h - 4,
                   borderStyle="underlined", borderWidth=0.5,
                   borderColor=BORDER, fillColor=FILL,
                   textColor=black, fontName="Helvetica", fontSize=8.5,
                   forceBorder=False)
    form.textfield(name="hcpcs_other_per", tooltip="Frequency unit for Other",
                   x=per_x + 18, y=y - 4, width=80, height=item_row_h - 4,
                   borderStyle="underlined", borderWidth=0.5,
                   borderColor=BORDER, fillColor=FILL,
                   textColor=black, fontName="Helvetica", fontSize=8.5,
                   forceBorder=False)
    y -= item_row_h + 6

    # ---------------------------------------------------------------------------
    # WOUND INFORMATION
    # ---------------------------------------------------------------------------
    c.setFont("Helvetica-Bold", 10)
    c.drawString(LEFT, y, "WOUND INFORMATION")
    c.setFont("Helvetica", 7.5)
    c.drawRightString(RIGHT, y, "Governing LCD: L33831 — Surgical Dressings")
    y -= 4
    c.setLineWidth(0.5)
    c.line(LEFT, y, RIGHT, y)
    y -= 12

    # Row 1: Wound location | Date of onset
    c.setFont("Helvetica", 9)
    c.drawString(LEFT + 2, y, "Wound Location:")
    form.textfield(name="wound_location", tooltip="Wound Location",
                   x=LEFT + 86, y=y - 4, width=220, height=12,
                   borderStyle="underlined", borderWidth=0.5,
                   borderColor=BORDER, fillColor=FILL,
                   textColor=black, fontName="Helvetica", fontSize=9,
                   forceBorder=False)
    c.drawString(LEFT + 320, y, "Date of Onset:")
    form.textfield(name="wound_onset_date", tooltip="Date of Onset (MM/DD/YYYY)",
                   x=LEFT + 392, y=y - 4, width=130, height=12,
                   borderStyle="underlined", borderWidth=0.5,
                   borderColor=BORDER, fillColor=FILL,
                   textColor=black, fontName="Helvetica", fontSize=9,
                   forceBorder=False)
    y -= 16

    # Row 2: Wound type checkboxes
    c.drawString(LEFT + 2, y, "Wound Type:")
    types = [
        ("wound_type_surgical", "Surgical"),
        ("wound_type_pressure", "Pressure ulcer"),
        ("wound_type_diabetic", "Diabetic ulcer"),
        ("wound_type_venous", "Venous ulcer"),
        ("wound_type_arterial", "Arterial ulcer"),
    ]
    cx = LEFT + 70
    for name, label in types:
        form.checkbox(name=name, tooltip=label,
                      x=cx, y=y - 1,
                      buttonStyle="check", borderStyle="solid",
                      shape="square", borderColor=BORDER, fillColor=FILL,
                      textColor=black, borderWidth=0.6, size=9)
        c.drawString(cx + 12, y, label)
        cx += 12 + c.stringWidth(label, "Helvetica", 9) + 14
    y -= 14
    # Row 2b: Pressure ulcer stage + Other type
    c.setFont("Helvetica", 8.5)
    c.drawString(LEFT + 12, y, "If pressure ulcer, stage:")
    sx = LEFT + 130
    for stage in ("1", "2", "3", "4"):
        form.checkbox(name=f"wound_pressure_stage_{stage}", tooltip=f"Pressure ulcer stage {stage}",
                      x=sx, y=y - 1,
                      buttonStyle="check", borderStyle="solid",
                      shape="square", borderColor=BORDER, fillColor=FILL,
                      textColor=black, borderWidth=0.6, size=9)
        c.drawString(sx + 12, y, stage)
        sx += 28
    c.drawString(LEFT + 280, y, "Other type:")
    form.textfield(name="wound_type_other", tooltip="Other wound type — describe",
                   x=LEFT + 332, y=y - 4, width=190, height=11,
                   borderStyle="underlined", borderWidth=0.5,
                   borderColor=BORDER, fillColor=FILL,
                   textColor=black, fontName="Helvetica", fontSize=8.5,
                   forceBorder=False)
    y -= 16

    # Row 3: Dimensions + Drainage
    c.setFont("Helvetica", 9)
    c.drawString(LEFT + 2, y, "Wound Dimensions (cm):")
    dx = LEFT + 138
    for axis in ("L", "W", "D"):
        c.drawString(dx, y, axis)
        form.textfield(name=f"wound_dim_{axis.lower()}", tooltip=f"Wound {axis} (cm)",
                       x=dx + 10, y=y - 4, width=32, height=12,
                       borderStyle="underlined", borderWidth=0.5,
                       borderColor=BORDER, fillColor=FILL,
                       textColor=black, fontName="Helvetica", fontSize=9,
                       forceBorder=False)
        dx += 50
    c.drawString(LEFT + 296, y, "Drainage:")
    drx = LEFT + 348
    for name, label in (("drainage_none", "None"), ("drainage_light", "Light"), ("drainage_moderate", "Moderate"), ("drainage_heavy", "Heavy")):
        form.checkbox(name=name, tooltip=label,
                      x=drx, y=y - 1,
                      buttonStyle="check", borderStyle="solid",
                      shape="square", borderColor=BORDER, fillColor=FILL,
                      textColor=black, borderWidth=0.6, size=9)
        c.drawString(drx + 12, y, label)
        drx += 12 + c.stringWidth(label, "Helvetica", 9) + 8
    y -= 16

    # Row 4: Length of Need
    c.drawString(LEFT + 2, y, "Length of Need (months):")
    form.textfield(name="length_of_need_months", tooltip="Length of Need (months)",
                   x=LEFT + 142, y=y - 4, width=50, height=12,
                   borderStyle="underlined", borderWidth=0.5,
                   borderColor=BORDER, fillColor=FILL,
                   textColor=black, fontName="Helvetica", fontSize=9,
                   forceBorder=False)
    y -= 18

    # ---------------------------------------------------------------------------
    # DIAGNOSIS ICD10
    # ---------------------------------------------------------------------------
    c.setFont("Helvetica-Bold", 10)
    c.drawString(LEFT, y, "DIAGNOSIS ICD10")
    y -= 4
    c.setLineWidth(0.5)
    c.line(LEFT, y, RIGHT, y)
    y -= 10
    c.setFont("Helvetica-Bold", 8)
    c.drawString(LEFT + 4, y, "Diagnosis")
    c.drawString(LEFT + 280, y, "ICD-10 Code")
    y -= 10
    for i in range(1, 4):
        form.textfield(name=f"diagnosis_{i}_name", tooltip=f"Diagnosis {i} description",
                       x=LEFT + 4, y=y - 2, width=270, height=12,
                       borderStyle="underlined", borderWidth=0.5,
                       borderColor=BORDER, fillColor=FILL,
                       textColor=black, fontName="Helvetica", fontSize=9,
                       forceBorder=False)
        form.textfield(name=f"diagnosis_{i}_icd10", tooltip=f"ICD-10 code for diagnosis {i}",
                       x=LEFT + 280, y=y - 2, width=140, height=12,
                       borderStyle="underlined", borderWidth=0.5,
                       borderColor=BORDER, fillColor=FILL,
                       textColor=black, fontName="Helvetica", fontSize=9,
                       forceBorder=False)
        y -= 14
    y -= 4

    # ---------------------------------------------------------------------------
    # INSURANCE INFORMATION - Primary Insurance
    # ---------------------------------------------------------------------------
    c.setFont("Helvetica-Bold", 10)
    c.drawString(LEFT, y, "INSURANCE INFORMATION  —  Primary Insurance")
    y -= 4
    c.setLineWidth(0.5)
    c.line(LEFT, y, RIGHT, y)
    y -= 14

    ins_rows = [
        ("Name of Insured:", "insured_name", "Relation to Patient:", "insured_relation"),
        ("Insured Date of Birth:", "insured_dob", "Insurance Company:", "insurance_company"),
        ("Policy Number:", "policy_number", "Group Number:", "group_number"),
        ("Address:", "insured_address", "City / State / ZIP:", "insured_city_state_zip"),
        ("__PHONE_SECONDARY__", None, None, None),
    ]
    for left_label, left_field, right_label, right_field in ins_rows:
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.rect(LEFT, y - row_h, col_w, row_h, stroke=1, fill=0)
        c.rect(LEFT + col_w, y - row_h, col_w, row_h, stroke=1, fill=0)
        c.setFont("Helvetica", 9)
        if left_label == "__PHONE_SECONDARY__":
            c.drawString(LEFT + 4, y - 12, "Phone:")
            form.textfield(name="insured_phone", tooltip="Insured Phone",
                           x=LEFT + 36, y=y - row_h + 3,
                           width=col_w - 44, height=row_h - 6,
                           borderStyle="underlined", borderWidth=0.5,
                           borderColor=BORDER, fillColor=FILL,
                           textColor=black, fontName="Helvetica", fontSize=9,
                           forceBorder=False)
            form.checkbox(name="attach_secondary_insurance", tooltip="Attach Secondary Insurance",
                          x=LEFT + col_w + 6, y=y - 13,
                          buttonStyle="check", borderStyle="solid",
                          shape="square", borderColor=BORDER, fillColor=FILL,
                          textColor=black, borderWidth=0.6, size=10)
            c.drawString(LEFT + col_w + 22, y - 12, "Attach Secondary Insurance")
        else:
            c.drawString(LEFT + 4, y - 12, left_label)
            label_w = c.stringWidth(left_label, "Helvetica", 9)
            form.textfield(name=left_field, tooltip=left_label.rstrip(":"),
                           x=LEFT + 6 + label_w + 2, y=y - row_h + 3,
                           width=col_w - label_w - 14, height=row_h - 6,
                           borderStyle="underlined", borderWidth=0.5,
                           borderColor=BORDER, fillColor=FILL,
                           textColor=black, fontName="Helvetica", fontSize=9,
                           forceBorder=False)
            c.drawString(LEFT + col_w + 4, y - 12, right_label)
            rlabel_w = c.stringWidth(right_label, "Helvetica", 9)
            form.textfield(name=right_field, tooltip=right_label.rstrip(":"),
                           x=LEFT + col_w + 6 + rlabel_w + 2, y=y - row_h + 3,
                           width=col_w - rlabel_w - 14, height=row_h - 6,
                           borderStyle="underlined", borderWidth=0.5,
                           borderColor=BORDER, fillColor=FILL,
                           textColor=black, fontName="Helvetica", fontSize=9,
                           forceBorder=False)
        y -= row_h
    y -= 8

    # ---------------------------------------------------------------------------
    # Attestation paragraph
    # ---------------------------------------------------------------------------
    attestation = (
        "The information on this Standard Written Order is accurate and complete to the best of my knowledge. "
        "I confirm that this patient has the condition(s) noted above and is/was being treated by me and is "
        "able to use the ordered item. The medical records substantiate the prescribed condition(s). "
        "Supporting documentation will be provided upon request for Medicare/Insurance review."
    )
    c.setFont("Helvetica", 8.5)
    # Word-wrap manually
    words = attestation.split()
    line = ""
    line_w_max = USABLE_W
    lines = []
    for w in words:
        test = (line + " " + w).strip()
        if c.stringWidth(test, "Helvetica", 8.5) > line_w_max:
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

    # ---------------------------------------------------------------------------
    # Signature line
    # ---------------------------------------------------------------------------
    c.setFont("Helvetica", 9.5)
    c.drawString(LEFT, y, "Prescriber Signature:")
    form.textfield(name="prescriber_signature", tooltip="Prescriber Signature",
                   x=LEFT + 110, y=y - 4, width=240, height=14,
                   borderStyle="underlined", borderWidth=0.5,
                   borderColor=BORDER, fillColor=FILL,
                   textColor=black, fontName="Helvetica", fontSize=10,
                   forceBorder=False)
    c.drawString(LEFT + 360, y, "Date:")
    form.textfield(name="signature_date", tooltip="Signature Date (MM/DD/YYYY)",
                   x=LEFT + 392, y=y - 4, width=130, height=14,
                   borderStyle="underlined", borderWidth=0.5,
                   borderColor=BORDER, fillColor=FILL,
                   textColor=black, fontName="Helvetica", fontSize=10,
                   forceBorder=False)
    y -= 18
    c.drawString(LEFT, y, "Printed Name:")
    form.textfield(name="prescriber_printed_name", tooltip="Prescriber Printed Name",
                   x=LEFT + 80, y=y - 4, width=270, height=14,
                   borderStyle="underlined", borderWidth=0.5,
                   borderColor=BORDER, fillColor=FILL,
                   textColor=black, fontName="Helvetica", fontSize=10,
                   forceBorder=False)
    y -= 18

    # ---------------------------------------------------------------------------
    # Footer
    # ---------------------------------------------------------------------------
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
    return OUT


def section_header(c, y, left_text, left_x, right_text, right_x, col_w):
    """Draw a two-column section header bar (light shaded)."""
    c.setFillColor(SHADE)
    c.rect(LEFT, y - 14, USABLE_W, 14, stroke=0, fill=1)
    c.setFillColor(LABEL)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(LEFT + 6, y - 11, left_text)
    c.drawString(MID + 4, y - 11, right_text)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.rect(LEFT, y - 14, USABLE_W, 14, stroke=1, fill=0)


if __name__ == "__main__":
    out = build()
    size = out.stat().st_size
    print(f"Wrote {out} ({size:,} bytes, {size/1024:.1f} KB)")
