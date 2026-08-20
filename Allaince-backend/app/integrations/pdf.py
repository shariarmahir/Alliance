import logging
import os
import sys
from html import escape
from pathlib import Path

from app.config import settings
from app.services.operations import amount_in_words

logger = logging.getLogger("app.pdf")

# On Linux (including the Docker image) the loader finds Pango/Cairo on the
# normal library path. On Windows it will not: the GTK stack ships in a
# separate prefix that is never on PATH by default, so WeasyPrint fails to
# import even when correctly installed. Registering the directory here means
# no caller has to remember to export PATH.
_WINDOWS_GTK_CANDIDATES = (
    r"C:\msys64\mingw64\bin",
    r"C:\Program Files\GTK3-Runtime Win64\bin",
)


def _register_windows_gtk() -> None:
    if sys.platform != "win32":
        return

    configured = os.environ.get("WEASYPRINT_DLL_DIRECTORIES")
    candidates = (
        [c.strip() for c in configured.split(os.pathsep) if c.strip()]
        if configured
        else list(_WINDOWS_GTK_CANDIDATES)
    )

    for candidate in candidates:
        path = Path(candidate)
        if not (path / "libgobject-2.0-0.dll").exists():
            continue
        # add_dll_directory is what actually satisfies cffi's dlopen on
        # modern Python; PATH alone is no longer enough since 3.8.
        try:
            os.add_dll_directory(str(path))
        except (OSError, AttributeError):
            pass
        if str(path) not in os.environ.get("PATH", ""):
            os.environ["PATH"] = f"{path}{os.pathsep}{os.environ.get('PATH', '')}"
        return


_register_windows_gtk()


class PdfUnavailable(RuntimeError):
    """WeasyPrint (or its native GTK/Pango stack) is not installed.

    Raised rather than returning a broken file, so callers can decide between
    a 503 and sending an email without the attachment.
    """


def _render_html(html: str) -> bytes:
    try:
        from weasyprint import HTML
    except (ImportError, OSError) as exc:
        # OSError covers the common case of the Python package being present
        # while its native libraries are missing.
        raise PdfUnavailable(
            "PDF rendering is unavailable: WeasyPrint and its native "
            "dependencies (GTK/Pango/Cairo) are not installed on this host. "
            "On Windows, install MSYS2 and "
            "`pacman -S mingw-w64-x86_64-pango mingw-w64-x86_64-cairo "
            "mingw-w64-x86_64-gdk-pixbuf2`, or set WEASYPRINT_DLL_DIRECTORIES "
            "to the directory holding libgobject-2.0-0.dll."
        ) from exc
    return HTML(string=html).write_pdf()


BASE_CSS = """
@page { size: A4; margin: 14mm 12mm; }
* { box-sizing: border-box; }
body { font-family: "Helvetica", "Arial", sans-serif; font-size: 10.5px; color: #1a1a1a; margin: 0; }
.head { display: flex; justify-content: space-between; align-items: flex-start;
        border-bottom: 3px solid #007DCC; padding-bottom: 10px; margin-bottom: 14px; }
.brand { font-size: 22px; font-weight: 700; color: #007DCC; letter-spacing: -0.4px; }
.brand span { color: #FFB900; }
.tag { font-size: 9px; color: #667085; margin-top: 1px; letter-spacing: 0.4px; }
.meta { text-align: right; font-size: 9.5px; color: #475467; line-height: 1.55; }
h1 { font-size: 14px; margin: 0 0 8px; }
.subject { background: #f4f8fb; border-left: 3px solid #007DCC; padding: 8px 10px;
           margin-bottom: 12px; font-size: 10.5px; }
table { width: 100%; border-collapse: collapse; }
.items th { background: #007DCC; color: #fff; font-size: 9.5px; text-align: left;
            padding: 7px 6px; font-weight: 600; }
.items td { padding: 7px 6px; border-bottom: 1px solid #e4e7ec; vertical-align: top; }
.items tr:nth-child(even) td { background: #fafbfc; }
.num { text-align: right; white-space: nowrap; }
.totals { margin-top: 10px; width: 46%; margin-left: auto; }
.totals td { padding: 5px 6px; font-size: 11px; }
.totals .grand td { background: #007DCC; color: #fff; font-weight: 700; font-size: 12px; }
.words { margin-top: 8px; font-size: 10px; font-style: italic; color: #475467; }
.terms { margin-top: 16px; page-break-inside: avoid; }
.terms h2 { font-size: 11px; margin: 0 0 6px; color: #007DCC; }
.terms td { padding: 3px 6px 3px 0; font-size: 9.5px; vertical-align: top; }
.terms td:first-child { color: #667085; width: 34%; }
.foot { margin-top: 22px; border-top: 1px solid #e4e7ec; padding-top: 8px;
        font-size: 8.5px; color: #667085; text-align: center; }
.sign { margin-top: 30px; display: flex; justify-content: flex-end; }
.sign div { border-top: 1px solid #98a2b3; padding-top: 4px; width: 170px;
            text-align: center; font-size: 9.5px; }
"""

ADDRESS = "House: 104, Road: 15, Sector: 11, Uttara, Dhaka-1230, Bangladesh"


def _header(doc_title: str, meta_rows: list[tuple[str, str]]) -> str:
    meta = "<br>".join(f"<strong>{escape(k)}:</strong> {escape(str(v))}" for k, v in meta_rows)
    return f"""
    <div class="head">
      <div>
        <div class="brand">AutoLink<span>.</span></div>
        <div class="tag">INTEGRATED TECHNOLOGIES</div>
        <div class="tag">{escape(ADDRESS)}</div>
        <div class="tag">{escape(settings.resend_from_email)} &middot; +8801713-116019</div>
      </div>
      <div class="meta"><div style="font-size:13px;font-weight:700;color:#1a1a1a;
           margin-bottom:4px">{escape(doc_title)}</div>{meta}</div>
    </div>"""


def _footer() -> str:
    return (
        '<div class="foot">AutoLink Integrated Technologies &middot; '
        "This is a computer-generated document.</div>"
    )


def _customer_block(details: dict) -> str:
    rows = [
        ("Company", details.get("companyName") or "—"),
        ("Attention", details.get("fullName") or "—"),
        ("Email", details.get("email") or "—"),
        ("Phone", details.get("phone") or "—"),
    ]
    cells = "".join(
        f'<td style="padding:2px 10px 2px 0;font-size:9.5px"><span style="color:#667085">'
        f"{escape(k)}:</span> <strong>{escape(str(v))}</strong></td>"
        for k, v in rows[:2]
    )
    cells2 = "".join(
        f'<td style="padding:2px 10px 2px 0;font-size:9.5px"><span style="color:#667085">'
        f"{escape(k)}:</span> <strong>{escape(str(v))}</strong></td>"
        for k, v in rows[2:]
    )
    return f"<table><tr>{cells}</tr><tr>{cells2}</tr></table>"


def render_quotation_pdf(quotation) -> bytes:
    """Renders the issued offer, or the un-priced customer request when no
    confirmation exists yet."""
    details = quotation.details or {}
    confirmation = quotation.confirmation

    if confirmation is None:
        return _render_request_pdf(quotation)

    rows = ""
    for i, line in enumerate(confirmation.lines or [], start=1):
        rows += (
            f"<tr><td>{i}</td>"
            f"<td><strong>{escape(str(line.get('name', '')))}</strong><br>"
            f'<span style="color:#667085;font-size:9px">{escape(str(line.get("partNumber", "")))}</span></td>'
            f"<td>{escape(str(line.get('specifications', '')))}</td>"
            f"<td class='num'>{int(line.get('quantity', 0))}</td>"
            f"<td>{escape(str(line.get('unit', 'Pcs')))}</td>"
            f"<td class='num'>{float(line.get('unitPrice', 0)):,.2f}</td>"
            f"<td class='num'>{float(line.get('total', 0)):,.2f}</td></tr>"
        )

    terms = confirmation.terms or {}
    term_rows = "".join(
        f"<tr><td>{escape(label)}</td><td>{escape(str(terms.get(key, '')))}</td></tr>"
        for key, label in [
            ("payment", "Payment"),
            ("delivery", "Delivery"),
            ("offerValidity", "Offer Validity"),
            ("vatAit", "VAT & AIT"),
            ("stock", "Stock"),
            ("installationCharge", "Installation Charge"),
            ("warranty", "Warranty"),
        ]
    )

    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}</style></head><body>
    {_header("QUOTATION", [("Ref", confirmation.ref_number), ("Date", confirmation.issued_date), ("Tracking", confirmation.tracking_id)])}
    {_customer_block(details)}
    <div class="subject"><strong>Subject:</strong> {escape(confirmation.subject or "")}</div>
    <table class="items">
      <thead><tr><th style="width:5%">SL</th><th style="width:27%">Description</th>
      <th style="width:26%">Specifications</th><th style="width:8%" class="num">Qty</th>
      <th style="width:8%">Unit</th><th style="width:13%" class="num">Unit Price</th>
      <th style="width:13%" class="num">Total</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
    <table class="totals"><tr class="grand"><td>Grand Total</td>
      <td class="num">BDT {confirmation.grand_total:,.2f}</td></tr></table>
    <div class="words">In words: {escape(amount_in_words(confirmation.grand_total))}</div>
    <div class="terms"><h2>Terms &amp; Conditions</h2><table>{term_rows}</table></div>
    <div class="sign"><div>Authorised Signature</div></div>
    {_footer()}
    </body></html>"""
    return _render_html(html)


def _render_request_pdf(quotation) -> bytes:
    """The customer's un-priced request — what was asked for, before any offer."""
    details = quotation.details or {}
    rows = ""
    for i, item in enumerate(quotation.items or [], start=1):
        rows += (
            f"<tr><td>{i}</td>"
            f"<td><strong>{escape(str(item.get('name', '')))}</strong></td>"
            f"<td>{escape(str(item.get('partNumber', '')))}</td>"
            f"<td class='num'>{int(item.get('quantity', 0))}</td></tr>"
        )

    submitted = details.get("submittedAt", "")
    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}</style></head><body>
    {_header("PRICE REQUEST", [("Request ID", quotation.id[:8].upper()), ("Submitted", str(submitted)[:10])])}
    {_customer_block(details)}
    <div class="subject">This document lists the items requested. Pricing follows in a
      formal quotation once reviewed.</div>
    <table class="items">
      <thead><tr><th style="width:8%">SL</th><th style="width:52%">Description</th>
      <th style="width:25%">Part Number</th><th style="width:15%" class="num">Qty</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
    {_footer()}
    </body></html>"""
    return _render_html(html)


def render_invoice_pdf(order) -> bytes:
    address = order.address or {}
    rows = ""
    for i, item in enumerate(order.items or [], start=1):
        quantity = int(item.get("quantity", 0))
        price = float(item.get("price", 0))
        rows += (
            f"<tr><td>{i}</td>"
            f"<td><strong>{escape(str(item.get('name', '')))}</strong><br>"
            f'<span style="color:#667085;font-size:9px">{escape(str(item.get("partNumber", "")))}</span></td>'
            f"<td class='num'>{quantity}</td>"
            f"<td class='num'>{price:,.2f}</td>"
            f"<td class='num'>{quantity * price:,.2f}</td></tr>"
        )

    ship_to = "<br>".join(
        escape(str(v))
        for v in [address.get("name"), address.get("line"), address.get("city"),
                  address.get("country"), address.get("phone")]
        if v
    )

    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}</style></head><body>
    {_header("INVOICE", [("Order", order.order_number), ("Tracking", order.tracking_id), ("Date", str(order.placed_at)[:10])])}
    <div style="font-size:9.5px;margin-bottom:10px"><span style="color:#667085">Ship to:</span><br>{ship_to}</div>
    <table class="items">
      <thead><tr><th style="width:6%">SL</th><th style="width:46%">Description</th>
      <th style="width:12%" class="num">Qty</th><th style="width:18%" class="num">Unit Price</th>
      <th style="width:18%" class="num">Total</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
    <table class="totals">
      <tr><td>Subtotal</td><td class="num">{order.subtotal:,.2f}</td></tr>
      <tr><td>Shipping ({escape(order.delivery_option_name or order.delivery_option)})</td>
          <td class="num">{order.shipping_cost:,.2f}</td></tr>
      <tr class="grand"><td>Grand Total</td><td class="num">BDT {order.grand_total:,.2f}</td></tr>
    </table>
    <div class="words">In words: {escape(amount_in_words(order.grand_total))}</div>
    {_footer()}
    </body></html>"""
    return _render_html(html)
