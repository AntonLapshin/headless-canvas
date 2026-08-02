/**
 * headless-canvas — public entry point.
 *
 * A headless, declarative React canvas for placing, moving, resizing, scaling
 * and rotating positioned elements. Zero visual styles: interaction behavior
 * is complete, appearance is 100% consumer-owned via the data-attribute
 * contract.
 */

export { Canvas } from './Canvas';
export { Item } from './Item';
export {
  MoveHandle,
  ResizeHandle,
  ScaleHandle,
  RotateHandle,
} from './features';
export type {
  MoveHandleProps,
  ResizeHandleProps,
  ScaleHandleProps,
  RotateHandleProps,
} from './features';
export { useCanvas, useItem, useItemId } from './context';
export type { UseItemResult } from './context';
export { useFeatureRegistration } from './registry';
export type { DragContext, DragHandler, FeatureRegistrationOptions } from './registry';
export {
  snap,
  clamp,
  hitTest,
  moveGeometry,
  resizeGeometry,
  scaleGeometry,
  rotateToGeometry,
  normalizeRotation,
  toItemLocal,
  DEFAULT_MIN_SIZE,
} from './hit';
export type { DragOptions, HitResult, HitTestInput, FeatureHit } from './hit';
export type {
  CanvasHandle,
  CanvasProps,
  Constraints,
  Direction,
  DragKind,
  ItemGeometry,
  ItemProps,
  Rect,
  ScaleAnchor,
} from './types';
