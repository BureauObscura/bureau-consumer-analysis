/* eslint-disable @next/next/no-img-element -- The small local SVG glyph is intentionally rendered without an image proxy. */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  FolderOpen,
  KeyRound,
  Play,
  Plus,
  Save,
  Settings2,
  Square,
  Trash2,
  Upload,
  Download,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
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
  Field,
  NumberField,
  Stat,
  dollars,
  number,
  percent,
} from "@/components/simulator/controls";
import { Journey } from "@/components/simulator/journey";
import { Population } from "@/components/simulator/population";
import { Results } from "@/components/simulator/results";
import {
  DEFAULT_COEFFICIENTS,
  DEFAULT_POPULATION,
  defaultScenario,
  EXPERIMENTS,
  makeVariant,
  FEATURE_FIELDS,
} from "@/lib/sim/defaults";
import { calibrationSignature } from "@/lib/sim/signature";
import { runRequestSchema, validCounts } from "@/lib/sim/validation";
import { parseRun } from "@/lib/sim/run-validation";
import { api, download } from "@/lib/client-api";
import { useSimulation } from "@/hooks/use-simulation";
import {
  ENGINE_VERSION,
  type Coefficients,
  type FunnelCounts,
  type PopulationConfig,
  type RunRequest,
  type Scenario,
} from "@/lib/sim/types";
interface SavedWorkspace {
  studies: { id: string; name: string; updated_at: string }[];
  runs: {
    id: string;
    name: string;
    created_at: string;
    summary: { processed: number; status: string };
  }[];
}
interface SensitivityRow {
  name: string;
  population: PopulationConfig;
  processed: number;
  orders: number;
  net: number;
}
const funnelKeys = [
  "exposed",
  "clicks",
  "carts",
  "checkout",
  "purchases",
] as const;
const initialObserved: FunnelCounts = {
  exposed: 100000,
  clicks: 0,
  carts: 0,
  checkout: 0,
  purchases: 0,
};
export default function Page() {
  const [scenarios, setScenarios] = useState<Scenario[]>(() => [
      defaultScenario(),
    ]),
    [population, setPopulation] =
      useState<PopulationConfig>(DEFAULT_POPULATION),
    [coefficients, setCoefficients] =
      useState<Coefficients>(DEFAULT_COEFFICIENTS);
  const [selected, setSelected] = useState("baseline"),
    [tab, setTab] = useState("journey"),
    [dialog, setDialog] = useState<"connections" | "library" | null>(null),
    [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [storage, setStorage] = useState(""),
    [saving, setSaving] = useState(false),
    [dirty, setDirtyState] = useState(false),
    [studyId, setStudyId] = useState(() => crypto.randomUUID());
  const [library, setLibrary] = useState<SavedWorkspace>({
      studies: [],
      runs: [],
    }),
    [observed, setObserved] = useState(initialObserved),
    [priceLow, setPriceLow] = useState(59),
    [priceHigh, setPriceHigh] = useState(129),
    [pricePoints, setPricePoints] = useState(5),
    [stressBusy, setStressBusy] = useState(false),
    [stress, setStress] = useState<SensitivityRow[]>([]);
  const editRevision = useRef(0),
    studyEpoch = useRef(0),
    liveStudy = useRef(studyId);
  const [renderEpoch, setRenderEpoch] = useState(0);
  function setDirty(value: boolean) {
    if (value) editRevision.current++;
    setDirtyState(value);
  }
  const [stressInputs, setStressInputs] = useState<RunRequest | null>(null);
  const simulation = useSimulation(),
    cancelStress = useRef(false),
    runRef = useRef(simulation.run);
  useEffect(() => {
    runRef.current = simulation.run;
  }, [simulation.run]);
  const baseline = scenarios[0],
    current = scenarios.find((s) => s.id === selected) ?? baseline,
    busy = !!simulation.busy || stressBusy;
  const calibratedStale =
    coefficients.calibration &&
    coefficients.calibration.signature !==
      calibrationSignature(population, baseline);
  const request = useCallback(
    (): RunRequest => ({
      id: crypto.randomUUID(),
      population: structuredClone(population),
      scenarios: structuredClone(scenarios),
      coefficients: structuredClone(coefficients),
    }),
    [population, scenarios, coefficients],
  );
  const notify = (text: string) => {
    setMessage(text);
    setError("");
  };
  async function loadLibrary() {
    try {
      setLibrary(await api<SavedWorkspace>("workspace"));
      setStorage("Connected");
    } catch {
      setStorage("Sign in to store sources and saved work");
    }
  }
  useEffect(() => {
    let active = true;
    api<SavedWorkspace>("workspace")
      .then((value) => {
        if (active) {
          setLibrary(value);
          setStorage("Connected");
        }
      })
      .catch(() => {
        if (active) setStorage("Sign in to store sources and saved work");
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  const update = (change: (s: Scenario) => Scenario) => {
    if (liveStudy.current !== studyId || studyEpoch.current !== renderEpoch)
      return;
    setScenarios((list) =>
      list.map((s) => (s.id === current.id ? change(s) : s)),
    );
    setDirty(true);
  };
  const startSimulation = simulation.start;
  const run = useCallback(async () => {
    setError("");
    setMessage("");
    setTab("results");
    try {
      const result = await startSimulation(request());
      runRef.current = result;
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [request, startSimulation]);
  async function saveStudy() {
    const revision = editRevision.current,
      origin = studyId;
    setSaving(true);
    setError("");
    try {
      await api("studies", {
        id: studyId,
        name: baseline.product.name,
        request: request(),
      });
      if (revision === editRevision.current && origin === liveStudy.current)
        setDirty(false);
      notify(
        revision === editRevision.current
          ? "Study saved with source references, population, and alternatives."
          : "Earlier snapshot saved. Newer changes in this tab still need saving.",
      );
      await loadLibrary();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function saveRun() {
    if (!simulation.run) return;
    setSaving(true);
    try {
      await api("runs", simulation.run);
      notify("Frozen run saved. It can be reopened from Saved work.");
      await loadLibrary();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function addVariant(id?: string) {
    if (scenarios.length >= 8) {
      setError(
        "Compare up to 8 journeys per run. Remove an alternative to add another.",
      );
      return;
    }
    let variant = id ? makeVariant(baseline, id) : structuredClone(current);
    variant = {
      ...variant,
      id: crypto.randomUUID(),
      name: id ? variant.name : `${current.name} alternative`,
    };
    setScenarios((list) => [...list, variant]);
    setSelected(variant.id);
    setDirty(true);
    notify(`${variant.name} added. Edit it in Journey inputs.`);
  }
  function priceSweep() {
    if (
      !Number.isFinite(priceLow) ||
      !Number.isFinite(priceHigh) ||
      priceLow <= 0 ||
      priceHigh <= priceLow ||
      !Number.isInteger(pricePoints) ||
      pricePoints < 2 ||
      pricePoints > 7
    ) {
      setError(
        "Use positive prices with the maximum above the minimum, and 2 to 7 test points.",
      );
      return;
    }
    const variants = Array.from({ length: pricePoints }, (_, i) => {
      const price =
        Math.round(
          (priceLow + ((priceHigh - priceLow) * i) / (pricePoints - 1)) * 100,
        ) / 100;
      return {
        ...structuredClone(baseline),
        id: crypto.randomUUID(),
        name: `Price ${dollars(price)}`,
        product: { ...baseline.product, price },
      };
    });
    setScenarios([baseline, ...variants]);
    setSelected(baseline.id);
    setDirty(true);
    notify(
      "Price sweep configured. All other journey inputs and consumer budgets are held constant. Run the comparison when ready.",
    );
  }
  async function fit() {
    if (!validCounts(observed)) {
      setError(
        "Enter positive, nested historical counts for every stage. Zero-event data needs a different calibration method.",
      );
      return;
    }
    setError("");
    try {
      await simulation.start(
        { ...request(), scenarios: [baseline] },
        (co) => {
          setCoefficients(co);
          setDirty(true);
          notify(
            "Baseline intercepts fitted. Review target versus achieved rates before using the model.",
          );
        },
        observed,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function sensitivity() {
    const prior = simulation.run;
    setStressBusy(true);
    cancelStress.current = false;
    setStress([]);
    setError("");
    const base = request();
    setStressInputs(structuredClone({ ...base, scenarios: [baseline] }));
    const cases: [string, Partial<PopulationConfig>][] = [
      ["Current assumptions", {}],
      [
        "More category interest",
        { excludedShare: Math.max(0, population.excludedShare - 0.15) },
      ],
      [
        "Less category interest",
        { excludedShare: Math.min(1, population.excludedShare + 0.15) },
      ],
      [
        "Lower budgets",
        { medianBudget: Math.max(1, population.medianBudget * 0.75) },
      ],
      [
        "Higher budgets",
        { medianBudget: Math.min(100000, population.medianBudget * 1.25) },
      ],
      [
        "More price sensitive",
        { priceSensitivity: Math.min(5, population.priceSensitivity * 1.3) },
      ],
      ["More skeptical", { distrust: Math.min(1, population.distrust + 0.2) }],
    ];
    try {
      for (const [name, patch] of cases) {
        if (cancelStress.current) break;
        const pop = {
          ...population,
          ...patch,
          size: Math.min(200000, population.size),
        };
        const r = await simulation.start({
          ...base,
          id: crypto.randomUUID(),
          population: pop,
          scenarios: [baseline],
        });
        setStress((rows) => [
          ...rows,
          {
            name,
            population: pop,
            processed: r.processed,
            orders: r.results[0].purchases,
            net: r.results[0].contribution - r.results[0].adSpend,
          },
        ]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStressBusy(false);
      simulation.setRun(prior);
    }
  }
  function importFile(file: File) {
    if (file.size > 12_000_000) {
      setError("Use a JSON export under 12 MB.");
      return;
    }
    void file
      .text()
      .then((text) => {
        const raw = JSON.parse(text);
        if (raw.results) {
          const result = parseRun(raw);
          simulation.setRun(result);
          setTab("results");
          notify(
            "Imported frozen run. Source files remain private to the workspace that uploaded them.",
          );
        } else {
          const req = runRequestSchema.parse(raw.request ?? raw);
          setScenarios(req.scenarios);
          setPopulation(req.population);
          setCoefficients(req.coefficients);
          setSelected(req.scenarios[0].id);
          studyEpoch.current++;
          setRenderEpoch(studyEpoch.current);
          const nextId = crypto.randomUUID();
          liveStudy.current = nextId;
          setStudyId(nextId);
          setStress([]);
          setStressInputs(null);
          setDirty(true);
          notify(
            "Configuration imported. Files from a different workspace must be uploaded here before saving.",
          );
        }
      })
      .catch((e) => setError(`Import failed: ${e.message}`));
  }
  const actionsRef = useRef({ request, run, tab, setTab });
  useEffect(() => {
    actionsRef.current = { request, run, tab, setTab };
  }, [request, run, tab]);
  useEffect(() => {
    type Tool = {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (value: unknown) => unknown;
    };
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Tool,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools: Tool[] = [
      {
        name: "read_consumer_study",
        description:
          "Read the visible study configuration and the latest run summary. Does not send data to providers.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(value) {
          if (
            value == null ||
            typeof value !== "object" ||
            Object.keys(value).length
          )
            throw Error("Expected an empty object.");
          const r = actionsRef.current.request();
          const latest = runRef.current;
          return {
            population: r.population,
            scenarios: r.scenarios.map((s) => ({
              id: s.id,
              name: s.name,
              product: s.product,
              platform: s.acquisition.platform,
              sources: s.sources.length,
            })),
            run: latest
              ? {
                  id: latest.id,
                  status: latest.status,
                  processed: latest.processed,
                  results: latest.results.map((r) => ({
                    name: r.scenarioName,
                    purchases: r.purchases,
                    netContribution: r.contribution - r.adSpend,
                  })),
                }
              : null,
          };
        },
      },
      {
        name: "start_consumer_simulation",
        description:
          "Start the configured free local simulation and show Results. This does not analyze files, spend API credits, or save a run.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(value) {
          if (
            value == null ||
            typeof value !== "object" ||
            Object.keys(value).length
          )
            throw Error("Expected an empty object.");
          const r = await actionsRef.current.run();
          return r
            ? { id: r.id, status: r.status, processed: r.processed }
            : { status: "No completed result" };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => lifecycle.abort();
  }, []);
  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          type="button"
          onClick={() => setTab("journey")}
          className="bureau-mark"
          aria-label="Bureau Obscura Consumer Analysis Division"
        >
          <img src="/bureau/glyph.svg" alt="" />
          <span>
            BUREAU OBSCURA<small>CONSUMER ANALYSIS DIVISION</small>
          </span>
        </button>
        <div className="header-status">
          <span>{number(population.size)}</span>synthetic consumers
        </div>
        <div className="header-actions">
          <Button variant="ghost" onClick={() => setDialog("connections")}>
            <KeyRound />
            Connections
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              void loadLibrary();
              setDialog("library");
            }}
          >
            <FolderOpen />
            Saved work
          </Button>
        </div>
      </header>
      <main className="workspace">
        <div className="page-heading">
          <div>
            <span className="eyebrow">CAD / Purchase journey study</span>
            <h1>Consumer simulation</h1>
            <p>
              Ad exposure through purchase, across a population with different
              reasons to buy or leave.
            </p>
          </div>
          <div className="actions">
            <Button
              variant="outline"
              onClick={saveStudy}
              disabled={saving || busy}
            >
              <Save />
              {saving ? "Saving…" : "Save study"}
              {dirty ? " *" : ""}
            </Button>
            <Button size="lg" onClick={run} disabled={busy}>
              <Play />
              {busy ? "Calculating…" : `Run ${number(population.size)}`}
              <ArrowRight />
            </Button>
          </div>
        </div>
        <div className="study-toolbar">
          <Choice
            label="Journey to edit"
            value={current.id}
            onChange={setSelected}
            options={scenarios.map((s, i) => ({
              value: s.id,
              label: `${i === 0 ? "Baseline · " : ""}${s.name}`,
            }))}
          />
          <Button
            variant="outline"
            onClick={() => addVariant()}
            disabled={busy || scenarios.length >= 8}
          >
            <Copy />
            Duplicate journey
          </Button>
          {current.id !== baseline.id && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setScenarios((list) => list.filter((s) => s.id !== current.id));
                setSelected(baseline.id);
                setDirty(true);
              }}
            >
              <Trash2 />
              Remove alternative
            </Button>
          )}
          <span className="toolbar-meta">
            {scenarios.length} {scenarios.length === 1 ? "journey" : "journeys"}{" "}
            ·{" "}
            {coefficients.provenance === "authored"
              ? "Uncalibrated assumptions"
              : calibratedStale
                ? "Calibration inputs changed"
                : "Fitted baseline"}
          </span>
        </div>
        {message && (
          <div className="notice success" role="status">
            <Check size={17} />
            {message}
            <button aria-label="Dismiss message" onClick={() => setMessage("")}>
              ×
            </button>
          </div>
        )}
        {(error || simulation.error) && (
          <div className="notice error" role="alert">
            {error || simulation.error}
            <button
              aria-label="Dismiss error"
              onClick={() => {
                setError("");
                simulation.clearError();
              }}
            >
              ×
            </button>
          </div>
        )}
        {calibratedStale && (
          <div className="notice">
            The baseline or population changed after fitting. Coefficients
            remain frozen for comparison; fit again only if you intend to
            establish a new baseline.
          </div>
        )}
        {busy && (
          <div className="run-progress" role="status">
            <div>
              <strong>
                {stressBusy
                  ? "Testing population assumptions"
                  : simulation.busy === "calibrate"
                    ? "Fitting baseline intercepts"
                    : `Evaluating ${number(simulation.run?.processed ?? 0)} / ${number(population.size)} consumers`}
              </strong>
              <Button
                variant="outline"
                onClick={() => {
                  cancelStress.current = true;
                  simulation.cancel();
                }}
              >
                <Square />
                Stop
              </Button>
            </div>
            <Progress
              value={
                simulation.busy === "calibrate"
                  ? undefined
                  : ((simulation.run?.processed ?? 0) /
                      (simulation.run?.planned ?? population.size)) *
                    100
              }
              aria-label="Consumers processed"
            />
            <p>
              The simulation runs locally in a background worker. Each consumer
              is evaluated individually.
            </p>
          </div>
        )}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line" className="main-tabs">
            <TabsTrigger value="journey">Journey inputs</TabsTrigger>
            <TabsTrigger value="population">Population</TabsTrigger>
            <TabsTrigger value="experiments">Experiments</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="calibration">Calibration</TabsTrigger>
            <TabsTrigger value="method">Model record</TabsTrigger>
          </TabsList>
          <TabsContent value="journey">
            <Journey
              scenario={current}
              update={update}
              apiKey={apiKey}
              connect={() => setDialog("connections")}
              notice={notify}
            />
          </TabsContent>
          <TabsContent value="population">
            <Population
              population={population}
              onChange={(p) => {
                setPopulation(p);
                setDirty(true);
              }}
              scenario={baseline}
            />
          </TabsContent>
          <TabsContent value="experiments">
            <div className="stack">
              <div className="section-heading">
                <div>
                  <h2>Experiments</h2>
                  <p>
                    Change one factor, compare complete journeys, or test how
                    much the answer depends on your population assumptions.
                  </p>
                </div>
                <span className="tag">Up to 8 journeys per run</span>
              </div>
              <div className="panel">
                <div className="section-heading">
                  <div>
                    <h3>Price elasticity test</h3>
                    <p>
                      Create a price-only sweep from the current baseline. This
                      replaces the alternative journey list.
                    </p>
                  </div>
                  <Settings2 size={21} />
                </div>
                <div className="form-grid three">
                  <NumberField
                    label="Lowest price ($)"
                    value={priceLow}
                    onChange={setPriceLow}
                    min={0.01}
                  />
                  <NumberField
                    label="Highest price ($)"
                    value={priceHigh}
                    onChange={setPriceHigh}
                    min={0.01}
                  />
                  <NumberField
                    label="Test prices"
                    value={pricePoints}
                    onChange={setPricePoints}
                    min={2}
                    max={7}
                    step={1}
                  />
                </div>
                <Button variant="outline" disabled={busy} onClick={priceSweep}>
                  <Plus />
                  Configure price sweep
                </Button>
                <p className="hint">
                  Population budgets do not change with price. The model also
                  accounts for discounts, free-shipping thresholds, tax, and
                  fees. Results include the order curve, contribution curve, and
                  modeled elasticity.
                </p>
              </div>
              <div className="experiment-grid">
                {EXPERIMENTS.map((e) => (
                  <div className="panel" key={e.id}>
                    <h3>{e.name}</h3>
                    <p>{e.description}</p>
                    <Button
                      variant="outline"
                      disabled={busy || scenarios.length >= 8}
                      onClick={() => addVariant(e.id)}
                    >
                      <Plus />
                      Add alternative
                    </Button>
                  </div>
                ))}
              </div>
              <div className="panel">
                <div className="section-heading">
                  <div>
                    <h3>Population sensitivity</h3>
                    <p>
                      Test seven plausible population settings on up to 200,000
                      consumers per case. Each case reports its actual sample
                      size.
                    </p>
                  </div>
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={sensitivity}
                  >
                    Run sensitivity checks
                  </Button>
                </div>
                <p className="hint">
                  Keeps the baseline journey and coefficients fixed. Changes
                  category interest, budget, price sensitivity, and skepticism
                  one at a time. These are stress cases, not confidence bounds
                  or probabilities of future outcomes.
                </p>
                {stress.length > 0 && (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Assumption case</TableHead>
                          <TableHead>Consumers</TableHead>
                          <TableHead>Orders</TableHead>
                          <TableHead>Purchase rate</TableHead>
                          <TableHead>Contribution after media</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stress.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>{r.name}</TableCell>
                            <TableCell>{number(r.processed)}</TableCell>
                            <TableCell>{number(r.orders)}</TableCell>
                            <TableCell>
                              {percent(r.orders / r.processed)}
                            </TableCell>
                            <TableCell>{dollars(r.net)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                disabled={busy}
                                onClick={() => {
                                  setPopulation({
                                    ...r.population,
                                    size: population.size,
                                  });
                                  setDirty(true);
                                  notify(
                                    `${r.name} population loaded for a full run.`,
                                  );
                                }}
                              >
                                Use population
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Button
                      variant="outline"
                      onClick={() =>
                        download(
                          "consumer-sensitivity.json",
                          JSON.stringify(
                            {
                              version: ENGINE_VERSION,
                              request: stressInputs,
                              cases: stress,
                            },
                            null,
                            2,
                          ),
                        )
                      }
                    >
                      <Download />
                      Export sensitivity
                    </Button>
                  </>
                )}
              </div>
              <Button size="lg" onClick={run} disabled={busy}>
                <Play />
                Run {scenarios.length} journeys × {number(population.size)}{" "}
                consumers
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="results">
            {simulation.run ? (
              <Results
                key={simulation.run.id}
                run={simulation.run}
                save={saveRun}
                busy={busy || saving}
              />
            ) : (
              <div className="empty-results panel">
                <div className="empty-diagram">
                  <span>Ad</span>
                  <ArrowRight />
                  <span>PDP</span>
                  <ArrowRight />
                  <span>Cart</span>
                  <ArrowRight />
                  <span>Checkout</span>
                </div>
                <h2>No run yet</h2>
                <p>
                  Configure your journey or run the editable example. Counts
                  appear only after consumers are evaluated.
                </p>
                <Button onClick={run} disabled={busy}>
                  <Play />
                  Run {number(population.size)} consumers
                </Button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="calibration">
            <div className="stack">
              <div className="section-heading">
                <div>
                  <h2>Baseline calibration</h2>
                  <p>
                    Fit four stage intercepts to observed funnel counts from a
                    comparable historical journey.
                  </p>
                </div>
                <span className="tag">
                  Current state: {coefficients.provenance}
                </span>
              </div>
              <div className="notice">
                Use counts from the same audience, observation window, and
                attribution definition. This model follows one exposure and one
                product unit. Aggregate funnel counts do not validate individual
                preferences or price-response coefficients.
              </div>
              <div className="panel">
                <div className="form-grid five">
                  {funnelKeys.map((key) => (
                    <NumberField
                      key={key}
                      label={
                        {
                          exposed: "Unique exposed consumers",
                          clicks: "Unique clickers",
                          carts: "Added to cart",
                          checkout: "Started checkout",
                          purchases: "Purchased",
                        }[key]
                      }
                      value={observed[key]}
                      onChange={(v) => setObserved((c) => ({ ...c, [key]: v }))}
                      max={1000000000}
                      step={1}
                    />
                  ))}
                </div>
                <div className="actions">
                  <Button
                    disabled={busy || !validCounts(observed)}
                    onClick={fit}
                  >
                    Fit baseline
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setCoefficients({ ...DEFAULT_COEFFICIENTS });
                      setDirty(true);
                      notify("Authored coefficients restored.");
                    }}
                  >
                    Reset coefficients
                  </Button>
                </div>
                <p className="hint">
                  Fits on up to 200,000 seeded consumers. Impossible targets are
                  rejected. Zero-event stages are not supported by this
                  intercept-fitting method. Alternatives use the frozen baseline
                  coefficients.
                </p>
              </div>
              <div className="panel">
                <h3>Current coefficients</h3>
                <div className="stats-grid">
                  {(["ad", "page", "cart", "checkout"] as const).map((key) => (
                    <Stat
                      key={key}
                      label={key}
                      value={coefficients[key].toFixed(4)}
                    />
                  ))}
                </div>
              </div>
              {coefficients.calibration && (
                <div className="panel">
                  <h3>Observed versus achieved rates</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stage</TableHead>
                        <TableHead>Historical rate</TableHead>
                        <TableHead>Fitted sample rate</TableHead>
                        <TableHead>Difference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {funnelKeys.slice(1).map((key, i) => {
                        const c = coefficients.calibration!,
                          den = funnelKeys[i],
                          target = c.observed[key] / c.observed[den],
                          actual =
                            c.achieved[key] / Math.max(1, c.achieved[den]);
                        return (
                          <TableRow key={key}>
                            <TableCell>{key}</TableCell>
                            <TableCell>{percent(target, 4)}</TableCell>
                            <TableCell>{percent(actual, 4)}</TableCell>
                            <TableCell>
                              {((actual - target) * 100).toFixed(4)} pp
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <p className="hint">
                    Fitted{" "}
                    {new Date(
                      coefficients.calibration.fittedAt,
                    ).toLocaleString()}{" "}
                    using {number(coefficients.calibration.population)}{" "}
                    consumers. A fit to your own baseline is not an
                    out-of-sample validation.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="method">
            <div className="stack method-record">
              <div className="section-heading">
                <div>
                  <h2>Model record</h2>
                  <p>
                    What is being simulated, where assumptions enter, and what
                    the output can support.
                  </p>
                </div>
                <span className="tag">{ENGINE_VERSION}</span>
              </div>
              <div className="form-grid two">
                <div className="panel">
                  <h3>Individual simulation</h3>
                  <p>
                    Every consumer ID gets a reproducible combination of
                    category relevance, need, budget, familiarity, payment
                    preference, and continuous shopping traits. Decisions occur
                    in sequence. People who leave do not continue into later
                    stages.
                  </p>
                  <p>
                    Philox counter-based random streams preserve the same people
                    and stage-level draws across alternatives. Ten million
                    records are evaluated directly in a background worker. The
                    app stores aggregate results and regenerates individual
                    records on demand.
                  </p>
                </div>
                <div className="panel">
                  <h3>What GPT does</h3>
                  <p>
                    GPT reviews uploaded images, PDFs, and text to propose
                    rubric inputs and observable checkout details. You choose
                    what to apply. It does not impersonate ten million shoppers
                    or supply measured conversion rates.
                  </p>
                  <p>
                    Live URLs return public page text through Jina Reader.
                    Uploaded HTML is parsed without running scripts. Neither
                    method verifies payment behavior, load speed, or every
                    interactive state.
                  </p>
                </div>
                <div className="panel">
                  <h3>Structural limits</h3>
                  <p>
                    People with zero category interest cannot buy. Offline-only
                    consumers cannot complete this online journey. Product
                    availability, budget, disclosure timing, information,
                    shipping, payment, and checkout effort constrain the
                    remaining consumers.
                  </p>
                  <p>
                    The model covers one product unit and one modeled ad
                    impression. It does not simulate auctions, ad delivery
                    optimization, competition over time, repeat visits,
                    household negotiations, subscription renewal, returns, or
                    lifetime value.
                  </p>
                </div>
                <div className="panel">
                  <h3>Assumptions & validation</h3>
                  <p>
                    Default distributions, correlations, platform adjustments,
                    and utility coefficients are authored. They are not a
                    representative panel or an empirically validated demand
                    model. GPT rubric scores are subjective judgments.
                  </p>
                  <p>
                    Use historical calibration to align the baseline,
                    sensitivity tests to challenge assumptions, and actual
                    experiments to validate rankings. The small Monte Carlo
                    error of a large run does not remove model uncertainty.
                  </p>
                </div>
              </div>
              <div className="panel">
                <h3>Evidence coverage in this study</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Journey</TableHead>
                      <TableHead>Sources</TableHead>
                      <TableHead>Applied GPT inputs</TableHead>
                      <TableHead>Manual inputs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scenarios.map((s) => {
                      const applied = Object.values(s.featureBasis).filter(
                        (v) => v.kind === "analysis",
                      ).length;
                      return (
                        <TableRow key={s.id}>
                          <TableCell>{s.name}</TableCell>
                          <TableCell>{s.sources.length}</TableCell>
                          <TableCell>{applied}</TableCell>
                          <TableCell>
                            {FEATURE_FIELDS.length - applied}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="panel">
                <h3>Reproduce & export</h3>
                <p>
                  JSON exports contain frozen scenario inputs, population
                  configuration, seed, consumer ID range, engine version,
                  aggregate outcomes, paired counts, and analysis receipts. Run
                  the same version with those inputs to reproduce individual
                  decisions.
                </p>
                <div className="actions">
                  <Button
                    variant="outline"
                    onClick={() =>
                      download(
                        "consumer-study-config.json",
                        JSON.stringify(request(), null, 2),
                      )
                    }
                  >
                    <Download />
                    Export current configuration
                  </Button>
                  <label className="file-button">
                    <Upload size={16} />
                    Import configuration or run
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) importFile(file);
                      }}
                    />
                  </label>
                  <a
                    href="/model-card.md"
                    className="text-link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <BookOpen size={17} />
                    Full model card
                  </a>
                </div>
              </div>
              <div className="panel">
                <h3>Sources behind the design</h3>
                <ul className="reference-list">
                  <li>
                    <a
                      href="https://eml.berkeley.edu/books/choice2nd/Ch06_p134-150.pdf"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Kenneth Train: mixed logit and heterogeneous preferences
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://jasss.soc.surrey.ac.uk/23/2/7.html"
                      target="_blank"
                      rel="noreferrer"
                    >
                      ODD protocol: documenting agent models
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://random123.com/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Random123: counter-based random generation
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://arxiv.org/abs/2411.10109"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Generative Agent Simulations of 1,000 People
                    </a>{" "}
                    uses interview grounding; it does not validate this purchase
                    simulator.
                  </li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <footer className="app-footer">
          <span>BUREAU OBSCURA / CAD</span>
          <span>
            {ENGINE_VERSION} · {storage || "Connecting storage…"}
          </span>
          <span>Simulation results, not observed demand</span>
        </footer>
      </main>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="library-dialog">
          <DialogTitle>
            {dialog === "connections" ? "Connections" : "Saved work"}
          </DialogTitle>
          <DialogDescription>
            {dialog === "connections"
              ? "Optional source analysis and private study storage."
              : "Reopen a study for editing or a frozen simulation run for review."}
          </DialogDescription>
          {dialog === "connections" ? (
            <div className="stack">
              <Field
                label="OpenAI API key"
                value={apiKey}
                type="password"
                onChange={setApiKey}
                help="Held in this tab's memory only. Never written to storage, exports, or logs. Clear it below when finished."
              />
              <p className="hint">
                Source analysis uses GPT-5.6 Terra and is billed to this key.
                Each Analyze action sends one selected source and product/copy
                context. No automatic retries. Simulation itself uses no paid
                API calls.
              </p>
              <div className="actions">
                <Button variant="outline" onClick={() => setApiKey("")}>
                  Clear key
                </Button>
                <Button onClick={() => setDialog(null)}>
                  {apiKey
                    ? "Use key in this tab"
                    : "Continue without AI analysis"}
                </Button>
              </div>
              <div className="panel">
                <h3>Workspace storage</h3>
                <p>{storage}</p>
                <a
                  href="/signin-with-chatgpt?return_to=/"
                  target="_top"
                  className="text-link"
                >
                  Sign in with ChatGPT
                </a>
                <p className="hint">
                  Source files and saved results belong to your signed-in
                  account. Public page import sends only the selected URL to
                  Jina Reader.
                </p>
              </div>
            </div>
          ) : (
            <div className="stack">
              <h3>Studies</h3>
              {library.studies.map((s) => (
                <button
                  className="saved-item"
                  key={s.id}
                  disabled={busy}
                  onClick={async () => {
                    try {
                      const v = await api<{ id: string; request: RunRequest }>(
                        `studies/${s.id}`,
                      );
                      const req = runRequestSchema.parse(v.request);
                      setScenarios(req.scenarios);
                      setPopulation(req.population);
                      setCoefficients(req.coefficients);
                      studyEpoch.current++;
                      setRenderEpoch(studyEpoch.current);
                      liveStudy.current = v.id;
                      setStudyId(v.id);
                      setStress([]);
                      setStressInputs(null);
                      setSelected(req.scenarios[0].id);
                      setDirty(false);
                      setDialog(null);
                      setTab("journey");
                      notify("Saved study opened.");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <span>
                    {s.name}
                    <small>{new Date(s.updated_at).toLocaleString()}</small>
                  </span>
                  <FolderOpen size={18} />
                </button>
              ))}
              {!library.studies.length && <p>No studies saved yet.</p>}
              <h3>Simulation runs</h3>
              {library.runs.map((r) => (
                <button
                  className="saved-item"
                  key={r.id}
                  disabled={busy}
                  onClick={async () => {
                    try {
                      const value = parseRun(await api(`runs/${r.id}`));
                      simulation.setRun(value);
                      setTab("results");
                      setDialog(null);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <span>
                    {r.name}
                    <small>
                      {number(r.summary.processed)} consumers ·{" "}
                      {r.summary.status} ·{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
              {!library.runs.length && <p>No runs saved yet.</p>}
              <label className="file-button">
                <Upload size={16} />
                Import JSON export
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) {
                      importFile(f);
                      setDialog(null);
                    }
                  }}
                />
              </label>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
