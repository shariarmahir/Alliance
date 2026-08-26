import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

from app.integrations import pdf as pdf_integration

PROJECT_ROOT = Path(__file__).resolve().parents[2]

# WeasyPrint needs a native GTK stack that is not present on every machine
# (notably a bare Windows host). Where it is missing these skip rather than
# fail — the app's own PdfUnavailable path is covered separately below.
try:
    pdf_integration._render_html("<p>probe</p>")
    PDF_AVAILABLE = True
except Exception:
    PDF_AVAILABLE = False

requires_pdf = pytest.mark.skipif(not PDF_AVAILABLE, reason="WeasyPrint native libs absent")


# WeasyPrint's native allocations are not returned between renders inside one
# interpreter, so rendering several full-page documents in a single process
# exhausts memory on a constrained host. Each case therefore renders in a fresh
# subprocess — which also mirrors how production should do it: a request-scoped
# worker, not a long-lived one batching documents.
def _render_in_subprocess(builder: str) -> bytes:
    script = textwrap.dedent(
        f"""
        import logging, sys
        logging.disable(logging.CRITICAL)
        sys.path.insert(0, {str(PROJECT_ROOT)!r})
        from tests.integrations._pdf_fixtures import make_order, make_quotation
        from app.integrations import pdf

        sys.stdout.buffer.write({builder})
        """
    )
    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        cwd=str(PROJECT_ROOT),
    )
    if result.returncode != 0:
        raise AssertionError(result.stderr.decode("utf-8", "replace")[-2000:])
    return result.stdout


def _assert_is_pdf(data: bytes) -> None:
    assert data.startswith(b"%PDF-"), "not a PDF"
    assert data.rstrip().endswith(b"%%EOF"), "PDF is truncated"
    # A near-empty document would still carry the header and trailer.
    assert len(data) > 2000, f"suspiciously small PDF ({len(data)} bytes)"


@requires_pdf
def test_issued_quotation_pdf_renders():
    _assert_is_pdf(_render_in_subprocess("pdf.render_quotation_pdf(make_quotation())"))


@requires_pdf
def test_unpriced_request_pdf_renders_when_not_yet_confirmed():
    data = _render_in_subprocess(
        "pdf.render_quotation_pdf(make_quotation(confirmed=False))"
    )
    _assert_is_pdf(data)


@requires_pdf
def test_invoice_pdf_renders():
    _assert_is_pdf(_render_in_subprocess("pdf.render_invoice_pdf(make_order())"))


# --- HTML generation (no native rendering needed) ---------------------------
# These exercise the template logic directly, which is where the behaviour
# under test lives, without paying the cost of a native render.


def test_customer_html_is_escaped_not_injected():
    from tests.integrations._pdf_fixtures import make_quotation

    quotation = make_quotation()
    quotation.details = {
        **quotation.details,
        "companyName": '<script>alert(1)</script>',
    }

    captured = {}
    original = pdf_integration._render_html
    pdf_integration._render_html = lambda html: captured.setdefault("html", html) or b"%PDF-"
    try:
        pdf_integration.render_quotation_pdf(quotation)
    finally:
        pdf_integration._render_html = original

    html = captured["html"]
    # Customer-supplied text reaches the template, so a raw <script> tag would
    # otherwise be injected straight into the document markup.
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;" in html


def test_quotation_html_contains_the_priced_figures():
    from tests.integrations._pdf_fixtures import make_quotation

    captured = {}
    original = pdf_integration._render_html
    pdf_integration._render_html = lambda html: captured.setdefault("html", html) or b"%PDF-"
    try:
        pdf_integration.render_quotation_pdf(make_quotation())
    finally:
        pdf_integration._render_html = original

    html = captured["html"]
    assert "AIT/MFL/Q-0418/2026" in html
    assert "210,000.00" in html
    assert "Two Lakh Ten Thousand Taka only." in html


def test_missing_native_libs_raise_pdf_unavailable(monkeypatch):
    """The 503 path: callers must get a typed error, never a corrupt file."""
    import builtins

    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "weasyprint":
            raise OSError("cannot load library 'libgobject-2.0-0'")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    with pytest.raises(pdf_integration.PdfUnavailable, match="GTK/Pango/Cairo"):
        pdf_integration._render_html("<p>x</p>")


def _capture(render, *args):
    """Renders and returns the HTML instead of the PDF bytes."""
    captured = {}
    original = pdf_integration._render_html
    pdf_integration._render_html = lambda html: captured.setdefault("html", html) or b"%PDF-"
    try:
        render(*args)
    finally:
        pdf_integration._render_html = original
    return captured["html"]


def test_documents_carry_the_masthead_the_client_uses():
    """The client's own Quotation and Challan PDFs share one masthead: the
    logo mark, the AUTOLINK INTEGRATED TECHNOLOGIES line, and a filled title
    badge. A document that renders without them is off-brand to a customer
    holding the earlier ones."""
    from tests.integrations._pdf_fixtures import make_quotation

    html = _capture(pdf_integration.render_quotation_pdf, make_quotation())

    assert "AUTOLINK INTEGRATED TECHNOLOGIES" in html
    assert 'class="badge"' in html
    assert "Price Quotation" in html
    # The mark is embedded, not linked: WeasyPrint has no base URL here, so a
    # relative path would render an empty box.
    assert "data:image/png;base64," in html


def test_documents_close_and_foot_the_way_the_client_documents_do():
    from tests.integrations._pdf_fixtures import make_quotation

    html = _capture(pdf_integration.render_quotation_pdf, make_quotation())

    assert "Thinking you" in html
    assert pdf_integration.SIGNATORY in html
    assert "Corporate Office:" in html
    assert pdf_integration.PHONE in html


def test_the_address_block_reads_as_a_letter_not_a_label_grid():
    """"To / Managing Director / Company / Address", with the reference and
    date opposite -- the arrangement on the documents this replaces."""
    from tests.integrations._pdf_fixtures import make_quotation

    html = _capture(pdf_integration.render_quotation_pdf, make_quotation())

    assert 'class="to"' in html
    assert ">To<" in html or "To<br>" in html
    assert "Ref:" in html
    assert "Date:" in html
