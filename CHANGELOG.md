# Changelog

All notable changes to **headless-canvas** are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/) and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Canvas bounds are now the default constraints** — items can never leave the canvas: moving, resizing, scaling and keyboard moves all clamp to `[0, width] × [0, height]` even without a `constraints` prop. An explicit `constraints` prop overrides individual edges (`{ maxX: 700 }` extends the right bound) while the rest stay pinned to the canvas.
- **`ScaleHandle` all-corner anchors** — `ScaleAnchor` is now `'nw' | 'ne' | 'sw' | 'se' | 'center'`; the corner opposite the anchor stays fixed (e.g. `'ne'` keeps the bottom-left fixed). Scaling is clamped to the canvas bounds, respecting the fixed corner.
- **`ScaleHandle` default anchor is now `'ne'` (top-right)** — reserved positions: move top-left, resize bottom-right, scale top-right, so the three handles never collide.
- **Default styled kit for the stories** (`stories/styled.tsx`) — a reference consumer-side styled set used by every story: heroicons glyphs (inlined, zero deps), handles at the reserved corners, selection/hover/focus rings, light & dark themes, and handles that fade in when their item is hovered or selected. The library itself still ships zero visual styles.

### Changed

- `resizeGeometry` / `scaleGeometry` / `moveGeometry` receive the effective canvas bounds from `<Canvas>` (pure functions unchanged in signature).
- Stories: `Keyboard`, `Controlled mode` and `Disabled` got explicit `render:` (CSF3 uses the file's default meta otherwise — they previously rendered the wrong demo; their play tests could not pass in the browser).
- Story play tests that assert `data-*` attributes now `await flush()` after pointer events (React batches continuous-event state updates).

### Fixed

- Styled handles previously rendered at the item's static flow position ("left middle") while their geometric hit regions sat at the corners — the visible handle and the interactive region diverged, so the handles felt dead. The styled kit positions visuals and anchors at the same reserved corners.

## [0.2.0] — 2026-08-02

Initial release. Per the library spec (`headless-canvas-spec.md` §13), this single release delivers **both** the v0.1.0 scope (core canvas) and the v0.2.0 scope (rotate, custom features, keyboard resize), since they were implemented in one pass. The spec's open questions were resolved as follows:

- **Name (§14.1):** `headless-canvas` — the spec's working title, available on npm, self-describing.
- **Publish vs file: dep (§14.2):** package layout is npm-ready (dual ESM/CJS, bundled types, zero runtime deps); actual publishing deferred until a second consumer exists. The Cozy Guide Studio consumes it via `file:` dep.
- **Rotation in v1 (§14.4):** included — `RotateHandle` shipped in this release.
- **Natural-size measurement (§14.6):** measured once per mount via `ResizeObserver` and updated on content change; resize/scale are no-ops until explicit dimensions are given.

### Added

- `<Canvas>` — root component: logical `width`/`height`, `scale` zoom (single CSS transform), `snapToGrid`, `constraints`, `disabled`, controlled/uncontrolled selection (`selectedId`/`onSelect`) and geometry (`items`/`onItemsChange`), drag lifecycle callbacks (`onDragStart`/`onDragEnd`), `onItemDoubleClick`, imperative `CanvasHandle` via ref (`getItems`, `setItems`, `select`, `bringToFront`, `sendToBack`).
- `<Item>` — positioned block: registers/unregisters geometry with the store; per-item store subscription (`useSyncExternalStore`) so a drag re-renders only the dragged item; auto-sizing via `ResizeObserver`; `data-*` attribute contract (`data-item-id`, `data-selected`, `data-hovered`, `data-locked`, `data-disabled`).
- Features — `MoveHandle` (whole-body hit region), `ResizeHandle` (all 8 directions, fixed opposite edges, min-size clamp), `ScaleHandle` (`se`/`center` anchors, proportional), `RotateHandle` (`offset`). All headless: one `pointer-events: none` anchor div, `data-feature`/`data-direction`, no visuals.
- `useFeatureRegistration` — public hook for custom affordances on the same canvas-level pointer pipeline.
- Hooks — `useCanvas()`, `useItem()`, `useItemId()`.
- Interaction model — single pointer listener on the canvas root with pointer capture; geometric hit-testing (features → bodies → empty, topmost first, rotation-aware); rAF-throttled `onItemsChange` with exact final payload; hover tracking; keyboard (arrows move, Shift+arrows resize, r/R rotate ±15°, Esc deselect).
- Styling contract — exactly one structural SCSS module (`canvas.module.scss`), auto-injected into the built JS; styling via the documented data-attribute contract.
- Tooling — Storybook (14 stories incl. a 500-item perf story and a light/dark styling showcase, all with interaction play-tests), Vitest + React Testing Library (63 tests: math, interaction, registry, a11y), ESLint + Prettier, dual ESM/CJS build with bundled type declarations.
- Docs — library-grade README, typed API reference, this changelog, MIT license.

[0.2.0]: https://github.com/AntonLapshin/headless-canvas/releases/tag/v0.2.0
