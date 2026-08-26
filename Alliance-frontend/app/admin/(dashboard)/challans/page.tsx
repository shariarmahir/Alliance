import { readChallans, readQuotations } from "@/app/lib/admin-data";
import { ChallansClient } from "./challans-client";

// `?order=<id>` arrives from the Prepare Challan quick option on a confirmed
// price request. Read here rather than with useSearchParams, which would need
// its own Suspense boundary or the production build fails.
export default async function AdminChallansPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const [challans, quotations, params] = await Promise.all([
    readChallans(),
    readQuotations(),
    searchParams,
  ]);
  return (
    <ChallansClient
      initialChallans={challans}
      orders={quotations.filter((q) => q.status === "confirmed")}
      presetOrderId={params.order}
    />
  );
}
