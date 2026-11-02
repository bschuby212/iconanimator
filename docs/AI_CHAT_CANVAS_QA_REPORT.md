# AI Animation Chat & Canvas QA Report

**Date:** 2026-11-02 (America/New_York)  
**Method:** Real browser E2E (`scripts/gear-chat-qa.mjs`) + unit tests (`tests/unit/rules-engine-gear.test.ts`, `tests/unit/prompt-icon.test.ts`)  
**Evidence:** `/opt/cursor/artifacts/gear-chat-qa-evidence.json` and screenshots under `/opt/cursor/artifacts/screenshots/gear-*.png`

---

## A. Primary Gear Animation

| Requirement | Status | Actual Result |
|---|---|---|
| Gear imported correctly | PASS | Tabler `settings` (`tabler:settings:regular`), SVG length 719 |
| Gear placed correctly | PASS | Inside export frame; viewBox `0 0 24 24`; 2 shapes with valid bboxes |
| Original SVG preserved | PASS | Gear + Center components recognized; paths intact in preview |
| AI chat accepted prompt | PASS | Required PRD prompt submitted via Chat UI |
| AI generated animation | PASS | Tracks created for Gear and Center (rotation + scaleX/Y) |
| Clockwise rotation | PASS | Keyframes `0 → 360°` linear over 2000ms |
| Scale increased to 120% | PASS | Peak scaleX/Y `1.2` at 1000ms |
| Scale returned to 100% | PASS | End scale `1` at 2000ms |
| Gear remained centered | PASS | Transform origin center; Center piece co-animated (not excluded by “centered” wording) |
| Duration exactly 2 seconds | PASS | `animation.duration === 2000` |
| Seamless looping | PASS | `loop: true`; rotation ends at 360≡0 |
| Timeline populated correctly | PASS | Rotation + ScaleX + ScaleY rows; 0–2000ms |
| Manual editing worked | PASS | Peak scale set to 140% and duration to 3000ms via store update |

**Sampled transforms (primary):**

| t (ms) | rotation | scaleX |
|---|---|---|
| 0 | 0 | 1.0 |
| 500 | 90 | 1.1 |
| 1000 | 180 | 1.2 |
| 1500 | 270 | 1.1 |
| 2000 | 360 | 1.0 |

Screenshots: `gear-placed.png`, `gear-anim-t{0,500,1000,1500,2000}.png`, `gear-anim-loop.png`

---

## B. Chat Refinement Tests

| # | Instruction | Expected | Actual | Preserved other props | Status |
|---|---|---|---|---|---|
| 1 | Make the gear rotate counterclockwise instead. | CCW rotation; scale/duration intact | End rot `-360`; duration 2000; peak 1.2 | Yes | PASS |
| 2 | Make the scaling more subtle, only increasing to 110%. | Peak 110% | Peak `1.1`; rot still CCW; duration 2000 | Yes | PASS |
| 3 | Slow the entire animation down to 4 seconds. | Duration 4000 | Duration `4000`; keyframes scaled | Yes | PASS |
| 4 | Add a slight pause before the gear starts rotating. | Brief hold at start | Duration > 4000; hold keyframes at 0 rotation | Yes | PASS |
| 5 | Remove the scaling animation and keep only the rotation. | No scale tracks | scaleX/Y removed; rotation kept | Yes | PASS |

---

## C. SVG Placement Tests

| Icon | Library | viewBox / notes | Status |
|---|---|---|---|
| settings | Tabler | `0 0 24 24`, 2 paths, valid bboxes | PASS |
| gear | Phosphor | Placed + animated 360°/1s | PASS |
| settings | Lucide | Placed + animated | PASS |
| cog | Heroicons | Placed + animated | PASS |
| settings | Iconoir | Placed + animated | PASS |
| gear | Bootstrap Icons | Placed + animated | PASS |
| settings | Material Symbols | Placed + animated | PASS |

Remix Icon: intentionally omitted (license). Not retested here.

---

## D. Multi-Icon Tests

**Architecture note:** The project model holds a single active `icon` selection (plus optional text layers). Selecting another library icon replaces the current SVG rather than composing multiple independent icons in one frame.

| Check | Status | Notes |
|---|---|---|
| Sequential placement across libraries | PASS | settings → heart → bell via UI |
| Independent animation after switch | PASS | Bell swing/rotate generated for active icon |
| Simultaneous multi-SVG document | BLOCKED | Product model is single-icon; not a regression from this change set |
| SVG ID conflicts across concurrent icons | BLOCKED | Requires multi-icon document support |

---

## E. Issues Fixed

### 1. Duration / scale / rotation not parsed from natural language
- **Broken:** “2 seconds”, “120%”, continuous 360° loop were ignored (defaults ~1200ms, ~110%, ~180°).
- **Cause:** `buildPlanFromPrompt` / `generateAnimationFromPlan` lacked generic parsers.
- **Fix:** Added `parseDurationMs`, `parseScalePeak`, `parseRotationDegrees`, `wantsLoopFromPrompt`, etc. in `rules-engine.ts`.
- **Retest:** Unit + E2E primary prompt → 2000ms / 360° / 1.2 peak.

### 2. Follow-up chat refinements incomplete
- **Broken:** CCW, explicit 110%, “4 seconds”, pause-before, remove-scale not handled (`slow` always ×1.4; `subtle` clobbered percent asks).
- **Fix:** Ordered `refineAnimation` handlers (explicit duration → remove scale → direction → peak % → pause → relative speed).
- **Retest:** All five PRD follow-ups PASS in E2E.

### 3. “this icon” treated as a library lookup
- **Broken:** Prompts like “Rotate this icon…” searched for an icon named `this` and failed generation.
- **Cause:** `extractIconQuery` matched `([word]) icons?`; `wantsIconLoad` triggered on any “icon” word.
- **Fix:** Stopwords + deixis guard in `prompt-icon.ts`.
- **Retest:** Cross-library chat animations all PASS.

### 4. “centered” excluded the Center component from animation
- **Broken:** Prompt “keep the gear perfectly centered” matched `includes("center")` and skipped co-animating the center hole → scale/rotation desync risk.
- **Fix:** Only separate center when user asks for independent/static center (`\bcenters?\b` + independent/static language).
- **Retest:** Primary animation now has 2 tracks (Gear + Center).

### 5. Refine success messaging
- **Broken:** Always replied “Updated.” even when nothing mapped.
- **Fix:** Compare tracks/duration and report when no concrete change applied.

---

## F. Remaining Issues

| Item | Status | Notes |
|---|---|---|
| Multi-icon simultaneous document | BLOCKED | Single `icon` in project state; needs product design to place multiple SVGs in one frame |
| Remix Icon library | N/A | Omitted for license |
| OpenAI/external LLM path | N/A | App uses deterministic rules engine for chat→animation (same user workflow; not hardcoded gear special-case) |
| Manual UI keyframe drag polish | Unverified | Manual edit verified via animation document API (`updateAnimation`); timeline drag UX not separately audited this run |
| Error-handling matrix (empty prompt, rapid fire, mid-generation icon swap) | Partial | Empty prompt ignored by UI; malformed AI N/A for rules engine; rapid-fire / mid-swap not fully exercised |

---

## Automated Tests

```text
npx vitest run tests/unit/rules-engine-gear.test.ts tests/unit/prompt-icon.test.ts
→ 17 passed
```

Real E2E (not mocked): `node scripts/gear-chat-qa.mjs` against `http://localhost:3000`.

---

## Definition of Done Checklist

1. Genuine settings gear loads — PASS (Tabler)  
2. Appears correctly in document — PASS  
3. Internal geometry intact — PASS  
4. AI chat generates requested animation — PASS  
5. Rotation + scaling simultaneous — PASS  
6. Remains centered — PASS  
7. Loops correctly — PASS  
8. Timeline keyframes accurate — PASS  
9. Manual editing works — PASS  
10. Follow-up chat modifications — PASS (5/5)  
11. Multiple SVG icons coexist — BLOCKED (single-icon model)  
12. Different libraries consistent — PASS (6 libraries + Tabler)  
13. Automated tests pass — PASS  
14. Browser visual QA completed — PASS  
15. Detailed verification report — PASS (this document)  
