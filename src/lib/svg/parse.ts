import { nanoid } from "nanoid";
import type { ParsedSvg, SvgElementNode } from "@/lib/animation/types";
import { sanitizeSvg } from "./sanitize";
import { splitIntoLayerPaths } from "./path-split";

function parseAttributes(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

function resolvePaint(
  el: Element,
  inherited: { fill?: string; stroke?: string } = {},
): { fill: string; stroke: string; filled: boolean } {
  const fill = (el.getAttribute("fill") || inherited.fill || "").toLowerCase();
  const stroke = el.getAttribute("stroke") || inherited.stroke || "";
  const filled = !(fill === "none" || fill === "transparent");
  return { fill, stroke, filled };
}

/** Split compound paths into layer-ready pieces (hole-aware when filled). */
function layerPathSegments(
  d: string,
  el: Element,
  inherited: { fill?: string; stroke?: string } = {},
): string[] {
  const { filled } = resolvePaint(el, inherited);
  return splitIntoLayerPaths(d, { filled });
}

function parseWithDom(svg: string, splitPaths: boolean): ParsedSvg {
  const sanitized = sanitizeSvg(svg);
  const doc = new DOMParser().parseFromString(sanitized, "image/svg+xml");
  const root = doc.documentElement;
  if (root.querySelector("parsererror") || root.tagName.toLowerCase() !== "svg") {
    throw new Error("Failed to parse SVG");
  }

  const viewBox =
    root.getAttribute("viewBox") ||
    `0 0 ${root.getAttribute("width") || 24} ${root.getAttribute("height") || 24}`;
  const [, , vbW, vbH] = viewBox.split(/[\s,]+/).map(Number);
  const width = Number(root.getAttribute("width")) || vbW || 24;
  const height = Number(root.getAttribute("height")) || vbH || 24;

  const elements: SvgElementNode[] = [];
  const elementMap: Record<string, SvgElementNode> = {};

  for (const child of Array.from(root.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === "title" || tag === "desc" || tag === "metadata") continue;

    if (tag === "path" && splitPaths) {
      const d = child.getAttribute("d") || "";
      const subpaths = layerPathSegments(d, child);
      if (subpaths.length > 1) {
        const baseAttrs = parseAttributes(child);
        delete baseAttrs.d;
        // Keep original fill-rule (Phosphor nonzero winding / Hero evenodd)
        for (const sub of subpaths) {
          const id = `el_${nanoid(8)}`;
          const node: SvgElementNode = {
            id,
            tag: "path",
            attributes: { ...baseAttrs, d: sub },
            children: [],
            originalId: child.getAttribute("id") || undefined,
          };
          elements.push(node);
          elementMap[id] = node;
        }
        continue;
      }
    }

    if (tag === "g") {
      const groupId = `el_${nanoid(8)}`;
      const groupAttrs = parseAttributes(child);
      const group: SvgElementNode = {
        id: groupId,
        tag: "g",
        attributes: groupAttrs,
        children: [],
        originalId: child.getAttribute("id") || undefined,
      };
      const inherited = {
        fill: groupAttrs.fill,
        stroke: groupAttrs.stroke,
      };
      for (const gc of Array.from(child.children)) {
        if (gc.tagName.toLowerCase() === "path" && splitPaths) {
          const d = gc.getAttribute("d") || "";
          const subpaths = layerPathSegments(d, gc, inherited);
          const baseAttrs = parseAttributes(gc);
          delete baseAttrs.d;
          // Inherit stroke/fill from group when missing on the path
          if (!baseAttrs.fill && inherited.fill) baseAttrs.fill = inherited.fill;
          if (!baseAttrs.stroke && inherited.stroke) {
            baseAttrs.stroke = inherited.stroke;
          }
          if (subpaths.length > 1) {
            for (const sub of subpaths) {
              const id = `el_${nanoid(8)}`;
              const node: SvgElementNode = {
                id,
                tag: "path",
                attributes: { ...baseAttrs, d: sub },
                children: [],
                parentId: groupId,
                originalId: gc.getAttribute("id") || undefined,
              };
              group.children.push(node);
              elementMap[id] = node;
            }
          } else {
            const id = `el_${nanoid(8)}`;
            const node: SvgElementNode = {
              id,
              tag: "path",
              attributes: {
                ...baseAttrs,
                d: subpaths[0] ?? d,
              },
              children: [],
              parentId: groupId,
              originalId: gc.getAttribute("id") || undefined,
            };
            group.children.push(node);
            elementMap[id] = node;
          }
        } else {
          const id = `el_${nanoid(8)}`;
          const node: SvgElementNode = {
            id,
            tag: gc.tagName.toLowerCase(),
            attributes: parseAttributes(gc),
            children: [],
            parentId: groupId,
            originalId: gc.getAttribute("id") || undefined,
          };
          group.children.push(node);
          elementMap[id] = node;
        }
      }
      // Flatten trivial groups: promote children so Layers panel lists real paths
      if (group.children.length > 0) {
        for (const childNode of group.children) {
          delete childNode.parentId;
          elements.push(childNode);
        }
        // Keep group in elementMap only if needed; prefer flat layer list
      } else {
        elements.push(group);
        elementMap[groupId] = group;
      }
      continue;
    }

    const id = `el_${nanoid(8)}`;
    const node: SvgElementNode = {
      id,
      tag,
      attributes: parseAttributes(child),
      children: [],
      originalId: child.getAttribute("id") || undefined,
      ...(tag === "text" || tag === "tspan"
        ? { textContent: child.textContent ?? "" }
        : {}),
    };
    // Nested tspans under text
    if (tag === "text") {
      for (const tc of Array.from(child.children)) {
        if (tc.tagName.toLowerCase() !== "tspan") continue;
        const tid = `el_${nanoid(8)}`;
        const tnode: SvgElementNode = {
          id: tid,
          tag: "tspan",
          attributes: parseAttributes(tc),
          children: [],
          parentId: id,
          textContent: tc.textContent ?? "",
        };
        node.children.push(tnode);
        elementMap[tid] = tnode;
      }
    }
    elements.push(node);
    elementMap[id] = node;
  }

  return {
    viewBox,
    width,
    height,
    rootAttributes: parseAttributes(root),
    elements,
    elementMap,
    originalSvg: sanitized,
  };
}

/** Node-compatible lightweight parser using regex when DOMParser unavailable */
function parseLightweight(svg: string, splitPaths: boolean): ParsedSvg {
  const sanitized = sanitizeSvg(svg);
  const vbMatch = sanitized.match(/viewBox=["']([^"']+)["']/i);
  const viewBox = vbMatch?.[1] || "0 0 24 24";
  const [, , vbW, vbH] = viewBox.split(/[\s,]+/).map(Number);

  const elements: SvgElementNode[] = [];
  const elementMap: Record<string, SvgElementNode> = {};

  // Extract path elements (fill-aware layer split, same as DOM parser)
  const pathRe = /<path\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(sanitized)) !== null) {
    const attrStr = m[1];
    const attrs = parseAttrString(attrStr);
    const d = attrs.d || "";
    const fill = (attrs.fill || "").toLowerCase();
    const filled = !(fill === "none" || fill === "transparent");
    // Heuristic: group-level fill="none" often lives on a parent <g>; if the
    // path itself has a stroke and no fill, treat as unfilled stroke layering.
    const strokeOnly = !!attrs.stroke && (!fill || fill === "none");
    const subs = splitPaths
      ? splitIntoLayerPaths(d, { filled: filled && !strokeOnly })
      : [d];
    const base = { ...attrs };
    delete base.d;
    for (const sub of subs) {
      const id = `el_${nanoid(8)}`;
      const node: SvgElementNode = {
        id,
        tag: "path",
        attributes: { ...base, d: sub },
        children: [],
      };
      elements.push(node);
      elementMap[id] = node;
    }
  }

  // circles, rects, lines, etc.
  for (const tag of ["circle", "ellipse", "rect", "line", "polyline", "polygon"]) {
    const re = new RegExp(`<${tag}\\b([^>]*)\\/?>`, "gi");
    let tm: RegExpExecArray | null;
    while ((tm = re.exec(sanitized)) !== null) {
      const id = `el_${nanoid(8)}`;
      const node: SvgElementNode = {
        id,
        tag,
        attributes: parseAttrString(tm[1]),
        children: [],
      };
      elements.push(node);
      elementMap[id] = node;
    }
  }

  return {
    viewBox,
    width: vbW || 24,
    height: vbH || 24,
    rootAttributes: { viewBox, xmlns: "http://www.w3.org/2000/svg" },
    elements,
    elementMap,
    originalSvg: sanitized,
  };
}

function parseAttrString(str: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([:\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    attrs[m[1]] = m[3] ?? m[4] ?? "";
  }
  return attrs;
}

export function parseSvg(
  svg: string,
  options: { splitPaths?: boolean } = {},
): ParsedSvg {
  // Default ON for component recognition. splitPathData converts relative
  // movetos to absolute so subpaths keep correct positions when separated.
  const splitPaths = options.splitPaths !== false;
  if (typeof DOMParser !== "undefined") {
    return parseWithDom(svg, splitPaths);
  }
  return parseLightweight(svg, splitPaths);
}

export function serializeElementsToSvg(parsed: ParsedSvg): string {
  const body = parsed.elements.map(serializeNode).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${parsed.viewBox}" width="${parsed.width}" height="${parsed.height}">${body}</svg>`;
}

function serializeNode(node: SvgElementNode): string {
  const attrs = Object.entries(node.attributes)
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
    .join(" ");
  if (node.children.length) {
    return `<${node.tag} data-animator-id="${node.id}" ${attrs}>${node.children.map(serializeNode).join("")}</${node.tag}>`;
  }
  return `<${node.tag} data-animator-id="${node.id}" ${attrs} />`;
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function getLeafElements(parsed: ParsedSvg): SvgElementNode[] {
  const leaves: SvgElementNode[] = [];
  function visit(nodes: SvgElementNode[]) {
    for (const n of nodes) {
      if (n.children.length) visit(n.children);
      else leaves.push(n);
    }
  }
  visit(parsed.elements);
  return leaves;
}

export function elementToPathApprox(node: SvgElementNode): string {
  if (node.tag === "path") return node.attributes.d || "";
  if (node.tag === "circle") {
    const cx = Number(node.attributes.cx || 0);
    const cy = Number(node.attributes.cy || 0);
    const r = Number(node.attributes.r || 0);
    return `M${cx - r},${cy}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`;
  }
  if (node.tag === "rect") {
    const x = Number(node.attributes.x || 0);
    const y = Number(node.attributes.y || 0);
    const w = Number(node.attributes.width || 0);
    const h = Number(node.attributes.height || 0);
    return `M${x},${y}h${w}v${h}h${-w}z`;
  }
  if (node.tag === "line") {
    return `M${node.attributes.x1 || 0},${node.attributes.y1 || 0}L${node.attributes.x2 || 0},${node.attributes.y2 || 0}`;
  }
  return "";
}
