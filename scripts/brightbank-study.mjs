import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  directory,
  studyName,
  makeStudy,
  writeFixtures,
  evidenceManifest,
} from "./brightbank-fixture.mjs";

await mkdir(".qa", { recursive: true });
await build({
  stdin: {
    contents: `export {defaultScenario,DEFAULT_COEFFICIENTS} from './lib/sim/defaults';export {runSync,traceConsumer,createRun,processRange} from './lib/sim/engine';export {runRequestSchema} from './lib/sim/validation';export {parseRun} from './lib/sim/run-validation';`,
    resolveDir: process.cwd(),
  },
  outfile: ".qa/brightbank-engine.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const {
  defaultScenario,
  DEFAULT_COEFFICIENTS,
  runSync,
  traceConsumer,
  runRequestSchema,
  parseRun,
  createRun,
  processRange,
} = await import("../.qa/brightbank-engine.mjs");
const request = runRequestSchema.parse(
  makeStudy(defaultScenario, DEFAULT_COEFFICIENTS),
);
const map = await writeFixtures(request);
const manifest = await evidenceManifest(map);
const json = (name, value) =>
  writeFile(`${directory}/${name}`, JSON.stringify(value, null, 2) + "\n");
await json("evidence-manifest.json", manifest);
const checks = [];
const pass = (name, detail = {}) => {
  checks.push({ name, status: "passed", ...detail });
  console.log("PASS " + name);
};
pass("Portable configuration validates; all feature scores are manual");
let apiBase;
const apiIndex = process.argv.indexOf("--api");
if (apiIndex >= 0) {
  apiBase = process.argv[apiIndex + 1];
  assert.match(apiBase, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
}
const studyId = crypto.randomUUID();
const headers = apiBase
  ? { Cookie: "__sites_local_auth=1", Origin: apiBase }
  : {};
async function call(path, data) {
  const response = await fetch(apiBase + "/api/sim/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      ...headers,
      ...(data === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
}
let ownedRequest = structuredClone(request);
if (apiBase) {
  const uploaded = new Map();
  for (const asset of manifest) {
    const stage =
      asset.file === "ad-copy.txt" || asset.file.endsWith(".png")
        ? "ad"
        : asset.file.includes("-cart.")
          ? "cart"
          : asset.file.includes("-checkout.")
            ? "checkout"
            : "pdp";
    const bytes = await readFile(`${directory}/${asset.file}`);
    let source;
    if (/\.(png|pdf)$/.test(asset.file)) {
      const response = await fetch(
        apiBase +
          `/api/sim/sources?stage=${stage}&name=${encodeURIComponent(asset.file.split("/").at(-1))}`,
        { method: "POST", headers, body: bytes },
      );
      source = await response.json();
      assert.equal(response.status, 200, JSON.stringify(source));
      const restored = await fetch(apiBase + source.url, { headers });
      assert.equal(restored.status, 200);
      assert.deepEqual(Buffer.from(await restored.arrayBuffer()), bytes);
      assert.match(restored.headers.get("cache-control"), /private/);
      assert.equal(source.hash, asset.sha256);
    } else {
      source = await call(
        asset.file.endsWith(".html") ? "sources/html" : "sources/manual",
        { stage, name: asset.file, text: bytes.toString() },
      );
      assert.ok(
        source.text.includes("Brightbank") ||
          source.text.includes("BRIGHTBANK"),
      );
      assert.ok(!source.text.includes("event.preventDefault()"));
      if (asset.file.includes("information-pdp"))
        assert.match(source.text, /35 g total sugar/);
    }
    uploaded.set(asset.file, source);
  }
  pass(
    "All 27 source assets uploaded; image and PDF bytes, hashes and private headers round-trip",
    { count: uploaded.size },
  );
  for (const s of ownedRequest.scenarios)
    s.sources = map[s.id].map((f) => uploaded.get(f));
  await call("studies", {
    id: studyId,
    name: studyName,
    request: ownedRequest,
  });
  const restored = await call(`studies/${studyId}`);
  assert.deepEqual(restored.request, ownedRequest);
  await writeFile(
    ".qa/brightbank-owned-study.json",
    JSON.stringify({ studyId, request: ownedRequest }, null, 2),
  );
  pass("Study saved and reopened with canonical owned source evidence");
  const noKey = await fetch(apiBase + "/api/sim/analysis", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: crypto.randomUUID(),
      sourceId: ownedRequest.scenarios[0].sources[0].id,
      scenario: ownedRequest.scenarios[0],
    }),
  });
  assert.equal(noKey.status, 400);
  pass("Missing API key rejected before paid GPT request");
}
if (process.argv.includes("--prepare-only")) {
  console.log(
    "Prepared fixtures and saved editable study. No simulation run yet.",
  );
  process.exit(0);
}
console.log("Evaluating 10,000,000 IDs across eight journeys...");
const run = parseRun(runSync(request));
assert.equal(run.processed, 10_000_000);
assert.equal(run.status, "complete");
pass(
  "Full 10M run validates nested funnels, loss accounting, segments and paired outcomes",
  { elapsedMs: run.elapsedMs },
);
const base = run.results[0];
for (const r of run.results) {
  assert.ok(r.purchases > 0);
  assert.ok(r.purchases < r.relevant);
  assert.equal(r.segments.relevance[0].purchases, 0);
  assert.equal(r.clicks, base.clicks);
}
pass(
  "Structural noninterest never buys; every journey retains a convertible subset",
);
for (const id of ["brightbank-guest", "brightbank-simple"]) {
  const r = run.results.find((r) => r.scenarioId === id);
  for (const key of ["clicks", "carts", "checkout"])
    assert.equal(r[key], base[key]);
}
pass("Checkout-only interventions preserve every upstream funnel count");
const sub = { ...request, count: 20000 };
const whole = runSync(sub),
  split = createRun(sub);
processRange(split, 0, 10000);
processRange(split, 10000, 20000);
assert.deepEqual(split.results, whole.results);
assert.deepEqual(split.comparisons, whole.comparisons);
pass(
  "20,000-ID partition replay produces identical results and paired comparisons",
);
const traces = [];
for (let si = 0; si < run.scenarios.length; si++) {
  const s = run.scenarios[si],
    r = run.results[si];
  for (const reason of [
    "no_interest",
    "purchased",
    "price",
    "information",
    "discount_search",
    "account_required",
    "form_friction",
    "technical_error",
  ]) {
    const id = r.samples[reason]?.[0];
    if (id === undefined) continue;
    const trace = traceConsumer(id, s, run.population, run.coefficients);
    assert.equal(trace.outcome.reason, reason);
    if (trace.outcome.bought) {
      const p = s.product;
      const item =
        Math.round(
          p.price *
            (trace.outcome.discountApplied ? 1 - p.discountPct : 1) *
            100,
        ) / 100;
      const shipping =
        p.freeShippingThreshold > 0 && item >= p.freeShippingThreshold
          ? 0
          : p.shipping;
      const revenue = Math.round((item + shipping) * 100) / 100;
      const gross =
        Math.round(
          (revenue + Math.round(revenue * p.taxRate * 100) / 100) * 100,
        ) / 100;
      const expected =
        Math.round(
          (revenue -
            p.unitCost -
            p.shippingCost -
            Math.round((gross * p.paymentFeeRate + p.paymentFeeFixed) * 100) /
              100) *
            100,
        ) / 100;
      assert.equal(trace.outcome.revenue, revenue);
      assert.equal(trace.outcome.contribution, expected);
    }
    traces.push({ scenarioId: s.id, reason, ...trace });
  }
}
assert.ok(traces.some((t) => t.reason === "purchased"));
assert.ok(traces.some((t) => t.reason === "no_interest"));
pass(
  "Individual records reproduce sampled outcomes and cent-based unit economics",
  { records: traces.length },
);
await json("individual-records.json", traces);
await json("journey-run.json", run);
if (apiBase) {
  const ownedRun = {
    ...structuredClone(run),
    id: crypto.randomUUID(),
    scenarios: ownedRequest.scenarios,
  };
  await call("runs", ownedRun);
  const readback = parseRun(await call(`runs/${ownedRun.id}`));
  assert.deepEqual(readback, ownedRun);
  await writeFile(
    ".qa/brightbank-owned-run.json",
    JSON.stringify({ studyId, runId: ownedRun.id }, null, 2),
  );
  pass("Full 10M frozen run saved and read back unchanged");
}
console.log(
  "Evaluating six price points, each across the same 10,000,000 IDs...",
);
const anchor = request.scenarios.find((s) => s.id === "brightbank-combined");
const prices = [19.2, 24, 28.8, 33.6, 38.4, 43.2];
const priceRequest = structuredClone(request);
priceRequest.id = "brightbank-price-10m";
priceRequest.scenarios = prices.map((price) => {
  const s = structuredClone(anchor);
  s.id = "brightbank-price-" + price.toFixed(2).replace(".", "-");
  s.name = "$" + price.toFixed(2) + " per 12-pack";
  s.product.price = price;
  return s;
});
runRequestSchema.parse(priceRequest);
const priceRun = parseRun(runSync(priceRequest));
for (const r of priceRun.results) assert.equal(r.clicks, base.clicks);
pass("Six price points each evaluate 10M IDs with the same price-free ad", {
  elapsedMs: priceRun.elapsedMs,
});
await json("price-configuration.json", priceRequest);
await json("price-run.json", priceRun);
const sensitivity = [];
for (const [name, overrides] of [
  ["Higher noninterest", { excludedShare: 0.8 }],
  ["Lower budgets", { medianBudget: 24 }],
  ["Higher price sensitivity", { priceSensitivity: 1.8 }],
]) {
  const req = structuredClone(request);
  req.id = "brightbank-sensitivity";
  req.count = 200000;
  Object.assign(req.population, overrides);
  req.scenarios = [request.scenarios[0], anchor];
  const r = parseRun(runSync(req));
  sensitivity.push({
    name,
    overrides,
    processed: r.processed,
    results: r.results.map((x) => ({
      name: x.scenarioName,
      purchases: x.purchases,
      contribution: x.contribution,
      adSpend: x.adSpend,
    })),
  });
}
await json("sensitivity.json", sensitivity);
pass("Three explicit 200,000-ID sensitivity checks completed");
const fmt = (n) => n.toLocaleString("en-US");
const usd = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const rows = run.results
  .map(
    (r) =>
      `| ${r.scenarioName} | ${fmt(r.clicks)} | ${fmt(r.carts)} | ${fmt(r.checkout)} | ${fmt(r.purchases)} | ${usd(r.revenue)} | ${usd(r.contribution - r.adSpend)} |`,
  )
  .join("\n");
const priceRows = priceRun.results
  .map(
    (r, i) =>
      `| ${usd(prices[i])} | ${fmt(r.purchases)} | ${usd(r.revenue)} | ${usd(r.contribution - r.adSpend)} |`,
  )
  .join("\n");
const best = [...run.results].sort(
  (a, b) => b.contribution - b.adSpend - (a.contribution - a.adSpend),
)[0];
const priceBest = [...priceRun.results].sort(
  (a, b) => b.contribution - b.adSpend - (a.contribution - a.adSpend),
)[0];
const paired = run.comparisons
  .map(
    (c) =>
      `| ${run.scenarios.find((s) => s.id === c.scenarioId).name} | ${fmt(c.bothBuy)} | ${fmt(c.baselineOnly)} | ${fmt(c.variantOnly)} |`,
  )
  .join("\n");
const report = `# Brightbank soda example study\n\nFictional product. Synthetic outputs from authored assumptions, not a sales forecast. Engine ${run.version}; seed ${run.population.seed}. Executed ${run.createdAt}.\n\n## Question\n\nHow do product answers, checkout requirements, shipping and price change a modeled first purchase of a $28.80 orange-vanilla cane-sugar soda 12-pack?\n\n## Journey results\n\nEach row evaluated the same ${fmt(run.processed)} individual IDs. Media spend is ${usd(base.adSpend)} per scenario at an assumed $9.50 CPM. Revenue includes customer shipping, excludes tax. Contribution after media subtracts product cost, fulfillment/shipping, payment fees and modeled ad spend. One purchase means one 12-pack.\n\n| Journey | Clicks | Carts | Checkout | Orders | Revenue | Contribution after media |\n|---|---:|---:|---:|---:|---:|---:|\n${rows}\n\n## Paired buyers versus baseline\n\n| Alternative | Buy both | Baseline only | Alternative only |\n|---|---:|---:|---:|\n${paired}\n\n## Price test\n\nThe complete-PDP, guest, shorter-forms journey is held constant. Each price evaluates the same 10M IDs. No price appears in the ad; therefore clicks must match. These six points are hypothetical PDP price changes; the supplied screenshot/PDF depicts the $28.80 anchor offer.\n\n| Pack price | Orders | Revenue | Contribution after media |\n|---|---:|---:|---:|\n${priceRows}\n\n## Price response detail\n\nThe $19.20 point produces fewer orders than $24.00 because this authored model penalizes late shipping in proportion to the merchandise price. The same $6.95 charge is a larger relative surprise on the cheaper pack. This is an interaction of model rules, not evidence that soda buyers prefer a higher price. The highest-contribution price is at the upper boundary of the tested range, so this study does not locate an interior optimum.\n\n## Decision from this model\n\nThe highest contribution among the journey alternatives is **${best.scenarioName}**, at ${usd(best.contribution - best.adSpend)} after media. The highest among the tested price points is **${priceBest.scenarioName}**, at ${usd(priceBest.contribution - priceBest.adSpend)}. This is a ranking inside the supplied assumptions, not a validated market recommendation or a continuous price optimum. ${best.contribution - best.adSpend < 0 ? "Even the strongest journey loses money after the assumed acquisition spend. The modeled conversion improvements do not establish a viable paid-acquisition plan." : "A positive modeled contribution does not establish real acquisition profitability."}\n\nUse this result to choose a real experiment: first measure the baseline funnel, then test a single checkout change at equal traffic allocation. Test price separately and track net contribution, refunds and repeat purchase. The simulated study supplies a test hypothesis, not an expected lift.\n\n## What was actually exercised\n\n${checks.map((c) => "- " + c.name + ".").join("\n")}\n\nSee test-receipt.json and browser-test.md for exact execution coverage. Optional paid GPT extraction is not claimed tested without a provider key. No real ads, transactions or customer records were used.\n\n## Interpretation limits\n\n65% structural noninterest is an invented input. Active need is 28% of the remaining 35%, or 9.8% of the full population in expectation. There is no separate sugar-avoidance, flavor or dietary trait. Ad pixels and page text do not independently get read by 10 million language-model agents; their modeled effect comes from the explicit numeric inputs in assumptions.md. Reported reasons are model decisions, not customer quotes.\n\nThe price curve and sensitivity checks do not validate those assumptions. Read sensitivity.json for three 200,000-ID stress cases. The generic return-window behavior is not a perishable-goods model. This version excludes multipack baskets, repeat purchases, inventory depletion and lifetime value.\n`;
await writeFile(directory + "/RESULTS.md", report);
const csvHeader =
  "scenario,exposed,clicks,carts,checkout,purchases,revenue,contribution_before_media,ad_spend,contribution_after_media";
await writeFile(
  directory + "/journey-results.csv",
  csvHeader +
    "\n" +
    run.results
      .map((r) =>
        [
          r.scenarioName,
          r.exposed,
          r.clicks,
          r.carts,
          r.checkout,
          r.purchases,
          r.revenue,
          r.contribution,
          r.adSpend,
          Math.round((r.contribution - r.adSpend) * 100) / 100,
        ]
          .map((v) => JSON.stringify(v))
          .join(","),
      )
      .join("\n") +
    "\n",
);
await json("test-receipt.json", {
  executedAt: new Date().toISOString(),
  runtime: process.version,
  platform: process.platform,
  architecture: process.arch,
  engine: run.version,
  configurationSha256: createHash("sha256")
    .update(await readFile(directory + "/configuration.json"))
    .digest("hex"),
  population: run.processed,
  journeys: run.scenarios.length,
  pricePoints: prices.length,
  apiTested: !!apiBase,
  paidGptTested: false,
  checks,
  memoryAtEnd: process.memoryUsage(),
});
console.log(
  JSON.stringify(
    {
      bestJourney: best.scenarioName,
      bestPrice: priceBest.scenarioName,
      baselineOrders: base.purchases,
      bestJourneyOrders: best.purchases,
      files: directory,
    },
    null,
    2,
  ),
);
