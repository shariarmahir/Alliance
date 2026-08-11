"use client";

import { useState } from "react";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-10 text-center">
        <CheckCircle2 className="size-10 text-primary" />
        <p className="text-lg font-semibold text-slate-900">Thanks for reaching out!</p>
        <p className="text-sm text-slate-600">Our team will get back to you within one business day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-xl flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-name">Name</Label>
        <Input id="contact-name" name="name" required placeholder="Your name" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-email">Email</Label>
        <Input id="contact-email" name="email" type="email" required placeholder="you@company.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea id="contact-message" name="message" required placeholder="How can we help?" rows={4} />
      </div>
      <button type="submit" className="btn-glass-accent">
        Send Message
      </button>
    </form>
  );
}
