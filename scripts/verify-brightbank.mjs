import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { build, transform } from "esbuild";
import { Parser } from "htmlparser2";

const root = "public/examples/brightbank/";
const readJson = async (name) =>
  JSON.parse(await readFile(root + name, "utf8"));
await mkdir(".qa", { recursive: true });
await build({
  stdin: {
    contents: `export {runRequestSchema} from './lib/sim/validation';export {parseRun} from './lib/sim/run-validation';export {runSync,traceConsumer} from './lib/sim/engine';`,
    resolveDir: process.cwd(),
  },
  outfile: ".qa/verify-brightbank.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { runRequestSchema, parseRun, runSync, traceConsumer } =
  await import("../.qa/verify-brightbank.mjs");
const config = runRequestSchema.parse(await readJson("configuration.json"));
const run = parseRun(await readJson("journey-run.json"));
const priceConfig = runRequestSchema.parse(
  await readJson("price-configuration.json"),
);
const priceRun = parseRun(await readJson("price-run.json"));
assert.deepEqual(run.scenarios, config.scenarios);
assert.deepEqual(run.population, config.population);
assert.deepEqual(priceRun.scenarios, priceConfig.scenarios);
assert.equal(run.processed, 10_000_000);
assert.equal(priceRun.processed, 10_000_000);
for (const asset of await readJson("evidence-manifest.json")) {
  const bytes = await readFile(root + asset.file);
  assert.equal(bytes.length, asset.bytes);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    asset.sha256,
    asset.file,
  );
  if (asset.file.endsWith(".html")) {
    const html = bytes.toString();
    const parser = new Parser({
      onopentag(name, attrs) {
        for (const [key, value] of Object.entries(attrs))
          if (key.startsWith("on")) new Function("event", value);
      },
    });
    parser.write(html);
    parser.end();
    for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))
      await transform(match[1], { loader: "js" });
  }
}
for (const s of config.scenarios) {
  const html = await readFile(root + s.id + "-checkout.html", "utf8");
  let fields = 0;
  const parser = new Parser({
    onopentag(name, attrs) {
      if (name === "input" && Object.hasOwn(attrs, "required")) fields++;
    },
  });
  parser.write(html);
  parser.end();
  assert.equal(
    fields,
    s.steps.reduce((n, st) => n + st.fields, 0),
    s.id + " required card-flow field count",
  );
}
for (const record of await readJson("individual-records.json")) {
  const s = config.scenarios.find((s) => s.id === record.scenarioId);
  const trace = traceConsumer(
    record.profile.id,
    s,
    config.population,
    config.coefficients,
  );
  assert.deepEqual(trace.profile, record.profile);
  assert.deepEqual(trace.outcome, record.outcome);
  assert.deepEqual(JSON.parse(JSON.stringify(trace.events)), record.events); // JSON represents -0 as 0.
}
if (process.argv.includes("--full")) {
  for (const [input, expected] of [
    [config, run],
    [priceConfig, priceRun],
  ]) {
    const actual = runSync(input);
    assert.deepEqual(actual.results, expected.results);
    assert.deepEqual(actual.comparisons, expected.comparisons);
  }
  console.log(
    "PASS full 10M journey and six-price replay matches every published numerical result.",
  );
}
console.log(
  "PASS Brightbank asset hashes, configuration/result schemas, HTML script syntax, required fields and 57 consumer records.",
);
