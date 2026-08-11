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
import type { Designation } from "@/app/lib/types";

const DESIGNATIONS: { value: Designation; label: string }[] = [
  { value: "sales-associate", label: "Sales Associate" },
  { value: "warehouse-staff", label: "Warehouse Staff" },
  { value: "support-agent", label: "Support Agent" },
  { value: "catalog-manager", label: "Catalog Manager" },
];

export function AddEmployeeDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [employeeIdNumber, setEmployeeIdNumber] = useState("");
  const [designation, setDesignation] = useState<Designation | "">("");

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setEmployeeIdNumber("");
    setDesignation("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, employeeIdNumber, designation }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not add employee.");
        toast.error(data.error ?? "Could not add employee.");
        return;
      }
      toast.success(`${name} added to the roster.`);
      resetForm();
      setOpen(false);
      onCreated();
    } catch {
      toast.error("Could not add employee.");
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
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
