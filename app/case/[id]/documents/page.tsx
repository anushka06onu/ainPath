"use client";

import { use, useRef, useState } from "react";
import { BusyInline, BusyOverlay } from "@/components/busy-overlay";
import { CaseLoading, CaseMissing } from "@/components/case-loading";
import { StepNav } from "@/components/case-shell";
import { PrivacyConsentModal } from "@/components/privacy-consent-modal";
import { Stamp } from "@/components/stamp";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCase } from "@/hooks/use-case";
import { useI18n } from "@/lib/i18n/context";
import { EvidenceViewer } from "@/components/evidence/evidence-viewer";
import { UncertaintyBanner } from "@/components/common/uncertainty-banner";
import { deleteDocument, fileUrl, patchDocument, recordConsent, uploadDocuments } from "@/lib/client";
import { compressUploadList } from "@/lib/image-compress";
import type { Evidence, EvidenceKind, ProcessingMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FileUp, Trash2 } from "lucide-react";

const KINDS: EvidenceKind[] = [
  "terms",
  "order",
  "chat",
  "receipt",
  "rejection",
  "delivery",
  "other",
];

export default function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, fmt } = useI18n();
  const D = t.docs;
  const { data, setData, loading, error } = useCase(id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; page: number; text: string } | null>(null);
  const [drag, setDrag] = useState(false);

  if (loading) return <CaseLoading />;
  if (error || !data) return <CaseMissing />;

  const needsConsent = !data.consent || !!data.consent.withdrawnAt;

  async function onConsent(opts: {
    processingMode: ProcessingMode;
    retentionDays: 1 | 7 | 30;
    sensitiveDataAck: boolean;
  }) {
    const c = await recordConsent(id, opts);
    setData(c);
  }

  async function onFiles(files: FileList | File[] | null) {
    if (!files || !files.length) return;
    if (needsConsent) {
      toast.error(t.consent.title);
      return;
    }
    setBusy(true);
    try {
      const compressed = await compressUploadList(files);
      const c = await uploadDocuments(id, compressed);
      setData(c);
      toast.success(t.story.saved);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("unsupported")) toast.error(D.errType);
      else if (msg.includes("too-large")) toast.error(D.errBig);
      else if (msg.includes("too-many")) toast.error(D.errMany);
      else toast.error(D.errGeneric);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function changeKind(evId: string, kind: EvidenceKind) {
    const c = await patchDocument(id, { evidenceId: evId, kind });
    setData(c);
  }

  async function saveEdit() {
    if (!editing) return;
    const c = await patchDocument(id, {
      evidenceId: editing.id,
      page: editing.page,
      text: editing.text,
    });
    setData(c);
    setEditing(null);
    toast.success(t.common.save);
  }

  async function remove(evId: string) {
    const c = await deleteDocument(id, evId);
    setData(c);
  }

  const hasTerms = data.evidence.some((e) => e.kind === "terms");

  return (
    <div>
      <PrivacyConsentModal open={needsConsent} onAccept={onConsent} />
      <h1 className="text-2xl sm:text-3xl">{D.title}</h1>
      <p className="mt-2 text-muted-foreground">{D.lead}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {fmt(D.limits, {
          files: data.limits.maxFiles,
          mb: data.limits.maxMb,
          pages: data.limits.maxPages,
        })}
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-12 text-center transition-colors",
          drag ? "border-primary bg-primary/5" : "border-border bg-card/50"
        )}
      >
        <FileUp className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{D.drop}</p>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <BusyInline label={D.uploading} /> : D.choose}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md"
          onChange={(e) => void onFiles(e.target.files)}
        />
      </div>

      {!hasTerms && data.evidence.length > 0 && (
        <p className="mt-4 text-sm text-[var(--warn)]">{D.needTerms}</p>
      )}

      {data.evidence.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{D.none}</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {data.evidence.map((ev) => (
            <EvidenceCard
              key={ev.id}
              ev={ev}
              caseId={id}
              editing={editing}
              setEditing={setEditing}
              onKind={(k) => void changeKind(ev.id, k)}
              onRemove={() => void remove(ev.id)}
              onSaveEdit={() => void saveEdit()}
              onCancelEdit={() => setEditing(null)}
              kinds={KINDS}
              labels={D.kinds}
              copy={D}
            />
          ))}
        </ul>
      )}

      <StepNav caseId={id} back="story" next="confirm" />
      <BusyOverlay open={busy} title={D.uploading} detail={D.uploadingD} />
    </div>
  );
}

function EvidenceCard({
  ev,
  caseId,
  editing,
  setEditing,
  onKind,
  onRemove,
  onSaveEdit,
  onCancelEdit,
  kinds,
  labels,
  copy,
}: {
  ev: Evidence;
  caseId: string;
  editing: { id: string; page: number; text: string } | null;
  setEditing: (v: { id: string; page: number; text: string } | null) => void;
  onKind: (k: EvidenceKind) => void;
  onRemove: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  kinds: EvidenceKind[];
  labels: Record<EvidenceKind, string>;
  copy: {
    page: string;
    confidence: string;
    low: string;
    edit: string;
    saveEdit: string;
    cancel: string;
    remove: string;
    inj: string;
    view: string;
    corrected: string;
    textExt: string;
    ocr: string;
    pagesN: string;
    hash: string;
  };
}) {
  const { fmt } = useI18n();
  const avg =
    ev.pages.length > 0
      ? ev.pages.reduce((s, p) => s + p.confidence, 0) / ev.pages.length
      : 0;

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{ev.filename}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {fmt(copy.pagesN, { n: ev.pages.length })} · {(ev.bytes / 1024).toFixed(0)} KB ·{" "}
            {ev.extraction === "ocr" ? copy.ocr : copy.textExt}
            {ev.corrected ? ` · ${copy.corrected}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-8 w-40 rounded-lg border border-input bg-transparent px-2 text-sm"
            value={ev.kind}
            onChange={(e) => onKind(e.target.value as EvidenceKind)}
            aria-label={labels[ev.kind]}
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {labels[k]}
              </option>
            ))}
          </select>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label={copy.remove}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {ev.injectionFlag && (
        <div className="mt-3">
          <UncertaintyBanner kind="ocr_injection" />
          <p className="mt-2 text-xs text-[var(--risk)]">{copy.inj}</p>
        </div>
      )}

      <div className="mt-3">
        <EvidenceViewer evidence={ev} fileUrl={fileUrl(caseId, ev.id)} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">{copy.confidence}</span>
        <Stamp tone={avg < 0.7 ? "warn" : "ok"}>{Math.round(avg * 100)}%</Stamp>
        <a
          href={fileUrl(caseId, ev.id)}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-primary hover:underline"
        >
          {copy.view}
        </a>
      </div>
      {avg < 0.7 && <p className="mt-2 text-xs text-[var(--warn)]">{copy.low}</p>}

      <div className="mt-4 space-y-3">
        {ev.pages.map((p) => {
          const isEdit = editing?.id === ev.id && editing.page === p.page;
          return (
            <div key={p.page} className="rounded-lg border border-border/70 bg-background/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-mono text-xs text-muted-foreground">
                  {fmt(copy.page, { n: p.page })}
                </p>
                {!isEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setEditing({ id: ev.id, page: p.page, text: p.text })}
                  >
                    {copy.edit}
                  </Button>
                )}
              </div>
              {isEdit ? (
                <div className="space-y-2">
                  <Textarea
                    value={editing.text}
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    className="min-h-28 font-mono text-xs"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={onSaveEdit}>
                      {copy.saveEdit}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                      {copy.cancel}
                    </Button>
                  </div>
                </div>
              ) : (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs text-foreground/85">
                  {p.text || "—"}
                </pre>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 truncate font-mono text-[0.65rem] text-muted-foreground">
        {copy.hash}: {ev.sha256.slice(0, 16)}…
      </p>
    </li>
  );
}
