"use client";

import { use, useState } from "react";
import Link from "next/link";
import { CaseLoading, CaseMissing } from "@/components/case-loading";
import { StepNav } from "@/components/case-shell";
import { Stamp } from "@/components/stamp";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useCase } from "@/hooks/use-case";
import { useI18n } from "@/lib/i18n/context";
import { fileUrl } from "@/lib/client";
import { AuthorityStrengthBadge } from "@/components/common/authority-strength-badge";
import { UncertaintyBanner } from "@/components/common/uncertainty-banner";
import type { Authority, Finding } from "@/lib/types";

export default function MemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, bi, fmt, lang } = useI18n();
  const M = t.memo;
  const { data, loading, error } = useCase(id);
  const [openAuth, setOpenAuth] = useState<Authority | null>(null);
  const [openFinding, setOpenFinding] = useState<Finding | null>(null);

  if (loading) return <CaseLoading />;
  if (error || !data) return <CaseMissing />;

  const analysis = data.analysis;
  if (!analysis) {
    return (
      <div>
        <h1 className="text-2xl sm:text-3xl">{M.title}</h1>
        <p className="mt-4 text-muted-foreground">{t.compare.noAnalysis}</p>
        <Button render={<Link href={`/case/${id}/confirm`} />} className="mt-6">
          {t.confirm.run}
        </Button>
        <StepNav caseId={id} back="compare" />
      </div>
    );
  }

  const authById = Object.fromEntries(data.authorities.map((a) => [a.id, a]));
  const weak = analysis.findings.filter(
    (f) =>
      f.status === "review" ||
      f.pass2Verdict === "FLAG_MISGROUNDED" ||
      f.pass2Verdict === "FLAG_HIERARCHY"
  );

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl">{M.title}</h1>
      <p className="mt-2 text-muted-foreground">{M.lead}</p>

      <section className="mt-8 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">{M.matter}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{M.matterBody}</p>
      </section>

      {weak.length > 0 ? <UncertaintyBanner kind="weak_support" className="mt-6" /> : null}

      <ul className="mt-8 space-y-5">
        {analysis.findings.map((f) => (
          <li key={f.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-serif text-xl">{bi(f.title)}</h2>
              <div className="flex flex-wrap gap-1.5">
                {(f.authorityStrength ||
                  (f.authorityIds[0] && authById[f.authorityIds[0]]?.strength)) && (
                  <AuthorityStrengthBadge
                    strength={
                      f.authorityStrength ??
                      authById[f.authorityIds[0]]!.strength
                    }
                    lang={lang}
                  />
                )}
                <Stamp
                  tone={f.status === "verified" ? "ok" : f.status === "review" ? "warn" : "review"}
                >
                  {f.status === "verified"
                    ? M.verified
                    : f.status === "review"
                      ? M.review
                      : M.unresolved}
                </Stamp>
                {f.pass2Verdict && f.pass2Verdict !== "SKIPPED" ? (
                  <Stamp tone={f.pass2Verdict === "PASS" ? "ok" : "warn"}>Pass2: {f.pass2Verdict}</Stamp>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-sm">{bi(f.risk)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{bi(f.statusReason)}</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">{M.clause}</p>
                <p className="mt-1 rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed">
                  “{f.anchor.quote}”
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fmt(M.page, { n: f.anchor.page })} · {f.anchor.evidenceId}
                </p>
                <a
                  href={fileUrl(id, f.anchor.evidenceId)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-primary hover:underline"
                >
                  {M.open}
                </a>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{M.authority}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {f.authorityIds.map((aid) => {
                    const a = authById[aid];
                    return (
                      <button
                        key={aid}
                        type="button"
                        onClick={() => a && setOpenAuth(a)}
                        className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1 font-mono text-xs text-primary hover:bg-primary/10"
                      >
                        [{aid}]
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed">
                  {f.authorityQuote}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">{M.counter}</p>
              <p className="mt-1 text-sm">{bi(f.counterpoint)}</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">{M.assumptions}</p>
                <p className="mt-1 text-sm text-muted-foreground">{bi(f.assumptions)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{M.next}</p>
                <p className="mt-1 text-sm text-muted-foreground">{bi(f.nextCheck)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {f.origin === "both"
                ? M.corroborated
                : f.origin === "rules"
                  ? M.byRules
                  : M.byModel}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="mt-2"
              onClick={() => setOpenFinding(f)}
            >
              {M.open}
            </Button>
          </li>
        ))}
      </ul>

      {/* Agent runs */}
      <section className="mt-10">
        <h2 className="text-lg font-medium">{M.runs}</h2>
        <ol className="mt-4 space-y-3">
          {analysis.runs.map((r) => (
            <li key={r.agent} className="flex gap-3 border-l-2 border-primary/30 pl-3">
              <div>
                <p className="font-medium">{M.agent[r.agent]}</p>
                <p className="text-xs text-muted-foreground">{M.agentDesc[r.agent]}</p>
                <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
                  {r.status === "fallback" ? M.fallback : r.model} · {r.ms}ms
                  {r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Source register */}
      <section className="mt-10">
        <h2 className="text-lg font-medium">{M.source}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{M.notVerifiedNote}</p>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {data.authorities.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <button
                type="button"
                className="text-left"
                onClick={() => setOpenAuth(a)}
              >
                <span className="font-mono text-xs text-primary">{a.id}</span>
                <span className="ml-2 text-sm">{bi(a.title)}</span>
              </button>
              <Stamp tone={a.textKind === "verbatim" ? "ok" : "warn"}>
                {a.textKind === "verbatim" ? M.officialText : M.paraphrase}
              </Stamp>
            </li>
          ))}
        </ul>
      </section>

      <Sheet open={!!openAuth} onOpenChange={(o) => !o && setOpenAuth(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {openAuth && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono text-base">{openAuth.id}</SheetTitle>
                <SheetDescription>{bi(openAuth.title)}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 px-1 text-sm">
                <p>
                  <span className="text-muted-foreground">{openAuth.section}</span>
                </p>
                <p className="rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {openAuth.passage}
                </p>
                <p className="text-xs text-muted-foreground">
                  {M.checked}: {openAuth.dateChecked} · {openAuth.version}
                </p>
                <Stamp tone={openAuth.textKind === "verbatim" ? "ok" : "warn"}>
                  {openAuth.textKind === "verbatim" ? M.officialText : M.paraphrase}
                </Stamp>
                <a
                  href={openAuth.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-primary hover:underline"
                >
                  {openAuth.url}
                </a>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!openFinding} onOpenChange={(o) => !o && setOpenFinding(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {openFinding && (
            <>
              <SheetHeader>
                <SheetTitle>{bi(openFinding.title)}</SheetTitle>
                <SheetDescription>{bi(openFinding.statusReason)}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 px-1 text-sm">
                <p className="font-mono text-xs">“{openFinding.anchor.quote}”</p>
                <p className="text-muted-foreground">{bi(openFinding.counterpoint)}</p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <StepNav caseId={id} back="roadmap" next="export" />
    </div>
  );
}
