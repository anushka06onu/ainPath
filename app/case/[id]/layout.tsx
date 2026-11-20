"use client";

import { use } from "react";
import { CaseShell } from "@/components/case-shell";

export default function CaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <CaseShell caseId={id}>{children}</CaseShell>;
}
