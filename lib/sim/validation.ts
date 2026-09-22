import { z } from "zod";
import { FEATURE_FIELDS } from "./defaults";
import { MAX_POPULATION } from "./types";
const ratio = z.number().min(0).max(1);
const features = z.object(
  Object.fromEntries(FEATURE_FIELDS.map((f) => [f.key, ratio])) as Record<
    (typeof FEATURE_FIELDS)[number]["key"],
    typeof ratio
  >,
);
export const populationSchema = z.object({
  size: z.number().int().min(1000).max(MAX_POPULATION),
  seed: z.number().int().min(0).max(4294967295),
  excludedShare: ratio,
  activeNeedShare: ratio,
  offlineOnlyShare: ratio,
  medianBudget: z.number().min(1).max(100_000),
  mobileShare: ratio,
  familiarShare: ratio,
  deliberation: ratio,
  priceSensitivity: z.number().min(0.1).max(5),
  distrust: ratio,
});
export const sourceSchema = z.object({
  id: z.string().max(100),
  stage: z.enum(["ad", "pdp", "cart", "checkout"]),
  kind: z.enum(["image", "pdf", "html", "manual"]),
  name: z.string().max(200),
  url: z
    .string()
    .max(2000)
    .regex(/^\/api\/sim\/sources\/[a-zA-Z0-9-]+\/file$/)
    .optional(),
  text: z.string().max(50000).optional(),
  originUrl: z.string().max(2000).optional(),
  hash: z.string().max(100),
  capturedAt: z.string().max(60),
  coverage: z.string().max(100),
  limitations: z.array(z.string().max(500)).max(20),
});
export const analysisSchema = z.object({
  id: z.string().max(100),
  sourceId: z.string().max(100),
  observations: z
    .array(
      z.object({
        feature: z.enum(
          FEATURE_FIELDS.map((f) => f.key) as [
            (typeof FEATURE_FIELDS)[number]["key"],
            ...(typeof FEATURE_FIELDS)[number]["key"][],
          ],
        ),
        value: ratio.nullable(),
        basis: z.enum(["observed", "inferred", "unknown"]),
        evidence: z.string().max(1000),
        sourceId: z.string().max(100),
        confidence: z.enum(["low", "medium", "high"]),
      }),
    )
    .max(20),
  summary: z.string().max(2500),
  unknowns: z.array(z.string().max(500)).max(30),
  model: z.string().max(100),
  responseId: z.string().max(200),
  createdAt: z.string().max(60),
  usage: z.record(z.unknown()).nullable(),
  costUsd: z.number().nonnegative().nullable(),
  context: z.record(z.unknown()),
  contextHash: z.string().max(100),
  settings: z
    .array(
      z.object({
        key: z.string().max(60),
        value: z
          .union([z.boolean(), z.number().finite(), z.string().max(100)])
          .nullable(),
        evidence: z.string().max(1000),
      }),
    )
    .max(30),
  checkoutSteps: z
    .array(
      z.object({
        name: z.string().min(1).max(150),
        type: z.enum([
          "contact",
          "address",
          "shipping",
          "payment",
          "review",
          "custom",
        ]),
        fields: z.number().int().min(0).max(50).nullable(),
        evidence: z.string().max(1000),
      }),
    )
    .max(12),
});
export const scenarioSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(150),
  product: z.object({
    name: z.string().min(1).max(200),
    category: z.enum([
      "home",
      "electronics",
      "apparel",
      "bags",
      "beauty",
      "food",
      "fitness",
      "pets",
      "hobby",
      "other",
    ]),
    description: z.string().max(8000),
    price: z.number().min(0.01).max(100000),
    unitCost: z.number().min(0).max(100000),
    shipping: z.number().min(0).max(10000),
    shippingCost: z.number().min(0).max(10000),
    taxRate: ratio,
    deliveryDays: z.number().min(0).max(365),
    returnDays: z.number().min(0).max(365),
    stock: z.enum(["available", "out"]),
    freeShippingThreshold: z.number().min(0).max(100000),
    paymentFeeRate: ratio,
    paymentFeeFixed: z.number().min(0).max(100),
    discountPct: z.number().min(0).max(0.95),
    appeal: z.enum(["practical", "design", "status", "value"]),
  }),
  pageCopy: z.string().max(50000),
  acquisition: z.object({
    platform: z.enum(["instagram", "facebook", "tiktok", "google_search"]),
    headline: z.string().max(1000),
    body: z.string().max(15000),
    cta: z.string().max(200),
    searchQuery: z.string().max(1000),
    searchIntent: ratio,
  }),
  features,
  settings: z.object({
    priceInAd: z.boolean(),
    shippingDisclosure: z.enum(["pdp", "cart", "checkout"]),
    discountMode: z.enum(["none", "automatic", "coupon"]),
    couponSuccess: ratio,
    guestCheckout: z.boolean(),
    wallets: z.boolean(),
    paypal: z.boolean(),
    bnpl: z.boolean(),
    mobileOptimized: z.boolean(),
    financingVisibleOnPage: z.boolean(),
    pageLoadSeconds: z.number().min(0).max(120),
    returnPolicyVisible: z.boolean(),
    adFrequency: z.number().int().min(1).max(30),
    cpm: z.number().min(0).max(10000),
  }),
  steps: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        name: z.string().min(1).max(150),
        type: z.enum([
          "contact",
          "address",
          "shipping",
          "payment",
          "review",
          "custom",
        ]),
        fields: z.number().int().min(0).max(50),
        seconds: z.number().min(0).max(300),
        errorRate: ratio,
        clarity: ratio,
      }),
    )
    .min(1)
    .max(12)
    .refine(
      (s) => new Set(s.map((v) => v.id)).size === s.length,
      "Checkout step IDs must be unique.",
    ),
  sources: z.array(sourceSchema).max(20),
  analyses: z.array(analysisSchema).max(50),
  featureBasis: z.record(
    z.object({
      kind: z.enum(["manual", "analysis"]),
      analysisId: z.string().max(100).optional(),
      sourceId: z.string().max(100).optional(),
    }),
  ),
});
export const coefficientsSchema = z.object({
  ad: z.number().min(-20).max(20),
  page: z.number().min(-20).max(20),
  cart: z.number().min(-20).max(20),
  checkout: z.number().min(-20).max(20),
  provenance: z.enum(["authored", "fitted"]),
  calibration: z
    .object({
      population: z.number(),
      baselineId: z.string(),
      fittedAt: z.string(),
      observed: z.object({
        exposed: z.number(),
        clicks: z.number(),
        carts: z.number(),
        checkout: z.number(),
        purchases: z.number(),
      }),
      achieved: z.object({
        exposed: z.number(),
        clicks: z.number(),
        carts: z.number(),
        checkout: z.number(),
        purchases: z.number(),
      }),
      seed: z.number(),
      signature: z.string().max(20000),
    })
    .optional(),
});
export const runRequestSchema = z
  .object({
    id: z.string().min(1).max(100),
    population: populationSchema,
    scenarios: z.array(scenarioSchema).min(1).max(8),
    coefficients: coefficientsSchema,
    startId: z.number().int().nonnegative().optional(),
    count: z.number().int().min(1).max(MAX_POPULATION).optional(),
  })
  .superRefine((r, ctx) => {
    if (new Set(r.scenarios.map((s) => s.id)).size !== r.scenarios.length)
      ctx.addIssue({ code: "custom", message: "Scenario IDs must be unique." });
    if (
      r.scenarios.some(
        (s) => s.product.category !== r.scenarios[0].product.category,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Paired comparisons must use the same category.",
      });
    if ((r.startId ?? 0) + (r.count ?? r.population.size) > r.population.size)
      ctx.addIssue({
        code: "custom",
        message: "Requested consumer IDs exceed the population.",
      });
  });
export function validCounts(c: {
  exposed: number;
  clicks: number;
  carts: number;
  checkout: number;
  purchases: number;
}) {
  const a = [c.exposed, c.clicks, c.carts, c.checkout, c.purchases];
  return a.every(
    (x, i) =>
      Number.isFinite(x) &&
      Number.isInteger(x) &&
      x > 0 &&
      (i === 0 || x <= a[i - 1]),
  );
}
