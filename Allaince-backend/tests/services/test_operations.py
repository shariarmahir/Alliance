from datetime import date

import pytest

from app.services.operations import (
    add_contact_request,
    add_order,
    add_quotation,
    amount_in_words,
    clamp_stage,
    confirm_quotation,
    default_subject,
    find_by_tracking_id,
    generate_ref_number,
    generate_tracking_id,
    list_quotations,
    mark_contact_request_handled,
    next_confirmation_sequence,
    update_delivery_stage,
    update_order_status,
    update_quotation_status,
)

ITEMS = [
    {"slug": "a", "partNumber": "PN-A", "name": "Drive", "price": 100.0, "quantity": 2},
    {"slug": "b", "partNumber": "PN-B", "name": "Relay", "price": 50.0, "quantity": 1},
]
DETAILS = {"fullName": "Ada", "email": "Ada@Example.com", "companyName": "Mahir Fabrics Ltd"}


# --- pure helpers -----------------------------------------------------------


@pytest.mark.parametrize(
    "amount,expected",
    [
        (0, "Zero Taka only."),
        (1, "One Taka only."),
        (15, "Fifteen Taka only."),
        (250, "Two Hundred Fifty Taka only."),
        (1000, "One Thousand Taka only."),
        (100000, "One Lakh Taka only."),
        (10000000, "One Crore Taka only."),
        (12345, "Twelve Thousand Three Hundred Forty Five Taka only."),
    ],
)
def test_amount_in_words(amount, expected):
    assert amount_in_words(amount) == expected


def test_amount_in_words_ignores_paisa_and_sign():
    assert amount_in_words(-42.99) == "Forty Two Taka only."


def test_generate_ref_number_uses_initials_and_year():
    assert generate_ref_number("Mahir Fabrics Ltd", 418, date(2026, 5, 1)) == "AIT/MFL/Q-0418/2026"


def test_generate_ref_number_falls_back_when_company_blank():
    assert generate_ref_number("", 1, date(2026, 1, 1)) == "AIT/GEN/Q-0001/2026"


def test_tracking_ids_are_unique_and_prefixed():
    ids = {generate_tracking_id() for _ in range(200)}
    assert len(ids) == 200
    assert all(i.startswith("AIT-TRK-") and len(i) == 16 for i in ids)


def test_default_subject_pluralises():
    assert "and 1 other item." in default_subject([{"name": "A"}, {"name": "B"}])
    assert "and 2 other items." in default_subject([{"name": "A"}, {"name": "B"}, {"name": "C"}])
    assert default_subject([{"name": "A"}]) == "Financial Offer for supply of A."


@pytest.mark.parametrize("raw,expected", [(None, 0), (-3, 0), (0, 0), (2, 2), (99, 3)])
def test_clamp_stage(raw, expected):
    assert clamp_stage(raw) == expected


# --- quotations -------------------------------------------------------------


async def test_add_quotation_computes_total_server_side(db):
    quotation = await add_quotation(db, ITEMS, DETAILS)
    # 100*2 + 50*1 — never taken from the client.
    assert quotation.total == 250.0
    assert quotation.status == "pending"
    assert quotation.customer_email == "ada@example.com"


async def test_confirm_issues_document_and_flips_status(db):
    quotation = await add_quotation(db, ITEMS, DETAILS)
    confirmed = await confirm_quotation(
        db,
        quotation.id,
        lines=[{"name": "Drive", "quantity": 2, "unitPrice": 120.0, "slug": "a"}],
    )
    assert confirmed.status == "confirmed"
    confirmation = confirmed.confirmation
    assert confirmation.grand_total == 240.0
    assert confirmation.ref_number == "AIT/MFL/Q-0001/" + str(date.today().year)
    assert confirmation.tracking_id.startswith("AIT-TRK-")
    assert confirmation.lines[0]["productId"].startswith("AIT-PRD-")
    # Line totals are recomputed, not trusted.
    assert confirmation.lines[0]["total"] == 240.0


async def test_confirming_does_not_overwrite_the_original_request(db):
    quotation = await add_quotation(db, ITEMS, DETAILS)
    await confirm_quotation(
        db, quotation.id, lines=[{"name": "Drive", "quantity": 2, "unitPrice": 999.0}]
    )
    # The customer's request and the admin's priced offer are separate documents.
    assert quotation.items == ITEMS
    assert quotation.total == 250.0


async def test_moving_off_confirmed_retracts_the_confirmation(db):
    quotation = await add_quotation(db, ITEMS, DETAILS)
    await confirm_quotation(db, quotation.id, lines=[{"name": "D", "quantity": 1, "unitPrice": 5}])
    assert quotation.confirmation is not None

    cancelled = await update_quotation_status(db, quotation.id, "cancelled")
    assert cancelled.status == "cancelled"
    assert cancelled.confirmation is None


async def test_confirmation_sequence_is_global(db):
    first = await add_quotation(db, ITEMS, DETAILS)
    second = await add_quotation(db, ITEMS, {**DETAILS, "companyName": "Other Co"})
    await confirm_quotation(db, first.id, lines=[{"name": "D", "quantity": 1, "unitPrice": 5}])
    await confirm_quotation(db, second.id, lines=[{"name": "D", "quantity": 1, "unitPrice": 5}])

    assert first.confirmation.ref_number.split("/")[2] == "Q-0001"
    # Sequence increments across the business, not per customer.
    assert second.confirmation.ref_number.split("/")[2] == "Q-0002"
    assert await next_confirmation_sequence(db) == 3


async def test_reissuing_keeps_the_original_ref_and_tracking_id(db):
    quotation = await add_quotation(db, ITEMS, DETAILS)
    await confirm_quotation(db, quotation.id, lines=[{"name": "D", "quantity": 1, "unitPrice": 5}])
    original_ref = quotation.confirmation.ref_number
    original_tracking = quotation.confirmation.tracking_id

    await confirm_quotation(db, quotation.id, lines=[{"name": "D", "quantity": 3, "unitPrice": 5}])
    # The customer may already hold both on a printed document.
    assert quotation.confirmation.ref_number == original_ref
    assert quotation.confirmation.tracking_id == original_tracking
    assert quotation.confirmation.grand_total == 15.0


async def test_confirm_returns_none_for_unknown_quotation(db):
    assert await confirm_quotation(db, "missing", lines=[]) is None


# --- tracking ---------------------------------------------------------------


async def test_find_by_tracking_id_is_case_insensitive(db):
    quotation = await add_quotation(db, ITEMS, DETAILS)
    await confirm_quotation(db, quotation.id, lines=[{"name": "D", "quantity": 1, "unitPrice": 5}])
    tracking = quotation.confirmation.tracking_id

    assert (await find_by_tracking_id(db, tracking.lower())).id == quotation.id
    assert (await find_by_tracking_id(db, f"  {tracking}  ")).id == quotation.id


async def test_unknown_tracking_id_returns_none(db):
    assert await find_by_tracking_id(db, "AIT-TRK-NOPE") is None
    assert await find_by_tracking_id(db, "") is None


async def test_update_delivery_stage_clamps_and_stamps(db):
    quotation = await add_quotation(db, ITEMS, DETAILS)
    await confirm_quotation(db, quotation.id, lines=[{"name": "D", "quantity": 1, "unitPrice": 5}])
    tracking = quotation.confirmation.tracking_id

    updated = await update_delivery_stage(db, tracking, 2)
    assert updated.confirmation.delivery_stage == 2
    assert updated.confirmation.delivery_updated_at is not None

    overflow = await update_delivery_stage(db, tracking, 99)
    assert overflow.confirmation.delivery_stage == 3


# --- orders and contact requests --------------------------------------------


async def test_add_order_generates_ids_server_side(db):
    order = await add_order(
        db,
        {
            "items": ITEMS,
            "subtotal": 250.0,
            "grand_total": 270.0,
            "address": {"name": "Ada Lovelace", "city": "Dhaka"},
        },
    )
    assert order.order_number.startswith("AIT-ORD-")
    assert order.tracking_id.startswith("AIT-TRK-")
    assert order.status == "pending"
    assert order.customer_name == "Ada Lovelace"


async def test_update_order_status(db):
    order = await add_order(db, {"items": [], "subtotal": 0, "grand_total": 0, "address": {}})
    updated = await update_order_status(db, order.order_number, "confirmed")
    assert updated.status == "confirmed"
    assert await update_order_status(db, "AIT-ORD-GHOST", "confirmed") is None


async def test_contact_request_lifecycle(db):
    request = await add_contact_request(
        db, {"name": "Ada", "email": "a@b.com", "subject": "Hi", "message": "Hello"}
    )
    assert request.handled is False

    handled = await mark_contact_request_handled(db, request.id, True)
    assert handled.handled is True
    assert await mark_contact_request_handled(db, "missing", True) is None


async def test_list_quotations_filters_by_status(db):
    a = await add_quotation(db, ITEMS, DETAILS)
    await add_quotation(db, ITEMS, DETAILS)
    await update_quotation_status(db, a.id, "cancelled")

    assert len(await list_quotations(db)) == 2
    assert len(await list_quotations(db, status="cancelled")) == 1
