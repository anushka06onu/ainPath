"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BusySpinner } from "@/components/busy-overlay";

export function CaseLoading() {
  const { t } = useI18n();
  return (
    <div className="space-y-6" aria-busy="true" aria-label={t.common.loadingCase}>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <BusySpinner />
        <div>
          <p className="text-sm font-medium text-foreground">{t.common.loadingCase}</p>
          <p className="text-xs text-muted-foreground">{t.common.loadingCaseD}</p>
        </div>
      </div>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="mt-2 h-40 w-full" />
    </div>
  );
}

export function CaseMissing() {
  const { t } = useI18n();
  return (
    <div className="py-16 text-center">
      <p className="text-muted-foreground">{t.common.notFound}</p>
      <Button nativeButton={false} render={<Link href="/demo" />} className="mt-6">
        {t.common.startOver}
      </Button>
    </div>
  );
}
