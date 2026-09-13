# Validation record

Implementation validation: 2026-09-12. Engine `consumer-1.0.0`.

## Executed

- **TypeScript:** `npm run typecheck` passed.
- **Engine regression suite:** 14 tests passed, including official Philox vectors, hard exclusions, sequential stage isolation, identical alternatives, partitions, record replay, cent rounding, calibration boundaries, artifact validation, URL policy, and inert HTML.
- **Built-worker contract:** actual 1,000,000-consumer execution matched the synchronous engine. Compact progress, concurrent-run rejection, invalid operations, and consumer ID limits passed. This exercised the built worker script in a Node VM, not a browser interaction test.
- **Local API integration:** app HTTP response, unauthenticated access, origin enforcement, foreign-owner records, image bytes and response headers, invalid images, HTML controls, private URL rejection, canonical source metadata, provenance validation, concurrent duplicate saves, and missing-key rejection passed. Uses local D1/R2 and the starter's loopback sign-in. No paid provider requests were made.
- **Worker bindings:** D1 `DB` and R2 `BUCKET` type generation succeeded.
- **Production build:** Vinext/Cloudflare output built successfully with migration artifacts.

## Full-population benchmark

Command: `node scripts/benchmark.mjs 10000000`.

The synchronous core evaluated **10,000,000 actual consumer IDs against two journeys** in **14.046 seconds**. The snapshots reported 83,148,800 bytes RSS and 8,462,952 bytes used heap at completion. These are point-in-time process measurements, not a browser performance guarantee or a full peak-memory profile.

| Result                    | Current journey | Guest checkout + wallets |
| ------------------------- | --------------: | -----------------------: |
| Exposed consumers         |      10,000,000 |               10,000,000 |
| Clicked                   |         176,564 |                  176,564 |
| Added to cart             |          30,189 |                   30,189 |
| Started checkout          |          21,715 |                   21,715 |
| Purchased                 |           6,955 |                   13,061 |
| Revenue                   |     $662,175.00 |            $1,242,993.80 |
| Contribution before media |     $396,120.95 |              $743,379.53 |
| Media spend               |     $120,000.00 |              $120,000.00 |

Paired outcomes: 6,955 purchased in both; 0 baseline-only; 6,106 alternative-only; 9,986,939 neither. Earlier-stage counts remain identical for the checkout-only intervention.

These are synthetic benchmark outputs from the supplied default assumptions. They are not demonstrated commercial lift or real customer behavior. The fixture remains reproducible through the benchmark script rather than being preloaded as fabricated app results.

## Review findings corrected

- Checkout changes leaking into upstream affordability and information decisions.
- Impossible calibration targets being labeled fitted.
- Fitted-input signatures and subrange ID provenance missing from exports.
- Zero-percent discounts being treated as a benefit.
- Fractional-cent accumulation in economics.
- Duplicate concurrent saves deleting the winning run's R2 object.
- Old async source completions crossing between studies.
- Save responses clearing newer unsaved edits.
- Sensitivity exports mixing old results with current inputs.
- Detached evidence recreating invalid analysis attribution.
- Hidden HTML controls being counted as shopper fields.
- Merchant costs being supplied to the source evaluator as shopper context.
- Contextless source-analysis receipts and incomplete setting validation.

## Not established by these checks

- Predictive accuracy, population representativeness, or causal validity against real purchases.
- Live paid GPT analysis with the user's API key.
- A complete interactive rendering of imported HTML or live checkout pages.
- Browser visual, accessibility, or end-to-end interaction QA. Browser interaction testing has not been completed.
- Live WebMCP registration/execution. No supported validation context was available; the two optional browser tools are feature-detected and were not claimed verified.

A successful build and private deployment are distinct from the open validation gaps above.
