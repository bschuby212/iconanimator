import { getIconData, iconToSVG } from "@iconify/utils";
import type { IconifyJSON } from "@iconify/types";
import {
  parseIconVariant,
  pickDefaultVariant,
  preferredVariantOrder,
  variantLabel,
} from "./variants";

export type LibraryId =
  | "tabler"
  | "lucide"
  | "feather"
  | "heroicons"
  | "ph"
  | "ri"
  | "iconoir"
  | "bi"
  | "material-symbols";

export interface LibraryMeta {
  id: LibraryId;
  name: string;
  /** SPDX / human license note for the official icon set */
  license: string;
  prefix: string;
  /** Whether this set commonly exposes style weights/variants */
  hasVariants: boolean;
}

/**
 * Official Iconify JSON packs — raw SVG geometry via Iconify, not React components.
 * Remix (`ri`) ships under Apache-2.0 in @iconify-json/ri; verify product terms before redistribution.
 */
export const LIBRARIES: LibraryMeta[] = [
  {
    id: "ph",
    name: "Phosphor Icons",
    license: "MIT",
    prefix: "ph",
    hasVariants: true,
  },
  {
    id: "tabler",
    name: "Tabler Icons",
    license: "MIT",
    prefix: "tabler",
    hasVariants: false,
  },
  {
    id: "lucide",
    name: "Lucide",
    license: "ISC",
    prefix: "lucide",
    hasVariants: false,
  },
  {
    id: "heroicons",
    name: "Heroicons",
    license: "MIT",
    prefix: "heroicons",
    hasVariants: true,
  },
  {
    id: "ri",
    name: "Remix Icon",
    license: "Apache-2.0 (verify product use)",
    prefix: "ri",
    hasVariants: false,
  },
  {
    id: "iconoir",
    name: "Iconoir",
    license: "MIT",
    prefix: "iconoir",
    hasVariants: false,
  },
  {
    id: "bi",
    name: "Bootstrap Icons",
    license: "MIT",
    prefix: "bi",
    hasVariants: false,
  },
  {
    id: "material-symbols",
    name: "Material Symbols",
    license: "Apache-2.0",
    prefix: "material-symbols",
    hasVariants: true,
  },
];

const collectionCache: Partial<Record<LibraryId, IconifyJSON>> = {};

function asIconifyJSON(mod: Record<string, unknown>): IconifyJSON | null {
  // @iconify-json/* exports { icons: IconifyJSON, info, metadata, chars }
  if (
    mod.icons &&
    typeof mod.icons === "object" &&
    "icons" in (mod.icons as object)
  ) {
    return mod.icons as IconifyJSON;
  }
  if (mod.prefix && mod.icons) {
    return mod as unknown as IconifyJSON;
  }
  if (mod.default) {
    return asIconifyJSON(mod.default as Record<string, unknown>);
  }
  return null;
}

async function loadCollection(id: LibraryId): Promise<IconifyJSON | null> {
  if (collectionCache[id]) return collectionCache[id]!;
  try {
    let mod: Record<string, unknown>;
    switch (id) {
      case "tabler":
        mod = await import("@iconify-json/tabler");
        break;
      case "lucide":
        mod = await import("@iconify-json/lucide");
        break;
      case "feather":
        mod = await import("@iconify-json/feather");
        break;
      case "heroicons":
        mod = await import("@iconify-json/heroicons");
        break;
      case "ph":
        mod = await import("@iconify-json/ph");
        break;
      case "ri":
        mod = await import("@iconify-json/ri");
        break;
      case "iconoir":
        mod = await import("@iconify-json/iconoir");
        break;
      case "bi":
        mod = await import("@iconify-json/bi");
        break;
      case "material-symbols":
        mod = await import("@iconify-json/material-symbols");
        break;
      default:
        return null;
    }
    const data = asIconifyJSON(mod);
    if (!data) return null;
    collectionCache[id] = data;
    return data;
  } catch {
    return null;
  }
}

export interface IconVariantRecord {
  id: string;
  label: string;
  /** Original Iconify icon name within the pack */
  iconName: string;
  svg: string;
}

/** Unique browsable icon (variants collapsed). */
export interface IconRecord {
  id: string;
  name: string;
  library: LibraryId;
  libraryName: string;
  /** Preview SVG for the default variant */
  svg: string;
  keywords: string[];
  defaultVariant: string;
  variants: IconVariantRecord[];
}

/**
 * Wrap Iconify body without forcing stroke/fill on the root.
 */
function bodyToSvg(body: string, viewBox = "0 0 24 24"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
}

function renderIconSvg(col: IconifyJSON, iconName: string): string | null {
  const data = getIconData(col, iconName);
  if (!data) return null;
  const rendered = iconToSVG(data, { height: "auto" });
  return bodyToSvg(rendered.body, rendered.attributes.viewBox || "0 0 24 24");
}

type FamilyAccum = {
  name: string;
  library: LibraryId;
  libraryName: string;
  variants: Map<string, { iconName: string; svg: string }>;
};

function buildFamilies(
  lib: LibraryMeta,
  col: IconifyJSON,
): Map<string, FamilyAccum> {
  const families = new Map<string, FamilyAccum>();
  for (const iconName of Object.keys(col.icons ?? {})) {
    if (!getIconData(col, iconName)) continue;
    const { base, variant } = parseIconVariant(lib.id, iconName);
    const key = `${lib.id}:${base}`;
    let fam = families.get(key);
    if (!fam) {
      fam = {
        name: base,
        library: lib.id,
        libraryName: lib.name,
        variants: new Map(),
      };
      families.set(key, fam);
    }
    // Prefer first SVG for a variant; skip duplicates
    if (!fam.variants.has(variant)) {
      const svg = renderIconSvg(col, iconName);
      if (svg) fam.variants.set(variant, { iconName, svg });
    }
  }
  return families;
}

function familyToRecord(fam: FamilyAccum): IconRecord | null {
  const variantIds = [...fam.variants.keys()];
  if (!variantIds.length) return null;
  const defaultVariant = pickDefaultVariant(fam.library, variantIds);
  const ordered = preferredVariantOrder(fam.library).filter((v) =>
    fam.variants.has(v),
  );
  for (const v of variantIds) {
    if (!ordered.includes(v)) ordered.push(v);
  }
  const variants: IconVariantRecord[] = ordered.map((v) => {
    const entry = fam.variants.get(v)!;
    return {
      id: v,
      label: variantLabel(v),
      iconName: entry.iconName,
      svg: entry.svg,
    };
  });
  const def = fam.variants.get(defaultVariant) ?? [...fam.variants.values()][0];
  if (!def) return null;
  return {
    id: `${fam.library}:${fam.name}`,
    name: fam.name,
    library: fam.library,
    libraryName: fam.libraryName,
    svg: def.svg,
    keywords: fam.name.split("-"),
    defaultVariant,
    variants,
  };
}

export { getLibraryLogo as getLibraryMarkSvg } from "./library-logos";

export async function getLibraryIconCount(
  library: LibraryId,
): Promise<{ total: number; unique: number }> {
  const col = await loadCollection(library);
  if (!col?.icons) return { total: 0, unique: 0 };
  const lib = LIBRARIES.find((l) => l.id === library)!;
  const families = buildFamilies(lib, col);
  return { total: Object.keys(col.icons).length, unique: families.size };
}

export async function searchIcons(
  query: string,
  libraryFilter: LibraryId | "all" = "all",
  limit = 80,
  offset = 0,
): Promise<IconRecord[]> {
  const q = query.trim().toLowerCase();
  const libs =
    libraryFilter === "all"
      ? LIBRARIES
      : LIBRARIES.filter((l) => l.id === libraryFilter);

  const results: IconRecord[] = [];
  const skip = Math.max(0, offset);
  let skipped = 0;

  const take = (rec: IconRecord) => {
    if (results.length >= limit) return true;
    if (skipped < skip) {
      skipped += 1;
      return false;
    }
    results.push(rec);
    return results.length >= limit;
  };

  for (const lib of libs) {
    const col = await loadCollection(lib.id);
    if (!col?.icons) continue;
    const families = buildFamilies(lib, col);

    const records: IconRecord[] = [];
    for (const fam of families.values()) {
      const rec = familyToRecord(fam);
      if (rec) records.push(rec);
    }

    if (!q) {
      records.sort((a, b) => a.name.localeCompare(b.name));
      // Single library browse
      if (libraryFilter !== "all") {
        for (const rec of records.slice(skip, skip + limit)) {
          results.push(rec);
        }
        return results;
      }
      // All libraries: take a balanced slice of starters then alpha
      const starters = [
        "house",
        "home",
        "heart",
        "star",
        "settings",
        "gear",
        "user",
        "bell",
        "trash",
        "search",
        "mail",
        "lock",
      ];
      for (const s of starters) {
        const hit = records.find((r) => r.name === s);
        if (hit && take(hit)) return results;
      }
      for (const rec of records) {
        if (starters.includes(rec.name)) continue;
        if (take(rec)) return results;
      }
      continue;
    }

    const scored: { rec: IconRecord; score: number }[] = [];
    for (const rec of records) {
      const name = rec.name;
      if (name === q) {
        scored.push({ rec, score: 100 });
        continue;
      }
      if (name.startsWith(q)) {
        scored.push({ rec, score: 80 });
        continue;
      }
      if (name.includes(q)) {
        scored.push({ rec, score: 60 });
        continue;
      }
      const parts = name.split("-");
      if (parts.some((p) => p === q)) {
        scored.push({ rec, score: 70 });
        continue;
      }
      if (q.length >= 3 && parts.some((p) => p.startsWith(q))) {
        scored.push({ rec, score: 40 });
      }
    }
    scored.sort(
      (a, b) => b.score - a.score || a.rec.name.localeCompare(b.rec.name),
    );
    for (const { rec } of scored) {
      if (take(rec)) return results;
    }
  }

  return results;
}

export async function getIconSvg(
  library: LibraryId,
  name: string,
): Promise<string | null> {
  const col = await loadCollection(library);
  if (!col) return null;
  return renderIconSvg(col, name);
}

export async function getIconFamily(
  library: LibraryId,
  baseName: string,
): Promise<IconRecord | null> {
  const col = await loadCollection(library);
  if (!col) return null;
  const lib = LIBRARIES.find((l) => l.id === library);
  if (!lib) return null;
  const families = buildFamilies(lib, col);
  const fam = families.get(`${library}:${baseName}`);
  return fam ? familyToRecord(fam) : null;
}

/** Sync helper for tests using require-friendly collections */
export function resolveIconifyJSON(mod: unknown): IconifyJSON {
  const data = asIconifyJSON(mod as Record<string, unknown>);
  if (!data) {
    throw new Error("Invalid Iconify JSON module");
  }
  return data;
}

export function getIconSvgSync(
  collection: IconifyJSON | Record<string, unknown>,
  name: string,
  library: LibraryId = "tabler",
): IconRecord | null {
  const set =
    "prefix" in collection && "icons" in collection
      ? (collection as IconifyJSON)
      : resolveIconifyJSON(collection);
  const svg = renderIconSvg(set, name);
  if (!svg) return null;
  const lib = LIBRARIES.find((l) => l.id === library)!;
  const { base, variant } = parseIconVariant(library, name);
  return {
    id: `${library}:${base}`,
    name: base,
    library,
    libraryName: lib.name,
    svg,
    keywords: base.split("-"),
    defaultVariant: variant,
    variants: [
      {
        id: variant,
        label: variantLabel(variant),
        iconName: name,
        svg,
      },
    ],
  };
}
