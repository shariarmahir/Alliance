import { readMailboxStatus } from "@/app/lib/admin-data";
import { EmailsClient } from "./emails-client";

export default async function AdminEmailsPage() {
  const status = await readMailboxStatus();
  return (
    <EmailsClient
      configured={status.configured}
      connected={status.connected}
      connectedSince={status.connectedAt ?? null}
      provider={status.provider}
      error={status.error ?? null}
    />
  );
}
