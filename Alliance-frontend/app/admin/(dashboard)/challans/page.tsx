import { readChallans, readQuotations } from "@/app/lib/admin-data";
import { ChallansClient } from "./challans-client";

export default async function AdminChallansPage() {
  const [challans, quotations] = await Promise.all([readChallans(), readQuotations()]);
  return (
    <ChallansClient
      initialChallans={challans}
      orders={quotations.filter((q) => q.status === "confirmed")}
    />
  );
}
