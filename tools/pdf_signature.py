"""
Post-process a ReportLab-generated PDF to convert a designated rectangle into
a proper PDF AcroForm signature field (/FT /Sig).

ReportLab's AcroForm wrapper supports text fields, checkboxes, radio groups,
list boxes, etc. — but not /Sig. We generate the rest of the form normally,
then use pypdf to inject a Sig-typed widget at the coordinates where the
signature should go. When opened in Adobe Acrobat, Preview (macOS), or any
modern browser PDF reader, the /Sig field becomes a clickable "Sign here"
target that opens the reader's drawn-signature workflow.

This is NOT a cryptographic digital signature — it's a placeholder for one.
The SIGNED state is created at signing time (drawn ink, imported image, or
true X.509 cert if the signer has a Digital ID — all valid for SWO purposes).

Usage:

    from pdf_signature import add_signature_field

    # ... build the PDF with reportlab, save it ...
    add_signature_field(
        pdf_path=Path("swo.pdf"),
        page_index=0,
        x=146, y=124,     # bottom-left of the field, in PDF points
        width=240, height=14,
        field_name="prescriber_signature",
    )
"""
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
    DictionaryObject,
    FloatObject,
    NameObject,
    NumberObject,
    TextStringObject,
)


def add_signature_field(
    pdf_path: Path,
    page_index: int,
    x: float,
    y: float,
    width: float,
    height: float,
    field_name: str = "prescriber_signature",
    tooltip: str = "Sign here",
) -> None:
    """Add an unsigned /Sig form field at (x, y, width, height) on the given
    page of the PDF, modifying it in place.

    Coordinates are PDF points (1/72 inch); origin is bottom-left of the page.
    """
    reader = PdfReader(str(pdf_path))
    writer = PdfWriter(clone_from=reader)

    page = writer.pages[page_index]

    # Build the signature widget annotation + form field (combined into one dict
    # since they reference the same object — standard AcroForm pattern).
    sig_field = DictionaryObject(
        {
            # Form-field part
            NameObject("/FT"): NameObject("/Sig"),
            NameObject("/T"): TextStringObject(field_name),
            NameObject("/TU"): TextStringObject(tooltip),
            NameObject("/Ff"): NumberObject(0),  # no special flags
            # Annotation part
            NameObject("/Type"): NameObject("/Annot"),
            NameObject("/Subtype"): NameObject("/Widget"),
            NameObject("/Rect"): ArrayObject(
                [
                    FloatObject(x),
                    FloatObject(y),
                    FloatObject(x + width),
                    FloatObject(y + height),
                ]
            ),
            # Annotation flags: Print (4) — visible in print + onscreen, not hidden
            NameObject("/F"): NumberObject(4),
            # Empty appearance — reader will use its default look until signed
            NameObject("/MK"): DictionaryObject(
                {
                    NameObject("/BC"): ArrayObject([NumberObject(0), NumberObject(0), NumberObject(0)]),
                }
            ),
            # Page back-reference
            NameObject("/P"): page.indirect_reference,
        }
    )
    sig_ref = writer._add_object(sig_field)

    # Attach widget to the page's /Annots
    if NameObject("/Annots") in page:
        page[NameObject("/Annots")].append(sig_ref)
    else:
        page[NameObject("/Annots")] = ArrayObject([sig_ref])

    # Attach field to the document's AcroForm /Fields
    root = writer._root_object
    if NameObject("/AcroForm") not in root:
        root[NameObject("/AcroForm")] = DictionaryObject(
            {NameObject("/Fields"): ArrayObject(), NameObject("/SigFlags"): NumberObject(3)}
        )
    acroform = root[NameObject("/AcroForm")]
    if NameObject("/Fields") not in acroform:
        acroform[NameObject("/Fields")] = ArrayObject()
    acroform[NameObject("/Fields")].append(sig_ref)

    # SigFlags = bitfield: 1 = SignaturesExist (tells reader the document
    # contains a signature field). We do NOT set bit 2 (AppendOnly) because
    # this is an unsigned placeholder — append-only is only meaningful for
    # already-signed documents.
    acroform[NameObject("/SigFlags")] = NumberObject(1)

    # IMPORTANT: do NOT set /NeedAppearances. Setting it to True causes the
    # reader to regenerate appearance streams for ALL form fields, which
    # strips the underlines, checkbox squares, and other visual treatments
    # ReportLab already baked into the existing fields. The /Sig field works
    # fine without it — readers know how to render unsigned signature fields
    # using their own default appearance.

    # Write back over the same path
    with open(pdf_path, "wb") as fh:
        writer.write(fh)
