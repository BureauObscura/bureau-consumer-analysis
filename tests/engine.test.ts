import test from "node:test";
import assert from "node:assert/strict";
import { philox, mulHi } from "../lib/sim/random";
import {
  calibrate,
  createRun,
  processRange,
  runSync,
  traceConsumer,
  profileFor,
  evaluate,
  counts,
} from "../lib/sim/engine";
import {
  DEFAULT_POPULATION,
  DEFAULT_COEFFICIENTS,
  defaultScenario,
  makeVariant,
} from "../lib/sim/defaults";
import { runRequestSchema, coefficientsSchema } from "../lib/sim/validation";
import { parseRun } from "../lib/sim/run-validation";
import { calibrationSignature } from "../lib/sim/signature";
import { publicPageUrl } from "../lib/server/url-policy";
import { htmlText } from "../lib/server/html";
import {
  MAX_POPULATION,
  type RunRequest,
  type RunResult,
} from "../lib/sim/types";
const request = (size = 100000): RunRequest => ({
  id: "unit-test",
  population: { ...DEFAULT_POPULATION, size },
  scenarios: [defaultScenario()],
  coefficients: { ...DEFAULT_COEFFICIENTS },
});
function invariant(r: RunResult) {
  for (const s of r.results) {
    assert.equal(s.exposed, r.processed);
    assert.ok(
      s.clicks <= s.exposed &&
        s.carts <= s.clicks &&
        s.checkout <= s.carts &&
        s.purchases <= s.checkout,
    );
    assert.equal(
      Object.values(s.reasons).reduce((a, b) => a + b, 0),
      s.exposed,
    );
    assert.equal(s.reasons.purchased, s.purchases);
    assert.equal(s.shoppingClicks + s.nonshoppingClicks, s.clicks);
    for (const segments of Object.values(s.segments))
      for (const key of [
        "exposed",
        "clicks",
        "carts",
        "checkout",
        "purchases",
      ] as const)
        assert.equal(
          segments.reduce((n, v) => n + v[key], 0),
          s[key],
        );
    assert.equal(
      Object.values(s.losses.ad).reduce((a, b) => a + b, 0),
      s.exposed - s.clicks,
    );
    assert.equal(
      Object.values(s.losses.pdp).reduce((a, b) => a + b, 0),
      s.clicks - s.carts,
    );
    assert.equal(
      Object.values(s.losses.cart).reduce((a, b) => a + b, 0),
      s.carts - s.checkout,
    );
    assert.equal(
      Object.values(s.losses.checkout).reduce((a, b) => a + b, 0),
      s.checkout - s.purchases,
    );
    assert.ok(
      s.steps.every(
        (v, i) =>
          v.completed <= v.reached &&
          v.reached <= (i ? s.steps[i - 1].completed : s.checkout),
      ),
    );
  }
  for (let i = 0; i < r.comparisons.length; i++) {
    const c = r.comparisons[i];
    assert.equal(c.bothBuy + c.baselineOnly, r.results[0].purchases);
    assert.equal(c.bothBuy + c.variantOnly, r.results[i + 1].purchases);
    assert.equal(
      c.bothBuy + c.baselineOnly + c.variantOnly + c.neither,
      r.processed,
    );
  }
  parseRun(JSON.parse(JSON.stringify(r)));
}
test("Philox matches all three Random123 known-answer vectors", () => {
  for (const [counter, key, expected] of [
    [
      [0, 0, 0, 0],
      [0, 0],
      [0x6627e8d5, 0xe169c58d, 0xbc57ac4c, 0x9b00dbd8],
    ],
    [
      [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff],
      [0xffffffff, 0xffffffff],
      [0x408f276d, 0x41c83b0e, 0xa20bc7c6, 0x6d5451fd],
    ],
    [
      [0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344],
      [0xa4093822, 0x299f31d0],
      [0xd16cfe09, 0x94fdcceb, 0x5001e420, 0x24126ea1],
    ],
  ]) {
    const out = new Uint32Array(4);
    philox(counter[0], counter[1], counter[2], counter[3], key[0], key[1], out);
    assert.deepEqual([...out], expected);
  }
  for (const a of [0, 1, 65535, 65536, 0xffffffff])
    for (const b of [0, 1, 65535, 0xffffffff])
      assert.equal(
        mulHi(a, b),
        Number(((BigInt(a) * BigInt(b)) >> BigInt(32)) & BigInt(0xffffffff)),
      );
});
test("full trajectory, segments, paired outcomes and terminal loss counts reconcile", () => {
  const q = request();
  q.scenarios.push(
    makeVariant(q.scenarios[0], "ideal"),
    makeVariant(q.scenarios[0], "free-shipping"),
  );
  const r = runSync(q);
  invariant(r);
  const again = runSync(q);
  assert.deepEqual(r.results, again.results);
  assert.deepEqual(r.comparisons, again.comparisons);
});
test("identical alternatives preserve every individual outcome", () => {
  const q = request();
  q.scenarios.push({ ...structuredClone(q.scenarios[0]), id: "identical" });
  const r = runSync(q);
  assert.equal(r.comparisons[0].baselineOnly, 0);
  assert.equal(r.comparisons[0].variantOnly, 0);
  assert.equal(r.comparisons[0].deltaRate, 0);
});
test("checkout and cart settings cannot change earlier stage selections", () => {
  const q = request();
  const a = runSync(q).results[0];
  q.scenarios[0].settings.guestCheckout = true;
  q.scenarios[0].settings.wallets = true;
  q.scenarios[0].settings.bnpl = true;
  q.scenarios[0].steps = [];
  q.scenarios[0].steps.push({
    id: "quick",
    name: "Quick",
    type: "review",
    fields: 0,
    seconds: 0,
    errorRate: 0,
    clarity: 1,
  });
  const b = runSync(q).results[0];
  assert.equal(a.clicks, b.clicks);
  assert.equal(a.carts, b.carts);
  assert.equal(a.checkout, b.checkout);
  q.scenarios[0].features.informationAccess = 1;
  const c = runSync(q).results[0];
  assert.equal(a.clicks, c.clicks);
  assert.equal(a.carts, c.carts);
});
test("structural disinterest, offline channel, and stock are hard purchase boundaries", () => {
  const q = request();
  q.scenarios = [makeVariant(q.scenarios[0], "ideal")];
  q.coefficients = {
    ad: 12,
    page: 12,
    cart: 12,
    checkout: 12,
    provenance: "authored",
  };
  q.population.excludedShare = 1;
  assert.equal(runSync(q).results[0].purchases, 0);
  q.population.excludedShare = 0;
  q.population.offlineOnlyShare = 1;
  assert.equal(runSync(q).results[0].purchases, 0);
  q.population.offlineOnlyShare = 0;
  q.scenarios[0].product.stock = "out";
  assert.equal(runSync(q).results[0].carts, 0);
});
test("range partitions are reproducible and retain exported start ID", () => {
  const q = request();
  const whole = runSync(q),
    partition = createRun(q);
  processRange(partition, 0, 137);
  processRange(partition, 137, 49000);
  processRange(partition, 49000, q.population.size);
  assert.deepEqual(partition.results, whole.results);
  const sub = runSync({ ...q, startId: 700, count: 300 });
  assert.equal(sub.startId, 700);
  assert.equal(sub.processed, 300);
  assert.equal(sub.planned, 300);
  invariant(sub);
});
test("saved consumer records reproduce actual aggregate outcomes", () => {
  const q = request(1000),
    r = runSync(q);
  let buys = 0,
    clicks = 0,
    carts = 0;
  for (let id = 0; id < 1000; id++) {
    const t = traceConsumer(id, q.scenarios[0], q.population, q.coefficients);
    buys += +t.outcome.bought;
    clicks += +t.outcome.clicked;
    carts += +t.outcome.cart;
    assert.deepEqual(
      t.outcome,
      evaluate(
        profileFor(id, q.population, "bags"),
        q.scenarios[0],
        q.population,
        q.coefficients,
      ),
    );
  }
  assert.equal(r.results[0].purchases, buys);
  assert.equal(r.results[0].clicks, clicks);
  assert.equal(r.results[0].carts, carts);
});
test("price changes preserve personal budgets and do not make a zero discount valuable", () => {
  const q = request();
  const p = profileFor(100, q.population, "bags");
  const normal = runSync(q);
  q.scenarios[0].product.price = 200;
  assert.deepEqual(p, profileFor(100, q.population, "bags"));
  q.scenarios[0].settings.discountMode = "automatic";
  q.scenarios[0].product.discountPct = 0;
  assert.equal(runSync(q).results[0].discountedOrders, 0);
  assert.ok(normal.results[0].purchases > 0);
});
test("money uses cents and gross total for configurable payment fees", () => {
  const q = request(1000),
    s = makeVariant(q.scenarios[0], "ideal"),
    p = profileFor(4, q.population, "bags");
  Object.assign(p, {
    relevance: "active",
    offlineOnly: false,
    budget: 100000,
    preferredPayment: "card",
    need: 1,
  });
  s.product.price = 99.99;
  s.settings.discountMode = "automatic";
  s.product.discountPct = 0.1;
  s.product.taxRate = 0.1;
  s.product.shipping = 8;
  s.product.shippingCost = 5;
  s.product.unitCost = 20;
  s.product.paymentFeeRate = 0.03;
  s.product.paymentFeeFixed = 0.3;
  s.steps = [
    {
      id: "review",
      name: "Review",
      type: "review",
      fields: 0,
      seconds: 0,
      errorRate: 0,
      clarity: 1,
    },
  ];
  let o;
  for (let id = 0; id < 500; id++) {
    p.id = id;
    o = evaluate(p, s, q.population, {
      ad: 20,
      page: 20,
      cart: 20,
      checkout: 20,
      provenance: "authored",
    });
    if (o.bought) break;
  }
  assert.ok(o?.bought);
  assert.equal(o.revenue, 97.99);
  assert.equal(o.contribution, 69.46);
  s.product.freeShippingThreshold = 89.99;
  const free = evaluate(p, s, q.population, {
    ad: 20,
    page: 20,
    cart: 20,
    checkout: 20,
    provenance: "authored",
  });
  assert.equal(free.revenue, 89.99);
});
test("calibration rejects impossible targets and recovers an attainable baseline", async () => {
  const q = request(100000),
    target = counts(runSync(q).results[0]);
  assert.ok(target.purchases > 0);
  const co = await calibrate(q, target);
  coefficientsSchema.parse(co);
  for (const key of ["clicks", "carts", "checkout", "purchases"] as const)
    assert.ok(Math.abs(co.calibration!.achieved[key] - target[key]) <= 4);
  const impossible = request(1000);
  impossible.population.excludedShare = 1;
  await assert.rejects(
    calibrate(impossible, {
      exposed: 10000,
      clicks: 1000,
      carts: 500,
      checkout: 400,
      purchases: 200,
    }),
    /outside|no consumers/,
  );
});
test("calibration detects input changes and fits long copy within the schema", () => {
  const q = request();
  q.scenarios[0].product.description = "a".repeat(8000);
  q.scenarios[0].acquisition.body = "b".repeat(15000);
  const a = calibrationSignature(q.population, q.scenarios[0]);
  assert.equal(a.length, 16);
  q.scenarios[0].product.price += 1;
  assert.notEqual(a, calibrationSignature(q.population, q.scenarios[0]));
});
test("request and saved artifact validation reject invalid or contradictory values", () => {
  const q = request(1000);
  assert.throws(() =>
    runRequestSchema.parse({
      ...q,
      population: { ...q.population, size: MAX_POPULATION + 1 },
    }),
  );
  assert.throws(() => runRequestSchema.parse({ ...q, id: "" }));
  assert.throws(() =>
    runRequestSchema.parse({
      ...q,
      coefficients: { ...q.coefficients, ad: NaN },
    }),
  );
  assert.throws(() =>
    runRequestSchema.parse({
      ...q,
      scenarios: [q.scenarios[0], q.scenarios[0]],
    }),
  );
  const r = runSync(q);
  r.results[0].reasons.purchased = 999;
  assert.throws(() => parseRun(r));
});
test("public URL policy rejects local destinations and signed credentials", () => {
  for (const url of [
    "http://store.com",
    "https://127.0.0.1/",
    "https://[::1]/",
    "https://store.internal./",
    "https://store.com/?signature=abc",
    "https://a:b@store.com",
    "https://store.com/?api_key=x",
    "file:///etc/passwd",
  ])
    assert.throws(() => publicPageUrl(url));
  assert.equal(
    publicPageUrl("https://example.com/product?variant=123#details").href,
    "https://example.com/product?variant=123",
  );
});
test("uploaded HTML is inert text with form labels, without executable or hidden templates", () => {
  const text = htmlText(
    '<h1>Useful bag</h1><script>fetch("https://bad.example")</script><style>hidden</style><template>not rendered</template><p>Price &amp; shipping</p><input required name="email"><img alt="Front view" src="https://never-fetched.invalid/x">',
  );
  assert.ok(text.includes("Useful bag"));
  assert.ok(text.includes("Price & shipping"));
  assert.ok(text.includes("required"));
  assert.ok(text.includes("Front view"));
  assert.ok(
    !text.includes("fetch") &&
      !text.includes("hidden") &&
      !text.includes("not rendered"),
  );
});
