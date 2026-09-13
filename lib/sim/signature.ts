import type { PopulationConfig, Scenario } from "./types";
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
    .join(",")}}`;
}
/** Non-security fingerprint for detecting changes to fitted behavioral inputs. */
export function calibrationSignature(
  population: PopulationConfig,
  scenario: Scenario,
): string {
  const { size: _, ...p } = population;
  const data = stable({
    population: p,
    product: scenario.product,
    acquisition: scenario.acquisition,
    features: scenario.features,
    settings: scenario.settings,
    steps: scenario.steps,
  });
  let a = 2166136261,
    b = 0x9e3779b9;
  for (let i = 0; i < data.length; i++) {
    a = Math.imul(a ^ data.charCodeAt(i), 16777619);
    b = Math.imul(b ^ data.charCodeAt(i), 0x85ebca6b);
  }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}
