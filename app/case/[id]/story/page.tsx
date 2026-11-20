"use client";

import { use, useState } from "react";
import { CaseLoading, CaseMissing } from "@/components/case-loading";
import { StepNav } from "@/components/case-shell";
import { Stamp } from "@/components/stamp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCase } from "@/hooks/use-case";
import { useI18n } from "@/lib/i18n/context";
import { patchCase, runIntake } from "@/lib/client";
import type { Channel, FactKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CHANNELS: Channel[] = ["daraz", "facebook", "other"];

export default function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, fmt } = useI18n();
  const S = t.story;
  const { data, setData, loading, error } = useCase(id);
  const [story, setStory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <CaseLoading />;
  if (error || !data) return <CaseMissing />;

  const text = story ?? data.story;
  const channelLabel = (c: Channel) =>
    c === "daraz" ? S.daraz : c === "facebook" ? S.facebook : S.other;

  async function saveChannel(channel: Channel) {
    const c = await patchCase(id, { channel });
    setData(c);
  }

  async function extract() {
    setBusy(true);
    try {
      await patchCase(id, { story: text });
      const c = await runIntake(id);
      setData(c);
      setStory(null);
      toast.success(S.saved);
    } catch {
      toast.error(t.common.error);
    } finally {
      setBusy(false);
    }
  }

  const factAsk = t.confirm.ask as Record<FactKey, string>;

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl">{S.title}</h1>
      <p className="mt-2 text-muted-foreground">{S.lead}</p>

      <fieldset className="mt-8">
        <legend className="text-sm font-medium">{S.channel}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => void saveChannel(c)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm transition-colors",
                data.channel === c
                  ? "border-primary bg-primary/5 font-medium"
                  : "border-border bg-card hover:border-foreground/20"
              )}
            >
              {channelLabel(c)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-8 space-y-2">
        <Label htmlFor="story">{S.title}</Label>
        <Textarea
          id="story"
          value={text}
          onChange={(e) => setStory(e.target.value)}
          placeholder={S.placeholder}
          className="min-h-40 text-base"
          maxLength={4000}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{fmt(S.chars, { n: text.length })}</span>
          <span>{data.llm.enabled ? S.llmOn : S.llmOff}</span>
        </div>
      </div>

      <div className="mt-4">
        <Button disabled={busy || !text.trim()} onClick={() => void extract()}>
          {busy ? S.reading : S.extract}
        </Button>
      </div>

      {data.facts.some((f) => f.value) && (
        <section className="mt-10">
          <h2 className="text-lg font-medium">{S.draft}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{S.draftLead}</p>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {data.facts
              .filter((f) => f.value)
              .map((f) => (
                <li key={f.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{factAsk[f.key]}</p>
                    <p className="mt-0.5 font-medium">{f.value}</p>
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
                    {t.status[f.status]}
                  </Stamp>
                </li>
              ))}
          </ul>
        </section>
      )}

      <StepNav caseId={id} next="documents" />
    </div>
  );
}
