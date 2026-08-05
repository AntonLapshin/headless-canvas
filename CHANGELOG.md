# Changelog

All notable changes to **headless-canvas** are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/) and the project adheres to [Semantic Versioning](https://semver.org/).

## [0.4.0] — 2026-08-05

### Changed

- **Flat white canvas (styled kit)** — the demo canvas is now a white stage with a gray border, no rounded corners and no drop shadow.
- **Hover and selection share one bluish color** — the kit's accent and hover are the same blue (light `#3b82f6`, dark `#60a5fa`), applied to the rings and the handles.
- **`MoveHandle` is a corner handle, not a body grab** — its hit region shrank from the whole item body to a small square around the anchor (the item's top-left corner, where the styled kit draws the move glyph). Body clicks are ignored by the canvas and pass through to the item's content, so buttons, selects and links inside items behave like any other DOM.
- **Selected item sits on top** — while selected, an item renders at `max effective z + 1` and wins hit-testing over every other item regardless of mount order. The bump is transient: the store's `zIndex` is never mutated, so `getItems()`/`onItemsChange` stay clean.
- **`measureEdges` simplified** — signature is now `measureEdges(item, bounds)`: each edge line runs straight from the item edge to the corresponding canvas edge and never stops at other items (breaking change for direct importers of `measureEdges`; `EdgeLines` was the only consumer).
- **Rotate/Resize values reuse the edge-value pill** — their value span now carries `data-edge-value`, so they render exactly like the EdgeLines numbers (white on dark pill, same radius/shadow).
- Example cards in the stories no longer use rounded borders.

### Fixed

- `RotateValue`/`ResizeValue` pills were tiny rounded blobs with barely visible white text: the container collapsed around its absolutely-positioned span. The pill styling now applies to the span itself (the same `[data-edge-value]` rule the edge lines use).

## [0.3.0] — 2026-08-05

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
[0.3.0]: https://github.com/AntonLapshin/headless-canvas/releases/tag/v0.3.0
[0.4.0]: https://github.com/AntonLapshin/headless-canvas/releases/tag/v0.4.0
