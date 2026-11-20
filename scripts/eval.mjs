/**
 * Offline rules-only eval against eval/cases.json.
 * Spawns vitest for executable scoring (no Groq).
 *
 * Usage: node scripts/eval.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const casesPath = path.join(process.cwd(), "eval", "cases.json");
const cases = JSON.parse(fs.readFileSync(casesPath, "utf8"));

console.log(`Eval stubs: ${cases.length} (12+ Daraz/Facebook labeled routes + deadline + sensitivity notes)`);
console.log("Running scored Vitest suite: tests/eval-route.test.ts + deadline + rules…\n");

const r = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vitest", "run", "tests/eval-route.test.ts", "tests/deadline.test.ts", "tests/rules.test.ts", "tests/citation.test.ts"],
  { stdio: "inherit", shell: true }
);

process.exit(r.status ?? 1);
