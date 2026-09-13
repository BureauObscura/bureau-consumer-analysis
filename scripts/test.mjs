import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir(".qa", { recursive: true });
await build({
  entryPoints: ["tests/engine.test.ts"],
  outfile: ".qa/engine.test.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
});
const result = spawnSync(process.execPath, ["--test", ".qa/engine.test.mjs"], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
