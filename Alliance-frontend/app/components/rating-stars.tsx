import { Star } from "lucide-react";

export function RatingStars({ rating, count }: { rating: number; count?: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`size-3.5 ${i <= Math.round(rating) ? "fill-accent text-accent" : "text-slate-300"}`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-500">
        {rating.toFixed(1)}
        {count != null ? ` (${count})` : ""}
      </span>
    </div>
  );
}
