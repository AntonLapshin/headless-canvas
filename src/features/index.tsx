/**
 * Built-in feature handles: MoveHandle, ResizeHandle, ScaleHandle, RotateHandle.
 *
 * Each handle is "headless": it renders ONE invisible anchor `<div>` with a
 * `data-feature` attribute (plus `data-direction` where relevant), registers
 * its geometric hit region + drag behavior with the canvas, and carries NO
 * visual styles. Consumers restyle by wrapping:
 *
 *   const MoveHandleStyled = () => (
 *     <div className={styles.handle}><MoveHandle /></div>
 *   );
 *
 * This is safe *because* hit-testing is coordinate-based: the DOM tree is
 * presentation only, so wrappers can never break interaction.
 */

import { memo, useCallback } from 'react';
import styles from '../canvas.module.scss';
import { useInternalCanvas, useItem, useItemId } from '../context';
import {
  HANDLE_SIZE,
  HIT_HALF,
  resizeAnchorPoint,
  resizeCursor,
  rotateAnchorPoint,
  scaleAnchorPoint,
  scaleCursor,
} from '../hit';
import { useFeatureRegistration, type DragHandler, type FeatureParams } from '../registry';
import type {
  Direction,
  DragKind,
  MoveHandleProps,
  Rect,
  ResizeHandleProps,
  RotateHandleProps,
  ScaleHandleProps,
} from '../types';

export type {
  MoveHandleProps,
  ResizeHandleProps,
  ScaleHandleProps,
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
 * Move affordance. Hit region = the item's whole body, so the item can be
 * grabbed anywhere to drag it.
 */
export const MoveHandle = memo(function MoveHandle({ cursor = 'move' }: MoveHandleProps) {
  const itemId = useItemId();
  const ctx = useInternalCanvas();
  const { geometry } = useItem();
  const point = { x: 0, y: 0 };

  const hitRect = useCallback((): Rect => {
    const g = ctx.getItem(itemId);
    return { x: 0, y: 0, width: g?.width ?? 0, height: g?.height ?? 0 };
  }, [ctx, itemId]);

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
 * edge fixed. No-op on auto-sized items (no explicit box to resize).
 */
export const ResizeHandle = memo(function ResizeHandle({
  direction = 'se',
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
      label={`Resize item (${direction})`}
      direction={direction}
      params={{ direction }}
      cursor={cursor ?? resizeCursor(direction)}
      locked={geometry.locked === true}
      disabled={ctx.disabled}
    />
  );
});

/* ------------------------------------------------------------------ */
/* ScaleHandle                                                         */
/* ------------------------------------------------------------------ */

/**
 * Proportional scale affordance. `anchor` picks the corner the handle sits on;
 * the opposite corner stays fixed ('se' keeps the top-left fixed, 'ne' the
 * bottom-left, …), `'center'` keeps the item center fixed.
 */
export const ScaleHandle = memo(function ScaleHandle({
  anchor = 'ne',
  cursor,
}: ScaleHandleProps) {
  const itemId = useItemId();
  const ctx = useInternalCanvas();
  const { geometry } = useItem();
  const w = geometry.width ?? 0;
  const h = geometry.height ?? 0;
  const point = scaleAnchorPoint(anchor, w, h);

  const hitRect = useCallback((): Rect => {
    const g = ctx.getItem(itemId);
    const p = scaleAnchorPoint(anchor, g?.width ?? 0, g?.height ?? 0);
    return { x: p.x - HIT_HALF, y: p.y - HIT_HALF, width: HIT_HALF * 2, height: HIT_HALF * 2 };
  }, [ctx, itemId, anchor]);

  return (
    <FeatureAnchor
      kind="scale"
      point={point}
      hitRect={hitRect}
      label="Scale item"
      params={{ anchor }}
      cursor={cursor ?? scaleCursor(anchor)}
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
