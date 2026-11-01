# Tintplan

Offline coloring planner. Photograph a coloring page, clean up the lines, tap areas to fill them with real pen colors, and get the pen codes written into the areas. Static SvelteKit app (no server) deployed to GitHub Pages as a PWA, and wrapped with Capacitor as an Android APK.

## Commands

- `bun run dev`: dev server
- `bun run check`: compiles Paraglide messages, then svelte-check
- `bun run lint`: eslint and prettier
- `bunx vitest --run`: unit tests (image pipeline, PNG chunks, labels)
- `bunx playwright test`: e2e against a production build (`bun run preview`)
- `CAPACITOR=1 bun run build && bunx cap sync android`: web build for the APK
- `bun scripts/android-icons.ts`: render launcher icons and splash screens from `static/favicon.svg`
- `bun run pens <dir>`: rebuild `src/lib/pens/data/` from the raw source files (see `scripts/import-pens.ts`)

## Layout

- `src/lib/image/`: pure image code, no DOM except `render.ts`.
  - `gray.ts` gray images and filters, `warp.ts` perspective straightening (gray and RGBA), `enhance.ts` page detection.
  - `lines.ts` outline extraction that works on colored and shaded pages: max channel, flattened light, black top-hat (closing minus image) for thin dark lines, absolute darkness, hysteresis for faint outline pieces. `morph` is an O(1) max/min filter.
  - `segment.ts` splits line art into areas: labels on a copy with thickened lines (gap closing), narrow strips added back, then grown under the lines. Also finds each area's label spot (furthest from the outline, near the center of mass), a per-area pixel list, and the half-resolution `scan` texture for the scan animation (`ScanOverlay.svelte`, a WebGL shader).
  - `label.ts` fits a code into an area's inscribed circle. `render.ts` composites fills under the lines (multiply) and draws labels on canvas.
  - `png.ts` writes and reads the private `tpLn` chunk that makes exported PNGs editable.
  - `worker.ts` runs decode, cleanup and segmentation off the main thread; `protocol.ts` is the typed RPC.
- `src/lib/editor.svelte.ts`: an open page. Fills per area, undo/redo, labels, legend, debounced saving with a thumbnail.
- `src/lib/db/`: Dexie schema. A page stores the image shown while coloring (`line`: lines, gray or original) and the outlines the areas come from (`outline`). Fills are stored as a point inside the area, not as an area number, so they survive changes to the segmentation.
- `src/lib/pens/`: palette index and lazily loaded palette JSON, `loadOwned` (the user's pens across ranges) and `sortByColor` (OKLCH hue steps, light to dark, neutrals last). Owned codes live in `settings.owned` per palette, edited under `/settings/pens`.
- `src/lib/export.ts`: PNG rendering with codes and legend, embedding and importing projects, file saving.
- `src/lib/native/`: Capacitor bridge (back button, haptics, share sheet). Everything else is the same web code.
- `src/routes/`: library (`/`), photo preparation (`/new`: crop, then check areas with live re-detection), editor (`/edit?id=`), `/settings`.
- `messages/{en,de}.json`: every UI string. Add both languages for each new key.

## Design

Read `DESIGN.md` before touching UI. After making changes, run `bun run lint` and fix all errors; it includes the `@shadcn/lint` design rules (no raw colors, no arbitrary values, no restyling of components, no inline styles except CSS custom properties).

## Releases

Add every user-facing change to `CHANGELOG.md` under "Unreleased" (Features / Fixes). To release: rename that section to the new version with the date, bump `version` in `package.json`, commit, then tag `vX.Y.Z` and push the tag. The Android Release workflow uses the section as the release notes and fails if it's missing. Pull requests build a signed APK artifact too.

The release keystore is backed up outside the repo; its secrets are `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. Losing it means existing installs can't update.

## Conventions

- Image coordinates are pixels of the cleaned page (longest side at most 2048).
- The cleaned line art is the source of truth for a page; areas are recomputed from it on open.
- Pen colors are approximations. Say so wherever colors are presented as matching real pens.
- Components in `src/lib/components/ui/` come from shadcn-svelte. bits-ui sets `data-state`, so use `data-[state=open]:` style variants, not `data-open:`.

## Tuning the area detection

Detection parameters were tuned on coloring pages that come with a colored version of the same drawing: the clean half gives the true areas, the colored half (and a simulated phone photo of both) must reproduce them. When changing `lines.ts` or `segment.ts`, rerun such a comparison and check that no page gets worse.
