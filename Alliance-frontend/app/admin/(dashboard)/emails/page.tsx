import { readEmails } from "@/app/lib/admin-operations";
import { EmailsClient } from "./emails-client";

export default async function AdminEmailsPage() {
  const emails = await readEmails();
  return <EmailsClient emails={emails} />;
}
