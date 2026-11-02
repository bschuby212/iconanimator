import {
  searchIcons,
  type IconRecord,
  type LibraryId,
} from "@/lib/icons/libraries";

export interface ChatIconRequest {
  /** True when the prompt asks to place/load an icon */
  wantsIcon: boolean;
  iconQuery: string | null;
  library: LibraryId | "all";
  /** Remaining prompt focused on motion, if separable */
  motionPrompt: string;
  /** Clear enough motion to auto-generate after loading */
  autoGenerate: boolean;
}

const LIBRARY_PATTERNS: { id: LibraryId; re: RegExp }[] = [
  { id: "tabler", re: /\b(?:tabler(?:\s+icons?)?)\b/i },
  { id: "lucide", re: /\b(?:lucide(?:\s+icons?)?)\b/i },
  { id: "feather", re: /\b(?:feather(?:\s+icons?)?)\b/i },
  { id: "heroicons", re: /\b(?:heroicons?|hero\s+icons?)\b/i },
  { id: "ph", re: /\b(?:phosphor(?:\s+icons?)?|\bph\b)\b/i },
  { id: "iconoir", re: /\b(?:iconoir)\b/i },
  { id: "bi", re: /\b(?:bootstrap(?:\s+icons?)?)\b/i },
  {
    id: "material-symbols",
    re: /\b(?:material(?:\s+symbols?)?|material\s+icons?)\b/i,
  },
];

const MOTION_RE =
  /\b(spin|rotate|rotat(?:e|ing)|bounce|fade|shake|pulse|float|wiggle|pop|appear|disappear|slide|swing|open|close|loop|grow|shrink|scale)\b/i;

const ICON_ACTION_RE =
  /\b(?:put|add|use|load|pick|choose|insert|place|get|bring|drop|set)\b/i;

/** Common icon name tokens we recognize even without "icon" keyword */
const KNOWN_ICONS = [
  "settings",
  "setting",
  "cog",
  "gear",
  "trash",
  "delete",
  "bin",
  "pencil",
  "edit",
  "pen",
  "bell",
  "notification",
  "lock",
  "unlock",
  "padlock",
  "mail",
  "envelope",
  "email",
  "download",
  "upload",
  "search",
  "magnifier",
  "heart",
  "star",
  "home",
  "house",
  "user",
  "person",
  "check",
  "menu",
  "camera",
  "file",
  "folder",
  "play",
  "pause",
  "plus",
  "minus",
  "x",
  "close",
  "arrow",
  "chevron",
  "calendar",
  "clock",
  "sun",
  "moon",
  "cloud",
  "wifi",
  "battery",
  "phone",
  "message",
  "chat",
  "cart",
  "shopping",
  "bookmark",
  "flag",
  "pin",
  "map",
  "globe",
  "link",
  "share",
  "eye",
  "image",
  "photo",
  "music",
  "video",
  "mic",
  "speaker",
  "volume",
  "filter",
  "refresh",
  "sync",
  "loader",
  "spinner",
];

function detectLibrary(prompt: string): LibraryId | "all" {
  for (const { id, re } of LIBRARY_PATTERNS) {
    if (re.test(prompt)) return id;
  }
  // prefix form: tabler:settings
  const m = prompt.match(
    /\b(tabler|lucide|feather|heroicons|ph|phosphor|iconoir|bi|bootstrap|material-symbols|material)\s*:\s*[\w-]+/i,
  );
  if (m) {
    const key = m[1].toLowerCase();
    if (key === "phosphor") return "ph";
    if (key === "bootstrap") return "bi";
    if (key === "material") return "material-symbols";
    return key as LibraryId;
  }
  return "all";
}

function stripLibraryWords(prompt: string): string {
  let s = prompt;
  for (const { re } of LIBRARY_PATTERNS) {
    s = s.replace(re, " ");
  }
  s = s.replace(/\b(?:from|in|with|using|of)\b/gi, " ");
  s = s.replace(/\b(?:the|a|an)\b/gi, " ");
  return s.replace(/\s+/g, " ").trim();
}

function extractIconQuery(prompt: string): string | null {
  const p = prompt.trim();

  // tabler:settings or settings@tabler
  const prefixed = p.match(
    /\b(?:tabler|lucide|feather|heroicons|ph|phosphor|iconoir|bi|bootstrap|material-symbols|material)\s*:\s*([\w-]+)/i,
  );
  if (prefixed?.[1]) return normalizeIconName(prefixed[1]);

  const atForm = p.match(
    /\b([\w-]+)\s*@\s*(?:tabler|lucide|feather|heroicons|ph|phosphor|iconoir|bi|bootstrap|material-symbols|material)\b/i,
  );
  if (atForm?.[1]) return normalizeIconName(atForm[1]);

  // "settings icon" / "the settings icon"
  const iconNoun = p.match(
    /\b(?:the\s+)?([a-z][\w-]{1,32})\s+icons?\b/i,
  );
  if (iconNoun?.[1] && !LIBRARY_PATTERNS.some((l) => l.re.test(iconNoun[1]))) {
    return normalizeIconName(iconNoun[1]);
  }

  // "icon settings" / "icon called settings"
  const iconCalled = p.match(
    /\bicons?\s+(?:called\s+|named\s+|for\s+)?([a-z][\w-]{1,32})\b/i,
  );
  if (iconCalled?.[1] && !LIBRARY_PATTERNS.some((l) => l.re.test(iconCalled[1]))) {
    return normalizeIconName(iconCalled[1]);
  }

  // Known icon name appearing in prompt
  const lower = p.toLowerCase();
  for (const name of KNOWN_ICONS) {
    if (new RegExp(`\\b${name}\\b`, "i").test(lower)) {
      return normalizeIconName(name);
    }
  }

  // "put X in" after stripping library words
  const stripped = stripLibraryWords(p).toLowerCase();
  const afterAction = stripped.match(
    /(?:put|add|use|load|pick|choose|insert|place|get|bring|drop)\s+([\w-]+(?:\s+[\w-]+)?)/i,
  );
  if (afterAction?.[1]) {
    const candidate = afterAction[1]
      .replace(/\bicons?\b/gi, "")
      .trim();
    if (candidate && candidate.length >= 2) return normalizeIconName(candidate);
  }

  return null;
}

function normalizeIconName(raw: string): string {
  const aliases: Record<string, string> = {
    setting: "settings",
    cog: "settings",
    gear: "settings",
    bin: "trash",
    delete: "trash",
    pen: "pencil",
    edit: "pencil",
    notification: "bell",
    padlock: "lock",
    email: "mail",
    envelope: "mail",
    magnifier: "search",
    house: "home",
    person: "user",
    close: "x",
    shopping: "shopping-cart",
    photo: "photo",
    spinner: "loader",
  };
  let name = raw.trim().toLowerCase().replace(/\s+/g, "-");
  name = aliases[name] ?? name;
  return name;
}

function hasMotionIntent(prompt: string): boolean {
  return MOTION_RE.test(prompt);
}

function wantsIconLoad(prompt: string, iconQuery: string | null): boolean {
  if (!iconQuery) return false;
  if (ICON_ACTION_RE.test(prompt)) return true;
  if (/\bicons?\b/i.test(prompt)) return true;
  if (LIBRARY_PATTERNS.some((l) => l.re.test(prompt))) return true;
  if (/:/.test(prompt) && /\b[\w-]+:[\w-]+\b/.test(prompt)) return true;
  return false;
}

export function parseChatIconRequest(prompt: string): ChatIconRequest {
  const library = detectLibrary(prompt);
  const iconQuery = extractIconQuery(prompt);
  const wantsIcon = wantsIconLoad(prompt, iconQuery);
  const autoGenerate = hasMotionIntent(prompt);

  // Prefer keeping the full prompt for motion planning so rules-engine sees "spin"
  let motionPrompt = prompt.trim();
  if (wantsIcon && iconQuery) {
    // Soften icon-loading phrasing but keep motion verbs
    motionPrompt = prompt
      .replace(ICON_ACTION_RE, " ")
      .replace(/\b(?:from|in|with|using)\b/gi, " ")
      .replace(/\bicons?\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!motionPrompt || motionPrompt.length < 3) {
      motionPrompt = autoGenerate ? prompt : `Animate ${iconQuery}`;
    }
  }

  return {
    wantsIcon,
    iconQuery: wantsIcon ? iconQuery : null,
    library,
    motionPrompt,
    autoGenerate,
  };
}

export async function resolveIconFromPrompt(
  prompt: string,
): Promise<{ request: ChatIconRequest; icon: IconRecord | null; error?: string }> {
  const request = parseChatIconRequest(prompt);
  if (!request.wantsIcon || !request.iconQuery) {
    return { request, icon: null };
  }

  const hits = await searchIcons(request.iconQuery, request.library, 12, 0);
  if (!hits.length && request.library !== "all") {
    // Fallback: search all libraries
    const allHits = await searchIcons(request.iconQuery, "all", 12, 0);
    if (!allHits.length) {
      return {
        request,
        icon: null,
        error: `Couldn't find a “${request.iconQuery}” icon in ${request.library}. Try another name or library.`,
      };
    }
    return { request, icon: pickBestIcon(allHits, request.iconQuery) };
  }

  if (!hits.length) {
    return {
      request,
      icon: null,
      error: `Couldn't find a “${request.iconQuery}” icon. Try another name or library.`,
    };
  }

  return { request, icon: pickBestIcon(hits, request.iconQuery) };
}

export function pickBestIcon(hits: IconRecord[], query: string): IconRecord {
  const q = query.toLowerCase();
  const exact = hits.find((h) => h.name === q);
  if (exact) return exact;
  const starts = hits.find((h) => h.name.startsWith(q));
  if (starts) return starts;
  return hits[0];
}
