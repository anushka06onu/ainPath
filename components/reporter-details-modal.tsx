"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BusyInline } from "@/components/busy-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/context";
import type { ReporterDetails } from "@/lib/types";

export function ReporterDetailsModal({
  open,
  initial,
  busy,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  initial?: ReporterDetails | null;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (details: ReporterDetails) => Promise<void> | void;
}) {
  const { t } = useI18n();
  const E = t.export;
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(initial?.fullName ?? "");
    setMobile(initial?.mobile ?? "");
    setEmail(initial?.email ?? "");
    setAddress(initial?.address ?? "");
    setOrderRef(initial?.orderRef ?? "");
    setError(false);
  }, [open, initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = fullName.trim();
    const phone = mobile.trim();
    if (!name || !phone) {
      setError(true);
      return;
    }
    setError(false);
    await onSubmit({
      fullName: name,
      mobile: phone,
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
      ...(orderRef.trim() ? { orderRef: orderRef.trim() } : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{E.reporterTitle}</DialogTitle>
          <DialogDescription>{E.reporterLead}</DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void submit(e)} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="reporter-name">{E.reporterName}</Label>
            <Input
              id="reporter-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
              disabled={busy}
              className="h-10"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reporter-mobile">{E.reporterMobile}</Label>
            <Input
              id="reporter-mobile"
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              autoComplete="tel"
              required
              disabled={busy}
              className="h-10"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reporter-email">{E.reporterEmail}</Label>
            <Input
              id="reporter-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={busy}
              className="h-10"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reporter-address">{E.reporterAddress}</Label>
            <Input
              id="reporter-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              disabled={busy}
              className="h-10"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reporter-order">{E.reporterOrder}</Label>
            <Input
              id="reporter-order"
              value={orderRef}
              onChange={(e) => setOrderRef(e.target.value)}
              disabled={busy}
              className="h-10"
            />
          </div>

          {error && <p className="text-sm text-[var(--risk)]">{E.reporterNeed}</p>}

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              {t.common.close}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <BusyInline label={E.reporterGenerating} /> : E.reporterContinue}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
