"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import type { AccessArea, Designation } from "@/app/lib/types";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import { ACCESS_OPTIONS, DESIGNATIONS } from "./employee-fields";

export function AddEmployeeDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [employeeIdNumber, setEmployeeIdNumber] = useState("");
  const [designation, setDesignation] = useState<Designation | "">("");
  const [customDesignation, setCustomDesignation] = useState("");
  const [accessOptions, setAccessOptions] = useState<AccessArea[]>([]);

  function toggleAccess(area: AccessArea, granted: boolean) {
    setAccessOptions((prev) => (granted ? [...prev, area] : prev.filter((a) => a !== area)));
  }

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setEmployeeIdNumber("");
    setDesignation("");
    setCustomDesignation("");
    setAccessOptions([]);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/admin/employees", {
        method: "POST",
        body: {
          name,
          email,
          password,
          employeeIdNumber,
          designation,
          customDesignation: designation === "other" ? customDesignation : undefined,
          accessOptions,
        },
      });
      toast.success(`${name} added to the roster.`);
      resetForm();
      setOpen(false);
      onCreated();
    } catch (err) {
      // The API rejects duplicates and short passwords with a message worth
      // showing verbatim; only fall back when there is nothing to quote.
      const message =
        err instanceof ApiError ? err.message : "Could not add employee.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger render={<Button><Plus /> Add Employee</Button>} />
      <DialogContent className="w-full max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
          <DialogDescription>Creates a real, independently-loggable-in sub-admin account.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              aria-describedby="password-hint"
            />
            {/* The API enforces 8 characters; saying so up front beats a
                rejected submission that loses nothing but wastes a round trip. */}
            <p id="password-hint" className="text-[11.5px] text-ink-muted">
              At least 8 characters.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="employeeIdNumber">Employee ID</Label>
              <Input
                id="employeeIdNumber"
                placeholder="EMP-0042"
                value={employeeIdNumber}
                onChange={(e) => setEmployeeIdNumber(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Designation</Label>
              <Select value={designation} onValueChange={(v) => setDesignation((v as Designation) ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {DESIGNATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {designation === "other" && (
            <div className="space-y-1.5">
              <Label htmlFor="customDesignation">Custom designation</Label>
              <Input
                id="customDesignation"
                placeholder="e.g. Procurement Coordinator"
                value={customDesignation}
                onChange={(e) => setCustomDesignation(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Access options</Label>
            <p className="text-xs text-muted-foreground">
              Products, stock, tasks and leave are always available to sub-admins. Grant any of these
              separately.
            </p>
            <div className="space-y-2.5 rounded-md border p-3">
              {ACCESS_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium leading-none">{opt.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{opt.hint}</p>
                  </div>
                  <Switch
                    checked={accessOptions.includes(opt.value)}
                    onCheckedChange={(checked) => toggleAccess(opt.value, checked)}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting || !designation}>
              {submitting ? "Adding..." : "Add Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
