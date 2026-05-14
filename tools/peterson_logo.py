"""
Shared helper for drawing the Peterson Medical Equipment logo lockup into a
ReportLab PDF. Used by build-swo-bone-stimulator.py and build-swo-dressings.py
so the two generated SWO PDFs stay visually consistent.

Loads marketing-site/assets/img/logo-primary.svg and renders it at the requested
position/height. Width is auto-scaled from the SVG's intrinsic aspect ratio.
"""
from pathlib import Path
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF

REPO_ROOT = Path(__file__).parent.parent
LOGO_SVG = REPO_ROOT / "marketing-site" / "assets" / "img" / "logo-primary.svg"


def draw_logo(canvas, x, y, height_pt=34):
    """Draw the Peterson lockup at (x, y) with the given height in points.

    (x, y) is the BOTTOM-LEFT of the placed logo (matches ReportLab's coord
    system where y increases upward).
    Returns the rendered width in points so the caller can lay out around it.
    """
    drawing = svg2rlg(str(LOGO_SVG))
    if drawing is None:
        return 0
    # svg2rlg gives us the drawing at the SVG's intrinsic size in pt.
    intrinsic_w = drawing.width or 1
    intrinsic_h = drawing.height or 1
    scale = height_pt / intrinsic_h
    drawing.scale(scale, scale)
    # When you scale a Drawing object, its `width`/`height` attributes do NOT
    # update — but renderPDF uses the post-scale rendering. We translate via
    # the (x, y) we pass to renderPDF.draw().
    rendered_w = intrinsic_w * scale
    renderPDF.draw(drawing, canvas, x, y)
    return rendered_w


if __name__ == "__main__":
    # Smoke test: render the logo to a one-page PDF for visual check.
    from reportlab.pdfgen.canvas import Canvas
    from reportlab.lib.pagesizes import letter
    out = Path(__file__).parent / "_logo-smoketest.pdf"
    c = Canvas(str(out), pagesize=letter)
    w = draw_logo(c, 36, letter[1] - 80, height_pt=34)
    c.setFont("Helvetica", 9)
    c.drawString(36, letter[1] - 100, f"Logo rendered at {w:.1f} pt wide x 34 pt tall.")
    c.showPage()
    c.save()
    print(f"Wrote smoketest: {out}")
