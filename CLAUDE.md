# Tintplan

Offline coloring planner. Photograph a coloring page, clean up the lines, tap areas to fill them with real pen colors, and get the pen codes written into the areas. Static SvelteKit app (no server) deployed to GitHub Pages as a PWA.

## Commands

- `bun run dev`: dev server
- `bun run check`: compiles Paraglide messages, then svelte-check
- `bun run lint`: eslint and prettier
- `bunx vitest --run`: unit tests (image pipeline, PNG chunks, labels)
- `bunx playwright test`: e2e against a production build (`bun run preview`)
- `bun run pens <dir>`: rebuild `src/lib/pens/data/` from the raw source files (see `scripts/import-pens.ts`)

## Layout

- `src/lib/image/`: pure image code, no DOM except `render.ts`.
  - `gray.ts` gray images and filters, `warp.ts` perspective straightening, `enhance.ts` line cleanup and page detection.
  - `segment.ts` splits line art into areas: labels on a copy with thickened lines (gap closing), narrow strips added back, then grown under the lines. Also finds each area's label spot (furthest from the outline, near the center of mass) and a per-area pixel list.
  - `label.ts` fits a code into an area's inscribed circle. `render.ts` composites fills under the lines (multiply) and draws labels on canvas.
  - `png.ts` writes and reads the private `tpLn` chunk that makes exported PNGs editable.
  - `worker.ts` runs decode, cleanup and segmentation off the main thread; `protocol.ts` is the typed RPC.
- `src/lib/editor.svelte.ts`: an open page. Fills per area, undo/redo, labels, legend, debounced saving with a thumbnail.
- `src/lib/db/`: Dexie schema. Fills are stored as a point inside the area, not as an area number, so they survive changes to the segmentation.
- `src/lib/pens/`: palette index and lazily loaded palette JSON.
- `src/lib/export.ts`: PNG rendering with codes and legend, embedding and importing projects, file saving.
- `src/routes/`: library (`/`), photo preparation (`/new`), editor (`/edit?id=`), `/settings`.
- `messages/{en,de}.json`: every UI string. Add both languages for each new key.

## Design

Read `DESIGN.md` before touching UI. After making changes, run `bun run lint` and fix all errors; it includes the `@shadcn/lint` design rules (no raw colors, no arbitrary values, no restyling of components, no inline styles except CSS custom properties).

## Releases

Add every user-facing change to `CHANGELOG.md` under "Unreleased" (Features / Fixes). To release: rename that section to the new version with the date, bump `version` in `package.json`, commit, then tag `vX.Y.Z` and push the tag.

## Conventions

- Image coordinates are pixels of the cleaned page (longest side at most 2048).
- The cleaned line art is the source of truth for a page; areas are recomputed from it on open.
- Pen colors are approximations. Say so wherever colors are presented as matching real pens.
- Components in `src/lib/components/ui/` come from shadcn-svelte. bits-ui sets `data-state`, so use `data-[state=open]:` style variants, not `data-open:`.
