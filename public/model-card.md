# Consumer Analysis Division model card

Engine: `consumer-1.0.0`  
Purpose: compare specified consumer-goods purchase journeys under explicit synthetic population assumptions.

## Intended use

Develop hypotheses about an ad, product page, offer, or checkout; identify which assumptions drive a recommendation; design follow-up experiments; demonstrate marketing measurement and AI product judgment.

This is not a real consumer panel, an observed demand forecast, a validated media-planning system, or ten million LLM interviews. It has no privileged knowledge of real people's preferences.

## Unit of analysis

One individually generated adult synthetic consumer receives one modeled ad impression and may click, add one product unit to cart, enter checkout, and purchase once. A terminal exit stops that trajectory. The current version does not include repeat sessions, household negotiation, competition dynamics, ad auctions, platform delivery optimization, abandoned-cart messaging, subscriptions, returns, or lifetime value.

Up to 10,000,000 consumer IDs are evaluated directly. IDs displayed in the interface are one-based; engine IDs start at zero. A run exports `startId`, `planned`, `processed`, seed, engine version, population, and frozen scenarios. Partial runs are not extrapolated to the planned population.

## Population generation

The default population has a 55% structural category exclusion, active need among 25% of the remaining category-relevant people, 6% unwillingness to transact online, an 80% mobile share, 8% brand familiarity, and a $95 median category budget. These values are **authored defaults**, not measured market statistics.

Category state is one of:

- **Excluded:** shopping-interest click probability and purchase probability are zero. An incidental curiosity/accidental click is still possible.
- **Dormant:** category interest exists without a strong immediate need; price, information, and the journey can still affect purchase.
- **Active:** current purchase need is present, but budgets, alternatives, trust, and friction still matter.

The profile includes affinity, need, lognormal budget, price sensitivity, deal seeking, reassurance need, information need, brand familiarity, incumbent satisfaction, novelty preference, urgency, attention, patience, privacy resistance, social-proof reliance, device, preferred payment, and primary appeal.

Shared latent inputs create correlated traits. Budget has log standard deviation 0.85 and a $3 floor. Lower latent resources increase price sensitivity and deal seeking. Research tendency and risk sensitivity affect information and reassurance needs. Those relationships are authored hypotheses rather than fitted population correlations. The model does not assign protected-demographic stereotypes.

The category domain affects relevance draws. Budgets and other stable traits do not change when the tested price changes. A paired run requires the same category in every scenario.

## Randomness and reproducibility

The generator is Philox4x32-10, using the published Random123 constants and known-answer vectors. Consumer ID, random block, domain, and seed determine the values. There is no single mutable global random stream.

Profile, ad/PDP, cart, information, payment, and checkout-step domains are separated. Checkout steps use stable IDs so editing one step does not shift unrelated step draws. Step reordering still changes cumulative effort and where charges become visible. Final-charge and payment-method draws use fixed semantic streams.

Comparisons use common random numbers. Each person retains the same traits and relevant random draws across variants. Paired outcomes count people who buy in both journeys, baseline only, alternative only, or neither.

Cross-runtime floating-point libraries can differ at extreme decision boundaries. The engine version and seed identify the model; exact bitwise equality across all future runtimes is not guaranteed. The implementation's repeat-run and partition tests operate within the tested runtime.

## Decision sequence

1. **Ad:** a mixed utility calculation combines baseline propensity, need/relevance, benefit clarity, attention, claim credibility, familiarity, visible price, offer visibility, platform context, and prior-exposure fatigue. A separate low-probability incidental-click channel can create visits without shopping intent.
2. **Product page eligibility:** structural category exclusion and unwillingness to purchase online stop purchases. An unavailable product cannot enter cart. The consumer can reject a known price outside their budget.
3. **Information:** consumers can seek product answers. Recovery depends on the configured information and answer access. Searching is not automatically successful.
4. **Add to cart:** need, affinity, appeal, price relative to budget, trust, evidence, existing alternatives, unresolved questions, page usability, waiting, mobile fit, and consistency with the ad determine a probability.
5. **Cart:** new questions and discount searching can create detours. Discount discovery is configured, not observed. Shipping surprise, delivery fit, interruptions, and remaining information needs affect progression.
6. **Account:** mandatory account creation introduces a distinct acceptance decision influenced by privacy, patience, and familiarity.
7. **Charges and payment:** final tax/shipping can exceed budget or reduce acceptance. A missing preferred payment method may cause exit or fallback to another method. BNPL affects PDP affordability only when it is both offered at checkout and visible on the page.
8. **Checkout steps:** field count, waiting time, clarity, device, patience, cumulative effort, and configured technical errors determine progression at each step.
9. **Order:** a successful trajectory records one purchase and its revenue and contribution.

Probabilities generally use a sigmoid utility. Structural gates are exact rather than sigmoid approximations. The default intercepts are ad −4.1, PDP −1.7, cart 1.1, checkout 1.6. Other coefficients appear directly in `lib/sim/engine.ts` and remain authored unless the implementation is changed and versioned.

The platform adjustments are hypotheses: search uses explicit commercial intent and query-to-offer match; TikTok gives additional weight to novelty/attention; Facebook adds an evidence/reassurance interaction. These are not measured cross-platform performance benchmarks, and the simulation does not predict ad delivery or auction prices.

The exposed population is supplied by the user. The simulator does not infer who actually uses a platform or how an ad network would target them.

## Detailed input contract

| Group         | Inputs                                                                                                                                     | How they enter                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Ad evidence   | Creative images, PDF storyboard, headline, body/transcript, CTA                                                                            | Reviewed evidence extraction maps visible content to rubric features; raw upload alone has no effect |
| Acquisition   | Platform, search query, commercial intent, visible price, exposure number, CPM                                                             | Platform/intent utility, fatigue context, price screening, modeled media cost                        |
| Product       | Title, description, category, main appeal, availability                                                                                    | Context for extraction, category-specific profile draw, appeal match, stock gate                     |
| Price         | Selling price, automatic/code discount, free-shipping threshold                                                                            | Known price, budget constraint, price utility, final total, order economics                          |
| PDP           | Full copy, images/PDF/HTML/text/URL, information, answer access, proof, trust, match, clarity, usability                                   | Evidence review and corresponding PDP utility terms                                                  |
| Page behavior | Load/wait time, mobile fit, visible returns, return window, visible financing                                                              | Waiting/device friction, policy reassurance, visible affordability                                   |
| Offer         | Shipping charge, first disclosure, delivery days, tax, code-search success                                                                 | Stage-specific information, surprise, urgency fit, discount recovery, final budget                   |
| Cart          | Clarity, information access, coupon emphasis, upsell interruption                                                                          | Information/code detours and cart progression                                                        |
| Checkout      | Guest access, wallets, PayPal, BNPL, ordered steps, fields, waiting, clarity, error rate                                                   | Sequential account, payment, and step decisions                                                      |
| Economics     | Unit cost, fulfillment, payment percentage/fixed fee, CPM                                                                                  | Contribution and media cost; merchant costs do not alter consumer preferences                        |
| Population    | Size, seed, no-interest share, active-need share, offline-only share, budget, device, familiarity, research, skepticism, price sensitivity | Stable heterogeneous profiles                                                                        |

Coupon prominence can cause searches even if the seller offers no discount. An automatic discount avoids the search detour. A 0% automatic discount produces neither discounted orders nor a positive price-reduction benefit.

The free-shipping threshold uses merchandise value after discount. A discount can therefore cause a shopper to lose free shipping. This is intentional and should be checked in offer comparisons.

The model's budget is category purchasing capacity for this occasion, not measured income. BNPL's affordability multiplier is a simplifying behavioral assumption, not a creditworthiness or financing recommendation.

## Source evidence and AI

The optional evaluator is GPT-5.6 Terra through the Responses API with strict structured output, `store:false`, no browsing/tools, a bounded response, and one explicit request per analysis. Uploaded text is treated as untrusted source content. The model is instructed not to follow embedded instructions or fabricate customer testimony.

Images and PDFs supply visual evidence. HTML is parsed without executing scripts or loading resources. Hidden fields are excluded from shopper-field extraction; selects, textareas, visible requirements, and CTA labels are retained. Public URLs are fetched through the fixed Jina Reader endpoint. Imported text is capped at 50,000 characters, and coverage warnings are retained.

A still image cannot establish load time, error frequency, successful payment, coupon recovery, or unseen steps. These remain manual assumptions. Missing payment logos or a cropped guest option do not establish absence. A checkout screenshot cannot establish that shipping was never disclosed earlier. First-disclosure timing remains a manual journey setting.

Each analysis stores the source ID/hash, exact supplied context, context hash, model/response identifiers, observation evidence, unknowns, token usage when available, and timestamp. It does not store the API key. Dollar cost remains unknown in the app; use provider billing to reconcile it.

Applied feature provenance must match an attached owned source, stored analysis, and the exact observation value. Editing a score manually clears that attribution. Removing a source detaches its analyses and attribution, leaving the current numeric value as a manual assumption. Analysis context changes are shown during review.

A lost response can be recovered from saved completed analyses without a new paid request. Requests with an uncertain outcome are not retried automatically. Request IDs are bound to their source context. A deliberate new analysis can incur a new charge.

## Economics

Money is rounded at the per-order merchandise, tax, fee, and contribution steps before aggregate accumulation.

- Revenue = discounted merchandise + charged shipping, excluding tax.
- Customer total = merchandise + shipping + configured tax on both.
- Payment fee = configured percentage of the charged total + fixed fee.
- Contribution before media = revenue − unit cost − fulfillment cost − payment fee.
- Media cost = individually exposed consumers × configured CPM / 1,000.
- Contribution after media = contribution before media − media cost.
- Acquisition cost = media cost / purchased orders, undefined at zero orders.

This is a scenario model, not a jurisdiction-aware tax service. Setting tax to zero tests a hypothetical total-charge difference. Whether tax applies is outside the model. The model does not include overhead, refunds/returns, inventory carry, repeat orders, or lifetime value.

**Exposure number** represents prior-view context for the one current impression. It changes fatigue but does not generate additional impressions or charge for historical media.

## Calibration

Historical counts must be positive, integer, and nested: exposed ≥ clickers ≥ carts ≥ checkout ≥ purchases. Counts must share a compatible population, time window, identity definition, and attribution rule. Zero-event stages are unsupported by this fitting method.

The engine uses at most 200,000 seeded consumers and sequential bisection of the four intercepts. It checks attainable bounds before fitting a stage, rejects absent stage entrants, and reports impossible historical targets without applying a new coefficient set. It stores historical and achieved counts, the fitting sample size, seed, timestamp, baseline ID, and a fixed-size fingerprint of fitted inputs.

A baseline fit matches aggregate rates; it does not identify all preference distributions, correlations, platform adjustments, or price-response coefficients. It is not out-of-sample validation. Editing the baseline or population marks the calibration changed. Coefficients stay frozen for comparisons until explicitly refitted.

## Comparison and uncertainty

Primary conversion is purchases per exposed consumer. When an ad changes, its visitors are a different selected subset; a higher PDP conversion rate alone need not mean a better complete journey.

Paired buyer gains and losses are shown alongside contribution. The approximate 95% Monte Carlo interval uses the paired purchase difference variance. It measures randomness conditional on the model and fixed inputs. It does **not** include parameter uncertainty, evaluator disagreement, population misspecification, market drift, or uncertainty about actual demand.

Price sweeps keep every other baseline input and personal budget fixed. The displayed endpoint log elasticity is `log(Q_high/Q_low) / log(P_high/P_low)`. It is undefined at zero-order endpoints. If manually edited variants change other inputs too, the curve is not an isolated price-effect estimate.

Sensitivity checks evaluate seven disclosed cases with up to 200,000 consumers each: current assumptions, higher/lower category relevance, lower/higher budgets, greater price sensitivity, and greater skepticism. Cases are not assigned probabilities. Their frozen inputs are exported with their results.

Exit labels identify a hard gate or a material negative modeled factor. If no sufficiently material barrier explains a PDP rejection, it is labeled deferred. Labels are not causal proof or interview findings. Consumer traces display the actual decision draw and selected model factors, not invented first-person quotes.

## Storage and privacy

Binary evidence and frozen runs are private R2 objects. D1 stores owner-scoped source metadata, analyses, requests, studies, and run summaries. Source and analysis metadata are rehydrated from owned records before saving. Signed-in identity is established by the Sites dispatcher; local previews use the starter's loopback-only test identity.

All writes require a same-origin request. Uploads and request bodies are bounded. Source responses use private caching and `nosniff`; PDFs download as attachments. Uploaded HTML is never served as executable HTML. URL policy rejects local/IP destinations, embedded credentials, non-HTTPS schemes, and common signed-query fields. Jina Reader receives only the explicitly imported public URL.

Keys live in tab memory and are sent only for explicit source analysis. Exported source references do not grant access to the underlying private files. Copying a study to another account/site requires uploading its evidence there.

## Validation and gaps

The repository includes meaningful engine regression tests, an actual built-worker protocol test, local API integration tests, and a full-population benchmark script. See `docs/VALIDATION.md` for the executed checks.

This build has not validated predictive performance against real purchases. Paid live source analysis requires the user's own API key and was not exercised with a real billed request during implementation. No browser visual/interaction QA was requested. The optional WebMCP tools are feature-detected; a supported validation context was not available, so their live registration is unverified.

Before using results to allocate a real campaign budget: compare baseline predictions to withheld real data, validate variant rankings in actual experiments, check population and attribution definitions, and rerun sensitivity around plausible parameter ranges. Treat synthetic reasons as questions to investigate.

## References

- Train, _Discrete Choice Methods with Simulation_, [mixed logit chapter](https://eml.berkeley.edu/books/choice2nd/Ch06_p134-150.pdf): conceptual background for heterogeneous choice probabilities. The coefficients here are not taken from an estimated Train model.
- Grimm et al., [ODD protocol](https://jasss.soc.surrey.ac.uk/23/2/7.html): model-documentation structure.
- [Random123](https://random123.com/) and [Philox source](https://github.com/DEShawResearch/random123/blob/main/include/Random123/philox.h): counter-based generator and known-answer validation.
- [Common random numbers in simulation comparisons](https://informs-sim.org/wsc03papers/008.pdf): comparison design.
- [Generative Agent Simulations of 1,000 People](https://arxiv.org/abs/2411.10109): an interview-grounded research example, not evidence that this purchase model is validated.
- [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs), [file inputs](https://developers.openai.com/api/docs/guides/file-inputs), and [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra): evaluator interface.
- [Jina Reader](https://jina.ai/reader/): public-text import provider.
