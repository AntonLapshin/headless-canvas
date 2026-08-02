/**
 * React context for the canvas.
 *
 * `<Canvas>` provides ONE context object, but subscription granularity is
 * split: stable values (width, height, scale, callbacks, registries) travel
 * through plain context — consumers' children do not re-render during a drag —
 * while geometry travels through the external store (`useSyncExternalStore`),
 * keyed by item id. Each `<Item>` subscribes to its own slice.
 */

import { createContext, useContext } from 'react';
import type { FeatureRegistry } from './registry';
import { useItemSnapshot, type GeometryStore } from './store';
import type { CanvasContextValue, Constraints, ItemGeometry } from './types';

/** Internal context shape: the public value plus library plumbing. */
export interface InternalCanvasContext extends CanvasContextValue {
  store: GeometryStore;
  registry: FeatureRegistry;
  disabled: boolean;
  constraints?: Constraints;
  snapToGrid?: number;
  /** Whether the canvas is in controlled-geometry mode (`items` prop). */
  controlled: boolean;
}

export const CanvasContext = createContext<InternalCanvasContext | null>(null);
export const ItemContext = createContext<string | null>(null);

function missingCanvas(): never {
  throw new Error(
    'headless-canvas: <Item>, features and hooks must be rendered inside a <Canvas>.',
  );
}

/** Internal hook: full context (store, registry, …). Throws outside <Canvas>. */
export function useInternalCanvas(): InternalCanvasContext {
  const ctx = useContext(CanvasContext);
  if (!ctx) missingCanvas();
  return ctx as InternalCanvasContext;
}

/** Public hook: canvas values for consumers. Throws outside <Canvas>. */
export function useCanvas(): CanvasContextValue {
  return useInternalCanvas();
}

/** The id of the nearest enclosing <Item>. Throws outside an <Item>. */
export function useItemId(): string {
  const id = useContext(ItemContext);
  if (id == null) {
    throw new Error(
      'headless-canvas: useItem/features must be rendered inside an <Item>.',
    );
  }
  return id;
}

export interface UseItemResult {
  id: string;
  geometry: ItemGeometry;
}

/** Public hook: the nearest <Item>'s id + live geometry (re-renders on change). */
export function useItem(): UseItemResult {
  const id = useItemId();
  const ctx = useInternalCanvas();
  const geometry = useItemSnapshot(ctx.store, id);
  return { id, geometry: geometry ?? { id, x: 0, y: 0 } };
}
