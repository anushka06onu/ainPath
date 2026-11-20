"use client";

import { useState } from "react";
import { BusyInline } from "@/components/busy-overlay";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import type { ProcessingMode } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PrivacyConsentModal({
  open,
  onAccept,
}: {
  open: boolean;
  onAccept: (opts: {
    processingMode: ProcessingMode;
    retentionDays: 1 | 7 | 30;
    sensitiveDataAck: boolean;
  }) => Promise<void> | void;
}) {
  const { t } = useI18n();
  const C = t.consent;
  const [mode, setMode] = useState<ProcessingMode>("LOCAL_OFFLINE");
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [purposes, setPurposes] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const ready = purposes && sensitive;

  async function accept(forceLocal?: boolean) {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await onAccept({
        processingMode: forceLocal ? "LOCAL_OFFLINE" : mode,
        retentionDays: days,
        sensitiveDataAck: true,
      });
    } catch {
      // Parent shows toast; keep modal open
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal
        aria-labelledby="consent-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-lg"
        style={{ backgroundColor: "var(--background)" }}
      >
        <h2 id="consent-title" className="font-serif text-2xl">
          {C.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{C.lead}</p>

        <fieldset className="mt-6 space-y-2">
          <legend className="text-sm font-medium">{C.local}</legend>
          {(
            [
              ["LOCAL_OFFLINE", C.local],
              ["CLOUD_REGIONAL", C.cloud],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                "w-full rounded-xl border px-4 py-3 text-left text-sm",
                mode === id ? "border-primary bg-primary/8" : "border-border"
              )}
            >
              {label}
            </button>
          ))}
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">{C.retention}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                [1, C.days1],
                [7, C.days7],
                [30, C.days30],
              ] as const
            ).map(([d, label]) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  days === d ? "border-primary bg-primary/8" : "border-border"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-5 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4"
            checked={purposes}
            onChange={(e) => setPurposes(e.target.checked)}
          />
          <span>{C.purposes}</span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4"
            checked={sensitive}
            onChange={(e) => setSensitive(e.target.checked)}
          />
          <span>{C.sensitive}</span>
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            size="lg"
            className="h-11"
            disabled={busy || !ready}
            aria-disabled={busy || !ready}
            onClick={() => void accept()}
          >
            {busy ? <BusyInline label={C.accepting} /> : C.accept}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11"
            disabled={busy || !ready}
            aria-disabled={busy || !ready}
            onClick={() => void accept(true)}
          >
            {busy ? <BusyInline label={C.accepting} /> : C.localOnly}
          </Button>
        </div>
        {!ready ? (
          <p className="mt-3 text-xs text-muted-foreground">{C.tickBoth}</p>
        ) : null}
      </div>
    </div>
  );
}
