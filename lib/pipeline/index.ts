import { randomUUID } from "node:crypto";
import type { CaseRecord, AgentRun, Finding, PipelineRunSnapshot } from "../types";
import { llmInfo, modelFingerprint, sha } from "../llm";
import { runIntake } from "./intake";
import { runResearch, runReview, runVerify, termsHash } from "./findings";
import { runVerifyPass2 } from "./pass2";
import { buildPositions, buildRoadmap } from "../rules";
import { todayIso } from "../engines/deadline";
import { AUTHORITIES } from "../../corpus/authorities";

export type Emit = (e: { agent: AgentRun["agent"]; status: "running" | "done" | "fallback" | "error"; run?: AgentRun; detail?: string }) => void;

const hash = (data: unknown) => sha(JSON.stringify(data));
const corpusHash = hash(AUTHORITIES);
const termsAgents = ["research", "review", "verify"] as const;

export async function runPipeline(c: CaseRecord, emit: Emit): Promise<CaseRecord> {
  const now = new Date();
  const parentRunId = c.activeRunId;
  const runs: AgentRun[] = [];
  const reusedStages: string[] = [];
  const recomputedStages: string[] = [];
  const cache = c.pipelineCache ??= {};
  const model = modelFingerprint(c);
  const canReuseFallback = !llmInfo(c).enabled;

  function start(agent: AgentRun["agent"]) {
    emit({ agent, status: "running" });
  }
  function complete(run: AgentRun, inputHash: string, reused = false) {
    const trace: AgentRun = {
      ...run,
      inputHash,
      ...(reused ? { ms: 0, at: now.toISOString(), note: [run.note, "reused"].filter(Boolean).join(" · ") } : {}),
    };
    runs.push(trace);
    (reused ? reusedStages : recomputedStages).push(trace.agent);
    emit({ agent: trace.agent, status: trace.status === "fallback" ? "fallback" : "done", run: trace });
  }

  start("intake");
  const before = c.facts;
  const intake = await runIntake(c);
  c.facts = intake.facts;
  const factsHash = hash(c.facts);
  if (hash(before) !== factsHash) c.approvedAt = undefined;
  complete(intake.run, intake.run.inputHash, intake.reused);

  start("deadlines");
  const timingFacts = c.facts.filter((f) => ["delivery_date", "delivery_date_alt"].includes(f.key))
    .map(({ key, value, status }) => ({ key, value, status }));
  const deadlineHash = hash(["deadlines-v2", c.channel, c.paymentChannel, todayIso(now), timingFacts, corpusHash]);
  const roadmapHash = hash(["roadmap-v2", deadlineHash, c.facts.map(({ key, status, value }) => [key, status, value])]);
  const oldRoadmap = cache.roadmap;
  const reuseDeadlines = oldRoadmap?.deadlineHash === deadlineHash;
  const reuseRoadmap = oldRoadmap?.hash === roadmapHash;
  const started = Date.now();
  const roadmap = reuseRoadmap ? oldRoadmap.value : buildRoadmap(c, now, reuseDeadlines ? oldRoadmap.value.clocks : undefined);
  cache.roadmap = { hash: roadmapHash, deadlineHash, value: roadmap };
  complete({
    agent: "deadlines", status: "done", model: "deadline-engine", inputHash: deadlineHash,
    ms: Date.now() - started, at: now.toISOString(),
  }, deadlineHash, reuseDeadlines);

  const termsKey = hash(["terms-v2", termsHash(c), corpusHash, model]);
  let termFindings: Finding[];
  if (cache.terms?.hash === termsKey) {
    for (const run of cache.terms.runs) {
      start(run.agent);
      complete(run, run.inputHash, true);
    }
    termFindings = cache.terms.findings;
  } else {
    start(termsAgents[0]);
    const research = await runResearch(c);
    complete(research.run, termsKey);

    start(termsAgents[1]);
    const review = await runReview(research.candidates, c);
    complete(review.run, hash([termsKey, research.candidates]));

    start(termsAgents[2]);
    const verified = runVerify(review.findings, c);
    complete(verified.run, hash([termsKey, review.findings]));
    termFindings = verified.findings;
    const termRuns = [research.run, review.run, verified.run].map((run) =>
      runs.find((trace) => trace.agent === run.agent) ?? run);
    if (canReuseFallback || termRuns.every((run) => run.status === "done")) {
      cache.terms = { hash: termsKey, findings: termFindings, runs: termRuns };
    }
  }

  const verifyFacts = c.facts.filter((f) =>
    (f.key === "delivery_estimate_in_order" && termFindings.some((x) => x.riskCategory === "DELIVERY_UNCLEAR")) ||
    (f.key === "chat_context" && termFindings.some((x) => x.riskCategory === "SUBSTITUTION_DISPUTE")));
  const pass2Key = hash(["verify-v2", corpusHash, model, termFindings, verifyFacts]);
  start("verify_p2");
  const cachedPass2 = cache.pass2?.hash === pass2Key ? cache.pass2 : undefined;
  const p2 = cachedPass2 ?? await runVerifyPass2(termFindings, c);
  complete(p2.run, pass2Key, !!cachedPass2);
  if (!cachedPass2 && (canReuseFallback || p2.run.status === "done")) {
    cache.pass2 = { hash: pass2Key, findings: p2.findings, run: p2.run };
  }

  const id = "run_" + randomUUID();
  const evidenceHash = hash(c.evidence.map(({ id, kind, sha256, pages }) => [id, kind, sha256, pages]));
  const snapshot: PipelineRunSnapshot = {
    id,
    parentRunId,
    status: "completed",
    inputManifestHash: hash([intake.run.inputHash, factsHash, evidenceHash, roadmapHash, pass2Key]),
    stageHashes: { ...Object.fromEntries(runs.map((r) => [r.agent, r.inputHash])), routes: roadmapHash },
    reusedStages: [...reusedStages, ...(reuseRoadmap ? ["routes"] : [])],
    recomputedStages: [...recomputedStages, ...(reuseRoadmap ? [] : ["routes"])],
    roadmap,
    findings: p2.findings,
    createdAt: now.toISOString(),
    latencyMs: Date.now() - now.getTime(),
  };
  if (c.analysis && hash(c.analysis.findings) !== hash(p2.findings)) c.approvedAt = undefined;
  c.runs = [...(c.runs ?? []).slice(-9), snapshot];
  c.activeRunId = id;
  c.analysis = {
    findings: p2.findings,
    positions: buildPositions(c),
    counterpoints: p2.findings.map((f) => ({ findingId: f.id, text: f.counterpoint })),
    runs,
    evidenceHash,
    factsHash,
    runId: id,
    baseRunId: parentRunId,
    createdAt: now.toISOString(),
  };
  return c;
}
