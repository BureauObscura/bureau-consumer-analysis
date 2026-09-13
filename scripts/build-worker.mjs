import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
await mkdir("public/workers", { recursive: true });
await build({
  entryPoints: ["lib/sim/worker.ts"],
  outfile: "public/workers/simulation.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "eof",
});
