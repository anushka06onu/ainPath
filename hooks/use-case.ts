"use client";

import { useCallback, useEffect, useState } from "react";
import type { CaseView } from "@/lib/types";
import { getCase } from "@/lib/client";

export function useCase(id: string) {
  const [data, setData] = useState<CaseView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await getCase(id);
      setData(c);
      return c;
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, setData, error, loading, refresh };
}
