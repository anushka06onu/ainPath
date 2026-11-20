"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CaseLoading, CaseMissing } from "@/components/case-loading";
import { StepNav } from "@/components/case-shell";
import { Stamp } from "@/components/stamp";
import { DeadlineClockGrid } from "@/components/roadmap/deadline-clock-grid";
import { UncertaintyBanner } from "@/components/common/uncertainty-banner";
import { DiffHighlighter } from "@/components/roadmap/diff-highlighter";
import { Button } from "@/components/ui/button";
import { useCase } from "@/hooks/use-case";
import { useI18n } from "@/lib/i18n/context";
import { analyzeCase, getCaseDiff, swapChat } from "@/lib/client";
import type { RouteStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";

function labelTone(label: RouteStep["label"]) {
  if (label === "source_confirmed") return "ok" as const;
  if (label === "depends_on_disputed") return "warn" as const;
  return "review" as const;
}

export default function RoadmapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, bi } = useI18n();
  const R = t.roadmap;
  const { data, setData, loading, error } = useCase(id);
  const [busy, setBusy] = useState(false);
  const [pulseIds, setPulseIds] = useState<Set<string>>(new Set());
  const [diff, setDiff] = useState<{
    reusedStages: string[];
    recomputedStages: string[];
    routeChanges: { changedLines: { type: string; before?: string; after?: string }[] }[];
  } | null>(null);
  const prevSteps = useRef<RouteStep[]>([]);

  useEffect(() => {
    if (!data?.roadmap) return;
    const prev = prevSteps.current;
    const next = data.roadmap.steps;
    if (prev.length) {
      const changed = new Set(
        next
          .filter((s) => {
            const p = prev.find((x) => x.id === s.id);
            return !p || JSON.stringify(p) !== JSON.stringify(s);
          })
          .map((s) => s.id)
      );
      // also new/removed
      for (const s of next) if (!prev.some((p) => p.id === s.id)) changed.add(s.id);
      setPulseIds(changed);
      const tmr = setTimeout(() => setPulseIds(new Set()), 1800);
      prevSteps.current = next;
      return () => clearTimeout(tmr);
    }
    prevSteps.current = next;
  }, [data?.roadmap]);

  if (loading) return <CaseLoading />;
  if (error || !data) return <CaseMissing />;

  const rm = data.roadmap;
  const chat = data.facts.find((f) => f.key === "chat_context")?.value;

  async function doSwap() {
    setBusy(true);
    try {
      const next = chat === "address_confirmation" ? "substitution" : "address";
      await swapChat(id, next);
      const c = await analyzeCase(id, () => {});
      setData(c);
      try {
        const d = await getCaseDiff(id, c.analysis?.baseRunId, c.analysis?.runId);
        setDiff(d as typeof diff);
      } catch {
        setDiff(null);
      }
      toast.success(t.compare.swapped);
    } catch {
      toast.error(t.common.error);
    } finally {
      setBusy(false);
    }
  }

  if (!data.analysis) {
    return (
      <div>
        <h1 className="text-2xl sm:text-3xl">{R.title}</h1>
        <p className="mt-4 text-muted-foreground">{R.needAnalysis}</p>
        <Button render={<Link href={`/case/${id}/confirm`} />} className="mt-6">
          {t.confirm.run}
        </Button>
        <StepNav caseId={id} back="compare" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl">{R.title}</h1>
      <p className="mt-2 text-muted-foreground">{R.lead}</p>
      <p className="mt-4 font-serif text-xl text-foreground">{bi(rm.headline)}</p>

      <DeadlineClockGrid clocks={rm.clocks ?? []} />

      {(rm.clocks ?? []).some((c) => c.status === "REFUSED_UNCONFIRMED_TRIGGER") ? (
        <UncertaintyBanner kind="conflicting_dates" className="mt-4" />
      ) : null}
      {data.channel === "facebook" &&
      data.facts.find((f) => f.key === "has_receipt")?.value !== "yes" ? (
        <UncertaintyBanner kind="missing_proof" className="mt-4" />
      ) : null}
      {data.channel === "other" ? <UncertaintyBanner kind="out_of_scope" className="mt-4" /> : null}

      {diff ? (
        <DiffHighlighter
          reusedStages={diff.reusedStages}
          recomputedStages={diff.recomputedStages}
          changes={diff.routeChanges.flatMap((r) => r.changedLines)}
        />
      ) : data.analysis?.baseRunId && data.analysis?.runId ? (
        <div className="mt-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-sm">
          <p className="font-medium">{R.diffBanner}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {R.diffRuns
              .replace("{base}", data.analysis.baseRunId)
              .replace("{target}", data.analysis.runId)}
          </p>
        </div>
      ) : null}

      {/* What-if chat */}
      <div className="mt-6 rounded-xl border border-dashed border-border bg-paper/40 p-4">
        <p className="text-sm font-medium">{R.whatIf}</p>
        <p className="mt-1 text-xs text-muted-foreground">{R.whatIfLead}</p>
        <p className="mt-2 text-sm">
          {t.compare.current}:{" "}
          <span className="font-medium">
            {chat === "address_confirmation"
              ? t.compare.swapA
              : chat === "substitution_approval"
                ? t.compare.swapB
                : chat || "—"}
          </span>
        </p>
        <Button size="sm" variant="outline" className="mt-3" disabled={busy} onClick={() => void doSwap()}>
          {t.compare.swap}
        </Button>
      </div>

      {/* Metro line — dedicated rail column so nodes never overlap cards */}
      <ol className="relative mt-10">
        {rm.steps.map((step, i) => {
          const pulsing = pulseIds.has(step.id);
          const last = i === rm.steps.length - 1;
          return (
            <motion.li
              key={step.id}
              layout
              animate={pulsing ? { scale: [1, 1.015, 1] } : { scale: 1 }}
              transition={{ duration: 0.55 }}
              className={cn("grid grid-cols-[1.25rem_1fr] gap-x-4", !last && "pb-8")}
            >
              <div className="relative flex justify-center" aria-hidden>
                {!last && (
                  <span className="absolute top-4 bottom-[-2rem] w-0.5 metro-line" />
                )}
                <span
                  className={cn(
                    "relative z-10 mt-2 size-3.5 shrink-0 rounded-full border-2 bg-background",
                    step.label === "source_confirmed"
                      ? "border-[var(--ok)]"
                      : step.label === "depends_on_disputed"
                        ? "border-[var(--warn)]"
                        : "border-[var(--review)]"
                  )}
                />
              </div>

              <div
                className={cn(
                  "min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5",
                  pulsing && "ring-2 ring-primary/30"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{R.kind[step.kind]}</p>
                    <h3 className="mt-0.5 font-serif text-lg leading-snug">{bi(step.title)}</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Stamp tone={labelTone(step.label)}>{R.stepLabel[step.label]}</Stamp>
                    {pulsing && <Stamp tone="ok">{R.changed}</Stamp>}
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{bi(step.detail)}</p>

                {step.where && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground">{R.where}</p>
                    {step.where.url ? (
                      <a
                        href={step.where.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        {bi(step.where.label)}
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      <p className="text-sm">{bi(step.where.label)}</p>
                    )}
                  </div>
                )}

                {step.attach.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground">{R.attach}</p>
                    <ul className="mt-1 list-disc pl-4 text-sm">
                      {step.attach.map((a, j) => (
                        <li key={j}>{bi(a)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {step.caveat && (
                  <p className="mt-3 rounded-md bg-[color-mix(in_oklch,var(--warn)_10%,transparent)] px-3 py-2 text-xs text-foreground/80">
                    <span className="font-medium">{R.caveat}: </span>
                    {bi(step.caveat)}
                  </p>
                )}

                {step.authorityIds.length > 0 && (
                  <p className="mt-2 font-mono text-[0.65rem] text-muted-foreground">
                    {R.sources}: {step.authorityIds.join(", ")}
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>

      <div className="mt-8">
        <Button render={<Link href={`/case/${id}/export`} />} size="lg" className="h-11 px-5">
          {R.toExport}
        </Button>
      </div>

      <StepNav caseId={id} back="compare" next="export" nextLabel={R.toExport} />
    </div>
  );
}
