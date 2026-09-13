/* eslint-disable @next/next/no-img-element -- Private evidence images must load with the signed-in caller session, without a public image proxy. */
"use client";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImageIcon,
  FileText,
  Globe,
  Plus,
  Trash2,
  Sparkles,
  ExternalLink,
  Upload,
  ShoppingBag,
  ShoppingCart,
  MousePointer2,
  CreditCard,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Button,
  Field,
  NumberField,
  Choice,
  Toggle,
  Range,
  options,
  percent,
} from "./controls";
import { CATEGORIES, FEATURE_FIELDS } from "@/lib/sim/defaults";
import { evidenceContext } from "@/lib/sim/evidence-context";
import { api, uploadSource } from "@/lib/client-api";
import type {
  Analysis,
  FeatureKey,
  Scenario,
  Source,
  Stage,
} from "@/lib/sim/types";
export const STAGES: {
  id: Stage;
  name: string;
  description: string;
  icon: typeof ImageIcon;
}[] = [
  {
    id: "ad",
    name: "Ad & placement",
    description: "Creative, copy, platform, intent, and prior exposure.",
    icon: MousePointer2,
  },
  {
    id: "pdp",
    name: "Product page",
    description:
      "Full page evidence, product answers, credibility, and usability.",
    icon: ShoppingBag,
  },
  {
    id: "cart",
    name: "Cart & offer",
    description: "Shipping, tax, discounts, delivery, and remaining questions.",
    icon: ShoppingCart,
  },
  {
    id: "checkout",
    name: "Checkout flow",
    description: "Account requirements, payment options, fields, and friction.",
    icon: CreditCard,
  },
];
type Props = {
  scenario: Scenario;
  update: (change: (s: Scenario) => Scenario) => void;
  apiKey: string;
  connect: () => void;
  notice: (text: string) => void;
};
export function Journey({
  scenario: s,
  update,
  apiKey,
  connect,
  notice,
}: Props) {
  const [stage, setStage] = useState<Stage | null>(null);
  const product = (key: keyof Scenario["product"], value: unknown) =>
    update((s) => ({ ...s, product: { ...s.product, [key]: value } }));
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Product & journey</h2>
          <p>
            Configure the current journey, then duplicate it to test
            alternatives.
          </p>
        </div>
        <span className="tag">All money in USD</span>
      </div>
      <div className="panel product-panel">
        <div className="form-grid four">
          <Field
            label="Journey name"
            value={s.name}
            onChange={(name) => update((s) => ({ ...s, name }))}
          />
          <Field
            label="Product title"
            value={s.product.name}
            onChange={(v) => product("name", v)}
          />
          <Choice
            label="Product category"
            value={s.product.category}
            onChange={(v) => product("category", v)}
            options={CATEGORIES}
          />
          <NumberField
            label="Selling price ($)"
            value={s.product.price}
            onChange={(v) => product("price", v)}
            min={0.01}
          />
        </div>
        <div className="form-grid two">
          <Field
            label="Product description & positioning"
            value={s.product.description}
            onChange={(v) => product("description", v)}
            multiline
            help="Explain who it is for, what it does, alternatives, and the main reason to choose it."
          />
          <div className="stack">
            <Choice
              label="Main appeal"
              value={s.product.appeal}
              onChange={(v) => product("appeal", v)}
              options={options(["practical", "design", "status", "value"])}
            />
            <Choice
              label="Availability"
              value={s.product.stock}
              onChange={(v) => product("stock", v)}
              options={[
                { value: "available", label: "Available to buy" },
                { value: "out", label: "Out of stock" },
              ]}
            />
          </div>
        </div>
      </div>
      <div className="journey-grid">
        {STAGES.map((item, i) => {
          const sources = s.sources.filter((v) => v.stage === item.id),
            keys = FEATURE_FIELDS.filter((v) => v.stage === item.id),
            reviewed = keys.filter(
              (f) => s.featureBasis[f.key]?.kind === "analysis",
            ).length,
            preview = sources.find((v) => v.kind === "image");
          return (
            <button
              className="stage-card"
              key={item.id}
              onClick={() => setStage(item.id)}
            >
              <div className="stage-top">
                <span>0{i + 1}</span>
                <item.icon size={21} />
              </div>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <div className="stage-preview">
                {preview ? (
                  <img src={preview.url} alt={`${item.name} source preview`} />
                ) : (
                  <div>
                    <item.icon size={30} />
                    <span>
                      {sources.length
                        ? `${sources.length} source files`
                        : "Add source material"}
                    </span>
                  </div>
                )}
              </div>
              <div className="stage-bottom">
                <span>
                  {sources.length} sources ·{" "}
                  {reviewed
                    ? `${reviewed} reviewed inputs`
                    : "Manual assumptions"}
                </span>
                <Plus size={15} />
              </div>
            </button>
          );
        })}
      </div>
      <div className="model-note">
        Files and copy inform the model after you review and apply extracted
        observations. Uploading alone does not change response probabilities.
      </div>
      <Dialog
        open={stage !== null}
        onOpenChange={(open) => {
          if (!open) setStage(null);
        }}
      >
        <DialogContent className="source-dialog">
          {stage && (
            <>
              <DialogTitle>
                {STAGES.find((v) => v.id === stage)!.name}
              </DialogTitle>
              <DialogDescription>
                Source material, observed details, and behavioral assumptions
                for this stage.
              </DialogDescription>
              <StageEditor
                key={`${s.id}-${stage}`}
                {...{ scenario: s, update, apiKey, connect, notice }}
                stage={stage}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function StageEditor({
  scenario: s,
  update,
  stage,
  apiKey,
  connect,
  notice,
}: Props & { stage: Stage }) {
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [url, setUrl] = useState(""),
    [pasted, setPasted] = useState(""),
    [activeAnalysis, setActiveAnalysis] = useState<Analysis | null>(null);
  const setting = (key: keyof Scenario["settings"], value: unknown) =>
    update((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));
  const product = (key: keyof Scenario["product"], value: unknown) =>
    update((s) => ({ ...s, product: { ...s.product, [key]: value } }));
  const acquisition = (key: keyof Scenario["acquisition"], value: unknown) =>
    update((s) => ({ ...s, acquisition: { ...s.acquisition, [key]: value } }));
  async function task(label: string, fn: () => Promise<void>) {
    setError("");
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }
  function addSource(source: Source) {
    update((s) => ({ ...s, sources: [...s.sources, source] }));
  }
  async function analyze(source: Source) {
    if (!apiKey) {
      connect();
      return;
    }
    await task("Analyzing source", async () => {
      const analysis = await api<Analysis>(
        "analysis",
        { sourceId: source.id, scenario: s, requestId: crypto.randomUUID() },
        { "x-sim-openai": apiKey },
      );
      update((s) => ({ ...s, analyses: [...s.analyses, analysis] }));
      setActiveAnalysis(analysis);
    });
  }
  function applyObservation(a: Analysis, key: FeatureKey) {
    if (
      !s.sources.some((v) => v.id === a.sourceId) ||
      !s.analyses.some((v) => v.id === a.id)
    )
      return;
    const o = a.observations.find((v) => v.feature === key);
    if (o?.value == null) return;
    update((s) => ({
      ...s,
      features: { ...s.features, [key]: o.value! },
      featureBasis: {
        ...s.featureBasis,
        [key]: { kind: "analysis", analysisId: a.id, sourceId: a.sourceId },
      },
    }));
  }
  function applySetting(a: Analysis, key: string) {
    if (
      !s.sources.some((v) => v.id === a.sourceId) ||
      !s.analyses.some((v) => v.id === a.id)
    )
      return;
    const o = a.settings.find((v) => v.key === key);
    if (o?.value == null) return;
    const bool = [
      "priceInAd",
      "guestCheckout",
      "wallets",
      "paypal",
      "bnpl",
      "returnPolicyVisible",
      "financingVisibleOnPage",
    ];
    if (bool.includes(key) && typeof o.value === "boolean")
      setting(key as keyof Scenario["settings"], o.value);
    else if (
      key === "shippingDisclosure" &&
      ["pdp", "cart", "checkout"].includes(String(o.value))
    )
      setting("shippingDisclosure", o.value);
    else if (
      key === "discountMode" &&
      ["none", "automatic", "coupon"].includes(String(o.value))
    )
      setting("discountMode", o.value);
    else {
      setError(
        "This suggestion has an unsupported value. Set the control manually.",
      );
      return;
    }
    notice(
      "Observed setting applied. Confirm it matches the intended journey.",
    );
  }
  const sources = s.sources.filter((v) => v.stage === stage);
  return (
    <Tabs defaultValue="configure">
      <TabsList variant="line" className="editor-tabs">
        <TabsTrigger value="configure">Inputs</TabsTrigger>
        <TabsTrigger value="sources">Sources ({sources.length})</TabsTrigger>
        <TabsTrigger value="assumptions">Model inputs</TabsTrigger>
      </TabsList>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      {busy && (
        <div className="notice" role="status">
          {busy}…
        </div>
      )}
      <TabsContent value="configure" className="stack">
        {stage === "ad" && (
          <>
            <div className="form-grid two">
              <Choice
                label="Ad platform"
                value={s.acquisition.platform}
                onChange={(v) => acquisition("platform", v)}
                options={[
                  { value: "instagram", label: "Instagram" },
                  { value: "facebook", label: "Facebook" },
                  { value: "tiktok", label: "TikTok" },
                  { value: "google_search", label: "Google Search" },
                ]}
              />
              <Field
                label="Call to action"
                value={s.acquisition.cta}
                onChange={(v) => acquisition("cta", v)}
              />
            </div>
            <Field
              label="Ad headline"
              value={s.acquisition.headline}
              onChange={(v) => acquisition("headline", v)}
            />
            <Field
              label="Ad body copy / video transcript"
              value={s.acquisition.body}
              onChange={(v) => acquisition("body", v)}
              multiline
            />
            {s.acquisition.platform === "google_search" && (
              <>
                <Field
                  label="Search query"
                  value={s.acquisition.searchQuery}
                  onChange={(v) => acquisition("searchQuery", v)}
                />
                <Range
                  label="Commercial intent of the query"
                  value={s.acquisition.searchIntent}
                  onChange={(v) => acquisition("searchIntent", v)}
                  help="0 = broad research; 100% = actively looking to purchase. An assumption about this exposed audience."
                />
              </>
            )}
            <div className="form-grid two">
              <NumberField
                label="CPM for the modeled exposure ($)"
                value={s.settings.cpm}
                onChange={(v) => setting("cpm", v)}
                help="Every consumer receives one modeled impression. For search, use an equivalent CPM or compare modeled cost per click."
              />
              <NumberField
                label="Exposure number, including prior views"
                value={s.settings.adFrequency}
                onChange={(v) => setting("adFrequency", v)}
                min={1}
                max={30}
                step={1}
                help="1 = first view. Prior exposure changes fatigue; previous impressions and their cost are outside this run."
              />
            </div>
            <Toggle
              label="Price visible in the ad"
              value={s.settings.priceInAd}
              onChange={(v) => setting("priceInAd", v)}
            />
            <Button
              variant="outline"
              disabled={!!busy || s.sources.length >= 20}
              onClick={() =>
                task("Saving ad copy", async () => {
                  const source = await api<Source>("sources/manual", {
                    stage,
                    name: "Ad copy",
                    text: `Platform: ${s.acquisition.platform}\nHeadline: ${s.acquisition.headline}\nBody: ${s.acquisition.body}\nCTA: ${s.acquisition.cta}\nSearch query: ${s.acquisition.searchQuery}`,
                  });
                  addSource(source);
                  notice(
                    "Ad copy saved as a source. Review it in Sources or attach creative there.",
                  );
                })
              }
            >
              <FileText />
              Save copy as analysis source
            </Button>
            <p className="hint">
              Attach creative in Sources. For motion ads, upload a storyboard
              PDF or key frames and include the spoken transcript here.
              Playback, sound, and timing are not inferred from stills.
            </p>
          </>
        )}
        {stage === "pdp" && (
          <>
            <Field
              label="Full PDP copy"
              value={s.pageCopy}
              onChange={(pageCopy) => update((s) => ({ ...s, pageCopy }))}
              multiline
              help="Include title, benefits, specifications, variants, reviews, FAQs, shipping, returns, guarantees, and purchase-button copy. Up to 50,000 characters."
            />
            <Button
              variant="outline"
              disabled={!!busy || s.sources.length >= 20 || !s.pageCopy.trim()}
              onClick={() =>
                task("Saving page copy", async () => {
                  addSource(
                    await api<Source>("sources/manual", {
                      stage,
                      name: "Full product page copy",
                      text: s.pageCopy,
                    }),
                  );
                  notice("Page copy saved. Review and analyze it in Sources.");
                })
              }
            >
              <FileText />
              Save copy as analysis source
            </Button>
            <p className="hint">
              Sources also accepts the page as a PDF, exported HTML,
              screenshots, or a public URL. Upload multiple views to include
              content below the fold.
            </p>
            <div className="form-grid two">
              <NumberField
                label="Page load / waiting time (seconds)"
                value={s.settings.pageLoadSeconds}
                onChange={(v) => setting("pageLoadSeconds", v)}
                max={120}
              />
              <NumberField
                label="Return window (days)"
                value={s.product.returnDays}
                onChange={(v) => product("returnDays", v)}
                max={365}
                step={1}
              />
            </div>
            <Toggle
              label="Page works well on mobile"
              value={s.settings.mobileOptimized}
              onChange={(v) => setting("mobileOptimized", v)}
            />
            <Toggle
              label="Return policy visible on PDP"
              value={s.settings.returnPolicyVisible}
              onChange={(v) => setting("returnPolicyVisible", v)}
            />
            <Toggle
              label="Financing shown on PDP"
              value={s.settings.financingVisibleOnPage}
              onChange={(v) => setting("financingVisibleOnPage", v)}
              help="Only changes affordability at this stage if BNPL is also available at checkout."
            />
          </>
        )}
        {stage === "cart" && (
          <>
            <h3>Customer charges</h3>
            <div className="form-grid three">
              <NumberField
                label="Price ($)"
                value={s.product.price}
                onChange={(v) => product("price", v)}
                min={0.01}
              />
              <NumberField
                label="Shipping charge ($)"
                value={s.product.shipping}
                onChange={(v) => product("shipping", v)}
              />
              <NumberField
                label="Tax rate (%)"
                value={s.product.taxRate * 100}
                onChange={(v) => product("taxRate", v / 100)}
                max={100}
              />
              <NumberField
                label="Free-shipping threshold ($)"
                value={s.product.freeShippingThreshold}
                onChange={(v) => product("freeShippingThreshold", v)}
                help="0 disables threshold. Based on merchandise after discounts."
              />
              <Choice
                label="Shipping first disclosed"
                value={s.settings.shippingDisclosure}
                onChange={(v) => setting("shippingDisclosure", v)}
                options={[
                  { value: "pdp", label: "Product page" },
                  { value: "cart", label: "Cart" },
                  { value: "checkout", label: "Checkout" },
                ]}
              />
              <NumberField
                label="Delivery estimate (days)"
                value={s.product.deliveryDays}
                onChange={(v) => product("deliveryDays", v)}
                max={365}
              />
            </div>
            <h3>Promotions</h3>
            <div className="form-grid two">
              <Choice
                label="Discount mechanism"
                value={s.settings.discountMode}
                onChange={(v) => setting("discountMode", v)}
                options={[
                  { value: "none", label: "No discount available" },
                  { value: "automatic", label: "Automatic discount" },
                  { value: "coupon", label: "Promo code required" },
                ]}
              />
              <NumberField
                label="Discount (%)"
                value={s.product.discountPct * 100}
                onChange={(v) => product("discountPct", v / 100)}
                max={95}
              />
            </div>
            <Range
              label="Chance of finding a usable promo code"
              value={s.settings.couponSuccess}
              onChange={(v) => setting("couponSuccess", v)}
              help="Applies only to consumers who search when a code is available. This is an assumption, not a site observation."
            />
            <h3>Merchant economics</h3>
            <div className="form-grid two">
              <NumberField
                label="Unit cost / COGS ($)"
                value={s.product.unitCost}
                onChange={(v) => product("unitCost", v)}
              />
              <NumberField
                label="Fulfillment cost per order ($)"
                value={s.product.shippingCost}
                onChange={(v) => product("shippingCost", v)}
              />
              <NumberField
                label="Payment processing fee (%)"
                value={s.product.paymentFeeRate * 100}
                onChange={(v) => product("paymentFeeRate", v / 100)}
                max={100}
              />
              <NumberField
                label="Fixed payment fee ($)"
                value={s.product.paymentFeeFixed}
                onChange={(v) => product("paymentFeeFixed", v)}
                max={100}
              />
            </div>
            <p className="hint">
              One product unit per order. Tax is passed through. Processing fees
              apply to the charged total. Contribution excludes returns,
              overhead, repeat purchases, and lifetime value.
            </p>
          </>
        )}
        {stage === "checkout" && (
          <>
            <div className="form-grid two">
              <Toggle
                label="Guest checkout available"
                value={s.settings.guestCheckout}
                onChange={(v) => setting("guestCheckout", v)}
              />
              <Toggle
                label="Express wallets available"
                value={s.settings.wallets}
                onChange={(v) => setting("wallets", v)}
              />
              <Toggle
                label="PayPal available"
                value={s.settings.paypal}
                onChange={(v) => setting("paypal", v)}
              />
              <Toggle
                label="Buy now, pay later available"
                value={s.settings.bnpl}
                onChange={(v) => setting("bnpl", v)}
              />
            </div>
            <p className="hint">
              Card payment is always available. Edit the actual sequence below.
              Charge review occurs at the first shipping, payment, or review
              step; payment preference is checked at payment or review.
            </p>
            {s.steps.map((step, index) => (
              <div className="checkout-editor" key={step.id}>
                <div className="step-title">
                  <span>0{index + 1}</span>
                  <strong>{step.name}</strong>
                  <div className="actions">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${step.name} up`}
                      disabled={index === 0}
                      onClick={() =>
                        update((s) => {
                          const steps = [...s.steps];
                          [steps[index - 1], steps[index]] = [
                            steps[index],
                            steps[index - 1],
                          ];
                          return { ...s, steps };
                        })
                      }
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${step.name} down`}
                      disabled={index === s.steps.length - 1}
                      onClick={() =>
                        update((s) => {
                          const steps = [...s.steps];
                          [steps[index + 1], steps[index]] = [
                            steps[index],
                            steps[index + 1],
                          ];
                          return { ...s, steps };
                        })
                      }
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${step.name}`}
                      disabled={s.steps.length === 1}
                      onClick={() =>
                        update((s) => ({
                          ...s,
                          steps: s.steps.filter((v) => v.id !== step.id),
                        }))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="form-grid three">
                  <Field
                    label="Step name"
                    value={step.name}
                    onChange={(name) =>
                      update((s) => ({
                        ...s,
                        steps: s.steps.map((v) =>
                          v.id === step.id ? { ...v, name } : v,
                        ),
                      }))
                    }
                  />
                  <Choice
                    label="Step type"
                    value={step.type}
                    options={options([
                      "contact",
                      "address",
                      "shipping",
                      "payment",
                      "review",
                      "custom",
                    ])}
                    onChange={(type) =>
                      update((s) => ({
                        ...s,
                        steps: s.steps.map((v) =>
                          v.id === step.id
                            ? { ...v, type: type as typeof step.type }
                            : v,
                        ),
                      }))
                    }
                  />
                  {(
                    [
                      ["fields", "Required fields", 1, 50],
                      ["seconds", "Waiting time (seconds)", 0.1, 300],
                      ["errorRate", "Technical failure (%)", 0.1, 100],
                      ["clarity", "Clarity (%)", 1, 100],
                    ] as const
                  ).map(([key, label, increment, max]) => (
                    <NumberField
                      key={key}
                      label={label}
                      value={
                        step[key] *
                        (key === "errorRate" || key === "clarity" ? 100 : 1)
                      }
                      max={max}
                      step={increment}
                      onChange={(value) =>
                        update((s) => ({
                          ...s,
                          steps: s.steps.map((v) =>
                            v.id === step.id
                              ? {
                                  ...v,
                                  [key]:
                                    value /
                                    (key === "errorRate" || key === "clarity"
                                      ? 100
                                      : 1),
                                }
                              : v,
                          ),
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              disabled={s.steps.length >= 12}
              onClick={() =>
                update((s) => ({
                  ...s,
                  steps: [
                    ...s.steps,
                    {
                      id: crypto.randomUUID(),
                      name: "Additional step",
                      type: "custom",
                      fields: 2,
                      seconds: 5,
                      errorRate: 0.01,
                      clarity: 0.75,
                    },
                  ],
                }))
              }
            >
              <Plus />
              Add checkout step
            </Button>
          </>
        )}
      </TabsContent>
      <TabsContent value="sources" className="stack">
        <div className="upload-box">
          <Upload size={24} />
          <div>
            <strong>Upload creative or page evidence</strong>
            <p>
              PNG, JPEG, WebP, PDF, HTML, or text. Images/PDF: 8 MB. HTML: 2
              million characters. Text: 50,000 characters. 20 sources per
              journey.
            </p>
            <input
              aria-label="Upload source files"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.pdf,.html,.htm,.txt,.md"
              multiple
              disabled={!!busy || s.sources.length >= 20}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                void task("Uploading sources", async () => {
                  if (s.sources.length + files.length > 20)
                    throw Error("A journey can contain up to 20 sources.");
                  for (const file of files)
                    addSource(await uploadSource(file, stage));
                });
              }}
            />
          </div>
        </div>
        <div className="form-grid two">
          <div className="stack">
            <Field
              label="Public page URL"
              value={url}
              onChange={setUrl}
              help="The selected public URL is sent to Jina Reader. No signed links, account pages, or checkout sessions."
            />
            <Button
              variant="outline"
              disabled={!!busy || !url.trim() || s.sources.length >= 20}
              onClick={() =>
                task("Importing public page", async () => {
                  addSource(
                    await api<Source>("sources/import", { stage, url }),
                  );
                  setUrl("");
                })
              }
            >
              <Globe />
              Import page text
            </Button>
          </div>
          <div className="stack">
            <Field
              label="Paste additional page or flow text"
              value={pasted}
              onChange={setPasted}
              multiline
            />
            <Button
              variant="outline"
              disabled={!!busy || !pasted.trim() || s.sources.length >= 20}
              onClick={() =>
                task("Saving text", async () => {
                  addSource(
                    await api<Source>("sources/manual", {
                      stage,
                      name: "Additional source text",
                      text: pasted,
                    }),
                  );
                  setPasted("");
                })
              }
            >
              <Plus />
              Add text
            </Button>
          </div>
        </div>
        {sources.map((source) => (
          <article className="source-item" key={source.id}>
            <div className="source-item-head">
              <div>
                <strong>{source.name}</strong>
                <small>
                  {source.coverage} ·{" "}
                  {new Date(source.capturedAt).toLocaleString()}
                </small>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Detach ${source.name}`}
                disabled={!!busy}
                onClick={() => {
                  if (activeAnalysis?.sourceId === source.id)
                    setActiveAnalysis(null);
                  update((s) => ({
                    ...s,
                    sources: s.sources.filter((v) => v.id !== source.id),
                    analyses: s.analyses.filter(
                      (a) => a.sourceId !== source.id,
                    ),
                    featureBasis: Object.fromEntries(
                      Object.entries(s.featureBasis).filter(
                        ([, v]) => v.sourceId !== source.id,
                      ),
                    ),
                  }));
                }}
              >
                <Trash2 />
              </Button>
            </div>
            {source.kind === "image" && (
              <img
                className="source-image"
                src={source.url}
                alt={source.name}
              />
            )}
            {source.text && (
              <details>
                <summary>Read imported text</summary>
                <pre className="source-text">{source.text}</pre>
              </details>
            )}
            {source.kind === "pdf" && (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-link"
              >
                Download supplied PDF <ExternalLink size={14} />
              </a>
            )}
            <ul className="source-limitations">
              {source.limitations.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
            <div className="actions">
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() => analyze(source)}
              >
                <Sparkles />
                New GPT analysis · paid API
              </Button>
              <Button
                variant="ghost"
                disabled={!!busy}
                onClick={() =>
                  task("Recovering saved analyses", async () => {
                    const saved = await api<{ analyses: Analysis[] }>(
                      `sources/${source.id}`,
                    );
                    update((s) => ({
                      ...s,
                      analyses: [
                        ...s.analyses,
                        ...saved.analyses.filter(
                          (a) => !s.analyses.some((v) => v.id === a.id),
                        ),
                      ],
                    }));
                    if (saved.analyses[0]) setActiveAnalysis(saved.analyses[0]);
                    else
                      setError(
                        "No completed analysis is saved for this source. Recovery did not make a paid request.",
                      );
                  })
                }
              >
                Recover saved analysis
              </Button>
              {s.analyses
                .filter((a) => a.sourceId === source.id)
                .map((a, i) => (
                  <Button
                    key={a.id}
                    variant="ghost"
                    onClick={() => setActiveAnalysis(a)}
                  >
                    Review analysis {i + 1}
                  </Button>
                ))}
            </div>
          </article>
        ))}
        {!sources.length && (
          <p className="empty-state">No sources attached to this stage yet.</p>
        )}
        <p className="hint">
          Analysis sends the selected file plus the product and copy context to
          OpenAI. It does not change your simulation until you apply
          suggestions. Your API key stays in this tab and is forwarded only for
          the explicit request.
        </p>
      </TabsContent>
      <TabsContent value="assumptions" className="stack">
        <p className="hint">
          0% and 100% are rubric endpoints, not predicted conversion. Applied
          GPT scores remain subjective judgments. You can replace any score.
        </p>
        <div className="form-grid two">
          {FEATURE_FIELDS.filter(
            (f) =>
              f.stage === stage &&
              (f.key !== "adQueryMatch" ||
                s.acquisition.platform === "google_search"),
          ).map((field) => (
            <div className="feature-input" key={field.key}>
              <Range
                label={field.label}
                value={s.features[field.key]}
                onChange={(value) =>
                  update((s) => ({
                    ...s,
                    features: { ...s.features, [field.key]: value },
                    featureBasis: {
                      ...s.featureBasis,
                      [field.key]: { kind: "manual" },
                    },
                  }))
                }
                help={`${field.low} → ${field.high}`}
              />
              <span className="basis">
                {s.featureBasis[field.key]?.kind === "analysis"
                  ? "Applied from source analysis"
                  : "Manual assumption"}
              </span>
            </div>
          ))}
        </div>
        {stage === "checkout" && (
          <p className="hint">
            Checkout uses the explicit flow, settings, timing, and error inputs
            in the Inputs tab.
          </p>
        )}
      </TabsContent>
      {activeAnalysis && (
        <div className="analysis-review panel">
          <div className="section-heading">
            <h3>Review extracted observations</h3>
            <Button variant="ghost" onClick={() => setActiveAnalysis(null)}>
              Close review
            </Button>
          </div>
          <p>{activeAnalysis.summary}</p>
          {(!s.sources.some((v) => v.id === activeAnalysis.sourceId) ||
            JSON.stringify(activeAnalysis.context) !==
              JSON.stringify(
                evidenceContext(
                  s,
                  s.sources.find((v) => v.id === activeAnalysis.sourceId)!,
                ),
              )) && (
            <div className="notice">
              Product or journey context changed since this analysis. Review its
              observations against the current inputs.
            </div>
          )}
          <small>
            {activeAnalysis.model} · {activeAnalysis.responseId} · Cost
            available in your OpenAI billing; token usage retained in the
            export.
          </small>
          {activeAnalysis.observations.map((o) => (
            <div className="observation" key={o.feature}>
              <div>
                <strong>
                  {FEATURE_FIELDS.find((f) => f.key === o.feature)?.label}
                </strong>
                <span className="tag">
                  {o.value == null ? "Unknown" : percent(o.value, 0)} ·{" "}
                  {o.confidence} confidence
                </span>
                <p>{o.evidence}</p>
              </div>
              <Button
                variant="outline"
                disabled={o.value == null}
                onClick={() => applyObservation(activeAnalysis, o.feature)}
              >
                Apply
              </Button>
            </div>
          ))}
          {activeAnalysis.settings.map((o) => (
            <div className="observation" key={o.key}>
              <div>
                <strong>
                  {o.key}: {String(o.value ?? "Unknown")}
                </strong>
                <p>{o.evidence}</p>
              </div>
              <Button
                variant="outline"
                disabled={o.value == null}
                onClick={() => applySetting(activeAnalysis, o.key)}
              >
                Apply setting
              </Button>
            </div>
          ))}
          {activeAnalysis.checkoutSteps.length > 0 && (
            <div className="stack">
              <h4>Visible checkout steps</h4>
              {activeAnalysis.checkoutSteps.map((step, i) => (
                <div className="observation" key={i}>
                  <div>
                    <strong>
                      {step.name} · {step.fields ?? "unknown"} required fields
                    </strong>
                    <p>{step.evidence}</p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={s.steps.length >= 12}
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        steps: [
                          ...s.steps,
                          {
                            id: crypto.randomUUID(),
                            name: step.name,
                            type: step.type,
                            fields: step.fields ?? 2,
                            seconds: 5,
                            errorRate: 0.01,
                            clarity: 0.75,
                          },
                        ],
                      }))
                    }
                  >
                    Add draft step
                  </Button>
                </div>
              ))}
              <p className="hint">
                Added steps start with manual assumptions: 5 seconds waiting, 1%
                error, 75% clarity, and 2 fields if unknown. Review these and
                remove duplicate existing steps.
              </p>
            </div>
          )}
          <ul className="source-limitations">
            {activeAnalysis.unknowns.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}
    </Tabs>
  );
}
