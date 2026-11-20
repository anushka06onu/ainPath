"use client";

import { useEffect, useRef, useState } from "react";
import { Stamp } from "@/components/stamp";
import { useI18n } from "@/lib/i18n/context";
import type { Evidence } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EvidenceViewer({
  evidence,
  fileUrl,
  highlightPage,
}: {
  evidence: Evidence;
  fileUrl: string;
  highlightPage?: number;
}) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(highlightPage ?? 1);
  const [pageCount, setPageCount] = useState(evidence.pages.length || 1);
  const [err, setErr] = useState<string | null>(null);
  const isPdf = evidence.mime === "application/pdf" || /\.pdf$/i.test(evidence.filename);
  const isImg = evidence.mime.startsWith("image/");

  const avgConf =
    evidence.pages.length > 0
      ? evidence.pages.reduce((s, p) => s + p.confidence, 0) / evidence.pages.length
      : 1;

  useEffect(() => {
    if (!isPdf || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
        const doc = await pdfjs.getDocument(fileUrl).promise;
        if (cancelled) return;
        setPageCount(doc.numPages);
        const p = await doc.getPage(Math.min(page, doc.numPages));
        const viewport = p.getViewport({ scale: 1.15 });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await p.render({ canvasContext: ctx, viewport } as Parameters<typeof p.render>[0]).promise;
      } catch {
        if (!cancelled) setErr("pdf-load-failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl, isPdf, page]);

  const pageMeta = evidence.pages.find((p) => p.page === page);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stamp tone={avgConf < 0.75 ? "warn" : "ok"}>
          {evidence.extraction === "ocr"
            ? `OCR · ${Math.round(avgConf * 100)}%`
            : evidence.extraction === "text"
              ? "Born-digital · 99%"
              : evidence.extraction}
        </Stamp>
        {evidence.injectionFlag ? <Stamp tone="risk">{t.docs.inj}</Stamp> : null}
        {evidence.corrected ? <Stamp tone="ok">Human-corrected</Stamp> : null}
      </div>

      {isImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl} alt={evidence.filename} className="mt-3 max-h-[420px] w-full object-contain" />
      ) : isPdf ? (
        <div className="mt-3 overflow-auto">
          {err ? (
            <p className="text-sm text-muted-foreground">
              <a href={fileUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                Open PDF
              </a>
            </p>
          ) : (
            <canvas ref={canvasRef} className="mx-auto max-w-full" />
          )}
          {pageCount > 1 && (
            <div className="mt-2 flex items-center justify-center gap-2 text-sm">
              <button
                type="button"
                className="rounded border px-2 py-1 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ←
              </button>
              <span>
                {page} / {pageCount}
              </span>
              <button
                type="button"
                className="rounded border px-2 py-1 disabled:opacity-40"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                →
              </button>
            </div>
          )}
        </div>
      ) : (
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
          {pageMeta?.text?.slice(0, 2000) || "—"}
        </pre>
      )}

      {pageMeta && pageMeta.confidence < 0.75 && (
        <p
          className={cn(
            "mt-2 text-xs",
            pageMeta.confidence < 0.5 ? "text-[var(--risk)]" : "text-[var(--warn)]"
          )}
        >
          Low OCR confidence on page {page} ({Math.round(pageMeta.confidence * 100)}%) — correct the
          text below if needed.
        </p>
      )}
    </div>
  );
}
