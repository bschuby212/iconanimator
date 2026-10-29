import { nanoid } from "nanoid";
import type {
  ComponentRole,
  ParsedSvg,
  SvgComponent,
  SvgElementNode,
} from "@/lib/animation/types";
import { elementToPathApprox, getLeafElements } from "./parse";
import { roughBounds } from "./path-split";

interface LeafInfo {
  node: SvgElementNode;
  bounds: ReturnType<typeof roughBounds>;
  area: number;
}

function leafInfo(node: SvgElementNode): LeafInfo {
  const d = elementToPathApprox(node);
  const bounds = roughBounds(d);
  const area = Math.max(0.1, (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY));
  return { node, bounds, area };
}

function makeComponent(
  name: string,
  role: ComponentRole,
  elementIds: string[],
  origin: { x: number; y: number; absolute?: boolean },
): SvgComponent {
  return {
    id: `cmp_${nanoid(8)}`,
    name,
    role,
    elementIds,
    transformOrigin: origin,
  };
}

function classifyByIconName(
  iconName: string,
  leaves: LeafInfo[],
): SvgComponent[] | null {
  const name = iconName.toLowerCase().replace(/\s+/g, "-");

  if (
    name.includes("trash") ||
    name.includes("delete") ||
    name.includes("bin")
  ) {
    return recognizeTrash(leaves);
  }
  if (
    name.includes("settings") ||
    name.includes("cog") ||
    name.includes("gear")
  ) {
    return recognizeGear(leaves);
  }
  if (
    name.includes("pencil") ||
    name === "edit" ||
    name.includes("file-pencil") ||
    name.includes("writing")
  ) {
    return recognizeEdit(leaves, name);
  }
  if (name.includes("bell")) {
    return recognizeBell(leaves);
  }
  if (name.includes("lock") || name.includes("padlock")) {
    return recognizeLock(leaves);
  }
  if (
    name.includes("mail") ||
    name.includes("envelope") ||
    name.includes("letter")
  ) {
    return recognizeEnvelope(leaves);
  }
  if (name.includes("download")) {
    return recognizeDownload(leaves);
  }
  if (name.includes("search") || name.includes("zoom")) {
    return recognizeSearch(leaves);
  }

  return null;
}

function recognizeTrash(leaves: LeafInfo[]): SvgComponent[] {
  // Heuristic: uppermost small paths = lid/handle; large mid path = body; vertical lines = interior
  const sorted = [...leaves].sort((a, b) => a.bounds.minY - b.bounds.minY);
  const lidCandidates = sorted.filter((l) => l.bounds.maxY <= 8.5);
  const bodyCandidates = sorted.filter((l) => l.bounds.maxY > 8.5);

  const lidIds = (lidCandidates.length ? lidCandidates : sorted.slice(0, 1)).map(
    (l) => l.node.id,
  );
  const bodyIds = (
    bodyCandidates.length ? bodyCandidates : sorted.slice(1)
  ).map((l) => l.node.id);

  // Lid hinge near top center of body
  const allLid = lidCandidates.length ? lidCandidates : [sorted[0]];
  const hingeX =
    allLid.reduce((s, l) => s + l.bounds.cx, 0) / Math.max(allLid.length, 1);
  const hingeY = Math.min(...allLid.map((l) => l.bounds.minY));

  const comps: SvgComponent[] = [];
  if (bodyIds.length) {
    comps.push(
      makeComponent("Container", "body", bodyIds, { x: 0.5, y: 0.5 }),
    );
  }
  if (lidIds.length) {
    comps.push(
      makeComponent("Lid", "lid", lidIds, {
        x: hingeX,
        y: hingeY + 0.5,
        absolute: true,
      }),
    );
  }
  return comps;
}

function recognizeGear(leaves: LeafInfo[]): SvgComponent[] {
  // Entire gear typically one complex path; optional center circle
  const byArea = [...leaves].sort((a, b) => b.area - a.area);
  const gear = byArea[0];
  const rest = byArea.slice(1);
  const comps: SvgComponent[] = [
    makeComponent("Gear", "gear", [gear.node.id], {
      x: gear.bounds.cx,
      y: gear.bounds.cy,
      absolute: true,
    }),
  ];
  if (rest.length) {
    comps.push(
      makeComponent(
        "Center",
        "center",
        rest.map((r) => r.node.id),
        {
          x: rest[0].bounds.cx,
          y: rest[0].bounds.cy,
          absolute: true,
        },
      ),
    );
  }
  return comps;
}

function recognizeEdit(leaves: LeafInfo[], name: string): SvgComponent[] {
  if (name.includes("pencil") && !name.includes("file") && leaves.length <= 2) {
    // Single pencil icon — treat whole as pencil; synthesize paper note if needed by generator
    return [
      makeComponent(
        "Pencil",
        "pencil",
        leaves.map((l) => l.node.id),
        { x: 0.5, y: 0.5 },
      ),
    ];
  }

  // edit / file-pencil: paper-like paths (axis-aligned-ish, larger) vs diagonal pencil
  const scored = leaves.map((l) => {
    const w = l.bounds.maxX - l.bounds.minX;
    const h = l.bounds.maxY - l.bounds.minY;
    const diagonalish = Math.abs(w - h) < 4 && w > 2;
    const topLeftish = l.bounds.minX < 10 && l.bounds.minY < 10;
    return { l, scorePencil: diagonalish && !topLeftish ? 1 : 0, area: l.area };
  });

  const pencil = [...scored].sort((a, b) => {
    if (b.scorePencil !== a.scorePencil) return b.scorePencil - a.scorePencil;
    return a.area - b.area;
  })[0];

  const pencilIds = new Set([pencil.l.node.id]);
  // Also include small stroke near pencil tip (often a separate path)
  for (const s of scored) {
    if (s.l.node.id === pencil.l.node.id) continue;
    if (s.area < pencil.area * 0.4 && s.scorePencil) {
      pencilIds.add(s.l.node.id);
    }
  }

  const paperIds = leaves
    .filter((l) => !pencilIds.has(l.node.id))
    .map((l) => l.node.id);

  const comps: SvgComponent[] = [];
  if (paperIds.length) {
    comps.push(makeComponent("Paper", "paper", paperIds, { x: 0.5, y: 0.5 }));
  }
  comps.push(
    makeComponent("Pencil", "pencil", [...pencilIds], {
      x: pencil.l.bounds.cx,
      y: pencil.l.bounds.cy,
      absolute: true,
    }),
  );
  return comps;
}

function recognizeBell(leaves: LeafInfo[]): SvgComponent[] {
  // Lower path segment often the clapper (high minY)
  const byMaxY = [...leaves].sort((a, b) => b.bounds.maxY - a.bounds.maxY);
  const clapper = byMaxY.find((l) => l.bounds.minY >= 15) ?? byMaxY[0];
  const bodyIds = leaves
    .filter((l) => l.node.id !== clapper.node.id)
    .map((l) => l.node.id);

  // If only one path, split heuristically already done — clapper is bottom-most subpath
  if (leaves.length === 1) {
    return [
      makeComponent("Bell", "bell", [leaves[0].node.id], {
        x: leaves[0].bounds.cx,
        y: leaves[0].bounds.minY,
        absolute: true,
      }),
    ];
  }

  const bodyLeaves = leaves.filter((l) => l.node.id !== clapper.node.id);
  const pivot =
    bodyLeaves[0] ??
    leaves.find((l) => l.node.id !== clapper.node.id) ??
    leaves[0];

  return [
    makeComponent(
      "Bell",
      "bell",
      bodyIds.length ? bodyIds : [leaves[0].node.id],
      {
        x: pivot.bounds.cx,
        y: pivot.bounds.minY + 1,
        absolute: true,
      },
    ),
    makeComponent("Clapper", "clapper", [clapper.node.id], {
      x: clapper.bounds.cx,
      y: clapper.bounds.minY,
      absolute: true,
    }),
  ];
}

function recognizeLock(leaves: LeafInfo[]): SvgComponent[] {
  // Body: lower rectangular path; shackle: upper U; keyhole: small center
  const byCy = [...leaves].sort((a, b) => a.bounds.cy - b.bounds.cy);
  const shackle = byCy[0];
  const rest = byCy.slice(1);
  const keyhole = rest.find((l) => l.area < 8);
  const body = rest.filter((l) => l.node.id !== keyhole?.node.id);

  const comps: SvgComponent[] = [
    makeComponent(
      "Body",
      "body",
      (body.length ? body : rest).map((l) => l.node.id),
      { x: 0.5, y: 0.5 },
    ),
    makeComponent("Shackle", "shackle", [shackle.node.id], {
      x: shackle.bounds.maxX - 1,
      y: shackle.bounds.maxY,
      absolute: true,
    }),
  ];
  if (keyhole) {
    comps.push(
      makeComponent("Keyhole", "keyhole", [keyhole.node.id], {
        x: 0.5,
        y: 0.5,
      }),
    );
  }
  return comps;
}

function recognizeEnvelope(leaves: LeafInfo[]): SvgComponent[] {
  // Flap: the V/chevron path; body: rectangle
  const byArea = [...leaves].sort((a, b) => b.area - a.area);
  const body = byArea[0];
  const flap = byArea[1] ?? byArea[0];
  const comps: SvgComponent[] = [
    makeComponent("Envelope", "body", [body.node.id], { x: 0.5, y: 0.5 }),
  ];
  if (flap.node.id !== body.node.id) {
    comps.push(
      makeComponent("Flap", "flap", [flap.node.id], {
        x: flap.bounds.cx,
        y: flap.bounds.minY,
        absolute: true,
      }),
    );
  }
  return comps;
}

function recognizeDownload(leaves: LeafInfo[]): SvgComponent[] {
  // Tray: bottom path (high minY); arrow: remaining
  const byMinY = [...leaves].sort((a, b) => b.bounds.minY - a.bounds.minY);
  const tray = byMinY[0];
  const arrowIds = leaves
    .filter((l) => l.node.id !== tray.node.id)
    .map((l) => l.node.id);

  return [
    makeComponent("Tray", "tray", [tray.node.id], { x: 0.5, y: 0.5 }),
    makeComponent(
      "Arrow",
      "arrow",
      arrowIds.length ? arrowIds : [leaves[0].node.id],
      { x: 0.5, y: 0.5 },
    ),
  ];
}

function recognizeSearch(leaves: LeafInfo[]): SvgComponent[] {
  return [
    makeComponent(
      "Magnifier",
      "glass",
      leaves.map((l) => l.node.id),
      { x: 0.5, y: 0.5 },
    ),
  ];
}

function genericComponents(leaves: LeafInfo[]): SvgComponent[] {
  if (leaves.length === 1) {
    return [
      makeComponent("Icon", "other", [leaves[0].node.id], { x: 0.5, y: 0.5 }),
    ];
  }
  return leaves.map((l, i) =>
    makeComponent(`Part ${i + 1}`, "other", [l.node.id], {
      x: l.bounds.cx,
      y: l.bounds.cy,
      absolute: true,
    }),
  );
}

export function recognizeComponents(
  parsed: ParsedSvg,
  iconName: string,
): SvgComponent[] {
  const leaves = getLeafElements(parsed).map(leafInfo);
  if (!leaves.length) return [];

  const specialized = classifyByIconName(iconName, leaves);
  if (specialized && specialized.length) {
    // Ensure all leaves covered
    const covered = new Set(specialized.flatMap((c) => c.elementIds));
    const missing = leaves.filter((l) => !covered.has(l.node.id));
    if (missing.length) {
      // Attach missing to largest component or create Other
      if (specialized[0]) {
        specialized[0].elementIds.push(...missing.map((m) => m.node.id));
      }
    }
    return specialized;
  }
  return genericComponents(leaves);
}

export function findComponentByRole(
  components: SvgComponent[],
  role: ComponentRole,
): SvgComponent | undefined {
  return components.find((c) => c.role === role);
}

export function groupElements(
  components: SvgComponent[],
  elementIds: string[],
  name: string,
  role: ComponentRole = "other",
): SvgComponent[] {
  const idSet = new Set(elementIds);
  const next = components
    .map((c) => ({
      ...c,
      elementIds: c.elementIds.filter((id) => !idSet.has(id)),
    }))
    .filter((c) => c.elementIds.length > 0);

  next.push(
    makeComponent(name, role, elementIds, {
      x: 0.5,
      y: 0.5,
    }),
  );
  return next;
}

export function ungroupComponent(
  components: SvgComponent[],
  componentId: string,
): SvgComponent[] {
  const target = components.find((c) => c.id === componentId);
  if (!target) return components;
  const rest = components.filter((c) => c.id !== componentId);
  for (const eid of target.elementIds) {
    rest.push(makeComponent(`Element`, "other", [eid], { x: 0.5, y: 0.5 }));
  }
  return rest;
}

/** Inject a simple letter rectangle into envelope SVGs when missing */
export function ensureLetterElement(
  parsed: ParsedSvg,
  components: SvgComponent[],
): { parsed: ParsedSvg; components: SvgComponent[]; created: boolean } {
  if (components.some((c) => c.role === "letter")) {
    return { parsed, components, created: false };
  }
  const id = `el_${nanoid(8)}`;
  const letter: SvgElementNode = {
    id,
    tag: "rect",
    attributes: {
      x: "7",
      y: "9",
      width: "10",
      height: "8",
      rx: "0.5",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      opacity: "0",
    },
    children: [],
  };
  const newParsed: ParsedSvg = {
    ...parsed,
    elements: [...parsed.elements, letter],
    elementMap: { ...parsed.elementMap, [id]: letter },
  };
  const letterCmp = makeComponent("Letter", "letter", [id], {
    x: 0.5,
    y: 0.5,
  });
  return {
    parsed: newParsed,
    components: [...components, letterCmp],
    created: true,
  };
}
