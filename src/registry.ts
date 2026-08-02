/**
 * Feature registry: every handle (built-in or custom) registers its hit
 * region and drag behavior here. Hit-testing is geometric — the DOM tree is
 * presentation only, so wrapping, portals or fragments around a feature can
 * never break interaction.
 */

import { useEffect, useId, useRef } from 'react';
import { useInternalCanvas } from './context';
import type { Direction, DragKind, ItemGeometry, Rect, ScaleAnchor } from './types';

/** Context passed to a custom feature's `onDrag`. */
export interface DragContext {
  /** The item being dragged. */
  itemId: string;
  /** Geometry snapshot from drag start (the drag is relative to this). */
  start: ItemGeometry;
  /** Pointer delta in logical units since drag start. */
  dx: number;
  dy: number;
  /** Current pointer position, logical canvas coordinates. */
  logical: { x: number; y: number };
  /** Pointer position at drag start, logical canvas coordinates. */
  startLogical: { x: number; y: number };
  /** The native pointer event (advanced use). */
  event: PointerEvent;
  /** Snap a logical value to the canvas grid. */
  snap: (value: number) => number;
  /** Constraints configured on the canvas. */
  constraints?: import('./types').Constraints;
  /** snapToGrid configured on the canvas. */
  snapToGrid?: number;
}

/** Custom drag handler: return a geometry patch (or nothing). */
export type DragHandler = (ctx: DragContext) => Partial<ItemGeometry> | void;

/** Built-in feature parameters (direction/anchor/offset for the handles). */
export interface FeatureParams {
  direction?: Direction;
  anchor?: ScaleAnchor;
  offset?: number;
}

export interface FeatureEntry {
  /** Stable instance id (from `useId`). */
  id: string;
  itemId: string;
  /** Built-in kinds use the library's drag math; any other string uses `onDrag`. */
  kind: DragKind | string;
  /** Item-local logical hit region. Reads live geometry at call time. */
  getHitRect(): Rect;
  /** Custom drag behavior (only consulted for non-built-in kinds). */
  onDrag?: DragHandler;
  params?: FeatureParams;
  cursor?: string;
}

export class FeatureRegistry {
  private entries = new Map<string, FeatureEntry>();

  add(entry: FeatureEntry): void {
    this.entries.set(entry.id, entry);
  }

  remove(id: string): void {
    this.entries.delete(id);
  }

  /** All registered entries (in registration order). */
  getAll(): FeatureEntry[] {
    return [...this.entries.values()];
  }

  get size(): number {
    return this.entries.size;
  }
}

export interface FeatureRegistrationOptions {
  /** Custom drag behavior for custom kinds (ignored for built-in kinds). */
  onDrag?: DragHandler;
  /** Built-in params: direction / anchor / offset. */
  params?: FeatureParams;
  /** Cursor the canvas shows while hovering this feature. */
  cursor?: string;
}

/**
 * Register a hit region + drag behavior for an item. Used internally by the
 * built-in handles and exported so consumers can build custom affordances
 * (e.g. a "crop" handle) on the same canvas-level pointer pipeline.
 *
 * `getHitRect` must be a *stable* function that reads live geometry (via
 * `useCanvas().getItem`), so the registration survives re-renders.
 */
export function useFeatureRegistration(
  itemId: string | null,
  kind: DragKind | string,
  getHitRect: () => Rect,
  options?: FeatureRegistrationOptions,
): void {
  const ctx = useInternalCanvas();
  const id = useId();
  const getHitRectRef = useRef(getHitRect);
  const onDragRef = useRef(options?.onDrag);
  const paramsRef = useRef(options?.params);
  const cursorRef = useRef(options?.cursor);

  getHitRectRef.current = getHitRect;
  onDragRef.current = options?.onDrag;
  paramsRef.current = options?.params;
  cursorRef.current = options?.cursor;

  useEffect(() => {
    if (!itemId) return;
    const entry: FeatureEntry = {
      id,
      itemId,
      kind,
      getHitRect: () => getHitRectRef.current(),
      onDrag: onDragRef.current,
      params: paramsRef.current,
      cursor: cursorRef.current,
    };
    ctx.registry.add(entry);
    return () => ctx.registry.remove(entry.id);
  }, [ctx, id, itemId, kind]);
}
