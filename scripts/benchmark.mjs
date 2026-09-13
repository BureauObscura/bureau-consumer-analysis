import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
await mkdir(".qa", { recursive: true });
await build({
  stdin: {
    contents: `import {runSync} from './lib/sim/engine';import {defaultScenario,DEFAULT_POPULATION,DEFAULT_COEFFICIENTS,makeVariant} from './lib/sim/defaults';export function run(n){const s=defaultScenario();return runSync({id:'benchmark',population:{...DEFAULT_POPULATION,size:n},scenarios:[s,makeVariant(s,'guest')],coefficients:DEFAULT_COEFFICIENTS});}`,
    resolveDir: process.cwd(),
  },
  outfile: ".qa/benchmark-engine.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { run } = await import("../.qa/benchmark-engine.mjs");
const result = run(Number(process.argv[2] ?? 10000000));
console.log(
  JSON.stringify(
    {
      processed: result.processed,
      version: result.version,
      elapsedMs: result.elapsedMs,
      results: result.results.map((r) => ({
        name: r.scenarioName,
        clicks: r.clicks,
        carts: r.carts,
        checkout: r.checkout,
        purchases: r.purchases,
        revenue: r.revenue,
        contribution: r.contribution,
        adSpend: r.adSpend,
        reasons: r.reasons,
      })),
      comparisons: result.comparisons,
      memory: process.memoryUsage(),
    },
    null,
    2,
  ),
);
