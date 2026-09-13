import { AppError, db, hash, readBounded } from "./storage";
import type { Source, Stage } from "@/lib/sim/types";
/** All network traffic goes to a fixed public reader service, never to caller-controlled destinations. */
import { publicPageUrl } from "./url-policy";
export { publicPageUrl } from "./url-policy";
export async function importPage(
  raw: string,
  stage: Stage,
  who: string,
): Promise<Source> {
  const url = publicPageUrl(raw);
  const response = await fetch(`https://r.jina.ai/${url.href}`, {
    method: "GET",
    headers: {
      Accept: "text/plain",
      DNT: "1",
      "X-No-Cache": "true",
      "X-Base": "final",
    },
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new AppError(
      `The public page reader could not retrieve this page (${response.status}). Upload a screenshot or paste the page text.`,
      502,
    );
  const bytes = await readBounded(response, 250000),
    fetchedText = new TextDecoder().decode(bytes),
    text = fetchedText.slice(0, 50000);
  if (
    text.length < 80 ||
    /^(?:Error|Warning):.*(?:error [45][0-9][0-9]|captcha|denied|blocked|cloudflare challenge)/im.test(
      text,
    )
  )
    throw new AppError(
      "The page did not return usable public content. Upload a screenshot or paste its text.",
      422,
    );
  const id = crypto.randomUUID(),
    source: Source = {
      id,
      stage,
      kind: "html",
      name: (url.hostname + url.pathname).slice(0, 200),
      originUrl: url.href,
      text,
      hash: await hash(new TextEncoder().encode(text)),
      capturedAt: new Date().toISOString(),
      coverage: "public reader text",
      limitations: [
        ...text
          .split("\n")
          .filter((line) => /^Warning:/i.test(line))
          .slice(0, 10)
          .map((line) => line.slice(0, 500)),
        ...(fetchedText.length > 50000
          ? ["Imported text was truncated to 50,000 characters."]
          : []),
        "The original requested URL is recorded. The reader may follow redirects; the final destination is not independently verified.",
        "Fetched through Jina Reader. Text does not verify visual layout, load speed, personalized content, or working checkout behavior.",
        "Only this selected page was imported. No purchase actions or checkout submissions were performed.",
      ],
    };
  await db()
    .prepare("INSERT INTO sources (id,owner,data,created_at) VALUES (?,?,?,?)")
    .bind(id, who, JSON.stringify(source), source.capturedAt)
    .run();
  return source;
}
