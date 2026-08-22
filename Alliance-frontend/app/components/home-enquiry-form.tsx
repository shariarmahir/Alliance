"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/app/lib/api-browser";

const FIELD =
  "w-full rounded-md border border-[#dde3ea] bg-white px-3.5 py-2.5 text-[13.5px] text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary/15";
const LABEL = "mono-label mb-1.5 block text-[11.5px] tracking-[0.06em] text-ink-muted";

const EMPTY = { name: "", email: "", phone: "", country: "", address: "", notes: "" };

// Posts to the shared /api/contact endpoint. That route accepts
// name/email/subject/message only, so the extra bundle fields (phone, country,
// address) are folded into the message body rather than dropped.
export function HomeEnquiryForm() {
  const [values, setValues] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  function set(key: keyof typeof EMPTY, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name || !values.email || !values.notes) {
      toast.error("Please add your name, work email and requirements.");
      return;
    }

    setSubmitting(true);
    const message = [
      values.notes,
      "",
      `Phone / WhatsApp: ${values.phone || "—"}`,
      `Country: ${values.country || "—"}`,
      `Company address: ${values.address || "—"}`,
    ].join("\n");

    try {
      await apiFetch("/api/contact", {
        method: "POST",
        body: {
          name: values.name,
          email: values.email,
          subject: "Homepage enquiry — Ask Price",
          message,
        },
      });
      toast.success("Enquiry sent. An engineer replies within four working hours.");
      setValues(EMPTY);
    } catch {
      toast.error("Could not send your enquiry. Please WhatsApp +8801315-770099 instead.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>FULL NAME</span>
          <input
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Md. Arif Chowdhury"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>WORK EMAIL</span>
          <input
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="name@company.com"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>PHONE / WHATSAPP</span>
          <input
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+880 …"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>COUNTRY</span>
          <input
            value={values.country}
            onChange={(e) => set("country", e.target.value)}
            placeholder="Bangladesh"
            className={FIELD}
          />
        </label>
      </div>

      <label className="mt-3.5 block">
        <span className={LABEL}>COMPANY ADDRESS</span>
        <textarea
          rows={3}
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Company name, street, area, city, postcode, country"
          className={`${FIELD} resize-y leading-[1.6]`}
        />
      </label>

      <label className="mt-3.5 block">
        <span className={LABEL}>REQUIREMENTS NOTES</span>
        <textarea
          rows={3}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Part numbers, quantities, machine and line, target delivery date"
          className={`${FIELD} resize-y leading-[1.6]`}
        />
      </label>

      <div className="mt-4.5 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="btn-sheen inline-flex items-center justify-center rounded-md border border-white/40 bg-accent/90 px-6.5 py-3.5 text-sm font-bold text-ink shadow-[0_10px_24px_rgba(255,185,0,.3)] transition-all hover:-translate-y-0.5 hover:bg-accent disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send my enquiry"}
        </button>
        <span className="text-xs leading-[1.5] text-[#8a94a6]">
          Or WhatsApp <strong className="font-mono text-ink">+8801315-770099</strong>
          <br />
          Sun–Thu 09:00–19:00 GMT+6
        </span>
      </div>
    </form>
  );
}
