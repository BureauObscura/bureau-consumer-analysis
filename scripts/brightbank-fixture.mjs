import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export const directory = "public/examples/brightbank";
export const studyName = "Brightbank soda · complete purchase journey";
export const population = {
  size: 10_000_000,
  seed: 20260915,
  excludedShare: 0.65,
  activeNeedShare: 0.28,
  offlineOnlyShare: 0.18,
  medianBudget: 32,
  mobileShare: 0.87,
  familiarShare: 0.02,
  deliberation: 0.42,
  priceSensitivity: 1.25,
  distrust: 0.55,
};
export const adCopy = `BRIGHTBANK / FICTIONAL EXAMPLE BRAND
Platform: Instagram feed, static image.
Headline: Orange. Vanilla. Cane sugar.
Body: Orange brightness, a soft vanilla finish, and cane sugar. Brightbank is an all-natural soda made without artificial flavors or colors. Twelve 12 fl oz cans, ready for the fridge. Contains 35 g added sugar per can. Shop the 12-pack.
CTA: Shop now
No price is shown in the creative or copy. Price tests change the PDP price only.
This is a fictional offer. No ad was purchased or delivered to real people.`;

const ingredients =
  "Carbonated water, cane sugar, orange juice from concentrate, natural orange and vanilla flavors, citric acid.";
const nutrition =
  "Per 12 fl oz can: 140 calories; 0 g total fat; 15 mg sodium; 36 g carbohydrate; 35 g total sugar, including 35 g added sugar; 0 g protein. Caffeine free.";
const baselineCopy = `BRIGHTBANK Orange & Vanilla Cane Sugar Soda. A 12-pack of 12 fl oz cans. All-natural soda with bright orange and a soft vanilla finish. Made without artificial flavors or colors. Contains 35 g added sugar per can. Serve cold. Single purchase, no subscription. Nutrition and ingredients are available from support. Shipping and tax calculated at checkout. Unopened packs may be returned within 14 days; report damaged deliveries within 7 days. This is a fictional storefront for a simulator example.`;
const completeCopy = `BRIGHTBANK Orange & Vanilla Cane Sugar Soda. A 12-pack of 12 fl oz cans (144 fl oz total). All-natural soda with bright orange and a soft vanilla finish. Made without artificial flavors or colors. Ingredients: ${ingredients} Nutrition: ${nutrition} Contains added sugar; this is not a low-sugar or zero-sugar drink. Single purchase, no subscription. Store unopened cans in a cool, dry place. Refrigerate after opening and serve cold. Ships to the contiguous United States in 3-5 business days. Unopened packs may be returned within 14 days; buyer pays return postage. Report damaged deliveries within 7 days for replacement. Contact support through the on-page form. There are no customer reviews yet. Shipping and tax calculated at checkout. This is a fictional storefront for a simulator example.`;

const step = (id, name, type, fields, seconds, errorRate, clarity) => ({
  id,
  name,
  type,
  fields,
  seconds,
  errorRate,
  clarity,
});
export function makeStudy(defaultScenario, coefficients) {
  const s = defaultScenario();
  Object.assign(s, {
    id: "brightbank-baseline",
    name: "Baseline: limited PDP + account checkout",
    pageCopy: baselineCopy,
  });
  s.product = {
    name: "Brightbank Orange & Vanilla Soda · 12-pack",
    category: "food",
    description:
      "Fictional all-natural cane-sugar soda. Orange and vanilla, 12 × 12 fl oz cans, 35 g added sugar per can. A full-sugar treat for people open to buying soda online.",
    price: 28.8,
    unitCost: 10.8,
    shipping: 6.95,
    shippingCost: 8.5,
    taxRate: 0.07,
    deliveryDays: 5,
    returnDays: 14,
    stock: "available",
    freeShippingThreshold: 0,
    paymentFeeRate: 0.029,
    paymentFeeFixed: 0.3,
    discountPct: 0.1,
    appeal: "design",
  };
  s.acquisition = {
    platform: "instagram",
    headline: "Orange. Vanilla. Cane sugar.",
    body: adCopy.split("Body: ")[1].split("\nCTA:")[0],
    cta: "Shop now",
    searchQuery: "",
    searchIntent: 0.5,
  };
  s.features = {
    adClarity: 0.88,
    adAttention: 0.82,
    adCredibility: 0.72,
    adBenefit: 0.7,
    adOffer: 0.62,
    adQueryMatch: 0.5,
    pageMatch: 0.94,
    pageClarity: 0.76,
    pageInformation: 0.35,
    pageAnswerAccess: 0.3,
    pageProof: 0.25,
    pageTrust: 0.57,
    pageUsability: 0.78,
    cartClarity: 0.66,
    informationAccess: 0.35,
    couponProminence: 0.82,
    upsellPressure: 0.15,
  };
  Object.assign(s.settings, {
    priceInAd: false,
    shippingDisclosure: "checkout",
    discountMode: "coupon",
    couponSuccess: 0.25,
    guestCheckout: false,
    wallets: false,
    paypal: false,
    bnpl: false,
    mobileOptimized: true,
    financingVisibleOnPage: false,
    pageLoadSeconds: 2.6,
    returnPolicyVisible: true,
    adFrequency: 1,
    cpm: 9.5,
  });
  s.steps = [
    step("contact", "Create account", "contact", 4, 16, 0.012, 0.75),
    step("address", "Delivery address", "address", 7, 24, 0.035, 0.72),
    step("shipping", "Choose shipping", "shipping", 1, 7, 0.008, 0.8),
    step("payment", "Card payment", "payment", 5, 25, 0.025, 0.76),
    step("review", "Review order", "review", 1, 8, 0.005, 0.85),
  ];
  s.sources = [];
  s.analyses = [];
  s.featureBasis = Object.fromEntries(
    Object.keys(s.features).map((k) => [k, { kind: "manual" }]),
  );
  const variant = (id, name) => ({ ...structuredClone(s), id, name });
  const info = variant("brightbank-information", "Complete PDP answers");
  info.pageCopy = completeCopy;
  Object.assign(info.features, {
    pageInformation: 0.9,
    pageAnswerAccess: 0.9,
    pageProof: 0.4,
    pageTrust: 0.72,
    informationAccess: 0.9,
  });
  const guest = variant("brightbank-guest", "Guest checkout + wallets");
  Object.assign(guest.settings, {
    guestCheckout: true,
    wallets: true,
    paypal: true,
  });
  guest.steps[0].name = "Contact details";
  const simple = variant("brightbank-simple", "Shorter checkout forms");
  simple.steps = s.steps.map((x, i) => ({
    ...x,
    fields: [4, 5, 1, 4, 1][i],
    seconds: [8, 12, 3, 12, 3][i],
    errorRate: x.errorRate * 0.25,
    clarity: 0.94,
  }));
  const shipping = variant("brightbank-shipping", "Free shipping");
  shipping.product.shipping = 0;
  const promo = variant("brightbank-promo", "Automatic 10% discount");
  promo.settings.discountMode = "automatic";
  const combined = structuredClone(info);
  combined.id = "brightbank-combined";
  combined.name = "Complete PDP + guest + shorter forms";
  Object.assign(combined.settings, {
    guestCheckout: true,
    wallets: true,
    paypal: true,
  });
  combined.steps = structuredClone(simple.steps);
  combined.steps[0] = {
    ...combined.steps[0],
    name: "Contact details",
    fields: 2,
  };
  const upfront = structuredClone(combined);
  upfront.id = "brightbank-upfront";
  upfront.name = "Combined + shipping shown on PDP";
  upfront.settings.shippingDisclosure = "pdp";
  upfront.pageCopy = upfront.pageCopy.replace(
    "Shipping and tax calculated at checkout.",
    "$6.95 shipping per pack. Tax calculated at checkout.",
  );
  return {
    id: "brightbank-journey-10m",
    population: structuredClone(population),
    scenarios: [s, info, guest, simple, shipping, promo, combined, upfront],
    coefficients: structuredClone(coefficients),
  };
}

const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const money = (n) => "$" + n.toFixed(2);
function shell(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
*{box-sizing:border-box}body{margin:0;background:#fff7e8;color:#302318;font:17px/1.6 system-ui,sans-serif}header,main,footer{max-width:1060px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;border-bottom:1px solid #dbb88e}header b{font-size:26px;letter-spacing:-1px}h1{font:700 clamp(32px,5vw,58px)/1.06 Georgia,serif;margin:12px 0 24px}h2{font-size:21px}a{color:#783111}button,.button{display:inline-block;background:#c64315;color:#fff;border:0;border-radius:5px;padding:14px 24px;font-weight:700;text-decoration:none;cursor:pointer}button:disabled{opacity:.7}.grid{display:grid;grid-template-columns:1fr 1fr;gap:38px}.hero{width:100%;border-radius:10px}.price{font-size:30px;font-weight:700}.note,footer{font-size:13px;color:#705b45}.notice{padding:10px 16px;background:#efe0c5;font-size:13px}.panel{padding:24px;margin:16px 0;border:1px solid #dbb88e;border-radius:8px;background:#fffaf1}label{display:block;margin:12px 0}input,select{display:block;width:100%;padding:10px;border:1px solid #af967b;border-radius:4px;font:inherit}input[type=checkbox]{display:inline;width:auto}dl{display:grid;grid-template-columns:1fr auto;gap:10px}dd{margin:0}nav{display:flex;gap:20px}.hidden{display:none}@media(max-width:680px){.grid{grid-template-columns:1fr}header,main,footer{padding:18px}}
</style></head><body><div class="notice">Fictional brand and simulated checkout. No purchases, charges, or data collection.</div><header><b>BRIGHTBANK</b><span>Orange &amp; Vanilla</span></header><main>${body}</main><footer>Example materials for Bureau Obscura Consumer Analysis Division. Product composition, policies, and economics are authored assumptions. All-natural is fictional positioning, not a verified certification.</footer></body></html>`;
}

export async function writeFixtures(request) {
  await mkdir(directory + "/assets", { recursive: true });
  await writeFile(directory + "/ad-copy.txt", adCopy + "\n");
  const mappings = {};
  for (const s of request.scenarios) {
    const info = s.features.pageInformation > 0.8;
    const net =
      s.product.price * (s.settings.discountMode === "automatic" ? 0.9 : 1);
    const total = net + s.product.shipping;
    const cart = `<h1>Your 12-pack</h1><div class="panel"><h2>${esc(s.product.name)}</h2><p>Quantity: 1 pack / 12 cans.</p><dl><dt>Product</dt><dd>${money(s.product.price)}</dd>${s.settings.discountMode === "automatic" ? `<dt>Automatic discount</dt><dd>-${money(s.product.price * 0.1)}</dd>` : ""}<dt>Shipping</dt><dd>${s.settings.shippingDisclosure === "pdp" ? money(s.product.shipping) : "Calculated at checkout"}</dd><dt>Tax</dt><dd>Calculated at checkout</dd></dl><label>Promo code <input id="promo" name="promo" placeholder="Have a code?"></label><button type="button" onclick="const ok=document.getElementById('promo').value.trim().toUpperCase()==='BRIGHT10';document.getElementById('promo-status').textContent=ok?'10% code accepted. Discount appears at checkout.':'Code not recognized.';document.getElementById('checkout-link').href='${s.id}-checkout.html'+(ok?'?promo=BRIGHT10':'')">Apply code</button><p id="promo-status" role="status"></p><p class="note">Optional promotion: BRIGHT10 gives 10% off the product. No stacking. Code discovery/success is an authored probability, not measured redemption.</p><a id="checkout-link" class="button" href="${s.id}-checkout.html">Continue to checkout</a><p><a href="${s.id}-pdp.html">Product details and returns</a></p></div>`;
    await writeFile(
      `${directory}/${s.id}-cart.html`,
      shell("Brightbank cart", cart),
    );
    const policy =
      "<p>Unopened packs: 14-day returns, buyer pays postage. Damaged deliveries: report within 7 days for replacement.</p>";
    const page = `<div class="grid"><img class="hero" src="assets/instagram-ad.png" alt="Brightbank orange and vanilla cane sugar soda can with orange and vanilla flower"><section><p>12 CANS / 12 FL OZ EACH</p><h1>Orange &amp; Vanilla</h1><p class="price">${money(s.product.price)}</p><p>All-natural cane-sugar soda. Bright orange with a soft vanilla finish. No artificial flavors or colors.</p><p>35 g added sugar per can. Single purchase, no subscription.</p>${s.settings.shippingDisclosure === "pdp" ? `<p>${money(s.product.shipping)} shipping. Tax calculated at checkout. Ships in 3-5 business days.</p>` : "<p>Shipping and tax calculated at checkout.</p>"}${s.settings.discountMode === "automatic" ? "<p>10% off automatically at checkout.</p>" : ""}<a class="button" href="${s.id}-cart.html">Add 12-pack to cart</a><p class="note">In stock in this fictional scenario.</p></section></div>${info ? `<section class="panel"><h2>Ingredients</h2><p>${ingredients}</p><h2>Nutrition</h2><p>${nutrition}</p><p>This is not a low-sugar or zero-sugar drink.</p><h2>Delivery, storage and returns</h2><p>Ships to the contiguous United States in 3-5 business days. Store unopened cans in a cool, dry place; refrigerate after opening. Serve cold.</p>${policy}<h2>Questions</h2><p>One pack contains twelve 12 fl oz cans, 144 fl oz total. No subscription. No customer reviews yet.</p><label>Ask a product question <input name="question"></label><button type="button" onclick="this.nextElementSibling.hidden=false">Show example support note</button><p hidden>No message is sent. This mockup represents accessible support; response speed is unmeasured.</p></section>` : `<section class="panel"><h2>Product details</h2><p>Serve cold. Ingredients and nutrition information are available from support.</p>${policy}</section>`}`;
    await writeFile(
      `${directory}/${s.id}-pdp.html`,
      shell("Brightbank product page", page),
    );
    const fields = {
      contact: s.settings.guestCheckout
        ? s.steps[0].fields === 2
          ? ["Email", "Full name"]
          : ["Email", "First name", "Last name", "Phone"]
        : ["Email", "Password", "Confirm password", "Phone"],
      address:
        s.steps[1].fields === 5
          ? [
              "Full name",
              "Street address including apartment",
              "City",
              "State",
              "ZIP code",
            ]
          : [
              "Full name",
              "Address line 1",
              "Address line 2",
              "City",
              "State",
              "ZIP code",
              "Country",
            ],
      shipping: ["Shipping method"],
      payment:
        s.steps[3].fields === 4
          ? ["Card number", "Name on card", "Expiry (MM/YY)", "Security code"]
          : [
              "Card number",
              "Name on card",
              "Expiry month",
              "Expiry year",
              "Security code",
            ],
      review: ["Confirm order details"],
    };
    const totals = `<div class="panel"><dl><dt>Merchandise after promotion</dt><dd id="item-total">${money(net)}</dd><dt>Shipping</dt><dd>${money(s.product.shipping)}</dd><dt>Example tax (7%)</dt><dd id="tax-total">${money(Math.round(total * 0.07 * 100) / 100)}</dd><dt>Total</dt><dd id="grand-total">${money(total + Math.round(total * 0.07 * 100) / 100)}</dd></dl><p id="discount-status"></p></div>`;
    const form = s.steps
      .map(
        (st, i) =>
          `<section class="panel step" data-step="${i}"><h2>${i + 1}. ${esc(st.name)}</h2>${st.id === "contact" ? `<p>${s.settings.guestCheckout ? "Guest checkout available." : "An account is required to continue."}</p>` : ""}${st.id === "address" ? "<p>Delivery country: United States.</p>" : ""}${st.id === "shipping" ? totals : ""}${st.id === "payment" ? `<label>Payment method<select id="payment-method" onchange="const alt=this.value!=='card';document.querySelectorAll('[name^=payment-]').forEach(el=>{el.required=!alt;el.disabled=alt});document.getElementById('payment-note').textContent=alt?'Simulated '+this.value+' selected. No provider connection.':''"><option value="card">Card</option>${s.settings.wallets ? '<option value="wallet">Express wallet</option>' : ""}${s.settings.paypal ? '<option value="PayPal">PayPal</option>' : ""}</select></label><p id="payment-note"></p>` : ""}${Array.from({ length: st.fields }, (_, j) => `<label>${fields[st.id][j]}<input name="${st.id}-${j}" placeholder="TEST DATA ONLY" required></label>`).join("")}${i < s.steps.length - 1 ? `<button type="button" onclick="nextStep(${i})">Continue</button>` : '<button type="submit">Place simulated order</button>'}</section>`,
      )
      .join("");
    const checkout = `<h1>Checkout</h1><p>One 12-pack. Test data only; this form never sends a request. Charges are shown at the shipping step.</p><form onsubmit="event.preventDefault();document.getElementById('receipt').hidden=false">${form}</form><section id="receipt" class="panel" hidden><h2>Simulated order complete</h2><p>No payment was collected and no data was saved.</p></section><p><a href="${s.id}-pdp.html">Delivery and return information</a></p><script>
    const steps=[...document.querySelectorAll('.step')]; steps.forEach((el,i)=>el.hidden=i!==0);
    function nextStep(i){const controls=[...steps[i].querySelectorAll('input,select')];if(!controls.every(el=>el.reportValidity()))return;steps[i].hidden=true;steps[i+1].hidden=false;steps[i+1].scrollIntoView({behavior:'smooth'});}
    const apply=${s.settings.discountMode === "automatic"}||(${s.settings.discountMode === "coupon"}&&new URLSearchParams(location.search).get('promo')==='BRIGHT10');
    if(apply){const item=Math.round(${s.product.price}*.9*100)/100;const subtotal=item+${s.product.shipping};const tax=Math.round(subtotal*.07*100)/100;document.getElementById('item-total').textContent='$'+item.toFixed(2);document.getElementById('tax-total').textContent='$'+tax.toFixed(2);document.getElementById('grand-total').textContent='$'+(subtotal+tax).toFixed(2);document.getElementById('discount-status').textContent='10% product discount applied; no stacking.';}
    </script>`;
    await writeFile(
      `${directory}/${s.id}-checkout.html`,
      shell("Brightbank simulated checkout", checkout),
    );
    mappings[s.id] = [
      "assets/instagram-ad.png",
      "ad-copy.txt",
      `${s.id}-pdp.html`,
      `${s.id}-cart.html`,
      `${s.id}-checkout.html`,
      ...(info ? ["product-facts.pdf"] : []),
    ];
  }
  await writeFile(
    directory + "/configuration.json",
    JSON.stringify(request, null, 2) + "\n",
  );
  await writeFile(
    directory + "/evidence-map.json",
    JSON.stringify(mappings, null, 2) + "\n",
  );
  return mappings;
}
export async function evidenceManifest(mappings) {
  return Promise.all(
    [...new Set(Object.values(mappings).flat())].map(async (file) => {
      const bytes = await readFile(directory + "/" + file);
      return {
        file,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        scenarios: Object.keys(mappings).filter((k) =>
          mappings[k].includes(file),
        ),
      };
    }),
  );
}
export const completeProductCopy = completeCopy;
