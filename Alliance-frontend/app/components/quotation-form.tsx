"use client";

import { Building2, User, ClipboardList } from "lucide-react";
import type { ContactMethod, LeadTime, QuotationDetails } from "@/app/lib/types";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";

export type QuotationFormValues = Omit<QuotationDetails, "submittedAt">;

const CONTACT_METHODS: { id: ContactMethod; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "whatsapp", label: "WhatsApp" },
];

const LEAD_TIMES: { id: LeadTime; label: string; hint: string }[] = [
  { id: "standard", label: "Standard", hint: "No rush — within a few weeks" },
  { id: "urgent", label: "Urgent", hint: "Needed as soon as possible" },
  { id: "flexible", label: "Flexible", hint: "Open to AutoLink's recommendation" },
];

export function QuotationForm({
  values,
  onChange,
}: {
  values: QuotationFormValues;
  onChange: (values: QuotationFormValues) => void;
}) {
  function set<K extends keyof QuotationFormValues>(key: K, value: QuotationFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
          <User className="size-5 text-primary" /> Contact Information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-fullName">Full Name *</Label>
            <Input
              id="q-fullName"
              required
              name="fullName"
              value={values.fullName}
              onChange={(e) => set("fullName", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-jobTitle">Job Title / Position</Label>
            <Input
              id="q-jobTitle"
              name="jobTitle"
              placeholder="e.g. Procurement Manager"
              value={values.jobTitle}
              onChange={(e) => set("jobTitle", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-email">Email *</Label>
            <Input
              id="q-email"
              type="email"
              required
              name="email"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-phone">Phone *</Label>
            <Input
              id="q-phone"
              required
              name="phone"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
          <Building2 className="size-5 text-primary" /> Company Details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-companyName">Company Name *</Label>
            <Input
              id="q-companyName"
              required
              name="companyName"
              value={values.companyName}
              onChange={(e) => set("companyName", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-country">Country *</Label>
            <Input
              id="q-country"
              required
              name="country"
              value={values.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-taxId">Tax / VAT / Business Registration No.</Label>
            <Input
              id="q-taxId"
              name="taxId"
              value={values.taxId}
              onChange={(e) => set("taxId", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-companyWebsite">Company Website</Label>
            <Input
              id="q-companyWebsite"
              type="url"
              name="companyWebsite"
              placeholder="https://"
              value={values.companyWebsite}
              onChange={(e) => set("companyWebsite", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
          <ClipboardList className="size-5 text-primary" /> Quotation Preferences
        </h2>

        <div className="mb-5 flex flex-col gap-1.5">
          <Label htmlFor="q-preferredContact">Preferred Contact Method</Label>
          <Select
            value={values.preferredContact}
            onValueChange={(v) => set("preferredContact", v as ContactMethod)}
          >
            <SelectTrigger id="q-preferredContact" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_METHODS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-sm font-semibold text-slate-900">Required Lead Time</p>
          <RadioGroup
            value={values.leadTime}
            onValueChange={(v) => set("leadTime", v as LeadTime)}
            className="grid gap-3 sm:grid-cols-3"
          >
            {LEAD_TIMES.map((lt) => (
              <label
                key={lt.id}
                className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 ${
                  values.leadTime === lt.id ? "border-primary bg-secondary" : "border-slate-200"
                }`}
              >
                <span className="flex items-center gap-2 font-semibold text-slate-900">
                  <RadioGroupItem value={lt.id} /> {lt.label}
                </span>
                <span className="text-xs text-slate-500">{lt.hint}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q-notes">Project / Requirements Notes</Label>
          <Textarea
            id="q-notes"
            name="notes"
            rows={4}
            placeholder="Tell us about your application, technical requirements, or any special instructions..."
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
