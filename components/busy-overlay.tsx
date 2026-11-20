"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function BusySpinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("size-5 shrink-0 animate-spin text-primary", className)}
      aria-hidden
    />
  );
}

/** Full-screen block while a long action runs (PDF, analysis, case create). */
export function BusyOverlay({
  open,
  title,
  detail,
  children,
}: {
  open: boolean;
  title: string;
  detail?: string;
  children?: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/75 p-6 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="ainpath-busy-title"
      aria-describedby={detail ? "ainpath-busy-detail" : undefined}
    >
      <div
        className={cn(
          "w-full rounded-2xl border border-border bg-card px-6 py-7 text-center shadow-lg",
          children ? "max-w-md" : "max-w-sm"
        )}
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
          <BusySpinner className="size-6" />
        </div>
        <p id="ainpath-busy-title" className="mt-4 font-serif text-lg text-foreground">
          {title}
        </p>
        {detail ? (
          <p
            id="ainpath-busy-detail"
            className="mt-2 text-sm leading-relaxed text-muted-foreground"
          >
            {detail}
          </p>
        ) : null}
        {children ? <div className="mt-5 text-left">{children}</div> : null}
        <div className="mx-auto mt-5 flex justify-center gap-1.5" aria-hidden>
          <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}

/** Inline row for buttons / panels. */
export function BusyInline({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-live="polite">
      <BusySpinner className="size-4" />
      <span>{label}</span>
    </span>
  );
}
