"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function CaseLoading() {
  const { t } = useI18n();
  return (
    <div className="space-y-4" aria-busy="true" aria-label={t.common.loading}>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="mt-6 h-40 w-full" />
    </div>
  );
}

export function CaseMissing() {
  const { t } = useI18n();
  return (
    <div className="py-16 text-center">
      <p className="text-muted-foreground">{t.common.notFound}</p>
      <Button render={<Link href="/demo" />} className="mt-6">
        {t.common.startOver}
      </Button>
    </div>
  );
}
