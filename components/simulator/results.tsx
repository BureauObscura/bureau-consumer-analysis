"use client";
import { PriceChart } from "./price-chart";
import { useMemo, useState } from "react";
import { Download, Search, ArrowRight, Check, Save } from "lucide-react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Button,
  Choice,
  NumberField,
  Stat,
  dollars,
  number,
  percent,
  options,
} from "./controls";
import { REASON_LABELS } from "@/lib/sim/defaults";
import { traceConsumer } from "@/lib/sim/engine";
import {
  ENGINE_VERSION,
  type RunResult,
  type Reason,
  type Stage,
  type SimulationResult,
} from "@/lib/sim/types";
import { download } from "@/lib/client-api";
const funnelKeys = [
  "exposed",
  "clicks",
  "carts",
  "checkout",
  "purchases",
] as const;
const funnelNames = [
  "Ad exposed",
  "Clicked",
  "Added to cart",
  "Started checkout",
  "Purchased",
];
const rate = (n: number, d: number) => (d ? percent(n / d) : "—");
const safeCsv = (v: unknown) =>
  `"${String(v)
    .replace(/^[=+@\-]/, "'$&")
    .replaceAll('"', '""')}"`;
export function exportRun(run: RunResult) {
  download(`consumer-run-${run.id}.json`, JSON.stringify(run, null, 2));
}
function exportCSV(run: RunResult) {
  const rows = [
    [
      "scenario",
      "population",
      "clicks",
      "carts",
      "checkout",
      "orders",
      "purchase_rate",
      "revenue_usd",
      "contribution_before_ads_usd",
      "ad_spend_usd",
      "net_contribution_usd",
      "status",
      "engine_version",
    ],
    ...run.results.map((r) => [
      r.scenarioName,
      r.exposed,
      r.clicks,
      r.carts,
      r.checkout,
      r.purchases,
      r.purchases / r.exposed,
      r.revenue,
      r.contribution,
      r.adSpend,
      r.contribution - r.adSpend,
      run.status,
      run.version,
    ]),
  ];
  download(
    `consumer-comparison-${run.id}.csv`,
    rows.map((r) => r.map(safeCsv).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
function exportReport(run: RunResult) {
  download(
    `consumer-study-${run.id}.md`,
    [
      `# Bureau Obscura | Consumer Analysis Division`,
      ``,
      `Date: ${run.createdAt}. Engine: ${run.version}. Status: ${run.status}.`,
      ``,
      `Individually evaluated consumers: ${number(run.processed)} of ${number(run.planned)}. Seed: ${run.population.seed}. Consumer IDs: ${run.startId + 1} through ${run.startId + run.processed}.`,
      ``,
      `This is an assumption-driven synthetic simulation, not observed consumer research or a demand forecast. Calibration: ${run.coefficients.provenance}.`,
      ``,
      `| Journey | Clicks | Orders | Revenue | Contribution after media |`,
      `|---|---:|---:|---:|---:|`,
      ...run.results.map(
        (r) =>
          `| ${r.scenarioName.replaceAll("|", "/")} | ${number(r.clicks)} | ${number(r.purchases)} | ${dollars(r.revenue)} | ${dollars(r.contribution - r.adSpend)} |`,
      ),
      ``,
      `Pairs use the same consumers and random streams. Compare purchase rate per exposed person. Conditional downstream rates describe different selected visitors if the ad changes.`,
      ``,
      `## Population assumptions`,
      ``,
      `\`\`\`json`,
      JSON.stringify(run.population, null, 2),
      `\`\`\``,
      ``,
      `## Source coverage`,
      ...run.scenarios.flatMap((s) => [
        ``,
        `### ${s.name}`,
        ...s.sources.map(
          (a) =>
            `- ${a.name} (${a.coverage}); SHA-256 ${a.hash}. ${a.limitations.join(" ")}`,
        ),
      ]),
      ``,
      `The companion JSON includes all inputs, source references, analysis receipts, counts, and paired outcomes needed to replay the run. Merchant contribution includes unit, fulfillment, payment, and media costs; it excludes returns, overhead, repeat purchases, and lifetime value.`,
    ].join("\n"),
    "text/markdown;charset=utf-8",
  );
}
export function Results({
  run,
  save,
  busy,
}: {
  run: RunResult;
  save: () => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState(0),
    [lossStage, setLossStage] = useState<Stage>("pdp"),
    [segment, setSegment] =
      useState<keyof SimulationResult["segments"]>("relevance"),
    [consumerId, setConsumerId] = useState(run.startId + 1),
    [inspect, setInspect] = useState(run.startId),
    [traceScenario, setTraceScenario] = useState(0);
  const r = run.results[Math.min(selected, run.results.length - 1)];
  const losses = Object.entries(r.losses[lossStage])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const lossTotal = losses.reduce((n, [, v]) => n + v, 0);
  const trace = useMemo(
    () =>
      run.version === ENGINE_VERSION &&
      inspect >= run.startId &&
      inspect < run.startId + run.processed
        ? traceConsumer(
            inspect,
            run.scenarios[Math.min(traceScenario, run.scenarios.length - 1)],
            run.population,
            run.coefficients,
          )
        : null,
    [
      run.version,
      run.processed,
      run.startId,
      run.scenarios,
      run.population,
      run.coefficients,
      inspect,
      traceScenario,
    ],
  );
  const best = [...run.results].sort(
    (a, b) => b.contribution - b.adSpend - (a.contribution - a.adSpend),
  )[0];
  return (
    <div className="stack results-view">
      <div className="section-heading">
        <div>
          <h2>Simulation results</h2>
          <p>
            {run.scenarios[0].product.name} · {number(run.processed)}{" "}
            individually evaluated consumers ·{" "}
            {(run.elapsedMs / 1000).toFixed(1)} seconds · seed{" "}
            {run.population.seed}
          </p>
        </div>
        <div className="actions">
          <span className={`tag ${run.status === "partial" ? "amber" : ""}`}>
            {run.status === "complete" ? "Complete" : "Partial run"}
          </span>
          <Button
            variant="outline"
            disabled={busy || !run.processed}
            onClick={save}
          >
            <Save />
            Save run
          </Button>
          <Button variant="outline" onClick={() => exportRun(run)}>
            <Download />
            JSON
          </Button>
          <Button variant="outline" onClick={() => exportCSV(run)}>
            CSV
          </Button>
          <Button variant="outline" onClick={() => exportReport(run)}>
            Report
          </Button>
        </div>
      </div>
      {run.status === "partial" && (
        <div className="notice">
          These are counts from {number(run.processed)} processed consumers.
          They have not been scaled to {number(run.planned)}.
        </div>
      )}
      {run.results.length > 1 && (
        <Choice
          label="Journey shown below"
          value={String(selected)}
          onChange={(v) => setSelected(Number(v))}
          options={run.results.map((r, i) => ({
            value: String(i),
            label: r.scenarioName,
          }))}
        />
      )}
      <div className="funnel">
        {funnelKeys.map((key, i) => {
          const value = r[key],
            previous = i ? r[funnelKeys[i - 1]] : r.exposed;
          return (
            <div className="funnel-cell" key={key}>
              <span className="eyebrow">
                0{i + 1} · {funnelNames[i]}
              </span>
              <strong>{number(value)}</strong>
              <div className="funnel-meter">
                <div
                  style={{
                    width: `${previous ? (value / previous) * 100 : 0}%`,
                  }}
                />
              </div>
              <small>
                {i
                  ? `${rate(value, previous)} of previous stage`
                  : `One impression per person`}
              </small>
              {i > 0 && (
                <span className="funnel-loss">
                  {number(previous - value)} did not advance
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="stats-grid">
        <Stat
          label="Purchase rate / exposed"
          value={rate(r.purchases, r.exposed)}
          detail="Primary conversion denominator"
        />
        <Stat
          label="Revenue"
          value={dollars(r.revenue)}
          detail="Merchandise + shipping; excludes tax"
        />
        <Stat
          label="Contribution after media"
          value={dollars(r.contribution - r.adSpend)}
          detail="Includes modeled merchant costs"
        />
        <Stat
          label="Acquisition cost / order"
          value={r.purchases ? dollars(r.adSpend / r.purchases) : "—"}
          detail={`${dollars(r.adSpend)} media spend`}
        />
      </div>
      <div className="panel">
        <div className="section-heading">
          <h3>Demand & detours</h3>
          <span className="tag">Synthetic behavior</span>
        </div>
        <div className="detail-stats">
          <Stat
            label="Category relevant"
            value={number(r.relevant)}
            detail={`${number(r.exposed - r.relevant)} structurally uninterested`}
          />
          <Stat label="Active purchase need" value={number(r.activeNeed)} />
          <Stat
            label="Incidental clicks"
            value={number(r.nonshoppingClicks)}
            detail="Curiosity or accidental attention"
          />
          <Stat
            label="Sought more information"
            value={number(r.informationSought)}
            detail={`${number(r.informationRecovered)} found an answer`}
          />
          <Stat
            label="Searched for a code"
            value={number(r.couponSought)}
            detail={`${number(r.couponFound)} found one`}
          />
          <Stat
            label="Discounted orders"
            value={number(r.discountedOrders)}
            detail={`${r.purchases ? dollars(r.revenue / r.purchases) : "—"} average order revenue`}
          />
        </div>
      </div>
      {run.results.length > 1 && (
        <div className="panel">
          <div className="section-heading">
            <div>
              <h3>Paired journey comparison</h3>
              <p>
                Same people, budgets, needs, and random streams in every
                journey.
              </p>
            </div>
            <span className="tag">{run.results.length} scenarios</span>
          </div>
          <div className="recommendation">
            <Check size={18} />
            <p>
              <strong>{best.scenarioName}</strong> has the highest modeled
              contribution after media among these scenarios:{" "}
              {dollars(best.contribution - best.adSpend)}.{" "}
              {best.contribution - best.adSpend < 0
                ? "All tested scenarios lose money after the included costs."
                : "Use this as a candidate for a real experiment."}
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Journey</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Net contribution</TableHead>
                <TableHead>Extra buyers / lost buyers</TableHead>
                <TableHead>Purchase-rate change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.results.map((v, i) => {
                const c = run.comparisons[i - 1];
                return (
                  <TableRow key={v.scenarioId}>
                    <TableCell>{v.scenarioName}</TableCell>
                    <TableCell>
                      {dollars(run.scenarios[i].product.price)}
                    </TableCell>
                    <TableCell>{number(v.purchases)}</TableCell>
                    <TableCell>{dollars(v.contribution - v.adSpend)}</TableCell>
                    <TableCell>
                      {c
                        ? `${number(c.variantOnly)} / ${number(c.baselineOnly)}`
                        : "Baseline"}
                    </TableCell>
                    <TableCell>
                      {c ? (
                        <>
                          {c.deltaRate >= 0 ? "+" : ""}
                          {(c.deltaRate * 100).toFixed(3)} pp
                          <small className="block">
                            MC 95%:{" "}
                            {(
                              (c.deltaRate - 1.96 * c.monteCarloSE) *
                              100
                            ).toFixed(3)}{" "}
                            to{" "}
                            {(
                              (c.deltaRate + 1.96 * c.monteCarloSE) *
                              100
                            ).toFixed(3)}{" "}
                            pp
                          </small>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="hint">
            The Monte Carlo interval reflects random variation within this
            model. It does not capture uncertainty in consumer assumptions or
            predict a real test result. Ad changes select different visitors, so
            downstream conditional rates alone do not establish improvement.
          </p>
        </div>
      )}
      <PriceChart run={run} />
      <div className="form-grid two">
        <div className="panel">
          <div className="section-heading">
            <h3>Where consumers leave</h3>
            <Choice
              label="Exit stage"
              value={lossStage}
              onChange={(v) => setLossStage(v as Stage)}
              options={[
                { value: "ad", label: "Ad" },
                { value: "pdp", label: "Product page" },
                { value: "cart", label: "Cart" },
                { value: "checkout", label: "Checkout" },
              ]}
            />
          </div>
          <p className="hint">
            Largest modeled barriers among {number(lossTotal)} exits here. Click
            a row to inspect one matching consumer. These are model
            explanations, not interview findings.
          </p>
          <div className="loss-list">
            {losses.map(([reason, count]) => (
              <button
                key={reason}
                onClick={() => {
                  const id = r.samples[`${lossStage}:${reason}`]?.[0];
                  if (id != null) {
                    setInspect(id);
                    setConsumerId(id + 1);
                    setTraceScenario(selected);
                  }
                }}
              >
                <div>
                  <span>{REASON_LABELS[reason as Reason] ?? reason}</span>
                  <strong>{number(count)}</strong>
                </div>
                <div className="loss-meter">
                  <i
                    style={{
                      width: `${lossTotal ? (count / lossTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
              </button>
            ))}
            {!losses.length && (
              <p>No exits at this stage in the processed population.</p>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="section-heading">
            <h3>Checkout steps</h3>
            <span className="tag">Reached / completed</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Step</TableHead>
                <TableHead>Reached</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.steps.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{v.name}</TableCell>
                  <TableCell>{number(v.reached)}</TableCell>
                  <TableCell>{number(v.completed)}</TableCell>
                  <TableCell>{rate(v.completed, v.reached)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="hint">
            Account rejection occurs before step one. Charge and payment checks
            occur within their configured steps, so those exits appear in step
            drop-off.
          </p>
        </div>
      </div>
      <div className="panel">
        <div className="section-heading">
          <h3>Population segments</h3>
          <Choice
            label="Segment by"
            value={segment}
            onChange={(v) => setSegment(v as typeof segment)}
            options={options(["relevance", "budget", "device", "motivation"])}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Segment</TableHead>
              <TableHead>Consumers</TableHead>
              <TableHead>Clicks</TableHead>
              <TableHead>Add to cart</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Purchase rate</TableHead>
              <TableHead>Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.segments[segment].map((v) => (
              <TableRow key={v.label}>
                <TableCell>{v.label}</TableCell>
                <TableCell>{number(v.exposed)}</TableCell>
                <TableCell>{number(v.clicks)}</TableCell>
                <TableCell>{number(v.carts)}</TableCell>
                <TableCell>{number(v.purchases)}</TableCell>
                <TableCell>{rate(v.purchases, v.exposed)}</TableCell>
                <TableCell>{dollars(v.revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="panel consumer-explorer">
        <div className="section-heading">
          <div>
            <h3>Consumer record</h3>
            <p>
              Inspect any processed ID. Every record regenerates from the saved
              seed and inputs.
            </p>
          </div>
          <span className="tag">No generated customer quotes</span>
        </div>
        <div className="explorer-controls">
          <NumberField
            label={`Consumer ID (${run.startId + 1}–${run.startId + run.processed})`}
            value={consumerId}
            onChange={setConsumerId}
            min={run.startId + 1}
            max={run.startId + run.processed}
            step={1}
          />
          <Choice
            label="Journey"
            value={String(traceScenario)}
            onChange={(v) => setTraceScenario(Number(v))}
            options={run.scenarios.map((v, i) => ({
              value: String(i),
              label: v.name,
            }))}
          />
          <Button
            disabled={
              !Number.isInteger(consumerId) ||
              consumerId < run.startId + 1 ||
              consumerId > run.startId + run.processed
            }
            onClick={() => setInspect(consumerId - 1)}
          >
            <Search />
            Inspect
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const id =
                run.startId + Math.floor(Math.random() * run.processed);
              setInspect(id);
              setConsumerId(id + 1);
            }}
          >
            Random record
          </Button>
        </div>
        {trace ? (
          <>
            <div className="record-heading">
              <span className="record-id">
                CAD / {String(inspect + 1).padStart(8, "0")}
              </span>
              <span className={`tag ${trace.outcome.bought ? "" : "amber"}`}>
                {REASON_LABELS[trace.outcome.reason]}
              </span>
            </div>
            <div className="trait-grid">
              <Stat label="Category state" value={trace.profile.relevance} />
              <Stat
                label="Current budget"
                value={dollars(trace.profile.budget)}
              />
              <Stat label="Main appeal" value={trace.profile.appeal} />
              <Stat
                label="Device / payment"
                value={`${trace.profile.mobile ? "Mobile" : "Desktop"} / ${trace.profile.preferredPayment}`}
              />
              {(
                [
                  ["need", "Current need"],
                  ["informationNeed", "Information need"],
                  ["trustNeed", "Reassurance need"],
                  ["dealSeeking", "Deal seeking"],
                  ["patience", "Patience"],
                  ["privacyNeed", "Privacy resistance"],
                  ["familiarity", "Brand familiarity"],
                  ["incumbent", "Existing alternative"],
                ] as const
              ).map(([key, label]) => (
                <Stat
                  key={key}
                  label={label}
                  value={percent(trace.profile[key], 0)}
                />
              ))}
            </div>
            <div className="trace-timeline">
              {trace.events.map((e, i) => (
                <div className="trace-event" key={i}>
                  <div className="trace-dot">{i + 1}</div>
                  <div>
                    <span className="eyebrow">{e.stage}</span>
                    <h4>{e.action}</h4>
                    <p>{e.detail}</p>
                    {e.probability != null && (
                      <span className="trace-probability">
                        Modeled probability {percent(e.probability, 3)}
                        {e.draw != null ? ` · Draw ${e.draw.toFixed(6)}` : ""}
                      </span>
                    )}
                    {e.factors.length > 0 && (
                      <details>
                        <summary>Selected model factors</summary>
                        <ul>
                          {e.factors.map((f, j) => (
                            <li key={j}>
                              {f.label}: {f.value.toFixed(3)}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                  <ArrowRight size={15} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="notice">
            This run uses a different engine version or has no processed
            records. Counts remain available; replay requires its original
            engine.
          </p>
        )}
      </div>
    </div>
  );
}
