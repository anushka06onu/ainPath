"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const STEPS = ["story", "documents", "confirm", "compare", "roadmap", "export"] as const;

export function CaseShell({
  caseId,
  children,
}: {
  caseId: string;
  children: React.ReactNode;
}) {
  const { t, lang, setLang, fmt } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const segment = pathname.split("/").pop() || "story";
  const stepIndex = Math.max(
    0,
    STEPS.findIndex((s) => s === segment || (segment === "memo" && s === "compare"))
  );
  const stepNum = segment === "memo" ? 4 : stepIndex + 1;
  const total = STEPS.length;

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3.5 px-5 py-4 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <BrandMark size="sm" className="!text-foreground" />
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setLang(lang === "bn" ? "en" : "bn")}
              >
                {lang === "bn" ? "EN" : "বাং"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t.nav.theme}
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                <Sun className="size-3.5 dark:hidden" />
                <Moon className="hidden size-3.5 dark:block" />
              </Button>
              <Button type="button" variant="ghost" size="xs" onClick={() => router.push("/")}>
                {t.common.save}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{fmt(t.steps.stepOf, { n: stepNum, total })}</span>
            <span className="truncate font-mono text-[0.65rem] opacity-70">
              {t.steps.cases} {caseId.slice(0, 8)}
            </span>
          </div>
          <Progress value={(stepNum / total) * 100} className="h-1.5" />

          <nav
            className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto pb-0.5"
            aria-label="Case steps"
          >
            {STEPS.map((s, i) => {
              const active = segment === s || (segment === "memo" && s === "compare");
              return (
                <Link
                  key={s}
                  href={`/case/${caseId}/${s}`}
                  className={cn(
                    "shrink-0 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                    active
                      ? "bg-primary/12 font-medium text-primary"
                      : i < stepIndex
                        ? "text-foreground/75 hover:bg-muted"
                        : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {t.steps[s]}
                </Link>
              );
            })}
            <Link
              href={`/case/${caseId}/memo`}
              className={cn(
                "shrink-0 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                segment === "memo"
                  ? "bg-primary/12 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {t.steps.memo}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8 sm:py-12">{children}</main>

      <p className="border-t border-border/60 px-5 py-4 text-center text-xs text-muted-foreground sm:px-8">
        {t.nav.footerCase}
      </p>
    </div>
  );
}

export function StepNav({
  caseId,
  back,
  next,
  nextLabel,
  nextDisabled,
  onNext,
}: {
  caseId: string;
  back?: string;
  next?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  onNext?: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="mt-10 flex items-center justify-between gap-3 border-t border-border/70 pt-6">
      {back ? (
        <Button variant="ghost" render={<Link href={`/case/${caseId}/${back}`} />}>
          {t.steps.back}
        </Button>
      ) : (
        <span />
      )}
      {next || onNext ? (
        <Button
          disabled={nextDisabled}
          onClick={async () => {
            if (onNext) await onNext();
            if (next) router.push(`/case/${caseId}/${next}`);
          }}
        >
          {nextLabel ?? t.steps.next}
        </Button>
      ) : null}
    </div>
  );
}
