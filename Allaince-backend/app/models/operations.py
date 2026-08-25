import uuid
from datetime import datetime

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, JSONVariant, UTCDateTime, utcnow


def _uuid() -> str:
    return str(uuid.uuid4())


class Quotation(Base):
    __tablename__ = "quotations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # items/details are an immutable snapshot of what the customer asked for.
    # Normalising them into rows referencing `products` would let a later
    # catalog price change retroactively rewrite historical quotations.
    items: Mapped[list] = mapped_column(JSONVariant, default=list, nullable=False)
    total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    details: Mapped[dict] = mapped_column(JSONVariant, default=dict, nullable=False)
    # inbox -> pending -> submitted -> confirmed, or cancelled from any point.
    # "inbox" is an untouched customer request; "pending" means a quotation has
    # been prepared but not yet sent; "submitted" means it reached the customer.
    status: Mapped[str] = mapped_column(String(20), default="inbox", index=True, nullable=False)
    # Denormalized out of `details` so listing/analytics can filter and sort
    # without unpacking JSON on every row.
    customer_email: Mapped[str] = mapped_column(String(320), default="", index=True, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, index=True, nullable=False
    )
    # Set when the quotation email is actually sent, which is also what moves
    # the status to "submitted" — the two must not drift apart.
    quoted_sent_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    # The customer's own Work Order / PO document, uploaded at confirmation.
    # Stored as a URL from the same object storage products use.
    po_document_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    po_number: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    po_uploaded_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    confirmation: Mapped["OrderConfirmation | None"] = relationship(
        back_populates="quotation",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="selectin",
    )
    invoices: Mapped[list["Invoice"]] = relationship(
        back_populates="quotation",
        cascade="all, delete-orphan",
        order_by="Invoice.created_at",
    )
    challans: Mapped[list["Challan"]] = relationship(
        back_populates="quotation",
        cascade="all, delete-orphan",
        order_by="Challan.created_at",
    )


class OrderConfirmation(Base):
    """The admin's priced offer — a separate document from the request.

    Split into its own 1:1 table rather than a nullable JSON column on
    `quotations`: it has its own lifecycle (issued once, then only
    delivery_stage mutates), and retracting a confirmation becomes a clean
    row delete instead of field-nulling.
    """

    __tablename__ = "order_confirmations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    quotation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quotations.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    ref_number: Mapped[str] = mapped_column(String(100), nullable=False)
    subject: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # yyyy-mm-dd, admin-editable free text on the PDF � kept as a string
    # because it is a printed label, not a date the backend computes with.
    issued_date: Mapped[str] = mapped_column(String(10), nullable=False)
    tracking_id: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    lines: Mapped[list] = mapped_column(JSONVariant, default=list, nullable=False)
    grand_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    terms: Mapped[dict] = mapped_column(JSONVariant, default=dict, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, index=True, nullable=False
    )
    # Index into DELIVERY_STAGES; absent/0 means "Confirmed".
    delivery_stage: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    delivery_updated_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    # "pending" | "received". Tracked separately from delivery: an order can
    # be delivered before payment clears, or paid for before it ships.
    payment_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    # When payment was marked received — printed on the money receipt, so it
    # is the recorded fact rather than the day the PDF happens to be made.
    payment_received_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    quotation: Mapped["Quotation"] = relationship(back_populates="confirmation")


class Invoice(Base):
    """A billing document raised against a confirmed order.

    Separate from OrderConfirmation because one order can be invoiced more
    than once (part-billing a staged delivery), and because an invoice has its
    own approval lifecycle and its own number series that must not move when
    the underlying quotation is re-priced.
    """

    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    quotation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quotations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Assigned at approval, not at draft: an abandoned draft must not consume
    # a number out of the formal series.
    invoice_number: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    invoice_date: Mapped[str] = mapped_column(String(10), default="", nullable=False)
    # pending -> submitted -> (partially_paid) -> paid -> completed, or cancelled.
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True, nullable=False)

    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    discount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # Percent, not amount: the rate is what an admin knows, and storing the
    # computed figure alongside it means a rounding change can never make the
    # printed document disagree with itself.
    tax_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    other_charges: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    grand_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    amount_paid: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, index=True, nullable=False
    )
    approved_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    quotation: Mapped["Quotation"] = relationship(back_populates="invoices")
    lines: Mapped[list["InvoiceLine"]] = relationship(
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceLine.position",
        lazy="selectin",
    )
    payments: Mapped[list["InvoicePayment"]] = relationship(
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoicePayment.received_at",
        lazy="selectin",
    )


class InvoiceLine(Base):
    """One billed line. Real rows rather than JSON so invoiced quantities can
    be summed per order line to work out what is left to bill."""

    __tablename__ = "invoice_lines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    invoice_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("invoices.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Ties back to the confirmation line it bills, so balances are per product
    # rather than per position in a list that may be filtered.
    slug: Mapped[str] = mapped_column(String(200), default="", index=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, default="", nullable=False)
    specifications: Mapped[str] = mapped_column(Text, default="", nullable=False)
    unit: Mapped[str] = mapped_column(String(30), default="Pcs", nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    invoice: Mapped["Invoice"] = relationship(back_populates="lines")


class InvoicePayment(Base):
    """One receipt against an invoice. A list rather than a single figure:
    "partially paid" only means anything if each instalment is recorded."""

    __tablename__ = "invoice_payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    invoice_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("invoices.id", ondelete="CASCADE"), index=True, nullable=False
    )
    amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    method: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    reference: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    received_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)

    invoice: Mapped["Invoice"] = relationship(back_populates="payments")


class Challan(Base):
    """A delivery note for goods leaving against a confirmed order.

    One order may ship across several challans, so the balance of what is
    still owed is derived by summing delivered quantities rather than stored
    on the order, which would drift the moment a challan is cancelled.
    """

    __tablename__ = "challans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    quotation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quotations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    challan_number: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    challan_date: Mapped[str] = mapped_column(String(10), default="", nullable=False)
    # pending -> dispatched -> delivered, or cancelled.
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True, nullable=False)

    delivery_address: Mapped[str] = mapped_column(Text, default="", nullable=False)
    vehicle_number: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    driver_info: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    receiver_name: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    remarks: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # The customer's signed copy, once it comes back.
    signed_document_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, index=True, nullable=False
    )
    approved_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    dispatched_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    quotation: Mapped["Quotation"] = relationship(back_populates="challans")
    lines: Mapped[list["ChallanLine"]] = relationship(
        back_populates="challan",
        cascade="all, delete-orphan",
        order_by="ChallanLine.position",
        lazy="selectin",
    )


class ChallanLine(Base):
    """One delivered line. Rows rather than JSON because the delivered balance
    per product is a SUM across every non-cancelled challan on the order."""

    __tablename__ = "challan_lines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    challan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("challans.id", ondelete="CASCADE"), index=True, nullable=False
    )
    slug: Mapped[str] = mapped_column(String(200), default="", index=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, default="", nullable=False)
    specifications: Mapped[str] = mapped_column(Text, default="", nullable=False)
    unit: Mapped[str] = mapped_column(String(30), default="Pcs", nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    challan: Mapped["Challan"] = relationship(back_populates="lines")


class Order(Base):
    __tablename__ = "orders"

    order_number: Mapped[str] = mapped_column(String(60), primary_key=True)
    tracking_id: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    items: Mapped[list] = mapped_column(JSONVariant, default=list, nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    shipping_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    grand_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    delivery_option: Mapped[str] = mapped_column(String(30), default="standard", nullable=False)
    delivery_option_name: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    delivery_eta: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    preferred_date: Mapped[str] = mapped_column(String(10), default="", nullable=False)
    address: Mapped[dict] = mapped_column(JSONVariant, default=dict, nullable=False)
    placed_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True, nullable=False)
    customer_name: Mapped[str] = mapped_column(String(200), default="", index=True, nullable=False)


class ContactRequest(Base):
    __tablename__ = "contact_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), index=True, nullable=False)
    subject: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, index=True, nullable=False
    )
    handled: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)


class GmailToken(Base):
    """Single-row table holding the encrypted Gmail refresh token."""

    __tablename__ = "gmail_token"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    # AES-256-GCM ciphertext; the key derives from GMAIL_TOKEN_ENCRYPTION_SECRET.
    encrypted_refresh_token: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    connected_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)
