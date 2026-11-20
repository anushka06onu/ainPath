"use client";

import { Stamp } from "@/components/stamp";
import { useI18n } from "@/lib/i18n/context";
import type { DeadlineClock } from "@/lib/types";
import { cn } from "@/lib/utils";

function tone(status: DeadlineClock["status"]) {
  if (status === "ACTIVE") return "ok" as const;
  if (status === "EXPIRING_SOON") return "warn" as const;
  if (status === "EXPIRED") return "risk" as const;
  if (status === "REFUSED_UNCONFIRMED_TRIGGER") return "warn" as const;
  return "review" as const;
}

export function DeadlineClockGrid({ clocks }: { clocks: DeadlineClock[] }) {
  const { bi, t } = useI18n();
  const R = t.roadmap;
  const visible = clocks.filter((c) => c.status !== "NOT_APPLICABLE" || c.clockId === "CRPA_S61_90D");

  return (
    <div className="mt-6 space-y-3">
      <p className="text-sm font-medium">{R.clocksTitle}</p>
      <p className="text-xs text-muted-foreground">{R.clocksLead}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((c) => (
          <div
            key={c.clockId}
            className={cn(
              "rounded-xl border border-border bg-card p-4",
              c.status === "REFUSED_UNCONFIRMED_TRIGGER" &&
                "border-[color-mix(in_oklch,var(--warn)_40%,var(--border))] bg-[color-mix(in_oklch,var(--warn)_8%,transparent)]"
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[0.65rem] text-muted-foreground">{c.clockId}</p>
                <h3 className="mt-0.5 font-serif text-base">{bi(c.name)}</h3>
              </div>
              <Stamp tone={tone(c.status)}>{R.clockStatus[c.status]}</Stamp>
            </div>
            {c.dueDate && c.status !== "REFUSED_UNCONFIRMED_TRIGGER" ? (
              <p className="mt-2 text-sm font-medium tabular-nums">{c.dueDate}</p>
            ) : null}
            <p className="mt-2 text-sm text-muted-foreground">{bi(c.refusalReason ?? c.note)}</p>
            {c.triggerDate ? (
              <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
                trigger: {c.triggerDate}
                {c.authorityId ? ` · ${c.authorityId}` : ""}
              </p>
            ) : (
              <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">{c.authorityId}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
