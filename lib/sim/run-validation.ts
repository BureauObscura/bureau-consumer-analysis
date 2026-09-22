import { z } from "zod";
import { runRequestSchema } from "./validation";
import { MAX_POPULATION, REASONS, type RunResult } from "./types";
const n = z.number().int().nonnegative().max(MAX_POPULATION),
  money = z.number().finite();
const funnel = z.object({
  exposed: n,
  clicks: n,
  carts: n,
  checkout: n,
  purchases: n,
});
const segment = funnel.extend({
  label: z.string().max(100),
  revenue: money,
  contribution: money,
});
const reasonCounts = z.object(
  Object.fromEntries(REASONS.map((reason) => [reason, n])) as Record<
    (typeof REASONS)[number],
    typeof n
  >,
);
const result = funnel.extend({
  scenarioId: z.string().max(100),
  scenarioName: z.string().max(150),
  relevant: n,
  activeNeed: n,
  shoppingClicks: n,
  nonshoppingClicks: n,
  informationSought: n,
  informationRecovered: n,
  couponSought: n,
  couponFound: n,
  discountedOrders: n,
  revenue: money,
  contribution: money,
  adSpend: money.nonnegative(),
  reasons: z.object(
    Object.fromEntries(REASONS.map((r) => [r, n])) as Record<
      (typeof REASONS)[number],
      typeof n
    >,
  ),
  steps: z
    .array(
      z.object({
        id: z.string().max(100),
        name: z.string().max(150),
        reached: n,
        completed: n,
      }),
    )
    .max(12),
  segments: z.object({
    relevance: z.array(segment).length(3),
    budget: z.array(segment).length(4),
    device: z.array(segment).length(2),
    motivation: z.array(segment).length(4),
  }),
  samples: z.record(z.array(n).max(16)),
  losses: z.object({
    ad: reasonCounts,
    pdp: reasonCounts,
    cart: reasonCounts,
    checkout: reasonCounts,
  }),
});
export const runResultSchema = z
  .object({
    id: z.string().min(1).max(100),
    version: z.string().max(40),
    createdAt: z.string().datetime(),
    elapsedMs: z.number().finite().nonnegative(),
    processed: n,
    planned: n.positive(),
    startId: n,
    status: z.enum(["complete", "partial"]),
    population: runRequestSchema.innerType().shape.population,
    coefficients: runRequestSchema.innerType().shape.coefficients,
    scenarios: runRequestSchema.innerType().shape.scenarios,
    results: z.array(result).min(1).max(8),
    comparisons: z
      .array(
        z.object({
          scenarioId: z.string().max(100),
          bothBuy: n,
          baselineOnly: n,
          variantOnly: n,
          neither: n,
          deltaRate: z.number().min(-1).max(1),
          monteCarloSE: z.number().min(0).max(1),
        }),
      )
      .max(7),
  })
  .superRefine((r, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const nested = (v: z.infer<typeof funnel>) =>
      v.exposed >= v.clicks &&
      v.clicks >= v.carts &&
      v.carts >= v.checkout &&
      v.checkout >= v.purchases;
    if (
      r.processed > r.planned ||
      r.startId + r.planned > r.population.size ||
      (r.status === "complete" && r.processed !== r.planned)
    )
      fail("Run population counts are inconsistent.");
    if (
      r.results.length !== r.scenarios.length ||
      r.comparisons.length !== r.scenarios.length - 1
    )
      fail("Run scenarios do not match results.");
    r.results.forEach((v, i) => {
      if (
        v.scenarioId !== r.scenarios[i]?.id ||
        v.exposed !== r.processed ||
        !nested(v) ||
        Object.values(v.reasons).reduce((a, b) => a + b, 0) !== v.exposed ||
        v.shoppingClicks + v.nonshoppingClicks !== v.clicks
      )
        fail("Run funnel counts are inconsistent.");
      if (
        v.reasons.purchased !== v.purchases ||
        v.discountedOrders > v.purchases ||
        v.informationRecovered > v.informationSought ||
        v.couponFound > v.couponSought ||
        v.steps.length !== r.scenarios[i]?.steps.length ||
        v.steps.some(
          (st, j) =>
            st.id !== r.scenarios[i]?.steps[j]?.id ||
            st.completed > st.reached ||
            st.reached > (j ? v.steps[j - 1].completed : v.checkout),
        )
      )
        fail("Run outcome totals are inconsistent.");
      for (const [stage, total] of [
        ["ad", v.exposed - v.clicks],
        ["pdp", v.clicks - v.carts],
        ["cart", v.carts - v.checkout],
        ["checkout", v.checkout - v.purchases],
      ] as const)
        if (Object.values(v.losses[stage]).reduce((a, b) => a + b, 0) !== total)
          fail("Stage loss counts are inconsistent.");
      if (
        Object.values(v.samples).some((ids) =>
          ids.some((id) => id < r.startId || id >= r.startId + r.processed),
        )
      )
        fail("Example IDs fall outside the processed range.");
      for (const group of Object.values(v.segments)) {
        for (const key of [
          "exposed",
          "clicks",
          "carts",
          "checkout",
          "purchases",
        ] as const)
          if (group.reduce((a, b) => a + b[key], 0) !== v[key])
            fail("Segment funnel totals are inconsistent.");
        if (
          group.reduce((a, b) => a + b.exposed, 0) !== v.exposed ||
          group.some((x) => !nested(x))
        )
          fail("Segment totals are inconsistent.");
      }
    });
    r.comparisons.forEach((c, i) => {
      if (
        c.scenarioId !== r.scenarios[i + 1]?.id ||
        c.bothBuy + c.baselineOnly + c.variantOnly + c.neither !==
          r.processed ||
        c.bothBuy + c.baselineOnly !== r.results[0]?.purchases ||
        c.bothBuy + c.variantOnly !== r.results[i + 1]?.purchases
      )
        fail("Paired counts are inconsistent.");
    });
  });
export const parseRun = (value: unknown): RunResult =>
  runResultSchema.parse(value) as RunResult;
