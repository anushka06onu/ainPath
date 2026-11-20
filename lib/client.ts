import type {
  CaseView,
  Channel,
  EvidenceKind,
  FactKey,
  FactStatus,
  Lang,
  PaymentChannel,
  ProcessingMode,
} from "./types";

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || `http-${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return data as T;
}

export async function createCase(body: {
  lang?: Lang;
  channel?: Channel;
  paymentChannel?: PaymentChannel;
  processingMode?: ProcessingMode;
  retentionDays?: 1 | 7 | 30;
  story?: string;
  fixture?: "daraz" | "facebook";
  variant?: "address" | "substitution";
}): Promise<CaseView> {
  return parse(
    await fetch("/api/cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export async function getCase(id: string): Promise<CaseView> {
  return parse(await fetch(`/api/cases/${id}`));
}

export async function recordConsent(
  id: string,
  body: {
    processingMode: ProcessingMode;
    retentionDays: 1 | 7 | 30;
    sensitiveDataAck: boolean;
    withdraw?: boolean;
  }
): Promise<CaseView> {
  return parse(
    await fetch(`/api/cases/${id}/consent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export async function getCaseDiff(
  id: string,
  baseRunId?: string,
  targetRunId?: string
): Promise<{
  reusedStages: string[];
  recomputedStages: string[];
  routeChanges: unknown[];
  findingChanges: unknown[];
}> {
  const q = new URLSearchParams();
  if (baseRunId) q.set("base_run_id", baseRunId);
  if (targetRunId) q.set("target_run_id", targetRunId);
  return parse(await fetch(`/api/cases/${id}/diff?${q}`));
}

export async function patchCase(
  id: string,
  body: {
    story?: string;
    channel?: Channel;
    lang?: Lang;
    facts?: { key: FactKey; value?: string; status?: FactStatus; pick?: boolean }[];
    approved?: boolean;
  }
): Promise<CaseView> {
  return parse(
    await fetch(`/api/cases/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export async function deleteCase(id: string): Promise<void> {
  await parse(await fetch(`/api/cases/${id}`, { method: "DELETE" }));
}

export async function runIntake(id: string): Promise<CaseView> {
  return parse(await fetch(`/api/cases/${id}/intake`, { method: "POST" }));
}

export async function uploadDocuments(
  id: string,
  files: FileList | File[],
  kind?: EvidenceKind
): Promise<CaseView> {
  const fd = new FormData();
  for (const f of Array.from(files)) fd.append("file", f);
  if (kind) fd.append("kind", kind);
  const data = await parse<{ case: CaseView }>(
    await fetch(`/api/cases/${id}/documents`, { method: "POST", body: fd })
  );
  return data.case;
}

export async function patchDocument(
  id: string,
  body:
    | { evidenceId: string; kind: EvidenceKind }
    | { evidenceId: string; page: number; text: string }
): Promise<CaseView> {
  return parse(
    await fetch(`/api/cases/${id}/documents`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export async function deleteDocument(id: string, evidenceId: string): Promise<CaseView> {
  return parse(
    await fetch(`/api/cases/${id}/documents?evidenceId=${encodeURIComponent(evidenceId)}`, {
      method: "DELETE",
    })
  );
}

export type AnalyzeEvent =
  | { agent: string; status: string; run?: { model?: string; note?: string; ms?: number }; done?: false }
  | { done: true; case: CaseView }
  | { done: true; error: string };

export async function analyzeCase(
  id: string,
  onEvent: (e: AnalyzeEvent) => void
): Promise<CaseView> {
  const res = await fetch(`/api/cases/${id}/analyze`, { method: "POST" });
  if (!res.ok || !res.body) throw new Error("analyze-failed");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let final: CaseView | null = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const ev = JSON.parse(line) as AnalyzeEvent;
      onEvent(ev);
      if ("done" in ev && ev.done && "case" in ev) final = ev.case;
      if ("done" in ev && ev.done && "error" in ev) throw new Error(ev.error);
    }
  }
  if (buf.trim()) {
    const ev = JSON.parse(buf) as AnalyzeEvent;
    onEvent(ev);
    if ("done" in ev && ev.done && "case" in ev) final = ev.case;
    if ("done" in ev && ev.done && "error" in ev) throw new Error(ev.error);
  }
  if (!final) throw new Error("analyze-incomplete");
  return final;
}

export async function swapChat(
  id: string,
  variant: "address" | "substitution"
): Promise<CaseView> {
  return parse(
    await fetch(`/api/cases/${id}/swap-chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variant }),
    })
  );
}

export function exportUrl(
  id: string,
  type: "memo" | "buyer" | "index" | "report",
  format: "html" | "md" | "pdf",
  opts?: { lang?: Lang; redact?: boolean; download?: boolean }
) {
  const q = new URLSearchParams({ type, format });
  if (opts?.lang) q.set("lang", opts.lang);
  if (opts?.redact === false) q.set("redact", "0");
  if (opts?.download === false) q.set("download", "0");
  else if (opts?.download || format === "pdf") q.set("download", "1");
  return `/api/cases/${id}/export?${q}`;
}

export function fileUrl(id: string, evId: string) {
  return `/api/cases/${id}/files/${evId}`;
}
