import { reviews } from "@/app/lib/static-content";
import { ClientReviewsCarousel } from "@/app/components/client-reviews-carousel";

export function ClientReviews() {
  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-7 py-14 md:px-[68px]">
      <div className="mb-5.5">
        <h2 className="mb-1 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-[27px]">What clients say</h2>
        <p className="text-[13.5px] text-[#64748b]">
          Verified after delivery · 4.8 average from 412 reviews
        </p>
      </div>

      <ClientReviewsCarousel reviews={reviews} />
    </section>
  );
}
