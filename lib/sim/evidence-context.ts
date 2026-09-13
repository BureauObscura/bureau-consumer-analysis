import type { Scenario, Source } from "./types";
export function evidenceContext(
  scenario: Scenario,
  source: Source,
): Record<string, unknown> {
  return {
    sourceId: source.id,
    sourceHash: source.hash,
    stage: source.stage,
    productContext: {
      name: scenario.product.name,
      category: scenario.product.category,
      description: scenario.product.description,
      appeal: scenario.product.appeal,
    },
    ad: scenario.acquisition,
    pageCopy: scenario.pageCopy,
    currentCheckout: scenario.steps.map((s) => ({
      name: s.name,
      type: s.type,
    })),
    promptVersion: "evidence-1.0.0",
  };
}
