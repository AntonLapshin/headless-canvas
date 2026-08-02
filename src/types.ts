/**
 * headless-canvas — public types.
 *
 * Everything a consumer imports is declared here. The library renders no
 * visual styles: all appearance is driven by data attributes + consumer CSS.
 */

/** Cardinal + intercardinal directions, used by `ResizeHandle`. */
export type Direction = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** The four built-in drag behaviors. Custom features may use any string. */
export type DragKind = 'move' | 'resize' | 'scale' | 'rotate';

/**
 * Which corner the `ScaleHandle` sits on (the opposite corner stays fixed
 * during the drag), or `'center'` to keep the item center fixed.
 */
export type ScaleAnchor = 'nw' | 'ne' | 'sw' | 'se' | 'center';

/** Axis-aligned rectangle in logical (item-local or canvas) coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Geometry of a single positioned item, in logical units.
 *
 * `width`/`height` are `undefined` for auto-sized items: the canvas measures
 * the rendered content box and stores the natural size. Auto-sized items
 * cannot be resized or scaled until given explicit dimensions.
 */
export interface ItemGeometry {
  /** Unique id; the item's identity in the store, hit-testing and selection. */
  id: string;
  /** Top-left corner, logical units. */
  x: number;
  y: number;
  /** `undefined` = natural content size (measured by ResizeObserver). */
  width?: number;
  height?: number;
  /** Degrees around the item center. Default 0. */
  rotation?: number;
  /** Explicit stacking order. Default: render (mount) order. */
  zIndex?: number;
  /** Blocks move/resize/scale/rotate; selection + keyboard focus stay active. */
  locked?: boolean;
}

/** Optional bounds the canvas enforces on dragged geometry. */
export interface Constraints {
  minX?: number;
  minY?: number;
  maxX?: number;
  maxY?: number;
  minWidth?: number;
  minHeight?: number;
}

/** Imperative API exposed through `Canvas`'s `ref`. */
export interface CanvasHandle {
  /** All current geometries, ordered by effective z (render order). */
  getItems(): ItemGeometry[];
  /** Replace all geometries (equivalent to a controlled `items` write). */
  setItems(items: ItemGeometry[]): void;
  /** Select (or deselect with `null`). */
  select(id: string | null): void;
  /** Raise an item above everything else. */
  bringToFront(id: string): void;
  /** Lower an item below everything else. */
  sendToBack(id: string): void;
}

/** Public value of the canvas context (see `useCanvas`). */
export interface CanvasContextValue {
  /** Logical size of the design space. */
  width: number;
  height: number;
  /** Display zoom; children are authored in logical units. */
  scale: number;
  /** Currently selected item id, or `null`. */
  selectedId: string | null;
  /** Item id under the pointer (no buttons pressed), or `null`. */
  hoveredId: string | null;
  /** Select an item, or `null` to deselect. */
  select(id: string | null): void;
  /** Read an item's current geometry from the store. */
  getItem(id: string): ItemGeometry | undefined;
  /** Apply a partial geometry patch (fires `onItemsChange`). */
  updateItem(id: string, patch: Partial<ItemGeometry>): void;
  /** Snap a logical value to the configured grid (identity when off). */
  snap(value: number): number;
  /** Convert client (viewport) coordinates to logical canvas coordinates. */
  toLogical(clientX: number, clientY: number): { x: number; y: number };
}

export interface CanvasProps {
  /** Logical size of the design space (e.g. 794×1123 = A4 @96dpi). Required. */
  width: number;
  height: number;
  /** Display zoom. Children are authored in logical units; `scale` maps to CSS px. Default 1. */
  scale?: number;
  /** Snap dragged geometry to this grid (logical units). Default: off. */
  snapToGrid?: number;
  /** Keep dragged items inside these bounds. Default: off. */
  constraints?: Constraints;
  /** Disable all interaction (still renders + context available). Default false. */
  disabled?: boolean;

  // ---- selection ----
  /** Controlled selection. Omit for uncontrolled. */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;

  // ---- geometry ----
  /** Controlled mode: pass the full geometry array. Omit for uncontrolled (canvas owns it). */
  items?: ItemGeometry[];
  /** Fired on drag end (and rAF-throttled during drag) with all current geometries. */
  onItemsChange?: (items: ItemGeometry[]) => void;
  onDragStart?: (id: string, kind: DragKind) => void;
  onDragEnd?: (id: string, kind: DragKind) => void;
  onItemDoubleClick?: (id: string) => void;

  /** Accessible name for the canvas region (screen readers). */
  'aria-label'?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  ref?: React.Ref<CanvasHandle>;
}

export interface ItemProps {
  id: string;
  /** Top-left corner, logical units. Initial value (uncontrolled mode). */
  x: number;
  y: number;
  /** `undefined` = natural content size (measured). Initial value. */
  width?: number;
  height?: number;
  /** Degrees around the center. Initial value. */
  rotation?: number;
  zIndex?: number;
  locked?: boolean;
  /**
   * Declarative affordances: `<MoveHandle />`, `<ResizeHandle />`,
   * `<ScaleHandle />`, `<RotateHandle />` — or your own feature components.
   */
  features?: React.ReactNode;
  /** Consumer styling hook. */
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface MoveHandleProps {
  /** Cursor shown while hovering the handle. Default `'move'`. */
  cursor?: string;
}

export interface ResizeHandleProps {
  /** Which edge/corner this handle resizes. Default `'se'`. */
  direction?: Direction;
  /** Cursor override; defaults to the per-direction resize cursor. */
  cursor?: string;
}

export interface ScaleHandleProps {
  /**
   * The corner the handle sits on; the opposite corner stays fixed during the
   * drag. Default `'ne'` (top-right) — the reserved scale position, so it
   * never collides with the move (top-left) or resize (bottom-right) handles.
   */
  anchor?: ScaleAnchor;
  /** Cursor override. Defaults to the per-anchor diagonal resize cursor. */
  cursor?: string;
}

export interface RotateHandleProps {
  /** Distance from the item's top-center to the handle. Default 24. */
  offset?: number;
  /** Cursor override. Default `'grab'`. */
  cursor?: string;
}
