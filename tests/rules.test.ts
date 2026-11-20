import { describe, expect, it } from "vitest";
import { addDaysIso, daysBetween, sameItem, buildRoadmap } from "@/lib/rules";
import { classifyChat } from "@/lib/pipeline/intake";
import type { CaseRecord } from "@/lib/types";

function blankCase(over: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: "test",
    lang: "en",
    channel: "daraz",
    paymentChannel: "PLATFORM_WALLET",
    processingMode: "LOCAL_OFFLINE",
    story: "",
    facts: [],
    evidence: [],
    runs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

describe("sameItem", () => {
  it("matches identical model strings", () => {
    expect(sameItem("Model A Phone", "Model A Phone")).toBe(true);
  });
  it("rejects different models", () => {
    expect(sameItem("Model A", "Model B")).toBe(false);
  });
});

describe("deadline arithmetic", () => {
  it("adds 30 days", () => {
    expect(addDaysIso("2026-01-01", 30)).toBe("2026-01-31");
  });
  it("counts days between", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
  });
});

describe("classifyChat", () => {
  it("detects address confirmation", () => {
    expect(
      classifyChat("Seller: Please confirm your delivery address.\nBuyer: yes")
    ).toBe("address_confirmation");
  });
  it("detects substitution approval", () => {
    expect(
      classifyChat("Seller: Model A is out of stock. Do you approve Model B?\nBuyer: yes")
    ).toBe("substitution_approval");
  });
});

describe("buildRoadmap", () => {
  it("uses Daraz route when return was rejected", () => {
    const c = blankCase({
      facts: [
        {
          key: "item_ordered",
          value: "Model A",
          status: "confirmed",
          evidenceIds: [],
          source: "document",
        },
        {
          key: "item_received",
          value: "Model B",
          status: "confirmed",
          evidenceIds: [],
          source: "document",
        },
        {
          key: "prior_action",
          value: "platform_return_rejected",
          status: "confirmed",
          evidenceIds: [],
          source: "document",
        },
        {
          key: "chat_context",
          value: "address_confirmation",
          status: "confirmed",
          evidenceIds: [],
          source: "document",
        },
        {
          key: "delivery_date",
          value: "2026-01-01",
          status: "confirmed",
          evidenceIds: [],
          source: "document",
        },
      ],
    });
    const rm = buildRoadmap(c, new Date("2026-01-10T00:00:00Z"));
    expect(rm.routeId).toMatch(/daraz/i);
    expect(rm.steps.length).toBeGreaterThan(0);
    expect(rm.deadline.state).toBe("computed");
    expect(rm.deadline.date).toBe("2026-01-31");
  });

  it("marks deadline conflict when two dates exist and trigger unconfirmed", () => {
    const c = blankCase({
      facts: [
        {
          key: "delivery_date",
          value: "2026-01-01",
          status: "candidate",
          evidenceIds: [],
          source: "document",
        },
        {
          key: "delivery_date_alt",
          value: "2026-01-05",
          status: "candidate",
          evidenceIds: [],
          source: "document",
        },
      ],
    });
    const rm = buildRoadmap(c);
    expect(rm.deadline.state).toBe("conflict");
  });

  it("builds Facebook route when channel is facebook", () => {
    const c = blankCase({
      channel: "facebook",
      facts: [
        {
          key: "has_receipt",
          value: "no",
          status: "confirmed",
          evidenceIds: [],
          source: "user",
        },
        {
          key: "item_ordered",
          value: "Model A",
          status: "confirmed",
          evidenceIds: [],
          source: "document",
        },
        {
          key: "item_received",
          value: "Model B",
          status: "confirmed",
          evidenceIds: [],
          source: "document",
        },
      ],
    });
    const rm = buildRoadmap(c);
    expect(rm.routeId).toBe("facebook_wrong_item");
  });
});
