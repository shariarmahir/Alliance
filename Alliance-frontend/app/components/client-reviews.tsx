import { reviews } from "@/app/lib/mock-data";
import { ClientReviewsCarousel } from "@/app/components/client-reviews-carousel";

export function ClientReviews() {
  return (
    <section className="border-y border-slate-200 bg-slate-50 py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Client Reviews</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Trusted by Buyers Worldwide
            </h2>
          </div>
        </div>

        <ClientReviewsCarousel reviews={reviews} />
      </div>
    </section>
  );
}
