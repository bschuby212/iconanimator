import type { ParsedSvg, SvgComponent, SvgElementNode } from "@/lib/animation/types";

function attrsToString(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .filter(([k]) => k !== "id")
    .map(([k, v]) => `${k}="${v.replace(/"/g, "&quot;")}"`)
    .join(" ");
}

function serializeNode(node: SvgElementNode): string {
  const attr = attrsToString(node.attributes);
  if (node.tag === "text" || node.tag === "tspan") {
    const inner = node.children.length
      ? node.children.map(serializeNode).join("")
      : escapeXml(node.textContent ?? "");
    return `<${node.tag}${attr ? ` ${attr}` : ""}>${inner}</${node.tag}>`;
  }
  if (node.children.length) {
    return `<${node.tag}${attr ? ` ${attr}` : ""}>${node.children
      .map(serializeNode)
      .join("")}</${node.tag}>`;
  }
  return `<${node.tag}${attr ? ` ${attr}` : ""} />`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Build a tiny SVG thumbnail for a component using its element ids. */
export function buildLayerPreviewSvg(
  parsed: ParsedSvg | null,
  component: SvgComponent,
  size = 18,
): string {
  if (component.role === "text") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><text x="12" y="16" text-anchor="middle" font-size="14" font-family="ui-sans-serif, system-ui, sans-serif" fill="currentColor">T</text></svg>`;
  }
  if (!parsed) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
  }

  const idSet = new Set(component.elementIds);
  const nodes: SvgElementNode[] = [];
  for (const el of parsed.elements) {
    if (idSet.has(el.id)) {
      nodes.push(el);
      continue;
    }
    // Include groups that contain selected children
    if (el.tag === "g" && el.children.some((c) => idSet.has(c.id))) {
      nodes.push({
        ...el,
        children: el.children.filter((c) => idSet.has(c.id)),
      });
    }
  }

  // Also pull leaf nodes that live only in elementMap
  for (const id of component.elementIds) {
    const n = parsed.elementMap[id];
    if (n && !nodes.some((x) => x.id === id) && n.tag !== "g") {
      nodes.push(n);
    }
  }

  if (!nodes.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
  }

  const body = nodes.map(serializeNode).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${parsed.viewBox}" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
