import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/app/lib/types";
import { formatPrice } from "@/app/lib/utils";
import { Badge } from "@/app/components/ui/badge";
import { RequestQuoteButton } from "@/app/components/request-quote-button";

const stockLabel: Record<Product["stock"], string> = {
  "in-stock": "In Stock",
  "low-stock": "Low Stock",
  "out-of-stock": "Out of Stock",
};
const stockVariant: Record<Product["stock"], "default" | "secondary" | "destructive"> = {
  "in-stock": "default",
  "low-stock": "secondary",
  "out-of-stock": "destructive",
};

export function ProductCard({ product }: { product: Product }) {
  return (
    <div className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-lg">
      <Link href={`/products/${product.slug}`} className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-slate-50">
        <Image src={product.image} alt={product.name} fill className="object-contain p-4" />
      </Link>
      <Badge variant={stockVariant[product.stock]} className="mb-2 w-fit">{stockLabel[product.stock]}</Badge>
      <p className="text-xs font-medium uppercase text-primary">{product.brand}</p>
      <Link href={`/products/${product.slug}`} className="font-semibold text-slate-900 hover:text-primary">
        {product.partNumber}
      </Link>
      <ul className="my-2 space-y-1 text-xs text-slate-600">
        {product.shortSpecs.slice(0, 2).map((s) => <li key={s}>• {s}</li>)}
      </ul>
      <p className="mb-3 text-lg font-bold text-slate-900">{formatPrice(product.price)}</p>
      <div className="mt-auto flex flex-col gap-2">
        <Link href={`/products/${product.slug}`} className="btn-glass">View Details</Link>
        <RequestQuoteButton product={product} />
      </div>
    </div>
  );
}
