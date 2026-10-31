# Tintplan design system

Tintplan should feel like a calm drawing table: the page is the content, tools stay out of the way, and the most frequent action (tap an area to fill it) never needs more than one tap. The rules below keep the UI consistent. `bun run lint` enforces most of them through [`@shadcn/lint`](https://github.com/shadcn-ui/lint); the rest are review rules. The system is shared with PunchClock.

## Principles

1. **The page first.** The editor gives the page all the space. Toolbars sit at the edges and never cover the page.
2. **Short click paths.** Filling an area is one tap, switching to a recent pen is one tap, the full pen picker is one tap away.
3. **Undo over confirm.** Fills, erasing and replacing are undoable. Confirmation dialogs are only for destructive, irreversible actions (delete a page).
4. **Honest colors.** Pen colors are approximations from color charts. Never claim an exact match.
5. **Mobile first, desktop aware.** Design at 360 to 430 px wide, then use extra width on desktop for more columns, never for stretched content.

## Tokens

All tokens live in `src/app.css`. Use them through Tailwind classes. Raw palette colors (`bg-violet-600`), hex values and arbitrary values (`p-[13px]`) are lint errors. The page itself is always white paper, in light and dark mode.

| Token                           | Use                                                      |
| ------------------------------- | -------------------------------------------------------- |
| `background`, `foreground`      | App chrome                                               |
| `card`, `popover`               | Surfaces, sheets, the editor toolbar                     |
| `muted`, `muted-foreground`     | Area around the page, inactive fills, secondary text     |
| `primary`, `primary-foreground` | Brand violet: primary actions, the selected pen and tool |
| `secondary`, `accent`           | Quiet buttons and hover fills                            |
| `destructive`                   | Delete, clear all, errors                                |
| `border`, `input`, `ring`       | Lines, field borders, focus ring                         |

Pen swatches are data: set the color as a CSS custom property and read it with a class (`bg-(--c)`, see `Swatch`).

### Typography

System font stack. `text-caption` (11 px) for swatch codes, `text-xs` for meta text, `text-sm` default UI, `text-body` for list rows, `text-lg` for sheet and editor titles, `text-xl`/`text-2xl` for page titles. Codes and counts use `tabular`. Weights: `font-medium` for labels, `font-semibold` for titles and codes.

### Layout

- Page gutter `px-4` on mobile, `md:px-8` on desktop. Library cards in a 2/3/4 column grid.
- Full-screen flows (`/new`, `/edit`) use `h-dvh` with a header, a flexible `bg-muted` stage and a bottom panel with `pb-safe`.
- Touch targets are at least 40 px.
- `surface` is the only card style. Sheets are `rounded-3xl`, cards `rounded-2xl`, swatches `rounded-lg`.

### Motion

- The area scan plays once per new page, about 2.5 s, and never blocks taps. It is skipped when the system asks for reduced motion.
- Sheets slide up on mobile and fade in centered on desktop. No looping animations.
- Screens change with a short slide (View Transitions): deeper screens come in from the right, going up slides back. `+layout.svelte` sets the direction from the screen depth.
- A ring shows where a tap filled or erased an area. Buttons press in slightly (`active:scale-95`/`98`).

### Inline styles

Inline `style` is a lint error, with one exception: CSS custom properties for data-driven values. The `Viewport` transform is set from script, not markup.

## Components

| Need                                         | Use                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Action                                       | `Button` (`default`, `secondary`, `outline`, `ghost`, `destructive`, `link`, `floating` over the page) |
| Two to four options                          | `Segmented`                                                                                            |
| Bottom sheet / dialog                        | `Sheet`; `Confirm` for destructive confirmation only                                                   |
| Settings list                                | `Group` with `Row` children                                                                            |
| Form field with label                        | `Field` wrapping `Input` or `NativeSelect` (options may carry a `group`)                               |
| Page title bar                               | `PageHeader`                                                                                           |
| Pen color chip                               | `Swatch` (`sm` in strips, `md` in grids)                                                               |
| Pan, zoom and tap on the page                | `Viewport`                                                                                             |
| Photo corners                                | `CornerEditor` (magnifier while dragging)                                                              |
| Area scan after creating or importing a page | `ScanOverlay` (WebGL, skipped with reduced motion)                                                     |

Pages may add layout classes to a component. They may not change its padding, typography, color, shape or effects; add a variant instead.

## Content

- Every string lives in `messages/en.json` and `messages/de.json`.
- Labels are short nouns or verbs ("Fill", "Choose a pen"). Hints explain consequences in one sentence.

## Checklist for UI changes

1. `bun run lint` passes.
2. Light and dark mode both checked.
3. Checked at 390 px and at 1440 px wide.
4. Both languages fit without truncating key labels.
5. Filling an area is still one tap.
