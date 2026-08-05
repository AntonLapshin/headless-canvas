# headless-canvas

**A headless, declarative React canvas for placing, moving, resizing, scaling and rotating positioned elements.**

[![npm version](https://img.shields.io/npm/v/headless-canvas?color=cb6f4e)](https://www.npmjs.com/package/headless-canvas)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Peer: React >= 18](https://img.shields.io/badge/react-%3E%3D18-blue)](package.json)
[![Zero runtime dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![Live demo](https://img.shields.io/badge/demo-storybook-ff4785)](https://antonlapshin.github.io/headless-canvas/)

**Interactive demo (Storybook): [https://antonlapshin.github.io/headless-canvas/](https://antonlapshin.github.io/headless-canvas/)** — drag, resize, scale and rotate the items to feel the interaction model.

`headless-canvas` gives you a complete drag-and-drop interaction engine with **zero visual styles**. It renders no handles, no outlines, no cursors, no colors — it renders structure and data attributes, and your CSS does the rest. Your DOM stays yours.

- **Headless** — one pointer listener on the canvas root; hit-testing is pure coordinate math against a feature/item registry, never DOM events. Wrapping, portals or fragments around handles can never break interaction.
- **Declarative** — compose what an item can do with JSX:
  ```tsx
  <Canvas width={794} height={1123}>
    <Item x={80} y={120} features={<MoveHandle />}><h1>Title</h1></Item>
    <Item x={80} y={400} width={300} height={200}
          features={<><MoveHandle /><ResizeHandle direction="se" /></>} />
    <Item x={500} y={400} width={200} height={200} features={<ScaleHandle />} />
  </Canvas>
  ```
- **Fast** — geometry lives in an external store (`useSyncExternalStore`); a drag re-renders only the dragged item. Zoom is a single CSS transform.
- **Universal** — no `<canvas>` element involved: the library renders plain DOM, so text is text, images are images, and the same components render identically in your editor and your export pipeline.

## The wrapping insight

```tsx
const MoveHandleStyled = () => (
  <>
    <div className={styles.handle}><MoveIcon /></div>
    <MoveHandle />
  </>
);

<Item id="a" x={80} y={120} features={<MoveHandleStyled />}>…</Item>
```

Because hit-testing is geometric (coordinate math against a registry), the DOM tree under the canvas is *presentation only*. You can restyle any handle freely — the interaction can't break. One rule: **the visual must be a sibling of the anchor, not a wrapper.** The anchor div is positioned in item-local coordinates (`left/top` set by the library), so wrapping it in a positioned div shifts it off its hit region — the pixels and the interaction would diverge. Render your visual as a sibling and pin it to the corner with CSS (`left/right/top/bottom`), and they stay in lockstep with zero JS.

The default styled kit in `stories/styled.tsx` is a complete reference implementation of this pattern (heroicons glyphs, reserved corner positions, hover/selection visibility) — copy it into your app and restyle from there.

## Install

```bash
npm install headless-canvas
# peer: react >= 18
```

The package ships ESM + CJS with bundled TypeScript declarations, and has **zero runtime dependencies**. The one structural stylesheet (positioning, `touch-action`, `user-select`) is auto-injected by the built JS — no CSS import needed. Vite/Webpack/Rollup/Next all work.

## Quickstart

```tsx
import { Canvas, Item, MoveHandle, ResizeHandle, RotateHandle } from 'headless-canvas';

// consumer stylesheet (CSS modules, Tailwind, plain CSS — your choice)
import styles from './editor.module.css';

// The visual is a SIBLING of the anchor — see "The wrapping insight" below.
const MoveHandleStyled = () => (
  <>
    <div className={styles.handle}><MoveIcon /></div>
    <MoveHandle />
  </>
);

export function Editor() {
  return (
    <Canvas width={794} height={1123} snapToGrid={10} aria-label="Page editor">
      <Item id="title" x={80} y={120} features={<MoveHandleStyled />}>
        <h1>Slow Living Autumn</h1>
      </Item>
      <Item
        id="photo"
        x={80} y={400} width={300} height={200}
        features={<><MoveHandleStyled /><ResizeHandle direction="se" /><RotateHandle /></>}
      >
        <img src="..." alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Item>
    </Canvas>
  );
}
```

Selected / hovered / locked states are driven by data attributes, so they're pure CSS:

```css
.item[data-selected="true"]  { outline: 2px dashed #c67b5c; }
.item[data-hovered="true"]   { box-shadow: 0 0 0 2px rgba(0,0,0,.15); }
.item[data-locked="true"]    { opacity: .7; }
.handle { position: absolute; width: 12px; height: 12px; cursor: move; ... }
```

## API reference

### `<Canvas>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `width` / `height` | `number` | — | **Required.** Logical size of the design space (e.g. 794×1123 = A4 @96dpi). |
| `scale` | `number` | `1` | Display zoom. Children are authored in logical units; `scale` maps to CSS px. A single CSS transform — no per-item transforms. |
| `snapToGrid` | `number` | off | Snap dragged geometry to this grid (logical units). |
| `constraints` | `Constraints` | canvas edges | `{ minX, minY, maxX, maxY, minWidth, minHeight }` — bounds enforced on dragged geometry. **Defaults to the canvas edges**: items can never leave the canvas. Override individual edges to tighten (`{ minX: 20 }`) or extend (`{ maxX: 700 }`) them; the rest stay pinned to the canvas. |
| `disabled` | `boolean` | `false` | Disable all interaction (still renders + context available). |
| `selectedId` / `onSelect` | `string \| null` / fn | uncontrolled | Controlled selection. Omit for uncontrolled. |
| `items` / `onItemsChange` | `ItemGeometry[]` / fn | uncontrolled | Controlled geometry: pass the full array; drags are reported (rAF-throttled during drag, exact on end) and the parent round-trips. |
| `onDragStart` / `onDragEnd` | `(id, kind) => void` | — | Drag lifecycle, with the drag kind (`'move' \| 'resize' \| 'rotate'` or a custom kind). |
| `onItemDoubleClick` | `(id) => void` | — | Double-click on an item body/feature. |
| `aria-label` | `string` | — | Accessible name for the region (rendered as `role="group"`). |
| `className` / `style` | — | — | Pass-through hooks for consumer CSS. |
| `ref` | `CanvasHandle` | — | Imperative API (below). |

### `CanvasHandle` (via ref)

| Method | Description |
|---|---|
| `getItems()` | All geometries, ordered by effective z (render order). |
| `setItems(items)` | Replace all geometries. |
| `select(id \| null)` | Select or deselect. |
| `bringToFront(id)` / `sendToBack(id)` | Reorder via `zIndex = max+1` / `min−1`. |

### `ItemGeometry`

```ts
{ id: string; x: number; y: number;
  width?: number; height?: number;   // undefined = natural content size (measured)
  rotation?: number;                 // degrees around center, default 0
  zIndex?: number;                   // default: render order
  locked?: boolean }                 // blocks transforms; selection + focus stay
```

### `<Item>`

| Prop | Description |
|---|---|
| `id` | Unique id — the item's identity in the store, hit-testing and selection. |
| `x`, `y`, `width`, `height`, `rotation`, `zIndex`, `locked` | Initial geometry. In uncontrolled mode, props are *initial values* — the store owns geometry afterwards (so re-rendering with different props never loses drag state). In controlled mode, the `items` prop wins. |
| `features` | Declarative affordances: `<MoveHandle />`, `<ResizeHandle />`, `<RotateHandle />`, plus the readouts `<EdgeLines />`, `<RotateValue />`, `<ResizeValue />` — or your own feature components. |
| `className` / `style` | Pass-through hooks for consumer CSS. |
| `children` | Item content — any React node. Auto-sized items are measured with a `ResizeObserver`. |

### Features (handles)

Each handle renders **one invisible anchor `<div>`** (`data-feature`, `pointer-events: none`, no classes, no visuals) and registers its geometric hit region + drag behavior. **No-op on locked items and disabled canvases.**

| Handle | Props | Behavior |
|---|---|---|
| `MoveHandle` | `cursor?` (default `'move'`) | Hit region = the whole item body — grab anywhere to move. |
| `ResizeHandle` | `direction?` — `n/s/e/w/ne/nw/se/sw` (default `'se'`), `lockRatio?` (default `false`), `cursor?` | Resizes that edge/corner; `n`/`w` handles keep the opposite edge fixed. Min size 8 (configurable via constraints). With `lockRatio` the aspect ratio is preserved — corner handles scale proportionally from the opposite corner (the former `ScaleHandle` behavior), edge handles scale the perpendicular axis around the item center. No-op on auto-sized items. |
| `RotateHandle` | `offset?` (default 24), `cursor?` | Sits above the item top-center; drag in a circle to rotate (normalized to [0, 360)). |

**Readouts** — passive features that render *only while the relevant drag is active* (no hit region, `pointer-events: none`). They carry zero visual styles: line color/width and number appearance are consumer CSS driven by the data attributes below.

| Readout | Shows | While |
|---|---|---|
| `EdgeLines` | One tiny line from each item edge toward the nearest target edge (another item or the canvas edge), with the pixel distance in the middle of each line — Figma-style measurement | the item is **moved** |
| `RotateValue` | The current angle (e.g. `45°`) | the item is **rotated** |
| `ResizeValue` | Live `width × height` in px | the item is **resized** |

**Custom features** — build your own affordances (a "crop" handle, a link handle…) on the same canvas-level pointer pipeline:

```tsx
function CropHandle() {
  const { id } = useItem();
  const canvas = useCanvas();
  useFeatureRegistration(id, 'crop', () => ({           // item-local hit region
    x: canvas.getItem(id)!.width! - 12, y: canvas.getItem(id)!.height! - 12,
    width: 24, height: 24,
  }), {
    cursor: 'crosshair',
    onDrag: ({ dx, dy, start }) => ({                   // return a geometry patch
      width: (start.width ?? 0) + dx,
      height: (start.height ?? 0) + dy,
    }),
  });
  return <div className={styles.crop} />;                // your visual, your styles
}
```

### Hooks

| Hook | Returns |
|---|---|
| `useCanvas()` | `{ width, height, scale, selectedId, hoveredId, activeDrag, select, getItem, updateItem, snap, toLogical }` — throws outside `<Canvas>`. `getItem`/`updateItem` read/write the store; `snap` snaps to the configured grid; `toLogical` maps client → logical coordinates; `activeDrag` is `{ itemId, kind, direction? }` while a drag is in progress (drives the readouts). |
| `useItem()` | `{ id, geometry }` for the nearest enclosing `<Item>` — re-renders when *that* item's geometry changes. |
| `useFeatureRegistration(itemId, kind, getHitRect, options?)` | Register a custom hit region + drag behavior (see above). |

## Styling guide

**The library ships one structural SCSS module** (`.canvas`, `.layer`, `.item`, `.feature` — positioning, `touch-action`, `user-select`, `pointer-events`) and **nothing else**. No colors, no borders, no cursors, no shadows. No Tailwind, no CSS-in-JS, no inline decorative styles.

### Data-attribute contract (stable, documented)

| Element | Attributes |
|---|---|
| Canvas root | `data-canvas` |
| Zoom layer | `data-canvas-layer` |
| Item wrapper | `data-item-id`, `data-selected`, `data-hovered`, `data-locked`, `data-disabled` (booleans) |
| Feature anchor | `data-feature="move\|resize\|rotate"`, `data-direction="se"` etc. |
| Edge line | `data-edge-line="top\|bottom\|left\|right"`, label `data-edge-value` (px) |
| Value readout | `data-feature="rotate-value"` (with `data-value`), `data-feature="resize-value"` (with `data-width` / `data-height`) |

Style everything from these:

```css
[data-canvas] { border-radius: 12px; background: #faf6ef; }
[data-item-id]:focus-visible { outline: 2px solid #c67b5c; }
[data-selected="true"] { box-shadow: 0 0 0 2px #c67b5c; }
[data-selected="true"] .handle, [data-hovered="true"] .handle { opacity: 1; }
[data-locked="true"] .handle { opacity: .4; }
```

**Convention for handle visibility** — the styled kit hides handles by default and fades them in with `[data-hovered="true"]` / `[data-selected="true"]` (plus `:focus-within` for keyboard users). The kit's reserved corner positions are pure CSS pins: move at `left/top`, resize at `right/bottom`, rotate above top-center.

**Styling the readouts** — EdgeLines lines are `<div data-edge-line>` children with `--hc-edge-thickness` (default 1px) controlling line width; labels are `data-edge-value` pills. Rotate/Resize values are pills on `[data-feature="rotate-value"]` / `[data-feature="resize-value"]`. The styled kit's measurement CSS (red lines, dark number pills — Figma-style) is a copy-ready reference.

Cursors for the built-in handles are applied by the canvas root while hovering (the anchors are `pointer-events: none`), so the `cursor` prop on each handle works out of the box — override by wrapping.

## Interaction & accessibility

- **Pointer model** — one `onPointerDown/Move/Up` set on the canvas root with pointer capture; hit-testing is geometric (features → item bodies → empty, topmost first). Mouse and touch are unified via pointer events; multi-touch (pinch) is not v1.
- **Bounds** — items can never leave the canvas: move, resize and keyboard moves clamp to the canvas edges (override individual edges with `constraints`). Programmatic writes (`updateItem`, controlled `items`) are not clamped — consumers own those.
- **Keyboard** — items are focusable (`tabIndex=0`). When focused: **arrows** move 1px, **Shift+arrows** resize 1px from the top-left, **r/R** rotate ±15°, **Esc** deselects. `Delete` is deliberately not handled — consumers own deletion.
- **ARIA** — canvas root is `role="group"` with your `aria-label`; items expose `aria-selected`; feature anchors carry `aria-label` ("Move item", …) and `aria-disabled`.
- **Locked items** — selection and focus stay; all transforms are blocked.
- **Disabled canvas** — everything off; still renders and provides context.

## Performance

- One pointer listener on the root (not N items).
- Hit-testing: registry scan, topmost-first — O(features + items); a uniform-grid spatial index is the documented upgrade path beyond ~1–2k items.
- Per-item store subscriptions: **only the dragged item re-renders per frame**; features re-render only when their item's geometry changes.
- `onItemsChange` is rAF-throttled during drag; `onDragEnd` always fires an exact final payload.
- `React.memo` on `Item` and features; stable callback identities.
- Zoom is a single CSS `transform` on one layer — no per-item transforms.
- See the **Perf** story: 500 draggable items with a live frame-time readout.

## Controlled vs uncontrolled

| Mode | How | Reading geometry |
|---|---|---|
| **Uncontrolled** (default) | Canvas owns the store; `Item` props are initial values | `onItemsChange` (throttled during drag, exact on end), `ref.getItems()` |
| **Controlled** | Pass `items`; the canvas mirrors the prop (prop changes win, skipped mid-drag) | Round-trip `onItemsChange` → state → `items` (standard controlled pattern) |

Selection has the same duality via `selectedId` / `onSelect`.

## FAQ

**Why no `<canvas>` element?** Because the WYSIWYG bet matters: the same components must render in the editor *and* in export (print PDF, thumbnails). DOM text is selectable, searchable, and pixel-identical everywhere. The name refers to the *design surface*, not the rendering API.

**Why exactly one SCSS file?** Structure is the library's job; appearance is yours. A single 350-byte structural module keeps the package honest: zero visual opinions, zero styling-system lock-in.

**How do I add a custom handle?** `useFeatureRegistration` — see the custom-feature example above. It's the same pipeline the built-in handles use.

**My item has no `width`/`height` — why won't it resize?** Auto-sized items are measured (content box) and rendered at natural size, but resizing/scaling requires explicit dimensions by design. Pass `width`/`height` to enable them.

**Why does the canvas show nothing?** It renders only what you put in it — that's the point. Structure comes from the injected stylesheet; appearance comes from your CSS on the data attributes.

**Does it work with touch?** Yes — pointer events unify mouse and touch. Pinch-zoom is a v2 candidate.

**What's the license?** MIT.

## Roadmap (v2 candidates)

Multi-select/grouping · snap-to-other-item *guides* (EdgeLines already measures, snapping them to exact alignments is next) · pinch zoom · custom drag shapes (paths) · in-canvas text editing · a spatial index for very large canvases.

## License

MIT © Anton Lapshin
