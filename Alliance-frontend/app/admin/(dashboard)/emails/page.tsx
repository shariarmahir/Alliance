import { readGmailStatus } from "@/app/lib/admin-data";
import { EmailsClient } from "./emails-client";

export default async function AdminEmailsPage() {
  const status = await readGmailStatus();
  return (
    <EmailsClient
      configured={status.configured}
      connected={status.connected}
      connectedSince={status.connectedAt ?? null}
    />
  );
}
