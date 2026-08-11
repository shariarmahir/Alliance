"use client";

import { MessageCircle } from "lucide-react";

export function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/8801713116019"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-[#25D366]/90 text-white shadow-lg shadow-[#25D366]/40 backdrop-blur-md transition-all duration-200 hover:scale-110 hover:bg-[#25D366] hover:shadow-xl"
    >
      <MessageCircle className="size-7" />
    </a>
  );
}
