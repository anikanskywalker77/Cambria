"""
Build the bone-growth-stimulator (E0748) Standard Written Order PDF.

Output: marketing-site/assets/forms/swo-bone-stimulator-e0748.pdf
        Single page, US Letter, fillable AcroForm fields. Matches the visual
        layout of the original vendor-supplied E0748 form, but every labeled
        blank now has a real fillable form field behind it (the vendor form
        had several "DOB:" / "Address:" / "Date of Surgery:" type labels with
        no field — this script fixes that).

This script is the source of truth for the form. To regenerate:

    pip install reportlab pypdf
    python tools/build-swo-bone-stimulator.py

The output PDF should never contain PHI — it is a blank template downloaded
publicly from petersonmedicalequipment.com.
"""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import black, white, HexColor

OUT = Path(__file__).parent.parent / "marketing-site" / "assets" / "forms" / "swo-bone-stimulator-e0748.pdf"

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
    """Underlined fillable text field (no border block — just the underline)."""
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


def labeled_field(c, form, label, field_name, x, y, total_w, label_font="Helvetica", label_size=9, field_size=9):
    """Draw 'Label:' and a fillable underlined text field beside it. Returns the
    width consumed."""
    c.setFont(label_font, label_size)
    c.drawString(x + 4, y - 12, label)
    label_w = c.stringWidth(label, label_font, label_size)
    tf(form, field_name, label.rstrip(":"), x + 6 + label_w + 2, y - 16, total_w - label_w - 14, height=12, font_size=field_size)


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


def section_header(c, label):
    """Bold section heading + thin rule beneath. Caller manages y."""
    c.setFont("Helvetica-Bold", 10)
    c.drawString(LEFT, label["y"], label["text"])
    c.setLineWidth(0.5)
    c.line(LEFT, label["y"] - 4, RIGHT, label["y"] - 4)


def build():
    c = canvas.Canvas(str(OUT), pagesize=letter)
    c.setTitle("Non-Invasive Spine Fusion Stimulator E0748 — Standard Written Order")
    c.setAuthor("Peterson Medical Equipment")
    c.setSubject("Letter of Medical Necessity / Standard Written Order — Spinal Bone Growth Stimulator (HCPCS E0748, LCD L33796)")
    c.setCreator("Peterson Medical Equipment")
    c.setKeywords("SWO, bone growth stimulator, osteogenesis stimulator, E0748, L33796, DMEPOS, spine fusion")

    form = c.acroForm

    # -------- Top strip ----------
    y = PAGE_H - MARGIN
    c.setFont("Helvetica-Bold", 9)
    c.drawString(LEFT, y - 9, "Fax: 1-509-980-7062")
    c.drawString(LEFT, y - 22, "Total Pages Sent: ______")
    c.drawRightString(RIGHT, y - 9, "Patient Number: ______")
    y -= 36

    # -------- Title ----------
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(MID, y, "NON-INVASIVE SPINE FUSION STIMULATOR  —  E0748")
    y -= 14
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(MID, y, "LETTER OF MEDICAL NECESSITY / STANDARD WRITTEN ORDER")
    y -= 6
    c.setLineWidth(1.2)
    c.line(LEFT, y, RIGHT, y)
    y -= 12

    # -------- PATIENT / PROVIDER ----------
    # Header bar
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
        ("Patient Name:", "patient_name", "Practice Name:", "practice_name"),
        ("Patient Phone:", "patient_phone", "Practitioner NPI:", "practitioner_npi"),
        ("__DOB_GENDER__", None, "Phone:", "practitioner_phone"),
        ("Address:", "patient_address", "Address:", "practitioner_address"),
        ("City/State/ZIP:", "patient_city_state_zip", "City/State/ZIP:", "practitioner_city_state_zip"),
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

    # -------- ITEM PRESCRIBED — Mark One ----------
    c.setFont("Helvetica-Bold", 10)
    c.drawString(LEFT, y, "ITEM PRESCRIBED  —  Mark One")
    y -= 4
    c.setLineWidth(0.5)
    c.line(LEFT, y, RIGHT, y)
    y -= 12

    items = [
        ("device_biomet_spinalpak", "Biomet SpinalPak Non-Invasive Spine Fusion Stimulator System"),
        ("device_enovis_spinallogic", "Enovis Regeneration SpinalLogic Device"),
        ("device_orthofix_spinal_stim", "Orthofix Spinal Stimulator"),
        ("device_orthofix_cervical_stim", "Orthofix Cervical Stimulator"),
        ("device_other", "Other product (describe):"),
    ]
    item_row_h = 16
    c.setFont("Helvetica", 9.5)
    for cb_name, label in items:
        cb(form, cb_name, label, LEFT + 4, y - 1, size=10)
        c.drawString(LEFT + 22, y, label)
        if cb_name == "device_other":
            tf(form, "device_other_desc", "Other product description",
               LEFT + 22 + c.stringWidth(label, "Helvetica", 9.5) + 6, y - 4,
               RIGHT - LEFT - 24 - c.stringWidth(label, "Helvetica", 9.5) - 6, height=12, font_size=9)
        y -= item_row_h

    # Estimated length row
    cb(form, "device_estimated_length_cb", "Estimated treatment length", LEFT + 4, y - 1, size=10)
    c.setFont("Helvetica", 9.5)
    c.drawString(LEFT + 22, y, "Estimated Length (months):")
    tf(form, "device_estimated_length_months", "Estimated length in months",
       LEFT + 22 + c.stringWidth("Estimated Length (months):", "Helvetica", 9.5) + 8,
       y - 4, 90, height=12, font_size=9)
    y -= item_row_h + 4

    # -------- SURGICAL INFORMATION ----------
    c.setFont("Helvetica-Bold", 10)
    c.drawString(LEFT, y, "SURGICAL INFORMATION")
    y -= 4
    c.setLineWidth(0.5)
    c.line(LEFT, y, RIGHT, y)
    y -= 12

    # Two-column with: Date of Surgery / Prior Surgery Date; Primary Fusion / Repeat Fusion;
    # Previous Fusion Date / Failed Fusions; Multi-Level Fusion + Levels / Other
    s_row_h = 16
    c.setFont("Helvetica", 9)
    # Row A
    c.drawString(LEFT + 4, y, "Date of Surgery:")
    tf(form, "surgery_date", "Date of Surgery (MM/DD/YYYY)",
       LEFT + 4 + c.stringWidth("Date of Surgery:", "Helvetica", 9) + 6, y - 4, 130, height=12)
    c.drawString(LEFT + col_w + 4, y, "Prior Surgery Date:")
    tf(form, "prior_surgery_date", "Prior Surgery Date",
       LEFT + col_w + 4 + c.stringWidth("Prior Surgery Date:", "Helvetica", 9) + 6, y - 4, 110, height=12)
    y -= s_row_h
    # Row B — checkboxes
    cb(form, "fusion_primary", "Primary Fusion", LEFT + 4, y - 1, size=10)
    c.drawString(LEFT + 22, y, "Primary Fusion")
    cb(form, "fusion_repeat", "Repeat Fusion", LEFT + col_w + 4, y - 1, size=10)
    c.drawString(LEFT + col_w + 22, y, "Repeat Fusion")
    y -= s_row_h
    # Row C
    c.drawString(LEFT + 4, y, "Previous Fusion Date:")
    tf(form, "previous_fusion_date", "Previous Fusion Date",
       LEFT + 4 + c.stringWidth("Previous Fusion Date:", "Helvetica", 9) + 6, y - 4, 110, height=12)
    c.drawString(LEFT + col_w + 4, y, "Failed Fusions:")
    tf(form, "failed_fusions", "Failed Fusions (count or notes)",
       LEFT + col_w + 4 + c.stringWidth("Failed Fusions:", "Helvetica", 9) + 6, y - 4, 130, height=12)
    y -= s_row_h
    # Row D — Multi-Level Fusion checkbox + Fusion Levels field
    cb(form, "fusion_multi_level", "Multi-Level Fusion", LEFT + 4, y - 1, size=10)
    c.drawString(LEFT + 22, y, "Multi-Level Fusion")
    c.drawString(LEFT + col_w + 4, y, "Fusion Levels:")
    tf(form, "fusion_levels", "Fusion Levels (e.g. L4-L5, L5-S1)",
       LEFT + col_w + 4 + c.stringWidth("Fusion Levels:", "Helvetica", 9) + 6, y - 4, 130, height=12)
    y -= s_row_h
    # Row E — Other (free text)
    cb(form, "surgical_other_cb", "Other surgical info", LEFT + 4, y - 1, size=10)
    c.drawString(LEFT + 22, y, "Other:")
    tf(form, "surgical_other", "Other surgical information",
       LEFT + 22 + c.stringWidth("Other:", "Helvetica", 9) + 6, y - 4, RIGHT - LEFT - 24 - c.stringWidth("Other:", "Helvetica", 9) - 6, height=12)
    y -= s_row_h + 4

    # -------- MEDICAL HISTORY — Mark All That Apply ----------
    c.setFont("Helvetica-Bold", 10)
    c.drawString(LEFT, y, "MEDICAL HISTORY  —  Mark All That Apply")
    y -= 4
    c.setLineWidth(0.5)
    c.line(LEFT, y, RIGHT, y)
    y -= 12

    history = [
        ("history_none", "None"),
        ("history_smoker", "Smoker"),
        ("history_obesity", "Obesity"),
        ("history_osteoporosis", "Osteoporosis"),
        ("history_rheumatoid_arthritis", "Rheumatoid Arthritis"),
        ("history_diabetes", "Diabetes"),
        ("history_renal_disease", "Renal Disease"),
        ("history_copd", "COPD"),
        ("history_hypertension", "Hypertension"),
        ("history_steroid_use", "Steroid Use"),
        ("history_spondylitis", "Spondylitis (Grade 1–5)"),
        ("history_other", "Other"),
    ]
    # 4 rows of 3
    cols = 3
    col_x = [LEFT + 4, LEFT + USABLE_W / 3 + 4, LEFT + 2 * USABLE_W / 3 + 4]
    h_row_h = 14
    for i, (name, label) in enumerate(history):
        r = i // cols
        col = i % cols
        cy = y - r * h_row_h
        cb(form, name, label, col_x[col], cy - 1, size=9)
        c.setFont("Helvetica", 9)
        c.drawString(col_x[col] + 12, cy, label)
        if name == "history_other":
            # Add a free-text field next to "Other"
            tf(form, "history_other_desc", "Other condition (describe)",
               col_x[col] + 12 + c.stringWidth(label, "Helvetica", 9) + 6, cy - 4, 80, height=11, font_size=8.5)
    y -= 4 * h_row_h + 4

    # -------- INSURANCE INFORMATION ----------
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

    # -------- Attestation ----------
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

    # -------- Signature ----------
    c.setFont("Helvetica", 9.5)
    c.drawString(LEFT, y, "Prescriber Signature:")
    tf(form, "prescriber_signature", "Prescriber Signature",
       LEFT + 110, y - 4, 240, height=14, font_size=10)
    c.drawString(LEFT + 360, y, "Date:")
    tf(form, "signature_date", "Signature Date (MM/DD/YYYY)",
       LEFT + 392, y - 4, 130, height=14, font_size=10)
    y -= 18
    c.drawString(LEFT, y, "Printed Name:")
    tf(form, "prescriber_printed_name", "Prescriber Printed Name",
       LEFT + 80, y - 4, 270, height=14, font_size=10)
    y -= 18

    # -------- Footer ----------
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


if __name__ == "__main__":
    out = build()
    size = out.stat().st_size
    print(f"Wrote {out} ({size:,} bytes, {size / 1024:.1f} KB)")
