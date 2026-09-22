"use client";
import { useMemo } from "react";
import { Range, NumberField, Stat, number, dollars, percent } from "./controls";
import {
  MAX_POPULATION,
  type PopulationConfig,
  type Scenario,
} from "@/lib/sim/types";
import { profileFor } from "@/lib/sim/engine";
const MIN_POPULATION = 1_000;
const POPULATION_STEP = 1_000;
const populationSize = (value: number) =>
  Number.isFinite(value)
    ? Math.min(
        MAX_POPULATION,
        Math.max(
          MIN_POPULATION,
          Math.round(value / POPULATION_STEP) * POPULATION_STEP,
        ),
      )
    : null;
export function Population({
  population: p,
  onChange,
  scenario,
}: {
  population: PopulationConfig;
  onChange: (p: PopulationConfig) => void;
  scenario: Scenario;
}) {
  const set = (key: keyof PopulationConfig, value: number) =>
    onChange({ ...p, [key]: value });
  const setPopulationSize = (value: number) => {
    const size = populationSize(value);
    if (size !== null) onChange({ ...p, size });
  };
  const records = useMemo(
    () =>
      [0, 41, 837, 912].map((id) =>
        profileFor(id, p, scenario.product.category),
      ),
    [p, scenario.product.category],
  );
  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <h2>Consumer population</h2>
          <p>
            Different needs, budgets, priorities, and tolerance for friction.
            Persistent traits follow each person through every step.
          </p>
        </div>
        <span className="tag">Adult consumer goods · USD</span>
      </div>
      <div className="panel">
        <div className="form-grid two">
          <Range
            label="Consumers to benchmark"
            value={p.size}
            onChange={setPopulationSize}
            min={MIN_POPULATION}
            max={MAX_POPULATION}
            step={POPULATION_STEP}
            format={number}
            help="Each selected ID is evaluated as a distinct synthetic consumer. Larger runs take longer but reduce simulation noise inside the authored model."
          />
          <NumberField
            label="Exact consumer count"
            value={p.size}
            onChange={setPopulationSize}
            min={MIN_POPULATION}
            max={MAX_POPULATION}
            step={POPULATION_STEP}
            help={`Maximum ${number(MAX_POPULATION)} consumers.`}
          />
        </div>
        <div className="form-grid two">
          <NumberField
            label="Population seed"
            value={p.seed}
            onChange={(v) => set("seed", v)}
            min={0}
            max={4294967295}
            step={1}
            help="Same seed + inputs = same people and decisions."
          />
          <NumberField
            label="Median current product budget ($)"
            value={p.medianBudget}
            onChange={(v) => set("medianBudget", v)}
            min={1}
            help="A distribution of available category budgets, not household income. Budgets stay fixed when you change price."
          />
        </div>
      </div>
      <div className="panel">
        <h3>Category relevance & purchase need</h3>
        <div
          className="population-bar"
          aria-label="Configured category relevance"
        >
          <i style={{ width: `${p.excludedShare * 100}%` }} />
          <i
            style={{
              width: `${(1 - p.excludedShare) * (1 - p.activeNeedShare) * 100}%`,
            }}
          />
          <i
            style={{
              width: `${(1 - p.excludedShare) * p.activeNeedShare * 100}%`,
            }}
          />
        </div>
        <div className="stats-grid three">
          <Stat
            label="No interest in this category"
            value={number(p.size * p.excludedShare)}
            detail="Purchase probability is exactly zero"
          />
          <Stat
            label="Relevant, no active need"
            value={number(
              p.size * (1 - p.excludedShare) * (1 - p.activeNeedShare),
            )}
            detail="May defer, investigate, or buy"
          />
          <Stat
            label="Relevant with active need"
            value={number(p.size * (1 - p.excludedShare) * p.activeNeedShare)}
            detail="Still subject to budget and journey barriers"
          />
        </div>
        <p className="hint">
          These are expected counts from your configured shares. The actual
          seeded population varies slightly and is reported after a run.
        </p>
        <div className="form-grid two">
          <Range
            label="Structurally uninterested share"
            value={p.excludedShare}
            onChange={(v) => set("excludedShare", v)}
            help="Cannot be persuaded to purchase this category within the simulated journey. Incidental clicks can still occur."
          />
          <Range
            label="Active need among relevant consumers"
            value={p.activeNeedShare}
            onChange={(v) => set("activeNeedShare", v)}
            help="Only applies to the relevant portion. The remaining people have dormant rather than zero category interest."
          />
          <Range
            label="Will not purchase online"
            value={p.offlineOnlyShare}
            onChange={(v) => set("offlineOnlyShare", v)}
            help="Can research after an ad click but will not transact in this online journey."
          />
          <Range
            label="Already familiar with the brand"
            value={p.familiarShare}
            onChange={(v) => set("familiarShare", v)}
            help="Use this to represent a warmer audience. It does not guarantee purchase."
          />
        </div>
      </div>
      <div className="panel">
        <h3>Shopping preferences & context</h3>
        <div className="form-grid two">
          <Range
            label="Mobile share"
            value={p.mobileShare}
            onChange={(v) => set("mobileShare", v)}
          />
          <Range
            label="Price sensitivity multiplier"
            value={p.priceSensitivity}
            onChange={(v) => set("priceSensitivity", v)}
            min={0.1}
            max={5}
            step={0.05}
            format={(v) => `${v.toFixed(2)}×`}
            help="Changes response to price relative to each person's fixed budget."
          />
          <Range
            label="Research and information need"
            value={p.deliberation}
            onChange={(v) => set("deliberation", v)}
            help="Shifts the population's need for evidence and product answers."
          />
          <Range
            label="Merchant skepticism"
            value={p.distrust}
            onChange={(v) => set("distrust", v)}
            help="Shifts reassurance needs; familiarity and evidence still vary between people."
          />
        </div>
        <p className="hint">
          Each person also has individual deal-seeking, patience, urgency,
          privacy resistance, preferred payment, appeal preference, incumbent
          satisfaction, attention, and novelty preference. Traits share latent
          inputs so they are not independent sliders assigned to cloned
          personas.
        </p>
      </div>
      <div className="panel">
        <h3>Generated record preview</h3>
        <div className="record-preview">
          {records.map((r) => (
            <div key={r.id}>
              <span className="eyebrow">
                CAD / {String(r.id + 1).padStart(8, "0")}
              </span>
              <strong>{dollars(r.budget)} budget</strong>
              <p>
                {r.relevance} need state · {r.appeal} appeal
                <br />
                {r.mobile ? "Mobile" : "Desktop"} · {r.preferredPayment}
                <br />
                Information need {percent(r.informationNeed, 0)}
                <br />
                Deal seeking {percent(r.dealSeeking, 0)}
                <br />
                {r.offlineOnly
                  ? "Will not buy online"
                  : "Online purchase possible"}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="notice">
        Default population shares and behavioral coefficients are authored
        assumptions. Larger synthetic populations increase simulation
        resolution; they do not make the population representative of ten
        million or one hundred million real people. Use historical funnel data
        and sensitivity tests to challenge the assumptions.
      </div>
    </div>
  );
}
