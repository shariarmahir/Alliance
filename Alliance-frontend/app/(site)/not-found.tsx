import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-4 text-4xl font-bold">404 — Page Not Found</h1>
      <p className="mb-6 text-slate-600">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="btn-glass">Back to Home</Link>
    </div>
  );
}
