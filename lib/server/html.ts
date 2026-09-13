import { Parser } from "htmlparser2";
/** Parse inert source. Never execute scripts, load resources, or return executable HTML. */
export function htmlText(html: string): string {
  const parts: string[] = [];
  let suppressed = 0;
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (["script", "style", "noscript", "template"].includes(name))
          suppressed++;
        if (suppressed) return;
        const label =
          attrs["aria-label"] ?? attrs.placeholder ?? attrs.name ?? "unlabeled";
        const required =
          "required" in attrs
            ? ", required"
            : attrs["aria-required"] === "true"
              ? ", marked required"
              : "";
        if (name === "input") {
          const type = (attrs.type ?? "text").toLowerCase();
          if (["submit", "button", "reset", "image"].includes(type))
            parts.push(` [Action: ${attrs.value ?? attrs.alt ?? label}] `);
          else if (type !== "hidden" && !("disabled" in attrs))
            parts.push(` [Input: ${label}; ${type}${required}] `);
        }
        if (["select", "textarea"].includes(name) && !("disabled" in attrs))
          parts.push(` [${name}: ${label}${required}] `);
        if (name === "img" && attrs.alt)
          parts.push(` [Image description: ${attrs.alt}] `);
        if (
          [
            "br",
            "p",
            "div",
            "section",
            "li",
            "h1",
            "h2",
            "h3",
            "button",
            "label",
          ].includes(name)
        )
          parts.push("\n");
      },
      ontext(text) {
        if (!suppressed) parts.push(text);
      },
      onclosetag(name) {
        if (["script", "style", "noscript", "template"].includes(name))
          suppressed = Math.max(0, suppressed - 1);
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  return parts
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}
