import type {
  Category,
  Coefficients,
  FeatureKey,
  PopulationConfig,
  Scenario,
  Stage,
  Reason,
} from "./types";
export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "home", label: "Home & living" },
  { value: "electronics", label: "Electronics" },
  { value: "apparel", label: "Clothing & footwear" },
  { value: "bags", label: "Bags & accessories" },
  { value: "beauty", label: "Beauty & personal care" },
  { value: "food", label: "Food & beverage" },
  { value: "fitness", label: "Fitness & outdoors" },
  { value: "pets", label: "Pet supplies" },
  { value: "hobby", label: "Hobbies & entertainment" },
  { value: "other", label: "Other consumer goods" },
];
export const FEATURE_FIELDS: {
  key: FeatureKey;
  stage: Stage;
  label: string;
  low: string;
  high: string;
}[] = [
  {
    key: "adClarity",
    stage: "ad",
    label: "Message clarity",
    low: "Product or benefit unclear",
    high: "Product and benefit explicit",
  },
  {
    key: "adAttention",
    stage: "ad",
    label: "Attention",
    low: "Easy to overlook",
    high: "Strong visual focal point",
  },
  {
    key: "adCredibility",
    stage: "ad",
    label: "Claim credibility",
    low: "Unsupported claims",
    high: "Specific, credible claims",
  },
  {
    key: "adBenefit",
    stage: "ad",
    label: "Benefit communication",
    low: "No clear use case",
    high: "Concrete useful outcome",
  },
  {
    key: "adOffer",
    stage: "ad",
    label: "Offer visibility",
    low: "Terms obscured",
    high: "Offer and conditions clear",
  },
  {
    key: "adQueryMatch",
    stage: "ad",
    label: "Search-query match",
    low: "Query and offer differ",
    high: "Offer directly answers the query",
  },
  {
    key: "pageMatch",
    stage: "pdp",
    label: "Ad-to-page consistency",
    low: "Different promise or product",
    high: "Same product and promise",
  },
  {
    key: "pageClarity",
    stage: "pdp",
    label: "Product clarity",
    low: "Offer hard to understand",
    high: "Product and options clear",
  },
  {
    key: "pageInformation",
    stage: "pdp",
    label: "Product information",
    low: "Key questions unanswered",
    high: "Category questions answered",
  },
  {
    key: "pageAnswerAccess",
    stage: "pdp",
    label: "Find product answers",
    low: "Answers hard to reach",
    high: "Answers easy to locate",
  },
  {
    key: "pageProof",
    stage: "pdp",
    label: "Useful supporting evidence",
    low: "No specific evidence",
    high: "Relevant reviews and demonstrations",
  },
  {
    key: "pageTrust",
    stage: "pdp",
    label: "Merchant reassurance",
    low: "Merchant and terms unclear",
    high: "Merchant and policies clear",
  },
  {
    key: "pageUsability",
    stage: "pdp",
    label: "Page usability",
    low: "Difficult to find and choose",
    high: "Clear options and purchase action",
  },
  {
    key: "cartClarity",
    stage: "cart",
    label: "Cart clarity",
    low: "Totals and next step unclear",
    high: "Totals and next step explicit",
  },
  {
    key: "informationAccess",
    stage: "cart",
    label: "Access to more information",
    low: "Answers difficult to find",
    high: "Questions answered without losing cart",
  },
  {
    key: "couponProminence",
    stage: "cart",
    label: "Coupon-field prominence",
    low: "Low emphasis",
    high: "Strong prompt to look for a code",
  },
  {
    key: "upsellPressure",
    stage: "cart",
    label: "Upsell interruption",
    low: "No interruption",
    high: "Repeated competing offers",
  },
];
export const DEFAULT_POPULATION: PopulationConfig = {
  size: 10_000_000,
  seed: 20260912,
  excludedShare: 0.55,
  activeNeedShare: 0.25,
  offlineOnlyShare: 0.06,
  medianBudget: 95,
  mobileShare: 0.8,
  familiarShare: 0.08,
  deliberation: 0.5,
  priceSensitivity: 1,
  distrust: 0.5,
};
export const DEFAULT_COEFFICIENTS: Coefficients = {
  ad: -4.1,
  page: -1.7,
  cart: 1.1,
  checkout: 1.6,
  provenance: "authored",
};
export function defaultScenario(): Scenario {
  return {
    id: "baseline",
    name: "Current journey",
    product: {
      name: "Everyday carry backpack",
      category: "bags",
      description:
        "A lightweight everyday backpack with a padded laptop compartment, weather-resistant fabric, and a repairable design.",
      price: 89,
      unitCost: 27,
      shipping: 8,
      shippingCost: 8,
      taxRate: 0.07,
      deliveryDays: 5,
      returnDays: 30,
      stock: "available",
      freeShippingThreshold: 0,
      paymentFeeRate: 0.029,
      paymentFeeFixed: 0.3,
      discountPct: 0.1,
      appeal: "practical",
    },
    pageCopy:
      "A lightweight everyday backpack with a padded laptop compartment, weather-resistant fabric, and a repairable design. 18 liter capacity. Fits a 15 inch laptop. Two exterior pockets. 30 day returns.",
    acquisition: {
      platform: "instagram",
      headline: "An everyday bag that does more.",
      body: "Weather-resistant. Laptop-ready. Built to be repaired. Meet your new everyday carry.",
      cta: "Shop now",
      searchQuery: "everyday laptop backpack",
      searchIntent: 0.65,
    },
    features: {
      adClarity: 0.68,
      adAttention: 0.7,
      adCredibility: 0.65,
      adBenefit: 0.65,
      adOffer: 0.55,
      adQueryMatch: 0.7,
      pageMatch: 0.78,
      pageClarity: 0.7,
      pageInformation: 0.52,
      pageAnswerAccess: 0.58,
      pageProof: 0.45,
      pageTrust: 0.62,
      pageUsability: 0.72,
      cartClarity: 0.75,
      informationAccess: 0.58,
      couponProminence: 0.65,
      upsellPressure: 0.2,
    },
    settings: {
      priceInAd: false,
      shippingDisclosure: "checkout",
      discountMode: "coupon",
      couponSuccess: 0.55,
      guestCheckout: false,
      wallets: false,
      paypal: true,
      bnpl: false,
      mobileOptimized: true,
      financingVisibleOnPage: false,
      pageLoadSeconds: 3.2,
      returnPolicyVisible: false,
      adFrequency: 1,
      cpm: 12,
    },
    steps: [
      {
        id: "contact",
        name: "Contact details",
        type: "contact",
        fields: 4,
        seconds: 8,
        errorRate: 0.01,
        clarity: 0.8,
      },
      {
        id: "address",
        name: "Delivery address",
        type: "address",
        fields: 7,
        seconds: 12,
        errorRate: 0.03,
        clarity: 0.75,
      },
      {
        id: "shipping",
        name: "Shipping method",
        type: "shipping",
        fields: 1,
        seconds: 4,
        errorRate: 0.01,
        clarity: 0.8,
      },
      {
        id: "payment",
        name: "Payment",
        type: "payment",
        fields: 5,
        seconds: 10,
        errorRate: 0.02,
        clarity: 0.8,
      },
      {
        id: "review",
        name: "Review order",
        type: "review",
        fields: 0,
        seconds: 3,
        errorRate: 0.005,
        clarity: 0.85,
      },
    ],
    sources: [],
    analyses: [],
    featureBasis: {},
  };
}
export const REASON_LABELS: Record<Reason, string> = {
  no_interest: "No product interest",
  no_attention: "Ad did not earn attention",
  low_relevance: "Weak benefit relevance",
  low_credibility: "Ad claim skepticism",
  price: "Price or budget",
  no_current_need: "No current purchase need",
  incumbent: "Satisfied with an alternative",
  offline_only: "Will not buy through this channel",
  information: "Unanswered product questions",
  trust: "Insufficient reassurance",
  page_friction: "Page usability or waiting",
  promise_mismatch: "Ad and page mismatch",
  shipping: "Shipping cost or surprise",
  delivery: "Delivery does not fit need",
  discount_search: "Left to seek a discount",
  cart_friction: "Cart interruption or confusion",
  account_required: "Account requirement",
  payment: "Preferred payment unavailable",
  form_friction: "Checkout effort",
  technical_error: "Simulated technical failure",
  deferred: "Deferred for other modeled reasons",
  out_of_stock: "Product unavailable",
  purchased: "Purchased",
};
export const EXPERIMENTS = [
  {
    id: "free-shipping",
    name: "Free shipping",
    description:
      "Remove the customer shipping charge; retain fulfillment cost.",
  },
  {
    id: "guest",
    name: "Guest checkout + wallets",
    description: "Remove mandatory account creation and offer express wallets.",
  },
  {
    id: "information",
    name: "Resolve product questions",
    description:
      "Improve product information, proof, policy visibility, and answer access.",
  },
  {
    id: "checkout",
    name: "Simpler checkout",
    description: "Reduce required fields, waiting, and modeled error rates.",
  },
  {
    id: "discount",
    name: "Automatic 10% discount",
    description: "Apply a discount without requiring a coupon search.",
  },
  {
    id: "clarity",
    name: "Clearer ad + matching page",
    description:
      "Clarify the benefit and maintain that promise on the product page.",
  },
  {
    id: "attention",
    name: "More attention only",
    description:
      "Increase visual attention while leaving the offer and journey unchanged.",
  },
  {
    id: "ideal",
    name: "High clarity + low friction",
    description:
      "High clarity and information, visible terms, guest checkout, and low friction at the same price.",
  },
] as const;
export function makeVariant(base: Scenario, id: string): Scenario {
  const s = structuredClone(base);
  s.id = id;
  s.name = EXPERIMENTS.find((e) => e.id === id)?.name ?? "Alternative journey";
  if (id === "free-shipping") s.product.shipping = 0;
  if (id === "guest" || id === "ideal") {
    s.settings.guestCheckout = true;
    s.settings.wallets = true;
    s.settings.paypal = true;
  }
  if (id === "information" || id === "ideal") {
    s.features.pageInformation = 0.95;
    s.features.pageAnswerAccess = 0.95;
    s.features.pageProof = 0.9;
    s.features.informationAccess = 0.95;
    s.settings.returnPolicyVisible = true;
  }
  if (id === "checkout" || id === "ideal") {
    s.steps = s.steps.map((step) => ({
      ...step,
      fields: Math.ceil(step.fields * 0.55),
      seconds: step.seconds * 0.4,
      errorRate: step.errorRate * 0.2,
      clarity: 0.97,
    }));
  }
  if (id === "discount") {
    s.settings.discountMode = "automatic";
    s.product.discountPct = 0.1;
  }
  if (id === "clarity" || id === "ideal") {
    s.features.adClarity = 0.95;
    s.features.adBenefit = 0.95;
    s.features.pageMatch = 0.98;
    s.features.pageClarity = 0.95;
  }
  if (id === "attention") s.features.adAttention = 0.98;
  if (id === "ideal") {
    s.features.adCredibility = 0.95;
    s.features.pageTrust = 0.95;
    s.features.pageUsability = 0.98;
    s.features.cartClarity = 0.98;
    s.features.upsellPressure = 0;
    s.settings.shippingDisclosure = "pdp";
    s.settings.pageLoadSeconds = 0.8;
  }
  for (const field of FEATURE_FIELDS)
    if (s.features[field.key] !== base.features[field.key])
      s.featureBasis[field.key] = { kind: "manual" };
  return s;
}
