"use client";

import { useState } from "react";
import { Mail, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";

type FormValues = { name: string; email: string; subject: string; message: string };

const EMPTY_VALUES: FormValues = { name: "", email: "", subject: "", message: "" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactPage() {
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!values.name || !values.email || !values.subject || !values.message) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (!EMAIL_RE.test(values.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not send your message. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      toast.error("Could not send your message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
        <CheckCircle2 className="size-16 text-primary" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Message sent</h1>
        <p className="mt-2 text-slate-500">
          Thanks for reaching out. Our team will get back to you within one business day.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 flex items-center gap-3 text-3xl font-extrabold text-slate-900">
        <MessageSquare className="size-8 text-primary" /> Contact Us
      </h1>
      <p className="mb-8 text-slate-500">
        Have a question about a product, an existing order, or need help finding the right part?
        Send us a message and our team will respond within one business day.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
            <Mail className="size-5 text-primary" /> Your Details
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-name">Full Name *</Label>
              <Input
                id="c-name"
                required
                name="name"
                className="h-11 rounded-md border-slate-300 px-4"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-email">Email *</Label>
              <Input
                id="c-email"
                type="email"
                required
                name="email"
                className="h-11 rounded-md border-slate-300 px-4"
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="c-subject">Subject *</Label>
              <Input
                id="c-subject"
                required
                name="subject"
                className="h-11 rounded-md border-slate-300 px-4"
                value={values.subject}
                onChange={(e) => set("subject", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="c-message">Message *</Label>
              <Textarea
                id="c-message"
                required
                name="message"
                rows={6}
                className="rounded-md border-slate-300 px-4 py-3"
                placeholder="Tell us how we can help..."
                value={values.message}
                onChange={(e) => set("message", e.target.value)}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-glass-accent flex w-full items-center justify-center gap-2 disabled:opacity-60 sm:w-auto"
        >
          {submitting ? "Sending..." : "Send Message"} <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
