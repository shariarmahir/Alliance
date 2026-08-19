from typing import Literal

from pydantic import Field, field_validator

from app.schemas.session import CamelModel

StockStatus = Literal["in-stock", "low-stock", "out-of-stock"]


class CategoryOut(CamelModel):
    slug: str
    name: str
    icon: str
    product_count: int


class CategoryCreate(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    icon: str = ""


class BrandOut(CamelModel):
    slug: str
    name: str
    logo: str


class ProductOut(CamelModel):
    slug: str
    part_number: str
    name: str
    brand: str
    category_slug: str
    image: str
    gallery: list[str]
    short_specs: list[str]
    description: list[str]
    alternate_part_numbers: list[str]
    specifications: dict[str, str]
    price: float
    stock: StockStatus
    stock_qty: int
    warranty_years: int


class ProductListOut(CamelModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int


class ProductCreate(CamelModel):
    name: str = Field(min_length=1, max_length=300)
    part_number: str = Field(min_length=1, max_length=200)
    brand: str = Field(min_length=1, max_length=160)
    category_slug: str = Field(min_length=1, max_length=160)
    image: str = ""
    gallery: list[str] = Field(default_factory=list)
    short_specs: list[str] = Field(default_factory=list)
    description: list[str] = Field(default_factory=list)
    alternate_part_numbers: list[str] = Field(default_factory=list)
    specifications: dict[str, str] = Field(default_factory=dict)
    price: float = Field(default=0, ge=0)
    stock_qty: int = Field(default=0, ge=0)
    warranty_years: int = Field(default=1, ge=0, le=100)


class ProductUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=300)
    part_number: str | None = Field(default=None, min_length=1, max_length=200)
    brand: str | None = None
    category_slug: str | None = None
    image: str | None = None
    gallery: list[str] | None = None
    short_specs: list[str] | None = None
    description: list[str] | None = None
    alternate_part_numbers: list[str] | None = None
    specifications: dict[str, str] | None = None
    price: float | None = Field(default=None, ge=0)
    stock_qty: int | None = Field(default=None, ge=0)
    warranty_years: int | None = Field(default=None, ge=0, le=100)


class StockUpdate(CamelModel):
    stock_qty: int = Field(ge=0)


class HeroImageOut(CamelModel):
    slot: int
    path: str


class BulkImportError(CamelModel):
    line_number: int | None
    message: str


class BulkImportResult(CamelModel):
    imported: int
    errors: list[BulkImportError]
    products: list[ProductOut]


class BulkImportRequest(CamelModel):
    category_slug: str
    # The raw numbered-list text pasted into the admin bulk-import box.
    text: str

    @field_validator("text")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Bulk import text cannot be empty.")
        return v


class TopSellerOut(CamelModel):
    """A product plus the quantity that earned it a top-seller slot.

    Computed from issued order confirmations, not a stored rank column.
    """

    product: ProductOut
    quantity_sold: int
