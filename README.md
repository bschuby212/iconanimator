# Icon Animator

AI-powered, component-level SVG icon animation for designers and developers.

**Find an icon → Describe an idea → Plan with AI → Generate → Refine → Export**

## Features

- Search Tabler, Lucide, Feather, Heroicons, and Phosphor icons (Iconify packages)
- Upload custom SVGs with sanitization and path splitting
- Semantic component recognition (lid, gear, pencil, shackle, clapper, …)
- Natural-language planning and generation with a structured animation document
- Deterministic keyframe engine with timeline scrubbing
- Manual editing: layers, transform origins, presets, undo/redo
- Export: React, animated SVG, CSS, Lottie JSON (GIF/MP4/WebM marked when blocked)
- Projects persisted in IndexedDB

## Stack

Next.js · React · TypeScript · Tailwind CSS · Geist · Zustand · Vitest · Zod

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional: set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) for LLM-assisted chat. Without a key, the deterministic rules engine handles planning and generation so animations remain testable offline.

## Test

```bash
npm test                 # unit + mandatory animation suite
npm run test:animation   # PRD §20–21 scenarios only
npm run qa:report        # refresh qa/QA_REPORT.md
```

The animation suite samples real Tabler SVGs at exact timestamps via `getElementPropertyAt` — for example trash lid rotation at 0 / open / hold / close.

## Architecture

| Module | Role |
|---|---|
| `src/lib/icons` | Library search |
| `src/lib/svg` | Parse, sanitize, split paths, recognize components |
| `src/lib/ai` | Plan / generate / refine (schema-validated; no eval of AI JS) |
| `src/lib/animation` | Keyframes, easing, deterministic sampling |
| `src/lib/export` | React / SVG / CSS / Lottie + compatibility checks |
| `src/lib/persistence` | IndexedDB projects |
| `src/store` | App state |
| `src/components` | Desktop-first creative UI |

## License note

Bundled icon sets remain under their upstream licenses (MIT / ISC, etc.). Respect each library’s terms when redistributing exported assets.
