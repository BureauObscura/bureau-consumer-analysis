export const ENGINE_VERSION = "consumer-1.0.0";
export const MAX_POPULATION = 10_000_000;
export type Stage = "ad" | "pdp" | "cart" | "checkout";
export type Category =
  | "home"
  | "electronics"
  | "apparel"
  | "bags"
  | "beauty"
  | "food"
  | "fitness"
  | "pets"
  | "hobby"
  | "other";
export type FeatureKey =
  | "adClarity"
  | "adAttention"
  | "adCredibility"
  | "adBenefit"
  | "adOffer"
  | "adQueryMatch"
  | "pageMatch"
  | "pageClarity"
  | "pageInformation"
  | "pageAnswerAccess"
  | "pageProof"
  | "pageTrust"
  | "pageUsability"
  | "cartClarity"
  | "informationAccess"
  | "couponProminence"
  | "upsellPressure";
export type Features = Record<FeatureKey, number>;
export interface Source {
  id: string;
  stage: Stage;
  kind: "image" | "pdf" | "html" | "manual";
  name: string;
  url?: string;
  text?: string;
  originUrl?: string;
  hash: string;
  capturedAt: string;
  coverage: string;
  limitations: string[];
}
export interface Observation {
  feature: FeatureKey;
  value: number | null;
  basis: "observed" | "inferred" | "unknown";
  evidence: string;
  sourceId: string;
  confidence: "low" | "medium" | "high";
}
export interface Analysis {
  id: string;
  sourceId: string;
  observations: Observation[];
  summary: string;
  unknowns: string[];
  model: string;
  responseId: string;
  createdAt: string;
  context: Record<string, unknown>;
  contextHash: string;
  usage: Record<string, unknown> | null;
  costUsd: number | null;
  settings: {
    key: string;
    value: boolean | number | string | null;
    evidence: string;
  }[];
  checkoutSteps: {
    name: string;
    type: CheckoutStep["type"];
    fields: number | null;
    evidence: string;
  }[];
}
export interface CheckoutStep {
  id: string;
  name: string;
  type: "contact" | "address" | "shipping" | "payment" | "review" | "custom";
  fields: number;
  seconds: number;
  errorRate: number;
  clarity: number;
}
export interface Scenario {
  id: string;
  name: string;
  product: {
    name: string;
    category: Category;
    description: string;
    price: number;
    unitCost: number;
    shipping: number;
    shippingCost: number;
    taxRate: number;
    deliveryDays: number;
    returnDays: number;
    stock: "available" | "out";
    freeShippingThreshold: number;
    paymentFeeRate: number;
    paymentFeeFixed: number;
    discountPct: number;
    appeal: "practical" | "design" | "status" | "value";
  };
  pageCopy: string;
  acquisition: {
    platform: "instagram" | "facebook" | "tiktok" | "google_search";
    headline: string;
    body: string;
    cta: string;
    searchQuery: string;
    searchIntent: number;
  };
  features: Features;
  settings: {
    priceInAd: boolean;
    shippingDisclosure: "pdp" | "cart" | "checkout";
    discountMode: "none" | "automatic" | "coupon";
    couponSuccess: number;
    guestCheckout: boolean;
    wallets: boolean;
    paypal: boolean;
    bnpl: boolean;
    mobileOptimized: boolean;
    financingVisibleOnPage: boolean;
    pageLoadSeconds: number;
    returnPolicyVisible: boolean;
    adFrequency: number;
    cpm: number;
  };
  steps: CheckoutStep[];
  sources: Source[];
  analyses: Analysis[];
  featureBasis: Partial<
    Record<
      FeatureKey,
      { kind: "manual" | "analysis"; analysisId?: string; sourceId?: string }
    >
  >;
}
export interface PopulationConfig {
  size: number;
  seed: number;
  excludedShare: number;
  activeNeedShare: number;
  offlineOnlyShare: number;
  medianBudget: number;
  mobileShare: number;
  familiarShare: number;
  deliberation: number;
  priceSensitivity: number;
  distrust: number;
}
export interface Coefficients {
  ad: number;
  page: number;
  cart: number;
  checkout: number;
  provenance: "authored" | "fitted";
  calibration?: {
    population: number;
    baselineId: string;
    fittedAt: string;
    observed: FunnelCounts;
    achieved: FunnelCounts;
    seed: number;
    signature: string;
  };
}
export interface FunnelCounts {
  exposed: number;
  clicks: number;
  carts: number;
  checkout: number;
  purchases: number;
}
export type Reason =
  | "no_interest"
  | "no_attention"
  | "low_relevance"
  | "low_credibility"
  | "price"
  | "no_current_need"
  | "incumbent"
  | "offline_only"
  | "information"
  | "trust"
  | "page_friction"
  | "promise_mismatch"
  | "shipping"
  | "delivery"
  | "discount_search"
  | "cart_friction"
  | "account_required"
  | "payment"
  | "form_friction"
  | "technical_error"
  | "deferred"
  | "out_of_stock"
  | "purchased";
export const REASONS: Reason[] = [
  "no_interest",
  "no_attention",
  "low_relevance",
  "low_credibility",
  "price",
  "no_current_need",
  "incumbent",
  "offline_only",
  "information",
  "trust",
  "page_friction",
  "promise_mismatch",
  "shipping",
  "delivery",
  "discount_search",
  "cart_friction",
  "account_required",
  "payment",
  "form_friction",
  "technical_error",
  "deferred",
  "out_of_stock",
  "purchased",
];
export interface Profile {
  id: number;
  relevance: "excluded" | "dormant" | "active";
  offlineOnly: boolean;
  budget: number;
  affinity: number;
  need: number;
  priceSensitivity: number;
  dealSeeking: number;
  trustNeed: number;
  informationNeed: number;
  familiarity: number;
  incumbent: number;
  novelty: number;
  urgency: number;
  attention: number;
  patience: number;
  privacyNeed: number;
  socialProofNeed: number;
  mobile: boolean;
  preferredPayment: "card" | "wallet" | "paypal" | "bnpl";
  appeal: "practical" | "design" | "status" | "value";
}
export interface TraceEvent {
  stage: string;
  action: string;
  probability: number | null;
  draw: number | null;
  factors: { label: string; value: number }[];
  detail: string;
}
export interface Outcome {
  clicked: boolean;
  shoppingClick: boolean;
  cart: boolean;
  checkout: boolean;
  bought: boolean;
  reason: Reason;
  informationSought: boolean;
  informationRecovered: boolean;
  couponSought: boolean;
  couponFound: boolean;
  discountApplied: boolean;
  stepsReached: number;
  stepsCompleted: number;
  revenue: number;
  contribution: number;
}
export interface ConsumerTrace {
  profile: Profile;
  outcome: Outcome;
  events: TraceEvent[];
}
export interface SegmentResult extends FunnelCounts {
  label: string;
  revenue: number;
  contribution: number;
}
export interface SimulationResult extends FunnelCounts {
  scenarioId: string;
  scenarioName: string;
  relevant: number;
  activeNeed: number;
  shoppingClicks: number;
  nonshoppingClicks: number;
  informationSought: number;
  informationRecovered: number;
  couponSought: number;
  couponFound: number;
  discountedOrders: number;
  revenue: number;
  contribution: number;
  adSpend: number;
  reasons: Record<Reason, number>;
  steps: { id: string; name: string; reached: number; completed: number }[];
  segments: {
    relevance: SegmentResult[];
    budget: SegmentResult[];
    device: SegmentResult[];
    motivation: SegmentResult[];
  };
  samples: Record<string, number[]>;
  losses: Record<Stage, Record<Reason, number>>;
}
export interface Comparison {
  scenarioId: string;
  bothBuy: number;
  baselineOnly: number;
  variantOnly: number;
  neither: number;
  deltaRate: number;
  monteCarloSE: number;
}
export interface RunRequest {
  id: string;
  population: PopulationConfig;
  scenarios: Scenario[];
  coefficients: Coefficients;
  startId?: number;
  count?: number;
}
export interface RunResult {
  id: string;
  version: string;
  createdAt: string;
  elapsedMs: number;
  processed: number;
  planned: number;
  startId: number;
  status: "complete" | "partial";
  population: PopulationConfig;
  coefficients: Coefficients;
  scenarios: Scenario[];
  results: SimulationResult[];
  comparisons: Comparison[];
}
export type WorkerMessage =
  | { type: "run"; request: RunRequest }
  | { type: "calibrate"; request: RunRequest; observed: FunnelCounts }
  | {
      type: "trace";
      id: string;
      consumerId: number;
      scenario: Scenario;
      population: PopulationConfig;
      coefficients: Coefficients;
    };
export type WorkerResponse =
  | {
      type: "progress";
      id: string;
      result: Omit<RunResult, "population" | "scenarios" | "coefficients">;
    }
  | { type: "complete"; id: string; result: RunResult }
  | { type: "calibrated"; id: string; coefficients: Coefficients }
  | { type: "trace"; id: string; trace: ConsumerTrace }
  | { type: "error"; id: string; message: string };
