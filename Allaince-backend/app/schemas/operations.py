from datetime import datetime
from typing import Literal

from pydantic import EmailStr, Field

from app.schemas.session import CamelModel

ContactMethod = Literal["email", "phone", "whatsapp"]
LeadTime = Literal["standard", "urgent", "flexible"]
DeliveryOptionId = Literal["standard", "express", "air"]
OrderStatus = Literal["pending", "confirmed", "cancelled"]
QuotationStatus = Literal["pending", "confirmed", "cancelled"]


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


class ConfirmQuotationRequest(CamelModel):
    ref_number: str | None = None
    subject: str = ""
    issued_date: str | None = None
    lines: list[ConfirmedLine] = Field(min_length=1)
    terms: QuotationTerms = Field(default_factory=QuotationTerms)


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


class QuotationStatusUpdate(CamelModel):
    status: QuotationStatus


class DeliveryStageUpdate(CamelModel):
    stage: int = Field(ge=0)


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


class TrackingStage(CamelModel):
    label: str
    hint: str


class TrackingOut(CamelModel):
    """Public tracking view — deliberately excludes pricing and contact
    details, since anyone holding a tracking ID can read it."""

    tracking_id: str
    ref_number: str
    status: QuotationStatus
    stage: int
    stage_label: str
    stages: list[TrackingStage]
    updated_at: datetime | None = None
    issued_at: datetime
