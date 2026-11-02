/**
 * Split Iconify icon names into base + style variant.
 * Phosphor: heart, heart-bold, heart-fill, heart-light, heart-thin, heart-duotone
 * Heroicons: heart, heart-solid, heart-16-solid, heart-20-solid
 * Material Symbols: home, home-outline, home-rounded, etc. (kept as distinct when needed)
 */

export interface ParsedIconName {
  base: string;
  variant: string;
}

const PHOSPHOR_WEIGHTS = ["thin", "light", "bold", "fill", "duotone"] as const;

const HERO_SIZE_SOLID = /^(.*)-(16|20)-solid$/;
const HERO_SOLID = /^(.*)-solid$/;

export function parseIconVariant(
  library: string,
  name: string,
): ParsedIconName {
  if (library === "ph") {
    for (const weight of PHOSPHOR_WEIGHTS) {
      if (name.endsWith(`-${weight}`)) {
        return {
          base: name.slice(0, -(weight.length + 1)),
          variant: weight,
        };
      }
    }
    return { base: name, variant: "regular" };
  }

  if (library === "heroicons") {
    const sized = name.match(HERO_SIZE_SOLID);
    if (sized) {
      return { base: sized[1], variant: `${sized[2]}-solid` };
    }
    const solid = name.match(HERO_SOLID);
    if (solid) {
      return { base: solid[1], variant: "solid" };
    }
    return { base: name, variant: "outline" };
  }

  if (library === "material-symbols") {
    // material-symbols names often encode style; treat full name as base
    // but collapse common outline/rounded/sharp suffixes when present as suffix
    for (const style of ["outline", "rounded", "sharp"] as const) {
      if (name.endsWith(`-${style}`)) {
        return {
          base: name.slice(0, -(style.length + 1)),
          variant: style,
        };
      }
    }
    return { base: name, variant: "filled" };
  }

  // Tabler filled variants often end with -filled / -fill
  if (name.endsWith("-filled")) {
    return { base: name.slice(0, -"-filled".length), variant: "filled" };
  }
  if (name.endsWith("-fill")) {
    return { base: name.slice(0, -"-fill".length), variant: "fill" };
  }

  return { base: name, variant: "regular" };
}

/** Prefer regular/outline as the default browsing preview */
export function preferredVariantOrder(library: string): string[] {
  switch (library) {
    case "ph":
      return ["regular", "bold", "fill", "light", "thin", "duotone"];
    case "heroicons":
      return ["outline", "solid", "20-solid", "16-solid"];
    case "material-symbols":
      return ["filled", "outline", "rounded", "sharp"];
    default:
      return ["regular", "filled", "fill", "outline", "solid"];
  }
}

export function pickDefaultVariant(
  library: string,
  variants: string[],
): string {
  for (const pref of preferredVariantOrder(library)) {
    if (variants.includes(pref)) return pref;
  }
  return variants[0] ?? "regular";
}

export function variantLabel(variant: string): string {
  const map: Record<string, string> = {
    regular: "Regular",
    bold: "Bold",
    fill: "Fill",
    filled: "Filled",
    light: "Light",
    thin: "Thin",
    duotone: "Duotone",
    outline: "Outline",
    solid: "Solid",
    "16-solid": "Solid 16",
    "20-solid": "Solid 20",
    rounded: "Rounded",
    sharp: "Sharp",
  };
  return map[variant] ?? variant.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
