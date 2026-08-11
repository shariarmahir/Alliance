import Link from "next/link";

export default function ProductNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="mb-4 text-3xl font-bold">Product Not Found</h1>
      <p className="mb-6 text-slate-600">The part you&apos;re looking for doesn&apos;t exist or has been removed.</p>
      <Link href="/products" className="btn-glass">Browse All Products</Link>
    </div>
  );
}
