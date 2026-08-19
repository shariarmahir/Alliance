import { isGmailConnected } from "@/app/lib/gmail-client";
import { EmailsClient } from "./emails-client";

export default async function AdminEmailsPage() {
  const status = await isGmailConnected();
  return <EmailsClient connected={status.connected} connectedSince={status.savedAt ?? null} />;
}
