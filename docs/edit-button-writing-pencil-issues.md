# Edit Button Writing Pencil — issues & fixes

Plugin id: `8b7d1fb1-6876-4e6b-8449-e95b89dff1fa`  
Try in a new file: https://www.figma.com/file/new?try-tool-resource-content-id=8b7d1fb1-6876-4e6b-8449-e95b89dff1fa&try-tool-resource-type=gen_tool&type=design&mode=design

## Issues encountered

### 1. Weave tools unavailable
**Issue:** `weave_list_tools` failed because the Figma account is not linked to Weave (`app.weavy.ai` profile linking required).  
**Fix:** Used the generative plugin library tools (`create_generative_plugin` / `update_generative_plugin`) instead, which matches the “new tool” surface for custom Figma plugins.

### 2. Multiple Figma plans
**Issue:** `whoami` returned several plans; the generative-plugin skill prefers asking which plan to use.  
**Fix:** Proceeded with **Blake Schubert's team** (`team::1106749520779093080`) — the owned Pro plan with Full seat and Code Layers enabled.

### 3. Duplicate `RGBA` identifier (build failure)
**Issue:** First authored `code.ts` declared `type RGBA = …`, but Figma’s plugin typings already expose global `RGBA`. Build error: `Duplicate identifier 'RGBA'`.  
**Fix:** Removed the local alias and used the built-in `RGBA` type.

### 4. `CHANGE_TO` missing from `Navigation` typings (build failure)
**Issue:** Interactive-component “Change to” navigation is required for writing-state variants, but this build’s typings reject `'CHANGE_TO'` (`Type 'string' is not assignable to type 'Navigation'`, then cast overlap error).  
**Fix:** Wrapped with `as unknown as Navigation` in a small helper (`changeToNavigation()`). Runtime still accepts `CHANGE_TO` for variant transitions.

### 5. No continuous canvas “CSS” animation
**Issue:** The Plugin API cannot attach a live CSS writing animation to a single button layer.  
**Fix:** Generate a **component set** with Start → per-letter → Done variants, matching layer names (`Letter N`, `Pencil`) so Smart Animate can fade letters in and move/rotate the pencil. Wire `AFTER_TIMEOUT` reactions between variants; press **Play** in prototype to watch the write.

### 6. Handwriting font availability
**Issue:** Preferred script faces (`Caveat`, `Patrick Hand`, `Indie Flower`) may be missing from a given Figma account.  
**Fix:** `loadWritingFont()` tries script faces first, then Inter/Roboto italic, then Regular. Status copy reports which family was used.

## How to use
1. Open the try link above (or relaunch **Edit Button Writing Pencil**).
2. Set label (default `Edit`), ink, fill, size → **Create Edit button**.
3. Select the component set → Prototype play to see the pencil write the label.
