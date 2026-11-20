import { describe, expect, it } from "vitest";
import { buildDeadlineClocks, legacyDeadlineFromClocks } from "@/lib/engines/deadline";
import type { CaseRecord, Fact } from "@/lib/types";

function f(key: Fact["key"], value: string, status: Fact["status"] = "confirmed"): Fact {
  return { key, value, status, evidenceIds: [], source: "document" };
}

function blank(over: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: "t",
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

describe("buildDeadlineClocks", () => {
  const now = new Date("2026-11-10T00:00:00Z");

  it("refuses CRPA s.60 and Daraz 14d when delivery unconfirmed", () => {
    const clocks = buildDeadlineClocks(blank({ facts: [f("delivery_date", "2026-11-01", "candidate")] }), now);
    const s60 = clocks.find((c) => c.clockId === "CRPA_S60_30D")!;
    const d14 = clocks.find((c) => c.clockId === "DARAZ_RETURN_14D")!;
    expect(s60.status).toBe("REFUSED_UNCONFIRMED_TRIGGER");
    expect(d14.status).toBe("REFUSED_UNCONFIRMED_TRIGGER");
    expect(s60.dueDate).toBeUndefined();
  });

  it("computes dual clocks when delivery confirmed", () => {
    const clocks = buildDeadlineClocks(blank({ facts: [f("delivery_date", "2026-11-01")] }), now);
    const s60 = clocks.find((c) => c.clockId === "CRPA_S60_30D")!;
    const d14 = clocks.find((c) => c.clockId === "DARAZ_RETURN_14D")!;
    expect(s60.status).toBe("ACTIVE");
    expect(s60.dueDate).toBe("2026-12-01");
    expect(d14.dueDate).toBe("2026-11-15");
    expect(legacyDeadlineFromClocks(clocks).state).toBe("computed");
    expect(legacyDeadlineFromClocks(clocks).date).toBe("2026-12-01");
  });

  it("refuses on conflicting dates", () => {
    const clocks = buildDeadlineClocks(
      blank({
        facts: [f("delivery_date", "2026-11-04", "candidate"), f("delivery_date_alt", "2026-11-07", "candidate")],
      }),
      now
    );
    expect(clocks.find((c) => c.clockId === "CRPA_S60_30D")!.status).toBe("REFUSED_UNCONFIRMED_TRIGGER");
    expect(legacyDeadlineFromClocks(clocks).state).toBe("conflict");
  });

  it("adds card chargeback clock for CARD payment", () => {
    const clocks = buildDeadlineClocks(
      blank({
        paymentChannel: "CARD_DEBIT_CREDIT",
        facts: [f("delivery_date", "2026-11-01")],
      }),
      now
    );
    expect(clocks.some((c) => c.clockId === "CARD_CHARGEBACK")).toBe(true);
  });

  it("skips Daraz 14d for Facebook channel", () => {
    const clocks = buildDeadlineClocks(
      blank({
        channel: "facebook",
        paymentChannel: "MFS_BKASH",
        facts: [f("delivery_date", "2026-11-01")],
      }),
      now
    );
    expect(clocks.find((c) => c.clockId === "DARAZ_RETURN_14D")).toBeUndefined();
    expect(clocks.some((c) => c.clockId === "BANGLA_QR_45D")).toBe(true);
  });
});
