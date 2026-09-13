import { calibrationSignature } from "./signature";
import { CATEGORIES } from "./defaults";
import { clamp, draws, sigmoid, unit } from "./random";
import {
  ENGINE_VERSION,
  REASONS,
  type Coefficients,
  type ConsumerTrace,
  type FunnelCounts,
  type Outcome,
  type PopulationConfig,
  type Profile,
  type Reason,
  type RunRequest,
  type RunResult,
  type Scenario,
  type SegmentResult,
  type SimulationResult,
  type TraceEvent,
} from "./types";

const scratch = () => new Uint32Array(4);
/** Continuous traits are correlated through shared latent inputs, not copied personas. */
export function profileFor(
  id: number,
  pop: PopulationConfig,
  category: string,
  out: Uint32Array = scratch(),
): Profile {
  draws(id, 0, 0, pop.seed, out);
  const resources = unit(out[0]),
    risk = unit(out[1]),
    deliberation = unit(out[2]),
    novelty = unit(out[3]);
  draws(id, 1, 0, pop.seed, out);
  const attention = unit(out[0]),
    deal = unit(out[1]),
    context = unit(out[2]),
    residual = unit(out[3]);
  draws(id, 2, 0, pop.seed, out);
  const budgetNoise = unit(out[0]),
    urgency = unit(out[1]),
    incumbent = unit(out[2]),
    payment = unit(out[3]);
  draws(id, 3, 0, pop.seed, out);
  const mobile = unit(out[0]) < pop.mobileShare,
    familiar = unit(out[1]) < pop.familiarShare,
    privacy = unit(out[2]),
    appeal = unit(out[3]);
  draws(
    id,
    CATEGORIES.findIndex((c) => c.value === category) + 1,
    5,
    pop.seed,
    out,
  );
  const relevanceDraw = unit(out[0]),
    needDraw = unit(out[1]),
    affinity = unit(out[2]),
    channel = unit(out[3]);
  const relevance =
    relevanceDraw < pop.excludedShare
      ? "excluded"
      : needDraw < pop.activeNeedShare
        ? "active"
        : "dormant";
  const resourceFactor =
    Math.sqrt(-2 * Math.log(resources)) * Math.cos(2 * Math.PI * budgetNoise);
  const resourceLevel = sigmoid(resourceFactor);
  const budget = pop.medianBudget * Math.exp(0.85 * resourceFactor);
  return {
    id,
    relevance,
    offlineOnly: channel < pop.offlineOnlyShare,
    budget: Math.max(3, budget),
    affinity,
    need:
      relevance === "active"
        ? 0.6 + 0.4 * needDraw
        : relevance === "excluded"
          ? 0
          : 0.06 + 0.3 * needDraw,
    priceSensitivity:
      pop.priceSensitivity *
      (0.55 + 0.6 * (1 - resourceLevel) + 0.45 * deliberation),
    dealSeeking: clamp(0.7 * deal + 0.2 * (1 - resourceLevel) + 0.1 * residual),
    trustNeed: clamp(
      0.65 * risk +
        0.2 * deliberation +
        0.15 * residual +
        (pop.distrust - 0.5) * 0.5,
    ),
    informationNeed: clamp(
      0.6 * deliberation +
        0.25 * risk +
        0.15 * residual +
        (pop.deliberation - 0.5) * 0.5,
    ),
    familiarity: familiar ? 0.65 + 0.35 * residual : 0.1 * residual,
    incumbent,
    novelty,
    urgency: clamp(
      0.65 * urgency + 0.35 * (relevance === "active" ? needDraw : 0.1),
    ),
    attention,
    patience: clamp(
      0.2 + 0.45 * deliberation + 0.35 * context - 0.15 * urgency,
    ),
    privacyNeed: clamp(0.65 * privacy + 0.35 * risk),
    socialProofNeed: clamp(0.55 * risk + 0.25 * deliberation + 0.2 * context),
    mobile,
    preferredPayment:
      payment < 0.47
        ? "card"
        : payment < 0.77
          ? "wallet"
          : payment < 0.93
            ? "paypal"
            : "bnpl",
    appeal:
      appeal < 0.4
        ? "practical"
        : appeal < 0.65
          ? "design"
          : appeal < 0.8
            ? "status"
            : "value",
  };
}
function primary(
  factors: { reason: Reason; value: number }[],
  fallback: Reason,
): Reason {
  let chosen = fallback,
    min = -0.35;
  for (const f of factors)
    if (f.value < min) {
      min = f.value;
      chosen = f.reason;
    }
  return chosen;
}
function event(
  events: TraceEvent[] | undefined,
  stage: string,
  action: string,
  p: number | null,
  draw: number | null,
  factors: { label: string; value: number }[],
  detail: string,
) {
  if (events)
    events.push({ stage, action, probability: p, draw, factors, detail });
}
const emptyOutcome = (): Outcome => ({
  clicked: false,
  shoppingClick: false,
  cart: false,
  checkout: false,
  bought: false,
  reason: "no_attention",
  informationSought: false,
  informationRecovered: false,
  couponSought: false,
  couponFound: false,
  discountApplied: false,
  stepsReached: 0,
  stepsCompleted: 0,
  revenue: 0,
  contribution: 0,
});

export function evaluate(
  profile: Profile,
  scenario: Scenario,
  pop: PopulationConfig,
  co: Coefficients,
  events?: TraceEvent[],
  out: Uint32Array = scratch(),
): Outcome {
  const p = profile,
    s = scenario,
    f = s.features,
    settings = s.settings,
    product = s.product,
    o = emptyOutcome();
  const appealMatch = p.appeal === product.appeal ? 1 : 0.3 + 0.35 * p.novelty;
  const automatic = settings.discountMode === "automatic";
  let discounted = automatic && product.discountPct > 0;
  const cents = (value: number) => Math.round(value * 100) / 100;
  let itemPrice = cents(
    product.price * (automatic ? 1 - product.discountPct : 1),
  );
  const budgetPenalty = (price: number) =>
    -p.priceSensitivity * Math.log1p(price / p.budget) * 1.25;
  draws(p.id, 0, 1, pop.seed, out);
  const shopDraw = unit(out[0]),
    nonshopDraw = unit(out[1]),
    pageDraw = unit(out[2]),
    infoDraw = unit(out[3]);
  const attention = 1.5 * (f.adAttention - 0.5) * (0.3 + 0.7 * p.attention);
  const relevance =
    1.25 * (f.adBenefit - 0.5) +
    1.25 * (p.need - 0.45) +
    0.6 * (appealMatch - 0.5);
  const credibility = (f.adCredibility - 0.5) * (0.5 + p.trustNeed);
  const priceInAd = settings.priceInAd ? budgetPenalty(itemPrice) * 0.45 : 0;
  const platform = s.acquisition.platform;
  const platformUtility =
    platform === "google_search"
      ? 1.1 * s.acquisition.searchIntent + 1.7 * (f.adQueryMatch - 0.5)
      : platform === "tiktok"
        ? 0.5 * (p.novelty - 0.5) + 0.3 * (f.adAttention - 0.5)
        : platform === "facebook"
          ? 0.25 * p.socialProofNeed * (f.adCredibility - 0.5)
          : 0;
  const adUtility =
    co.ad +
    platformUtility +
    attention +
    relevance +
    credibility +
    1.1 * (f.adClarity - 0.5) +
    0.6 * p.familiarity +
    priceInAd +
    0.5 * (f.adOffer - 0.5) * p.dealSeeking -
    0.18 * (settings.adFrequency - 1) * (1 - p.need);
  const pShop = p.relevance === "excluded" ? 0 : sigmoid(adUtility);
  const pNonshop = clamp(
    0.00015 + 0.0018 * f.adAttention * (0.3 + 0.7 * p.novelty),
    0,
    0.01,
  );
  o.shoppingClick = shopDraw < pShop;
  o.clicked = o.shoppingClick || nonshopDraw < pNonshop;
  event(
    events,
    `${platform}: shopping interest`,
    o.shoppingClick ? "Click to investigate product" : "No shopping click",
    pShop,
    shopDraw,
    [
      { label: "Baseline propensity", value: co.ad },
      { label: "Platform and intent", value: platformUtility },
      { label: "Product relevance and need", value: relevance },
      { label: "Attention", value: attention },
      { label: "Credibility", value: credibility },
      { label: "Visible price", value: priceInAd },
    ],
    p.relevance === "excluded"
      ? "Structural category exclusion: shopping probability is exactly zero."
      : "The same preferences continue into the product page. The random draw represents variation under this model.",
  );
  if (!o.shoppingClick)
    event(
      events,
      `${platform}: incidental attention`,
      o.clicked ? "Curiosity or accidental click" : "Ignore",
      pNonshop,
      nonshopDraw,
      [],
      "A separate nonshopping click channel can earn attention without creating product interest.",
    );
  if (!o.clicked) {
    o.reason =
      p.relevance === "excluded"
        ? "no_interest"
        : primary(
            [
              { reason: "low_relevance", value: relevance },
              { reason: "low_credibility", value: credibility },
              { reason: "price", value: priceInAd },
              { reason: "no_attention", value: attention },
            ],
            "no_attention",
          );
    return o;
  }
  if (p.relevance === "excluded" || p.offlineOnly) {
    o.reason = p.relevance === "excluded" ? "no_interest" : "offline_only";
    event(
      events,
      "Product page",
      "Leave",
      0,
      null,
      [],
      o.reason === "no_interest"
        ? "Creative attention did not create product interest."
        : "This consumer does not transact through this online channel.",
    );
    return o;
  }
  if (product.stock === "out") {
    o.reason = "out_of_stock";
    event(
      events,
      "Product page",
      "Unavailable",
      0,
      null,
      [],
      "The product cannot be ordered in this scenario.",
    );
    return o;
  }
  const shippingFor = (price: number) =>
    product.freeShippingThreshold > 0 && price >= product.freeShippingThreshold
      ? 0
      : product.shipping;
  let shipping = shippingFor(itemPrice);
  const knownPagePrice =
    itemPrice + (settings.shippingDisclosure === "pdp" ? shipping : 0);
  if (
    knownPagePrice >
    p.budget *
      (p.preferredPayment === "bnpl" &&
      settings.bnpl &&
      settings.financingVisibleOnPage
        ? 1.6
        : 1.12)
  ) {
    o.reason = "price";
    event(
      events,
      "Product page",
      "Leave: outside budget",
      0,
      null,
      [
        { label: "Known cost", value: knownPagePrice },
        { label: "Budget", value: p.budget },
      ],
      "The consumer only knows charges disclosed by this stage.",
    );
    return o;
  }
  let information = f.pageInformation;
  const gap = Math.max(0, p.informationNeed - information);
  o.informationSought =
    infoDraw < clamp(0.12 + gap * 1.25 + p.informationNeed * 0.25);
  if (o.informationSought) {
    draws(p.id, 1, 1, pop.seed, out);
    const recoveryDraw = unit(out[0]);
    const answerChance = clamp(
      f.pageAnswerAccess * (0.25 + 0.75 * information),
    );
    o.informationRecovered = recoveryDraw < answerChance;
    if (o.informationRecovered) information = clamp(information + 0.23);
    event(
      events,
      "Product information",
      o.informationRecovered
        ? "Find useful answer"
        : "Question remains unresolved",
      answerChance,
      recoveryDraw,
      [
        { label: "Information gap", value: gap },
        { label: "Answer access", value: f.pageAnswerAccess },
      ],
      "A bounded information detour. Searching is not automatically a successful answer or a purchase.",
    );
  }
  const trust =
    1.45 * (f.pageTrust - 0.5) * (0.4 + p.trustNeed) +
    f.pageProof * p.socialProofNeed * 0.75 +
    0.55 * p.familiarity -
    (settings.returnPolicyVisible ? 0 : 0.4 * p.trustNeed) -
    (settings.returnPolicyVisible
      ? (Math.max(0, 14 - product.returnDays) / 14) * 0.3 * p.trustNeed
      : 0);
  const infoPenalty = -Math.max(0, p.informationNeed - information) * 2.8;
  const pageFriction =
    -Math.max(0, settings.pageLoadSeconds - (1 + 5 * p.patience)) * 0.18 -
    (p.mobile && !settings.mobileOptimized ? 0.85 : 0) +
    0.7 * (f.pageUsability - 0.5);
  const match = 1.8 * (f.pageMatch - 0.65);
  const price = budgetPenalty(knownPagePrice);
  const incumbentPenalty = -p.incumbent * (1 - p.need) * 1.2;
  const pageUtility =
    co.page +
    1.55 * p.need +
    0.55 * p.affinity +
    0.6 * appealMatch +
    trust +
    infoPenalty +
    pageFriction +
    match +
    price +
    incumbentPenalty +
    0.65 * (f.pageClarity - 0.5);
  const pCart = sigmoid(pageUtility);
  o.cart = pageDraw < pCart;
  event(
    events,
    "Product page",
    o.cart ? "Add to cart" : "Leave or defer",
    pCart,
    pageDraw,
    [
      { label: "Baseline propensity", value: co.page },
      {
        label: "Current need relative to neutral",
        value: 1.55 * (p.need - 0.5),
      },
      { label: "Known price / budget", value: price },
      { label: "Unanswered information", value: infoPenalty },
      { label: "Trust and evidence", value: trust },
      { label: "Page usability", value: pageFriction },
      { label: "Ad-to-page match", value: match },
      { label: "Existing alternative", value: incumbentPenalty },
    ],
    "The add-to-cart decision uses only this consumer's preferences and the information visible so far.",
  );
  if (!o.cart) {
    o.reason = primary(
      [
        { reason: "no_current_need", value: 1.55 * (p.need - 0.5) },
        { reason: "price", value: price },
        { reason: "information", value: infoPenalty },
        { reason: "trust", value: trust },
        { reason: "page_friction", value: pageFriction },
        { reason: "promise_mismatch", value: match },
        { reason: "incumbent", value: incumbentPenalty },
      ],
      "deferred",
    );
    return o;
  }
  draws(p.id, 8, 1, pop.seed, out);
  const cartQuestionDraw = unit(out[0]),
    cartAnswerDraw = unit(out[1]);
  const cartGap = Math.max(0, p.informationNeed - information);
  if (cartQuestionDraw < cartGap * 0.8) {
    o.informationSought = true;
    const answerChance = clamp(
      f.informationAccess * (0.25 + 0.75 * f.pageInformation),
    );
    const answered = cartAnswerDraw < answerChance;
    if (answered) {
      information = clamp(information + 0.2);
      o.informationRecovered = true;
    }
    event(
      events,
      "Cart: product questions",
      answered
        ? "Find answer and return to cart"
        : "Question remains unresolved",
      answerChance,
      cartAnswerDraw,
      [{ label: "Remaining information gap", value: cartGap }],
      "Only answers accessible at this stage can resolve the question.",
    );
  }
  draws(p.id, 2, 1, pop.seed, out);
  const couponDraw = unit(out[0]),
    findDraw = unit(out[1]),
    cartDraw = unit(out[2]),
    accountDraw = unit(out[3]);
  if (settings.discountMode !== "automatic") {
    o.couponSought =
      couponDraw < clamp(p.dealSeeking * (0.2 + 0.7 * f.couponProminence));
    if (o.couponSought) {
      o.couponFound =
        settings.discountMode === "coupon" && findDraw < settings.couponSuccess;
      event(
        events,
        "Cart: discount",
        o.couponFound ? "Find and apply discount" : "No usable code found",
        settings.discountMode === "coupon" ? settings.couponSuccess : 0,
        findDraw,
        [
          { label: "Deal seeking", value: p.dealSeeking },
          { label: "Coupon emphasis", value: f.couponProminence },
        ],
        "Discount searching can succeed, lead to deferral, or lose the sale.",
      );
      if (o.couponFound) {
        discounted = product.discountPct > 0;
        itemPrice = cents(product.price * (1 - product.discountPct));
        shipping = shippingFor(itemPrice);
      } else if (findDraw > 0.35 + 0.45 * p.need) {
        o.reason = "discount_search";
        return o;
      }
    }
  }
  const cartShipping =
    settings.shippingDisclosure === "checkout" ? 0 : shipping;
  const shippingSurprise =
    settings.shippingDisclosure === "cart"
      ? -(shipping / Math.max(10, itemPrice)) * (1 + p.priceSensitivity) * 2.3
      : 0;
  const delivery =
    -Math.max(0, product.deliveryDays - (2 + 9 * (1 - p.urgency))) * 0.2;
  const cartInfo =
    -Math.max(0, p.informationNeed - information) *
    1.1 *
    (1 - f.informationAccess);
  const cartFriction =
    -f.upsellPressure * (1 - p.patience) * 1.4 + 1.1 * (f.cartClarity - 0.5);
  const pCheckout = sigmoid(
    co.cart +
      0.6 * p.need +
      shippingSurprise +
      delivery +
      cartInfo +
      cartFriction +
      (discounted ? 0.5 * p.dealSeeking : 0),
  );
  o.checkout = cartDraw < pCheckout;
  event(
    events,
    "Cart",
    o.checkout ? "Start checkout" : "Leave cart",
    pCheckout,
    cartDraw,
    [
      { label: "New shipping charge", value: shippingSurprise },
      { label: "Delivery fit", value: delivery },
      { label: "Unresolved information", value: cartInfo },
      { label: "Cart effort", value: cartFriction },
    ],
    `Known merchandise and shipping: $${(itemPrice + cartShipping).toFixed(2)}. Tax and any late shipping are not assumed known yet.`,
  );
  if (!o.checkout) {
    o.reason = primary(
      [
        { reason: "shipping", value: shippingSurprise },
        { reason: "delivery", value: delivery },
        { reason: "information", value: cartInfo },
        { reason: "cart_friction", value: cartFriction },
      ],
      "cart_friction",
    );
    return o;
  }
  if (!settings.guestCheckout) {
    const pAccount = sigmoid(
      2.2 - 2.3 * p.privacyNeed - 1.1 * (1 - p.patience) + 0.6 * p.familiarity,
    );
    const accepts = accountDraw < pAccount;
    event(
      events,
      "Checkout: account",
      accepts ? "Create account" : "Decline account requirement",
      pAccount,
      accountDraw,
      [
        { label: "Privacy resistance", value: -2.3 * p.privacyNeed },
        { label: "Patience", value: -1.1 * (1 - p.patience) },
      ],
      "Account preference is distinct from product interest.",
    );
    if (!accepts) {
      o.reason = "account_required";
      return o;
    }
  }
  const paymentAvailable =
    p.preferredPayment === "card" ||
    (p.preferredPayment === "wallet" && settings.wallets) ||
    (p.preferredPayment === "paypal" && settings.paypal) ||
    (p.preferredPayment === "bnpl" && settings.bnpl);
  let paymentChecked = false,
    chargesChecked = false;
  const checkCharges = (draw: number): boolean => {
    const total = cents(
      itemPrice + shipping + cents((itemPrice + shipping) * product.taxRate),
    );
    const lateSurprise =
      settings.shippingDisclosure === "checkout"
        ? -(shipping / Math.max(10, itemPrice)) * (1 + p.priceSensitivity) * 2.8
        : 0;
    const affordable =
      total <=
      p.budget * (p.preferredPayment === "bnpl" && settings.bnpl ? 1.6 : 1.12);
    const chance = affordable
      ? sigmoid(
          2.6 +
            lateSurprise -
            product.taxRate * p.priceSensitivity +
            0.4 * p.need,
        )
      : 0;
    const accepted = draw < chance;
    event(
      events,
      "Checkout: final charges",
      accepted ? "Accept final total" : "Reject final total",
      chance,
      draw,
      [
        { label: "Late shipping surprise", value: lateSurprise },
        { label: "Final total", value: total },
        { label: "Budget", value: p.budget },
      ],
      "Taxes are passed through and excluded from merchant revenue. Charges are checked once when disclosed.",
    );
    if (!accepted)
      o.reason = affordable && lateSurprise < 0 ? "shipping" : "price";
    chargesChecked = true;
    return accepted;
  };
  const checkPayment = (draw: number): boolean => {
    const chance = paymentAvailable
      ? 1
      : clamp(
          0.65 -
            0.35 * p.privacyNeed -
            0.2 * (p.preferredPayment === "bnpl" ? 1 : 0),
        );
    const accepted = draw < chance;
    event(
      events,
      "Checkout: payment",
      accepted
        ? paymentAvailable
          ? "Use preferred payment"
          : "Use an alternative payment"
        : "No acceptable payment method",
      chance,
      draw,
      [],
      `Preferred method: ${p.preferredPayment}. Availability here is configured, not verified against a live processor.`,
    );
    if (!accepted) o.reason = "payment";
    paymentChecked = true;
    return accepted;
  };
  draws(p.id, 98, 1, pop.seed, out);
  const finalChargeDraw = unit(out[0]),
    paymentMethodDraw = unit(out[1]);
  let friction = 0;
  for (const step of s.steps) {
    // A stable step-id stream prevents reordered or inserted steps shifting other random draws.
    let stepKey = 2166136261;
    for (let j = 0; j < step.id.length; j++)
      stepKey = Math.imul(stepKey ^ step.id.charCodeAt(j), 16777619);
    draws(p.id, stepKey >>> 0, 3, pop.seed, out);
    const errorDraw = unit(out[0]),
      continueDraw = unit(out[1]);
    o.stepsReached++;
    if (
      (step.type === "shipping" ||
        step.type === "payment" ||
        step.type === "review") &&
      !chargesChecked &&
      !checkCharges(finalChargeDraw)
    )
      return o;
    if (
      (step.type === "payment" || step.type === "review") &&
      !paymentChecked &&
      !checkPayment(paymentMethodDraw)
    )
      return o;
    if (errorDraw < step.errorRate) {
      o.reason = "technical_error";
      event(
        events,
        step.name,
        "Technical failure",
        step.errorRate,
        errorDraw,
        [],
        "A failure drawn from the configured error assumption. This is not a measured defect in the live site.",
      );
      return o;
    }
    const effort =
      step.fields * 0.052 * (1.2 - p.patience) * (p.mobile ? 1.25 : 1) +
      step.seconds * 0.013 * (1.2 - p.patience);
    friction += effort;
    const clear = (step.clarity - 0.5) * 0.65;
    const continueChance = sigmoid(
      co.checkout + 1.65 + 0.45 * p.need + clear - effort - 0.18 * friction,
    );
    const advances = continueDraw < continueChance;
    event(
      events,
      step.name,
      advances ? "Complete step" : "Abandon checkout",
      continueChance,
      continueDraw,
      [
        { label: "Step effort", value: -effort },
        { label: "Accumulated effort", value: -0.18 * friction },
        { label: "Step clarity", value: clear },
      ],
      `${step.fields} required fields; ${step.seconds} seconds of configured waiting. The consumer's patience and device affect effort.`,
    );
    if (!advances) {
      o.reason = "form_friction";
      return o;
    }
    o.stepsCompleted++;
  }
  draws(p.id, 99, 1, pop.seed, out);
  if (!chargesChecked && !checkCharges(finalChargeDraw)) return o;
  if (!paymentChecked && !checkPayment(paymentMethodDraw)) return o;
  o.bought = true;
  o.reason = "purchased";
  o.discountApplied = discounted;
  o.revenue = cents(itemPrice + shipping);
  const charge = cents(
    itemPrice + shipping + cents((itemPrice + shipping) * product.taxRate),
  );
  o.contribution = cents(
    o.revenue -
      product.unitCost -
      product.shippingCost -
      cents(charge * product.paymentFeeRate + product.paymentFeeFixed),
  );
  event(
    events,
    "Order",
    "Purchase",
    1,
    null,
    [
      { label: "Merchandise and shipping revenue", value: o.revenue },
      { label: "Contribution before advertising", value: o.contribution },
    ],
    "Simulated order under the frozen model and inputs. This is not a real transaction.",
  );
  return o;
}
function segment(label: string): SegmentResult {
  return {
    label,
    exposed: 0,
    clicks: 0,
    carts: 0,
    checkout: 0,
    purchases: 0,
    revenue: 0,
    contribution: 0,
  };
}
export function emptyResult(s: Scenario): SimulationResult {
  return {
    scenarioId: s.id,
    scenarioName: s.name,
    exposed: 0,
    clicks: 0,
    carts: 0,
    checkout: 0,
    purchases: 0,
    relevant: 0,
    activeNeed: 0,
    shoppingClicks: 0,
    nonshoppingClicks: 0,
    informationSought: 0,
    informationRecovered: 0,
    couponSought: 0,
    couponFound: 0,
    discountedOrders: 0,
    revenue: 0,
    contribution: 0,
    adSpend: 0,
    reasons: Object.fromEntries(REASONS.map((r) => [r, 0])) as Record<
      Reason,
      number
    >,
    steps: s.steps.map((step) => ({
      id: step.id,
      name: step.name,
      reached: 0,
      completed: 0,
    })),
    segments: {
      relevance: [
        segment("No interest"),
        segment("Dormant need"),
        segment("Active need"),
      ],
      budget: [
        segment("Under $50"),
        segment("$50–99"),
        segment("$100–199"),
        segment("$200+"),
      ],
      device: [segment("Mobile"), segment("Desktop")],
      motivation: [
        segment("Practical"),
        segment("Design"),
        segment("Status"),
        segment("Value"),
      ],
    },
    samples: {},
    losses: Object.fromEntries(
      ["ad", "pdp", "cart", "checkout"].map((stage) => [
        stage,
        Object.fromEntries(REASONS.map((r) => [r, 0])),
      ]),
    ) as SimulationResult["losses"],
  };
}
function addSegment(
  r: FunnelCounts & { revenue: number; contribution: number },
  o: Outcome,
) {
  r.exposed++;
  r.clicks += +o.clicked;
  r.carts += +o.cart;
  r.checkout += +o.checkout;
  r.purchases += +o.bought;
  r.revenue = Math.round(r.revenue * 100 + o.revenue * 100) / 100;
  r.contribution =
    Math.round(r.contribution * 100 + o.contribution * 100) / 100;
}
export function addOutcome(
  r: SimulationResult,
  p: Profile,
  o: Outcome,
  s: Scenario,
) {
  addSegment(r, o);
  r.relevant += +(p.relevance !== "excluded");
  r.activeNeed += +(p.relevance === "active");
  r.shoppingClicks += +o.shoppingClick;
  r.nonshoppingClicks += +(o.clicked && !o.shoppingClick);
  r.informationSought += +o.informationSought;
  r.informationRecovered += +o.informationRecovered;
  r.couponSought += +o.couponSought;
  r.couponFound += +o.couponFound;
  r.discountedOrders += +o.discountApplied;
  r.reasons[o.reason]++;
  const sample = r.samples[o.reason] ?? (r.samples[o.reason] = []);
  if (sample.length < 16) sample.push(p.id);
  if (!o.bought) {
    const stage = !o.clicked
      ? "ad"
      : !o.cart
        ? "pdp"
        : !o.checkout
          ? "cart"
          : "checkout";
    r.losses[stage][o.reason]++;
    const key = `${stage}:${o.reason}`,
      ids = r.samples[key] ?? (r.samples[key] = []);
    if (ids.length < 16) ids.push(p.id);
  }
  for (let i = 0; i < o.stepsReached; i++) r.steps[i].reached++;
  for (let i = 0; i < o.stepsCompleted; i++) r.steps[i].completed++;
  addSegment(
    r.segments.relevance[
      p.relevance === "excluded" ? 0 : p.relevance === "dormant" ? 1 : 2
    ],
    o,
  );
  addSegment(
    r.segments.budget[
      p.budget < 50 ? 0 : p.budget < 100 ? 1 : p.budget < 200 ? 2 : 3
    ],
    o,
  );
  addSegment(r.segments.device[p.mobile ? 0 : 1], o);
  addSegment(
    r.segments.motivation[
      p.appeal === "practical"
        ? 0
        : p.appeal === "design"
          ? 1
          : p.appeal === "status"
            ? 2
            : 3
    ],
    o,
  );
  r.adSpend = (r.exposed * s.settings.cpm) / 1000;
}
export function createRun(request: RunRequest): RunResult {
  return {
    id: request.id,
    version: ENGINE_VERSION,
    createdAt: new Date().toISOString(),
    elapsedMs: 0,
    processed: 0,
    planned: request.count ?? request.population.size,
    startId: request.startId ?? 0,
    status: "partial",
    population: structuredClone(request.population),
    coefficients: structuredClone(request.coefficients),
    scenarios: structuredClone(request.scenarios),
    results: request.scenarios.map(emptyResult),
    comparisons: request.scenarios.slice(1).map((s) => ({
      scenarioId: s.id,
      bothBuy: 0,
      baselineOnly: 0,
      variantOnly: 0,
      neither: 0,
      deltaRate: 0,
      monteCarloSE: 0,
    })),
  };
}
export function processRange(run: RunResult, start: number, end: number): void {
  const out = scratch(),
    { population: pop, scenarios, coefficients: co } = run;
  for (let id = start; id < end; id++) {
    const p = profileFor(id, pop, scenarios[0].product.category, out);
    let baseline = false;
    for (let v = 0; v < scenarios.length; v++) {
      const o = evaluate(p, scenarios[v], pop, co, undefined, out);
      addOutcome(run.results[v], p, o, scenarios[v]);
      if (v === 0) baseline = o.bought;
      else {
        const c = run.comparisons[v - 1];
        if (baseline && o.bought) c.bothBuy++;
        else if (baseline) c.baselineOnly++;
        else if (o.bought) c.variantOnly++;
        else c.neither++;
      }
    }
  }
  run.processed += end - start;
  for (const c of run.comparisons) {
    c.deltaRate = (c.variantOnly - c.baselineOnly) / run.processed;
    c.monteCarloSE = Math.sqrt(
      Math.max(
        0,
        ((c.variantOnly + c.baselineOnly) / run.processed -
          c.deltaRate * c.deltaRate) /
          run.processed,
      ),
    );
  }
}
export function traceConsumer(
  id: number,
  scenario: Scenario,
  pop: PopulationConfig,
  co: Coefficients,
): ConsumerTrace {
  const profile = profileFor(id, pop, scenario.product.category),
    events: TraceEvent[] = [];
  return {
    profile,
    outcome: evaluate(profile, scenario, pop, co, events),
    events,
  };
}
export function runSync(request: RunRequest): RunResult {
  const run = createRun(request),
    start = request.startId ?? 0,
    begin = performance.now();
  processRange(run, start, start + run.planned);
  run.status = "complete";
  run.elapsedMs = performance.now() - begin;
  return run;
}
export function counts(result: SimulationResult): FunnelCounts {
  return {
    exposed: result.exposed,
    clicks: result.clicks,
    carts: result.carts,
    checkout: result.checkout,
    purchases: result.purchases,
  };
}
export async function calibrate(
  request: RunRequest,
  observed: FunnelCounts,
  onProgress?: (stage: string) => void,
): Promise<Coefficients> {
  const co: Coefficients = {
    ...request.coefficients,
    provenance: "fitted",
    calibration: undefined,
  };
  const n = Math.min(200_000, request.population.size),
    pop = { ...request.population, size: n };
  const stages = [
    { key: "ad", num: "clicks", den: "exposed" },
    { key: "page", num: "carts", den: "clicks" },
    { key: "cart", num: "checkout", den: "carts" },
    { key: "checkout", num: "purchases", den: "checkout" },
  ] as const;
  let achieved: FunnelCounts = {
    exposed: n,
    clicks: 0,
    carts: 0,
    checkout: 0,
    purchases: 0,
  };
  for (const stage of stages) {
    const target = observed[stage.num] / observed[stage.den];
    let lo = -15,
      hi = 15;
    const measure = (intercept: number) => {
      const c = { ...co, [stage.key]: intercept };
      return counts(
        runSync({
          ...request,
          startId: 0,
          population: pop,
          scenarios: [request.scenarios[0]],
          coefficients: c,
          count: n,
        }).results[0],
      );
    };
    const low = measure(lo),
      high = measure(hi);
    if (high[stage.den] === 0)
      throw Error(
        `Cannot fit ${stage.key}: no consumers reach this stage. No coefficients were applied.`,
      );
    const resolution = 1 / high[stage.den];
    if (
      target < low[stage.num] / Math.max(1, low[stage.den]) - resolution ||
      target > high[stage.num] / high[stage.den] + resolution
    )
      throw Error(
        `Historical ${stage.key} rate is outside what this population and journey can produce. Review structural exclusions, budget, and journey inputs. No coefficients were applied.`,
      );
    onProgress?.(stage.key);
    for (let iter = 0; iter < 15; iter++) {
      co[stage.key] = (lo + hi) / 2;
      const r = runSync({
        ...request,
        startId: 0,
        population: pop,
        scenarios: [request.scenarios[0]],
        coefficients: co,
        count: n,
      });
      achieved = counts(r.results[0]);
      const actual = achieved[stage.num] / Math.max(1, achieved[stage.den]);
      if (actual < target) lo = co[stage.key];
      else hi = co[stage.key];
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  achieved = counts(
    runSync({
      ...request,
      startId: 0,
      population: pop,
      scenarios: [request.scenarios[0]],
      coefficients: co,
      count: n,
    }).results[0],
  );
  co.calibration = {
    population: n,
    baselineId: request.scenarios[0].id,
    fittedAt: new Date().toISOString(),
    observed,
    achieved,
    seed: pop.seed,
    signature: calibrationSignature(request.population, request.scenarios[0]),
  };
  return co;
}
