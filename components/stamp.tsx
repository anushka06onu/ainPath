import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "risk" | "review" | "muted";

const toneClass: Record<Tone, string> = {
  ok: "border-[color-mix(in_oklch,var(--ok)_55%,transparent)] text-[var(--ok)] bg-[color-mix(in_oklch,var(--ok)_10%,transparent)]",
  warn: "border-[color-mix(in_oklch,var(--warn)_55%,transparent)] text-[color-mix(in_oklch,var(--warn)_80%,var(--foreground))] bg-[color-mix(in_oklch,var(--warn)_12%,transparent)]",
  risk: "border-[color-mix(in_oklch,var(--risk)_55%,transparent)] text-[var(--risk)] bg-[color-mix(in_oklch,var(--risk)_10%,transparent)]",
  review:
    "border-[color-mix(in_oklch,var(--review)_45%,transparent)] text-[var(--review)] bg-[color-mix(in_oklch,var(--review)_10%,transparent)]",
  muted: "border-border text-muted-foreground bg-muted/40",
};

export function Stamp({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[0.65rem] font-medium tracking-wide uppercase",
        "rotate-[-1deg]",
        toneClass[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
