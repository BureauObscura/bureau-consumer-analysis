import { AppError } from "./errors";
export function publicPageUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError("Enter a complete public HTTPS page URL.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new AppError("Use a public HTTPS page without embedded credentials.");
  if (
    !host.includes(".") ||
    host.includes(":") ||
    /^\d+(\.\d+){3}$/.test(host) ||
    /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host) ||
    host.endsWith(".localhost")
  )
    throw new AppError("Local and private addresses cannot be imported.");
  for (const key of url.searchParams.keys())
    if (
      /token|secret|password|auth|session|email|signature|credential|api_key|^(sig|key|code|ticket)$/i.test(
        key,
      )
    )
      throw new AppError(
        "Remove private or signed query parameters before importing a public page.",
      );
  if (raw.length > 1800) throw new AppError("Page URL is too long.");
  url.hash = "";
  return url;
}
