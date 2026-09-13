import { z } from "zod";
import { analyzeSource } from "@/lib/server/analysis";
import { importPage } from "@/lib/server/import-page";
import { htmlText } from "@/lib/server/html";
import {
  AppError,
  bucket,
  db,
  hash,
  owner,
  readBounded,
  sameOrigin,
  saveSource,
  sourceFor,
} from "@/lib/server/storage";
import { runRequestSchema, scenarioSchema } from "@/lib/sim/validation";
import { parseRun } from "@/lib/sim/run-validation";
import type { Scenario, Source } from "@/lib/sim/types";
const stageSchema = z.enum(["ad", "pdp", "cart", "checkout"]);
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function body(request: Request, max = 2_000_000) {
  try {
    return JSON.parse(
      new TextDecoder().decode(
        await readBounded(new Response(request.body), max),
      ),
    );
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError("The request must contain valid JSON.");
  }
}
async function canonical(scenarios: Scenario[], who: string) {
  for (const scenario of scenarios) {
    scenario.sources = await Promise.all(
      scenario.sources.map(async (s) => (await sourceFor(s.id, who)).source),
    );
    for (const a of scenario.analyses) {
      const row = await db()
        .prepare(
          "SELECT data FROM analyses WHERE id=? AND owner=? AND source_id=?",
        )
        .bind(a.id, who, a.sourceId)
        .first<{ data: string }>();
      if (!row)
        throw new AppError("Analysis not found in this workspace.", 404);
      Object.assign(a, JSON.parse(row.data));
    }
    for (const [key, basis] of Object.entries(scenario.featureBasis)) {
      if (basis.kind === "analysis") {
        const a = scenario.analyses.find(
          (a) => a.id === basis.analysisId && a.sourceId === basis.sourceId,
        );
        const o = a?.observations.find((o) => o.feature === key);
        if (
          !scenario.sources.some((s) => s.id === basis.sourceId) ||
          o?.value == null ||
          scenario.features[key as keyof Scenario["features"]] !== o.value
        )
          throw new AppError(
            "An applied score no longer matches its attached analysis. Set it manually or apply a current source observation.",
          );
      }
    }
  }
  return scenarios;
}
const draftSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(150),
  request: runRequestSchema,
});
async function handler(request: Request) {
  try {
    if (request.method !== "GET") sameOrigin(request);
    const who = await owner(),
      url = new URL(request.url),
      path = url.pathname.replace(/^\/api\/sim\//, "").split("/");
    if (request.method === "GET" && path[0] === "workspace") {
      const [studies, runs] = await Promise.all([
        db()
          .prepare(
            "SELECT id,name,updated_at FROM studies WHERE owner=? ORDER BY updated_at DESC LIMIT 50",
          )
          .bind(who)
          .all(),
        db()
          .prepare(
            "SELECT id,name,summary,created_at FROM simulation_runs WHERE owner=? ORDER BY created_at DESC LIMIT 50",
          )
          .bind(who)
          .all(),
      ]);
      return json({
        studies: studies.results,
        runs: runs.results.map((r) => ({
          ...r,
          summary: JSON.parse(r.summary as string),
        })),
      });
    }
    if (path[0] === "studies" && request.method === "POST") {
      const value = draftSchema.parse(await body(request, 12_000_000));
      value.request.scenarios = await canonical(value.request.scenarios, who);
      const compact = structuredClone(value);
      for (const s of compact.request.scenarios)
        for (const source of s.sources) delete source.text;
      const existing = await db()
        .prepare("SELECT owner FROM studies WHERE id=?")
        .bind(value.id)
        .first<{ owner: string }>();
      if (existing && existing.owner !== who)
        throw new AppError("Study not found.", 404);
      const data = JSON.stringify(compact);
      if (new TextEncoder().encode(data).length > 1_500_000)
        throw new AppError(
          "This study contains too much analysis history. Remove unused sources or save fewer alternatives.",
          413,
        );
      const now = new Date().toISOString();
      await db()
        .prepare(
          "INSERT INTO studies (id,owner,name,data,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,data=excluded.data,updated_at=excluded.updated_at WHERE studies.owner=excluded.owner",
        )
        .bind(value.id, who, value.name, data, now)
        .run();
      return json({ id: value.id, updatedAt: now });
    }
    if (path[0] === "studies" && request.method === "GET" && path[1]) {
      const row = await db()
        .prepare("SELECT data FROM studies WHERE id=? AND owner=?")
        .bind(path[1], who)
        .first<{ data: string }>();
      if (!row) throw new AppError("Study not found.", 404);
      const value = JSON.parse(row.data);
      value.request.scenarios = await canonical(value.request.scenarios, who);
      return json(value);
    }
    if (path[0] === "sources" && request.method === "POST") {
      if (path[1] === "import") {
        const v = z
          .object({ url: z.string().max(1800), stage: stageSchema })
          .parse(await body(request));
        return json(await importPage(v.url, v.stage, who));
      }
      if (path[1] === "manual" || path[1] === "html") {
        const v = z
          .object({
            name: z.string().min(1).max(200),
            stage: stageSchema,
            text: z
              .string()
              .min(1)
              .max(path[1] === "html" ? 2_000_000 : 50000),
          })
          .parse(await body(request, 2_100_000));
        const extracted = path[1] === "html" ? htmlText(v.text) : v.text;
        const text = extracted.slice(0, 50000),
          id = crypto.randomUUID();
        const source: Source = {
          id,
          name: v.name,
          stage: v.stage,
          kind: path[1] === "html" ? "html" : "manual",
          text,
          hash: await hash(new TextEncoder().encode(text)),
          capturedAt: new Date().toISOString(),
          coverage:
            path[1] === "html" ? "HTML text and form labels" : "supplied text",
          limitations: [
            ...(extracted.length > 50000
              ? ["Text was truncated to 50,000 characters."]
              : []),
            "Only supplied text is used. Visual layout, scripts, hidden interactions, and performance are not verified.",
          ],
        };
        await db()
          .prepare(
            "INSERT INTO sources (id,owner,data,created_at) VALUES (?,?,?,?)",
          )
          .bind(id, who, JSON.stringify(source), source.capturedAt)
          .run();
        return json(source);
      }
      const stage = stageSchema.parse(url.searchParams.get("stage")),
        name = z.string().min(1).max(200).parse(url.searchParams.get("name"));
      return json(
        await saveSource(
          who,
          stage,
          name,
          await readBounded(new Response(request.body), 8_000_000),
        ),
      );
    }
    if (path[0] === "sources" && path[1] && request.method === "GET") {
      const source = await sourceFor(path[1], who);
      if (path[2] === "file") {
        if (!source.object_key)
          throw new AppError("This source has no binary file.", 404);
        const object = await bucket().get(source.object_key);
        if (!object) throw new AppError("Source file not found.", 404);
        return new Response(object.body, {
          headers: {
            "Content-Type": source.mime!,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox",
            "Content-Disposition":
              source.mime === "application/pdf"
                ? 'attachment; filename="journey.pdf"'
                : "inline",
          },
        });
      }
      const analyses = await db()
        .prepare(
          "SELECT data FROM analyses WHERE source_id=? AND owner=? ORDER BY created_at DESC",
        )
        .bind(path[1], who)
        .all<{ data: string }>();
      return json({
        source: source.source,
        analyses: analyses.results.map((a) => JSON.parse(a.data)),
      });
    }
    if (path[0] === "analysis" && request.method === "POST") {
      const value = z
        .object({
          sourceId: z.string().uuid(),
          requestId: z.string().uuid(),
          scenario: scenarioSchema,
        })
        .parse(await body(request));
      return json(
        await analyzeSource(
          who,
          value.sourceId,
          request.headers.get("x-sim-openai") ?? "",
          value.scenario,
          value.requestId,
        ),
      );
    }
    if (path[0] === "runs" && request.method === "POST") {
      const run = parseRun(await body(request, 12_000_000));
      run.scenarios = await canonical(run.scenarios, who);
      const existing = await db()
        .prepare("SELECT id FROM simulation_runs WHERE id=? AND owner=?")
        .bind(run.id, who)
        .first();
      if (existing) return json({ id: run.id });
      const key = `${who}/runs/${run.id}/${crypto.randomUUID()}`,
        summary = {
          processed: run.processed,
          status: run.status,
          version: run.version,
          results: run.results.map((r) => ({
            name: r.scenarioName,
            purchases: r.purchases,
            netContribution: r.contribution - r.adSpend,
          })),
        };
      await bucket().put(key, JSON.stringify(run), {
        httpMetadata: { contentType: "application/json" },
      });
      try {
        await db()
          .prepare(
            "INSERT INTO simulation_runs (id,owner,name,summary,object_key,created_at) VALUES (?,?,?,?,?,?)",
          )
          .bind(
            run.id,
            who,
            run.scenarios[0].product.name,
            JSON.stringify(summary),
            key,
            run.createdAt,
          )
          .run();
      } catch (error) {
        await bucket().delete(key);
        const saved = await db()
          .prepare("SELECT id FROM simulation_runs WHERE id=? AND owner=?")
          .bind(run.id, who)
          .first();
        if (!saved) throw error;
      }
      return json({ id: run.id });
    }
    if (path[0] === "runs" && path[1] && request.method === "GET") {
      const row = await db()
        .prepare(
          "SELECT object_key FROM simulation_runs WHERE id=? AND owner=?",
        )
        .bind(path[1], who)
        .first<{ object_key: string }>();
      if (!row) throw new AppError("Run not found.", 404);
      const object = await bucket().get(row.object_key);
      if (!object) throw new AppError("Run artifact not found.", 404);
      return new Response(object.body, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, no-store",
        },
      });
    }
    throw new AppError("This endpoint does not exist.", 404);
  } catch (error) {
    if (error instanceof z.ZodError)
      return json(
        {
          error: error.issues
            .slice(0, 4)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        400,
      );
    if (error instanceof AppError)
      return json({ error: error.message }, error.status);
    return json(
      {
        error:
          "The request could not be completed. Your current inputs remain in this tab.",
      },
      500,
    );
  }
}
export const GET = handler;
export const POST = handler;
