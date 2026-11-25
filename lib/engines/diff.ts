/**
 * Line-level evidence-sensitivity diff between two PipelineRun snapshots.
 */
import type { CaseRecord, Lang, PipelineRunSnapshot, RouteStep } from "../types";

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
  targetRunId: string,
  lang: Lang = c.lang,
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
        after: after.title[lang],
        changedLines: [{ type: "ADDED", after: after.detail[lang] }],
      });
      continue;
    }
    if (before.label !== after.label || before.kind !== after.kind ||
      before.title[lang] !== after.title[lang] || before.detail[lang] !== after.detail[lang]) {
      routeChanges.push({
        routeCode: id,
        field: "eligibility_status",
        before: before.label,
        after: after.label,
        changedLines: [
          {
            type: "MODIFIED",
            before: before.detail[lang],
            after: after.detail[lang],
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
        before: before.title[lang],
        after: "",
        changedLines: [{ type: "REMOVED", before: before.detail[lang] }],
      });
    }
  }

  const findingChanges: DiffResult["findingChanges"] = [];
  const baseF = new Map(base.findings.map((f) => [f.id, f]));
  const targetF = new Map(target.findings.map((f) => [f.id, f]));
  for (const id of new Set([...baseF.keys(), ...targetF.keys()])) {
    const before = baseF.get(id);
    const after = targetF.get(id);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const line = (f: typeof before) => f ? f.title[lang] + " · " + f.statusReason[lang] : "";
    findingChanges.push({
      findingCode: id,
      field: !before || !after ? "finding" : "verification",
      before: line(before),
      after: line(after),
    });
  }
  const priorClocks = new Map(base.roadmap.clocks?.map((clock) => [clock.clockId, clock]));
  for (const after of target.roadmap.clocks ?? []) {
    const before = priorClocks.get(after.clockId);
    priorClocks.delete(after.clockId);
    if (before && before.status === after.status && before.dueDate === after.dueDate &&
      before.refusalReason?.[lang] === after.refusalReason?.[lang]) continue;
    const describe = (clock: typeof before) => clock ? clock.name[lang] + " · " +
      (clock.dueDate ?? clock.refusalReason?.[lang] ?? clock.note[lang]) : "";
    routeChanges.push({
      routeCode: after.clockId, field: "deadline", before: describe(before), after: describe(after),
      changedLines: [{ type: before ? "MODIFIED" : "ADDED", before: describe(before), after: describe(after) }],
    });
  }
  for (const before of priorClocks.values()) {
    const line = before.name[lang] + " · " + (before.dueDate ?? before.note[lang]);
    routeChanges.push({
      routeCode: before.clockId, field: "deadline", before: line, after: "",
      changedLines: [{ type: "REMOVED", before: line }],
    });
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
