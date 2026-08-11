import Link from "next/link";
import Image from "next/image";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { RatingStars } from "@/app/components/rating-stars";
import { formatPrice } from "@/app/lib/utils";
import type { TopSeller } from "@/app/lib/top-sellers";

export function TopSellerCard({ product }: { product: TopSeller }) {
  const browseHref = `/products?q=${encodeURIComponent(product.name)}`;

  return (
    <Card className="group overflow-hidden p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <Link href={browseHref} className="block">
        <div className="relative aspect-square overflow-hidden bg-slate-100">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <Badge className="absolute left-2 top-2 bg-accent text-accent-foreground hover:bg-accent">
            {product.condition}
          </Badge>
          {product.stock === 0 && (
            <Badge variant="destructive" className="absolute right-2 top-2">
              Out of Stock
            </Badge>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">{product.brand}</span>
        <Link href={browseHref}>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium hover:text-primary">{product.name}</h3>
        </Link>
        <RatingStars rating={product.rating} count={product.reviews} />
        <div className="mt-1">
          <span className="text-lg font-bold text-slate-900">{formatPrice(product.price)}</span>
          {product.oldPrice > product.price && (
            <span className="ml-2 text-xs text-slate-400 line-through">{formatPrice(product.oldPrice)}</span>
          )}
        </div>
        <Link href={browseHref} className="btn-glass-accent mt-1 w-full">
          Request Quotation
        </Link>
      </div>
    </Card>
  );
}
