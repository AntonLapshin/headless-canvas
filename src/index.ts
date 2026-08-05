/**
 * headless-canvas — public entry point.
 *
 * A headless, declarative React canvas for placing, moving, resizing and
 * rotating positioned elements. Zero visual styles: interaction behavior
 * is complete, appearance is 100% consumer-owned via the data-attribute
 * contract.
 */

export { Canvas } from './Canvas';
export { Item } from './Item';
export {
  MoveHandle,
  ResizeHandle,
  RotateHandle,
  EdgeLines,
  RotateValue,
  ResizeValue,
} from './features';
export type {
  MoveHandleProps,
  ResizeHandleProps,
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
  measureEdges,
  DEFAULT_MIN_SIZE,
} from './hit';
export type {
  DragOptions,
  HitResult,
  HitTestInput,
  FeatureHit,
  EdgeMeasurement,
  EdgeSide,
  MeasureBounds,
} from './hit';
export type {
  ActiveDrag,
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
