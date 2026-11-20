"use client";

import { use, useState } from "react";
import Link from "next/link";
import { BusyInline, BusyOverlay } from "@/components/busy-overlay";
import { CaseLoading, CaseMissing } from "@/components/case-loading";
import { StepNav } from "@/components/case-shell";
import { Stamp } from "@/components/stamp";
import { Button } from "@/components/ui/button";
import { useCase } from "@/hooks/use-case";
import { useI18n } from "@/lib/i18n/context";
import { analyzeCase, swapChat } from "@/lib/client";
import { toast } from "sonner";

export default function ComparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, bi } = useI18n();
  const C = t.compare;
  const { data, setData, loading, error } = useCase(id);
  const [busy, setBusy] = useState<"swap" | "rerun" | null>(null);

  if (loading) return <CaseLoading />;
  if (error || !data) return <CaseMissing />;

  const analysis = data.analysis;
  const chat = data.facts.find((f) => f.key === "chat_context")?.value;
  const isAddr = chat === "address_confirmation";

  async function doSwap() {
    setBusy("swap");
    try {
      const next = isAddr ? "substitution" : "address";
      await swapChat(id, next);
      const c = await analyzeCase(id, () => {});
      setData(c);
      toast.success(C.swapped);
    } catch {
      toast.error(t.common.error);
    } finally {
      setBusy(null);
    }
  }

  async function rerun() {
    setBusy("rerun");
    try {
      const c = await analyzeCase(id, () => {});
      setData(c);
    } catch {
      toast.error(t.common.error);
    } finally {
      setBusy(null);
    }
  }

  if (!analysis) {
    return (
      <div>
        <h1 className="text-2xl sm:text-3xl">{C.title}</h1>
        <p className="mt-4 text-muted-foreground">{C.noAnalysis}</p>
        <div className="mt-6 flex gap-3">
          <Button render={<Link href={`/case/${id}/confirm`} />}>{C.goConfirm}</Button>
          <Button variant="outline" disabled={!!busy} onClick={() => void rerun()}>
            {busy === "rerun" ? <BusyInline label={t.common.reanalysing} /> : t.confirm.run}
          </Button>
        </div>
        <StepNav caseId={id} back="confirm" />
        <BusyOverlay open={busy === "rerun"} title={t.common.reanalysing} detail={t.confirm.runningD} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl">{C.title}</h1>
      <p className="mt-2 text-muted-foreground">{C.lead}</p>

      {/* Two-voice + spine */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:gap-8">
        {analysis.positions.map((p) => (
          <div key={p.side} className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <p className="text-sm font-medium tracking-wide text-primary">
              {p.side === "buyer" ? C.buyer : C.seller}
            </p>
            <p className="mt-3 font-serif text-xl leading-snug sm:text-2xl">{bi(p.claim)}</p>
            <div className="mt-6">
              <p className="text-xs text-muted-foreground">{C.support}</p>
              <ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-relaxed">
                {p.support.map((s, i) => (
                  <li key={i}>{bi(s)}</li>
                ))}
              </ul>
            </div>
            <div className="mt-5">
              <p className="text-xs text-muted-foreground">{C.missing}</p>
              <ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-relaxed text-muted-foreground">
                {p.missing.map((s, i) => (
                  <li key={i}>{bi(s)}</li>
                ))}
              </ul>
            </div>
            {p.authorityIds.length > 0 && (
              <p className="mt-5 font-mono text-xs text-primary">
                {C.authority}: {p.authorityIds.join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Chat swap */}
      <section className="mt-10 rounded-xl border border-border bg-paper/50 p-5">
        <h2 className="font-medium">{C.chatTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{C.swapLead}</p>
        <p className="mt-3 text-sm">
          {C.current}:{" "}
          <span className="font-medium">
            {isAddr ? C.swapA : chat === "substitution_approval" ? C.swapB : chat || "—"}
          </span>
        </p>
        <Button className="mt-4" variant="outline" disabled={!!busy} onClick={() => void doSwap()}>
          {busy === "swap" ? <BusyInline label={t.common.swapping} /> : C.swap}
        </Button>
      </section>

      {/* Findings preview */}
      <section className="mt-10">
        <h2 className="text-xl">{C.findings}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{C.findingsLead}</p>
        <ul className="mt-4 space-y-3">
          {analysis.findings.map((f) => (
            <li key={f.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{bi(f.title)}</p>
                <Stamp
                  tone={
                    f.status === "verified" ? "ok" : f.status === "review" ? "warn" : "review"
                  }
                >
                  {f.status === "verified"
                    ? t.memo.verified
                    : f.status === "review"
                      ? t.memo.review
                      : t.memo.unresolved}
                </Stamp>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{bi(f.risk)}</p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                p{f.anchor.page} · {f.authorityIds.join(", ")}
              </p>
            </li>
          ))}
        </ul>
        <Button render={<Link href={`/case/${id}/memo`} />} variant="link" className="mt-2 px-0">
          {C.openMemo}
        </Button>
      </section>

      <StepNav caseId={id} back="confirm" next="roadmap" />
      <BusyOverlay
        open={busy === "swap"}
        title={t.common.swapping}
        detail={t.common.swappingD}
      />
      <BusyOverlay
        open={busy === "rerun"}
        title={t.common.reanalysing}
        detail={t.confirm.runningD}
      />
    </div>
  );
}
