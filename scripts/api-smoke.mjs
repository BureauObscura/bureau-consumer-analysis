import assert from "node:assert/strict";
import { build } from "esbuild";
import { DatabaseSync } from "node:sqlite";
import { readdirSync } from "node:fs";
await build({
  stdin: {
    contents: `export {defaultScenario,DEFAULT_POPULATION,DEFAULT_COEFFICIENTS} from './lib/sim/defaults';export {runSync} from './lib/sim/engine';`,
    resolveDir: process.cwd(),
  },
  outfile: ".qa/api-fixture.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { defaultScenario, DEFAULT_POPULATION, DEFAULT_COEFFICIENTS, runSync } =
  await import("../.qa/api-fixture.mjs");
const base = process.argv[2] ?? "http://localhost:5174";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error(
    "This smoke test is restricted to a local development server. It uses the supported local sign-in cookie and synthetic database fixtures.",
  );
const other = `qa-${crypto.randomUUID()}`;
const headers = { Cookie: "__sites_local_auth=1", Origin: base };
const dbDir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
let database;
for (const name of readdirSync(dbDir).filter(
  (n) => n.endsWith(".sqlite") && n !== "metadata.sqlite",
)) {
  const db = new DatabaseSync(`${dbDir}/${name}`);
  if (db.prepare("SELECT name FROM sqlite_master WHERE name='sources'").get()) {
    database = db;
    break;
  }
  db.close();
}
if (!database)
  throw Error("Apply local D1 migrations before running the API test.");
const foreignSource = crypto.randomUUID(),
  foreignStudy = crypto.randomUUID(),
  foreignRun = crypto.randomUUID();
database
  .prepare("INSERT INTO sources (id,owner,data,created_at) VALUES (?,?,?,?)")
  .run(foreignSource, other, "{}", new Date().toISOString());
database
  .prepare(
    "INSERT INTO studies (id,owner,name,data,updated_at) VALUES (?,?,?,?,?)",
  )
  .run(foreignStudy, other, "Foreign QA", "{}", new Date().toISOString());
database
  .prepare(
    "INSERT INTO simulation_runs (id,owner,name,summary,object_key,created_at) VALUES (?,?,?,?,?,?)",
  )
  .run(
    foreignRun,
    other,
    "Foreign QA",
    "{}",
    "unreadable-foreign-object",
    new Date().toISOString(),
  );
async function call(
  path,
  { method = "GET", data, identity = true, extra = {} } = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(identity ? headers : {}),
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...extra,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: response.headers };
}
const check = (label) => console.log(`PASS ${label}`);
assert.equal((await call("/", { identity: false })).status, 200);
check("App returns HTML");
assert.equal(
  (await call("/api/sim/workspace", { identity: false })).status,
  401,
);
check("Unauthenticated storage rejected");
const initial = await call("/api/sim/workspace");
assert.equal(initial.status, 200, JSON.stringify(initial.body));
check("Owned workspace available");
assert.equal(
  (
    await call("/api/sim/sources/manual", {
      method: "POST",
      data: { stage: "pdp", name: "QA", text: "Product details" },
      extra: { Origin: "https://foreign.invalid" },
    })
  ).status,
  403,
);
check("Foreign-origin mutations rejected");
const sourceResponse = await call("/api/sim/sources/manual", {
  method: "POST",
  data: {
    stage: "pdp",
    name: "QA product page",
    text: "A durable everyday bag. Original product evidence.",
  },
});
assert.equal(sourceResponse.status, 200, JSON.stringify(sourceResponse.body));
const source = sourceResponse.body;
assert.equal((await call(`/api/sim/sources/${foreignSource}`)).status, 404);
check("Source ownership enforced");
const image = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  ),
);
const imageResponse = await fetch(
  base + "/api/sim/sources?stage=ad&name=qa.png",
  { method: "POST", headers, body: image },
);
assert.equal(imageResponse.status, 200);
const stored = await imageResponse.json();
const file = await fetch(base + stored.url, { headers });
assert.equal(file.status, 200);
assert.equal(file.headers.get("content-type"), "image/png");
assert.equal(file.headers.get("x-content-type-options"), "nosniff");
assert.match(file.headers.get("cache-control"), /private/);
assert.deepEqual(new Uint8Array(await file.arrayBuffer()), image);
check("Uploaded image bytes and private headers round-trip");
const invalid = await fetch(base + "/api/sim/sources?stage=ad&name=bad.png", {
  method: "POST",
  headers,
  body: new Uint8Array([137, 80, 78, 71]),
});
assert.equal(invalid.status, 400);
check("Malformed image rejected");
const html = await call("/api/sim/sources/html", {
  method: "POST",
  data: {
    stage: "checkout",
    name: "Checkout HTML",
    text: '<script>secret()</script><input type="hidden" name="csrf"><select required name="country"><option>US</option></select><input type="submit" value="Place order">',
  },
});
assert.equal(html.status, 200);
assert.ok(
  !html.body.text.includes("csrf") && !html.body.text.includes("secret()"),
);
assert.match(html.body.text, /required/);
assert.match(html.body.text, /Place order/);
check("HTML controls extracted without hidden fields or scripts");
assert.equal(
  (
    await call("/api/sim/sources/import", {
      method: "POST",
      data: { stage: "pdp", url: "https://127.0.0.1/" },
    })
  ).status,
  400,
);
check("Private URL rejected without network request");
const s = defaultScenario();
s.sources = [{ ...source, text: "SPOOFED EVIDENCE" }, stored];
const request = {
  id: crypto.randomUUID(),
  population: { ...DEFAULT_POPULATION, size: 10000 },
  scenarios: [s],
  coefficients: DEFAULT_COEFFICIENTS,
};
const studyId = crypto.randomUUID();
const save = await call("/api/sim/studies", {
  method: "POST",
  data: { id: studyId, name: "QA study", request },
});
assert.equal(save.status, 200, JSON.stringify(save.body));
const restored = await call(`/api/sim/studies/${studyId}`);
assert.equal(restored.status, 200);
assert.equal(restored.body.request.scenarios[0].sources[0].text, source.text);
assert.equal((await call(`/api/sim/studies/${foreignStudy}`)).status, 404);
check("Study saves canonical source evidence and enforces ownership");
const spoof = structuredClone(request);
spoof.scenarios[0].featureBasis.adClarity = {
  kind: "analysis",
  analysisId: "missing",
  sourceId: source.id,
};
assert.equal(
  (
    await call("/api/sim/studies", {
      method: "POST",
      data: { id: crypto.randomUUID(), name: "Bad provenance", request: spoof },
    })
  ).status,
  400,
);
check("False analysis provenance rejected");
const run = runSync(request);
const saves = await Promise.all(
  Array.from({ length: 4 }, () =>
    call("/api/sim/runs", { method: "POST", data: run }),
  ),
);
assert.ok(
  saves.every((r) => r.status === 200),
  JSON.stringify(saves),
);
const result = await call(`/api/sim/runs/${run.id}`);
assert.equal(result.status, 200, JSON.stringify(result.body));
assert.equal(result.body.results[0].purchases, run.results[0].purchases);
assert.equal((await call(`/api/sim/runs/${foreignRun}`)).status, 404);
check("Concurrent duplicate run saves preserve the artifact");
assert.equal(
  (
    await call("/api/sim/analysis", {
      method: "POST",
      data: {
        sourceId: source.id,
        requestId: crypto.randomUUID(),
        scenario: s,
      },
    })
  ).status,
  400,
);
check("Missing API key fails before paid provider request");
database.prepare("DELETE FROM sources WHERE id=?").run(foreignSource);
database.prepare("DELETE FROM studies WHERE id=?").run(foreignStudy);
database.prepare("DELETE FROM simulation_runs WHERE id=?").run(foreignRun);
database.close();
console.log(
  "All local API integration checks passed. No paid provider calls were made.",
);
