const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "path",
  "circle",
  "ellipse",
  "rect",
  "line",
  "polyline",
  "polygon",
  "defs",
  "clipPath",
  "mask",
  "use",
  "title",
  "desc",
  "metadata",
]);

const ALLOWED_ATTRS = new Set([
  "id",
  "class",
  "d",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-opacity",
  "fill-opacity",
  "opacity",
  "transform",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "points",
  "viewBox",
  "xmlns",
  "xmlns:xlink",
  "xlink:href",
  "href",
  "clip-path",
  "mask",
  "fill-rule",
  "clip-rule",
  "vector-effect",
]);

export function sanitizeSvg(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Empty SVG");
  }
  // Allow SVG fragments (path/g/etc.) but reject plain text without markup
  if (!/<svg[\s>]/i.test(trimmed)) {
    if (!/<(path|g|circle|rect|line|polygon|polyline|ellipse)\b/i.test(trimmed)) {
      throw new Error("Invalid SVG markup");
    }
    const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${trimmed}</svg>`;
    return sanitizeSvg(wrapped);
  }

  // Strip scripts, event handlers, foreignObject, styles with urls
  const svg = trimmed
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/data:/gi, "");

  // Parse with DOMParser in browser / linkedom-like approach via regex fallback for Node
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      throw new Error("Invalid SVG markup");
    }
    const root = doc.documentElement;
    if (root.tagName.toLowerCase() !== "svg") {
      throw new Error("Root element must be svg");
    }
    cleanNode(root);
    return new XMLSerializer().serializeToString(root);
  }

  // Node fallback: basic validation
  if (/<(script|foreignObject|iframe|object|embed)\b/i.test(svg)) {
    throw new Error("Disallowed SVG content");
  }
  return svg;
}

function cleanNode(node: Element): void {
  const tag = node.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag) && tag !== "svg") {
    node.remove();
    return;
  }
  const toRemove: Attr[] = [];
  for (const attr of Array.from(node.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on") || !ALLOWED_ATTRS.has(name)) {
      // keep data-* for internal use? strip for safety
      if (!name.startsWith("data-animator")) {
        toRemove.push(attr);
      }
    }
  }
  toRemove.forEach((a) => node.removeAttribute(a.name));
  for (const child of Array.from(node.children)) {
    cleanNode(child);
  }
}

export function validateSvg(input: string): { ok: boolean; error?: string } {
  try {
    sanitizeSvg(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid SVG" };
  }
}
