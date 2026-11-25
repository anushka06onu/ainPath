import { spawnSync } from "node:child_process";

// Run the labeled route cases and the full pipeline and data-lifecycle checks.
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run"], { stdio: "inherit" });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
