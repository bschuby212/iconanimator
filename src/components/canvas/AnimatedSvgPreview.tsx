"use client";

import { useCallback, useState } from "react";
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
      "font-size": "fontSize",
      "font-family": "fontFamily",
      "font-weight": "fontWeight",
      "text-anchor": "textAnchor",
      "dominant-baseline": "dominantBaseline",
      "letter-spacing": "letterSpacing",
    };
    attrs[map[key] ?? key] = value;
  }
  return attrs;
}

function isIdentityTransform(t: ElementTransform): boolean {
  return (
    t.x === 0 &&
    t.y === 0 &&
    t.rotation === 0 &&
    t.scaleX === 1 &&
    t.scaleY === 1 &&
    t.skewX === 0 &&
    t.skewY === 0
  );
}

function AnimatedNode({
  node,
  transforms,
  selectedIds,
  hoveredId,
  originX,
  originY,
}: {
  node: SvgElementNode;
  transforms: Record<string, ElementTransform>;
  selectedIds: Set<string>;
  hoveredId: string | null;
  originX: number;
  originY: number;
}) {
  const hasTrack = Object.prototype.hasOwnProperty.call(transforms, node.id);
  const t = hasTrack ? transforms[node.id] : DEFAULT_TRANSFORM;
  const origin = t.transformOrigin;
  const ox = origin.absolute ? origin.x : originX;
  const oy = origin.absolute ? origin.y : originY;
  // Preserve original SVG transform attributes when we are not animating this node
  const animatedTransform =
    hasTrack && !isIdentityTransform(t)
      ? transformToSvgAttribute(t, ox, oy)
      : hasTrack
        ? transformToSvgAttribute(t, ox, oy)
        : undefined;
  const selected = selectedIds.has(node.id);
  const hovered = hoveredId === node.id && !selected;
  const base = nodeProps(node);
  const common = {
    ...base,
    "data-animator-id": node.id,
    ...(animatedTransform
      ? {
          transform: base.transform
            ? `${animatedTransform} ${base.transform}`
            : animatedTransform,
        }
      : {}),
    ...(hasTrack ? { opacity: t.opacity } : {}),
    ...(t.fill ? { fill: t.fill } : {}),
    ...(t.stroke ? { stroke: t.stroke } : {}),
    ...(t.strokeWidth !== undefined ? { strokeWidth: t.strokeWidth } : {}),
    style: {
      cursor: "pointer",
      pointerEvents: "all" as const,
      ...(selected
        ? {
            filter: "url(#animator-selection-glow)",
          }
        : hovered
          ? {
              filter: "url(#animator-hover-glow)",
            }
          : {}),
    },
  };

  if (node.tag === "g") {
    return (
      <g {...common} style={{ cursor: "pointer", pointerEvents: "all" }}>
        {node.children.map((child) => (
          <AnimatedNode
            key={child.id}
            node={child}
            transforms={transforms}
            selectedIds={selectedIds}
            hoveredId={hoveredId}
            originX={originX}
            originY={originY}
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
  if (node.tag === "text") {
    return (
      <text {...common} style={{ ...common.style, pointerEvents: "all" }}>
        {node.children.length
          ? node.children.map((child) => (
              <AnimatedNode
                key={child.id}
                node={child}
                transforms={transforms}
                selectedIds={selectedIds}
                hoveredId={hoveredId}
                originX={originX}
                originY={originY}
              />
            ))
          : node.textContent}
      </text>
    );
  }
  if (node.tag === "tspan") {
    return <tspan {...common}>{node.textContent}</tspan>;
  }
  return null;
}

export function AnimatedSvgPreview({
  parsed,
  transforms,
  selectedElementIds,
  size,
  color,
  onSelectElement,
  labelForElement,
}: {
  parsed: ParsedSvg;
  transforms: Record<string, ElementTransform>;
  selectedElementIds: string[];
  size: number;
  color: string;
  onSelectElement: (elementId: string | null) => void;
  /** Resolve a human layer name for tooltip on hover */
  labelForElement?: (elementId: string) => string;
}) {
  const selectedIds = new Set(selectedElementIds);
  const vb = parsed.viewBox.split(/[\s,]+/).map(Number);
  const originX = (vb[0] || 0) + (vb[2] || 24) / 2;
  const originY = (vb[1] || 0) + (vb[3] || 24) / 2;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(
    null,
  );

  const idFromEvent = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    return (
      target.closest("[data-animator-id]")?.getAttribute("data-animator-id") ??
      null
    );
  }, []);

  /** Resolve a layer under the cursor, including sparse fills (gear holes, strokes). */
  const idAtPoint = useCallback(
    (svg: SVGSVGElement, clientX: number, clientY: number, target: EventTarget | null) => {
      const direct = idFromEvent(target);
      if (direct) return direct;

      const stack = document.elementsFromPoint(clientX, clientY);
      for (const el of stack) {
        if (!(el instanceof Element) || el === svg) continue;
        const found = el
          .closest("[data-animator-id]")
          ?.getAttribute("data-animator-id");
        if (found) return found;
      }

      // BBox fallback so hovering a hole still names the surrounding path
      try {
        const ctm = svg.getScreenCTM()?.inverse();
        if (!ctm) return null;
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const local = pt.matrixTransform(ctm);
        const nodes = [
          ...svg.querySelectorAll<SVGGraphicsElement>("[data-animator-id]"),
        ].reverse();
        for (const node of nodes) {
          if (node.tagName.toLowerCase() === "g") continue;
          const bb = node.getBBox();
          if (
            local.x >= bb.x &&
            local.x <= bb.x + bb.width &&
            local.y >= bb.y &&
            local.y <= bb.y + bb.height
          ) {
            return node.getAttribute("data-animator-id");
          }
        }
      } catch {
        // getBBox can throw on detached/display:none nodes
      }
      return null;
    },
    [idFromEvent],
  );

  return (
    <div className="relative inline-block">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={parsed.viewBox}
        width={size}
        height={size}
        overflow="visible"
        style={{ color, overflow: "visible", maxWidth: "none" }}
        className="block select-none overflow-visible"
        data-testid="animated-svg-preview"
        onClick={(e) => {
          e.stopPropagation();
          const svg = e.currentTarget;
          if (e.target === svg) {
            const id = idAtPoint(svg, e.clientX, e.clientY, e.target);
            onSelectElement(id);
            return;
          }
          onSelectElement(idFromEvent(e.target) ?? idAtPoint(svg, e.clientX, e.clientY, e.target));
        }}
        onMouseMove={(e) => {
          const id = idAtPoint(e.currentTarget, e.clientX, e.clientY, e.target);
          setHoveredId(id);
          if (!id) {
            setTip(null);
            return;
          }
          const label =
            labelForElement?.(id) ??
            parsed.elementMap[id]?.originalId ??
            id;
          const rect = e.currentTarget.getBoundingClientRect();
          setTip({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            label,
          });
        }}
        onMouseLeave={() => {
          setHoveredId(null);
          setTip(null);
        }}
      >
        <defs>
          <filter
            id="animator-selection-glow"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="0.6"
              floodColor="#0f9f8a"
              floodOpacity="0.95"
            />
          </filter>
          <filter
            id="animator-hover-glow"
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
          >
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="0.45"
              floodColor="#0f9f8a"
              floodOpacity="0.35"
            />
          </filter>
        </defs>
        {parsed.elements.map((node) => (
          <AnimatedNode
            key={node.id}
            node={node}
            transforms={transforms}
            selectedIds={selectedIds}
            hoveredId={hoveredId}
            originX={originX}
            originY={originY}
          />
        ))}
      </svg>
      {tip && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded-md bg-[#0b7f6e]/92 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white shadow-sm"
          style={{ left: tip.x, top: tip.y }}
          data-testid="layer-hover-tooltip"
        >
          {tip.label}
        </div>
      )}
    </div>
  );
}
