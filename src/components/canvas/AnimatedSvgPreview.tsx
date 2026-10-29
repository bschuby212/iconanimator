"use client";

import type {
  ElementTransform,
  ParsedSvg,
  SvgElementNode,
} from "@/lib/animation/types";
import { transformToSvgAttribute } from "@/lib/animation/engine";
import { DEFAULT_TRANSFORM } from "@/lib/animation/types";

function nodeProps(node: SvgElementNode) {
  const attrs: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(node.attributes)) {
    if (key === "class") {
      attrs.className = value;
      continue;
    }
    // React expects camelCase for some SVG attrs
    const map: Record<string, string> = {
      "stroke-width": "strokeWidth",
      "stroke-linecap": "strokeLinecap",
      "stroke-linejoin": "strokeLinejoin",
      "stroke-dasharray": "strokeDasharray",
      "stroke-dashoffset": "strokeDashoffset",
      "fill-opacity": "fillOpacity",
      "stroke-opacity": "strokeOpacity",
      "clip-path": "clipPath",
      "fill-rule": "fillRule",
      "clip-rule": "clipRule",
      "vector-effect": "vectorEffect",
    };
    attrs[map[key] ?? key] = value;
  }
  return attrs;
}

function AnimatedNode({
  node,
  transforms,
  selectedIds,
}: {
  node: SvgElementNode;
  transforms: Record<string, ElementTransform>;
  selectedIds: Set<string>;
}) {
  const t = transforms[node.id] ?? DEFAULT_TRANSFORM;
  const origin = t.transformOrigin;
  const ox = origin.absolute ? origin.x : 12;
  const oy = origin.absolute ? origin.y : 12;
  const transform = transformToSvgAttribute(t, ox, oy);
  const selected = selectedIds.has(node.id);
  const common = {
    ...nodeProps(node),
    "data-animator-id": node.id,
    transform,
    opacity: t.opacity,
    ...(t.fill ? { fill: t.fill } : {}),
    ...(t.stroke ? { stroke: t.stroke } : {}),
    ...(t.strokeWidth !== undefined ? { strokeWidth: t.strokeWidth } : {}),
    style: selected
      ? { outline: "1px solid var(--accent)", outlineOffset: 2 }
      : undefined,
  };

  if (node.tag === "g") {
    return (
      <g {...common}>
        {node.children.map((child) => (
          <AnimatedNode
            key={child.id}
            node={child}
            transforms={transforms}
            selectedIds={selectedIds}
          />
        ))}
      </g>
    );
  }

  if (node.tag === "path") return <path {...common} />;
  if (node.tag === "circle") return <circle {...common} />;
  if (node.tag === "ellipse") return <ellipse {...common} />;
  if (node.tag === "rect") return <rect {...common} />;
  if (node.tag === "line") return <line {...common} />;
  if (node.tag === "polyline") return <polyline {...common} />;
  if (node.tag === "polygon") return <polygon {...common} />;
  return null;
}

export function AnimatedSvgPreview({
  parsed,
  transforms,
  selectedElementIds,
  size,
  color,
  onSelectElement,
}: {
  parsed: ParsedSvg;
  transforms: Record<string, ElementTransform>;
  selectedElementIds: string[];
  size: number;
  color: string;
  onSelectElement: (elementId: string | null) => void;
}) {
  const selectedIds = new Set(selectedElementIds);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={parsed.viewBox}
      width={size}
      height={size}
      overflow="visible"
      style={{ color }}
      className="select-none"
      onClick={(e) => {
        const target = e.target as Element;
        const id = target.closest("[data-animator-id]")?.getAttribute("data-animator-id");
        onSelectElement(id ?? null);
      }}
    >
      {parsed.elements.map((node) => (
        <AnimatedNode
          key={node.id}
          node={node}
          transforms={transforms}
          selectedIds={selectedIds}
        />
      ))}
    </svg>
  );
}
