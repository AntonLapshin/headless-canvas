/**
 * Pure geometry math: snap, clamp, drag deltas, hit-testing.
 *
 * Everything in this file is a function of plain values — no React, no DOM.
 * This is what makes the interaction model testable and the hit-testing
 * geometric (coordinate math against a registry, never DOM events).
 */

import type { Constraints, Direction, DragKind, ItemGeometry, Rect, ScaleAnchor } from './types';

/** Default minimum size enforced during resize/scale drags. */
export const DEFAULT_MIN_SIZE = 8;

/** Half-extent of a feature's hit square (20×20 logical px around the anchor). */
export const HIT_HALF = 10;

/** Size of the invisible anchor `<div>` each feature renders. */
export const HANDLE_SIZE = 12;

/** Snap a value to a grid. Identity when `grid` is falsy or non-positive. */
export function snap(value: number, grid?: number): number {
  if (!grid || grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

/** Clamp `value` into `[min, max]` (NaN-safe: falls back to `min`). */
export function clamp(value: number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (Number.isNaN(value)) return lo;
  return Math.min(Math.max(value, lo), hi);
}

/** Normalize a rotation into [0, 360). */
export function normalizeRotation(degrees: number): number {
  const r = degrees % 360;
  return r < 0 ? r + 360 : r;
}

/** Angle (degrees) from `(cx, cy)` to `(px, py)`, in canvas coordinates. */
export function angleFromCenter(cx: number, cy: number, px: number, py: number): number {
  return (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
}

export interface DragOptions {
  snapToGrid?: number;
  constraints?: Constraints;
  /** Minimum sizes for resize/scale (defaults to 8 when unset). */
  minWidth?: number;
  minHeight?: number;
}

/* ------------------------------------------------------------------ */
/* Drag math                                                           */
/* ------------------------------------------------------------------ */

/** Move: translate by (dx, dy), snap both axes, clamp to bounds. */
export function moveGeometry(
  item: ItemGeometry,
  dx: number,
  dy: number,
  opts: DragOptions,
): Partial<ItemGeometry> {
  const c = opts.constraints;
  const w = item.width ?? 0;
  const h = item.height ?? 0;
  return {
    x: clamp(
      snap(item.x + dx, opts.snapToGrid),
      c?.minX ?? -Infinity,
      (c?.maxX ?? Infinity) - w,
    ),
    y: clamp(
      snap(item.y + dy, opts.snapToGrid),
      c?.minY ?? -Infinity,
      (c?.maxY ?? Infinity) - h,
    ),
  };
}

/**
 * Resize: adjust width/height by dx/dy on the relevant axes. `n`/`w` handles
 * shift x/y so the opposite edge stays fixed. The moving edge(s) snap to the
 * grid; min sizes and bounds constraints are enforced.
 *
 * Auto-sized items (width or height undefined) are a documented no-op: they
 * have no explicit box to resize.
 */
export function resizeGeometry(
  item: ItemGeometry,
  direction: Direction,
  dx: number,
  dy: number,
  opts: DragOptions,
): Partial<ItemGeometry> {
  if (item.width == null || item.height == null) return {};
  const c = opts.constraints;
  const minW = c?.minWidth ?? opts.minWidth ?? DEFAULT_MIN_SIZE;
  const minH = c?.minHeight ?? opts.minHeight ?? DEFAULT_MIN_SIZE;
  const grid = opts.snapToGrid;
  const { x: sx, y: sy, width: sw, height: sh } = item;

  const east = direction.includes('e');
  const west = direction.includes('w');
  const south = direction.includes('s');
  const north = direction.includes('n');

  let x = sx;
  let y = sy;
  let width = sw;
  let height = sh;

  if (east) width = snap(sx + sw + dx, grid) - sx;
  if (west) {
    // Right edge stays fixed; the left edge moves and snaps.
    const right = sx + sw;
    x = clamp(snap(sx + dx, grid), c?.minX ?? -Infinity, right - minW);
    width = right - x;
  }
  if (south) height = snap(sy + sh + dy, grid) - sy;
  if (north) {
    // Bottom edge stays fixed; the top edge moves and snaps.
    const bottom = sy + sh;
    y = clamp(snap(sy + dy, grid), c?.minY ?? -Infinity, bottom - minH);
    height = bottom - y;
  }

  // Min-size clamp, preserving the fixed edge for n/w handles.
  width = Math.max(width, minW);
  if (west) x = sx + sw - width;
  height = Math.max(height, minH);
  if (north) y = sy + sh - height;

  // Bounds constraints on the box (constraints win over the fixed edge).
  if (c) {
    if (c.minX != null) x = Math.max(x, c.minX);
    if (c.minY != null) y = Math.max(y, c.minY);
    if (c.maxX != null) width = Math.min(width, c.maxX - x);
    if (c.maxY != null) height = Math.min(height, c.maxY - y);
    width = Math.max(width, minW);
    height = Math.max(height, minH);
  }

  return { x, y, width, height };
}

/**
 * Scale: proportional — newH = newW × (h/w). The corner opposite the anchor
 * stays fixed ('se' keeps the top-left, 'ne' the bottom-left, 'sw' the
 * top-right, 'nw' the bottom-right); 'center' keeps the item center fixed.
 * Constraints bound the *moving* edges, so an item can never be scaled past
 * the canvas bounds. Auto-sized items are a documented no-op.
 */
export function scaleGeometry(
  item: ItemGeometry,
  anchor: ScaleAnchor,
  dx: number,
  _dy: number,
  opts: DragOptions,
): Partial<ItemGeometry> {
  if (item.width == null || item.height == null || item.width <= 0) return {};
  const c = opts.constraints;
  const minW = c?.minWidth ?? opts.minWidth ?? DEFAULT_MIN_SIZE;
  const minH = c?.minHeight ?? opts.minHeight ?? DEFAULT_MIN_SIZE;
  const ratio = item.height / item.width;
  const sx = item.x;
  const sy = item.y;
  const sw = item.width;
  const sh = item.height;
  const right = sx + sw;
  const bottom = sy + sh;

  // se/ne follow the pointer (+dx grows); sw/nw oppose it (their moving edge
  // is the left one); center grows both ways.
  const grow = anchor === 'center' ? dx * 2 : anchor === 'se' || anchor === 'ne' ? dx : -dx;

  // Max width the moving edges allow before hitting the constraints. The
  // fixed corner never moves, so only the opposite edges are bounded.
  let maxW = Infinity;
  switch (anchor) {
    case 'se': // top-left fixed: right ≤ maxX, bottom ≤ maxY
      if (c?.maxX != null) maxW = Math.min(maxW, c.maxX - sx);
      if (c?.maxY != null) maxW = Math.min(maxW, (c.maxY - sy) / ratio);
      break;
    case 'ne': {
      // bottom-left fixed: right ≤ maxX, top ≥ minY
      if (c?.maxX != null) maxW = Math.min(maxW, c.maxX - sx);
      if (c?.minY != null) maxW = Math.min(maxW, (bottom - c.minY) / ratio);
      break;
    }
    case 'sw': {
      // top-right fixed: left ≥ minX, bottom ≤ maxY
      if (c?.minX != null) maxW = Math.min(maxW, right - c.minX);
      if (c?.maxY != null) maxW = Math.min(maxW, (c.maxY - sy) / ratio);
      break;
    }
    case 'nw': {
      // bottom-right fixed: left ≥ minX, top ≥ minY
      if (c?.minX != null) maxW = Math.min(maxW, right - c.minX);
      if (c?.minY != null) maxW = Math.min(maxW, (bottom - c.minY) / ratio);
      break;
    }
    case 'center': {
      const cx = sx + sw / 2;
      const cy = sy + sh / 2;
      if (c?.minX != null || c?.maxX != null) {
        const lo = c.minX != null ? cx - c.minX : Infinity;
        const hi = c.maxX != null ? c.maxX - cx : Infinity;
        maxW = Math.min(maxW, 2 * Math.min(lo, hi));
      }
      if (c?.minY != null || c?.maxY != null) {
        const lo = c.minY != null ? (cy - c.minY) / ratio : Infinity;
        const hi = c.maxY != null ? (c.maxY - cy) / ratio : Infinity;
        maxW = Math.min(maxW, 2 * Math.min(lo, hi));
      }
      break;
    }
  }

  let width = Math.max(minW, snap(item.width + grow, opts.snapToGrid));
  if (minH / ratio > width) width = minH / ratio; // keep the ratio while honoring minH
  if (Number.isFinite(maxW)) width = Math.min(width, maxW);
  width = Math.max(width, minW); // min sizes win over bounds (matches resize)
  const height = width * ratio;

  switch (anchor) {
    case 'se':
      return { width, height };
    case 'ne':
      return { y: bottom - height, width, height }; // left edge fixed
    case 'sw':
      return { x: right - width, width, height }; // top edge fixed
    case 'center': {
      const cx = sx + sw / 2;
      const cy = sy + sh / 2;
      return { x: cx - width / 2, y: cy - height / 2, width, height };
    }
    case 'nw':
    default:
      return { x: right - width, y: bottom - height, width, height };
  }
}

/** Rotate to an absolute angle (degrees), normalized to [0, 360). */
export function rotateToGeometry(_item: ItemGeometry, angle: number): Partial<ItemGeometry> {
  return { rotation: normalizeRotation(angle) };
}

/* ------------------------------------------------------------------ */
/* Feature anchor positions (item-local) + cursors                     */
/* ------------------------------------------------------------------ */

/** Anchor point (item-local) for a resize handle direction. */
export function resizeAnchorPoint(direction: Direction, w: number, h: number): { x: number; y: number } {
  switch (direction) {
    case 'n':
      return { x: w / 2, y: 0 };
    case 's':
      return { x: w / 2, y: h };
    case 'e':
      return { x: w, y: h / 2 };
    case 'w':
      return { x: 0, y: h / 2 };
    case 'ne':
      return { x: w, y: 0 };
    case 'nw':
      return { x: 0, y: 0 };
    case 'sw':
      return { x: 0, y: h };
    case 'se':
    default:
      return { x: w, y: h };
  }
}

/** Anchor point (item-local) for a scale handle (the corner it sits on). */
export function scaleAnchorPoint(anchor: ScaleAnchor, w: number, h: number): { x: number; y: number } {
  switch (anchor) {
    case 'nw':
      return { x: 0, y: 0 };
    case 'ne':
      return { x: w, y: 0 };
    case 'sw':
      return { x: 0, y: h };
    case 'center':
      return { x: w / 2, y: h / 2 };
    case 'se':
    default:
      return { x: w, y: h };
  }
}

/** Default cursor per scale anchor. */
export function scaleCursor(anchor: ScaleAnchor): string {
  return anchor === 'ne' || anchor === 'sw' ? 'nesw-resize' : 'nwse-resize';
}

/** Anchor point (item-local) for a rotate handle (above the top-center). */
export function rotateAnchorPoint(w: number, offset: number): { x: number; y: number } {
  return { x: w / 2, y: -offset };
}

/** Default resize cursor per direction. */
export function resizeCursor(direction: Direction): string {
  switch (direction) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'nw':
    case 'se':
    default:
      return 'nwse-resize';
  }
}

/* ------------------------------------------------------------------ */
/* Hit-testing                                                         */
/* ------------------------------------------------------------------ */

export type HitResult =
  | { type: 'feature'; itemId: string; entry: FeatureHit }
  | { type: 'item'; itemId: string }
  | { type: 'empty' };

/** A registered feature, as seen by the hit-tester. */
export interface FeatureHit {
  id: string;
  itemId: string;
  kind: DragKind | string;
  /** Item-local logical hit region (live — reads current geometry). */
  getHitRect(): Rect;
  /** Cursor the canvas shows while hovering this feature. */
  cursor?: string;
}

export interface HitTestInput {
  /** Pointer position in logical canvas coordinates. */
  point: { x: number; y: number };
  /** Items ordered topmost-first (caller sorts by effective z). */
  itemsTopmostFirst: ItemGeometry[];
  /** All registered feature entries. */
  features: FeatureHit[];
}

/** Does `point` fall inside `rect` (inclusive edges)? */
export function pointInRect(point: { x: number; y: number }, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Convert a logical canvas point into an item's local (unrotated) space.
 * The item's rotation is applied to the pointer, so body + feature hit
 * rects can be tested as plain axis-aligned rects even for rotated items.
 */
export function toItemLocal(
  point: { x: number; y: number },
  item: ItemGeometry,
): { x: number; y: number } {
  const w = item.width ?? 0;
  const h = item.height ?? 0;
  const cx = item.x + w / 2;
  const cy = item.y + h / 2;
  const rot = ((item.rotation ?? 0) * Math.PI) / 180;
  const dx = point.x - cx;
  const dy = point.y - cy;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  return {
    x: dx * cos - dy * sin + w / 2,
    y: dx * sin + dy * cos + h / 2,
  };
}

/**
 * Hit-test: feature regions (of the topmost item under the cursor) first,
 * then item bodies, then empty space. Pure — no DOM involved.
 *
 * For a given item, its features are checked in reverse registration order
 * (last-registered first): a corner `ResizeHandle` renders after a
 * body-covering `MoveHandle`, so the corner wins — matching the visual
 * stacking of the anchor divs.
 */
export function hitTest(input: HitTestInput): HitResult {
  const { point, itemsTopmostFirst, features } = input;

  for (const item of itemsTopmostFirst) {
    const local = toItemLocal(point, item);

    // Features of this item, topmost (last-registered) first.
    const itemFeatures: FeatureHit[] = [];
    for (const entry of features) {
      if (entry.itemId === item.id) itemFeatures.push(entry);
    }
    for (let i = itemFeatures.length - 1; i >= 0; i--) {
      if (pointInRect(local, itemFeatures[i].getHitRect())) {
        return { type: 'feature', itemId: item.id, entry: itemFeatures[i] };
      }
    }

    // Item body.
    const w = item.width ?? 0;
    const h = item.height ?? 0;
    if (w > 0 && h > 0 && local.x >= 0 && local.x <= w && local.y >= 0 && local.y <= h) {
      return { type: 'item', itemId: item.id };
    }
  }

  return { type: 'empty' };
}
