import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getProductBySlug, getRelatedProducts } from "@/app/lib/mock-data";
import { formatPrice } from "@/app/lib/utils";
import { Badge } from "@/app/components/ui/badge";
import { ProductGallery } from "@/app/components/product-gallery";
import { QuoteCta } from "@/app/components/quote-cta";
import { ProductCard } from "@/app/components/product-card";
import type { Product } from "@/app/lib/types";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };
  return {
    title: `${product.partNumber} | ${product.name}`,
    description: product.description[0],
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const related = getRelatedProducts(slug);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <ProductGallery images={product.gallery} alt={product.name} />

        <div>
          <p className="text-sm font-medium uppercase text-primary">{product.brand}</p>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">{product.partNumber}</h1>
          <p className="mb-4 text-slate-600">{product.name}</p>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Badge variant={stockVariant[product.stock]}>{stockLabel[product.stock]}</Badge>
            <span className="flex items-center gap-1 text-sm text-slate-600">
              <ShieldCheck className="size-4 text-primary" /> {product.warrantyYears}-Year Warranty
            </span>
          </div>

          <p className="mb-6 text-3xl font-bold text-slate-900">{formatPrice(product.price)}</p>

          <ul className="mb-6 space-y-2 text-sm text-slate-700">
            {product.description.map((d) => (
              <li key={d} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>

          {product.alternatePartNumbers.length > 0 && (
            <div className="mb-6">
              <p className="mb-1 text-sm font-semibold text-slate-900">Also Known As</p>
              <p className="text-sm text-slate-600">{product.alternatePartNumbers.join(", ")}</p>
            </div>
          )}

          <QuoteCta product={product} />
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-lg font-bold text-slate-900">Specifications</h2>
          <table className="w-full overflow-hidden rounded-lg border border-slate-200 text-sm">
            <tbody>
              {Object.entries(product.specifications).map(([key, value], i) => (
                <tr key={key} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="border-b border-slate-200 px-4 py-2.5 font-medium text-slate-700">{key}</td>
                  <td className="border-b border-slate-200 px-4 py-2.5 text-slate-600">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-center rounded-xl border border-primary/20 bg-primary/5 p-6">
          <ShieldCheck className="mb-3 size-10 text-primary" />
          <h3 className="mb-2 text-lg font-bold text-slate-900">{product.warrantyYears}-Year Manufacturer Warranty</h3>
          <p className="text-sm text-slate-600">
            This part is covered by a {product.warrantyYears}-year warranty against defects in materials and
            workmanship. Contact our support team for warranty claims or technical assistance.
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-14">
          <h2 className="mb-6 text-xl font-bold text-slate-900">Customers Also Bought</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
