import { Header } from "@/app/components/header";
import { Footer } from "@/app/components/footer";
import { WhatsAppButton } from "@/app/components/whatsapp-button";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
