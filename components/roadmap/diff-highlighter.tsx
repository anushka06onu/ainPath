"use client";

import { useI18n } from "@/lib/i18n/context";

export function DiffHighlighter({
  reusedStages,
  recomputedStages,
  changes,
}: {
  reusedStages: string[];
  recomputedStages: string[];
  changes: { before?: string; after?: string; type: string }[];
}) {
  const { t } = useI18n();
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm">
      <p className="font-medium">{t.roadmap.diffBanner}</p>
      <div className="flex flex-wrap gap-2 text-xs">
        {reusedStages.map((s) => (
          <span key={s} className="rounded-md border border-border bg-background px-2 py-1">
            ✓ {s}
          </span>
        ))}
        {recomputedStages.map((s) => (
          <span key={s} className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1">
            ↻ {s}
          </span>
        ))}
      </div>
      <ul className="space-y-2">
        {changes.map((c, i) => (
          <li key={i} className="text-xs">
            {c.before ? (
              <p className="border-l-4 border-rose-500 bg-rose-50 px-2 py-1 line-through dark:bg-rose-950/30">
                {c.before}
              </p>
            ) : null}
            {c.after ? (
              <p className="border-l-4 border-emerald-600 bg-emerald-50 px-2 py-1 dark:bg-emerald-950/30">
                {c.after}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
