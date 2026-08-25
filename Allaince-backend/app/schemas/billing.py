from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.session import CamelModel

InvoiceStatus = Literal[
    "pending", "submitted", "partially_paid", "paid", "completed", "cancelled"
]
ChallanStatus = Literal["pending", "dispatched", "delivered", "cancelled"]


class DocumentLineIn(CamelModel):
    slug: str = Field(default="", max_length=200)
    name: str = Field(default="", max_length=500)
    specifications: str = Field(default="", max_length=2000)
    unit: str = Field(default="Pcs", max_length=30)
    quantity: int = Field(ge=0, le=1_000_000)
    unit_price: float = Field(default=0.0, ge=0)


class InvoiceLineOut(CamelModel):
    slug: str
    name: str
    specifications: str
    unit: str
    quantity: int
    unit_price: float
    total: float


class InvoicePaymentIn(CamelModel):
    amount: float = Field(gt=0)
    method: str = Field(default="", max_length=60)
    reference: str = Field(default="", max_length=200)
    note: str = Field(default="", max_length=1000)
    received_at: datetime | None = None


class InvoicePaymentOut(CamelModel):
    id: str
    amount: float
    method: str
    reference: str
    note: str
    received_at: datetime


class InvoiceCreate(CamelModel):
    quotation_id: str
    lines: list[DocumentLineIn] = Field(min_length=1, max_length=200)
    discount: float = Field(default=0.0, ge=0)
    # Percent. Defaults to zero rather than a national rate: whether this
    # business charges VAT is a fact about the business, not a default.
    tax_rate: float = Field(default=0.0, ge=0, le=100)
    other_charges: float = Field(default=0.0, ge=0)
    notes: str = Field(default="", max_length=4000)


class InvoiceUpdate(CamelModel):
    lines: list[DocumentLineIn] | None = Field(default=None, max_length=200)
    discount: float | None = Field(default=None, ge=0)
    tax_rate: float | None = Field(default=None, ge=0, le=100)
    other_charges: float | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=4000)


class InvoiceOut(CamelModel):
    id: str
    quotation_id: str
    invoice_number: str | None
    invoice_date: str
    status: InvoiceStatus
    subtotal: float
    discount: float
    tax_rate: float
    tax_amount: float
    other_charges: float
    grand_total: float
    amount_paid: float
    notes: str
    created_at: datetime
    approved_at: datetime | None
    submitted_at: datetime | None
    completed_at: datetime | None
    lines: list[InvoiceLineOut]
    payments: list[InvoicePaymentOut]
    # Denormalized for the list screen, which would otherwise need the whole
    # quotation to render one row.
    customer_name: str = ""
    ref_number: str = ""
    po_number: str = ""

    @property
    def outstanding(self) -> float:
        return round(self.grand_total - self.amount_paid, 2)


class InvoiceStatusUpdate(CamelModel):
    status: InvoiceStatus


class ChallanLineOut(CamelModel):
    slug: str
    name: str
    specifications: str
    unit: str
    quantity: int


class ChallanCreate(CamelModel):
    quotation_id: str
    lines: list[DocumentLineIn] = Field(min_length=1, max_length=200)
    delivery_address: str = Field(default="", max_length=1000)
    remarks: str = Field(default="", max_length=2000)


class ChallanUpdate(CamelModel):
    lines: list[DocumentLineIn] | None = Field(default=None, max_length=200)
    delivery_address: str | None = Field(default=None, max_length=1000)
    remarks: str | None = Field(default=None, max_length=2000)


class ChallanDispatch(CamelModel):
    vehicle_number: str = Field(default="", max_length=60)
    driver_info: str = Field(default="", max_length=200)
    receiver_name: str = Field(default="", max_length=200)
    remarks: str | None = Field(default=None, max_length=2000)


class ChallanOut(CamelModel):
    id: str
    quotation_id: str
    challan_number: str | None
    challan_date: str
    status: ChallanStatus
    delivery_address: str
    vehicle_number: str
    driver_info: str
    receiver_name: str
    remarks: str
    signed_document_url: str | None
    created_at: datetime
    approved_at: datetime | None
    dispatched_at: datetime | None
    delivered_at: datetime | None
    lines: list[ChallanLineOut]
    customer_name: str = ""
    ref_number: str = ""
    po_number: str = ""


class ChallanStatusUpdate(CamelModel):
    status: ChallanStatus


class OrderBalanceLine(CamelModel):
    """Ordered → delivered → balance per line, which is what makes multiple
    challans against one order safe."""

    slug: str
    name: str
    specifications: str
    unit: str
    unit_price: float
    ordered: int
    delivered: int
    invoiced: int
    balance: int
    uninvoiced: int
