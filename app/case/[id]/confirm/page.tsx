"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BusyInline, BusyOverlay } from "@/components/busy-overlay";
import { CaseLoading, CaseMissing } from "@/components/case-loading";
import { StepNav } from "@/components/case-shell";
import { Stamp } from "@/components/stamp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCase } from "@/hooks/use-case";
import { useI18n } from "@/lib/i18n/context";
import { analyzeCase, patchCase } from "@/lib/client";
import type { CaseView, Fact, FactKey, FactStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ROUTE_KEYS_DARAZ: FactKey[] = [
  "item_ordered",
  "item_received",
  "prior_action",
  "rejection_reason",
  "chat_context",
  "delivery_date",
];
const ROUTE_KEYS_FB: FactKey[] = [
  "item_ordered",
  "item_received",
  "has_receipt",
  "chat_context",
  "delivery_date",
];

function displayValue(key: FactKey, value: string, opt: Record<string, string>): string {
  if (!value) return "";
  const map: Partial<Record<FactKey, Record<string, string>>> = {
    rejection_reason: {
      substitute_approved: opt.substitute_approved,
      item_as_described: opt.item_as_described,
      outside_window: opt.outside_window,
      other: opt.other,
      none: opt.none,
    },
    prior_action: {
      platform_return_rejected: opt.platform_return_rejected,
      platform_return_pending: opt.platform_return_pending,
      seller_contacted: opt.seller_contacted,
      none: opt.noneDone,
    },
    has_receipt: { yes: opt.yes, no: opt.no, unknown: opt.unknown },
    chat_context: {
      address_confirmation: opt.address_confirmation,
      substitution_approval: opt.substitution_approval,
      unclear: opt.unclear,
      none: opt.noChat,
    },
    delivery_estimate_in_order: { yes: opt.yes, no: opt.no, unknown: opt.unknown },
  };
  return map[key]?.[value] ?? value;
}

function FactRow({
  f,
  route,
  ask,
  why,
  labels,
  statusLabels,
  opt,
  onStatus,
  onValue,
  onPickAlt,
}: {
  f: Fact;
  route?: boolean;
  ask: string;
  why: string;
  labels: {
    route: string;
    missing: string;
    confirm: string;
    dispute: string;
    unreadable: string;
    conflictTitle: string;
    conflictBody: string;
    use: string;
    evidence: string;
  };
  statusLabels: Record<FactStatus, string>;
  opt: Record<string, string>;
  onStatus: (key: FactKey, status: FactStatus) => void;
  onValue: (key: FactKey, value: string) => void;
  onPickAlt: () => void;
}) {
  const [draft, setDraft] = useState(f.value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(f.value);
  }, [f.value, f.key]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function onChange(value: string) {
    setDraft(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onValue(f.key, value), 400);
  }

  const shown = displayValue(f.key, draft, opt);

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{ask}</p>
            {route && <Stamp tone="review">{labels.route}</Stamp>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{why}</p>
        </div>
        <Stamp
          tone={
            f.status === "confirmed"
              ? "ok"
              : f.status === "disputed"
                ? "risk"
                : f.status === "unreadable"
                  ? "warn"
                  : "muted"
          }
        >
          {statusLabels[f.status]}
        </Stamp>
      </div>

      <div className="mt-3">
        <Input
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (timer.current) clearTimeout(timer.current);
            if (draft !== f.value) onValue(f.key, draft);
          }}
          placeholder={labels.missing}
          className="font-medium"
        />
        {shown && shown !== draft && (
          <p className="mt-1 text-xs text-muted-foreground">{shown}</p>
        )}
      </div>

      {f.key === "delivery_date_alt" && draft && (
        <div className="mt-3 rounded-lg border border-dashed border-[color-mix(in_oklch,var(--warn)_40%,transparent)] bg-[color-mix(in_oklch,var(--warn)_8%,transparent)] p-3">
          <p className="text-sm font-medium">{labels.conflictTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{labels.conflictBody}</p>
          <Button size="sm" className="mt-2" onClick={onPickAlt}>
            {labels.use}: {draft}
          </Button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["confirmed", labels.confirm],
            ["disputed", labels.dispute],
            ["unreadable", labels.unreadable],
          ] as const
        ).map(([st, label]) => (
          <Button
            key={st}
            type="button"
            size="sm"
            variant={f.status === st ? "default" : "outline"}
            onClick={() => onStatus(f.key, st)}
          >
            {label}
          </Button>
        ))}
      </div>

      {f.evidenceIds.length > 0 && (
        <p className="mt-2 font-mono text-[0.65rem] text-muted-foreground">
          {labels.evidence}: {f.evidenceIds.join(", ")}
        </p>
      )}
    </li>
  );
}

export default function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const C = t.confirm;
  const router = useRouter();
  const { data, setData, loading, error } = useCase(id);
  const [busy, setBusy] = useState(false);
  const [agentStatus, setAgentStatus] = useState<Record<string, string>>({});

  const routeKeys = useMemo(() => {
    if (!data) return [];
    const base = data.channel === "facebook" ? ROUTE_KEYS_FB : ROUTE_KEYS_DARAZ;
    const keys = [...base];
    if (data.facts.some((f) => f.key === "delivery_date_alt")) {
      const i = keys.indexOf("delivery_date");
      keys.splice(i + 1, 0, "delivery_date_alt");
    }
    return keys;
  }, [data]);

  async function setStatus(key: FactKey, status: FactStatus) {
    const c = await patchCase(id, { facts: [{ key, status }] });
    setData(c);
  }

  async function setValue(key: FactKey, value: string) {
    const c = await patchCase(id, { facts: [{ key, value, status: "candidate" }] });
    setData(c);
  }

  async function pickAlt() {
    const c = await patchCase(id, {
      facts: [{ key: "delivery_date_alt", pick: true }],
    });
    setData(c);
  }

  async function run(view: CaseView) {
    if (!view.evidence.length) {
      toast.error(C.errNeedDocs);
      return;
    }
    setBusy(true);
    setAgentStatus({});
    try {
      const c = await analyzeCase(id, (ev) => {
        if ("agent" in ev && ev.agent) {
          setAgentStatus((s) => ({ ...s, [ev.agent]: ev.status }));
        }
      });
      setData(c);
      router.push(`/case/${id}/compare`);
    } catch {
      toast.error(t.common.error);
      setBusy(false);
    }
  }

  if (loading) return <CaseLoading />;
  if (error || !data) return <CaseMissing />;

  const otherFacts = data.facts.filter((f) => !routeKeys.includes(f.key));
  const factMap = Object.fromEntries(data.facts.map((f) => [f.key, f])) as Record<
    FactKey,
    Fact | undefined
  >;

  const rowLabels = {
    route: C.route,
    missing: C.missing,
    confirm: C.confirm,
    dispute: C.dispute,
    unreadable: C.unreadable,
    conflictTitle: C.conflictTitle,
    conflictBody: C.conflictBody,
    use: C.use,
    evidence: C.evidence,
  };

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl">{C.title}</h1>
      <p className="mt-2 text-muted-foreground">{C.lead}</p>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-primary">{C.route}</h2>
        <ul className="mt-3 space-y-3">
          {routeKeys.map((key) => {
            const f = factMap[key] ?? {
              key,
              value: "",
              status: "candidate" as const,
              evidenceIds: [],
              source: "user" as const,
            };
            return (
              <FactRow
                key={key}
                f={f}
                route
                ask={C.ask[key]}
                why={C.why[key]}
                labels={rowLabels}
                statusLabels={t.status}
                opt={C.opt}
                onStatus={(k, s) => void setStatus(k, s)}
                onValue={(k, v) => void setValue(k, v)}
                onPickAlt={() => void pickAlt()}
              />
            );
          })}
        </ul>
      </section>

      {otherFacts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-muted-foreground">{C.other}</h2>
          <ul className="mt-3 space-y-3">
            {otherFacts.map((f) => (
              <FactRow
                key={f.key}
                f={f}
                ask={C.ask[f.key]}
                why={C.why[f.key]}
                labels={rowLabels}
                statusLabels={t.status}
                opt={C.opt}
                onStatus={(k, s) => void setStatus(k, s)}
                onValue={(k, v) => void setValue(k, v)}
                onPickAlt={() => void pickAlt()}
              />
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button size="lg" className="h-11 px-5" disabled={busy} onClick={() => void run(data)}>
          {busy ? <BusyInline label={C.running} /> : C.run}
        </Button>
      </div>

      <StepNav
        caseId={id}
        back="documents"
        next={data.analysis ? "compare" : undefined}
        nextDisabled={!data.analysis}
      />

      <BusyOverlay open={busy} title={C.running} detail={C.runningD}>
        <p className="text-sm font-medium text-foreground">{t.agents.title}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {(["intake", "deadlines", "research", "review", "verify", "verify_p2"] as const).map((a) => (
            <li
              key={a}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                agentStatus[a] === "running" && "border-primary bg-primary/5",
                (agentStatus[a] === "done" || agentStatus[a] === "fallback") &&
                  "border-[color-mix(in_oklch,var(--ok)_40%,transparent)]"
              )}
            >
              <span className="font-medium">{t.memo.agent[a]}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {agentStatus[a]
                  ? t.agents[agentStatus[a] as keyof typeof t.agents] ?? agentStatus[a]
                  : t.agents.wait}
              </span>
            </li>
          ))}
        </ul>
      </BusyOverlay>
    </div>
  );
}
