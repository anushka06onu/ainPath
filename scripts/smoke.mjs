const B = "http://localhost:3000";
const j = async (p, o) => {
  const r = await fetch(B + p, o);
  const t = await r.text();
  try { return { s: r.status, d: JSON.parse(t) }; } catch { return { s: r.status, d: t }; }
};
const post = (p, b) => j(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b ?? {}) });

const mode = process.argv[2] || "daraz";
const variant = process.argv[3] || "address";
let r = await post("/api/cases", { lang: "en", fixture: mode, variant });
console.log("create", r.s, r.d.id ?? r.d);
const id = r.d.id;
console.log("facts", r.d.facts.map((f) => `${f.key}=${f.value}[${f.status}]`).join("\n  "));
// confirm all facts with value
await j(`/api/cases/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ facts: r.d.facts.filter((f) => f.value).map((f) => ({ key: f.key, status: "confirmed" })) }) });
const a = await fetch(`${B}/api/cases/${id}/analyze`, { method: "POST" });
const txt = await a.text();
const lines = txt.trim().split("\n").map((l) => JSON.parse(l));
for (const l of lines) if (!l.done) console.log(l.agent, l.status, l.run?.model, l.run?.note ?? "", l.run?.ms);
const fin = lines.at(-1);
if (fin.error) console.log("ERR", fin.error);
else {
  const c = fin.case;
  for (const f of c.analysis.findings) console.log(`- [${f.status}] ${f.title.en} | p${f.anchor.page} "${f.anchor.quote}" | ${f.authorityIds} | ${f.origin}\n    risk: ${f.risk.en}\n    bn: ${f.title.bn}`);
  console.log("roadmap:", c.roadmap.routeId, c.roadmap.steps.map((s) => `${s.id}[${s.label}]`).join(", "));
  console.log("deadline:", JSON.stringify(c.roadmap.deadline));
  console.log("positions:", c.analysis.positions.map((p) => p.side + ": " + p.claim.en).join(" | "));
}
console.log(id);
