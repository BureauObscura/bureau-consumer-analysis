# Brightbank soda example study

Fictional product. Synthetic outputs from authored assumptions, not a sales forecast. Engine consumer-1.0.0; seed 20260915. Executed 2026-09-15T06:05:57.718Z.

## Question

How do product answers, checkout requirements, shipping and price change a modeled first purchase of a $28.80 orange-vanilla cane-sugar soda 12-pack?

## Journey results

Each row evaluated the same 10,000,000 individual IDs. Media spend is $95,000.00 per scenario at an assumed $9.50 CPM. Revenue includes customer shipping, excludes tax. Contribution after media subtracts product cost, fulfillment/shipping, payment fees and modeled ad spend. One purchase means one 12-pack.

| Journey | Clicks | Carts | Checkout | Orders | Revenue | Contribution after media |
|---|---:|---:|---:|---:|---:|---:|
| Baseline: limited PDP + account checkout | 207,282 | 33,552 | 22,634 | 4,843 | $171,435.17 | -$23,810.17 |
| Complete PDP answers | 207,282 | 46,936 | 31,951 | 6,811 | $241,180.61 | $5,197.07 |
| Guest checkout + wallets | 207,282 | 33,552 | 22,634 | 10,364 | $367,054.12 | $57,523.77 |
| Shorter checkout forms | 207,282 | 33,552 | 22,634 | 5,420 | $191,884.36 | -$15,305.07 |
| Free shipping | 207,282 | 33,552 | 22,634 | 6,790 | $193,083.84 | -$40,966.13 |
| Automatic 10% discount | 207,282 | 36,344 | 30,256 | 6,265 | $205,930.55 | -$18,253.75 |
| Complete PDP + guest + shorter forms | 207,282 | 46,936 | 31,951 | 16,263 | $576,042.57 | $144,403.33 |
| Combined + shipping shown on PDP | 207,282 | 38,739 | 26,439 | 18,837 | $667,014.75 | $182,100.73 |

## Paired buyers versus baseline

| Alternative | Buy both | Baseline only | Alternative only |
|---|---:|---:|---:|
| Complete PDP answers | 4,843 | 0 | 1,968 |
| Guest checkout + wallets | 4,843 | 0 | 5,521 |
| Shorter checkout forms | 4,843 | 0 | 577 |
| Free shipping | 4,843 | 0 | 1,947 |
| Automatic 10% discount | 4,674 | 169 | 1,591 |
| Complete PDP + guest + shorter forms | 4,843 | 0 | 11,420 |
| Combined + shipping shown on PDP | 4,839 | 4 | 13,998 |

## Price test

The complete-PDP, guest, shorter-forms journey is held constant. Each price evaluates the same 10M IDs. No price appears in the ad; therefore clicks must match. These six points are hypothetical PDP price changes; the supplied screenshot/PDF depicts the $28.80 anchor offer.

| Pack price | Orders | Revenue | Contribution after media |
|---|---:|---:|---:|
| $19.20 | 17,135 | $444,583.93 | -$32.16 |
| $24.00 | 17,362 | $532,652.30 | $80,826.71 |
| $28.80 | 16,263 | $576,042.57 | $144,403.33 |
| $33.60 | 14,861 | $596,763.79 | $191,954.84 |
| $38.40 | 13,370 | $600,308.38 | $224,592.84 |
| $43.20 | 11,993 | $595,336.15 | $246,762.37 |

## Price response detail

The $19.20 point produces fewer orders than $24.00 because this authored model penalizes late shipping in proportion to the merchandise price. The same $6.95 charge is a larger relative surprise on the cheaper pack. This is an interaction of model rules, not evidence that soda buyers prefer a higher price. The highest-contribution price is at the upper boundary of the tested range, so this study does not locate an interior optimum.

## Decision from this model

The highest contribution among the journey alternatives is **Combined + shipping shown on PDP**, at $182,100.73 after media. The highest among the tested price points is **$43.20 per 12-pack**, at $246,762.37. This is a ranking inside the supplied assumptions, not a validated market recommendation or a continuous price optimum. A positive modeled contribution does not establish real acquisition profitability.

Use this result to choose a real experiment: first measure the baseline funnel, then test a single checkout change at equal traffic allocation. Test price separately and track net contribution, refunds and repeat purchase. The simulated study supplies a test hypothesis, not an expected lift.

## What was actually exercised

- Portable configuration validates; all feature scores are manual.
- All 27 source assets uploaded; image and PDF bytes, hashes and private headers round-trip.
- Study saved and reopened with canonical owned source evidence.
- Missing API key rejected before paid GPT request.
- Full 10M run validates nested funnels, loss accounting, segments and paired outcomes.
- Structural noninterest never buys; every journey retains a convertible subset.
- Checkout-only interventions preserve every upstream funnel count.
- 20,000-ID partition replay produces identical results and paired comparisons.
- Individual records reproduce sampled outcomes and cent-based unit economics.
- Full 10M frozen run saved and read back unchanged.
- Six price points each evaluate 10M IDs with the same price-free ad.
- Three explicit 200,000-ID sensitivity checks completed.

See test-receipt.json and browser-test.md for exact execution coverage. Optional paid GPT extraction is not claimed tested without a provider key. No real ads, transactions or customer records were used.

## Interpretation limits

65% structural noninterest is an invented input. Active need is 28% of the remaining 35%, or 9.8% of the full population in expectation. There is no separate sugar-avoidance, flavor or dietary trait. Ad pixels and page text do not independently get read by 10 million language-model agents; their modeled effect comes from the explicit numeric inputs in assumptions.md. Reported reasons are model decisions, not customer quotes.

The price curve and sensitivity checks do not validate those assumptions. Read sensitivity.json for three 200,000-ID stress cases. The generic return-window behavior is not a perishable-goods model. This version excludes multipack baskets, repeat purchases, inventory depletion and lifetime value.
