# Product decisions

This portfolio application joins marketing judgment, measurement design, AI evidence extraction, and reproducible software. It makes a complete acquisition-to-order workflow inspectable rather than producing an unexplained creative score.

## Decisions that matter

1. **Structural noninterest is explicit.** A better ad cannot make every person want a product. This avoids a population in which every response is merely a different shade of likely purchase.
2. **Preference continuity survives the funnel.** The person who clicked remains the same person at the page, cart, and checkout. Budgets and tolerance do not get regenerated for each stage.
3. **Attention and demand are separate.** Incidental clicks can improve CTR without creating buyers. A creative recommendation should therefore consider final orders and economics.
4. **Comparisons are paired.** Common random numbers and persistent IDs show who is gained and lost under an intervention, reducing noise from comparing unrelated synthetic populations.
5. **Source evidence needs review.** AI can interpret a PDF or ad, but missing content and inferred usability must remain visible. Observations, evidence, unknowns, and human application are separate steps.
6. **The cost model follows the customer total.** Discounting can change threshold eligibility; tax and late shipping can affect affordability; fee and fulfillment costs can reverse an order-based recommendation.
7. **Calibration has a failure mode.** An impossible historical target is rejected. A successful baseline fit does not imply the model's population or individual explanations are true.
8. **Scale is implemented directly.** Ten million profiles are generated and evaluated, with bounded memory and a responsive background-worker architecture. The app does not inflate a small sample and call it ten million people.
9. **The research artifact is reproducible.** Frozen inputs, engine version, population seed, ID range, analysis receipts, and paired counts travel with an exported run.
10. **Model uncertainty is separate from simulation noise.** A narrow Monte Carlo interval can coexist with poor population assumptions. Sensitivity cases and real experiments address different questions.

## Demonstrating it in a hiring conversation

Start with one real ad and a supplied product-page PDF. Explain which observations came from the source and which inputs remain assumptions. Run the baseline with a price sweep, then compare a checkout-only intervention. Inspect one gained buyer and one lost buyer. Finish with contribution after media, a sensitivity case, and the real experiment you would run next.

A defensible description of the work is: “Built a reproducible consumer-journey simulator with ten million individual synthetic trajectories, multimodal evidence review, paired experiments, calibration, and unit economics.” Do not describe the project as predicting ten million real people or claim business lift without a measured deployment result.
