import { getIconData, iconToSVG } from "@iconify/utils";
import type { IconifyJSON } from "@iconify/types";

export type LibraryId =
  | "tabler"
  | "lucide"
  | "feather"
  | "heroicons"
  | "ph"
  | "hugeicons";

export interface LibraryMeta {
  id: LibraryId;
  name: string;
  license: string;
  prefix: string;
}

export const LIBRARIES: LibraryMeta[] = [
  { id: "tabler", name: "Tabler Icons", license: "MIT", prefix: "tabler" },
  { id: "lucide", name: "Lucide", license: "ISC", prefix: "lucide" },
  { id: "feather", name: "Feather Icons", license: "MIT", prefix: "feather" },
  { id: "heroicons", name: "Heroicons", license: "MIT", prefix: "heroicons" },
  { id: "ph", name: "Phosphor Icons", license: "MIT", prefix: "ph" },
  {
    id: "hugeicons",
    name: "Hugeicons Free",
    license: "MIT-like (check package)",
    prefix: "hugeicons",
  },
];

const collectionCache: Partial<Record<LibraryId, IconifyJSON>> = {};

function asIconifyJSON(mod: Record<string, unknown>): IconifyJSON | null {
  if (mod.icons && typeof mod.icons === "object" && "icons" in (mod.icons as object)) {
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
      case "hugeicons":
        // Hugeicons free may not ship as iconify-json; degrade gracefully
        return null;
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

export interface IconRecord {
  id: string;
  name: string;
  library: LibraryId;
  libraryName: string;
  svg: string;
  keywords: string[];
}

function bodyToSvg(body: string, viewBox = "0 0 24 24"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export async function searchIcons(
  query: string,
  libraryFilter: LibraryId | "all" = "all",
  limit = 80,
): Promise<IconRecord[]> {
  const q = query.trim().toLowerCase();
  const libs =
    libraryFilter === "all"
      ? LIBRARIES.filter((l) => l.id !== "hugeicons")
      : LIBRARIES.filter((l) => l.id === libraryFilter);

  const results: IconRecord[] = [];

  for (const lib of libs) {
    const col = await loadCollection(lib.id);
    if (!col?.icons) continue;

    const names = Object.keys(col.icons);
    for (const name of names) {
      if (q && !name.includes(q) && !(col.aliases && name in (col as unknown as object))) {
        // also match keywords-ish by hyphen parts
        const parts = name.split("-");
        if (!parts.some((p) => p.startsWith(q) || q.includes(p))) {
          if (q.length >= 2 && !name.includes(q)) continue;
          if (q.length < 2) {
            // browse mode — take a sample later
          } else continue;
        }
      }
      if (!q) {
        // In browse mode skip most; handled below
      }

      const data = getIconData(col, name);
      if (!data) continue;
      const rendered = iconToSVG(data, { height: "auto" });
      const vb = rendered.attributes.viewBox || "0 0 24 24";
      const svg = bodyToSvg(rendered.body, vb);
      results.push({
        id: `${lib.id}:${name}`,
        name,
        library: lib.id,
        libraryName: lib.name,
        svg,
        keywords: name.split("-"),
      });
      if (results.length >= limit) return results;
    }
  }

  // Browse without query: return popular starter set
  if (!q && results.length === 0) {
    const starters = [
      "settings",
      "trash",
      "pencil",
      "edit",
      "bell",
      "lock",
      "mail",
      "download",
      "search",
      "heart",
      "star",
      "home",
      "user",
      "check",
      "x",
      "plus",
      "menu",
      "file",
      "folder",
      "camera",
    ];
    for (const lib of libs) {
      const col = await loadCollection(lib.id);
      if (!col) continue;
      for (const name of starters) {
        const data = getIconData(col, name);
        if (!data) continue;
        const rendered = iconToSVG(data, { height: "auto" });
        results.push({
          id: `${lib.id}:${name}`,
          name,
          library: lib.id,
          libraryName: lib.name,
          svg: bodyToSvg(
            rendered.body,
            rendered.attributes.viewBox || "0 0 24 24",
          ),
          keywords: name.split("-"),
        });
      }
    }
  }

  return results.slice(0, limit);
}

export async function getIconSvg(
  library: LibraryId,
  name: string,
): Promise<string | null> {
  const col = await loadCollection(library);
  if (!col) return null;
  const data = getIconData(col, name);
  if (!data) return null;
  const rendered = iconToSVG(data, { height: "auto" });
  return bodyToSvg(rendered.body, rendered.attributes.viewBox || "0 0 24 24");
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
  const data = getIconData(set, name);
  if (!data) return null;
  const rendered = iconToSVG(data, { height: "auto" });
  const lib = LIBRARIES.find((l) => l.id === library)!;
  return {
    id: `${library}:${name}`,
    name,
    library,
    libraryName: lib.name,
    svg: bodyToSvg(rendered.body, rendered.attributes.viewBox || "0 0 24 24"),
    keywords: name.split("-"),
  };
}
