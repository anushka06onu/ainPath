/**
 * Scored route/deadline eval against labeled stubs in eval/cases.json.
 * Targets: >=20/24 first-route when expectRoute is set; deadline state checks.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildRoadmap } from "@/lib/rules";
import type { CaseRecord, Fact, PaymentChannel } from "@/lib/types";

type Stub = {
  id: string;
  channel: "daraz" | "facebook" | "other";
  variant: "address" | "substitution";
  expectRoute?: string;
  expectDeadline?: "computed" | "conflict" | "needs_trigger" | "not_applicable";
  expectStepKind?: string;
};

const stubs = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "eval", "cases.json"), "utf8")
) as Stub[];

function fact(key: Fact["key"], value: string, status: Fact["status"] = "confirmed"): Fact {
  return { key, value, status, evidenceIds: [], source: "document" };
}

function caseFromStub(s: Stub): CaseRecord {
  const payment: PaymentChannel =
    s.channel === "facebook" ? "MFS_BKASH" : "PLATFORM_WALLET";
  const facts: Fact[] = [
    fact("item_ordered", "Model A"),
    fact("item_received", "Model B"),
    fact(
      "chat_context",
      s.variant === "substitution" ? "substitution_approval" : "address_confirmation"
    ),
  ];

  if (s.channel === "daraz") {
    facts.push(fact("prior_action", "platform_return_rejected"));
    facts.push(fact("rejection_reason", "substitute_approved"));
  }
  if (s.channel === "facebook") {
    facts.push(fact("has_receipt", s.id.includes("has-receipt") ? "yes" : "no"));
  }

  if (s.expectDeadline === "computed" || (!s.expectDeadline && s.channel !== "other")) {
    if (s.id !== "deadline-needs-trigger" && s.id !== "deadline-conflict") {
      facts.push(fact("delivery_date", "2026-11-01"));
    }
  }
  if (s.id === "deadline-conflict") {
    facts.push(fact("delivery_date", "2026-11-04", "candidate"));
    facts.push(fact("delivery_date_alt", "2026-11-07", "candidate"));
  }
  if (s.id === "deadline-needs-trigger") {
    // no delivery date
  }
  if (s.id === "deadline-computed") {
    // ensure confirmed delivery
    const d = facts.find((f) => f.key === "delivery_date");
    if (!d) facts.push(fact("delivery_date", "2026-11-01"));
  }

  return {
    id: s.id,
    lang: "en",
    channel: s.channel,
    paymentChannel: payment,
    processingMode: "LOCAL_OFFLINE",
    story: "",
    facts,
    evidence: [],
    runs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("eval route scoring", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  const routeCases = stubs.filter((s) => s.expectRoute);
  const deadlineCases = stubs.filter((s) => s.expectDeadline);

  it(`scores first-route labels (${routeCases.length} cases)`, () => {
    let pass = 0;
    for (const s of routeCases) {
      const rm = buildRoadmap(caseFromStub(s), now);
      if (rm.routeId === s.expectRoute) pass++;
      else console.log("ROUTE MISS", s.id, "got", rm.routeId, "want", s.expectRoute);
    }
    expect(pass).toBeGreaterThanOrEqual(Math.min(20, routeCases.length));
    expect(pass).toBe(routeCases.length);
  });

  it("scores deadline states", () => {
    for (const s of deadlineCases) {
      const rm = buildRoadmap(caseFromStub(s), now);
      expect(rm.deadline.state, s.id).toBe(s.expectDeadline);
    }
  });

  it("Daraz dual clocks present when delivery confirmed", () => {
    const rm = buildRoadmap(caseFromStub(stubs.find((s) => s.id === "deadline-computed")!), now);
    expect(rm.clocks.some((c) => c.clockId === "DARAZ_RETURN_14D")).toBe(true);
    expect(rm.clocks.some((c) => c.clockId === "CRPA_S60_30D")).toBe(true);
  });
});
