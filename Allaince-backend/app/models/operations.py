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
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True, nullable=False)
    # Denormalized out of `details` so listing/analytics can filter and sort
    # without unpacking JSON on every row.
    customer_email: Mapped[str] = mapped_column(String(320), default="", index=True, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, index=True, nullable=False
    )

    confirmation: Mapped["OrderConfirmation | None"] = relationship(
        back_populates="quotation",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="selectin",
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
