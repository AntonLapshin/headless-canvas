# Changelog

All notable changes to **headless-canvas** are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/) and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Handle support readouts** — three new headless features, rendered only while their drag is active:
  - **`EdgeLines`** — while an item is moved, a tiny measurement line runs from each edge toward the nearest target edge (another item or the canvas edge), with the pixel distance in the middle of each line (Figma-style). Pure math in `measureEdges(item, others, bounds)`; line color/width and number appearance are consumer CSS (`--hc-edge-thickness`, `data-edge-line`, `data-edge-value`).
  - **`RotateValue`** — shows the live angle (e.g. `45°`) while the item is rotated.
  - **`ResizeValue`** — shows live `width × height` while the item is resized.
  - The canvas context now exposes `activeDrag: { itemId, kind, direction? } | null` (`useCanvas().activeDrag`) so readouts — and custom features — can react to drags.
- **`ResizeHandle lockRatio`** — when `lockRatio` is set, resizing preserves the item's aspect ratio: corner handles scale proportionally from the opposite corner, edge handles scale the perpendicular axis around the item center. `resizeGeometry` accepts `lockRatio` in `DragOptions`.
- **Default styled kit readout styles** — red measurement lines + dark number pills (Figma-like), `ResizeHandleStyled` gains a `lockRatio` prop (link glyph), and a **Measure** story showcases all three readouts with interaction play-tests.

### Changed

- **`ScaleHandle` removed** — proportional scaling is now `ResizeHandle` with `lockRatio` (one affordance, two modes). `scaleGeometry` remains as exported pure math (and is what corner `lockRatio` delegates to); `DragKind` is now `'move' | 'resize' | 'rotate'`.
- The styled kit's reserved positions are now move (top-left), resize (bottom-right), rotate (above top-center) — no scale corner.

### Fixed

- (none)

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
