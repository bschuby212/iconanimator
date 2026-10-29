import { nanoid } from "nanoid";
import type { ParsedSvg, SvgElementNode } from "@/lib/animation/types";
import { sanitizeSvg } from "./sanitize";
import { splitPathData } from "./path-split";

function parseAttributes(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    attrs[attr.name] = attr.value;
  }
  return attrs;
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
      const subpaths = splitPathData(d);
      if (subpaths.length > 1) {
        const baseAttrs = parseAttributes(child);
        delete baseAttrs.d;
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
      const group: SvgElementNode = {
        id: groupId,
        tag: "g",
        attributes: parseAttributes(child),
        children: [],
        originalId: child.getAttribute("id") || undefined,
      };
      for (const gc of Array.from(child.children)) {
        if (gc.tagName.toLowerCase() === "path" && splitPaths) {
          const d = gc.getAttribute("d") || "";
          const subpaths = splitPathData(d);
          const baseAttrs = parseAttributes(gc);
          delete baseAttrs.d;
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
      elements.push(group);
      elementMap[groupId] = group;
      continue;
    }

    const id = `el_${nanoid(8)}`;
    const node: SvgElementNode = {
      id,
      tag,
      attributes: parseAttributes(child),
      children: [],
      originalId: child.getAttribute("id") || undefined,
    };
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

  // Extract path elements
  const pathRe = /<path\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(sanitized)) !== null) {
    const attrStr = m[1];
    const attrs = parseAttrString(attrStr);
    const d = attrs.d || "";
    const subs = splitPaths ? splitPathData(d) : [d];
    for (const sub of subs) {
      const id = `el_${nanoid(8)}`;
      const node: SvgElementNode = {
        id,
        tag: "path",
        attributes: { ...attrs, d: sub },
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
