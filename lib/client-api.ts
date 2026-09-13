export async function api<T>(
  path: string,
  data?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(`/api/sim/${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers:
      data === undefined
        ? headers
        : { "Content-Type": "application/json", ...headers },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const value = await response.json();
  if (!response.ok)
    throw Error((value as { error?: string }).error ?? "Request failed.");
  return value as T;
}
export async function uploadSource(file: File, stage: string) {
  if (file.size > 8_000_000)
    throw Error(
      "Upload files smaller than 8 MB. Export a shorter PDF or compress the image.",
    );
  if (/\.html?$/i.test(file.name))
    return api<import("./sim/types").Source>("sources/html", {
      stage,
      name: file.name,
      text: await file.text(),
    });
  if (/\.(txt|md)$/i.test(file.name))
    return api<import("./sim/types").Source>("sources/manual", {
      stage,
      name: file.name,
      text: await file.text(),
    });
  const response = await fetch(
    `/api/sim/sources?stage=${stage}&name=${encodeURIComponent(file.name.slice(0, 200))}`,
    { method: "POST", body: file },
  );
  const value = await response.json();
  if (!response.ok)
    throw Error((value as { error?: string }).error ?? "Upload failed.");
  return value as import("./sim/types").Source;
}
export function download(
  name: string,
  text: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
