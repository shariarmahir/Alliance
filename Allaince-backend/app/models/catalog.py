from datetime import datetime

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, JSONVariant, UTCDateTime, utcnow


class Category(Base):
    __tablename__ = "categories"

    slug: Mapped[str] = mapped_column(String(160), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    icon: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    # Denormalized and recomputed on every product write, matching the
    # frontend's syncCategoryProductCounts — both the admin tab and the
    # storefront grid read it directly.
    product_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)


class Brand(Base):
    __tablename__ = "brands"

    slug: Mapped[str] = mapped_column(String(160), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    logo: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)


class Product(Base):
    __tablename__ = "products"

    slug: Mapped[str] = mapped_column(String(200), primary_key=True)
    part_number: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(300), index=True, nullable=False)
    brand: Mapped[str] = mapped_column(String(160), index=True, nullable=False)
    category_slug: Mapped[str] = mapped_column(
        String(160), ForeignKey("categories.slug", ondelete="RESTRICT"), index=True, nullable=False
    )
    image: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    gallery: Mapped[list] = mapped_column(JSONVariant, default=list, nullable=False)
    short_specs: Mapped[list] = mapped_column(JSONVariant, default=list, nullable=False)
    description: Mapped[list] = mapped_column(JSONVariant, default=list, nullable=False)
    alternate_part_numbers: Mapped[list] = mapped_column(JSONVariant, default=list, nullable=False)
    specifications: Mapped[dict] = mapped_column(JSONVariant, default=dict, nullable=False)
    price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # Derived from stock_qty via derive_stock_status — never set directly.
    stock: Mapped[str] = mapped_column(String(20), default="in-stock", nullable=False)
    stock_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    warranty_years: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, onupdate=utcnow, nullable=False
    )


class HeroImage(Base):
    __tablename__ = "hero_images"

    slot: Mapped[int] = mapped_column(Integer, primary_key=True)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, onupdate=utcnow, nullable=False
    )
