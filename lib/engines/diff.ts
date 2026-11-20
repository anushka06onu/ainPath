/**
 * Line-level evidence-sensitivity diff between two PipelineRun snapshots.
 */
import type { CaseRecord, Finding, PipelineRunSnapshot, RouteStep } from "../types";

export interface DiffResult {
  caseId: string;
  baseRunId: string;
  targetRunId: string;
  reusedStages: string[];
  recomputedStages: string[];
  routeChanges: {
    routeCode: string;
    field: string;
    before: string;
    after: string;
    changedLines: { type: "MODIFIED" | "ADDED" | "REMOVED"; before?: string; after?: string }[];
  }[];
  findingChanges: {
    findingCode: string;
    field: string;
    before: string;
    after: string;
  }[];
}

function stepKey(s: RouteStep) {
  return s.id;
}

export function diffRuns(
  c: CaseRecord,
  baseRunId: string,
  targetRunId: string
): DiffResult | null {
  const runs = c.runs ?? [];
  const base = runs.find((r) => r.id === baseRunId);
  const target = runs.find((r) => r.id === targetRunId);
  if (!base || !target) return null;

  const routeChanges: DiffResult["routeChanges"] = [];
  const baseSteps = new Map(base.roadmap.steps.map((s) => [stepKey(s), s]));
  const targetSteps = new Map(target.roadmap.steps.map((s) => [stepKey(s), s]));

  for (const [id, after] of targetSteps) {
    const before = baseSteps.get(id);
    if (!before) {
      routeChanges.push({
        routeCode: id,
        field: "step",
        before: "",
        after: after.title.en,
        changedLines: [{ type: "ADDED", after: after.detail.en }],
      });
      continue;
    }
    if (before.label !== after.label || before.detail.en !== after.detail.en) {
      routeChanges.push({
        routeCode: id,
        field: "eligibility_status",
        before: before.label,
        after: after.label,
        changedLines: [
          {
            type: "MODIFIED",
            before: before.detail.en,
            after: after.detail.en,
          },
        ],
      });
    }
  }
  for (const [id, before] of baseSteps) {
    if (!targetSteps.has(id)) {
      routeChanges.push({
        routeCode: id,
        field: "step",
        before: before.title.en,
        after: "",
        changedLines: [{ type: "REMOVED", before: before.detail.en }],
      });
    }
  }

  const findingChanges: DiffResult["findingChanges"] = [];
  const baseF = new Map(base.findings.map((f) => [f.id, f]));
  for (const after of target.findings) {
    const before = baseF.get(after.id);
    if (!before) continue;
    if (before.status !== after.status) {
      findingChanges.push({
        findingCode: after.id,
        field: "verification_status",
        before: before.status,
        after: after.status,
      });
    }
  }

  return {
    caseId: c.id,
    baseRunId,
    targetRunId,
    reusedStages: target.reusedStages,
    recomputedStages: target.recomputedStages,
    routeChanges,
    findingChanges,
  };
}

export function latestPair(c: CaseRecord): { base?: PipelineRunSnapshot; target?: PipelineRunSnapshot } {
  const runs = c.runs ?? [];
  if (runs.length < 1) return {};
  const target = runs[runs.length - 1];
  const base = target.parentRunId ? runs.find((r) => r.id === target.parentRunId) : runs[runs.length - 2];
  return { base, target };
}

/** Silence unused Finding import if tree-shaken. */
export type _Finding = Finding;
