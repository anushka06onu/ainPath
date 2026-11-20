"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { CaseLoading, CaseMissing } from "@/components/case-loading";
import { StepNav } from "@/components/case-shell";
import { Stamp } from "@/components/stamp";
import { ReporterDetailsModal } from "@/components/reporter-details-modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useCase } from "@/hooks/use-case";
import { useI18n } from "@/lib/i18n/context";
import { deleteCase, exportUrl, patchCase } from "@/lib/client";
import type { ReporterDetails } from "@/lib/types";
import { toast } from "sonner";

export default function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, bi, lang } = useI18n();
  const E = t.export;
  const router = useRouter();
  const { data, setData, loading, error } = useCase(id);
  const [redact, setRedact] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reporterOpen, setReporterOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  if (loading) return <CaseLoading />;
  if (error || !data) return <CaseMissing />;

  async function toggleApprove(approved: boolean) {
    setBusy(true);
    try {
      const c = await patchCase(id, { approved });
      setData(c);
    } catch {
      toast.error(t.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function purge() {
    if (!confirm(E.delConfirm)) return;
    setBusy(true);
    try {
      await deleteCase(id);
      toast.success(E.deleted);
      router.push("/");
    } catch {
      toast.error(t.common.error);
      setBusy(false);
    }
  }

  async function generatePdf(details: ReporterDetails) {
    setPdfBusy(true);
    try {
      const c = await patchCase(id, { reporter: details });
      setData(c);
      const href = exportUrl(id, "report", "pdf", { lang, redact, download: true });
      const res = await fetch(href);
      if (!res.ok) throw new Error("pdf-failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ainpath-report-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setReporterOpen(false);
    } catch {
      toast.error(t.common.error);
    } finally {
      setPdfBusy(false);
    }
  }

  const approved = !!data.approvedAt;
  const hasAnalysis = !!data.analysis;

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl">{E.title}</h1>
      <p className="mt-2 text-muted-foreground">{E.lead}</p>

      {!hasAnalysis && (
        <p className="mt-6 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          {E.needAnalysis}
        </p>
      )}

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">{E.summary}</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t.story.channel}</dt>
            <dd className="font-medium capitalize">{data.channel}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t.roadmap.title}</dt>
            <dd className="font-medium">{data.roadmap ? bi(data.roadmap.headline) : "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">{t.steps.story}</dt>
            <dd className="mt-1 line-clamp-4 text-muted-foreground">{data.story || "—"}</dd>
          </div>
        </dl>
        <ul className="mt-4 space-y-1 text-sm">
          {data.facts
            .filter((f) => f.value)
            .map((f) => (
              <li key={f.key} className="flex flex-wrap justify-between gap-2 border-t border-border/60 py-2">
                <span className="text-muted-foreground">{t.confirm.ask[f.key]}</span>
                <span className="flex items-center gap-2 font-medium">
                  {f.value}
                  <Stamp
                    tone={
                      f.status === "confirmed"
                        ? "ok"
                        : f.status === "disputed"
                          ? "risk"
                          : "muted"
                    }
                  >
                    {t.status[f.status]}
                  </Stamp>
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-medium">{E.attachments}</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.evidence.map((ev) => (
            <li key={ev.id} className="flex justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <span>
                {ev.filename}{" "}
                <span className="text-muted-foreground">({t.docs.kinds[ev.kind]})</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">{ev.id}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 flex items-center gap-3">
        <Checkbox
          id="redact"
          checked={redact}
          onCheckedChange={(v) => setRedact(v === true)}
        />
        <Label htmlFor="redact" className="text-sm font-normal">
          {E.redact}
        </Label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!approved ? (
          <Button size="lg" className="h-11 px-5" disabled={busy || !hasAnalysis} onClick={() => void toggleApprove(true)}>
            {E.approve}
          </Button>
        ) : (
          <>
            <Stamp tone="ok">
              {E.approvedAt} {data.approvedAt?.slice(0, 10)}
            </Stamp>
            <Button variant="outline" disabled={busy} onClick={() => void toggleApprove(false)}>
              {E.unapprove}
            </Button>
          </>
        )}
      </div>

      <section className="mt-10">
        <h2 className="font-medium">{E.downloads}</h2>
        {!approved && <p className="mt-2 text-sm text-muted-foreground">{E.needApprove}</p>}

        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <p className="font-medium">{E.pdfReport}</p>
          <p className="mt-1 text-sm text-muted-foreground">{E.pdfReportD}</p>
          <div className="mt-4">
            <Button
              size="lg"
              className="h-11 px-5"
              disabled={!approved || pdfBusy}
              onClick={() => setReporterOpen(true)}
            >
              {E.pdfReport}
            </Button>
          </div>
        </div>

        <p className="mt-8 text-sm font-medium text-muted-foreground">{E.moreFormats}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {(
            [
              ["buyer", E.buyer, E.buyerD],
              ["index", E.index, E.indexD],
              ["memo", E.memoDl, E.memoD],
            ] as const
          ).map(([type, title, desc]) => (
            <div key={type} className="rounded-xl border border-border bg-card p-4">
              <p className="font-medium">{title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {approved ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={
                        <a
                          href={exportUrl(id, type, "html", { lang, redact })}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      {E.html}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      nativeButton={false}
                      render={
                        <a href={exportUrl(id, type, "md", { lang, redact, download: true })} />
                      }
                    >
                      {E.md}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" disabled>
                      {E.html}
                    </Button>
                    <Button size="sm" variant="ghost" disabled>
                      {E.md}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-xl border border-dashed border-[color-mix(in_oklch,var(--risk)_35%,transparent)] p-5">
        <h2 className="font-medium text-[var(--risk)]">{E.privacy}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{E.privacyBody}</p>
        <Button
          variant="destructive"
          className="mt-4"
          disabled={busy}
          onClick={() => void purge()}
        >
          {E.del}
        </Button>
      </section>

      <StepNav caseId={id} back="roadmap" />

      <ReporterDetailsModal
        open={reporterOpen}
        initial={data.reporter}
        busy={pdfBusy}
        onOpenChange={setReporterOpen}
        onSubmit={generatePdf}
      />
    </div>
  );
}
