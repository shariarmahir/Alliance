import { notFound } from "next/navigation";
import { getProductBySlug } from "@/app/lib/mock-data";
import { QuoteForm } from "@/app/components/quote-form";

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ productSlug: string }>;
  searchParams: Promise<{ qty?: string }>;
}) {
  const { productSlug } = await params;
  const { qty } = await searchParams;
  const product = getProductBySlug(productSlug);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Request a Quotation</h1>
      <QuoteForm product={product} initialQty={Number(qty ?? "1") || 1} />
    </div>
  );
}
