import { readFile } from "node:fs/promises";
import vm from "node:vm";
import assert from "node:assert/strict";
import { build } from "esbuild";
await import("./build-worker.mjs");
await build({
  stdin: {
    contents: `export {defaultScenario,DEFAULT_POPULATION,DEFAULT_COEFFICIENTS} from './lib/sim/defaults';export {runSync} from './lib/sim/engine';`,
    resolveDir: process.cwd(),
  },
  outfile: ".qa/worker-fixture.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { defaultScenario, DEFAULT_POPULATION, DEFAULT_COEFFICIENTS, runSync } =
  await import("../.qa/worker-fixture.mjs");
const messages = [];
const context = vm.createContext({
  Uint32Array,
  performance,
  structuredClone,
  setTimeout,
  clearTimeout,
  console,
  self: {
    postMessage(message) {
      messages.push(structuredClone(message));
    },
  },
});
vm.runInContext(
  await readFile("public/workers/simulation.js", "utf8"),
  context,
);
await context.self.onmessage({ data: { type: "unknown" } });
assert.equal(messages.pop().type, "error");
const request = {
  id: "worker-contract",
  population: { ...DEFAULT_POPULATION, size: 1000000 },
  scenarios: [defaultScenario()],
  coefficients: DEFAULT_COEFFICIENTS,
};
const pending = context.self.onmessage({ data: { type: "run", request } });
await context.self.onmessage({
  data: { type: "run", request: { ...request, id: "concurrent" } },
});
await pending;
assert.ok(messages.some((m) => m.type === "error" && m.id === "concurrent"));
const progress = messages.filter((m) => m.type === "progress"),
  complete = messages.find((m) => m.type === "complete");
assert.ok(progress.length);
assert.ok(
  progress.every(
    (m) =>
      !("scenarios" in m.result) &&
      !("population" in m.result) &&
      m.result.status === "partial",
  ),
);
assert.equal(complete.result.processed, 1000000);
assert.deepEqual(complete.result.results, runSync(request).results);
await context.self.onmessage({
  data: {
    type: "trace",
    id: "bad-id",
    consumerId: 1000001,
    scenario: request.scenarios[0],
    population: request.population,
    coefficients: request.coefficients,
  },
});
assert.equal(messages.at(-1).type, "error");
console.log(
  "PASS built Worker: exact one-million-consumer output, compact progress, concurrent-run rejection, unknown operation, and trace range validation.",
);
