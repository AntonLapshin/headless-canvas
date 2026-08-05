/**
 * Built-in features: handles (MoveHandle, ResizeHandle, RotateHandle) and
 * readouts (EdgeLines, RotateValue, ResizeValue).
 *
 * Handles are "headless": each renders ONE invisible anchor `<div>` with a
 * `data-feature` attribute (plus `data-direction` where relevant), registers
 * its geometric hit region + drag behavior with the canvas, and carries NO
 * visual styles. Consumers restyle by wrapping:
 *
 *   const MoveHandleStyled = () => (
 *     <div className={styles.handle}><MoveHandle /></div>
 *   );
 *
 * Readouts are "headless" in the same spirit: they render structure + data
 * attributes only when their drag is active (EdgeLines while moving,
 * RotateValue while rotating, ResizeValue while resizing) and carry no visual
 * styles — line color/width and number appearance are consumer CSS.
 *
 * This is safe *because* hit-testing is coordinate-based: the DOM tree is
 * presentation only, so wrappers can never break interaction.
 */

import { memo, useCallback, useMemo } from 'react';
import styles from '../canvas.module.scss';
import { useInternalCanvas, useItem, useItemId } from '../context';
import {
  HANDLE_SIZE,
  HIT_HALF,
  measureEdges,
  normalizeRotation,
  resizeAnchorPoint,
  resizeCursor,
  rotateAnchorPoint,
} from '../hit';
import { useFeatureRegistration, type DragHandler, type FeatureParams } from '../registry';
import type {
  Direction,
  DragKind,
  MoveHandleProps,
  Rect,
  ResizeHandleProps,
  RotateHandleProps,
} from '../types';

export type {
  MoveHandleProps,
  ResizeHandleProps,
  RotateHandleProps,
} from '../types';

interface FeatureAnchorProps {
  kind: DragKind | string;
  /** Item-local point the handle is anchored at (visual center). */
  point: { x: number; y: number };
  /** Stable hit-region function (reads live geometry). */
  hitRect: () => Rect;
  label: string;
  direction?: Direction;
  params?: FeatureParams;
  cursor?: string;
  onDrag?: DragHandler;
  locked: boolean;
  disabled: boolean;
}

/** Shared implementation for all built-in handles. */
function FeatureAnchor(props: FeatureAnchorProps) {
  const { kind, point, hitRect, label, direction, params, cursor, onDrag, locked, disabled } = props;
  const itemId = useItemId();
  useFeatureRegistration(itemId, kind, hitRect, { params, cursor, onDrag });

  return (
    <div
      className={styles.feature}
      data-feature={kind}
      data-direction={direction}
      style={{
        left: point.x - HANDLE_SIZE / 2,
        top: point.y - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
      }}
      role="button"
      aria-label={label}
      aria-disabled={disabled || locked}
      tabIndex={-1}
    />
  );
}

/* ------------------------------------------------------------------ */
/* MoveHandle                                                          */
/* ------------------------------------------------------------------ */

/**
 * Move affordance. Hit region = a small square around the handle anchor
 * (the item's top-left corner, where the styled kit draws the move glyph).
 * The item body is deliberately NOT a move region: body clicks pass through
 * to the item's content, so buttons, selects and links inside an item work
 * like any other DOM.
 */
export const MoveHandle = memo(function MoveHandle({ cursor = 'move' }: MoveHandleProps) {
  const ctx = useInternalCanvas();
  const { geometry } = useItem();
  const point = { x: 0, y: 0 };

  const hitRect = useCallback((): Rect => {
    // Anchor sits at the item-local origin (top-left); grab square around it.
    return { x: -HIT_HALF, y: -HIT_HALF, width: HIT_HALF * 2, height: HIT_HALF * 2 };
  }, []);

  return (
    <FeatureAnchor
      kind="move"
      point={point}
      hitRect={hitRect}
      label="Move item"
      cursor={cursor}
      locked={geometry.locked === true}
      disabled={ctx.disabled}
    />
  );
});

/* ------------------------------------------------------------------ */
/* ResizeHandle                                                        */
/* ------------------------------------------------------------------ */

/**
 * Resize affordance for one edge/corner. `n`/`w` handles keep the opposite
 * edge fixed. With `lockRatio` the item keeps its aspect ratio (corner
 * handles scale proportionally from the opposite corner; edge handles scale
 * the perpendicular axis around the item center). No-op on auto-sized items
 * (no explicit box to resize).
 */
export const ResizeHandle = memo(function ResizeHandle({
  direction = 'se',
  lockRatio = false,
  cursor,
}: ResizeHandleProps) {
  const itemId = useItemId();
  const ctx = useInternalCanvas();
  const { geometry } = useItem();
  const w = geometry.width ?? 0;
  const h = geometry.height ?? 0;
  const point = resizeAnchorPoint(direction, w, h);

  const hitRect = useCallback((): Rect => {
    const g = ctx.getItem(itemId);
    const p = resizeAnchorPoint(direction, g?.width ?? 0, g?.height ?? 0);
    return { x: p.x - HIT_HALF, y: p.y - HIT_HALF, width: HIT_HALF * 2, height: HIT_HALF * 2 };
  }, [ctx, itemId, direction]);

  return (
    <FeatureAnchor
      kind="resize"
      point={point}
      hitRect={hitRect}
      label={`Resize item (${direction})${lockRatio ? ', locked ratio' : ''}`}
      direction={direction}
      params={{ direction, lockRatio }}
      cursor={cursor ?? resizeCursor(direction)}
      locked={geometry.locked === true}
      disabled={ctx.disabled}
    />
  );
});

/* ------------------------------------------------------------------ */
/* RotateHandle                                                        */
/* ------------------------------------------------------------------ */

/** Rotate affordance: drag in a circle around the item center. */
export const RotateHandle = memo(function RotateHandle({
  offset = 24,
  cursor,
}: RotateHandleProps) {
  const itemId = useItemId();
  const ctx = useInternalCanvas();
  const { geometry } = useItem();
  const w = geometry.width ?? 0;
  const point = rotateAnchorPoint(w, offset);

  const hitRect = useCallback((): Rect => {
    const g = ctx.getItem(itemId);
    const p = rotateAnchorPoint(g?.width ?? 0, offset);
    return { x: p.x - HIT_HALF, y: p.y - HIT_HALF, width: HIT_HALF * 2, height: HIT_HALF * 2 };
  }, [ctx, itemId, offset]);

  return (
    <FeatureAnchor
      kind="rotate"
      point={point}
      hitRect={hitRect}
      label="Rotate item"
      params={{ offset }}
      cursor={cursor ?? 'grab'}
      locked={geometry.locked === true}
      disabled={ctx.disabled}
    />
  );
});

/* ------------------------------------------------------------------ */
/* Readouts (passive, no hit region — rendered only during their drag) */
/* ------------------------------------------------------------------ */

/**
 * Edge measurement lines: while the item is being MOVED, draws a line from
 * each edge of the item rectangle straight to the corresponding canvas edge,
 * with the pixel distance in the middle of each line. Lines never stop at
 * other items — the measurement target is always the canvas bound. Renders
 * nothing when idle. Headless: structure + `data-edge-line` /
 * `data-edge-value`; line color/width and number appearance are consumer CSS.
 */
export const EdgeLines = memo(function EdgeLines() {
  const itemId = useItemId();
  const ctx = useInternalCanvas();
  const { geometry } = useItem();
  const active = ctx.activeDrag;
  const moving = active?.itemId === itemId && active?.kind === 'move';
  const w = geometry.width ?? 0;
  const h = geometry.height ?? 0;

  const edges = useMemo(() => {
    if (!moving || w <= 0 || h <= 0) return [];
    return measureEdges(geometry, {
      minX: ctx.constraints?.minX ?? 0,
      minY: ctx.constraints?.minY ?? 0,
      maxX: ctx.constraints?.maxX ?? ctx.width,
      maxY: ctx.constraints?.maxY ?? ctx.height,
    });
  }, [moving, geometry, ctx, w, h]);

  if (!moving || edges.length === 0) return null;

  // Item-local line geometry. Lines extend outward from each edge; the label
  // sits at the midpoint (centered via the styled kit's CSS). Thickness uses
  // `--hc-edge-thickness` (default 1px) so styled kits can override the line
  // width without touching the headless geometry.
  const thickness = 'var(--hc-edge-thickness, 1px)';
  const lines = edges.map((e) => {
    const horizontal = e.edge === 'left' || e.edge === 'right';
    const style: React.CSSProperties = horizontal
      ? { left: e.edge === 'left' ? -e.distance : w, top: h / 2, width: e.distance, height: thickness }
      : { left: w / 2, top: e.edge === 'top' ? -e.distance : h, width: thickness, height: e.distance };
    return (
      <div key={e.edge} className={styles.edgeLine} data-edge-line={e.edge} style={style}>
        <span className={styles.edgeValue} data-edge-value>
          {Math.round(e.distance)}
        </span>
      </div>
    );
  });

  return (
    <div className={styles.readout} data-feature="edge-lines" aria-hidden="true">
      {lines}
    </div>
  );
});

/** Value readout shown while the item is being ROTATED: the current angle. */
export const RotateValue = memo(function RotateValue() {
  const itemId = useItemId();
  const ctx = useInternalCanvas();
  const { geometry } = useItem();
  const active = ctx.activeDrag;
  const rotating = active?.itemId === itemId && active?.kind === 'rotate';
  if (!rotating) return null;
  const w = geometry.width ?? 0;
  const deg = Math.round(normalizeRotation(geometry.rotation ?? 0));
  return (
    <div
      className={styles.readout}
      data-feature="rotate-value"
      data-value={deg}
      style={{ left: w / 2, top: -44 }}
      aria-hidden="true"
    >
      <span className={styles.edgeValue} data-edge-value>
        {deg}°
      </span>
    </div>
  );
});

/** Value readout shown while the item is being RESIZED: width × height. */
export const ResizeValue = memo(function ResizeValue() {
  const itemId = useItemId();
  const ctx = useInternalCanvas();
  const { geometry } = useItem();
  const active = ctx.activeDrag;
  const resizing = active?.itemId === itemId && active?.kind === 'resize';
  if (!resizing) return null;
  const w = Math.round(geometry.width ?? 0);
  const h = Math.round(geometry.height ?? 0);
  const direction = active?.direction ?? 'se';
  const p = resizeAnchorPoint(direction, w, h);
  const offset = 18;
  const dx = direction.includes('e') ? offset : direction.includes('w') ? -offset : 0;
  const dy = direction.includes('s') ? offset : direction.includes('n') ? -offset : 0;
  return (
    <div
      className={styles.readout}
      data-feature="resize-value"
      data-width={w}
      data-height={h}
      style={{ left: p.x + dx, top: p.y + dy }}
      aria-hidden="true"
    >
      <span className={styles.edgeValue} data-edge-value>
        {w} × {h}
      </span>
    </div>
  );
});
