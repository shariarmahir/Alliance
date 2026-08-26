"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
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
import { Switch } from "@/app/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import type { AccessArea, Designation, SafeEmployee } from "@/app/lib/types";
import { ACCESS_OPTIONS, DESIGNATIONS, impliedBy } from "./employee-fields";

// Editing an existing sub-admin. Everything the Add dialog collects except
// the password, which is handled separately below: a password field
// pre-filled with anything is either a lie or a leak, and one left blank on
// a normal edit must not be read as "set the password to empty".
//
// PATCH /employees/{id} takes exclude_unset, so only what changed is sent.
// That matters for the password in particular — omitting the key entirely is
// what leaves the existing one alone.

export function EditEmployeeDialog({
  employee,
  onSaved,
}: {
  employee: SafeEmployee;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(employee.name);
  const [email, setEmail] = useState(employee.email);
  const [employeeIdNumber, setEmployeeIdNumber] = useState(employee.employeeIdNumber);
  const [designation, setDesignation] = useState<Designation>(employee.designation);
  const [customDesignation, setCustomDesignation] = useState(
    employee.customDesignation ?? ""
  );
  const [accessOptions, setAccessOptions] = useState<AccessArea[]>(
    employee.accessOptions ?? []
  );
  const [password, setPassword] = useState("");
  const [disabled, setDisabled] = useState(employee.disabled ?? false);

  function reset() {
    setName(employee.name);
    setEmail(employee.email);
    setEmployeeIdNumber(employee.employeeIdNumber);
    setDesignation(employee.designation);
    setCustomDesignation(employee.customDesignation ?? "");
    setAccessOptions(employee.accessOptions ?? []);
    setPassword("");
    setDisabled(employee.disabled ?? false);
    setError(null);
  }

  function toggleAccess(area: AccessArea, granted: boolean) {
    setAccessOptions((prev) =>
      granted ? [...prev, area] : prev.filter((a) => a !== area)
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (designation === "other" && !customDesignation.trim()) {
      setError("Type the custom designation.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/api/admin/employees/${encodeURIComponent(employee.id)}`, {
        method: "PATCH",
        body: {
          name: name.trim(),
          email: email.trim(),
          employeeIdNumber: employeeIdNumber.trim(),
          designation,
          // Cleared rather than left stale when moving off "other" — a
          // leftover label would keep showing in the roster's designation
          // column, which reads from it whenever designation is "other".
          customDesignation: designation === "other" ? customDesignation.trim() : "",
          accessOptions,
          disabled,
          // Omitted entirely unless typed. Sending "" would be a request to
          // set an empty password, which the API would reject and the admin
          // would read as the whole edit failing.
          ...(password ? { password } : {}),
        },
      });
      toast.success(`${name.trim()} updated.`);
      setPassword("");
      setOpen(false);
      onSaved();
    } catch (err) {
      // The API names duplicate emails and short passwords; worth quoting.
      const message =
        err instanceof ApiError ? err.message : "Could not update this employee.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Discard edits on close so reopening shows the account as stored,
        // not a half-finished change the admin backed out of.
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Edit ${employee.name}`}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[#dde3ea] text-ink-soft transition-colors hover:border-primary hover:text-primary"
          >
            <Pencil className="size-3.5" />
          </button>
        }
      />
      <DialogContent className="max-h-[85vh] w-full max-w-md overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit employee</DialogTitle>
          <DialogDescription className="font-mono text-[11.5px] text-[#8a94a6]">
            {employee.employeeIdNumber}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-emp-name">Full Name</Label>
            <Input
              id="edit-emp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-emp-email">Email</Label>
            <Input
              id="edit-emp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-emp-password">New password</Label>
            <Input
              id="edit-emp-password"
              type="password"
              autoComplete="new-password"
              placeholder="Leave blank to keep current"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              aria-describedby="edit-password-hint"
            />
            <p id="edit-password-hint" className="text-[11.5px] text-ink-muted">
              Only fill this in to change it. At least 8 characters.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-emp-id">Employee ID</Label>
              <Input
                id="edit-emp-id"
                value={employeeIdNumber}
                onChange={(e) => setEmployeeIdNumber(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Designation</Label>
              <Select
                value={designation}
                onValueChange={(v) => setDesignation((v as Designation) ?? designation)}
              >
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
              <Label htmlFor="edit-custom-designation">Custom designation</Label>
              <Input
                id="edit-custom-designation"
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
              Products, stock, tasks and leave are always available to sub-admins.
              Grant any of these separately.
            </p>
            <div className="space-y-2.5 rounded-md border p-3">
              {ACCESS_OPTIONS.map((opt) => {
                // Granting Orders already opens invoices and challans, so
                // their toggles show as on and locked rather than sitting
                // off beside a page the account can open.
                const covered = impliedBy(accessOptions, opt.value);
                return (
                  <div key={opt.value} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium leading-none">{opt.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {covered ? "Included with Orders" : opt.hint}
                      </p>
                    </div>
                    <Switch
                      checked={accessOptions.includes(opt.value) || covered}
                      disabled={covered}
                      onCheckedChange={(checked) => toggleAccess(opt.value, checked)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium leading-none">Account disabled</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Blocks sign-in and revokes live sessions, keeping their tasks and
                reports intact.
              </p>
            </div>
            <Switch checked={disabled} onCheckedChange={setDisabled} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
