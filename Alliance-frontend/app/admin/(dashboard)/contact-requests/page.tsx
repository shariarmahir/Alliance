import { readContactRequests } from "@/app/lib/admin-data";
import { ContactRequestsClient } from "./contact-requests-client";

export default async function AdminContactRequestsPage() {
  const requests = await readContactRequests();
  return <ContactRequestsClient initialRequests={requests} />;
}
