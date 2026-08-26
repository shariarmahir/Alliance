from datetime import datetime
from typing import Literal

from pydantic import EmailStr, Field

from app.schemas.session import CamelModel

ContactMethod = Literal["email", "phone", "whatsapp"]
LeadTime = Literal["standard", "urgent", "flexible"]
DeliveryOptionId = Literal["standard", "express", "air"]
OrderStatus = Literal["pending", "confirmed", "cancelled"]
# The commercial workflow, in order. "inbox" is an untouched customer request;
# "pending" means a quotation has been prepared but not yet sent; "submitted"
# means it was emailed to the customer. Cancellation can happen from any point.
QuotationStatus = Literal["inbox", "pending", "submitted", "confirmed", "cancelled"]
PaymentStatus = Literal["pending", "received"]


class QuoteItem(CamelModel):
    slug: str
    part_number: str
    name: str
    brand: str = ""
    image: str = ""
    price: float = Field(ge=0)
    quantity: int = Field(ge=1, le=100_000)


class QuotationDetails(CamelModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str = Field(default="", max_length=50)
    job_title: str = Field(default="", max_length=200)
    company_name: str = Field(default="", max_length=200)
    country: str = Field(default="", max_length=100)
    tax_id: str = Field(default="", max_length=100)
    company_website: str = Field(default="", max_length=300)
    preferred_contact: ContactMethod = "email"
    lead_time: LeadTime = "standard"
    notes: str = Field(default="", max_length=5000)
    submitted_at: datetime | None = None


class ConfirmedLine(CamelModel):
    """One priced line on an issued confirmation.

    Deliberately a different shape from QuoteItem: the customer's request and
    the admin's priced offer are separate documents, so issuing must not
    overwrite what was asked.
    """

    product_id: str = ""
    slug: str = ""
    part_number: str = ""
    name: str
    image: str = ""
    specifications: str = ""
    quantity: int = Field(ge=1)
    unit: str = "Pcs"
    unit_price: float = Field(ge=0)
    total: float = Field(default=0, ge=0)


class QuotationTerms(CamelModel):
    payment: str = ""
    delivery: str = ""
    offer_validity: str = ""
    vat_ait: str = ""
    stock: str = ""
    installation_charge: str = ""
    warranty: str = ""


class OrderConfirmationOut(CamelModel):
    ref_number: str
    subject: str
    issued_date: str
    tracking_id: str
    lines: list[ConfirmedLine]
    grand_total: float
    terms: QuotationTerms
    issued_at: datetime
    delivery_stage: int = 0
    delivery_updated_at: datetime | None = None
    # Section B: "When the total ordered quantity has been delivered, the
    # Work Order delivery status will automatically become Completed."
    # delivery_stage is the customer's tracker (Pending, Confirmed), not a
    # fulfilment state, so completion is reported separately -- derived from
    # the challans rather than stored, so it cannot disagree with them.
    delivery_complete: bool = False
    payment_status: PaymentStatus = "pending"
    payment_received_at: datetime | None = None
    # Derived from the order's invoices on every read, so the Orders screen
    # and the Invoices screen cannot disagree about one debt.
    amount_invoiced: float = 0.0
    amount_paid: float = 0.0
    amount_outstanding: float = 0.0


class ConfirmQuotationRequest(CamelModel):
    ref_number: str | None = None
    subject: str = ""
    issued_date: str | None = None
    lines: list[ConfirmedLine] = Field(min_length=1)
    terms: QuotationTerms = Field(default_factory=QuotationTerms)
    # False saves the priced offer but leaves the quotation pending, so an
    # admin can produce and send the PDF before deciding to accept it.
    confirm: bool = True


class QuotationCreate(CamelModel):
    items: list[QuoteItem] = Field(min_length=1, max_length=200)
    details: QuotationDetails


class QuotationOut(CamelModel):
    id: str
    items: list[QuoteItem]
    total: float
    details: QuotationDetails
    status: QuotationStatus
    confirmation: OrderConfirmationOut | None = None
    quoted_sent_at: datetime | None = None
    po_document_url: str | None = None
    po_number: str = ""
    po_uploaded_at: datetime | None = None


class QuotationStatusUpdate(CamelModel):
    status: QuotationStatus


class WorkOrderUpdate(CamelModel):
    """The customer's PO reference. The file itself arrives as multipart on the
    upload route; this carries the number, which is often known first."""

    po_number: str = Field(default="", max_length=120)


class QuotationEmailRequest(CamelModel):
    """The PDF the admin's browser rendered, base64-encoded.

    Optional: a caller that omits it falls back to the server's own renderer,
    which produces a plainer document. The browser's copy is preferred because
    it is the same file the download button produces, so the customer receives
    exactly what the admin saw.
    """

    pdf_base64: str | None = None
    file_name: str | None = None


class DeliveryStageUpdate(CamelModel):
    stage: int = Field(ge=0)


class PaymentStatusUpdate(CamelModel):
    status: PaymentStatus


class DeliveryAddress(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    line: str = Field(default="", max_length=500)
    city: str = Field(default="", max_length=120)
    country: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=50)


class OrderCreate(CamelModel):
    items: list[QuoteItem] = Field(min_length=1, max_length=200)
    subtotal: float = Field(ge=0)
    shipping_cost: float = Field(default=0, ge=0)
    grand_total: float = Field(ge=0)
    delivery_option: DeliveryOptionId = "standard"
    delivery_option_name: str = ""
    delivery_eta: str = ""
    preferred_date: str = ""
    address: DeliveryAddress


class OrderOut(CamelModel):
    order_number: str
    tracking_id: str
    items: list[QuoteItem]
    subtotal: float
    shipping_cost: float
    grand_total: float
    delivery_option: DeliveryOptionId
    delivery_option_name: str
    delivery_eta: str
    preferred_date: str
    address: DeliveryAddress
    placed_at: datetime
    status: OrderStatus


class OrderStatusUpdate(CamelModel):
    status: OrderStatus


class ContactRequestCreate(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    subject: str = Field(default="", max_length=300)
    message: str = Field(min_length=1, max_length=5000)


class ContactRequestOut(CamelModel):
    id: str
    name: str
    email: str
    subject: str
    message: str
    submitted_at: datetime
    handled: bool


class HandledUpdate(CamelModel):
    handled: bool
