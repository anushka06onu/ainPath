import type { Analysis, CaseRecord, AgentRun, PipelineRunSnapshot } from "../types";
import { sha } from "../llm";
import { runIntake } from "./intake";
import { runResearch, runReview, runVerify, termsHash } from "./findings";
import { runVerifyPass2 } from "./pass2";
import { buildPositions, buildRoadmap } from "../rules";
import crypto from "node:crypto";

const runId = () => "run_" + crypto.randomBytes(4).toString("hex");

export type Emit = (e: { agent: AgentRun["agent"]; status: "running" | "done" | "fallback" | "error"; run?: AgentRun; detail?: string }) => void;

const factsHash = (c: CaseRecord) => sha(c.facts.map((f) => `${f.key}=${f.value}:${f.status}`).join("|")).slice(0, 12);
const evidenceHash = (c: CaseRecord) => sha(c.evidence.map((e) => e.sha256 + e.pages.map((p) => p.text).join("")).join("|")).slice(0, 12);

/**
 * Intake → Research → Review → Verify P1 → Verify P2.
 * Terms-stable research/review/verify_p1 may be cached; pass2 + positions always refresh with facts.
 */
export async function runPipeline(c: CaseRecord, emit: Emit): Promise<CaseRecord> {
  const runs: AgentRun[] = [];
  const parentRunId = c.activeRunId;
  const reusedStages: string[] = [];
  const recomputedStages: string[] = [];

  emit({ agent: "intake", status: "running" });
  const intake = await runIntake(c);
  c.facts = intake.facts;
  runs.push(intake.run);
  recomputedStages.push("intake");
  emit({ agent: "intake", status: intake.run.status === "fallback" ? "fallback" : "done", run: intake.run });

  emit({ agent: "deadlines", status: "running" });
  const dlRun: AgentRun = {
    agent: "deadlines",
    status: "done",
    model: "deadline-engine",
    inputHash: factsHash(c),
    ms: 0,
    note: "deterministic dual clocks",
    at: new Date().toISOString(),
  };
  runs.push(dlRun);
  recomputedStages.push("deadlines");
  emit({ agent: "deadlines", status: "done", run: dlRun });

  const th = termsHash(c);
  const prev = c.analysis;
  const cached = !!prev && prev.runs.some((r) => r.agent === "research" && r.inputHash === th) && prev.findings.length > 0;

  let findings = prev?.findings ?? [];
  let counterpoints = prev?.counterpoints ?? [];

  if (cached) {
    for (const agent of ["research", "review", "verify"] as const) {
      const r: AgentRun = { agent, status: "done", model: "cache", inputHash: th, ms: 0, note: "terms unchanged — reused", at: new Date().toISOString() };
      runs.push(r);
      reusedStages.push(agent);
      emit({ agent, status: "running" });
      emit({ agent, status: "done", run: r });
    }
  } else {
    emit({ agent: "research", status: "running" });
    const research = await runResearch(c);
    runs.push(research.run);
    recomputedStages.push("research");
    emit({ agent: "research", status: research.run.status === "fallback" ? "fallback" : "done", run: research.run, detail: research.retrieved.join(",") });

    emit({ agent: "review", status: "running" });
    const review = await runReview(research.candidates, c);
    runs.push(review.run);
    recomputedStages.push("review");
    emit({ agent: "review", status: review.run.status === "fallback" ? "fallback" : "done", run: review.run });

    emit({ agent: "verify", status: "running" });
    const verify = runVerify(review.findings, c);
    runs.push(verify.run);
    findings = verify.findings;
    recomputedStages.push("verify");
    emit({ agent: "verify", status: "done", run: verify.run });
  }

  emit({ agent: "verify_p2", status: "running" });
  const p2 = await runVerifyPass2(findings, c);
  runs.push(p2.run);
  findings = p2.findings;
  counterpoints = findings.map((f) => ({ findingId: f.id, text: f.counterpoint }));
  recomputedStages.push("verify_p2");
  emit({ agent: "verify_p2", status: p2.run.status === "fallback" ? "fallback" : "done", run: p2.run });

  const thisRunId = runId();
  const roadmap = buildRoadmap(c);
  const snapshot: PipelineRunSnapshot = {
    id: thisRunId,
    parentRunId,
    status: "completed",
    inputManifestHash: sha(th + factsHash(c) + evidenceHash(c)).slice(0, 16),
    stageHashes: Object.fromEntries(runs.map((r) => [r.agent, r.inputHash])),
    reusedStages,
    recomputedStages,
    roadmap,
    findings,
    createdAt: new Date().toISOString(),
    latencyMs: runs.reduce((s, r) => s + r.ms, 0),
  };
  c.runs = [...(c.runs ?? []).slice(-9), snapshot];
  c.activeRunId = thisRunId;

  const analysis: Analysis = {
    findings,
    positions: buildPositions(c),
    counterpoints,
    runs,
    evidenceHash: evidenceHash(c),
    factsHash: factsHash(c),
    runId: thisRunId,
    baseRunId: parentRunId,
    createdAt: new Date().toISOString(),
  };
  c.analysis = analysis;
  return c;
}
