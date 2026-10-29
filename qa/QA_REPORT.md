# AI Icon Animator — QA report

Generated: 2026-10-29T16:00:43.191Z

## Summary

- Vitest tests passed: **34/34**
- Vitest tests failed: **0**
- Success: **yes**

## Mandatory animation scenarios

| Scenario | Icon | Status | Evidence |
|---|---|---|---|
| Test 1: Settings gear | `tabler:settings` | Pass | Deterministic frame sampling via `getElementPropertyAt` |
| Test 2: Trash can | `tabler:trash` | Pass | Deterministic frame sampling via `getElementPropertyAt` |
| Test 3: Edit icon | `tabler:edit` | Pass | Deterministic frame sampling via `getElementPropertyAt` |
| Test 4: Bell | `tabler:bell` | Pass | Deterministic frame sampling via `getElementPropertyAt` |
| Test 5: Lock | `tabler:lock` | Pass | Deterministic frame sampling via `getElementPropertyAt` |
| Test 6: Envelope | `tabler:mail` | Pass | Deterministic frame sampling via `getElementPropertyAt` |
| Test 7: Download | `tabler:download` | Pass | Deterministic frame sampling via `getElementPropertyAt` |
| Test 8: Search | `tabler:search` | Pass | Deterministic frame sampling via `getElementPropertyAt` |

## Features tested

- SVG parse / sanitize / path split
- Semantic component recognition
- Animation engine interpolation, easing, scrubbing, loop
- AI plan + generate + refine (rules engine; OpenAI optional)
- Export: React, animated SVG, CSS, Lottie (validated)
- Mandatory component-level scenarios 1–8
- Complexity simple / detailed / complex
- Conversation scenarios A/B/D/E

## Known limitations

- Hugeicons Free Iconify package is not bundled; UI marks it as soon.
- GIF / MP4 / WebM require a headless rasterizer; marked unavailable in-app without Playwright media pipeline.
- Lottie export maps transforms into shape layers; exact path geometry is approximated — React/SVG preferred for fidelity.
- Some single-path icons (e.g. certain bell variants) may not expose a separable clapper; the system reports a limitation instead of faking independence.
- Visual screenshot comparisons are covered by deterministic transform sampling; browser pixel diffs need `npx playwright test` when browsers are installed.

## Export compatibility

| Format | Status | Notes |
|---|---|---|
| React | Pass | Full keyframe document embedded |
| Animated SVG | Pass | CSS keyframes in SVG |
| CSS | Pass | Keyframes + classes |
| Lottie JSON | Pass (approx paths) | Schema-valid transform layers |
| GIF | Blocked | Needs frame renderer |
| MP4 | Blocked | Needs frame renderer |
| WebM | Blocked | Needs frame renderer |
| PNG | Blocked | Static capture helper pending |

## Recommended fixes

1. Add Playwright visual frame captures for each mandatory scenario when Chromium is available.
2. Improve bell clapper segmentation with AI-assisted path cutting for single-path bells.
3. Wire OpenAI structured outputs when `OPENAI_API_KEY` is present for freer-form prompts.
4. Implement canvas MediaRecorder / ffmpeg pipeline for GIF/MP4/WebM.

## Mandatory scenario evidence

### tabler:settings

- Prompt: "Rotate the gear clockwise, make it grow slightly, then shrink back to its original size."
- Components: Gear (gear), Center (center)
- Duration: 1200ms · tracks: 2
- Plan:
  1. Rotate the gear clockwise 180°.
  1. Scale up to 110%.
  1. Return scale to 100%.
- Sampled frames:

```json
[
  {
    "time": 0,
    "rotation": 0,
    "x": 0,
    "y": 0,
    "scaleX": 1
  },
  {
    "time": 400,
    "rotation": 139.99999999999997,
    "x": 0,
    "y": 0,
    "scaleX": 1.077777777777778
  },
  {
    "time": 1000,
    "rotation": 180,
    "x": 0,
    "y": 0,
    "scaleX": 1.0222222222222221
  }
]
```
- Result: **Pass**

### tabler:trash

- Prompt: "Open the trash can lid, pause briefly, then close it."
- Components: Container (body), Lid (lid)
- Duration: 1200ms · tracks: 4
- Plan:
  1. Keep the trash can body stationary.
  1. Rotate the lid upward ~45° around its hinge.
  1. Hold the lid open briefly.
  1. Rotate the lid back to its original position.
  1. Apply a subtle settling motion.
- Sampled frames:

```json
[
  {
    "time": 0,
    "rotation": 0,
    "x": 0,
    "y": 0,
    "scaleX": 1
  },
  {
    "time": 300,
    "rotation": -41.83673469387755,
    "x": 0,
    "y": 0,
    "scaleX": 1
  },
  {
    "time": 600,
    "rotation": -50,
    "x": 0,
    "y": 0,
    "scaleX": 1
  },
  {
    "time": 1000,
    "rotation": -13.717421124828533,
    "x": 0,
    "y": 0,
    "scaleX": 1
  }
]
```
- Result: **Pass**

### tabler:edit

- Prompt: "Keep the paper still while the pencil moves across it like someone is writing."
- Components: Paper (paper), Pencil (pencil)
- Duration: 1400ms · tracks: 1
- Plan:
  1. Keep the paper stationary.
  1. Move the pencil across the paper in a writing motion.
  1. Rotate the pencil slightly while writing.
  1. Return the pencil to its original position.
- Sampled frames:

```json
[
  {
    "time": 0,
    "rotation": 0,
    "x": 0,
    "y": 0,
    "scaleX": 1
  },
  {
    "time": 350,
    "rotation": -7.555555555555555,
    "x": 4,
    "y": 2.4,
    "scaleX": 1
  },
  {
    "time": 1400,
    "rotation": 0,
    "x": 0,
    "y": 0,
    "scaleX": 1
  }
]
```
- Result: **Pass**

### tabler:bell

- Prompt: "Make the bell swing from side to side while the clapper moves independently."
- Components: Bell (bell), Clapper (clapper)
- Duration: 1600ms · tracks: 2
- Plan:
  1. Swing the bell left and right around its top pivot.
  1. Move the clapper independently with opposing timing.
  1. Gradually settle the motion.
- Sampled frames:

```json
[
  {
    "time": 0,
    "rotation": 0,
    "x": 0,
    "y": 0,
    "scaleX": 1
  },
  {
    "time": 240,
    "rotation": -18,
    "x": 0,
    "y": 0,
    "scaleX": 1
  },
  {
    "time": 480,
    "rotation": 18,
    "x": 0,
    "y": 0,
    "scaleX": 1
  },
  {
    "time": 1600,
    "rotation": 0,
    "x": 0,
    "y": 0,
    "scaleX": 1
  }
]
```
- Result: **Pass**

### tabler:lock

- Prompt: "Make the padlock unlock by lifting and rotating the shackle."
- Components: Body (body), Shackle (shackle)
- Duration: 1100ms · tracks: 1
- Plan:
  1. Keep the lock body stationary.
  1. Lift the shackle upward.
  1. Rotate the shackle around its connection point.
  1. Settle in the unlocked pose.
- Sampled frames:

```json
[
  {
    "time": 0,
    "rotation": 0,
    "x": 0,
    "y": 0,
    "scaleX": 1
  },
  {
    "time": 700,
    "rotation": -29.350464876033058,
    "x": 0,
    "y": -5,
    "scaleX": 1
  },
  {
    "time": 1100,
    "rotation": -40,
    "x": 0,
    "y": -5,
    "scaleX": 1
  }
]
```
- Result: **Pass**

### tabler:mail

- Prompt: "Open the envelope flap and have a letter slide out."
- Components: Envelope (body), Flap (flap), Letter (letter)
- Duration: 1400ms · tracks: 2
- Plan:
  1. Keep the envelope body stationary.
  1. Open the envelope flap.
  1. Slide the letter upward out of the envelope.
- Sampled frames:

```json
[
  {
    "time": 0,
    "rotation": 0,
    "x": 0,
    "y": 0,
    "scaleX": 1
  },
  {
    "time": 500,
    "rotation": -160,
    "x": 0,
    "y": 0,
    "scaleX": 1
  },
  {
    "time": 1400,
    "rotation": -160,
    "x": 0,
    "y": 0,
    "scaleX": 1
  }
]
```
- Result: **Pass**

### tabler:download

- Prompt: "Make the arrow move downward into the tray, then settle."
- Components: Tray (tray), Arrow (arrow)
- Duration: 1000ms · tracks: 2
- Plan:
  1. Keep the tray stationary.
  1. Move the arrow downward into the tray.
  1. Settle the arrow.
- Sampled frames:

```json
[
  {
    "time": 0,
    "rotation": 0,
    "x": 0,
    "y": 0,
    "scaleX": 1
  },
  {
    "time": 700,
    "rotation": 0,
    "x": 0,
    "y": 6,
    "scaleX": 1
  },
  {
    "time": 1000,
    "rotation": 0,
    "x": 0,
    "y": 5,
    "scaleX": 1
  }
]
```
- Result: **Pass**

### tabler:search

- Prompt: "Move the magnifying glass around as if searching, then return it to its original position."
- Components: Magnifier (glass)
- Duration: 1400ms · tracks: 2
- Plan:
  1. Move the magnifying glass along a searching path.
  1. Return to the original position.
- Sampled frames:

```json
[
  {
    "time": 0,
    "rotation": 0,
    "x": 0,
    "y": 0,
    "scaleX": 1
  },
  {
    "time": 350,
    "rotation": 0,
    "x": 3,
    "y": -2,
    "scaleX": 1
  },
  {
    "time": 1400,
    "rotation": 0,
    "x": 0,
    "y": 0,
    "scaleX": 1
  }
]
```
- Result: **Pass**

Full machine-readable dump: `qa/animation-evidence.json`
Vitest JSON: `qa/vitest-results.json`
