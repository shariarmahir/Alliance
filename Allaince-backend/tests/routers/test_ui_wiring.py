"""Every endpoint the admin UI calls must exist on the backend.

Eight passes tested the API directly. None checked that the screens are
wired to it: a path typo, a renamed route or a method mismatch produces a
404 in the browser while every backend test still passes, because the tests
call the real path and the UI calls the wrong one.

The list is transcribed from the fetch calls in Alliance-frontend/app/admin
and app/lib. A route removed or renamed without updating the UI fails here.
"""

from app.main import app

# (method, path) exactly as FastAPI registers them.
UI_CALLS = [
    # -- Document 2, Section A: Invoice -----------------------------------
    ("POST", "/api/admin/invoices"),
    ("GET", "/api/admin/invoices"),
    ("GET", "/api/admin/invoices/{invoice_id}"),
    ("PATCH", "/api/admin/invoices/{invoice_id}"),
    ("POST", "/api/admin/invoices/{invoice_id}/approve"),
    ("POST", "/api/admin/invoices/{invoice_id}/submit"),
    ("POST", "/api/admin/invoices/{invoice_id}/payments"),
    ("PATCH", "/api/admin/invoices/{invoice_id}/status"),
    ("GET", "/api/admin/invoices/{invoice_id}/pdf"),
    # -- Document 2, Section B: Challan ------------------------------------
    ("POST", "/api/admin/challans"),
    ("GET", "/api/admin/challans"),
    ("GET", "/api/admin/challans/{challan_id}"),
    ("PATCH", "/api/admin/challans/{challan_id}"),
    ("POST", "/api/admin/challans/{challan_id}/approve"),
    ("POST", "/api/admin/challans/{challan_id}/dispatch"),
    ("POST", "/api/admin/challans/{challan_id}/deliver"),
    ("PATCH", "/api/admin/challans/{challan_id}/status"),
    ("GET", "/api/admin/challans/{challan_id}/pdf"),
    # -- Document 1, and Section C's quick options -------------------------
    ("GET", "/api/admin/quotations"),
    ("GET", "/api/admin/quotations/{quotation_id}"),
    ("POST", "/api/admin/quotations/{quotation_id}/confirm"),
    ("PATCH", "/api/admin/quotations/{quotation_id}/status"),
    ("POST", "/api/admin/quotations/{quotation_id}/email"),
    ("GET", "/api/admin/quotations/{quotation_id}/pdf"),
    ("GET", "/api/admin/quotations/{quotation_id}/history"),
    ("GET", "/api/admin/quotations/{quotation_id}/balances"),
    ("PATCH", "/api/admin/quotations/{quotation_id}/work-order"),
    ("POST", "/api/admin/quotations/{quotation_id}/work-order"),
    ("PATCH", "/api/admin/quotations/{quotation_id}/delivery"),
    ("PATCH", "/api/admin/quotations/{quotation_id}/payment"),
]


def _registered() -> set[tuple[str, str]]:
    """Walks nested routers as well as top-level routes.

    This FastAPI version keeps each include_router() call as an
    _IncludedRouter holding its own .routes, so a flat scan of app.routes
    finds none of the API endpoints.
    """
    out: set[tuple[str, str]] = set()

    def walk(routes) -> None:
        for route in routes:
            # An _IncludedRouter holds its endpoints on .original_router,
            # not .routes -- a flat scan, or one that only follows .routes,
            # finds none of the API paths.
            inner = getattr(route, "original_router", None)
            if inner is not None:
                walk(inner.routes)
            nested = getattr(route, "routes", None)
            if nested:
                walk(nested)
            path = getattr(route, "path", None)
            methods = getattr(route, "methods", None)
            if not path or not methods:
                continue
            for method in methods:
                if method not in ("HEAD", "OPTIONS"):
                    out.add((method, path))

    walk(app.routes)
    return out


def test_every_endpoint_the_admin_ui_calls_is_registered():
    registered = _registered()
    missing = [call for call in UI_CALLS if call not in registered]
    assert not missing, (
        "The admin UI calls endpoints that do not exist -- these 404 in the "
        f"browser while the backend tests pass: {missing}"
    )
