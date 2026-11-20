"use client";

import { useState } from "react";
import { BusyInline, BusyOverlay } from "@/components/busy-overlay";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n/context";
import { deleteCase, recordConsent } from "@/lib/client";
import type { CaseView } from "@/lib/types";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function PrivacyDrawer({
  data,
  onUpdate,
}: {
  data: CaseView;
  onUpdate: (c: CaseView) => void;
}) {
  const { t } = useI18n();
  const C = t.consent;
  const router = useRouter();
  const [busy, setBusy] = useState<"withdraw" | "delete" | null>(null);

  async function withdraw() {
    setBusy("withdraw");
    try {
      const c = await recordConsent(data.id, {
        processingMode: data.processingMode,
        retentionDays: (data.consent?.retentionDays as 1 | 7 | 30) || 7,
        sensitiveDataAck: true,
        withdraw: true,
      });
      onUpdate(c);
      toast.success(C.withdraw);
    } catch {
      toast.error(t.common.error);
    } finally {
      setBusy(null);
    }
  }

  async function purge() {
    const typed = window.prompt(`Type DELETE to confirm`);
    if (typed !== "DELETE") return;
    setBusy("delete");
    try {
      await deleteCase(data.id);
      router.push("/");
    } catch {
      toast.error(t.common.error);
      setBusy(null);
    }
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ainpath-${data.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Sheet>
      <SheetTrigger className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs hover:bg-muted">
        {C.privacy}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{C.privacy}</SheetTitle>
          <SheetDescription>{C.lead}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">Mode:</span>{" "}
            {data.processingMode}
            {data.consent?.cloudRegion ? ` · ${data.consent.cloudRegion}` : ""}
          </p>
          <p>
            <span className="text-muted-foreground">{C.remaining}:</span>{" "}
            {data.retentionExpiresAt?.slice(0, 16) ?? "—"}
          </p>
          <div className="flex flex-col gap-2 pt-4">
            <Button variant="outline" disabled={!!busy} onClick={downloadJson}>
              {C.exportJson}
            </Button>
            <Button
              variant="outline"
              disabled={!!busy || !data.consent}
              onClick={() => void withdraw()}
            >
              {busy === "withdraw" ? <BusyInline label={C.withdrawing} /> : C.withdraw}
            </Button>
            <Button variant="destructive" disabled={!!busy} onClick={() => void purge()}>
              {busy === "delete" ? <BusyInline label={C.deleting} /> : C.delete}
            </Button>
          </div>
        </div>
      </SheetContent>
      <BusyOverlay open={busy === "delete"} title={C.deleting} />
      <BusyOverlay open={busy === "withdraw"} title={C.withdrawing} />
    </Sheet>
  );
}
